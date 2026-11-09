import test from 'node:test';
import assert from 'node:assert/strict';

/*
 * Dependency-free integration checks for the To-do List browser half.
 *
 * The plugin is a plain bundle for `window.__ModuleLoader__`, so the tests load
 * it with a fake window/document, a fake locale service and a minimal recursive
 * React renderer (no npm install, no jsdom). The real component tree is rendered:
 * group chips open a menu, picking a group moves the task, dragging a task onto
 * the sidebar rail moves it too, and every move is persisted to localStorage.
 */

const STORAGE_KEY = 'dsh-todo-list/v1';
const UI_KEY = 'dsh-todo-list:ui/v1';
const DEFINITIONS = [];

globalThis.window = {
  __ModuleLoader__: { load: (definition) => DEFINITIONS.push(definition) },
};

await import('../todo-list/client.js');

/* ------------------------------------------------------------------ */
/* Fakes                                                               */
/* ------------------------------------------------------------------ */

function makeDocument() {
  const listeners = new Map();
  return {
    activeElement: null,
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

function seedStorage(overrides = {}) {
  const tasks = [
    {
      id: 't1',
      title: '写周报',
      done: false,
      doneAt: null,
      due: '2026-11-12',
      priority: 'high',
      groupId: 'work',
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 't2',
      title: '约牙医',
      done: false,
      doneAt: null,
      due: null,
      priority: 'medium',
      groupId: 'life',
      order: 0,
      createdAt: 2,
      updatedAt: 2,
    },
    {
      id: 't3',
      title: '读书',
      done: false,
      doneAt: null,
      due: null,
      priority: 'low',
      groupId: 'life',
      order: 1,
      createdAt: 3,
      updatedAt: 3,
    },
    {
      id: 't4',
      title: '买菜',
      done: true,
      doneAt: 9,
      due: null,
      priority: 'none',
      groupId: 'inbox',
      order: 0,
      createdAt: 4,
      updatedAt: 4,
    },
    {
      id: 't5',
      title: '读论文',
      done: false,
      doneAt: null,
      due: null,
      priority: 'none',
      groupId: 'g_read',
      order: 0,
      createdAt: 5,
      updatedAt: 5,
    },
  ];
  const groups = [{ id: 'g_read', name: '阅读计划', order: 3 }];
  return {
    [STORAGE_KEY]: JSON.stringify({ version: 1, groups, tasks }),
    [UI_KEY]: JSON.stringify({ groupId: 'all', filter: 'all' }),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

function harness(options = {}) {
  const storage = createStorage(options.storage || seedStorage());
  const document = makeDocument();
  globalThis.document = document;
  const copies = [];
  let uuid = 0;
  globalThis.window = {
    localStorage: storage,
    innerWidth: 1280,
    innerHeight: 900,
    crypto: { randomUUID: () => 'uuid-' + String(++uuid) },
    setTimeout: () => 1,
    clearTimeout: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText(text) {
          copies.push(text);
          return Promise.resolve();
        },
      },
    },
  });

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
  const definition = DEFINITIONS[0];
  const plugin = definition.factory((id) => {
    if (id === 'react') return React;
    throw new Error('unexpected require: ' + id);
  });
  plugin.apply(ctx);

  const page = slots.main.component;
  const anchors = new Map();
  function anchorFor(title) {
    let anchor = anchors.get(title);
    if (anchor === undefined) {
      anchor = {
        title,
        focus() {},
        contains(target) {
          return target === anchor;
        },
        getBoundingClientRect() {
          return { left: 120, right: 160, top: 200, bottom: 218, width: 40, height: 18 };
        },
      };
      anchors.set(title, anchor);
    }
    return anchor;
  }
  const h = {
    storage,
    dictionaries,
    copies,
    slots,
    React,
    document,
    tree: null,
    render() {
      h.tree = render(React.createElement(page, {}));
      return h.tree;
    },
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
  h.row = (title) =>
    h.all('div').find(
      (node) => node.props.role === 'listitem' && h.text(node).includes(title),
    );
  h.chip = (title) => {
    const row = h.row(title);
    if (row === undefined) return undefined;
    return h
      .descendants(row, (node) => node.type === 'button' && node.props['aria-haspopup'] === 'menu')
      .at(0);
  };
  h.menu = () => h.all('div').find((node) => node.props.role === 'menu');
  h.menuItems = () => h.all('button').filter((node) => node.props.role === 'menuitemradio');
  h.railButton = (label) =>
    h.all('button').find((node) => {
      const className = String(node.props.className || '');
      return className.includes('tdl-rail-item') && h.text(node).trim().startsWith(label);
    });
  h.task = (id) => {
    const data = JSON.parse(storage.map.get(STORAGE_KEY));
    return data.tasks.find((task) => task.id === id);
  };
  h.clickChip = (title) => {
    const chip = h.chip(title);
    assert.ok(chip, 'group chip for ' + title + ' exists; text: ' + h.text());
    const anchor = anchorFor(title);
    // Browsers deliver mousedown before click; reproduce that so the
    // menu's anchor guard is exercised too.
    document.dispatch('mousedown', { target: anchor });
    chip.props.onClick({ currentTarget: anchor });
    h.render();
    return chip;
  };
  h.pickGroup = (label) => {
    const item = h.menuItems().find((node) => h.text(node) === label);
    assert.ok(item, 'group option ' + label + ' exists');
    item.props.onClick();
    h.render();
    return item;
  };
  h.clickRail = (label) => {
    const button = h.railButton(label);
    assert.ok(button, 'rail group ' + label + ' exists');
    button.props.onClick();
    h.render();
    return button;
  };
  h.railRow = (label) =>
    h.all('div').find((node) => {
      const className = String(node.props.className || '');
      return className.includes('tdl-rail-row') && h.text(node).trim().startsWith(label);
    });
  h.clickFilter = (label) => {
    const button = h.all('button').find(
      (node) => node.props.role === 'tab' && h.text(node).startsWith(label),
    );
    assert.ok(button, 'filter ' + label + ' exists');
    button.props.onClick();
    h.render();
    return button;
  };
  h.mousedown = (target) => {
    document.dispatch('mousedown', { target });
    h.render();
  };
  h.menuKey = (key) => {
    const menu = h.menu();
    assert.ok(menu, 'group menu is open');
    menu.props.onKeyDown({ key, preventDefault() {} });
    h.render();
  };
  h.escape = () => {
    document.dispatch('keydown', { key: 'Escape', preventDefault() {} });
    h.render();
  };
  h.dragStart = (title) => {
    const row = h.row(title);
    assert.ok(row, 'task row ' + title + ' exists');
    const handle = h.descendants(row, (node) => node.props.draggable === true).at(0);
    assert.ok(handle, 'drag handle for ' + title + ' exists');
    handle.props.onDragStart({
      dataTransfer: { setData() {}, effectAllowed: '' },
    });
    h.render();
    return handle;
  };
  h.dragOverRail = (label) => {
    const row = h.railRow(label);
    assert.ok(row, 'rail row ' + label + ' exists');
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      dataTransfer: { dropEffect: '' },
    };
    row.props.onDragOver(event);
    h.render();
    return event;
  };
  h.dropRail = (label) => {
    const row = h.railRow(label);
    assert.ok(row, 'rail row ' + label + ' exists');
    row.props.onDrop({ preventDefault() {} });
    h.render();
    return row;
  };
  h.flush = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    h.render();
  };
  return h;
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test('registers both entry points and renders the task list with group chips', () => {
  const h = harness();
  assert.deepEqual(Object.keys(h.slots).sort(), [
    'conversation.composer.dock',
    'main',
    'sidebar.panellist',
  ]);
  h.render();
  assert.match(h.text(), /写周报/);
  assert.match(h.text(), /阅读计划/);
  const chips = h.all('button').filter((node) => node.props['aria-haspopup'] === 'menu');
  assert.equal(chips.length, 4, 'one chip per open task in the All view');
  assert.equal(h.text(h.chip('写周报')), '工作');
  assert.match(h.chip('写周报').props['aria-label'], /工作/);
});

test('group menu lists every group and marks the current one', () => {
  const h = harness();
  h.render();
  h.clickChip('写周报');
  const menu = h.menu();
  assert.ok(menu, 'group menu is open');
  assert.equal(menu.props.role, 'menu');
  assert.deepEqual(h.menuItems().map((node) => h.text(node)), [
    '收件箱',
    '工作',
    '生活',
    '阅读计划',
  ]);
  const work = h.menuItems().find((node) => h.text(node) === '工作');
  assert.equal(work.props['aria-checked'], true);
  const life = h.menuItems().find((node) => h.text(node) === '生活');
  assert.equal(life.props['aria-checked'], false);
});

test('picking another group moves the task, appends it and shows a notice', () => {
  const h = harness();
  h.render();
  h.clickChip('写周报');
  h.pickGroup('生活');
  const task = h.task('t1');
  assert.equal(task.groupId, 'life');
  assert.equal(task.order, 2, 'moved task lands after the existing Life tasks');
  assert.ok(task.updatedAt > 1, 'updatedAt is refreshed');
  assert.equal(h.text(h.chip('写周报')), '生活');
  assert.equal(h.menu(), undefined, 'menu closes after picking');
  assert.match(h.text(), /已移到「生活」/);
  assert.equal(task.due, '2026-11-12');
  assert.equal(task.priority, 'high');
  assert.equal(task.done, false);
});

test('picking the current group is a no-op and still closes the menu', () => {
  const h = harness();
  h.render();
  const before = h.task('t1');
  h.clickChip('写周报');
  h.pickGroup('工作');
  const after = h.task('t1');
  assert.equal(after.groupId, 'work');
  assert.equal(after.order, before.order);
  assert.equal(after.updatedAt, before.updatedAt);
  assert.equal(h.menu(), undefined);
  assert.doesNotMatch(h.text(), /已移到/);
});

test('moving onto a custom group appends after that group tasks', () => {
  const h = harness();
  h.render();
  h.clickChip('写周报');
  h.pickGroup('阅读计划');
  assert.equal(h.task('t1').order, 1);
  h.clickChip('约牙医');
  h.pickGroup('阅读计划');
  assert.equal(h.task('t2').groupId, 'g_read');
  assert.equal(h.task('t2').order, 2);
});

test('dragging a task onto a sidebar group moves it and highlights the target', () => {
  const h = harness();
  h.render();
  h.dragStart('写周报');
  const hover = h.dragOverRail('阅读计划');
  assert.equal(hover.defaultPrevented, true);
  assert.match(h.railButton('阅读计划').props.className, /tdl-rail-item-drop/);
  h.dropRail('阅读计划');
  assert.equal(h.task('t1').groupId, 'g_read');
  assert.equal(h.task('t1').order, 1);
  assert.match(h.text(), /已移到「阅读计划」/);
  assert.doesNotMatch(h.railButton('阅读计划').props.className, /tdl-rail-item-drop/);
});

test('dragging onto the current group does not move or highlight it', () => {
  const h = harness();
  h.render();
  h.dragStart('写周报');
  const hover = h.dragOverRail('工作');
  assert.equal(hover.defaultPrevented, false);
  assert.doesNotMatch(h.railButton('工作').props.className, /tdl-rail-item-drop/);
  h.dropRail('工作');
  assert.equal(h.task('t1').groupId, 'work');
  assert.equal(h.task('t1').order, 0);
  assert.doesNotMatch(h.text(), /已移到/);
});

test('group chips stay available inside a single group view', () => {
  const h = harness();
  h.render();
  h.clickRail('生活');
  assert.match(h.text(), /约牙医/);
  assert.equal(h.text(h.chip('约牙医')), '生活');
  h.clickChip('约牙医');
  h.pickGroup('工作');
  assert.equal(h.task('t2').groupId, 'work');
  assert.doesNotMatch(h.text(), /约牙医/, 'moved task leaves the current group list');
  assert.match(h.text(), /已移到「工作」/);
});

test('Escape closes the group menu', () => {
  const h = harness();
  h.render();
  h.clickChip('写周报');
  assert.ok(h.menu());
  h.escape();
  assert.equal(h.menu(), undefined);
});

test('clicking the same group chip again closes the menu', () => {
  const h = harness();
  h.render();
  h.clickChip('写周报');
  assert.ok(h.menu());
  h.clickChip('写周报');
  assert.equal(h.menu(), undefined);
  assert.equal(h.task('t1').groupId, 'work');
});

test('a group change survives a reload from localStorage', () => {
  const h = harness();
  h.render();
  h.clickChip('写周报');
  h.pickGroup('阅读计划');
  const snapshot = Object.fromEntries(h.storage.map);
  const reloaded = harness({ storage: snapshot });
  reloaded.render();
  assert.equal(reloaded.task('t1').groupId, 'g_read');
  assert.equal(reloaded.text(reloaded.chip('写周报')), '阅读计划');
});

test('tasks with an unknown group fall back to Inbox', () => {
  const data = JSON.parse(seedStorage()[STORAGE_KEY]);
  data.tasks[0].groupId = 'ghost';
  const h = harness({ storage: { [STORAGE_KEY]: JSON.stringify(data) } });
  h.render();
  assert.equal(h.text(h.chip('写周报')), '收件箱');
  h.clickChip('写周报');
  h.pickGroup('生活');
  assert.equal(h.task('t1').groupId, 'life');
});

test('Chinese and English dictionaries stay in sync', () => {
  const h = harness();
  assert.deepEqual(Object.keys(h.dictionaries.zh).sort(), Object.keys(h.dictionaries.en).sort());
  for (const key of ['task.groupValue', 'group.menuTitle', 'notice.moved']) {
    assert.ok(key in h.dictionaries.en, key + ' exists in English');
  }
  assert.match(h.dictionaries.zh['task.groupValue'], /切换/);
});

test('Markdown copy puts the moved task under its new group', async () => {
  const h = harness();
  h.render();
  // Work: 写周报; Life: 约牙医, 读书. Cross the two so both sections stay non-empty.
  h.clickChip('约牙医');
  h.pickGroup('工作');
  h.clickChip('写周报');
  h.pickGroup('生活');
  const copyButton = h
    .all('button')
    .find((node) => node.props['aria-label'] === '复制为 Markdown');
  assert.ok(copyButton);
  copyButton.props.onClick();
  await h.flush();
  const markdown = h.copies.at(-1);
  assert.ok(markdown, 'markdown was written to the clipboard');
  const life = markdown.indexOf('## 生活');
  const work = markdown.indexOf('## 工作');
  assert.ok(work >= 0, 'Work section is present');
  assert.ok(life >= 0, 'Life section is present');
  assert.ok(life > work, 'Life section is after Work');
  const report = markdown.indexOf('写周报');
  const dentist = markdown.indexOf('约牙医');
  assert.ok(report > life, '写周报 is listed under Life');
  assert.ok(dentist > work && dentist < life, '约牙医 is listed under Work');
});

test('adding a task still works after the row changes', () => {
  const h = harness();
  h.render();
  const input = h
    .all('input')
    .find((node) => node.props['aria-label'] === '添加待办，回车保存');
  assert.ok(input);
  input.props.onChange({ target: { value: '新任务' } });
  h.render();
  const form = h.all('form').find((node) => String(node.props.className || '').includes('tdl-add'));
  assert.ok(form);
  form.props.onSubmit({ preventDefault() {} });
  h.render();
  assert.match(h.text(), /新任务/);
  const data = JSON.parse(h.storage.map.get(STORAGE_KEY));
  const added = data.tasks.find((task) => task.title === '新任务');
  assert.ok(added);
  assert.equal(added.groupId, 'inbox');
});

test('the chip exposes aria-expanded and an outside mousedown closes the menu', () => {
  const h = harness();
  h.render();
  assert.equal(h.chip('写周报').props['aria-expanded'], false);
  h.clickChip('写周报');
  assert.equal(h.chip('写周报').props['aria-expanded'], true);
  h.mousedown({});
  assert.equal(h.menu(), undefined);
  assert.equal(h.chip('写周报').props['aria-expanded'], false);
});

test('Tab closes the group menu', () => {
  const h = harness();
  h.render();
  h.clickChip('写周报');
  h.menuKey('Tab');
  assert.equal(h.menu(), undefined);
});

test('changing the group or filter view closes the group menu', () => {
  const h = harness();
  h.render();
  h.clickChip('写周报');
  h.clickRail('生活');
  assert.equal(h.menu(), undefined);
  h.clickChip('约牙医');
  assert.ok(h.menu());
  h.clickFilter('今天');
  assert.equal(h.menu(), undefined);
});

test('moving into an empty group starts its order at 0', () => {
  const storage = seedStorage();
  const data = JSON.parse(storage[STORAGE_KEY]);
  data.groups.push({ id: 'g_empty', name: '空分组', order: 4 });
  storage[STORAGE_KEY] = JSON.stringify(data);
  const h = harness({ storage });
  h.render();
  h.clickChip('写周报');
  h.pickGroup('空分组');
  const task = h.task('t1');
  assert.equal(task.groupId, 'g_empty');
  assert.equal(task.order, 0);
  assert.equal(h.text(h.chip('写周报')), '空分组');
});

test('a completed task can move groups and keeps its completion time', () => {
  const h = harness();
  h.render();
  h.clickFilter('已完成');
  assert.match(h.text(), /买菜/);
  h.clickChip('买菜');
  h.pickGroup('生活');
  const task = h.task('t4');
  assert.equal(task.groupId, 'life');
  assert.equal(task.done, true);
  assert.equal(task.doneAt, 9);
  assert.match(h.text(), /买菜/);
});

test('rail counts follow a moved task', () => {
  const h = harness();
  h.render();
  assert.equal(h.text(h.railButton('工作')).trim(), '工作1');
  h.clickChip('写周报');
  h.pickGroup('生活');
  assert.equal(h.text(h.railButton('工作')).trim(), '工作0');
  assert.equal(h.text(h.railButton('生活')).trim(), '生活3');
});

test('the group switcher renders in English too', () => {
  const h = harness({ lang: 'en' });
  h.render();
  assert.equal(h.chip('写周报').props['aria-label'], 'Group: Work. Click to move.');
  h.clickChip('写周报');
  assert.equal(h.menu().props['aria-label'], 'Move to group');
  assert.deepEqual(
    h.menuItems().map((node) => h.text(node)),
    ['Inbox', 'Work', 'Life', '阅读计划'],
  );
  h.pickGroup('Life');
  assert.match(h.text(), /Moved to Life/);
});

test('an imported group with the reserved id all is discarded', () => {
  const data = JSON.parse(seedStorage()[STORAGE_KEY]);
  data.groups.push({ id: 'all', name: '伪全部', order: 5 });
  data.tasks[0].groupId = 'all';
  const h = harness({ storage: { [STORAGE_KEY]: JSON.stringify(data) } });
  h.render();
  assert.equal(h.text(h.chip('写周报')), '收件箱');
  h.clickChip('写周报');
  assert.equal(h.menuItems().length, 4);
  assert.equal(h.menuItems().some((node) => h.text(node) === '伪全部'), false);
});

test('hovering a rail group clears the row reorder indicator', () => {
  const h = harness();
  h.render();
  h.clickChip('约牙医');
  h.pickGroup('工作');
  h.dragStart('写周报');
  const target = h.row('约牙医');
  target.props.onDragOver({
    preventDefault() {},
    currentTarget: {
      getBoundingClientRect() {
        return { top: 0, height: 20 };
      },
    },
    clientY: 18,
    dataTransfer: { dropEffect: '' },
  });
  h.render();
  assert.match(String(h.row('约牙医').props.className), /tdl-drop-(before|after)/);
  h.dragOverRail('生活');
  assert.doesNotMatch(String(h.row('约牙医').props.className), /tdl-drop-(before|after)/);
});

test('a single click no longer renames; double click edits and saves', () => {
  const h = harness();
  h.render();
  const titleSpan = () =>
    h
      .descendants(
        h.row('写周报'),
        (node) => node.type === 'span' && String(node.props.className || '').includes('tdl-task-title'),
      )
      .at(0);
  const titleInput = () =>
    h.all('input').find((node) => node.props.className === 'tdl-title-input');

  assert.ok(titleSpan(), 'title span exists');
  assert.equal(titleSpan().props.onClick, undefined, 'single click has no rename handler');
  assert.equal(titleInput(), undefined, 'nothing is being edited yet');

  titleSpan().props.onDoubleClick();
  h.render();
  const input = titleInput();
  assert.ok(input, 'double click opens the inline editor');
  assert.equal(input.props.value, '写周报');

  input.props.onChange({ target: { value: '写周报（改）' } });
  h.render();
  titleInput().props.onBlur();
  h.render();
  assert.equal(h.task('t1').title, '写周报（改）');
  assert.equal(titleInput(), undefined);
  assert.match(h.text(), /写周报（改）/);
});

test('keyboard Enter on the focused title still starts editing', () => {
  const h = harness();
  h.render();
  const titleSpan = h
    .descendants(
      h.row('写周报'),
      (node) => node.type === 'span' && String(node.props.className || '').includes('tdl-task-title'),
    )
    .at(0);
  titleSpan.props.onKeyDown({
    key: 'Enter',
    preventDefault() {},
    nativeEvent: { isComposing: false },
  });
  h.render();
  const input = h.all('input').find((node) => node.props.className === 'tdl-title-input');
  assert.ok(input, 'Enter opens the inline editor');
  assert.equal(input.props.value, '写周报');
});
