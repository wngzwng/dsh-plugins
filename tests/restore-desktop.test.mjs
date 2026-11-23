import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { restore } from '../scripts/restore-desktop.mjs';

const manifest = { enabledBundles: [{name:'demo', version:'1.0.0'}], enabledBuiltins: [{name:'builtin'}] };
const opts = { manifest, log() {} };
function fake(extra = []) {
  const rows = [{name:'builtin', optional:true, availability:'installation', enabled:false}, ...extra];
  const calls = [];
  return { rows, calls, listBundles: () => structuredClone(rows),
    installBundle(spec) { calls.push(spec); rows.push({name:'demo', installed:true, version:'1.0.0', enabled:false}); },
    enableBundle(name) { calls.push(name); rows.find(r => r.name === name).enabled = true; }
  };
}

test('dry run, apply, then apply again: second apply issues zero writes', async () => {
  const api = fake([{name:'unrelated', installed:true, enabled:false}]);
  await restore(api, opts); assert.deepEqual(api.calls, []);
  await restore(api, {...opts, apply:true}); assert.deepEqual(api.calls, ['demo@1.0.0','demo','builtin']);
  api.calls.length = 0;
  await restore(api, {...opts, apply:true}); assert.deepEqual(api.calls, []);
  assert.equal(api.rows.find(r => r.name === 'unrelated').enabled, false);
});
test('version drift or missing tgz stops entire plan before writing', async () => {
  const api = fake([{name:'demo', installed:true, enabled:true, version:'2.0.0'}]);
  await assert.rejects(restore(api, {...opts, apply:true}), /预检/);
  const broken = {enabledBundles:[...manifest.enabledBundles, {name:'other', version:'1', archive:'not-provided.tgz'}], enabledBuiltins:[]};
  const empty = fake();
  await assert.rejects(restore(empty, {...opts, manifest:broken, apply:true}), /预检/);
  assert.deepEqual(api.calls, []); assert.deepEqual(empty.calls, []);
});
test('recognizes new package name as equivalent to old profile alias', async () => {
  const api = fake([{name:'new', installed:true, enabled:true, version:'1'}]);
  await restore(api, {...opts, apply:true, manifest:{enabledBundles:[{name:'old', packageName:'new', version:'1'}], enabledBuiltins:[]}});
  assert.deepEqual(api.calls, []);
});
test('archive needed only for installing; wrong digest blocks all writes', async () => {
  const path = fileURLToPath(new URL('./', import.meta.url));
  // Stand in for the archive with a file already in the fixture; no real install.
  const name = 'restore-desktop.test.mjs';
  const p = {name:'demo', version:'1.0.0', archive:name, sha256:'invalid'};
  const options = {...opts, apply:true, archiveDir:path, manifest:{enabledBundles:[p], enabledBuiltins:[]}};
  const api = fake();
  await assert.rejects(restore(api, options), /预检/); assert.deepEqual(api.calls, []);
  p.sha256 = createHash('sha256').update(readFileSync(path + name)).digest('hex');
  await restore(api, options); assert.deepEqual(api.calls, ['file:'+path+name, 'demo']);
  api.calls.length = 0;
  await restore(api, {...options, archiveDir:'/not-provided'}); assert.deepEqual(api.calls, []);
});
test('install reporting success without a matching bundle is an error', async () => {
  const api = fake(); api.installBundle = () => {};
  await assert.rejects(restore(api, {...opts, apply:true}), /回读/);
  assert.deepEqual(api.calls, []);
});
