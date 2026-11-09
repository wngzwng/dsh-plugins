/**
 * Composer quick picker — generated/embedded fragment (owner: quick-ui).
 *
 * The entry button lives in the `conversation.input.right` slot; the picker
 * itself is a shared `Modal` (portalled to `document.body` by `Portal`, as the
 * conversation package requires for composer overlays). Copy and insert are
 * the only actions that count as "used"; inserting goes exclusively through
 * the shared `doInsert(inputActions, text)` helper (captureInsertion +
 * insertText, revision checked) and never replaces the whole draft or sends.
 *
 * Rules for this file (see DESIGN.md §1): plain script in the client factory
 * scope, no import/export statements, only functions and consts, all copy in
 * QUICK_PICKER_DICT under `quick.` keys (zh/en parity enforced by tests),
 * styling only via `--dsw-alias-*` tokens defined in QUICK_PICKER_CSS.
 */

const QUICK_PICKER_CSS = [
  '.plq-entry-wrap{display:inline-flex;align-items:center;min-width:0}',
  '.plq-entry{display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;line-height:1;cursor:pointer;white-space:nowrap}',
  '.plq-entry:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent);color:var(--dsw-alias-label-primary)}',
  '.plq-entry:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
  '.plq-entry-label{color:var(--dsw-alias-label-primary)}',
  '.pl-dialog:has(.plq-shell){width:min(720px,100%)}',
  '.plq-shell{display:flex;flex-direction:column;gap:10px;min-height:0;width:100%;max-width:720px;margin:0 auto}',
  '.plq-toolbar{display:flex;align-items:center;gap:10px}',
  '.plq-search{flex:1;min-width:0;min-height:32px}',
  '.plq-count{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}',
  '.plq-strip{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:7px 10px;border:.5px solid transparent;border-radius:9px;font-size:12.5px;line-height:1.5}',
  '.plq-strip-info{border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}',
  '.plq-strip-success{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 10%,transparent);color:var(--dsw-alias-state-success-primary,#2f9e44)}',
  '.plq-strip-error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#b3261e) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#b3261e) 10%,transparent);color:var(--dsw-alias-state-error-primary,#b3261e)}',
  '.plq-strip-text{flex:1;min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}',
  '.plq-rate-copy{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;min-width:0}',
  '.plq-rate-title{font-weight:600;color:var(--dsw-alias-label-primary)}',
  '.plq-rate-hint{color:var(--dsw-alias-label-secondary)}',
  '.plq-rate-later{flex:none;margin-left:auto}',
  '.plq-body{display:grid;grid-template-columns:minmax(220px,1fr) minmax(0,1.35fr);gap:12px;min-height:0;align-items:stretch}',
  '.plq-list-col{display:flex;flex-direction:column;min-width:0;min-height:0}',
  '.plq-list{display:flex;flex-direction:column;gap:2px;overflow:auto;overscroll-behavior:contain;max-height:min(52vh,420px);padding-right:2px}',
  '.plq-section{margin:0 0 6px}',
  '.plq-section-head{display:flex;align-items:center;gap:6px;margin:0;padding:6px 8px 4px;font-size:11.5px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary)}',
  '.plq-section-count{font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
  '.plq-row{display:flex;flex-direction:column;align-items:stretch;gap:4px;width:100%;min-height:44px;padding:7px 9px;border:.5px solid transparent;border-radius:9px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}',
  '.plq-row:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 9%,transparent)}',
  '.plq-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
  '.plq-row-selected{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent)}',
  '.plq-row-title{display:block;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.plq-row-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;min-width:0}',
  '.plq-mark{font-size:11.5px;line-height:1;color:var(--dsw-alias-label-secondary)}',
  '.plq-preview-col{display:flex;flex-direction:column;min-width:0;min-height:0;border-left:.5px solid var(--dsw-alias-border-l1);padding-left:12px}',
  '.plq-preview{display:flex;flex-direction:column;gap:8px;min-height:0;flex:1}',
  '.plq-preview-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}',
  '.plq-preview-viewrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
  '.plq-preview-body-md{white-space:normal;font-family:inherit}',
  '.plq-preview-title{margin:0;font-size:14px;font-weight:600;overflow-wrap:anywhere}',
  '.plq-preview-usage{margin:0;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;white-space:pre-wrap}',
  '.plq-preview-body{margin:0;padding:10px 12px;max-height:40vh;overflow:auto;overscroll-behavior:contain;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12.8px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}',
  '.plq-preview-actions{display:flex;flex-wrap:wrap;gap:8px}',
  '.plq-action{flex:none}',
  '.plq-hint{margin:0;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}',
  '.plq-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:32px 20px;text-align:center;color:var(--dsw-alias-label-secondary)}',
  '.plq-empty-title{margin:0;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}',
  '.plq-empty-body{margin:0;max-width:46ch;font-size:12.8px;line-height:1.7}',
  '@media (max-width: 640px){',
  '.pl-dialog:has(.plq-shell){width:100%;border-radius:12px}',
  '.plq-shell{max-width:none}',
  '.plq-body{grid-template-columns:minmax(0,1fr);gap:10px}',
  '.plq-list{max-height:40vh}',
  '.plq-preview-col{border-left:0;border-top:.5px solid var(--dsw-alias-border-l1);padding-left:0;padding-top:10px}',
  '.plq-preview-body{max-height:32vh}',
  '}',
].join('');

const QUICK_PICKER_DICT = {
  zh: {
    'quick.entry': '提示库',
    'quick.entryTitle': '打开提示库快捷选择',
    'quick.title': '提示库 · 快捷选择',
    'quick.search': '搜索提示词',
    'quick.searchPlaceholder': '搜索标题、正文或标签',
    'quick.resultCount': '{n} 条',
    'quick.listLabel': '提示词列表',
    'quick.sectionPinned': '置顶',
    'quick.sectionFavorite': '收藏',
    'quick.sectionRecent': '最近使用',
    'quick.sectionAll': '全部提示词',
    'quick.sectionResults': '匹配结果',
    'quick.selectPrompt': '选择提示词：{title}',
    'quick.pinned': '已置顶',
    'quick.favorite': '已收藏',
    'quick.noSelection': '选择一条提示词查看正文',
    'quick.noSelectionBody': '用搜索或列表选择一条提示词，预览后再复制或插入。',
    'quick.previewLabel': '正文预览',
    'quick.usageLine': '使用场景：{usage}',
    'quick.openLibrary': '在提示库中打开',
    'quick.openPanelHint': '无法直接打开管理面板，请从左侧栏打开提示库。',
    'quick.clearSearch': '清除搜索',
    'quick.emptyTitle': '还没有提示词',
    'quick.emptyBody': '先在提示库中新建提示词，之后就能在这里快速取用。',
    'quick.noResultTitle': '没有匹配结果',
    'quick.noResultBody': '换个关键词试试，或清除搜索查看快速访问。',
    'quick.rateTitle': '用后评分',
    'quick.rateHint': '刚才这条提示词效果如何？',
    'quick.rateLater': '稍后',
    'quick.ratingLabel': '用后评分',
    'quick.insertDisabled': '当前 DSH 版本未提供安全插入接口，插入已禁用，请改用复制。',
    'quick.storageWarning': '本地存储不可用，本次改动可能无法保存。',
  },
  en: {
    'quick.entry': 'Prompts',
    'quick.entryTitle': 'Open the Prompt Library quick picker',
    'quick.title': 'Prompt Library · Quick picker',
    'quick.search': 'Search prompts',
    'quick.searchPlaceholder': 'Search titles, text or tags',
    'quick.resultCount': '{n}',
    'quick.listLabel': 'Prompt list',
    'quick.sectionPinned': 'Pinned',
    'quick.sectionFavorite': 'Favorites',
    'quick.sectionRecent': 'Recently used',
    'quick.sectionAll': 'All prompts',
    'quick.sectionResults': 'Results',
    'quick.selectPrompt': 'Select prompt: {title}',
    'quick.pinned': 'Pinned',
    'quick.favorite': 'Favorite',
    'quick.noSelection': 'Select a prompt to preview its text',
    'quick.noSelectionBody': 'Search or pick a prompt from the list, then copy or insert it.',
    'quick.previewLabel': 'Prompt text preview',
    'quick.usageLine': 'When to use: {usage}',
    'quick.openLibrary': 'Open in Prompt Library',
    'quick.openPanelHint': 'The management panel could not be opened here — open the Prompt Library from the sidebar.',
    'quick.clearSearch': 'Clear search',
    'quick.emptyTitle': 'No prompts yet',
    'quick.emptyBody': 'Create prompts in the Prompt Library first; they will show up here for quick reuse.',
    'quick.noResultTitle': 'No matching prompts',
    'quick.noResultBody': 'Try another keyword, or clear the search to browse quick access.',
    'quick.rateTitle': 'Rate after use',
    'quick.rateHint': 'How well did this prompt work?',
    'quick.rateLater': 'Later',
    'quick.ratingLabel': 'Rate after use',
    'quick.insertDisabled': 'This DSH version exposes no safe insertion API, so inserting is disabled — use Copy instead.',
    'quick.storageWarning': 'Local storage is unavailable; changes in this session may not be saved.',
  },
};

/* ------------------------------------------------------------------ */
/* Pure view-model helpers (QP prefix keeps names unique in the bundle) */
/* ------------------------------------------------------------------ */

/** Sections shown while the search box is empty: pinned, favorites, recent. */
function QPQuickSections(data) {
  const prompts = Array.isArray(data.prompts) ? data.prompts : [];
  const pinned = sortPrompts(
    prompts.filter((prompt) => prompt.pinned === true),
    'default',
  );
  const shown = new Set(pinned.map((prompt) => prompt.id));
  const favorites = sortPrompts(
    prompts.filter((prompt) => prompt.favorite === true && !shown.has(prompt.id)),
    'default',
  );
  for (const prompt of favorites) shown.add(prompt.id);
  const recent = sortPrompts(
    prompts.filter(
      (prompt) =>
        prompt.lastUsedAt !== null && prompt.lastUsedAt !== undefined && !shown.has(prompt.id),
    ),
    'recent',
  ).slice(0, 20);
  const sections = [
    { key: 'pinned', titleKey: 'quick.sectionPinned', items: pinned },
    { key: 'favorites', titleKey: 'quick.sectionFavorite', items: favorites },
    { key: 'recent', titleKey: 'quick.sectionRecent', items: recent },
  ].filter((section) => section.items.length > 0);
  if (sections.length === 0 && prompts.length > 0) {
    return [{ key: 'all', titleKey: 'quick.sectionAll', items: sortPrompts(prompts, 'default') }];
  }
  return sections;
}

/** Search results use the default core ordering (pinned keeps priority). */
function QPSearchResults(data, query) {
  return selectPrompts(
    data,
    { view: 'all', tagId: null, quality: 'any', search: query },
    'default',
  );
}

/* ------------------------------------------------------------------ */
/* Presentational helpers                                              */
/* ------------------------------------------------------------------ */

function QPSectionHead(props) {
  return h(
    'h3',
    { className: 'plq-section-head' },
    h('span', { className: 'plq-section-name' }, props.label),
    h('span', { className: 'plq-section-count' }, String(props.count)),
  );
}

function QPEmptyState(props) {
  return h(
    'div',
    { className: 'plq-empty' },
    h('p', { className: 'plq-empty-title' }, props.title),
    props.body ? h('p', { className: 'plq-empty-body' }, props.body) : null,
    props.action || null,
  );
}

function QPRow(props) {
  const prompt = props.prompt;
  return h(
    'button',
    {
      type: 'button',
      className: 'plq-row' + (props.selected ? ' plq-row-selected' : ''),
      'data-prompt-id': prompt.id,
      'aria-current': props.selected ? 'true' : undefined,
      'aria-label': props.t('quick.selectPrompt', { title: prompt.title }),
      onClick: () => props.onSelect(prompt.id),
    },
    h('span', { className: 'plq-row-title' }, prompt.title),
    h(
      'span',
      { className: 'plq-row-meta' },
      prompt.pinned
        ? h(
            'span',
            { className: 'plq-mark', role: 'img', 'aria-label': props.t('quick.pinned') },
            '📌',
          )
        : null,
      prompt.favorite
        ? h(
            'span',
            { className: 'plq-mark', role: 'img', 'aria-label': props.t('quick.favorite') },
            '★',
          )
        : null,
      h(ScoreBadge, { prompt, t: props.t }),
    ),
    h(TagChips, { tags: props.tags, limit: 3 }),
  );
}

function QPNoticeStrip(props) {
  const notice = props.notice;
  if (!notice) return null;
  const kind = notice.kind === 'error' ? 'error' : notice.kind === 'success' ? 'success' : 'info';
  const text = notice.error
    ? describeError(props.t, notice.error)
    : props.t(notice.key, notice.params);
  return h(
    'div',
    {
      className: 'plq-strip plq-strip-' + kind,
      role: kind === 'error' ? 'alert' : 'status',
    },
    h('span', { className: 'plq-strip-text' }, text),
  );
}

/** Non-blocking "rate after use" strip: never covers search or the list. */
function QPRatingStrip(props) {
  const prompt = props.prompt;
  if (!prompt) return null;
  const valid = isScoreValid(prompt);
  const value = valid ? prompt.score.stars : null;
  return h(
    'div',
    { className: 'plq-strip plq-strip-rate', role: 'group', 'aria-label': props.t('quick.rateTitle') },
    h(
      'span',
      { className: 'plq-rate-copy' },
      h('span', { className: 'plq-rate-title' }, props.t('quick.rateTitle')),
      h(
        'span',
        { className: 'plq-rate-hint' },
        isScoreStale(prompt) ? props.t('common.ratingStale') : props.t('quick.rateHint'),
      ),
    ),
    h(StarRating, {
      value,
      onChange: (stars) => props.onRate(stars),
      onClear: () => props.onRate(null),
      label: props.t('quick.ratingLabel'),
      t: props.t,
    }),
    h(
      'button',
      {
        type: 'button',
        className: 'pl-link-btn plq-rate-later',
        onClick: () => props.onDismiss(),
      },
      props.t('quick.rateLater'),
    ),
  );
}

function QPPreview(props) {
  const { prompt, t, insertAvailable, bodyMode, onBodyMode } = props;
  if (!prompt) {
    return h(QPEmptyState, {
      title: t('quick.noSelection'),
      body: t('quick.noSelectionBody'),
    });
  }
  const copyClass = 'pl-btn plq-action' + (insertAvailable ? '' : ' pl-btn-primary');
  const insertClass = 'pl-btn plq-action' + (insertAvailable ? ' pl-btn-primary' : '');
  return h(
    'div',
    { className: 'plq-preview' },
    h(
      'div',
      { className: 'plq-preview-head' },
      h('h3', { className: 'plq-preview-title' }, prompt.title),
      h(ScoreBadge, { prompt, t }),
    ),
    prompt.usage ? h('p', { className: 'plq-preview-usage' }, t('quick.usageLine', { usage: prompt.usage })) : null,
    h(
      'div',
      { className: 'plq-preview-viewrow' },
      h(BodyViewToggle, {
        mode: bodyMode === 'markdown' ? 'markdown' : 'plain',
        onChange: onBodyMode,
        t,
      }),
      bodyMode === 'markdown'
        ? h('span', { className: 'plq-hint' }, t('common.markdownHint'))
        : null,
    ),
    bodyMode === 'markdown'
      ? h(MarkdownView, {
          text: prompt.body,
          className: 'plq-preview-body plq-preview-body-md',
        })
      : h(
          'pre',
          {
            className: 'plq-preview-body',
            tabIndex: 0,
            'aria-label': t('quick.previewLabel'),
          },
          prompt.body,
        ),
    h(TagChips, { tags: props.tags, limit: 6 }),
    h(
      'div',
      { className: 'plq-preview-actions' },
      h(
        'button',
        { type: 'button', className: copyClass, onClick: () => props.onCopy() },
        t('common.copy'),
      ),
      h(
        'button',
        {
          type: 'button',
          className: insertClass,
          disabled: !insertAvailable,
          'aria-describedby': insertAvailable ? undefined : 'plq-insert-note',
          title: insertAvailable ? undefined : t('quick.insertDisabled'),
          onClick: () => props.onInsert(),
        },
        t('common.insert'),
      ),
      h(
        'button',
        { type: 'button', className: 'pl-btn pl-btn-ghost plq-action', onClick: () => props.onOpenLibrary() },
        t('quick.openLibrary'),
      ),
    ),
    !insertAvailable
      ? h('p', { id: 'plq-insert-note', className: 'plq-hint' }, t('quick.insertDisabled'))
      : null,
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

function PromptLibraryQuickEntry(props) {
  const slotProps = (props && props.slotProps) || {};
  const store = props.store;
  const locale = props.locale;
  const t = useT(locale);
  const snap = useStore(store);
  const data = snap && snap.data ? snap.data : { version: 1, tags: [], prompts: [] };

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const [ratedId, setRatedId] = React.useState(null);
  const [bodyMode, setBodyMode] = useBodyRenderMode(store);

  const entryRef = React.useRef(null);
  const searchRef = React.useRef(null);
  const narrow = useNarrow(entryRef, 640);

  const sessionId = slotProps.sessionId;
  const sessionRef = React.useRef(sessionId);
  sessionRef.current = sessionId;

  const insertAvailable = hasInsertApi(slotProps.inputActions);

  /* Switching conversations must never keep a stale overlay or selection. */
  React.useEffect(() => {
    setOpen(false);
    setSearch('');
    setSelectedId(null);
    setNotice(null);
    setRatedId(null);
  }, [sessionId]);

  /* Success feedback is a short strip; clear its timer on unmount/change. */
  React.useEffect(() => {
    if (!notice || notice.kind !== 'success') return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    if (timer && typeof timer.unref === 'function') timer.unref();
    return () => clearTimeout(timer);
  }, [notice]);

  function resetPanelState() {
    setSearch('');
    setSelectedId(null);
    setNotice(null);
    setRatedId(null);
  }

  function closePanel() {
    setOpen(false);
    resetPanelState();
  }

  function openPanel() {
    resetPanelState();
    setOpen(true);
  }

  function togglePanel() {
    if (open) closePanel();
    else openPanel();
  }

  const query = search.trim();
  const sections = query === '' ? QPQuickSections(data) : [];
  const results = query === '' ? [] : QPSearchResults(data, query);
  const activeSections =
    query === ''
      ? sections
      : results.length > 0
        ? [{ key: 'results', titleKey: 'quick.sectionResults', items: results }]
        : [];
  const visible = activeSections.reduce((acc, section) => acc.concat(section.items), []);
  const total = visible.length;
  const selected = selectedId
    ? data.prompts.find((prompt) => prompt.id === selectedId) || null
    : null;
  const ratedPrompt = ratedId
    ? data.prompts.find((prompt) => prompt.id === ratedId) || null
    : null;
  const isSearching = query !== '';

  function onSearchChange(event) {
    const value = event && event.target ? event.target.value : '';
    setSearch(value);
    setSelectedId(null);
  }

  function onSelect(promptId) {
    setSelectedId(promptId);
  }

  function onListKeyDown(event) {
    if (!event || !event.key) return;
    const key = event.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
    if (visible.length === 0) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    const currentIndex = visible.findIndex((prompt) => prompt.id === selectedId);
    let nextIndex;
    if (key === 'Home') nextIndex = 0;
    else if (key === 'End') nextIndex = visible.length - 1;
    else if (key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : Math.min(visible.length - 1, currentIndex + 1);
    else nextIndex = currentIndex < 0 ? visible.length - 1 : Math.max(0, currentIndex - 1);
    setSelectedId(visible[nextIndex].id);
  }

  function showNotice(kind, key, params) {
    setNotice({ kind, key, params: params || {} });
  }

  async function handleCopy(prompt) {
    if (!prompt) return;
    const session = sessionRef.current;
    const ok = await copyText(prompt.body);
    /* Async results are only applied while the composer still shows the same session. */
    if (sessionRef.current !== session) return;
    if (!ok) {
      showNotice('error', 'common.copyFailed');
      return;
    }
    store.markUsed(prompt.id);
    setRatedId(prompt.id);
    showNotice('success', 'common.copyOk');
  }

  function handleInsert(prompt) {
    if (!prompt) return;
    const session = sessionRef.current;
    if (!insertAvailable) {
      showNotice('info', 'common.insertNoApi');
      return;
    }
    const result = doInsert(slotProps.inputActions, prompt.body);
    if (sessionRef.current !== session) return;
    if (result && result.ok === true) {
      store.markUsed(prompt.id);
      setRatedId(prompt.id);
      showNotice('success', 'common.insertOk');
      return;
    }
    if (result && result.code === 'NO_API') {
      showNotice('info', 'common.insertNoApi');
      return;
    }
    showNotice('error', 'common.insertRejected');
  }

  function handleRate(prompt, stars) {
    if (!prompt) return;
    const result = store.setRating(prompt.id, stars);
    if (result && result.ok === false) setNotice({ kind: 'error', error: result.error });
  }

  function handleOpenLibrary() {
    if (openLibraryPanel(props.layout)) {
      closePanel();
      return;
    }
    showNotice('info', 'quick.openPanelHint');
  }

  /* -------------------------- entry button -------------------------- */

  const entry = h(
    'span',
    { ref: entryRef, className: 'plq-entry-wrap' },
    h(
      'button',
      {
        type: 'button',
        className: 'plq-entry',
        'aria-label': t('quick.entry'),
        title: t('quick.entryTitle'),
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        onClick: togglePanel,
      },
      h(LibraryIcon, { size: 16 }),
      narrow ? null : h('span', { className: 'plq-entry-label' }, t('quick.entry')),
    ),
  );

  /* ----------------------------- panel ------------------------------ */

  let body;
  if (data.prompts.length === 0) {
    body = h(QPEmptyState, {
      title: t('quick.emptyTitle'),
      body: t('quick.emptyBody'),
      action: h(
        'button',
        { type: 'button', className: 'pl-btn pl-btn-primary', onClick: handleOpenLibrary },
        t('quick.openLibrary'),
      ),
    });
  } else if (isSearching && total === 0) {
    body = h(QPEmptyState, {
      title: t('quick.noResultTitle'),
      body: t('quick.noResultBody'),
      action: h(
        'button',
        {
          type: 'button',
          className: 'pl-btn',
          onClick: () => {
            setSearch('');
            setSelectedId(null);
          },
        },
        t('quick.clearSearch'),
      ),
    });
  } else {
    body = h(
      'div',
      { className: 'plq-body' },
      h(
        'div',
        { className: 'plq-list-col' },
        h(
          'div',
          {
            className: 'plq-list',
            'data-quick-list': 'true',
            'aria-label': t('quick.listLabel'),
            onKeyDown: onListKeyDown,
          },
          activeSections.map((section) =>
            h(
              'div',
              {
                key: section.key,
                className: 'plq-section',
                role: 'group',
                'aria-label': t(section.titleKey),
              },
              h(QPSectionHead, { label: t(section.titleKey), count: section.items.length }),
              section.items.map((prompt) =>
                h(QPRow, {
                  key: prompt.id,
                  prompt,
                  selected: prompt.id === selectedId,
                  t,
                  tags: tagsForPrompt(data, prompt),
                  onSelect,
                }),
              ),
            ),
          ),
        ),
      ),
      h(
        'div',
        { className: 'plq-preview-col' },
        h(QPPreview, {
          prompt: selected,
          t,
          tags: selected ? tagsForPrompt(data, selected) : [],
          insertAvailable,
          bodyMode,
          onBodyMode: setBodyMode,
          onCopy: () => handleCopy(selected),
          onInsert: () => handleInsert(selected),
          onOpenLibrary: handleOpenLibrary,
        }),
      ),
    );
  }

  const panel = open
    ? h(
        Modal,
        {
          title: t('quick.title'),
          onClose: closePanel,
          wide: true,
          initialFocusRef: searchRef,
          closeLabel: t('common.close'),
        },
        h(
          'div',
          { className: 'plq-shell' },
          h(
            'div',
            { className: 'plq-toolbar' },
            h('input', {
              ref: searchRef,
              type: 'search',
              className: 'pl-input plq-search',
              value: search,
              placeholder: t('quick.searchPlaceholder'),
              'aria-label': t('quick.search'),
              onChange: onSearchChange,
            }),
            total > 0 ? h('span', { className: 'plq-count', role: 'status' }, t('quick.resultCount', { n: total })) : null,
          ),
          snap && snap.status !== 'ready'
            ? h('p', { className: 'plq-hint' }, t('quick.storageWarning'))
            : null,
          h(QPNoticeStrip, { notice, t }),
          ratedPrompt
            ? h(QPRatingStrip, {
                prompt: ratedPrompt,
                t,
                onRate: (stars) => handleRate(ratedPrompt, stars),
                onDismiss: () => setRatedId(null),
              })
            : null,
          body,
        ),
      )
    : null;

  return h(React.Fragment, null, entry, panel);
}
