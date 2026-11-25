import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, realpath, mkdtemp, rm } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, basename, join } from 'node:path';
import { once } from 'node:events';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { apply } from '../index.js';

// Execute the published official bridge, not an invented approximation. It has
// only node:stream runtime imports; stripping types does not change its logic.
const source = await readFile(new URL(import.meta.resolve('@deepseek-ai/dsh-client-connection/src/http-bridge.ts')), 'utf8');
const bridgeJs = stripTypeScriptTypes(source, { mode: 'strip' });
const { bridge } = await import('data:text/javascript;base64,' + Buffer.from(bridgeJs).toString('base64'));

test('real HTTP -> official DSH bridge -> official JSON backend supports GET, follow POST, reread and unfollow', async () => {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'dsh-watch-http-test-'));
  const backend = new JsonStorageBackend(root); const routes = new Map(); const effects = [];
  let legacyMode = false;
  const services = {
    storage: { backend: { get: () => backend } },
    connection: {
      // Isolated test identity only. No live DSH tokens or browser credentials.
      admit: ({ headers }) => headers.get('x-test-owner') === 'yes' ? { peer: { principal: { kind: 'owner' } } } : { rejection: 403 },
      fetch: { register(route) { routes.set(route.path, route); return async () => routes.delete(route.path); } },
    },
    sessionController: { state: async () => ({ running: false, pendingInput: [], cursor: 0 }) },
  };
  await apply({ get: key => services[key], effect(fn) { effects.push(fn()); } });
  const handler = {
    requestBodyMode({ url }) { return legacyMode ? 'streaming' : routes.get(url.pathname)?.requestBody || 'buffered'; },
    async fetch(request) {
      const route = routes.get(new URL(request.url).pathname);
      if (!route) return new Response('', { status: 404 });
      if (!route.methods.includes(request.method)) return new Response('', { status: 405 });
      return route.fetch(request);
    },
  };
  const server = createServer(async (req, res) => {
    try { await bridge(req, res, handler, {}); }
    catch (error) { if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
  });
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    const get = () => fetch(origin + '/api/session-watch/state', { headers: { 'x-test-owner': 'yes' } });
    // Demonstrate the user's exact failure with the old route body mode.
    legacyMode = true;
    let response = await get(); assert.equal(response.status, 500);
    assert.match((await response.json()).error, /GET\/HEAD.*body|GET.*body/i);
    legacyMode = false;
    response = await get(); assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).state.followed, []);
    const post = action => fetch(origin + '/api/session-watch/update', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-owner': 'yes' }, body: JSON.stringify(action),
    });
    response = await post({ revision: 0, action: { type: 'follow', ids: ['clicked-session'] } });
    assert.equal(response.status, 200); assert.deepEqual((await response.json()).state.followed, ['clicked-session']);
    response = await get(); assert.deepEqual((await response.json()).state.followed, ['clicked-session']);
    response = await post({ revision: 1, action: { type: 'unfollow', id: 'clicked-session' } });
    assert.equal(response.status, 200); assert.deepEqual((await response.json()).state.followed, []);
    const beforeKeys = (await (await get()).json()).state;
    const config = { ...beforeKeys.shortcuts, enabled: false, prefix: 'Ctrl+Alt+B' };
    response = await post({ revision: beforeKeys.revision, action: { type: 'shortcuts', config, expectedConfig: beforeKeys.shortcuts } });
    assert.equal(response.status, 200); assert.equal((await response.json()).state.shortcuts.enabled, false);
    const reread = (await (await get()).json()).state.shortcuts;
    assert.equal(reread.prefix, 'Ctrl+Alt+B');
    const persisted = JSON.parse(await readFile(join(root, 'session_watch.json'), 'utf8'));
    assert.deepEqual(persisted.global.shortcuts, reread);
    response = await fetch(origin + '/api/session-watch/state'); assert.equal(response.status, 403);
    response = await fetch(origin + '/api/session-watch/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 403);
    // Authentication was not removed to get the interaction working.
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    for (const dispose of effects.reverse()) await dispose(); await backend.close();
    const resolved = await realpath(root);
    assert.equal(dirname(resolved), parent); assert.ok(basename(resolved).startsWith('dsh-watch-http-test-')); assert.equal(resolved, root);
    await rm(resolved, { recursive: true, force: true });
  }
});
