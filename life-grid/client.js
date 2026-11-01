/**
 * Life Grid — browser half.
 *
 * A yearly nine-grid planner following Chapter 2 of 《只管去做》 (邹小强):
 * eight life areas around one yearly theme, goals per area, focus-area marks
 * and a five-year vision in the center. Registers a left-sidebar panel icon and
 * the matching main-column page. Data is stored in this browser, one entry per
 * year, and can be exported / imported as JSON.
 */
window.__ModuleLoader__.load({
  id: '@local/life-grid',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'life-grid';
    const PANEL_ID = 'life-grid';
    const STORAGE_KEY = 'dsh-life-grid/v1';

    const AREA_IDS = [
      'growth',
      'experience',
      'leisure',
      'work',
      'family',
      'health',
      'finance',
      'social',
    ];

    const DICT = {
      en: {
        'panel.label': 'Life Grid',
        'page.title': 'Life Grid',
        'page.subtitle':
          'An annual nine-grid after 《只管去做》 (Zou Xiaoqiang): eight life areas around one yearly theme.',
        'summary.goals': '{count} goals',
        'summary.focus': '{count} focus areas',
        'summary.empty': '{count} areas still blank',
        'year.prev': 'Previous year',
        'year.next': 'Next year',
        'year.thisYear': 'This year',
        'center.year': '{year} plan',
        'center.themeLabel': 'Theme of the year',
        'center.themePlaceholder': 'e.g. Steady pace, grow outward',
        'center.visionLabel': 'The life I want in five years',
        'center.visionPlaceholder':
          'Describe an ordinary ideal day with what you see, hear and feel…',
        'center.note':
          'Balance is not equal division. A stage may lean on one area — just see what it costs elsewhere.',
        'area.growth': 'Learning & growth',
        'area.experience': 'New experiences',
        'area.leisure': 'Rest & leisure',
        'area.work': 'Work & career',
        'area.family': 'Family & life',
        'area.health': 'Health',
        'area.finance': 'Money & finance',
        'area.social': 'Community & people',
        'cell.focusOn': "Mark as this year's focus",
        'cell.focusOff': 'Remove the focus mark',
        'cell.focusBadge': 'Focus area',
        'cell.empty': 'Nothing yet',
        'cell.add': 'Add goal',
        'goal.edit': 'Edit goal',
        'goal.delete': 'Delete goal',
        'goal.confirmDelete': 'Delete',
        'goal.cancelDelete': 'Cancel',
        'form.goalPlaceholder': 'The stage result I want this year…',
        'form.notePlaceholder':
          'How I will verify it (optional, e.g. finish 6 talks and review the notes)…',
        'form.save': 'Save',
        'form.cancel': 'Cancel',
        'form.hint': '⌘/Ctrl + Enter saves · Esc cancels',
        'actions.copy': 'Copy as Markdown',
        'actions.export': 'Export JSON',
        'actions.import': 'Import JSON',
        'actions.help': 'How to use',
        'notice.exported': 'Exported the grid as JSON',
        'notice.copied': 'Grid copied as Markdown',
        'notice.copyFailed': 'Copy failed — select the text manually',
        'notice.imported': 'Imported {count} year(s)',
        'notice.importFailed': 'Import failed: this file is not a Life Grid backup',
        'md.theme': 'Theme: {value}',
        'md.vision': 'Five-year vision:',
        'md.focus': 'Focus areas',
        'md.colon': ': ',
        'md.list': ', ',
        'help.title': 'How to use the nine-grid',
        'help.intro':
          'Built on Chapter 2 of 《只管去做》 by Zou Xiaoqiang: balance eight areas, then turn a vague vision into verifiable yearly goals.',
        'help.step1.title': '1 · Vision inventory',
        'help.step1.body':
          'Draw the grid and place what the five-year letter describes into the eight areas. Notice what is missing or crowded out — balance is not equal division, and a stage may focus on one area.',
        'help.step2.title': '2 · Define → plan → goal',
        'help.step2.body':
          "Define the vision in your own words, compare current reality with it, pick a path, then set this year's stage result, deadline and way to verify. Put the goal back into its area.",
        'help.step3.title': '3 · Reasonable check',
        'help.step3.body':
          'Check goals with SMART, estimate the time each needs, subtract fixed commitments, and adjust order, scope or deadline when the total exceeds your capacity.',
        'help.step4.title': '4 · Choose focus areas',
        'help.step4.body':
          'Mark the areas this stage needs most. The star marks priorities — it is not a promise to fill every box.',
        'help.data':
          'This grid is saved in the current browser only (one entry per year). Export a JSON backup regularly; import merges by year.',
        'help.close': 'Close',
      },
      zh: {
        'panel.label': '人生九宫格',
        'page.title': '人生九宫格',
        'page.subtitle':
          '参考《只管去做》（邹小强）第二章：八个生活领域围绕一个年度主题，把愿景孵化成今年的目标。',
        'summary.goals': '{count} 条目标',
        'summary.focus': '{count} 个重点领域',
        'summary.empty': '{count} 个领域空缺',
        'year.prev': '上一年',
        'year.next': '下一年',
        'year.thisYear': '回到今年',
        'center.year': '{year} 年度',
        'center.themeLabel': '年度主题',
        'center.themePlaceholder': '例如：稳住节奏，向外生长',
        'center.visionLabel': '五年后想过的生活',
        'center.visionPlaceholder':
          '用看到、听到、闻到的细节，写一个理想的普通日子……',
        'center.note':
          '平衡不等于平均分配；允许阶段性偏重，但要看清它对其他领域的影响。',
        'area.growth': '学习成长',
        'area.experience': '体验突破',
        'area.leisure': '休闲放松',
        'area.work': '工作事业',
        'area.family': '家庭生活',
        'area.health': '身体健康',
        'area.finance': '财务理财',
        'area.social': '人际社群',
        'cell.focusOn': '标为今年重点',
        'cell.focusOff': '取消重点标记',
        'cell.focusBadge': '重点领域',
        'cell.empty': '还没写',
        'cell.add': '添加目标',
        'goal.edit': '编辑目标',
        'goal.delete': '删除目标',
        'goal.confirmDelete': '删除',
        'goal.cancelDelete': '取消',
        'form.goalPlaceholder': '今年想达成的阶段成果……',
        'form.notePlaceholder':
          '完成标准 / 验证方式（可选，如：独立完成 6 次讲解并记录改进）……',
        'form.save': '保存',
        'form.cancel': '取消',
        'form.hint': '⌘/Ctrl + Enter 保存 · Esc 取消',
        'actions.copy': '复制为 Markdown',
        'actions.export': '导出 JSON',
        'actions.import': '导入 JSON',
        'actions.help': '怎么用',
        'notice.exported': '已导出 JSON 备份',
        'notice.copied': '已复制为 Markdown',
        'notice.copyFailed': '复制失败，请手动选择文本',
        'notice.imported': '已导入 {count} 个年度的数据',
        'notice.importFailed': '导入失败：这不是有效的人生九宫格备份',
        'md.theme': '主题：{value}',
        'md.vision': '五年愿景：',
        'md.focus': '重点领域',
        'md.colon': '：',
        'md.list': '、',
        'help.title': '怎么用九宫格',
        'help.intro':
          '按《只管去做》（邹小强）第二章整理：先盘点八个领域的愿景，再把模糊愿景孵化成可验证的年度目标。',
        'help.step1.title': '1 · 愿景盘点',
        'help.step1.body':
          '先画九宫格，把五年信里的愿景放进对应领域，观察哪些被忽略或挤占。平衡不等于平均分配，阶段性偏重也可以，但要看清影响。',
        'help.step2.title': '2 · 定义 → 计划 → 目标',
        'help.step2.body':
          '先用自己的话定义“变好”的样子，再比较现状与愿景、选择路径，最后确定今年要到的阶段成果、完成时间和验证方式，放回九宫格。',
        'help.step3.title': '3 · 合理性检查',
        'help.step3.body':
          '用 SMART 检查目标，估算每个目标所需时间，扣除工作、睡眠和家庭等固定占用；总需求超过可支配时间时，调整顺序、范围或期限。',
        'help.step4.title': '4 · 选择重点领域',
        'help.step4.body':
          '根据现阶段需求，用星标选出今年的重点领域。星标是优先级，不是要求填满每一格。',
        'help.data':
          '九宫格只保存在当前浏览器（按年度各一份）。建议定期导出 JSON 备份；导入时按年度合并。',
        'help.close': '关闭',
      },
    };

    const CSS = [
      '.lgk-page{box-sizing:border-box;width:100%;height:100%;min-width:0;min-height:0;display:flex;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}',
      '.lgk-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}',
      '.lgk-content{container-type:inline-size;max-width:1120px;margin:0 auto;padding:0 clamp(20px,3.4vw,44px) 56px}',
      '.lgk-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;padding-top:28px;margin-bottom:18px}',
      '[data-platform=darwin] .lgk-head{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}',
      '.lgk-title{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.lgk-title h1{margin:0;font-size:20px;font-weight:500;line-height:28px}',
      '.lgk-sub{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:20px}',
      '.lgk-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}',
      '.lgk-chip{border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 8px;font-size:11.5px;line-height:18px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.lgk-chip-warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,var(--dsw-alias-border-l1))}',
      '.lgk-head-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.lgk-yearbox{display:inline-flex;align-items:center;height:30px;padding:0 2px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.lgk-yearnum{min-width:46px;text-align:center;font-size:13px;font-weight:600;line-height:20px;font-variant-numeric:tabular-nums}',
      '.lgk-thisyear{height:24px;margin-left:2px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:11.5px;cursor:pointer}',
      '.lgk-thisyear:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}',
      '.lgk-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .15s,color .15s}',
      '.lgk-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent));color:var(--dsw-alias-label-primary)}',
      '.lgk-icon-btn:focus-visible,.lgk-add:focus-visible,.lgk-star:focus-visible,.lgk-btn:focus-visible,.lgk-goal-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.lgk-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-areas:"growth experience leisure" "work center family" "health finance social";gap:14px}',
      '.lgk-cell{box-sizing:border-box;display:flex;flex-direction:column;min-width:0;min-height:200px;padding:14px;border:.5px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1)}',
      '.lgk-cell-focus{border-color:var(--dsw-alias-brand-primary);box-shadow:inset 0 0 0 .5px var(--dsw-alias-brand-primary)}',
      '.lgk-cell-head{display:flex;align-items:center;gap:7px;min-width:0}',
      '.lgk-glyph{flex:none;color:var(--dsw-alias-label-secondary)}',
      '.lgk-cell-title{margin:0;min-width:0;font-size:13.5px;font-weight:600;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lgk-cell-focus .lgk-cell-title{color:var(--dsw-alias-brand-primary)}',
      '.lgk-count{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:16px;padding:0 5px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;font-variant-numeric:tabular-nums}',
      '.lgk-star{margin-left:auto;flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.lgk-star:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent));color:var(--dsw-alias-label-primary)}',
      '.lgk-star-on{color:var(--dsw-alias-brand-primary)}',
      '.lgk-goals{display:flex;flex-direction:column;gap:6px;flex:1;margin:10px 0 0;padding:0;list-style:none}',
      '.lgk-goal{display:flex;align-items:flex-start;gap:6px;padding:7px 8px;border-radius:10px;background:var(--dsw-alias-bg-layer-2)}',
      '.lgk-goal-body{flex:1;min-width:0}',
      '.lgk-goal-text{margin:0;font-size:13px;line-height:19px;overflow-wrap:anywhere}',
      '.lgk-goal-note{margin:2px 0 0;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}',
      '.lgk-goal-actions{display:flex;flex:none;align-items:center;gap:2px;opacity:0;transition:opacity .12s}',
      '.lgk-goal:hover .lgk-goal-actions,.lgk-goal:focus-within .lgk-goal-actions,.lgk-goal-confirming .lgk-goal-actions{opacity:1}',
      '.lgk-goal-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.lgk-goal-btn:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 12%,transparent));color:var(--dsw-alias-label-primary)}',
      '.lgk-goal-btn-danger{color:var(--dsw-alias-state-error-primary)}',
      '.lgk-add{display:inline-flex;align-items:center;justify-content:center;gap:4px;width:100%;min-height:30px;margin-top:8px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}',
      '.lgk-add:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.lgk-empty{margin:10px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);opacity:.75}',
      '.lgk-form{display:flex;flex-direction:column;gap:6px;margin-top:8px;min-width:0}',
      '.lgk-goal-form{padding:0;background:transparent}',
      '.lgk-input{box-sizing:border-box;width:100%;min-height:0;padding:7px 9px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:18px;resize:vertical}',
      '.lgk-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.72}',
      '.lgk-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.lgk-input-note{font-size:12px}',
      '.lgk-form-foot{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
      '.lgk-hint{margin-right:auto;padding:2px 0;font-size:11px;line-height:15px;color:var(--dsw-alias-label-secondary);opacity:.8}',
      '.lgk-btn{height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}',
      '.lgk-btn:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent))}',
      '.lgk-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,var(--dsw-alias-border-l1))}',
      '.lgk-btn-primary{border-color:transparent;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);color:var(--dsw-alias-brand-primary);font-weight:500}',
      '.lgk-btn-primary:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}',
      '.lgk-center{grid-area:center;border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 6%,var(--dsw-alias-bg-layer-1))}',
      '.lgk-center-year{display:block;margin-bottom:4px;font-size:16px;font-weight:600;line-height:22px;font-variant-numeric:tabular-nums}',
      '.lgk-label{display:block;margin:9px 0 4px;font-size:11.5px;font-weight:500;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.lgk-center .lgk-input{background:var(--dsw-alias-bg-base)}',
      '.lgk-center-note{margin:10px 0 0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary)}',
      '.lgk-notice{margin:0 0 14px;padding:7px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.lgk-notice[data-kind=error]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,var(--dsw-alias-border-l1))}',
      '.lgk-notice[data-kind=ok]{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 40%,var(--dsw-alias-border-l1))}',
      '.lgk-file{display:none}',
      '.lgk-foot{margin-top:14px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);opacity:.8}',
      '.lgk-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:color-mix(in srgb,#000 30%,transparent)}',
      '.lgk-dialog{box-sizing:border-box;display:flex;flex-direction:column;width:min(560px,100%);max-height:calc(100dvh - 48px);padding:20px 22px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);box-shadow:0 24px 64px color-mix(in srgb,#000 32%,transparent);outline:none}',
      '.lgk-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.lgk-dialog-title{margin:0;font-size:16px;font-weight:600;line-height:24px}',
      '.lgk-dialog-intro{margin:4px 0 12px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.lgk-steps{display:flex;flex-direction:column;gap:10px;overflow:auto;margin:0 -4px;padding:2px 4px}',
      '.lgk-step{padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.lgk-step h3{margin:0 0 2px;font-size:12.5px;font-weight:600;line-height:18px}',
      '.lgk-step p{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.lgk-dialog-note{margin:12px 0 0;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary)}',
      '.lgk-dialog-foot{display:flex;justify-content:flex-end;margin-top:12px}',
      '@container (max-width: 780px){.lgk-grid{grid-template-columns:minmax(0,1fr);grid-template-areas:"center" "growth" "experience" "leisure" "work" "family" "health" "finance" "social"}.lgk-cell{min-height:0}}',
      '@media (max-width: 760px){.lgk-grid{grid-template-columns:minmax(0,1fr);grid-template-areas:"center" "growth" "experience" "leisure" "work" "family" "health" "finance" "social"}.lgk-cell{min-height:0}}',
    ].join('\n');

    /* ------------------------------------------------------------------ */
    /* Glyphs                                                              */
    /* ------------------------------------------------------------------ */

    const STROKE = Object.freeze({
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    });

    function strokePath(d, extra) {
      return { tag: 'path', attrs: Object.assign({}, STROKE, { d }, extra) };
    }

    function strokeCircle(cx, cy, r, extra) {
      return { tag: 'circle', attrs: Object.assign({}, STROKE, { cx, cy, r }, extra) };
    }

    function strokeRect(x, y, width, height, extra) {
      return { tag: 'rect', attrs: Object.assign({}, STROKE, { x, y, width, height }, extra) };
    }

    const AREA_GLYPHS = {
      growth: [
        strokePath(
          'M8 5.1C6.9 4 5 3.7 3.2 3.7v8.6c1.8 0 3.7.3 4.8 1.4 1.1-1.1 3-1.4 4.8-1.4V3.7C11 3.7 9.1 4 8 5.1Z',
        ),
        strokePath('M8 5.1v8.6'),
      ],
      experience: [strokePath('M8 2.8l1.5 3.7 3.7 1.5-3.7 1.5L8 13.2 6.5 9.5 2.8 8l3.7-1.5Z')],
      leisure: [
        strokeCircle(8, 8, 2.6),
        strokePath(
          'M8 1.9v1.5M8 12.6v1.5M1.9 8h1.5M12.6 8h1.5M3.7 3.7l1.1 1.1M11.2 11.2l1.1 1.1M12.3 3.7l-1.1 1.1M4.8 11.2l-1.1 1.1',
        ),
      ],
      work: [
        strokeRect(2.8, 5, 10.4, 7.2, { rx: 1.4 }),
        strokePath('M6 5V3.8h4V5'),
        strokePath('M2.8 8.6h10.4'),
      ],
      family: [
        strokePath('M2.9 7.4 8 3.3l5.1 4.1v5.4H2.9Z'),
        strokePath('M6.3 12.8V9.3h3.4v3.5'),
      ],
      health: [strokePath('M8 12.8 4 8.8a3 3 0 0 1 4-4.5 3 3 0 0 1 4 4.5Z')],
      finance: [
        strokeCircle(8, 8, 4.1),
        strokePath('M6.1 5.4 8 7.6l1.9-2.2M8 7.6v3.3M6.4 8.6h3.2M6.4 10.1h3.2'),
      ],
      social: [
        strokeCircle(5.6, 6.1, 1.7),
        strokePath('M2.9 12.6c0-1.5 1.2-2.7 2.7-2.7s2.7 1.2 2.7 2.7'),
        strokeCircle(10.9, 5.3, 1.4),
        strokePath('M9.8 9.9c1.4-.2 2.5.9 2.6 2.3'),
      ],
    };

    const ACTION_GLYPHS = {
      left: [strokePath('M10 4 6 8l4 4')],
      right: [strokePath('M6 4l4 4-4 4')],
      copy: [
        strokeRect(5.6, 2.8, 7, 8.2, { rx: 1.3 }),
        strokePath('M3.4 5.2v6.3a1.5 1.5 0 0 0 1.5 1.5h6.3'),
      ],
      download: [
        strokePath('M8 3v7.3'),
        strokePath('M5.1 7.5 8 10.4l2.9-2.9'),
        strokePath('M3.6 12.8h8.8'),
      ],
      upload: [
        strokePath('M8 10.6V3.3'),
        strokePath('M5.1 6.2 8 3.3l2.9 2.9'),
        strokePath('M3.6 12.8h8.8'),
      ],
      help: [
        strokeCircle(8, 8, 5.8),
        strokePath('M6.3 6.4a1.7 1.7 0 1 1 2.4 1.6c-.5.2-.7.6-.7 1.1v.3'),
        { tag: 'circle', attrs: { cx: 8, cy: 11.2, r: 0.75, fill: 'currentColor', stroke: 'none' } },
      ],
      edit: [
        strokePath('M3.4 12.6l.6-2.6 6.1-6.1 2 2-6.1 6.1Z'),
        strokePath('M9.4 4.6l2 2'),
      ],
      close: [strokePath('M4.6 5.4 11.4 12.2M11.4 5.4 4.6 12.2')],
      star: [
        strokePath('M8 2.7l1.6 3.3 3.6.5-2.6 2.6.6 3.7L8 11l-3.2 1.8.6-3.7L2.8 6.5l3.6-.5Z'),
      ],
    };

    function Glyph(props) {
      const shapes = AREA_GLYPHS[props.kind] || AREA_GLYPHS.growth;
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: props.size || 15,
          height: props.size || 15,
          'aria-hidden': true,
          focusable: 'false',
          className: props.className || 'lgk-glyph',
        },
        shapes.map((shape, index) => h(shape.tag, Object.assign({ key: index }, shape.attrs))),
      );
    }

    function ActionGlyph(props) {
      const shapes = ACTION_GLYPHS[props.kind] || ACTION_GLYPHS.help;
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: props.size || 15,
          height: props.size || 15,
          'aria-hidden': true,
          focusable: 'false',
        },
        shapes.map((shape, index) => h(shape.tag, Object.assign({ key: index }, shape.attrs))),
      );
    }

    function StarGlyph(props) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 15,
          height: 15,
          'aria-hidden': true,
          focusable: 'false',
        },
        h('path', {
          d: 'M8 2.7l1.6 3.3 3.6.5-2.6 2.6.6 3.7L8 11l-3.2 1.8.6-3.7L2.8 6.5l3.6-.5Z',
          fill: props.filled ? 'currentColor' : 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinejoin: 'round',
        }),
      );
    }

    function PanelGlyph(props) {
      const size = props.size || 16;
      const cells = [];
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          const center = row === 1 && column === 1;
          cells.push(
            h('rect', {
              key: `${row}-${column}`,
              x: 1.6 + column * 4.5,
              y: 1.6 + row * 4.5,
              width: 3.6,
              height: 3.6,
              rx: 1,
              fill: center ? 'currentColor' : 'none',
              stroke: 'currentColor',
              strokeWidth: center ? 0 : 1.1,
            }),
          );
        }
      }
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true, focusable: 'false' },
        cells,
      );
    }

    /* ------------------------------------------------------------------ */
    /* Data                                                                */
    /* ------------------------------------------------------------------ */

    function emptyYear() {
      const goals = {};
      for (const id of AREA_IDS) goals[id] = [];
      return { theme: '', vision: '', focus: [], goals };
    }

    function newGoalId() {
      return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }

    function normalizeYear(raw) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      const sourceGoals = source.goals !== null && typeof source.goals === 'object' ? source.goals : {};
      const goals = {};
      for (const id of AREA_IDS) {
        const list = Array.isArray(sourceGoals[id]) ? sourceGoals[id] : [];
        goals[id] = list
          .filter(
            (item) =>
              item !== null &&
              typeof item === 'object' &&
              typeof item.text === 'string' &&
              item.text.trim() !== '',
          )
          .map((item) => ({
            id: typeof item.id === 'string' && item.id !== '' ? item.id : newGoalId(),
            text: item.text.trim(),
            note: typeof item.note === 'string' ? item.note.trim() : '',
          }));
      }
      const focus = Array.isArray(source.focus)
        ? Array.from(new Set(source.focus.filter((id) => AREA_IDS.includes(id))))
        : [];
      return {
        theme: typeof source.theme === 'string' ? source.theme : '',
        vision: typeof source.vision === 'string' ? source.vision : '',
        focus,
        goals,
      };
    }

    function normalizeStore(raw) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      const sourceYears = source.years !== null && typeof source.years === 'object' ? source.years : {};
      const years = {};
      for (const [key, value] of Object.entries(sourceYears)) {
        if (!/^\d{4}$/.test(key)) continue;
        years[key] = normalizeYear(value);
      }
      const currentYear =
        typeof source.currentYear === 'string' && /^\d{4}$/.test(source.currentYear)
          ? source.currentYear
          : String(new Date().getFullYear());
      return { version: 1, currentYear, years };
    }

    function emptyStore() {
      return { version: 1, currentYear: String(new Date().getFullYear()), years: {} };
    }

    function loadStore() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return emptyStore();
        return normalizeStore(JSON.parse(raw));
      } catch (error) {
        return emptyStore();
      }
    }

    function saveStore(store) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      } catch (error) {
        /* storage may be unavailable; the page still works in memory */
      }
    }

    function buildMarkdown(store, year, t) {
      const data = store.years[String(year)] || emptyYear();
      const lines = [`# ${year} ${t('page.title')}`, ''];
      if (data.theme.trim() !== '') {
        lines.push(t('md.theme', { value: data.theme.trim() }), '');
      }
      if (data.vision.trim() !== '') {
        lines.push(t('md.vision'), data.vision.trim(), '');
      }
      for (const areaId of AREA_IDS) {
        lines.push(`## ${t(`area.${areaId}`)}`);
        const goals = data.goals[areaId] || [];
        if (goals.length === 0) {
          lines.push(`（${t('cell.empty')}）`);
        } else {
          goals.forEach((goal) => {
            lines.push(`- [ ] ${goal.text}${goal.note ? `（${goal.note}）` : ''}`);
          });
        }
        lines.push('');
      }
      if (data.focus.length > 0) {
        lines.push(`## ${t('md.focus')}`);
        lines.push(data.focus.map((id) => t(`area.${id}`)).join(t('md.list')));
        lines.push('');
      }
      return lines.join('\n');
    }

    /* ------------------------------------------------------------------ */
    /* Hooks                                                               */
    /* ------------------------------------------------------------------ */

    function useLocaleRevision(locale) {
      const [revision, setRevision] = React.useState(() => locale.getSnapshot().revision);
      React.useEffect(
        () => locale.subscribe(() => setRevision(locale.getSnapshot().revision)),
        [locale],
      );
      return revision;
    }

    /* ------------------------------------------------------------------ */
    /* Cells                                                               */
    /* ------------------------------------------------------------------ */

    function AreaCell(props) {
      const t = props.t;
      const goals = props.goals;
      const editingHere = props.editing !== null && props.editing.areaId === props.areaId;
      const editingGoalId = editingHere ? props.editing.goalId : null;
      const areaLabel = t(`area.${props.areaId}`);

      const formKey = editingGoalId === null ? 'new' : editingGoalId;
      const onFormKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          props.onCancel();
        } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          props.onCommit();
        }
      };

      const form = h(
        'form',
        {
          key: 'form',
          className: 'lgk-form',
          onSubmit: (event) => {
            event.preventDefault();
            props.onCommit();
          },
          onKeyDown: onFormKeyDown,
        },
        h('textarea', {
          className: 'lgk-input',
          rows: 2,
          autoFocus: true,
          value: props.draft.text,
          placeholder: t('form.goalPlaceholder'),
          'aria-label': t('form.goalPlaceholder'),
          onChange: (event) =>
            props.onDraftChange({ text: event.target.value, note: props.draft.note }),
        }),
        h('textarea', {
          className: 'lgk-input lgk-input-note',
          rows: 2,
          value: props.draft.note,
          placeholder: t('form.notePlaceholder'),
          'aria-label': t('form.notePlaceholder'),
          onChange: (event) =>
            props.onDraftChange({ text: props.draft.text, note: event.target.value }),
        }),
        h(
          'div',
          { className: 'lgk-form-foot' },
          h('span', { className: 'lgk-hint' }, t('form.hint')),
          h(
            'button',
            { type: 'button', className: 'lgk-btn', onClick: props.onCancel },
            t('form.cancel'),
          ),
          h('button', { type: 'submit', className: 'lgk-btn lgk-btn-primary' }, t('form.save')),
        ),
      );

      const rows = goals.map((goal) => {
        if (editingGoalId === goal.id) {
          return h('li', { key: goal.id, className: 'lgk-goal lgk-goal-form' }, form);
        }
        const confirming =
          props.confirming !== null &&
          props.confirming.areaId === props.areaId &&
          props.confirming.goalId === goal.id;
        return h(
          'li',
          { key: goal.id, className: confirming ? 'lgk-goal lgk-goal-confirming' : 'lgk-goal' },
          h(
            'div',
            { className: 'lgk-goal-body' },
            h('p', { className: 'lgk-goal-text' }, goal.text),
            goal.note !== '' ? h('p', { className: 'lgk-goal-note' }, goal.note) : null,
          ),
          h(
            'div',
            { className: 'lgk-goal-actions' },
            confirming
              ? [
                  h(
                    'button',
                    {
                      key: 'confirm',
                      type: 'button',
                      className: 'lgk-btn lgk-btn-danger',
                      onClick: () => props.onConfirmDelete(props.areaId, goal.id),
                    },
                    t('goal.confirmDelete'),
                  ),
                  h(
                    'button',
                    {
                      key: 'cancel',
                      type: 'button',
                      className: 'lgk-btn',
                      onClick: props.onCancelDelete,
                    },
                    t('goal.cancelDelete'),
                  ),
                ]
              : [
                  h(
                    'button',
                    {
                      key: 'edit',
                      type: 'button',
                      className: 'lgk-goal-btn',
                      'aria-label': t('goal.edit'),
                      title: t('goal.edit'),
                      onClick: () => props.onStartEdit(props.areaId, goal),
                    },
                    h(ActionGlyph, { kind: 'edit', size: 13 }),
                  ),
                  h(
                    'button',
                    {
                      key: 'delete',
                      type: 'button',
                      className: 'lgk-goal-btn',
                      'aria-label': t('goal.delete'),
                      title: t('goal.delete'),
                      onClick: () => props.onRequestDelete(props.areaId, goal.id),
                    },
                    h(ActionGlyph, { kind: 'close', size: 13 }),
                  ),
                ],
          ),
        );
      });

      return h(
        'article',
        {
          className:
            'lgk-cell lgk-area-' + props.areaId + (props.focused ? ' lgk-cell-focus' : ''),
          style: { gridArea: props.areaId },
          'aria-labelledby': `lgk-title-${props.areaId}`,
        },
        h(
          'header',
          { className: 'lgk-cell-head' },
          h(Glyph, { kind: props.areaId, size: 15 }),
          h('h2', { className: 'lgk-cell-title', id: `lgk-title-${props.areaId}` }, areaLabel),
          h('span', { className: 'lgk-count', 'aria-hidden': true }, String(goals.length)),
          h(
            'button',
            {
              type: 'button',
              className: props.focused ? 'lgk-star lgk-star-on' : 'lgk-star',
              'aria-pressed': props.focused,
              'aria-label': props.focused ? t('cell.focusOff') : t('cell.focusOn'),
              title: props.focused ? t('cell.focusOff') : t('cell.focusOn'),
              onClick: () => props.onToggleFocus(props.areaId),
            },
            h(StarGlyph, { filled: props.focused }),
          ),
        ),
        goals.length === 0 && !editingHere
          ? h('p', { className: 'lgk-empty' }, t('cell.empty'))
          : null,
        rows.length > 0 ? h('ul', { className: 'lgk-goals' }, rows) : null,
        editingHere && editingGoalId === null ? h('div', { key: formKey }, form) : null,
        editingHere
          ? null
          : h(
              'button',
              { type: 'button', className: 'lgk-add', onClick: () => props.onStartAdd(props.areaId) },
              `+ ${t('cell.add')}`,
            ),
      );
    }

    function CenterCell(props) {
      const t = props.t;
      const data = props.data;
      return h(
        'article',
        { className: 'lgk-cell lgk-center', style: { gridArea: 'center' } },
        h('span', { className: 'lgk-center-year' }, t('center.year', { year: props.year })),
        h(
          'label',
          { className: 'lgk-label', htmlFor: 'lgk-theme' },
          t('center.themeLabel'),
        ),
        h('textarea', {
          id: 'lgk-theme',
          className: 'lgk-input lgk-theme',
          rows: 2,
          value: data.theme,
          placeholder: t('center.themePlaceholder'),
          onChange: (event) => props.onTheme(event.target.value),
        }),
        h(
          'label',
          { className: 'lgk-label', htmlFor: 'lgk-vision' },
          t('center.visionLabel'),
        ),
        h('textarea', {
          id: 'lgk-vision',
          className: 'lgk-input lgk-vision',
          rows: 3,
          value: data.vision,
          placeholder: t('center.visionPlaceholder'),
          onChange: (event) => props.onVision(event.target.value),
        }),
        h('p', { className: 'lgk-center-note' }, t('center.note')),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Help dialog                                                         */
    /* ------------------------------------------------------------------ */

    function HelpDialog(props) {
      const t = props.t;
      const dialogRef = React.useRef(null);
      React.useEffect(() => {
        if (dialogRef.current !== null && typeof dialogRef.current.focus === 'function') {
          dialogRef.current.focus();
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            props.onClose();
          }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
      }, [props.onClose]);

      const steps = [1, 2, 3, 4].map((index) =>
        h(
          'div',
          { className: 'lgk-step', key: index },
          h('h3', null, t(`help.step${index}.title`)),
          h('p', null, t(`help.step${index}.body`)),
        ),
      );

      return h(
        'div',
        {
          className: 'lgk-backdrop',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) props.onClose();
          },
        },
        h(
          'div',
          {
            className: 'lgk-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('help.title'),
            tabIndex: -1,
            ref: dialogRef,
          },
          h(
            'div',
            { className: 'lgk-dialog-head' },
            h('h2', { className: 'lgk-dialog-title' }, t('help.title')),
            h(
              'button',
              {
                type: 'button',
                className: 'lgk-icon-btn',
                'aria-label': t('help.close'),
                title: t('help.close'),
                onClick: props.onClose,
              },
              h(ActionGlyph, { kind: 'close' }),
            ),
          ),
          h('p', { className: 'lgk-dialog-intro' }, t('help.intro')),
          h('div', { className: 'lgk-steps' }, steps),
          h('p', { className: 'lgk-dialog-note' }, t('help.data')),
          h(
            'div',
            { className: 'lgk-dialog-foot' },
            h(
              'button',
              { type: 'button', className: 'lgk-btn lgk-btn-primary', onClick: props.onClose },
              t('help.close'),
            ),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Page                                                                */
    /* ------------------------------------------------------------------ */

    function LifeGridPage(props) {
      const t = props.t;
      useLocaleRevision(props.locale);

      const initial = React.useMemo(loadStore, []);
      const [store, setStore] = React.useState(initial);
      const [year, setYear] = React.useState(() => {
        const stored = Number(initial.currentYear);
        return Number.isFinite(stored) && stored > 0 ? stored : new Date().getFullYear();
      });
      const [editing, setEditing] = React.useState(null);
      const [draft, setDraft] = React.useState({ text: '', note: '' });
      const [confirming, setConfirming] = React.useState(null);
      const [helpOpen, setHelpOpen] = React.useState(false);
      const [notice, setNotice] = React.useState(null);
      const fileRef = React.useRef(null);

      const yearKey = String(year);
      const yearData = store.years[yearKey] || emptyYear();
      const currentYear = new Date().getFullYear();

      const goalTotal = AREA_IDS.reduce(
        (total, id) => total + (yearData.goals[id] || []).length,
        0,
      );
      const emptyTotal = AREA_IDS.filter((id) => (yearData.goals[id] || []).length === 0).length;

      React.useEffect(() => {
        saveStore(store);
      }, [store]);

      React.useEffect(() => {
        if (notice === null) return undefined;
        const timer = window.setTimeout(() => setNotice(null), 4200);
        return () => window.clearTimeout(timer);
      }, [notice]);

      React.useEffect(() => {
        if (confirming === null) return undefined;
        const timer = window.setTimeout(() => setConfirming(null), 5000);
        return () => window.clearTimeout(timer);
      }, [confirming]);

      const mutateYear = React.useCallback(
        (mutator) => {
          setStore((previous) => {
            const key = String(year);
            const base = previous.years[key] || emptyYear();
            const next = mutator(base, key);
            if (next === base) return previous;
            return {
              ...previous,
              currentYear: key,
              years: { ...previous.years, [key]: next },
            };
          });
        },
        [year],
      );

      const changeYear = (nextYear) => {
        if (!Number.isFinite(nextYear) || nextYear < 1900 || nextYear > 2999) return;
        setEditing(null);
        setConfirming(null);
        setYear(nextYear);
        setStore((previous) => ({ ...previous, currentYear: String(nextYear) }));
      };

      const setTheme = (value) => mutateYear((data) => ({ ...data, theme: value }));
      const setVision = (value) => mutateYear((data) => ({ ...data, vision: value }));

      const toggleFocus = (areaId) =>
        mutateYear((data) => {
          const focus = data.focus.includes(areaId)
            ? data.focus.filter((id) => id !== areaId)
            : AREA_IDS.filter((id) => id === areaId || data.focus.includes(id));
          return { ...data, focus };
        });

      const startAdd = (areaId) => {
        setConfirming(null);
        setEditing({ areaId, goalId: null });
        setDraft({ text: '', note: '' });
      };

      const startEdit = (areaId, goal) => {
        setConfirming(null);
        setEditing({ areaId, goalId: goal.id });
        setDraft({ text: goal.text, note: goal.note });
      };

      const cancelEdit = () => setEditing(null);

      const commitEdit = () => {
        if (editing === null) return;
        const text = draft.text.trim();
        if (text === '') {
          setEditing(null);
          return;
        }
        const note = draft.note.trim();
        const areaId = editing.areaId;
        if (editing.goalId === null) {
          mutateYear((data) => ({
            ...data,
            goals: {
              ...data.goals,
              [areaId]: [...(data.goals[areaId] || []), { id: newGoalId(), text, note }],
            },
          }));
        } else {
          const goalId = editing.goalId;
          mutateYear((data) => ({
            ...data,
            goals: {
              ...data.goals,
              [areaId]: (data.goals[areaId] || []).map((goal) =>
                goal.id === goalId ? { ...goal, text, note } : goal,
              ),
            },
          }));
        }
        setEditing(null);
      };

      const requestDelete = (areaId, goalId) => setConfirming({ areaId, goalId });

      const confirmDelete = (areaId, goalId) => {
        mutateYear((data) => ({
          ...data,
          goals: {
            ...data.goals,
            [areaId]: (data.goals[areaId] || []).filter((goal) => goal.id !== goalId),
          },
        }));
        if (
          editing !== null &&
          editing.areaId === areaId &&
          editing.goalId === goalId
        ) {
          setEditing(null);
        }
        setConfirming(null);
      };

      const copyMarkdown = () => {
        const text = buildMarkdown(store, year, t);
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
        if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
          setNotice({ kind: 'error', text: t('notice.copyFailed') });
          return;
        }
        clipboard
          .writeText(text)
          .then(() => setNotice({ kind: 'ok', text: t('notice.copied') }))
          .catch(() => setNotice({ kind: 'error', text: t('notice.copyFailed') }));
      };

      const exportJson = () => {
        const payload = JSON.stringify(store, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `life-grid-${year}.json`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice({ kind: 'ok', text: t('notice.exported') });
      };

      const pickImport = () => {
        if (fileRef.current !== null) fileRef.current.click();
      };

      const importFile = (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        file
          .text()
          .then((text) => {
            const imported = normalizeStore(JSON.parse(text));
            const count = Object.keys(imported.years).length;
            if (count === 0) {
              setNotice({ kind: 'error', text: t('notice.importFailed') });
              return;
            }
            setStore((previous) => ({
              ...previous,
              currentYear: imported.years[previous.currentYear] !== undefined
                ? previous.currentYear
                : imported.currentYear,
              years: { ...previous.years, ...imported.years },
            }));
            setEditing(null);
            setConfirming(null);
            setNotice({ kind: 'ok', text: t('notice.imported', { count }) });
          })
          .catch(() => setNotice({ kind: 'error', text: t('notice.importFailed') }));
      };

      const closeHelp = React.useCallback(() => setHelpOpen(false), []);

      const goThisYear = () => changeYear(currentYear);

      const cells = AREA_IDS.map((areaId) =>
        h(AreaCell, {
          key: areaId,
          areaId,
          goals: yearData.goals[areaId] || [],
          focused: yearData.focus.includes(areaId),
          editing,
          confirming,
          draft,
          t,
          onToggleFocus: toggleFocus,
          onStartAdd: startAdd,
          onStartEdit: startEdit,
          onDraftChange: setDraft,
          onCommit: commitEdit,
          onCancel: cancelEdit,
          onRequestDelete: requestDelete,
          onCancelDelete: () => setConfirming(null),
          onConfirmDelete: confirmDelete,
        }),
      );

      return h(
        'section',
        {
          className: 'lgk-page',
          'aria-label': t('page.title'),
          onKeyDown: (event) => {
            if (event.key === 'Escape' && confirming !== null) {
              event.preventDefault();
              setConfirming(null);
            }
          },
        },
        h('style', null, CSS),
        h(
          'div',
          { className: 'lgk-scroll' },
          h(
            'div',
            { className: 'lgk-content' },
            h(
              'header',
              { className: 'lgk-head' },
              h(
                'div',
                { className: 'lgk-title' },
                h('h1', null, t('page.title')),
                h('p', { className: 'lgk-sub' }, t('page.subtitle')),
                h(
                  'div',
                  { className: 'lgk-chips' },
                  h('span', { className: 'lgk-chip' }, t('summary.goals', { count: goalTotal })),
                  h(
                    'span',
                    { className: 'lgk-chip' },
                    t('summary.focus', { count: yearData.focus.length }),
                  ),
                  emptyTotal > 0
                    ? h(
                        'span',
                        { className: 'lgk-chip lgk-chip-warn' },
                        t('summary.empty', { count: emptyTotal }),
                      )
                    : null,
                ),
              ),
              h(
                'div',
                { className: 'lgk-head-actions' },
                h(
                  'div',
                  { className: 'lgk-yearbox' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'lgk-icon-btn',
                      'aria-label': t('year.prev'),
                      title: t('year.prev'),
                      onClick: () => changeYear(year - 1),
                    },
                    h(ActionGlyph, { kind: 'left', size: 14 }),
                  ),
                  h('span', { className: 'lgk-yearnum', 'aria-live': 'polite' }, String(year)),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'lgk-icon-btn',
                      'aria-label': t('year.next'),
                      title: t('year.next'),
                      onClick: () => changeYear(year + 1),
                    },
                    h(ActionGlyph, { kind: 'right', size: 14 }),
                  ),
                  year !== currentYear
                    ? h(
                        'button',
                        { type: 'button', className: 'lgk-thisyear', onClick: goThisYear },
                        t('year.thisYear'),
                      )
                    : null,
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'lgk-icon-btn',
                    'aria-label': t('actions.copy'),
                    title: t('actions.copy'),
                    onClick: copyMarkdown,
                  },
                  h(ActionGlyph, { kind: 'copy' }),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'lgk-icon-btn',
                    'aria-label': t('actions.export'),
                    title: t('actions.export'),
                    onClick: exportJson,
                  },
                  h(ActionGlyph, { kind: 'download' }),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'lgk-icon-btn',
                    'aria-label': t('actions.import'),
                    title: t('actions.import'),
                    onClick: pickImport,
                  },
                  h(ActionGlyph, { kind: 'upload' }),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'lgk-icon-btn',
                    'aria-label': t('actions.help'),
                    title: t('actions.help'),
                    onClick: () => setHelpOpen(true),
                  },
                  h(ActionGlyph, { kind: 'help' }),
                ),
              ),
            ),
            notice !== null
              ? h(
                  'div',
                  { className: 'lgk-notice', 'data-kind': notice.kind, role: 'status' },
                  notice.text,
                )
              : null,
            h(
              'div',
              { className: 'lgk-grid' },
              cells,
              h(CenterCell, {
                key: 'center',
                t,
                year,
                data: yearData,
                onTheme: setTheme,
                onVision: setVision,
              }),
            ),
            h('p', { className: 'lgk-foot' }, t('help.data')),
          ),
        ),
        h('input', {
          ref: fileRef,
          className: 'lgk-file',
          type: 'file',
          accept: 'application/json,.json',
          onChange: importFile,
          tabIndex: -1,
          'aria-hidden': true,
        }),
        helpOpen ? h(HelpDialog, { t, onClose: closeHelp }) : null,
      );
    }

    /* ------------------------------------------------------------------ */
    /* Plugin                                                              */
    /* ------------------------------------------------------------------ */

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, 'en', DICT.en),
        'life-grid: English dictionary',
      );
      ctx.effect(
        () => ctx.locale.register(NS, 'zh', DICT.zh),
        'life-grid: Chinese dictionary',
      );
      const translate = ctx.locale.bind(NS);
      const locale = ctx.locale;

      function LifeGridIcon(props) {
        return h(PanelGlyph, { size: props.size });
      }

      function LifeGridPanel() {
        return h(LifeGridPage, { t: translate, locale });
      }

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            label: () => translate('panel.label'),
          },
          LifeGridIcon,
        ),
      );

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
          },
          LifeGridPanel,
        ),
      );
    }

    return { inject: ['slots', 'locale'], apply };
  },
});
