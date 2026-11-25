// Browser adapter; matching/validation remains in shortcuts.js.
export function shortcutEditableTarget(target) {
  const element = target?.nodeType === 1 ? target : target?.parentElement;
  return !!element?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""],[role="textbox"]');
}
export function shortcutRootVisible(root, win = window) {
  if (!root?.isConnected) return false;
  for (let node = root; node?.nodeType === 1; node = node.parentElement) {
    if (node.hidden || node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true') return false;
    const style = win.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}
export function createShortcutController({ win, doc, getConfig, getScope, canRun, run, isSuspended, onPrefix = () => {}, onDiagnostic = () => {} }) {
  const matcher = createShortcutMatcher();
  let composing = false; let timer;
  const reset = () => { matcher.reset(); win.clearTimeout(timer); timer = undefined; onPrefix(false); };
  const handle = event => {
    const config = getConfig(); const scope = getScope(event);
    const editing = shortcutEditableTarget(event.composedPath?.()[0] || event.target);
    const suspended = composing || isSuspended(); const wasPrevented = event.defaultPrevented;
    const outcome = matcher.handle(event, { config, scope, editing, suspended, canRun, now: Date.now() });
    const relevant = event.ctrlKey || event.altKey || event.metaKey || Boolean(timer) || outcome.handled;
    if (outcome.handled) { event.preventDefault(); event.stopImmediatePropagation(); }
    win.clearTimeout(timer); timer = undefined;
    onPrefix(!!outcome.pending);
    if (outcome.pending) timer = win.setTimeout(reset, 1200);
    let failed = false;
    try { if (outcome.action) run(outcome.action); } catch (error) { failed = true; console.error('Session Watch shortcut action failed', error); }
    if (relevant) {
      const reason = failed ? '动作执行异常' : suspended ? '设置浮窗、录制或输入法暂停' : wasPrevented ? '已由其它控件处理'
        : event.isComposing || event.keyCode === 229 ? '输入法组词中' : !config.enabled ? '当前快捷键总开关关闭'
        : !validateShortcutConfig(config).valid ? '配置校验失败' : outcome.pending ? '已接收前缀，松开修饰键后按下一键'
        : outcome.action ? '已派发动作' : editing ? '编辑区保护或没有匹配绑定' : '没有匹配的可执行绑定（检查作用域、布局和修饰键）';
      onDiagnostic({ code: typeof event.code === 'string' && /^[A-Za-z0-9]{1,24}$/.test(event.code) ? event.code : '',
        stroke: shortcutStroke(event), scope, editing, suspended, handled: !!outcome.handled, action: outcome.action || null, reason });
    }
  };
  const start = () => { composing = true; reset(); };
  const end = () => { composing = false; reset(); };
  const blurred = () => { composing = false; reset(); };
  const hidden = () => { if (doc.visibilityState === 'hidden') blurred(); };
  // Window capture precedes native editors; only a recognized executable
  // shortcut is consumed. Recording suspends this adapter before key delivery.
  win.addEventListener('keydown', handle, true);
  win.addEventListener('blur', blurred);
  doc.addEventListener('compositionstart', start, true);
  doc.addEventListener('compositionend', end, true);
  doc.addEventListener('visibilitychange', hidden);
  return { reset, dispose() {
    reset(); win.removeEventListener('keydown', handle, true); win.removeEventListener('blur', blurred);
    doc.removeEventListener('compositionstart', start, true); doc.removeEventListener('compositionend', end, true);
    doc.removeEventListener('visibilitychange', hidden);
  } };
}
