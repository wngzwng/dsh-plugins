import test from 'node:test';
import assert from 'node:assert/strict';
import { SHORTCUT_ACTIONS, createDefaultShortcutConfig, normalizeShortcutConfig, validateShortcutConfig, shortcutStroke, createShortcutMatcher, paneShortcutTarget } from '../shortcuts.js';

const defaultConfig = () => createDefaultShortcutConfig();
const config = (bindings, extra = {}) => ({ version: 1, enabled: true, prefix: 'Ctrl+;', bindings, ...extra });
const binding = (action, keys, scopes = ['local'], enabled = true) => ({ action, enabled, scopes, keys });
const event = (key, options = {}) => ({ key, ...options });
const ctrl = (key, options = {}) => event(key, { ctrlKey: true, ...options });
const context = (options = {}) => ({ config: defaultConfig(), scope: 'local', editing: false, suspended: false, canRun: () => true, now: 0, ...options });
const valid = value => assert.deepEqual(validateShortcutConfig(value), { valid: true, errors: [] });
const invalid = value => { const result = validateShortcutConfig(value); assert.equal(result.valid, false); assert.ok(result.errors.length); assert.ok(result.errors.every(item => typeof item.message === 'string')); return result; };
const prefix = (matcher, ctx = context()) => assert.deepEqual(matcher.handle(ctrl(';'), ctx), { handled: true, pending: true });

test('legacy Ctrl+B prefix migrates without mutating settings; other custom leaders remain unchanged', () => {
  const old = { ...defaultConfig(), enabled: false, prefix: 'ctrl+b' };
  old.bindings[0].scopes = ['local', 'outside'];
  old.bindings.find(item => item.action === 'search').keys = ['ctrl+b /'];
  const before = structuredClone(old); invalid(old);
  const migrated = normalizeShortcutConfig(old); valid(migrated);
  assert.equal(migrated.prefix, 'Ctrl+;'); assert.equal(migrated.enabled, false);
  assert.deepEqual(migrated.bindings[0].scopes, ['local', 'outside']);
  assert.deepEqual(migrated.bindings[0].keys, old.bindings[0].keys);
  assert.deepEqual(migrated.bindings.find(item => item.action === 'search').keys, ['Ctrl+; /']);
  assert.deepEqual(old, before);
  const custom = { ...defaultConfig(), prefix: 'Ctrl+Alt+B' };
  assert.deepEqual(normalizeShortcutConfig(custom), custom);
});
test('migration collisions fail closed, and new Ctrl+B leader/single/sequence saves are rejected', () => {
  const old = { ...defaultConfig(), prefix: 'Ctrl+B' };
  old.bindings.find(item => item.action === 'editor.focus').keys = ['Ctrl+; H'];
  assert.deepEqual(normalizeShortcutConfig(old), { version: 1, enabled: false, prefix: 'Ctrl+;', bindings: [] });
  invalid(config([], { prefix: 'Ctrl+B' }));
  for (const key of ['Ctrl+B', 'Ctrl+B X', 'Prefix Ctrl+B']) invalid(config([binding('search', [key])]));
});
test('DSH Ctrl+B passes through in all scopes and cancels pending sequences without dispatch', () => {
  for (const scope of ['local', 'outside']) for (const editing of [false, true]) {
    const matcher = createShortcutMatcher(); const ctx = context({ scope, editing });
    assert.deepEqual(matcher.handle(ctrl('b'), ctx), { handled: false });
    if (scope === 'local') prefix(matcher, ctx);
    assert.deepEqual(matcher.handle(ctrl('B', { repeat: true }), ctx), { handled: false });
    assert.deepEqual(matcher.handle(event('h'), ctx), { handled: false });
  }
});

test('action contract is exactly 13 immutable whitelisted metadata records', () => {
  assert.equal(SHORTCUT_ACTIONS.length, 13);
  assert.equal(new Set(SHORTCUT_ACTIONS.map(item => item.id)).size, 13);
  for (const item of SHORTCUT_ACTIONS) { assert.deepEqual(Object.keys(item), ['id', 'label', 'description']); assert.ok(item.label); assert.ok(item.description); assert.ok(Object.isFrozen(item)); }
  assert.ok(Object.isFrozen(SHORTCUT_ACTIONS));
  assert.equal(SHORTCUT_ACTIONS.some(item => /prompt|cancel|approv/.test(item.id)), false);
});
test('defaults are valid, independent, complete and only show defaults to both scopes', () => {
  const a = defaultConfig(); const b = defaultConfig(); valid(a);
  assert.equal(a.version, 1); assert.equal(a.enabled, true); assert.equal(a.prefix, 'Ctrl+;');
  assert.equal(a.bindings.length, 13);
  assert.deepEqual(a.bindings.find(item => item.action === 'workbench.show').scopes, ['local', 'outside']);
  assert.ok(a.bindings.filter(item => item.action !== 'workbench.show').every(item => item.scopes.join() === 'local'));
  a.bindings[0].keys.push('Ctrl+K X'); a.bindings[0].scopes.push('outside');
  assert.equal(b.bindings[0].keys.length, 2); assert.deepEqual(b.bindings[0].scopes, ['local']);
});
test('missing persistence defaults but corrupted persistence is disabled with no active bindings', () => {
  assert.deepEqual(normalizeShortcutConfig(undefined), defaultConfig());
  assert.deepEqual(normalizeShortcutConfig(null), defaultConfig());
  for (const bad of [{}, [], 'oops', config([binding('unknown', ['Ctrl+Q'])]), { ...defaultConfig(), version: 2 }]) {
    assert.deepEqual(normalizeShortcutConfig(bad), { version: 1, enabled: false, prefix: 'Ctrl+;', bindings: [] });
  }
});
test('normalization canonicalizes without mutating, and absent scopes always means local', () => {
  const input = config([{ action: 'workbench.show', keys: ['ctrl+alt+m'] }, { action: 'search', keys: ['prefix /'], scopes: ['outside', 'local'] }], { prefix: 'ctrl+;' });
  const before = structuredClone(input); valid(input);
  const normalized = normalizeShortcutConfig(input);
  assert.deepEqual(normalized.bindings[0], { action: 'workbench.show', enabled: true, scopes: ['local'], keys: ['Ctrl+Alt+M'] });
  assert.deepEqual(normalized.bindings[1].scopes, ['local', 'outside']);
  assert.deepEqual(input, before);
});
test('scopes are nonexclusive; disjoint identical keys do not conflict but overlapping keys do', () => {
  valid(config([binding('search', ['Ctrl+Q'], ['local']), binding('editor.focus', ['Ctrl+Q'], ['outside'])]));
  invalid(config([binding('search', ['Ctrl+Q'], ['local']), binding('editor.focus', ['Ctrl+Q'], ['local', 'outside'])]));
  invalid(config([binding('search', ['Ctrl+Q'], [])]));
  invalid(config([binding('search', ['Ctrl+Q'], ['global'])]));
});
test('disabled entries do not conflict; master disable does not hide conflicting bindings', () => {
  valid(config([binding('search', ['Ctrl+Q']), binding('editor.focus', ['Ctrl+Q'], ['local'], false)]));
  invalid(config([binding('search', ['Ctrl+Q']), binding('editor.focus', ['Ctrl+Q'])], { enabled: false }));
});
test('rejects duplicate actions, duplicate alternatives, prefix ambiguity and common-prefix singles', () => {
  invalid(config([binding('search', ['Ctrl+Q']), binding('search', ['Ctrl+K'])]));
  invalid(config([binding('search', ['Ctrl+Q', 'ctrl+q'])]));
  invalid(config([binding('search', ['Ctrl+K']), binding('editor.focus', ['Ctrl+K X'])]));
  invalid(config([binding('search', ['Prefix H']), binding('editor.focus', ['Ctrl+; H'])]));
  invalid(config([binding('search', ['Ctrl+;'])]));
  valid(config([binding('search', ['Ctrl+K X']), binding('editor.focus', ['Ctrl+K Y'])]));
});
test('controlled grammar rejects unsafe, ambiguous, oversized or empty keys', () => {
  for (const key of ['h', '1', '/', 'Shift+H', 'Prefix', 'Prefix H Z', 'Ctrl+Ctrl+H', 'Ctrl++H', 'Control+H', 'Ctrl+;ogus', ' Ctrl+H', 'Ctrl+H ', 'Ctrl+K  X', 'x'.repeat(100)]) invalid(config([binding('search', [key])]));
  for (const key of ['Ctrl+Enter', 'Meta+Enter', 'Enter', 'Escape', 'Ctrl+W', 'Meta+T', 'Ctrl+Shift+R', 'Ctrl+N', 'Meta+L', 'Ctrl+F']) invalid(config([binding('search', [key])]));
  valid(config([binding('search', ['Ctrl+K Space', 'Alt+/', 'Meta+Shift+;', 'Ctrl+F6'])]));
  for (const badPrefix of ['B', 'Shift+B', 'Ctrl+W', 'Escape', 'Prefix', 'Ctrl+; X']) invalid(config([], { prefix: badPrefix }));
  invalid(config([binding('search', [])])); invalid(config([binding('search', Array(9).fill('Ctrl+Q'))]));
  invalid(config(Array(14).fill(binding('search', ['Ctrl+Q']))));
});
test('prototype-sensitive fields, inherited fields, arrays and accessors fail safely', () => {
  const polluted = JSON.parse('{"version":1,"enabled":true,"prefix":"Ctrl+;","bindings":[],"__proto__":{"polluted":true}}');
  invalid(polluted); assert.equal({}.polluted, undefined);
  invalid(config([binding('__proto__', ['Ctrl+Q'])]));
  invalid(config([{ ...binding('search', ['Ctrl+Q']), constructor: 'bad' }]));
  invalid(Object.create(defaultConfig()));
  const accessor = defaultConfig(); Object.defineProperty(accessor, 'prefix', { enumerable: true, get() { throw new Error('must not execute'); } });
  assert.doesNotThrow(() => invalid(accessor));
  invalid(config([Object.create(binding('search', ['Ctrl+Q']))]));
  invalid(config([binding('search', ['Ctrl+Q'], Array(1))]));
});
test('stroke normalization controls names, modifier order, layout case and punctuation', () => {
  assert.equal(shortcutStroke(event('h')), 'H'); assert.equal(shortcutStroke(event('H')), 'H');
  assert.equal(shortcutStroke(event('H', { shiftKey: true })), 'Shift+H');
  assert.equal(shortcutStroke(event('m', { metaKey: true, shiftKey: true, altKey: true, ctrlKey: true })), 'Ctrl+Alt+Shift+Meta+M');
  assert.equal(shortcutStroke(ctrl('ArrowLeft')), 'Ctrl+ArrowLeft');
  assert.equal(shortcutStroke(event(' ')), 'Space'); assert.equal(shortcutStroke(event(';')), ';'); assert.equal(shortcutStroke(event('/')), '/');
  assert.equal(shortcutStroke(event('?', { shiftKey: true })), 'Shift+/');
  assert.equal(shortcutStroke(event('!', { shiftKey: true })), 'Shift+1');
  assert.equal(shortcutStroke(null), null);
  for (const key of ['Control', 'Alt', 'Meta', 'Shift', 'Dead', 'Process', 'Unidentified', '汉', 'F24']) assert.equal(shortcutStroke(event(key)), null);
  assert.equal(shortcutStroke(event('h', { isComposing: true })), null);
});
test('physical codes normalize letters, digits, punctuation and supported named keys to configuration grammar', () => {
  const codes = [
    ...Array.from({ length: 26 }, (_, i) => { const key = String.fromCharCode(65 + i); return ['Key' + key, key]; }),
    ...Array.from({ length: 10 }, (_, i) => ['Digit' + i, String(i)]),
    ['Semicolon', ';'], ['Slash', '/'], ['Period', '.'], ['Comma', ','],
    ['Minus', '-'], ['Equal', '='], ['BracketLeft', '['], ['BracketRight', ']'],
    ['Backslash', '\\'], ['Backquote', '`'], ['Quote', "'"],
    ...['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', 'Escape', ...Array.from({ length: 12 }, (_, i) => 'F' + (i + 1))].map(key => [key, key]),
  ];
  for (const [code, key] of codes) {
    assert.equal(shortcutStroke(event('localized', { code, shiftKey: true })), 'Shift+' + key, code);
    if (key !== 'Escape') valid(config([binding('search', ['Alt+' + key])]));
  }
  assert.equal(shortcutStroke(ctrl('µ', { code: 'KeyM', altKey: true })), 'Ctrl+Alt+M');
  assert.equal(shortcutStroke(ctrl('；', { code: 'Semicolon' })), 'Ctrl+;');
  assert.equal(shortcutStroke(ctrl('b', { code: 'KeyQ' })), 'Ctrl+Q');
});
test('localized physical shortcut events open the workbench and complete prefix sequences', () => {
  const matcher = createShortcutMatcher();
  for (const scope of ['local', 'outside']) {
    assert.deepEqual(matcher.handle(ctrl('µ', { code: 'KeyM', altKey: true }), context({ scope, editing: true })), { handled: true, action: 'workbench.show' });
  }
  const ctx = context({ editing: true });
  assert.deepEqual(matcher.handle(ctrl('；', { code: 'Semicolon' }), ctx), { handled: true, pending: true });
  assert.deepEqual(matcher.handle(event('／', { code: 'Slash' }), ctx), { handled: true, action: 'search' });
});
test('physical Ctrl+B stays reserved despite a conflicting key, including pending sequences', () => {
  const cfg = config([binding('search', ['Prefix H'], ['local', 'outside'])]);
  for (const scope of ['local', 'outside']) for (const editing of [false, true]) {
    const matcher = createShortcutMatcher(); const ctx = context({ config: cfg, scope, editing });
    const reserved = ctrl(';', { code: 'KeyB' });
    assert.equal(shortcutStroke(reserved), 'Ctrl+B');
    assert.deepEqual(matcher.handle(reserved, ctx), { handled: false });
    prefix(matcher, ctx);
    assert.deepEqual(matcher.handle(reserved, ctx), { handled: false });
    assert.deepEqual(matcher.handle(event('h', { code: 'KeyH' }), ctx), { handled: false });
  }
});
test('unknown codes safely fall back to key-only input while known codes allow native synthetic keys', () => {
  for (const code of [undefined, '', 'Unidentified', 'UnknownCode', 'Keym', 'Digit10', 'F24', 'Numpad1']) {
    assert.equal(shortcutStroke(ctrl('m', { code, altKey: true })), 'Ctrl+Alt+M');
    assert.equal(shortcutStroke(event('?', { code, shiftKey: true })), 'Shift+/');
    for (const key of ['Unidentified', 'Dead', 'Process', '汉', undefined]) assert.equal(shortcutStroke(ctrl(key, { code })), null);
  }
  for (const key of ['Unidentified', undefined, '']) {
    assert.equal(shortcutStroke(ctrl(key, { code: 'KeyM', altKey: true })), 'Ctrl+Alt+M');
    assert.deepEqual(createShortcutMatcher().handle(ctrl(key, { code: 'KeyM', altKey: true }), context()), { handled: true, action: 'workbench.show' });
  }
});
test('known physical codes never bypass IME, dead/process keys or modifier-only input', () => {
  const cases = [
    ctrl('µ', { code: 'KeyM', altKey: true, keyCode: 229 }),
    ctrl('Unidentified', { code: 'KeyM', altKey: true, isComposing: true }),
    ...['Dead', 'Process', 'Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].map(key => ctrl(key, { code: 'KeyM', altKey: true })),
  ];
  for (const evt of cases) {
    assert.equal(shortcutStroke(evt), null);
    assert.deepEqual(createShortcutMatcher().handle(evt, context()), { handled: false });
  }
  for (const options of [{ keyCode: 229 }, { isComposing: true }, { getModifierState: () => true }]) {
    const matcher = createShortcutMatcher(); prefix(matcher);
    assert.deepEqual(matcher.handle(event('h', { code: 'KeyH', ...options }), context()), { handled: false });
    assert.deepEqual(matcher.handle(event('h', { code: 'KeyH' }), context()), { handled: false });
  }
});
test('direct directions resolve but normal letters and unsupported actions are not consumed', () => {
  const matcher = createShortcutMatcher(); const ctx = context();
  assert.deepEqual(matcher.handle(ctrl('ArrowLeft'), ctx), { handled: true, action: 'pane.left' });
  for (const key of ['h', 'j', 'k', 'l', 'z', '1', '/', 'Enter', 'Escape']) assert.deepEqual(matcher.handle(event(key), ctx), { handled: false });
  assert.deepEqual(matcher.handle(ctrl('ArrowLeft'), context({ canRun: () => false })), { handled: false });
  assert.deepEqual(matcher.handle(ctrl(';'), context({ canRun: () => false })), { handled: false });
});
test('editing preserves direct editing keys but show and valid prefix sequences work', () => {
  const matcher = createShortcutMatcher(); const ctx = context({ editing: true });
  assert.deepEqual(matcher.handle(ctrl('ArrowRight'), ctx), { handled: false });
  assert.deepEqual(matcher.handle(ctrl('m', { altKey: true }), ctx), { handled: true, action: 'workbench.show' });
  const rebound = config([binding('workbench.show', ['Ctrl+ArrowLeft'])]);
  assert.deepEqual(matcher.handle(ctrl('ArrowLeft'), context({ editing: true, config: rebound })), { handled: false });
  const reboundSearch = config([binding('search', ['Ctrl+ArrowRight'])]);
  assert.deepEqual(matcher.handle(ctrl('ArrowRight'), context({ editing: true, config: reboundSearch })), { handled: false });
  prefix(matcher, ctx); assert.deepEqual(matcher.handle(event('h'), { ...ctx, now: 10 }), { handled: true, action: 'pane.left' });
});
test('shared prefix expands all default sequences without Shift for displayed uppercase letters', () => {
  for (const [key, action] of [['h', 'pane.left'], ['l', 'pane.right'], ['k', 'pane.up'], ['j', 'pane.down'], ['1', 'pane.1'], ['4', 'pane.4'], [';', 'pane.previous'], ['z', 'pane.maximize'], ['/', 'search'], ['i', 'editor.focus']]) {
    const matcher = createShortcutMatcher(); prefix(matcher); assert.deepEqual(matcher.handle(event(key), context({ now: 10 })), { handled: true, action });
  }
  const matcher = createShortcutMatcher(); prefix(matcher); assert.deepEqual(matcher.handle(event('H', { shiftKey: true }), context()), { handled: true });
});
test('explicit two-stroke alternatives and a changed shared prefix are supported', () => {
  const matcher = createShortcutMatcher(); const ctx = context({ config: config([binding('search', ['Ctrl+K X', 'Prefix /'])], { prefix: 'Alt+B' }) });
  assert.deepEqual(matcher.handle(ctrl('k'), ctx), { handled: true, pending: true });
  assert.deepEqual(matcher.handle(event('x'), ctx), { handled: true, action: 'search' });
  assert.deepEqual(matcher.handle(event('b', { altKey: true }), ctx), { handled: true, pending: true });
  assert.deepEqual(matcher.handle(event('/'), ctx), { handled: true, action: 'search' });
});
test('pending expires at 1.2 seconds and reset/scope/config changes invalidate it', () => {
  for (const variation of ['expire', 'reset', 'scope', 'config', 'backwards']) {
    const matcher = createShortcutMatcher(); const ctx = context({ now: 100 }); prefix(matcher, ctx);
    let next = { ...ctx, now: 110 };
    if (variation === 'expire') next.now = 1300;
    if (variation === 'reset') matcher.reset();
    if (variation === 'scope') next.scope = 'outside';
    if (variation === 'config') next.config = { ...ctx.config, prefix: 'Ctrl+K' };
    if (variation === 'backwards') next.now = 90;
    assert.deepEqual(matcher.handle(event('h'), next), { handled: false }, variation);
  }
  const matcher = createShortcutMatcher(); prefix(matcher, context({ now: 0 }));
  assert.equal(matcher.handle(event('h'), context({ now: 1199 })).action, 'pane.left');
});
test('disabled, invalid, suspended, IME, prevented and AltGraph input clear pending', () => {
  const cases = [
    [event('h', { isComposing: true }), context()], [event('h', { keyCode: 229 }), context()],
    [event('h', { defaultPrevented: true }), context()], [event('h'), context({ suspended: true })],
    [event('h'), context({ config: { ...defaultConfig(), enabled: false } })], [event('h'), context({ config: {} })],
    [event('h', { getModifierState: name => name === 'AltGraph' }), context()],
  ];
  for (const [evt, ctx] of cases) {
    const matcher = createShortcutMatcher(); prefix(matcher);
    assert.deepEqual(matcher.handle(evt, ctx), { handled: false });
    assert.deepEqual(matcher.handle(event('h'), context()), { handled: false });
  }
});
test('scope filters prefix availability, show runs once in either scope and absent scope stays local', () => {
  const matcher = createShortcutMatcher(); const outside = context({ scope: 'outside' });
  assert.deepEqual(matcher.handle(ctrl(';'), outside), { handled: false });
  assert.deepEqual(matcher.handle(ctrl('m', { altKey: true }), outside), { handled: true, action: 'workbench.show' });
  assert.deepEqual(matcher.handle(ctrl('m', { altKey: true }), context()), { handled: true, action: 'workbench.show' });
  const scoped = config([{ action: 'workbench.show', enabled: true, keys: ['Ctrl+Alt+M'] }]);
  assert.deepEqual(matcher.handle(ctrl('m', { altKey: true }), context({ config: scoped, scope: 'outside' })), { handled: false });
});
test('only runnable sequences occupy a prefix; state changes recheck canRun before action', () => {
  const matcher = createShortcutMatcher(); const ctx = context({ canRun: action => action === 'workbench.show' });
  assert.deepEqual(matcher.handle(ctrl(';'), ctx), { handled: false });
  prefix(matcher);
  assert.deepEqual(matcher.handle(event('h'), context({ canRun: action => action === 'search' })), { handled: true });
  prefix(matcher);
  assert.deepEqual(matcher.handle(event('h'), context({ canRun: () => false })), { handled: false });
  assert.deepEqual(matcher.handle(ctrl(';'), context({ canRun: () => { throw new Error('unavailable'); } })), { handled: false });
});
test('unknown continuation consumes once, never dispatches, and modifier-only keydowns preserve pending', () => {
  const matcher = createShortcutMatcher(); prefix(matcher);
  assert.deepEqual(matcher.handle(event('Shift'), context()), { handled: false, pending: true });
  assert.deepEqual(matcher.handle(event('x'), context()), { handled: true });
  assert.deepEqual(matcher.handle(event('x'), context()), { handled: false });
  prefix(matcher); assert.deepEqual(matcher.handle(event('Enter'), context()), { handled: true });
  assert.deepEqual(matcher.handle(event('Enter'), context()), { handled: false });
});
test('repeats never retrigger leader or nonnavigation actions, but directions can repeat', () => {
  const matcher = createShortcutMatcher(); const ctx = context();
  assert.deepEqual(matcher.handle(ctrl(';', { repeat: true }), ctx), { handled: false });
  prefix(matcher, ctx);
  assert.deepEqual(matcher.handle(ctrl(';', { repeat: true }), context({ now: 10 })), { handled: true, pending: true });
  assert.deepEqual(matcher.handle(event('z'), context({ now: 20 })), { handled: true, action: 'pane.maximize' });
  assert.deepEqual(matcher.handle(event('z', { repeat: true }), context({ now: 30 })), { handled: true });
  matcher.reset();
  assert.deepEqual(matcher.handle(ctrl('ArrowRight', { repeat: true }), ctx), { handled: true, action: 'pane.right' });
  prefix(matcher, ctx); assert.equal(matcher.handle(event('l'), ctx).action, 'pane.right');
  assert.deepEqual(matcher.handle(event('l', { repeat: true }), ctx), { handled: true, action: 'pane.right' });
  assert.deepEqual(matcher.handle(ctrl('m', { altKey: true, repeat: true }), ctx), { handled: false });
});
test('editing Ctrl+arrows are protected even as a custom leader or sequence continuation', () => {
  const matcher = createShortcutMatcher();
  const leaderConfig = config([binding('search', ['Prefix /'])], { prefix: 'Ctrl+ArrowLeft' }); valid(leaderConfig);
  assert.deepEqual(matcher.handle(ctrl('ArrowLeft'), context({ editing: true, config: leaderConfig })), { handled: false });
  const sequenceConfig = config([binding('workbench.show', ['Prefix Ctrl+ArrowRight'])]); valid(sequenceConfig);
  const ctx = context({ config: sequenceConfig, editing: true }); prefix(matcher, ctx);
  assert.deepEqual(matcher.handle(ctrl('ArrowRight'), ctx), { handled: false });
  assert.deepEqual(matcher.handle(event('h'), ctx), { handled: false });
});
test('array holes, extra properties and custom iterators cannot enter configuration parsing', () => {
  invalid(config(Array(1)));
  invalid(config([binding('search', Array(1))]));
  const bindings = []; bindings.constructor = 'bad'; invalid(config(bindings));
  const keys = ['Ctrl+Q']; keys[Symbol.iterator] = () => { throw new Error('do not execute'); };
  assert.doesNotThrow(() => invalid(config([binding('search', keys)])));
  const scopes = ['local']; Object.defineProperty(scopes, '0', { enumerable: true, get() { throw new Error('do not execute'); } });
  assert.doesNotThrow(() => invalid(config([binding('search', ['Ctrl+Q'], scopes)])));
});
test('configuration parsing never executes methods inherited from supplied array prototypes', () => {
  const cfg = config([binding('search', ['Ctrl+Q'], ['local'])]);
  const poisoned = Object.create(null);
  poisoned.every = poisoned.includes = poisoned[Symbol.iterator] = () => { throw new Error('must not execute'); };
  Object.setPrototypeOf(cfg.bindings[0].scopes, poisoned);
  Object.setPrototypeOf(cfg.bindings[0].keys, poisoned);
  Object.setPrototypeOf(cfg.bindings, poisoned);
  assert.doesNotThrow(() => valid(cfg));
  assert.deepEqual(normalizeShortcutConfig(cfg), config([binding('search', ['Ctrl+Q'])]));
});
test('leader repeats do not extend the deadline, and held nonnavigation singles only run once', () => {
  const matcher = createShortcutMatcher(); prefix(matcher, context({ now: 100 }));
  assert.deepEqual(matcher.handle(ctrl(';', { repeat: true }), context({ now: 1200 })), { handled: true, pending: true });
  assert.deepEqual(matcher.handle(event('z'), context({ now: 1300 })), { handled: false });
  assert.deepEqual(matcher.handle(ctrl('m', { altKey: true }), context()), { handled: true, action: 'workbench.show' });
  assert.deepEqual(matcher.handle(ctrl('m', { altKey: true, repeat: true }), context()), { handled: true });
  matcher.reset(); assert.deepEqual(matcher.handle(ctrl('m', { altKey: true, repeat: true }), context()), { handled: false });
});
test('clipboard, selection, undo and print keys cannot be rebound or used as leaders', () => {
  for (const mod of ['Ctrl', 'Meta']) for (const key of ['A', 'C', 'V', 'X', 'Y', 'Z', 'P']) {
    invalid(config([binding('workbench.show', [mod + '+' + key])]));
    invalid(config([], { prefix: mod + '+' + key }));
    invalid(config([binding('search', ['Prefix ' + mod + '+' + key])]));
  }
  valid(defaultConfig()); // Ctrl+; remains the explicitly chosen leader exception.
});
test('editing show exception requires Alt plus Ctrl or Meta; word deletion is never stolen', () => {
  const matcher = createShortcutMatcher();
  for (const [key, evt] of [['Ctrl+Backspace', ctrl('Backspace')], ['Ctrl+M', ctrl('m')], ['Alt+M', event('m', { altKey: true })], ['Meta+M', event('m', { metaKey: true })]]) {
    const cfg = config([binding('workbench.show', [key])]); valid(cfg);
    assert.deepEqual(matcher.handle(evt, context({ config: cfg, editing: true })), { handled: false }, key);
    assert.deepEqual(matcher.handle(evt, context({ config: cfg, editing: false })), { handled: true, action: 'workbench.show' }, key);
  }
  const cfg = config([binding('workbench.show', ['Alt+Meta+M'])]); valid(cfg);
  assert.deepEqual(matcher.handle(event('m', { altKey: true, metaKey: true }), context({ config: cfg, editing: true })), { handled: true, action: 'workbench.show' });
  assert.deepEqual(matcher.handle(ctrl('m', { altKey: true, isComposing: true }), context({ editing: true })), { handled: false });
});
test('matcher never calls DOM methods or mutates event/config', () => {
  const matcher = createShortcutMatcher(); const cfg = defaultConfig(); const before = structuredClone(cfg);
  const evt = Object.freeze({ key: 'localized', code: 'ArrowLeft', ctrlKey: true, preventDefault() { throw new Error('pure engine must not call'); }, stopPropagation() { throw new Error('pure engine must not call'); } });
  assert.equal(shortcutStroke(evt), 'Ctrl+ArrowLeft');
  assert.equal(matcher.handle(evt, context({ config: cfg })).action, 'pane.left'); assert.deepEqual(cfg, before);
});
test('pane geometry is spatial, bounded, nonwrapping and independent of session occupancy', () => {
  assert.equal(paneShortcutTarget('columns', 0, 'right'), 1); assert.equal(paneShortcutTarget('columns', 1, 'left'), 0);
  for (const direction of ['up', 'down']) assert.equal(paneShortcutTarget('columns', 0, direction), null);
  assert.equal(paneShortcutTarget('rows', 0, 'down'), 1); assert.equal(paneShortcutTarget('rows', 1, 'up'), 0);
  assert.equal(paneShortcutTarget('rows', 0, 'right'), null);
  const expected = { 0: { right: 1, down: 2 }, 1: { left: 0, down: 3 }, 2: { up: 0, right: 3 }, 3: { up: 1, left: 2 } };
  for (let index = 0; index < 4; index++) for (const direction of ['left', 'right', 'up', 'down']) assert.equal(paneShortcutTarget('quad', index, direction), expected[index][direction] ?? null);
  for (const [layout, index, direction] of [['other', 0, 'left'], ['quad', -1, 'left'], ['quad', 4, 'left'], ['quad', 1.5, 'left'], ['quad', 0, 'constructor'], ['columns', 2, 'left']]) assert.equal(paneShortcutTarget(layout, index, direction), null);
});
