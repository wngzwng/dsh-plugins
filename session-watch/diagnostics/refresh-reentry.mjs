// Isolated diagnostic: fake transport only; never contacts DSH or edits profile data.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../core.js';
let source = (await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8')).replace(/^export\s+/gm, '');
const candidate = process.argv.includes('--candidate');
if (candidate) {
  const early = "    snapshot = { ...snapshot, loading: true }; publish('');\n    refreshPromise =";
  const late = '    return refreshPromise;\n  }\n  async function flush()';
  if (!source.includes(early) || !source.includes(late)) throw new Error('Source changed; candidate transformation not applied');
  source = source.replace(early, '    refreshPromise =').replace(late, "    snapshot = { ...snapshot, loading: true }; publish('');\n" + late);
}
const context = vm.createContext({ ...core, setTimeout, clearTimeout });
vm.runInContext(source + '\nglobalThis.Store = createWatchStore;', context);
let gets = 0; let notifications = 0; let reentries = 0;
const nested = []; const maxReentries = 4;
const store = context.Store(async method => {
  if (method !== 'GET') throw new Error('Diagnostic permits GET only');
  gets++; return { status: 200, body: { state: core.createDefaultState() } };
});
store.subscribe(() => {
  notifications++;
  if (store.getSnapshot().loading && reentries < maxReentries) {
    reentries++;
    nested.push(store.refresh());
  }
});
try {
  await Promise.all([store.refresh(), ...nested]);
  console.log(JSON.stringify({ diagnostic: 'bounded synchronous subscriber refresh reentry', candidateInMemoryOnly: candidate, maxReentries, reentries, transportGets: gets, notifications, deduplicated: gets === 1, liveDSHContacted: false }));
} finally { store.dispose(); }
