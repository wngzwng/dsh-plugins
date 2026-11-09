import test from 'node:test';
import assert from 'node:assert/strict';

/*
 * Dependency-free integration checks for the Pomodoro Clock browser half.
 *
 * The plugin is a plain `window.__ModuleLoader__` bundle whose factory requires
 * `react` and (optionally) `react-dom`, so the tests load it with a fake
 * window/document, a fake locale service, a recording fake `react-dom` and a
 * minimal recursive React renderer (no npm install, no jsdom, no network).
 *
 * Two just-fixed regressions are locked in here:
 *   - the settings scrim/dialog render through `ReactDOM.createPortal` into
 *     `document.body`, because the composer dock's `will-change: transform`
 *     makes `position: fixed` descendants position against the dock strip;
 *   - the rounds row is a count (`次` / `times`), not a duration (`分钟`).
 */

const SETTINGS_KEY = 'dsh-pomodoro-clock:settings:v1';
const DEFINITIONS = [];
const PORTAL = Symbol('react.portal');

globalThis.window = {
  __ModuleLoader__: { load: (definition) => DEFINITIONS.push(definition) },
};

await import('../pomodoro-clock/client.js');

/* ------------------------------------------------------------------ */
/* Fakes                                                               */
/* ------------------------------------------------------------------ */

function makeDocument() {
  const listeners = new Map();
  const body = { tagName: 'BODY' };
  return {
    activeElement: null,
    body,
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    },
    dispatch(type, event) {
      for (const handler of (listeners.get(type) || []).slice()) handler(event);
    },
    createElement() {
      return { click() {} };
    },
  };
}

function createStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

function isRenderable(value) {
  return value !== null && value !== undefined && value !== false && value !== true;
}

function sameDeps(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => Object.is(value, b[index]));
}

/*
 * Minimal hook-capable renderer. Component instances are keyed by their tree
 * path so state/refs/effects survive re-renders. `useEffect` callbacks run in
 * `flushEffects()` after the tree has been laid out, matching React closely
 * enough for these components. Portal nodes returned by the fake `react-dom`
 * are rendered inline in the tree so their children stay findable.
 */
function createReact() {
  const Fragment = Symbol('Fragment');
  const instances = new Map();
  let current = null;
  let pendingEffects = [];
  let dirty = false;
  let rootElement = null;
  let tree = null;

  function createElement(type, config, ...children) {
    const props = Object.assign({}, config || {});
    const key = props.key === undefined ? null : props.key;
    delete props.key;
    const flat = children.flat(Infinity).filter(isRenderable);
    if (flat.length > 0) props.children = flat;
    return { type, key, props, children: flat };
  }

  function registerEffect(effect, deps) {
    const instance = current;
    const index = instance.effectIndex++;
    const previous = instance.effects[index];
    if (previous !== undefined && sameDeps(previous.deps, deps)) return;
    const record = {
      instance,
      effect,
      deps: deps === undefined || deps === null ? undefined : deps.slice(),
      cleanup: previous === undefined ? undefined : previous.cleanup,
    };
    instance.effects[index] = record;
    pendingEffects.push(record);
  }

  const React = {
    Fragment,
    createElement,
    useState(initial) {
      const instance = current;
      const index = instance.stateIndex++;
      if (!(index in instance.states)) {
        instance.states[index] = typeof initial === 'function' ? initial() : initial;
      }
      return [
        instance.states[index],
        (next) => {
          instance.states[index] =
            typeof next === 'function' ? next(instance.states[index]) : next;
          dirty = true;
        },
      ];
    },
    useRef(initial) {
      const instance = current;
      const index = instance.refIndex++;
      if (instance.refs[index] === undefined) instance.refs[index] = { current: initial };
      return instance.refs[index];
    },
    useCallback(fn, deps) {
      const instance = current;
      const index = instance.memoIndex++;
      const previous = instance.memos[index];
      if (previous !== undefined && sameDeps(previous.deps, deps)) return previous.fn;
      instance.memos[index] = { fn, deps: deps === undefined ? undefined : deps.slice() };
      return fn;
    },
    useEffect(effect, deps) {
      registerEffect(effect, deps);
    },
  };

  function renderChildren(children, parentPath) {
    return (children || []).map((child, index) => {
      const keyed =
        child !== null &&
        typeof child === 'object' &&
        child.key !== null &&
        child.key !== undefined;
      const childPath =
        parentPath + '/' + (keyed ? 'k:' + String(child.key) : 'i:' + String(index));
      return renderNode(child, childPath);
    });
  }

  function renderNode(node, path) {
    if (!isRenderable(node)) return null;
    if (typeof node === 'string' || typeof node === 'number') return node;
    if (Array.isArray(node)) return node.map((child, index) => renderNode(child, path + '/' + index));
    if (node.type === Fragment) {
      return {
        type: 'fragment',
        key: node.key,
        props: {},
        children: renderChildren(node.children, path),
      };
    }
    if (node.type === PORTAL) {
      const portalChildren = Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children];
      return {
        type: 'portal',
        key: node.key,
        props: { container: node.props.container },
        children: renderChildren(portalChildren, path + '/portal'),
      };
    }
    if (typeof node.type === 'function') {
      let instance = instances.get(path);
      if (instance === undefined) {
        instance = {
          states: [],
          refs: [],
          memos: [],
          effects: [],
          stateIndex: 0,
          refIndex: 0,
          memoIndex: 0,
          effectIndex: 0,
          visited: false,
        };
        instances.set(path, instance);
      }
      instance.visited = true;
      instance.stateIndex = 0;
      instance.refIndex = 0;
      instance.memoIndex = 0;
      instance.effectIndex = 0;
      const saved = current;
      current = instance;
      const output = node.type(node.props || {});
      current = saved;
      const rendered = renderNode(output, path + '/out');
      return {
        type: 'component',
        component: node.type,
        key: node.key,
        props: node.props || {},
        children: rendered === null ? [] : [rendered],
      };
    }
    const rendered = {
      type: node.type,
      key: node.key,
      props: node.props || {},
      children: renderChildren(node.children, path),
    };
    // Minimal DOM-ish surface so refs (dialog focus) behave like refs.
    rendered.getBoundingClientRect = () => ({
      left: 0,
      right: 340,
      top: 0,
      bottom: 400,
      width: 340,
      height: 400,
    });
    rendered.contains = (target) => target === rendered;
    rendered.focus = () => {
      if (typeof globalThis.document !== 'undefined') {
        globalThis.document.activeElement = rendered;
      }
    };
    rendered.click = () => {};
    rendered.select = () => {};
    if (node.props.ref !== null && node.props.ref !== undefined && typeof node.props.ref === 'object') {
      node.props.ref.current = rendered;
    }
    return rendered;
  }

  function flushEffects() {
    while (pendingEffects.length > 0) {
      const batch = pendingEffects;
      pendingEffects = [];
      for (const record of batch) {
        if (record.instance.visited === false) continue;
        if (typeof record.cleanup === 'function') record.cleanup();
        const cleanup = record.effect();
        record.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      }
    }
  }

  function prune() {
    for (const [path, instance] of instances) {
      if (instance.visited) continue;
      for (const record of instance.effects) {
        if (record !== undefined && typeof record.cleanup === 'function') record.cleanup();
      }
      instances.delete(path);
    }
  }

  return {
    React,
    render(element) {
      rootElement = element;
      let result = null;
      for (let pass = 0; pass < 25; pass += 1) {
        dirty = false;
        for (const instance of instances.values()) instance.visited = false;
        result = renderNode(rootElement, 'root');
        flushEffects();
        prune();
        if (!dirty) break;
      }
      tree = result;
      return result;
    },
    getTree() {
      return tree;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

function harness(options = {}) {
  const storage = createStorage(options.storage || {});
  const document = makeDocument();
  globalThis.document = document;
  globalThis.window = {
    localStorage: storage,
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener() {},
    removeEventListener() {},
  };

  const dictionaries = { en: {}, zh: {} };
  const language = options.lang === 'en' ? 'en' : 'zh';
  const translate = (key, values) => {
    let text = dictionaries[language][key];
    if (typeof text !== 'string') return key;
    if (values !== undefined && values !== null) {
      for (const [name, value] of Object.entries(values)) {
        text = text.split('{' + name + '}').join(String(value));
      }
    }
    return text;
  };
  const locale = {
    register(namespace, lang, dictionary) {
      dictionaries[lang] = dictionary;
      return () => {};
    },
    bind() {
      return translate;
    },
    getSnapshot() {
      return { active: language, revision: 0 };
    },
    subscribe() {
      return () => {};
    },
  };

  const slots = {};
  const ctx = {
    effect(fn) {
      fn();
    },
    locale,
    slots: {
      inject(name, fn) {
        fn();
      },
      register(config, component) {
        slots[config.name || config.key] = { config, component };
        return () => {};
      },
    },
  };

  const { React, render } = createReact();
  const portals = [];
  const ReactDOM = {
    createPortal(children, container) {
      portals.push({ children, container });
      return { type: PORTAL, key: null, props: { children, container } };
    },
  };

  const definition = DEFINITIONS[0];
  assert.equal(definition.id, '@local/pomodoro-clock');
  const plugin = definition.factory((id) => {
    if (id === 'react') return React;
    if (id === 'react-dom') return ReactDOM;
    throw new Error('unexpected require: ' + id);
  });
  plugin.apply(ctx);

  const dockEntry = slots['conversation.composer.dock'].component;
  const h = {
    storage,
    dictionaries,
    slots,
    React,
    ReactDOM,
    document,
    portals,
    tree: null,
  };

  h.renderDock = () => {
    h.tree = render(React.createElement(dockEntry, {}));
    return h.tree;
  };
  h.text = (...args) => {
    const value = args.length === 0 ? h.tree : args[0];
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map((child) => h.text(child)).join('');
    return (value.children || []).map((child) => h.text(child)).join('');
  };
  h.all = (type) => {
    const found = [];
    const visit = (node) => {
      if (node === null || typeof node !== 'object') return;
      if (node.type === type) found.push(node);
      (node.children || []).forEach(visit);
    };
    visit(h.tree);
    return found;
  };
  h.descendants = (node, predicate) => {
    const found = [];
    const visit = (value) => {
      if (value === null || typeof value !== 'object') return;
      if (predicate(value)) found.push(value);
      (value.children || []).forEach(visit);
    };
    visit(node);
    return found;
  };
  h.settingsButton = () => {
    const button = h.all('button').find((node) => node.props['aria-haspopup'] === 'dialog');
    assert.ok(button, 'composer dock has a settings button');
    return button;
  };
  h.openSettings = () => {
    const button = h.settingsButton();
    button.props.onClick();
    h.renderDock();
    return button;
  };
  h.dialog = () => h.all('div').find((node) => node.props.role === 'dialog');
  h.portalNodes = () => h.all('portal');
  h.backdrop = () =>
    h.all('div').find((node) => String(node.props.className || '').includes('pomo-backdrop'));
  h.unitSpans = () =>
    h
      .all('span')
      .filter((node) => String(node.props.className || '') === 'pomo-unit')
      .map((node) => h.text(node));
  h.numberInput = (label) =>
    h
      .all('input')
      .find((node) => String(node.props['aria-label'] || '').startsWith(label + ' ('));
  h.stepButton = (ariaLabel) =>
    h.all('button').find((node) => node.props['aria-label'] === ariaLabel);
  h.button = (label) => h.all('button').find((node) => h.text(node) === label);
  h.storageSettings = () => {
    const raw = storage.map.get(SETTINGS_KEY);
    return raw === undefined ? undefined : JSON.parse(raw);
  };
  return h;
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test('settings scrim and dialog are portalled to document.body', () => {
  const h = harness();
  h.renderDock();
  assert.deepEqual(Object.keys(h.slots).sort(), ['conversation.composer.dock']);
  h.openSettings();

  assert.ok(h.portals.length >= 1, 'ReactDOM.createPortal() is used for the dialog');
  for (const call of h.portals) {
    assert.equal(call.container, h.document.body, 'portal container is document.body');
    assert.equal(call.container, globalThis.document.body);
  }

  const portals = h.portalNodes();
  assert.equal(portals.length, 1, 'the rendered tree has exactly one portal');
  const scrim = h.descendants(portals[0], (node) =>
    String(node.props.className || '').includes('pomo-backdrop'),
  );
  assert.equal(scrim.length, 1, 'the scrim is rendered inside the portalled subtree');
  const dialog = h.descendants(portals[0], (node) => node.props.role === 'dialog');
  assert.equal(dialog.length, 1, 'the dialog is rendered inside the portalled subtree');
  assert.equal(dialog[0].props['aria-modal'], 'true');
  assert.match(h.text(portals[0]), /番茄时钟设置/);
  assert.match(h.text(portals[0]), /每轮专注次数/);

  const dockPill = h.all('span').find((node) => String(node.props.className || '') === 'pomo');
  assert.ok(dockPill, 'the composer dock pill exists');
  assert.equal(
    h.descendants(dockPill, (node) => String(node.props.className || '').includes('pomo-dialog'))
      .length,
    0,
    'the dialog is not laid out inside the composer dock pill',
  );
});

test('rounds setting shows the times unit while durations show minutes', () => {
  const h = harness();
  h.renderDock();
  h.openSettings();

  const dialog = h.dialog();
  assert.ok(dialog, 'the settings dialog is open');
  const text = h.text(dialog);
  for (const label of ['专注时长', '短休息时长', '长休息时长', '每轮专注次数']) {
    assert.ok(text.includes(label), 'dialog shows ' + label);
  }

  assert.deepEqual(h.unitSpans(), ['分钟', '分钟', '分钟', '次'], 'units per row in zh');

  const rounds = h.numberInput('每轮专注次数');
  assert.ok(rounds, 'the rounds number input exists');
  assert.equal(rounds.props.value, 4);
  assert.match(rounds.props['aria-label'], /次/);
  assert.doesNotMatch(rounds.props['aria-label'], /分钟/);

  const focus = h.numberInput('专注时长');
  assert.ok(focus, 'the focus number input exists');
  assert.equal(focus.props.value, 25);
  assert.match(focus.props['aria-label'], /分钟/);

  const en = harness({ lang: 'en' });
  en.renderDock();
  en.openSettings();
  assert.deepEqual(en.unitSpans(), ['min', 'min', 'min', 'times'], 'units per row in en');
  const enRounds = en.numberInput('Focus sessions per cycle');
  assert.ok(enRounds, 'the English rounds number input exists');
  assert.match(enRounds.props['aria-label'], /times/);
});

test('save persists the edited settings and cancel discards the draft', () => {
  const h = harness();
  h.renderDock();
  assert.equal(h.storageSettings(), undefined, 'nothing is written before Save');
  h.openSettings();

  const plus = h.stepButton('增加 每轮专注次数');
  assert.ok(plus, 'the rounds increase button exists');
  plus.props.onClick();
  h.renderDock();
  assert.equal(h.numberInput('每轮专注次数').props.value, 5, 'the draft bumps to 5');
  assert.equal(h.storageSettings(), undefined, 'editing alone does not persist');

  const save = h.button('保存');
  assert.ok(save, 'the Save button exists');
  save.props.onClick();
  h.renderDock();
  assert.equal(h.dialog(), undefined, 'the dialog closes after Save');
  assert.equal(h.numberInput('每轮专注次数'), undefined, 'no dialog input remains in the tree');

  const stored = h.storageSettings();
  assert.ok(stored, 'settings were persisted');
  assert.equal(stored.rounds, 5);
  assert.equal(stored.focus, 25);
  assert.equal(stored.short, 5);
  assert.equal(stored.long, 15);

  h.openSettings();
  assert.equal(h.numberInput('每轮专注次数').props.value, 5, 'the saved value is loaded again');
  const plusAgain = h.stepButton('增加 每轮专注次数');
  plusAgain.props.onClick();
  h.renderDock();
  assert.equal(h.numberInput('每轮专注次数').props.value, 6, 'the draft bumps again');

  const cancel = h.button('取消');
  assert.ok(cancel, 'the Cancel button exists');
  cancel.props.onClick();
  h.renderDock();
  assert.equal(h.dialog(), undefined, 'the dialog closes after Cancel');
  assert.equal(h.storageSettings().rounds, 5, 'Cancel leaves the persisted settings untouched');

  h.openSettings();
  assert.equal(h.numberInput('每轮专注次数').props.value, 5, 'reopening discards the cancelled draft');
});

test('Escape and a backdrop click close the dialog without saving', () => {
  const h = harness();
  h.renderDock();
  h.openSettings();
  assert.ok(h.dialog(), 'the dialog is open');

  h.document.dispatch('keydown', {
    key: 'Escape',
    stopPropagation() {},
    preventDefault() {},
  });
  h.renderDock();
  assert.equal(h.dialog(), undefined, 'Escape closes the dialog');
  assert.equal(h.storageSettings(), undefined, 'Escape does not persist');

  h.openSettings();
  const backdrop = h.backdrop();
  assert.ok(backdrop, 'the backdrop exists');
  backdrop.props.onMouseDown({ target: h.dialog(), currentTarget: backdrop });
  h.renderDock();
  assert.ok(h.dialog(), 'a mousedown inside the dialog keeps it open');

  const clickAway = h.backdrop();
  clickAway.props.onMouseDown({ target: clickAway, currentTarget: clickAway });
  h.renderDock();
  assert.equal(h.dialog(), undefined, 'clicking the backdrop closes the dialog');
  assert.equal(h.storageSettings(), undefined, 'the backdrop does not persist');
});
