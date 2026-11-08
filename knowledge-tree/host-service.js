import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createGithubSync, canonicalDocumentHash } from './github-sync.js';

const METHODS = ['status', 'configure', 'disconnect', 'listTrees', 'readTree', 'pushTree', 'hashDocument'];
const MAX_REQUEST_BYTES = 64 * 1024 * 1024;

export function validateConfiguration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw problem('INVALID_CONFIG', '请输入 GitHub 仓库配置。');
  const config = {};
  for (const key of ['owner', 'repo', 'branch', 'directory']) {
    if (typeof value[key] !== 'string') throw problem('INVALID_CONFIG', '仓库、分支和目录必须填写。');
    config[key] = value[key].trim();
  }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(config.owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(config.repo) || ['.', '..'].includes(config.repo)) throw problem('INVALID_CONFIG', 'GitHub 用户名或仓库名无效。');
  if (!config.branch || config.branch.length > 200 || /[\x00-\x20\x7f~^:?*\[\\]/.test(config.branch) || config.branch.includes('..') || config.branch.includes('@{') || config.branch.endsWith('.') || config.branch.startsWith('/') || config.branch.endsWith('/') || config.branch.includes('//') || config.branch.split('/').some(part => part.startsWith('.') || part.endsWith('.lock'))) throw problem('INVALID_CONFIG', 'GitHub 分支名无效。');
  if (!config.directory || config.directory.length > 200 || !config.directory.split('/').every(part => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part) && part !== '.' && part !== '..')) throw problem('INVALID_CONFIG', '目录必须是仓库中的安全相对路径，例如 knowledge-trees。');
  return config;
}

function problem(code, message) { return Object.assign(new Error(message), { code }); }

/** Token is held only in Host memory (or supplied by the Host environment), never on disk. */
export function createHostService({ configPath, environment = process.env, fetchImpl = globalThis.fetch } = {}) {
  const profile = String(environment.DSH_PROFILE || 'default').replace(/[^A-Za-z0-9_-]/g, '_');
  configPath ||= join(environment.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'knowledge-tree', profile + '.json');
  let sessionToken = '';
  let config = null;
  let loaded = false;
  let queue = Promise.resolve();

  async function load() {
    if (loaded) return;
    try {
      const saved = JSON.parse(await readFile(configPath, 'utf8'));
      config = validateConfiguration(saved);
    } catch (error) {
      if (error.code !== 'ENOENT') throw problem('CONFIG_READ_FAILED', 'GitHub 配置无法读取；原文件未被覆盖。');
    }
    loaded = true;
  }
  function token() { return sessionToken || environment.KNOWLEDGE_TREE_GITHUB_TOKEN || ''; }
  async function status() {
    await load();
    return { configured: config !== null, config, credentialAvailable: Boolean(token()), credentialSource: sessionToken ? 'session' : token() ? 'environment' : 'none' };
  }
  async function save(next) {
    await mkdir(join(configPath, '..'), { recursive: true, mode: 0o700 });
    const temp = configPath + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temp, configPath);
  }
  const github = createGithubSync({ fetchImpl, getConfig: async () => {
    await load();
    if (!config) throw problem('NOT_CONFIGURED', '请先配置 GitHub 仓库。');
    return config;
  }, getToken: async () => token() });

  async function execute(method, input = {}) {
    if (!METHODS.includes(method)) throw problem('NOT_FOUND', '未知操作。');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw problem('INVALID_REQUEST', '请求格式错误。');
    if (method === 'status') return status();
    if (method === 'configure') {
      const next = validateConfiguration(input);
      if (input.token !== undefined && (typeof input.token !== 'string' || input.token.length > 1024 || /[\r\n\x00]/.test(input.token))) throw problem('INVALID_TOKEN', 'Token 格式错误。');
      await save(next);
      config = next;
      loaded = true;
      if (input.token) sessionToken = input.token.trim();
      return status();
    }
    if (method === 'disconnect') {
      await load();
      // Keep the repository configuration for reconnecting. Remove only the session credential.
      sessionToken = '';
      return status();
    }
    if (method === 'hashDocument') return { hash: await canonicalDocumentHash(input.document) };
    if (method === 'listTrees') return github.listTrees();
    if (method === 'readTree') return github.readTree(input.treeId);
    return github.pushTree(input);
  }

  return {
    status,
    call(method, input) {
      // Configuration changes and remote writes cannot interleave across requests.
      const work = queue.then(() => execute(method, input));
      queue = work.catch(() => {});
      return work;
    },
    dispose() { sessionToken = ''; },
  };
}

const MESSAGES = {
  INVALID_CONFIG: 'GitHub 仓库配置无效。', INVALID_TREE_ID: '知识树标识无效。',
  INVALID_DOCUMENT: '知识树数据校验失败，未上传。', INVALID_REMOTE: '远端文件不完整或格式无效，未覆盖本地。',
  NOT_FOUND: '远端仓库、分支或知识树不存在，或没有读取权限。',
  CONFLICT: '远端已变化，请先查看远端；本次没有覆盖。',
  REF_CONFLICT: '提交期间远端分支发生变化，请刷新后重试；未强制覆盖。',
  LIMIT_EXCEEDED: '数据超过本版支持的大小限制，未执行覆盖。',
  HTTP_ERROR: 'GitHub 请求失败，请检查网络、Token 权限与仓库配置。',
  TIMEOUT: 'GitHub 请求超时，请稍后重试。',
  AUTH_ERROR: '请在 GitHub 配置中填写本次运行使用的 PAT，或给 Host 设置 KNOWLEDGE_TREE_GITHUB_TOKEN。',
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
          const message = MESSAGES[code] || ({ INVALID_REQUEST: '请求格式错误。', INVALID_TOKEN: 'Token 格式错误。', NOT_CONFIGURED: '请先配置 GitHub 仓库。', CONFIG_READ_FAILED: 'Host 无法读取 GitHub 配置，未覆盖原配置。' })[code] || '操作失败，请检查 Host 配置或重试。';
          return new Response(JSON.stringify({ ok: false, error: { code, message } }), { status: code.includes('CONFLICT') ? 409 : code === 'NOT_FOUND' ? 404 : 400, headers });
        }
      },
    });
  }
}
