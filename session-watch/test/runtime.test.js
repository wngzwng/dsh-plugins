import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../core.js';
const source = (await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8')).replace(/^export\s+/gm, '');
const context = vm.createContext({ ...core, setTimeout, clearTimeout, structuredClone });
vm.runInContext(source + '\nglobalThis.runtime = { createWatchStore, createMonitor };', context);
const { createWatchStore, createMonitor } = context.runtime;
const settle = () => new Promise(resolve => setImmediate(resolve));

test('client serializes queued actions, rebases 409, and keeps optimistic UI coherent', async () => {
  let server = core.createDefaultState(); let conflict = true; const calls = [];
  const store = createWatchStore(async (method, body) => {
    if (method === 'GET') return { status: 200, body: { state: server } };
    calls.push(body);
    if (conflict) { conflict = false; server = core.reduceState(server, { type: 'follow', ids: ['other-tab'] }); return { status: 409, body: { state: server } }; }
    assert.equal(body.revision, server.revision);
    server = core.reduceState(server, body.action); return { status: 200, body: { state: server } };
  });
  await store.refresh();
  store.dispatch({ type: 'follow', ids: ['a'] }); store.dispatch({ type: 'assign', id: 'a', index: 1 });
  assert.deepEqual([...store.getSnapshot().state.followed], ['a']);
  await settle();
  assert.deepEqual([...store.getSnapshot().state.followed], ['other-tab', 'a']);
  assert.equal(store.getSnapshot().state.panes[1], 'a'); assert.equal(store.getSnapshot().saving, false); assert.equal(calls.length, 3);
  store.dispose();
});
test('save failure is visible and rolls back only failed optimistic action', async () => {
  const store = createWatchStore(async method => {
    if (method === 'GET') return { status: 200, body: { state: core.createDefaultState() } };
    throw new Error('offline');
  });
  await store.refresh(); store.dispatch({ type: 'follow', ids: ['a'] }); await settle();
  assert.deepEqual([...store.getSnapshot().state.followed], []); assert.match(store.getSnapshot().error, /保存失败/);
  store.dispose();
});
test('load errors do not enable writes or overwrite saved state', async () => {
  const store = createWatchStore(async () => { throw new Error('offline'); });
  await store.refresh(); store.dispatch({ type: 'follow', ids: ['a'] });
  assert.equal(store.getSnapshot().ready, false); assert.match(store.getSnapshot().error, /读取/);
  store.dispose();
});
test('late POST response never rolls back a newer refresh revision', async () => {
  let server = core.reduceState(core.createDefaultState(), { type: 'follow', ids: ['a'] });
  let finish;
  const store = createWatchStore(async (method, body) => {
    if (method === 'GET') return { status: 200, body: { state: server } };
    server = core.reduceState(server, body.action);
    const committed = server;
    return new Promise(resolve => { finish = () => resolve({ status: 200, body: { state: committed } }); });
  });
  await store.refresh(); store.dispatch({ type: 'follow', ids: ['b'] });
  server = core.reduceState(server, { type: 'follow', ids: ['c'] });
  await store.refresh(); finish(); await settle();
  assert.equal(store.getSnapshot().state.revision, 3);
  assert.deepEqual([...store.getSnapshot().state.followed], ['a', 'b', 'c']);
  store.dispose();
});
test('monitor deduplicates retains, subscribes to native updates, releases all references', async () => {
  let retains = 0; let releases = 0; let subscriptions = 0; let notifications = 0;
  const callbacks = new Set();
  const observable = value => ({ getSnapshot: () => value, subscribe(fn) { subscriptions++; callbacks.add(fn); return () => { subscriptions--; callbacks.delete(fn); }; } });
  const sessions = { retain(id, options) {
    retains++; assert.equal(options.source, 'controllerOperation');
    const binding = { session: { ...observable({ running: true }), loadOlder: async () => {} }, eventSource: observable({ entries: [{ type: 'event', event: { type: 'user/message', seq: 2, time: 100, data: { content: [{ type: 'text', text: id }] } } }], hasMore: false }) };
    return { binding, ready: Promise.resolve(binding), release() { releases++; } };
  } };
  const monitor = createMonitor(sessions, () => notifications++, fn => { queueMicrotask(fn); return 1; }, () => {});
  monitor.sync(['a', 'a', 'b']); assert.equal(retains, 2); assert.equal(monitor.count(), 2);
  assert.equal(monitor.get('a').snippet, 'a'); assert.equal(subscriptions, 4);
  monitor.sync(['b']); assert.equal(releases, 1); assert.equal(subscriptions, 2);
  await settle(); assert.ok(notifications > 0);
  monitor.releaseAll(); assert.equal(releases, 2); assert.equal(subscriptions, 0); assert.equal(monitor.count(), 0);
});
test('preview read watermark excludes metadata and buffered history can expand', async () => {
  const entries = Array.from({ length: 100 }, (_, i) => ({ type: 'event', event: { type: 'user/message', seq: i + 1, time: 100 + i, data: { content: [{ type: 'text', text: String(i) }] } } }));
  entries.push({ type: 'event', event: { type: 'turn/end', seq: 101, time: 201, data: { reason: 'done' } } });
  const sessions = { retain() { return { binding: { session: { getSnapshot: () => ({}), subscribe: () => () => {}, loadOlder: async () => { throw new Error('not needed for buffered history'); } }, eventSource: { getSnapshot: () => ({ entries, hasMore: false }), subscribe: () => () => {} } }, ready: Promise.resolve(), release() {} }; } };
  const monitor = createMonitor(sessions, () => {}); monitor.sync(['a']);
  assert.equal(monitor.get('a').latestSeq, 101); assert.equal(monitor.get('a').contentSeq, 100);
  assert.equal(monitor.get('a').rows.length, 80); assert.equal(monitor.get('a').hasMore, true);
  await monitor.loadOlder('a'); assert.equal(monitor.get('a').rows.length, 100); assert.equal(monitor.get('a').rowLimit, 160);
  monitor.releaseAll();
});
test('partial subscription failure releases earlier disposer and permits retry', async () => {
  let active = 0; let released = 0; let fail = true;
  const sessions = { retain() { return { binding: {
    session: { getSnapshot: () => ({}), subscribe() { active++; return () => active--; } },
    eventSource: { getSnapshot: () => ({ entries: [] }), subscribe() { if (fail) throw new Error('injected'); active++; return () => active--; } },
  }, ready: Promise.resolve(), release() { released++; } }; } };
  const monitor = createMonitor(sessions, () => {});
  monitor.sync(['a']); assert.equal(active, 0); assert.equal(released, 1); assert.equal(monitor.count(), 0);
  fail = false; monitor.sync(['a']); assert.equal(active, 2); assert.equal(monitor.count(), 1);
  monitor.releaseAll(); assert.equal(active, 0); assert.equal(released, 2);
});
test('unobserved followed sessions keep only small known unread watermarks', async () => {
  const sessions = { retain(id) { return { binding: {
    session: { getSnapshot: () => ({}), subscribe: () => () => {} },
    eventSource: { getSnapshot: () => ({ entries: [{ type: 'event', event: { type: 'user/message', seq: 9, time: 100, data: { content: [{ type: 'text', text: id }] } } }] }), subscribe: () => () => {} },
  }, ready: Promise.resolve(), release() {} }; } };
  const monitor = createMonitor(sessions, () => {}); monitor.sync(['a'], ['a', 'b']);
  monitor.sync(['b'], ['a', 'b']); assert.equal(monitor.get('a').contentSeq, 9); assert.equal(monitor.get('a').rows, undefined);
  monitor.sync(['b'], ['b']); assert.equal(monitor.get('a'), undefined); monitor.releaseAll();
});
test('historical prepends do not change latest content identity', async () => {
  const event = seq => ({ type: 'event', event: { type: 'user/message', seq, time: seq, data: { content: [{ type: 'text', text: String(seq) }] } } });
  const short = core.extractPreview([event(20), event(21)]);
  const long = core.extractPreview([event(1), event(2), event(20), event(21)]);
  assert.equal(short.rows.at(-1).key, long.rows.at(-1).key);
});
test('monitor restores requested row window and loads through stable reading anchor', async () => {
  let loaded;
  const sessions = { retain() { return { binding: {
    session: { getSnapshot: () => ({}), subscribe: () => () => {}, async loadThrough(seq) { loaded = seq; } },
    eventSource: { getSnapshot: () => ({ entries: [], hasMore: true }), subscribe: () => () => {} },
  }, ready: Promise.resolve(), release() {} }; } };
  const monitor = createMonitor(sessions, () => {}, setTimeout, clearTimeout, () => ({ rowLimit: 160, anchorSeq: 17, following: false }));
  monitor.sync(['a']); assert.equal(monitor.get('a').restoring, true);
  await settle(); assert.equal(loaded, 17); assert.equal(monitor.get('a').rowLimit, 160); assert.equal(monitor.get('a').restoring, false);
  monitor.releaseAll();
});
test('monitor caps active references and does not reacquire unchanged set', async () => {
  let retains = 0; let releases = 0;
  const sessions = { retain() { retains++; return { binding: { session: { getSnapshot: () => ({}), subscribe: () => () => {} }, eventSource: { getSnapshot: () => ({ entries: [], hasMore: false }), subscribe: () => () => {} } }, ready: Promise.resolve(), release: () => releases++ }; } };
  const monitor = createMonitor(sessions, () => {});
  const ids = Array.from({ length: 50 }, (_, i) => String(i)); monitor.sync(ids); monitor.sync(ids);
  assert.equal(retains, 12); monitor.releaseAll(); assert.equal(releases, 12);
});
