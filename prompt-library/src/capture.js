/**
 * Quick-capture overlay — generated/embedded fragment (owner: Lead).
 *
 * One shared capture dialog hosted in the root-scoped `shell.overlay` slot so it
 * survives composer/chat surface changes. Entry points (full panel, quick panel,
 * composer toolbar, chat text selection) only call `capture.open({text, source})`
 * with a synchronous snapshot; the dialog never reads the clipboard, never
 * touches host DOM, never sends messages and never rewrites the draft.
 *
 * Save path goes through the existing store (`createPrompt`), so persistence,
 * validation, failure handling and data migration stay in one place.
 */

const CAPTURE_DICT = {
  zh: {
    'capture.title': '快速收录',
    'capture.subtitle': '先保存，再整理。原文会按你填写的内容原样保留。',
    'capture.bodyLabel': '正文',
    'capture.bodyPlaceholder': '粘贴或输入要保存的提示词；换行与缩进会原样保留。',
    'capture.bodyRequired': '正文不能为空',
    'capture.bodyAria': '提示词正文',
    'capture.titleLabel': '标题',
    'capture.titlePlaceholder': '留空将根据正文自动生成',
    'capture.titleAria': '提示词标题',
    'capture.autoTitleHint': '标题可直接改写；留空或点「恢复自动标题」时，使用正文首个非空行（最多 40 个可见字符）。',
    'capture.titleAutoBadge': '自动生成',
    'capture.titleManualBadge': '已手动修改',
    'capture.autoTitleButton': '自动生成',
    'capture.autoTitleButtonTitle': '用根据正文生成的标题替换当前标题（会先确认）',
    'capture.autoTitleConfirmTitle': '用自动生成的标题替换？',
    'capture.autoTitleConfirmBody': '将把当前标题替换为「{title}」。此操作不会改动正文。',
    'capture.autoTitleReplace': '替换',
    'capture.autoTitleCancel': '保留当前标题',
    'capture.tagsLabel': '标签',
    'capture.tagsEmpty': '还没有标签，可稍后在提示库中创建并整理。',
    'capture.more': '更多选项',
    'capture.less': '收起选项',
    'capture.usageLabel': '使用场景',
    'capture.usagePlaceholder': '可选：预期效果 / 使用场景',
    'capture.sourceNoteLabel': '来源说明',
    'capture.sourceNotePlaceholder': '可选：例如来自某篇文档或某次对话',
    'capture.inboxTarget': '保存到：收件箱',
    'capture.inboxHint': '收录后可在「收件箱」集中整理；不影响当前草稿或消息。',
    'capture.save': '收录',
    'capture.saving': '保存中…',
    'capture.cancel': '取消',
    'capture.saveShortcut': 'Ctrl/Cmd + Enter 保存',
    'capture.discardTitle': '放弃这次收录？',
    'capture.discardMessage': '正文、标题和标签等尚未保存的内容将丢失。',
    'capture.discardConfirm': '放弃收录',
    'capture.discardCancel': '继续编辑',
    'capture.duplicateTitle': '发现重复内容',
    'capture.duplicateExact': '此内容已收录',
    'capture.duplicateNear': '发现疑似重复内容（仅首尾空白或换行编码不同）',
    'capture.duplicateHint': '可先查看已有条目，或仍然另存为新条目。另存不会继承已有条目的评分、使用次数或 AI 评价。',
    'capture.exactBadge': '完全相同',
    'capture.nearBadge': '疑似重复',
    'capture.viewExisting': '查看已有',
    'capture.backToEdit': '返回继续编辑',
    'capture.saveAnyway': '仍然另存',
    'capture.previewTitle': '已有条目预览',
    'capture.previewMeta': '可在提示库中查看完整内容与评分。',
    'capture.previewBack': '返回',
    'capture.previewBodyAria': '已有提示词正文',
    'capture.savedTitle': '已收录',
    'capture.savedBody': '已保存到收件箱。',
    'capture.viewSaved': '查看',
    'capture.continueCapture': '继续收录',
    'capture.close': '关闭',
    'capture.saveError': '保存失败：{message}',
    'capture.hintComposer': '当前 DSH 接口只提供整份草稿文本，无法安全读取选区；这里已收录整份草稿。若只需选区，请复制后使用「快速收录」。',
    'capture.hintMessage': '已收录你在对话中选中的文本。来源会话会记录在提示词元数据中。',
    'capture.moreTags': '共 {n} 个标签',
  },
  en: {
    'capture.title': 'Quick capture',
    'capture.subtitle': 'Save first, organize later. The text you enter is kept exactly as written.',
    'capture.bodyLabel': 'Prompt text',
    'capture.bodyPlaceholder': 'Paste or type the prompt to save; line breaks and indentation are preserved.',
    'capture.bodyRequired': 'Prompt text is required',
    'capture.bodyAria': 'Prompt text',
    'capture.titleLabel': 'Title',
    'capture.titlePlaceholder': 'Leave empty to generate from the text',
    'capture.titleAria': 'Prompt title',
    'capture.autoTitleHint': 'The title is editable; clear it or choose "Restore suggested title" to use the first non-empty line (up to 40 visible characters).',
    'capture.titleAutoBadge': 'Auto',
    'capture.titleManualBadge': 'Edited',
    'capture.autoTitleButton': 'Auto title',
    'capture.autoTitleButtonTitle': 'Replace the current title with the one generated from the text (asks first)',
    'capture.autoTitleConfirmTitle': 'Replace with the generated title?',
    'capture.autoTitleConfirmBody': 'The current title will be replaced with \"{title}\". The prompt text is not changed.',
    'capture.autoTitleReplace': 'Replace',
    'capture.autoTitleCancel': 'Keep current title',
    'capture.tagsLabel': 'Tags',
    'capture.tagsEmpty': 'No tags yet; create and organize them in the library later.',
    'capture.more': 'More options',
    'capture.less': 'Hide options',
    'capture.usageLabel': 'Usage scenario',
    'capture.usagePlaceholder': 'Optional: expected effect / usage scenario',
    'capture.sourceNoteLabel': 'Source note',
    'capture.sourceNotePlaceholder': 'Optional: e.g. from a document or a conversation',
    'capture.inboxTarget': 'Save to: Inbox',
    'capture.inboxHint': 'Organize it later in Inbox; the current draft or message is not touched.',
    'capture.save': 'Capture',
    'capture.saving': 'Saving…',
    'capture.cancel': 'Cancel',
    'capture.saveShortcut': 'Ctrl/Cmd + Enter to save',
    'capture.discardTitle': 'Discard this capture?',
    'capture.discardMessage': 'Unsaved text, title and tags will be lost.',
    'capture.discardConfirm': 'Discard capture',
    'capture.discardCancel': 'Keep editing',
    'capture.duplicateTitle': 'Duplicate content found',
    'capture.duplicateExact': 'This content is already in the library',
    'capture.duplicateNear': 'Likely duplicate (only leading/trailing whitespace or line endings differ)',
    'capture.duplicateHint': 'Preview the existing entries, or save anyway as a new entry. Saving anyway does not inherit their rating, usage count or AI review.',
    'capture.exactBadge': 'Same text',
    'capture.nearBadge': 'Likely duplicate',
    'capture.viewExisting': 'View existing',
    'capture.backToEdit': 'Back to editing',
    'capture.saveAnyway': 'Save anyway',
    'capture.previewTitle': 'Existing entry preview',
    'capture.previewMeta': 'Open the library for the full content and rating.',
    'capture.previewBack': 'Back',
    'capture.previewBodyAria': 'Existing prompt text',
    'capture.savedTitle': 'Captured',
    'capture.savedBody': 'Saved to Inbox.',
    'capture.viewSaved': 'View',
    'capture.continueCapture': 'Capture another',
    'capture.close': 'Close',
    'capture.saveError': 'Save failed: {message}',
    'capture.hintComposer': 'This DSH version exposes only the whole draft, not a safe reading API for the selection; the whole draft was captured. To capture only a selection, copy it and use Quick capture.',
    'capture.hintMessage': 'Captured the text you selected in the conversation. The source session is recorded in the prompt metadata.',
    'capture.moreTags': '{n} tags',
  },
};

const CAPTURE_CSS = [
  '.pl-capture-shell{display:flex;flex-direction:column;gap:12px}',
  '.pl-capture-sub{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.6}',
  '.pl-capture-banner{display:flex;gap:8px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12.3px;line-height:1.6}',
  '.pl-capture-target{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12.3px;color:var(--dsw-alias-label-secondary)}',
  '.pl-capture-target strong{color:var(--dsw-alias-label-primary);font-weight:600}',
  '.pl-capture-body{min-height:160px;max-height:38vh}',
  '.pl-capture-title-label{display:flex;align-items:center;gap:6px}',
  '.pl-capture-title-state{padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.6;font-weight:400}',
  '.pl-capture-title-state[data-title-state="manual"]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d4a72c) 14%,transparent);color:var(--dsw-alias-state-warn-primary,#d4a72c)}',
  '.pl-capture-auto-title{flex:none;font-size:12px}',
  '.pl-capture-auto-title:disabled{opacity:.5;cursor:not-allowed}',
  '.pl-capture-title-confirm{display:flex;flex-direction:column;gap:6px;margin-top:6px;padding:8px 10px;border:.5px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d4a72c) 35%,transparent);border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d4a72c) 10%,transparent)}',
  '.pl-capture-title-confirm-text{margin:0;font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary)}',
  '.pl-capture-title-confirm-actions{display:flex;flex-wrap:wrap;gap:8px}',
  '.pl-capture-title-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
  '.pl-capture-title-row .pl-input{flex:1;min-width:180px}',
  '.pl-capture-field-error{margin:4px 0 0;color:var(--dsw-alias-state-error-primary,#b3261e);font-size:12px}',
  '.pl-capture-tags{display:flex;flex-wrap:wrap;gap:6px 12px}',
  '.pl-capture-tag{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--dsw-alias-label-primary);cursor:pointer}',
  '.pl-capture-tag input{accent-color:var(--dsw-alias-brand-primary)}',
  '.pl-capture-more-toggle{align-self:flex-start}',
  '.pl-capture-more{display:flex;flex-direction:column;gap:12px;padding:10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}',
  '.pl-capture-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px}',
  '.pl-capture-foot-hint{margin-right:auto;color:var(--dsw-alias-label-secondary);font-size:11.5px}',
  '.pl-capture-dups{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;max-height:34vh;overflow:auto}',
  '.pl-capture-dup{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}',
  '.pl-capture-dup-title{flex:1;min-width:140px;font-size:13px;font-weight:500;overflow-wrap:anywhere}',
  '.pl-capture-dup-badge{flex:none;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px}',
  '.pl-capture-dup-badge-exact{color:var(--dsw-alias-state-warn-primary,#d4a72c)}',
  '.pl-capture-preview-body{margin:0;max-height:36vh;overflow:auto;padding:10px;border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:12.8px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}',
  '.pl-capture-success{display:flex;flex-direction:column;gap:10px;padding:12px;border:.5px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 35%,transparent);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 10%,transparent);color:var(--dsw-alias-state-success-primary,#2f9e44)}',
  '.pl-capture-success-title{margin:0;font-size:14px;font-weight:600}',
  '.pl-capture-success-body{margin:0;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
  '.pl-capture-confirm{padding:8px 10px;border:.5px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d4a72c) 35%,transparent);border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d4a72c) 10%,transparent);color:var(--dsw-alias-label-primary);font-size:12.5px}',
  '@media (max-width:640px){.pl-capture-body{min-height:120px;max-height:32vh}.pl-capture-title-row .pl-input{min-width:0}}',
].join('');

/** Shared, tiny open-request hub: entry points publish a snapshot, the overlay consumes it. */
function createCaptureHub() {
  const listeners = new Set();
  let sequence = 0;
  let request = null;
  let snapshot = { seq: 0, request: null };
  function emit() {
    snapshot = { seq: sequence, request };
    for (const listener of Array.from(listeners)) {
      try {
        listener();
      } catch (error) {
        /* a broken subscriber must not break capture */
      }
    }
  }
  function normalizeSource(source) {
    const raw = source && typeof source === 'object' ? source : {};
    const kind = raw.kind === 'composer' || raw.kind === 'message' ? raw.kind : 'paste';
    return {
      kind,
      sessionId: typeof raw.sessionId === 'string' && raw.sessionId ? raw.sessionId : undefined,
      messageId: typeof raw.messageId === 'string' && raw.messageId ? raw.messageId : undefined,
    };
  }
  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Publish one capture request; an unsaved open capture is never overwritten. */
    open(payload) {
      if (request !== null) return false;
      const source = payload && typeof payload === 'object' ? normalizeSource(payload.source) : normalizeSource(null);
      request = {
        text: typeof (payload && payload.text) === 'string' ? payload.text : '',
        source,
      };
      sequence += 1;
      emit();
      return true;
    },
    close() {
      if (request === null) return;
      request = null;
      sequence += 1;
      emit();
    },
  };
}

function captureTagIdsFromPrompt(prompt) {
  return prompt && Array.isArray(prompt.tagIds) ? prompt.tagIds.slice() : [];
}

/**
 * The shared capture dialog. Rendered inside the root `shell.overlay` slot so a
 * chat selection surface or composer popover can close without losing input.
 */
function PromptLibraryCaptureHost(props) {
  const capture = props.capture;
  const store = props.store;
  const focus = props.focus;
  const getLayout = typeof props.getLayout === 'function' ? props.getLayout : () => undefined;
  const t = props.t;
  const locale = props.locale;
  const snapshot = React.useSyncExternalStore(capture.subscribe, capture.getSnapshot);
  const request = snapshot.request;
  if (!request) return null;
  return h(PromptLibraryCaptureDialog, {
    key: 'capture-' + String(snapshot.seq),
    request,
    capture,
    store,
    focus,
    getLayout,
    t,
    locale,
  });
}

function PromptLibraryCaptureDialog(props) {
  const { request, capture, store, focus, getLayout, t, locale } = props;
  const initialText = String(request.text || '');
  const [activeSource, setActiveSource] = React.useState(() => request.source || { kind: 'paste' });
  const [body, setBody] = React.useState(initialText);
  const [title, setTitle] = React.useState(() => suggestCaptureTitle(initialText));
  const [titleDirty, setTitleDirty] = React.useState(false);
  const [usage, setUsage] = React.useState('');
  const [sourceNote, setSourceNote] = React.useState('');
  const [tagIds, setTagIds] = React.useState([]);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [fieldError, setFieldError] = React.useState(false);
  const [phase, setPhase] = React.useState('edit');
  const [duplicates, setDuplicates] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const [saved, setSaved] = React.useState(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [autoTitleConfirmOpen, setAutoTitleConfirmOpen] = React.useState(false);
  const bodyRef = React.useRef(null);
  const composingRef = React.useRef(false);
  const resetFocusRef = React.useRef(0);
  const savingRef = React.useRef(false);

  React.useEffect(() => {
    const element = bodyRef.current;
    if (element && typeof element.focus === 'function') {
      try {
        element.focus();
      } catch (error) {
        /* ignore */
      }
    }
  }, []);

  React.useEffect(() => {
    if (resetFocusRef.current === 0) return;
    const element = bodyRef.current;
    if (element && typeof element.focus === 'function') {
      try {
        element.focus();
      } catch (error) {
        /* ignore */
      }
    }
  }, [resetFocusRef.current]);

  const data = store.getSnapshot().data;
  const tags = sortTags(data.tags);
  /* The auto suggestion is derived from the body so manual edits can be
   * reverted at any time without losing the current text. */
  const autoTitle = suggestCaptureTitle(body);
  const autoTitleDisabled = autoTitle === '' || title === autoTitle;
  const hasContent = Boolean(
    body.trim() || title.trim() || usage.trim() || sourceNote.trim() || tagIds.length,
  );

  function close() {
    setDiscardOpen(false);
    capture.close();
  }

  function requestClose() {
    if (saving) return;
    if (phase === 'success') {
      close();
      return;
    }
    if (discardOpen) {
      setDiscardOpen(false);
      return;
    }
    if (hasContent) {
      setDiscardOpen(true);
      return;
    }
    close();
  }

  function onBodyChange(event) {
    const value = event && event.target ? event.target.value : '';
    setBody(value);
    setFieldError(false);
    if (!titleDirty) setTitle(suggestCaptureTitle(value));
  }

  function onTitleChange(event) {
    const value = event && event.target ? event.target.value : '';
    setTitle(value);
    /* Never refill the auto suggestion while the field is empty: doing that
     * made the last character impossible to delete (it came straight back).
     * An empty title simply means "use the suggestion" at save time, and a
     * later body edit may refill it while the field is still untouched. */
    setTitleDirty(value.trim() !== '');
    setAutoTitleConfirmOpen(false);
  }

  function requestAutoTitle() {
    if (autoTitleDisabled) return;
    setAutoTitleConfirmOpen(true);
  }

  function applyAutoTitle() {
    setTitle(autoTitle);
    setTitleDirty(false);
    setAutoTitleConfirmOpen(false);
  }

  function toggleTag(tagId) {
    setTagIds((previous) =>
      previous.includes(tagId) ? previous.filter((id) => id !== tagId) : previous.concat([tagId]),
    );
  }

  function onKeyDown(event) {
    if (!event || event.key !== 'Enter') return;
    if (!(event.metaKey || event.ctrlKey)) return;
    const composing =
      composingRef.current ||
      event.isComposing === true ||
      (event.nativeEvent && event.nativeEvent.isComposing === true) ||
      event.keyCode === 229 ||
      (event.nativeEvent && event.nativeEvent.keyCode === 229);
    if (composing) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    attemptSave(false);
  }

  function attemptSave(saveAnyway) {
    if (savingRef.current || saving) return;
    if (phase === 'success') return;
    const rawBody = body;
    if (!rawBody.trim()) {
      setFieldError(true);
      setError(t('capture.bodyRequired'));
      return;
    }
    let effectiveTitle = title.trim();
    if (!effectiveTitle) {
      effectiveTitle = suggestCaptureTitle(rawBody);
      setTitle(effectiveTitle);
      setTitleDirty(false);
    }
    if (!effectiveTitle) {
      setFieldError(true);
      setError(t('err.TITLE_REQUIRED'));
      return;
    }
    if (!saveAnyway) {
      const found = findCaptureDuplicates(store.getData(), rawBody);
      if (found.exact.length > 0 || found.near.length > 0) {
        setDuplicates(found);
        setPreview(null);
        setPhase('duplicates');
        return;
      }
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setFieldError(false);
    let result;
    try {
      result = store.createPrompt({
        title: effectiveTitle,
        body: rawBody,
        usage,
        tagIds,
        organize: 'inbox',
        capture: {
          kind: activeSource.kind,
          at: Date.now(),
          sessionId: activeSource.sessionId,
          messageId: activeSource.messageId,
          note: sourceNote.trim() ? sourceNote.trim() : undefined,
        },
      });
    } catch (failure) {
      result = { ok: false, error: { code: 'STORAGE_WRITE_FAILED', message: String((failure && failure.message) || failure) } };
    }
    savingRef.current = false;
    setSaving(false);
    if (!result || !result.ok) {
      setError(t('capture.saveError', { message: describeError(t, result && result.error) }));
      return;
    }
    const created = result.prompt;
    setSaved({ id: created && created.id ? created.id : '', title: effectiveTitle });
    setDuplicates(null);
    setPreview(null);
    setPhase('success');
  }

  function continueCapture() {
    setBody('');
    setTitle('');
    setTitleDirty(false);
    setUsage('');
    setSourceNote('');
    setTagIds([]);
    setMoreOpen(false);
    setError(null);
    setFieldError(false);
    setDuplicates(null);
    setPreview(null);
    setSaved(null);
    setPhase('edit');
    setDiscardOpen(false);
    setActiveSource({ kind: 'paste' });
    resetFocusRef.current += 1;
  }

  function viewSaved() {
    const layout = getLayout();
    const id = saved && saved.id ? saved.id : '';
    capture.close();
    if (layout && typeof layout.selectPanel === 'function') {
      try {
        layout.selectPanel('prompt-library');
      } catch (error) {
        /* panel opens on next navigation attempt */
      }
    }
    if (id && focus && typeof focus.request === 'function') focus.request(id);
  }

  const bodyField = h(
    'div',
    { className: 'pl-field' },
    h('label', { className: 'pl-label', htmlFor: 'pl-capture-body' }, t('capture.bodyLabel')),
    h('textarea', {
      id: 'pl-capture-body',
      ref: bodyRef,
      className: 'pl-textarea pl-capture-body',
      'aria-label': t('capture.bodyAria'),
      placeholder: t('capture.bodyPlaceholder'),
      value: body,
      onChange: onBodyChange,
      onKeyDown,
      onCompositionStart: () => {
        composingRef.current = true;
      },
      onCompositionEnd: () => {
        composingRef.current = false;
      },
    }),
    fieldError ? h('p', { className: 'pl-capture-field-error', role: 'alert' }, t('capture.bodyRequired')) : null,
  );

  const titleField = h(
    'div',
    { className: 'pl-field' },
    h(
      'div',
      { className: 'pl-capture-title-label' },
      h('label', { className: 'pl-label' }, t('capture.titleLabel')),
      autoTitle
        ? h(
            'span',
            { className: 'pl-capture-title-state', 'data-title-state': titleDirty ? 'manual' : 'auto' },
            t(titleDirty ? 'capture.titleManualBadge' : 'capture.titleAutoBadge'),
          )
        : null,
    ),
    h(
      'div',
      { className: 'pl-capture-title-row' },
      h('input', {
        type: 'text',
        className: 'pl-input',
        'aria-label': t('capture.titleAria'),
        placeholder: t('capture.titlePlaceholder'),
        value: title,
        onChange: onTitleChange,
        onKeyDown,
      }),
      autoTitle
        ? h(
            'button',
            {
              type: 'button',
              className: 'pl-btn pl-btn-ghost pl-capture-auto-title',
              title: t('capture.autoTitleButtonTitle'),
              'aria-label': t('capture.autoTitleButton'),
              disabled: autoTitleDisabled,
              onClick: requestAutoTitle,
            },
            t('capture.autoTitleButton'),
          )
        : null,
    ),
    h('p', { className: 'pl-field-hint' }, t('capture.autoTitleHint')),
    autoTitleConfirmOpen
      ? h(
          'div',
          {
            className: 'pl-capture-title-confirm',
            role: 'alertdialog',
            'aria-label': t('capture.autoTitleConfirmTitle'),
          },
          h('p', { className: 'pl-capture-title-confirm-text' }, t('capture.autoTitleConfirmTitle')),
          h(
            'p',
            { className: 'pl-capture-sub' },
            t('capture.autoTitleConfirmBody', { title: autoTitle }),
          ),
          h(
            'div',
            { className: 'pl-capture-title-confirm-actions' },
            h(
              'button',
              { type: 'button', className: 'pl-btn pl-btn-primary', onClick: applyAutoTitle },
              t('capture.autoTitleReplace'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'pl-btn',
                onClick: () => setAutoTitleConfirmOpen(false),
              },
              t('capture.autoTitleCancel'),
            ),
          ),
        )
      : null,
  );

  const tagsField = h(
    'div',
    { className: 'pl-field' },
    h('label', { className: 'pl-label' }, t('capture.tagsLabel')),
    tags.length
      ? h(
          'div',
          { className: 'pl-capture-tags' },
          tags.map((tag) =>
            h(
              'label',
              { key: tag.id, className: 'pl-capture-tag' },
              h('input', {
                type: 'checkbox',
                'aria-label': tag.name,
                checked: tagIds.includes(tag.id),
                onChange: () => toggleTag(tag.id),
              }),
              h('span', null, tag.name),
            ),
          ),
        )
      : h('p', { className: 'pl-muted' }, t('capture.tagsEmpty')),
  );

  const moreSection = moreOpen
    ? h(
        'div',
        { className: 'pl-capture-more' },
        h(
          'div',
          { className: 'pl-field' },
          h('label', { className: 'pl-label' }, t('capture.usageLabel')),
          h('textarea', {
            className: 'pl-textarea',
            'aria-label': t('capture.usageLabel'),
            placeholder: t('capture.usagePlaceholder'),
            value: usage,
            onChange: (event) => setUsage(event && event.target ? event.target.value : ''),
          }),
        ),
        h(
          'div',
          { className: 'pl-field' },
          h('label', { className: 'pl-label' }, t('capture.sourceNoteLabel')),
          h('input', {
            type: 'text',
            className: 'pl-input',
            'aria-label': t('capture.sourceNoteLabel'),
            placeholder: t('capture.sourceNotePlaceholder'),
            value: sourceNote,
            onChange: (event) => setSourceNote(event && event.target ? event.target.value : ''),
          }),
        ),
      )
    : null;

  const hint =
    activeSource.kind === 'composer'
      ? t('capture.hintComposer')
      : activeSource.kind === 'message'
        ? t('capture.hintMessage')
        : '';

  const duplicateList = duplicates
    ? h(
        'ul',
        { className: 'pl-capture-dups', 'aria-label': t('capture.duplicateTitle') },
        duplicates.exact.map((prompt) =>
          h(
            'li',
            { key: 'exact-' + prompt.id, className: 'pl-capture-dup' },
            h('span', { className: 'pl-capture-dup-title' }, prompt.title),
            h('span', { className: 'pl-capture-dup-badge pl-capture-dup-badge-exact' }, t('capture.exactBadge')),
            h(
              'button',
              { type: 'button', className: 'pl-btn', onClick: () => setPreview({ prompt, exact: true }) },
              t('capture.viewExisting'),
            ),
          ),
        ),
        duplicates.near.map((prompt) =>
          h(
            'li',
            { key: 'near-' + prompt.id, className: 'pl-capture-dup' },
            h('span', { className: 'pl-capture-dup-title' }, prompt.title),
            h('span', { className: 'pl-capture-dup-badge' }, t('capture.nearBadge')),
            h(
              'button',
              { type: 'button', className: 'pl-btn', onClick: () => setPreview({ prompt, exact: false }) },
              t('capture.viewExisting'),
            ),
          ),
        ),
      )
    : null;

  let content = null;
  let footer = null;

  if (phase === 'success' && saved) {
    content = h(
      'div',
      { className: 'pl-capture-success', role: 'status' },
      h('p', { className: 'pl-capture-success-title' }, t('capture.savedTitle') + ' · ' + saved.title),
      h('p', { className: 'pl-capture-success-body' }, t('capture.savedBody')),
    );
    footer = h(
      'div',
      { className: 'pl-capture-foot' },
      saved.id
        ? h('button', { type: 'button', className: 'pl-btn pl-btn-primary', onClick: viewSaved }, t('capture.viewSaved'))
        : null,
      h('button', { type: 'button', className: 'pl-btn', onClick: continueCapture }, t('capture.continueCapture')),
      h('button', { type: 'button', className: 'pl-btn pl-btn-ghost', onClick: close }, t('capture.close')),
    );
  } else if (phase === 'duplicates' && duplicates) {
    content = preview
      ? h(
          'div',
          { className: 'pl-capture-shell' },
          h('h3', { className: 'pl-section-title' }, t('capture.previewTitle')),
          h('p', { className: 'pl-capture-dup-title' }, preview.prompt.title),
          h('p', { className: 'pl-capture-sub' }, t('capture.previewMeta')),
          h('pre', { className: 'pl-capture-preview-body', 'aria-label': t('capture.previewBodyAria') }, preview.prompt.body),
          h(
            'div',
            { className: 'pl-capture-foot' },
            h('button', { type: 'button', className: 'pl-btn', onClick: () => setPreview(null) }, t('capture.previewBack')),
          ),
        )
      : h(
          'div',
          { className: 'pl-capture-shell' },
          h('h3', { className: 'pl-section-title' }, t('capture.duplicateTitle')),
          h(
            'p',
            { className: 'pl-capture-sub' },
            duplicates.exact.length > 0 ? t('capture.duplicateExact') : t('capture.duplicateNear'),
          ),
          duplicateList,
          h('p', { className: 'pl-capture-sub' }, t('capture.duplicateHint')),
        );
    footer = preview
      ? h(
          'div',
          { className: 'pl-capture-foot' },
          h('button', { type: 'button', className: 'pl-btn', onClick: () => setPreview(null) }, t('capture.previewBack')),
        )
      : h(
          'div',
          { className: 'pl-capture-foot' },
          h(
            'button',
            { type: 'button', className: 'pl-btn', onClick: () => { setPhase('edit'); setDuplicates(null); setPreview(null); } },
            t('capture.backToEdit'),
          ),
          h(
            'button',
            { type: 'button', className: 'pl-btn pl-btn-primary', onClick: () => attemptSave(true), disabled: saving },
            t('capture.saveAnyway'),
          ),
        );
  } else {
    content = h(
      'div',
      { className: 'pl-capture-shell' },
      h('p', { className: 'pl-capture-sub' }, t('capture.subtitle')),
      hint ? h('div', { className: 'pl-capture-banner', role: 'note' }, hint) : null,
      h(
        'div',
        { className: 'pl-capture-target' },
        h('strong', null, t('capture.inboxTarget')),
        h('span', null, '· ' + t('capture.inboxHint')),
      ),
      bodyField,
      titleField,
      tagsField,
      h(
        'button',
        {
          type: 'button',
          className: 'pl-btn pl-btn-ghost pl-capture-more-toggle',
          'aria-expanded': moreOpen,
          onClick: () => setMoreOpen(!moreOpen),
        },
        moreOpen ? t('capture.less') : t('capture.more'),
      ),
      moreSection,
      error ? h('div', { className: 'pl-notice pl-notice-error', role: 'alert' }, error) : null,
      discardOpen
        ? h(
            'div',
            { className: 'pl-capture-confirm' },
            h('p', { className: 'pl-capture-dup-title', role: 'alert' }, t('capture.discardTitle')),
            h('p', { className: 'pl-capture-sub' }, t('capture.discardMessage')),
            h(
              'div',
              { className: 'pl-capture-foot' },
              h('button', { type: 'button', className: 'pl-btn', onClick: () => setDiscardOpen(false) }, t('capture.discardCancel')),
              h(
                'button',
                { type: 'button', className: 'pl-btn pl-btn-danger', onClick: close },
                t('capture.discardConfirm'),
              ),
            ),
          )
        : null,
    );
    footer = h(
      'div',
      { className: 'pl-capture-foot' },
      h('span', { className: 'pl-capture-foot-hint' }, t('capture.saveShortcut')),
      h('button', { type: 'button', className: 'pl-btn', onClick: requestClose, disabled: saving }, t('capture.cancel')),
      h(
        'button',
        {
          type: 'button',
          className: 'pl-btn pl-btn-primary',
          onClick: () => attemptSave(false),
          disabled: saving,
        },
        saving ? t('capture.saving') : t('capture.save'),
      ),
    );
  }

  return h(
    Modal,
    {
      title: t('capture.title'),
      onClose: requestClose,
      closeLabel: t('common.close'),
      wide: true,
      footer,
      initialFocusRef: phase === 'edit' ? bodyRef : undefined,
    },
    h('div', { onKeyDown }, content),
  );
}
