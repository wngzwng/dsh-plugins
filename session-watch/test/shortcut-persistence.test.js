import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../core.js';
import { createDefaultShortcutConfig } from '../shortcuts.js';
import { createStateController } from '../host-state.js';
const source = (await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8')).replace(/^export\s+/gm, '');
const context = vm.createContext({ ...core, setTimeout, clearTimeout, structuredClone });
vm.runInContext(source + '\nglobalThis.Store = createWatchStore;', context);
const Store = context.Store;
const disk = initial => ({ saved: initial, writes: 0, async loadAll() { return { global: this.saved }; }, async setGlobal(value) { this.writes++; this.saved = structuredClone(value); }, async close() {} });
const modified = () => ({ ...createDefaultShortcutConfig(), prefix: 'Ctrl+Alt+B' });

test('old Ctrl+B profile migrates on load and persists atomically with the next successful state save', async () => {
  const old = { ...core.createDefaultState(), followed: ['a'], panes: ['a', null, null, null], mode: 'split' };
  old.shortcuts.prefix = 'Ctrl+B'; old.shortcuts.enabled = false; old.shortcuts.bindings[0].scopes = ['local', 'outside'];
  const medium = disk(old); const controller = await createStateController(medium);
  assert.equal(controller.get().shortcuts.prefix, 'Ctrl+;'); assert.equal(controller.get().shortcuts.enabled, false);
  assert.equal(medium.writes, 0); assert.equal(medium.saved.shortcuts.prefix, 'Ctrl+B');
  assert.deepEqual(controller.get().shortcuts.bindings[0].scopes, ['local', 'outside']);
  const denied = await controller.update(0, { type: 'shortcuts', config: old.shortcuts, expectedConfig: controller.get().shortcuts });
  assert.equal(denied.status, 400); assert.equal(medium.writes, 0);
  const saved = await controller.update(0, { type: 'follow', ids: ['b'] });
  assert.equal(saved.status, 200); assert.equal(medium.saved.shortcuts.prefix, 'Ctrl+;');
  assert.deepEqual(medium.saved.followed, ['a', 'b']); assert.equal(medium.saved.panes[0], 'a');
  const restarted = await createStateController(medium);
  assert.deepEqual(restarted.get(), controller.get()); await controller.close(); await restarted.close();
});

test('legacy profile gains shortcut defaults without losing followed sessions or layouts', async () => {
  const old = { ...core.createDefaultState(), followed: ['a'], panes: ['a', null, null, null], mode: 'split' };
  delete old.shortcuts;
  const medium = disk(old); const controller = await createStateController(medium);
  assert.deepEqual(controller.get().followed, ['a']); assert.equal(controller.get().panes[0], 'a');
  assert.equal(controller.get().shortcuts.prefix, 'Ctrl+;'); assert.equal(medium.writes, 0);
  await controller.close();
});
test('shortcut saves persist only valid settings and preserve enabled/scope state', async () => {
  const medium = disk(null); const controller = await createStateController(medium);
  const config = modified(); config.enabled = false; config.bindings[0].scopes = ['local', 'outside'];
  const expectedConfig = controller.get().shortcuts;
  let response = await controller.update(0, { type: 'shortcuts', config, expectedConfig });
  assert.equal(response.status, 200); assert.equal(medium.saved.shortcuts.enabled, false);
  assert.deepEqual(medium.saved.shortcuts.bindings[0].scopes, ['local', 'outside']);
  const corrupt = modified(); corrupt.bindings[0].keys = ['Enter'];
  response = await controller.update(1, { type: 'shortcuts', config: corrupt, expectedConfig: config });
  assert.equal(response.status, 400); assert.equal(medium.writes, 1);
  const restarted = await createStateController(medium); assert.deepEqual(restarted.get().shortcuts, config);
  await controller.close(); await restarted.close();
});
test('stale settings cannot overwrite another page configuration even at the latest profile revision', async () => {
  const controller = await createStateController(disk(null)); const expectedConfig = controller.get().shortcuts;
  await controller.update(0, { type: 'shortcuts', config: modified(), expectedConfig });
  await controller.update(1, { type: 'follow', ids: ['other'] });
  const result = await controller.update(2, { type: 'shortcuts', config: { ...expectedConfig, enabled: false }, expectedConfig });
  assert.equal(result.status, 409); assert.equal(result.body.error, 'shortcuts-changed');
  assert.equal(controller.get().shortcuts.prefix, 'Ctrl+Alt+B'); await controller.close();
});
test('client settings are not applied before durable acknowledgment', async () => {
  let finish; const initial = core.createDefaultState();
  const store = Store(async (method, body) => method === 'GET' ? { status: 200, body: { state: initial } } : new Promise(resolve => {
    finish = () => resolve({ status: 200, body: { state: core.reduceState(initial, body.action) } });
  }));
  await store.refresh();
  const pending = store.dispatch({ type: 'shortcuts', config: modified(), expectedConfig: initial.shortcuts });
  assert.equal(store.getSnapshot().state.shortcuts.prefix, 'Ctrl+Alt+B');
  assert.equal(store.getConfirmedState().shortcuts.prefix, 'Ctrl+;');
  finish(); assert.equal(await pending, true); assert.equal(store.getConfirmedState().shortcuts.prefix, 'Ctrl+Alt+B'); store.dispose();
});
test('settings conflict resolves false and never silently retries an overwritten configuration', async () => {
  let posts = 0; const initial = core.createDefaultState();
  const latest = core.reduceState(initial, { type: 'shortcuts', config: modified() });
  const store = Store(async method => {
    if (method === 'GET') return { status: 200, body: { state: initial } };
    posts++; return { status: 409, body: { state: latest, error: 'shortcuts-changed' } };
  });
  await store.refresh();
  assert.equal(await store.dispatch({ type: 'shortcuts', config: { ...initial.shortcuts, enabled: false }, expectedConfig: initial.shortcuts }), false);
  assert.equal(posts, 1); assert.equal(store.getConfirmedState().shortcuts.prefix, 'Ctrl+Alt+B');
  assert.match(store.getSnapshot().error, /其他页面/); store.dispose();
});
