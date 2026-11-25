// Included in client.js by build.mjs. No browser globals until construction.
export function createWatchStore(transport) {
  let base = createDefaultState();
  let snapshot = { state: base, ready: false, loading: false, saving: false, error: '' };
  let refreshPromise = null;
  let queue = []; let working = false; let stopped = false;
  const listeners = new Set();
  function publish(error = snapshot.error) {
    let state = base;
    for (const item of queue) state = reduceState(state, item.action);
    snapshot = { state, ready: snapshot.ready, loading: snapshot.loading, saving: queue.length > 0, error };
    for (const listener of listeners) listener();
  }
  function refresh() {
    if (stopped) return Promise.resolve(false);
    if (refreshPromise) return refreshPromise;
    snapshot = { ...snapshot, loading: true }; publish('');
    refreshPromise = Promise.resolve().then(async () => {
      try {
        const value = await transport('GET');
        if (stopped) return false;
        const next = normalizeState(value.body.state);
        if (value.status !== 200 || value.body.state?.version !== 1) throw Object.assign(new Error('load'), { status: value.status });
        if (!snapshot.ready || next.revision >= base.revision) base = next;
        snapshot = { ...snapshot, ready: true }; publish('');
        return true;
      } catch (error) {
        if (!stopped) publish('读取关注数据失败' + (Number.isInteger(error?.status) ? `（HTTP ${error.status}）` : '') + '，点击重试。原有数据未被覆盖。');
        return false;
      }
    }).finally(() => {
      refreshPromise = null;
      if (!stopped) { snapshot = { ...snapshot, loading: false }; publish(); }
    });
    return refreshPromise;
  }
  async function flush() {
    if (working || stopped || !snapshot.ready) return;
    working = true;
    while (queue.length && !stopped) {
      const item = queue[0]; let accepted = false;
      try {
        for (let retry = 0; retry < 4; retry++) {
          const value = await transport('POST', { revision: base.revision, action: item.action });
          if (stopped) break;
          if ((value.status === 200 || value.status === 409) && value.body.state?.version !== 1) throw new Error('invalid-state');
          if (value.body.state) {
            const next = normalizeState(value.body.state);
            // A late POST response must not undo a newer cross-tab GET.
            if (next.revision >= base.revision) base = next;
          }
          if (value.body.error === 'shortcuts-changed') throw Object.assign(new Error('shortcuts changed'), { code: 'shortcuts-changed' });
          if (value.status === 200) { accepted = true; break; }
          if (value.status !== 409) throw new Error('save');
        }
        if (!stopped) { queue.shift(); publish(accepted ? '' : '其他页面正在修改关注列表，请重试本次操作。'); item.resolve(accepted); }
      } catch (error) { if (!stopped) { queue.shift(); publish(error?.code === 'shortcuts-changed' ? '快捷键配置已被其他页面修改，请重新载入后保存。' : '保存失败' + (Number.isInteger(error?.status) ? `（HTTP ${error.status}）` : '') + '，本次操作未确认，请重试。'); item.resolve(false); } }
    }
    working = false;
  }
  return {
    getSnapshot: () => snapshot,
    getConfirmedState: () => base,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    refresh,
    dispatch(action) {
      if (stopped || !snapshot.ready) return Promise.resolve(false);
      if (reduceState(snapshot.state, action) === snapshot.state) return Promise.resolve(true);
      return new Promise(resolve => { queue.push({ action, resolve }); publish(''); void flush(); });
    },
    dispose() { stopped = true; for (const item of queue) item.resolve(false); queue = []; listeners.clear(); },
  };
}

export function createMonitor(sessions, notify, schedule = setTimeout, cancel = clearTimeout, getReading = () => ({})) {
  const retained = new Map();
  const cache = new Map();
  let timer = null;
  function changed() { if (timer == null) timer = schedule(() => { timer = null; notify(); }, 120); }
  function release(id) {
    const item = retained.get(id);
    if (!item) return;
    retained.delete(id); item.stopped = true;
    for (const off of item.off) { try { off(); } catch { /* release remaining resources too */ } }
    try { item.reference?.release(); } catch { /* one bad disposer must not leak peers */ }
    const data = cache.get(id);
    if (data) cache.set(id, { contentSeq: data.contentSeq, contentKey: data.contentKey, updatedAt: data.updatedAt });
  }
  function acquire(id) {
    if (retained.has(id)) return;
    const saved = getReading(id) || {};
    const rowLimit = Number.isInteger(saved.rowLimit) ? Math.max(80, Math.min(400, saved.rowLimit)) : 80;
    const restoring = !saved.following && Number.isSafeInteger(saved.anchorSeq) && saved.anchorSeq >= 0;
    const item = { stopped: false, off: [], reference: null, rowLimit, read: null, restoring };
    retained.set(id, item);
    try {
      // Native shared references own their history opening and reconnect logic.
      // Never call prompt/cancel/command/create here.
      const reference = sessions.retain(id, { source: 'controllerOperation' });
      item.reference = reference;
      const { session, eventSource } = reference.binding;
      const read = () => {
        if (item.stopped) return;
        const window = eventSource.getSnapshot();
        const preview = extractPreview(window.entries, item.rowLimit + 1);
        const bufferedOlder = preview.rows.length > item.rowLimit;
        preview.rows = preview.rows.slice(-item.rowLimit);
        const contentSeq = preview.rows.reduce((max, row) => Math.max(max, row.seq), 0);
        const last = preview.rows.at(-1);
        const contentKey = last ? `${last.key}:${last.text.length}` : '';
        cache.set(id, { ...preview, contentSeq, contentKey, snapshot: session.getSnapshot(), restoring: item.restoring, restoreError: item.restoreError, hasMore: item.rowLimit < 400 && (window.hasMore || bufferedOlder), rowLimit: item.rowLimit });
        changed();
      };
      item.read = read;
      // Register disposers one by one: a later subscribe may throw.
      item.off.push(session.subscribe(read));
      item.off.push(eventSource.subscribe(read));
      read();
      reference.ready.then(async () => {
        if (item.stopped) return;
        if (item.restoring) {
          try { await session.loadThrough(saved.anchorSeq); }
          catch { item.restoreError = true; }
          item.restoring = false;
        }
        read();
      }, error => {
        if (!item.stopped) { cache.set(id, { ...cache.get(id), error: error?.message || '会话暂时无法读取' }); changed(); }
      });
    } catch (error) { release(id); cache.set(id, { ...cache.get(id), error: error?.message || '会话暂时无法读取' }); changed(); }
  }
  return {
    sync(ids, followed = ids) {
      const wanted = new Set(ids.slice(0, 12));
      for (const id of retained.keys()) if (!wanted.has(id)) release(id);
      for (const id of wanted) acquire(id);
      // Keep only small unread watermarks for off-page followed sessions.
      // Release their body/history; changing pages must not mark them as read.
      const known = new Set(followed);
      for (const id of cache.keys()) if (!known.has(id)) cache.delete(id);
    },
    get: id => cache.get(id),
    async loadOlder(id) {
      const item = retained.get(id);
      if (!item?.reference || item.rowLimit >= 400) return;
      item.rowLimit = Math.min(400, item.rowLimit + 80);
      if (item.reference.binding.eventSource.getSnapshot().hasMore) await item.reference.binding.session.loadOlder();
      item.read?.();
    },
    releaseAll() { for (const id of [...retained.keys()]) release(id); if (timer != null) cancel(timer); timer = null; cache.clear(); },
    count: () => retained.size,
  };
}
