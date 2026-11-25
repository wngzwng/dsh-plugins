import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createShortcutSettingsComponent } from '../src/shortcut-settings.js';
import * as realHelpers from '../shortcuts.js';

// These helpers are deliberate UI test doubles, not shortcut-engine tests.
// The factory integration accepts the same fixed helper protocol as production.
const ids = ['pane.left', 'pane.right', 'pane.up', 'pane.down', 'pane.1', 'pane.2', 'pane.3', 'pane.4', 'pane.previous', 'pane.maximize', 'search', 'editor.focus', 'workbench.show'];
const labels = ['向左切窗', '向右切窗', '向上切窗', '向下切窗', '窗格一', '窗格二', '窗格三', '窗格四', '上一窗格', '最大化', '搜索', '输入区', '显示工作台'];
const clone = value => JSON.parse(JSON.stringify(value));
const defaults = () => ({ version: 1, enabled: true, prefix: 'Ctrl+;', bindings: ids.map((action, index) => ({
  action, enabled: true, scopes: action === 'workbench.show' ? ['local', 'outside'] : ['local'], keys: ['Prefix F' + (index + 1)],
})) });
const helpers = {
  SHORTCUT_ACTIONS: ids.map((id, index) => ({ id, label: labels[index], description: '动作说明 ' + id })),
  createDefaultShortcutConfig: defaults,
  normalizeShortcutConfig(value) {
    const config = clone(value || defaults());
    config.bindings = config.bindings.map(binding => ({ ...binding, scopes: binding.scopes === undefined ? ['local'] : binding.scopes }));
    return config;
  },
  validateShortcutConfig(config) {
    const errors = [];
    for (const binding of config.bindings) {
      if (!binding.scopes?.length) errors.push({ action: binding.action, message: '至少选择一种作用域' });
      if (!binding.keys.length) errors.push({ action: binding.action, message: '至少一个按键' });
      if (binding.keys.includes('Ctrl+Enter')) errors.push({ action: binding.action, message: '不能覆盖原生发送快捷键' });
      for (const other of config.bindings) {
        if (binding.action >= other.action || !binding.enabled || !other.enabled) continue;
        if (binding.scopes.some(scope => other.scopes.includes(scope)) && binding.keys.some(key => other.keys.includes(key))) errors.push({ action: binding.action, message: '快捷键作用域冲突' });
      }
    }
    return { valid: errors.length === 0, errors };
  },
  shortcutStroke(event) {
    if (!event.key || ['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null;
    return [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta', event.key.length === 1 ? event.key.toUpperCase() : event.key].filter(Boolean).join('+');
  },
};

async function mount(t, overrides = {}, helperSet = helpers) {
  const jsdomErrors = []; const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => jsdomErrors.push(error));
  const dom = new JSDOM('<!doctype html><html><body><div id="test-root"></div></body></html>', { url: 'http://localhost/', virtualConsole });
  const oldWindow = globalThis.window; const oldDocument = globalThis.document;
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('test-root'));
  const Settings = createShortcutSettingsComponent(React, React.createElement, helperSet);
  const saves = []; const recording = []; let closes = 0;
  let props = { value: defaults(), saving: false, error: '', onSave: async (config, expected) => { saves.push({ config: clone(config), expected: clone(expected) }); return true; }, onClose: () => closes++, onRecordingChange: value => recording.push(value), ...overrides };
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };
  async function update(next = {}) { props = { ...props, ...next }; await React.act(async () => { root.render(React.createElement(Settings, props)); await settle(); }); }
  const get = label => dom.window.document.querySelector('[aria-label="' + label + '"]');
  async function click(label) {
    const target = get(label); assert.ok(target, 'Missing control: ' + label);
    await React.act(async () => { target.click(); await settle(); });
  }
  async function input(label, value) {
    const target = get(label); assert.ok(target, 'Missing input: ' + label);
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(target, value);
      target.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      target.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      await settle();
    });
  }
  async function select(value) { await React.act(async () => { const node = get('筛选快捷键'); node.value = value; node.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await settle(); }); }
  async function key(key, extra = {}) {
    const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
    await React.act(async () => { dom.window.document.activeElement.dispatchEvent(event); await settle(); });
    return event;
  }
  let disposed = false;
  async function dispose() {
    if (disposed) return; disposed = true;
    await React.act(async () => root.unmount());
    assert.deepEqual(jsdomErrors, []);
    dom.window.close(); globalThis.window = oldWindow; globalThis.document = oldDocument; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
  t.after(dispose); await update();
  return { dom, get, click, input, key, select, update, dispose, saves, recording, get props() { return props; }, get closes() { return closes; }, text: () => dom.window.document.body.textContent };
}

test('floating dialog focuses itself, traps Tab, and redirects background focus', async t => {
  const ui = await mount(t); const dialog = ui.get('快捷键设置'); const doc = ui.dom.window.document;
  assert.equal(dialog.getAttribute('role'), 'dialog'); assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.ok(dialog.parentElement.classList.contains('sw-keys-layer')); assert.equal(doc.activeElement, dialog);
  const first = ui.get('关闭快捷键设置'); const last = ui.get('取消修改');
  assert.equal((await ui.key('Tab')).defaultPrevented, true); assert.equal(doc.activeElement, first);
  await ui.key('Tab', { shiftKey: true }); assert.equal(doc.activeElement, last);
  await ui.key('Tab'); assert.equal(doc.activeElement, first);
  const outside = doc.createElement('button'); doc.body.appendChild(outside);
  await React.act(async () => outside.focus()); assert.equal(doc.activeElement, dialog);
});
test('floating backdrop and Escape honor dirty/save guards; recording Escape only cancels recording', async t => {
  const ui = await mount(t);
  await ui.click('启用全部快捷键');
  assert.equal((await ui.key('Escape')).defaultPrevented, true); assert.equal(ui.closes, 0);
  assert.match(ui.text(), /有未保存的修改，是否放弃并关闭/);
  await ui.click('继续编辑');
  await React.act(async () => ui.dom.window.document.querySelector('.sw-keys-layer').click());
  assert.equal(ui.closes, 0); assert.match(ui.text(), /有未保存的修改/);
  await ui.click('继续编辑'); await ui.click('录制公共前缀');
  await ui.key('Escape'); assert.equal(ui.get('快捷键录制区'), null); assert.equal(ui.closes, 0);
  assert.match(ui.text(), /已取消录制/);
  await ui.update({ saving: true }); await ui.key('Escape'); assert.equal(ui.closes, 0);
});
test('clean floating dialog requests close once per Escape, never on held repeats', async t => {
  const ui = await mount(t);
  await ui.key('Escape'); assert.equal(ui.closes, 1);
  await ui.key('Escape', { repeat: true }); assert.equal(ui.closes, 1);
});

test('settings edits are isolated draft; master and item switches preserve bindings; save receives expected config', async t => {
  const initial = defaults(); const frozen = clone(initial);
  const ui = await mount(t, { value: initial });
  assert.ok(ui.get('快捷键设置').hasAttribute('data-sw-shortcut-settings'));
  await ui.input('按键 向左切窗', 'Ctrl+K X | ');
  assert.equal(ui.get('按键 向左切窗').value, 'Ctrl+K X | '); // do not erase delimiters while typing
  await ui.input('按键 向左切窗', 'Ctrl+K X | Alt+H');
  await ui.click('启用全部快捷键'); await ui.click('启用 向右切窗');
  assert.deepEqual(initial, frozen); assert.equal(ui.saves.length, 0);
  await ui.click('保存并应用');
  assert.equal(ui.saves.length, 1); assert.deepEqual(ui.saves[0].expected, initial);
  assert.deepEqual(ui.saves[0].config.bindings[0].keys, ['Ctrl+K X', 'Alt+H']);
  assert.equal(ui.saves[0].config.enabled, false); assert.equal(ui.saves[0].config.bindings[1].enabled, false);
  assert.deepEqual(ui.saves[0].config.bindings[1].keys, initial.bindings[1].keys);
  assert.match(ui.text(), /已保存并确认/); assert.equal(ui.closes, 0);
  // Parent may deliver the accepted value later; old props must not erase ACKed draft.
  await ui.update({ error: '' }); assert.equal(ui.get('按键 向左切窗').value, 'Ctrl+K X | Alt+H');
});

test('scope checkboxes are independent, missing scope defaults local, empty scope blocks save and filters include dual scope', async t => {
  const initial = defaults(); delete initial.bindings[0].scopes;
  const ui = await mount(t, { value: initial });
  assert.equal(ui.get('局内 向左切窗').checked, true); assert.equal(ui.get('局外 向左切窗').checked, false);
  await ui.click('局外 向左切窗');
  assert.equal(ui.get('局内 向左切窗').checked, true); assert.equal(ui.get('局外 向左切窗').checked, true);
  await ui.select('outside'); assert.ok(ui.get('按键 向左切窗')); assert.ok(ui.get('按键 显示工作台')); assert.equal(ui.get('按键 向右切窗'), null);
  await ui.select('all'); await ui.click('局内 向左切窗'); await ui.click('局外 向左切窗');
  assert.match(ui.text(), /至少选择一种作用域/); assert.equal(ui.get('保存并应用').disabled, true);
  await ui.click('保存并应用'); assert.equal(ui.saves.length, 0);
});

test('conflicts and native protected keys prevent saving; cancel and defaults change only draft', async t => {
  const ui = await mount(t);
  await ui.input('按键 向左切窗', 'Prefix F2');
  assert.match(ui.text(), /冲突/); assert.equal(ui.get('保存并应用').disabled, true);
  await ui.input('按键 向左切窗', 'Ctrl+Enter'); assert.match(ui.text(), /不能覆盖原生发送/);
  await ui.click('恢复默认 向左切窗'); assert.equal(ui.get('按键 向左切窗').value, 'Prefix F1');
  await ui.input('公共前缀', 'Ctrl+K'); await ui.click('取消修改'); assert.equal(ui.get('公共前缀').value, 'Ctrl+;');
  await ui.input('按键 向左切窗', 'Alt+H'); await ui.click('恢复全部默认');
  assert.equal(ui.get('按键 向左切窗').value, 'Prefix F1'); assert.equal(ui.saves.length, 0);
});

test('save failures retain draft and external errors; dirty close uses inline confirmation without dialogs', async t => {
  const ui = await mount(t, { onSave: async () => false, error: '服务器拒绝了并发覆盖' });
  await ui.input('按键 向左切窗', 'Alt+H'); await ui.click('保存并应用');
  assert.match(ui.text(), /保存未成功/); assert.match(ui.text(), /服务器拒绝/); assert.equal(ui.get('按键 向左切窗').value, 'Alt+H');
  await ui.click('关闭快捷键设置'); assert.equal(ui.closes, 0); assert.match(ui.text(), /是否放弃并关闭/);
  await ui.click('继续编辑'); assert.equal(ui.get('放弃修改并关闭'), null);
  await ui.click('关闭快捷键设置'); await ui.click('放弃修改并关闭'); assert.equal(ui.closes, 1);
});

test('only shortcut-config changes cause concurrent-edit protection; reload is explicit and uses latest config', async t => {
  const ui = await mount(t); await ui.input('按键 向左切窗', 'Alt+H');
  await ui.update({ value: clone(ui.props.value), profileRevision: 999 });
  assert.doesNotMatch(ui.text(), /其它页面已修改/); assert.equal(ui.get('保存并应用').disabled, false);
  const latest = defaults(); latest.prefix = 'Ctrl+G';
  await ui.update({ value: latest });
  assert.match(ui.text(), /其它页面已修改/); assert.equal(ui.get('保存并应用').disabled, true);
  assert.equal(ui.get('按键 向左切窗').value, 'Alt+H');
  await ui.click('重新载入已确认配置');
  assert.equal(ui.get('公共前缀').value, 'Ctrl+G'); assert.equal(ui.get('按键 向左切窗').value, 'Prefix F1');
  await ui.click('保存并应用'); assert.deepEqual(ui.saves[0].expected, latest);
});

test('recording pauses synchronously, swallows events, ignores modifier/IME, supports Prefix and actual two-step sequences', async t => {
  const ui = await mount(t); let nativeKeys = 0;
  ui.dom.window.document.addEventListener('keydown', () => nativeKeys++);
  await ui.click('录制组合 向左切窗');
  assert.deepEqual(ui.recording, [true]); assert.equal(ui.dom.window.document.activeElement, ui.get('快捷键录制区'));
  await ui.update({ error: '不会导致录制effect重建' }); assert.deepEqual(ui.recording, [true]);
  assert.equal((await ui.key('Control', { ctrlKey: true })).defaultPrevented, true);
  await ui.key('Process', { keyCode: 229, isComposing: true }); assert.deepEqual(ui.recording, [true]);
  await ui.key('h', { ctrlKey: true, altKey: true });
  assert.deepEqual(ui.recording, [true, false]); assert.equal(ui.get('按键 向左切窗').value, 'Ctrl+Alt+H');
  await ui.click('录制序列 向左切窗'); await ui.key(';', { ctrlKey: true });
  assert.match(ui.text(), /第一步：Ctrl\+;/); await ui.key('x');
  assert.equal(ui.get('按键 向左切窗').value, 'Prefix X');
  await ui.click('录制序列 向左切窗'); await ui.key('k', { ctrlKey: true }); await ui.key('x');
  assert.equal(ui.get('按键 向左切窗').value, 'Ctrl+K X');
  assert.equal(nativeKeys, 0); assert.equal(ui.saves.length, 0);
});

test('Esc, stop, prefix recording and unmount always release pause without changing or applying canceled recording', async t => {
  const ui = await mount(t);
  await ui.click('录制组合 向左切窗'); await ui.key('Escape');
  assert.equal(ui.get('按键 向左切窗').value, 'Prefix F1'); assert.deepEqual(ui.recording, [true, false]);
  await ui.click('录制序列 向左切窗'); await ui.key('k', { ctrlKey: true }); await ui.click('停止录制');
  assert.equal(ui.get('按键 向左切窗').value, 'Prefix F1');
  await ui.click('录制公共前缀'); await ui.key('g', { ctrlKey: true }); assert.equal(ui.get('公共前缀').value, 'Ctrl+G');
  await ui.click('录制组合 向左切窗'); assert.equal(ui.recording.at(-1), true);
  await ui.dispose(); assert.equal(ui.recording.at(-1), false); assert.equal(ui.saves.length, 0);
});

test('real recorder passes Ctrl+B to native handlers, cancels recording, and manual Ctrl+B cannot save', async t => {
  const initial = realHelpers.createDefaultShortcutConfig(); const left = realHelpers.SHORTCUT_ACTIONS[0].label;
  const ui = await mount(t, { value: initial }, realHelpers); let native = 0;
  ui.dom.window.document.addEventListener('keydown', event => { if (event.ctrlKey && (event.code === 'KeyB' || event.key === 'b')) native++; });
  for (const label of ['录制公共前缀', '录制组合 ' + left, '录制序列 ' + left]) {
    await ui.click(label);
    if (label.startsWith('录制序列')) await ui.key(';', { ctrlKey: true });
    assert.equal((await ui.key('b', { ctrlKey: true })).defaultPrevented, false);
    assert.equal(ui.recording.at(-1), false); assert.equal(ui.get('快捷键录制区'), null);
    assert.equal(ui.get('公共前缀').value, 'Ctrl+;'); assert.match(ui.text(), /Ctrl\+B 已由 DSH 使用/);
  }
  await ui.click('录制公共前缀');
  assert.equal((await ui.key('и', { code: 'KeyB', ctrlKey: true })).defaultPrevented, false);
  assert.equal(ui.recording.at(-1), false); assert.equal(ui.get('公共前缀').value, 'Ctrl+;');
  assert.equal(native, 4); assert.equal(ui.saves.length, 0);
  await ui.input('公共前缀', 'Ctrl+B'); assert.equal(ui.get('保存并应用').disabled, true);
});

test('read-only keyboard diagnostics can refresh without editing or saving shortcut settings', async t => {
  let data = { version: 'test', ready: true, events: [] };
  const ui = await mount(t, { getDiagnostics: () => data });
  assert.ok(ui.get('按键诊断')); assert.equal(JSON.parse(ui.get('按键诊断内容').textContent).ready, true);
  data = { ...data, events: [{ code: 'KeyM', stroke: 'Ctrl+Alt+M', reason: '已派发动作' }] };
  await ui.click('刷新按键诊断');
  assert.equal(JSON.parse(ui.get('按键诊断内容').textContent).events[0].code, 'KeyM');
  assert.equal(ui.saves.length, 0); assert.match(ui.text(), /与已确认配置一致/);
});

test('real helpers integrate with settings: conflict/reserved validation, normalized Prefix recording and acknowledged save', async t => {
  const initial = realHelpers.createDefaultShortcutConfig(); const original = clone(initial);
  const left = realHelpers.SHORTCUT_ACTIONS.find(action => action.id === 'pane.left').label;
  const ui = await mount(t, { value: initial }, realHelpers);
  assert.equal(ui.dom.window.document.querySelectorAll('[data-shortcut-action]').length, 13);
  await ui.input('按键 ' + left, 'Ctrl+ArrowRight');
  assert.match(ui.text(), /冲突/); assert.equal(ui.get('保存并应用').disabled, true); assert.equal(ui.saves.length, 0);
  await ui.input('按键 ' + left, 'Ctrl+Enter');
  assert.match(ui.text(), /原生/); assert.equal(ui.get('保存并应用').disabled, true);
  await ui.click('取消修改');
  await ui.input('公共前缀', 'ctrl+g');
  await ui.click('录制序列 ' + left); await ui.key('g', { ctrlKey: true }); await ui.key('x');
  assert.equal(ui.get('按键 ' + left).value, 'Prefix X');
  await ui.click('局外 ' + left);
  assert.equal(ui.get('局内 ' + left).checked, true); assert.equal(ui.get('局外 ' + left).checked, true);
  assert.equal(ui.get('保存并应用').disabled, false);
  await ui.click('保存并应用');
  assert.deepEqual(initial, original); assert.equal(ui.saves.length, 1);
  assert.equal(realHelpers.validateShortcutConfig(ui.saves[0].config).valid, true);
  assert.equal(ui.saves[0].config.prefix, 'Ctrl+G');
  assert.deepEqual(ui.saves[0].config.bindings.find(binding => binding.action === 'pane.left').keys, ['Prefix X']);
  assert.deepEqual(ui.saves[0].config.bindings.find(binding => binding.action === 'pane.left').scopes, ['local', 'outside']);
  assert.deepEqual(ui.saves[0].expected, original); assert.match(ui.text(), /已保存并确认/);
  assert.deepEqual(ui.recording, [true, false]);
});

test('real safe-empty configuration still lists all actions without silently enabling or saving defaults', async t => {
  const initial = { version: 1, enabled: false, prefix: 'Ctrl+;', bindings: [] };
  const ui = await mount(t, { value: initial }, realHelpers);
  const left = realHelpers.SHORTCUT_ACTIONS[0].label;
  assert.equal(ui.dom.window.document.querySelectorAll('[data-shortcut-action]').length, 13);
  assert.equal(ui.get('启用 ' + left).checked, false); assert.equal(ui.saves.length, 0);
  assert.match(ui.text(), /与已确认配置一致/);
  await ui.click('启用 ' + left); await ui.click('启用全部快捷键'); await ui.click('保存并应用');
  assert.equal(ui.saves[0].config.bindings.length, 1); assert.equal(ui.saves[0].config.bindings[0].action, 'pane.left');
  assert.deepEqual(ui.saves[0].expected, initial);
});

test('pending ACK disables edits; rejected and thrown saves keep the draft and never close settings', async t => {
  let resolveSave; let calls = 0;
  const ui = await mount(t, { onSave: () => { calls++; return new Promise(resolve => { resolveSave = resolve; }); } });
  await ui.input('按键 向左切窗', 'Alt+H'); await ui.click('保存并应用');
  assert.equal(calls, 1); assert.equal(ui.get('保存并应用').disabled, true); assert.equal(ui.get('公共前缀').disabled, true);
  assert.match(ui.text(), /正在保存/); assert.doesNotMatch(ui.text(), /已保存并确认/);
  await React.act(async () => { resolveSave(false); await new Promise(resolve => setImmediate(resolve)); });
  assert.equal(ui.get('按键 向左切窗').value, 'Alt+H'); assert.match(ui.text(), /保存未成功/);
  await ui.update({ onSave: async () => { throw new Error('存储不可写'); } });
  await ui.click('保存并应用'); assert.match(ui.text(), /存储不可写/); assert.equal(ui.closes, 0);
});
