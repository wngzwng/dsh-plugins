// Pure shortcut configuration, matching and pane geometry. No DOM or side effects.
export const SHORTCUT_ACTIONS = Object.freeze([
  ['pane.left', '左侧窗格', '切换到左侧相邻窗格'],
  ['pane.right', '右侧窗格', '切换到右侧相邻窗格'],
  ['pane.up', '上方窗格', '切换到上方相邻窗格'],
  ['pane.down', '下方窗格', '切换到下方相邻窗格'],
  ['pane.1', '窗格 1', '选择当前布局中的第一个窗格'],
  ['pane.2', '窗格 2', '选择当前布局中的第二个窗格'],
  ['pane.3', '窗格 3', '选择当前布局中的第三个窗格'],
  ['pane.4', '窗格 4', '选择当前布局中的第四个窗格'],
  ['pane.previous', '上一窗格', '返回上一个可用窗格'],
  ['pane.maximize', '最大化／恢复', '切换当前窗格最大化状态'],
  ['search', '搜索关注会话', '聚焦工作台关注列表搜索框'],
  ['editor.focus', '聚焦输入', '聚焦当前窗格的原生输入区，不发送消息'],
  ['workbench.show', '显示／聚焦工作台', '打开工作台或聚焦已经打开的工作台'],
].map(([id, label, description]) => Object.freeze({ id, label, description })));

const ACTION_IDS = new Set(SHORTCUT_ACTIONS.map(item => item.id));
const DIRECTIONS = new Set(['pane.left', 'pane.right', 'pane.up', 'pane.down']);
const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
const MAX_BINDINGS = 13;
const MAX_ALTERNATIVES = 8;
const MAX_KEY_LENGTH = 64;
const PREFIX_TIMEOUT = 1200;
const DEFAULT_PREFIX = 'Ctrl+;';
const RESERVED_LETTERS = new Set(['W', 'T', 'R', 'N', 'L', 'F', 'A', 'C', 'V', 'X', 'Y', 'Z', 'P']);
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const NAMED_KEYS = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', 'Escape', ...Array.from({ length: 12 }, (_, i) => 'F' + (i + 1))];
const NAMED_BY_LOWER = new Map(NAMED_KEYS.map(key => [key.toLowerCase(), key]));
const PUNCTUATION = new Set([';', '/', '.', ',', '-', '=', '[', ']', '\\', '`', "'"]);
const SHIFTED_KEYS = new Map(Object.entries({ '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', ':': ';', '?': '/', '<': ',', '>': '.', '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\', '~': '`', '"': "'" }));
const CODE_KEYS = new Map([
  ...NAMED_KEYS.map(key => [key, key]),
  ['Semicolon', ';'], ['Slash', '/'], ['Period', '.'], ['Comma', ','],
  ['Minus', '-'], ['Equal', '='], ['BracketLeft', '['], ['BracketRight', ']'],
  ['Backslash', '\\'], ['Backquote', '`'], ['Quote', "'"],
]);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
// Configuration fields must be own data properties; never execute accessors.
const field = (value, key) => own(value, key) ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;
const safeShape = (value, allowed) => record(value) && Object.getOwnPropertySymbols(value).length === 0 && Object.keys(value).every(key => !BAD_KEYS.has(key) && allowed.includes(key) && own(Object.getOwnPropertyDescriptor(value, key), 'value'));
const dataArray = (value, max, min = 0) => Array.isArray(value) && value.length >= min && value.length <= max && Object.getOwnPropertySymbols(value).length === 0 && Object.keys(value).length === value.length && Object.keys(value).every((key, index) => key === String(index) && own(Object.getOwnPropertyDescriptor(value, key), 'value'));

function keyName(value) {
  if (typeof value !== 'string') return null;
  if (/^[a-z0-9]$/i.test(value)) return value.toUpperCase();
  if (PUNCTUATION.has(value)) return value;
  return NAMED_BY_LOWER.get(value.toLowerCase()) || null;
}
function parseStroke(value) {
  if (typeof value !== 'string' || !value.length || value.length > MAX_KEY_LENGTH || value.trim() !== value || /\s/.test(value)) return null;
  const parts = value.split('+');
  const key = keyName(parts.pop());
  if (!key) return null;
  const mods = [];
  for (const part of parts) {
    const mod = MODIFIERS.find(item => item.toLowerCase() === part.toLowerCase());
    if (!mod || mods.includes(mod)) return null;
    mods.push(mod);
  }
  const canonicalMods = MODIFIERS.filter(mod => mods.includes(mod));
  return { key, mods: canonicalMods, text: [...canonicalMods, key].join('+') };
}
function nativeReserved(stroke) {
  if (stroke.text === 'Ctrl+B') return true; // DSH owns this key, including while a sequence is pending.
  if (stroke.key === 'Escape') return true;
  if (stroke.key === 'Enter' && (stroke.mods.length === 0 || stroke.mods.includes('Ctrl') || stroke.mods.includes('Meta'))) return true;
  return RESERVED_LETTERS.has(stroke.key) && (stroke.mods.includes('Ctrl') || stroke.mods.includes('Meta'));
}
function leaderEligible(stroke) {
  return stroke.mods.some(mod => mod === 'Ctrl' || mod === 'Alt' || mod === 'Meta');
}
function parseBinding(value, prefix, legacyPrefix = false) {
  if (typeof value !== 'string' || !value.length || value.length > MAX_KEY_LENGTH || value.trim() !== value) return null;
  const parts = value.split(' ');
  if (parts.length > 2 || parts.some(part => !part)) return null;
  const placeholder = parts[0].toLowerCase() === 'prefix';
  if (placeholder && parts.length !== 2) return null;
  const strokes = parts.map((part, i) => i === 0 && placeholder ? prefix : parseStroke(part));
  if (strokes.some(stroke => !stroke) || !leaderEligible(strokes[0]) || strokes.some((stroke, index) => nativeReserved(stroke) && !(legacyPrefix && index === 0 && stroke.text === 'Ctrl+B'))) return null;
  return { text: strokes.map((stroke, i) => i === 0 && placeholder ? 'Prefix' : stroke.text).join(' '), strokes: strokes.map(stroke => stroke.text) };
}

export function createDefaultShortcutConfig() {
  const keys = [
    ['Ctrl+ArrowLeft', 'Prefix H'], ['Ctrl+ArrowRight', 'Prefix L'],
    ['Ctrl+ArrowUp', 'Prefix K'], ['Ctrl+ArrowDown', 'Prefix J'],
    ['Prefix 1'], ['Prefix 2'], ['Prefix 3'], ['Prefix 4'],
    ['Prefix ;'], ['Prefix Z'], ['Prefix /'], ['Prefix I'], ['Ctrl+Alt+M'],
  ];
  return { version: 1, enabled: true, prefix: DEFAULT_PREFIX, bindings: SHORTCUT_ACTIONS.map((item, index) => ({ action: item.id, enabled: true, scopes: item.id === 'workbench.show' ? ['local', 'outside'] : ['local'], keys: [...keys[index]] })) };
}

function inspectConfig(input, allowLegacyPrefix = false) {
  const errors = [];
  const add = (message, action) => errors.push(action === undefined ? { message } : { action, message });
  if (!safeShape(input, ['version', 'enabled', 'prefix', 'bindings'])) return { errors: [{ message: '快捷键配置必须是有效的普通数据对象，且不能包含未知字段或访问器。' }] };
  if (field(input, 'version') !== 1) add('不支持的快捷键配置版本。');
  if (typeof field(input, 'enabled') !== 'boolean') add('总开关必须为布尔值。');
  const prefix = parseStroke(field(input, 'prefix'));
  const legacyPrefix = allowLegacyPrefix && prefix?.text === 'Ctrl+B';
  if (!prefix || !leaderEligible(prefix) || (nativeReserved(prefix) && !legacyPrefix)) add('前缀必须包含 Ctrl、Alt 或 Meta，且不能占用原生或浏览器保留键（Ctrl+B 已由 DSH 使用）。');
  const source = field(input, 'bindings');
  if (!dataArray(source, MAX_BINDINGS)) return { errors: [...errors, { message: '快捷键条目必须为数组且不超过 13 条。' }] };
  const bindings = [];
  const sequences = [];
  const actions = new Set();
  for (let itemIndex = 0; itemIndex < source.length; itemIndex++) {
    const item = field(source, String(itemIndex));
    if (!safeShape(item, ['action', 'enabled', 'scopes', 'keys'])) { add('快捷键条目包含非法字段或访问器。'); continue; }
    const action = field(item, 'action');
    if (!ACTION_IDS.has(action)) { add('未知快捷键动作。'); continue; }
    if (actions.has(action)) add('同一动作只能配置一个条目。', action);
    actions.add(action);
    const enabled = field(item, 'enabled') === undefined ? true : field(item, 'enabled');
    if (typeof enabled !== 'boolean') add('启用状态必须为布尔值。', action);
    const rawScopes = field(item, 'scopes');
    const scopes = rawScopes === undefined ? ['local'] : rawScopes;
    const scopeOk = dataArray(scopes, 2, 1) && Array.prototype.every.call(scopes, scope => scope === 'local' || scope === 'outside');
    if (!scopeOk) add('至少选择局内或局外，且只能使用这两种作用域。', action);
    const normalizedScopes = scopeOk ? ['local', 'outside'].filter(scope => Array.prototype.includes.call(scopes, scope)) : [];
    const rawKeys = field(item, 'keys');
    if (!dataArray(rawKeys, MAX_ALTERNATIVES, 1)) { add('每个动作需有 1～8 个备选按键。', action); continue; }
    const keys = [];
    for (let keyIndex = 0; keyIndex < rawKeys.length; keyIndex++) {
      const value = field(rawKeys, String(keyIndex));
      const parsed = prefix && parseBinding(value, prefix, legacyPrefix);
      if (!parsed) { add('按键格式无效、过长，或占用了原生／浏览器保留键。', action); continue; }
      keys.push(parsed.text);
      if (enabled === true && scopeOk) sequences.push({ action, scopes: normalizedScopes, strokes: parsed.strokes });
    }
    bindings.push({ action, enabled: enabled === true, scopes: normalizedScopes, keys });
  }
  for (let i = 0; i < sequences.length; i++) {
    const left = sequences[i];
    if (prefix && left.strokes.length === 1 && left.strokes[0] === prefix.text) add('单步绑定不能占用公共前缀键。', left.action);
    for (let j = 0; j < i; j++) {
      const right = sequences[j];
      if (!left.scopes.some(scope => right.scopes.includes(scope))) continue;
      if (left.strokes[0] !== right.strokes[0]) continue;
      if (left.strokes.length === 1 || right.strokes.length === 1 || left.strokes[1] === right.strokes[1]) add(`与 ${right.action} 的按键或序列前缀冲突。`, left.action);
    }
  }
  return { errors, config: { version: 1, enabled: field(input, 'enabled') === true, prefix: prefix?.text || DEFAULT_PREFIX, bindings }, sequences };
}

export function validateShortcutConfig(input) {
  const { errors } = inspectConfig(input);
  return { valid: errors.length === 0, errors };
}
export function normalizeShortcutConfig(input) {
  if (input === undefined || input === null) return createDefaultShortcutConfig();
  // Only persistence normalization admits the old leader; new saves remain strict.
  let inspected = inspectConfig(input, true);
  if (!inspected.errors.length && inspected.config.prefix === 'Ctrl+B') {
    const migrated = { ...inspected.config, prefix: DEFAULT_PREFIX, bindings: inspected.config.bindings.map(item => ({
      ...item, keys: item.keys.map(key => key.startsWith('Ctrl+B ') ? DEFAULT_PREFIX + key.slice('Ctrl+B'.length) : key),
    })) };
    // A pre-existing fixed Ctrl+; sequence may collide with the migrated leader.
    inspected = inspectConfig(migrated);
  }
  // Never revive dangerous or ambiguous bindings from corrupted persistence.
  return inspected.errors.length ? { version: 1, enabled: false, prefix: DEFAULT_PREFIX, bindings: [] } : inspected.config;
}

export function shortcutStroke(event) {
  if (!event || event.isComposing || event.keyCode === 229) return null;
  let value = event.key;
  if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'Dead', 'Process'].includes(value)) return null;
  // Physical keys survive Option/localized layouts. A known code also supports
  // native synthetic events with an absent/Unidentified key, but never IME input.
  const code = event.code;
  let key = typeof code === 'string' && (/^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit[0-9]$/.test(code) ? code.slice(5) : CODE_KEYS.get(code));
  if (!key) {
    if (value === ' ' || value === 'Spacebar') value = 'Space';
    value = SHIFTED_KEYS.get(value) || value;
    key = keyName(value);
  }
  if (!key) return null;
  return [...MODIFIERS.filter(mod => event[{ Ctrl: 'ctrlKey', Alt: 'altKey', Shift: 'shiftKey', Meta: 'metaKey' }[mod]] === true), key].join('+');
}

export function createShortcutMatcher() {
  let pending = null;
  let last = null;
  let contextSignature = '';
  const reset = () => { pending = null; last = null; contextSignature = ''; };
  const idle = () => ({ handled: false });
  return {
    reset,
    handle(event, context) {
      let altGraph = false;
      try { altGraph = event?.getModifierState?.('AltGraph') === true; } catch { altGraph = true; }
      if (!event || !context || event.defaultPrevented || event.isComposing || event.keyCode === 229 || altGraph || context.suspended || !['local', 'outside'].includes(context.scope) || typeof context.canRun !== 'function') { reset(); return idle(); }
      const inspected = inspectConfig(context.config);
      if (inspected.errors.length || !inspected.config.enabled) { reset(); return idle(); }
      const signature = context.scope + ':' + JSON.stringify(inspected.config);
      if (signature !== contextSignature) { pending = null; last = null; contextSignature = signature; }
      const canRun = action => { try { return context.canRun(action) === true; } catch { return false; } };
      const eligible = inspected.sequences.filter(item => item.scopes.includes(context.scope) && canRun(item.action));
      const now = typeof context.now === 'number' && Number.isFinite(context.now) ? context.now : Date.now();
      if (pending && (now < pending.started || now - pending.started >= PREFIX_TIMEOUT)) pending = null;
      if (pending && !eligible.some(item => item.strokes.length === 2 && item.strokes[0] === pending.first)) pending = null;
      const stroke = shortcutStroke(event);
      if (!stroke) {
        if (pending && ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return { handled: false, pending: true };
        const handled = pending !== null; pending = null; last = null;
        return { handled };
      }
      // Reserved DSH keys must pass through even after an otherwise valid leader.
      if (stroke === 'Ctrl+B') { reset(); return idle(); }
      // Even a custom leader/continuation must never steal Ctrl+arrows from an editor.
      if (context.editing && stroke.startsWith('Ctrl+') && /Arrow(Left|Right|Up|Down)$/.test(stroke)) { pending = null; last = null; return idle(); }
      if (pending && event.repeat && stroke === pending.first) return { handled: true, pending: true };
      if (pending) {
        const first = pending.first; pending = null; last = null;
        const found = eligible.find(item => item.strokes.length === 2 && item.strokes[0] === first && item.strokes[1] === stroke);
        if (!found) return { handled: true }; // Consume one unknown continuation, never run an action.
        last = { action: found.action, stroke, sequence: true };
        if (event.repeat && !DIRECTIONS.has(found.action)) return { handled: true };
        return { handled: true, action: found.action };
      }
      const directAllowed = action => !context.editing || (action === 'workbench.show' && stroke.includes('Alt+') && (stroke.startsWith('Ctrl+') || stroke.includes('Meta+')));
      if (event.repeat) {
        if (last && last.stroke === stroke && (last.sequence || directAllowed(last.action)) && eligible.some(item => item.action === last.action)) return DIRECTIONS.has(last.action) ? { handled: true, action: last.action } : { handled: true };
        const repeatable = eligible.find(item => item.strokes.length === 1 && item.strokes[0] === stroke && DIRECTIONS.has(item.action) && directAllowed(item.action));
        if (repeatable) { last = { action: repeatable.action, stroke, sequence: false }; return { handled: true, action: repeatable.action }; }
        return idle();
      }
      last = null;
      {
        const found = eligible.find(item => item.strokes.length === 1 && item.strokes[0] === stroke && directAllowed(item.action));
        if (found) { last = { action: found.action, stroke, sequence: false }; return { handled: true, action: found.action }; }
      }
      if (eligible.some(item => item.strokes.length === 2 && item.strokes[0] === stroke)) {
        pending = { first: stroke, started: now };
        return { handled: true, pending: true };
      }
      return idle();
    },
  };
}

export function paneShortcutTarget(layout, index, direction) {
  if (!Number.isInteger(index) || index < 0) return null;
  const dimensions = layout === 'quad' ? [2, 2] : layout === 'columns' ? [2, 1] : layout === 'rows' ? [1, 2] : null;
  if (!dimensions || index >= dimensions[0] * dimensions[1]) return null;
  const delta = direction === 'left' ? [-1, 0] : direction === 'right' ? [1, 0] : direction === 'up' ? [0, -1] : direction === 'down' ? [0, 1] : null;
  if (!delta) return null;
  const x = index % dimensions[0] + delta[0]; const y = Math.floor(index / dimensions[0]) + delta[1];
  return x < 0 || y < 0 || x >= dimensions[0] || y >= dimensions[1] ? null : y * dimensions[0] + x;
}
