/**
 * Pomodoro Clock — browser half.
 *
 * A compact ambient timer rendered in `conversation.composer.dock`: focus /
 * short break / long break cycle with a progress ring, play-pause, reset,
 * today's count, a settings dialog and a chime. The timer state lives in this
 * module (one store per activated plugin instance), so it keeps running while
 * the dock entry remounts as sessions change.
 */
window.__ModuleLoader__.load({
  id: '@local/pomodoro-clock',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'pomodoro-clock';
    const SETTINGS_KEY = 'dsh-pomodoro-clock:settings:v1';
    const STATS_KEY = 'dsh-pomodoro-clock:stats:v1';
    const TICK_MS = 250;

    const DEFAULTS = Object.freeze({
      focus: 25,
      short: 5,
      long: 15,
      rounds: 4,
      autoStart: false,
      sound: true,
    });

    const LIMITS = Object.freeze({
      focus: [1, 180],
      short: [1, 60],
      long: [1, 120],
      rounds: [1, 8],
    });

    const DICT = {
      en: {
        'phase.focus': 'Focus',
        'phase.short': 'Break',
        'phase.long': 'Long break',
        'action.start': 'Start',
        'action.pause': 'Pause',
        'action.reset': 'Reset',
        'action.settings': 'Settings',
        'aria.timer': 'Pomodoro timer: {phase}, {time} remaining. Click to start or pause.',
        'aria.cycle': '{done} of {total} focus sessions completed this cycle',
        'settings.title': 'Pomodoro clock',
        'settings.focus': 'Focus length',
        'settings.short': 'Short break',
        'settings.long': 'Long break',
        'settings.rounds': 'Focus sessions per cycle',
        'settings.autoStart': 'Start the next phase automatically',
        'settings.sound': 'Chime when a phase ends',
        'settings.statsToday': '{count} focus sessions completed today',
        'settings.resetStats': "Reset today's count",
        'settings.cancel': 'Cancel',
        'settings.save': 'Save',
        'settings.close': 'Close settings',
        'settings.decrease': 'Decrease',
        'settings.increase': 'Increase',
        'unit.min': 'min',
      },
      zh: {
        'phase.focus': '专注',
        'phase.short': '短休息',
        'phase.long': '长休息',
        'action.start': '开始',
        'action.pause': '暂停',
        'action.reset': '重置',
        'action.settings': '设置',
        'aria.timer': '番茄时钟：{phase}，剩余 {time}。点击开始或暂停。',
        'aria.cycle': '本轮已完成 {done} / {total} 个专注',
        'settings.title': '番茄时钟设置',
        'settings.focus': '专注时长',
        'settings.short': '短休息时长',
        'settings.long': '长休息时长',
        'settings.rounds': '每轮专注次数',
        'settings.autoStart': '自动开始下一阶段',
        'settings.sound': '阶段结束时播放提示音',
        'settings.statsToday': '今日已完成 {count} 个番茄',
        'settings.resetStats': '重置今日番茄数',
        'settings.cancel': '取消',
        'settings.save': '保存',
        'settings.close': '关闭设置',
        'settings.decrease': '减少',
        'settings.increase': '增加',
        'unit.min': '分钟',
      },
    };

    const CSS = [
      '.pomo{display:inline-flex;align-items:center;gap:4px;height:24px;font-family:inherit;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary);white-space:nowrap;user-select:none}',
      '.pomo-main{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 6px 0 2px;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer;transition:background .15s}',
      '.pomo-main:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent)}',
      '.pomo-main:focus-visible,.pomo-icon-btn:focus-visible,.pomo-toggle:focus-visible,.pomo-step:focus-visible,.pomo-text-btn:focus-visible,.pomo-primary-btn:focus-visible,.pomo-link-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.pomo-ring{display:block;flex:none}',
      '.pomo-phase{font-size:12px;font-weight:500;line-height:1}',
      '.pomo-time{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;letter-spacing:.2px;line-height:20px}',
      '.pomo-dots{display:inline-flex;align-items:center;gap:3px;padding:0 2px}',
      '.pomo-dot{width:4px;height:4px;border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 32%,transparent)}',
      '.pomo-dot-on{background:var(--dsw-alias-brand-primary)}',
      '.pomo-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:color .15s,background .15s}',
      '.pomo-icon-btn:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-secondary) 12%,transparent)}',
      '.pomo-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:color-mix(in srgb,#000 28%,transparent)}',
      '.pomo-dialog{box-sizing:border-box;width:min(340px,100%);max-height:calc(100dvh - 48px);display:flex;flex-direction:column;padding:18px 20px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);box-shadow:0 18px 48px color-mix(in srgb,#000 30%,transparent);font-family:inherit;outline:none}',
      '.pomo-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.pomo-dialog-title{margin:0;font-size:15px;font-weight:600;line-height:22px}',
      '.pomo-dialog-sub{margin:2px 0 12px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.pomo-dialog-body{display:flex;flex-direction:column;gap:2px;margin:0 -4px;padding:2px 4px;overflow:auto}',
      '.pomo-field{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:34px;padding:2px 0}',
      '.pomo-field-label{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}',
      '.pomo-stepper{display:inline-flex;flex:none;align-items:center;gap:1px;padding:1px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base)}',
      '.pomo-step{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:15px;line-height:1;cursor:pointer}',
      '.pomo-step:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-secondary) 12%,transparent);color:var(--dsw-alias-label-primary)}',
      '.pomo-step:disabled{opacity:.35;cursor:default}',
      '.pomo-number{width:32px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-variant-numeric:tabular-nums;text-align:center;appearance:textfield;-moz-appearance:textfield;outline:none}',
      '.pomo-number::-webkit-inner-spin-button,.pomo-number::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}',
      '.pomo-unit{padding-right:2px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.pomo-toggle{position:relative;flex:none;width:36px;height:20px;padding:0;border:0;border-radius:999px;background:var(--dsw-alias-border-l2);cursor:pointer;transition:background .15s}',
      '.pomo-toggle[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}',
      '.pomo-toggle::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-bg-base);box-shadow:0 1px 2px color-mix(in srgb,#000 25%,transparent);transition:transform .15s}',
      '.pomo-toggle[aria-checked="true"]::after{transform:translateX(16px)}',
      '.pomo-dialog-footer{display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.pomo-footer-spacer{flex:1}',
      '.pomo-text-btn,.pomo-primary-btn,.pomo-link-btn{height:28px;padding:0 10px;border:0;border-radius:8px;font:inherit;font-size:13px;cursor:pointer}',
      '.pomo-text-btn{background:transparent;color:var(--dsw-alias-label-secondary)}',
      '.pomo-text-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 12%,transparent);color:var(--dsw-alias-label-primary)}',
      '.pomo-link-btn{padding:0 2px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.pomo-link-btn:hover{color:var(--dsw-alias-state-error-primary)}',
      '.pomo-primary-btn{padding:0 14px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);color:var(--dsw-alias-brand-primary);font-weight:500}',
      '.pomo-primary-btn:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}',
      '.pomo-dialog .pomo-icon-btn{width:24px;height:24px}',
    ].join('\n');

    /* ------------------------------------------------------------------ */
    /* Persistence helpers                                                 */
    /* ------------------------------------------------------------------ */

    function readJson(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        return parsed !== null && typeof parsed === 'object' ? parsed : fallback;
      } catch (error) {
        return fallback;
      }
    }

    function writeJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        /* storage may be unavailable; the timer still works in memory */
      }
    }

    function clampInt(value, fallback, min, max) {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numeric)) return fallback;
      return Math.min(max, Math.max(min, Math.round(numeric)));
    }

    function normalizeSettings(value) {
      const source = value !== null && typeof value === 'object' ? value : {};
      return {
        focus: clampInt(source.focus, DEFAULTS.focus, LIMITS.focus[0], LIMITS.focus[1]),
        short: clampInt(source.short, DEFAULTS.short, LIMITS.short[0], LIMITS.short[1]),
        long: clampInt(source.long, DEFAULTS.long, LIMITS.long[0], LIMITS.long[1]),
        rounds: clampInt(source.rounds, DEFAULTS.rounds, LIMITS.rounds[0], LIMITS.rounds[1]),
        autoStart: source.autoStart === true,
        sound: source.sound !== false,
      };
    }

    function dayKey(timestamp) {
      const date = new Date(timestamp);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}`;
    }

    function loadStats(now) {
      const day = dayKey(now);
      const stored = readJson(STATS_KEY, null);
      if (stored !== null && stored.day === day && typeof stored.count === 'number') {
        return { day, count: Math.max(0, Math.floor(stored.count)) };
      }
      return { day, count: 0 };
    }

    function saveStats(stats) {
      writeJson(STATS_KEY, stats);
    }

    function formatClock(ms) {
      const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /* ------------------------------------------------------------------ */
    /* Timer store                                                         */
    /* ------------------------------------------------------------------ */

    function createStore() {
      let settings = normalizeSettings(readJson(SETTINGS_KEY, DEFAULTS));
      let stats = loadStats(Date.now());
      let phase = 'focus';
      let cycleDone = 0;
      let running = false;
      let phaseTotalMs = settings.focus * 60000;
      let remainingMs = phaseTotalMs;
      let endsAt = 0;
      let tickId = null;
      let audio = null;
      const listeners = new Set();

      function phaseDurationMs() {
        if (phase === 'focus') return settings.focus * 60000;
        if (phase === 'short') return settings.short * 60000;
        return settings.long * 60000;
      }

      function snapshot() {
        return {
          phase,
          cycleDone,
          running,
          remainingMs,
          totalMs: phaseTotalMs,
          completedToday: stats.count,
          settings: {
            focus: settings.focus,
            short: settings.short,
            long: settings.long,
            rounds: settings.rounds,
            autoStart: settings.autoStart,
            sound: settings.sound,
          },
        };
      }

      function emit() {
        const state = snapshot();
        listeners.forEach((listener) => listener(state));
      }

      function subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }

      function arm() {
        if (tickId !== null) return;
        tickId = window.setInterval(tick, TICK_MS);
      }

      function disarm() {
        if (tickId === null) return;
        window.clearInterval(tickId);
        tickId = null;
      }

      function ensureAudio() {
        if (!settings.sound) return null;
        try {
          if (audio === null) {
            const AudioCtor = window.AudioContext || window.webkitAudioContext;
            if (typeof AudioCtor !== 'function') return null;
            audio = new AudioCtor();
          }
          if (audio.state === 'suspended' && typeof audio.resume === 'function') {
            audio.resume().catch(() => {});
          }
          return audio;
        } catch (error) {
          return null;
        }
      }

      function chime() {
        if (!settings.sound) return;
        const context = ensureAudio();
        if (context === null) return;
        try {
          const startAt = context.currentTime;
          [880, 1174.66].forEach((frequency, index) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            const at = startAt + index * 0.16;
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.linearRampToValueAtTime(0.16, at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(at);
            oscillator.stop(at + 0.38);
          });
        } catch (error) {
          /* audio unavailable */
        }
      }

      function finish() {
        const finishedPhase = phase;
        running = false;
        disarm();
        endsAt = 0;
        remainingMs = 0;
        if (finishedPhase === 'focus') {
          const today = dayKey(Date.now());
          stats = { day: today, count: (stats.day === today ? stats.count : 0) + 1 };
          saveStats(stats);
          cycleDone = Math.min(settings.rounds, cycleDone + 1);
        }
        chime();
        if (finishedPhase === 'long') cycleDone = 0;
        if (finishedPhase === 'focus') {
          phase = cycleDone >= settings.rounds ? 'long' : 'short';
        } else {
          phase = 'focus';
        }
        phaseTotalMs = phaseDurationMs();
        remainingMs = phaseTotalMs;
        emit();
        if (settings.autoStart) start();
      }

      function tick() {
        const left = endsAt - Date.now();
        if (left <= 0) {
          remainingMs = 0;
          finish();
          return;
        }
        const previousSecond = Math.ceil(remainingMs / 1000);
        remainingMs = left;
        if (Math.ceil(left / 1000) !== previousSecond) emit();
      }

      function start() {
        if (running) return;
        if (remainingMs <= 0) {
          phaseTotalMs = phaseDurationMs();
          remainingMs = phaseTotalMs;
        }
        running = true;
        endsAt = Date.now() + remainingMs;
        ensureAudio();
        arm();
        emit();
      }

      function pause() {
        if (!running) return;
        running = false;
        remainingMs = Math.max(0, endsAt - Date.now());
        endsAt = 0;
        disarm();
        if (remainingMs <= 0) {
          finish();
          return;
        }
        emit();
      }

      function toggle() {
        if (running) pause();
        else start();
      }

      function reset() {
        running = false;
        disarm();
        endsAt = 0;
        phaseTotalMs = phaseDurationMs();
        remainingMs = phaseTotalMs;
        emit();
      }

      function updateSettings(patch) {
        settings = normalizeSettings(Object.assign({}, settings, patch));
        writeJson(SETTINGS_KEY, settings);
        cycleDone = Math.min(cycleDone, settings.rounds);
        if (!running) {
          phaseTotalMs = phaseDurationMs();
          remainingMs = phaseTotalMs;
        }
        emit();
      }

      function resetStats() {
        stats = { day: dayKey(Date.now()), count: 0 };
        saveStats(stats);
        emit();
      }

      function dispose() {
        disarm();
        listeners.clear();
        if (audio !== null && typeof audio.close === 'function') {
          try {
            audio.close().catch(() => {});
          } catch (error) {
            /* already closed */
          }
        }
        audio = null;
      }

      return {
        getState: snapshot,
        subscribe,
        start,
        pause,
        toggle,
        reset,
        updateSettings,
        resetStats,
        dispose,
      };
    }

    /* ------------------------------------------------------------------ */
    /* Icons                                                               */
    /* ------------------------------------------------------------------ */

    function svg(viewBox, width, height, children) {
      return h(
        'svg',
        { viewBox, width, height, 'aria-hidden': true, focusable: 'false', className: 'pomo-ring' },
        children,
      );
    }

    function Ring(props) {
      const radius = 6.5;
      const circumference = 2 * Math.PI * radius;
      const progress = Math.min(1, Math.max(0, props.progress));
      const offset = circumference * (1 - progress);
      const icon = props.running
        ? [
            h('rect', { key: 'l', x: 5.9, y: 5.7, width: 1.7, height: 4.6, rx: 0.6, fill: 'var(--dsw-alias-label-primary)' }),
            h('rect', { key: 'r', x: 8.4, y: 5.7, width: 1.7, height: 4.6, rx: 0.6, fill: 'var(--dsw-alias-label-primary)' }),
          ]
        : h('path', { d: 'M6.9 5.9 10.4 8 6.9 10.1 Z', fill: 'var(--dsw-alias-label-primary)' });
      return svg('0 0 16 16', 16, 16, [
        h('circle', {
          key: 'track',
          cx: 8,
          cy: 8,
          r: radius,
          fill: 'none',
          stroke: 'var(--dsw-alias-border-l2)',
          strokeWidth: 2,
        }),
        h('circle', {
          key: 'progress',
          cx: 8,
          cy: 8,
          r: radius,
          fill: 'none',
          stroke: props.color,
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeDasharray: `${circumference} ${circumference}`,
          strokeDashoffset: offset,
          transform: 'rotate(-90 8 8)',
          style: { transition: 'stroke-dashoffset .4s linear' },
        }),
        h('g', { key: 'icon' }, icon),
      ]);
    }

    function resetIcon() {
      return svg('0 0 16 16', 14, 14, [
        h('path', {
          key: 'arc',
          d: 'M3.5 8.2a4.6 4.6 0 1 0 1.4-3.3',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
        }),
        h('path', {
          key: 'arrow',
          d: 'M4.2 2.3v3.1h3.1',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      ]);
    }

    function settingsIcon() {
      return svg('0 0 16 16', 14, 14, [
        h('path', {
          key: 'lines',
          d: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          opacity: 0.55,
        }),
        h('rect', { key: 'k1', x: 4.4, y: 3.1, width: 2.6, height: 2.8, rx: 1, fill: 'currentColor' }),
        h('rect', { key: 'k2', x: 9.1, y: 6.6, width: 2.6, height: 2.8, rx: 1, fill: 'currentColor' }),
        h('rect', { key: 'k3', x: 6.2, y: 10.1, width: 2.6, height: 2.8, rx: 1, fill: 'currentColor' }),
      ]);
    }

    function closeIcon() {
      return svg('0 0 16 16', 14, 14, [
        h('path', {
          key: 'x',
          d: 'M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
      ]);
    }

    /* ------------------------------------------------------------------ */
    /* Hooks                                                               */
    /* ------------------------------------------------------------------ */

    function useStoreState(store) {
      const [state, setState] = React.useState(store.getState);
      React.useEffect(() => store.subscribe(setState), [store]);
      return state;
    }

    function useLocaleRevision(locale) {
      const [revision, setRevision] = React.useState(() => locale.getSnapshot().revision);
      React.useEffect(
        () => locale.subscribe(() => setRevision(locale.getSnapshot().revision)),
        [locale],
      );
      return revision;
    }

    /* ------------------------------------------------------------------ */
    /* Settings dialog                                                     */
    /* ------------------------------------------------------------------ */

    function SettingsDialog(props) {
      const store = props.store;
      const t = props.t;
      const state = props.state;
      const onClose = props.onClose;
      const [draft, setDraft] = React.useState(state.settings);
      const dialogRef = React.useRef(null);

      React.useEffect(() => {
        if (dialogRef.current !== null && typeof dialogRef.current.focus === 'function') {
          dialogRef.current.focus();
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
      }, [onClose]);

      const update = (patch) => setDraft((current) => Object.assign({}, current, patch));

      const stepBy = (key, delta) => {
        const limits = LIMITS[key];
        setDraft((current) => {
          const next = Math.min(limits[1], Math.max(limits[0], current[key] + delta));
          return Object.assign({}, current, { [key]: next });
        });
      };

      const numberRow = (key, label) => {
        const limits = LIMITS[key];
        return h(
          'div',
          { className: 'pomo-field', key },
          h('span', { className: 'pomo-field-label' }, label),
          h(
            'span',
            { className: 'pomo-stepper' },
            h(
              'button',
              {
                type: 'button',
                className: 'pomo-step',
                'aria-label': `${t('settings.decrease')} ${label}`,
                disabled: draft[key] <= limits[0],
                onClick: () => stepBy(key, -1),
              },
              '\u2212',
            ),
            h('input', {
              className: 'pomo-number',
              type: 'number',
              inputMode: 'numeric',
              min: limits[0],
              max: limits[1],
              value: draft[key],
              'aria-label': `${label} (${t('unit.min')})`,
              onChange: (event) => {
                const parsed = Number(event.target.value);
                if (!Number.isFinite(parsed)) return;
                const next = Math.min(limits[1], Math.max(limits[0], Math.round(parsed)));
                update({ [key]: next });
              },
            }),
            h('span', { className: 'pomo-unit', 'aria-hidden': true }, t('unit.min')),
            h(
              'button',
              {
                type: 'button',
                className: 'pomo-step',
                'aria-label': `${t('settings.increase')} ${label}`,
                disabled: draft[key] >= limits[1],
                onClick: () => stepBy(key, 1),
              },
              '+',
            ),
          ),
        );
      };

      const toggleRow = (key, label) =>
        h(
          'div',
          { className: 'pomo-field', key },
          h('span', { className: 'pomo-field-label' }, label),
          h('button', {
            type: 'button',
            className: 'pomo-toggle',
            role: 'switch',
            'aria-checked': draft[key],
            'aria-label': label,
            onClick: () => update({ [key]: !draft[key] }),
          }),
        );

      return h(
        'div',
        {
          className: 'pomo-dialog',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('settings.title'),
          tabIndex: -1,
          ref: dialogRef,
        },
        h(
          'div',
          { className: 'pomo-dialog-head' },
          h('h2', { className: 'pomo-dialog-title' }, t('settings.title')),
          h(
            'button',
            {
              type: 'button',
              className: 'pomo-icon-btn',
              'aria-label': t('settings.close'),
              title: t('settings.close'),
              onClick: onClose,
            },
            closeIcon(),
          ),
        ),
        h('p', { className: 'pomo-dialog-sub' }, t('settings.statsToday', { count: state.completedToday })),
        h(
          'div',
          { className: 'pomo-dialog-body' },
          numberRow('focus', t('settings.focus')),
          numberRow('short', t('settings.short')),
          numberRow('long', t('settings.long')),
          numberRow('rounds', t('settings.rounds')),
          toggleRow('autoStart', t('settings.autoStart')),
          toggleRow('sound', t('settings.sound')),
        ),
        h(
          'div',
          { className: 'pomo-dialog-footer' },
          h(
            'button',
            {
              type: 'button',
              className: 'pomo-link-btn',
              onClick: () => store.resetStats(),
            },
            t('settings.resetStats'),
          ),
          h('span', { className: 'pomo-footer-spacer' }),
          h(
            'button',
            { type: 'button', className: 'pomo-text-btn', onClick: onClose },
            t('settings.cancel'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pomo-primary-btn',
              onClick: () => {
                store.updateSettings(draft);
                onClose();
              },
            },
            t('settings.save'),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Dock entry                                                          */
    /* ------------------------------------------------------------------ */

    function DockEntry(props) {
      const store = props.store;
      const t = props.t;
      const state = useStoreState(store);
      useLocaleRevision(props.locale);
      const [settingsOpen, setSettingsOpen] = React.useState(false);
      const closeSettings = React.useCallback(() => setSettingsOpen(false), []);

      const isBreak = state.phase !== 'focus';
      const accent = isBreak
        ? 'var(--dsw-alias-state-success-primary)'
        : 'var(--dsw-alias-brand-primary)';
      const time = formatClock(state.remainingMs);
      const phaseText = t(`phase.${state.phase}`);
      const progress = state.totalMs > 0 ? state.remainingMs / state.totalMs : 0;
      const ariaTimer = t('aria.timer', { phase: phaseText, time });
      const ariaCycle = t('aria.cycle', { done: state.cycleDone, total: state.settings.rounds });
      const dots = [];
      for (let index = 0; index < state.settings.rounds; index += 1) {
        dots.push(
          h('span', {
            key: index,
            className: index < state.cycleDone ? 'pomo-dot pomo-dot-on' : 'pomo-dot',
          }),
        );
      }

      return h(
        React.Fragment,
        null,
        h('style', { key: 'styles' }, CSS),
        h(
          'span',
          { key: 'pill', className: 'pomo' },
          h(
            'button',
            {
              type: 'button',
              className: 'pomo-main',
              onClick: store.toggle,
              'aria-label': ariaTimer,
              title: `${state.running ? t('action.pause') : t('action.start')} · ${phaseText} ${time}`,
            },
            h(Ring, { progress, running: state.running, color: accent }),
            h(
              'span',
              {
                className: 'pomo-phase',
                style: state.running ? { color: accent } : undefined,
              },
              phaseText,
            ),
            h('span', { className: 'pomo-time' }, time),
          ),
          h('span', { className: 'pomo-dots', 'aria-hidden': true, title: ariaCycle }, dots),
          h(
            'button',
            {
              type: 'button',
              className: 'pomo-icon-btn',
              onClick: store.reset,
              'aria-label': t('action.reset'),
              title: t('action.reset'),
            },
            resetIcon(),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pomo-icon-btn',
              onClick: () => setSettingsOpen(true),
              'aria-label': t('action.settings'),
              title: t('action.settings'),
              'aria-haspopup': 'dialog',
              'aria-expanded': settingsOpen,
            },
            settingsIcon(),
          ),
        ),
        settingsOpen
          ? h(
              'div',
              {
                key: 'backdrop',
                className: 'pomo-backdrop',
                onMouseDown: (event) => {
                  if (event.target === event.currentTarget) setSettingsOpen(false);
                },
              },
              h(SettingsDialog, {
                store,
                t,
                state,
                onClose: closeSettings,
              }),
            )
          : null,
      );
    }

    /* ------------------------------------------------------------------ */
    /* Plugin                                                              */
    /* ------------------------------------------------------------------ */

    function apply(ctx) {
      const store = createStore();
      ctx.effect(() => () => store.dispose(), 'pomodoro-clock: timer lifecycle');
      ctx.effect(
        () => ctx.locale.register(NS, 'en', DICT.en),
        'pomodoro-clock: English dictionary',
      );
      ctx.effect(
        () => ctx.locale.register(NS, 'zh', DICT.zh),
        'pomodoro-clock: Chinese dictionary',
      );
      const translate = ctx.locale.bind(NS);
      const locale = ctx.locale;

      function ComposerDockEntry() {
        return h(DockEntry, { store, t: translate, locale });
      }

      ctx.slots.inject('conversation.composer.dock', () =>
        ctx.slots.register(
          {
            name: 'conversation.composer.dock',
            id: 'pomodoro-clock',
            order: 6,
          },
          ComposerDockEntry,
        ),
      );
    }

    return { inject: ['slots', 'locale'], apply };
  },
});
