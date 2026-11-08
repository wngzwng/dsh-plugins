import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function editor() {
  let loaded;
  const calls = [];
  const source = (await readFile(new URL('../knowledge-tree/client.js', import.meta.url), 'utf8'))
    .replace("return { inject: ['slots', 'locale'], apply };", "return { createStore, normalizeData };");
  const context = vm.createContext({ structuredClone, console, setTimeout, clearTimeout,
    window: { __ModuleLoader__: { load(value) { loaded = value; } }, localStorage: {
      getItem() { return null; }, setItem(key) { calls.push(key); throw new Error('legacy storage must not be written'); },
    } } });
  vm.runInContext(source, context);
  return { ...loaded.factory(() => ({ createElement() {} })), calls };
}
const record = { id: 'tree-test', document: {version:3,title:'原始树',stage:'brainstorm',cards:[],links:[]},ui:{} };
const tick = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };

test('bundled editor persists independent library records, never writes legacy data or UI', async () => {
  const { createStore, calls } = await editor();
  const saved = [];
  const store = createStore(record, async(document,ui) => { saved.push(structuredClone({document,ui})); });
  store.addCard('第一张', '正文');
  store.setTitle('修改标题');
  await tick();
  assert.equal(saved.at(-1).document.title, '修改标题');
  assert.equal(saved.at(-1).document.cards.length, 1);
  assert.equal(store.getState().storageError, false);
  assert.ok(store.getState().savedAt);
  assert.deepEqual(calls, []);
  assert.throws(() => createStore(), /record/);
});

test('bundled editor catches asynchronous write failure and retains unsaved document', async () => {
  const {createStore,calls} = await editor();
  const store = createStore(record, async()=>{throw new Error('quota');});
  store.addCard('未保存卡片','请保留');
  await tick();
  assert.equal(store.getState().storageError,true);
  assert.equal(store.getState().savedAt,null);
  assert.equal(store.getState().cards[0].title,'未保存卡片');
  assert.deepEqual(calls,[]);
});

test('late completion of an older editor save cannot mark newer unsaved data saved', async () => {
  const {createStore} = await editor();
  const pending = [];
  const store = createStore(record, ()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
  store.setTitle('first'); await tick();
  store.setTitle('second'); await tick();
  pending[0].resolve(); await tick();
  assert.equal(store.getState().savedAt,null);
  pending[1].reject(new Error('failed')); await tick();
  assert.equal(store.getState().storageError,true);
  assert.equal(store.getState().title,'second');
});
