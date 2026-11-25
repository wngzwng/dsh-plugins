import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateController, readBoundedJson } from '../host-state.js';
import { apply } from '../index.js';

function unit(initial = null) {
  return { saved: initial, writes: 0, closed: false, fail: false,
    async loadAll() { return { global: this.saved, tables: {} }; },
    async setGlobal(value) { if (this.fail) throw new Error('disk-full'); this.saved = structuredClone(value); this.writes++; },
    async close() { this.closed = true; },
  };
}
test('state persists only after write acknowledgment and rejects stale writers', async () => {
  const disk = unit(); const controller = await createStateController(disk);
  const [a, b] = await Promise.all([controller.update(0, { type: 'follow', ids: ['a'] }), controller.update(0, { type: 'follow', ids: ['b'] })]);
  assert.equal(a.status, 200); assert.equal(b.status, 409);
  assert.deepEqual(controller.get().followed, ['a']); assert.equal(disk.writes, 1);
  const again = await createStateController(disk); assert.deepEqual(again.get().followed, ['a']);
});
test('failed storage writes leave prior state intact and do not poison the queue', async () => {
  const disk = unit(); const controller = await createStateController(disk); disk.fail = true;
  await assert.rejects(controller.update(0, { type: 'follow', ids: ['a'] }));
  assert.deepEqual(controller.get().followed, []); disk.fail = false;
  assert.equal((await controller.update(0, { type: 'follow', ids: ['b'] })).status, 200);
});
test('malformed actions and revisions cannot mutate state; returned snapshots are detached', async () => {
  const disk = unit(); const controller = await createStateController(disk);
  for (const action of [null, [], { type: 'prompt' }, { type: 'cancel' }]) assert.equal((await controller.update(0, action)).status, 400);
  assert.equal((await controller.update(-1, { type: 'follow' })).status, 400);
  const value = controller.get(); value.followed.push('injected'); assert.deepEqual(controller.get().followed, []);
  await controller.close(); assert.equal(disk.closed, true);
  await assert.rejects(controller.update(0, { type: 'follow', ids: ['a'] }));
});
test('unknown storage versions fail closed without overwriting existing data', async () => {
  const disk = unit({ version: 99, followed: ['important'] });
  await assert.rejects(createStateController(disk)); assert.equal(disk.writes, 0);
});
test('bounded JSON rejects wrong types, invalid JSON and oversized stream bodies', async () => {
  const request = body => new Request('http://localhost/api/session-watch/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  assert.deepEqual(await readBoundedJson(request('{"revision":0}')), { revision: 0 });
  await assert.rejects(readBoundedJson(request('{')));
  await assert.rejects(readBoundedJson(request('x'.repeat(100)), 10));
  await assert.rejects(readBoundedJson(new Request('http://localhost', { method: 'POST', body: '{}' })));
});
test('host routes require authenticated owner, enforce CAS, and expose only passive status reads', async () => {
  const disk = unit(); const routes = new Map(); const effects = []; let statusReads = 0;
  const services = {
    storage: { backend: { names: () => ['json'], get: key => { assert.equal(key, 'json'); return { kv: { open: async () => disk } }; } } },
    connection: { admit: ({ headers }) => headers.get('x-test-owner') === 'yes' ? { peer: { principal: { kind: 'owner' } } } : { rejection: 403 },
      fetch: { async register(route) { assert.match(route.path, /^\/api\/session-watch\/(state|update|status)$/); routes.set(route.path, route); return () => routes.delete(route.path); } } },
    sessionController: { async state({ sessionId }) { statusReads++; return { running: false, pendingInput: sessionId === 'a' ? ['question'] : [], cursor: 7 }; } },
  };
  const ctx = { get: key => services[key], logger: { warn() {} }, effect(fn) { effects.push(fn()); } };
  await apply(ctx);
  const state = routes.get('/api/session-watch/state'); const status = routes.get('/api/session-watch/status');
  const update = routes.get('/api/session-watch/update');
  assert.deepEqual(state.methods, ['GET']); assert.equal(state.requestBody, 'buffered');
  assert.deepEqual(update.methods, ['POST']); assert.equal(update.requestBody, 'streaming');
  const request = (path, method = 'GET', body, owner = true) => new Request('http://localhost/api' + path, { method, headers: { ...(owner ? { 'x-test-owner': 'yes' } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await state.fetch(request('/session-watch/state', 'GET', null, false))).status, 403);
  assert.equal((await status.fetch(request('/session-watch/status?id=a', 'GET', null, false))).status, 403);
  let response = await update.fetch(request('/session-watch/update', 'POST', { revision: 0, action: { type: 'follow', ids: ['a'] } }));
  assert.deepEqual((await response.json()).state.followed, ['a']);
  response = await update.fetch(request('/session-watch/update', 'POST', { revision: 0, action: { type: 'follow', ids: ['b'] } }));
  assert.equal(response.status, 409);
  response = await status.fetch(request('/session-watch/status?id=a'));
  assert.deepEqual((await response.json()).items.a.pendingInput, ['question']); assert.equal(statusReads, 1);
  for (const effect of effects.reverse()) { const dispose = await effect; if (typeof dispose === 'function') await dispose(); }
  assert.equal(routes.size, 0); assert.equal(disk.closed, true);
});
