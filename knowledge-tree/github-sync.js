import { createHash } from 'node:crypto';

/** Standalone Node ESM adapter. No network work happens until a method is called.
 * getConfig: async () => ({ owner, repo, branch, directory }); getToken: async () => token.
 * A missing branch/repository is NOT_FOUND (creating repositories/branches is deliberately unsupported).
 * baseHash is the SHA-256 of the hydrated document, not a Git blob/commit SHA.
 * Conflicts are rejected, never merged. All reads are pinned to one commit.
 */
const API = 'https://api.github.com';
const TIMEOUT_MS = 15_000;
const MAX_IMAGE = 512 * 1024;
const MAX_FILE = 4 * 1024 * 1024;
const MAX_DOCUMENT = 20 * 1024 * 1024;
const MAX_ASSETS = 12 * 1024 * 1024;
const MAX_RESPONSE = 24 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
const MAX_TREE_ENTRIES = 100_000;
const MAX_TREES = 500;
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const TREE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const ASSET = /^assets\/([0-9a-f]{64})\.(png|jpg|gif|webp)$/;
const VOLATILE = new Set(['updatedAt', 'ui', 'view', 'collapsed', 'expanded', 'prompt', 'savedAt']);
const MESSAGES = {
  INVALID_CONFIG: 'Invalid GitHub sync configuration.',
  INVALID_TREE_ID: 'Invalid tree identifier.',
  INVALID_DOCUMENT: 'Invalid knowledge-tree document.',
  INVALID_REMOTE: 'Invalid or incomplete remote knowledge-tree data.',
  NOT_FOUND: 'The requested repository, branch, or tree was not found.',
  CONFLICT: 'The remote tree changed. Pull it before pushing again.',
  REF_CONFLICT: 'The branch advanced during push. Pull it before retrying.',
  LIMIT_EXCEEDED: 'GitHub sync size or enumeration limit exceeded; no partial result is returned.',
  HTTP_ERROR: 'GitHub API request failed.',
  TIMEOUT: 'GitHub API request timed out.',
  AUTH_ERROR: 'GitHub credentials are unavailable.',
};

export class GithubSyncError extends Error {
  constructor(code, status) {
    super(MESSAGES[code]);
    this.name = 'GithubSyncError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}
const fail = (code, status) => { throw new GithubSyncError(code, status); };
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)
  && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBlobHash = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const own = (x, key) => Object.prototype.hasOwnProperty.call(x, key);

function checkTreeId(id) {
  if (typeof id !== 'string' || !TREE_ID.test(id)) fail('INVALID_TREE_ID');
  return id;
}

function configValue(value) {
  if (!object(value)) fail('INVALID_CONFIG');
  const { owner, repo, branch, directory } = value;
  if (typeof owner !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)
    || typeof repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || repo === '.' || repo === '..'
    || typeof branch !== 'string' || branch.length > 200 || !branch || branch === '@'
    || /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) || branch.includes('..') || branch.includes('@{')
    || branch.split('/').some((part) => !part || part.startsWith('.') || part.endsWith('.') || part.endsWith('.lock'))
    || typeof directory !== 'string' || directory.length > 200 || !directory
    || directory.split('/').some((part) => !/^[A-Za-z0-9_.-]+$/.test(part) || part === '.' || part === '..')) {
    fail('INVALID_CONFIG');
  }
  return { owner, repo, branch, directory };
}

// Refuse non-JSON values rather than silently dropping them via JSON.stringify.
function jsonValue(value, code, seen = new Set(), depth = 0) {
  if (depth > 40) fail(code);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if ((!object(value) && !Array.isArray(value)) || seen.has(value)) fail(code);
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      if (!own(value, i)) fail(code);
      jsonValue(value[i], code, seen, depth + 1);
    }
  } else {
    for (const [key, child] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') fail(code);
      jsonValue(child, code, seen, depth + 1);
    }
  }
  seen.delete(value);
}

function base64Bytes(text, code, wrapped = false) {
  if (typeof text !== 'string') fail(code);
  const clean = wrapped ? text.replace(/[\r\n]/g, '') : text;
  if (!clean || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) fail(code);
  const bytes = Buffer.from(clean, 'base64');
  if (bytes.toString('base64') !== clean) fail(code);
  return bytes;
}

function imageBytes(image, code) {
  if (!object(image) || !own(MIME_EXT, image.mime) || typeof image.data !== 'string'
    || Object.keys(image).some((key) => !['data', 'mime', 'w', 'h'].includes(key))
    || !Number.isInteger(image.w) || image.w < 0 || image.w > 32768
    || !Number.isInteger(image.h) || image.h < 0 || image.h > 32768) fail(code);
  const prefix = `data:${image.mime};base64,`;
  if (!image.data.startsWith(prefix)) fail(code);
  if (image.data.length > MAX_IMAGE * 4 / 3 + 100) fail('LIMIT_EXCEEDED');
  const bytes = base64Bytes(image.data.slice(prefix.length), code);
  if (bytes.length > MAX_IMAGE) fail('LIMIT_EXCEEDED');
  const valid = image.mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : image.mime === 'image/jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : image.mime === 'image/gif' ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'))
        : bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
          && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!valid) fail(code);
  return bytes;
}

function validateDocument(doc, code = 'INVALID_DOCUMENT', stored = false) {
  jsonValue(doc, code);
  if (!object(doc) || ![2, 3].includes(doc.version) || !['brainstorm', 'classify', 'tree'].includes(doc.stage)
    || typeof doc.title !== 'string' || doc.title.length > 60
    || !Array.isArray(doc.cards) || !Array.isArray(doc.links)
    || (own(doc, 'updatedAt') && (typeof doc.updatedAt !== 'number' || !Number.isFinite(doc.updatedAt)))) fail(code);
  if (doc.cards.length > 5000 || doc.links.length > 10000) fail('LIMIT_EXCEEDED');
  const ids = new Set();
  const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
  let imageTotal = 0;
  for (const card of doc.cards) {
    if (!object(card) || !validId(card.id) || ids.has(card.id) || typeof card.title !== 'string'
      || !card.title.trim() || card.title.length > 120 || typeof card.content !== 'string' || card.content.length > 4000
      || typeof card.placed !== 'boolean' || typeof card.order !== 'number' || !Number.isFinite(card.order)
      || typeof card.createdAt !== 'number' || !Number.isFinite(card.createdAt)) fail(code);
    ids.add(card.id);
    if (card.image !== undefined && card.image !== null) {
      if (!stored) imageTotal += imageBytes(card.image, code).length;
      else {
        const im = card.image;
        if (!object(im) || !own(MIME_EXT, im.mime) || typeof im.asset !== 'string' || !ASSET.test(im.asset)
          || !im.asset.endsWith(`.${MIME_EXT[im.mime]}`)
          || Object.keys(im).some((key) => !['asset', 'mime', 'w', 'h'].includes(key))
          || !Number.isInteger(im.w) || im.w < 0 || im.w > 32768
          || !Number.isInteger(im.h) || im.h < 0 || im.h > 32768) fail(code);
      }
    }
  }
  if (imageTotal > MAX_ASSETS) fail('LIMIT_EXCEEDED');
  const linkIds = new Set();
  const pairs = new Set();
  const primary = new Map();
  for (const link of doc.links) {
    if (!object(link) || !validId(link.id) || linkIds.has(link.id) || !ids.has(link.parentId)
      || !ids.has(link.childId) || link.parentId === link.childId || typeof link.primary !== 'boolean'
      || pairs.has(`${link.parentId}\0${link.childId}`)) fail(code);
    linkIds.add(link.id);
    pairs.add(`${link.parentId}\0${link.childId}`);
    if (link.primary) {
      if (primary.has(link.childId)) fail(code);
      primary.set(link.childId, link.parentId);
    }
  }
  // Primary cycles are corruption, not something to fix silently on pull.
  for (const id of ids) {
    const visited = new Set();
    let cursor = id;
    while (primary.has(cursor)) {
      if (visited.has(cursor)) fail(code);
      visited.add(cursor);
      cursor = primary.get(cursor);
    }
  }
  if (Buffer.byteLength(JSON.stringify(doc)) > MAX_DOCUMENT) fail('LIMIT_EXCEEDED');
  return doc;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Hash all content (including cards and hydrated images), ignoring only top-level UI/save metadata. */
export function canonicalDocumentHash(document) {
  validateDocument(document);
  const content = Object.fromEntries(Object.entries(document).filter(([key]) => !VOLATILE.has(key)));
  return digest(stable(content));
}

function utf8(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail('INVALID_REMOTE'); }
}
function parseJson(text) {
  try { return JSON.parse(text); }
  catch { fail('INVALID_REMOTE'); }
}
function sha(value) {
  if (typeof value !== 'string' || !SHA.test(value)) fail('INVALID_REMOTE');
  return value;
}

function markdown(document) {
  const escape = (text) => text.replace(/[\\`*_{}\[\]<>#!|]/g, '\\$&').replace(/[\r\n]/g, ' ');
  const lines = [`# ${escape(document.title || 'Knowledge Tree')}`, ''];
  // Every card is included exactly once. Relations are explicit, not a lossy outline projection.
  for (const card of document.cards) {
    lines.push(`## ${escape(card.title)}`, '', card.content, '');
    if (card.image) lines.push(`![${escape(card.title)}](${card.image.asset})`, '');
    lines.push(`Card: \`${card.id}\``, '');
  }
  if (document.links.length) {
    lines.push('## Relations', '');
    for (const link of document.links) lines.push(`- \`${link.parentId}\` → \`${link.childId}\` (${link.primary ? 'primary' : 'related'})`);
  }
  return Buffer.from(`${lines.join('\n')}\n`);
}

/** Format helpers shared by other transports (git over SSH reuses the same on-disk tree format). */
export const treeFormat = {
  MAX_IMAGE, MAX_FILE, MAX_DOCUMENT, MAX_ASSETS, MAX_RESPONSE, MAX_SNAPSHOT_BYTES,
  MAX_TREE_ENTRIES, MAX_TREES, MIME_EXT, TREE_ID, ASSET,
  validateDocument, stable, markdown, imageBytes, digest, gitBlobHash, checkTreeId,
};

/**
 * Legacy HTTPS/PAT adapter. The Host now pushes over SSH via `git-sync.js`; this adapter is
 * kept for the shared on-disk format and its tests, and can still be used directly.
 */
export function createGithubSync({ fetchImpl = globalThis.fetch, getToken, getConfig } = {}) {
  if (typeof fetchImpl !== 'function' || typeof getToken !== 'function' || typeof getConfig !== 'function') fail('INVALID_CONFIG');

  async function context() {
    let raw;
    try { raw = await getConfig(); } catch { fail('INVALID_CONFIG'); }
    const config = configValue(raw);
    let token;
    try { token = await getToken(); } catch { fail('AUTH_ERROR'); }
    if (typeof token !== 'string' || !token.trim() || token.length > 4096 || /[\r\n]/.test(token)) fail('AUTH_ERROR');
    const root = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;

    async function request(method, path, body, refUpdate = false) {
      const controller = new AbortController();
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new GithubSyncError('TIMEOUT')); }, TIMEOUT_MS);
      });
      const operation = async () => {
        let response;
        try {
          response = await fetchImpl(`${API}${root}${path}`, {
            method, redirect: 'error', signal: controller.signal,
            headers: {
              Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
              'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json',
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        } catch { fail('HTTP_ERROR'); }
        if (!response || typeof response.status !== 'number' || typeof response.text !== 'function') fail('HTTP_ERROR');
        if (response.status < 200 || response.status >= 300) {
          if (refUpdate && [409, 422].includes(response.status)) fail('REF_CONFLICT', response.status);
          fail(response.status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR', response.status);
        }
        if (/rel\s*=\s*["']?next\b/i.test(response.headers?.get('link') || '')) fail('LIMIT_EXCEEDED');
        const length = Number(response.headers?.get('content-length'));
        if (Number.isFinite(length) && length > MAX_RESPONSE) fail('LIMIT_EXCEEDED');
        let text;
        if (response.body && typeof response.body.getReader === 'function') {
          const reader = response.body.getReader();
          const chunks = [];
          let total = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              total += value.byteLength;
              if (total > MAX_RESPONSE) {
                controller.abort();
                void reader.cancel().catch(() => {});
                fail('LIMIT_EXCEEDED');
              }
              chunks.push(Buffer.from(value));
            }
          } catch (error) {
            if (error instanceof GithubSyncError) throw error;
            fail('HTTP_ERROR');
          } finally { reader.releaseLock(); }
          text = utf8(Buffer.concat(chunks, total));
        } else {
          try { text = await response.text(); } catch { fail('HTTP_ERROR'); }
          if (typeof text !== 'string') fail('INVALID_REMOTE');
          if (Buffer.byteLength(text) > MAX_RESPONSE) fail('LIMIT_EXCEEDED');
        }
        return parseJson(text);
      };
      try { return await Promise.race([operation(), timeout]); }
      finally { clearTimeout(timer); }
    }
    return { ...config, request };
  }

  async function snapshot(ctx) {
    const ref = await ctx.request('GET', `/git/ref/heads/${ctx.branch.split('/').map(encodeURIComponent).join('/')}`);
    if (!object(ref) || !object(ref.object) || ref.object.type !== 'commit') fail('INVALID_REMOTE');
    const commitSha = sha(ref.object.sha);
    const commit = await ctx.request('GET', `/git/commits/${commitSha}`);
    if (!object(commit) || commit.sha !== commitSha || !object(commit.tree)) fail('INVALID_REMOTE');
    const treeSha = sha(commit.tree.sha);
    const tree = await ctx.request('GET', `/git/trees/${treeSha}?recursive=1`);
    if (!object(tree) || tree.sha !== treeSha || typeof tree.truncated !== 'boolean' || !Array.isArray(tree.tree)) fail('INVALID_REMOTE');
    if (tree.truncated || tree.tree.length > MAX_TREE_ENTRIES) fail('LIMIT_EXCEEDED');
    const entries = new Map();
    for (const entry of tree.tree) {
      if (!object(entry) || typeof entry.path !== 'string' || !entry.path || entries.has(entry.path)
        || !['blob', 'tree', 'commit'].includes(entry.type)) fail('INVALID_REMOTE');
      sha(entry.sha);
      entries.set(entry.path, entry);
    }
    return { commitSha, treeSha, entries, blobs: new Map(), blobBytes: 0 };
  }

  function managedEntry(snap, path, maxBytes = MAX_FILE) {
    const entry = snap.entries.get(path);
    if (!entry || entry.type !== 'blob' || entry.mode !== '100644'
      || !Number.isSafeInteger(entry.size) || entry.size < 0) fail('INVALID_REMOTE');
    if (entry.size > maxBytes) fail('LIMIT_EXCEEDED');
    return entry;
  }

  async function blob(ctx, snap, path, maxBytes = MAX_FILE) {
    const entry = managedEntry(snap, path, maxBytes);
    if (!snap.blobs.has(entry.sha)) {
      if (snap.blobBytes + entry.size > MAX_SNAPSHOT_BYTES) fail('LIMIT_EXCEEDED');
      let result;
      try { result = await ctx.request('GET', `/git/blobs/${entry.sha}`); }
      catch (error) { if (error.code === 'NOT_FOUND') fail('INVALID_REMOTE'); throw error; }
      if (!object(result) || result.sha !== entry.sha || result.encoding !== 'base64'
        || !Number.isSafeInteger(result.size) || result.size !== entry.size) fail('INVALID_REMOTE');
      if (result.size > maxBytes) fail('LIMIT_EXCEEDED');
      const bytes = base64Bytes(result.content, 'INVALID_REMOTE', true);
      if (bytes.length !== result.size || gitBlobHash(bytes) !== entry.sha) fail('INVALID_REMOTE');
      snap.blobs.set(entry.sha, bytes);
      snap.blobBytes += bytes.length;
    }
    const bytes = snap.blobs.get(entry.sha);
    if (bytes.length !== entry.size || bytes.length > maxBytes) fail('INVALID_REMOTE');
    return bytes;
  }

  async function load(ctx, snap, treeId) {
    const root = `${ctx.directory}/${treeId}/`;
    if (!snap.entries.has(`${root}tree.json`)) {
      // A partial previous/manual upload must not be treated as an empty slot and overwritten.
      if ([...snap.entries.keys()].some((path) => path === root.slice(0, -1) || path.startsWith(root))) fail('INVALID_REMOTE');
      fail('NOT_FOUND');
    }
    const envelope = parseJson(utf8(await blob(ctx, snap, `${root}tree.json`)));
    if (!object(envelope) || envelope.format !== 'dsh-knowledge-tree' || envelope.version !== 1
      || envelope.treeId !== treeId || Object.keys(envelope).some((key) => !['format', 'version', 'treeId', 'document'].includes(key))) fail('INVALID_REMOTE');
    validateDocument(envelope.document, 'INVALID_REMOTE', true);
    // The companion markdown is part of the format; refuse partial or oversized uploads.
    utf8(await blob(ctx, snap, `${root}tree.md`));
    let total = 0;
    for (const card of envelope.document.cards) {
      if (!card.image) continue;
      const image = card.image;
      const bytes = await blob(ctx, snap, `${root}${image.asset}`, MAX_IMAGE);
      total += bytes.length;
      if (total > MAX_ASSETS) fail('LIMIT_EXCEEDED');
      if (digest(bytes) !== ASSET.exec(image.asset)[1]) fail('INVALID_REMOTE');
      card.image = { data: `data:${image.mime};base64,${bytes.toString('base64')}`, mime: image.mime, w: image.w, h: image.h };
    }
    validateDocument(envelope.document, 'INVALID_REMOTE');
    return {
      treeId, document: envelope.document, hash: canonicalDocumentHash(envelope.document),
      commitSha: snap.commitSha, title: envelope.document.title,
    };
  }

  async function listTrees() {
    const ctx = await context();
    const snap = await snapshot(ctx);
    const prefix = `${ctx.directory}/`;
    const ids = [];
    const partialIds = new Set();
    for (const path of snap.entries.keys()) {
      if (!path.startsWith(prefix)) continue;
      const relative = path.slice(prefix.length);
      const parts = relative.split('/');
      // Exact, immediate manifest paths only. Unrelated repository files are not trees.
      if (parts.length === 2 && parts[1] === 'tree.md'
        || parts.length === 3 && parts[1] === 'assets' && ASSET.test(parts.slice(1).join('/'))) {
        if (!TREE_ID.test(parts[0])) fail('INVALID_REMOTE');
        partialIds.add(parts[0]);
      }
      if (parts.length !== 2 || parts[1] !== 'tree.json') continue;
      if (!TREE_ID.test(parts[0])) fail('INVALID_REMOTE');
      ids.push(parts[0]);
    }
    if ([...partialIds].some((id) => !snap.entries.has(`${prefix}${id}/tree.json`))) fail('INVALID_REMOTE');
    if (ids.length > MAX_TREES) fail('LIMIT_EXCEEDED');
    const result = [];
    for (const id of ids.sort()) {
      const { document: _document, ...summary } = await load(ctx, snap, id);
      result.push(summary);
    }
    return result;
  }

  async function readTree(treeId) {
    checkTreeId(treeId);
    const ctx = await context();
    return load(ctx, await snapshot(ctx), treeId);
  }

  async function pushTree({ treeId, document, baseHash = null, baseDocument, message } = {}) {
    checkTreeId(treeId);
    validateDocument(document);
    if (baseHash !== null && (typeof baseHash !== 'string' || !HASH.test(baseHash))) fail('INVALID_DOCUMENT');
    if (baseDocument !== undefined && (baseHash === null || canonicalDocumentHash(baseDocument) !== baseHash)) fail('INVALID_DOCUMENT');
    if (message !== undefined && (typeof message !== 'string' || !message.trim() || message.length > 1000)) fail('INVALID_DOCUMENT');
    // Copy before the first await: callers may continue editing their live document while a push runs.
    const local = JSON.parse(JSON.stringify(document));
    const hash = canonicalDocumentHash(local);
    const ctx = await context();
    const snap = await snapshot(ctx);
    let remote;
    try { remote = await load(ctx, snap, treeId); }
    catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
    if (remote?.hash === hash) return { treeId, hash, commitSha: snap.commitSha, title: local.title, noOp: true };
    if ((remote?.hash ?? null) !== baseHash) fail('CONFLICT');

    const root = `${ctx.directory}/${treeId}/`;
    const files = new Map();
    for (const card of local.cards) {
      if (!card.image) continue;
      const im = card.image;
      const bytes = imageBytes(im, 'INVALID_DOCUMENT');
      const asset = `assets/${digest(bytes)}.${MIME_EXT[im.mime]}`;
      files.set(`${root}${asset}`, bytes);
      card.image = { asset, mime: im.mime, w: im.w, h: im.h };
    }
    const envelope = { format: 'dsh-knowledge-tree', version: 1, treeId, document: local };
    files.set(`${root}tree.json`, Buffer.from(`${stable(envelope)}\n`));
    files.set(`${root}tree.md`, markdown(local));
    for (const bytes of files.values()) if (bytes.length > MAX_FILE) fail('LIMIT_EXCEEDED');
    const treeEntries = [];
    for (const [path, bytes] of files) {
      const expectedSha = gitBlobHash(bytes);
      const existing = snap.entries.get(path);
      if (existing?.sha === expectedSha && existing.type === 'blob' && existing.mode === '100644') {
        treeEntries.push({ path, mode: '100644', type: 'blob', sha: expectedSha });
      } else {
        const result = await ctx.request('POST', '/git/blobs', { content: bytes.toString('base64'), encoding: 'base64' });
        if (!object(result) || sha(result.sha) !== expectedSha) fail('INVALID_REMOTE');
        treeEntries.push({ path, mode: '100644', type: 'blob', sha: result.sha });
      }
    }
    // Remove only old content-addressed assets, never unrelated files in the repository.
    for (const [path, entry] of snap.entries) {
      if (path.startsWith(root) && ASSET.test(path.slice(root.length)) && !files.has(path)) {
        managedEntry(snap, path, MAX_IMAGE);
        treeEntries.push({ path, mode: entry.mode, type: 'blob', sha: null });
      }
    }
    if (treeEntries.length > 15000) fail('LIMIT_EXCEEDED');
    const tree = await ctx.request('POST', '/git/trees', { base_tree: snap.treeSha, tree: treeEntries });
    if (!object(tree)) fail('INVALID_REMOTE');
    const treeSha = sha(tree.sha);
    const commit = await ctx.request('POST', '/git/commits', {
      message: message ?? `Sync knowledge tree ${treeId}`, tree: treeSha, parents: [snap.commitSha],
    });
    if (!object(commit)) fail('INVALID_REMOTE');
    const commitSha = sha(commit.sha);
    const ref = await ctx.request('PATCH', `/git/refs/heads/${ctx.branch.split('/').map(encodeURIComponent).join('/')}`,
      { sha: commitSha, force: false }, true);
    if (!object(ref) || !object(ref.object) || ref.object.type !== 'commit' || ref.object.sha !== commitSha) fail('INVALID_REMOTE');
    return { treeId, hash, commitSha, title: local.title, noOp: false };
  }

  return { listTrees, readTree, pushTree };
}
