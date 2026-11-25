import { createDefaultState, normalizeState, reduceState } from './core.js';
import { normalizeShortcutConfig, validateShortcutConfig } from './shortcuts.js';

const ACTIONS = new Set(['follow', 'unfollow', 'assign', 'remove-pane', 'mode', 'layout', 'active', 'ratios', 'read', 'reorder', 'shortcuts']);
export function validAction(action) {
  return !!action && typeof action === 'object' && !Array.isArray(action) && ACTIONS.has(action.type)
    && (action.type !== 'shortcuts' || (action.config?.version === 1 && action.expectedConfig?.version === 1
      && validateShortcutConfig(action.config).valid && validateShortcutConfig(action.expectedConfig).valid));
}

// One serial writer per profile. State is published only after durable storage
// acknowledges the write; rejected writes leave the previous snapshot intact.
export async function createStateController(unit) {
  const saved = (await unit.loadAll()).global;
  if (saved != null && (typeof saved !== 'object' || saved.version !== 1)) {
    throw new Error('Unsupported session-watch data version; existing data was not overwritten');
  }
  let state = saved == null ? createDefaultState() : normalizeState(saved);
  let tail = Promise.resolve();
  let closing = false;
  return {
    get: () => structuredClone(state),
    update(revision, action) {
      if (closing) return Promise.reject(new Error('Storage is closing'));
      const operation = tail.then(async () => {
        if (!Number.isSafeInteger(revision) || revision < 0 || !validAction(action)) {
          return { status: 400, body: { error: 'invalid-action' } };
        }
        if (revision !== state.revision) return { status: 409, body: { state: structuredClone(state) } };
        if (action.type === 'shortcuts' && JSON.stringify(normalizeShortcutConfig(action.expectedConfig)) !== JSON.stringify(state.shortcuts)) {
          return { status: 409, body: { state: structuredClone(state), error: 'shortcuts-changed' } };
        }
        const next = reduceState(state, action);
        if (next !== state) {
          await unit.setGlobal(next);
          state = next;
        }
        return { status: 200, body: { state: structuredClone(state) } };
      });
      tail = operation.catch(() => {});
      return operation;
    },
    async close() { closing = true; await tail; await unit.close(); },
  };
}

export async function readBoundedJson(request, maxBytes = 32768) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('content-type');
  if (Number(request.headers.get('content-length')) > maxBytes) throw new Error('body-too-large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty-body');
  const chunks = []; let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('body-too-large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
}
