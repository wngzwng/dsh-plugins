import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as React from 'react';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createDefaultState, reduceState } from '../core.js';

// Diagnostic fixture, NOT a real AppFrame/ResizeObserver/browser-width test.
// Model the verified keyed-main navigation and a shared Session generation.
test('incident diagnostic: 20 keyed workbench/original round trips release pane refs and sidebar focus remains available', { timeout: 15000 }, async () => {
  const errors = []; const console = new VirtualConsole(); console.on('jsdomError', value => errors.push(value));
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/', runScripts: 'outside-only', virtualConsole: console });
  const oldWindow = globalThis.window; const oldDocument = globalThis.document;
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client'); const h = React.createElement;
  let subscriptions = 0;
  function observable(initial) {
    let value = initial; const listeners = new Set();
    return { getSnapshot: () => value, subscribe(fn) { subscriptions++; listeners.add(fn); return () => { subscriptions--; listeners.delete(fn); }; }, set(next) { value = next; for (const fn of [...listeners]) fn(); } };
  }
  const definitions = new Map(); const disposers = []; const version = observable(0); const panel = observable('session-watch');
  const bindings = new Map(); let mainRef; let generation = 0; const focusListeners = new Set();
  const add = dom.window.document.addEventListener.bind(dom.window.document); const remove = dom.window.document.removeEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = (type, fn, opts) => { if (type === 'focusin' && opts === true) focusListeners.add(fn); return add(type, fn, opts); };
  dom.window.document.removeEventListener = (type, fn, opts) => { if (type === 'focusin' && opts === true) focusListeners.delete(fn); return remove(type, fn, opts); };
  const summary = id => ({ id, sessionId: id, displayTitle: 'diagnostic ' + id, cwd: '/diagnostic', blank: false });
  const list = observable({ ids: ['a', 'b'], byId: { a: summary('a'), b: summary('b') } });
  function publishList() { list.set({ ...list.getSnapshot(), byId: Object.fromEntries(['a', 'b'].map(id => [id, { ...summary(id), retainedBy: { ...bindings.get(id)?.counts } }])) }); }
  const sessions = { list, retain(id, { source }) {
    let record = bindings.get(id);
    if (!record || record.total === 0) { record = { generation: ++generation, counts: {}, total: 0, binding: {
      sessionId: id, session: observable({ sessionId: id, openState: 'open', blank: false, removed: false, running: false }),
      conversation: observable({ activeTargets: new Set(['chat']) }), eventSource: observable({ entries: [], hasMore: false }),
    } }; bindings.set(id, record); }
    record.counts[source] = (record.counts[source] || 0) + 1; record.total++; publishList(); let released = false;
    return { sessionId: id, binding: record.binding, ready: Promise.resolve(record.binding), release() {
      assert.equal(released, false); released = true; record.counts[source]--; record.total--; publishList();
    } };
  } };
  const keyFor = options => options.name + ':' + (options.id || options.key || 'single');
  const slots = { inject(name, callback) { const off = callback(); disposers.push(off); return off; }, register(options, component) {
    const key = keyFor(options); const entry = { options, component }; definitions.set(key, entry); version.set(version.getSnapshot() + 1);
    return () => { if (definitions.get(key) === entry) { definitions.delete(key); version.set(version.getSnapshot() + 1); } };
  } };
  const services = { sessions, slots, layout: { selectPanel: key => panel.set(key || 'conversation') }, uiWorkspace: { openSession(id) {
    const next = sessions.retain(id, { source: 'mainView' }); const old = mainRef; mainRef = next; old?.release(); panel.set('conversation');
  } } };
  let state = { ...createDefaultState(), followed: ['a', 'b'], panes: ['a', 'b', null, null], mode: 'split' };
  dom.window.fetch = async (url, options) => {
    if (String(url).includes('/status')) return { ok: true, json: async () => ({ items: {} }) };
    if (options.method === 'POST') { const body = JSON.parse(options.body); assert.equal(body.revision, state.revision); state = reduceState(state, body.action); }
    return { status: 200, json: async () => ({ state }) };
  };
  const SessionContext = React.createContext(null);
  const SessionProvider = ({ session, children }) => h(SessionContext.Provider, { value: session }, children);
  function Scoped() {
    const ref = React.useContext(SessionContext); const component = definitions.get('session-watch.native:single').component;
    const read = (source, select) => React.useSyncExternalStore(source.subscribe, () => select(source.getSnapshot()));
    return h(component, { sessionId: ref.sessionId, useSession: select => read(ref.binding.session, select), useConversation: select => read(ref.binding.conversation, select), useSessions: select => read(list, select), renderFactorySlot: () => h('textarea', { 'aria-label': 'fixture native editor ' + ref.sessionId }) });
  }
  function Original() {
    const [right, setRight] = React.useState(false); const input = React.useRef(null);
    React.useLayoutEffect(() => { if (right) input.current.focus(); }, [right]);
    return h('section', { 'data-original': 'true' },
      [...definitions.values()].filter(entry => entry.options.name === 'conversation.session.header.utilities').map(entry => h(entry.component, { key: keyFor(entry.options), sessionId: 'a' })),
      h('button', { 'aria-label': 'fixture rightbar', onClick: () => setRight(value => !value) }, 'rightbar'), right ? h('input', { ref: input, 'aria-label': 'fixture rightbar input' }) : null);
  }
  function Frame() {
    const current = React.useSyncExternalStore(panel.subscribe, panel.getSnapshot); React.useSyncExternalStore(version.subscribe, version.getSnapshot);
    return current === 'session-watch' ? h(definitions.get('main:session-watch').component, { key: current, SessionProvider, renderSlot: () => h(Scoped) }) : h(Original, { key: current });
  }
  dom.window.__ModuleLoader__ = { load({ factory }) { const plugin = factory(() => React); plugin.apply({ get: key => services[key], effect(callback) { disposers.push(callback()); } }); } };
  const root = createRoot(dom.window.document.getElementById('root'));
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
  const click = async label => { const node = [...dom.window.document.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === label); assert.ok(node, label); await React.act(async () => { node.click(); await settle(); }); };
  try {
    await React.act(async () => { dom.window.eval(await readFile(new URL('../client.js', import.meta.url), 'utf8')); root.render(h(Frame)); await settle(); });
    for (let round = 0; round < 20; round++) {
      assert.equal([...bindings.values()].reduce((sum, record) => sum + (record.counts.controllerOperation || 0), 0), 4);
      if (round % 2) { await click('快捷键设置'); await click('关闭快捷键设置'); }
      const button = dom.window.document.querySelector('[data-pane="0"] button[aria-label="打开原会话"]'); assert.ok(button);
      await React.act(async () => { button.click(); await settle(); });
      assert.equal(dom.window.document.querySelector('.sw-app'), null);
      assert.equal([...bindings.values()].reduce((sum, record) => sum + (record.counts.controllerOperation || 0), 0), 0);
      assert.equal(bindings.get('a').counts.mainView, 1); assert.equal(focusListeners.size, 0);
      assert.equal([...definitions.values()].filter(entry => entry.options.id === 'session-watch-return').length, 1);
      await click('fixture rightbar'); assert.equal(dom.window.document.activeElement.getAttribute('aria-label'), 'fixture rightbar input');
      await click('返回关注工作台');
    }
    assert.deepEqual(errors, []);
  } finally {
    await React.act(async () => root.unmount()); mainRef?.release();
    for (const off of disposers.reverse()) if (typeof off === 'function') off();
    assert.equal(subscriptions, 0); assert.equal(focusListeners.size, 0); assert.ok([...bindings.values()].every(record => record.total === 0));
    dom.window.close(); globalThis.window = oldWindow; globalThis.document = oldDocument; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
