import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGithubSync, canonicalDocumentHash, GithubSyncError } from '../github-sync.js';

const TOKEN = 'test-token-must-never-appear-in-errors';
const CONFIG = { owner: 'test-owner', repo: 'knowledge', branch: 'sync/main', directory: 'knowledge/trees' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lF8AAAAASUVORK5CYII=', 'base64');
const gitSha = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const hash = (value) => createHash('sha1').update(JSON.stringify(value)).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));
const manifestPath = (id) => `${CONFIG.directory}/${id}/tree.json`;

function document(title = 'Sample', withImage = true) {
  return {
    version: 3, stage: 'classify', title,
    cards: [
      { id: 'c_root', title: 'Root', content: 'Root content', placed: true, order: 0, createdAt: 100,
        image: withImage ? { data: `data:image/png;base64,${png.toString('base64')}`, mime: 'image/png', w: 1, h: 1 } : null },
      { id: 'c_child', title: 'Child', content: 'Full child content', placed: true, order: 1, createdAt: 101, image: null },
    ],
    links: [{ id: 'l_1', parentId: 'c_root', childId: 'c_child', primary: true }],
    updatedAt: 1000,
  };
}

/** In-memory implementation of only the GitHub Git Data endpoints. Never calls fetch. */
class MockGithub {
  constructor() {
    this.blobs = new Map();
    this.trees = new Map();
    this.commits = new Map();
    this.calls = [];
    this.sequence = 0;
    this.ref = this.commitFiles(new Map(), []);
    this.hook = null;
    this.fetch = this.fetch.bind(this);
  }

  blob(bytes) {
    bytes = Buffer.from(bytes);
    const sha = gitSha(bytes);
    this.blobs.set(sha, bytes);
    return sha;
  }

  tree(files) {
    const sha = hash([...files.entries()].sort());
    this.trees.set(sha, new Map(files));
    return sha;
  }

  commitFiles(files, parents = [this.ref]) {
    const tree = this.tree(files);
    const sha = hash({ tree, parents, sequence: this.sequence++ });
    this.commits.set(sha, { sha, tree: { sha: tree }, parents: parents.map((parent) => ({ sha: parent })) });
    return sha;
  }

  currentFiles() { return new Map(this.trees.get(this.commits.get(this.ref).tree.sha)); }

  setFiles(changes) {
    const files = this.currentFiles();
    for (const [path, content] of Object.entries(changes)) {
      if (content === null) files.delete(path);
      else files.set(path, { path, mode: '100644', type: 'blob', sha: this.blob(content), size: Buffer.byteLength(content) });
    }
    this.ref = this.commitFiles(files);
  }

  editManifest(id, edit) {
    const entry = this.currentFiles().get(manifestPath(id));
    const envelope = JSON.parse(this.blobs.get(entry.sha).toString());
    edit(envelope);
    this.setFiles({ [manifestPath(id)]: JSON.stringify(envelope) });
  }

  response(status, body, headers = {}) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  }

  async fetch(url, options) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.github.com');
    assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    const body = options.body === undefined ? undefined : JSON.parse(options.body);
    const call = { method: options.method, path: parsed.pathname.replace('/repos/test-owner/knowledge', ''), search: parsed.search, body };
    this.calls.push(call);
    if (this.hook) {
      const result = await this.hook(call, this);
      if (result) return result;
    }
    const refPath = '/git/ref/heads/sync/main';
    if (call.method === 'GET' && call.path === refPath) {
      return this.response(200, { ref: 'refs/heads/sync/main', object: { type: 'commit', sha: this.ref } });
    }
    if (call.method === 'GET' && call.path.startsWith('/git/commits/')) {
      const commit = this.commits.get(call.path.slice('/git/commits/'.length));
      return this.response(commit ? 200 : 404, commit || { message: 'Not Found' });
    }
    if (call.method === 'GET' && call.path.startsWith('/git/trees/')) {
      assert.equal(call.search, '?recursive=1');
      const sha = call.path.slice('/git/trees/'.length);
      const files = this.trees.get(sha);
      return this.response(files ? 200 : 404, files ? { sha, truncated: false, tree: [...files.values()] } : {});
    }
    if (call.method === 'GET' && call.path.startsWith('/git/blobs/')) {
      const sha = call.path.slice('/git/blobs/'.length);
      const bytes = this.blobs.get(sha);
      return this.response(bytes ? 200 : 404, bytes ? { sha, size: bytes.length, encoding: 'base64', content: bytes.toString('base64') } : {});
    }
    if (call.method === 'POST' && call.path === '/git/blobs') {
      assert.equal(body.encoding, 'base64');
      return this.response(201, { sha: this.blob(Buffer.from(body.content, 'base64')) });
    }
    if (call.method === 'POST' && call.path === '/git/trees') {
      const files = new Map(this.trees.get(body.base_tree));
      for (const entry of body.tree) {
        if (entry.sha === null) files.delete(entry.path);
        else {
          assert.equal(entry.type, 'blob');
          assert.equal(entry.mode, '100644');
          const bytes = this.blobs.get(entry.sha);
          assert.ok(bytes);
          files.set(entry.path, { ...entry, size: bytes.length });
        }
      }
      return this.response(201, { sha: this.tree(files) });
    }
    if (call.method === 'POST' && call.path === '/git/commits') {
      const sha = hash({ ...body, sequence: this.sequence++ });
      this.commits.set(sha, { sha, tree: { sha: body.tree }, parents: body.parents.map((parent) => ({ sha: parent })) });
      return this.response(201, { sha });
    }
    if (call.method === 'PATCH' && call.path === '/git/refs/heads/sync/main') {
      assert.equal(body.force, false, 'all ref updates must explicitly be non-force');
      const commit = this.commits.get(body.sha);
      // Both siblings have the old parent; the second sibling is not a descendant of current ref.
      if (!commit.parents.some((parent) => parent.sha === this.ref)) return this.response(422, { message: `Not a fast forward ${TOKEN}` });
      this.ref = body.sha;
      return this.response(200, { object: { type: 'commit', sha: this.ref } });
    }
    assert.fail(`Unexpected mock API request: ${call.method} ${call.path}`);
  }
}

function adapter(api, config = CONFIG, extras = {}) {
  return createGithubSync({ fetchImpl: api.fetch, getToken: async () => TOKEN, getConfig: async () => config, ...extras });
}

async function rejectsCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof GithubSyncError);
    assert.equal(error.code, code);
    assert.equal(String(error).includes(TOKEN), false);
    assert.equal(JSON.stringify(error).includes(TOKEN), false);
    return true;
  });
}

function assertNoWrites(api, since = 0) {
  assert.equal(api.calls.slice(since).some((call) => call.method !== 'GET'), false);
}

test('push/pull roundtrip separates image, writes one atomic tree/commit/ref and preserves unrelated files', async () => {
  const api = new MockGithub();
  api.setFiles({ 'README.md': 'Do not change', [`${CONFIG.directory}/other.txt`]: 'Unmanaged' });
  const sync = adapter(api);
  const original = document();
  const result = await sync.pushTree({ treeId: 'tree_1', document: original, message: 'Snapshot' });
  assert.equal(result.noOp, false);
  assert.equal(result.hash, canonicalDocumentHash(original));
  const files = api.currentFiles();
  const envelope = JSON.parse(api.blobs.get(files.get(manifestPath('tree_1')).sha).toString());
  assert.equal(envelope.format, 'dsh-knowledge-tree');
  assert.equal(envelope.version, 1);
  const asset = envelope.document.cards[0].image.asset;
  assert.match(asset, /^assets\/[0-9a-f]{64}\.png$/);
  assert.equal(envelope.document.cards[0].image.data, undefined);
  assert.equal(files.has(`${CONFIG.directory}/tree_1/${asset}`), true);
  const md = api.blobs.get(files.get(`${CONFIG.directory}/tree_1/tree.md`).sha).toString();
  assert.ok(md.includes(asset));
  assert.ok(md.includes('Full child content'));
  assert.equal(api.blobs.get(files.get('README.md').sha).toString(), 'Do not change');
  assert.equal(api.calls.filter((call) => call.path === '/git/trees' && call.method === 'POST').length, 1);
  assert.equal(api.calls.filter((call) => call.path === '/git/commits' && call.method === 'POST').length, 1);
  assert.equal(api.calls.filter((call) => call.method === 'PATCH').length, 1);
  const read = await sync.readTree('tree_1');
  assert.deepEqual(read, { treeId: 'tree_1', document: original, hash: result.hash, commitSha: result.commitSha, title: original.title });
  assert.deepEqual(await sync.listTrees(), [{ treeId: 'tree_1', hash: result.hash, commitSha: result.commitSha, title: original.title }]);
  assert.deepEqual(original, document(), 'push must not mutate its input');
});

test('canonical hash is key-order stable, ignores updatedAt/UI, includes cards, links, images', () => {
  const original = document();
  const a = canonicalDocumentHash(original);
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  reordered.updatedAt = 999;
  reordered.ui = { expanded: ['c_root'] };
  reordered.view = 'graph';
  assert.equal(canonicalDocumentHash(reordered), a);
  for (const mutate of [
    (d) => { d.cards[0].content = 'Changed'; },
    (d) => { d.cards[0].image.w = 2; },
    (d) => { d.cards[0].image = null; },
    (d) => { d.links[0].primary = false; },
    (d) => { d.title = 'Other'; },
  ]) {
    const changed = clone(original); mutate(changed);
    assert.notEqual(canonicalDocumentHash(changed), a);
  }
});

test('stale base rejects changes without any writes; identical local/remote is a no-op', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  const first = await sync.pushTree({ treeId: 'one', document: document('First') });
  const remote = document('Remote');
  const second = await sync.pushTree({ treeId: 'one', document: remote, baseHash: first.hash, baseDocument: document('First') });
  const before = api.calls.length;
  await rejectsCode(sync.pushTree({ treeId: 'one', document: document('Local'), baseHash: first.hash }), 'CONFLICT');
  assertNoWrites(api, before);
  const noOp = await sync.pushTree({ treeId: 'one', document: remote, baseHash: first.hash });
  assert.equal(noOp.noOp, true);
  assert.equal(noOp.commitSha, second.commitSha);
  assertNoWrites(api, before);
  await rejectsCode(sync.pushTree({ treeId: 'one', document: document('Overwrite'), baseHash: null }), 'CONFLICT');
  await rejectsCode(sync.pushTree({ treeId: 'one', document: remote, baseHash: first.hash, baseDocument: remote }), 'INVALID_DOCUMENT');
});

test('non-force sibling-commit race rejects losing update and keeps winner intact', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  const initial = await sync.pushTree({ treeId: 'race', document: document('Base', false) });
  let winner;
  api.hook = (call) => {
    if (call.method === 'PATCH') {
      api.hook = null;
      api.setFiles({ 'other-concurrent-file.txt': 'Winner update' });
      winner = api.ref;
    }
  };
  await rejectsCode(sync.pushTree({ treeId: 'race', document: document('Loser', false), baseHash: initial.hash }), 'REF_CONFLICT');
  assert.equal(api.ref, winner);
  assert.equal((await sync.readTree('race')).title, 'Base');
  assert.equal(api.currentFiles().has('other-concurrent-file.txt'), true);
  assert.ok(api.calls.filter((call) => call.method === 'PATCH').every((call) => call.body.force === false));
});

test('two simultaneous pushes from the same parent yield exactly one successful commit', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  const initial = await sync.pushTree({ treeId: 'race', document: document('Base', false) });
  const results = await Promise.allSettled([
    sync.pushTree({ treeId: 'race', document: document('First', false), baseHash: initial.hash }),
    sync.pushTree({ treeId: 'race', document: document('Second', false), baseHash: initial.hash }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'REF_CONFLICT');
  const winner = results.find((result) => result.status === 'fulfilled').value;
  assert.equal((await sync.readTree('race')).hash, winner.hash);
});

test('all reads are pinned to one commit even if branch advances while enumerating', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  const initial = await sync.pushTree({ treeId: 'one', document: document('Pinned', false) });
  const initialTree = api.commits.get(initial.commitSha).tree.sha;
  api.hook = (call) => {
    if (call.method === 'GET' && call.path === `/git/commits/${initial.commitSha}`) {
      api.hook = null;
      api.editManifest('one', (envelope) => { envelope.document.title = 'Advanced'; });
    }
  };
  const list = await sync.listTrees();
  assert.equal(list[0].title, 'Pinned');
  assert.equal(list[0].commitSha, initial.commitSha);
  assert.ok(api.calls.some((call) => call.path === `/git/trees/${initialTree}`));
  assert.equal((await sync.readTree('one')).title, 'Advanced');
});

test('malicious config and treeId paths fail before any HTTP request', async () => {
  for (const directory of ['', '.', '..', '../escape', 'a/../../b', '/absolute', 'a//b', 'a/', 'a\\b', 'a/%2e%2e', 'a/./b', 'a/space here']) {
    const api = new MockGithub();
    await rejectsCode(adapter(api, { ...CONFIG, directory }).listTrees(), 'INVALID_CONFIG');
    assert.equal(api.calls.length, 0);
  }
  for (const branch of ['../main', 'a..b', 'a@{x}', 'a.lock', 'a\\b', 'a//b', 'a b', '-x?']) {
    const api = new MockGithub();
    await rejectsCode(adapter(api, { ...CONFIG, branch }).listTrees(), 'INVALID_CONFIG');
    assert.equal(api.calls.length, 0);
  }
  const api = new MockGithub(); const sync = adapter(api);
  for (const treeId of ['..', '../escape', 'a/b', '%2e%2e', 'a\\b', '', 'a.b', 'a'.repeat(65), 123]) {
    await rejectsCode(sync.readTree(treeId), 'INVALID_TREE_ID');
    await rejectsCode(sync.pushTree({ treeId, document: document() }), 'INVALID_TREE_ID');
  }
  assert.equal(api.calls.length, 0);
});

test('missing tree and GitHub 404 have explicit NOT_FOUND errors', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  assert.deepEqual(await sync.listTrees(), []);
  await rejectsCode(sync.readTree('missing'), 'NOT_FOUND');
  api.hook = () => api.response(404, { message: `${TOKEN} secret upstream response` });
  await rejectsCode(sync.listTrees(), 'NOT_FOUND');
});

test('remote invalid envelopes and document types are rejected without cleaning', async () => {
  for (const mutate of [
    (e) => { e.format = 'unknown'; },
    (e) => { e.version = 2; },
    (e) => { e.treeId = 'wrong'; },
    (e) => { e.document.version = 99; },
    (e) => { e.document.cards = {}; },
    (e) => { e.document.cards[0].title = 123; },
    (e) => { e.document.cards.push(clone(e.document.cards[0])); },
    (e) => { e.document.links[0].childId = 'missing'; },
    (e) => { e.document.links[0].primary = 'true'; },
    (e) => { e.document.links.push({ id: 'cycle', parentId: 'c_child', childId: 'c_root', primary: true }); },
    (e) => { e.document.updatedAt = 'not a timestamp'; },
    (e) => { e.extra = 'unexpected envelope field'; },
  ]) {
    const api = new MockGithub(); const sync = adapter(api);
    await sync.pushTree({ treeId: 'bad', document: document('Valid', false) });
    api.editManifest('bad', mutate);
    const before = api.calls.length;
    await rejectsCode(sync.readTree('bad'), 'INVALID_REMOTE');
    await rejectsCode(sync.listTrees(), 'INVALID_REMOTE');
    await rejectsCode(sync.pushTree({ treeId: 'bad', document: document('Replacement', false) }), 'INVALID_REMOTE');
    assertNoWrites(api, before);
  }
});

test('external image URLs and traversal asset references are never fetched', async () => {
  for (const asset of ['https://evil.example/secret.png', '//evil.example/x', '../private.png', 'assets/../private.png', 'assets/%2e%2e/secret.png', `assets/${'a'.repeat(64)}.svg`]) {
    const api = new MockGithub(); const sync = adapter(api);
    await sync.pushTree({ treeId: 'bad', document: document() });
    api.editManifest('bad', (e) => { e.document.cards[0].image.asset = asset; });
    await rejectsCode(sync.readTree('bad'), 'INVALID_REMOTE');
  }
  for (const data of ['https://evil.example/image.png', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64,AAAA', 'data:image/png;base64,!!!!']) {
    const api = new MockGithub(); const local = document(); local.cards[0].image.data = data;
    await rejectsCode(adapter(api).pushTree({ treeId: 'bad', document: local }), 'INVALID_DOCUMENT');
    assert.equal(api.calls.length, 0);
  }
});

test('missing/corrupt asset, symlink manifests, partial uploads and invalid JSON are explicit errors', async () => {
  for (const corrupt of ['missing-asset', 'bad-hash', 'missing-markdown', 'bad-json', 'symlink']) {
    const api = new MockGithub(); const sync = adapter(api);
    await sync.pushTree({ treeId: 'bad', document: document() });
    const files = api.currentFiles();
    const path = manifestPath('bad');
    const envelope = JSON.parse(api.blobs.get(files.get(path).sha).toString());
    const assetPath = `${CONFIG.directory}/bad/${envelope.document.cards[0].image.asset}`;
    if (corrupt === 'missing-asset') api.setFiles({ [assetPath]: null });
    if (corrupt === 'bad-hash') api.setFiles({ [assetPath]: Buffer.concat([png, Buffer.from('changed')]) });
    if (corrupt === 'missing-markdown') api.setFiles({ [`${CONFIG.directory}/bad/tree.md`]: null });
    if (corrupt === 'bad-json') api.setFiles({ [path]: '{not json' });
    if (corrupt === 'symlink') {
      files.get(path).mode = '120000';
      api.ref = api.commitFiles(files);
    }
    await rejectsCode(sync.readTree('bad'), 'INVALID_REMOTE');
  }
});

test('recursive truncation, pagination, large files and excessive tree counts explicitly fail', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  await sync.pushTree({ treeId: 'one', document: document('One', false) });
  api.hook = (call) => call.path.startsWith('/git/trees/')
    ? api.response(200, { sha: call.path.slice('/git/trees/'.length), truncated: true, tree: [] }) : undefined;
  await rejectsCode(sync.listTrees(), 'LIMIT_EXCEEDED');
  await rejectsCode(sync.readTree('one'), 'LIMIT_EXCEEDED');
  await rejectsCode(sync.pushTree({ treeId: 'new', document: document() }), 'LIMIT_EXCEEDED');
  api.hook = (call) => call.path.startsWith('/git/trees/')
    ? api.response(200, {}, { Link: '<https://api.github.com/next?page=2>; rel="next"' }) : undefined;
  await rejectsCode(sync.listTrees(), 'LIMIT_EXCEEDED');
  api.hook = null;
  const files = api.currentFiles();
  files.get(manifestPath('one')).size = 4 * 1024 * 1024 + 1;
  api.ref = api.commitFiles(files);
  await rejectsCode(sync.readTree('one'), 'LIMIT_EXCEEDED');
  api.hook = (call) => call.path.startsWith('/git/trees/') ? api.response(200, {
    sha: call.path.slice('/git/trees/'.length), truncated: false,
    tree: Array.from({ length: 501 }, (_, i) => ({ path: `${CONFIG.directory}/t_${i}/tree.json`, type: 'blob', mode: '100644', size: 0, sha: 'a'.repeat(40) })),
  }) : undefined;
  await rejectsCode(sync.listTrees(), 'LIMIT_EXCEEDED');
});

test('list strictly filters the management directory without accepting lookalike prefixes/nested manifests', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  await sync.pushTree({ treeId: 'ok', document: document('Only tree', false) });
  api.setFiles({
    'outside/ghost/tree.json': 'bad',
    [`${CONFIG.directory}-backup/ghost/tree.json`]: 'bad',
    [`${CONFIG.directory}/nested/ghost/tree.json`]: 'bad',
    [`${CONFIG.directory}/notes.txt`]: 'bad',
  });
  assert.deepEqual((await sync.listTrees()).map((entry) => entry.treeId), ['ok']);
  api.setFiles({ [`${CONFIG.directory}/../tree.json`]: '{}' });
  await rejectsCode(sync.listTrees(), 'INVALID_REMOTE');
});

test('replacing/removing images deletes only obsolete managed assets and deduplicates shared images', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  const local = document(); local.cards[1].image = clone(local.cards[0].image);
  const first = await sync.pushTree({ treeId: 'one', document: local });
  assert.equal([...api.currentFiles().keys()].filter((path) => path.includes('/assets/')).length, 1);
  api.setFiles({ [`${CONFIG.directory}/one/assets/keep.txt`]: 'Unmanaged' });
  local.cards.forEach((card) => { card.image = null; });
  await sync.pushTree({ treeId: 'one', document: local, baseHash: first.hash });
  assert.equal([...api.currentFiles().keys()].some((path) => /assets\/[a-f0-9]{64}\.png$/.test(path)), false);
  assert.equal(api.currentFiles().has(`${CONFIG.directory}/one/assets/keep.txt`), true);
  assert.deepEqual((await sync.readTree('one')).document, local);
});

test('local invalid types, oversized images and file payloads fail before writes', async () => {
  for (const mutate of [
    (d) => { d.cards[0].title = ''; },
    (d) => { d.cards[0].order = NaN; },
    (d) => { d.cards[0].image.mime = 'image/svg+xml'; },
    (d) => { d.cards[0].image.w = -1; },
    (d) => { d.foo = undefined; },
    (d) => { d.links[0].childId = 'missing'; },
  ]) {
    const api = new MockGithub(); const local = document(); mutate(local);
    await rejectsCode(adapter(api).pushTree({ treeId: 'bad', document: local }), 'INVALID_DOCUMENT');
    assert.equal(api.calls.length, 0);
  }
  const api = new MockGithub(); const sync = adapter(api); const local = document();
  local.cards[0].image.data = `data:image/png;base64,${Buffer.concat([png, Buffer.alloc(512 * 1024)]).toString('base64')}`;
  await rejectsCode(sync.pushTree({ treeId: 'big', document: local }), 'LIMIT_EXCEEDED');
  assert.equal(api.calls.length, 0);
  const large = document('Big', false); large.extra = 'x'.repeat(4 * 1024 * 1024);
  await rejectsCode(sync.pushTree({ treeId: 'big', document: large }), 'LIMIT_EXCEEDED');
  assertNoWrites(api);
});

test('partial remote uploads without a manifest are corruption, not a missing/empty tree', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  api.setFiles({ [`${CONFIG.directory}/partial/tree.md`]: '# Partial' });
  const before = api.calls.length;
  await rejectsCode(sync.listTrees(), 'INVALID_REMOTE');
  await rejectsCode(sync.readTree('partial'), 'INVALID_REMOTE');
  await rejectsCode(sync.pushTree({ treeId: 'partial', document: document() }), 'INVALID_REMOTE');
  assertNoWrites(api, before);
});

test('caller mutations during asynchronous configuration cannot change the submitted snapshot', async () => {
  const api = new MockGithub(); const original = document('Snapshot', false);
  const sync = adapter(api, CONFIG, { getConfig: async () => { original.title = 'Mutated'; return CONFIG; } });
  const result = await sync.pushTree({ treeId: 'one', document: original });
  assert.equal(result.title, 'Snapshot');
  assert.equal((await sync.readTree('one')).title, 'Snapshot');
});

test('response payload limit and malformed blob responses fail explicitly', async () => {
  const api = new MockGithub(); const sync = adapter(api);
  await sync.pushTree({ treeId: 'one', document: document('One', false) });
  api.hook = (call) => call.path.startsWith('/git/blobs/') ? api.response(200, {}, { 'Content-Length': String(24 * 1024 * 1024 + 1) }) : undefined;
  await rejectsCode(sync.readTree('one'), 'LIMIT_EXCEEDED');
  api.hook = (call) => call.path.startsWith('/git/blobs/') ? api.response(200, {
    sha: call.path.slice('/git/blobs/'.length), encoding: 'base64', size: 4, content: '!!!!',
  }) : undefined;
  await rejectsCode(sync.readTree('one'), 'INVALID_REMOTE');
});

test('network, credential, and upstream errors never expose credentials or response content', async () => {
  const api = new MockGithub();
  await rejectsCode(adapter(api, CONFIG, { fetchImpl: async () => { throw new Error(TOKEN); } }).listTrees(), 'HTTP_ERROR');
  await rejectsCode(adapter(api, CONFIG, { getToken: async () => { throw new Error(TOKEN); } }).listTrees(), 'AUTH_ERROR');
  await rejectsCode(adapter(api, CONFIG, { getConfig: async () => { throw new Error(TOKEN); } }).listTrees(), 'INVALID_CONFIG');
  api.hook = () => api.response(403, { message: TOKEN });
  await rejectsCode(adapter(api).listTrees(), 'HTTP_ERROR');
});

test('request timeout works even when injected fetch ignores AbortSignal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sync = createGithubSync({ fetchImpl: () => new Promise(() => {}), getToken: async () => TOKEN, getConfig: async () => CONFIG });
  const operation = rejectsCode(sync.listTrees(), 'TIMEOUT');
  // Let the two async getter continuations install the timeout, without sleeping.
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(15_001);
  await operation;
});
