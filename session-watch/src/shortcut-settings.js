// Factory is embedded in the dynamic Client bundle; no runtime imports.
export function createShortcutSettingsComponent(React, h, helpers) {
  const { useState, useRef, useLayoutEffect } = React;
  const { SHORTCUT_ACTIONS, createDefaultShortcutConfig, normalizeShortcutConfig, validateShortcutConfig, shortcutStroke } = helpers;
  const clone = value => JSON.parse(JSON.stringify(value));
  const json = value => JSON.stringify(value);
  const scopesOf = binding => binding.scopes === undefined ? ['local'] : binding.scopes;

  return function ShortcutSettings({ value, saving = false, error = '', onSave, onClose, onRecordingChange, returnFocusTo, getDiagnostics }) {
    const incoming = normalizeShortcutConfig(value);
    const incomingKey = json(incoming);
    const [base, setBase] = useState(() => clone(incoming));
    const [draft, setDraft] = useState(() => clone(incoming));
    const [filter, setFilter] = useState('all');
    const [diagnostics, setDiagnostics] = useState(() => getDiagnostics?.() || null);
    const [keyTexts, setKeyTexts] = useState({});
    const [pending, setPending] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [saveError, setSaveError] = useState('');
    const [closing, setClosing] = useState(false);
    const [recording, setRecording] = useState(null);
    const recordingRef = useRef(null);
    const captureRef = useRef(null);
    const dialogRef = useRef(null);
    const draftRef = useRef(draft); draftRef.current = draft;
    const callbackRef = useRef(onRecordingChange); callbackRef.current = onRecordingChange;
    const listenerRef = useRef(null);
    const mounted = useRef(true);
    const ack = useRef(null);
    const baseKey = json(base);
    const dirty = json(draft) !== baseKey;
    const ignoredPreviousValue = ack.current && incomingKey === ack.current.previous;
    const changedElsewhere = incomingKey !== baseKey && !ignoredPreviousValue;
    const busy = saving || pending;
    const editingDisabled = busy || Boolean(recording);
    const validation = validateShortcutConfig(draft);
    const errors = Array.isArray(validation.errors) ? validation.errors : [];

    function replaceDraft(next) {
      const copy = clone(next); draftRef.current = copy; setDraft(copy); setKeyTexts({});
      setSaveError(''); setFeedback(''); setClosing(false);
    }
    function loadConfirmed() {
      stopRecording(); ack.current = null;
      setBase(clone(incoming)); replaceDraft(incoming);
      setFeedback('已重新载入当前确认配置。');
    }
    useLayoutEffect(() => {
      if (ack.current && incomingKey === ack.current.saved) ack.current = null;
      if (changedElsewhere && !dirty && !busy) {
        ack.current = null; setBase(clone(incoming)); replaceDraft(incoming);
        setFeedback('已载入其它页面更新的快捷键配置。');
      }
    }, [incomingKey, baseKey, dirty, busy]);

    function bindingFor(action) {
      return draft.bindings.find(binding => binding.action === action) || { ...createDefaultShortcutConfig().bindings.find(binding => binding.action === action), action, enabled: false, scopes: ['local'] };
    }
    function editBinding(action, patch) {
      const current = draftRef.current;
      const exists = current.bindings.some(binding => binding.action === action);
      const bindings = exists ? current.bindings.map(binding => binding.action === action ? { ...binding, ...patch } : binding) : [...current.bindings, { ...bindingFor(action), ...patch }];
      replaceDraft({ ...current, bindings });
    }
    function stopRecording() {
      if (!recordingRef.current) return;
      recordingRef.current = null;
      callbackRef.current?.(false);
      if (mounted.current) setRecording(null);
    }
    function startRecording(action, mode) {
      if (busy) return;
      const wasRecording = Boolean(recordingRef.current);
      const next = { action, mode, strokes: [] };
      recordingRef.current = next;
      if (!wasRecording) callbackRef.current?.(true); // pause synchronously, before any rerender
      setRecording({ ...next }); setSaveError(''); setFeedback(''); setClosing(false);
    }
    useLayoutEffect(() => { if (recording) captureRef.current?.focus(); }, [recording]);
    listenerRef.current = event => {
      const current = recordingRef.current;
      if (shortcutStroke(event) === 'Ctrl+B') {
        if (current) { stopRecording(); setFeedback('Ctrl+B 已由 DSH 使用，已取消录制并交还原生处理。'); }
        return; // Do not preventDefault or stop propagation, including while recording.
      }
      if (!current) {
        if (event.isComposing || event.keyCode === 229 || event.which === 229) return;
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
          if (!event.repeat) close();
        } else if (event.key === 'Tab') {
          const dialog = dialogRef.current;
          const controls = [...(dialog?.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') || [])];
          const first = controls[0]; const last = controls[controls.length - 1];
          const outside = !dialog?.contains(document.activeElement) || document.activeElement === dialog;
          if (!first || (event.shiftKey ? outside || document.activeElement === first : outside || document.activeElement === last)) {
            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
            (event.shiftKey ? last : first)?.focus();
          }
        }
        return;
      }
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
      if (event.key === 'Escape') { stopRecording(); setFeedback('已取消录制，原配置未改变。'); return; }
      if (event.isComposing || event.keyCode === 229 || event.which === 229 || event.repeat) return;
      if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(event.key)) return;
      let stroke;
      try { stroke = shortcutStroke(event); } catch { stroke = null; }
      if (!stroke) { setFeedback('此按键不能录制，请换一个组合键或取消。'); return; }
      const strokes = [...current.strokes, stroke];
      if (current.mode === 'sequence' && strokes.length < 2) {
        const next = { ...current, strokes }; recordingRef.current = next; setRecording({ ...next }); return;
      }
      if (current.mode === 'prefix') replaceDraft({ ...draftRef.current, prefix: stroke });
      else {
        // Normalize the prefix independently: another invalid draft row must
        // not make normalizeShortcutConfig replace it with a safe fallback.
        const parts = draftRef.current.prefix.split('+'); const prefixKey = parts.pop();
        const hasModifier = name => parts.some(part => part.toLowerCase() === name);
        const prefix = shortcutStroke({ key: prefixKey, ctrlKey: hasModifier('ctrl'), altKey: hasModifier('alt'), shiftKey: hasModifier('shift'), metaKey: hasModifier('meta') });
        const key = current.mode === 'sequence' ? (strokes[0] === prefix ? 'Prefix ' + strokes[1] : strokes.join(' ')) : stroke;
        editBinding(current.action, { keys: [key] });
      }
      stopRecording(); setFeedback('录制完成，仅修改草稿；保存后才会生效。');
    };
    useLayoutEffect(() => {
      mounted.current = true;
      const listener = event => listenerRef.current?.(event);
      const doc = document; const win = window;
      const dialog = dialogRef.current; const opener = returnFocusTo || doc.activeElement;
      const keepFocus = event => { if (dialog?.isConnected && !dialog.contains(event.target)) dialog.focus({ preventScroll: true }); };
      doc.addEventListener('focusin', keepFocus, true);
      dialog?.focus({ preventScroll: true });
      // Window capture prevents native document-level Esc/stop handlers from
      // seeing a recording event. Document capture also covers direct dispatch.
      window.addEventListener('keydown', listener, true);
      document.addEventListener('keydown', listener, true);
      return () => {
        mounted.current = false;
        window.removeEventListener('keydown', listener, true);
        document.removeEventListener('keydown', listener, true);
        recordingRef.current = null;
        callbackRef.current?.(false);
        doc.removeEventListener('focusin', keepFocus, true);
        // Wait until React removes background inert and the floating layer.
        win.setTimeout(() => {
          if (opener?.isConnected && !doc.querySelector('[data-sw-shortcut-settings]') && (!doc.activeElement || doc.activeElement === doc.body)) opener.focus({ preventScroll: true });
        }, 0);
      };
    }, []);

    async function save() {
      if (busy || recordingRef.current) return;
      if (changedElsewhere) { setSaveError('其它页面已修改快捷键配置，请重新载入后再保存。'); return; }
      const checked = validateShortcutConfig(draftRef.current);
      if (!checked.valid) { setSaveError('配置存在错误，尚未保存。请修正下方提示。'); return; }
      const submitted = clone(normalizeShortcutConfig(draftRef.current)); const expected = clone(base);
      setPending(true); setSaveError(''); setFeedback('');
      try {
        const accepted = await onSave(submitted, expected);
        if (!mounted.current) return;
        if (!accepted) { setSaveError('保存未成功，草稿已保留。请检查错误后重试。'); return; }
        ack.current = { previous: json(expected), saved: json(submitted) };
        setBase(clone(submitted)); replaceDraft(submitted);
        setFeedback('快捷键配置已保存并确认。');
      } catch (failure) {
        if (mounted.current) setSaveError('保存失败，草稿已保留。' + (failure?.message ? ' ' + String(failure.message).slice(0, 200) : ''));
      } finally { if (mounted.current) setPending(false); }
    }
    function close() {
      if (busy) return;
      stopRecording();
      if (dirty) setClosing(true); else onClose?.();
    }
    function restoreAll() { stopRecording(); replaceDraft(createDefaultShortcutConfig()); setFeedback('已将全部默认值放入草稿，保存后生效。'); }
    function restoreOne(action) {
      const original = createDefaultShortcutConfig().bindings.find(binding => binding.action === action);
      if (original) editBinding(action, clone(original));
    }
    function checkbox(label, checked, change, disabled = editingDisabled) {
      return h('label', { className: 'sw-keys-check' }, h('input', { type: 'checkbox', 'aria-label': label, checked: Boolean(checked), disabled, onChange: event => change(event.target.checked) }), label);
    }
    function button(label, click, disabled = editingDisabled, text = label) {
      return h('button', { type: 'button', className: 'sw-btn', 'aria-label': label, disabled, onClick: click }, text);
    }
    const visible = SHORTCUT_ACTIONS.filter(action => {
      if (filter === 'all') return true;
      return scopesOf(bindingFor(action.id)).includes(filter);
    });
    return h('div', { className: 'sw-keys-layer', onClick: event => { if (event.target === event.currentTarget) close(); } },
      h('section', { ref: dialogRef, className: 'sw-keys-settings', role: 'dialog', 'aria-modal': 'true', tabIndex: -1, 'data-sw-shortcut-settings': 'true', 'aria-label': '快捷键设置' },
      h('header', { className: 'sw-keys-heading' }, h('h2', null, '快捷键设置'), button('关闭快捷键设置', close, busy)),
      h('p', { className: 'sw-keys-hint' }, '编辑、录制和恢复默认只修改草稿；保存并确认后才生效。局内／局外可同时启用，未指定时默认为局内。'),
      checkbox('启用全部快捷键', draft.enabled, enabled => replaceDraft({ ...draftRef.current, enabled })),
      h('div', { className: 'sw-keys-toolbar' },
        h('label', null, '查看 ', h('select', { 'aria-label': '筛选快捷键', value: filter, disabled: editingDisabled, onChange: event => setFilter(event.target.value) },
          h('option', { value: 'all' }, '全部'), h('option', { value: 'local' }, '局内'), h('option', { value: 'outside' }, '局外'))),
        h('label', null, '公共前缀 ', h('input', { type: 'text', 'aria-label': '公共前缀', value: draft.prefix, disabled: editingDisabled,
          onChange: event => replaceDraft({ ...draftRef.current, prefix: event.target.value }) })),
        button('录制公共前缀', () => startRecording(null, 'prefix')),
        button('恢复全部默认', restoreAll)),
      changedElsewhere ? h('div', { className: 'sw-error sw-keys-concurrent', role: 'alert' },
        '其它页面已修改快捷键配置。当前草稿不会覆盖它，请重新载入。', button('重新载入已确认配置', loadConfirmed, busy)) : null,
      recording ? h('div', { className: 'sw-keys-recording', ref: captureRef, tabIndex: 0, 'aria-label': '快捷键录制区', role: 'group' },
        h('p', { role: 'status' }, recording.mode === 'sequence' ? (recording.strokes.length ? '第一步：' + recording.strokes[0] + '；请按第二步。' : '正在录制两步序列，请按第一步。') : '正在录制组合键，请按目标按键。'),
        h('p', null, recording.mode === 'prefix' ? '录制只修改草稿中的公共前缀，保存后影响所有 Prefix 序列。Esc 或停止录制可取消。' : '本次录制会替换这一项的全部备选键；仅修改草稿。Esc 或停止录制可取消。'),
        button('停止录制', () => { stopRecording(); setFeedback('已取消录制，原配置未改变。'); }, false)) : null,
      h('div', { className: 'sw-keys-list' }, visible.map(action => {
        const binding = bindingFor(action.id);
        const scopes = scopesOf(binding);
        const setScope = (scope, enabled) => editBinding(action.id, { scopes: enabled ? [...new Set([...scopes, scope])] : scopes.filter(item => item !== scope) });
        return h('article', { className: 'sw-keys-row', key: action.id, 'data-shortcut-action': action.id },
          h('div', { className: 'sw-keys-action' }, h('strong', null, action.label), h('p', null, action.description)),
          checkbox('启用 ' + action.label, binding.enabled, enabled => editBinding(action.id, { enabled })),
          h('label', { className: 'sw-keys-binding' }, '按键 ', h('input', { type: 'text', 'aria-label': '按键 ' + action.label, value: keyTexts[action.id] ?? binding.keys.join(' | '), disabled: editingDisabled,
            placeholder: 'Ctrl+ArrowLeft | Prefix H', onChange: event => { const text = event.target.value; editBinding(action.id, { keys: text.split('|').map(part => part.trim()).filter(Boolean) }); setKeyTexts(current => ({ ...current, [action.id]: text })); } })),
          h('div', { className: 'sw-keys-scopes' }, checkbox('局内 ' + action.label, scopes.includes('local'), enabled => setScope('local', enabled)), checkbox('局外 ' + action.label, scopes.includes('outside'), enabled => setScope('outside', enabled))),
          h('div', { className: 'sw-keys-row-actions' }, button('录制组合 ' + action.label, () => startRecording(action.id, 'single'), editingDisabled, '录制组合'), button('录制序列 ' + action.label, () => startRecording(action.id, 'sequence'), editingDisabled, '录制序列'), button('恢复默认 ' + action.label, () => restoreOne(action.id), editingDisabled, '恢复默认')));
      })),
      h('p', { className: 'sw-keys-hint' }, '备选按键用 | 分隔；Prefix H 使用公共前缀；Ctrl+K X 表示先按 Ctrl+K，再按 X。原生发送、停止、复制粘贴等保护键不能覆盖。局外仅限 DSH 应用内；系统可能先截获 Ctrl+方向键，届时请使用或改绑前缀。'),
      errors.length ? h('ul', { className: 'sw-error sw-keys-errors', role: 'alert' }, errors.map((item, index) => h('li', { key: index }, (item.action ? item.action + '：' : '') + item.message))) : null,
      error || saveError ? h('p', { className: 'sw-error', role: 'alert' }, [error, saveError].filter(Boolean).join(' ')) : null,
      feedback ? h('p', { className: 'sw-keys-feedback', role: 'status' }, feedback) : null,
      diagnostics ? h('section', { 'aria-label': '按键诊断' }, h('h3', null, '按键诊断（只读）'),
        h('p', null, '先关闭浮窗测试快捷键，再打开这里刷新。仅保留最近 8 次组合键／序列步骤，不记录普通输入正文，不写入磁盘。'),
        button('刷新按键诊断', () => setDiagnostics(getDiagnostics?.() || null), false),
        h('pre', { style: { whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', fontSize: 11 }, 'aria-label': '按键诊断内容' }, JSON.stringify(diagnostics, null, 2))) : null,
      h('footer', { className: 'sw-keys-footer' }, h('span', null, dirty ? '有未保存的修改' : '与已确认配置一致'),
        button('保存并应用', save, busy || Boolean(recording) || changedElsewhere || !validation.valid, busy ? '正在保存…' : '保存并应用'),
        button('取消修改', loadConfirmed, busy)),
      closing ? h('div', { className: 'sw-keys-close-warning', role: 'alert' }, '有未保存的修改，是否放弃并关闭？',
        button('继续编辑', () => setClosing(false), busy), button('放弃修改并关闭', () => { stopRecording(); onClose?.(); }, busy)) : null));
  };
}
