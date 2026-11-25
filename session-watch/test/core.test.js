import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultShortcutConfig } from '../shortcuts.js';
import {
  createDefaultState, normalizeState, reduceState, visiblePaneCount, extractPreview, sessionDisplayTitle,
} from '../core.js';

const apply = (state, ...actions) => actions.reduce(reduceState, state);
const followed = (...ids) => reduceState(createDefaultState(), { type: 'follow', ids });
const envelope = (type, seq, data, time = `2026-11-17T10:00:${String(seq).padStart(2, '0')}Z`) => ({
  type: 'event', event: { type, seq, time, data },
});
const text = (value) => ({ type: 'text', text: value });
function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

test('native displayTitle wins over stale projection title', () => {
  const list = { byId: { a: { displayTitle: '多会话关注与分屏插件设计' } }, projectionsBySession: { a: { values: { title: '旧名字' } } } };
  assert.equal(sessionDisplayTitle(list, 'a'), '多会话关注与分屏插件设计');
});
test('native string title projection is accepted without assuming an object payload', () => {
  assert.equal(sessionDisplayTitle({ projectionsBySession: { a: { values: { title: '  模拟结果分析  ' } } } }, 'a'), '模拟结果分析');
});
test('missing titles never fall back to shared session-id prefixes or unrelated projections', () => {
  assert.equal(sessionDisplayTitle({}, 'session-long-id'), '未命名会话');
  assert.equal(sessionDisplayTitle({ byId: { a: { displayTitle: ' ' } }, projectionsBySession: { a: { values: { other: { title: '不是会话标题' } } } } }, 'a'), '未命名会话');
});
test('title updates are read from the latest immutable list snapshot', () => {
  const oldList = { byId: { a: { displayTitle: '原始标题' } } };
  const newList = { byId: { a: { displayTitle: '重命名后的会话' } } };
  assert.equal(sessionDisplayTitle(oldList, 'a'), '原始标题');
  assert.equal(sessionDisplayTitle(newList, 'a'), '重命名后的会话');
});

test('default state is complete and independent', () => {
  const a = createDefaultState();
  const b = createDefaultState();
  assert.deepEqual(a, {
    version: 1, revision: 0, followed: [], panes: [null, null, null, null],
    mode: 'cards', layout: 'columns', activePane: 0, ratios: { x: 0.5, y: 0.5 }, read: {}, shortcuts: createDefaultShortcutConfig(),
  });
  a.followed.push('a');
  a.panes[0] = 'a';
  a.ratios.x = 0.7;
  a.read.a = 2;
  assert.deepEqual(b, createDefaultState());
});

test('normalization rejects invalid persistence and strips unknown fields', () => {
  for (const input of [undefined, null, false, 42, 'bad', []]) {
    assert.deepEqual(normalizeState(input), createDefaultState());
  }
  const input = freezeDeep({
    version: 999, revision: -1,
    followed: ['', '  ', null, 42, 'a', 'a', 'b', 'x'.repeat(201)],
    panes: ['a', 'a', 'missing', 'b', 'a'], mode: 'unknown', layout: 'unknown',
    activePane: 19, ratios: { x: -1, y: Infinity }, read: { a: -1, b: 1.5 }, extra: 'discard',
  });
  assert.deepEqual(normalizeState(input), {
    ...createDefaultState(), followed: ['a', 'b'], panes: ['a', null, null, 'b'],
    ratios: { x: 0.2, y: 0.5 },
  });
  const valid = normalizeState({
    followed: ['a', 'b'], panes: ['a', 'b'], mode: 'split', layout: 'rows',
    activePane: 1, ratios: { x: 0.9, y: 0.1 }, revision: 7, read: { a: 0, b: 4 },
  });
  assert.equal(valid.revision, 7);
  assert.equal(valid.activePane, 1);
  assert.deepEqual(valid.ratios, { x: 0.8, y: 0.2 });
  assert.deepEqual(normalizeState(valid), valid);
});

test('normalization enforces id length, stable uniqueness and followed limit', () => {
  const ids = ['a', 'a', 'x'.repeat(200), ...Array.from({ length: 210 }, (_, i) => `s${i}`)];
  const state = normalizeState({ followed: ids });
  assert.equal(state.followed.length, 200);
  assert.deepEqual(state.followed.slice(0, 4), ['a', 'x'.repeat(200), 's0', 's1']);
  assert.equal(state.followed.at(-1), 's197');
});

test('read normalization excludes dangerous keys, inherited keys and unfollowed/invalid sequences', () => {
  const read = JSON.parse('{"__proto__":1,"constructor":2,"prototype":3,"a":4,"b":-1,"c":1.5,"d":9007199254740992,"ghost":8}');
  Object.setPrototypeOf(read, { inherited: 15 });
  const state = normalizeState({ followed: ['__proto__', 'constructor', 'prototype', 'a', 'b', 'c', 'd', 'inherited'], read });
  assert.deepEqual(state.read, { a: 4 });
  assert.equal(Object.getPrototypeOf(state.read), Object.prototype);
  assert.equal({}.polluted, undefined);
});

test('follow is stable, deduplicates ids, validates them and does not assign panes', () => {
  const state = apply(createDefaultState(),
    { type: 'follow', ids: ['b', 'a', 'b', '', 1, null, 'x'.repeat(201)] },
    { type: 'follow', ids: ['a', 'c'] });
  assert.deepEqual(state.followed, ['b', 'a', 'c']);
  assert.deepEqual(state.panes, [null, null, null, null]);
  assert.equal(state.mode, 'cards');
  assert.equal(state.revision, 2);
  const full = followed(...Array.from({ length: 200 }, (_, i) => `s${i}`));
  assert.strictEqual(reduceState(full, { type: 'follow', ids: ['new'] }), full);
  assert.strictEqual(reduceState(full, { type: 'assign', id: 'new' }), full);
});

test('unfollow removes both visible/hidden pane and read position without affecting peers', () => {
  const state = normalizeState({
    followed: ['a', 'b'], panes: ['b', null, null, 'a'], layout: 'columns', read: { a: 8, b: 3 },
  });
  const next = reduceState(freezeDeep(state), { type: 'unfollow', id: 'a' });
  assert.deepEqual(next.followed, ['b']);
  assert.deepEqual(next.panes, ['b', null, null, null]);
  assert.deepEqual(next.read, { b: 3 });
  assert.equal(next.revision, 1);
  assert.strictEqual(reduceState(next, { type: 'unfollow', id: 'missing' }), next);
});

test('assign follows first, targets activePane by default and opens split mode', () => {
  const state = reduceState(createDefaultState(), { type: 'active', index: 1 });
  const next = reduceState(freezeDeep(state), { type: 'assign', id: 'new' });
  assert.deepEqual(next.followed, ['new']);
  assert.deepEqual(next.panes, [null, 'new', null, null]);
  assert.equal(next.mode, 'split');
  assert.equal(next.activePane, 1);
  assert.equal(next.revision, state.revision + 1);
});

test('assign never duplicates a session, even when asked to replace another pane', () => {
  const state = apply(followed('a', 'b'),
    { type: 'assign', id: 'a', index: 0 },
    { type: 'assign', id: 'b', index: 1 });
  const next = reduceState(state, { type: 'assign', id: 'a', index: 1 });
  assert.deepEqual(next.panes, ['a', 'b', null, null]);
  assert.equal(next.activePane, 0);
  assert.strictEqual(reduceState(next, { type: 'assign', id: 'a', index: 99 }), next);
});

test('assign replacement and pane removal do not unfollow or clear read data', () => {
  const state = apply(followed('a', 'b'),
    { type: 'assign', id: 'a', index: 0 }, { type: 'read', id: 'a', seq: 8 });
  const next = reduceState(state, { type: 'assign', id: 'b', index: 0 });
  assert.deepEqual(next.followed, ['a', 'b']);
  assert.deepEqual(next.read, { a: 8 });
  const removed = reduceState(next, { type: 'remove-pane', index: 0 });
  assert.deepEqual(removed.panes, [null, null, null, null]);
  assert.deepEqual(removed.followed, ['a', 'b']);
  assert.deepEqual(removed.read, { a: 8 });
  assert.strictEqual(reduceState(removed, { type: 'remove-pane', index: 0 }), removed);
});

test('hidden assign switches to quad, layout switches retain all bindings and reset active', () => {
  const quad = reduceState(followed('a', 'b'), { type: 'assign', id: 'a', index: 3 });
  assert.equal(quad.layout, 'quad');
  assert.equal(quad.activePane, 3);
  const columns = reduceState(quad, { type: 'layout', value: 'columns' });
  assert.equal(columns.activePane, 0);
  assert.deepEqual(columns.panes, [null, null, null, 'a']);
  const rows = reduceState(columns, { type: 'layout', value: 'rows' });
  assert.strictEqual(reduceState(rows, { type: 'active', index: 3 }), rows);
  const restored = reduceState(rows, { type: 'layout', value: 'quad' });
  assert.deepEqual(restored.panes, quad.panes);
  assert.equal(normalizeState({ ...quad, layout: 'rows' }).activePane, 0);
  const reveal = reduceState(columns, { type: 'assign', id: 'a', index: 0 });
  assert.equal(reveal.layout, 'quad');
  assert.equal(reveal.activePane, 3);
  assert.deepEqual(reveal.panes, quad.panes);
  for (const layout of ['columns', 'rows', 'unknown', undefined]) assert.equal(visiblePaneCount(layout), 2);
  assert.equal(visiblePaneCount('quad'), 4);
});

test('mode changes preserve layout and pane bindings', () => {
  const split = reduceState(createDefaultState(), { type: 'assign', id: 'a', index: 1 });
  const cards = reduceState(split, { type: 'mode', value: 'cards' });
  assert.equal(cards.mode, 'cards');
  assert.deepEqual(cards.panes, split.panes);
  assert.equal(cards.layout, split.layout);
  assert.equal(reduceState(cards, { type: 'mode', value: 'split' }).mode, 'split');
});

test('ratios clamp independently and reject coercion, NaN and Infinity', () => {
  const state = reduceState(createDefaultState(), { type: 'ratios', x: 100, y: -10 });
  assert.deepEqual(state.ratios, { x: 0.8, y: 0.2 });
  const next = reduceState(state, { type: 'ratios', x: 0.4 });
  assert.deepEqual(next.ratios, { x: 0.4, y: 0.2 });
  assert.strictEqual(reduceState(next, { type: 'ratios', x: '0.5', y: NaN }), next);
  assert.strictEqual(reduceState(next, { type: 'ratios', x: Infinity }), next);
});

test('read positions are monotonic nonnegative safe integers for followed ids only', () => {
  const initial = followed('a', '__proto__', 'constructor', 'prototype');
  const zero = reduceState(initial, { type: 'read', id: 'a', seq: 0 });
  assert.deepEqual(zero.read, { a: 0 });
  const state = reduceState(zero, { type: 'read', id: 'a', seq: 10 });
  for (const action of [
    { type: 'read', id: 'a', seq: 10 }, { type: 'read', id: 'a', seq: 2 },
    { type: 'read', id: 'a', seq: -1 }, { type: 'read', id: 'a', seq: 1.5 },
    { type: 'read', id: 'a', seq: '11' }, { type: 'read', id: 'a', seq: Infinity },
    { type: 'read', id: 'a', seq: Number.MAX_SAFE_INTEGER + 1 },
    { type: 'read', id: 'missing', seq: 20 },
    ...['__proto__', 'constructor', 'prototype'].map((id) => ({ type: 'read', id, seq: 20 })),
  ]) assert.strictEqual(reduceState(state, action), state);
  assert.equal(reduceState(state, { type: 'read', id: 'a', seq: 11 }).read.a, 11);
});

test('reorder is stable, supports moving to end, and never changes panes', () => {
  const state = reduceState(followed('a', 'b', 'c', 'd'), { type: 'assign', id: 'b', index: 1 });
  const next = reduceState(state, { type: 'reorder', id: 'd', beforeId: 'b' });
  assert.deepEqual(next.followed, ['a', 'd', 'b', 'c']);
  assert.deepEqual(next.panes, state.panes);
  const end = reduceState(next, { type: 'reorder', id: 'a' });
  assert.deepEqual(end.followed, ['d', 'b', 'c', 'a']);
  for (const action of [
    { type: 'reorder', id: 'a' }, { type: 'reorder', id: 'b', beforeId: 'b' },
    { type: 'reorder', id: 'ghost' }, { type: 'reorder', id: 'a', beforeId: 'ghost' },
    { type: 'reorder', id: 'd', beforeId: 'b' },
  ]) assert.strictEqual(reduceState(end, action), end);
});

test('no-op and malformed actions preserve identity and revision', () => {
  const state = freezeDeep(followed('a'));
  for (const action of [null, undefined, [], 1, {}, { type: 'unknown' },
    { type: 'follow', ids: ['a', '', null] }, { type: 'follow', ids: 'bad' },
    { type: 'assign', id: '' }, { type: 'assign', id: 'b', index: -1 },
    { type: 'assign', id: 'b', index: 4 }, { type: 'remove-pane', index: 1.5 },
    { type: 'remove-pane', index: 0 }, { type: 'active', index: 0 },
    { type: 'active', index: 2 }, { type: 'active', index: '1' },
    { type: 'mode', value: 'cards' }, { type: 'mode', value: 'other' },
    { type: 'layout', value: 'columns' }, { type: 'layout', value: 'other' },
    { type: 'ratios' },
  ]) {
    const next = reduceState(state, action);
    assert.strictEqual(next, state, JSON.stringify(action));
    assert.equal(next.revision, 1);
  }
});

test('all action types are immutable and each successful action increments once', () => {
  let state = createDefaultState();
  const actions = [
    { type: 'follow', ids: ['a', 'b'] }, { type: 'assign', id: 'a', index: 1 },
    { type: 'active', index: 0 }, { type: 'mode', value: 'cards' },
    { type: 'layout', value: 'quad' }, { type: 'ratios', x: 0.6 },
    { type: 'read', id: 'a', seq: 4 }, { type: 'reorder', id: 'a' },
    { type: 'remove-pane', index: 1 }, { type: 'unfollow', id: 'a' },
  ];
  for (const action of actions) {
    const copy = structuredClone(state);
    const previous = freezeDeep(state);
    state = reduceState(previous, freezeDeep(action));
    assert.deepEqual(previous, copy);
    assert.notStrictEqual(state, previous);
    assert.equal(state.revision, previous.revision + 1);
    assert.deepEqual(normalizeState(state), state);
  }
});

test('reduce repairs sparse pane arrays rather than returning an invalid state by identity', () => {
  const state = { ...createDefaultState(), panes: Array(4) };
  const result = reduceState(state, { type: 'unknown' });
  assert.deepEqual(result.panes, [null, null, null, null]);
  assert.notStrictEqual(result, state);
  assert.equal(result.revision, 1);
});

test('revision overflow is refused to preserve a safe persistence counter', () => {
  const state = normalizeState({ revision: Number.MAX_SAFE_INTEGER });
  assert.strictEqual(reduceState(state, { type: 'follow', ids: ['a'] }), state);
});

test('preview safely extracts explicit text blocks and tool names only', () => {
  const entries = freezeDeep([
    envelope('user/message', 1, { content: [text('hello'), { type: 'image', url: 'private' }, text('world')] }),
    envelope('assistant/message', 2, { message: { content: [
      { type: 'thinking', text: 'SECRET THINKING' }, text('answer'),
      { type: 'reasoning', text: 'SECRET REASONING' },
    ] }, credential: 'SECRET TOKEN' }),
    envelope('tool/call', 3, { name: 'search', arguments: { apiKey: 'SECRET KEY' }, result: 'SECRET RESULT' }),
  ]);
  const result = extractPreview(entries);
  assert.deepEqual(result.rows.map(({ role, text: value }) => [role, value]), [
    ['user', 'hello\nworld'], ['assistant', 'answer'], ['tool', 'search'],
  ]);
  assert.equal(result.latestSeq, 3);
  assert.equal(result.updatedAt, '2026-11-17T10:00:03Z');
  assert.equal(result.snippet, 'search');
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.equal(new Set(result.rows.map((row) => row.key)).size, 3);
  assert.deepEqual(result, extractPreview(entries));
});

test('preview accepts only explicit text-delta and never reasoning/unknown chunks', () => {
  const live = (seq, chunk) => ({ type: 'transient', event: {
    type: 'assistant/live-chunk', seq, time: seq * 1000, data: { attemptId: 'a', turn: 1, step: 1, chunk },
  } });
  const result = extractPreview([
    live(1, { type: 'text-delta', index: 0, text: 'live answer' }),
    live(2, { text: 'SECRET unknown plain text' }),
    live(3, { type: 'reasoning', text: 'SECRET' }),
    live(4, { type: 'thinking', text: 'SECRET' }),
    live(5, { type: 'reasoning-delta', text: 'SECRET' }),
    live(6, { reasoning: 'SECRET', delta: { text: 'SECRET' } }),
    live(7, 'SECRET unknown chunk'),
    envelope('assistant/thinking', 8, { content: [text('SECRET')] }),
    envelope('assistant/reasoning', 9, { text: 'SECRET' }),
  ]);
  assert.deepEqual(result.rows.map((row) => row.text), ['live answer']);
  assert.equal(result.latestSeq, 9);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('preview aggregates text deltas by attempt/turn/step/index and preserves whitespace', () => {
  const live = (seq, value, attemptId = 'attempt', turn = 1, step = 1, index = 0) => ({
    type: 'transient', event: { type: 'assistant/live-chunk', seq, time: seq * 1000,
      data: { attemptId, turn, step, chunk: { type: 'text-delta', index, text: value } } },
  });
  const entries = freezeDeep([
    live(1, 'hello'), live(2, ' '), live(3, 'world'),
    live(4, 'other block', 'attempt', 1, 1, 1),
    live(5, 'other step', 'attempt', 1, 2),
    live(6, 'other turn', 'attempt', 2),
    live(7, 'other attempt', 'new-attempt'),
  ]);
  const result = extractPreview(entries);
  assert.deepEqual(result.rows.map((row) => row.text), [
    'hello world', 'other block', 'other step', 'other turn', 'other attempt',
  ]);
  assert.equal(result.rows[0].seq, 3);
  assert.equal(result.rows[0].time, 3000);
  assert.equal(result.rows[0].key, extractPreview(entries.slice(0, 1)).rows[0].key);
  const chunks = Array.from({ length: 100 }, (_, i) => live(i, 'a'));
  assert.equal(extractPreview(chunks).rows.length, 1);
  assert.equal(extractPreview(chunks).rows[0].text.length, 100);
});

test('preview honors inclusive surface replacements before applying row limit', () => {
  const replacement = envelope('assistant/message', 6, { message: { role: 'assistant', content: [text('replacement')] } });
  replacement.event.surfaceOp = { op: 'replace', startSeq: 2, endSeq: 4 };
  const entries = freezeDeep([
    envelope('user/message', 1, { content: [text('keep first')] }),
    envelope('assistant/message', 2, { content: [text('OLD lower bound')] }),
    envelope('tool/call', 3, { name: 'OLD middle' }),
    envelope('assistant/message', 4, { content: [text('OLD upper bound')] }),
    envelope('user/message', 5, { content: [text('keep last')] }), replacement,
  ]);
  const result = extractPreview(entries);
  assert.deepEqual(result.rows.map((row) => row.text), ['keep first', 'keep last', 'replacement']);
  assert.equal(JSON.stringify(result).includes('OLD'), false);
  assert.equal(result.latestSeq, 6);
  assert.equal(result.snippet, 'replacement');
  assert.deepEqual(extractPreview(entries, 2).rows.map((row) => row.seq), [5, 6]);
  assert.deepEqual(extractPreview([replacement, ...entries.slice(0, -1)]).rows.map((row) => row.seq), [6, 1, 5]);
});

test('malformed surface operations cannot hide messages and replacement cannot hide itself', () => {
  for (const surfaceOp of ['append', { op: 'append', startSeq: 1, endSeq: 2 },
    { op: 'replace', startSeq: -1, endSeq: 2 }, { op: 'replace', startSeq: 2, endSeq: 1 },
    { op: 'replace', startSeq: '1', endSeq: 2 }, { op: 'replace', startSeq: 1, endSeq: Infinity },
  ]) {
    const marker = envelope('other', 5, {});
    marker.event.surfaceOp = surfaceOp;
    assert.equal(extractPreview([envelope('user/message', 1, { content: [text('keep')] }), marker]).rows.length, 1);
  }
  const replacement = envelope('assistant/message', 5, { content: [text('self')] });
  replacement.event.surfaceOp = { op: 'replace', startSeq: 0, endSeq: 10 };
  assert.equal(extractPreview([replacement]).rows[0].text, 'self');
});

test('preview excludes system/developer messages including conflicting nested message roles', () => {
  const result = extractPreview([
    envelope('system/message', 1, { content: [text('SECRET')] }),
    envelope('developer/message', 2, { content: [text('SECRET')] }),
    envelope('assistant/message', 3, { message: { role: 'system', content: [text('SECRET')] } }),
    envelope('user/message', 4, { role: 'developer', content: [text('SECRET')] }),
    envelope('assistant/message', 5, { message: { role: 'assistant', content: [text('safe')] } }),
  ]);
  assert.deepEqual(result.rows.map((row) => row.text), ['safe']);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('preview does not stringify or recursively inspect unknown payloads', () => {
  const poison = { toString() { throw new Error('must not stringify'); }, token: 'SECRET' };
  const result = extractPreview([
    envelope('assistant/message', 1, { content: poison }),
    envelope('user/message', 2, { content: 'unverified string content' }),
    envelope('assistant/message', 3, { content: [{ type: 'text', text: poison }] }),
    envelope('tool/call', 4, { name: poison }),
    envelope('tool/result', 5, { content: [text('SECRET')] }),
    envelope('other', 6, { text: 'SECRET' }),
    { type: 'transient', event: { type: 'user/message', seq: 7, data: { content: [text('SECRET')] } } },
    { type: 'event', event: { type: 'assistant/live-chunk', seq: 8, data: { chunk: { text: 'SECRET' } } } },
  ]);
  assert.deepEqual(result.rows, []);
  assert.equal(result.latestSeq, 8);
  assert.equal(result.snippet, '');
});

test('preview limits tail rows, reports metadata from skipped events, and bounds snippet', () => {
  const entries = [
    envelope('user/message', 3, { content: [text('old')] }),
    envelope('assistant/message', 1, { content: [text('next')] }),
    envelope('assistant/message', 4, { content: [text(`  newest\n${'x'.repeat(200)}`)] }),
    envelope('assistant/reasoning', 12, { content: [text('SECRET')] }),
  ];
  const result = extractPreview(entries, 2);
  assert.deepEqual(result.rows.map((row) => row.seq), [1, 4]);
  assert.equal(result.latestSeq, 12);
  assert.equal(result.updatedAt, '2026-11-17T10:00:12Z');
  assert.equal(result.snippet.length, 180);
  assert.equal(result.snippet.startsWith('newest '), true);
  assert.deepEqual(extractPreview(entries, 0).rows, []);
  assert.equal(extractPreview(entries, 0).snippet, result.snippet);
  assert.equal(extractPreview(entries, -1).rows.length, 3);
  const many = Array.from({ length: 70 }, (_, i) => envelope('user/message', i, { content: [text(`${i}`)] }, i));
  assert.equal(extractPreview(many).rows.length, 60);
  assert.equal(extractPreview(many).rows[0].seq, 10);
});

test('preview rejects malformed entry envelopes, metadata and empty rows', () => {
  assert.deepEqual(extractPreview(null), { rows: [], latestSeq: 0, updatedAt: null, snippet: '' });
  const entries = [null, false, [], {}, { type: 'event' },
    { type: 'unknown', event: { seq: 999, time: 999, data: { content: [text('bad')] } } },
    envelope('user/message', -1, { content: [text('invalid seq')] }, null),
    envelope('user/message', 1.5, { content: [text('invalid seq')] }, 'bad time'),
    envelope('user/message', 1, { content: [text(' ')] }, Infinity),
    envelope('user/message', 2, null, {}),
    envelope('user/message', 3, { content: [text('safe')] }, { token: 'SECRET' }),
  ];
  const result = extractPreview(entries);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].text, 'safe');
  assert.equal(result.rows[0].time, null);
  assert.equal(result.latestSeq, 3);
  assert.equal(result.updatedAt, null);
});
