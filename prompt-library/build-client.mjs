/**
 * Build the browser bundle for the Prompt Library.
 *
 * The plain client loader cannot import relative ESM modules, so the
 * dependency-free pure logic (`core.js`) and the two authored UI fragments
 * (`src/full-panel.js`, `src/quick-picker.js`) are embedded into `client.js`
 * between two marker comments. Named `export ` prefixes in the embedded files
 * are stripped so they become ordinary declarations in the factory scope.
 *
 * Run from this directory: `node build-client.mjs`
 */
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const START = '    /* BEGIN GENERATED MODULES */';
const END = '    /* END GENERATED MODULES */';

const parts = ['core.js', 'src/capture.js', 'src/full-panel.js', 'src/quick-picker.js'];
const sources = [];
for (const part of parts) {
  let source;
  try {
    source = await readFile(new URL(part, root), 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(
        `Missing ${part}. Create it before building the client bundle.`,
      );
    }
    throw error;
  }
  // Only real statements are rejected; comments may mention these forms.
  if (/^[ \t]*import[ \t]/m.test(source) || /^[ \t]*import[ \t]*\(/m.test(source) || /^[ \t]*export[ \t]+default\b/m.test(source)) {
    throw new Error(
      `${part}: embedded modules must not use import statements or export default.`,
    );
  }
  sources.push(
    `    /* ===== ${part} ===== */\n` +
      source.replace(/^export /gm, '') +
      `\n    /* ===== end ${part} ===== */`,
  );
}

const embedded = sources.join('\n');
const block = `${START}\n${embedded}\n${END}`;

let client = await readFile(new URL('client.js', root), 'utf8');
const from = client.indexOf(START);
const to = from < 0 ? -1 : client.indexOf(END, from);
if (from >= 0 && to >= 0) {
  client = client.slice(0, from) + block + client.slice(to + END.length);
} else if (from >= 0 || to >= 0) {
  throw new Error('client.js has only one generated-block marker');
} else {
  throw new Error(
    'client.js is missing the generated-block markers: ' + START + ' / ' + END,
  );
}

await writeFile(new URL('client.js', root), client);
console.log(
  `prompt-library: embedded ${parts.length} modules (${embedded.length} chars) into client.js`,
);
