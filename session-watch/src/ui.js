function apply(ctx) {
  const { useState, useEffect, useLayoutEffect, useRef, useMemo, useSyncExternalStore } = React;
  const sessions = ctx.get('sessions');
  const layout = ctx.get('layout');
  const workspace = ctx.get('uiWorkspace');
  const slots = ctx.get('slots');
  if (!sessions || !layout || !workspace || !slots) throw new Error('Session Watch: required UI services unavailable');
  const abort = new AbortController();
  const API = '/api/session-watch/';
  const store = createWatchStore(async (method, body) => {
    const response = await fetch(API + (method === 'GET' ? 'state' : 'update'), {
      method, credentials: 'same-origin', cache: 'no-store', signal: abort.signal,
      ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (response.status !== 200 && response.status !== 409) throw Object.assign(new Error('request failed'), { status: response.status });
    return { status: response.status, body: await response.json() };
  });
  const reading = new Map();
  let returnOff = null;
  const style = document.createElement('style'); style.dataset.sessionWatch = 'true'; style.textContent = CSS;
  document.head.appendChild(style);
  ctx.effect(() => () => { abort.abort(); store.dispose(); style.remove(); returnOff?.(); reading.clear(); }, 'session-watch: browser lifetime');
  void store.refresh();

  const useStore = () => useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const useList = () => useSyncExternalStore(sessions.list.subscribe.bind(sessions.list), sessions.list.getSnapshot.bind(sessions.list));
  const dispatch = action => store.dispatch(action);
  const ShortcutSettings = createShortcutSettingsComponent(React, h, { SHORTCUT_ACTIONS, createDefaultShortcutConfig, normalizeShortcutConfig, validateShortcutConfig, shortcutStroke });
  let pageBridge = null; let pendingCommand = null; let recordingShortcut = false;
  const shortcutDiagnostics = [];
  const getShortcutDiagnostics = () => ({ version: '1.2.3', ready: store.getSnapshot().ready, enabled: store.getConfirmedState().shortcuts.enabled,
    prefix: store.getConfirmedState().shortcuts.prefix, error: store.getSnapshot().error, events: [...shortcutDiagnostics].reverse() });
  const paneHistory = { current: null, last: null };
  const shortcutScope = event => {
    const root = pageBridge?.root;
    if (!shortcutRootVisible(root, window)) return 'outside';
    const target = event?.composedPath?.()[0] || event?.target || document.activeElement;
    return target === document.body || target === document || target === window || root.contains(target) ? 'local' : 'outside';
  };
  const currentPane = () => {
    const pane = document.activeElement?.closest?.('[data-pane]');
    return pane && pageBridge?.root?.contains(pane) ? Number(pane.dataset.pane) : store.getSnapshot().state.activePane;
  };
  const canShortcutRun = action => {
    if (!store.getSnapshot().ready) return false;
    if (action === 'workbench.show' || action === 'search') return true;
    const state = store.getSnapshot().state; const index = currentPane(); const count = visiblePaneCount(state.layout);
    if (state.mode !== 'split') return false;
    if (action === 'pane.previous') return paneHistory.last != null && paneHistory.last !== index && paneHistory.last < count;
    if (/^pane\.[1-4]$/.test(action)) return Number(action.slice(-1)) <= count;
    if (action === 'editor.focus') return !!state.panes[index] && sessions.list.getSnapshot().byId[state.panes[index]]?.formatStatus !== 'migration-required';
    return ['pane.left', 'pane.right', 'pane.up', 'pane.down', 'pane.maximize'].includes(action);
  };
  const runShortcut = action => {
    if (action === 'workbench.show') {
      if (shortcutRootVisible(pageBridge?.root, window)) pageBridge.focusCurrent();
      else { pendingCommand = action; layout.selectPanel('session-watch'); }
    } else if (shortcutRootVisible(pageBridge?.root, window)) pageBridge.run(action);
    else { pendingCommand = action; layout.selectPanel('session-watch'); }
  };
  const keyboard = createShortcutController({ win: window, doc: document,
    getConfig: () => store.getSnapshot().ready ? store.getConfirmedState().shortcuts : { ...createDefaultShortcutConfig(), enabled: false },
    getScope: shortcutScope, canRun: canShortcutRun, run: runShortcut,
    isSuspended: () => recordingShortcut || !!pageBridge?.settingsOpen,
    onDiagnostic: value => { shortcutDiagnostics.push(value); if (shortcutDiagnostics.length > 8) shortcutDiagnostics.shift(); },
    onPrefix: pending => pageBridge?.setKeyHint(pending ? store.getConfirmedState().shortcuts.prefix + ' …' : '') });
  ctx.effect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') void store.refresh(); };
    const blur = () => pageBridge?.cancelFocus();
    window.addEventListener('focus', refresh); window.addEventListener('blur', blur);
    const timer = window.setInterval(refresh, 15000);
    return () => { keyboard.dispose(); pageBridge?.cancelFocus(); window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('blur', blur); pageBridge = null; pendingCommand = null; };
  }, 'session-watch: keyboard and settings synchronization');
  const stop = (event, fn) => { event.stopPropagation(); fn(); };
  function Button({ label, children, onClick, active, className = '', ...props }) {
    return h('button', { type: 'button', className: 'sw-btn ' + (active ? 'is-active ' : '') + className,
      title: label, 'aria-label': label, 'aria-pressed': active === undefined ? undefined : active, onClick, ...props }, children || label);
  }
  function Star({ size = 18, filled = false }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'm12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z' }));
  }
  const titleOf = sessionDisplayTitle;
  function workspaceOf(summary) {
    return summary?.cwd?.split(/[\\/]/).filter(Boolean).pop() || '未指定工作区';
  }
  function age(time) {
    if (!time) return '暂无更新';
    const minutes = Math.floor((Date.now() - Number(time)) / 60000);
    return minutes <= 0 ? '刚刚' : minutes < 60 ? `${minutes} 分钟前` : new Date(Number(time)).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function statusOf(summary, data, passive) {
    if (!summary) return ['会话不在当前列表', 'warn'];
    if (summary?.formatStatus === 'migration-required') return ['需在原会话升级', 'warn'];
    if (data?.error || data?.snapshot?.openState === 'error') return ['读取失败', 'error'];
    if (data?.snapshot?.removed || passive?.unavailable) return ['暂不可用', 'warn'];
    if (passive?.pendingInput?.length) return [passive.pendingInput.includes('approval') ? '等待批准' : '等待输入', 'warn'];
    if (data?.snapshot?.running || summary?.running || passive?.running) return ['运行中', 'running'];
    if (data?.snapshot?.lastAgentError) return ['执行异常', 'error'];
    if (data?.snapshot?.openState === 'loading') return ['加载中', 'idle'];
    return ['空闲', 'idle'];
  }
  function Badge({ value }) { return h('span', { className: 'sw-badge ' + value[1] }, h('i'), value[0]); }
  function openSession(id) {
    returnOff?.();
    returnOff = slots.inject('conversation.session.header.utilities', () => slots.register({
      name: 'conversation.session.header.utilities', id: 'session-watch-return', order: -50,
    }, () => h(Button, { label: '返回关注工作台', onClick: () => layout.selectPanel('session-watch') }, '↶ 工作台')));
    workspace.openSession(id);
  }
  async function toggleFollow(id) {
    if (!id || typeof id !== 'string') return;
    if (!store.getSnapshot().ready && !(await store.refresh())) return;
    const on = store.getSnapshot().state.followed.includes(id);
    dispatch(on ? { type: 'unfollow', id } : { type: 'follow', ids: [id] });
  }
  function FollowButton(props) {
    const snapshot = useStore();
    const { state, ready, loading, saving, error } = snapshot;
    const on = state.followed.includes(props.sessionId);
    const label = !ready && error ? '重试加载关注状态' : on ? '取消关注会话' : '关注会话';
    const text = loading && !ready ? '加载中…' : saving ? '保存中…' : !ready && error ? '加载失败，重试' : on ? '已关注' : '关注';
    return h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      h(Button, { label, disabled: loading || saving || !props.sessionId, active: on, title: error || label,
        onClick: () => { void toggleFollow(props.sessionId); } }, h(Star, { filled: on }), h('span', null, text)),
      error ? h('span', { role: 'status', title: error, style: { fontSize: 11 } }, ready && !error.startsWith('读取') ? '保存失败，请重试' : '读取失败') : null);
  }
  function MenuFollow(props) {
    const { state, ready, loading, saving, error } = useStore();
    const on = state.followed.includes(props.sessionId);
    return h('button', { className: 'sw-menuitem', role: 'menuitem', disabled: loading || saving, title: error || undefined,
      onClick: () => { void toggleFollow(props.sessionId); } }, h(Star, { filled: on }), loading ? '加载关注状态…' : saving ? '保存中…' : !ready && error ? '读取失败，点击重试关注' : on ? '取消关注会话' : '关注会话');
  }

  class NativeErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error) { console.error('Session Watch: native render failed', error); }
    render() {
      if (!this.state.error) return this.props.children;
      return h('div', { className: 'sw-empty-pane', role: 'alert' },
        h('strong', null, '原生会话渲染失败'), h('p', null, String(this.state.error?.message || '组件暂不可用').slice(0, 240)),
        h(Button, { label: '重试原生会话', onClick: this.props.retry }, '重试'),
        h(Button, { label: '打开原会话', onClick: () => openSession(this.props.id) }, '打开原会话 ↗'));
    }
  }
  function NativeConversation(props) {
    const session = props.useSession(value => value);
    const conversation = props.useConversation(value => value);
    const summaryBlank = props.useSessions(value => value.byId[props.sessionId]?.blank);
    if (!session || !conversation) return h('p', { className: 'sw-empty-small', role: 'status' }, '正在准备原生会话…');
    const active = conversation.activeTargets.size > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running;
    const blank = !active && !session.promptAttempted;
    const settling = blank && session.openState === 'loading' && summaryBlank !== true;
    const hero = blank && (session.openState === 'open' || summaryBlank === true);
    return props.renderFactorySlot('conversation.content', { variant: 'embedded', phase: settling ? 'settling' : hero ? 'hero' : 'active', hero }, {
      fallback: h('p', { className: 'sw-empty-small', role: 'status' }, '内置会话组件暂不可用，请打开原会话。'),
    });
  }
  function NativePane({ id, data, state, SessionProvider, renderSlot }) {
    const [reference, setReference] = useState(null);
    const [failure, setFailure] = useState('');
    const [attempt, setAttempt] = useState(0);
    const container = useRef(null);
    useEffect(() => {
      let owned; let stopped = false;
      setFailure(''); setReference(null);
      try {
        owned = sessions.retain(id, { source: 'controllerOperation' });
        setReference(owned);
        void owned.ready.catch(() => { if (!stopped) setFailure('会话暂时无法打开，请重试或打开原会话。'); });
      } catch { setFailure('无法取得会话引用，请重试。'); }
      return () => { stopped = true; owned?.release(); };
    }, [id, attempt]);
    function markAtBottom() {
      const node = container.current?.querySelector('[data-conversation-scroll]');
      if (!node || node.clientHeight <= 0 || document.visibilityState !== 'visible') return;
      if (node.scrollHeight - node.scrollTop - node.clientHeight > 8) return;
      if (data?.contentKey) reading.set(id, { ...reading.get(id), seenKey: data.contentKey });
      if ((data?.contentSeq || 0) > (state.read[id] || 0)) dispatch({ type: 'read', id, seq: data.contentSeq });
    }
    useLayoutEffect(markAtBottom, [reference, data?.contentKey]);
    const retry = () => setAttempt(value => value + 1);
    return h('div', { className: 'sw-native', ref: container, onScrollCapture: markAtBottom },
      failure ? h('div', { className: 'sw-empty-pane', role: 'alert' }, failure,
        h(Button, { label: '重试原生会话', onClick: retry }, '重试'),
        h(Button, { label: '打开原会话', onClick: () => openSession(id) }, '打开原会话 ↗')) : reference ?
        h(NativeErrorBoundary, { key: id + ':' + attempt, id, retry },
          // ui-session requires an owned SessionReference, not a session-id string.
          h(SessionProvider, { session: reference, empty: () => h('p', { className: 'sw-empty-small' }, '会话绑定暂不可用') }, renderSlot('session-watch.native', {}))) :
        h('p', { className: 'sw-empty-small', role: 'status' }, '正在挂载原生会话…'));
  }

  function Picker({ list, state, onClose }) {
    const [query, setQuery] = useState(''); const [folder, setFolder] = useState('');
    const [selected, setSelected] = useState([]); const [page, setPage] = useState(0);
    const folders = [...new Set(list.ids.map(id => list.byId[id]?.cwd).filter(Boolean))];
    const filtered = list.ids.filter(id => {
      const s = list.byId[id];
      return !s?.blank && !state.followed.includes(id) && (!folder || s?.cwd === folder) && (!query || (titleOf(list, id) + ' ' + (s?.cwd || '') + ' ' + id).toLowerCase().includes(query.toLowerCase()));
    });
    return h('section', { className: 'sw-picker', 'aria-label': '添加关注会话' },
      h('div', { className: 'sw-picker-head' }, h('h2', null, '添加关注会话'), h(Button, { label: '关闭添加面板', onClick: onClose }, '关闭')),
      h('div', { className: 'sw-picker-filters' },
        h('input', { autoFocus: true, 'aria-label': '搜索会话', placeholder: '搜索标题、工作区或会话 ID', value: query, onChange: event => { setQuery(event.target.value); setPage(0); } }),
        h('select', { 'aria-label': '按工作区筛选', value: folder, onChange: event => { setFolder(event.target.value); setPage(0); } }, h('option', { value: '' }, '全部工作区'), folders.map(path => h('option', { key: path, value: path }, path))),
      ),
      h('div', { className: 'sw-picker-list' }, filtered.slice(page * 30, page * 30 + 30).map(id => h('label', { key: id, className: 'sw-picker-item' },
        h('input', { type: 'checkbox', checked: selected.includes(id), onChange: event => setSelected(current => event.target.checked ? [...current, id] : current.filter(item => item !== id)) }),
        h('div', null, h('strong', null, titleOf(list, id)), h('small', { title: list.byId[id]?.cwd }, workspaceOf(list.byId[id]) + ' · ' + age(list.byId[id]?.updatedAt))),
        h(Badge, { value: [list.byId[id]?.running ? '运行中' : '空闲', list.byId[id]?.running ? 'running' : 'idle'] }),
      )), !filtered.length ? h('p', { className: 'sw-empty-small' }, list.phase === 'pending' ? '正在加载会话列表…' : '没有匹配的未关注会话') : null),
      h('div', { className: 'sw-picker-foot' }, h('span', null, `已选 ${selected.length} 个 · 共 ${filtered.length} 个可选`),
        h(Button, { label: '上一页', disabled: page === 0, onClick: () => setPage(page - 1) }, '‹'),
        h(Button, { label: '下一页', disabled: (page + 1) * 30 >= filtered.length, onClick: () => setPage(page + 1) }, '›'),
        h(Button, { label: '添加关注', className: 'sw-primary', disabled: !selected.length, onClick: () => { dispatch({ type: 'follow', ids: selected }); onClose(); } }, `关注 ${selected.length || ''} 个会话`)),
    );
  }

  function WorkspacePage({ SessionProvider, renderSlot }) {
    const snapshot = useStore(); const { state } = snapshot; const list = useList();
    const [, render] = useState(0);
    const monitor = useMemo(() => createMonitor(sessions, () => render(value => value + 1), setTimeout, clearTimeout, id => reading.get(id)), []);
    const [picker, setPicker] = useState(false); const [query, setQuery] = useState('');
    const [maximized, setMaximized] = useState(null); const [undo, setUndo] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false); const [settingsError, setSettingsError] = useState('');
    const [keyHint, setKeyHint] = useState('');
    const settingsOpener = useRef(null);
    const app = useRef(null); const lastFocus = useRef(new Map()); const cancelPendingFocus = useRef(() => {});
    const [cardPage, setCardPage] = useState(0); const [sort, setSort] = useState('manual');
    const [passive, setPassive] = useState({}); const [offline, setOffline] = useState(false);
    const grid = useRef(null); const dragCleanup = useRef(null);
    const followed = state.followed.filter(id => !query || (titleOf(list, id) + ' ' + (list.byId[id]?.cwd || '')).toLowerCase().includes(query.toLowerCase()));
    const ordered = sort === 'recent' ? [...followed].sort((a, b) => (list.byId[b]?.updatedAt || 0) - (list.byId[a]?.updatedAt || 0)) : followed;
    const pages = Math.max(1, Math.ceil(ordered.length / 12));
    const pageIndex = Math.min(cardPage, pages - 1);
    const cards = ordered.slice(pageIndex * 12, pageIndex * 12 + 12);
    const visibleCount = visiblePaneCount(state.layout);
    const visibleIds = state.panes.slice(0, visibleCount).filter(Boolean);
    const watchIds = (state.mode === 'cards' ? cards : visibleIds).filter(id => list.byId[id] && list.byId[id].formatStatus !== 'migration-required');
    const watchKey = watchIds.join('|');
    useEffect(() => {
      monitor.sync(watchIds, state.followed);
      for (const id of reading.keys()) if (!state.followed.includes(id)) reading.delete(id);
    }, [watchKey, state.followed.join('|'), monitor]);
    useEffect(() => () => { monitor.releaseAll(); dragCleanup.current?.(); }, [monitor]);
    useEffect(() => {
      const controller = new AbortController(); let stopped = false; let timer;
      async function check() {
        if (document.visibilityState === 'hidden') { timer = setTimeout(check, 3000); return; }
        try {
          const qs = watchIds.map(id => 'id=' + encodeURIComponent(id)).join('&');
          const response = await fetch(API + 'status?' + qs, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
          if (!response.ok) throw new Error('status');
          const value = await response.json(); if (!stopped) { setPassive(value.items || {}); setOffline(false); }
        } catch { if (!stopped) { setOffline(true); setPassive({}); } }
        if (!stopped) timer = setTimeout(check, 3000);
      }
      void check();
      return () => { stopped = true; controller.abort(); clearTimeout(timer); };
    }, [watchKey]);
    useLayoutEffect(() => {
      if (paneHistory.current !== state.activePane) { paneHistory.last = paneHistory.current; paneHistory.current = state.activePane; }
      const api = { root: app.current, settingsOpen, setKeyHint, run: performShortcut, cancelFocus: () => cancelPendingFocus.current(), focusCurrent: () => focusPane(currentPane()) };
      pageBridge = api;
      if (pendingCommand) { const action = pendingCommand; pendingCommand = null; if (canShortcutRun(action)) { if (action === 'workbench.show') api.focusCurrent(); else api.run(action); } }
      return () => { if (pageBridge === api) pageBridge = null; };
    });
    useEffect(() => () => { cancelPendingFocus.current(); recordingShortcut = false; }, []);
    function rememberFocus(index, node = document.activeElement) {
      const pane = app.current?.querySelector(`[data-pane="${index}"]`);
      if (!node || !pane?.contains(node) || node === pane) return;
      const saved = { node, sessionId: store.getSnapshot().state.panes[index] };
      if (typeof node.selectionStart === 'number') { saved.start = node.selectionStart; saved.end = node.selectionEnd; }
      const selection = document.getSelection();
      if (selection?.rangeCount && node.contains(selection.anchorNode)) saved.range = selection.getRangeAt(0).cloneRange();
      lastFocus.current.set(index, saved);
    }
    function selectPane(index) {
      const active = store.getSnapshot().state.activePane;
      if (index !== active) { paneHistory.last = active; paneHistory.current = index; dispatch({ type: 'active', index }); }
    }
    function focusPane(index, editor = false) {
      cancelPendingFocus.current();
      let observer; let timeout; let stopped = false;
      const cancel = () => { stopped = true; observer?.disconnect(); window.clearTimeout(timeout); window.clearTimeout(start); };
      cancelPendingFocus.current = cancel;
      const tryFocus = () => {
        if (stopped || !shortcutRootVisible(app.current, window) || store.getSnapshot().state.activePane !== index) { cancel(); return; }
        const pane = app.current.querySelector(`[data-pane="${index}"]`); if (!pane) { cancel(); return; }
        let target;
        if (editor) target = pane.querySelector('.sw-native [contenteditable="true"][role="textbox"],.sw-native textarea:not([disabled]):not([readonly]),.sw-native [contenteditable="true"]');
        else {
          const saved = lastFocus.current.get(index);
          target = saved?.sessionId === store.getSnapshot().state.panes[index] && saved.node.isConnected && pane.contains(saved.node) ? saved.node : pane;
        }
        if (!target) return;
        const saved = lastFocus.current.get(index);
        if (document.activeElement === target) { cancel(); return; }
        target.focus({ preventScroll: true });
        if (saved?.node === target) {
          if (typeof saved.start === 'number' && target.setSelectionRange) { try { target.setSelectionRange(saved.start, saved.end); } catch {} }
          if (saved.range?.startContainer.isConnected && target.contains(saved.range.startContainer) && target.contains(saved.range.endContainer)) {
            const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(saved.range);
          }
        }
        cancel();
      };
      const start = window.setTimeout(() => {
        tryFocus();
        if (!stopped && editor) {
          const pane = app.current?.querySelector(`[data-pane="${index}"]`);
          if (pane && window.MutationObserver) { observer = new window.MutationObserver(tryFocus); observer.observe(pane, { childList: true, subtree: true }); }
          timeout = window.setTimeout(() => { if (!stopped) { setKeyHint('当前输入区尚未就绪，请稍后重试。'); cancel(); } }, 1200);
        }
      }, 0);
    }
    function performShortcut(action) {
      const current = store.getSnapshot().state; const index = currentPane();
      if (action === 'search') { app.current?.querySelector('.sw-search')?.focus(); return; }
      if (action === 'editor.focus') { focusPane(index, true); return; }
      if (action === 'pane.maximize') { setMaximized(value => value === index ? null : index); focusPane(index); return; }
      let target = /^pane\.[1-4]$/.test(action) ? Number(action.slice(-1)) - 1 : action === 'pane.previous' ? paneHistory.last : paneShortcutTarget(current.layout, index, action.slice(5));
      if (target == null || target < 0 || target >= visiblePaneCount(current.layout)) return;
      rememberFocus(index);
      if (maximized != null) setMaximized(target);
      selectPane(target); focusPane(target);
    }
    async function saveShortcuts(config, expectedConfig) {
      setSettingsError('');
      if (JSON.stringify(normalizeShortcutConfig(expectedConfig)) !== JSON.stringify(store.getConfirmedState().shortcuts)) { setSettingsError('快捷键配置已在其他页面更新，请重新载入后保存。'); return false; }
      if (!validateShortcutConfig(config).valid) { setSettingsError('快捷键配置存在错误，请先修正。'); return false; }
      return dispatch({ type: 'shortcuts', config, expectedConfig });
    }
    useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), 8000); return () => clearTimeout(timer); }, [undo]);
    function remove(id) {
      setUndo({ id, beforeId: state.followed[state.followed.indexOf(id) + 1], pane: state.panes.indexOf(id) });
      dispatch({ type: 'unfollow', id });
    }
    function restore() {
      if (!undo) return;
      dispatch({ type: 'follow', ids: [undo.id] });
      dispatch({ type: 'reorder', id: undo.id, beforeId: undo.beforeId });
      if (undo.pane >= 0 && !state.panes[undo.pane]) dispatch({ type: 'assign', id: undo.id, index: undo.pane });
      setUndo(null);
    }
    function assign(id, index = state.activePane) {
      setMaximized(null); dispatch({ type: 'assign', id, index });
    }
    function resize(axis, event) {
      if (event.button !== 0 || !grid.current) return;
      event.preventDefault(); dragCleanup.current?.();
      const bounds = grid.current.getBoundingClientRect();
      let value = state.ratios[axis];
      const move = e => {
        value = Math.max(.2, Math.min(.8, axis === 'x' ? (e.clientX - bounds.left) / bounds.width : (e.clientY - bounds.top) / bounds.height));
        grid.current?.style.setProperty('--sw-' + axis, value * 100 + '%');
      };
      const done = () => { cleanup(); dispatch({ type: 'ratios', [axis]: value }); };
      const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', done); window.removeEventListener('pointercancel', done); dragCleanup.current = null; };
      dragCleanup.current = cleanup;
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', done); window.addEventListener('pointercancel', done);
    }
    function splitter(axis) {
      return h('div', { key: axis, className: 'sw-splitter sw-splitter-' + axis, role: 'separator', tabIndex: 0,
        'aria-label': axis === 'x' ? '调整左右窗格大小' : '调整上下窗格大小', 'aria-orientation': axis === 'x' ? 'vertical' : 'horizontal',
        'aria-valuenow': Math.round(state.ratios[axis] * 100), 'aria-valuemin': 20, 'aria-valuemax': 80,
        onPointerDown: event => resize(axis, event), onDoubleClick: () => dispatch({ type: 'ratios', [axis]: .5 }),
        onKeyDown: event => { if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) { event.preventDefault(); dispatch({ type: 'ratios', [axis]: state.ratios[axis] + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -.05 : .05) }); } } }, h('i'));
    }
    function unread(id) {
      const data = monitor.get(id); const lastSeenKey = reading.get(id)?.seenKey;
      return (data?.contentSeq || 0) > (state.read[id] || 0) || Boolean(lastSeenKey && data?.contentKey && lastSeenKey !== data.contentKey);
    }
    function row(id) {
      const index = state.panes.indexOf(id); const data = monitor.get(id);
      return h('div', { key: id, className: 'sw-follow-row ' + (state.panes[state.activePane] === id ? 'is-current' : ''), draggable: true,
        onDragStart: event => event.dataTransfer.setData('application/x-session-watch', id),
        onDragOver: event => { if (event.dataTransfer.types.includes('application/x-session-watch')) event.preventDefault(); },
        onDrop: event => { event.preventDefault(); const source = event.dataTransfer.getData('application/x-session-watch'); if (state.followed.includes(source)) dispatch({ type: 'reorder', id: source, beforeId: id }); } },
        h('div', { className: 'sw-follow-title' }, h(Button, { label: '取消关注 ' + titleOf(list, id), className: 'sw-star', onClick: () => remove(id) }, h(Star, { filled: true, size: 15 })),
          h('button', { type: 'button', className: 'sw-select-session', title: '在当前窗格展示：' + titleOf(list, id), onClick: () => assign(id) }, titleOf(list, id)), unread(id) ? h('span', { className: 'sw-unread', title: '有未读更新', 'aria-label': '有未读更新' }) : null),
        h('div', { className: 'sw-follow-meta', title: list.byId[id]?.cwd }, workspaceOf(list.byId[id]), index >= 0 ? h('span', { className: 'sw-pane-tag' }, `${index + 1} ${index < visibleCount ? '分屏中' : '已隐藏'}`) : null),
        h('div', { className: 'sw-follow-bottom' }, h(Badge, { value: statusOf(list.byId[id], data, passive[id]) }), h('small', null, age(data?.updatedAt || list.byId[id]?.updatedAt))),
        h('div', { className: 'sw-row-actions' }, h(Button, { label: '打开原会话 ' + titleOf(list, id), onClick: () => openSession(id) }, '打开 ↗'),
          h(Button, { label: '上移关注项 ' + titleOf(list, id), disabled: state.followed.indexOf(id) === 0, onClick: () => dispatch({ type: 'reorder', id, beforeId: state.followed[state.followed.indexOf(id) - 1] }) }, '↑')),
      );
    }
    function pane(index) {
      const id = state.panes[index]; const data = id ? monitor.get(id) : null;
      const hidden = index >= visibleCount || (maximized != null && maximized !== index);
      return h('section', { key: index, className: 'sw-pane ' + (state.activePane === index ? 'is-selected ' : '') + (maximized === index ? 'is-maximized' : ''),
        style: { display: hidden ? 'none' : undefined }, 'data-pane': index, 'aria-label': '窗格 ' + (index + 1),
        tabIndex: -1, onPointerDown: () => selectPane(index),
        onFocusCapture: event => { selectPane(index); rememberFocus(index, event.target); },
        onDragOver: event => { if (event.dataTransfer.types.includes('application/x-session-watch')) event.preventDefault(); },
        onDrop: event => { event.preventDefault(); const source = event.dataTransfer.getData('application/x-session-watch'); if (state.followed.includes(source)) assign(source, index); } },
        h('header', { className: 'sw-pane-header' }, h('span', { className: 'sw-pane-number' }, index + 1), h('strong', { className: 'sw-pane-title', title: id ? titleOf(list, id) : '' }, id ? titleOf(list, id) : '空窗格'),
          id ? h(Badge, { value: statusOf(list.byId[id], data, passive[id]) }) : null,
          h('div', { className: 'sw-pane-actions' }, id ? h(Button, { label: '打开原会话', onClick: event => stop(event, () => openSession(id)) }, '↗') : null,
            h(Button, { label: maximized === index ? '恢复布局' : '最大化窗格', onClick: event => stop(event, () => setMaximized(maximized === index ? null : index)) }, maximized === index ? '⊟' : '⛶'),
            id ? h(Button, { label: '移出分屏（保留关注，不停止任务）', onClick: event => stop(event, () => dispatch({ type: 'remove-pane', index })) }, '×') : null)),
        id ? h('div', { className: 'sw-pane-workspace', title: list.byId[id]?.cwd }, workspaceOf(list.byId[id])) : null,
        id && list.byId[id]?.formatStatus !== 'migration-required' ? (!hidden && state.mode === 'split' ? h(NativePane, { key: id, id, data, state, SessionProvider, renderSlot }) : null) : h('div', { className: 'sw-empty-pane' }, h('span', { className: 'sw-empty-glyph' }, id ? '↗' : '+'),
          h('strong', null, id ? '此会话需要升级格式' : '选择一个关注会话'), h('p', null, id ? '为避免自动迁移，请打开原会话处理。' : '点击左侧会话，或将它拖到这里'),
          h(Button, { label: id ? '打开原会话' : '添加会话', onClick: () => id ? openSession(id) : setPicker(true) })),
      );
    }
    return h('div', { ref: app, className: 'sw-app', 'data-session-watch': 'true', onPointerDownCapture: () => cancelPendingFocus.current() },
      h('aside', { className: 'sw-rail', inert: settingsOpen || undefined, 'aria-label': '关注会话列表' },
        h('div', { className: 'sw-rail-heading' }, h(Star, { filled: true }), h('h2', null, '关注会话'), h('span', { className: 'sw-count' }, state.followed.length)),
        h(Button, { label: '添加会话', className: 'sw-primary sw-add', disabled: !snapshot.ready, onClick: () => setPicker(value => !value) }, '＋ 添加会话'),
        h('input', { className: 'sw-search', placeholder: '搜索关注会话', 'aria-label': '搜索关注会话', value: query, onChange: event => { setQuery(event.target.value); setCardPage(0); } }),
        h('div', { className: 'sw-follow-list' }, ordered.map(row), !ordered.length ? h('p', { className: 'sw-empty-small' }, state.followed.length ? '没有匹配的关注会话' : '在会话标题旁点 ☆，或添加已有会话。') : null),
        h('footer', { className: 'sw-rail-foot' }, `关注 ${state.followed.length} 个 · 分屏展示 ${visibleIds.length} 个`)),
      h('main', { className: 'sw-main', inert: settingsOpen || undefined },
        h('header', { className: 'sw-toolbar' }, h('div', { className: 'sw-heading' }, h('h1', null, '会话工作台'), h('p', null, '多个任务，进展一目了然')),
          h('div', { className: 'sw-tools' }, h('div', { className: 'sw-segment' }, ['cards', 'split'].map(mode => h(Button, { key: mode, label: mode === 'cards' ? '卡片模式' : '分屏模式', active: state.mode === mode, disabled: !snapshot.ready, onClick: () => dispatch({ type: 'mode', value: mode }) }, mode === 'cards' ? '卡片' : '分屏'))),
            state.mode === 'split' ? h('div', { className: 'sw-segment' }, [['columns', '左右双屏', '◫'], ['rows', '上下双屏', '⊟'], ['quad', '四宫格', '⊞']].map(([value, label, glyph]) => h(Button, { key: value, label, active: state.layout === value, onClick: () => { setMaximized(null); dispatch({ type: 'layout', value }); } }, glyph))) : null,
            h('select', { value: sort, 'aria-label': '关注列表排序', onChange: event => setSort(event.target.value) }, h('option', { value: 'manual' }, '手动排序'), h('option', { value: 'recent' }, '最近更新')),
            h(Button, { label: '快捷键设置', onClick: () => { keyboard.reset(); settingsOpener.current = document.activeElement; setSettingsError(''); setSettingsOpen(true); } }, '⌨ 快捷键'),
            h(Button, { label: '刷新关注数据', onClick: () => { void store.refresh(); monitor.sync(watchIds, state.followed); } }, '↻'))),
        h('div', { className: 'sw-hint' }, 'ⓘ 原生会话模式 · 可在各窗格直接输入、审批和操作' , h('span', null, snapshot.saving ? '保存中…' : snapshot.ready ? '已保存到当前配置档' : '正在加载…')),
        snapshot.error || offline ? h('div', { className: 'sw-error', role: 'status' }, snapshot.error || '连接异常，内容可能不是最新。正在尝试重新连接。') : null,
        undo ? h('div', { className: 'sw-notice', role: 'status' }, '已取消关注；任务未停止。', h(Button, { label: '撤销取消关注', onClick: restore }, '撤销')) : null,
        keyHint ? h('div', { className: 'sw-key-hint', role: 'status' }, keyHint) : null,
        picker ? h(Picker, { list, state, onClose: () => setPicker(false) }) : null,
        !snapshot.ready ? h('div', { className: 'sw-empty-pane' }, '正在加载关注数据…', h(Button, { label: '重试读取', onClick: () => { void store.refresh(); } })) : state.followed.length === 0 ? h('div', { className: 'sw-welcome' }, h(Star, { size: 44 }), h('h2', null, '把值得关注的会话放在一起'), h('p', null, '跨工作区观察进展，不必反复切换。'), h(Button, { label: '选择关注会话', className: 'sw-primary', onClick: () => setPicker(true) }, '＋ 选择关注会话'), h('small', null, '关注不会发送消息，也不会触发模型调用。')) :
          h(React.Fragment, null,
            h('div', { className: 'sw-cards', style: { display: state.mode === 'cards' ? undefined : 'none' } }, cards.map(id => {
              const data = monitor.get(id);
              return h('article', { key: id, className: 'sw-card' }, h('header', null, h(Star, { size: 16, filled: true }), h('h2', { title: titleOf(list, id) }, titleOf(list, id)), unread(id) ? h('span', { className: 'sw-unread', title: '有未读更新' }) : null),
                h('p', { className: 'sw-card-workspace', title: list.byId[id]?.cwd }, workspaceOf(list.byId[id])), h(Badge, { value: statusOf(list.byId[id], data, passive[id]) }),
                h('p', { className: 'sw-snippet' }, data?.snippet || (data?.error ? '暂时无法读取消息' : '暂无可展示的消息')),
                h('small', null, age(data?.updatedAt || list.byId[id]?.updatedAt)),
                h('footer', null, h(Button, { label: '打开原会话 ' + titleOf(list, id), onClick: () => openSession(id) }, '打开会话 ↗'), h(Button, { label: '加入分屏 ' + titleOf(list, id), onClick: () => assign(id) }, '加入分屏'), h(Button, { label: '取消关注 ' + titleOf(list, id), onClick: () => remove(id) }, '☆')));
            }), !cards.length ? h('p', null, '没有匹配的关注会话') : null),
            state.mode === 'cards' && pages > 1 ? h('div', { className: 'sw-pagination' }, h(Button, { label: '上一组卡片', disabled: pageIndex === 0, onClick: () => setCardPage(pageIndex - 1) }, '‹'), `${pageIndex + 1} / ${pages} · 每组 12 个实时预览`, h(Button, { label: '下一组卡片', disabled: pageIndex + 1 >= pages, onClick: () => setCardPage(pageIndex + 1) }, '›')) : null,
            h('div', { ref: grid, className: 'sw-grid sw-grid-' + state.layout + (maximized != null ? ' has-maximized' : ''),
              style: { display: state.mode === 'split' ? undefined : 'none', '--sw-x': state.ratios.x * 100 + '%', '--sw-y': state.ratios.y * 100 + '%' } },
              [0, 1, 2, 3].map(pane), maximized == null && state.layout !== 'rows' ? splitter('x') : null, maximized == null && state.layout !== 'columns' ? splitter('y') : null),
          ),
        h('footer', { className: 'sw-bottom-hint' }, '移出分屏不会取消关注，也不会停止任务。', h('span', null, '实时订阅仅在工作台打开时保持')),
      ),
      settingsOpen ? h(ShortcutSettings, { getDiagnostics: getShortcutDiagnostics, returnFocusTo: settingsOpener.current, value: store.getConfirmedState().shortcuts, saving: snapshot.saving, error: settingsError || snapshot.error, onSave: saveShortcuts,
        onClose: () => { recordingShortcut = false; keyboard.reset(); setSettingsOpen(false); },
        onRecordingChange: value => { recordingShortcut = value; keyboard.reset(); } }) : null,
    );
  }
  function register(name, options, component) {
    slots.inject(name, () => slots.register({ name, ...options }, component));
  }
  register('sidebar.panellist', { id: 'session-watch', order: 24, label: '关注会话' }, props => h(Star, { size: props.size, filled: props.active }));
  register('main', { key: 'session-watch', children: { 'session-watch.native': { kind: 'single', scope: 'session' } } }, WorkspacePage);
  register('session-watch.native', {}, NativeConversation);
  register('conversation.session.header.actions', { id: 'session-watch-follow', order: -5 }, FollowButton);
  register('sidebar.workspaces.session.menu.item', { id: 'session-watch-follow', order: 5 }, MenuFollow);
}
