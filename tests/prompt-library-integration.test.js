/*
 * Cross-slot integration checks for the Prompt Library bundle.
 *
 * These cover the plugin wiring that belongs to no single UI fragment: the three
 * slot registrations, dictionaries, style ownership/cleanup, cross-tab reload,
 * and the "never overwrite corrupted/newer data" storage contract. Per-fragment
 * interaction tests live in tests/prompt-library-panel.test.js / -quick.test.js;
 * pure data logic lives in tests/prompt-library-core.test.js.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers/prompt-library-harness.js';

const DATA_KEY = 'dsh-prompt-library/v1';

function seedPrompt(overrides = {}) {
  return {
    id: 'p-seed',
    title: '代码审查助手',
    body: '请审查以下代码，重点关注边界条件与错误处理。',
    usage: '代码审查',
    tagIds: [],
    favorite: false,
    pinned: false,
    createdAt: 1,
    updatedAt: 1,
    bodyVersion: 1,
    score: { stars: null, note: '', ratedBodyVersion: null, ratedAt: null },
    lastUsedAt: null,
    useCount: 0,
    aiReview: null,
    ...overrides,
  };
}

function seeded(storage = {}) {
  return harness({
    storage: {
      [DATA_KEY]: JSON.stringify({
        version: 1,
        tags: [],
        prompts: [seedPrompt()],
      }),
      ...storage,
    },
  });
}

test('registers the sidebar icon, the main page and the composer entry', () => {
  const h = harness();
  assert.deepEqual(Object.keys(h.slots).sort(), [
    'conversation.input.right',
    'main',
    'sidebar.panellist',
  ]);
  assert.equal(h.slots.main.config.key, 'prompt-library');
  assert.equal(h.slots['sidebar.panellist'].config.id, 'prompt-library');
  assert.equal(h.slots['conversation.input.right'].config.id, 'prompt-library');
  assert.equal(typeof h.slots['sidebar.panellist'].config.label, 'function');
  assert.deepEqual(h.plugin.inject.sort(), ['locale', 'slots']);
  h.dispose();
});

test('sidebar label follows the active locale', () => {
  const h = harness();
  const label = h.slots['sidebar.panellist'].config.label;
  assert.equal(label(), '提示库');
  h.setLanguage('en');
  assert.equal(label(), 'Prompt Library');
  h.dispose();
});

function seedless() {
  return harness();
}

test('renders the full page and the composer entry without a selected prompt', () => {
  const h = seedless();
  h.renderPage();
  assert.ok(h.tree, 'page renders');
  const pageText = h.text();
  assert.ok(pageText.includes('提示库') || pageText.includes('Prompt Library'), pageText.slice(0, 400));
  h.renderQuick();
  assert.ok(h.tree, 'composer entry renders');
  const entryButtons = h.all('button');
  assert.ok(entryButtons.length >= 1);
  assert.ok(
    entryButtons.some((node) => {
      const text = h.text(node) + String(node.props['aria-label'] || '') + String(node.props.title || '');
      return text.includes('提示库') || text.includes('Prompt Library');
    }),
    'composer entry exposes an accessible Prompt Library label',
  );
  h.dispose();
});

test('registers zh and en dictionaries with identical keys', () => {
  const h = harness();
  const zh = Object.keys(h.dictionaries.zh).sort();
  const en = Object.keys(h.dictionaries.en).sort();
  assert.ok(zh.length > 40, 'dictionary has a meaningful number of keys');
  assert.deepEqual(zh, en);
  assert.equal(h.dictionaries.zh['panel.label'], '提示库');
  assert.equal(h.dictionaries.en['panel.label'], 'Prompt Library');
  assert.equal(
    h.dictionaries.zh['common.aiDisclaimer'],
    'AI 评价仅供参考，实际效果请以你的使用体验为准。',
  );
  h.dispose();
});

test('owns one theme-token style element and removes it with the plugin', () => {
  const h = seedless();
  h.renderPage();
  const styles = h.document.head.children.filter(
    (node) => node.tagName === 'STYLE' && node.getAttribute('data-dsh-plugin') === 'prompt-library',
  );
  assert.equal(styles.length, 1);
  const css = styles[0].textContent;
  assert.match(css, /--dsw-alias-/);
  assert.match(css, /\.pl-overlay/);
  h.disposeEffects();
  assert.equal(
    h.document.head.children.filter((node) => node.tagName === 'STYLE').length,
    0,
    'style element is removed on unload',
  );
  h.dispose();
});

test('empty storage is not written until the user changes something', () => {
  const h = harness();
  h.renderPage();
  assert.equal(h.storage.map.size, 0);
  h.dispose();
});

test('corrupted stored data is left untouched instead of being reset', () => {
  const h = harness({ storage: { [DATA_KEY]: '{"version":1,"prompts":[{' } });
  const before = h.storage.map.get(DATA_KEY);
  h.renderPage();
  assert.ok(h.tree, 'page still renders');
  assert.equal(h.storage.map.get(DATA_KEY), before, 'raw corrupted data is preserved');
  h.setLanguage('en');
  h.renderPage();
  assert.equal(h.storage.map.get(DATA_KEY), before);
  h.dispose();
});

test('an unavailable browser storage surface is reported without wiping anything', () => {
  const h = harness({ noStorage: true });
  h.renderPage();
  assert.match(h.text(), /localStorage/);
  assert.ok(h.storage.map.size === 0, 'nothing is written without storage');
  h.dispose();
});

test('data from a newer schema version is rejected without overwriting it', () => {
  const newer = JSON.stringify({ version: 99, tags: [], prompts: [seedPrompt()] });
  const h = harness({ storage: { [DATA_KEY]: newer } });
  h.renderPage();
  assert.equal(h.storage.map.get(DATA_KEY), newer);
  h.dispose();
});

test('JSON backup download carries the complete data root', async () => {
  const h = seeded();
  h.renderPage();
  h.clickButton('导出');
  h.clickButton('JSON 完整备份');
  await h.flush();
  const last = h.downloads[h.downloads.length - 1];
  assert.ok(last, 'a download was triggered');
  assert.match(last.filename, /^prompt-library-backup-\d{8}\.json$/);
  const contents = await h.readDownload();
  assert.ok(contents && contents.text, 'download content is captured');
  const parsed = JSON.parse(contents.text);
  assert.equal(parsed.format, 'dsh-prompt-library-backup');
  assert.equal(parsed.data.prompts[0].title, '代码审查助手');
  h.dispose();
});

test('the full page keeps the storage location and backup advice visible', () => {
  const h = seeded();
  h.renderPage();
  assert.match(h.text(), /localStorage/);
  assert.match(h.text(), /备份/);
  h.dispose();
});

test('a typed personal note is saved on blur and never leaks to another prompt', () => {
  const second = seedPrompt({
    id: 'p-second',
    title: '翻译润色',
    body: '把下面的文字翻译成英文。',
    score: { stars: null, note: '第二条的备注', ratedBodyVersion: null, ratedAt: null },
  });
  const h = harness({
    storage: {
      [DATA_KEY]: JSON.stringify({ version: 1, tags: [], prompts: [seedPrompt(), second] }),
    },
  });
  h.renderPage();
  const firstRow = h.all('button').find((node) => h.text(node).includes('代码审查助手'));
  firstRow.props.onClick({ preventDefault() {}, stopPropagation() {} });
  h.render();
  const note = h.findTextarea('rating-note');
  assert.ok(note, 'rating note field exists');
  assert.equal(note.props.value, '');
  h.change(note, '第一条的新备注');
  h.findTextarea('rating-note').props.onBlur({});
  h.render();
  assert.equal(h.promptById('p-seed').score.note, '第一条的新备注');
  assert.equal(h.promptById('p-second').score.note, '第二条的备注');

  const secondRow = h.all('button').find((node) => h.text(node).includes('翻译润色'));
  secondRow.props.onClick({ preventDefault() {}, stopPropagation() {} });
  h.render();
  assert.equal(h.findTextarea('rating-note').props.value, '第二条的备注');
  h.dispose();
});

test('cross-tab storage events reload the panel data', () => {
  const h = seeded();
  h.renderPage();
  assert.match(h.text(), /代码审查助手/);
  const replacement = JSON.stringify({
    version: 1,
    tags: [],
    prompts: [seedPrompt({ id: 'p-other', title: '翻译润色' })],
  });
  h.storage.map.set(DATA_KEY, replacement);
  h.window.dispatch('storage', { key: DATA_KEY });
  h.renderPage();
  assert.match(h.text(), /翻译润色/);
  assert.doesNotMatch(h.text(), /代码审查助手/);
  h.dispose();
});

test('quick picker opens the full panel through the host layout service when available', async () => {
  const panels = [];
  const h = harness({
    layout: {
      selectPanel(id) {
        panels.push(id);
      },
    },
    storage: {
      [DATA_KEY]: JSON.stringify({
        version: 1,
        tags: [],
        prompts: [seedPrompt()],
      }),
    },
  });
  h.renderQuick();
  h.clickButton('提示库');
  const row = h.all('button').find((node) => h.text(node).includes('代码审查助手'));
  assert.ok(row, 'seeded prompt row exists');
  row.props.onClick({ preventDefault() {}, stopPropagation() {} });
  h.render();
  const open = h.all('button').find((node) => h.text(node).trim() === '在提示库中打开');
  assert.ok(open, 'open-library action exists');
  open.props.onClick({});
  await h.flush();
  assert.deepEqual(panels, ['prompt-library']);
  h.dispose();
});

test('the composer entry keeps working when the host exposes no layout service', () => {
  const h = harness();
  h.renderQuick();
  assert.ok(h.all('button').length >= 1);
  h.dispose();
});

test('panel and composer entry can be unmounted independently', () => {
  const h = seeded();
  h.renderPage();
  assert.match(h.text(), /代码审查助手/);
  h.renderQuick();
  assert.ok(h.all('button').length >= 1);
  h.renderPage();
  assert.match(h.text(), /代码审查助手/);
  h.dispose();
});

/* ------------------------------------------------------------------------- */
/* Markdown preview (opt-in; raw text stays the source)                      */
/* ------------------------------------------------------------------------- */

const MARKDOWN_BODY = [
  '# 审查清单',
  '',
  '请按 **边界条件** 与 *错误处理* 审查，保留 `inline code`。',
  '同一段落第二行。',
  '',
  '- 检查空值',
  '- 检查并发',
  '',
  '1. 先读代码',
  '2. 再给建议',
  '',
  '> 引用：不要臆测需求。',
  '',
  '```js',
  'const value = "<b>literal</b>";',
  '```',
  '',
  '| 维度 | 要求 |',
  '| --- | --- |',
  '| 目标 | 明确 |',
  '',
  '[安全链接](https://example.com/a) 与 [危险链接](javascript:alert(1))',
  '![远程图片](https://example.com/a.png)',
  '<script>alert(1)</script>',
].join('\n');

function markdownHarness(extraStorage = {}) {
  return harness({
    storage: {
      [DATA_KEY]: JSON.stringify({
        version: 1,
        tags: [],
        prompts: [seedPrompt({ id: 'p-md', title: 'Markdown 提示词', body: MARKDOWN_BODY })],
      }),
      ...extraStorage,
    },
  });
}

function openMarkdownDetail(h) {
  h.renderPage();
  const row = h.all('button').find((node) => h.text(node).includes('Markdown 提示词'));
  assert.ok(row, 'seeded Markdown prompt row exists');
  row.props.onClick({ preventDefault() {}, stopPropagation() {} });
  h.render();
}

function markdownViewNode(h) {
  return h
    .all('div')
    .find((node) => typeof node.props.className === 'string' && node.props.className.split(' ').includes('pl-markdown'));
}

test('the detail body is plain text by default and opts into rendered Markdown', () => {
  const h = markdownHarness();
  openMarkdownDetail(h);
  const rawBody = h.all('pre').find((node) => node.props.className === 'pl-detail-body');
  assert.ok(rawBody, 'default plain body exists');
  assert.equal(h.text(rawBody).includes('**边界条件**'), true, 'raw Markdown is shown literally');
  assert.equal(markdownViewNode(h), undefined, 'nothing is rendered before opt-in');

  const toggle = h
    .all('button')
    .find((node) => h.text(node).trim() === 'Markdown 渲染');
  assert.ok(toggle, 'Markdown toggle exists');
  assert.equal(toggle.props['aria-pressed'], false);
  toggle.props.onClick({});
  h.render();

  const view = markdownViewNode(h);
  assert.ok(view, 'rendered Markdown view exists');
  assert.equal(h.text(view).includes('**边界条件**'), false, 'rendered mode hides literal markers');
  const strong = h.descendants(view, (node) => node.type === 'strong');
  assert.deepEqual(strong.map((node) => h.text(node)), ['边界条件']);
  assert.deepEqual(h.descendants(view, (node) => node.type === 'em').map((node) => h.text(node)), ['错误处理']);
  assert.deepEqual(h.descendants(view, (node) => node.type === 'code').map((node) => h.text(node)).slice(0, 1), ['inline code']);
  assert.equal(h.descendants(view, (node) => node.type === 'h1').length, 1);
  assert.equal(h.descendants(view, (node) => node.type === 'ul').length, 1);
  assert.equal(h.descendants(view, (node) => node.type === 'ol').length, 1);
  assert.equal(h.descendants(view, (node) => node.type === 'blockquote').length, 1);
  assert.equal(h.descendants(view, (node) => node.type === 'table').length, 1);
  assert.equal(h.descendants(view, (node) => node.type === 'pre').length, 1, 'fenced code block');
  assert.equal(h.text(view).includes('<b>literal</b>'), true, 'code fence content is literal text');

  const links = h.descendants(view, (node) => node.type === 'a');
  assert.deepEqual(links.map((node) => node.props.href), ['https://example.com/a']);
  assert.equal(h.descendants(view, (node) => node.type === 'script').length, 0, 'no script element');
  assert.equal(h.descendants(view, (node) => node.type === 'img').length, 0, 'images are not loaded');
  assert.equal(h.text(view).includes('<script>alert(1)</script>'), true, 'raw HTML stays literal text');
  assert.equal(
    h.text(view).includes('![远程图片](https://example.com/a.png)'),
    true,
    'image Markdown stays literal',
  );

  const pressed = h
    .all('button')
    .find((node) => h.text(node).trim() === 'Markdown 渲染');
  assert.equal(pressed.props['aria-pressed'], true);
  const prefs = JSON.parse(h.storage.map.get('dsh-prompt-library:ui/v1'));
  assert.equal(prefs.bodyRender, 'markdown');
  h.dispose();
});

test('copying keeps the raw Markdown while the detail view is rendered', async () => {
  const h = markdownHarness();
  openMarkdownDetail(h);
  h.clickButton('Markdown 渲染');
  assert.ok(markdownViewNode(h));
  h.clickButton('复制正文');
  await h.flush();
  assert.equal(h.calls.copies.at(-1), MARKDOWN_BODY);
  assert.equal(h.promptById('p-md').useCount, 1, 'copy success still records usage');
  h.dispose();
});

test('the Markdown preference persists and applies to the quick picker', async () => {
  const h = markdownHarness({
    'dsh-prompt-library:ui/v1': JSON.stringify({ bodyRender: 'markdown' }),
  });
  openMarkdownDetail(h);
  assert.ok(markdownViewNode(h), 'saved preference opens in rendered mode');

  h.renderQuick();
  h.clickButton('提示库');
  const row = h.all('button').find((node) => h.text(node).includes('Markdown 提示词'));
  row.props.onClick({ preventDefault() {}, stopPropagation() {} });
  h.render();
  const preview = markdownViewNode(h);
  assert.ok(preview, 'quick picker preview renders Markdown too');
  assert.equal(h.descendants(preview, (node) => node.type === 'table').length, 1);

  h.clickButton('复制正文');
  await h.flush();
  assert.equal(h.calls.copies.at(-1), MARKDOWN_BODY, 'quick copy keeps raw Markdown');

  h.clickButton('插入输入框');
  await h.flush();
  assert.equal(h.calls.inserts.at(-1).text, MARKDOWN_BODY, 'quick insert keeps raw Markdown');
  assert.equal(h.calls.drafts.length, 0, 'insert never replaces the whole draft');
  h.dispose();
});

test('switching back to source text restores the exact raw view', () => {
  const h = markdownHarness({
    'dsh-prompt-library:ui/v1': JSON.stringify({ bodyRender: 'markdown' }),
  });
  openMarkdownDetail(h);
  assert.ok(markdownViewNode(h));
  h.clickButton('原文');
  const rawBody = h.all('pre').find((node) => node.props.className === 'pl-detail-body');
  assert.ok(rawBody);
  assert.equal(h.text(rawBody), MARKDOWN_BODY);
  const prefs = JSON.parse(h.storage.map.get('dsh-prompt-library:ui/v1'));
  assert.equal(prefs.bodyRender, 'plain');
  h.dispose();
});
