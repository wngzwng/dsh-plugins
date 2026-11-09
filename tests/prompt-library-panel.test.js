/*
 * Panel tests for the Prompt Library `main` slot page (owner: panel-ui).
 *
 * They render the real component tree through the shared harness (fake
 * window/document/locale/React + fake fetch) and drive it exactly like a user:
 * finding buttons/inputs by their accessible names, clicking, typing, pressing
 * Escape, and asserting on the rendered text, aria attributes and the JSON
 * persisted in the fake localStorage.
 *
 * The panel owns no data logic of its own: filtering/sorting comes from core,
 * persistence from the store. These tests therefore focus on the UI contract
 * (visible states, dialogs, confirmations, aria, i18n, narrow layout) rather
 * than re-testing core's algorithms.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers/prompt-library-harness.js';

const DATA_KEY = 'dsh-prompt-library/v1';
const UI_KEY = 'dsh-prompt-library:ui/v1';

/* Download content capture: Node may provide its own URL.createObjectURL, so
 * capture every Blob handed to it regardless of the harness polyfill. */
const capturedBlobs = [];
const nativeCreateObjectURL =
  typeof URL.createObjectURL === 'function' ? URL.createObjectURL.bind(URL) : null;
URL.createObjectURL = (blob) => {
  capturedBlobs.push(blob);
  return nativeCreateObjectURL ? nativeCreateObjectURL(blob) : 'blob:test-' + String(capturedBlobs.length);
};

async function lastDownloadText() {
  const blob = capturedBlobs[capturedBlobs.length - 1];
  assert.ok(blob, 'a download blob was captured');
  return blob.text();
}

/* ------------------------------------------------------------------ */
/* Fixtures & helpers                                                  */
/* ------------------------------------------------------------------ */

function seedPrompt(overrides = {}) {
  return {
    id: 'p-seed',
    title: '代码审查助手',
    body: '请审查以下代码，重点关注边界条件与错误处理。',
    usage: '代码审查',
    tagIds: [],
    favorite: false,
    pinned: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    bodyVersion: 1,
    score: { stars: null, note: '', ratedBodyVersion: null, ratedAt: null },
    lastUsedAt: null,
    useCount: 0,
    aiReview: null,
    ...overrides,
  };
}

function seeded(prompts, tags = [], options = {}) {
  const base = options.storage || {};
  return harness({
    ...options,
    storage: {
      [DATA_KEY]: JSON.stringify({ version: 1, tags, prompts }),
      ...base,
    },
  });
}

function dictFor(h) {
  const active = h.locale.getSnapshot().active;
  return h.dictionaries[active] || h.dictionaries.zh;
}

/** Translate like the plugin does (params interpolation). */
function tr(h, key, params) {
  let text = dictFor(h)[key];
  if (typeof text !== 'string') return key;
  if (params && typeof params === 'object') {
    for (const [name, value] of Object.entries(params)) {
      text = text.split('{' + name + '}').join(String(value));
    }
  }
  return text;
}

function hasDialog(h) {
  return h.all('div').some((node) => node.props && node.props.role === 'dialog');
}

function buttonMatches(h, node, label) {
  const aria = node.props['aria-label'];
  const title = node.props.title;
  return aria === label || title === label || h.text(node).trim() === label;
}

function findButton(h, label) {
  return h.all('button').find((node) => buttonMatches(h, node, label));
}

function clickNode(h, node) {
  assert.ok(node, 'button exists');
  node.props.onClick({ currentTarget: node, target: node, preventDefault() {}, stopPropagation() {} });
  h.render();
}

function clickLastButton(h, label) {
  const matches = h.all('button').filter((node) => buttonMatches(h, node, label));
  assert.ok(matches.length > 0, 'button not found: ' + label);
  clickNode(h, matches[matches.length - 1]);
}

/** Detail-panel toggle (aria-pressed) — ignores the equally named nav item. */
function detailToggleButton(h, label) {
  return h.all('button').find((node) => {
    const className = String(node.props.className || '');
    return (
      className.includes('pl-btn') &&
      node.props['aria-pressed'] !== undefined &&
      h.text(node).trim() === label
    );
  });
}

function clickDetailToggle(h, label) {
  const node = detailToggleButton(h, label);
  assert.ok(node, 'detail toggle not found: ' + label);
  clickNode(h, node);
  return node;
}

/** Titles in prompt-list order (aria-label of each list item button). */
function listTitles(h) {
  return h.all('button')
    .filter((node) => String(node.props.className || '').includes('pl-list-item'))
    .map((node) => String(node.props['aria-label'] || ''));
}

function navTagNames(h) {
  const prefix = tr(h, 'full.nav.tagAria', { name: '§' }).split('§')[0];
  return h.all('button')
    .filter(
      (node) =>
        String(node.props.className || '').includes('pl-nav-item') &&
        typeof node.props['aria-label'] === 'string' &&
        node.props['aria-label'].startsWith(prefix),
    )
    .map((node) => node.props['aria-label'].slice(prefix.length));
}

function editorTagNames(h) {
  return h
    .all('input')
    .filter((node) => node.props.type === 'checkbox')
    .map((node) => String(node.props['aria-label'] || ''));
}

function setSort(h, value) {
  const select = h.all('select').find((node) => node.props['aria-label'] === 'sort');
  assert.ok(select, 'sort select exists');
  select.props.onChange({ target: { value } });
  h.render();
}

function uploadImportFile(h, name, content) {
  const input = h.all('input').find((node) => node.props['aria-label'] === 'import-file');
  assert.ok(input, 'import file input exists');
  input.props.onChange({ target: { files: [{ name, text: async () => content }] } });
}

function dataTagNames(data) {
  return data.tags
    .slice()
    .sort((a, b) => (a.order === b.order ? String(a.name).localeCompare(String(b.name)) : a.order - b.order))
    .map((tag) => tag.name);
}

function aiStatusResponse(overrides = {}) {
  return {
    status: 200,
    body: {
      ok: true,
      available: true,
      provider: 'deepseek-account',
      model: 'deepseek-flash',
      displayName: 'deepseek-flash',
      source: 'default',
      ...overrides,
    },
  };
}

/** Hand-rolled focus request store: same shape as the shared client helper. */
function makeFocusStore(initial = null) {
  let requested = typeof initial === 'string' ? initial : null;
  let sequence = 0;
  const listeners = new Set();
  const emit = () => {
    sequence += 1;
    for (const listener of Array.from(listeners)) listener();
  };
  return {
    getSnapshot: () => ({ id: requested, seq: sequence }),
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    request(id) {
      requested = id;
      emit();
    },
    consume() {
      const id = requested;
      requested = null;
      emit();
      return id;
    },
    current: () => requested,
  };
}

/** Navigation button by its accessible label (nav items carry counts). */
function navItemByAria(h, label) {
  return h.all('button').find(
    (node) =>
      String(node.props.className || '').includes('pl-nav-item') && node.props['aria-label'] === label,
  );
}

/** A button whose visible text equals the active dictionary string. */
function buttonByText(h, label) {
  return h.all('button').find((node) => h.text(node).trim() === label);
}

/* ------------------------------------------------------------------ */
/* 1. Empty / first-use state, storage untouched, dictionary parity   */
/* ------------------------------------------------------------------ */

test('renders the first-use welcome state without writing storage, and en/zh keys match', () => {
  const h = harness();
  h.renderPage();
  const text = h.text();
  assert.match(text, /提示库/);
  assert.match(text, /欢迎使用提示库/);
  assert.match(text, /数据只保存在本机浏览器/);
  assert.match(text, /新建提示词/);
  assert.match(text, /导入提示词/);
  assert.match(text, /从列表中选择提示词查看详情/);
  assert.ok(hasDialog(h) === false);
  assert.equal(h.storage.map.size, 0, 'opening an empty library must not write anything');

  const zhFull = Object.keys(h.dictionaries.zh).filter((key) => key.startsWith('full.')).sort();
  const enFull = Object.keys(h.dictionaries.en).filter((key) => key.startsWith('full.')).sort();
  assert.deepEqual(zhFull, enFull, 'zh/en fragment dictionary key sets must be identical');
  assert.ok(zhFull.length >= 100, 'fragment dictionary has a meaningful number of keys');
  assert.equal(typeof h.dictionaries.zh['full.aiErr.NO_MODEL'], 'string');
  assert.equal(typeof h.dictionaries.en['full.sortRule.ratingDesc'], 'string');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 2. Create: required fields, newline preservation, persistence      */
/* ------------------------------------------------------------------ */

test('create prompt validates required fields, keeps line breaks, persists and selects', () => {
  const h = harness();
  h.renderPage();
  h.clickButton('新建提示词');
  assert.ok(hasDialog(h));
  assert.ok(h.findInput('title'));
  assert.ok(h.findTextarea('body'));

  // Blank title + body is rejected in place and nothing is persisted.
  h.clickButton('保存');
  assert.equal(h.findInput('title').props.value, '');
  assert.match(h.text(), /请填写标题/);
  assert.match(h.text(), /请填写正文/);
  assert.equal(h.storage.map.size, 0, 'invalid submit must not persist');

  h.change(h.findInput('title'), '写作助手');
  h.change(h.findTextarea('body'), '第一段\n第二段\n第三段');
  h.change(h.findTextarea('usage'), '日常写作');
  h.clickButton('保存');
  assert.equal(hasDialog(h), false, 'save success closes the dialog');
  const stored = h.data();
  assert.equal(stored.prompts.length, 1);
  assert.equal(stored.prompts[0].title, '写作助手');
  assert.equal(stored.prompts[0].body, '第一段\n第二段\n第三段');
  assert.equal(stored.prompts[0].usage, '日常写作');
  assert.equal(stored.prompts[0].bodyVersion, 1);
  // Auto-selected: the detail pane is rendered for the new prompt.
  assert.match(h.text(), /已使用 0 次/);
  assert.ok(h.findTextarea('body') === undefined);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 3. Edit: save + unsaved-close confirmation (Esc / X / cancel)      */
/* ------------------------------------------------------------------ */

test('editing saves changes and every unsaved close path asks for confirmation', () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  h.clickButton('代码审查助手');
  const originalTitle = h.prompts()[0].title;

  // Esc with unsaved edits shows the discard confirmation instead of closing.
  h.clickButton('编辑');
  h.change(h.findInput('title'), '临时标题');
  h.pressEscape();
  assert.ok(hasDialog(h), 'discard dialog replaces/closes over the editor');
  assert.match(h.text(), /放弃未保存的修改/);
  h.clickButton('继续编辑');
  assert.doesNotMatch(h.text(), /放弃未保存的修改/, 'keep editing closes only the confirmation');
  assert.equal(h.findInput('title').props.value, '临时标题');

  // Cancel with unsaved edits asks again; discarding keeps the old data.
  h.clickButton('取消');
  assert.match(h.text(), /放弃未保存的修改/);
  h.clickButton('放弃修改');
  assert.equal(hasDialog(h), false);
  assert.equal(h.prompts()[0].title, originalTitle, 'discard must not persist the draft');

  // The X button and the dialog background ask too.
  h.clickButton('编辑');
  h.change(h.findInput('title'), 'X 关闭测试');
  h.clickButton('关闭');
  assert.match(h.text(), /放弃未保存的修改/);
  h.clickButton('继续编辑');
  const overlay = h
    .all('div')
    .find((node) => String(node.props.className || '').split(' ').includes('pl-overlay'));
  assert.ok(overlay, 'dialog overlay exists');
  overlay.props.onMouseDown({ target: overlay, currentTarget: overlay });
  h.render();
  assert.match(h.text(), /放弃未保存的修改/, 'background click asks before discarding');
  h.clickButton('放弃修改');
  assert.equal(h.prompts()[0].title, originalTitle);

  // Reopen and save: the store is updated and the dialog closes.
  h.clickButton('编辑');
  h.change(h.findInput('title'), '代码审查助手（新）');
  h.clickButton('保存');
  assert.equal(hasDialog(h), false);
  assert.equal(h.prompts()[0].title, '代码审查助手（新）');
  assert.match(h.text(), /代码审查助手（新）/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 4. Delete: second confirmation only                                 */
/* ------------------------------------------------------------------ */

test('delete prompt requires a second confirmation that says it is permanent', () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  h.clickButton('代码审查助手');
  h.clickButton('删除');
  assert.ok(hasDialog(h));
  assert.match(h.text(), /此操作不可恢复/);
  // Cancel leaves everything alone.
  h.clickButton('取消');
  assert.equal(h.prompts().length, 1);
  // Confirm deletes.
  h.clickButton('删除');
  h.clickButton('永久删除');
  assert.equal(h.prompts().length, 0);
  assert.match(h.text(), /欢迎使用提示库/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 5. Tag management: create / rename / duplicate / reorder / delete  */
/* ------------------------------------------------------------------ */

test('tag manager creates, trims names, rejects duplicates, reorders and deletes without deleting prompts', () => {
  const tags = [
    { id: 't1', name: '写作', order: 0 },
    { id: 't2', name: '代码', order: 1 },
  ];
  const h = seeded([seedPrompt({ tagIds: ['t1', 't2'] })], tags);
  h.renderPage();
  h.clickButton('标签管理');
  assert.match(h.text(), /管理标签/);
  assert.match(h.text(), /标签顺序会同时影响导航与编辑器中的选择顺序/);

  // Create (name is trimmed).
  h.change(h.findInput('new-tag'), ' 灵感 ');
  h.clickButton('新建标签');
  assert.ok(h.tags().some((tag) => tag.name === '灵感'), 'trimmed tag created');
  assert.ok(!h.tags().some((tag) => tag.name === ' 灵感 '));

  // Duplicate names are rejected.
  h.change(h.findInput('new-tag'), '写作');
  h.clickButton('新建标签');
  assert.match(h.text(), /已存在同名标签/);
  assert.equal(h.tags().filter((tag) => tag.name === '写作').length, 1);

  // Rename (trimmed) and duplicate rejection on rename.
  h.clickButton(tr(h, 'full.tags.renameAria', { name: '代码' }));
  h.change(h.findInput('tag-rename'), ' 编程 ');
  h.clickButton('保存名称');
  assert.ok(h.tags().some((tag) => tag.name === '编程'));
  h.clickButton(tr(h, 'full.tags.renameAria', { name: '写作' }));
  h.change(h.findInput('tag-rename'), '编程');
  h.clickButton('保存名称');
  assert.match(h.text(), /已存在同名标签/);
  h.clickButton('取消');

  // Reorder: moving 编程 up swaps it before 写作.
  h.clickButton(tr(h, 'full.tags.moveUpAria', { name: '编程' }));
  assert.deepEqual(dataTagNames(h.data()), ['编程', '写作', '灵感']);
  assert.deepEqual(navTagNames(h), ['编程', '写作', '灵感'], 'navigation order follows sortTags');

  // The editor tag picker uses the same order and can create tags inline.
  h.clickButton('关闭');
  h.clickButton('新建提示词');
  assert.deepEqual(editorTagNames(h), ['编程', '写作', '灵感']);
  h.change(h.findInput('new-tag'), '内联新标签');
  h.clickButton('新建标签');
  assert.ok(h.tags().some((tag) => tag.name === '内联新标签'));
  assert.deepEqual(editorTagNames(h), ['编程', '写作', '灵感', '内联新标签']);
  const inlineCheckbox = h
    .all('input')
    .filter((node) => node.props['aria-label'] === '内联新标签')
    .pop();
  assert.equal(inlineCheckbox.props.checked, true, 'newly created inline tag is selected');
  h.clickButton('取消');
  h.clickButton('放弃修改');

  // Delete asks for confirmation, explains prompts survive, and prunes tagIds.
  h.clickButton('标签管理');
  h.clickButton(tr(h, 'full.tags.deleteAria', { name: '写作' }));
  assert.match(h.text(), /只会移除分类关系/);
  assert.match(h.text(), /不会删除任何提示词/);
  h.clickButton('删除标签');
  assert.ok(!h.tags().some((tag) => tag.name === '写作'));
  assert.equal(h.prompts().length, 1, 'deleting a tag must not delete prompts');
  assert.deepEqual(h.prompts()[0].tagIds, ['t2']);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 6. Favorite / pin are independent, aria-pressed, default order     */
/* ------------------------------------------------------------------ */

test('favorite and pin are independent aria-pressed toggles; default order puts pinned first', () => {
  const prompts = [
    seedPrompt({ id: 'p-pinned', title: '置顶旧提示', pinned: true, createdAt: 1000, updatedAt: 1000 }),
    seedPrompt({ id: 'p-new', title: '较新未置顶', createdAt: 2000, updatedAt: 2000 }),
  ];
  const h = seeded(prompts);
  h.renderPage();
  assert.deepEqual(listTitles(h), ['置顶旧提示', '较新未置顶'], 'pinned wins the default sort');

  h.clickButton('较新未置顶');
  let favorite = detailToggleButton(h, '收藏');
  assert.ok(favorite, 'favorite toggle exists');
  assert.equal(favorite.props['aria-pressed'], false);
  clickDetailToggle(h, '收藏');
  assert.equal(h.promptById('p-new').favorite, true);
  assert.equal(h.promptById('p-new').pinned, false);
  assert.equal(detailToggleButton(h, '取消收藏').props['aria-pressed'], true);

  clickDetailToggle(h, '置顶');
  assert.equal(h.promptById('p-new').pinned, true);
  assert.equal(h.promptById('p-new').favorite, true);
  // The newly pinned prompt now leads the default order.
  assert.equal(listTitles(h)[0], '较新未置顶');

  // Un-favorite leaves pinned untouched.
  clickDetailToggle(h, '取消收藏');
  assert.equal(h.promptById('p-new').favorite, false);
  assert.equal(h.promptById('p-new').pinned, true);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 7. Sorting: rule text from explainSort + rating ordering rules     */
/* ------------------------------------------------------------------ */

test('sort select renders explainSort rule text and rating sorts keep unrated last', () => {
  const prompts = [
    seedPrompt({
      id: 'p-high',
      title: '高分提示',
      score: { stars: 5, note: '', ratedBodyVersion: 1, ratedAt: 1 },
    }),
    seedPrompt({
      id: 'p-low',
      title: '低分提示',
      score: { stars: 2, note: '', ratedBodyVersion: 1, ratedAt: 1 },
    }),
    seedPrompt({ id: 'p-none', title: '未评分提示' }),
  ];
  const h = seeded(prompts);
  h.renderPage();
  assert.match(h.text(), /排序规则：置顶优先 → 最近更新时间倒序/);

  setSort(h, 'ratingDesc');
  assert.match(h.text(), /有效评分优先，未评分与待复评/);
  assert.match(h.text(), /同分时置顶优先/);
  assert.deepEqual(listTitles(h), ['高分提示', '低分提示', '未评分提示']);

  setSort(h, 'ratingAsc');
  assert.deepEqual(listTitles(h), ['低分提示', '高分提示', '未评分提示']);

  // Changed sort is remembered through writeUiPrefs.
  const prefs = JSON.parse(h.storage.map.get(UI_KEY));
  assert.equal(prefs.sort, 'ratingAsc');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 8. Search + tag + quality combine; no results can be cleared        */
/* ------------------------------------------------------------------ */

test('search, tag and quality filters combine; empty results offer clear-filters', () => {
  const tags = [
    { id: 't1', name: '写作', order: 0 },
    { id: 't2', name: '代码', order: 1 },
  ];
  const prompts = [
    seedPrompt({ id: 'p1', title: '代码审查助手', body: '请审查代码', tagIds: ['t2'] }),
    seedPrompt({
      id: 'p2',
      title: '写作润色',
      body: '请润色文字',
      tagIds: ['t1'],
      score: { stars: 4.5, note: '', ratedBodyVersion: 1, ratedAt: 1 },
    }),
    seedPrompt({
      id: 'p3',
      title: '翻译助手',
      body: '请翻译内容',
      tagIds: [],
      score: { stars: 2, note: '', ratedBodyVersion: 1, ratedAt: 1 },
      lastUsedAt: 1700000000100,
    }),
  ];
  const h = seeded(prompts, tags);
  h.renderPage();

  // Search across tags/title/body.
  h.change(h.findInput('search'), '润色');
  assert.deepEqual(listTitles(h), ['写作润色']);
  h.change(h.findInput('search'), '');

  // Tag node filters.
  h.clickButton(tr(h, 'full.nav.tagAria', { name: '代码' }));
  assert.deepEqual(listTitles(h), ['代码审查助手']);

  // Quality filter combines with the tag.
  h.clickButton('4 星及以上');
  assert.deepEqual(listTitles(h), []);
  assert.match(h.text(), /没有匹配的提示词/);
  assert.ok(findButton(h, '清除筛选'), 'no-results state offers clear filters');

  // Clear everything.
  clickLastButton(h, '清除筛选');
  assert.deepEqual(listTitles(h), ['代码审查助手', '写作润色', '翻译助手']);
  assert.equal(h.findInput('search').props.value, '');

  // View: recently used only contains used prompts.
  h.clickButton('最近使用');
  assert.deepEqual(listTitles(h), ['翻译助手']);

  // Quality unrated / stale are part of the same filter contract.
  h.clickButton('全部提示词');
  h.clickButton('未评分');
  assert.deepEqual(listTitles(h), ['代码审查助手']);
  h.clickButton('未评分');
  assert.deepEqual(listTitles(h), ['代码审查助手', '写作润色', '翻译助手']);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 9. Rating: half stars, clearing, note saving                       */
/* ------------------------------------------------------------------ */

test('rating accepts half stars, clears independently and keeps a separately saved note', () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  h.clickButton('代码审查助手');

  h.clickButton('4.5 星');
  let prompt = h.promptById('p-seed');
  assert.equal(prompt.score.stars, 4.5);
  assert.equal(prompt.score.ratedBodyVersion, 1);

  h.change(h.findTextarea('rating-note'), '日常很好用');
  h.clickButton('保存备注');
  prompt = h.promptById('p-seed');
  assert.equal(prompt.score.note, '日常很好用');
  assert.match(h.text(), /备注已保存/);

  // Clearing removes the stars but keeps the note (per data model).
  h.clickButton('清除评分');
  prompt = h.promptById('p-seed');
  assert.equal(prompt.score.stars, null);
  assert.equal(prompt.score.note, '日常很好用');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 10. Stale rating: kept but ineffective, "keep old rating" works    */
/* ------------------------------------------------------------------ */

test('a body change keeps the old rating visible as stale and "keep old rating" re-validates it', () => {
  const h = seeded([
    seedPrompt({
      id: 'p-stale',
      title: '待复评提示',
      body: '修改后的正文',
      bodyVersion: 2,
      score: { stars: 4, note: '旧备注', ratedBodyVersion: 1, ratedAt: 1 },
    }),
  ]);
  h.renderPage();
  h.clickButton('待复评提示');
  assert.match(h.text(), /待复评/);
  assert.match(h.text(), /正文已修改，旧评分不再参与排序与筛选/);
  // Old stars are still visible/kept, but not used for filtering.
  assert.equal(h.promptById('p-stale').score.stars, 4);
  h.clickButton('4 星及以上');
  assert.deepEqual(listTitles(h), []);
  h.clickButton('4 星及以上');

  h.clickButton('沿用原评分');
  const prompt = h.promptById('p-stale');
  assert.equal(prompt.score.stars, 4);
  assert.equal(prompt.score.ratedBodyVersion, 2);
  assert.equal(prompt.score.note, '旧备注');
  assert.doesNotMatch(h.text(), /旧评分不再参与排序与筛选/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 11. AI status: unavailable + retry                                 */
/* ------------------------------------------------------------------ */

test('AI section shows the fixed disclaimer, unavailable state and a working retry', async () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  await h.flush();
  h.clickButton('代码审查助手');
  assert.match(h.text(), /AI 评价仅供参考/);
  assert.match(h.text(), /AI 评价不可用/);
  assert.match(h.text(), /原因：NO_SERVICE/);
  const before = h.calls.fetch.filter((request) => request.url.includes('/ai/status')).length;
  h.clickButton('重试');
  await h.flush();
  const after = h.calls.fetch.filter((request) => request.url.includes('/ai/status')).length;
  assert.equal(after, before + 1, 'retry re-checks the AI service');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 12. AI review: attach with input snapshot, regenerate, delete      */
/* ------------------------------------------------------------------ */

test('AI review attaches the exact input snapshot, regenerating replaces it and delete asks first', async () => {
  const h = seeded([seedPrompt()]);
  let reviewCalls = 0;
  h.setFetch((request) => {
    if (request.url.includes('/ai/status')) return aiStatusResponse();
    if (request.url.includes('/ai/review')) {
      reviewCalls += 1;
      return {
        status: 200,
        body: {
          ok: true,
          review: {
            text: '第' + String(reviewCalls) + '次评价：目标清晰，建议补充输出格式。',
            provider: 'deepseek-account',
            model: 'deepseek-flash',
            generatedAt: 1700000000100,
            count: 24,
          },
        },
      };
    }
    return undefined;
  });
  h.renderPage();
  await h.flush();
  h.clickButton('代码审查助手');
  assert.match(h.text(), /将使用 deepseek-account \/ deepseek-flash/);
  assert.match(h.text(), /可能产生模型费用/);

  h.clickButton('AI 评价');
  await h.flush(8);
  let prompt = h.promptById('p-seed');
  assert.ok(prompt.aiReview, 'review attached');
  assert.match(prompt.aiReview.text, /第1次评价/);
  assert.deepEqual(prompt.aiReview.input, {
    title: prompt.title,
    body: prompt.body,
    usage: prompt.usage,
  });
  assert.match(h.text(), /第1次评价/);
  assert.match(h.text(), /模型：deepseek-flash/);
  assert.doesNotMatch(h.text(), /内容已修改，建议重新评价/);

  // Regenerate replaces the old review (only on success).
  h.clickButton('重新生成');
  await h.flush(8);
  prompt = h.promptById('p-seed');
  assert.match(prompt.aiReview.text, /第2次评价/);
  assert.equal(reviewCalls, 2);

  // Delete requires confirmation and only removes the AI review.
  h.clickButton('删除 AI 评价');
  assert.ok(hasDialog(h));
  assert.match(h.text(), /将删除这条提示词的 AI 评价/);
  h.clickButton('删除评价');
  await h.flush();
  assert.equal(h.promptById('p-seed').aiReview, null);
  assert.equal(h.promptById('p-seed').score.stars, null, 'personal rating untouched');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 13. AI review: generating state prevents duplicate requests        */
/* ------------------------------------------------------------------ */

test('AI generating state shows loading and ignores duplicate clicks', async () => {
  const h = seeded([seedPrompt()]);
  let releaseReview;
  const gate = new Promise((resolve) => {
    releaseReview = resolve;
  });
  h.setFetch((request) => {
    if (request.url.includes('/ai/status')) return aiStatusResponse();
    if (request.url.includes('/ai/review')) return { status: 200, body: gate };
    return undefined;
  });
  h.renderPage();
  await h.flush();
  h.clickButton('代码审查助手');
  const reviewFetchCount = () => h.calls.fetch.filter((request) => request.url.includes('/ai/review')).length;

  h.clickButton('AI 评价');
  await h.flush(2);
  assert.equal(reviewFetchCount(), 1);
  assert.match(h.text(), /正在生成 AI 评价/);
  const generatingButton = findButton(h, tr(h, 'full.ai.generating'));
  assert.ok(generatingButton, 'loading label replaces the button text');
  assert.equal(generatingButton.props.disabled, true);
  // Duplicate click is ignored by the guard.
  clickNode(h, generatingButton);
  assert.equal(reviewFetchCount(), 1);

  releaseReview({
    ok: true,
    review: { text: '迟到的评价', provider: 'p', model: 'm', generatedAt: 1, count: 5 },
  });
  await h.flush(6);
  assert.match(h.promptById('p-seed').aiReview.text, /迟到的评价/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 14. AI review: failure keeps the old review and reports the code   */
/* ------------------------------------------------------------------ */

test('a failed AI request keeps the old review and surfaces the error code', async () => {
  const oldReview = {
    text: '旧评价内容：结构清楚。',
    provider: 'deepseek-account',
    model: 'deepseek-flash',
    generatedAt: 1700000000000,
    input: {
      title: '代码审查助手',
      body: '请审查以下代码，重点关注边界条件与错误处理。',
      usage: '代码审查',
    },
  };
  const h = seeded([seedPrompt({ aiReview: oldReview })]);
  h.setFetch((request) => {
    if (request.url.includes('/ai/status')) return aiStatusResponse();
    if (request.url.includes('/ai/review')) {
      return { status: 502, body: { ok: false, code: 'BUSY', message: 'too many' } };
    }
    return undefined;
  });
  h.renderPage();
  await h.flush();
  h.clickButton('代码审查助手');
  h.clickButton('重新生成');
  await h.flush(8);
  const prompt = h.promptById('p-seed');
  assert.equal(prompt.aiReview.text, oldReview.text, 'old review survives a failure');
  assert.match(h.text(), /AI 评价失败/);
  assert.match(h.text(), /BUSY/);
  assert.match(h.text(), /旧评价内容/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 15. AI staleness marker for changed content                        */
/* ------------------------------------------------------------------ */

test('an AI review made against older content is marked as stale', async () => {
  const h = seeded([
    seedPrompt({
      id: 'p-ai-stale',
      title: '已改正文',
      body: '新正文',
      aiReview: {
        text: '针对旧正文的评价。',
        provider: 'deepseek-account',
        model: 'deepseek-flash',
        generatedAt: 1700000000000,
        input: { title: '已改正文', body: '旧正文', usage: '代码审查' },
      },
    }),
  ]);
  h.aiHandlers();
  h.renderPage();
  await h.flush();
  h.clickButton('已改正文');
  assert.match(h.text(), /内容已修改，建议重新评价/);
  assert.match(h.text(), /针对旧正文的评价/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 16. Editor AI review: attach only when content is unchanged        */
/* ------------------------------------------------------------------ */

test('editor AI review is attached on save only when the saved content matches the reviewed draft', async () => {
  // Same content on save -> attached.
  const h = harness();
  h.aiHandlers();
  h.renderPage();
  await h.flush();
  h.clickButton('新建提示词');
  h.change(h.findInput('title'), '草稿评价');
  h.change(h.findTextarea('body'), '原始正文');
  h.clickButton('AI 评价');
  await h.flush(8);
  assert.match(h.text(), /整体目标清晰/);
  h.clickButton('保存');
  await h.flush(8);
  let prompt = h.prompts()[0];
  assert.ok(prompt && prompt.aiReview, 'unchanged draft review is attached on save');
  assert.equal(prompt.aiReview.input.body, '原始正文');
  h.dispose();

  // Content edited after the review -> not attached, explicit notice.
  const h2 = harness();
  h2.aiHandlers();
  h2.renderPage();
  await h2.flush();
  h2.clickButton('新建提示词');
  h2.change(h2.findInput('title'), '草稿已过期');
  h2.change(h2.findTextarea('body'), '评价时的正文');
  h2.clickButton('AI 评价');
  await h2.flush(8);
  h2.change(h2.findTextarea('body'), '保存时的不同正文');
  h2.clickButton('保存');
  await h2.flush(8);
  const saved = h2.prompts()[0];
  assert.ok(saved, 'prompt saved');
  assert.equal(saved.aiReview, null, 'stale review is not associated');
  assert.match(h2.text(), /评价针对修改前的内容，未关联/);
  h2.dispose();
});

/* ------------------------------------------------------------------ */
/* 17. Copy: success marks used, failure does not                     */
/* ------------------------------------------------------------------ */

test('copying marks the prompt as used and shows the rate-after-use entry; failure does not', async () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  h.clickButton('代码审查助手');
  h.clickButton('复制正文');
  await h.flush();
  assert.deepEqual(h.calls.copies, [seedPrompt().body]);
  assert.equal(h.promptById('p-seed').useCount, 1);
  assert.equal(typeof h.promptById('p-seed').lastUsedAt, 'number');
  assert.match(h.text(), /刚复制过正文/);
  h.clickButton('5 星');
  assert.equal(h.promptById('p-seed').score.stars, 5);
  h.dispose();

  // Clipboard denied (and execCommand fallback false) -> no usage counted.
  const h2 = seeded([seedPrompt()]);
  globalThis.navigator.clipboard.writeText = async () => {
    throw new Error('denied');
  };
  h2.document.execCommand = () => false;
  h2.renderPage();
  h2.clickButton('代码审查助手');
  h2.clickButton('复制正文');
  await h2.flush();
  assert.equal(h2.promptById('p-seed').useCount, 0);
  assert.equal(h2.promptById('p-seed').lastUsedAt, null);
  assert.match(h2.text(), /复制失败/);
  assert.doesNotMatch(h2.text(), /刚复制过正文/);
  h2.dispose();
});

/* ------------------------------------------------------------------ */
/* 18. CSV import: preview, invalid rows, apply                       */
/* ------------------------------------------------------------------ */

test('CSV import previews new/duplicate/invalid rows and applies only after confirmation', async () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  h.clickButton('导入');
  assert.match(h.text(), /字段说明/);
  assert.match(h.text(), /CSV 用于交换，JSON 用于完整备份/);

  const csv = [
    'title,body,tags,usage,rating,note',
    '新提示词,"第一行\n第二行","[""写作"",""营销""]",场景,4.5,不错',
    '代码审查助手,请审查以下代码，重点关注边界条件与错误处理。,,, ,',
    '坏评分提示,正文,,,4.3,',
    '',
  ].join('\n');
  uploadImportFile(h, 'import.csv', csv);
  await h.flush(6);
  assert.match(h.text(), /CSV 导入预览/);
  assert.match(h.text(), /新增 1/);
  assert.match(h.text(), /重复跳过 1/);
  assert.match(h.text(), /无效 1/);
  assert.match(h.text(), /将新建标签 2/);
  assert.match(h.text(), /评分必须是 1~5 之间 0.5 的倍数/);
  assert.equal(h.prompts().length, 1, 'preview must not write');

  h.clickButton('确认导入');
  await h.flush(6);
  const data = h.data();
  assert.equal(data.prompts.length, 2);
  const imported = data.prompts.find((prompt) => prompt.title === '新提示词');
  assert.ok(imported, 'new prompt imported');
  assert.match(imported.body, /第一行\n第二行/);
  assert.deepEqual(data.tags.map((tag) => tag.name), ['写作', '营销']);
  assert.equal(imported.score.stars, 4.5);
  assert.equal(imported.score.ratedBodyVersion, null, 'CSV rating starts as needs-re-rating');
  assert.match(h.text(), /已导入 1 条提示词，新建 2 个标签/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 19. JSON import: merge, replace confirmation, invalid JSON         */
/* ------------------------------------------------------------------ */

test('JSON import merges, requires a second confirmation for replace, and rejects invalid JSON', async () => {
  const incomingPrompt = seedPrompt({ id: 'p-incoming', title: '导入的提示词', body: '导入正文' });
  const incomingBackup = {
    format: 'dsh-prompt-library-backup',
    version: 1,
    exportedAt: 1700000000000,
    app: 'dsh-prompt-library',
    appVersion: '1.0.0',
    data: {
      version: 1,
      tags: [{ id: 't-incoming', name: '导入标签', order: 0 }],
      prompts: [incomingPrompt],
    },
  };
  const h = seeded([seedPrompt()]);
  h.renderPage();
  h.clickButton('导入');
  uploadImportFile(h, 'backup.json', JSON.stringify(incomingBackup));
  await h.flush(6);
  assert.match(h.text(), /JSON 导入预览/);
  assert.match(h.text(), /新增 1/);
  h.clickButton('确认导入');
  await h.flush(6);
  assert.equal(h.prompts().length, 2);
  assert.match(h.text(), /已合并导入：新增 1 条/);

  // Replace mode: preview counts current data, then an explicit destructive confirm.
  h.clickButton('导入');
  uploadImportFile(h, 'backup.json', JSON.stringify(incomingBackup));
  await h.flush(6);
  h.clickButton('替换');
  await h.flush(4);
  assert.match(h.text(), /将替换现有 2 条提示词/);
  h.clickButton('确认导入');
  assert.ok(hasDialog(h));
  assert.match(h.text(), /替换导入会先删除现有全部提示词与标签/);
  h.clickButton('删除现有数据并导入');
  await h.flush(6);
  assert.deepEqual(h.prompts().map((prompt) => prompt.title), ['导入的提示词']);
  assert.deepEqual(h.tags().map((tag) => tag.name), ['导入标签']);

  // Invalid JSON is reported and leaves data untouched.
  h.clickButton('导入');
  uploadImportFile(h, 'broken.json', '{not valid json');
  await h.flush(4);
  assert.match(h.text(), /不是合法的 JSON/);
  assert.equal(h.prompts().length, 1);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 20. Export menu: JSON backup / CSV / template downloads            */
/* ------------------------------------------------------------------ */

test('export menu downloads a dated JSON backup, the CSV and the CSV template', async () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  const downloadsBefore = h.download().length;

  h.clickButton('导出');
  assert.match(h.text(), /JSON 完整备份/);
  assert.match(h.text(), /含标签、评分与 AI 评价版本关联/);
  h.clickButton('JSON 完整备份');
  const jsonText = await lastDownloadText();
  const jsonName = h.download()[downloadsBefore].filename;
  assert.match(jsonName, /^prompt-library-backup-\d{8}\.json$/);
  const backup = JSON.parse(jsonText);
  assert.equal(backup.format, 'dsh-prompt-library-backup');
  assert.equal(backup.data.prompts.length, 1);
  assert.equal(backup.data.prompts[0].title, '代码审查助手');

  h.clickButton('导出');
  h.clickButton('导出 CSV');
  const csvText = await lastDownloadText();
  const csvName = h.download()[h.download().length - 1].filename;
  assert.match(csvName, /^prompt-library-\d{8}\.csv$/);
  assert.match(csvText, /^title,body,tags,usage,rating,note,organize,sourceNote\r?\n/);
  assert.match(csvText, /代码审查助手/);

  h.clickButton('导出');
  h.clickButton('CSV 模板');
  const templateText = await lastDownloadText();
  assert.equal(templateText, 'title,body,tags,usage,rating,note,organize,sourceNote\n');
  assert.equal(h.download()[h.download().length - 1].filename, 'prompt-library-template.csv');
  assert.equal(h.download().length, downloadsBefore + 3);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 21. Share: title + body only; clipboard download entry points      */
/* ------------------------------------------------------------------ */

test('share dialog copies/downloads only the title and body, never notes or AI reviews', async () => {
  const h = seeded([
    seedPrompt({
      score: { stars: 4, note: '私人备注不应分享', ratedBodyVersion: 1, ratedAt: 1 },
      aiReview: {
        text: 'AI 评价文本不应分享',
        provider: 'deepseek-account',
        model: 'deepseek-flash',
        generatedAt: 1700000000000,
        input: { title: '代码审查助手', body: seedPrompt().body, usage: '代码审查' },
      },
    }),
  ]);
  h.renderPage();
  h.clickButton('代码审查助手');
  h.clickButton('分享');
  assert.match(h.text(), /分享内容只包含标题与正文/);
  assert.match(h.text(), /不包含个人评分备注或 AI 评价/);

  h.clickButton('下载 .md');
  const mdText = await lastDownloadText();
  assert.match(mdText, /# 代码审查助手/);
  assert.match(mdText, /请审查以下代码/);
  assert.doesNotMatch(mdText, /私人备注不应分享/);
  assert.doesNotMatch(mdText, /AI 评价文本不应分享/);
  assert.match(h.download()[h.download().length - 1].filename, /\.md$/);

  h.clickButton('下载 .txt');
  const txtText = await lastDownloadText();
  assert.match(txtText, /^代码审查助手\n\n请审查以下代码/);
  assert.doesNotMatch(txtText, /私人备注不应分享/);
  assert.match(h.download()[h.download().length - 1].filename, /\.txt$/);

  // The share dialog also offers a copy button (the last "复制正文" in the tree).
  clickLastButton(h, '复制正文');
  await h.flush();
  assert.deepEqual(h.calls.copies, [seedPrompt().body]);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 22. Corrupt storage: warning, raw download, explicit reset         */
/* ------------------------------------------------------------------ */

test('corrupt data shows a warning, downloads the raw text and only resets after confirmation', async () => {
  const raw = '{"version":1,"prompts":[{"id":"broken"';
  const h = harness({ storage: { [DATA_KEY]: raw } });
  h.renderPage();
  await h.flush();
  assert.match(h.text(), /本地提示词数据已损坏/);
  assert.equal(h.storage.map.get(DATA_KEY), raw, 'raw corrupted data is preserved');

  h.clickButton('下载原始数据');
  assert.equal(h.download()[0].filename, 'prompt-library-raw.txt');
  assert.equal(await lastDownloadText(), raw);

  h.clickButton('重置为空数据库');
  assert.ok(hasDialog(h));
  assert.match(h.text(), /此操作不可恢复/);
  h.clickButton('重置数据库');
  await h.flush(4);
  assert.deepEqual(h.data(), { version: 1, tags: [], prompts: [] });
  assert.doesNotMatch(h.text(), /本地提示词数据已损坏/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 23. Storage write failure: draft + old data preserved, retry works */
/* ------------------------------------------------------------------ */

test('a failed save keeps the editor draft and the stored data, and a retry succeeds', async () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  h.clickButton('代码审查助手');
  h.clickButton('编辑');
  h.change(h.findInput('title'), '保存失败也要保留');
  h.setStorageFailure(true);
  h.clickButton('保存');
  await h.flush(4);
  assert.ok(hasDialog(h), 'editor stays open on failure');
  assert.equal(h.findInput('title').props.value, '保存失败也要保留');
  assert.match(h.text(), /保存失败/);
  assert.match(h.text(), /浏览器存储空间不足/);
  assert.equal(h.prompts()[0].title, '代码审查助手', 'old data untouched');
  assert.equal(h.prompts()[0].title, h.promptById('p-seed').title);

  h.setStorageFailure(false);
  h.clickButton('保存');
  await h.flush(4);
  assert.equal(hasDialog(h), false);
  assert.equal(h.promptById('p-seed').title, '保存失败也要保留');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 24. Narrow layout: list step then detail step with back button     */
/* ------------------------------------------------------------------ */

test('narrow layout shows list then detail as steps and offers a back-to-list button', async () => {
  const h = seeded([seedPrompt()], [], { width: 700 });
  h.renderPage();
  await h.flush();
  assert.ok(listTitles(h).includes('代码审查助手'), 'narrow list is shown');
  assert.doesNotMatch(h.text(), /已使用 0 次/);
  assert.doesNotMatch(h.text(), /从列表中选择提示词查看详情/);

  h.clickButton('代码审查助手');
  assert.match(h.text(), /返回列表/);
  assert.match(h.text(), /已使用 0 次/);
  // Only the detail step is rendered: navigation/filter column is hidden.
  assert.doesNotMatch(h.text(), /质量筛选/);

  h.clickButton('返回列表');
  assert.ok(listTitles(h).includes('代码审查助手'));
  assert.match(h.text(), /质量筛选/);
  assert.doesNotMatch(h.text(), /返回列表/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 25. UI preferences: persisted, restored, corrupt values tolerated  */
/* ------------------------------------------------------------------ */

test('filter preferences are written to writeUiPrefs and restored on the next mount', () => {
  const prompts = [
    seedPrompt({ id: 'p1', title: '带标签提示', tagIds: ['t1'] }),
    seedPrompt({ id: 'p2', title: '另一个提示' }),
  ];
  const tags = [{ id: 't1', name: '筛选标签', order: 0 }];
  const h = seeded(prompts, tags);
  h.renderPage();
  h.change(h.findInput('search'), '提示');
  h.clickButton(tr(h, 'full.nav.tagAria', { name: '筛选标签' }));
  setSort(h, 'ratingDesc');
  const rawPrefs = h.storage.map.get(UI_KEY);
  assert.ok(rawPrefs, 'preferences written');
  const prefs = JSON.parse(rawPrefs);
  assert.equal(prefs.search, '提示');
  assert.equal(prefs.tagId, 't1');
  assert.equal(prefs.sort, 'ratingDesc');
  h.dispose();

  // A fresh mount restores search + tag + sort.
  const h2 = seeded(prompts, tags, { storage: { [UI_KEY]: rawPrefs } });
  h2.renderPage();
  assert.equal(h2.findInput('search').props.value, '提示');
  const sortSelect = h2.all('select').find((node) => node.props['aria-label'] === 'sort');
  assert.equal(sortSelect.props.value, 'ratingDesc');
  const pressedTag = h2.all('button').find(
    (node) => node.props['aria-label'] === tr(h2, 'full.nav.tagAria', { name: '筛选标签' }),
  );
  assert.equal(pressedTag.props['aria-pressed'], true);
  assert.deepEqual(listTitles(h2), ['带标签提示']);
  h2.dispose();

  // Invalid preferences are ignored instead of breaking the panel.
  const h3 = harness({ storage: { [UI_KEY]: '{"view":42,"quality":"nope","sort":"bogus"}' } });
  h3.renderPage();
  assert.equal(h3.findInput('search').props.value, '');
  const sortSelect3 = h3.all('select').find((node) => node.props['aria-label'] === 'sort');
  assert.equal(sortSelect3.props.value, 'default');
  h3.dispose();
});

/* ------------------------------------------------------------------ */
/* 26. Editing the body invalidates the rating end-to-end              */
/* ------------------------------------------------------------------ */

test('editing the prompt body keeps the old rating but marks it stale in the detail pane', () => {
  const h = seeded([
    seedPrompt({
      score: { stars: 5, note: '很好', ratedBodyVersion: 1, ratedAt: 1 },
    }),
  ]);
  h.renderPage();
  h.clickButton('代码审查助手');
  assert.doesNotMatch(h.text(), /正文已修改，旧评分不再参与排序与筛选/);

  h.clickButton('编辑');
  h.change(h.findTextarea('body'), '修改后的正文');
  h.clickButton('保存');
  const prompt = h.promptById('p-seed');
  assert.equal(prompt.bodyVersion, 2);
  assert.equal(prompt.body, '修改后的正文');
  assert.equal(prompt.score.stars, 5, 'old stars are kept');
  assert.equal(prompt.score.ratedBodyVersion, 1, 'and stay associated with the old version');
  assert.match(h.text(), /待复评/);
  assert.match(h.text(), /正文已修改，旧评分不再参与排序与筛选/);
  // The old rating is visible, and can be re-validated.
  h.clickButton('沿用原评分');
  assert.equal(h.promptById('p-seed').score.ratedBodyVersion, 2);
  assert.doesNotMatch(h.text(), /正文已修改，旧评分不再参与排序与筛选/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 27. Accessibility: every rendered control is a type=button button  */
/* ------------------------------------------------------------------ */

test('all interactive buttons rendered by the panel are type="button" with accessible names', () => {
  const h = seeded([seedPrompt()], [{ id: 't1', name: '写作', order: 0 }]);
  h.renderPage();
  h.clickButton('代码审查助手');
  const assertButtons = (where) => {
    const buttons = h.all('button');
    assert.ok(buttons.length > 0, 'buttons rendered in ' + where);
    for (const node of buttons) {
      assert.equal(node.props.type, 'button', 'non-submit button in ' + where);
      const name = String(node.props['aria-label'] || '') + '|' + h.text(node).trim();
      assert.ok(name.replace('|', '').trim().length > 0, 'button has an accessible name in ' + where);
    }
  };
  assertButtons('panel+detail');
  h.clickButton('编辑');
  assertButtons('editor');
  h.clickButton('取消');
  h.clickButton('标签管理');
  assertButtons('tag manager');
  h.clickButton('关闭');
  h.clickButton('分享');
  assertButtons('share dialog');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 26. Escape closes plain modals; language switch re-renders          */
/* ------------------------------------------------------------------ */

test('Escape closes a clean modal, and switching the locale re-renders the panel in English', () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();

  h.clickButton('新建提示词');
  assert.ok(hasDialog(h));
  h.pressEscape();
  assert.equal(hasDialog(h), false, 'clean editor closes with Escape');
  assert.equal(h.storage.map.get(DATA_KEY), JSON.stringify({ version: 1, tags: [], prompts: [seedPrompt()] }));

  h.clickButton('标签管理');
  assert.ok(hasDialog(h));
  h.pressEscape();
  assert.equal(hasDialog(h), false, 'tag manager closes with Escape');

  h.setLanguage('en');
  const text = h.text();
  assert.match(text, /Prompt Library/);
  assert.match(text, /New prompt/);
  assert.match(text, /Local-first/);
  assert.equal(h.findInput('search').props.placeholder, 'Search title, text or tags');
  assert.doesNotMatch(text, /欢迎使用/);
  assert.equal(tr(h, 'full.sort.label'), 'Sort');
  h.setLanguage('zh');
  assert.match(h.text(), /提示库/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 29. Quick capture: inbox navigation, count and filtering            */
/* ------------------------------------------------------------------ */

test('inbox navigation shows the unorganized count, filters the list and keeps the badge', () => {
  const h = seeded([
    seedPrompt({
      id: 'p-inbox',
      title: '待整理提示',
      organize: 'inbox',
      capture: { kind: 'paste', at: 1700000000100 },
    }),
    seedPrompt({ id: 'p-organized', title: '已整理提示' }),
  ]);
  h.renderPage();
  assert.deepEqual(listTitles(h).sort(), ['已整理提示', '待整理提示'].sort());
  assert.match(h.text(), /收件箱（1）/);

  const inboxNav = navItemByAria(h, tr(h, 'full.nav.inboxAria', { count: 1 }));
  assert.ok(inboxNav, 'inbox nav item carries the count');
  clickNode(h, inboxNav);
  assert.deepEqual(listTitles(h), ['待整理提示'], 'inbox view only lists unorganized prompts');
  assert.equal(navItemByAria(h, tr(h, 'full.nav.inboxAria', { count: 1 })).props['aria-pressed'], true);
  const item = h
    .all('button')
    .find((node) => String(node.props.className || '').includes('pl-list-item'));
  assert.ok(item, 'inbox item rendered');
  assert.match(h.text(item), /待整理/, 'list item shows the to-organize badge');

  // Other filters still combine with the inbox view.
  h.clickButton(tr(h, 'full.nav.favorites'));
  assert.equal(listTitles(h).length, 0);
  assert.match(h.text(), /没有匹配的提示词/);
  h.dispose();
});

test('an empty inbox shows its own empty copy and a zero count', () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  assert.match(h.text(), /收件箱（0）/);
  const inboxNav = navItemByAria(h, tr(h, 'full.nav.inboxAria', { count: 0 }));
  assert.ok(inboxNav, 'zero count is rendered');
  clickNode(h, inboxNav);
  assert.match(h.text(), /收件箱是空的/);
  assert.match(h.text(), /快速收录的提示词会先进入收件箱/);
  assert.equal(listTitles(h).length, 0);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 30. Organization status: badge, toggle, persistence, failures      */
/* ------------------------------------------------------------------ */

test('detail shows the inbox badge and moves prompts between inbox and organized without touching updatedAt', () => {
  const h = seeded([
    seedPrompt({
      id: 'p-inbox',
      title: '待整理提示',
      organize: 'inbox',
      updatedAt: 1700000000000,
      capture: { kind: 'paste', at: 1700000000100 },
    }),
  ]);
  h.renderPage();
  h.clickButton('待整理提示');
  assert.match(h.text(), /整理状态/);
  assert.match(h.text(), /当前状态：待整理/);
  assert.match(h.text(), /待整理/);
  assert.match(h.text(), /标记整理完成/);

  h.clickButton('标记整理完成');
  const organized = h.promptById('p-inbox');
  assert.equal(organized.organize, 'organized');
  assert.equal(organized.updatedAt, 1700000000000, 'organization change must not refresh updatedAt');
  assert.equal(organized.bodyVersion, 1);
  assert.match(h.text(), /已标记为整理完成/);
  assert.match(h.text(), /当前状态：已整理/);
  assert.match(h.text(), /重新移回收件箱/);
  assert.match(h.text(), /收件箱（0）/);

  h.clickButton('重新移回收件箱');
  const back = h.promptById('p-inbox');
  assert.equal(back.organize, 'inbox');
  assert.equal(back.updatedAt, 1700000000000);
  assert.match(h.text(), /已移回收件箱/);
  assert.match(h.text(), /当前状态：待整理/);
  assert.match(h.text(), /收件箱（1）/);
  h.dispose();
});

test('a failed organization write keeps the stored status and surfaces the error', () => {
  const h = seeded([
    seedPrompt({ id: 'p-inbox', title: '待整理提示', organize: 'inbox' }),
  ]);
  h.renderPage();
  h.clickButton('待整理提示');
  h.setStorageFailure(true);
  h.clickButton('标记整理完成');
  assert.match(h.text(), /整理状态更新失败/);
  assert.match(h.text(), /浏览器存储空间不足/);
  assert.equal(h.promptById('p-inbox').organize, 'inbox', 'failed write leaves storage untouched');

  h.setStorageFailure(false);
  h.clickButton('标记整理完成');
  assert.equal(h.promptById('p-inbox').organize, 'organized');
  assert.match(h.text(), /已标记为整理完成/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 31. Capture source metadata and source-session jump                */
/* ------------------------------------------------------------------ */

test('detail shows capture source metadata and reports a failed source-session jump', () => {
  const h = seeded([
    seedPrompt({
      id: 'p-captured',
      title: '收录的提示词',
      organize: 'inbox',
      capture: {
        kind: 'composer',
        at: 1700000000100,
        sessionId: 'session-9',
        note: '来自输入框草稿',
      },
    }),
  ]);
  h.renderPage();
  h.clickButton('收录的提示词');
  const text = h.text();
  assert.match(text, /来源信息/);
  assert.match(text, /来源：输入框草稿/);
  assert.match(text, /收录时间：/);
  assert.match(text, /来源说明：来自输入框草稿/);
  assert.match(text, /打开来源会话/);

  // The real injected openSession throws when uiWorkspace is unavailable.
  h.clickButton('打开来源会话');
  assert.match(h.text(), /当前环境不支持打开来源会话/);
  // The body and stored data are unaffected by the failed jump.
  assert.match(h.text(), /请审查以下代码/);
  assert.equal(h.promptById('p-captured').capture.sessionId, 'session-9');
  h.dispose();
});

test('a throwing openSession shows a failure notice and leaves the prompt intact', () => {
  const h = seeded([
    seedPrompt({
      id: 'p-captured',
      title: '收录的提示词',
      organize: 'inbox',
      capture: { kind: 'paste', at: 1700000000100, sessionId: 'session-1' },
    }),
  ]);
  h.renderPage({
    openSession: () => {
      throw new Error('boom-42');
    },
  });
  h.clickButton('收录的提示词');
  h.clickButton('打开来源会话');
  assert.match(h.text(), /打开来源会话失败：boom-42/);
  assert.match(h.text(), /请审查以下代码/, 'detail stays rendered');
  h.dispose();
});

test('a chat-message capture explains that no exact message jump is offered', () => {
  const h = seeded([
    seedPrompt({
      id: 'p-msg',
      title: '对话收录',
      organize: 'inbox',
      capture: { kind: 'message', at: 1700000000100, messageId: 'msg-1' },
    }),
  ]);
  h.renderPage();
  h.clickButton('对话收录');
  assert.match(h.text(), /来源：对话消息/);
  assert.match(h.text(), /当前接口不支持定位到原消息/);
  assert.equal(buttonByText(h, tr(h, 'full.capture.openSession')), undefined);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 32. Header quick-capture entry                                     */
/* ------------------------------------------------------------------ */

test('the header quick-capture button opens the hub with an empty paste source', () => {
  const calls = [];
  const h = seeded([seedPrompt()]);
  h.renderPage({
    capture: {
      open(payload) {
        calls.push(payload);
        return true;
      },
    },
  });
  const button = buttonByText(h, tr(h, 'full.capture.open'));
  assert.ok(button, 'quick-capture button rendered');
  assert.notEqual(button.props.disabled, true);
  assert.equal(button.props.title, tr(h, 'full.capture.openHint'));
  clickNode(h, button);
  assert.deepEqual(calls, [{ text: '', source: { kind: 'paste' } }]);
  h.dispose();
});

test('a capture hub failure is surfaced without touching the library', () => {
  const h = seeded([seedPrompt()]);
  h.renderPage({
    capture: {
      open() {
        throw new Error('capture-broken');
      },
    },
  });
  h.clickButton(tr(h, 'full.capture.open'));
  assert.match(h.text(), /快速收录打开失败：capture-broken/);
  assert.deepEqual(h.prompts().map((prompt) => prompt.title), ['代码审查助手']);
  h.dispose();
});

test('without a capture hub the quick-capture button is disabled and explains why', () => {
  const h = seeded([seedPrompt()]);
  h.renderPage({ capture: null });
  const button = buttonByText(h, tr(h, 'full.capture.open'));
  assert.ok(button, 'quick-capture button rendered');
  assert.equal(button.props.disabled, true);
  assert.equal(button.props['aria-disabled'], 'true');
  assert.equal(button.props.title, tr(h, 'full.capture.unavailable'));
  clickNode(h, button);
  assert.equal(h.storage.map.size, 1, 'a disabled capture entry writes nothing');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 33. Focus requests from the capture dialog                         */
/* ------------------------------------------------------------------ */

test('a focus request selects the prompt, returns to all prompts and clears every filter', () => {
  const prompts = [
    seedPrompt({ id: 'p-one', title: '第一条提示', tagIds: ['t1'] }),
    seedPrompt({ id: 'p-two', title: '第二条提示' }),
  ];
  const tags = [{ id: 't1', name: '筛选标签', order: 0 }];
  const focus = makeFocusStore();
  const h = seeded(prompts, tags);
  h.renderPage({ focus });
  h.change(h.findInput('search'), '不存在的词');
  h.clickButton(tr(h, 'full.nav.tagAria', { name: '筛选标签' }));
  h.clickButton(tr(h, 'full.nav.rated4'));
  assert.equal(h.findInput('search').props.value, '不存在的词');

  focus.request('p-two');
  h.render();
  assert.equal(focus.current(), null, 'the focus request is consumed exactly once');
  assert.equal(h.findInput('search').props.value, '', 'search is cleared');
  const allNav = h.all('button').find(
    (node) =>
      String(node.props.className || '').includes('pl-nav-item') &&
      h.text(node).trim() === tr(h, 'full.nav.all'),
  );
  assert.equal(allNav.props['aria-pressed'], true, 'view returns to all prompts');
  assert.equal(
    navItemByAria(h, tr(h, 'full.nav.tagAria', { name: '筛选标签' })).props['aria-pressed'],
    false,
    'tag filter is cleared',
  );
  const rated4 = buttonByText(h, tr(h, 'full.nav.rated4'));
  assert.equal(rated4.props['aria-pressed'], false, 'quality filter is cleared');
  assert.match(h.text(), /第二条提示/, 'requested prompt is selected');
  assert.match(h.text(), /已使用 0 次/);
  h.dispose();
});

test('a focus request for a missing prompt shows a notice instead of a broken detail', () => {
  const focus = makeFocusStore();
  const h = seeded([seedPrompt()]);
  h.renderPage({ focus });
  focus.request('deleted-id');
  h.render();
  assert.match(h.text(), /要查看的提示词不存在或已被删除/);
  assert.equal(focus.current(), null);
  assert.match(h.text(), /从列表中选择提示词查看详情/, 'no broken detail is rendered');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 34. Import field guide covers the new capture columns              */
/* ------------------------------------------------------------------ */

test('the import field guide documents the organize and sourceNote columns', () => {
  const h = seeded([seedPrompt()]);
  h.renderPage();
  h.clickButton('导入');
  const text = h.text();
  assert.match(text, /organize/);
  assert.match(text, /sourceNote/);
  assert.match(text, /CSV 列：title、body、tags、usage、rating、note、organize、sourceNote/);
  assert.match(text, /整理状态/);
  assert.match(text, /来源说明/);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 35. Capture dictionary parity                                       */
/* ------------------------------------------------------------------ */

test('capture, inbox and organization dictionary entries keep zh/en parity', () => {
  const h = harness();
  h.renderPage();
  const prefixes = ['full.inbox.', 'full.organize.', 'full.capture.'];
  const pick = (lang) =>
    Object.keys(h.dictionaries[lang])
      .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
      .sort();
  const zh = pick('zh');
  const en = pick('en');
  assert.deepEqual(zh, en, 'capture-related zh/en key sets must be identical');
  assert.ok(zh.length >= 20, 'capture feature has a meaningful dictionary surface');
  for (const key of zh) {
    assert.ok(h.dictionaries.zh[key].length > 0, key + ' has zh text');
    assert.ok(h.dictionaries.en[key].length > 0, key + ' has en text');
  }
  assert.notEqual(
    h.dictionaries.zh['full.organize.markDone'],
    h.dictionaries.en['full.organize.markDone'],
  );
  h.dispose();
});
