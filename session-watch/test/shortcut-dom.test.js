import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import * as shortcuts from '../shortcuts.js';
const source = (await readFile(new URL('../src/shortcut-dom.js', import.meta.url), 'utf8')).replace(/^export\s+/gm, '');
function setup() {
  const dom = new JSDOM('<!doctype html><div id="root"><textarea></textarea><div contenteditable="true"><span>text</span></div></div>');
  const context = vm.createContext({ ...shortcuts, window: dom.window, document: dom.window.document });
  vm.runInContext(source + '\nglobalThis.adapter = { createShortcutController, shortcutRootVisible };', context);
  let scope = 'local'; let suspended = false; const actions = []; const prefixes = []; const diagnostics = [];
  const controller = context.adapter.createShortcutController({ win: dom.window, doc: dom.window.document,
    getConfig: shortcuts.createDefaultShortcutConfig, getScope: () => scope, canRun: () => true,
    run: action => actions.push(action), isSuspended: () => suspended, onPrefix: value => prefixes.push(value), onDiagnostic: value => diagnostics.push(JSON.parse(JSON.stringify(value))) });
  const key = (key, options = {}, target = dom.window.document.body) => {
    const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }); target.dispatchEvent(event); return event;
  };
  return { dom, actions, prefixes, diagnostics, key, visible: context.adapter.shortcutRootVisible,
    scope: value => scope = value, suspend: value => suspended = value, stop: () => controller.dispose(), dispose() { controller.dispose(); dom.window.close(); } };
}
test('Ctrl+B reaches native document handlers before, after prefix, and outside workbench', () => {
  const f = setup(); let native = 0;
  try {
    f.dom.window.document.addEventListener('keydown', event => { if (event.ctrlKey && event.key === 'b') native++; });
    const input = f.dom.window.document.querySelector('textarea');
    assert.equal(f.key('b', { ctrlKey: true }, input).defaultPrevented, false);
    assert.equal(f.key(';', { ctrlKey: true }, input).defaultPrevented, true);
    assert.equal(f.key('b', { ctrlKey: true }, input).defaultPrevented, false);
    assert.equal(f.key('h', {}, input).defaultPrevented, false);
    f.scope('outside'); assert.equal(f.key('b', { ctrlKey: true }, input).defaultPrevented, false);
    assert.equal(native, 3); assert.deepEqual(f.actions, []);
    f.scope('local'); f.key(';', { ctrlKey: true }, input); f.key('h', {}, input);
    assert.deepEqual(f.actions, ['pane.left']);
  } finally { f.dispose(); }
});

test('physical Mac/IME-layout events route show and localized prefix navigation with bounded diagnostic fields', () => {
  const f = setup();
  try {
    const input = f.dom.window.document.querySelector('textarea');
    f.key('ordinary text must not be recorded', { code: 'KeyT' }, input);
    assert.equal(f.diagnostics.length, 0);
    f.scope('outside');
    assert.equal(f.key('µ', { code: 'KeyM', ctrlKey: true, altKey: true }, input).defaultPrevented, true);
    assert.deepEqual(f.actions, ['workbench.show']);
    assert.equal(f.diagnostics.at(-1).stroke, 'Ctrl+Alt+M'); assert.equal(f.diagnostics.at(-1).reason, '已派发动作');
    f.scope('local');
    assert.equal(f.key('；', { code: 'Semicolon', ctrlKey: true }, input).defaultPrevented, true);
    assert.match(f.diagnostics.at(-1).reason, /已接收前缀/);
    assert.equal(f.key('ｌ', { code: 'KeyL' }, input).defaultPrevented, true);
    assert.equal(f.actions.at(-1), 'pane.right'); assert.equal(f.diagnostics.at(-1).code, 'KeyL');
    assert.equal(Object.hasOwn(f.diagnostics.at(-1), 'key'), false);
    f.key('ordinary text must not be recorded', { code: 'KeyT' }, input);
    assert.equal(f.diagnostics.length, 3);
    f.suspend(true); f.key(';', { code: 'Semicolon', ctrlKey: true }, input);
    assert.match(f.diagnostics.at(-1).reason, /暂停/);
  } finally { f.dispose(); }
});

test('DOM adapter preserves editing arrows but routes prefixed navigation and protects IME', () => {
  const f = setup();
  try {
    const input = f.dom.window.document.querySelector('textarea');
    assert.equal(f.key('ArrowRight', { ctrlKey: true }, input).defaultPrevented, false);
    assert.equal(f.key(';', { ctrlKey: true }, input).defaultPrevented, true);
    assert.equal(f.key('l', {}, input).defaultPrevented, true); assert.deepEqual(f.actions, ['pane.right']);
    const editable = f.dom.window.document.querySelector('[contenteditable] span');
    assert.equal(f.key('ArrowLeft', { ctrlKey: true }, editable).defaultPrevented, false);
    assert.equal(f.key(';', { ctrlKey: true, isComposing: true }, input).defaultPrevented, false);
    assert.equal(f.key('j', {}, input).defaultPrevented, false);
  } finally { f.dispose(); }
});
test('blur clears a stale composition lock, recording suspension clears pending and outside executes only allowed defaults', () => {
  const f = setup();
  try {
    f.dom.window.document.dispatchEvent(new f.dom.window.CompositionEvent('compositionstart', { bubbles: true }));
    assert.equal(f.key('m', { ctrlKey: true, altKey: true }).defaultPrevented, false);
    f.dom.window.dispatchEvent(new f.dom.window.Event('blur'));
    assert.equal(f.key('m', { ctrlKey: true, altKey: true }).defaultPrevented, true);
    f.key(';', { ctrlKey: true }); f.suspend(true); f.key('j'); f.suspend(false);
    assert.equal(f.key('j').defaultPrevented, false); assert.deepEqual(f.actions, ['workbench.show']);
    f.scope('outside'); assert.equal(f.key('ArrowLeft', { ctrlKey: true }).defaultPrevented, false);
    assert.equal(f.key(';', { ctrlKey: true }).defaultPrevented, false);
    f.key('m', { ctrlKey: true, altKey: true }); assert.deepEqual(f.actions, ['workbench.show', 'workbench.show']);
  } finally { f.dispose(); }
});
test('visibility checks include hidden ancestors and disposal removes the actual window listener', () => {
  const f = setup(); const root = f.dom.window.document.getElementById('root');
  try {
    assert.equal(f.visible(root, f.dom.window), true);
    root.style.display = 'none'; assert.equal(f.visible(root, f.dom.window), false);
    root.style.display = ''; root.parentElement.setAttribute('inert', ''); assert.equal(f.visible(root, f.dom.window), false);
    root.parentElement.removeAttribute('inert'); assert.equal(f.visible(root, f.dom.window), true);
    f.stop(); assert.equal(f.key('m', { ctrlKey: true, altKey: true }, root).defaultPrevented, false); assert.equal(f.actions.length, 0);
  } finally { f.dispose(); }
});
