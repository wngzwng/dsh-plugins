import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHostService, registerHostRoutes, validateConfiguration } from '../knowledge-tree/host-service.js';

const config = { remote: 'git@github.com:someone/knowledge.git', branch: 'main', directory: 'knowledge-trees' };

test('Host validates SSH remote, ref and directory inputs', () => {
  assert.deepEqual(validateConfiguration(config), config);
  for (const patch of [
    { directory: '../oops' }, { directory: '/root' }, { directory: 'a//b' },
    { remote: 'https://github.com/someone/knowledge.git' },
    { remote: 'git@gitlab.com:someone/knowledge.git' },
    { remote: 'ssh://git@example.com/someone/knowledge.git' },
    { branch: 'refs/../main' }, { branch: 'main.lock' }, { branch: 'x\nAuthorization: x' },
  ]) {
    assert.throws(() => validateConfiguration({ ...config, ...patch }), { code: 'INVALID_CONFIG' });
  }
  // A legacy HTTPS config migrates to its SSH remote instead of failing.
  assert.deepEqual(
    validateConfiguration({ owner: 'someone', repo: 'knowledge', branch: 'main', directory: 'knowledge-trees' }),
    config,
  );
});

test('config is persisted without secrets and survives a restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kt-host-'));
  const configPath = join(dir, 'config.json');
  const service = createHostService({ configPath, environment: {} });
  const result = await service.call('configure', config);
  assert.equal(result.configured, true);
  assert.equal(result.transport, 'ssh');
  assert.deepEqual(result.config, config);
  assert.equal(typeof result.gitAvailable, 'boolean');
  const saved = await readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(saved), config);
  assert.equal(saved.includes('token'), false);

  const restarted = createHostService({ configPath, environment: {} });
  assert.equal((await restarted.status()).configured, true);
  assert.deepEqual((await restarted.status()).config, config);
  // disconnect keeps the repository config (credentials live in the user's SSH setup).
  assert.equal((await service.call('disconnect', {})).configured, true);
});

test('a previously saved HTTPS config is migrated on load', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kt-host-'));
  const configPath = join(dir, 'config.json');
  await writeFile(configPath, JSON.stringify({ owner: 'someone', repo: 'knowledge', branch: 'main', directory: 'knowledge-trees' }));
  const service = createHostService({ configPath, environment: {} });
  assert.deepEqual((await service.status()).config, config);
});

test('registered authenticated routes are exact POST and redact upstream errors', async () => {
  const routes = [];
  registerHostRoutes({ connection: { fetch: { register: (route) => routes.push(route) } } }, {
    call: async () => { throw new Error('github_pat_SECRET raw fetch exception'); },
  });
  assert.equal(routes.length, 8);
  for (const route of routes) {
    assert.match(route.path, /^\/api\/knowledge-tree\/[A-Za-z]+$/);
    assert.deepEqual(route.methods, ['POST']);
    assert.equal(route.requestBody, 'buffered');
  }
  const response = await routes[0].fetch(new Request('http://localhost' + routes[0].path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(JSON.stringify(payload).includes('SECRET'), false);
});

test('route rejects invalid and oversized requests before dispatch', async () => {
  const routes = [];
  let calls = 0;
  registerHostRoutes({ connection: { fetch: { register: (route) => routes.push(route) } } }, { call: async () => { calls++; } });
  for (const [headers, body] of [[{}, '{}'], [{ 'Content-Type': 'application/json' }, '{'], [{ 'Content-Type': 'application/json', 'Content-Length': String(70 * 1024 * 1024) }, '{}']]) {
    const response = await routes[0].fetch(new Request('http://localhost' + routes[0].path, { method: 'POST', headers, body }));
    assert.equal((await response.json()).ok, false);
  }
  assert.equal(calls, 0);
});
