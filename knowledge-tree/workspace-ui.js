// Kept self-contained so the client adapter can embed this function verbatim.
export function createWorkspaceComponents(React) {
  const { createElement: h, useState, useRef, useEffect } = React;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const stable = (value) => JSON.stringify(value, function (key, item) {
    if (key === 'updatedAt') return undefined;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.keys(item).sort().reduce((out, name) => { out[name] = item[name]; return out; }, {});
    }
    return item;
  });
  // Keep the exact stored/remote representation when editor normalization alone changes it
  // (for example, an omitted image becoming null). Apply only actual editor changes.
  const reconcileEditor = (raw, projected, edited) => {
    if (stable(projected) === stable(edited)) return clone(raw);
    if (Array.isArray(edited)) {
      return edited.map((item, index) => {
        const keyed = item && typeof item === 'object' && typeof item.id === 'string';
        const before = keyed && Array.isArray(projected) ? projected.find((value) => value && value.id === item.id) : projected?.[index];
        const original = keyed && Array.isArray(raw) ? raw.find((value) => value && value.id === item.id) : raw?.[index];
        return before === undefined ? clone(item) : reconcileEditor(original, before, item);
      });
    }
    if (edited && projected && typeof edited === 'object' && typeof projected === 'object') {
      const result = raw && typeof raw === 'object' && !Array.isArray(raw) ? clone(raw) : {};
      for (const key of Object.keys(projected)) if (!(key in edited)) delete result[key];
      for (const key of Object.keys(edited)) {
        const value = reconcileEditor(raw?.[key], projected[key], edited[key]);
        if (value === undefined) delete result[key]; else result[key] = value;
      }
      return result;
    }
    return clone(edited);
  };
  // Tolerate a Host that still returns the pre-SSH config shape ({owner, repo}): display its
// equivalent SSH remote instead of `undefined`, and migrate it on the next save.
  const remoteText = (config) => {
    if (!config) return '';
    if (typeof config.remote === 'string') return config.remote;
    if (typeof config.owner === 'string' && typeof config.repo === 'string') {
      return `git@github.com:${config.owner}/${String(config.repo).replace(/\.git$/, '')}.git`;
    }
    return '';
  };
  const remotePrefix = (config) => JSON.stringify([remoteText(config), config.branch, config.directory]) + '/';
  const cachedSnapshot = (row) => row && (row.snapshot || row);
  const errorText = (error) => error && error.message ? error.message : String(error || '未知错误');
  const hashValue = (result) => typeof result === 'string' ? result : result && (result.hash || result.documentHash);
  const title = (record) => record && record.document && record.document.title || '未命名知识树';
  const counts = (document) => `${(document.cards || []).length} 张卡片 · ${(document.links || []).length} 条关系 · ${(document.cards || []).filter((card) => card.image).length} 张图片`;
  const imageData = (image) => image && typeof image.data === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/\s]+=*$/i.test(image.data) ? image.data : null;
  // The workspace shell wraps the embedded knowledge-tree editor (`.kt-page`), which has its
  // own design system. Generic element rules below therefore exclude `.kt-page` descendants,
  // otherwise the shell's button / input / img defaults would override the editor's cards,
  // controls and images.
  const css = `
.ktw{--kw-bg:var(--dsw-alias-bg-base,#fff);--kw-layer:var(--dsw-alias-bg-layer-1,#f6f7f9);--kw-text:var(--dsw-alias-label-primary,#20242b);--kw-muted:var(--dsw-alias-label-secondary,#666d79);--kw-border:var(--dsw-alias-border-l1,#d8dde5);--kw-brand:var(--dsw-alias-brand-primary,#3765cf);color:var(--kw-text);background:var(--kw-bg);height:100%;min-height:420px;display:flex;flex-direction:column;font:13px/1.5 system-ui,sans-serif;overflow:auto}
.ktw *:not(.kt-page *){box-sizing:border-box}.ktw button:not(.kt-page *),.ktw input:not(.kt-page *),.ktw textarea:not(.kt-page *){font:inherit;color:inherit}.ktw button:not(.kt-page *){cursor:pointer;border:1px solid var(--kw-border);border-radius:7px;padding:5px 9px;background:var(--kw-bg)}.ktw button:not(.kt-page *):disabled{cursor:not-allowed;opacity:.5}.ktw button:not(.kt-page *)[aria-current=true]{border-color:var(--kw-brand);color:var(--kw-brand)}.ktw input:not(.kt-page *),.ktw textarea:not(.kt-page *){border:1px solid var(--kw-border);background:var(--kw-bg);border-radius:6px;padding:6px;max-width:100%}.ktw input:not(.kt-page *):focus,.ktw textarea:not(.kt-page *):focus,.ktw button:not(.kt-page *):focus-visible,.ktw summary:not(.kt-page *):focus-visible{outline:2px solid var(--kw-brand);outline-offset:2px}.ktw header,.ktw .kw-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px;border-bottom:1px solid var(--kw-border)}.ktw h2:not(.kt-page *),.ktw h3:not(.kt-page *){margin:0 0 8px;font-size:15px}.ktw .kw-body{display:flex;flex:1;min-height:0}.ktw nav{width:210px;flex:none;padding:12px;border-right:1px solid var(--kw-border);overflow:auto}.ktw nav ul{list-style:none;padding:0;margin:8px 0 18px}.ktw nav li{margin:5px 0}.ktw .kw-tree{width:100%;text-align:left;overflow-wrap:anywhere}.ktw main{flex:1;min-width:0;display:flex;flex-direction:column}.ktw .kw-columns{display:flex;flex:1;min-height:0;overflow:auto}.ktw .kw-pane{flex:1;min-width:0;overflow:auto;border-right:1px solid var(--kw-border)}.ktw .kw-pane>h3{padding:10px;background:var(--kw-layer);margin:0}.ktw .kw-editor{height:100%;min-height:360px}.ktw .kw-view{padding:12px}.ktw .kw-muted{color:var(--kw-muted);font-size:12px}.ktw .kw-notice{padding:8px 12px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--kw-layer)}.ktw .kw-error{color:var(--dsw-alias-state-error-primary,#b3261e)}.ktw .kw-card{border:1px solid var(--kw-border);border-radius:8px;margin:8px 0;padding:8px;overflow-wrap:anywhere}.ktw .kw-card summary{cursor:pointer;font-weight:600}.ktw .kw-card pre{white-space:pre-wrap;font:inherit}.ktw img:not(.kt-page *){display:block;max-width:100%;max-height:600px;object-fit:contain}.ktw .kw-dialog{position:fixed;inset:0;z-index:80;background:#0006;display:flex;align-items:center;justify-content:center;padding:20px}.ktw .kw-dialog form{background:var(--kw-bg);border:1px solid var(--kw-border);border-radius:12px;padding:20px;width:520px;max-height:90vh;overflow:auto}.ktw label:not(.kt-page *){display:block;margin:8px 0}.ktw label:not(.kt-page *) input,.ktw label:not(.kt-page *) textarea{display:block;width:100%;margin-top:4px}.ktw .kw-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ktw .kw-inline{padding:8px;border:1px solid var(--kw-border);border-radius:6px;margin:6px 0}.ktw .kw-snapshots{padding:10px}.ktw .kw-search{width:100%}@media(max-width:850px){.ktw nav{width:165px}.ktw .kw-columns{flex-direction:column}.ktw .kw-pane{min-height:280px;flex:none}.ktw .kw-editor{height:520px}}
`;

  const menuCss = `.ktw .kw-context-menu{position:fixed;z-index:10000;display:flex;flex-direction:column;min-width:160px;padding:5px;border:1px solid var(--kw-border);border-radius:9px;background:var(--kw-bg);box-shadow:0 6px 22px #0002}.ktw .kw-context-menu button{border:0;text-align:left;padding:8px 12px}.ktw .kw-context-menu button:hover,.ktw .kw-context-menu button:focus-visible{background:var(--kw-layer)}.ktw .kw-context-menu .kw-danger{color:var(--dsw-alias-state-error-primary,#b3261e)}`;

  function ReadOnlyTree({ snapshot }) {
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState(false);
    const document = snapshot.document;
    const cards = document.cards || [];
    const links = document.links || [];
    const names = new Map(cards.map((card) => [card.id, card.title]));
    const name = (id) => names.get(id) || `未知卡片（${id}）`;
    const matching = cards.filter((card) => {
      const relations = links.filter((link) => link.childId === card.id || link.parentId === card.id).map((link) => name(link.childId === card.id ? link.parentId : link.childId)).join(' ');
      return `${card.title || ''} ${card.content || ''} ${relations}`.toLowerCase().includes(query.toLowerCase());
    });
    return h('div', { className: 'kw-view' },
      h('h2', null, document.title || '未命名知识树'),
      h('p', { className: 'kw-muted' }, `${counts(document)}。远端只读，不会保存或上传。`),
      h('label', null, '搜索卡片、正文与关联名称', h('input', { className: 'kw-search', type: 'search', value: query, onChange: (event) => setQuery(event.target.value) })),
      h('button', { type: 'button', onClick: () => setExpanded(!expanded) }, expanded ? '收起全部卡片' : '展开全部卡片'),
      h('p', { className: 'kw-muted', 'aria-live': 'polite' }, `显示 ${matching.length} / ${cards.length} 张卡片`),
      matching.map((card) => {
        const parents = links.filter((link) => link.childId === card.id);
        const primary = parents.find((link) => link.primary);
        const related = new Set(parents.filter((link) => !link.primary).map((link) => name(link.parentId)));
        links.filter((link) => link.parentId === card.id && !link.primary).forEach((link) => related.add(name(link.childId)));
        const children = links.filter((link) => link.parentId === card.id && link.primary).map((link) => name(link.childId));
        const image = imageData(card.image);
        return h('details', { key: `${card.id}:${expanded}:${query}`, className: 'kw-card', open: expanded || !!query },
          h('summary', null, card.title || '无标题卡片'),
          h('p', { className: 'kw-muted' }, `主父节点：${primary ? name(primary.parentId) : '顶层 / 未分类'}`),
          children.length > 0 && h('p', { className: 'kw-muted' }, `下级：${children.join('、')}`),
          h('p', { className: 'kw-muted' }, `关联：${Array.from(related).join('、') || '无'}`),
          h('pre', null, card.content || '（暂无正文）'),
          image && h('a', { href: image, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `查看图片：${card.title || '卡片图片'}` }, h('img', { src: image, alt: card.title || '卡片图片', loading: 'lazy' })),
          card.image && !image && h('p', { className: 'kw-muted' }, '图片格式无效，已阻止加载。'));
      }));
  }

  function Workspace({ library, createEditor, renderEditor, rpc, normalizeDocument }) {
    const [locals, setLocals] = useState([]);
    const [selected, setSelected] = useState(null);
    const [remoteItems, setRemoteItems] = useState([]);
    const [remote, setRemote] = useState(null);
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);
    const [pushing, setPushing] = useState(false);
    const [ready, setReady] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [configOpen, setConfigOpen] = useState(false);
    const [form, setForm] = useState({ remote: 'git@github.com:', branch: 'main', directory: 'knowledge-trees' });
    const [deleteId, setDeleteId] = useState(null);
    const [treeMenu, setTreeMenu] = useState(null);
    const menuRef = useRef(null);
    const menuTrigger = useRef(null);
    const [nameDialog, setNameDialog] = useState(null);
    const [treeName, setTreeName] = useState('');
    const [nameError, setNameError] = useState('');
    const [pushOpen, setPushOpen] = useState(false);
    const [dirty, setDirty] = useState(null);
    const dirtyEpoch = useRef(0);
    const [message, setMessage] = useState('更新知识树');
    const [conflict, setConflict] = useState(null);
    const [snapshots, setSnapshots] = useState(null);
    const [, rerender] = useState(0);
    const contexts = useRef(new Map());
    const selectedRef = useRef(null);
    const busyRef = useRef(false);
    const alive = useRef(true);
    const configRef = useRef(null);
    const update = () => { if (alive.current) rerender((value) => value + 1); };
    const normal = (document) => clone(normalizeDocument ? normalizeDocument(clone(document)) : document);
    const current = selected && contexts.current.get(selected);
    const showError = (reason) => { if (alive.current) setError(errorText(reason)); };
    const hash = async (document) => {
      const result = hashValue(await rpc('hashDocument', { document: clone(document) }));
      if (!result || typeof result !== 'string') throw new Error('主机未返回有效文档哈希，已取消操作。');
      return result;
    };
    const refreshLocals = async () => {
      const list = await library.listLocal();
      if (alive.current) setLocals(Array.isArray(list) ? list : list.records || []);
      return Array.isArray(list) ? list : list.records || [];
    };
    const remember = async (id) => { try { await library.setSetting('workspace.selectedTreeId', id); } catch (reason) { showError(reason); } };
    const canLeave = () => {
      const context = contexts.current.get(selectedRef.current);
      if (context && (context.pending || context.error)) {
        showError(new Error('当前知识树尚未成功保存。请先重试保存，避免切换后丢失编辑。'));
        return false;
      }
      return true;
    };
    const queue = (context, action) => {
      const task = context.tail.catch(() => {}).then(action);
      context.tail = task;
      // The editor adapter may fire and forget; the promise still rejects for callers that await it.
      task.catch(() => {});
      return task;
    };
    const save = (context, document, ui) => {
      context.draft = { document: reconcileEditor(context.editorRaw, context.editorProjection, document), ui: clone(ui || {}) };
      const capture = clone(context.draft);
      const sequence = ++context.sequence;
      context.pending++;
      update();
      return queue(context, async () => {
        try {
          const latest = await library.getLocal(context.id);
          if (!latest) throw new Error('本地知识树已被删除；内存中的编辑仍保留，请勿关闭页面。');
          if (latest.revision !== context.record.revision) throw new Error('本地记录已在另一窗口更新。为防止覆盖，未保存当前编辑。');
          const result = await library.saveLocal({ ...latest, document: capture.document, ui: capture.ui }, { expectedRevision: latest.revision });
          context.record = result || await library.getLocal(context.id);
          context.savedSequence = sequence;
          context.error = null;
          await refreshLocals();
          return context.record;
        } catch (reason) {
          context.error = reason;
          showError(new Error(`本地保存失败：${errorText(reason)}。编辑保留在当前页面，请重试保存。`));
          throw reason;
        } finally { context.pending--; update(); }
      });
    };
    const activate = async (recordOrId, force = false) => {
      if (!canLeave()) return false;
      const id = typeof recordOrId === 'string' ? recordOrId : recordOrId.id;
      let context = contexts.current.get(id);
      if (!context) {
        const record = await library.getLocal(id);
        if (!record) throw new Error('找不到本地知识树。');
        const projection = normal(record.document);
        // updatedAt belongs to the editor's runtime state, not its persisted document.
        delete projection.updatedAt;
        context = { id, record, editorRaw: clone(record.document), editorProjection: clone(projection), draft: { document: clone(record.document), ui: clone(record.ui || {}) }, tail: Promise.resolve(), pending: 0, sequence: 0, savedSequence: 0, error: null };
        context.store = createEditor({ ...record, document: projection }, (document, ui) => save(context, document, ui));
        contexts.current.set(id, context);
      }
      if (!canLeave()) return false;
      selectedRef.current = id;
      setSelected(id);
      setSnapshots(null);
      await remember(id);
      return true;
    };
    const flush = async (context) => {
      if (!context) return;
      await context.tail.catch(() => {});
      if (context.error || context.pending) throw new Error('请先成功保存本地编辑，再执行同步。');
    };
    const run = async (action) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError('');
      setNotice('');
      try { await action(); } catch (reason) { showError(reason); }
      finally { busyRef.current = false; if (alive.current) { setBusy(false); setPushing(false); } }
    };
    const readRemote = async (treeId) => {
      const config = configRef.current;
      if (!config) throw new Error('请先配置 SSH 仓库地址。');
      const response = await rpc('readTree', { treeId });
      if (!response || response.found === false || response.notFound || !response.document) throw new Error('远端知识树不存在或无法读取；未更改任何本地内容。');
      // Hash/cache the exact remote document. Normalization is an editor projection only.
      const document = clone(response.document);
      const documentHash = await hash(document);
      const snapshot = { ...response, treeId, document, hash: documentHash, cachedAt: Date.now(), remoteKey: remotePrefix(config) + treeId };
      await library.cacheRemote(snapshot.remoteKey, snapshot);
      return snapshot;
    };
    const openRemote = (treeId) => run(async () => {
      setConflict(null);
      const key = remotePrefix(configRef.current) + treeId;
      try {
        const snapshot = await readRemote(treeId);
        setRemote({ ...snapshot, offline: false });
      } catch (reason) {
        const row = await library.getRemote(key);
        const cached = cachedSnapshot(row);
        if (cached && cached.document) {
          setRemote({ ...cached, cachedAt: cached.cachedAt || row.updatedAt, treeId, remoteKey: key, document: clone(cached.document), offline: true });
          setNotice(`远端读取失败：${errorText(reason)}。正在显示离线缓存，不可将缓存用于拉取覆盖。`);
        } else { setRemote(null); throw reason; }
      }
    });
    const refreshRemote = () => run(async () => {
      if (!configRef.current) throw new Error('请先配置 SSH 仓库地址。');
      const result = await rpc('listTrees', {});
      const items = Array.isArray(result) ? result : result && (result.trees || result.items) || [];
      setRemoteItems(items.map((item) => typeof item === 'string' ? { treeId: item, title: item } : { ...item, treeId: item.treeId || item.id }));
      setNotice('远端目录已手动刷新；未上传或替换任何知识树。');
    });

    useEffect(() => {
      alive.current = true;
      const initialized = Promise.resolve().then(() => library.init());
      (async () => {
        try {
          await initialized;
          const records = await refreshLocals();
          const previous = await library.getSetting('workspace.selectedTreeId');
          const chosen = records.find((record) => record.id === previous) || records[0];
          if (chosen && alive.current) await activate(chosen, true);
        } catch (reason) { showError(reason); }
        finally { if (alive.current) setReady(true); }
      })();
      (async () => {
        try {
          await initialized;
          const result = await rpc('status', {});
          if (!alive.current) return;
          setStatus(result);
          configRef.current = result.configured ? result.config : null;
          if (result.config) setForm({ remote: remoteText(result.config), branch: result.config.branch, directory: result.config.directory });
          if (configRef.current) {
            const cached = await library.listRemote(remotePrefix(configRef.current));
            if (alive.current) setRemoteItems((cached || []).map((row) => {
              const item = cachedSnapshot(row);
              return { ...item, treeId: item.treeId || (row.remoteKey || row.key || '').slice(remotePrefix(configRef.current).length), cached: true };
            }));
          }
        } catch (reason) { showError(new Error(`SSH 同步状态不可用（本地仍可编辑）：${errorText(reason)}`)); }
      })();
      return () => { alive.current = false; };
    }, []);
    useEffect(() => {
      const beforeUnload = (event) => {
        if (Array.from(contexts.current.values()).some((context) => context.pending || context.error)) {
          event.preventDefault(); event.returnValue = '';
        }
      };
      if (typeof window !== 'undefined') window.addEventListener('beforeunload', beforeUnload);
      return () => { if (typeof window !== 'undefined') window.removeEventListener('beforeunload', beforeUnload); };
    }, []);

    useEffect(() => {
      const epoch = ++dirtyEpoch.current;
      if (!current) { setDirty(null); return; }
      if (!current.record.sync?.baseHash) { setDirty('尚未推送'); return; }
      setDirty('同步状态检查中');
      hash(current.record.document).then((value) => {
        if (alive.current && epoch === dirtyEpoch.current) setDirty(value === current.record.sync.baseHash ? '与同步基线一致' : '有未推送更改');
      }).catch(() => {
        if (alive.current && epoch === dirtyEpoch.current) setDirty('离线：同步状态待检查');
      });
    }, [selected, current?.record.revision]);

    const openNameDialog = (record) => {
      if (!canLeave()) return;
      setNameError('');
      setTreeName(record ? contexts.current.get(record.id)?.draft.document.title ?? record.document.title : '新知识树');
      setNameDialog(record ? { id: record.id, revision: record.revision } : { id: null });
    };
    const closeTreeMenu = (restoreFocus = false) => {
      setTreeMenu(null);
      if (restoreFocus) menuTrigger.current?.focus();
    };
    const openTreeMenu = (event, record, keyboard = false) => {
      event.preventDefault();
      if (busyRef.current) return;
      const button = event.currentTarget;
      menuTrigger.current = button;
      const bounds = button.getBoundingClientRect?.() || { left: 0, bottom: 0 };
      const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const height = typeof window !== 'undefined' ? window.innerHeight : 768;
      const x = keyboard ? bounds.left : event.clientX;
      const y = keyboard ? bounds.bottom : event.clientY;
      setDeleteId(null);
      setTreeMenu({ id: record.id, x: Math.max(8, Math.min(x || 0, width - 176)), y: Math.max(8, Math.min(y || 0, height - 108)) });
    };
    useEffect(() => {
      if (!treeMenu || typeof document === 'undefined') return;
      menuRef.current?.querySelector('button:not(:disabled)')?.focus();
      const outside = (event) => { if (!menuRef.current?.contains(event.target)) closeTreeMenu(); };
      const escape = (event) => { if (event.key === 'Escape') { event.preventDefault(); closeTreeMenu(true); } };
      const dismiss = () => closeTreeMenu();
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', escape);
      document.addEventListener('scroll', dismiss, true);
      window.addEventListener('resize', dismiss);
      return () => {
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('keydown', escape);
        document.removeEventListener('scroll', dismiss, true);
        window.removeEventListener('resize', dismiss);
      };
    }, [treeMenu]);
    const newTree = () => openNameDialog(null);
    const submitTreeName = (event) => {
      event.preventDefault();
      const clean = treeName.trim();
      if (!clean || clean.length > 60) { setNameError('名称不能为空，且不能超过 60 个字符。'); return; }
      setNameError('');
      return run(async () => {
        if (!canLeave()) return;
        if (nameDialog.id === null) {
          const record = await library.createLocal(normal({ version: 3, stage: 'brainstorm', title: clean, cards: [], links: [], updatedAt: Date.now() }));
          await refreshLocals();
          await activate(record, true);
          setNotice('已新建本地知识树，不会自动上传。');
        } else {
          const context = contexts.current.get(nameDialog.id);
          await flush(context);
          const latest = await library.getLocal(nameDialog.id);
          if (!latest) throw new Error('本地知识树已不存在。');
          const expected = context ? context.record.revision : nameDialog.revision;
          if (latest.revision !== expected) throw new Error('知识树已在另一窗口更新，未覆盖名称；请重新打开后重试。');
          if (latest.document.title !== clean) {
            if (context) {
              // Update the existing editor too: the next card save must not restore its old title.
              context.store.setTitle(clean);
              await Promise.resolve();
              await flush(context);
            } else {
              await library.saveLocal({ ...latest, document: { ...latest.document, title: clean } }, { expectedRevision: expected });
            }
          }
          await refreshLocals();
          setNotice('本地树已重命名；树 ID、卡片与同步关联不变，不会自动推送。');
        }
        setNameDialog(null);
      });
    };
    const deleteTree = (id) => run(async () => {
      if (!canLeave()) return;
      if (typeof library.deleteLocal !== 'function') throw new Error('当前本地存储适配器不支持删除知识树。');
      const record = await library.getLocal(id);
      if (!record) throw new Error('知识树已不存在。');
      await library.snapshotLocal(id, { reason: '删除本地知识树前' });
      await library.deleteLocal(id, { expectedRevision: record.revision });
      contexts.current.delete(id);
      const records = await refreshLocals();
      setDeleteId(null);
      if (selectedRef.current === id) {
        selectedRef.current = null; setSelected(null);
        if (records[0]) await activate(records[0], true);
        else await remember(null);
      }
      setNotice('本地知识树已删除；SSH 远端内容未删除。');
    });
    const configure = (event) => {
      event.preventDefault();
      run(async () => {
        const input = { remote: form.remote.trim(), branch: form.branch.trim(), directory: form.directory.trim() };
        if (!input.remote || !input.branch || !input.directory) throw new Error('请填写 SSH 远端地址、分支和目录。');
        const result = await rpc('configure', input);
        const next = result && typeof result.configured === 'boolean' ? result : await rpc('status', {});
        configRef.current = next.configured ? next.config : null;
        setStatus(next);
        setForm(next.config ? { remote: remoteText(next.config), branch: next.config.branch, directory: next.config.directory } : input);
        setRemote(null); setRemoteItems([]); setConflict(null); setConfigOpen(false);
        setNotice('SSH 仓库配置已保存。没有自动上传；请手动刷新远端目录。');
      });
    };
    const checkConnection = () => run(async () => {
      const result = await rpc('check', {});
      setNotice(`SSH 连接正常：${result.remote}（${result.branch}）@ ${String(result.commitSha).slice(0, 8)}`);
    });
    const push = () => run(async () => {
      setPushing(true);
      const context = contexts.current.get(selectedRef.current);
      if (!context) throw new Error('请先选择本地知识树。');
      if (!configRef.current) throw new Error('请先配置仓库。');
      if (!message.trim()) throw new Error('请填写提交说明。');
      await flush(context);
      // Capture before the network request; subsequent typing remains local and is never replaced.
      const captured = clone(context.record);
      // Remove the confirmation overlay before awaiting the network: typing stays available.
      setPushOpen(false);
      setNotice('正在推送捕获的本地版本；你可以继续编辑，新编辑不会自动上传。');
      const prefix = remotePrefix(configRef.current);
      const associated = captured.sync && captured.sync.remoteKey && captured.sync.remoteKey.startsWith(prefix);
      const treeId = associated ? captured.sync.treeId || captured.sync.remoteKey.slice(prefix.length) : captured.id;
      const key = prefix + treeId;
      const pushedHash = await hash(captured.document);
      const response = await rpc('pushTree', { treeId, document: clone(captured.document), baseHash: associated ? captured.sync.baseHash || null : null, message: message.trim() });
      if (response && (response.conflict || response.ok === false)) throw new Error('推送被拒绝：远端已更改。请手动读取远端并比较，不会强制覆盖。');
      try {
        await queue(context, async () => {
          // Only edits saved by THIS context may advance its revision. Never adopt another
          // window's document merely to patch metadata: this editor still holds its old body.
          const latest = await library.getLocal(context.id);
          if (!latest) throw new Error('本地记录已删除，无法记录同步基线。');
          if (latest.revision !== context.record.revision) throw new Error('本地记录已在另一窗口更新，已拒绝记录同步元数据；请重新加载本地树。');
          const result = await library.saveLocal({ ...latest, sync: { ...latest.sync, remoteKey: key, treeId, baseHash: pushedHash } }, { expectedRevision: context.record.revision });
          context.record = result || await library.getLocal(context.id);
        });
      } catch (reason) {
        throw new Error(`远端推送已成功，但本地同步基线记录失败：${errorText(reason)}。远端提交已存在，请勿误认为推送失败而重复覆盖。`);
      }
      await refreshLocals(); update();
      setPushOpen(false);
      setNotice('已推送捕获的本地版本。推送期间的新编辑仍保留在本地，未被覆盖或自动上传。');
    });
    const pull = () => run(async () => {
      if (!remote) throw new Error('请先读取一棵远端知识树。');
      if (!canLeave()) return;
      const snapshot = await readRemote(remote.treeId);
      setRemote({ ...snapshot, offline: false });
      const records = await refreshLocals();
      const matching = records.find((record) => record.sync && record.sync.remoteKey === snapshot.remoteKey);
      if (!matching) {
        const collision = await library.getLocal(snapshot.treeId);
        const options = { sync: { remoteKey: snapshot.remoteKey, treeId: snapshot.treeId, baseHash: snapshot.hash } };
        if (!collision) options.id = snapshot.treeId;
        const created = await library.createLocal(snapshot.document, options);
        await refreshLocals(); await activate(created, true);
        setConflict(null);
        setNotice(collision ? '本地 ID 已存在，已用新 ID 导入远端；同步仍指向原远端树。' : '已导入远端为同 ID 的本地知识树；以后编辑只保存在本地。');
        return;
      }
      const context = contexts.current.get(matching.id);
      await flush(context);
      // Serialize with editor saves while we calculate hashes and decide whether replacement is safe.
      const replace = async () => {
        const latest = await library.getLocal(matching.id);
        if (!latest) throw new Error('本地知识树已不存在。');
        if (context && latest.revision !== context.record.revision) throw new Error('本地记录已在另一窗口更新，请重新加载本地树后再拉取。');
        if (context && (context.pending || context.error)) throw new Error('检测到正在编辑或保存；请保存后重试拉取。');
        const localHash = await hash(latest.document);
        const baseHash = latest.sync && latest.sync.baseHash;
        if (localHash === snapshot.hash) {
          // Equal content may still have an obsolete base. Metadata-only CAS stays in
          // the editor queue, so later keystrokes retain their body and use our revision.
          // A cross-window change fails CAS rather than being absorbed into this context.
          if (baseHash !== snapshot.hash) {
            const saved = await library.saveLocal({ ...latest, sync: { ...latest.sync, remoteKey: snapshot.remoteKey, treeId: snapshot.treeId, baseHash: snapshot.hash } }, { expectedRevision: latest.revision });
            if (context) context.record = saved || await library.getLocal(latest.id);
          }
          await refreshLocals(); setConflict(null); setNotice('本地与远端内容相同，已对齐同步基线，未替换内容。'); return;
        }
        const localDirty = localHash !== baseHash;
        const remoteChanged = snapshot.hash !== baseHash;
        if (localDirty && !remoteChanged) { setConflict(null); setNotice('远端没有变化。保留本地未推送编辑，不执行覆盖。'); return; }
        if (localDirty && remoteChanged) {
          setConflict({ snapshot, localId: latest.id });
          setNotice('本地与远端均有更改：已停止拉取。请并排比较，可将远端另存为独立本地树。');
          return;
        }
        // Saves initiated while hashDocument was awaiting must never be discarded.
        if (context && (context.pending || context.error)) throw new Error('拉取检查期间出现新编辑，已取消替换。');
        const verified = await library.getLocal(latest.id);
        if (!verified || verified.revision !== latest.revision) throw new Error('拉取检查期间本地版本已变化，已取消替换。');
        await library.snapshotLocal(latest.id, { reason: '拉取远端替换前' });
        if (context && (context.pending || context.error)) throw new Error('快照期间出现新编辑，已取消替换。');
        const sequence = context && context.sequence;
        const result = await library.saveLocal({ ...latest, document: snapshot.document, ui: {}, sync: { ...latest.sync, remoteKey: snapshot.remoteKey, treeId: snapshot.treeId, baseHash: snapshot.hash } }, { expectedRevision: latest.revision });
        const saved = result || await library.getLocal(latest.id);
        if (context && context.sequence !== sequence) {
          // A keystroke can arrive during IndexedDB's final asynchronous CAS. Keep its editor
          // alive, advance its revision, and let the already-queued save persist that draft.
          context.record = saved;
          setNotice('已读取远端；替换期间的新编辑仍保留在原编辑器，并将继续保存在本地。');
        } else {
          contexts.current.delete(latest.id);
          if (selectedRef.current === latest.id) await activate(saved, true);
          setNotice('已拉取远端；替换前的本地版本已保存为快照。');
        }
        await refreshLocals(); setConflict(null);
      };
      if (context) await queue(context, replace); else await replace();
    });
    const saveIndependent = () => run(async () => {
      if (!conflict || !canLeave()) return;
      const record = await library.createLocal(clone(conflict.snapshot.document));
      await refreshLocals(); await activate(record, true);
      setConflict(null);
      setNotice('远端版本已另存为独立本地树（新 ID、无同步关联），原本地树未更改。');
    });
    const loadSnapshots = () => run(async () => {
      if (!selectedRef.current) return;
      const list = await library.listSnapshots(selectedRef.current);
      setSnapshots(Array.isArray(list) ? list : list.snapshots || []);
    });
    const restore = (snapshot) => run(async () => {
      if (!canLeave()) return;
      const context = contexts.current.get(selectedRef.current);
      await flush(context);
      const restored = await library.restoreSnapshot(snapshot.id || snapshot.snapshotId);
      await refreshLocals();
      // Restoring is copy-only in the library. Re-check navigation safety in case
      // the original editor received input while the restore transaction awaited.
      if (canLeave()) await activate(restored, true);
      setNotice('已将快照恢复为新的本地知识树，原树没有被覆盖，也不会自动推送。');
    });

    return h('section', { className: 'ktw', 'aria-label': '知识树工作区' },
      h('style', null, css + menuCss),
      h('header', null, h('strong', null, '知识树工作区'), h('span', { className: 'kw-muted' }, '本地优先 · 只有点击推送才上传'),
        h('button', { type: 'button', disabled: busy, onClick: () => setConfigOpen(true) }, 'SSH 配置'),
        h('span', { className: 'kw-muted' }, status && status.configured ? `${remoteText(status.config)} · ${status.config.branch}${status.gitAvailable === false ? ' · 未找到 git' : ''}` : '未配置 SSH 远端')),
      error && h('div', { role: 'alert', className: 'kw-notice kw-error' }, error),
      notice && h('div', { role: 'status', className: 'kw-notice' }, notice),
      h('div', { className: 'kw-body', 'aria-busy': busy || !ready },
        h('nav', { 'aria-label': '知识树导航' },
          h('h2', null, '本地知识树'), h('button', { type: 'button', disabled: busy || !ready, onClick: newTree }, '新建本地树'),
          !ready && h('p', null, '正在打开本地资料库…'),
          h('ul', null, locals.map((record) => h('li', { key: record.id },
            h('button', { type: 'button', className: 'kw-tree', 'aria-current': selected === record.id, disabled: busy,
              title: '单击查看 · 双击重命名 · 右键更多操作', 'aria-haspopup': 'menu', 'aria-expanded': treeMenu?.id === record.id,
              onClick: () => { closeTreeMenu(); if (!busyRef.current && selectedRef.current !== record.id) return activate(record).catch(showError); },
              onDoubleClick: () => { closeTreeMenu(); if (!busyRef.current) openNameDialog(record); },
              onContextMenu: (event) => openTreeMenu(event, record),
              onKeyDown: (event) => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) openTreeMenu(event, record, true); else if (event.key === 'F2') { event.preventDefault(); if (!busyRef.current) openNameDialog(record); } },
            }, title(record)),
            deleteId === record.id && h('div', { className: 'kw-inline' }, h('p', null, '仅删除本地树，确定吗？'), h('button', { type: 'button', disabled: busy, onClick: () => deleteTree(record.id) }, '确认删除'), ' ', h('button', { type: 'button', disabled: busy, onClick: () => setDeleteId(null) }, '取消'))))),
          h('h2', null, 'SSH 远端'),
          h('button', { type: 'button', disabled: busy || !status?.configured, onClick: refreshRemote }, '手动刷新远端目录'),
          h('p', { className: 'kw-muted' }, '点击只读浏览，不会导入或覆盖本地。'),
          h('ul', null, remoteItems.filter((item) => item.treeId).map((item) => h('li', { key: item.treeId }, h('button', { type: 'button', className: 'kw-tree', disabled: busy, 'aria-current': remote?.treeId === item.treeId, onClick: () => openRemote(item.treeId) }, `${item.title || item.document?.title || item.treeId}${item.cached ? '（缓存）' : ''}`))))),
        h('main', null,
          h('div', { className: 'kw-toolbar' },
            h('span', { className: 'kw-muted' }, current ? current.error ? '保存失败 · 编辑仍保留' : current.pending ? '正在本地保存…' : stable(current.draft.document) !== stable(current.record.document) ? '本地编辑尚未保存' : '已保存在本地' : '请选择或新建本地知识树'),
            current && dirty && h('span', { className: 'kw-muted' }, dirty),
            current?.error && h('button', { type: 'button', disabled: busy || !!current.pending, onClick: () => run(async () => { await save(current, current.draft.document, current.draft.ui); setNotice('本地保存成功。'); }) }, '重试保存'),
            h('button', { type: 'button', disabled: busy || !current || !status?.configured || !!current.error || !!current.pending, onClick: () => setPushOpen(true) }, '推送当前本地树…'),
            h('button', { type: 'button', disabled: busy || !remote || !!current?.error || !!current?.pending, onClick: pull }, '拉取当前远端树'),
            h('button', { type: 'button', disabled: busy || !current, onClick: loadSnapshots }, '本地快照'),
            remote && h('button', { type: 'button', disabled: busy, onClick: () => { setRemote(null); setConflict(null); } }, '关闭远端对照')),
          conflict && h('div', { className: 'kw-notice' }, '冲突：未覆盖任何本地内容。', h('button', { type: 'button', disabled: busy, onClick: saveIndependent }, '将远端另存为独立本地树')),
          snapshots && h('div', { className: 'kw-snapshots' }, h('h3', null, '本地历史快照（恢复为新树，不覆盖原树）'), snapshots.length ? snapshots.map((snapshot) => h('div', { key: snapshot.id || snapshot.snapshotId }, h('span', null, `${new Date(snapshot.createdAt || snapshot.updatedAt || 0).toLocaleString()} ${snapshot.reason || ''} `), h('button', { type: 'button', disabled: busy, onClick: () => restore(snapshot) }, '恢复此快照'))) : h('p', null, '暂无快照'), h('button', { type: 'button', onClick: () => setSnapshots(null) }, '收起快照')),
          h('div', { className: 'kw-columns' },
            h('section', { className: 'kw-pane', 'aria-label': '本地可编辑版本' }, h('h3', null, '本地版本 · 可编辑（不会自动上传）'), current ? h('div', { key: selected, className: 'kw-editor', inert: busy && !pushing ? true : undefined, 'aria-disabled': busy && !pushing || undefined }, renderEditor(current.store)) : h('div', { className: 'kw-view' }, '从左侧新建或选择一棵知识树。')),
            remote && h('section', { className: 'kw-pane', 'aria-label': '远端只读版本' }, h('h3', null, `远端版本 · 只读${remote.offline ? ' · 离线缓存' : ''}`), h('p', { className: 'kw-notice kw-muted' }, `缓存时间：${new Date(remote.cachedAt || remote.fetchedAt || remote.updatedAt || 0).toLocaleString()}${remote.offline ? '（不是最新远端状态）' : '（手动读取）'}`), h(ReadOnlyTree, { key: `${remote.remoteKey}:${remote.hash}`, snapshot: remote }))))),
      treeMenu && h('div', { ref: menuRef, role: 'menu', 'aria-label': '本地知识树操作', className: 'kw-context-menu', style: { left: treeMenu.x, top: treeMenu.y }, onKeyDown: (event) => {
        const items = Array.from(event.currentTarget.querySelectorAll('button:not(:disabled)'));
        const active = items.indexOf(document.activeElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        } else if (event.key === 'Tab') closeTreeMenu();
      } },
        h('button', { type: 'button', role: 'menuitem', disabled: busy || !!current?.pending || !!current?.error, onClick: () => { const record = locals.find(item => item.id === treeMenu.id); closeTreeMenu(); if (record) openNameDialog(record); } }, '重命名'),
        h('button', { type: 'button', role: 'menuitem', className: 'kw-danger', disabled: busy, onClick: () => { setDeleteId(treeMenu.id); closeTreeMenu(true); } }, '删除')),
      nameDialog && h('div', { className: 'kw-dialog' }, h('form', { role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'kw-name-title', onSubmit: submitTreeName },
        h('h2', { id: 'kw-name-title' }, nameDialog.id === null ? '新建本地树' : '重命名本地树'),
        h('label', null, '知识树名称', h('input', { value: treeName, autoFocus: true, required: true, maxLength: 60, disabled: busy, 'aria-label': '知识树名称', onFocus: (event) => event.target.select(), onChange: (event) => { setTreeName(event.target.value); setNameError(''); }, onKeyDown: (event) => { if (event.key === 'Escape' && !busy) setNameDialog(null); if (event.key === 'Enter' && (event.nativeEvent?.isComposing || event.isComposing || event.keyCode === 229)) event.preventDefault(); } })),
        h('p', { className: 'kw-muted' }, '1–60 个字符。名称不影响树 ID、卡片或同步关联；不会自动上传。'),
        nameError && h('p', { role: 'alert', className: 'kw-error' }, nameError),
        h('div', { className: 'kw-actions' }, h('button', { type: 'submit', disabled: busy }, nameDialog.id === null ? '创建' : '保存名称'), h('button', { type: 'button', disabled: busy, onClick: () => setNameDialog(null) }, '取消')))),
      configOpen && h('div', { className: 'kw-dialog' }, h('form', { role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'kw-config-title', onSubmit: configure },
        h('h2', { id: 'kw-config-title' }, 'SSH 仓库配置'),
        h('p', null, '通过本机 git 以 SSH 推送（不保存任何令牌）。只连接你有权使用的仓库；配置后不会自动上传。公开仓库中的卡片正文和图片对所有人可见，请勿上传隐私内容。'),
        [['remote', 'SSH 远端地址（git@github.com:owner/repo.git）'], ['branch', '分支'], ['directory', '目录']].map(([key, label]) => h('label', { key }, label, h('input', { value: form[key], required: true, disabled: busy, onChange: (event) => setForm((value) => ({ ...value, [key]: event.target.value })) }))),
        h('details', null, h('summary', null, 'SSH 前置条件'), h('p', null, '需要在 Host 所在机器上：1) 已安装 git；2) 已生成并添加 SSH 公钥到 GitHub；3) ssh -T git@github.com 能正常通过（使用 ssh-agent 或 ~/.ssh/config）。插件不读取、不保存私钥，凭证完全交给系统 SSH。首次连接 GitHub 时请先在终端完成 known_hosts 指纹确认。')),
        h('div', { className: 'kw-actions' }, h('button', { type: 'submit', disabled: busy }, '保存配置'), h('button', { type: 'button', disabled: busy || !status?.configured, onClick: checkConnection }, '测试连接'), h('button', { type: 'button', disabled: busy, onClick: () => setConfigOpen(false) }, '取消')))),
      pushOpen && current && h('div', { className: 'kw-dialog' }, h('form', { role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'kw-push-title', onSubmit: (event) => { event.preventDefault(); push(); } },
        h('h2', { id: 'kw-push-title' }, '确认推送当前本地树'), h('p', null, `仅推送「${title({ document: current.draft.document })}」，不会上传其他本地树。`),
        h('p', null, counts(current.draft.document)), h('p', { className: 'kw-muted' }, '预览包含正文、关系和图片。点击推送时捕获已保存版本；推送期间仍可编辑，新编辑不会被覆盖。公开仓库内容对所有人可见。'),
        h('label', null, '提交说明', h('textarea', { value: message, required: true, disabled: busy, onChange: (event) => setMessage(event.target.value) })),
        h('div', { className: 'kw-actions' }, h('button', { type: 'submit', disabled: busy || !!current.pending || !!current.error }, busy ? '正在推送…' : '确认通过 SSH 推送'), h('button', { type: 'button', disabled: busy, onClick: () => setPushOpen(false) }, '取消')))));
  }
  return { Workspace };
}
