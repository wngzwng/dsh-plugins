/*
 * Prompt Library — composer quick picker (owner: quick-ui).
 *
 * Drives the real `PromptLibraryQuickEntry` component tree from the built
 * `client.js` through the shared harness: entry button a11y, quick-access
 * sections, search, preview, copy/insert semantics, after-use rating,
 * session-switch safety, empty/no-result states and zh/en parity.
 *
 * Quick-capture entries (DESIGN.md §9.3): the composer `存草稿` entry, the
 * conversation-selection `收录为提示词` action, and the quick-picker toolbar
 * entries. Those components run in real slot registrations, so the tests use
 * `h.renderSlot(...)` and inspect the shared capture hub exactly as the
 * overlay does; entry components never mutate the draft, submit or use the
 * clipboard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { harness } from './helpers/prompt-library-harness.js';

const DATA_KEY = 'dsh-prompt-library/v1';
const T0 = 1700000000000;

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function makePrompt(overrides) {
  return {
    title: 'untitled',
    body: 'body',
    usage: '',
    tagIds: [],
    favorite: false,
    pinned: false,
    createdAt: T0,
    updatedAt: T0,
    bodyVersion: 1,
    score: { stars: null, note: '', ratedBodyVersion: null, ratedAt: null },
    lastUsedAt: null,
    useCount: 0,
    aiReview: null,
    ...overrides,
  };
}

const PINNED_BODY = '请润色下面的文字：\n保持原意，输出中文。';
const FAV_BODY = '请审查以下代码并指出潜在的安全与性能问题。';
const RECENT_BODY = '你是一名商务写作助理，请用专业而简洁的语气写一封回复邮件。';
const PLAIN_BODY = '把下面内容翻译成英文，只输出译文，不要解释。';
const EN_BODY = 'Summarize the meeting notes into decisions, owners and deadlines.';

function seedData() {
  return {
    version: 1,
    tags: [
      { id: 'tag-writing', name: '写作', order: 0 },
      { id: 'tag-code', name: '代码', order: 1 },
    ],
    prompts: [
      makePrompt({
        id: 'p-pinned',
        title: '润色置顶',
        body: PINNED_BODY,
        usage: '日常润色',
        tagIds: ['tag-writing'],
        pinned: true,
        updatedAt: T0 + 300,
      }),
      makePrompt({
        id: 'p-fav',
        title: '代码审查',
        body: FAV_BODY,
        usage: '提交前审查',
        tagIds: ['tag-code'],
        favorite: true,
        updatedAt: T0 + 200,
        score: { stars: 4, note: '', ratedBodyVersion: 1, ratedAt: T0 + 220 },
      }),
      makePrompt({
        id: 'p-recent',
        title: '邮件回复',
        body: RECENT_BODY,
        usage: '客户回复',
        tagIds: ['tag-writing'],
        updatedAt: T0 + 100,
        bodyVersion: 2,
        score: { stars: 3, note: '旧评分', ratedBodyVersion: 1, ratedAt: T0 + 120 },
        lastUsedAt: T0 + 5000,
        useCount: 3,
      }),
      makePrompt({
        id: 'p-plain',
        title: '翻译助手',
        body: PLAIN_BODY,
        usage: '翻译',
        tagIds: ['tag-writing'],
        updatedAt: T0 + 50,
      }),
      makePrompt({
        id: 'p-en',
        title: 'Meeting Notes',
        body: EN_BODY,
        usage: 'Meeting wrap-up',
        tagIds: ['tag-code'],
        updatedAt: T0 + 400,
        score: { stars: 4.5, note: '', ratedBodyVersion: 1, ratedAt: T0 + 420 },
      }),
    ],
  };
}

function seedStorage() {
  return { [DATA_KEY]: JSON.stringify(seedData()) };
}

function makeHarness(options = {}) {
  return harness({ storage: seedStorage(), ...options });
}

/* ------------------------------------------------------------------ */
/* DOM-ish helpers over the harness tree                               */
/* ------------------------------------------------------------------ */

function entryButton(h) {
  return h.all('button').find((node) => node.props && node.props['aria-haspopup'] === 'dialog');
}

function rows(h) {
  return h.all('button').filter((node) => node.props && node.props['data-prompt-id']);
}

function rowTitle(h, title) {
  return rows(h).find((node) => node.props['aria-label'] === '选择提示词：' + title);
}

function rowById(h, id) {
  return rows(h).find((node) => node.props['data-prompt-id'] === id);
}

function hoverTipWrappers(h) {
  return h.all('span').filter((node) => node.props && node.props['data-hover-tip'] !== undefined);
}

/** Hover the given tooltip wrapper and return the rendered tooltip text. */
function hoverTipAt(h, index) {
  const wrappers = hoverTipWrappers(h);
  const wrapper = wrappers[index === undefined ? 0 : index];
  assert.ok(wrapper, 'hover-tip wrapper exists');
  wrapper.props.onMouseEnter({ type: 'mouseenter' });
  h.render();
  const tooltip = h.all('div').find((node) => node.props && node.props.role === 'tooltip');
  assert.ok(tooltip, 'tooltip is rendered immediately on hover');
  return { wrapper, tooltip, text: h.text(tooltip) };
}

/** Leaving the anchor removes the tooltip again. */
function leaveTip(h, wrapper) {
  wrapper.props.onMouseLeave({ type: 'mouseleave' });
  h.render();
  assert.equal(
    h.all('div').some((node) => node.props && node.props.role === 'tooltip'),
    false,
    'tooltip hides on mouse leave',
  );
}

function openPanel(h) {
  const entry = entryButton(h);
  assert.ok(entry, 'quick entry button exists');
  entry.props.onClick({ preventDefault() {}, stopPropagation() {} });
  h.render();
}

function selectRow(h, title) {
  const row = rowTitle(h, title);
  assert.ok(row, 'prompt row exists: ' + title);
  row.props.onClick({});
  h.render();
}

function quickList(h) {
  return h.all('div').find((node) => node.props && node.props['data-quick-list'] === 'true');
}

function pressList(h, key) {
  const list = quickList(h);
  assert.ok(list, 'quick list exists');
  let prevented = false;
  list.props.onKeyDown({
    key,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {},
    target: {},
    currentTarget: {},
  });
  h.render();
  return prevented;
}

function quickKeys(dictionary) {
  return Object.keys(dictionary || {})
    .filter((key) => key.startsWith('quick.'))
    .sort();
}

function placeholders(text) {
  return (String(text).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort();
}

/* ------------------------------------------------------------------ */
/* 1. Composer entry button                                            */
/* ------------------------------------------------------------------ */

test('entry button: dialog a11y attributes, label, and no draft mutation', () => {
  const h = makeHarness();
  h.renderQuick();

  const entry = entryButton(h);
  assert.ok(entry, 'entry button is rendered in conversation.input.right');
  assert.equal(entry.props.type, 'button');
  assert.equal(entry.props['aria-label'], '提示库');
  assert.equal(entry.props['aria-expanded'], false);

  const hovered = hoverTipAt(h, 0);
  assert.match(hovered.text, /提示库快捷选择|quick picker/i, 'entry hover description is immediate');
  leaveTip(h, hovered.wrapper);

  openPanel(h);
  assert.equal(Boolean(entryButton(h).props['aria-expanded']), true, 'expanded after opening');
  assert.ok(h.text().includes('提示库 · 快捷选择'), 'dialog opens');
  assert.ok(h.findInput('搜索提示词'), 'search box is rendered');

  // Opening the panel is a pure view action.
  assert.deepEqual(h.calls.inserts, []);
  assert.deepEqual(h.calls.drafts, []);
  assert.equal(h.storage.map.get(DATA_KEY), JSON.stringify(seedData()), 'data unchanged');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 2. Quick access sections and ratings                                */
/* ------------------------------------------------------------------ */

test('quick picker offers 全部/置顶/收藏/最近使用 tabs and defaults to all prompts', () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);

  const tabs = h.all('button').filter((node) => node.props && node.props.role === 'tab');
  assert.deepEqual(
    tabs.map((node) => h.text(node).replace(/\d+/g, '').trim()),
    ['全部', '置顶', '收藏', '最近使用'],
    'four category tabs',
  );
  assert.deepEqual(
    tabs.map((node) => node.props['aria-selected']),
    [true, false, false, false],
    'all prompts is the default tab',
  );
  const text = h.text();
  assert.ok(text.includes('全部'), 'all tab label');
  assert.ok(text.includes('置顶'), 'pinned tab label');
  assert.ok(text.includes('收藏'), 'favorites tab label');
  assert.ok(text.includes('最近使用'), 'recent tab label');

  // Default "All": every prompt is reachable, including plain ones.
  assert.equal(rows(h).length, 5);
  assert.ok(rowTitle(h, '润色置顶'));
  assert.ok(rowTitle(h, '代码审查'));
  assert.ok(rowTitle(h, '邮件回复'));
  assert.ok(rowTitle(h, '翻译助手'), 'plain prompt is visible under All');
  assert.ok(rowTitle(h, 'Meeting Notes'));

  // No row selected yet -> the preview shows an explicit empty state.
  assert.ok(text.includes('选择一条提示词查看正文'), 'no-selection preview empty state');

  // Ratings: unrated, valid (4 stars), and stale are all distinguishable.
  assert.ok(text.includes('未评分'), 'unrated badge');
  assert.ok(text.includes('待复评'), 'stale badge');
  assert.ok(
    h.all('span').some((node) => node.props && node.props['aria-label'] === '4 星'),
    'valid 4-star rating is displayed',
  );

  // Favorite / pinned markers.
  const pinnedRow = rowTitle(h, '润色置顶');
  assert.ok(
    h.descendants(pinnedRow, (node) => node.props && node.props['aria-label'] === '已置顶').length > 0,
  );
  const favRow = rowTitle(h, '代码审查');
  assert.ok(
    h.descendants(favRow, (node) => node.props && node.props['aria-label'] === '已收藏').length > 0,
  );

  // Category tabs filter the list; counts stay visible.
  h.clickButton('置顶1');
  assert.equal(rows(h).length, 1);
  assert.ok(rowTitle(h, '润色置顶'));
  h.clickButton('收藏1');
  assert.equal(rows(h).length, 1);
  assert.ok(rowTitle(h, '代码审查'));
  h.clickButton('最近使用1');
  assert.equal(rows(h).length, 1);
  assert.ok(rowTitle(h, '邮件回复'));
  h.clickButton('全部5');
  assert.equal(rows(h).length, 5);

  // Keyboard: arrow keys move the selected tab (roving focus).
  const tablist = h.all('div').find((node) => node.props && node.props.role === 'tablist');
  assert.ok(tablist);
  let prevented = false;
  tablist.props.onKeyDown({
    key: 'ArrowRight',
    preventDefault() {
      prevented = true;
    },
  });
  h.render();
  assert.equal(prevented, true);
  const afterArrow = h.all('button').filter((node) => node.props && node.props.role === 'tab');
  assert.deepEqual(
    afterArrow.map((node) => node.props['aria-selected']),
    [false, true, false, false],
    'ArrowRight selects 置顶',
  );
  h.dispose();
});

test('a prompt outside quick-access categories is visible under All, and an empty tab offers 查看全部', () => {
  const storage = {
    [DATA_KEY]: JSON.stringify({
      version: 1,
      tags: [],
      prompts: [makePrompt({ id: 'p-only', title: '唯一的提示词', body: '只有一条正文。' })],
    }),
  };
  const h = harness({ storage });
  h.renderQuick();
  openPanel(h);

  assert.equal(rows(h).length, 1, 'All shows prompts that are not pinned/favorite/recent');
  assert.ok(rowTitle(h, '唯一的提示词'));

  // Recent tab is empty for this prompt and offers a way back to All.
  h.clickButton('最近使用0');
  assert.equal(rows(h).length, 0);
  assert.ok(h.text().includes('这个分类还没有提示词'));
  h.clickButton('查看全部');
  assert.equal(rows(h).length, 1);
  assert.ok(rowTitle(h, '唯一的提示词'));
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 3. Search                                                           */
/* ------------------------------------------------------------------ */

test('search filters by title, body and tag names, ignoring case', () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);
  const input = h.findInput('搜索提示词');
  assert.ok(input, 'search input');

  // Title match.
  h.change(input, '代码审查');
  assert.equal(rows(h).length, 1);
  assert.ok(rowTitle(h, '代码审查'));
  assert.ok(h.text().includes('匹配结果'));

  // Body-only match (the word is not in the title).
  h.change(h.findInput('搜索提示词'), '英文');
  assert.equal(rows(h).length, 1);
  assert.ok(rowTitle(h, '翻译助手'));

  // Tag name match, and case-insensitive matching.
  h.change(h.findInput('搜索提示词'), '写作');
  assert.equal(rows(h).length, 3);
  h.change(h.findInput('搜索提示词'), 'MEETING');
  assert.equal(rows(h).length, 1);
  assert.ok(rowTitle(h, 'Meeting Notes'));

  // Whitespace around the query is ignored.
  h.change(h.findInput('搜索提示词'), '  邮件  ');
  assert.equal(rows(h).length, 1);
  assert.ok(rowTitle(h, '邮件回复'));
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 4. Copy                                                             */
/* ------------------------------------------------------------------ */

test('copy success marks the prompt used with exactly the body text', async () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);
  selectRow(h, '润色置顶');

  h.clickButton('复制正文');
  await h.flush();

  assert.equal(h.calls.copies.at(-1), PINNED_BODY, 'clipboard gets the body only');
  const prompt = h.promptById('p-pinned');
  assert.equal(prompt.useCount, 1);
  assert.ok(prompt.lastUsedAt, 'lastUsedAt set');
  assert.ok(h.text().includes('已复制正文'), 'success feedback');
  assert.ok(h.text().includes('用后评分'), 'after-use rating strip appears');
  assert.deepEqual(h.calls.drafts, []);
  h.dispose();
});

test('copy failure reports the error, does not mark used and does not offer rating', async () => {
  const h = makeHarness();
  h.renderQuick();
  globalThis.navigator.clipboard.writeText = () => Promise.reject(new Error('clipboard denied'));
  h.document.execCommand = () => false;
  openPanel(h);
  selectRow(h, '润色置顶');

  h.clickButton('复制正文');
  await h.flush();

  const prompt = h.promptById('p-pinned');
  assert.equal(prompt.useCount, 0, 'failed copy is not a use');
  assert.equal(prompt.lastUsedAt, null);
  assert.ok(h.text().includes('复制失败'), 'failure feedback');
  assert.equal(h.text().includes('用后评分'), false, 'rating strip only after a successful use');
  assert.deepEqual(h.calls.copies, []);
  assert.deepEqual(h.calls.drafts, []);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 5. Insert                                                           */
/* ------------------------------------------------------------------ */

test('insert success goes through inputActions and never overwrites the draft', async () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);
  selectRow(h, '润色置顶');

  h.clickButton('插入输入框');
  await h.flush();

  assert.equal(h.calls.inserts.length, 1, 'insertText called once');
  assert.equal(h.calls.inserts[0].text, PINNED_BODY);
  assert.equal(typeof h.calls.inserts[0].span, 'object');
  assert.equal(h.calls.inserts[0].span.draftRev, 1);
  assert.equal(h.promptById('p-pinned').useCount, 1);
  assert.ok(h.text().includes('已插入当前输入框'));
  assert.deepEqual(h.calls.drafts, [], 'never replaces the whole draft with setDraft');
  assert.ok(h.text().includes('用后评分'));
  h.dispose();
});

test('insert rejection reports it truthfully and does not mark used', async () => {
  const h = makeHarness();
  const inputActions = {
    captureInsertion() {
      return { start: 0, end: 0, draftRev: 1 };
    },
    insertText() {
      return false;
    },
  };
  h.renderQuick({ ...h.slotProps, inputActions });
  openPanel(h);
  selectRow(h, '润色置顶');

  h.clickButton('插入输入框');
  await h.flush();

  assert.equal(h.promptById('p-pinned').useCount, 0);
  assert.ok(h.text().includes('插入被拒绝'), 'rejection feedback');
  assert.deepEqual(h.calls.drafts, []);
  h.dispose();
});

test('missing insert API disables insert, explains the copy fallback and copy still works', async () => {
  const h = makeHarness();
  h.renderQuick({ ...h.slotProps, inputActions: null });
  openPanel(h);
  selectRow(h, '润色置顶');

  const insert = h.buttonByLabel('插入输入框');
  assert.ok(insert, 'insert button exists');
  assert.equal(insert.props.disabled, true, 'insert disabled without the API');
  assert.equal(insert.props['aria-describedby'], 'plq-insert-note');
  assert.ok(h.text().includes('未提供安全插入接口'), 'explicit degradation copy');

  const copy = h.buttonByLabel('复制正文');
  assert.equal(copy.props.disabled, undefined, 'copy remains available');
  assert.ok(copy.props.className.includes('pl-btn-primary'), 'copy is the primary action');

  h.clickButton('复制正文');
  await h.flush();
  assert.equal(h.promptById('p-pinned').useCount, 1, 'copy fallback marks used');
  assert.equal(h.calls.copies.at(-1), PINNED_BODY);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 6. After-use rating                                                 */
/* ------------------------------------------------------------------ */

test('after-use rating strip writes the rating, can clear it and can be dismissed', async () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);
  selectRow(h, '润色置顶');
  h.clickButton('复制正文');
  await h.flush();

  assert.ok(h.text().includes('用后评分'));

  h.clickButton('5 星');
  let prompt = h.promptById('p-pinned');
  assert.equal(prompt.score.stars, 5);
  assert.equal(prompt.score.ratedBodyVersion, prompt.bodyVersion, 'rating tied to current body version');
  assert.ok(prompt.score.ratedAt, 'ratedAt recorded');

  h.clickButton('清除评分');
  prompt = h.promptById('p-pinned');
  assert.equal(prompt.score.stars, null);

  h.clickButton('稍后');
  assert.equal(h.text().includes('用后评分'), false, 'strip dismissed');
  assert.ok(h.findInput('搜索提示词'), 'search still usable');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 7. Keyboard and focus behaviour                                     */
/* ------------------------------------------------------------------ */

test('arrow keys move the list selection and Enter never auto-inserts', () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);

  let listRows = rows(h);
  assert.ok(listRows.every((row) => row.props['aria-current'] !== 'true'), 'no initial selection');

  assert.equal(pressList(h, 'ArrowDown'), true, 'ArrowDown is handled');
  listRows = rows(h);
  assert.equal(listRows[0].props['aria-current'], 'true');
  assert.ok(h.text().includes('保持原意'), 'preview shows the selected body');

  pressList(h, 'ArrowDown');
  listRows = rows(h);
  assert.equal(listRows[1].props['aria-current'], 'true');

  pressList(h, 'End');
  assert.equal(rows(h).at(-1).props['aria-current'], 'true');
  pressList(h, 'Home');
  assert.equal(rows(h)[0].props['aria-current'], 'true');

  // Enter deliberately does nothing: inserting requires the explicit button.
  const prevented = pressList(h, 'Enter');
  assert.equal(prevented, false);
  assert.deepEqual(h.calls.inserts, []);
  assert.deepEqual(h.calls.drafts, []);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 8. Close / session safety                                           */
/* ------------------------------------------------------------------ */

test('Escape closes the panel and removes the dialog', () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);
  assert.ok(h.findInput('搜索提示词'));

  h.pressEscape();

  assert.equal(h.findInput('搜索提示词'), undefined, 'dialog unmounted');
  assert.equal(Boolean(entryButton(h).props['aria-expanded']), false);
  assert.equal(h.document.listenerCount('keydown'), 0, 'modal key listener cleaned up');
  h.dispose();
});

test('changing the conversation session closes the panel and clears the selection', () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);
  selectRow(h, '代码审查');
  assert.equal(rowTitle(h, '代码审查').props['aria-current'], 'true');

  h.renderQuick({ ...h.slotProps, sessionId: 'session-2' });

  assert.equal(h.findInput('搜索提示词'), undefined, 'panel auto-closed on session switch');
  assert.equal(Boolean(entryButton(h).props['aria-expanded']), false);

  openPanel(h);
  const reopened = rows(h);
  assert.ok(reopened.length > 0, 'panel can be reopened in the new session');
  assert.ok(reopened.every((row) => row.props['aria-current'] !== 'true'), 'no stale selection');
  h.dispose();
});

test('a copy resolving after a session switch is ignored', async () => {
  const h = makeHarness();
  h.renderQuick();
  let resolveCopy = null;
  globalThis.navigator.clipboard.writeText = () =>
    new Promise((resolve) => {
      resolveCopy = resolve;
    });
  openPanel(h);
  selectRow(h, '润色置顶');
  h.clickButton('复制正文');
  assert.equal(typeof resolveCopy, 'function', 'copy promise captured');

  h.renderQuick({ ...h.slotProps, sessionId: 'session-2' });
  resolveCopy();
  await h.flush();

  assert.equal(h.promptById('p-pinned').useCount, 0, 'late async result ignored');
  assert.equal(h.text().includes('已复制正文'), false);
  assert.equal(h.findInput('搜索提示词'), undefined);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 9. Empty / no-result states                                         */
/* ------------------------------------------------------------------ */

test('empty library shows creation guidance and the open-library fallback hint', () => {
  const h = harness();
  h.renderQuick();
  openPanel(h);

  assert.equal(rows(h).length, 0);
  assert.ok(h.text().includes('还没有提示词'));
  assert.ok(h.text().includes('先在提示库中新建提示词'));

  // No layout service in the harness -> explicit fallback instruction.
  h.clickButton('在提示库中打开');
  assert.ok(h.text().includes('请从左侧栏打开提示库'));
  h.dispose();
});

test('no search results show a clear-search action that restores quick access', () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);
  assert.equal(rows(h).length, 5);

  h.change(h.findInput('搜索提示词'), 'zzz-没有这个');
  assert.equal(rows(h).length, 0);
  assert.ok(h.text().includes('没有匹配结果'));

  h.clickButton('清除搜索');
  assert.equal(h.findInput('搜索提示词').props.value, '');
  assert.equal(rows(h).length, 5, 'all prompts restored');
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 10. i18n, narrow layout, CSS contract                               */
/* ------------------------------------------------------------------ */

test('quick dictionary keys are identical and placeholder-compatible in zh/en', () => {
  const h = makeHarness();
  const zh = h.dictionaries.zh;
  const en = h.dictionaries.en;
  const zhKeys = quickKeys(zh);
  const enKeys = quickKeys(en);

  assert.ok(zhKeys.length >= 25, 'all quick copy lives in QUICK_PICKER_DICT');
  assert.deepEqual(zhKeys, enKeys, 'zh/en quick key parity');
  for (const key of zhKeys) {
    assert.equal(typeof zh[key], 'string');
    assert.equal(typeof en[key], 'string');
    assert.ok(zh[key].length > 0 && en[key].length > 0, 'no empty translations: ' + key);
    assert.deepEqual(placeholders(zh[key]), placeholders(en[key]), 'placeholder parity: ' + key);
  }
  h.dispose();
});

test('english locale renders the quick picker in English', () => {
  const h = makeHarness();
  h.setLanguage('en');
  h.renderQuick();
  assert.equal(entryButton(h).props['aria-label'], 'Prompts');
  openPanel(h);

  const text = h.text();
  assert.ok(text.includes('Prompt Library · Quick picker'));
  assert.ok(text.includes('All'));
  assert.ok(text.includes('Pinned'));
  assert.ok(text.includes('Favorites'));
  assert.ok(text.includes('Recent'));
  assert.equal(h.findInput('Search prompts').props.placeholder, 'Search titles, text or tags');
  rowById(h, 'p-pinned').props.onClick({});
  h.render();
  assert.ok(h.buttonByLabel('Copy text'), 'english action labels');
  assert.ok(h.buttonByLabel('Insert into draft'));
  assert.ok(h.buttonByLabel('Open in Prompt Library'));
  h.dispose();
});

test('narrow composer keeps an icon-only entry with an accessible label', () => {
  const h = harness({ storage: seedStorage(), width: 600 });
  h.renderQuick();
  const entry = entryButton(h);
  assert.equal(entry.props['aria-label'], '提示库');
  assert.equal(h.text(entry).trim(), '', 'label text hidden on narrow widths');
  const hovered = hoverTipAt(h, 0);
  assert.match(hovered.text, /提示库快捷选择/, 'hover description remains the only explanation');
  leaveTip(h, hovered.wrapper);
  h.dispose();
});

test('QUICK_PICKER_CSS provides the mobile layout and theme tokens', () => {
  const source = readFileSync(new URL('../prompt-library/client.js', import.meta.url), 'utf8');
  assert.ok(source.includes('@media (max-width: 640px)'), 'mobile media query');
  assert.ok(source.includes('max-height:40vh'), 'list height capped on mobile');
  assert.ok(source.includes('--dsw-alias-'), 'theme tokens only');
  assert.ok(source.includes('.plq-preview-body'), 'preview text area styles');
  assert.ok(source.includes('.plq-row'), 'list row styles');
  assert.ok(source.includes('.plq-capture-actions'), 'panel capture action styles');
  assert.ok(source.includes('.plq-msg-capture'), 'selection capture action styles');
  assert.ok(source.includes('.plq-draft-entry'), 'composer save-draft entry styles');
});

/* ------------------------------------------------------------------ */
/* Quick-capture fixtures (DESIGN.md §9)                               */
/* ------------------------------------------------------------------ */

/* Multi-line draft with leading/trailing whitespace: the whole string must be
 * handed over verbatim ("整份草稿"), not trimmed or split. */
const CAPTURE_DRAFT = '\n  第一行草稿  \n第二行：保留换行与空格  \n';

function captureHub(h) {
  const entries = (h.slotEntries && h.slotEntries['shell.overlay']) || [];
  const entry = entries.find(
    (item) => item.config && item.config.id === 'prompt-library-capture',
  );
  assert.ok(entry, 'capture host is registered in shell.overlay');
  assert.equal(typeof entry.config.inject, 'function', 'capture host injects the shared hub');
  const injected = entry.config.inject() || {};
  assert.equal(typeof injected.capture.getSnapshot, 'function', 'capture hub exposes snapshots');
  return injected.capture;
}

function fakeCapture(options = {}) {
  const calls = [];
  return {
    calls,
    open(payload) {
      calls.push(payload);
      return options.result === false ? false : true;
    },
  };
}

function renderSaveDraft(h, slotProps) {
  return h.renderSlot('conversation.input.right', 'prompt-library-save-draft', slotProps);
}

function renderSelectionAction(h, props) {
  return h.renderSlot('conversation.chat.text-interaction', 'prompt-library-capture', props);
}

/* ------------------------------------------------------------------ */
/* 11. Composer "save draft" capture entry                             */
/* ------------------------------------------------------------------ */

test('closing the panel does not re-open the entry hover tooltip', () => {
  const h = makeHarness();
  h.renderQuick();

  // Opening the panel happens through the entry button.
  openPanel(h);
  assert.ok(h.text().includes('提示库 · 快捷选择'));

  // Close it; focus restoration used to immediately show the tooltip again.
  h.pressEscape();
  const wrapper = hoverTipWrappers(h)[0];
  assert.ok(wrapper, 'entry hover wrapper remains');
  wrapper.props.onFocus({ type: 'focus' });
  wrapper.props.onMouseEnter({ type: 'mouseenter' });
  h.render();
  assert.equal(
    h.all('div').some((node) => node.props && node.props.role === 'tooltip'),
    false,
    'tooltip stays hidden right after closing the panel',
  );
  h.dispose();
});

test('save-draft entry: button a11y + whole-draft snapshot and no composer mutation', () => {
  const h = makeHarness();
  const hub = captureHub(h);
  renderSaveDraft(h, {
    sessionId: 'session-1',
    input: { draft: CAPTURE_DRAFT },
    inputActions: h.fakeInputActions,
  });

  const button = h.buttonByLabel('保存为提示词');
  assert.ok(button, 'save-draft button renders in the composer toolbar');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props['aria-label'], '保存为提示词');
  assert.equal(button.props.disabled, false);
  assert.ok(
    h.descendants(button, (node) => node.type === 'svg').length > 0,
    'compact icon is rendered',
  );
  assert.equal(h.text(button).trim(), '', 'the composer entry is icon-only; hover carries the explanation');
  const hovered = hoverTipAt(h, 0);
  assert.equal(hovered.text, '把输入框中的整份草稿收录为提示词', 'hover explanation names the action');
  leaveTip(h, hovered.wrapper);

  const before = h.storage.map.get(DATA_KEY);
  h.clickButton('保存为提示词');

  const request = hub.getSnapshot().request;
  assert.ok(request, 'capture dialog received the request');
  assert.equal(request.text, CAPTURE_DRAFT, 'the WHOLE draft is captured verbatim');
  assert.equal(request.source.kind, 'composer');
  assert.equal(request.source.sessionId, 'session-1');
  assert.deepEqual(h.calls.drafts, [], 'never calls setDraft');
  assert.deepEqual(h.calls.inserts, [], 'never inserts or submits');
  assert.deepEqual(h.calls.copies, [], 'never reads the clipboard');
  assert.equal(h.storage.map.get(DATA_KEY), before, 'library data unchanged');
  hub.close();
  h.dispose();
});

test('save-draft entry: empty or whitespace-only drafts are disabled with a reason', () => {
  const h = makeHarness();
  const hub = captureHub(h);
  renderSaveDraft(h, {
    sessionId: 'session-1',
    input: { draft: '   \n\t  ' },
    inputActions: h.fakeInputActions,
  });

  const button = h.buttonByLabel('保存为提示词');
  assert.ok(button, 'button still renders so the action is discoverable');
  assert.equal(button.props.disabled, true);
  const hovered = hoverTipAt(h, 0);
  assert.equal(hovered.text, '输入框为空，暂无可保存的草稿', 'disabled reason appears on hover');
  leaveTip(h, hovered.wrapper);

  h.clickButton('保存为提示词');
  assert.equal(hub.getSnapshot().request, null, 'disabled button never opens capture');
  assert.deepEqual(h.calls.drafts, []);
  h.dispose();
});

test('save-draft entry: click-time session snapshot survives a conversation switch', () => {
  const h = makeHarness();
  const hub = captureHub(h);

  renderSaveDraft(h, { sessionId: 'session-1', input: { draft: '草稿一' } });
  h.clickButton('保存为提示词');
  const first = hub.getSnapshot().request;
  assert.equal(first.text, '草稿一');
  assert.equal(first.source.sessionId, 'session-1');

  renderSaveDraft(h, { sessionId: 'session-2', input: { draft: '草稿二' } });
  assert.equal(hub.getSnapshot().request, first, 'opening a dialog does not re-read slot props');
  assert.equal(hub.getSnapshot().request.source.sessionId, 'session-1');

  h.clickButton('保存为提示词');
  assert.equal(
    hub.getSnapshot().request,
    first,
    'an unsaved open capture is never overwritten by another click',
  );

  hub.close();
  h.clickButton('保存为提示词');
  const second = hub.getSnapshot().request;
  assert.equal(second.text, '草稿二', 'a later click snapshots the current draft');
  assert.equal(second.source.sessionId, 'session-2', 'a later click snapshots the current session');
  hub.close();
  h.dispose();
});

test('save-draft entry: follows the active locale', () => {
  const h = makeHarness();
  h.setLanguage('en');
  renderSaveDraft(h, { sessionId: 'session-1', input: { draft: 'draft text' } });

  const button = h.buttonByLabel('Save as prompt');
  assert.ok(button, 'english label');
  assert.equal(button.props['aria-label'], 'Save as prompt');
  const hovered = hoverTipAt(h, 0);
  assert.match(hovered.text, /whole composer draft/i, 'english hover description is immediate');
  leaveTip(h, hovered.wrapper);
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 12. Conversation-selection capture action                           */
/* ------------------------------------------------------------------ */

test('selection action: reads the selection, opens capture with session snapshot, then dismisses', () => {
  const h = makeHarness({ uiConversation: true });
  const capture = fakeCapture();
  let dismissed = 0;
  renderSelectionAction(h, {
    capture,
    readText: () => '  选中的对话文本  ',
    dismiss: () => {
      dismissed += 1;
    },
    trigger: 'selection',
    sessionId: 'session-42',
  });

  const button = h.buttonByLabel('收录为提示词');
  assert.ok(button, 'selection action button renders');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props.disabled, false);

  let pointerPrevented = false;
  button.props.onPointerDown({
    preventDefault() {
      pointerPrevented = true;
    },
  });
  assert.equal(pointerPrevented, true, 'pointerdown is prevented so the host selection survives');

  h.clickButton('收录为提示词');
  assert.equal(capture.calls.length, 1, 'capture.open called exactly once');
  assert.deepEqual(capture.calls[0], {
    text: '  选中的对话文本  ',
    source: { kind: 'message', sessionId: 'session-42' },
  });
  assert.equal(dismissed, 1, 'overlay is dismissed after handing off');
  h.dispose();
});

test('selection action: empty, missing or throwing readText dismisses without opening capture', () => {
  const h = makeHarness({ uiConversation: true });
  const capture = fakeCapture();
  let dismissed = 0;
  const dismiss = () => {
    dismissed += 1;
  };
  const cases = [
    () => null,
    () => '   \n\t ',
    () => {
      throw new Error('selection surface already gone');
    },
  ];

  for (const readText of cases) {
    renderSelectionAction(h, {
      capture,
      readText,
      dismiss,
      trigger: 'selection',
      sessionId: 'session-1',
    });
    h.clickButton('收录为提示词');
  }

  assert.deepEqual(capture.calls, [], 'nothing captured when there is no selection text');
  assert.equal(dismissed, cases.length, 'every degraded click closes the overlay');
  h.dispose();
});

test('selection action: other triggers render nothing; a missing capture hub degrades safely', () => {
  const h = makeHarness({ uiConversation: true });
  const capture = fakeCapture();
  let dismissed = 0;
  const dismiss = () => {
    dismissed += 1;
  };

  renderSelectionAction(h, {
    capture,
    readText: () => 'text',
    dismiss,
    trigger: 'menu',
    sessionId: 'session-1',
  });
  assert.equal(h.buttonByLabel('收录为提示词'), undefined, 'only selection triggers render the action');
  assert.equal(h.text().trim(), '');

  renderSelectionAction(h, {
    capture: null,
    readText: () => 'text',
    dismiss,
    trigger: 'selection',
    sessionId: 'session-1',
  });
  const disabled = h.buttonByLabel('收录为提示词');
  assert.ok(disabled, 'button renders but disabled without a capture hub');
  assert.equal(disabled.props.disabled, true);
  assert.ok(
    disabled.props.title && disabled.props.title.includes('未提供'),
    'unavailable reason is explicit',
  );

  h.clickButton('收录为提示词');
  assert.deepEqual(capture.calls, [], 'no capture hub -> nothing opens');
  assert.equal(dismissed, 1, 'degraded click still dismisses the overlay');
  h.dispose();
});

test('selection action: a slot-injected t wins over the locale fallback', () => {
  const h = makeHarness({ uiConversation: true });
  const capture = fakeCapture();
  const base = {
    capture,
    readText: () => 'text',
    dismiss: () => {},
    trigger: 'selection',
    sessionId: 'session-1',
  };

  renderSelectionAction(h, base);
  assert.ok(h.buttonByLabel('收录为提示词'), 'zh copy by default');

  h.setLanguage('en');
  renderSelectionAction(h, base);
  assert.ok(h.buttonByLabel('Save as prompt'), 'english copy after locale switch');

  const seen = [];
  renderSelectionAction(h, {
    ...base,
    t: (key) => {
      seen.push(key);
      return 'custom:' + key;
    },
  });
  assert.ok(seen.includes('quick.captureMessage'), 'explicit props.t is used instead of useT');
  assert.ok(h.text().includes('custom:quick.captureMessage'));
  h.dispose();
});

/* ------------------------------------------------------------------ */
/* 13. Quick picker capture entries                                    */
/* ------------------------------------------------------------------ */

test('quick panel: quick-capture hands over an empty paste capture and closes the picker', () => {
  const h = makeHarness();
  const hub = captureHub(h);
  h.renderQuick();
  openPanel(h);

  const button = h.buttonByLabel('快速收录');
  assert.ok(button, 'quick-capture button is in the panel toolbar');
  assert.equal(button.props.type, 'button');
  assert.ok(button.props.title, 'tooltip explains the paste source');

  h.clickButton('快速收录');
  assert.equal(h.findInput('搜索提示词'), undefined, 'picker yields to the capture dialog');

  const request = hub.getSnapshot().request;
  assert.ok(request, 'capture dialog received the paste request');
  assert.equal(request.text, '', 'quick capture starts empty for manual pasting');
  assert.equal(request.source.kind, 'paste');

  h.renderOverlay();
  assert.equal(
    h.findTextarea('提示词正文').props.value,
    '',
    'the empty paste dialog is rendered from the shared hub',
  );
  hub.close();
  h.dispose();
});

test('quick panel: save-draft snapshots the whole composer draft as a composer capture', () => {
  const h = makeHarness();
  const hub = captureHub(h);
  h.renderQuick({ ...h.slotProps, sessionId: 'session-7', input: { draft: CAPTURE_DRAFT } });
  openPanel(h);

  const button = h.buttonByLabel('保存草稿为提示词');
  assert.ok(button, 'save-draft button is in the panel toolbar');
  assert.equal(button.props.disabled, false);
  assert.deepEqual(h.calls.drafts, []);

  h.clickButton('保存草稿为提示词');
  assert.equal(h.findInput('搜索提示词'), undefined, 'picker closes after handing off');

  const request = hub.getSnapshot().request;
  assert.ok(request);
  assert.equal(request.text, CAPTURE_DRAFT, 'whole draft captured verbatim');
  assert.equal(request.source.kind, 'composer');
  assert.equal(request.source.sessionId, 'session-7', 'session id snapshotted at click time');
  assert.deepEqual(h.calls.drafts, [], 'never calls setDraft');
  assert.deepEqual(h.calls.inserts, [], 'never submits the draft');

  h.renderOverlay();
  assert.equal(
    h.findTextarea('提示词正文').props.value,
    CAPTURE_DRAFT,
    'the capture dialog receives the composer draft',
  );
  hub.close();
  h.dispose();
});

test('quick panel: save-draft is disabled for an empty draft and never opens capture', () => {
  const h = makeHarness();
  const hub = captureHub(h);
  h.renderQuick({ ...h.slotProps, input: { draft: '  \n\t ' } });
  openPanel(h);

  const button = h.buttonByLabel('保存草稿为提示词');
  assert.ok(button);
  assert.equal(button.props.disabled, true, 'empty draft disables save-draft');
  assert.equal(button.props.title, '输入框为空，暂无可保存的草稿');

  h.clickButton('保存草稿为提示词');
  assert.equal(hub.getSnapshot().request, null);
  assert.ok(h.findInput('搜索提示词'), 'panel stays open');
  h.dispose();
});

test('quick panel: an already-open capture is never overwritten; the reason is shown', () => {
  const h = makeHarness();
  const hub = captureHub(h);
  hub.open({ text: '已有请求', source: { kind: 'paste' } });
  h.renderQuick({ ...h.slotProps, input: { draft: '草稿' } });
  openPanel(h);

  h.clickButton('快速收录');
  assert.ok(h.text().includes('收录弹层已打开'), 'busy reason for quick capture');
  h.clickButton('保存草稿为提示词');
  assert.ok(h.text().includes('收录弹层已打开'), 'busy reason for save-draft');

  const request = hub.getSnapshot().request;
  assert.equal(request.text, '已有请求', 'the unsaved open capture keeps its text');
  assert.ok(h.findInput('搜索提示词'), 'picker stays usable after the refusal');
  hub.close();
  h.dispose();
});
