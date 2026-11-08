import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHostService, registerHostRoutes, validateConfiguration } from '../knowledge-tree/host-service.js';

const config = { owner: 'someone', repo: 'knowledge', branch: 'main', directory: 'knowledge-trees' };

test('Host validates all repository path and ref inputs', () => {
  assert.deepEqual(validateConfiguration(config), config);
  for (const patch of [{directory:'../oops'}, {directory:'/root'}, {directory:'a//b'}, {owner:'evil/owner'}, {repo:'..'}, {branch:'refs/../main'}, {branch:'main.lock'}, {branch:'x\nAuthorization: x'}]) {
    assert.throws(() => validateConfiguration({...config,...patch}), {code:'INVALID_CONFIG'});
  }
});

test('credentials are session-only and never persisted or returned', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kt-host-'));
  const configPath = join(dir, 'config.json');
  const service = createHostService({ configPath, environment: {} });
  const result = await service.call('configure', {...config,token:'github_pat_SECRET'});
  assert.equal(result.credentialAvailable, true);
  assert.equal(result.credentialSource, 'session');
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.equal((await readFile(configPath,'utf8')).includes('SECRET'), false);
  const restarted = createHostService({ configPath, environment: {} });
  assert.equal((await restarted.status()).configured, true);
  assert.equal((await restarted.status()).credentialAvailable, false);
  service.dispose();
  assert.equal((await service.status()).credentialAvailable, false);
});

test('registered authenticated routes are exact POST and redact upstream errors', async () => {
  const routes = [];
  registerHostRoutes({connection:{fetch:{register: route => routes.push(route)}}}, {
    call: async () => { throw new Error('github_pat_SECRET: raw fetch exception'); },
  });
  assert.equal(routes.length, 7);
  for (const route of routes) {
    assert.match(route.path,/^\/api\/knowledge-tree\/[A-Za-z]+$/);
    assert.deepEqual(route.methods,['POST']);
    assert.equal(route.requestBody,'buffered');
  }
  const response = await routes[0].fetch(new Request('http://localhost'+routes[0].path, {method:'POST', headers:{'Content-Type':'application/json'},body:'{}'}));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.equal(payload.ok,false);
  assert.equal(JSON.stringify(payload).includes('SECRET'),false);
});

test('route rejects invalid and oversized requests before dispatch', async () => {
  const routes = [];
  let calls = 0;
  registerHostRoutes({connection:{fetch:{register: route=>routes.push(route)}}}, {call:async()=>{calls++;}});
  for (const [headers,body] of [[{},'{}'],[{'Content-Type':'application/json'},'{'],[{'Content-Type':'application/json','Content-Length':String(70*1024*1024)},'{}']]) {
    const response = await routes[0].fetch(new Request('http://localhost'+routes[0].path,{method:'POST',headers,body}));
    assert.equal((await response.json()).ok,false);
  }
  assert.equal(calls,0);
});
