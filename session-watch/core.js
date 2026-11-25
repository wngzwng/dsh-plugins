import { createDefaultShortcutConfig, normalizeShortcutConfig, validateShortcutConfig } from './shortcuts.js';
// Pure state and conservative preview helpers. No runtime IO.
const MAX_FOLLOWED = 200;
const BAD_READ_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const validId = (id) => typeof id === 'string' && id.length <= 200 && id.trim().length > 0;
const validSeq = (seq) => Number.isSafeInteger(seq) && seq >= 0;
const validIndex = (index) => Number.isInteger(index) && index >= 0 && index < 4;
const clampRatio = (value, fallback) => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(0.2, Math.min(0.8, value)) : fallback;

/** Use the same title as native Session list/header; title projections are strings. */
export function sessionDisplayTitle(list, id) {
  const summary = list?.byId?.[id];
  const candidates = [summary?.displayTitle, list?.projectionsBySession?.[id]?.values?.title, summary?.projections?.values?.title];
  for (const value of candidates) if (typeof value === 'string' && value.trim()) return value.trim();
  return '未命名会话';
}

/** Returns a new, independently mutable version-1 empty state on every call. */
export function createDefaultState() {
  return {
    version: 1,
    revision: 0,
    followed: [],
    panes: [null, null, null, null],
    mode: 'cards',
    layout: 'columns',
    activePane: 0,
    ratios: { x: 0.5, y: 0.5 },
    read: {},
    shortcuts: createDefaultShortcutConfig(),
  };
}

/** Invalid/unknown layouts safely fall back to the two-pane layout. */
export function visiblePaneCount(layout) {
  return layout === 'quad' ? 4 : 2;
}

/** Sanitizes persisted JSON; ignores unknown properties and never mutates input. */
export function normalizeState(input) {
  const result = createDefaultState();
  if (!isRecord(input)) return result;
  result.shortcuts = normalizeShortcutConfig(input.shortcuts);
  if (validSeq(input.revision)) result.revision = input.revision;
  const followed = new Set();
  if (Array.isArray(input.followed)) {
    for (const id of input.followed) {
      if (validId(id)) followed.add(id);
      if (followed.size === MAX_FOLLOWED) break;
    }
  }
  result.followed = [...followed];
  const assigned = new Set();
  if (Array.isArray(input.panes)) {
    for (let index = 0; index < 4; index += 1) {
      const id = input.panes[index];
      if (followed.has(id) && !assigned.has(id)) {
        result.panes[index] = id;
        assigned.add(id);
      }
    }
  }
  if (input.mode === 'split') result.mode = 'split';
  if (['columns', 'rows', 'quad'].includes(input.layout)) result.layout = input.layout;
  if (validIndex(input.activePane) && input.activePane < visiblePaneCount(result.layout)) {
    result.activePane = input.activePane;
  }
  if (isRecord(input.ratios)) {
    result.ratios.x = clampRatio(input.ratios.x, 0.5);
    result.ratios.y = clampRatio(input.ratios.y, 0.5);
  }
  if (isRecord(input.read)) {
    for (const id of followed) {
      if (!BAD_READ_KEYS.has(id) && own(input.read, id) && validSeq(input.read[id])) {
        result.read[id] = input.read[id];
      }
    }
  }
  return result;
}

function equalState(a, b) {
  if (!isRecord(a) || !Array.isArray(a.followed) || !Array.isArray(a.panes)
    || !isRecord(a.ratios) || !isRecord(a.read)) return false;
  return a.version === b.version && a.revision === b.revision
    && a.mode === b.mode && a.layout === b.layout && a.activePane === b.activePane
    && JSON.stringify(a.shortcuts) === JSON.stringify(b.shortcuts)
    && a.ratios.x === b.ratios.x && a.ratios.y === b.ratios.y
    && a.followed.length === b.followed.length && b.followed.every((id, i) => own(a.followed, i) && id === a.followed[i])
    && a.panes.length === b.panes.length && b.panes.every((id, i) => own(a.panes, i) && id === a.panes[i])
    && Object.keys(a.read).length === Object.keys(b.read).length
    && Object.keys(b.read).every((id) => own(a.read, id) && a.read[id] === b.read[id]);
}

/**
 * Applies one action immutably. Unknown/invalid/no-op actions return the original
 * canonical state by identity. Each actual change increments revision once.
 * assign reveals a hidden target by switching to quad; it always opens split.
 * reorder without beforeId moves to the end; an unknown beforeId is a no-op.
 * At Number.MAX_SAFE_INTEGER revision, changes are refused rather than overflow.
 */
export function reduceState(state, action) {
  const base = normalizeState(state);
  const next = { ...base };
  if (!isRecord(action)) return equalState(state, base) ? state : base;
  switch (action.type) {
    case 'shortcuts':
      if (validateShortcutConfig(action.config).valid) next.shortcuts = normalizeShortcutConfig(action.config);
      break;
    case 'follow': {
      const ids = new Set(base.followed);
      if (!Array.isArray(action.ids)) break;
      for (const id of action.ids) {
        if (ids.size >= MAX_FOLLOWED) break;
        if (validId(id)) ids.add(id);
      }
      next.followed = [...ids];
      break;
    }
    case 'unfollow': {
      if (!base.followed.includes(action.id)) break;
      next.followed = base.followed.filter((id) => id !== action.id);
      next.panes = base.panes.map((id) => id === action.id ? null : id);
      next.read = { ...base.read };
      delete next.read[action.id];
      break;
    }
    case 'assign': {
      if (!validId(action.id)) break;
      const existingIndex = base.panes.indexOf(action.id);
      const index = existingIndex >= 0 ? existingIndex : action.index === undefined ? base.activePane : action.index;
      if (!validIndex(index)) break;
      if (!base.followed.includes(action.id)) {
        if (base.followed.length >= MAX_FOLLOWED) break;
        next.followed = [...base.followed, action.id];
      }
      next.panes = [...base.panes];
      next.panes[index] = action.id;
      next.activePane = index;
      next.mode = 'split';
      if (index >= visiblePaneCount(base.layout)) next.layout = 'quad';
      break;
    }
    case 'remove-pane':
      if (validIndex(action.index)) {
        next.panes = [...base.panes];
        next.panes[action.index] = null;
      }
      break;
    case 'mode':
      if (action.value === 'cards' || action.value === 'split') next.mode = action.value;
      break;
    case 'layout':
      if (['columns', 'rows', 'quad'].includes(action.value)) {
        next.layout = action.value;
        if (base.activePane >= visiblePaneCount(action.value)) next.activePane = 0;
      }
      break;
    case 'active':
      if (validIndex(action.index) && action.index < visiblePaneCount(base.layout)) next.activePane = action.index;
      break;
    case 'ratios':
      next.ratios = {
        x: clampRatio(action.x, base.ratios.x),
        y: clampRatio(action.y, base.ratios.y),
      };
      break;
    case 'read':
      if (base.followed.includes(action.id) && !BAD_READ_KEYS.has(action.id) && validSeq(action.seq)
        && (!own(base.read, action.id) || action.seq > base.read[action.id])) {
        next.read = { ...base.read, [action.id]: action.seq };
      }
      break;
    case 'reorder': {
      if (!base.followed.includes(action.id) || action.id === action.beforeId) break;
      if (action.beforeId !== undefined && !base.followed.includes(action.beforeId)) break;
      next.followed = base.followed.filter((id) => id !== action.id);
      const index = action.beforeId === undefined ? next.followed.length : next.followed.indexOf(action.beforeId);
      next.followed.splice(index, 0, action.id);
      break;
    }
    default:
      break;
  }
  if (equalState(state, next)) return state;
  if (base.revision === Number.MAX_SAFE_INTEGER) return equalState(state, base) ? state : base;
  next.revision = base.revision + 1;
  return next;
}

// Deliberately do not walk arbitrary objects, stringify payloads, read tool
// arguments/results, or fall back to reasoning/thinking fields.
function contentText(content) {
  if (!Array.isArray(content)) return '';
  return content.filter((block) => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text).join('\n');
}

function liveText(chunk) {
  return isRecord(chunk) && chunk.type === 'text-delta' && typeof chunk.text === 'string' ? chunk.text : '';
}

function liveGroupKey(data) {
  if (!validId(data.attemptId) || !validSeq(data.turn) || !validSeq(data.step)
    || !isRecord(data.chunk) || !validSeq(data.chunk.index)) return null;
  // Every value here is a validated scalar, never an arbitrary payload object.
  return `live:${JSON.stringify([data.attemptId, data.turn, data.step, data.chunk.index])}`;
}

function replacementRanges(entries) {
  const ranges = [];
  for (const entry of entries) {
    if (!isRecord(entry) || entry.type !== 'event' || !isRecord(entry.event)) continue;
    const { surfaceOp, seq } = entry.event;
    if (validSeq(seq) && isRecord(surfaceOp) && surfaceOp.op === 'replace'
      && validSeq(surfaceOp.startSeq) && validSeq(surfaceOp.endSeq) && surfaceOp.startSeq <= surfaceOp.endSeq) {
      ranges.push({ start: surfaceOp.startSeq, end: surfaceOp.endSeq, by: seq });
    }
  }
  return ranges;
}

function eventTime(time) {
  if (typeof time === 'number' && Number.isFinite(time) && time >= 0) return time;
  if (typeof time === 'string' && time.length <= 100 && Number.isFinite(Date.parse(time))) return time;
  return null;
}

/**
 * Conservative SessionEventLikeEntry[] preview. limit is a tail-row count (0 is
 * allowed), not a character budget. Unknown message shapes are intentionally
 * omitted, never guessed. latestSeq/updatedAt cover ALL recognized entry
 * envelopes, even events whose payloads are not previewed. Inclusive replace
 * surface ranges hide older events, but not the replacing event itself.
 * rows preserve input order; durable identity is type + seq, independent of paging.
 * text-delta chunks aggregate by attemptId/turn/step/block index, with a stable
 * live key and the final chunk's seq/time; other stream chunk types are ignored.
 * updatedAt preserves the latest valid timestamp's input type, or is null.
 * snippet is the final safe text, whitespace-collapsed and capped at 180 chars.
 */
export function extractPreview(entries, limit = 60) {
  const rows = [];
  const liveGroups = new Map();
  let latestSeq = 0;
  let updatedAt = null;
  let newestTime = -Infinity;
  if (Array.isArray(entries)) {
    const replacements = replacementRanges(entries);
    entries.forEach((entry, index) => {
      if (!isRecord(entry) || !['event', 'transient'].includes(entry.type) || !isRecord(entry.event)) return;
      const event = entry.event;
      const seq = validSeq(event.seq) ? event.seq : null;
      if (seq !== null) latestSeq = Math.max(latestSeq, seq);
      const time = eventTime(event.time);
      const timestamp = typeof time === 'string' ? Date.parse(time) : time;
      if (time !== null && timestamp >= newestTime) {
        newestTime = timestamp;
        updatedAt = time;
      }
      if (seq === null || !isRecord(event.data)) return;
      if (replacements.some((range) => seq < range.by && seq >= range.start && seq <= range.end)) return;
      let role;
      let text = '';
      if (entry.type === 'event' && (event.type === 'user/message' || event.type === 'assistant/message')) {
        role = event.type === 'user/message' ? 'user' : 'assistant';
        if (event.data.role !== undefined && event.data.role !== role) return;
        if (isRecord(event.data.message) && event.data.message.role !== undefined && event.data.message.role !== role) return;
        text = contentText(event.data.content);
        if (!text && isRecord(event.data.message)) text = contentText(event.data.message.content);
      } else if (entry.type === 'event' && event.type === 'tool/call') {
        role = 'tool';
        if (typeof event.data.name === 'string') text = event.data.name;
      } else if (entry.type === 'transient' && event.type === 'assistant/live-chunk') {
        role = 'assistant';
        text = liveText(event.data.chunk);
      }
      if (!role || !text) return;
      if (entry.type === 'transient') {
        const key = liveGroupKey(event.data);
        if (key !== null) {
          const existing = liveGroups.get(key);
          if (existing) {
            existing.text += text;
            existing.seq = seq;
            existing.time = time;
          } else {
            const row = { key, seq, time, role, text };
            liveGroups.set(key, row);
            rows.push(row);
          }
          return;
        }
      }
      rows.push({ key: entry.type === 'event' ? `event:${seq}` : `transient:${seq}:${index}`, seq, time, role, text });
    });
  }
  const count = Number.isSafeInteger(limit) && limit >= 0 ? limit : 60;
  const nonemptyRows = rows.filter((row) => row.text.trim());
  const visibleRows = count === 0 ? [] : nonemptyRows.slice(-count);
  return {
    rows: visibleRows,
    latestSeq,
    updatedAt,
    snippet: nonemptyRows.length ? nonemptyRows[nonemptyRows.length - 1].text.replace(/\s+/g, ' ').trim().slice(0, 180) : '',
  };
}
