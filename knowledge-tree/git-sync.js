import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, unlink, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalDocumentHash, GithubSyncError, treeFormat } from './github-sync.js';

/**
 * Git-over-SSH transport for the knowledge-tree workspace.
 *
 * Same on-disk remote format as the HTTPS connector (`<dir>/<treeId>/tree.json`, `tree.md`,
 * `assets/<sha256>.<ext>`), but all network work goes through the system `git` binary using
 * the user's ambient SSH configuration (ssh-agent / ~/.ssh/config). No PAT, no HTTPS.
 *
 * Reads are pinned to one fetched commit. Pushes are fast-forward only and are rejected when
 * the remote head is not the commit the caller based on; conflicts are never merged.
 */
const {
  MAX_IMAGE, MAX_FILE, MAX_SNAPSHOT_BYTES, MAX_TREE_ENTRIES, MAX_TREES,
  MIME_EXT, ASSET, TREE_ID, validateDocument, stable, markdown, imageBytes, digest, checkTreeId,
} = treeFormat;

const FETCH_TIMEOUT = 120_000;
const PUSH_TIMEOUT = 120_000;
const LOCAL_TIMEOUT = 30_000;
const MAX_GIT_OUTPUT = 64 * 1024 * 1024;
const GIT_IDENTITY = ['-c', 'user.name=knowledge-tree', '-c', 'user.email=knowledge-tree@localhost', '-c', 'commit.gpgsign=false'];
const SHA = /^[0-9a-f]{40}$/;
const REMOTE_REF = (branch) => `refs/remotes/origin/${branch}`;
const BRANCH_REF = (branch) => `refs/heads/${branch}`;

const MESSAGES = {
  GIT_MISSING: '未找到 git 命令，请先安装 git（macOS 可运行 xcode-select --install）。',
  SSH_AUTH: 'SSH 认证失败：请确认已把公钥加到 GitHub，且 ssh -T git@github.com 能在本机通过。',
  NOT_FOUND: '远端仓库、分支或知识树不存在，或当前 SSH 密钥没有访问权限。',
  CONFLICT: '远端已变化，请先查看远端；本次没有覆盖。',
  REF_CONFLICT: '提交期间远端分支发生变化，请刷新后重试；未强制覆盖。',
  NETWORK: '无法连接 GitHub（SSH）；请检查网络、代理与 SSH 配置。',
  TIMEOUT: 'Git 操作超时，请稍后重试。',
  INVALID_REMOTE: '远端文件不完整或格式无效，未覆盖本地。',
  INVALID_CONFIG: 'SSH 仓库配置无效。',
  INVALID_TREE_ID: '知识树标识无效。',
  INVALID_DOCUMENT: '知识树数据校验失败，未上传。',
  LIMIT_EXCEEDED: '数据超过本版支持的大小限制，未执行覆盖。',
  GIT_ERROR: 'Git 操作失败，请检查 SSH 配置与仓库状态。',
};

function fail(code) {
  const error = new GithubSyncError(code);
  error.message = MESSAGES[code] || MESSAGES.GIT_ERROR;
  return error;
}

function mapGitFailure(stderr) {
  const text = String(stderr || '');
  if (/permission denied|publickey|host key verification|could not read from remote repository|authentication failed|no such identity/i.test(text)) return 'SSH_AUTH';
  if (/couldn't find remote ref|remote branch .* not found|does not appear to be a git repository|repository not found|not found/i.test(text)) return 'NOT_FOUND';
  if (/non-fast-forward|fetch first|\[rejected\]|failed to push some refs/i.test(text)) return 'REF_CONFLICT';
  if (/could not resolve hostname|network is unreachable|connection timed out|connection refused|connection reset/i.test(text)) return 'NETWORK';
  return 'GIT_ERROR';
}

/** Validates a config produced by the Host. Tests may call the connector directly. */
export function validateGitConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('INVALID_CONFIG');
  const { remote, branch, directory } = value;
  if (typeof remote !== 'string' || remote.length > 300
    || !/^(?:git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?|ssh:\/\/git@github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?)$/.test(remote.trim())) {
    throw fail('INVALID_CONFIG');
  }
  if (typeof branch !== 'string' || !branch || branch.length > 200 || branch === '@'
    || /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) || branch.includes('..') || branch.includes('@{')
    || branch.startsWith('/') || branch.endsWith('/') || branch.includes('//') || branch.endsWith('.')
    || branch.split('/').some((part) => !part || part.startsWith('.') || part.endsWith('.lock'))) {
    throw fail('INVALID_CONFIG');
  }
  if (typeof directory !== 'string' || !directory || directory.length > 200
    || !directory.split('/').every((part) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part) && part !== '.' && part !== '..')) {
    throw fail('INVALID_CONFIG');
  }
  return { remote: remote.trim(), branch, directory };
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

export function createGitSync({ getConfig, cacheRoot, environment = process.env, git = 'git' } = {}) {
  if (typeof getConfig !== 'function') throw fail('INVALID_CONFIG');
  const root = cacheRoot || join(environment.DSH_HOME || join(environment.HOME || tmpdir(), '.dsh'), 'storages', 'knowledge-tree', 'git');

  function run(args, options = {}) {
    return new Promise((resolve, reject) => {
      execFile(
        git,
        args,
        {
          cwd: options.cwd,
          timeout: options.timeout || LOCAL_TIMEOUT,
          maxBuffer: MAX_GIT_OUTPUT,
          encoding: options.encoding || 'utf8',
          env: {
            ...environment,
            GIT_TERMINAL_PROMPT: '0',
            GIT_ASKPASS: 'echo',
            LC_ALL: 'C',
            ...(options.env || {}),
          },
        },
        (error, stdout, stderr) => {
          if (!error) return resolve({ stdout, stderr });
          if (error.code === 'ENOENT') return reject(fail('GIT_MISSING'));
          if (error.killed) return reject(fail('TIMEOUT'));
          reject(fail(mapGitFailure(stderr) ));
        },
      );
    });
  }

  async function context() {
    let raw;
    try { raw = await getConfig(); } catch { throw fail('INVALID_CONFIG'); }
    return validateGitConfig(raw);
  }

  const cachePath = (config) => join(root, digest(`${config.remote}\u0000${config.branch}`).slice(0, 24) + '.git');

  async function ensureRepo(config) {
    const dir = cachePath(config);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    if (!(await exists(join(dir, 'HEAD')))) await run(['init', '-q', '--initial-branch=main', dir], { timeout: LOCAL_TIMEOUT });
    let current = null;
    try { current = (await run(['-C', dir, 'remote', 'get-url', 'origin'])).stdout.trim(); } catch { /* no remote yet */ }
    if (current === null) await run(['-C', dir, 'remote', 'add', 'origin', config.remote]);
    else if (current !== config.remote) await run(['-C', dir, 'remote', 'set-url', 'origin', config.remote]);
    return dir;
  }

  async function fetchHead(config) {
    const dir = await ensureRepo(config);
    try {
      await run(['-C', dir, 'fetch', '--no-tags', '--prune', 'origin', `+${BRANCH_REF(config.branch)}:${REMOTE_REF(config.branch)}`], { timeout: FETCH_TIMEOUT });
    } catch (error) {
      if (error.code === 'REF_CONFLICT') throw fail('NOT_FOUND');
      throw error;
    }
    const head = await run(['-C', dir, 'rev-parse', '--verify', REMOTE_REF(config.branch)]);
    const commitSha = head.stdout.trim();
    if (!SHA.test(commitSha)) throw fail('INVALID_REMOTE');
    return { dir, commitSha };
  }

  async function snapshot(config) {
    const { dir, commitSha } = await fetchHead(config);
    const listing = await run(['-C', dir, 'ls-tree', '-r', '-l', '--full-tree', commitSha], { timeout: LOCAL_TIMEOUT });
    const entries = new Map();
    let total = 0;
    for (const line of listing.stdout.split('\n')) {
      if (!line) continue;
      const match = /^(\d{6}) (blob|tree) ([0-9a-f]{40})\s+(\d+|-)\t(.+)$/.exec(line);
      if (!match) throw fail('INVALID_REMOTE');
      const size = match[4] === '-' ? 0 : Number(match[4]);
      if (!Number.isFinite(size) || size < 0) throw fail('INVALID_REMOTE');
      total += size;
      entries.set(match[5], { mode: match[1], type: match[2], sha: match[3], size });
      if (entries.size > MAX_TREE_ENTRIES || total > MAX_SNAPSHOT_BYTES) throw fail('LIMIT_EXCEEDED');
    }
    return { dir, commitSha, entries };
  }

  async function blob(snap, path, maxBytes = MAX_FILE) {
    const entry = snap.entries.get(path);
    if (!entry || entry.type !== 'blob') throw fail('INVALID_REMOTE');
    if (entry.size > maxBytes) throw fail('LIMIT_EXCEEDED');
    const result = await run(['-C', snap.dir, 'cat-file', 'blob', entry.sha], { encoding: 'buffer', timeout: LOCAL_TIMEOUT });
    const bytes = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout);
    if (bytes.length !== entry.size || bytes.length > maxBytes) throw fail('INVALID_REMOTE');
    return bytes;
  }

  function utf8(bytes) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw fail('INVALID_REMOTE'); }
  }
  function parseJson(text) {
    try { return JSON.parse(text); } catch { throw fail('INVALID_REMOTE'); }
  }

  async function load(config, snap, treeId) {
    const prefix = `${config.directory}/`;
    const root = `${prefix}${treeId}/`;
    if (!snap.entries.has(`${root}tree.json`)) {
      if ([...snap.entries.keys()].some((path) => path === root.slice(0, -1) || path.startsWith(root))) throw fail('INVALID_REMOTE');
      throw fail('NOT_FOUND');
    }
    const envelope = parseJson(utf8(await blob(snap, `${root}tree.json`)));
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
      || envelope.format !== 'dsh-knowledge-tree' || envelope.version !== 1 || envelope.treeId !== treeId
      || Object.keys(envelope).some((key) => !['format', 'version', 'treeId', 'document'].includes(key))) throw fail('INVALID_REMOTE');
    validateDocument(envelope.document, 'INVALID_REMOTE', true);
    utf8(await blob(snap, `${root}tree.md`));
    let total = 0;
    for (const card of envelope.document.cards) {
      if (!card.image) continue;
      const bytes = await blob(snap, `${root}${card.image.asset}`, MAX_IMAGE);
      total += bytes.length;
      if (total > 12 * 1024 * 1024) throw fail('LIMIT_EXCEEDED');
      if (digest(bytes) !== ASSET.exec(card.image.asset)[1]) throw fail('INVALID_REMOTE');
      card.image = { data: `data:${card.image.mime};base64,${bytes.toString('base64')}`, mime: card.image.mime, w: card.image.w, h: card.image.h };
    }
    validateDocument(envelope.document, 'INVALID_REMOTE');
    return { treeId, document: envelope.document, hash: canonicalDocumentHash(envelope.document), commitSha: snap.commitSha, title: envelope.document.title };
  }

  async function listTrees() {
    const config = await context();
    const snap = await snapshot(config);
    const prefix = `${config.directory}/`;
    const ids = [];
    const partial = new Set();
    for (const path of snap.entries.keys()) {
      if (!path.startsWith(prefix)) continue;
      const relative = path.slice(prefix.length);
      const parts = relative.split('/');
      if ((parts.length === 2 && parts[1] === 'tree.md')
        || (parts.length === 3 && parts[1] === 'assets' && ASSET.test(parts.slice(1).join('/')))) {
        if (!TREE_ID.test(parts[0])) throw fail('INVALID_REMOTE');
        partial.add(parts[0]);
      }
      if (parts.length !== 2 || parts[1] !== 'tree.json') continue;
      if (!TREE_ID.test(parts[0])) throw fail('INVALID_REMOTE');
      ids.push(parts[0]);
    }
    if ([...partial].some((id) => !snap.entries.has(`${prefix}${id}/tree.json`))) throw fail('INVALID_REMOTE');
    if (ids.length > MAX_TREES) throw fail('LIMIT_EXCEEDED');
    const result = [];
    for (const id of ids.sort()) {
      const { document: _document, ...summary } = await load(config, snap, id);
      result.push(summary);
    }
    return result;
  }

  async function readTree(treeId) {
    checkTreeId(treeId);
    const config = await context();
    return load(config, await snapshot(config), treeId);
  }

  async function pushTree({ treeId, document, baseHash = null, baseDocument, message } = {}) {
    checkTreeId(treeId);
    validateDocument(document);
    if (baseHash !== null && (typeof baseHash !== 'string' || !/^[0-9a-f]{64}$/.test(baseHash))) throw fail('INVALID_DOCUMENT');
    if (baseDocument !== undefined && (baseHash === null || canonicalDocumentHash(baseDocument) !== baseHash)) throw fail('INVALID_DOCUMENT');
    if (message !== undefined && (typeof message !== 'string' || !message.trim() || message.length > 1000)) throw fail('INVALID_DOCUMENT');
    const local = JSON.parse(JSON.stringify(document));
    const hash = canonicalDocumentHash(local);
    const config = await context();
    const snap = await snapshot(config);
    let remote = null;
    try { remote = await load(config, snap, treeId); } catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
    if (remote !== null && remote.hash === hash) {
      return { treeId, hash, commitSha: snap.commitSha, title: local.title, noOp: true };
    }
    if ((remote === null ? null : remote.hash) !== baseHash) throw fail('CONFLICT');

    const root = `${config.directory}/${treeId}/`;
    const files = new Map();
    for (const card of local.cards) {
      if (!card.image) continue;
      const bytes = imageBytes(card.image, 'INVALID_DOCUMENT');
      const asset = `assets/${digest(bytes)}.${MIME_EXT[card.image.mime]}`;
      files.set(`${root}${asset}`, bytes);
      card.image = { asset, mime: card.image.mime, w: card.image.w, h: card.image.h };
    }
    const envelope = { format: 'dsh-knowledge-tree', version: 1, treeId, document: local };
    files.set(`${root}tree.json`, Buffer.from(`${stable(envelope)}\n`));
    files.set(`${root}tree.md`, markdown(local));
    for (const bytes of files.values()) if (bytes.length > MAX_FILE) throw fail('LIMIT_EXCEEDED');

    const worktree = await mkdtemp(join(tmpdir(), 'kt-ssh-'));
    try {
      await run(['-C', snap.dir, 'worktree', 'add', '--detach', worktree, snap.commitSha], { timeout: LOCAL_TIMEOUT });
      const targetDir = join(worktree, config.directory, treeId);
      await mkdir(join(targetDir, 'assets'), { recursive: true });
      for (const [path, bytes] of files) {
        const destination = join(worktree, path);
        await mkdir(join(destination, '..'), { recursive: true });
        await writeFile(destination, bytes);
      }
      const kept = new Set([...files.keys()].filter((path) => path.startsWith(`${root}assets/`)));
      let existing = [];
      try { existing = await readdir(join(targetDir, 'assets')); } catch { existing = []; }
      for (const name of existing) {
        const path = `${root}assets/${name}`;
        if (!kept.has(path)) await unlink(join(worktree, path)).catch(() => {});
      }
      await run(['-C', worktree, 'add', '-A', '--', root], { timeout: LOCAL_TIMEOUT });
      const commit = await run(['-C', worktree, ...GIT_IDENTITY, 'commit', '-q', '-m', message || `Sync knowledge tree ${treeId}`], { timeout: LOCAL_TIMEOUT });
      void commit;
      const head = (await run(['-C', worktree, 'rev-parse', 'HEAD'])).stdout.trim();
      if (!SHA.test(head)) throw fail('INVALID_REMOTE');
      try {
        await run(['-C', worktree, 'push', '--no-verify', 'origin', `${head}:${BRANCH_REF(config.branch)}`], { timeout: PUSH_TIMEOUT });
      } catch (error) {
        if (error.code === 'REF_CONFLICT' || error.code === 'GIT_ERROR') throw fail('REF_CONFLICT');
        throw error;
      }
      await run(['-C', snap.dir, 'update-ref', REMOTE_REF(config.branch), head]).catch(() => {});
      return { treeId, hash, commitSha: head, title: local.title, noOp: false };
    } finally {
      await run(['-C', snap.dir, 'worktree', 'remove', '--force', worktree], { timeout: LOCAL_TIMEOUT }).catch(() => {});
      await rm(worktree, { recursive: true, force: true }).catch(() => {});
    }
  }

  /** Lightweight connectivity/auth probe: fetch the configured branch. */
  async function check() {
    const config = await context();
    const { commitSha } = await fetchHead(config);
    return { ok: true, commitSha, remote: config.remote, branch: config.branch };
  }

  return { listTrees, readTree, pushTree, check, validateGitConfig };
}
