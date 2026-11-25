import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { apply, inject, STORAGE_DESCRIPTOR } from '../index.js';
import { createStateController } from '../host-state.js';

async function temporary(t) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'dsh-session-watch-test-'));
  t.after(async () => {
    // Delete only the exact temporary directory this test created.
    const resolved = await realpath(root);
    assert.equal(dirname(resolved), parent);
    assert.ok(basename(resolved).startsWith('dsh-session-watch-test-'));
    assert.equal(resolved, root);
    await rm(resolved, { recursive: true, force: true });
  });
  return root;
}

test('official JSON backend rejects the old hyphenated name and accepts the production descriptor', async t => {
  const root = await temporary(t); const backend = new JsonStorageBackend(root);
  try {
    await assert.rejects(backend.kv.open({ ...STORAGE_DESCRIPTOR, name: 'session-watch' }), /invalid unit name/);
    assert.equal(STORAGE_DESCRIPTOR.name, 'session_watch');
    assert.ok(inject.includes('storage.backend.json'));
    const unit = await backend.kv.open(STORAGE_DESCRIPTOR);
    assert.equal((await unit.loadAll()).global, null);
    await unit.close();
  } finally { await backend.close(); }
});

test('official backend persists follows/layout/read and restores them after a full backend restart', async t => {
  const root = await temporary(t); let backend = new JsonStorageBackend(root);
  let controller;
  try {
    controller = await createStateController(await backend.kv.open(STORAGE_DESCRIPTOR));
    await controller.update(0, { type: 'follow', ids: ['session-a', 'session-b'] });
    await controller.update(1, { type: 'assign', id: 'session-b', index: 1 });
    await controller.update(2, { type: 'read', id: 'session-b', seq: 42 });
    const beforeKeys = controller.get().shortcuts;
    await controller.update(3, { type: 'shortcuts', config: { ...beforeKeys, prefix: 'Ctrl+Alt+B', enabled: false }, expectedConfig: beforeKeys });
    const expected = controller.get();
    assert.equal(expected.shortcuts.prefix, 'Ctrl+Alt+B');
    const document = JSON.parse(await readFile(join(root, 'session_watch.json'), 'utf8'));
    assert.equal(document.unit.name, STORAGE_DESCRIPTOR.name);
    assert.deepEqual(document.global, expected);
    await controller.close(); controller = null;
    await backend.close();
    backend = new JsonStorageBackend(root);
    controller = await createStateController(await backend.kv.open(STORAGE_DESCRIPTOR));
    assert.deepEqual(controller.get(), expected);
  } finally { await controller?.close(); await backend.close(); }
});

test('Host activation succeeds against the official backend and releases the unit on unload', async t => {
  const root = await temporary(t); const backend = new JsonStorageBackend(root);
  const effects = []; const routes = new Map();
  const services = {
    storage: { backend: { get(key) { assert.equal(key, 'json'); return backend; } } },
    connection: { fetch: { register(route) { assert.match(route.path, /^\/api\/session-watch\/(state|update|status)$/); routes.set(route.path, route); return async () => routes.delete(route.path); } } },
    sessionController: {},
  };
  try {
    await apply({ get: key => services[key], effect(fn) { effects.push(fn()); } });
    assert.equal(routes.size, 3);
    for (const dispose of effects.reverse()) await dispose();
    effects.length = 0;
    assert.equal(routes.size, 0);
    // Reopening also checks that activation did not leak a live unit handle.
    const reopened = await backend.kv.open(STORAGE_DESCRIPTOR); await reopened.close();
  } finally { for (const dispose of effects.reverse()) await dispose(); await backend.close(); }
});
