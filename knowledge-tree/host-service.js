import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonicalDocumentHash } from './github-sync.js';
import { createGitSync, validateGitConfig } from './git-sync.js';

const METHODS = ['status', 'configure', 'disconnect', 'check', 'listTrees', 'readTree', 'pushTree', 'hashDocument'];
const MAX_REQUEST_BYTES = 64 * 1024 * 1024;

function problem(code, message) { return Object.assign(new Error(message), { code }); }

/** Accepts the SSH config, and migrates a previously saved HTTPS config to its SSH remote. */
export function validateConfiguration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw problem('INVALID_CONFIG', '请输入 SSH 仓库配置。');
  let input = value;
  if (typeof input.remote !== 'string' && typeof input.owner === 'string' && typeof input.repo === 'string') {
    const repo = String(input.repo).replace(/\.git$/, '');
    input = { remote: `git@github.com:${input.owner}/${repo}.git`, branch: input.branch, directory: input.directory };
  }
  try {
    return validateGitConfig(input);
  } catch (error) {
    const message = error.code === 'INVALID_CONFIG' ? 'SSH 仓库配置无效：需要形如 git@github.com:owner/repo.git 的地址、合法分支和安全目录。' : 'SSH 仓库配置无效。';
    throw problem(error.code || 'INVALID_CONFIG', message);
  }
}

/** Repository config lives on disk; SSH credentials come from the user's ssh-agent / ~/.ssh/config. */
export function createHostService({ configPath, environment = process.env } = {}) {
  const profile = String(environment.DSH_PROFILE || 'default').replace(/[^A-Za-z0-9_-]/g, '_');
  configPath ||= join(environment.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'knowledge-tree', profile + '.json');
  let config = null;
  let loaded = false;
  let gitAvailable = null;
  let queue = Promise.resolve();

  async function load() {
    if (loaded) return;
    try {
      const saved = JSON.parse(await readFile(configPath, 'utf8'));
      config = validateConfiguration(saved);
    } catch (error) {
      if (error.code !== 'ENOENT') throw problem('CONFIG_READ_FAILED', 'SSH 仓库配置无法读取；原文件未被覆盖。');
    }
    loaded = true;
  }

  function checkGit() {
    if (gitAvailable !== null) return Promise.resolve(gitAvailable);
    return new Promise((resolve) => {
      execFile('git', ['--version'], { timeout: 10_000 }, (error) => {
        gitAvailable = !error;
        resolve(gitAvailable);
      });
    });
  }

  async function status() {
    await load();
    const available = await checkGit();
    return {
      configured: config !== null,
      config,
      transport: 'ssh',
      gitAvailable: available,
      gitVersion: available ? 'git' : null,
    };
  }

  async function save(next) {
    await mkdir(join(configPath, '..'), { recursive: true, mode: 0o700 });
    const temp = configPath + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temp, configPath);
  }

  const git = createGitSync({
    environment,
    getConfig: async () => {
      await load();
      if (!config) throw problem('NOT_CONFIGURED', '请先配置 SSH 仓库地址。');
      return config;
    },
  });

  async function execute(method, input = {}) {
    if (!METHODS.includes(method)) throw problem('NOT_FOUND', '未知操作。');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw problem('INVALID_REQUEST', '请求格式错误。');
    if (method === 'status') return status();
    if (method === 'configure') {
      const next = validateConfiguration(input);
      if (!(await checkGit())) throw problem('GIT_MISSING', MESSAGES.GIT_MISSING);
      await save(next);
      config = next;
      loaded = true;
      return status();
    }
    if (method === 'disconnect') {
      await load();
      // Nothing secret is stored: keep the repository config for reconnecting.
      return status();
    }
    if (method === 'hashDocument') return { hash: await canonicalDocumentHash(input.document) };
    if (method === 'check') return git.check();
    if (method === 'listTrees') return git.listTrees();
    if (method === 'readTree') return git.readTree(input.treeId);
    return git.pushTree(input);
  }

  return {
    status,
    call(method, input) {
      // Configuration changes and remote writes cannot interleave across requests.
      const work = queue.then(() => execute(method, input));
      queue = work.catch(() => {});
      return work;
    },
    dispose() {},
  };
}

const MESSAGES = {
  INVALID_CONFIG: 'SSH 仓库配置无效。',
  INVALID_TREE_ID: '知识树标识无效。',
  INVALID_DOCUMENT: '知识树数据校验失败，未上传。',
  INVALID_REMOTE: '远端文件不完整或格式无效，未覆盖本地。',
  NOT_FOUND: '远端仓库、分支或知识树不存在，或当前 SSH 密钥没有权限。',
  CONFLICT: '远端已变化，请先查看远端；本次没有覆盖。',
  REF_CONFLICT: '提交期间远端分支发生变化，请刷新后重试；未强制覆盖。',
  LIMIT_EXCEEDED: '数据超过本版支持的大小限制，未执行覆盖。',
  GIT_MISSING: '未找到 git 命令，请先安装 git（macOS 可运行 xcode-select --install）。',
  SSH_AUTH: 'SSH 认证失败：请确认公钥已添加到 GitHub，且 ssh -T git@github.com 在本机可用。',
  NETWORK: '无法连接 GitHub（SSH）：请检查网络、代理与 SSH 配置。',
  GIT_ERROR: 'Git 操作失败：请检查 SSH 配置与仓库状态。',
  TIMEOUT: 'Git 操作超时，请稍后重试。',
  HTTP_ERROR: '远端请求失败，请检查网络与仓库配置。',
  AUTH_ERROR: 'SSH 认证失败：请确认本机 SSH 密钥可用。',
};

/** Routes inherit DSH connection's owner authentication and Host/Origin fence. */
export function registerHostRoutes(ctx, service) {
  for (const method of METHODS) {
    ctx.connection.fetch.register({
      path: '/api/knowledge-tree/' + method,
      methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
        try {
          if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw problem('INVALID_REQUEST', '需要 JSON 请求。');
          const declared = Number(request.headers.get('content-length'));
          if (declared > MAX_REQUEST_BYTES) throw problem('LIMIT_EXCEEDED', MESSAGES.LIMIT_EXCEEDED);
          const bytes = await request.arrayBuffer();
          if (bytes.byteLength > MAX_REQUEST_BYTES) throw problem('LIMIT_EXCEEDED', MESSAGES.LIMIT_EXCEEDED);
          let input;
          try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw problem('INVALID_REQUEST', '请求 JSON 无效。'); }
          return new Response(JSON.stringify({ ok: true, result: await service.call(method, input) }), { headers });
        } catch (error) {
          const code = /^[A-Z_]+$/.test(error.code || '') ? error.code : 'INTERNAL_ERROR';
          const message = MESSAGES[code] || ({ INVALID_REQUEST: '请求格式错误。', NOT_CONFIGURED: '请先配置 SSH 仓库地址。', CONFIG_READ_FAILED: 'Host 无法读取 SSH 仓库配置，未覆盖原配置。' })[code] || '操作失败，请检查 Host 配置或重试。';
          return new Response(JSON.stringify({ ok: false, error: { code, message } }), { status: code.includes('CONFLICT') ? 409 : code === 'NOT_FOUND' ? 404 : 400, headers });
        }
      },
    });
  }
}
