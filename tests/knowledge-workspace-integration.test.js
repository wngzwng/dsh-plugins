import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorkspaceComponents } from '../knowledge-tree/workspace-ui.js';
import { canonicalStringify } from '../knowledge-tree/library.js';

// Contract integration: deliberately uses the real library's wrapped remote cache,
// detached records, CAS revisions, ignored snapshot reasons, and copy-only restore.
// No browser/DOM/dependency installation is required.
const clone = (value) => value == null ? value : structuredClone(value);
const config = { remote: 'git@github.com:owner/repo.git', branch: 'main', directory: 'knowledge-trees' };
const prefix = JSON.stringify(Object.values(config)) + '/';
const hash = (value) => createHash('sha256').update(canonicalStringify(value)).digest('hex');
const doc = (title = '本地', image = false) => ({ version: 3, stage: 'brainstorm', title,
  cards: [{ id: 'c', title: '卡片', content: '正文', placed: false, order: 0, createdAt: 1, ...(image ? { image: null } : {}) }], links: [] });
const record = (id, document, sync = { remoteKey: null, baseHash: null }) => ({ id, document: clone(document), ui: {}, sync: clone(sync), revision: 1, updatedAt: 1 });
const gate = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function harness(initial = [], remotes = {}, options = {}) {
  const states = [], refs = [], effects = [];
  let si = 0, ri = 0, ei = 0, tree, generated = 0;
  const records = new Map(initial.map((item) => [item.id, clone(item)]));
  const cached = new Map((options.cache || []).map((item) => [item.remoteKey, clone(item)]));
  const snapshots = new Map(), stores = new Map(), calls = [], settings = new Map();
  const React = {
    createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity).filter((child) => child !== false && child != null) }; },
    useState(value) { const i = si++; if (!(i in states)) states[i] = value; return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef(value) { const i = ri++; if (!(i in refs)) refs[i] = { current: value }; return refs[i]; },
    useEffect(effect) { const i = ei++; if (!(i in effects)) effects[i] = effect; },
  };
  const status = () => ({ configured: true, config: clone(config), transport: 'ssh', gitAvailable: true });
  const library = {
    async init() { return clone([...records.values()]); },
    async listLocal() { return clone([...records.values()]); },
    async getLocal(id) { return clone(records.get(id) || null); },
    async createLocal(document, opts = {}) {
      const id = opts.id || `new-${++generated}`;
      if (records.has(id)) throw new Error('ID collision');
      const value = record(id, document, opts.sync);
      records.set(id, clone(value)); return clone(value);
    },
    async saveLocal(item, { expectedRevision }) {
      if (h.beforeSave) await h.beforeSave(item);
      if (h.failMetadata && item.sync?.baseHash) throw new Error('metadata quota failure');
      if (records.get(item.id)?.revision !== expectedRevision) throw new Error('REVISION_CONFLICT');
      const saved = { ...clone(item), revision: expectedRevision + 1, updatedAt: Date.now() };
      records.set(item.id, saved); return clone(saved);
    },
    async deleteLocal(id) { return records.delete(id); },
    async getSetting(key) { return clone(settings.get(key)); },
    async setSetting(key, value) { settings.set(key, clone(value)); },
    async cacheRemote(remoteKey, snapshot) {
      const row = { remoteKey, snapshot: clone(snapshot), updatedAt: Date.now() };
      cached.set(remoteKey, row); return clone(row);
    },
    async getRemote(key) { return clone(cached.get(key) || null); },
    async listRemote(key) { return clone([...cached.values()].filter((row) => row.remoteKey.startsWith(key))); },
    async snapshotLocal(id) {
      const row = { id: `snapshot-${++generated}`, localId: id, record: clone(records.get(id)), createdAt: Date.now() };
      snapshots.set(row.id, row); return clone(row);
    },
    async listSnapshots(id) { return clone([...snapshots.values()].filter((row) => row.localId === id)); },
    async restoreSnapshot(id) {
      const saved = snapshots.get(id);
      const result = record(`restored-${++generated}`, saved.record.document, saved.record.sync);
      records.set(result.id, clone(result)); return clone(result);
    },
  };
  const rpc = async (method, input) => {
    calls.push({ method, input: clone(input) });
    if (method === 'status') return status();
    if (method === 'configure') return status();
    if (method === 'check') return { ok: true, remote: config.remote, branch: config.branch, commitSha: 'a'.repeat(40) };
    if (method === 'hashDocument') { if (h.hashHook) await h.hashHook(input.document); return { hash: hash(input.document) }; }
    if (method === 'listTrees') return Object.entries(remotes).map(([treeId, document]) => ({ treeId, title: document.title }));
    if (method === 'readTree') {
      if (h.offline) throw new Error('offline');
      if (!remotes[input.treeId]) throw new Error('not found');
      return { treeId: input.treeId, document: clone(remotes[input.treeId]), hash: hash(remotes[input.treeId]), commitSha: 'commit' };
    }
    if (method === 'pushTree') {
      if (h.pushGate) await h.pushGate.promise;
      remotes[input.treeId] = clone(input.document);
      return { treeId: input.treeId, hash: hash(input.document), commitSha: 'new-commit' };
    }
    throw new Error('Unexpected RPC: ' + method);
  };
  const { Workspace } = createWorkspaceComponents(React);
  const props = { library, rpc, normalizeDocument: options.normalize || ((value) => value),
    createEditor(item, onSave) { const store = { id: item.id, document: clone(item.document), onSave }; stores.set(item.id, store); return store; },
    renderEditor(store) { return React.createElement('editor', { store }); },
  };
  const h = { records, cached, stores, calls, snapshots, library, offline: !!options.offline, hashHook: null,
    render() { si = ri = ei = 0; tree = Workspace(props); return tree; },
    async tick() { for (let i = 0; i < 150; i++) await Promise.resolve(); h.render(); },
    async start() { h.render(); effects.forEach((effect) => effect()); await h.tick(); },
    all(type) { const values = []; const visit = (node) => { if (!node || typeof node !== 'object') return; if (node.type === type) values.push(node); node.children.forEach(visit); }; visit(tree); return values; },
    text(node = tree) { return typeof node === 'string' || typeof node === 'number' ? String(node) : node && typeof node === 'object' ? node.children.map((child) => h.text(child)).join('') : ''; },
    button(label) { const result = h.all('button').find((node) => h.text(node) === label); assert.ok(result, `Missing ${label}: ${h.text()}`); return result; },
    async click(label) { const button = h.button(label); assert.ok(!button.props.disabled, `${label} enabled`); await button.props.onClick(); await h.tick(); },
    selected() { return h.all('editor')[0]?.props.store.id; },
    async openRemote(id = 'r') { await h.click('手动刷新远端目录'); const button = h.all('button').filter((node) => h.text(node) === remotes[id].title).at(-1); assert.ok(button); await button.props.onClick(); await h.tick(); },
    async push() { await h.click('推送当前本地树…'); h.all('form').find((node) => node.props['aria-labelledby'] === 'kw-push-title').props.onSubmit({ preventDefault() {} }); await h.tick(); },
    async save(id, document) { const store = stores.get(id); store.document = clone(document); return store.onSave(document, {}); },
  };
  return h;
}

test('wrapped cached snapshots appear in the startup list and offline read-only pane', async () => {
  const remote = doc('缓存树');
  const h = harness([], {}, { offline: true, cache: [{ remoteKey: prefix + 'r', snapshot: { document: remote, hash: hash(remote) }, updatedAt: 123 }] });
  await h.start();
  await h.click('缓存树（缓存）');
  assert.match(h.text(), /离线缓存/);
  assert.equal(h.all('section').find((node) => node.props['aria-label'] === '远端只读版本') != null, true);
  assert.equal(h.records.size, 0);
  await h.click('拉取当前远端树');
  assert.equal(h.records.size, 0, 'cache is never used as Pull source');
});

test('snapshot restore activates the returned NEW record and retains the original editor', async () => {
  const h = harness([record('a', doc('原树'))]);
  await h.start();
  await h.library.snapshotLocal('a');
  const changed = doc('原树后续编辑');
  await h.save('a', changed); await h.tick();
  const originalStore = h.stores.get('a');
  await h.click('本地快照'); await h.click('恢复此快照');
  const restoredId = h.selected();
  assert.notEqual(restoredId, 'a');
  assert.equal(h.records.get(restoredId).document.title, '原树');
  assert.equal(h.records.get('a').document.title, '原树后续编辑');
  assert.equal(h.stores.get('a'), originalStore);
  assert.match(h.text(), /原树没有被覆盖/);
});

test('same-content Pull repairs baseHash metadata without replacing body, UI or store', async () => {
  const remote = doc('同文');
  const local = record('a', remote, { remoteKey: prefix + 'r', baseHash: 'obsolete' }); local.ui = { expanded: ['c'] };
  const h = harness([local], { r: remote });
  await h.start(); await h.openRemote();
  const originalStore = h.stores.get('a');
  await h.click('拉取当前远端树');
  assert.equal(h.records.get('a').sync.baseHash, hash(remote));
  assert.deepEqual(h.records.get('a').document, remote);
  assert.deepEqual(h.records.get('a').ui, local.ui);
  assert.equal(h.stores.get('a'), originalStore);
  assert.equal(h.snapshots.size, 0);
});

test('same-content Pull metadata CAS serializes with a keystroke arriving during hash', async () => {
  const remote = doc('同文');
  const h = harness([record('a', remote, { remoteKey: prefix + 'r', baseHash: 'obsolete' })], { r: remote });
  await h.start(); await h.openRemote();
  const pause = gate(); let hashes = 0;
  h.hashHook = async () => { if (++hashes === 2) await pause.promise; };
  const pulling = h.button('拉取当前远端树').props.onClick(); await h.tick();
  const edited = doc('打字期间的新正文');
  const saving = h.save('a', edited);
  pause.resolve(); await pulling; await saving; await h.tick();
  assert.deepEqual(h.records.get('a').document, edited);
  assert.equal(h.records.get('a').sync.baseHash, hash(remote));
  assert.equal(h.records.get('a').revision, 3);
});

test('same-content Pull never adopts a different window revision during its hash check', async () => {
  const remote = doc('同文');
  const h = harness([record('a', remote, { remoteKey: prefix + 'r', baseHash: 'obsolete' })], { r: remote });
  await h.start(); await h.openRemote();
  let hashes = 0;
  h.hashHook = async () => {
    if (++hashes === 2) h.records.set('a', { ...record('a', doc('另一个窗口')), revision: 2 });
  };
  await h.click('拉取当前远端树');
  assert.equal(h.records.get('a').document.title, '另一个窗口');
  assert.equal(h.records.get('a').sync.baseHash, null);
  assert.match(h.text(), /REVISION_CONFLICT/);
  await assert.rejects(h.save('a', doc('旧store')), /另一窗口/);
  assert.equal(h.records.get('a').document.title, '另一个窗口');
});

test('Push never absorbs another window revision and subsequent old editor saves remain blocked', async () => {
  const h = harness([record('a', doc('旧窗口'))]); h.pushGate = gate();
  await h.start(); await h.push();
  h.records.set('a', { ...record('a', doc('另一个窗口')), revision: 2 });
  h.pushGate.resolve(); await h.tick();
  assert.equal(h.records.get('a').document.title, '另一个窗口');
  assert.equal(h.records.get('a').sync.baseHash, null);
  assert.match(h.text(), /推送已成功.*基线记录失败/);
  assert.match(h.text(), /另一窗口/);
  await assert.rejects(h.save('a', doc('旧窗口再次打字')), /另一窗口/);
  assert.equal(h.records.get('a').document.title, '另一个窗口');
});

test('Push metadata CAS rejects a cross-window write between get and save without retrying', async () => {
  const h = harness([record('a', doc('捕获版本'))]);
  let metadataAttempts = 0;
  h.beforeSave = async (item) => {
    if (item.sync.baseHash) {
      metadataAttempts++;
      h.records.set('a', { ...record('a', doc('竞争窗口')), revision: 2 });
    }
  };
  await h.start(); await h.push();
  assert.equal(metadataAttempts, 1);
  assert.equal(h.records.get('a').document.title, '竞争窗口');
  assert.match(h.text(), /推送已成功.*基线记录失败/);
  await assert.rejects(h.save('a', doc('旧store')), /另一窗口/);
});

test('successful Push with metadata storage failure is explicitly distinguished from network failure', async () => {
  const h = harness([record('a', doc('上传成功'))]); h.failMetadata = true;
  await h.start(); await h.push();
  assert.equal(h.calls.filter((call) => call.method === 'pushTree').length, 1);
  assert.match(h.text(), /远端推送已成功，但本地同步基线记录失败/);
  assert.match(h.text(), /metadata quota failure/);
});

test('remote document hash and Pull body stay raw; editor-only image normalization creates no permanent dirty', async () => {
  const remote = doc('未含image字段');
  const normalize = (input) => ({ ...input, cards: input.cards.map((card) => ({ ...card, image: card.image ?? null })) });
  const h = harness([], { r: remote }, { normalize });
  await h.start(); await h.openRemote(); await h.click('拉取当前远端树');
  assert.deepEqual(h.records.get('r').document, remote);
  assert.equal(h.records.get('r').sync.baseHash, hash(remote));
  assert.equal(h.stores.get('r').document.cards[0].image, null, 'normalization exists only in editor');
  // UI state save reports the normalized editor representation, but must preserve raw body.
  await h.save('r', h.stores.get('r').document); await h.tick();
  assert.deepEqual(h.records.get('r').document, remote);
  assert.match(h.text(), /已保存在本地/);
  await h.click('拉取当前远端树');
  assert.doesNotMatch(h.text(), /双方|均有更改|冲突：/);
  const edited = clone(h.stores.get('r').document); edited.cards[0].content = '真正修改正文';
  await h.save('r', edited); await h.tick();
  assert.equal(h.records.get('r').document.cards[0].content, '真正修改正文');
  assert.equal(Object.hasOwn(h.records.get('r').document.cards[0], 'image'), false);
  await h.push();
  assert.equal(h.records.get('r').sync.baseHash, hash(h.records.get('r').document));
});

test('required SSH remote, branch and directory fields are enforced, with SSH setup disclosure', async () => {
  const h = harness(); await h.start(); await h.click('SSH 配置');
  const directory = h.all('label').find((node) => h.text(node) === '目录').children.find((node) => node.type === 'input');
  assert.equal(directory.props.required, true);
  const remote = h.all('label').find((node) => h.text(node).includes('SSH 远端地址')).children.find((node) => node.type === 'input');
  remote.props.onChange({ target: { value: 'https://github.com/owner/repo.git' } }); await h.tick();
  directory.props.onChange({ target: { value: ' ' } }); await h.tick();
  h.all('form')[0].props.onSubmit({ preventDefault() {} }); await h.tick();
  assert.equal(h.calls.some((call) => call.method === 'configure'), false);
  assert.match(h.text(), /请填写.*目录/);
  assert.match(h.text(), /ssh -T git@github\.com/);
  assert.match(h.text(), /ssh-agent/);
  assert.match(h.text(), /不保存任何令牌/);
  assert.doesNotMatch(h.text(), /个人访问令牌|KNOWLEDGE_TREE_GITHUB_TOKEN/);
});
test('SSH config dialog offers a connection test that keeps local data intact', async () => {
  const h = harness([record('a', doc())]);
  await h.start(); await h.click('SSH 配置');
  await h.click('测试连接');
  assert.equal(h.calls.some((call) => call.method === 'check'), true);
  assert.match(h.text(), /SSH 连接正常/);
  assert.match(h.text(), /git@github\.com:owner\/repo\.git/);
  assert.equal(h.records.size, 1);
  assert.equal(h.button('手动刷新远端目录').props.disabled, false);
});