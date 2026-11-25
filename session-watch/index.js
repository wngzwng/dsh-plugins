import { createStateController, readBoundedJson } from './host-state.js';

export const name = 'session-watch';
export const inject = ['storage', 'storage.backend.json', 'connection', 'sessionController'];

// DSH 0.2.2 UNIT_NAME_RE: /^[a-z][a-z0-9_]*$/ (no hyphens).
export const STORAGE_DESCRIPTOR = Object.freeze({ name: 'session_watch', version: 1, tables: Object.freeze([]), hasGlobal: true, layout: 'single' });

export async function apply(ctx) {
  const storage = ctx.get('storage');
  const connection = ctx.get('connection');
  if (!storage || !connection) throw new Error('session-watch requires storage and connection');
  // Match the lifecycle dependency above; do not silently choose a different
  // backend merely because it also exposes the KV facet.
  const backend = storage.backend.get('json');
  if (!backend?.kv) throw new Error('session-watch requires the JSON KV backend');
  const unit = await backend.kv.open(STORAGE_DESCRIPTOR);
  let controller;
  try { controller = await createStateController(unit); }
  catch (error) { await unit.close(); throw error; }
  ctx.effect(() => () => controller.close(), 'session-watch: profile state');
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
  // Shared connection routes inherit DSH authentication, trusted Host/Origin,
  // and Peer admission. No unauthenticated webServer escape-hatch routes.
  const disposeState = await connection.fetch.register({
    // The native bridge attaches a body to every streaming request. GET must
    // therefore be buffered; keep bounded streaming writes on a separate URL.
    path: '/api/session-watch/state', methods: ['GET'], requestBody: 'buffered',
    async fetch(request) {
      const admission = connection.admit({ headers: request.headers });
      if (admission.rejection || admission.peer?.principal.kind !== 'owner') return json({ error: 'owner-required' }, 403);
      return json({ state: controller.get() });
    },
  });
  ctx.effect(() => disposeState, 'session-watch: authenticated read route');
  const disposeUpdate = await connection.fetch.register({
    path: '/api/session-watch/update', methods: ['POST'], requestBody: 'streaming',
    async fetch(request) {
      const admission = connection.admit({ headers: request.headers });
      if (admission.rejection || admission.peer?.principal.kind !== 'owner') return json({ error: 'owner-required' }, 403);
      let body;
      try { body = await readBoundedJson(request); }
      catch { return json({ error: 'invalid-request' }, 400); }
      try {
        const result = await controller.update(body?.revision, body?.action);
        return json(result.body, result.status);
      } catch (error) {
        ctx.logger?.warn?.('session-watch: state persistence failed');
        return json({ error: 'save-failed' }, 503);
      }
    },
  });
  ctx.effect(() => disposeUpdate, 'session-watch: authenticated update route');
  const sessionController = ctx.get('sessionController');
  const disposeStatus = await connection.fetch.register({
    path: '/api/session-watch/status', methods: ['GET'], requestBody: 'buffered',
    async fetch(request) {
      const admission = connection.admit({ headers: request.headers });
      if (admission.rejection || admission.peer?.principal.kind !== 'owner') return json({ error: 'owner-required' }, 403);
      const ids = [...new Set(new URL(request.url).searchParams.getAll('id'))];
      if (ids.length > 12 || ids.some(id => !id || id.length > 200)) return json({ error: 'invalid-ids' }, 400);
      const entries = await Promise.all(ids.map(async sessionId => {
        try {
          const value = await sessionController.state({ sessionId }, request.signal);
          return [sessionId, { running: value.running, pendingInput: value.pendingInput, cursor: value.cursor }];
        } catch { return [sessionId, { unavailable: true }]; }
      }));
      return json({ items: Object.fromEntries(entries) });
    },
  });
  ctx.effect(() => disposeStatus, 'session-watch: passive status route');
}
