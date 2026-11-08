// Plain client loader cannot import relative ESM modules. Embed the two dependency-free
// browser modules from their tested source; leave the existing editor implementation intact.
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
let client = await readFile(new URL('client.js', root), 'utf8');
const start = '    /* BEGIN GENERATED WORKSPACE MODULES */';
const end = '    /* END GENERATED WORKSPACE MODULES */';
const library = await readFile(new URL('library.js', root), 'utf8');
const workspace = await readFile(new URL('workspace-ui.js', root), 'utf8');
// Modules deliberately have no imports, and named exported functions are self-contained.
const embedded = [library, workspace].map(source => source.replace(/^export /gm, '')).join('\n');
const block = start + '\n' + embedded + '\n' + end;
if (client.includes(start)) {
  const from = client.indexOf(start), to = client.indexOf(end, from);
  if (to < 0) throw new Error('Missing generated block end marker');
  client = client.slice(0, from) + block + client.slice(to + end.length);
} else {
  client = client.replace('    const NS =', block + '\n\n    const NS =');
}
await writeFile(new URL('client.js', root), client);
