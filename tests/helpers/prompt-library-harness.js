/*
 * Dependency-free test harness for the Prompt Library browser bundle.
 *
 * The plugin is a plain bundle for `window.__ModuleLoader__`, so this harness
 * loads it with a fake window/document, a fake locale service, a fake fetch,
 * and a minimal recursive React renderer (no npm install, no jsdom). Real
 * component trees are rendered: pages, dialogs, portals and the composer quick
 * picker are all driven through their props and DOM-ish events.
 *
 * Usage:
 *   import { harness } from './helpers/prompt-library-harness.js';
 *   const h = harness();       // builds mock storage/document/locale/react
 *   h.renderPage();            // renders the sidebar `main` page
 *   h.renderQuick({...});      // renders the composer entry with slot props
 */

const DEFINITIONS = [];
const PORTAL = Symbol('portal');

// Keep the pristine URL blob helpers once; every harness installs a recording
// wrapper so download content can be asserted even when Node provides them.
const ORIGINAL_CREATE_OBJECT_URL =
  typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL.bind(URL)
    : null;
const ORIGINAL_REVOKE_OBJECT_URL =
  typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function'
    ? URL.revokeObjectURL.bind(URL)
    : null;

globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      DEFINITIONS.push(definition);
    },
  },
};

// Load once; each harness re-runs the factory so stores/components are fresh.
await import('../../prompt-library/client.js');

if (DEFINITIONS.length === 0) {
  throw new Error(
    'prompt-library/client.js did not register a module; run `node prompt-library/build-client.mjs` first',
  );
}

/* ------------------------------------------------------------------ */
/* Fakes                                                               */
/* ------------------------------------------------------------------ */

function makeElement(tagName) {
  const element = {
    tagName: String(tagName || 'div').toUpperCase(),
    style: {},
    dataset: {},
    attributes: {},
    children: [],
    parentNode: null,
    textContent: '',
    value: '',
    href: '',
    download: '',
    disabled: false,
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'style') this.style = this.style || {};
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    appendChild(child) {
      this.children.push(child);
      if (child) child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      if (child) child.parentNode = null;
      return child;
    },
    contains() {
      return false;
    },
    querySelectorAll() {
      return [];
    },
    click() {},
    focus() {},
    select() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    },
  };
  return element;
}

function makeDocument() {
  const listeners = new Map();
  const head = makeElement('head');
  const body = makeElement('body');
  const document = {
    activeElement: null,
    head,
    body,
    createElement: (tag) => makeElement(tag),
    execCommand: () => true,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
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
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },
  };
  return document;
}

function createStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      if (storageShouldFail) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      map.set(key, String(value));
    },
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };
}

let storageShouldFail = false;

function isRenderable(value) {
  return value !== null && value !== undefined && value !== false && value !== true;
}

function sameDeps(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => Object.is(value, b[index]));
}

function createReact() {
  const Fragment = Symbol('Fragment');
  const instances = new Map();
  const componentIds = new WeakMap();
  let nextComponentId = 0;
  function componentId(type) {
    let id = componentIds.get(type);
    if (id === undefined) {
      nextComponentId += 1;
      id = nextComponentId;
      componentIds.set(type, id);
    }
    return id;
  }
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
          const nextValue = typeof next === 'function' ? next(instance.states[index]) : next;
          if (Object.is(nextValue, instance.states[index])) return;
          instance.states[index] = nextValue;
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
    useMemo(fn, deps) {
      const instance = current;
      const index = instance.memoIndex++;
      const previous = instance.memos[index];
      if (previous !== undefined && sameDeps(previous.deps, deps)) return previous.value;
      const value = fn();
      instance.memos[index] = { value, deps: deps === undefined ? undefined : deps.slice() };
      return value;
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
    useLayoutEffect(effect, deps) {
      registerEffect(effect, deps);
    },
    useSyncExternalStore(subscribe, getSnapshot) {
      const instance = current;
      const index = instance.memoIndex++;
      const snapshot = getSnapshot();
      const previous = instance.memos[index];
      const record = previous && previous.kind === 'sync' ? previous : { kind: 'sync', deps: [subscribe], subscriptions: [] };
      instance.memos[index] = record;
      if (record.previousSnapshot !== snapshot) {
        record.previousSnapshot = snapshot;
        if (record.subscribe === subscribe && typeof subscribe === 'function') {
          /* subscribe lifecycle handled in the effect below */
        }
      }
      React.useEffect(() => {
        if (typeof subscribe !== 'function') return undefined;
        const unsubscribe = subscribe(() => {
          dirty = true;
        });
        return typeof unsubscribe === 'function' ? unsubscribe : undefined;
      }, [subscribe]);
      return snapshot;
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
    if (node.type === PORTAL) {
      return {
        type: 'portal',
        key: node.key,
        props: {},
        children: renderChildren(node.children, path),
      };
    }
    if (node.type === Fragment) {
      return {
        type: 'fragment',
        key: node.key,
        props: {},
        children: renderChildren(node.children, path),
      };
    }
    if (typeof node.type === 'function') {
      const instanceKey = path + '#c' + String(componentId(node.type));
      let instance = instances.get(instanceKey);
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
        instances.set(instanceKey, instance);
      }
      instance.visited = true;
      instance.stateIndex = 0;
      instance.refIndex = 0;
      instance.memoIndex = 0;
      instance.effectIndex = 0;
      const saved = current;
      current = instance;
      let output;
      try {
        output = node.type(node.props || {});
      } finally {
        current = saved;
      }
      const rendered = renderNode(output, path + '/out');
      return {
        type: 'component',
        component: node.type,
        key: node.key,
        props: node.props || {},
        children: rendered === null ? [] : [rendered],
      };
    }
    return {
      type: node.type,
      key: node.key,
      props: node.props || {},
      children: renderChildren(node.children, path),
    };
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
    for (const [key, instance] of instances) {
      if (instance.visited) continue;
      for (const record of instance.effects) {
        if (record !== undefined && typeof record.cleanup === 'function') record.cleanup();
      }
      instances.delete(key);
    }
  }

  return {
    React,
    createPortal(children, container) {
      return { type: PORTAL, key: null, props: { container }, children: [children] };
    },
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
    unsubscribeAll() {
      for (const instance of instances.values()) {
        for (const record of instance.effects) {
          if (record !== undefined && typeof record.cleanup === 'function') record.cleanup();
        }
      }
      instances.clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

export function harness(options = {}) {
  const storage = createStorage(options.storage || {});
  const calls = { fetch: [], copies: [], inserts: [], drafts: [], downloads: [] };
  const blobs = new Map();
  let blobSeq = 0;
  if (typeof globalThis.URL !== 'undefined') {
    // Compose with whatever wrapper is already installed (a test file may wrap
    // these itself); the native helpers are captured at module load.
    const previousCreate =
      typeof globalThis.URL.createObjectURL === 'function'
        ? globalThis.URL.createObjectURL
        : ORIGINAL_CREATE_OBJECT_URL;
    const previousRevoke =
      typeof globalThis.URL.revokeObjectURL === 'function'
        ? globalThis.URL.revokeObjectURL
        : ORIGINAL_REVOKE_OBJECT_URL;
    globalThis.URL.createObjectURL = (blob) => {
      const url = previousCreate
        ? previousCreate(blob)
        : 'blob:prompt-library-' + String((blobSeq += 1));
      blobs.set(url, blob);
      return url;
    };
    globalThis.URL.revokeObjectURL = (url) => {
      // Keep the captured blob readable for post-run assertions; only the
      // underlying URL (if any) is released.
      if (previousRevoke) {
        try {
          previousRevoke(url);
        } catch {
          /* ignore */
        }
      }
    };
  }
  const document = makeDocument();
  const baseCreateElement = document.createElement;
  document.createElement = (tag) => {
    const element = baseCreateElement(tag);
    if (String(tag).toLowerCase() === 'a') {
      element.click = () => {
        calls.downloads.push({ filename: element.download, href: element.href });
      };
    }
    return element;
  };
  let language = options.lang === 'en' ? 'en' : 'zh';
  let localeRevision = 0;
  const localeListeners = new Set();

  globalThis.document = document;

  const copies = calls.copies;
  let uuid = 0;

  const navigator = {
    languages: language === 'zh' ? ['zh-CN'] : ['en-US'],
    clipboard: {
      writeText(text) {
        copies.push(String(text));
        return Promise.resolve();
      },
    },
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });

  const windowListeners = new Map();
  globalThis.window = {
    localStorage: options.noStorage ? null : storage,
    innerWidth: options.width || 1280,
    innerHeight: 900,
    crypto: { randomUUID: () => 'uuid-' + String(++uuid) },
    addEventListener(type, handler) {
      const list = windowListeners.get(type) || [];
      list.push(handler);
      windowListeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = windowListeners.get(type) || [];
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    },
    dispatch(type, event) {
      for (const handler of (windowListeners.get(type) || []).slice()) handler(event);
    },
    matchMedia() {
      return { matches: false, addEventListener() {}, removeEventListener() {} };
    },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };

  if (options.width) {
    // keep in sync when the caller simulates resizing
    Object.defineProperty(globalThis.window, 'innerWidth', {
      configurable: true,
      get: () => currentWidth,
    });
  }
  let currentWidth = options.width || 1280;

  const dictionaries = { zh: {}, en: {} };
  const translateFor = (lang) => {
    const t = (key, params) => {
      let text = dictionaries[lang][key];
      if (typeof text !== 'string') {
        text = dictionaries.en[key];
      }
      if (typeof text !== 'string') return key;
      if (params && typeof params === 'object') {
        for (const [name, value] of Object.entries(params)) {
          text = text.split('{' + name + '}').join(String(value));
        }
      }
      return text;
    };
    return t;
  };

  const locale = {
    register(namespace, lang, dictionary) {
      if (!dictionaries[lang]) dictionaries[lang] = {};
      Object.assign(dictionaries[lang], dictionary || {});
      localeRevision += 1;
      for (const listener of localeListeners) listener();
      return () => {};
    },
    bind() {
      return translateFor(language);
    },
    getSnapshot() {
      return { active: language, revision: localeRevision, locales: ['zh', 'en'] };
    },
    subscribe(listener) {
      localeListeners.add(listener);
      return () => localeListeners.delete(listener);
    },
    getLocale() {
      return { active: language };
    },
  };

  const interactions = [];
  const openSessionCalls = [];
  const services = Object.assign({}, options.services || {});
  if (options.layout !== undefined) services.layout = options.layout;
  if (options.uiConversation === true && !services.uiConversation) {
    services.uiConversation = {
      interactions: {
        register(definition) {
          interactions.push(definition);
          return () => {};
        },
        getSnapshot() {
          return [];
        },
      },
    };
  }
  if (options.uiWorkspace === true && !services.uiWorkspace) {
    services.uiWorkspace = {
      openSession(sessionId) {
        openSessionCalls.push(sessionId);
      },
    };
  }
  const slots = {};
  const slotEntries = {};
  const disposers = [];

  const ctx = {
    effect(fn) {
      const dispose = fn();
      if (typeof dispose === 'function') disposers.push(dispose);
      return () => {};
    },
    disposeEffects() {
      while (disposers.length > 0) {
        const dispose = disposers.pop();
        try {
          dispose();
        } catch {
          /* ignore */
        }
      }
    },
    inject(names, callback) {
      try {
        callback(ctx);
      } catch (error) {
        /* an optional injection callback must not break the harness */
      }
      return () => {};
    },
    get(name) {
      return services[name];
    },
    locale,
    slots: {
      inject(name, fn) {
        fn();
        return () => {};
      },
      register(config, component) {
        const name = config.name || config.key;
        const entry = { config, component };
        if (!slotEntries[name]) slotEntries[name] = [];
        slotEntries[name].push(entry);
        if (!slots[name]) slots[name] = entry;
        return () => {
          const list = slotEntries[name];
          if (!list) return;
          const index = list.indexOf(entry);
          if (index >= 0) list.splice(index, 1);
          if (slots[name] === entry) slots[name] = list[0];
        };
      },
    },
  };

  const react = createReact();
  const definition = DEFINITIONS[0];
  const plugin = definition.factory((id) => {
    if (id === 'react') return react.React;
    if (id === 'react-dom') {
      return { createPortal: react.createPortal };
    }
    throw new Error('unexpected require: ' + id);
  });
  plugin.apply(ctx);

  const fetchHandlers = [];
  let defaultFetch = () => ({ status: 404, body: { ok: false, code: 'NO_SERVICE' } });
  globalThis.fetch = async (url, init) => {
    const request = {
      url: String(url),
      method: (init && init.method) || 'GET',
      headers: (init && init.headers) || {},
      body: (init && init.body) || null,
      signal: init && init.signal,
    };
    calls.fetch.push(request);
    if (request.signal && request.signal.aborted) {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
    let response = null;
    for (const handler of fetchHandlers.slice().reverse()) {
      const candidate = handler(request);
      if (candidate !== undefined) {
        response = candidate;
        break;
      }
    }
    if (response === null) response = defaultFetch(request);
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      async json() {
        return response.body;
      },
      async text() {
        return typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
      },
    };
  };

  const fakeInputActions = {
    captureInsertion() {
      return { start: 0, end: 0, draftRev: 1 };
    },
    insertText(text, span) {
      calls.inserts.push({ text, span });
      return options.insertResult !== false;
    },
    setDraft(text) {
      calls.drafts.push(text);
    },
  };
  const slotProps = Object.assign(
    {
      sessionId: options.sessionId || 'session-1',
      input: { draft: options.draft || '' },
      session: { running: false },
      inputActions: options.inputActions === undefined ? fakeInputActions : options.inputActions,
    },
    options.slotProps || {},
  );

  function walk(node, predicate, found) {
    if (node === null || typeof node !== 'object') return found;
    if (Array.isArray(node)) {
      for (const child of node) walk(child, predicate, found);
      return found;
    }
    if (predicate(node)) found.push(node);
    for (const child of node.children || []) walk(child, predicate, found);
    return found;
  }

  function textOf(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map((child) => textOf(child)).join('');
    return (value.children || []).map((child) => textOf(child)).join('');
  }

  function all(type) {
    return walk(renderedTree, (node) => node.type === type, []);
  }

  function descendants(node, predicate) {
    return walk(node, predicate, []);
  }

  function isButton(node) {
    return node && node.type === 'button';
  }

  function buttonByLabel(label) {
    return all('button').find((node) => {
      const aria = node.props['aria-label'];
      const title = node.props.title;
      return aria === label || title === label || textOf(node).trim() === label;
    });
  }

  function clickButton(label) {
    const button = buttonByLabel(label);
    if (!button) {
      throw new Error('button not found: ' + label + '\n' + textOf(renderedTree).slice(0, 1200));
    }
    if (typeof button.props.onClick === 'function') {
      const currentTarget = {
        ...button,
        getBoundingClientRect() {
          return { left: 120, top: 200, right: 360, bottom: 224, width: 240, height: 24 };
        },
        focus() {},
        contains() {
          return false;
        },
      };
      button.props.onClick({
        currentTarget,
        target: currentTarget,
        preventDefault() {},
        stopPropagation() {},
      });
    }
    render();
    return button;
  }

  function findInput(label) {
    return all('input').find((node) => {
      const aria = node.props['aria-label'];
      return aria === label;
    });
  }

  function findTextarea(label) {
    return all('textarea').find((node) => node.props['aria-label'] === label);
  }

  function change(node, value) {
    if (!node) throw new Error('input node not found');
    node.props.onChange({ target: { value }, currentTarget: { value } });
    render();
    return node;
  }

  function submit(form) {
    if (!form) throw new Error('form not found');
    if (typeof form.props.onSubmit === 'function') {
      form.props.onSubmit({ preventDefault() {}, currentTarget: form });
    }
    render();
  }

  function pressEscape() {
    document.dispatch('keydown', {
      key: 'Escape',
      preventDefault() {},
      stopPropagation() {},
      target: document.activeElement,
    });
    render();
  }

  function pressTab(shiftKey) {
    document.dispatch('keydown', {
      key: 'Tab',
      shiftKey: Boolean(shiftKey),
      preventDefault() {},
      stopPropagation() {},
      target: document.activeElement,
    });
    render();
  }

  let renderedTree = null;

  function render() {
    renderedTree = react.render(root);
    return renderedTree;
  }

  let root = react.React.createElement(() => null, {});

  function renderPage(props) {
    const entry = slots.main;
    if (!entry) throw new Error('main slot was not registered');
    root = react.React.createElement(entry.component, props || {});
    return render();
  }

  function slotInjectedProps(entry) {
    const config = entry.config || {};
    let injected = {};
    try {
      if (typeof config.inject === 'function') injected = config.inject() || {};
    } catch (error) {
      injected = {};
    }
    if (!injected || typeof injected !== 'object') injected = {};
    const props = Object.assign({}, injected);
    if (config.locale) props.t = translateFor(language);
    return props;
  }

  function findSlotEntry(name, selector) {
    const list = slotEntries[name] || [];
    if (selector === undefined || selector === null) return list[0];
    if (typeof selector === 'number') return list[selector];
    return (
      list.find(
        (entry) =>
          entry.config &&
          (entry.config.id === selector || entry.config.key === selector),
      ) || null
    );
  }

  function renderSlot(name, selector, extraProps) {
    const entry = findSlotEntry(name, selector);
    if (!entry) throw new Error('slot not registered: ' + name + ' (' + String(selector) + ')');
    const props = Object.assign(slotInjectedProps(entry), extraProps || {});
    root = react.React.createElement(entry.component, props);
    return render();
  }

  function renderOverlay() {
    return renderSlot('shell.overlay', 'prompt-library-capture');
  }

  function renderQuick(props) {
    const entry = slots['conversation.input.right'];
    if (!entry) throw new Error('conversation.input.right slot was not registered');
    root = react.React.createElement(entry.component, props === undefined ? slotProps : props);
    return render();
  }

  function renderSidebarIcon(props) {
    const entry = slots['sidebar.panellist'];
    if (!entry) throw new Error('sidebar.panellist slot was not registered');
    root = react.React.createElement(entry.component, props || { size: 18 });
    return render();
  }

  async function flush(cycles = 3) {
    for (let index = 0; index < cycles; index += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      render();
    }
  }

  function data() {
    const raw = storage.map.get('dsh-prompt-library/v1');
    return raw ? JSON.parse(raw) : null;
  }

  function prompts() {
    const value = data();
    return value ? value.prompts : [];
  }

  function tags() {
    const value = data();
    return value ? value.tags : [];
  }

  function promptById(id) {
    return prompts().find((prompt) => prompt.id === id) || undefined;
  }

  function setLanguage(next) {
    language = next === 'en' ? 'en' : 'zh';
    localeRevision += 1;
    for (const listener of localeListeners) listener();
    render();
  }

  function setFetch(handler) {
    fetchHandlers.push(handler);
  }

  function aiHandlers(config = {}) {
    const status = config.status || {
      status: 200,
      body: { ok: true, available: true, provider: 'deepseek-account', model: 'deepseek-flash', displayName: 'deepseek-flash', source: 'default' },
    };
    const review = config.review || {
      status: 200,
      body: { ok: true, review: { text: '整体目标清晰，约束合理；建议补充输出格式与边界条件。', provider: 'deepseek-account', model: 'deepseek-flash', generatedAt: 1700000000100, count: 30 } },
    };
    setFetch((request) => {
      if (request.url.includes('/ai/status')) return typeof status === 'function' ? status(request) : status;
      if (request.url.includes('/ai/review')) return typeof review === 'function' ? review(request) : review;
      return undefined;
    });
  }

  return {
    storage,
    document,
    window: globalThis.window,
    locale,
    slots,
    calls,
    slotProps,
    fakeInputActions,
    dictionaries,
    react,
    plugin,
    get root() {
      return root;
    },
    get tree() {
      return renderedTree;
    },
    render,
    renderPage,
    renderQuick,
    renderSidebarIcon,
    renderSlot,
    renderOverlay,
    slotEntries,
    interactions,
    openSessionCalls,
    flush,
    text: (value) => textOf(value === undefined ? renderedTree : value),
    all,
    descendants,
    buttonByLabel,
    clickButton,
    findInput,
    findTextarea,
    change,
    submit,
    pressEscape,
    pressTab,
    data,
    prompts,
    tags,
    promptById,
    setLanguage,
    setFetch,
    aiHandlers,
    setWidth(width) {
      currentWidth = width;
      if (globalThis.window && typeof globalThis.window.dispatch === 'function') {
        globalThis.window.dispatch('resize', {});
      }
      render();
    },
    setStorageFailure(value) {
      storageShouldFail = Boolean(value);
    },
    download: () => calls.downloads,
    downloads: calls.downloads,
    blobs,
    readDownload: async (index = -1) => {
      const list = calls.downloads;
      const item = index < 0 ? list[list.length - 1] : list[index];
      if (!item) return null;
      const blob = blobs.get(item.href);
      if (!blob) return null;
      const text = await blob.text();
      return { ...item, text };
    },
    ctx,
    disposeEffects: () => ctx.disposeEffects(),
    dispose() {
      ctx.disposeEffects();
      react.unsubscribeAll();
      globalThis.window = { __ModuleLoader__: { load: (definition) => DEFINITIONS.push(definition) } };
    },
  };
}

export { makeElement, makeDocument, createStorage };
