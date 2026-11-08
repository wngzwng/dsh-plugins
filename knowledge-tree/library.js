/**
 * Browser/Node ESM library. No imports and no localStorage writes.
 * createLibrary is deliberately self-contained so its source can be embedded in
 * the browser bundle. Inject an IDBFactory (not an IDBDatabase).
 *
 * All promises settle on transaction completion, not request success. Errors
 * have a stable `code` and keep the original failure in `cause` when available.
 *
 * init/listLocal => LocalRecord[]; getLocal/getRemote => record or null.
 * createLocal(document, {id?, sync?, ui?}) / saveLocal(record,
 * {expectedRevision?}) => LocalRecord. saveLocal defaults its CAS expectation to
 * record.revision, and never upserts a deleted record. deleteLocal => boolean.
 * getSetting => JSON or null; setSetting(key, JSON) => JSON (null clears a value).
 * cacheRemote(key, snapshot) => {remoteKey, snapshot, updatedAt}; listRemote
 * filters literal string prefixes. Remote keys must not contain credentials.
 * snapshotLocal => {id, localId, record, createdAt}; listSnapshots(localId?)
 * => snapshots newest first. restoreSnapshot => NEW LocalRecord, never an
 * overwrite. Snapshots survive deletion; there is no automatic retention limit.
 * close() permanently closes this instance; instantiate again to reopen.
 *
 * Settings block credential-shaped keys recursively, not arbitrary secret
 * values: callers must keep tokens in memory and never pass them to this API.
 * Documents allow structural cycles (the UI diagnoses them), but reject bad
 * endpoints, duplicate IDs/pairs and multiple primary parents. No data is
 * silently repaired or discarded when a migration fails.
 */
export function createLibrary({ indexedDB, legacyStorage, onBlocked } = {}) {
  const DATABASE = 'dsh-knowledge-tree-library';
  const VERSION = 1;
  const LEGACY_KEYS = ['dsh-knowledge-tree/v3', 'dsh-knowledge-tree/v2', 'dsh-knowledge-tree/v1'];
  const MIGRATION_KEY = 'legacy-migration-v1';
  const PRIVATE_KEY = /token|authorization|password|secret|credential|api[-_]?key/i;
  let database = null;
  let opening = null;
  let initializing = null;
  let initialized = false;
  let closed = false;

  function error(code, message, cause) {
    const result = new Error(message);
    result.name = 'LibraryError';
    result.code = code;
    if (cause !== undefined) result.cause = cause;
    return result;
  }
  function plain(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }
  function copy(value, code = 'INVALID_DATA') {
    const seen = new Set();
    function visit(item) {
      if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
      if (typeof item === 'number' && Number.isFinite(item)) return item;
      if (typeof item !== 'object' || (!Array.isArray(item) && !plain(item)) || seen.has(item)) {
        throw error(code, 'Only finite, acyclic JSON data can be stored.');
      }
      seen.add(item);
      let result;
      if (Array.isArray(item)) {
        result = Array.from(item, visit);
      } else {
        result = {};
        for (const key of Object.keys(item)) {
          Object.defineProperty(result, key, { value: visit(item[key]), enumerable: true, writable: true, configurable: true });
        }
      }
      seen.delete(item);
      return result;
    }
    return visit(value);
  }
  function nonempty(value, label) {
    if (typeof value !== 'string' || value.length === 0) throw error('INVALID_ARGUMENT', label + ' must be a nonempty string.');
    return value;
  }
  function randomId(prefix) {
    const crypto = globalThis.crypto;
    if (!crypto || typeof crypto.getRandomValues !== 'function') {
      throw error('CRYPTO_UNAVAILABLE', 'Secure random IDs require crypto.getRandomValues.');
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return prefix + '_' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  function documentData(input, legacy = false) {
    const fail = (message) => { throw error('INVALID_DOCUMENT', message); };
    if (!plain(input)) fail('Document must be an object.');
    if (legacy ? ![undefined, 1, 2, 3].includes(input.version) : ![2, 3].includes(input.version)) fail('Unsupported document version.');
    if (!Array.isArray(input.cards) || !Array.isArray(input.links)) fail('Document cards and links must be arrays.');
    if (!['brainstorm', 'classify', 'tree'].includes(input.stage)) fail('Invalid document stage.');
    if (input.title !== undefined && typeof input.title !== 'string') fail('Document title must be a string.');
    if (!legacy && typeof input.title !== 'string') fail('Document title must be a string.');
    const source = copy(input, 'INVALID_DOCUMENT');
    const ids = new Set();
    const cards = source.cards.map((card, index) => {
      if (!plain(card)) fail('Every card must be an object.');
      const id = legacy && !card.id ? randomId('c') : card.id;
      if (typeof id !== 'string' || !id || ids.has(id)) fail('Card IDs must be nonempty and unique.');
      ids.add(id);
      const title = legacy && card.title === undefined ? card.text : card.title;
      const content = legacy && card.content === undefined ? (card.note === undefined ? '' : card.note) : card.content;
      if (typeof title !== 'string' || typeof content !== 'string') fail('Card title and content must be strings.');
      const next = { ...card, id, title, content };
      if (legacy) {
        delete next.text;
        delete next.note;
        if (next.order === undefined) next.order = index;
        if (next.placed === undefined) next.placed = false;
        if (next.image === undefined) next.image = null;
        if (next.createdAt === undefined) next.createdAt = 0;
      }
      return next;
    });
    const linkIds = new Set();
    const pairs = new Set();
    const primaries = new Set();
    const links = source.links.map((link) => {
      if (!plain(link)) fail('Every link must be an object.');
      const id = legacy && !link.id ? randomId('l') : link.id;
      if (typeof id !== 'string' || !id || linkIds.has(id)) fail('Link IDs must be nonempty and unique.');
      linkIds.add(id);
      if (!ids.has(link.parentId) || !ids.has(link.childId) || link.parentId === link.childId) fail('Link endpoints must reference two different cards.');
      const pair = JSON.stringify([link.parentId, link.childId]);
      if (pairs.has(pair)) fail('Duplicate link endpoints.');
      pairs.add(pair);
      if (link.primary !== undefined && typeof link.primary !== 'boolean') fail('Link primary must be boolean.');
      const primary = legacy && link.primary === undefined ? !primaries.has(link.childId) : link.primary === true;
      if (primary && primaries.has(link.childId)) fail('A card cannot have multiple primary parents.');
      if (primary) primaries.add(link.childId);
      return { ...link, id, primary };
    });
    if (legacy) {
      for (const link of links) {
        if (!primaries.has(link.childId)) { link.primary = true; primaries.add(link.childId); }
      }
      const children = new Set(links.map((link) => link.childId));
      for (const card of cards) if (children.has(card.id)) card.placed = true;
    }
    // Preserve a validated remote/local document byte-semantically (including optional
    // fields and version); normalization belongs only to the legacy migration/editor.
    if (!legacy) return source;
    return { version: 3, stage: source.stage, title: source.title || '', cards, links };
  }
  function syncData(input) {
    if (input === undefined || input === null) return { remoteKey: null, baseHash: null };
    if (!plain(input)) throw error('INVALID_ARGUMENT', 'sync must be an object.');
    const result = { remoteKey: input.remoteKey ?? null, baseHash: input.baseHash ?? null };
    if (input.treeId !== undefined && input.treeId !== null) {
      if (typeof input.treeId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(input.treeId)) throw error('INVALID_ARGUMENT', 'sync.treeId must be a safe tree ID.');
      result.treeId = input.treeId;
    }
    if (result.remoteKey !== null) nonempty(result.remoteKey, 'sync.remoteKey');
    if (result.baseHash !== null && typeof result.baseHash !== 'string') throw error('INVALID_ARGUMENT', 'sync.baseHash must be a string or null.');
    if (input.baseDocument !== undefined) result.baseDocument = documentData(input.baseDocument);
    return result;
  }
  function settingsData(key, value) {
    nonempty(key, 'Setting key');
    if (PRIVATE_KEY.test(key)) throw error('SENSITIVE_SETTING', 'Tokens and credentials cannot be persisted in settings.');
    if (value === undefined) return;
    const result = copy(value);
    function inspect(item) {
      if (!item || typeof item !== 'object') return;
      for (const name of Object.keys(item)) {
        if (PRIVATE_KEY.test(name)) throw error('SENSITIVE_SETTING', 'Tokens and credentials cannot be persisted in settings.');
        inspect(item[name]);
      }
    }
    inspect(result);
    return result;
  }
  function open() {
    if (closed) return Promise.reject(error('CLOSED', 'Library connection has been closed. Create a new library instance.'));
    if (database) return Promise.resolve(database);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!indexedDB || typeof indexedDB.open !== 'function') {
        reject(error('IDB_UNAVAILABLE', 'IndexedDB is unavailable; localStorage fallback is intentionally disabled.'));
        return;
      }
      let request;
      let blocked = false;
      try { request = indexedDB.open(DATABASE, VERSION); }
      catch (cause) { reject(error('IDB_OPEN_FAILED', 'Could not open the local library.', cause)); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const [name, keyPath] of [['locals', 'id'], ['remotes', 'remoteKey'], ['settings', 'key'], ['snapshots', 'id'], ['meta', 'key']]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        }
      };
      request.onblocked = () => {
        blocked = true;
        const failure = error('IDB_BLOCKED', 'Library upgrade is blocked. Close other Knowledge Tree tabs and retry.');
        try { if (typeof onBlocked === 'function') onBlocked(failure); } catch (_) { /* notification must not mask the storage error */ }
        reject(failure);
      };
      request.onerror = () => reject(error('IDB_OPEN_FAILED', 'Could not open the local library.', request.error));
      request.onsuccess = () => {
        const db = request.result;
        if (blocked || closed) { db.close(); if (closed) reject(error('CLOSED', 'Library connection has been closed.')); return; }
        database = db;
        db.onversionchange = () => { db.close(); database = null; };
        resolve(db);
      };
    }).finally(() => { opening = null; });
    return opening;
  }
  async function transaction(names, mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(names, mode); }
      catch (cause) { reject(error('IDB_TRANSACTION_FAILED', 'Could not start a library transaction.', cause)); return; }
      let result;
      let failure;
      const fail = (cause) => {
        failure = cause && cause.name === 'LibraryError' && typeof cause.code === 'string' ? cause : error('IDB_WRITE_FAILED', 'Library transaction failed; no changes were committed.', cause);
        try { tx.abort(); } catch (_) { reject(failure); }
      };
      const context = {
        store: (name) => tx.objectStore(name),
        result: (value) => { result = value; },
        request: (request, success) => {
          request.onsuccess = () => { try { success(request.result); } catch (cause) { fail(cause); } };
        },
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || error('IDB_TRANSACTION_FAILED', 'Library transaction aborted; no changes were committed.', tx.error));
      // Let request errors abort the whole transaction; never swallow quota errors.
      tx.onerror = () => {};
      try { work(context); } catch (cause) { fail(cause); }
    });
  }
  function all(name) {
    return transaction([name], 'readonly', (tx) => tx.request(tx.store(name).getAll(), tx.result));
  }
  function read(name, key) {
    return transaction([name], 'readonly', (tx) => tx.request(tx.store(name).get(key), (value) => tx.result(value ?? null)));
  }
  function localRecord(document, { id, sync, ui } = {}) {
    return { id: id === undefined ? randomId('tree') : nonempty(id, 'Local id'), document: documentData(document),
      ui: ui === undefined ? {} : copy(ui), sync: syncData(sync), updatedAt: Date.now(), revision: 1 };
  }
  function readLegacy() {
    if (!legacyStorage) return { document: { version: 3, stage: 'brainstorm', title: '', cards: [], links: [] }, ui: {} };
    try {
      let raw = null;
      for (const key of LEGACY_KEYS) {
        const value = legacyStorage.getItem(key);
        if (value !== null && value !== undefined) { raw = value; break; }
      }
      const document = raw === null ? { version: 3, stage: 'brainstorm', title: '', cards: [], links: [] } : documentData(JSON.parse(raw), true);
      const rawUi = legacyStorage.getItem('dsh-knowledge-tree:ui/v2');
      const ui = rawUi === null || rawUi === undefined ? {} : copy(JSON.parse(rawUi));
      if (!plain(ui)) throw error('INVALID_DATA', 'Legacy UI state must be an object.');
      const rawPrompts = legacyStorage.getItem('dsh-knowledge-tree:prompts/v1');
      const prompts = rawPrompts === null || rawPrompts === undefined ? undefined : settingsData('prompts', JSON.parse(rawPrompts));
      return { document, ui, prompts };
    } catch (cause) {
      throw error('LEGACY_MIGRATION_FAILED', 'Legacy data could not be migrated. Original keys are untouched; repair the data and retry init().', cause);
    }
  }
  async function init() {
    if (initialized) return all('locals');
    if (initializing) return initializing;
    initializing = (async () => {
      const marker = await read('meta', MIGRATION_KEY);
      if (!marker) {
        const legacy = readLegacy(); // Parse BEFORE opening a write transaction. Failure leaves migration pending.
        const record = localRecord(legacy.document, { ui: legacy.ui });
        await transaction(['meta', 'locals', 'settings'], 'readwrite', (tx) => {
          tx.request(tx.store('meta').get(MIGRATION_KEY), (current) => {
            if (current) return; // Another tab completed migration while we were reading legacy storage.
            tx.store('locals').add(record);
            if (legacy.prompts !== undefined) tx.store('settings').put({ key: 'prompts', value: legacy.prompts });
            tx.store('meta').add({ key: MIGRATION_KEY, value: true, migratedAt: Date.now() });
          });
        });
      }
      initialized = true;
      return all('locals');
    })().finally(() => { initializing = null; });
    return initializing;
  }
  async function ensureInitialized() { if (!initialized) await init(); }
  async function listLocal() { await ensureInitialized(); return (await all('locals')).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)); }
  async function getLocal(id) { nonempty(id, 'Local id'); await ensureInitialized(); return read('locals', id); }
  async function createLocal(document, options = {}) {
    const record = localRecord(document, options);
    await ensureInitialized();
    return transaction(['locals'], 'readwrite', (tx) => {
      tx.request(tx.store('locals').get(record.id), (current) => {
        if (current) throw error('ALREADY_EXISTS', 'A local tree with this ID already exists.');
        tx.store('locals').add(record);
        tx.result(record);
      });
    });
  }
  async function saveLocal(record, { expectedRevision } = {}) {
    if (!plain(record)) throw error('INVALID_ARGUMENT', 'Local record must be an object.');
    const id = nonempty(record.id, 'Local id');
    const expected = expectedRevision === undefined ? record.revision : expectedRevision;
    if (!Number.isSafeInteger(expected) || expected < 1) throw error('INVALID_REVISION', 'Saving requires the previously read revision or expectedRevision.');
    const next = { id, document: documentData(record.document), ui: copy(record.ui === undefined ? {} : record.ui), sync: syncData(record.sync) };
    await ensureInitialized();
    return transaction(['locals'], 'readwrite', (tx) => {
      tx.request(tx.store('locals').get(id), (current) => {
        if (!current) throw error('NOT_FOUND', 'The local tree no longer exists.');
        if (current.revision !== expected) throw error('REVISION_CONFLICT', 'This tree changed in another tab. Reload it before saving.');
        if (!Number.isSafeInteger(current.revision + 1)) throw error('INVALID_REVISION', 'Revision limit exceeded.');
        const saved = { ...next, revision: current.revision + 1, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
        tx.store('locals').put(saved);
        tx.result(saved);
      });
    });
  }
  async function deleteLocal(id, { expectedRevision } = {}) {
    nonempty(id, 'Local id'); await ensureInitialized();
    return transaction(['locals'], 'readwrite', (tx) => {
      tx.request(tx.store('locals').get(id), (current) => {
        if (expectedRevision !== undefined && current?.revision !== expectedRevision) throw error('REVISION_CONFLICT', 'This tree changed before deletion.');
        tx.store('locals').delete(id); tx.result(Boolean(current));
      });
    });
  }
  async function getSetting(key) { settingsData(key); await ensureInitialized(); const row = await read('settings', key); return row ? row.value : null; }
  async function setSetting(key, value) {
    if (value === undefined) throw error('INVALID_DATA', 'Setting values must be JSON; use null to clear a value.');
    const safe = settingsData(key, value); await ensureInitialized();
    return transaction(['settings'], 'readwrite', (tx) => { tx.store('settings').put({ key, value: safe }); tx.result(safe); });
  }
  async function cacheRemote(remoteKey, snapshot) {
    nonempty(remoteKey, 'Remote key');
    const value = copy(snapshot);
    // Cache may carry transport metadata, but documents, when present, must be valid.
    if (plain(value) && value.document !== undefined) value.document = documentData(value.document);
    else if (plain(value) && value.version !== undefined) documentData(value);
    const row = { remoteKey, snapshot: value, updatedAt: Date.now() }; await ensureInitialized();
    return transaction(['remotes'], 'readwrite', (tx) => { tx.store('remotes').put(row); tx.result(row); });
  }
  async function getRemote(remoteKey) { nonempty(remoteKey, 'Remote key'); await ensureInitialized(); return read('remotes', remoteKey); }
  async function listRemote(remotePrefix = '') {
    if (typeof remotePrefix !== 'string') throw error('INVALID_ARGUMENT', 'Remote prefix must be a string.');
    await ensureInitialized(); return (await all('remotes')).filter((row) => row.remoteKey.startsWith(remotePrefix)).sort((a, b) => a.remoteKey.localeCompare(b.remoteKey));
  }
  async function snapshotLocal(id) {
    nonempty(id, 'Local id'); const snapshotId = randomId('snapshot'); await ensureInitialized();
    return transaction(['locals', 'snapshots'], 'readwrite', (tx) => {
      tx.request(tx.store('locals').get(id), (record) => {
        if (!record) throw error('NOT_FOUND', 'Cannot snapshot a missing local tree.');
        const snapshot = { id: snapshotId, localId: id, record, createdAt: Date.now() };
        tx.store('snapshots').add(snapshot); tx.result(snapshot);
      });
    });
  }
  async function listSnapshots(id) {
    if (id !== undefined) nonempty(id, 'Local id'); await ensureInitialized();
    return (await all('snapshots')).filter((row) => id === undefined || row.localId === id).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  }
  async function restoreSnapshot(snapshotId) {
    nonempty(snapshotId, 'Snapshot id'); await ensureInitialized();
    const id = randomId('tree');
    return transaction(['snapshots', 'locals'], 'readwrite', (tx) => {
      tx.request(tx.store('snapshots').get(snapshotId), (snapshot) => {
        if (!snapshot) throw error('NOT_FOUND', 'Snapshot does not exist.');
        // Restoring always creates a copy. Never silently roll back an edited original.
        // A recovered copy has a NEW identity and must not retain a remote write association.
        const record = localRecord(snapshot.record.document, { id, ui: snapshot.record.ui });
        tx.store('locals').add(record); tx.result(record);
      });
    });
  }
  function close() { closed = true; if (database) database.close(); database = null; }
  return { init, listLocal, getLocal, createLocal, saveLocal, deleteLocal, getSetting, setSetting,
    cacheRemote, getRemote, listRemote, snapshotLocal, listSnapshots, restoreSnapshot, close };
}

/** Deterministic JSON for hashing: object keys sorted, array order preserved.
 * Rejects undefined, nonfinite numbers, sparse arrays, class instances and cycles
 * rather than silently dropping or changing data. Does not hash or mutate input.
 */
export function canonicalStringify(value) {
  const ancestors = new Set();
  function stringify(item) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || ancestors.has(item)) throw new TypeError('Canonical JSON requires finite, acyclic JSON data.');
    ancestors.add(item);
    let result;
    if (Array.isArray(item)) {
      result = '[' + Array.from(item, stringify).join(',') + ']';
    } else {
      const proto = Object.getPrototypeOf(item);
      if (proto !== Object.prototype && proto !== null) throw new TypeError('Canonical JSON requires plain objects.');
      result = '{' + Object.keys(item).sort().map((key) => JSON.stringify(key) + ':' + stringify(item[key])).join(',') + '}';
    }
    ancestors.delete(item);
    return result;
  }
  return stringify(value);
}
