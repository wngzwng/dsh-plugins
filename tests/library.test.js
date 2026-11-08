import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLibrary, canonicalStringify } from '../knowledge-tree/library.js';

// Run: node --test tests/library.test.js
// IDB tests use an installed fake-indexeddb if available, or an installed Chrome
// with its REAL IndexedDB. Nothing is downloaded or installed by this test file.
// Set CHROME_PATH to select a browser; REQUIRE_IDB_TESTS=1 makes absence a failure.

test('canonical JSON sorts objects recursively and preserves array order', () => {
  const input = { z: 2, a: [{ y: 1, x: '中' }, false, null] };
  assert.equal(canonicalStringify(input), '{"a":[{"x":"中","y":1},false,null],"z":2}');
  assert.equal(canonicalStringify({ x: -0 }), '{"x":0}');
  assert.equal(canonicalStringify(input), canonicalStringify({ a: input.a, z: 2 }));
  assert.equal(input.a[0].y, 1);
});

test('canonical JSON refuses lossy, non-JSON and cyclic inputs', () => {
  const cyclic = {}; cyclic.self = cyclic;
  for (const value of [undefined, NaN, Infinity, 1n, () => {}, new Date(), new Map(), [, 1], { x: undefined }, cyclic]) {
    assert.throws(() => canonicalStringify(value), TypeError);
  }
  const shared = { x: 1 };
  assert.equal(canonicalStringify([shared, shared]), '[{"x":1},{"x":1}]');
});

test('library is self-contained and reports missing IndexedDB without fallback', async () => {
  const embedded = (0, eval)('(' + createLibrary.toString() + ')');
  const library = embedded({ legacyStorage: { getItem() { throw new Error('must not read'); } } });
  await assert.rejects(library.init(), { code: 'IDB_UNAVAILABLE' });
  await assert.rejects(library.init(), { code: 'IDB_UNAVAILABLE' });
  library.close();
  await assert.rejects(library.init(), { code: 'CLOSED' });
});

test('public validation rejects unsafe settings and invalid records before I/O', async () => {
  const library = createLibrary();
  for (const key of ['token', 'githubToken', 'access_token', 'Authorization', 'apiKey', 'password']) {
    await assert.rejects(library.setSetting(key, 'sensitive'), { code: 'SENSITIVE_SETTING' });
    await assert.rejects(library.getSetting(key), { code: 'SENSITIVE_SETTING' });
  }
  await assert.rejects(library.setSetting('github', { nested: [{ token: 'private' }] }), { code: 'SENSITIVE_SETTING' });
  await assert.rejects(library.setSetting('foo', undefined), { code: 'INVALID_DATA' });
  await assert.rejects(library.createLocal({ version: 4 }), { code: 'INVALID_DOCUMENT' });
  await assert.rejects(library.saveLocal({ id: 'tree', revision: 0 }), { code: 'INVALID_REVISION' });
  await assert.rejects(library.getLocal(''), { code: 'INVALID_ARGUMENT' });
});

// This suite has no Node dependencies so the identical source can run in a
// browser context or against an externally provided IDBFactory.
async function indexedDBSuite(createLibrary, indexedDB) {
  const dbName = 'dsh-knowledge-tree-library';
  const checks = [];
  const connections = new Set();
  const assert = (ok, label) => { if (!ok) throw new Error(label); };
  const equal = (actual, expected, label) => assert(JSON.stringify(actual) === JSON.stringify(expected), label + ': ' + JSON.stringify(actual));
  const rejects = async (run, code) => {
    try { await run(); } catch (cause) { assert(cause.code === code, 'expected ' + code + ', got ' + cause.code + ': ' + cause.message); return cause; }
    throw new Error('Expected rejection: ' + code);
  };
  const fresh = async () => {
    for (const library of connections) library.close();
    connections.clear();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Test database deletion blocked'));
    });
  };
  const library = (storage, extra = {}) => {
    const result = createLibrary({ indexedDB, legacyStorage: storage, ...extra });
    connections.add(result); return result;
  };
  const storage = (entries = {}) => {
    const data = { ...entries };
    return { data, getItem(key) { return Object.hasOwn(data, key) ? data[key] : null; },
      setItem() { throw new Error('Legacy keys must never be written'); }, removeItem() { throw new Error('Legacy keys must never be deleted'); } };
  };
  const doc = (title = '树') => ({ version: 3, stage: 'brainstorm', title,
    cards: [{ id: 'c1', title: '知识', content: '细节', placed: false, order: 0, image: null }], links: [] });
  const check = async (name, run) => { await fresh(); await run(); checks.push(name); };
  try {
    await check('empty init creates exactly one local tree, once across concurrent tabs', async () => {
      const a = library(storage()), b = library(storage());
      const [left, right] = await Promise.all([a.init(), b.init()]);
      equal(left.length, 1, 'left count'); equal(right.length, 1, 'right count'); equal(left[0].id, right[0].id, 'same migrated record');
      equal(left[0].document, { version: 3, stage: 'brainstorm', title: '', cards: [], links: [] }, 'empty document');
      assert(/^tree_[0-9a-f]{32}$/.test(left[0].id), 'cryptographic tree ID');
      equal(left[0].revision, 1, 'initial revision');
      equal((await a.init()).length, 1, 'idempotent init');
      await a.deleteLocal(left[0].id); a.close();
      equal((await library(storage()).init()).length, 0, 'deleting all must not recreate an empty replacement');
    });
    for (const version of [1, 2, 3]) {
      await check('legacy v' + version + ' migration preserves old key and UI/prompts', async () => {
        const input = doc('v' + version); input.version = version;
        if (version === 1) { input.cards[0].text = input.cards[0].title; input.cards[0].note = input.cards[0].content; delete input.cards[0].title; delete input.cards[0].content; }
        const key = 'dsh-knowledge-tree/v' + version;
        const saved = JSON.stringify(input);
        const original = storage({ [key]: saved, 'dsh-knowledge-tree:ui/v2': '{"view":"graph"}', 'dsh-knowledge-tree:prompts/v1': '{"items":["Why?"]}' });
        const instance = library(original);
        const rows = await instance.init(); equal(rows.length, 1, 'one migrated tree');
        equal(rows[0].document.version, 3, 'upgraded version'); equal(rows[0].document.cards[0].title, '知识', 'title');
        equal(rows[0].document.cards[0].content, '细节', 'content'); equal(rows[0].ui, { view: 'graph' }, 'ui');
        equal(await instance.getSetting('prompts'), { items: ['Why?'] }, 'prompts'); equal(original.data[key], saved, 'untouched legacy');
      });
    }
    await check('migration prefers newest key without importing duplicates', async () => {
      const original = storage({ 'dsh-knowledge-tree/v3': JSON.stringify(doc('new')), 'dsh-knowledge-tree/v2': JSON.stringify({ ...doc('old'), version: 2 }) });
      const rows = await library(original).init(); equal(rows.length, 1, 'single import'); equal(rows[0].document.title, 'new', 'v3 first');
    });
    for (const broken of ['{broken', 'null', '{}', JSON.stringify({ ...doc(), version: 99 })]) {
      await check('damaged migration is retryable: ' + broken.slice(0, 25), async () => {
        const original = storage({ 'dsh-knowledge-tree/v3': broken, 'dsh-knowledge-tree/v2': JSON.stringify({ ...doc('older'), version: 2 }) });
        const instance = library(original);
        await rejects(() => instance.init(), 'LEGACY_MIGRATION_FAILED');
        equal(original.data['dsh-knowledge-tree/v3'], broken, 'original bytes');
        // Verify failure did not mark migration done or create an empty replacement.
        const raw = await new Promise((resolve, reject) => { const r = indexedDB.open(dbName); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        const contents = await new Promise((resolve, reject) => {
          const tx = raw.transaction(['locals', 'meta']); const rows = {};
          tx.objectStore('locals').getAll().onsuccess = (event) => { rows.locals = event.target.result; };
          tx.objectStore('meta').getAll().onsuccess = (event) => { rows.meta = event.target.result; };
          tx.oncomplete = () => resolve(rows); tx.onabort = () => reject(tx.error);
        }); raw.close();
        equal(contents, { locals: [], meta: [] }, 'migration writes nothing on bad JSON');
        original.data['dsh-knowledge-tree/v3'] = JSON.stringify(doc('repaired'));
        const rows = await instance.init(); equal(rows.length, 1, 'retry count'); equal(rows[0].document.title, 'repaired', 'retry recovered');
      });
    }
    await check('legacy storage access denied fails instead of fallback', async () => {
      const instance = library({ getItem() { throw new Error('SecurityError'); } });
      await rejects(() => instance.init(), 'LEGACY_MIGRATION_FAILED');
    });
    await check('local CRUD, safe IDs, detached reads and persisted revisions', async () => {
      const instance = library(storage()); await instance.init();
      const input = doc(); const created = await instance.createLocal(input, { sync: { remoteKey: 'repo:path', treeId: 'remote-tree', baseHash: 'sha' } });
      input.cards[0].title = 'mutated input';
      equal((await instance.getLocal(created.id)).document.cards[0].title, '知识', 'input copy');
      const fetched = await instance.getLocal(created.id); fetched.ui.expanded = ['c1']; fetched.document.title = 'saved';
      const saved = await instance.saveLocal(fetched); equal(saved.revision, 2, 'revision increment'); assert(saved.updatedAt > fetched.updatedAt, 'timestamp advances');
      fetched.document.title = 'post-write mutation'; equal((await instance.getLocal(created.id)).document.title, 'saved', 'detached persisted copy');
      equal(saved.sync, { remoteKey: 'repo:path', baseHash: 'sha', treeId: 'remote-tree' }, 'remote tree ID retained even when local ID differs');
      await rejects(() => instance.createLocal(doc(), { id: created.id }), 'ALREADY_EXISTS');
      equal(await instance.deleteLocal(created.id), true, 'delete existing'); equal(await instance.deleteLocal(created.id), false, 'delete absent');
      equal(await instance.getLocal(created.id), null, 'missing get'); await rejects(() => instance.saveLocal(saved), 'NOT_FOUND');
    });
    await check('remote document fields and version are preserved without normalization', async () => {
      const instance = library(storage());
      const input = { ...doc(' raw title '), version: 2, updatedAt: 123, custom: { keep: true } };
      delete input.cards[0].image;
      const created = await instance.createLocal(input, { sync: { remoteKey: 'repo:r', treeId: 'r', baseHash: 'base' } });
      equal(created.document, input, 'raw remote fields retained');
      equal((await instance.getLocal(created.id)).document, input, 'raw remote survives IDB');
      equal(created.sync.treeId, 'r', 'remote identity retained');
      await instance.cacheRemote('repo:r', { document: input });
      equal((await instance.getRemote('repo:r')).snapshot.document, input, 'raw remote cache retained');
      await rejects(() => instance.deleteLocal(created.id, { expectedRevision: created.revision + 1 }), 'REVISION_CONFLICT');
      assert(await instance.getLocal(created.id), 'failed delete keeps document');
    });
    await check('atomic CAS prevents concurrent lost updates across connections', async () => {
      const left = library(storage()), right = library(storage()); await Promise.all([left.init(), right.init()]);
      const original = await left.createLocal(doc());
      const a = await left.getLocal(original.id), b = await right.getLocal(original.id);
      a.document.title = 'left'; b.document.title = 'right';
      const outcomes = await Promise.allSettled([left.saveLocal(a), right.saveLocal(b)]);
      equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1, 'exactly one CAS succeeds');
      equal(outcomes.find((x) => x.status === 'rejected').reason.code, 'REVISION_CONFLICT', 'loser conflict');
      const current = await right.getLocal(original.id); equal(current.revision, 2, 'one increment');
      await rejects(() => left.saveLocal(a, { expectedRevision: 1 }), 'REVISION_CONFLICT');
      const next = await left.saveLocal({ ...current, revision: 100 }, { expectedRevision: 2 }); equal(next.revision, 3, 'explicit expected revision');
    });
    await check('readonly remote caches are fully separate from local documents', async () => {
      const instance = library(storage()); const original = (await instance.init())[0];
      await instance.cacheRemote('repo:a', { document: doc('remote'), sha: 'a' });
      await instance.cacheRemote('repo:b', doc('second')); await instance.cacheRemote('other:a', doc('other'));
      equal((await instance.getRemote('repo:a')).snapshot.document.title, 'remote', 'cached document');
      equal((await instance.listRemote('repo:')).map((x) => x.remoteKey), ['repo:a', 'repo:b'], 'prefix listing');
      equal(await instance.getLocal(original.id), original, 'local record untouched'); equal((await instance.listLocal()).length, 1, 'no local copies');
      await instance.cacheRemote('repo:a', { document: doc('updated'), sha: 'b' });
      equal((await instance.getRemote('repo:a')).snapshot.sha, 'b', 'cache replaced'); equal(await instance.getRemote('missing'), null, 'missing cache');
    });
    await check('settings persist non-secrets and reject nested credential keys', async () => {
      const instance = library(storage()); await instance.setSetting('remote', { owner: 'me', repo: 'notes', branch: 'main' });
      equal(await instance.getSetting('remote'), { owner: 'me', repo: 'notes', branch: 'main' }, 'setting value');
      await rejects(() => instance.setSetting('remote', { nested: { accessToken: 'private' } }), 'SENSITIVE_SETTING');
      equal((await instance.getSetting('remote')).owner, 'me', 'rejected write did not overwrite');
      await instance.setSetting('remote', null); equal(await instance.getSetting('remote'), null, 'clear');
    });
    await check('snapshots are durable and restore to a new local copy', async () => {
      const instance = library(storage()); const original = await instance.createLocal(doc('before'), { sync: { remoteKey: 'repo:x', baseHash: 'base' } });
      const snap = await instance.snapshotLocal(original.id); equal(snap.record.revision, 1, 'snapshot revision');
      const changed = await instance.saveLocal({ ...original, document: doc('after') });
      const restored = await instance.restoreSnapshot(snap.id); assert(restored.id !== original.id, 'new restore ID'); equal(restored.document.title, 'before', 'snapshot content');
      equal(restored.sync, { remoteKey: null, baseHash: null }, 'restored copy is independent'); equal(restored.revision, 1, 'copy revision');
      equal(await instance.getLocal(original.id), changed, 'original not rolled back'); equal((await instance.listSnapshots(original.id)).length, 1, 'snapshot listing');
      await instance.deleteLocal(original.id); equal((await instance.listSnapshots(original.id)).length, 1, 'snapshot survives deletion');
      equal((await instance.restoreSnapshot(snap.id)).document.title, 'before', 'restore after deletion');
      await rejects(() => instance.restoreSnapshot('missing'), 'NOT_FOUND'); await rejects(() => instance.snapshotLocal('missing'), 'NOT_FOUND');
    });
    await check('aborted migration transaction rolls back all writes and retries', async () => {
      let abortWrites = true;
      // Wrap only the factory/connection. Requests, stores, transaction ordering
      // and rollback still come from the real IndexedDB implementation.
      const factory = { open(...args) {
        const request = indexedDB.open(...args);
        let wrapped;
        return new Proxy(request, { get(target, key) {
          if (key === 'result') {
            if (!wrapped) wrapped = new Proxy(target.result, { get(db, property) {
              if (property === 'transaction') return (...txArgs) => {
                const tx = db.transaction(...txArgs);
                if (txArgs[1] === 'readwrite' && abortWrites) {
                  return new Proxy(tx, { get(transaction, name) {
                    if (name === 'objectStore') return (storeName) => new Proxy(transaction.objectStore(storeName), { get(store, operation) {
                      if (operation === 'add' || operation === 'put') return (...values) => {
                        const result = store[operation](...values);
                        transaction.abort();
                        return result;
                      };
                      const value = store[operation]; return typeof value === 'function' ? value.bind(store) : value;
                    } });
                    const value = transaction[name]; return typeof value === 'function' ? value.bind(transaction) : value;
                  }, set(transaction, name, value) { transaction[name] = value; return true; } });
                }
                return tx;
              };
              const value = db[property]; return typeof value === 'function' ? value.bind(db) : value;
            }, set(db, name, value) { db[name] = value; return true; } });
            return wrapped;
          }
          const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
        }, set(target, key, value) { target[key] = value; return true; } });
      } };
      const original = storage({ 'dsh-knowledge-tree/v3': JSON.stringify(doc('atomic migration')) });
      const instance = createLibrary({ indexedDB: factory, legacyStorage: original }); connections.add(instance);
      let failed = false;
      try { await instance.init(); } catch (cause) { failed = true; assert(cause.code.startsWith('IDB_'), 'explicit storage error'); }
      assert(failed, 'aborted transaction rejects init');
      abortWrites = false;
      const records = await instance.init(); equal(records.length, 1, 'retry once after abort');
      equal(records[0].document.title, 'atomic migration', 'migration not marked done on abort');
    });
    await check('blocked upgrade notification reports an explicit failure', async () => {
      let blocked = false;
      const instance = createLibrary({ indexedDB: { open() {
        const request = {};
        queueMicrotask(() => request.onblocked());
        return request;
      } }, onBlocked(cause) { blocked = cause.code === 'IDB_BLOCKED'; } });
      await rejects(() => instance.init(), 'IDB_BLOCKED'); assert(blocked, 'blocked callback'); instance.close();
    });
    return checks;
  } finally { await fresh(); }
}

async function installedChrome() {
  const candidates = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const candidate of candidates.filter(Boolean)) { try { await access(candidate); return candidate; } catch {} }
  return null;
}

async function browserSuite(chromePath) {
  const profile = await mkdtemp(join(tmpdir(), 'knowledge-tree-idb-test-'));
  const server = createServer((_, response) => { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Knowledge Tree IndexedDB tests</title>'); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let sequence = 0, buffer = '', stderr = '';
  const pending = new Map();
  browser.stderr.on('data', (chunk) => { stderr += chunk; });
  browser.stdio[4].on('data', (chunk) => {
    buffer += chunk.toString();
    let boundary;
    while ((boundary = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 1);
      if (!message.id || !pending.has(message.id)) continue;
      const { resolve, reject, timer } = pending.get(message.id); pending.delete(message.id); clearTimeout(timer);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  });
  const failPending = (cause) => { for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(cause); } pending.clear(); };
  browser.on('error', failPending);
  browser.on('exit', (code) => failPending(new Error('Chrome exited ' + code + ': ' + stderr.slice(-2000))));
  const command = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method + '\n' + stderr.slice(-2000))); }, 30000);
    pending.set(id, { resolve, reject, timer });
    browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });
  try {
    const { targetId } = await command('Target.createTarget', { url: 'http://127.0.0.1:' + server.address().port });
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
    await command('Runtime.enable', {}, sessionId);
    // Wait for same-origin navigation without a sleep; evaluate after Page.navigate.
    await command('Page.enable', {}, sessionId);
    await command('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port }, sessionId);
    const evaluated = await command('Runtime.evaluate', {
      expression: '(' + indexedDBSuite.toString() + ')((' + createLibrary.toString() + '), indexedDB)',
      awaitPromise: true, returnByValue: true,
    }, sessionId);
    if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails));
    return evaluated.result.value;
  } finally {
    failPending(new Error('Test cleanup'));
    browser.kill('SIGTERM');
    await new Promise((resolve) => { if (browser.exitCode !== null || browser.signalCode !== null) resolve(); else browser.once('exit', resolve); });
    await new Promise((resolve) => server.close(resolve));
    // profile is an absolute mkdtemp result, verified to be our test directory.
    assert.equal(profile.startsWith(join(tmpdir(), 'knowledge-tree-idb-test-')), true);
    await rm(profile, { recursive: true, force: true });
  }
}

test('IndexedDB integration: migrations, CAS, independent caches and snapshots', { timeout: 60000 }, async (context) => {
  let fake;
  try { fake = await import('fake-indexeddb'); } catch (cause) { if (cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause; }
  let results;
  if (fake) {
    results = await indexedDBSuite(createLibrary, new fake.IDBFactory());
    context.diagnostic('Adapter: fake-indexeddb');
  } else {
    const chrome = await installedChrome();
    if (!chrome) {
      if (process.env.REQUIRE_IDB_TESTS === '1') assert.fail('Install Chrome, set CHROME_PATH, or provide fake-indexeddb to run the IDB tests.');
      context.skip('No installed fake-indexeddb or Chrome; pure tests still run. Set REQUIRE_IDB_TESTS=1 in CI to disallow this skip.'); return;
    }
    results = await browserSuite(chrome);
    context.diagnostic('Adapter: real Chrome IndexedDB');
  }
  for (const result of results) context.diagnostic(result);
  assert.ok(results.length >= 15);
});
