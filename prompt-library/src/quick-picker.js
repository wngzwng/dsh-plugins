/**
 * Composer quick picker + quick-capture entries — generated/embedded fragment
 * (owner: quick-ui).
 *
 * The entry button lives in the `conversation.input.right` slot; the picker
 * itself is a shared `Modal` (portalled to `document.body` by `Portal`, as the
 * conversation package requires for composer overlays). Copy and insert are
 * the only actions that count as "used"; inserting goes exclusively through
 * the shared `doInsert(inputActions, text)` helper (captureInsertion +
 * insertText, revision checked) and never replaces the whole draft or sends.
 *
 * Quick capture (DESIGN.md §9.3) adds three entry points that only ever publish
 * a synchronous snapshot to the Lead-owned capture hub (`capture.open`):
 * `PromptLibrarySaveDraftEntry` (composer toolbar, whole draft),
 * `PromptLibraryMessageCaptureAction` (chat selection overlay) and the quick
 * picker toolbar entries (empty paste capture / whole draft). They never write
 * the draft, submit, read the clipboard or touch host DOM; the capture dialog
 * owns editing, saving, duplicate checks and the "whole draft" degradation copy.
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
  '.plq-tip-wrap{display:inline-flex;align-items:center;min-width:0}',
  '.plq-tip{position:fixed;z-index:10001;max-width:280px;padding:6px 9px;border-radius:8px;background:var(--dsw-alias-toast-bg,color-mix(in srgb,var(--dsw-alias-label-primary) 92%,transparent));color:var(--dsw-alias-toast-label,var(--dsw-alias-bg-base));font-size:12px;line-height:1.45;text-align:left;overflow-wrap:anywhere;box-shadow:0 6px 20px rgba(0,0,0,.2);pointer-events:none}',
  '.plq-draft-entry{justify-content:center;width:30px;min-height:30px;padding:0}',
  '.plq-draft-entry:disabled{opacity:.4;cursor:not-allowed}',
  '.plq-draft-entry[disabled]{opacity:.55;cursor:not-allowed}',
  '.plq-draft-entry[disabled]:hover{background:transparent;color:var(--dsw-alias-label-secondary)}',
  '.plq-msg-capture{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:1;cursor:pointer;white-space:nowrap}',
  '.plq-msg-capture:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
  '.plq-msg-capture:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
  '.plq-msg-capture[disabled]{opacity:.55;cursor:not-allowed}',
  '.pl-dialog:has(.plq-shell){width:min(720px,100%)}',
  '.plq-shell{display:flex;flex-direction:column;gap:10px;min-height:0;width:100%;max-width:720px;margin:0 auto}',
  '.plq-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px}',
  '.plq-search{flex:1;min-width:0;min-height:32px}',
  '.plq-count{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}',
  '.plq-capture-actions{display:flex;align-items:center;gap:6px;margin-left:auto}',
  '.plq-capture-btn{flex:none;display:inline-flex;align-items:center;gap:4px;min-height:30px;padding:0 8px;font-size:12.5px}',
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
  '.plq-tabs{display:flex;gap:2px;margin:0 0 6px;padding:2px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);overflow:auto}',
  '.plq-tab{display:inline-flex;flex:1;align-items:center;justify-content:center;gap:4px;min-height:26px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;white-space:nowrap;cursor:pointer}',
  '.plq-tab:hover{color:var(--dsw-alias-label-primary)}',
  '.plq-tab-on,.plq-tab-on:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary);font-weight:500}',
  '.plq-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
  '.plq-tab-count{min-width:13px;text-align:center;font-size:10.5px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}',
  '.plq-tab-on .plq-tab-count{color:var(--dsw-alias-brand-primary)}',
  '.plq-tab-empty{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:18px 12px;color:var(--dsw-alias-label-secondary)}',
  '.plq-tab-empty-title{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
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
  '.plq-toolbar{flex-wrap:wrap}',
  '.plq-capture-actions{margin-left:0;width:100%;justify-content:flex-end}',
  '.plq-body{grid-template-columns:minmax(0,1fr);gap:10px}',
  '.plq-list{max-height:40vh}',
  '.plq-preview-col{border-left:0;border-top:.5px solid var(--dsw-alias-border-l1);padding-left:0;padding-top:10px}',
  '.plq-preview-body{max-height:32vh}',
  '}',
].join('');

const QUICK_PICKER_DICT = {
  zh: {
    'quick.entry': '提示库',
    'quick.entryTitle': '提示库快捷选择：搜索、收藏、置顶与最近使用的提示词，可预览、复制或插入当前输入框',
    'quick.title': '提示库 · 快捷选择',
    'quick.search': '搜索提示词',
    'quick.searchPlaceholder': '搜索标题、正文或标签',
    'quick.resultCount': '{n} 条',
    'quick.listLabel': '提示词列表',
    'quick.sectionPinned': '置顶',
    'quick.sectionFavorite': '收藏',
    'quick.sectionRecent': '最近使用',
    'quick.sectionAll': '全部提示词',
    'quick.tabsLabel': '提示词分类',
    'quick.tabAll': '全部',
    'quick.tabPinned': '置顶',
    'quick.tabFavorite': '收藏',
    'quick.tabRecent': '最近使用',
    'quick.tabCountAria': '{label}，{n} 条',
    'quick.tabEmpty': '这个分类还没有提示词',
    'quick.tabEmptyBody': '切换到「全部」查看所有提示词。',
    'quick.viewAll': '查看全部',
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
    'quick.saveDraft': '存草稿',
    'quick.saveDraftLabel': '保存为提示词',
    'quick.saveDraftTitle': '把输入框中的整份草稿收录为提示词',
    'quick.saveDraftEmpty': '输入框为空，暂无可保存的草稿',
    'quick.saveDraftPanel': '保存草稿为提示词',
    'quick.captureQuick': '快速收录',
    'quick.captureQuickTitle': '打开快速收录，手动粘贴文本',
    'quick.captureBusy': '收录弹层已打开，请先完成或关闭当前收录。',
    'quick.captureUnavailable': '当前环境未提供快速收录功能。',
    'quick.captureMessage': '收录为提示词',
    'quick.captureMessageTitle': '把选中的对话文本收录为提示词',
  },
  en: {
    'quick.entry': 'Prompts',
    'quick.entryTitle': 'Prompt Library quick picker: search favorites, pins and recent prompts, then preview, copy or insert into the draft',
    'quick.title': 'Prompt Library · Quick picker',
    'quick.search': 'Search prompts',
    'quick.searchPlaceholder': 'Search titles, text or tags',
    'quick.resultCount': '{n}',
    'quick.listLabel': 'Prompt list',
    'quick.sectionPinned': 'Pinned',
    'quick.sectionFavorite': 'Favorites',
    'quick.sectionRecent': 'Recently used',
    'quick.sectionAll': 'All prompts',
    'quick.tabsLabel': 'Prompt categories',
    'quick.tabAll': 'All',
    'quick.tabPinned': 'Pinned',
    'quick.tabFavorite': 'Favorites',
    'quick.tabRecent': 'Recent',
    'quick.tabCountAria': '{label}, {n} prompts',
    'quick.tabEmpty': 'Nothing in this category yet',
    'quick.tabEmptyBody': 'Switch to "All" to browse every prompt.',
    'quick.viewAll': 'View all',
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
    'quick.saveDraft': 'Save draft',
    'quick.saveDraftLabel': 'Save as prompt',
    'quick.saveDraftTitle': 'Save the whole composer draft as a prompt',
    'quick.saveDraftEmpty': 'The composer is empty — nothing to save',
    'quick.saveDraftPanel': 'Save draft as prompt',
    'quick.captureQuick': 'Quick capture',
    'quick.captureQuickTitle': 'Open quick capture to paste text manually',
    'quick.captureBusy': 'A capture dialog is already open — finish or close it first.',
    'quick.captureUnavailable': 'Quick capture is not available in this environment.',
    'quick.captureMessage': 'Save as prompt',
    'quick.captureMessageTitle': 'Save the selected conversation text as a prompt',
  },
};

/* ------------------------------------------------------------------ */
/* Pure view-model helpers (QP prefix keeps names unique in the bundle) */
/* ------------------------------------------------------------------ */

/** Quick-picker categories, rendered as tabs above the list. */
const QP_TABS = [
  { id: 'all', labelKey: 'quick.tabAll' },
  { id: 'pinned', labelKey: 'quick.tabPinned' },
  { id: 'favorites', labelKey: 'quick.tabFavorite' },
  { id: 'recent', labelKey: 'quick.tabRecent' },
];

/** Prompts shown by one tab; pinned prompts stay first inside "All". */
function QPQuickItems(data, tab) {
  const prompts = Array.isArray(data.prompts) ? data.prompts : [];
  if (tab === 'pinned') {
    return sortPrompts(
      prompts.filter((prompt) => prompt.pinned === true),
      'default',
    );
  }
  if (tab === 'favorites') {
    return sortPrompts(
      prompts.filter((prompt) => prompt.favorite === true),
      'default',
    );
  }
  if (tab === 'recent') {
    return sortPrompts(
      prompts.filter(
        (prompt) => prompt.lastUsedAt !== null && prompt.lastUsedAt !== undefined,
      ),
      'recent',
    ).slice(0, 20);
  }
  return sortPrompts(prompts, 'default');
}

/** Per-tab counts (recent is capped at what the tab shows). */
function QPQuickTabCounts(data) {
  const prompts = Array.isArray(data.prompts) ? data.prompts : [];
  const recent = prompts.filter(
    (prompt) => prompt.lastUsedAt !== null && prompt.lastUsedAt !== undefined,
  ).length;
  return {
    all: prompts.length,
    pinned: prompts.filter((prompt) => prompt.pinned === true).length,
    favorites: prompts.filter((prompt) => prompt.favorite === true).length,
    recent: Math.min(recent, 20),
  };
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
/* Quick capture entries (DESIGN.md §9.3)                              */
/* ------------------------------------------------------------------ */

/** Inbox/tray icon used by the capture entries; color comes from currentColor. */
let QP_TIP_SEQUENCE = 0;

const QP_NOOP_SUBSCRIBE = () => () => {};
const QP_EMPTY_CAPTURE_SNAPSHOT = Object.freeze({ seq: 0, request: null });

/**
 * Immediate hover/focus description. Native `title` tooltips wait about a
 * second before showing, which felt slow in the composer toolbar; this renders
 * a themed tooltip at once (portalled to the body, because the composer is its
 * own containing block) and keeps keyboard focus users informed too.
 */
function QPHoverTip(props) {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState(null);
  const wrapRef = React.useRef(null);
  const tipRef = React.useRef(null);
  const idRef = React.useRef(null);
  const suppressRef = React.useRef(false);
  suppressRef.current = props.suppress === true;
  React.useEffect(() => {
    if (props.suppress === true) setOpen(false);
  }, [props.suppress]);
  if (idRef.current === null) {
    QP_TIP_SEQUENCE += 1;
    idRef.current = 'plq-tip-' + String(QP_TIP_SEQUENCE);
  }
  const label = typeof props.label === 'string' ? props.label : '';

  React.useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const anchor = wrapRef.current;
      const tip = tipRef.current;
      if (!anchor || !tip || typeof anchor.getBoundingClientRect !== 'function') return;
      const rect = anchor.getBoundingClientRect();
      const width = tip.offsetWidth || 200;
      const height = tip.offsetHeight || 32;
      const viewWidth = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 800;
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(8, Math.min(left, viewWidth - width - 8));
      let top = rect.top - height - 6;
      if (top < 8) top = rect.bottom + 6;
      setCoords({ left, top });
    };
    place();
    const win = typeof window !== 'undefined' ? window : null;
    const hide = () => setOpen(false);
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('resize', hide);
      win.addEventListener('scroll', hide, true);
    }
    return () => {
      if (win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('resize', hide);
        win.removeEventListener('scroll', hide, true);
      }
    };
  }, [open]);

  function show() {
    if (!label || suppressRef.current) return;
    setCoords(null);
    setOpen(true);
  }
  function hide() {
    setOpen(false);
  }

  return h(
    'span',
    {
      ref: wrapRef,
      className: 'plq-tip-wrap',
      'data-hover-tip': '',
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
      onClick: hide,
    },
    props.children,
    open && label
      ? h(
          Portal,
          null,
          h(
            'div',
            {
              ref: tipRef,
              id: idRef.current,
              role: 'tooltip',
              className: 'plq-tip',
              style:
                coords === null
                  ? { left: 0, top: 0, visibility: 'hidden' }
                  : { left: String(coords.left) + 'px', top: String(coords.top) + 'px' },
            },
            label,
          ),
        )
      : null,
  );
}

function QPCaptureIcon(props) {
  const size = (props && props.size) || 16;
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    /* A wide, rounded bookmark with a solid plus: conceptually a bookmark (the
     * user's preference), optically sized and weighted to sit next to the
     * library book icon without looking thinner or smaller. */
    h('path', {
      d: 'M5.3 6a1.8 1.8 0 0 1 1.8-1.8h9.8a1.8 1.8 0 0 1 1.8 1.8v14.4L12 16.6l-6.7 3.8V6Z',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinejoin: 'round',
      fill: 'none',
    }),
    h('path', {
      d: 'M11.15 8.5h1.7v1.65h1.65v1.7h-1.65v1.65h-1.7v-1.65H9.5v-1.7h1.65V8.5Z',
      fill: 'currentColor',
      opacity: 0.9,
    }),
  );
}

/**
 * Second composer entry (`conversation.input.right`, after the picker):
 * saves the WHOLE composer draft into the capture dialog.
 *
 * Rules (DESIGN.md §9.3/§9.4): the draft is only ever read here — never
 * written, submitted or replaced; there is no safe selection API for the
 * composer, so only the full draft is offered and the dialog explains the
 * degradation. `capture` is optional: without it the button stays disabled.
 */
function PromptLibrarySaveDraftEntry(props) {
  const source = props || {};
  const slotProps = source.slotProps || {};
  const t = useT(source.locale);
  const capture = source.capture || null;
  const captureReady = Boolean(capture && typeof capture.open === 'function');
  /* Subscribe to the capture hub so the entry tooltip can be suppressed while
   * its dialog is open and just after it closes: Modal restores focus to this
   * button, which would otherwise immediately re-open the hover description. */
  const captureStore =
    capture && typeof capture.subscribe === 'function' && typeof capture.getSnapshot === 'function'
      ? capture
      : null;
  const captureSnapshot = React.useSyncExternalStore(
    captureStore ? captureStore.subscribe : QP_NOOP_SUBSCRIBE,
    captureStore ? captureStore.getSnapshot : () => QP_EMPTY_CAPTURE_SNAPSHOT,
  );
  const captureOpen = Boolean(captureSnapshot && captureSnapshot.request);
  const [tipSuppressed, setTipSuppressed] = React.useState(false);
  const tipTimerRef = React.useRef(null);
  const captureWasOpenRef = React.useRef(false);
  /* Compute the open->closed transition during render: closing the dialog
   * restores focus in the same commit, so waiting for an effect would let the
   * tooltip flash open first. */
  const captureJustClosed = captureWasOpenRef.current && !captureOpen;
  if (captureOpen) captureWasOpenRef.current = true;
  else if (captureJustClosed) captureWasOpenRef.current = false;
  React.useEffect(() => {
    if (!captureJustClosed) return;
    setTipSuppressed(true);
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => {
      tipTimerRef.current = null;
      setTipSuppressed(false);
    }, 600);
    if (tipTimerRef.current && typeof tipTimerRef.current.unref === 'function') tipTimerRef.current.unref();
  }, [captureJustClosed]);
  React.useEffect(
    () => () => {
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    },
    [],
  );
  /* The slot passes a snapshot plus the `useInput` hook. Reading props.input
   * alone goes stale: the composer slot does not re-render this entry on every
   * keystroke, so the button used to think an already-filled draft was empty.
   * Subscribe through the standard hook when the host provides it. */
  const useInput = typeof slotProps.useInput === 'function' ? slotProps.useInput : null;
  const liveInput = useInput ? useInput((state) => state) : slotProps.input;
  const draft =
    liveInput && typeof liveInput.draft === 'string'
      ? liveInput.draft
      : slotProps.input && typeof slotProps.input.draft === 'string'
        ? slotProps.input.draft
        : '';
  const hasDraft = draft.trim() !== '';
  const disabled = !captureReady || !hasDraft;
  const title = !captureReady
    ? t('quick.captureUnavailable')
    : hasDraft
      ? t('quick.saveDraftTitle')
      : t('quick.saveDraftEmpty');

  function onClick() {
    if (!captureReady) return;
    /* Snapshot the whole draft and the session id at click time; never mutate.
     * `draft` comes from the subscribed input snapshot above. */
    if (draft.trim() === '') return;
    const sessionId = slotProps.sessionId;
    capture.open({ text: draft, source: { kind: 'composer', sessionId } });
  }

  return h(
    QPHoverTip,
    { label: title, suppress: captureOpen || captureJustClosed || tipSuppressed },
    h(
      'button',
      {
        type: 'button',
        className: 'plq-entry plq-draft-entry',
        'aria-label': t('quick.saveDraftLabel'),
        disabled,
        'data-capture-entry': 'composer',
        onClick,
      },
      h(QPCaptureIcon, { size: 17 }),
    ),
  );
}

/**
 * Selection action rendered by the `conversation.chat.text-interaction`
 * overlay: hands the selected message text to the capture dialog and closes
 * the overlay. Only `trigger === 'selection'` is ours; nothing here touches
 * the host DOM or writes to the conversation.
 */
function PromptLibraryMessageCaptureAction(props) {
  const source = props || {};
  const fallbackT = useT(source.locale);
  const t = typeof source.t === 'function' ? source.t : fallbackT;
  const capture = source.capture || null;
  const captureReady = Boolean(capture && typeof capture.open === 'function');
  const trigger = source.trigger;

  function dismiss() {
    if (typeof source.dismiss === 'function') source.dismiss();
  }

  function onPointerDown(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
  }

  function onClick() {
    if (trigger !== 'selection' || !captureReady) {
      dismiss();
      return;
    }
    let text = null;
    try {
      text = typeof source.readText === 'function' ? source.readText() : null;
    } catch {
      text = null;
    }
    if (typeof text !== 'string' || text.trim() === '') {
      dismiss();
      return;
    }
    const opened = { text, source: { kind: 'message', sessionId: source.sessionId } };
    try {
      capture.open(opened);
    } finally {
      dismiss();
    }
  }

  /* Other triggers (menu/link/...) are not ours: render nothing at all. */
  if (trigger !== undefined && trigger !== null && trigger !== 'selection') return null;

  const title = captureReady ? t('quick.captureMessageTitle') : t('quick.captureUnavailable');
  return h(
    'button',
    {
      type: 'button',
      className: 'plq-msg-capture',
      'aria-label': t('quick.captureMessage'),
      title,
      disabled: !captureReady,
      'data-capture-entry': 'message',
      onPointerDown,
      onClick,
    },
    h(QPCaptureIcon, { size: 14 }),
    h('span', null, t('quick.captureMessage')),
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
  const [tab, setTab] = React.useState('all');
  const tabRefs = React.useRef({});
  const [tipSuppressed, setTipSuppressed] = React.useState(false);
  const tipTimerRef = React.useRef(null);
  const [bodyMode, setBodyMode] = useBodyRenderMode(store);

  const entryRef = React.useRef(null);
  const searchRef = React.useRef(null);
  const narrow = useNarrow(entryRef, 640);

  const sessionId = slotProps.sessionId;
  const sessionRef = React.useRef(sessionId);
  sessionRef.current = sessionId;

  const insertAvailable = hasInsertApi(slotProps.inputActions);

  /* Optional Lead-injected capture hub; every entry degrades safely without it. */
  const capture = (props && props.capture) || null;
  const captureReady = Boolean(capture && typeof capture.open === 'function');
  const useInputHook = typeof slotProps.useInput === 'function' ? slotProps.useInput : null;
  const liveSlotInput = useInputHook ? useInputHook((state) => state) : slotProps.input;
  const composerDraft =
    liveSlotInput && typeof liveSlotInput.draft === 'string'
      ? liveSlotInput.draft
      : slotProps.input && typeof slotProps.input.draft === 'string'
        ? slotProps.input.draft
        : '';
  const draftReady = composerDraft.trim() !== '';

  /* Switching conversations must never keep a stale overlay or selection. */
  React.useEffect(() => {
    setOpen(false);
    setSearch('');
    setSelectedId(null);
    setNotice(null);
    setRatedId(null);
    setTab('all');
  }, [sessionId]);

  /* A tooltip must not pop up just because closing the panel restored focus. */
  React.useEffect(
    () => () => {
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    },
    [],
  );

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
    setTab('all');
  }

  function closePanel() {
    setOpen(false);
    resetPanelState();
    setTipSuppressed(true);
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => {
      tipTimerRef.current = null;
      setTipSuppressed(false);
    }, 600);
    if (tipTimerRef.current && typeof tipTimerRef.current.unref === 'function') tipTimerRef.current.unref();
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
  const isSearching = query !== '';
  const tabCounts = QPQuickTabCounts(data);
  const tabItems = isSearching ? [] : QPQuickItems(data, tab);
  const results = isSearching ? QPSearchResults(data, query) : [];
  const visible = isSearching ? results : tabItems;
  const total = visible.length;
  const selected = selectedId
    ? data.prompts.find((prompt) => prompt.id === selectedId) || null
    : null;
  const ratedPrompt = ratedId
    ? data.prompts.find((prompt) => prompt.id === ratedId) || null
    : null;

  function selectTab(nextTab) {
    if (!QP_TABS.some((definition) => definition.id === nextTab)) return;
    setTab(nextTab);
    setSelectedId(null);
  }

  function onTabsKeyDown(event) {
    if (!event || !event.key) return;
    const order = QP_TABS.map((definition) => definition.id);
    const currentIndex = Math.max(0, order.indexOf(tab));
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % order.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + order.length) % order.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = order.length - 1;
    else return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    const next = order[nextIndex];
    selectTab(next);
    const node = tabRefs.current[next];
    if (node && typeof node.focus === 'function') {
      try {
        node.focus();
      } catch (error) {
        /* focus is best effort */
      }
    }
  }

  const tabsBar =
    !isSearching && data.prompts.length > 0
      ? h(
          'div',
          {
            className: 'plq-tabs',
            role: 'tablist',
            'aria-label': t('quick.tabsLabel'),
            onKeyDown: onTabsKeyDown,
          },
          QP_TABS.map((definition) => {
            const active = tab === definition.id;
            const count = tabCounts[definition.id] || 0;
            return h(
              'button',
              {
                key: definition.id,
                ref: (node) => {
                  tabRefs.current[definition.id] = node;
                },
                type: 'button',
                role: 'tab',
                id: 'plq-tab-' + definition.id,
                'aria-selected': active,
                'aria-controls': 'plq-list-panel',
                'aria-label': t('quick.tabCountAria', { label: t(definition.labelKey), n: count }),
                tabIndex: active ? 0 : -1,
                className: 'plq-tab' + (active ? ' plq-tab-on' : ''),
                onClick: () => selectTab(definition.id),
              },
              h('span', { className: 'plq-tab-label' }, t(definition.labelKey)),
              h('span', { className: 'plq-tab-count', 'aria-hidden': 'true' }, String(count)),
            );
          }),
        )
      : null;

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

  /* Open the capture dialog and hand over; the dialog owns all editing/saving.
   * `capture.open` returns false when a dialog is already open (request kept). */
  function openCapture(payload) {
    if (!captureReady) return false;
    let opened;
    try {
      opened = capture.open(payload);
    } catch {
      opened = false;
    }
    return opened !== false;
  }

  function handleQuickCapture() {
    if (!captureReady) return;
    if (openCapture({ text: '', source: { kind: 'paste' } })) {
      closePanel();
      return;
    }
    showNotice('info', 'quick.captureBusy');
  }

  function handleSaveDraftCapture() {
    if (!captureReady) return;
    /* Snapshot the whole draft and session id at click time, read-only. */
    if (composerDraft.trim() === '') return;
    const payload = {
      text: composerDraft,
      source: { kind: 'composer', sessionId: slotProps.sessionId },
    };
    if (openCapture(payload)) {
      closePanel();
      return;
    }
    showNotice('info', 'quick.captureBusy');
  }

  /* -------------------------- entry button -------------------------- */

  const entry = h(
    'span',
    { ref: entryRef, className: 'plq-entry-wrap' },
    h(
      QPHoverTip,
      { label: t('quick.entryTitle'), suppress: open || tipSuppressed },
      h(
        'button',
        {
          type: 'button',
          className: 'plq-entry',
          'aria-label': t('quick.entry'),
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          onClick: togglePanel,
        },
        h(LibraryIcon, { size: 16 }),
        narrow ? null : h('span', { className: 'plq-entry-label' }, t('quick.entry')),
      ),
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
        tabsBar,
        h(
          'div',
          {
            id: 'plq-list-panel',
            className: 'plq-list',
            'data-quick-list': 'true',
            role: isSearching ? 'group' : 'tabpanel',
            'aria-labelledby': isSearching ? undefined : 'plq-tab-' + tab,
            'aria-label': isSearching ? t('quick.listLabel') : undefined,
            onKeyDown: onListKeyDown,
          },
          isSearching
            ? [
                h(QPSectionHead, {
                  key: 'results-head',
                  label: t('quick.sectionResults'),
                  count: results.length,
                }),
                ...results.map((prompt) =>
                  h(QPRow, {
                    key: prompt.id,
                    prompt,
                    selected: prompt.id === selectedId,
                    t,
                    tags: tagsForPrompt(data, prompt),
                    onSelect,
                  }),
                ),
              ]
            : tabItems.length > 0
              ? tabItems.map((prompt) =>
                  h(QPRow, {
                    key: prompt.id,
                    prompt,
                    selected: prompt.id === selectedId,
                    t,
                    tags: tagsForPrompt(data, prompt),
                    onSelect,
                  }),
                )
              : [
                  h(
                    'div',
                    { key: 'tab-empty', className: 'plq-tab-empty', role: 'status' },
                    h('p', { className: 'plq-tab-empty-title' }, t('quick.tabEmpty')),
                    h('p', { className: 'plq-hint' }, t('quick.tabEmptyBody')),
                    tab !== 'all'
                      ? h(
                          'button',
                          {
                            type: 'button',
                            className: 'pl-btn',
                            onClick: () => selectTab('all'),
                          },
                          t('quick.viewAll'),
                        )
                      : null,
                  ),
                ],
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
            captureReady
              ? h(
                  'div',
                  { className: 'plq-capture-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'pl-btn pl-btn-ghost plq-capture-btn',
                      'aria-label': t('quick.captureQuick'),
                      title: t('quick.captureQuickTitle'),
                      'data-quick-capture': 'paste',
                      onClick: handleQuickCapture,
                    },
                    h(QPCaptureIcon, { size: 14 }),
                    h('span', null, t('quick.captureQuick')),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'pl-btn pl-btn-ghost plq-capture-btn',
                      'aria-label': t('quick.saveDraftLabel'),
                      title: draftReady ? t('quick.saveDraftTitle') : t('quick.saveDraftEmpty'),
                      disabled: !draftReady,
                      'data-quick-capture': 'composer',
                      onClick: handleSaveDraftCapture,
                    },
                    t('quick.saveDraftPanel'),
                  ),
                )
              : null,
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
