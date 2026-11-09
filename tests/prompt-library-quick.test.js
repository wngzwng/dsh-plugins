/*
 * Prompt Library — composer quick picker (owner: quick-ui).
 *
 * Drives the real `PromptLibraryQuickEntry` component tree from the built
 * `client.js` through the shared harness: entry button a11y, quick-access
 * sections, search, preview, copy/insert semantics, after-use rating,
 * session-switch safety, empty/no-result states and zh/en parity.
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
  assert.ok(entry.props.title && entry.props.title.length > 0, 'entry has a title tooltip');
  assert.equal(entry.props['aria-expanded'], false);

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

test('empty search shows pinned / favorites / recently-used sections with counts and ratings', () => {
  const h = makeHarness();
  h.renderQuick();
  openPanel(h);

  const text = h.text();
  assert.ok(text.includes('置顶'), 'pinned section');
  assert.ok(text.includes('收藏'), 'favorites section');
  assert.ok(text.includes('最近使用'), 'recent section');

  // Section rows: exactly the three quick-access prompts (plain ones excluded).
  const listRows = rows(h);
  assert.equal(listRows.length, 3);
  assert.ok(rowTitle(h, '润色置顶'));
  assert.ok(rowTitle(h, '代码审查'));
  assert.ok(rowTitle(h, '邮件回复'));
  assert.equal(rowTitle(h, '翻译助手'), undefined, 'non-pinned/favorite/recent prompt hidden');
  assert.equal(rowTitle(h, 'Meeting Notes'), undefined);

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
  h.dispose();
});

test('prompts outside the quick-access categories fall back to an all-prompts section', () => {
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

  assert.ok(h.text().includes('全部提示词'), 'all-prompts fallback section');
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
  assert.equal(rows(h).length, 3);

  h.change(h.findInput('搜索提示词'), 'zzz-没有这个');
  assert.equal(rows(h).length, 0);
  assert.ok(h.text().includes('没有匹配结果'));

  h.clickButton('清除搜索');
  assert.equal(h.findInput('搜索提示词').props.value, '');
  assert.equal(rows(h).length, 3, 'quick access restored');
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
  assert.ok(text.includes('Pinned'));
  assert.ok(text.includes('Favorites'));
  assert.ok(text.includes('Recently used'));
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
  assert.ok(entry.props.title);
  assert.equal(h.text(entry).trim(), '', 'label text hidden on narrow widths');
  h.dispose();
});

test('QUICK_PICKER_CSS provides the mobile layout and theme tokens', () => {
  const source = readFileSync(new URL('../prompt-library/client.js', import.meta.url), 'utf8');
  assert.ok(source.includes('@media (max-width: 640px)'), 'mobile media query');
  assert.ok(source.includes('max-height:40vh'), 'list height capped on mobile');
  assert.ok(source.includes('--dsw-alias-'), 'theme tokens only');
  assert.ok(source.includes('.plq-preview-body'), 'preview text area styles');
  assert.ok(source.includes('.plq-row'), 'list row styles');
});
