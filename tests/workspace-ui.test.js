import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorkspaceComponents } from '../knowledge-tree/workspace-ui.js';

const copy = (value) => structuredClone(value);
const config = { owner: 'owner', repo: 'repo', branch: 'main', directory: 'trees' };
const prefix = JSON.stringify(Object.values(config)) + '/';
const document = (title) => ({ version: 3, stage: 'brainstorm', title, cards: [{ id: 'card', title: '卡片', content: '正文', image: null }], links: [] });
const hash = (doc) => createHash('sha256').update(JSON.stringify(doc)).digest('hex');
const record = (id, doc, sync) => ({ id, document: doc, ui: {}, revision: 1, updatedAt: 1, ...(sync ? { sync } : {}) });
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function harness(initial = [], remotes = {}) {
  const state = [];
  const refs = [];
  const effects = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let tree;
  let generatedId = 0;
  const records = new Map(initial.map((item) => [item.id, copy(item)]));
  const cached = new Map();
  const stores = new Map();
  const calls = [];
  const snapshots = [];
  const settings = new Map();
  const React = {
    createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity).filter((child) => child !== false && child != null) }; },
    useState(value) { const index = stateIndex++; if (!(index in state)) state[index] = value; return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }]; },
    useRef(value) { const index = refIndex++; if (!(index in refs)) refs[index] = { current: value }; return refs[index]; },
    useEffect(effect) { const index = effectIndex++; if (!(index in effects)) effects[index] = effect; },
  };
  const library = {
    async init() {},
    async listLocal() { return copy([...records.values()]); },
    async getLocal(id) { return copy(records.get(id)); },
    async saveLocal(item, { expectedRevision }) {
      if (h.failSave) throw new Error('quota failure');
      if (records.get(item.id)?.revision !== expectedRevision) throw new Error('revision conflict');
      const result = { ...copy(item), revision: expectedRevision + 1, updatedAt: Date.now() };
      records.set(item.id, result); return copy(result);
    },
    async createLocal(doc, options = {}) { const id = options.id || `new-${++generatedId}`; if (records.has(id)) throw new Error('ID collision'); const item = record(id, copy(doc), copy(options.sync)); records.set(id, item); return copy(item); },
    async deleteLocal(id, { expectedRevision }) { if (records.get(id)?.revision !== expectedRevision) throw new Error('revision conflict'); records.delete(id); },
    async listRemote(key) { return copy([...cached.values()].filter((item) => item.remoteKey.startsWith(key))); },
    async getRemote(key) { return copy(cached.get(key)); },
    async cacheRemote(key, value) { cached.set(key, { remoteKey: key, snapshot: copy(value), updatedAt: Date.now() }); },
    async getSetting(key) { return settings.get(key); },
    async setSetting(key, value) { settings.set(key, value); },
    async snapshotLocal(id, options) { snapshots.push({ id: `snapshot-${snapshots.length}`, localId: id, record: copy(records.get(id)), createdAt: Date.now(), reason: options.reason }); },
    async listSnapshots() { return snapshots; },
    async restoreSnapshot(id) { const snapshot = snapshots.find((item) => item.id === id); return library.createLocal(snapshot.record.document, { ui: snapshot.record.ui }); },
  };
  const rpc = async (method, input) => {
    calls.push({ method, input: copy(input) });
    if (method === 'status') return { configured: true, credentialAvailable: true, config };
    if (method === 'hashDocument') return { hash: hash(input.document) };
    if (method === 'listTrees') return Object.entries(remotes).map(([treeId, doc]) => ({ treeId, title: doc.title }));
    if (method === 'readTree') { if (h.offline) throw new Error('offline'); return remotes[input.treeId] ? { document: copy(remotes[input.treeId]) } : { found: false }; }
    if (method === 'pushTree') {
      if (h.pushGate) await h.pushGate.promise;
      remotes[input.treeId] = copy(input.document); return { hash: hash(input.document) };
    }
    throw new Error(`unexpected method ${method}`);
  };
  const { Workspace } = createWorkspaceComponents(React);
  const props = { library, rpc, normalizeDocument: (value) => value,
    createEditor(item, onSave) { const store = { id: item.id, document: copy(item.document), onSave, setTitle(value) { store.document.title = value; onSave(copy(store.document), {}).catch(() => {}); } }; stores.set(item.id, store); return store; },
    renderEditor(store) { return React.createElement('editor', { store }); },
  };
  const h = { records, stores, cached, calls, snapshots, library, props, failSave: false, offline: false, pushGate: null,
    render() { stateIndex = 0; refIndex = 0; effectIndex = 0; tree = Workspace(props); return tree; },
    async tick() { for (let i = 0; i < 100; i++) await Promise.resolve(); h.render(); },
    async start() { h.render(); effects.forEach((effect) => effect()); await h.tick(); },
    all(type) { const result = []; const visit = (node) => { if (!node || typeof node !== 'object') return; if (node.type === type) result.push(node); node.children.forEach(visit); }; visit(tree); return result; },
    text(node = tree) { if (typeof node === 'string' || typeof node === 'number') return String(node); if (!node || typeof node !== 'object') return ''; return node.children.map((child) => h.text(child)).join(''); },
    button(label) { const item = h.all('button').find((node) => h.text(node) === label); assert.ok(item, `button ${label} exists; text: ${h.text()}`); return item; },
    async click(label) { const button = h.button(label); assert.equal(!!button.props.disabled, false, `${label} enabled`); await button.props.onClick(); await h.tick(); },
    context(name) { const button = h.all('button').find(node => node.props.onContextMenu && h.text(node) === name); assert.ok(button, `local tree ${name}`); button.props.onContextMenu({ preventDefault() {}, currentTarget: { focus() {}, getBoundingClientRect() { return {left:10,bottom:40}; } }, clientX:20,clientY:30 }); h.render(); },
    doubleClick(name) { const button = h.all('button').find(node => node.props.onDoubleClick && h.text(node) === name); assert.ok(button); button.props.onDoubleClick(); h.render(); },
    async remote(id = 'r') { await h.click('手动刷新远端目录'); const button = h.all('button').filter((node) => node.props['aria-current'] !== undefined && h.text(node) === remotes[id].title).at(-1); await button.props.onClick(); await h.tick(); },
    async save(id, doc) { const store = stores.get(id); store.document = doc; const result = store.onSave(doc, {}); await h.tick(); return result; },
    async submitPush() { await h.click('推送当前本地树…'); const form = h.all('form').find((node) => node.props['aria-labelledby'] === 'kw-push-title'); assert.ok(form); form.props.onSubmit({ preventDefault() {} }); await h.tick(); },
  };
  return h;
}

test('exports one self-contained factory and never auto-uploads', async () => {
  assert.deepEqual(Object.keys(createWorkspaceComponents({})), ['Workspace']);
  const h = harness([record('a', document('本地'))]);
  await h.start();
  assert.equal(h.calls.filter((call) => call.method === 'pushTree').length, 0);
  assert.equal(h.calls.filter((call) => call.method === 'listTrees').length, 0);
  assert.match(h.text(), /本地优先/);
});

test('serialized CAS saves retain the editor and block switching after failure', async () => {
  const h = harness([record('a', document('A')), record('b', document('B'))]);
  await h.start();
  const original = h.stores.get('a');
  const first = original.onSave(document('A1'), {});
  const second = original.onSave(document('A2'), {});
  await Promise.all([first, second]); await h.tick();
  assert.equal(h.records.get('a').document.title, 'A2');
  assert.equal(h.records.get('a').revision, 3);
  h.failSave = true;
  await assert.rejects(original.onSave(document('A3'), {}), /quota failure/);
  await h.tick();
  await h.click('B');
  assert.equal(h.stores.has('b'), false);
  assert.equal(h.stores.get('a'), original);
  assert.match(h.text(), /尚未成功保存/);
  h.failSave = false;
  await h.click('重试保存');
  assert.equal(h.records.get('a').document.title, 'A3');
  await h.click('B');
  assert.equal(h.stores.has('b'), true);
});

test('push snapshots current local, permits typing, and only patches sync on latest record', async () => {
  const local = document('捕获版本');
  const h = harness([record('a', local)]);
  h.pushGate = deferred();
  await h.start();
  await h.submitPush();
  assert.equal(h.all('form').length, 0, 'confirmation overlay closes while pushing');
  assert.equal(h.calls.filter((call) => call.method === 'pushTree').length, 1);
  await h.save('a', document('推送期间编辑'));
  h.pushGate.resolve(); await h.tick();
  assert.equal(h.records.get('a').document.title, '推送期间编辑');
  assert.equal(h.records.get('a').sync.baseHash, hash(local));
  assert.equal(h.records.get('a').sync.treeId, 'a');
  assert.equal(h.records.get('a').sync.remoteKey, prefix + 'a');
});

test('first pull preserves remote ID; ID collision gets independent ID with remote treeId binding', async () => {
  for (const collision of [false, true]) {
    const h = harness(collision ? [record('r', document('原本地'))] : [], { r: document('远端') });
    await h.start(); await h.remote(); await h.click('拉取当前远端树');
    const imported = [...h.records.values()].find((item) => item.sync?.remoteKey === prefix + 'r');
    assert.ok(imported);
    assert.equal(imported.id, collision ? 'new-1' : 'r');
    assert.equal(imported.sync.treeId, 'r');
    if (collision) assert.equal(h.records.get('r').document.title, '原本地');
  }
});

test('dirty local and unchanged remote is a no-op; both changed offers independent copy', async () => {
  const base = document('基线');
  for (const changed of [false, true]) {
    const local = record('a', document('本地更改'), { remoteKey: prefix + 'r', treeId: 'r', baseHash: hash(base) });
    const h = harness([local], { r: changed ? document('远端更改') : base });
    await h.start(); await h.remote(); await h.click('拉取当前远端树');
    assert.equal(h.records.get('a').document.title, '本地更改');
    assert.equal(h.snapshots.length, 0);
    if (changed) {
      await h.click('将远端另存为独立本地树');
      const independent = h.records.get('new-1');
      assert.equal(independent.document.title, '远端更改');
      assert.equal(independent.sync, undefined);
    } else assert.match(h.text(), /保留本地未推送编辑/);
  }
});

test('clean pull snapshots before replacement and remote not-found never overwrites', async () => {
  const base = document('基线');
  const h = harness([record('a', base, { remoteKey: prefix + 'r', treeId: 'r', baseHash: hash(base) })], { r: document('远端更改') });
  await h.start(); await h.remote(); await h.click('拉取当前远端树');
  assert.equal(h.snapshots.length, 1);
  assert.equal(h.snapshots[0].record.document.title, '基线');
  assert.equal(h.records.get('a').document.title, '远端更改');
  h.offline = true;
  await h.click('拉取当前远端树');
  assert.equal(h.records.get('a').document.title, '远端更改');
  assert.equal(h.snapshots.length, 1);
});

test('manual offline read displays labelled cache and pull still requires fresh host read', async () => {
  const h = harness([], { r: document('远端缓存') });
  await h.start(); await h.remote();
  assert.equal(h.cached.size, 1);
  h.offline = true;
  await h.remote();
  assert.match(h.text(), /离线缓存/);
  assert.match(h.text(), /缓存时间/);
  await h.click('拉取当前远端树');
  assert.equal(h.records.size, 0);
});

test('identical pull updates old sync baseline without replacing editor content', async () => {
  const same = document('相同');
  const h = harness([record('a', same, { remoteKey: prefix + 'r', treeId: 'r', baseHash: hash(document('旧基线')) })], { r: same });
  await h.start();
  const editor = h.stores.get('a');
  await h.remote(); await h.click('拉取当前远端树');
  assert.equal(h.records.get('a').sync.baseHash, hash(same));
  assert.equal(h.snapshots.length, 0);
  assert.equal(h.stores.get('a'), editor);
});

test('restoring snapshots activates a new copy rather than overwriting original', async () => {
  const h = harness([record('a', document('原树'))]);
  await h.start();
  await h.library.snapshotLocal('a', { reason: '测试' });
  await h.save('a', document('新编辑'));
  await h.click('本地快照'); await h.click('恢复此快照');
  assert.equal(h.records.get('a').document.title, '新编辑');
  assert.equal(h.records.get('new-1').document.title, '原树');
  assert.ok(h.stores.get('new-1'));
});

test('collision-imported tree pushes original remote treeId, not local ID', async () => {
  const h = harness([record('r', document('原本地'))], { r: document('远端') });
  await h.start(); await h.remote(); await h.click('拉取当前远端树');
  await h.save('new-1', document('导入后编辑'));
  await h.submitPush();
  const call = h.calls.find((item) => item.method === 'pushTree');
  assert.equal(call.input.treeId, 'r');
  assert.equal(call.input.document.title, '导入后编辑');
});

async function nameForm(h, value, submitLabel) {
  const input = h.all('input').find((node) => node.props['aria-label'] === '知识树名称');
  assert.ok(input);
  input.props.onChange({ target: { value } }); h.render();
  const form = h.all('form').find((node) => node.props['aria-labelledby'] === 'kw-name-title');
  await form.props.onSubmit({ preventDefault() {} }); await h.tick();
}

test('new local tree accepts a trimmed name and cancellation creates nothing', async () => {
  const h = harness([record('a', document('原树'))]); await h.start();
  await h.click('新建本地树'); await h.click('取消');
  assert.equal(h.records.size, 1);
  await h.click('新建本地树'); await nameForm(h, '  我的读书笔记  ');
  assert.equal(h.records.get('new-1').document.title, '我的读书笔记');
  assert.ok(h.stores.get('new-1'));
  assert.equal(h.calls.some((call) => call.method === 'pushTree'), false);
});

test('empty or oversized tree names are rejected without creating records', async () => {
  const h = harness([record('a', document('原树'))]); await h.start(); await h.click('新建本地树');
  for (const value of ['   ', '树'.repeat(61)]) {
    await nameForm(h, value);
    assert.equal(h.records.size, 1); assert.match(h.text(), /名称不能为空/);
  }
});

test('renaming the active tree updates its editor and preserves ID, cards and sync', async () => {
  const sync = {remoteKey:prefix+'remote-a', treeId:'remote-a', baseHash:'base'};
  const h = harness([record('a', document('旧名称'), sync)]); await h.start();
  h.context('旧名称'); await h.click('重命名'); await nameForm(h, '新名称');
  assert.equal(h.records.get('a').document.title, '新名称');
  assert.deepEqual(h.records.get('a').sync, sync);
  assert.equal(h.stores.get('a').document.title, '新名称');
  const next = copy(h.stores.get('a').document); next.cards[0].content = '新正文';
  await h.save('a', next);
  assert.equal(h.records.get('a').document.title, '新名称');
  assert.equal(h.calls.some(call => call.method === 'pushTree'), false);
});

test('renaming an unopened tree leaves the active tree unchanged and rejects stale revisions', async () => {
  const h = harness([record('a', document('A')),record('b', document('B'))]); await h.start();
  h.doubleClick('B');
  await nameForm(h, 'B2');
  assert.equal(h.records.get('b').document.title,'B2');
  assert.equal(h.stores.get('a').document.title,'A');
  h.doubleClick('B2');
  h.records.set('b',{...h.records.get('b'),revision:99,document:document('另一窗口')});
  await nameForm(h,'不能覆盖');
  assert.equal(h.records.get('b').document.title,'另一窗口');
  assert.match(h.text(), /另一窗口更新/);
});

test('rename storage failure keeps the editor draft and reports unsaved state', async () => {
  const h = harness([record('a',document('旧名称'))]); await h.start();
  h.context('旧名称'); await h.click('重命名'); h.failSave=true;
  await nameForm(h,'保存失败的名字');
  assert.equal(h.records.get('a').document.title,'旧名称');
  assert.equal(h.stores.get('a').document.title,'保存失败的名字');
  assert.match(h.text(),/保存失败/);
});

test('local action buttons are hidden until context menu, and double click opens rename', async () => {
  const h=harness([record('a',document('A'))]); await h.start();
  assert.equal(h.all('button').some(node=>['重命名','删除'].includes(h.text(node))),false);
  h.context('A');
  assert.equal(h.all('button').filter(node=>node.props.role==='menuitem').length,2);
  assert.ok(h.all('div').some(node=>node.props.role==='menu'));
  await h.click('重命名');
  assert.equal(h.all('div').some(node=>node.props.role==='menu'),false);
  await h.click('取消');
  h.doubleClick('A');
  assert.ok(h.all('form').some(node=>node.props['aria-labelledby']==='kw-name-title'));
});

test('keyboard context menu and F2 provide non-pointer tree actions', async () => {
  const h=harness([record('a',document('A'))]); await h.start();
  const button=h.all('button').find(node=>node.props.onContextMenu);
  button.props.onKeyDown({key:'F10',shiftKey:true,preventDefault(){},currentTarget:{getBoundingClientRect(){return {left:10,bottom:40};}}}); h.render();
  assert.ok(h.all('div').some(node=>node.props.role==='menu'));
  await h.click('重命名'); await h.click('取消');
  button.props.onKeyDown({key:'F2',preventDefault(){}}); h.render();
  assert.ok(h.all('form').some(node=>node.props['aria-labelledby']==='kw-name-title'));
});

test('delete requires inline confirmation and never calls remote deletion', async () => {
  const h = harness([record('a', document('A'))]);
  await h.start(); h.context('A'); await h.click('删除');
  assert.equal(h.records.size, 1);
  await h.click('确认删除');
  assert.equal(h.records.size, 0);
  assert.equal(h.snapshots.length, 1);
  assert.equal(h.calls.some((call) => /delete/i.test(call.method)), false);
});
