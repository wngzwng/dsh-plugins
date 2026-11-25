import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import * as React from 'react';
import { createDefaultState, reduceState } from '../core.js';

const bundle = await readFile(new URL('../client.js', import.meta.url), 'utf8');
test('React mount with native Factory test doubles: reference scoping, user actions and complete cleanup', async () => {
  const errors = []; const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { url: 'http://localhost/', runScripts: 'outside-only', virtualConsole });
  const previousWindow = globalThis.window; const previousDocument = globalThis.document;
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { act } = React;
  // React DOM feature detection must run after a browser-like document exists.
  const { createRoot } = await import('react-dom/client');
  let state = createDefaultState(); let retains = 0; let releases = 0; let subscriptions = 0; let promptCalls = 0;
  const commands = []; const allReferences = new Set(); const releasedReferences = new Set(); const providerReferences = new Set();
  const SessionContext = React.createContext(null);
  let navigated = null; let selectedPanel = null; let failLoad = false; let failSave = false; const effects = []; const registrations = new Map();
  const ids = ['a', 'b', 'c', 'd'];
  const listValue = { ids, phase: 'ready', byId: Object.fromEntries(ids.map(id => [id, { sessionId: id, displayTitle: '测试会话 ' + id, cwd: '/work/project-' + id, running: id === 'a', updatedAt: Date.now() }])), projectionsBySession: Object.fromEntries(ids.map(id => [id, { values: { title: '旧标题 ' + id } }])) };
  function observable(value) { return { getSnapshot: () => value, subscribe() { subscriptions++; return () => subscriptions--; } }; }
  const sessions = { list: observable(listValue), retain(id, options) {
    assert.equal(typeof id, 'string'); assert.deepEqual(JSON.parse(JSON.stringify(options)), { source: 'controllerOperation' });
    retains++;
    const binding = { sessionId: id, session: { ...observable({ sessionId: id, blank: false, removed: false, running: false, openState: 'open' }),
      prompt(text) { promptCalls++; commands.push({ type: 'prompt', sessionId: id, text }); },
      cancel() { promptCalls++; commands.push({ type: 'cancel', sessionId: id }); }, async loadOlder() {} },
      conversation: observable({ activeTargets: new Set(['chat']) }),
      eventSource: observable({ entries: [{ type: 'event', event: { type: 'assistant/message', seq: 2, time: Date.now(), data: { message: { role: 'assistant', content: [{ type: 'text', text: '回复内容 ' + id }, { type: 'reasoning', text: 'PRIVATE_REASONING' }] } } } }], hasMore: false }) };
    const reference = { sessionId: id, binding, ready: Promise.resolve(binding), release() {
      assert.equal(releasedReferences.has(reference), false, 'Reference released twice');
      releasedReferences.add(reference); releases++;
    } };
    allReferences.add(reference); return reference;
  } };
  function SessionProvider({ session, children, empty }) {
    if (session == null) return empty || null;
    assert.equal(typeof session, 'object', 'SessionProvider must receive a SessionReference, never an id string');
    assert.ok(allReferences.has(session), 'Provider must receive the exact retained reference');
    assert.equal(releasedReferences.has(session), false, 'Cannot render a released reference');
    assert.equal(session.sessionId, session.binding.sessionId);
    providerReferences.add(session);
    return React.createElement(SessionContext.Provider, { value: session }, children);
  }
  function selectSnapshot(source, selector) {
    const value = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
    return selector(value);
  }
  // This is deliberately a Factory TEST DOUBLE, not a real DSH Chat renderer.
  function NativeFactory({ name, input }) {
    const reference = React.useContext(SessionContext); const editor = React.useRef(null);
    assert.ok(reference); assert.equal(name, 'conversation.content');
    assert.deepEqual(JSON.parse(JSON.stringify(input)), { variant: 'embedded', phase: 'active', hero: false });
    const id = reference.sessionId;
    return React.createElement('section', { 'data-mock-native-session': id },
      React.createElement('p', null, '原生 Factory 测试替身 ' + id),
      React.createElement('textarea', { ref: editor, 'aria-label': '测试替身输入 ' + id }),
      React.createElement('button', { 'aria-label': '测试替身发送 ' + id, onClick: () => reference.binding.session.prompt(editor.current.value) }, '发送'),
      React.createElement('button', { 'aria-label': '测试替身停止 ' + id, onClick: () => reference.binding.session.cancel() }, '停止'));
  }
  function ScopedSlot({ name, owner }) {
    const reference = React.useContext(SessionContext); assert.ok(reference, 'Session child must be below the Provider');
    const entry = [...registrations.values()].find(value => value.options.name === name); assert.ok(entry, 'Missing Session child: ' + name);
    return React.createElement(entry.component, { ...owner, sessionId: reference.sessionId,
      useSession: selector => selectSnapshot(reference.binding.session, selector),
      useConversation: selector => selectSnapshot(reference.binding.conversation, selector),
      useSessions: selector => selectSnapshot(sessions.list, selector),
      renderFactorySlot: (factoryName, input) => React.createElement(NativeFactory, { name: factoryName, input }),
    });
  }
  function renderSlot(name, owner) { return React.createElement(ScopedSlot, { name, owner }); }
  function renderWorkspace() {
    const entry = registrations.get('main:session-watch');
    assert.deepEqual(JSON.parse(JSON.stringify(entry.options.children)), { 'session-watch.native': { kind: 'single', scope: 'session' } });
    return React.createElement(entry.component, { SessionProvider, renderSlot });
  }
  const services = {
    sessions, layout: { selectPanel(id) { selectedPanel = id; } }, uiWorkspace: { openSession(id) { navigated = id; } },
    slots: { inject(name, callback) { return callback(); }, register(options, component) { const key = options.name + ':' + (options.id || options.key); registrations.set(key, { component, options }); return () => registrations.delete(key); } },
  };
  dom.window.fetch = async (url, options) => {
    if (String(url).includes('/status')) return { ok: true, json: async () => ({ items: {} }) };
    if ((options.method === 'GET' && failLoad) || (options.method === 'POST' && failSave)) return { status: 503, json: async () => ({ error: 'unavailable' }) };
    if (options.method === 'POST') {
      assert.match(String(url), /\/update$/);
      const body = JSON.parse(options.body); assert.equal(body.revision, state.revision); state = reduceState(state, body.action);
    }
    return { status: 200, json: async () => ({ state }) };
  };
  dom.window.__ModuleLoader__ = { load({ factory }) {
    const plugin = factory(id => { assert.equal(id, 'react'); return React; });
    plugin.apply({ get: name => services[name], effect(callback) { effects.push(callback()); } });
  } };
  const root = createRoot(dom.window.document.getElementById('root'));
  async function settle() { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); }
  async function click(label) {
    const button = [...dom.window.document.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === label);
    assert.ok(button, 'Missing button: ' + label);
    await act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await settle(); });
  }
  async function key(target, value, options = {}) {
    const event = new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
    await act(async () => { target.dispatchEvent(event); await settle(); await new Promise(resolve => setTimeout(resolve, 5)); });
    return event;
  }
  async function prefix(value) { await key(dom.window.document.activeElement, ';', { ctrlKey: true }); return key(dom.window.document.activeElement, value); }
  try {
    await act(async () => { dom.window.eval(bundle); root.render(renderWorkspace()); await settle(); });
    assert.equal([...registrations.values()].some(entry => ['conversation.content', 'conversation.session', 'conversation.composer', 'conversation.composer.bar'].includes(entry.options.name)), false, 'Workbench must not replace global native slots');
    assert.match(dom.window.document.body.textContent, /把值得关注的会话放在一起/);
    await click('选择关注会话');
    const checks = [...dom.window.document.querySelectorAll('.sw-picker input[type=checkbox]')]; assert.equal(checks.length, 4);
    await act(async () => { for (const checkbox of checks) checkbox.click(); await settle(); });
    await click('添加关注');
    assert.equal(state.followed.length, 4); assert.equal(dom.window.document.querySelectorAll('.sw-card').length, 4);
    await click('加入分屏 测试会话 a');
    assert.equal(state.mode, 'split'); assert.equal(state.panes[0], 'a');
    assert.equal(dom.window.document.querySelector('.sw-pane-title').textContent, '测试会话 a');
    await click('四宫格'); assert.equal(state.layout, 'quad');
    assert.equal(dom.window.document.querySelectorAll('.sw-pane').length, 4);
    const paneTwo = dom.window.document.querySelector('[data-pane="1"]');
    await act(async () => { paneTwo.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })); await settle(); });
    const selectB = [...dom.window.document.querySelectorAll('.sw-select-session')].find(node => node.textContent === '测试会话 b');
    assert.ok(selectB);
    await act(async () => { selectB.click(); await settle(); });
    assert.deepEqual(state.panes.slice(0, 2), ['a', 'b']);
    assert.deepEqual([...dom.window.document.querySelectorAll('[data-mock-native-session]')].map(node => node.dataset.mockNativeSession).sort(), ['a', 'b']);
    assert.equal(promptCalls, 0, 'Mounting native panes must not automatically prompt or cancel');
    const inputA = dom.window.document.querySelector('textarea[aria-label="测试替身输入 a"]');
    const inputB = dom.window.document.querySelector('textarea[aria-label="测试替身输入 b"]');
    inputA.value = 'a 的草稿'; inputB.value = '只发给 b';
    await act(async () => { inputA.focus(); inputA.setSelectionRange(2, 3); await settle(); });
    assert.equal(state.activePane, 0);
    await key(inputA, 'm', { ctrlKey: true, altKey: true });
    assert.equal(dom.window.document.activeElement, inputA); assert.equal(inputA.selectionStart, 2); assert.equal(inputA.selectionEnd, 3);
    assert.equal((await key(inputA, 'ArrowRight', { ctrlKey: true })).defaultPrevented, false, 'Editing Ctrl+arrow stays native');
    assert.equal(state.activePane, 0);
    await prefix('l'); assert.equal(state.activePane, 1); assert.equal(dom.window.document.activeElement, paneTwo);
    await prefix('i'); assert.equal(dom.window.document.activeElement, inputB);
    await prefix('h'); assert.equal(state.activePane, 0); assert.equal(dom.window.document.activeElement, inputA);
    assert.equal(inputA.selectionStart, 2); assert.equal(inputA.selectionEnd, 3);
    await prefix('j'); assert.equal(state.activePane, 2);
    await key(dom.window.document.activeElement, 'ArrowRight', { ctrlKey: true }); assert.equal(state.activePane, 3);
    assert.equal((await key(dom.window.document.activeElement, 'ArrowRight', { ctrlKey: true })).defaultPrevented, true);
    assert.equal(state.activePane, 3, 'No wrap at edge');
    await key(dom.window.document.activeElement, 'ArrowUp', { ctrlKey: true }); assert.equal(state.activePane, 1);
    await prefix(';'); assert.equal(state.activePane, 3);
    await prefix(';'); assert.equal(state.activePane, 1);
    await prefix('/'); assert.equal(dom.window.document.activeElement.getAttribute('aria-label'), '搜索关注会话');
    await prefix('1'); assert.equal(state.activePane, 0);
    assert.equal(promptCalls, 0, 'Navigation/focus shortcuts must never prompt or cancel');
    await click('快捷键设置');
    const floating = dom.window.document.querySelector('[data-sw-shortcut-settings]');
    assert.equal(floating.getAttribute('role'), 'dialog');
    assert.equal(floating.parentElement.parentElement, dom.window.document.querySelector('.sw-app'));
    assert.equal(dom.window.document.querySelector('.sw-main').hasAttribute('inert'), true);
    assert.equal(dom.window.document.querySelector('.sw-rail').hasAttribute('inert'), true);
    assert.ok(inputA.isConnected && inputB.isConnected, 'Floating settings must not remount native conversations');
    const master = dom.window.document.querySelector('input[aria-label="启用全部快捷键"]');
    await act(async () => { master.click(); await settle(); });
    assert.equal(state.shortcuts.enabled, true, 'Unconfirmed draft must not affect active shortcuts');
    await click('录制公共前缀');
    assert.equal((await key(dom.window.document.activeElement, 'b', { ctrlKey: true })).defaultPrevented, false, 'Recording must preserve native Ctrl+B');
    assert.equal(dom.window.document.querySelector('[aria-label="快捷键录制区"]'), null);
    assert.equal((await key(dom.window.document.activeElement, 'j')).defaultPrevented, false, 'Recording must not arm runtime prefix');
    await click('录制公共前缀');
    await key(dom.window.document.activeElement, 'k', { ctrlKey: true, altKey: true });
    assert.equal(state.shortcuts.prefix, 'Ctrl+;');
    await click('保存并应用');
    assert.equal(state.shortcuts.enabled, false); assert.equal(state.shortcuts.prefix, 'Ctrl+Alt+K');
    await click('关闭快捷键设置');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(dom.window.document.querySelector('.sw-main').hasAttribute('inert'), false);
    assert.equal(dom.window.document.activeElement, inputA, 'Closing floating settings restores opener focus');
    await act(async () => { dom.window.document.querySelector('[data-pane="0"]').focus(); await settle(); });
    assert.equal((await key(dom.window.document.activeElement, 'ArrowRight', { ctrlKey: true })).defaultPrevented, false);
    assert.equal(state.activePane, 0, 'Master-off must stop key execution');
    await click('快捷键设置');
    assert.equal(dom.window.document.querySelector('[aria-label="公共前缀"]').value, 'Ctrl+Alt+K');
    await click('恢复全部默认');
    assert.equal(state.shortcuts.enabled, false, 'Reset is only a draft until saved');
    await click('保存并应用'); assert.equal(state.shortcuts.enabled, true); assert.equal(state.shortcuts.prefix, 'Ctrl+;');
    await click('关闭快捷键设置');
    assert.equal(promptCalls, 0, 'Settings and recording must never invoke native business actions');
    await click('测试替身发送 b');
    assert.deepEqual(commands, [{ type: 'prompt', sessionId: 'b', text: '只发给 b' }]);
    assert.equal(inputA.value, 'a 的草稿', 'Sending in b must not change a draft');
    await click('测试替身停止 a');
    assert.deepEqual(commands[1], { type: 'cancel', sessionId: 'a' });
    await act(async () => { dom.window.document.querySelector('[data-pane="0"]').focus(); await settle(); });
    await prefix('z'); assert.equal(dom.window.document.querySelector('.is-maximized').dataset.pane, '0');
    await prefix('l'); assert.equal(dom.window.document.querySelector('.is-maximized').dataset.pane, '1');
    await prefix('z'); assert.equal(dom.window.document.querySelector('.is-maximized'), null);
    await click('卡片模式');
    assert.equal(dom.window.document.querySelectorAll('[data-mock-native-session]').length, 0);
    assert.ok(providerReferences.size >= 2);
    for (const reference of providerReferences) assert.ok(releasedReferences.has(reference), 'Mode change must release native-pane references');
    await click('分屏模式');
    assert.equal(dom.window.document.querySelectorAll('[data-mock-native-session]').length, 2);
    assert.equal(promptCalls, 2, 'Remounting panes must not repeat user operations');
    await click('最大化窗格'); assert.ok(dom.window.document.querySelector('.sw-pane.is-maximized'));
    await click('恢复布局'); assert.equal(dom.window.document.querySelector('.sw-pane.is-maximized'), null);
    await click('移出分屏（保留关注，不停止任务）');
    assert.equal(state.panes[0], null); assert.deepEqual(state.followed, ['a', 'b', 'c', 'd']);
    await click('取消关注 测试会话 a'); assert.equal(state.followed.includes('a'), false);
    await click('撤销取消关注'); assert.equal(state.followed.includes('a'), true);
    await click('打开原会话 测试会话 a'); assert.equal(navigated, 'a');
    const Return = registrations.get('conversation.session.header.utilities:session-watch-return').component;
    await act(async () => { root.render(React.createElement(Return)); await settle(); });
    await click('返回关注工作台'); assert.equal(selectedPanel, 'session-watch');
    selectedPanel = 'other';
    assert.equal((await key(dom.window.document.body, 'ArrowLeft', { ctrlKey: true })).defaultPrevented, false);
    assert.equal(selectedPanel, 'other', 'Local navigation is not active outside workbench');
    assert.equal((await key(dom.window.document.body, 'm', { ctrlKey: true, altKey: true })).defaultPrevented, true);
    assert.equal(selectedPanel, 'session-watch');
    const Header = registrations.get('conversation.session.header.actions:session-watch-follow').component;
    await act(async () => { root.render(React.createElement(Header, { sessionId: 'a' })); await settle(); });
    assert.match(dom.window.document.body.textContent, /已关注/);
    await click('取消关注会话'); assert.equal(state.followed.includes('a'), false);
    await click('关注会话'); assert.equal(state.followed.includes('a'), true);
    failSave = true;
    await click('取消关注会话');
    assert.equal(state.followed.includes('a'), true);
    assert.match(dom.window.document.querySelector('[role=status]').textContent, /保存失败/);
    failSave = false;
    await click('取消关注会话'); assert.equal(state.followed.includes('a'), false);
    // Recreate the Client half with an initialization error. Unlike the old
    // permanently-disabled star, the failure is visible and directly retryable.
    await act(async () => { root.render(null); await settle(); });
    for (const dispose of effects.splice(0).reverse()) if (typeof dispose === 'function') dispose();
    failLoad = true;
    await act(async () => {
      dom.window.eval(bundle);
      root.render(React.createElement(registrations.get('conversation.session.header.actions:session-watch-follow').component, { sessionId: 'fresh' }));
      await settle();
    });
    assert.match(dom.window.document.body.textContent, /加载失败，重试/);
    const retry = dom.window.document.querySelector('button[aria-label="重试加载关注状态"]');
    assert.ok(retry); assert.equal(retry.disabled, false);
    failLoad = false;
    await click('重试加载关注状态'); assert.equal(state.followed.includes('fresh'), true);
    assert.match(dom.window.document.body.textContent, /已关注/);
    assert.equal(promptCalls, 2, 'Only the two explicit user actions may invoke prompt/cancel');
    assert.deepEqual(commands, [{ type: 'prompt', sessionId: 'b', text: '只发给 b' }, { type: 'cancel', sessionId: 'a' }]);
    assert.equal(dom.window.document.body.textContent.includes('PRIVATE_REASONING'), false);
    assert.deepEqual(errors, []);
  } finally {
    await act(async () => root.unmount());
    for (const dispose of effects.reverse()) if (typeof dispose === 'function') dispose();
    assert.equal(retains, releases); assert.equal(subscriptions, 0);
    for (const reference of allReferences) assert.ok(releasedReferences.has(reference), 'Every retained reference must be released on unmount');
    assert.equal(dom.window.document.querySelectorAll('[data-session-watch]').length, 0);
    assert.equal(dom.window.document.querySelectorAll('style[data-session-watch]').length, 0);
    dom.window.close(); globalThis.window = previousWindow; globalThis.document = previousDocument;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
