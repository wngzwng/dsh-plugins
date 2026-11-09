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
    'shell.overlay',
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

/* ------------------------------------------------------------------------- */
/* Quick capture (paste / composer draft / chat selection)                   */
/* ------------------------------------------------------------------------- */

const CAPTURE_TEXT = '请审查以下代码，重点关注边界条件与错误处理。';

function captureHubOf(h) {
  const entry = h.slotEntries['shell.overlay'].find((item) => item.config.id === 'prompt-library-capture');
  assert.ok(entry, 'capture overlay host is registered');
  const injected = entry.config.inject();
  assert.ok(injected.capture, 'capture hub injected');
  return injected.capture;
}

function openCapture(h, payload) {
  const capture = captureHubOf(h);
  const opened = capture.open(payload);
  assert.equal(opened, true, 'capture request opened');
  h.renderOverlay();
  return capture;
}

/** Open the quick panel, click its "快速收录" action and render the overlay. */
function openQuickCapture(h) {
  h.renderQuick();
  h.clickButton('提示库');
  h.clickButton('快速收录');
  h.renderOverlay();
}

function saveCapture(h) {
  const saveButton = h.all('button').find((node) => h.text(node).trim() === '收录');
  assert.ok(saveButton, 'capture save button exists');
  saveButton.props.onClick({});
  h.render();
}

test('pasting into quick capture saves an inbox entry with an automatic title', async () => {
  const h = harness();
  openQuickCapture(h);
  const body = h.findTextarea('提示词正文');
  assert.ok(body, 'body field exists and is focused-ish');
  h.change(body, CAPTURE_TEXT);
  const titleInput = h.findInput('提示词标题');
  assert.equal(titleInput.props.value, CAPTURE_TEXT, 'title is suggested from the first non-empty line');
  h.clickButton('更多选项');
  h.change(h.findTextarea('使用场景'), '代码审查');
  h.change(h.findInput('来源说明'), '来自周会文档');
  saveCapture(h);
  await h.flush();

  const prompts = h.prompts();
  assert.equal(prompts.length, 1);
  const saved = prompts[0];
  assert.equal(saved.title, CAPTURE_TEXT);
  assert.equal(saved.body, CAPTURE_TEXT, 'body is kept exactly');
  assert.equal(saved.usage, '代码审查');
  assert.equal(saved.organize, 'inbox');
  assert.deepEqual(saved.capture && saved.capture.kind, 'paste');
  assert.equal(saved.capture.note, '来自周会文档');
  assert.equal(typeof saved.capture.at, 'number');
  assert.equal(saved.useCount, 0, 'capturing is not a use');
  assert.equal(saved.lastUsedAt, null);
  assert.equal(saved.favorite, false);
  assert.equal(saved.pinned, false);
  assert.equal(saved.score.stars, null);
  assert.equal(saved.aiReview, null);
  assert.match(h.text(), /已收录/);
  h.dispose();
});

test('automatic titles stay within 40 visible characters and never overwrite manual edits', () => {
  const h = harness();
  openQuickCapture(h);
  const longLine = '这是一个非常长的提示词标题'.repeat(6);
  h.change(h.findTextarea('提示词正文'), longLine + '\n第二行');
  const titleInput = h.findInput('提示词标题');
  const suggested = titleInput.props.value;
  assert.equal(Array.from(suggested.replace(/\s/gu, '')).length <= 40, true);
  assert.match(suggested, /…$/);
  h.change(titleInput, '我的手写标题');
  h.change(h.findTextarea('提示词正文'), '新的正文第一行');
  assert.equal(h.findInput('提示词标题').props.value, '我的手写标题', 'manual title survives body edits');
  h.change(h.findInput('提示词标题'), '');
  assert.equal(
    h.findInput('提示词标题').props.value,
    '新的正文第一行',
    'clearing the title resumes the automatic suggestion',
  );
  h.dispose();
});

test('continuous capture resets text, title, tags and source without inheriting them', async () => {
  const h = harness({ storage: { [DATA_KEY]: JSON.stringify({ version: 1, tags: [{ id: 'tag-1', name: '写作', order: 0 }], prompts: [] }) } });
  openQuickCapture(h);
  h.change(h.findTextarea('提示词正文'), '第一条正文');
  h.clickButton('更多选项');
  h.change(h.findTextarea('使用场景'), '第一条场景');
  h.change(h.findInput('来源说明'), '第一条来源');
  const tag = h.all('input').find((node) => node.props['aria-label'] === '写作');
  tag.props.onChange({ target: { checked: true } });
  h.render();
  saveCapture(h);
  await h.flush();
  assert.equal(h.prompts().length, 1);
  assert.deepEqual(h.prompts()[0].tagIds, ['tag-1']);
  assert.equal(h.prompts()[0].capture.note, '第一条来源');

  h.clickButton('继续收录');
  assert.equal(h.findTextarea('提示词正文').props.value, '', 'body cleared');
  assert.equal(h.findInput('提示词标题').props.value, '', 'title cleared');
  const checkedTags = h.all('input').filter((node) => node.props.type === 'checkbox' && node.props.checked);
  assert.equal(checkedTags.length, 0, 'tags are not inherited');
  assert.equal(h.all('button').some((node) => h.text(node).trim() === '收起选项'), false, 'more options collapsed');

  h.change(h.findTextarea('提示词正文'), '第二条正文');
  saveCapture(h);
  await h.flush();
  const prompts = h.prompts();
  assert.equal(prompts.length, 2);
  assert.equal(prompts[1].organize, 'inbox');
  assert.deepEqual(prompts[1].tagIds, []);
  assert.equal(prompts[1].capture.kind, 'paste', 'source resets to paste for the next capture');
  assert.equal(prompts[1].capture.note, undefined);
  h.dispose();
});

test('exact duplicates are reported and can be previewed or saved as a new entry', async () => {
  const h = harness({
    storage: {
      [DATA_KEY]: JSON.stringify({
        version: 1,
        tags: [],
        prompts: [
          seedPrompt({
            id: 'p-existing',
            title: '现有提示词',
            body: CAPTURE_TEXT,
            score: { stars: 4.5, note: '不错', ratedBodyVersion: 1, ratedAt: 2 },
            lastUsedAt: 5,
            useCount: 3,
            favorite: true,
            aiReview: { text: '参考评价', provider: 'x', model: 'm', generatedAt: 3, input: { title: '现有提示词', body: CAPTURE_TEXT, usage: '' } },
          }),
        ],
      }),
    },
  });
  openQuickCapture(h);
  h.change(h.findTextarea('提示词正文'), CAPTURE_TEXT);
  saveCapture(h);
  assert.match(h.text(), /发现重复内容/);
  assert.match(h.text(), /此内容已收录/);
  assert.equal(h.prompts().length, 1, 'nothing saved before choosing');

  h.clickButton('查看已有');
  assert.equal(h.text().includes('现有提示词'), true);
  assert.equal(h.text().includes(CAPTURE_TEXT), true, 'existing body is previewed');
  h.clickButton('返回');
  h.clickButton('返回继续编辑');
  assert.ok(h.findTextarea('提示词正文'), 'back to the editor keeps the capture content');

  saveCapture(h);
  h.clickButton('仍然另存');
  await h.flush();
  const prompts = h.prompts();
  assert.equal(prompts.length, 2);
  const created = prompts[1];
  assert.equal(created.body, CAPTURE_TEXT);
  assert.equal(created.organize, 'inbox');
  assert.equal(created.score.stars, null, 'no rating inherited');
  assert.equal(created.useCount, 0);
  assert.equal(created.favorite, false);
  assert.equal(created.aiReview, null);
  assert.equal(prompts[0].score.stars, 4.5, 'existing entry untouched');
  h.dispose();
});

test('near duplicates differ only by leading/trailing whitespace or line endings', async () => {
  const h = harness({
    storage: {
      [DATA_KEY]: JSON.stringify({ version: 1, tags: [], prompts: [seedPrompt({ id: 'p-near', body: 'line one\r\nline two' })] }),
    },
  });
  openQuickCapture(h);
  h.change(h.findTextarea('提示词正文'), '  line one\nline two  ');
  saveCapture(h);
  assert.match(h.text(), /发现疑似重复内容/);
  assert.match(h.text(), /疑似重复/);
  assert.equal(h.text().includes('此内容已收录'), false, 'near duplicates are not labelled exact');
  assert.equal(h.prompts().length, 1);
  h.dispose();
});

test('a failed save keeps every capture field and can be retried', async () => {
  const h = harness();
  openQuickCapture(h);
  h.change(h.findTextarea('提示词正文'), '会失败的正文');
  h.change(h.findInput('提示词标题'), '会失败的标题');
  h.setStorageFailure(true);
  saveCapture(h);
  assert.match(h.text(), /保存失败/);
  assert.equal(h.prompts() ? h.prompts().length : 0, 0);
  assert.equal(h.findTextarea('提示词正文').props.value, '会失败的正文', 'body retained');
  assert.equal(h.findInput('提示词标题').props.value, '会失败的标题', 'title retained');
  h.setStorageFailure(false);
  saveCapture(h);
  await h.flush();
  assert.equal(h.prompts().length, 1);
  assert.equal(h.prompts()[0].title, '会失败的标题');
  h.dispose();
});

test('Escape asks before discarding unsaved capture content', () => {
  const h = harness();
  openQuickCapture(h);
  h.change(h.findTextarea('提示词正文'), '未保存的收录');
  h.pressEscape();
  assert.match(h.text(), /放弃这次收录/);
  assert.equal(h.findTextarea('提示词正文').props.value, '未保存的收录');
  h.clickButton('继续编辑');
  assert.ok(h.findTextarea('提示词正文'));
  h.pressEscape();
  h.clickButton('放弃收录');
  assert.equal(h.prompts() ? h.prompts().length : 0, 0, 'discard saves nothing');
  h.dispose();
});

test('Ctrl/Cmd+Enter saves, but never during IME composition', async () => {
  const h = harness();
  openQuickCapture(h);
  h.change(h.findTextarea('提示词正文'), '快捷键保存正文');
  const key = (extra) =>
    Object.assign({ key: 'Enter', metaKey: true, preventDefault() {}, nativeEvent: {} }, extra);
  h.findTextarea('提示词正文').props.onKeyDown(key({ nativeEvent: { isComposing: true } }));
  h.render();
  assert.equal(h.prompts() ? h.prompts().length : 0, 0, 'IME composition does not save');
  h.findTextarea('提示词正文').props.onKeyDown(key({}));
  h.render();
  await h.flush();
  assert.equal(h.prompts().length, 1);
  h.dispose();
});

test('the composer save-draft entry captures the whole draft without touching it', async () => {
  const draft = '  草稿第一行\n第二行  ';
  const h = harness({ uiConversation: true });
  const slotProps = { sessionId: 'session-a', input: { draft }, inputActions: h.fakeInputActions };
  h.renderSlot('conversation.input.right', 'prompt-library-save-draft', slotProps);
  h.clickButton('保存为提示词');
  h.renderOverlay();
  assert.equal(h.findTextarea('提示词正文').props.value, draft, 'whole draft snapshotted exactly');
  assert.match(h.text(), /整份草稿/, 'composer selection limitation is explained');
  saveCapture(h);
  await h.flush();
  const saved = h.prompts()[0];
  assert.equal(saved.body, draft);
  assert.equal(saved.capture.kind, 'composer');
  assert.equal(saved.capture.sessionId, 'session-a');
  assert.equal(h.calls.drafts.length, 0, 'never calls setDraft');
  assert.equal(h.calls.inserts.length, 0);
  h.dispose();
});

test('composer capture keeps the session captured at click time after a session switch', async () => {
  const h = harness({ uiConversation: true });
  h.renderSlot('conversation.input.right', 'prompt-library-save-draft', {
    sessionId: 'session-old',
    input: { draft: '旧会话草稿' },
    inputActions: h.fakeInputActions,
  });
  h.clickButton('保存为提示词');
  h.renderSlot('conversation.input.right', 'prompt-library-save-draft', {
    sessionId: 'session-new',
    input: { draft: '新会话草稿' },
    inputActions: h.fakeInputActions,
  });
  h.renderOverlay();
  assert.equal(h.findTextarea('提示词正文').props.value, '旧会话草稿', 'captured snapshot does not change');
  saveCapture(h);
  await h.flush();
  assert.equal(h.prompts()[0].capture.sessionId, 'session-old');
  h.dispose();
});

test('the chat text-selection interaction opens capture for selected text only', async () => {
  const h = harness({ uiConversation: true });
  assert.equal(h.interactions.length, 1);
  const interaction = h.interactions[0];
  assert.equal(interaction.id, 'prompt-library-capture');

  let opened = 0;
  const request = (overrides) =>
    Object.assign(
      {
        trigger: 'selection',
        sessionId: 'session-chat',
        readText: () => '选中的对话文字',
        open() {
          opened += 1;
        },
      },
      overrides,
    );
  interaction.onInteraction(request({ trigger: 'context-menu' }));
  interaction.onInteraction(request({ readText: () => '   ' }));
  interaction.onInteraction(request({ readText: () => null }));
  assert.equal(opened, 0, 'only explicit non-empty selections are admitted');
  interaction.onInteraction(request({}));
  assert.equal(opened, 1);

  h.renderSlot('conversation.chat.text-interaction', 'prompt-library-capture', {
    readText: () => '选中的对话文字',
    dismiss() {},
    trigger: 'selection',
    sessionId: 'session-chat',
  });
  h.clickButton('收录为提示词');
  h.renderOverlay();
  assert.equal(h.findTextarea('提示词正文').props.value, '选中的对话文字');
  assert.match(h.text(), /选中的文本/);
  saveCapture(h);
  await h.flush();
  const saved = h.prompts()[0];
  assert.equal(saved.body, '选中的对话文字');
  assert.equal(saved.capture.kind, 'message');
  assert.equal(saved.capture.sessionId, 'session-chat');
  h.dispose();
});

/* ------------------------------------------------------------------------- */
/* Inbox / organize status / source metadata through the management page     */
/* ------------------------------------------------------------------------- */

function capturedPrompt(overrides = {}) {
  return seedPrompt({
    id: 'p-captured',
    title: '收件箱条目',
    body: '收录进来的正文',
    organize: 'inbox',
    capture: { kind: 'composer', at: 1700000000000, sessionId: 'session-src', note: '来自输入框' },
    ...overrides,
  });
}

test('the management page opens quick capture and focuses a saved item after "查看"', async () => {
  const panels = [];
  const h = harness({ layout: { selectPanel: (id) => panels.push(id) } });
  h.renderPage();
  h.clickButton('快速收录');
  h.renderOverlay();
  h.change(h.findTextarea('提示词正文'), '面板收录的正文');
  saveCapture(h);
  await h.flush();
  assert.equal(h.prompts()[0].organize, 'inbox');

  h.clickButton('查看');
  assert.deepEqual(panels, ['prompt-library'], 'opens the full management panel');
  h.renderPage();
  assert.match(h.text(), /面板收录的正文/, 'the saved item is selected in the detail pane');
  assert.match(h.text(), /待整理/);
  h.dispose();
});

test('inbox list marks the item and the detail can complete/reopen organization', () => {
  const h = harness({
    storage: { [DATA_KEY]: JSON.stringify({ version: 1, tags: [], prompts: [capturedPrompt()] }) },
  });
  h.renderPage();
  const inboxButton = h.all('button').find((node) => h.text(node).includes('收件箱（1）'));
  assert.ok(inboxButton, 'inbox nav shows the pending count');
  inboxButton.props.onClick({});
  h.render();
  const row = h.all('button').find((node) => h.text(node).includes('收件箱条目'));
  assert.ok(row);
  row.props.onClick({});
  h.render();
  assert.match(h.text(), /待整理/);
  assert.match(h.text(), /整理状态/);
  const before = h.promptById('p-captured');
  h.clickButton('标记整理完成');
  const after = h.promptById('p-captured');
  assert.equal(after.organize, 'organized');
  assert.equal(after.updatedAt, before.updatedAt, 'organize toggle does not refresh updatedAt');
  assert.equal(after.body, before.body);
  h.clickButton('重新移回收件箱');
  assert.equal(h.promptById('p-captured').organize, 'inbox');
  h.dispose();
});

test('source metadata is shown and a missing source session is reported without breaking the item', () => {
  const h = harness({
    storage: { [DATA_KEY]: JSON.stringify({ version: 1, tags: [], prompts: [capturedPrompt()] }) },
  });
  h.renderPage();
  const row = h.all('button').find((node) => h.text(node).includes('收件箱条目'));
  row.props.onClick({});
  h.render();
  assert.match(h.text(), /来源信息/);
  assert.match(h.text(), /输入框草稿/);
  assert.match(h.text(), /来源说明：来自输入框/);
  h.clickButton('打开来源会话');
  assert.match(h.text(), /不支持打开来源会话/);
  assert.equal(h.promptById('p-captured').body, '收录进来的正文', 'prompt text is untouched');
  h.dispose();
});

test('rapid double submits create exactly one captured entry', async () => {
  const h = harness();
  openQuickCapture(h);
  h.change(h.findTextarea('提示词正文'), '只应保存一次的正文');
  const saveButton = h.all('button').find((node) => h.text(node).trim() === '收录');
  assert.ok(saveButton);
  saveButton.props.onClick({});
  saveButton.props.onClick({});
  h.render();
  await h.flush();
  assert.equal(h.prompts().length, 1);
  h.dispose();
});
