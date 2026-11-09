/**
 * To-do List — browser half.
 *
 * Quick capture lives in `conversation.composer.dock`; the full task page is a
 * sidebar panel (`sidebar.panellist` + `main`, key `todo-list`). Both halves
 * share one store so a checkbox ticked in the dock shows up on the page
 * immediately. Tasks, groups and the selected view are saved in this browser's
 * `localStorage`; JSON export/import moves them between machines.
 */
window.__ModuleLoader__.load({
  id: '@local/todo-list',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'todo-list';
    const PANEL_ID = 'todo-list';
    const STORAGE_KEY = 'dsh-todo-list/v1';
    const UI_KEY = 'dsh-todo-list:ui/v1';
    const MAX_GROUP_NAME = 20;

    const PRIORITIES = ['none', 'low', 'medium', 'high'];
    const PRIORITY_LABEL_KEY = {
      none: 'task.priorityNone',
      low: 'task.priorityLow',
      medium: 'task.priorityMedium',
      high: 'task.priorityHigh',
    };
    const FILTERS = ['all', 'today', 'overdue', 'done'];
    const BUILTIN_GROUPS = [
      { id: 'inbox', order: 0 },
      { id: 'work', order: 1 },
      { id: 'life', order: 2 },
    ];
    const BUILTIN_IDS = new Set(BUILTIN_GROUPS.map((group) => group.id));

    const DICT = {
      en: {
        'panel.label': 'To-do List',
        'page.title': 'To-do List',
        'page.subtitle':
          'Capture what you want to do, then move it forward with Today and Overdue.',
        'page.foot': 'Stored only in this browser · Export JSON before switching devices',
        'filter.all': 'All',
        'filter.today': 'Today',
        'filter.overdue': 'Overdue',
        'filter.done': 'Done',
        'group.all': 'All',
        'group.inbox': 'Inbox',
        'group.work': 'Work',
        'group.life': 'Life',
        'group.new': 'New group',
        'group.edit': 'Manage group',
        'group.rename': 'Rename group',
        'group.nameLabel': 'Group name',
        'group.namePlaceholder': 'e.g. Reading plan',
        'group.nameRequired': 'Enter a group name',
        'group.nameDuplicate': 'A group with this name already exists',
        'group.nameTooLong': 'Use at most {max} characters',
        'group.deleteTitle': 'Delete group “{name}”?',
        'group.deleteBody':
          'Its {count} task(s) will move to Inbox and will not be lost. This cannot be undone.',
        'group.deleteConfirm': 'Delete group',
        'group.cancel': 'Cancel',
        'group.save': 'Save',
        'group.menuTitle': 'Move to group',
        'add.placeholder': 'Add a task, press Enter',
        'add.group': 'Group',
        'add.submit': 'Add',
        'task.drag': 'Drag to reorder, or drop on a group',
        'task.groupValue': 'Group: {name}. Click to move.',
        'task.complete': 'Mark as done',
        'task.uncomplete': 'Mark as not done',
        'task.editTitle': 'Edit title',
        'task.editTitleHint': 'Double-click to edit',
        'task.addDue': 'Date',
        'task.setDue': 'Set due date',
        'task.dueValue': 'Due {value}',
        'task.dueMenuTitle': 'Due date',
        'task.dueMenuToday': 'Today',
        'task.dueMenuTomorrow': 'Tomorrow',
        'task.dueMenuClear': 'Clear',
        'task.dueToday': 'Today',
        'task.dueTomorrow': 'Tomorrow',
        'task.dueOverdue': 'Overdue {days}d',
        'task.priorityNone': 'No priority',
        'task.priorityLow': 'Low priority',
        'task.priorityMedium': 'Medium priority',
        'task.priorityHigh': 'High priority',
        'task.priorityCycle': 'Priority: {label}. Click to change.',
        'task.delete': 'Delete task',
        'task.confirmDelete': 'Delete',
        'task.cancelDelete': 'Cancel',
        'actions.copy': 'Copy as Markdown',
        'actions.export': 'Export JSON',
        'actions.import': 'Import JSON',
        'actions.help': 'How to use',
        'actions.clearDone': 'Clear completed',
        'actions.clearDoneConfirm': 'Clear {count}?',
        'actions.clearDoneCancel': 'Cancel',
        'notice.exported': 'Exported the list as JSON',
        'notice.exportFailed': 'Export failed',
        'notice.copied': 'List copied as Markdown',
        'notice.copyFailed': 'Copy failed — select the text manually',
        'notice.imported': 'Imported: {added} added, {updated} updated, {skipped} skipped',
        'notice.importFailed': 'Import failed: this file is not a To-do List backup',
        'notice.clearedDone': 'Cleared {count} completed task(s)',
        'notice.moved': 'Moved to {name}',
        'notice.storageUnavailable':
          'Local storage is unavailable — changes stay in memory only.',
        'notice.loadFailed':
          'Saved data could not be read; starting from an empty list. The old data was not overwritten.',
        'empty.all': 'Nothing here yet. Add the first task above.',
        'empty.filter': 'No tasks match this filter.',
        'empty.group': 'This group has no tasks yet.',
        'empty.done': 'No completed tasks yet.',
        'dock.label': 'To-do',
        'dock.today': 'Today {done}/{total}',
        'dock.overdue': '{count} overdue',
        'dock.add': 'Add to-do',
        'dock.quickPlaceholder': 'Add a task for today, Enter to save',
        'dock.todayTitle': 'Today',
        'dock.overdueTitle': 'Overdue',
        'dock.doneToday': '{count} completed today',
        'dock.emptyToday': 'Nothing due today',
        'dock.footer': 'Full list: the “To-do” panel in the sidebar',
        'help.title': 'How to use the to-do list',
        'help.intro':
          'Two entry points: the “To-do” control under the composer is for quick capture; the sidebar page is for arranging groups, dates and priorities.',
        'help.dockTitle': '1 · Capture beside the composer',
        'help.dockBody':
          'Click “To-do” or “+”, type a task and press Enter. Quick-added tasks land in Inbox, due today. Overdue and today rows can be ticked right in the popover.',
        'help.pageTitle': '2 · Arrange on the full page',
        'help.pageBody':
          'Pick a group, then set a due date, cycle the priority bars, drag the handle to reorder, and use the Today / Overdue filters to focus. To move a task to another group, click its group chip — or drag it onto a group in the left rail. The Done tab can clear finished tasks.',
        'help.dataTitle': 'Where the data lives',
        'help.data':
          'Everything is stored in this browser only (localStorage) and never uploaded. Export a JSON backup before switching devices or clearing site data; import merges by task id and never deletes local tasks.',
        'help.delete': 'Deleting a task asks for confirmation right on its row — no dialog.',
        'help.close': 'Close',
        'a11y.groupRail': 'Groups',
        'a11y.filters': 'Filters',
        'a11y.tasks': 'Tasks',
        'md.wrap': ' ({value})',
        'md.sep': ' · ',
      },
      zh: {
        'panel.label': '待办清单',
        'page.title': '待办清单',
        'page.subtitle': '把想做的事收进来，再按「今天 / 过期」推进。',
        'page.foot': '数据只保存在本机浏览器 · 换设备前请导出 JSON 备份',
        'filter.all': '全部',
        'filter.today': '今天',
        'filter.overdue': '过期',
        'filter.done': '已完成',
        'group.all': '全部',
        'group.inbox': '收件箱',
        'group.work': '工作',
        'group.life': '生活',
        'group.new': '新建分组',
        'group.edit': '管理分组',
        'group.rename': '重命名分组',
        'group.nameLabel': '分组名称',
        'group.namePlaceholder': '例如：阅读计划',
        'group.nameRequired': '请输入分组名称',
        'group.nameDuplicate': '已有同名分组',
        'group.nameTooLong': '名称最多 {max} 字',
        'group.deleteTitle': '删除分组「{name}」？',
        'group.deleteBody': '组内 {count} 条任务会移到收件箱，不会丢失。删除后无法撤销。',
        'group.deleteConfirm': '删除分组',
        'group.cancel': '取消',
        'group.save': '保存',
        'group.menuTitle': '移动到分组',
        'add.placeholder': '添加待办，回车保存',
        'add.group': '分组',
        'add.submit': '添加',
        'task.drag': '拖动排序，或拖到分组上',
        'task.groupValue': '分组：{name}，点击切换',
        'task.complete': '标记完成',
        'task.uncomplete': '标记未完成',
        'task.editTitle': '编辑标题',
        'task.editTitleHint': '双击编辑',
        'task.addDue': '日期',
        'task.setDue': '设置截止日期',
        'task.dueValue': '截止日期：{value}',
        'task.dueMenuTitle': '截止日期',
        'task.dueMenuToday': '今天',
        'task.dueMenuTomorrow': '明天',
        'task.dueMenuClear': '清除',
        'task.dueToday': '今天',
        'task.dueTomorrow': '明天',
        'task.dueOverdue': '已过期 {days} 天',
        'task.priorityNone': '无优先级',
        'task.priorityLow': '低优先级',
        'task.priorityMedium': '中优先级',
        'task.priorityHigh': '高优先级',
        'task.priorityCycle': '优先级：{label}，点击切换',
        'task.delete': '删除任务',
        'task.confirmDelete': '确认删除',
        'task.cancelDelete': '取消',
        'actions.copy': '复制为 Markdown',
        'actions.export': '导出 JSON',
        'actions.import': '导入 JSON',
        'actions.help': '使用说明',
        'actions.clearDone': '清空已完成',
        'actions.clearDoneConfirm': '确认清空 {count} 条？',
        'actions.clearDoneCancel': '取消',
        'notice.exported': '已导出 JSON',
        'notice.exportFailed': '导出失败',
        'notice.copied': '已复制为 Markdown',
        'notice.copyFailed': '复制失败，请手动选择文本',
        'notice.imported': '导入完成：新增 {added} 条，更新 {updated} 条，跳过 {skipped} 条',
        'notice.importFailed': '导入失败：这不是待办清单的备份文件',
        'notice.clearedDone': '已清空 {count} 条已完成任务',
        'notice.moved': '已移到「{name}」',
        'notice.storageUnavailable': '本机存储不可用，改动只保留在内存中。',
        'notice.loadFailed': '本机数据读取失败，已从空清单开始；原数据未被覆盖。',
        'empty.all': '还没有任务，从上面添加第一条。',
        'empty.filter': '这个筛选下没有任务。',
        'empty.group': '这个分组还没有任务。',
        'empty.done': '还没有已完成的任务。',
        'dock.label': '待办',
        'dock.today': '今日 {done}/{total}',
        'dock.overdue': '过期 {count}',
        'dock.add': '添加待办',
        'dock.quickPlaceholder': '添加今天的待办，回车保存',
        'dock.todayTitle': '今天',
        'dock.overdueTitle': '已过期',
        'dock.doneToday': '今日已完成 {count}',
        'dock.emptyToday': '今天没有到期的任务',
        'dock.footer': '完整清单在左侧栏「待办」',
        'help.title': '怎么用待办清单',
        'help.intro':
          '两个入口：输入框下方的「待办」用来随手记；左侧栏的整页用来安排分组、截止日期和优先级。',
        'help.dockTitle': '1 · 输入框旁快速记',
        'help.dockBody':
          '点「待办」或「＋」，输入内容回车即添加为「今天」到期的收件箱任务。弹层里可以直接勾掉今天和过期的任务。',
        'help.pageTitle': '2 · 整页安排',
        'help.pageBody':
          '选分组后，点日期设截止日、点优先级色条切换高低、拖动左侧手柄排序，再用「今天 / 过期」筛选聚焦。要换分组，点任务上的分组徽标，或把它拖到左侧栏的分组上。已完成的任务可在「已完成」里一键清空。',
        'help.dataTitle': '数据存在哪',
        'help.data':
          '只保存在当前浏览器（localStorage），不上传。换设备或清缓存前请用右上角「导出 JSON」备份；导入按任务 id 合并，不会删除本机任务。',
        'help.delete': '删除任务时先在原地确认一次，再点「确认删除」才会移除，不会弹窗。',
        'help.close': '关闭',
        'a11y.groupRail': '分组',
        'a11y.filters': '筛选',
        'a11y.tasks': '任务列表',
        'md.wrap': '（{value}）',
        'md.sep': ' · ',
      },
    };

    const CSS = [
      '.tdl-page{box-sizing:border-box;width:100%;height:100%;min-width:0;min-height:0;display:flex;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}',
      '.tdl-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}',
      '.tdl-content{max-width:1120px;margin:0 auto;padding:0 clamp(20px,3.4vw,44px) 48px}',
      '.tdl-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;padding-top:28px;margin-bottom:14px}',
      '[data-platform=darwin] .tdl-head{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}',
      '.tdl-title{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.tdl-title h1{margin:0;font-size:20px;font-weight:500;line-height:28px}',
      '.tdl-sub{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:20px}',
      '.tdl-head-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.tdl-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .15s,color .15s}',
      '.tdl-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent));color:var(--dsw-alias-label-primary)}',
      '.tdl-icon-btn:focus-visible,.tdl-dock-main:focus-visible,.tdl-dock-add:focus-visible,.tdl-filter:focus-visible,.tdl-rail-item:focus-visible,.tdl-rail-add:focus-visible,.tdl-rail-edit:focus-visible,.tdl-btn:focus-visible,.tdl-text-btn:focus-visible,.tdl-del:focus-visible,.tdl-priority:focus-visible,.tdl-due:focus-visible,.tdl-group-badge:focus-visible,.tdl-groupmenu-item:focus-visible,.tdl-panel-done-toggle:focus-visible,.tdl-quick input:focus-visible,.tdl-add-input:focus-visible,.tdl-title-input:focus-visible,.tdl-date-input:focus-visible,.tdl-dialog input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.tdl-body{display:flex;align-items:flex-start;gap:18px;margin-top:6px}',
      '.tdl-rail{flex:none;width:190px;display:flex;flex-direction:column;gap:2px;padding-top:2px}',
      '.tdl-rail-row{position:relative;display:flex;align-items:center}',
      '.tdl-rail-item{display:flex;flex:1;min-width:0;align-items:center;gap:8px;height:32px;padding:0 9px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}',
      '.tdl-rail-row .tdl-rail-item{padding-right:30px}',
      '.tdl-rail-item:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 9%,transparent))}',
      '.tdl-rail-item-active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 11%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.tdl-rail-item-active:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent)}',
      '.tdl-rail-item-drop,.tdl-rail-item-drop:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);box-shadow:inset 0 0 0 1.5px var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.tdl-rail-item-drop .tdl-rail-count{color:var(--dsw-alias-brand-primary)}',
      '.tdl-rail-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tdl-rail-count{flex:none;min-width:16px;text-align:right;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.tdl-rail-item-active .tdl-rail-count{color:var(--dsw-alias-brand-primary)}',
      '.tdl-rail-edit{position:absolute;right:5px;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);opacity:0;cursor:pointer;transition:opacity .12s}',
      '.tdl-rail-row:hover .tdl-rail-edit,.tdl-rail-edit:focus-visible{opacity:1}',
      '.tdl-rail-edit:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 12%,transparent));color:var(--dsw-alias-label-primary)}',
      '.tdl-rail-add{display:inline-flex;align-items:center;gap:5px;height:30px;margin-top:6px;padding:0 9px;border:1px dashed var(--dsw-alias-border-l2);border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}',
      '.tdl-rail-add:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.tdl-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}',
      '.tdl-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.tdl-filters{display:flex;flex-wrap:wrap;gap:3px;padding:3px;border:.5px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-layer-1)}',
      '.tdl-filter{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}',
      '.tdl-filter:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-secondary) 8%,transparent)}',
      '.tdl-filter-active,.tdl-filter-active:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary);font-weight:500}',
      '.tdl-filter-count{min-width:14px;padding:0 3px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);font-size:10.5px;line-height:15px;text-align:center;font-variant-numeric:tabular-nums}',
      '.tdl-spacer{flex:1}',
      '.tdl-clear{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer}',
      '.tdl-clear:hover{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent)}',
      '.tdl-add{display:flex;align-items:center;gap:6px;padding:4px;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}',
      '.tdl-add-input{flex:1;min-width:0;height:30px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}',
      '.tdl-add-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.75}',
      '.tdl-add-select{flex:none;height:26px;max-width:132px;padding:0 4px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px}',
      '.tdl-add-btn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.tdl-add-btn:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.tdl-list{display:flex;flex-direction:column;gap:1px}',
      '.tdl-section{margin-top:10px}',
      '.tdl-section:first-child{margin-top:2px}',
      '.tdl-section-head{display:flex;align-items:center;gap:6px;padding:0 2px 4px;font-size:11.5px;font-weight:500;color:var(--dsw-alias-label-secondary)}',
      '.tdl-section-count{min-width:14px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);font-size:10px;line-height:15px;text-align:center;font-variant-numeric:tabular-nums;font-weight:400}',
      '.tdl-task{display:flex;align-items:center;gap:7px;min-height:38px;padding:4px 6px;border-radius:10px;background:transparent}',
      '.tdl-task:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.tdl-task-done .tdl-task-title{color:var(--dsw-alias-label-secondary);text-decoration:line-through;text-decoration-thickness:1px}',
      '.tdl-task-dragging{opacity:.45}',
      '.tdl-drop-before{box-shadow:inset 0 2px 0 var(--dsw-alias-brand-primary)}',
      '.tdl-drop-after{box-shadow:inset 0 -2px 0 var(--dsw-alias-brand-primary)}',
      '.tdl-drag{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:26px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-secondary);opacity:.35;cursor:grab}',
      '.tdl-task:hover .tdl-drag{opacity:.8}',
      '.tdl-check{flex:none;width:15px;height:15px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}',
      '.tdl-task-title{flex:1;min-width:0;font-size:13.5px;line-height:20px;overflow-wrap:anywhere;cursor:text;border-radius:4px}',
      '.tdl-title-input{flex:1;min-width:0;height:26px;padding:0 6px;border:.5px solid var(--dsw-alias-brand-primary);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13.5px;outline:none}',
      '.tdl-meta{flex:none;display:inline-flex;align-items:center;gap:2px}',
      '.tdl-group-badge{max-width:96px;height:17px;padding:0 6px;border:0;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}',
      '.tdl-group-badge:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.tdl-pop.tdl-groupmenu{gap:2px;padding:8px}',
      '.tdl-groupmenu .tdl-panel-section-title{padding:2px 6px 5px}',
      '.tdl-groupmenu-item{display:flex;flex:none;align-items:center;gap:7px;height:30px;padding:0 7px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer}',
      '.tdl-groupmenu-item:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent))}',
      '.tdl-groupmenu-item[aria-checked=true]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 11%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.tdl-groupmenu-check{flex:none;display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px}',
      '.tdl-groupmenu-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tdl-due{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 6px;border:.5px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1;white-space:nowrap;cursor:pointer;font-variant-numeric:tabular-nums}',
      '.tdl-due:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 9%,transparent);color:var(--dsw-alias-label-primary)}',
      '.tdl-due-overdue,.tdl-due-overdue:hover{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent)}',
      '.tdl-due-empty{opacity:0;transition:opacity .12s}',
      '.tdl-task:hover .tdl-due-empty,.tdl-task:focus-within .tdl-due-empty{opacity:.7}',
      '.tdl-priority{display:inline-flex;align-items:flex-end;gap:2px;height:22px;padding:0 4px;border:0;border-radius:6px;background:transparent;cursor:pointer}',
      '.tdl-priority:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 9%,transparent)}',
      '.tdl-priority-bar{width:3px;border-radius:1px;background:var(--dsw-alias-border-l2)}',
      '.tdl-priority-bar:nth-child(1){height:6px}',
      '.tdl-priority-bar:nth-child(2){height:9px}',
      '.tdl-priority-bar:nth-child(3){height:12px}',
      '.tdl-priority-bar-on{background:var(--dsw-alias-brand-primary)}',
      '.tdl-priority-medium .tdl-priority-bar-on{background:var(--dsw-alias-state-warn-primary)}',
      '.tdl-priority-high .tdl-priority-bar-on{background:var(--dsw-alias-state-error-primary)}',
      '.tdl-del{flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);opacity:0;cursor:pointer;transition:opacity .12s,color .12s}',
      '.tdl-task:hover .tdl-del,.tdl-task:focus-within .tdl-del,.tdl-task-confirming .tdl-del{opacity:1}',
      '.tdl-del:hover{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent)}',
      '.tdl-confirm{flex:none;display:inline-flex;align-items:center;gap:2px}',
      '.tdl-text-btn{height:22px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}',
      '.tdl-text-btn:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent));color:var(--dsw-alias-label-primary)}',
      '.tdl-text-btn-danger{color:var(--dsw-alias-state-error-primary)}',
      '.tdl-text-btn-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary)}',
      '.tdl-empty{padding:26px 12px;border:.5px dashed var(--dsw-alias-border-l2);border-radius:14px;color:var(--dsw-alias-label-secondary);font-size:12.5px;text-align:center}',
      '.tdl-warn{margin:0;padding:7px 10px;border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,var(--dsw-alias-border-l1));border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}',
      '.tdl-notice{margin:0 0 10px;padding:7px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.tdl-notice[data-kind=error]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,var(--dsw-alias-border-l1))}',
      '.tdl-notice[data-kind=ok]{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 40%,var(--dsw-alias-border-l1))}',
      '.tdl-foot{margin-top:12px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);opacity:.8}',
      '.tdl-file{display:none}',
      '.tdl-dock{position:relative;display:inline-flex;align-items:center;gap:2px;height:24px;font-family:inherit;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary);white-space:nowrap;user-select:none}',
      '.tdl-dock-main{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 7px;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer}',
      '.tdl-dock-main:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent)}',
      '.tdl-dock-label{color:var(--dsw-alias-label-primary)}',
      '.tdl-dock-today{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.tdl-dock-overdue{display:inline-flex;align-items:center;height:16px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary);font-size:10.5px;font-variant-numeric:tabular-nums}',
      '.tdl-dock-add{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.tdl-dock-add:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 12%,transparent);color:var(--dsw-alias-label-primary)}',
      '.tdl-pop{box-sizing:border-box;z-index:9998;display:flex;flex-direction:column;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);box-shadow:0 18px 48px color-mix(in srgb,#000 30%,transparent);font-family:inherit;font-size:12.5px;line-height:18px;overflow:auto}',
      '.tdl-quick{display:flex;align-items:center;gap:6px;padding:0 0 8px}',
      '.tdl-quick-input{flex:1;min-width:0;height:28px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}',
      '.tdl-quick-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.75}',
      '.tdl-quick-add{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.tdl-quick-add:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.tdl-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 2px 6px}',
      '.tdl-panel-title{font-size:13px;font-weight:600}',
      '.tdl-panel-sub{font-size:11.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.tdl-panel-section{display:flex;flex-direction:column;gap:1px}',
      '.tdl-panel-section + .tdl-panel-section{margin-top:6px;padding-top:6px;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.tdl-panel-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 3px 3px;font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.tdl-panel-section-title-warn{color:var(--dsw-alias-state-error-primary)}',
      '.tdl-panel-item{display:flex;align-items:center;gap:7px;padding:4px 4px;border-radius:8px}',
      '.tdl-panel-item:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 8%,transparent)}',
      '.tdl-panel-task{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}',
      '.tdl-panel-task-done{color:var(--dsw-alias-label-secondary);text-decoration:line-through;text-decoration-thickness:1px}',
      '.tdl-panel-due{flex:none;font-size:10.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.tdl-panel-due-late{color:var(--dsw-alias-state-error-primary)}',
      '.tdl-panel-empty{margin:0;padding:4px 3px 2px;font-size:11.5px;color:var(--dsw-alias-label-secondary)}',
      '.tdl-panel-done-toggle{display:flex;align-items:center;gap:4px;width:100%;margin-top:4px;padding:5px 3px 0;border:0;border-top:.5px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;text-align:left;cursor:pointer}',
      '.tdl-panel-done-toggle:hover{color:var(--dsw-alias-label-primary)}',
      '.tdl-panel-foot{padding:8px 3px 1px;border-top:.5px solid var(--dsw-alias-border-l1);margin-top:6px;font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.tdl-datemenu{gap:7px;padding:10px}',
      '.tdl-date-input{box-sizing:border-box;height:30px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}',
      '.tdl-date-actions{display:flex;flex-wrap:wrap;gap:4px}',
      '.tdl-date-actions .tdl-text-btn{border:.5px solid var(--dsw-alias-border-l1);border-radius:7px}',
      '.tdl-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:color-mix(in srgb,#000 30%,transparent)}',
      '.tdl-dialog{box-sizing:border-box;display:flex;flex-direction:column;gap:9px;width:min(420px,100%);max-height:calc(100dvh - 48px);padding:18px 20px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);box-shadow:0 24px 64px color-mix(in srgb,#000 32%,transparent);outline:none}',
      '.tdl-dialog-title{margin:0;font-size:15px;font-weight:600;line-height:22px}',
      '.tdl-dialog-sub{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.tdl-field{display:flex;flex-direction:column;gap:5px}',
      '.tdl-field-label{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary)}',
      '.tdl-field input{box-sizing:border-box;width:100%;height:32px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}',
      '.tdl-dialog-error{margin:0;font-size:11.5px;line-height:17px;color:var(--dsw-alias-state-error-primary)}',
      '.tdl-dialog-actions{display:flex;align-items:center;gap:8px;margin-top:3px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.tdl-btn{height:28px;padding:0 11px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}',
      '.tdl-btn:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent))}',
      '.tdl-btn-primary{border-color:transparent;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);color:var(--dsw-alias-brand-primary);font-weight:500}',
      '.tdl-btn-primary:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}',
      '.tdl-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,var(--dsw-alias-border-l1))}',
      '.tdl-help-steps{display:flex;flex-direction:column;gap:8px;overflow:auto;margin:2px -2px;padding:0 2px}',
      '.tdl-help-step{padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.tdl-help-step h3{margin:0 0 2px;font-size:12.5px;font-weight:600;line-height:18px}',
      '.tdl-help-step p{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.tdl-help-note{margin:8px 0 0;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l1);font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary)}',
      '@media (max-width:720px){.tdl-body{flex-direction:column;gap:8px}.tdl-rail{width:100%;flex-direction:row;align-items:center;gap:4px;overflow-x:auto;padding-bottom:2px}.tdl-rail-row{flex:none}.tdl-rail-row .tdl-rail-item{flex:none;height:30px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1)}.tdl-rail-edit{position:static;opacity:1;width:22px}.tdl-rail-add{flex:none;margin-top:0;height:30px}.tdl-group-badge{max-width:110px;height:24px;padding:0 8px;font-size:11px;line-height:24px}.tdl-meta{gap:1px}}',
    ].join('');

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

    function newId(prefix) {
      try {
        if (
          typeof window !== 'undefined' &&
          window.crypto &&
          typeof window.crypto.randomUUID === 'function'
        ) {
          return `${prefix}_${window.crypto.randomUUID()}`;
        }
      } catch (error) {
        /* fall through to the timestamp id */
      }
      return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    /* ------------------------------------------------------------------ */
    /* Date helpers                                                        */
    /* ------------------------------------------------------------------ */

    function pad2(value) {
      return String(value).padStart(2, '0');
    }

    function dayKeyFromDate(date) {
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    }

    function todayKey(now) {
      return dayKeyFromDate(new Date(typeof now === 'number' ? now : Date.now()));
    }

    function parseDayKey(key) {
      if (typeof key !== 'string') return null;
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
      if (match === null) return null;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }
      return date;
    }

    function normalizeDue(value) {
      return typeof value === 'string' && parseDayKey(value) !== null ? value : null;
    }

    function dayDiff(fromKey, toKey) {
      const from = parseDayKey(fromKey);
      const to = parseDayKey(toKey);
      if (from === null || to === null) return 0;
      const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
      const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
      return Math.round((toUtc - fromUtc) / 86400000);
    }

    function addDaysKey(key, days) {
      const date = parseDayKey(key);
      if (date === null) return null;
      date.setDate(date.getDate() + days);
      return dayKeyFromDate(date);
    }

    function formatDue(due, t, locale) {
      const delta = dayDiff(todayKey(), due);
      if (delta === 0) return t('task.dueToday');
      if (delta === 1) return t('task.dueTomorrow');
      if (delta === -1) return t('task.dueOverdue', { days: 1 });
      if (delta < -1) return t('task.dueOverdue', { days: -delta });
      const date = parseDayKey(due);
      if (date === null) return due;
      let language = 'en-US';
      try {
        const snapshot = locale === null || locale === undefined ? null : locale.getSnapshot();
        language = snapshot !== null && snapshot.active === 'zh' ? 'zh-CN' : 'en-US';
      } catch (error) {
        /* keep the default */
      }
      try {
        return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }).format(
          date,
        );
      } catch (error) {
        return due;
      }
    }

    function byOrder(a, b) {
      return a.order - b.order || a.createdAt - b.createdAt;
    }

    /* ------------------------------------------------------------------ */
    /* Normalization                                                       */
    /* ------------------------------------------------------------------ */

    function normalizeGroups(raw) {
      const source = Array.isArray(raw) ? raw : [];
      const seenIds = new Set();
      const seenNames = new Set();
      const groups = [];
      source.forEach((item, index) => {
        if (item === null || typeof item !== 'object') return;
        // `all` is the synthetic "every group" view, never a real group id.
        if (
          typeof item.id !== 'string' ||
          item.id === '' ||
          item.id === 'all' ||
          BUILTIN_IDS.has(item.id)
        ) {
          return;
        }
        if (seenIds.has(item.id)) return;
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (name === '' || [...name].length > MAX_GROUP_NAME) return;
        const lowered = name.toLowerCase();
        if (seenNames.has(lowered)) return;
        seenIds.add(item.id);
        seenNames.add(lowered);
        groups.push({
          id: item.id,
          name,
          order: Number.isFinite(item.order) ? item.order : BUILTIN_GROUPS.length + index,
        });
      });
      return groups;
    }

    function normalizeTask(raw, fallbackOrder, seenIds) {
      if (raw === null || typeof raw !== 'object') return null;
      const title = typeof raw.title === 'string' ? raw.title.trim() : '';
      if (title === '') return null;
      let id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : newId('t');
      while (seenIds.has(id)) id = newId('t');
      seenIds.add(id);
      const done = raw.done === true;
      const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
      return {
        id,
        title,
        done,
        doneAt: done && Number.isFinite(raw.doneAt) ? raw.doneAt : done ? createdAt : null,
        due: normalizeDue(raw.due),
        priority: PRIORITIES.indexOf(raw.priority) >= 0 ? raw.priority : 'none',
        groupId: typeof raw.groupId === 'string' ? raw.groupId : 'inbox',
        order: Number.isFinite(raw.order) ? raw.order : fallbackOrder,
        createdAt,
        updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
      };
    }

    function normalizeData(raw) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      const groups = normalizeGroups(source.groups);
      const knownGroups = new Set(BUILTIN_IDS);
      groups.forEach((group) => knownGroups.add(group.id));
      const seenIds = new Set();
      const tasks = [];
      const rawTasks = Array.isArray(source.tasks) ? source.tasks : [];
      rawTasks.forEach((item, index) => {
        const task = normalizeTask(item, index, seenIds);
        if (task === null) return;
        if (!knownGroups.has(task.groupId)) task.groupId = 'inbox';
        tasks.push(task);
      });
      return { version: 1, groups, tasks };
    }

    function normalizeUi(raw, data) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      const requested = source.groupId;
      const validGroup =
        requested === 'all' ||
        (typeof requested === 'string' &&
          (BUILTIN_IDS.has(requested) || data.groups.some((group) => group.id === requested)));
      return {
        groupId: validGroup ? requested : 'all',
        filter: FILTERS.indexOf(source.filter) >= 0 ? source.filter : 'all',
      };
    }

    function allGroups(customGroups) {
      return BUILTIN_GROUPS.map((group) => ({
        id: group.id,
        order: group.order,
        builtin: true,
      })).concat(
        customGroups
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((group) => ({ id: group.id, name: group.name, order: group.order, builtin: false })),
      );
    }

    function groupLabel(group, t) {
      return group.builtin ? t(`group.${group.id}`) : group.name;
    }

    /* ------------------------------------------------------------------ */
    /* Store                                                               */
    /* ------------------------------------------------------------------ */

    function createStore() {
      let data;
      let loadError;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        data = normalizeData(raw === null ? null : JSON.parse(raw));
        loadError = false;
      } catch (error) {
        data = normalizeData(null);
        loadError = true;
      }
      let ui = normalizeUi(readJson(UI_KEY, null), data);
      let storageError = false;
      let snapshot = null;
      const listeners = new Set();

      function buildSnapshot() {
        return {
          tasks: data.tasks,
          groups: data.groups,
          ui,
          storageError,
          loadError,
        };
      }

      function emit() {
        snapshot = buildSnapshot();
        listeners.forEach((listener) => listener(snapshot));
      }

      function persistData() {
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ version: 1, groups: data.groups, tasks: data.tasks }),
          );
          storageError = false;
          loadError = false;
        } catch (error) {
          storageError = true;
        }
      }

      function persistUi() {
        try {
          window.localStorage.setItem(UI_KEY, JSON.stringify(ui));
        } catch (error) {
          /* UI state is a convenience; ignore quota or privacy-mode failures */
        }
      }

      function groupExists(id) {
        return (
          typeof id === 'string' &&
          (BUILTIN_IDS.has(id) || data.groups.some((group) => group.id === id))
        );
      }

      function updateTask(id, patch) {
        const index = data.tasks.findIndex((task) => task.id === id);
        if (index < 0) return;
        const next = Object.assign({}, data.tasks[index], patch, { updatedAt: Date.now() });
        const tasks = data.tasks.slice();
        tasks[index] = next;
        data.tasks = tasks;
        persistData();
        emit();
      }

      function addTask(input) {
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        if (title === '') return null;
        const groupId = groupExists(input.groupId) ? input.groupId : 'inbox';
        const siblingOrders = data.tasks
          .filter((task) => task.groupId === groupId)
          .map((task) => task.order);
        const minOrder = siblingOrders.length > 0 ? Math.min.apply(null, siblingOrders) : 0;
        const now = Date.now();
        const task = {
          id: newId('t'),
          title,
          done: false,
          doneAt: null,
          due: normalizeDue(input.due),
          priority: PRIORITIES.indexOf(input.priority) >= 0 ? input.priority : 'none',
          groupId,
          order: minOrder - 1,
          createdAt: now,
          updatedAt: now,
        };
        data.tasks = data.tasks.concat([task]);
        persistData();
        emit();
        return task;
      }

      function toggleTask(id) {
        const task = data.tasks.find((item) => item.id === id);
        if (task === undefined) return;
        updateTask(id, { done: !task.done, doneAt: task.done ? null : Date.now() });
      }

      function renameTask(id, title) {
        const trimmed = typeof title === 'string' ? title.trim() : '';
        if (trimmed === '') return;
        updateTask(id, { title: trimmed });
      }

      function setDue(id, due) {
        updateTask(id, { due: normalizeDue(due) });
      }

      function cyclePriority(id) {
        const task = data.tasks.find((item) => item.id === id);
        if (task === undefined) return;
        const index = PRIORITIES.indexOf(task.priority);
        updateTask(id, { priority: PRIORITIES[(index + 1) % PRIORITIES.length] });
      }

      function deleteTask(id) {
        const tasks = data.tasks.filter((task) => task.id !== id);
        if (tasks.length === data.tasks.length) return;
        data.tasks = tasks;
        persistData();
        emit();
      }

      function clearCompleted(groupId) {
        const tasks = data.tasks.filter(
          (task) => !(task.done && (groupId === 'all' || task.groupId === groupId)),
        );
        const removed = data.tasks.length - tasks.length;
        if (removed === 0) return 0;
        data.tasks = tasks;
        persistData();
        emit();
        return removed;
      }

      function reorderTask(draggedId, targetId, after) {
        if (draggedId === targetId) return;
        const dragged = data.tasks.find((task) => task.id === draggedId);
        const target = data.tasks.find((task) => task.id === targetId);
        if (dragged === undefined || target === undefined || dragged.groupId !== target.groupId) {
          return;
        }
        const groupTasks = data.tasks
          .filter((task) => task.groupId === dragged.groupId)
          .sort(byOrder);
        groupTasks.splice(
          groupTasks.findIndex((task) => task.id === draggedId),
          1,
        );
        let targetIndex = groupTasks.findIndex((task) => task.id === targetId);
        if (targetIndex < 0) return;
        if (after) targetIndex += 1;
        groupTasks.splice(targetIndex, 0, dragged);
        const orderById = new Map(groupTasks.map((task, index) => [task.id, index]));
        data.tasks = data.tasks.map((task) =>
          task.groupId === dragged.groupId
            ? Object.assign({}, task, { order: orderById.get(task.id) })
            : task,
        );
        persistData();
        emit();
      }

      function moveTaskToGroup(id, groupId) {
        const task = data.tasks.find((item) => item.id === id);
        if (task === undefined || !groupExists(groupId) || task.groupId === groupId) {
          return false;
        }
        const targetOrders = data.tasks
          .filter((item) => item.groupId === groupId)
          .map((item) => item.order);
        const order = targetOrders.length > 0 ? Math.max.apply(null, targetOrders) + 1 : 0;
        updateTask(id, { groupId, order });
        return true;
      }

      function addGroup(name) {
        const trimmed = typeof name === 'string' ? name.trim() : '';
        if (trimmed === '' || [...trimmed].length > MAX_GROUP_NAME) return null;
        const lowered = trimmed.toLowerCase();
        if (data.groups.some((group) => group.name.toLowerCase() === lowered)) return null;
        const maxOrder = data.groups.reduce(
          (max, group) => Math.max(max, group.order),
          BUILTIN_GROUPS.length - 1,
        );
        const group = { id: newId('g'), name: trimmed, order: maxOrder + 1 };
        data.groups = data.groups.concat([group]);
        persistData();
        emit();
        return group;
      }

      function renameGroup(id, name) {
        const trimmed = typeof name === 'string' ? name.trim() : '';
        if (trimmed === '' || [...trimmed].length > MAX_GROUP_NAME) return false;
        const lowered = trimmed.toLowerCase();
        if (
          data.groups.some(
            (group) => group.id !== id && group.name.toLowerCase() === lowered,
          )
        ) {
          return false;
        }
        const index = data.groups.findIndex((group) => group.id === id);
        if (index < 0) return false;
        const groups = data.groups.slice();
        groups[index] = Object.assign({}, groups[index], { name: trimmed });
        data.groups = groups;
        persistData();
        emit();
        return true;
      }

      function deleteGroup(id) {
        if (BUILTIN_IDS.has(id)) return;
        if (!data.groups.some((group) => group.id === id)) return;
        let order = data.tasks
          .filter((task) => task.groupId === 'inbox')
          .reduce((max, task) => Math.max(max, task.order), 0);
        const now = Date.now();
        data.tasks = data.tasks.map((task) => {
          if (task.groupId !== id) return task;
          order += 1;
          return Object.assign({}, task, {
            groupId: 'inbox',
            order,
            updatedAt: now,
          });
        });
        data.groups = data.groups.filter((group) => group.id !== id);
        if (ui.groupId === id) {
          ui = Object.assign({}, ui, { groupId: 'inbox' });
          persistUi();
        }
        persistData();
        emit();
      }

      function setSelectedGroup(groupId) {
        if (groupId !== 'all' && !groupExists(groupId)) return;
        if (ui.groupId === groupId) return;
        ui = Object.assign({}, ui, { groupId });
        persistUi();
        emit();
      }

      function setFilter(filter) {
        if (FILTERS.indexOf(filter) < 0 || ui.filter === filter) return;
        ui = Object.assign({}, ui, { filter });
        persistUi();
        emit();
      }

      function importData(payload) {
        const incoming = normalizeData(payload);
        const knownGroupIds = new Set(BUILTIN_IDS);
        data.groups.forEach((group) => knownGroupIds.add(group.id));
        const groups = data.groups.slice();
        let addedGroups = 0;
        incoming.groups.forEach((group) => {
          if (knownGroupIds.has(group.id)) return;
          knownGroupIds.add(group.id);
          groups.push(group);
          addedGroups += 1;
        });
        data.groups = groups;
        const tasks = data.tasks.slice();
        const indexById = new Map(tasks.map((task, index) => [task.id, index]));
        let added = 0;
        let updated = 0;
        let skipped = 0;
        incoming.tasks.forEach((incomingTask) => {
          const index = indexById.get(incomingTask.id);
          if (index === undefined) {
            indexById.set(incomingTask.id, tasks.length);
            tasks.push(incomingTask);
            added += 1;
            return;
          }
          if (incomingTask.updatedAt > tasks[index].updatedAt) {
            tasks[index] = incomingTask;
            updated += 1;
            return;
          }
          skipped += 1;
        });
        data.tasks = tasks;
        persistData();
        emit();
        return { added, updated, skipped, addedGroups };
      }

      function exportPayload() {
        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          groups: data.groups,
          tasks: data.tasks,
        };
      }

      snapshot = buildSnapshot();

      return {
        getState() {
          return snapshot;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        addTask,
        toggleTask,
        renameTask,
        setDue,
        cyclePriority,
        deleteTask,
        clearCompleted,
        reorderTask,
        moveTaskToGroup,
        addGroup,
        renameGroup,
        deleteGroup,
        setSelectedGroup,
        setFilter,
        importData,
        exportPayload,
      };
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

    function useTransientNotice() {
      const [notice, setNotice] = React.useState(null);
      const timerRef = React.useRef(null);
      const show = React.useCallback((text, kind) => {
        setNotice({ text, kind: kind === 'error' ? 'error' : 'ok' });
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setNotice(null);
        }, 3200);
      }, []);
      React.useEffect(
        () => () => {
          if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        },
        [],
      );
      return [notice, show];
    }

    /* ------------------------------------------------------------------ */
    /* Icons                                                               */
    /* ------------------------------------------------------------------ */

    function glyph(children, size) {
      return h(
        'svg',
        {
          width: size || 16,
          height: size || 16,
          viewBox: '0 0 16 16',
          'aria-hidden': true,
          focusable: 'false',
        },
        ...children,
      );
    }

    function strokePath(d, extra) {
      return h(
        'path',
        Object.assign(
          {
            d,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.4,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          extra,
        ),
      );
    }

    function plusGlyph(size) {
      return glyph([strokePath('M8 3.2v9.6'), strokePath('M3.2 8h9.6')], size);
    }

    function checkGlyph(size) {
      return glyph([strokePath('M3.4 8.4l3.1 3.1 6.1-6.8')], size);
    }

    function xGlyph(size) {
      return glyph([strokePath('M4.2 4.2l7.6 7.6'), strokePath('M11.8 4.2l-7.6 7.6')], size);
    }

    function calendarGlyph(size) {
      return glyph(
        [
          h('rect', {
            key: 'body',
            x: 2.4,
            y: 3.2,
            width: 11.2,
            height: 10,
            rx: 2,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.2,
          }),
          strokePath('M2.4 6.2h11.2', { strokeWidth: 1.1 }),
          strokePath('M5.2 2v2.3', { strokeWidth: 1.2 }),
          strokePath('M10.8 2v2.3', { strokeWidth: 1.2 }),
        ],
        size,
      );
    }

    function gripGlyph() {
      const dots = [];
      [4.2, 8, 11.8].forEach((y) => {
        [6.2, 9.8].forEach((x) => {
          dots.push(h('circle', { key: `${x}-${y}`, cx: x, cy: y, r: 0.95, fill: 'currentColor' }));
        });
      });
      return glyph(dots, 14);
    }

    function copyGlyph(size) {
      return glyph(
        [
          h('rect', {
            key: 'back',
            x: 5.2,
            y: 2.6,
            width: 8,
            height: 9,
            rx: 1.6,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.2,
          }),
          strokePath('M3.4 5.2v6.3a1.5 1.5 0 0 0 1.5 1.5h6.3'),
        ],
        size,
      );
    }

    function downloadGlyph(size) {
      return glyph(
        [
          strokePath('M8 2.8v7.1'),
          strokePath('M5.1 7.2 8 10.1l2.9-2.9'),
          strokePath('M3.4 12.7h9.2'),
        ],
        size,
      );
    }

    function uploadGlyph(size) {
      return glyph(
        [
          strokePath('M8 10.4V3.3'),
          strokePath('M5.1 6.2 8 3.3l2.9 2.9'),
          strokePath('M3.4 12.7h9.2'),
        ],
        size,
      );
    }

    function helpGlyph(size) {
      return glyph(
        [
          h('circle', {
            key: 'ring',
            cx: 8,
            cy: 8,
            r: 6.2,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.3,
          }),
          strokePath('M6.1 6.1a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.7.5-.7 1v.3', { strokeWidth: 1.3 }),
          h('circle', { key: 'dot', cx: 8, cy: 12, r: 0.85, fill: 'currentColor' }),
        ],
        size,
      );
    }

    function editGlyph(size) {
      return glyph(
        [
          strokePath('M3.2 12.8l.5-2.6 6.6-6.6a1.3 1.3 0 0 1 1.8 0l.9.9a1.3 1.3 0 0 1 0 1.8L6.4 12.3l-2.6.5Z'),
          strokePath('M9.2 4.8l2.6 2.6'),
        ],
        size,
      );
    }

    function PanelGlyph(props) {
      const size = props.size || 18;
      return glyph(
        [
          h('rect', {
            key: 'r1',
            x: 2.3,
            y: 2.2,
            width: 3.1,
            height: 3.1,
            rx: 0.9,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.2,
          }),
          strokePath('M7.1 3.75h6.6'),
          h('rect', {
            key: 'r2',
            x: 2.3,
            y: 6.6,
            width: 3.1,
            height: 3.1,
            rx: 0.9,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.2,
          }),
          strokePath('M7.1 8.15h6.6'),
          h('rect', {
            key: 'r3',
            x: 2.3,
            y: 11,
            width: 3.1,
            height: 3.1,
            rx: 0.9,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.2,
          }),
          strokePath('M7.1 12.55h4.6'),
        ],
        size,
      );
    }

    /* ------------------------------------------------------------------ */
    /* Markdown                                                            */
    /* ------------------------------------------------------------------ */

    function buildMarkdown(state, t, locale) {
      const groups = allGroups(state.groups);
      const lines = [`# ${t('page.title')}`, ''];
      let hasAny = false;
      groups.forEach((group) => {
        const tasks = state.tasks
          .filter((task) => task.groupId === group.id)
          .sort(byOrder);
        if (tasks.length === 0) return;
        hasAny = true;
        lines.push(`## ${groupLabel(group, t)}`, '');
        tasks.forEach((task) => {
          const meta = [];
          if (task.due !== null) meta.push(formatDue(task.due, t, locale));
          if (task.priority !== 'none') meta.push(t(PRIORITY_LABEL_KEY[task.priority]));
          lines.push(
            `- [${task.done ? 'x' : ' '}] ${task.title}${
              meta.length > 0 ? t('md.wrap', { value: meta.join(t('md.sep')) }) : ''
            }`,
          );
        });
        lines.push('');
      });
      if (!hasAny) lines.push(t('empty.all'));
      return lines.join('\n');
    }

    /* ------------------------------------------------------------------ */
    /* Task row                                                            */
    /* ------------------------------------------------------------------ */

    function TaskRow(props) {
      const { task, t, locale, groupLabel: groupText, canDrop } = props;
      const [editing, setEditing] = React.useState(false);
      const [draft, setDraft] = React.useState(task.title);
      const [confirming, setConfirming] = React.useState(false);
      const inputRef = React.useRef(null);

      React.useEffect(() => {
        setDraft(task.title);
      }, [task.title]);

      React.useEffect(() => {
        if (editing && inputRef.current !== null) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, [editing]);

      React.useEffect(() => {
        if (!confirming) return undefined;
        function onKey(event) {
          if (event.key === 'Escape') setConfirming(false);
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [confirming]);

      function startEditing() {
        setDraft(task.title);
        setEditing(true);
      }

      function commit() {
        const next = draft.trim();
        if (next !== '' && next !== task.title) props.onRename(task.id, next);
        setEditing(false);
      }

      function onTitleKeyDown(event) {
        if (
          event.nativeEvent !== undefined &&
          event.nativeEvent !== null &&
          event.nativeEvent.isComposing === true
        ) {
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setDraft(task.title);
          setEditing(false);
        }
      }

      function handleDragStart(event) {
        if (event.dataTransfer !== null) {
          try {
            event.dataTransfer.setData('text/plain', task.id);
            event.dataTransfer.effectAllowed = 'move';
          } catch (error) {
            /* some browsers restrict the drag data store; the id is in state */
          }
        }
        props.onDragStart(task.id);
      }

      function handleDragOver(event) {
        if (!canDrop(task)) return;
        event.preventDefault();
        if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
        const rect = event.currentTarget.getBoundingClientRect();
        const after = event.clientY > rect.top + rect.height / 2;
        props.onDragOver(task.id, after);
      }

      function handleDrop(event) {
        if (!canDrop(task)) return;
        event.preventDefault();
        props.onDrop(task.id);
      }

      const priorityCount =
        task.priority === 'high' ? 3 : task.priority === 'medium' ? 2 : task.priority === 'low' ? 1 : 0;
      const dueText = task.due === null ? '' : formatDue(task.due, t, locale);
      const overdue = task.due !== null && !task.done && task.due < todayKey();
      const rowClass = [
        'tdl-task',
        task.done ? 'tdl-task-done' : '',
        confirming ? 'tdl-task-confirming' : '',
        props.dragging ? 'tdl-task-dragging' : '',
        props.drop === 'before' ? 'tdl-drop-before' : props.drop === 'after' ? 'tdl-drop-after' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const priorityLabel = t(PRIORITY_LABEL_KEY[task.priority]);

      const meta = h(
        'span',
        { className: 'tdl-meta' },
        groupText
          ? h(
              'button',
              {
                type: 'button',
                className: 'tdl-group-badge',
                onClick: (event) => props.onGroupMenu(task, event.currentTarget),
                'aria-haspopup': 'menu',
                'aria-expanded': props.groupMenuOpen === true,
                'aria-label': t('task.groupValue', { name: groupText }),
                title: t('task.groupValue', { name: groupText }),
              },
              groupText,
            )
          : null,
        h(
          'button',
          {
            type: 'button',
            className: `tdl-due${overdue ? ' tdl-due-overdue' : ''}${
              task.due === null ? ' tdl-due-empty' : ''
            }`,
            onClick: (event) => props.onDue(task, event.currentTarget),
            'aria-label': task.due === null ? t('task.setDue') : t('task.dueValue', { value: dueText }),
            title: task.due === null ? t('task.setDue') : t('task.dueValue', { value: dueText }),
          },
          calendarGlyph(11),
          task.due === null ? t('task.addDue') : dueText,
        ),
        h(
          'button',
          {
            type: 'button',
            className: `tdl-priority tdl-priority-${task.priority}`,
            onClick: () => props.onCyclePriority(task.id),
            'aria-label': t('task.priorityCycle', { label: priorityLabel }),
            title: t('task.priorityCycle', { label: priorityLabel }),
          },
          [0, 1, 2].map((index) =>
            h('span', {
              key: index,
              className: `tdl-priority-bar${index < priorityCount ? ' tdl-priority-bar-on' : ''}`,
            }),
          ),
        ),
      );

      return h(
        'div',
        {
          className: rowClass,
          role: 'listitem',
          onDragOver: handleDragOver,
          onDrop: handleDrop,
        },
        h(
          'span',
          {
            className: 'tdl-drag',
            draggable: true,
            onDragStart: handleDragStart,
            onDragEnd: props.onDragEnd,
            title: t('task.drag'),
            'aria-hidden': true,
          },
          gripGlyph(),
        ),
        h('input', {
          className: 'tdl-check',
          type: 'checkbox',
          checked: task.done,
          onChange: () => props.onToggle(task.id),
          'aria-label': task.done ? t('task.uncomplete') : t('task.complete'),
        }),
        editing
          ? h('input', {
              ref: inputRef,
              className: 'tdl-title-input',
              type: 'text',
              value: draft,
              'aria-label': t('task.editTitle'),
              onChange: (event) => setDraft(event.target.value),
              onBlur: commit,
              onKeyDown: onTitleKeyDown,
            })
          : h(
              'span',
              {
                className: 'tdl-task-title',
                role: 'button',
                tabIndex: 0,
                onDoubleClick: startEditing,
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    startEditing();
                  }
                },
                title: t('task.editTitleHint'),
              },
              task.title,
            ),
        meta,
        confirming
          ? h(
              'span',
              { className: 'tdl-confirm' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'tdl-text-btn tdl-text-btn-danger',
                  onClick: () => props.onDelete(task.id),
                },
                t('task.confirmDelete'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'tdl-text-btn',
                  onClick: () => setConfirming(false),
                },
                t('task.cancelDelete'),
              ),
            )
          : h(
              'button',
              {
                type: 'button',
                className: 'tdl-del',
                onClick: () => setConfirming(true),
                'aria-label': t('task.delete'),
                title: t('task.delete'),
              },
              xGlyph(14),
            ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Due date menu                                                       */
    /* ------------------------------------------------------------------ */

    function DueMenu(props) {
      const { task, t, rect, onSet, onClose } = props;
      const panelRef = React.useRef(null);

      React.useEffect(() => {
        function onPointerDown(event) {
          if (panelRef.current !== null && panelRef.current.contains(event.target)) return;
          onClose();
        }
        function onKeyDown(event) {
          if (event.key === 'Escape') onClose();
        }
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onClose);
        window.addEventListener('scroll', onClose, true);
        return () => {
          document.removeEventListener('mousedown', onPointerDown);
          document.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('resize', onClose);
          window.removeEventListener('scroll', onClose, true);
        };
      }, [onClose]);

      const width = 240;
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - width - 8),
      );
      const top = Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - 214));

      return h(
        'div',
        {
          ref: panelRef,
          className: 'tdl-pop tdl-datemenu',
          role: 'dialog',
          'aria-label': t('task.dueMenuTitle'),
          style: { position: 'fixed', left, top, width, zIndex: 9998 },
        },
        h('div', { className: 'tdl-panel-section-title' }, t('task.dueMenuTitle')),
        h('input', {
          type: 'date',
          className: 'tdl-date-input',
          value: task.due === null ? '' : task.due,
          'aria-label': t('task.dueMenuTitle'),
          onChange: (event) => {
            const value = event.target.value;
            onSet(task.id, value === '' ? null : value);
            onClose();
          },
        }),
        h(
          'div',
          { className: 'tdl-date-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'tdl-text-btn',
              onClick: () => {
                onSet(task.id, todayKey());
                onClose();
              },
            },
            t('task.dueMenuToday'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'tdl-text-btn',
              onClick: () => {
                onSet(task.id, addDaysKey(todayKey(), 1));
                onClose();
              },
            },
            t('task.dueMenuTomorrow'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'tdl-text-btn',
              onClick: () => {
                onSet(task.id, null);
                onClose();
              },
            },
            t('task.dueMenuClear'),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Group menu                                                          */
    /* ------------------------------------------------------------------ */

    function GroupMenu(props) {
      const { task, groups, t, rect, anchor, onPick, onClose } = props;
      const panelRef = React.useRef(null);

      function focusAnchor() {
        if (anchor !== null && anchor !== undefined && typeof anchor.focus === 'function') {
          anchor.focus();
        }
      }

      React.useEffect(() => {
        function onPointerDown(event) {
          if (panelRef.current !== null && panelRef.current.contains(event.target)) return;
          if (
            anchor !== null &&
            anchor !== undefined &&
            typeof anchor.contains === 'function' &&
            anchor.contains(event.target)
          ) {
            return;
          }
          onClose();
        }
        function onKeyDown(event) {
          if (event.key === 'Escape') {
            event.preventDefault();
            focusAnchor();
            onClose();
          }
        }
        function onScroll(event) {
          if (panelRef.current !== null && panelRef.current.contains(event.target)) return;
          onClose();
        }
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onClose);
        window.addEventListener('scroll', onScroll, true);
        return () => {
          document.removeEventListener('mousedown', onPointerDown);
          document.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('resize', onClose);
          window.removeEventListener('scroll', onScroll, true);
        };
      }, [onClose]);

      React.useEffect(() => {
        const panel = panelRef.current;
        if (panel === null || typeof panel.querySelector !== 'function') return;
        const current = panel.querySelector('[aria-checked="true"]');
        const target = current !== null ? current : panel.querySelector('button');
        if (target !== null && typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      }, []);

      function onMenuKeyDown(event) {
        if (event.key === 'Tab') {
          onClose();
          return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const panel = panelRef.current;
        if (panel === null || typeof panel.querySelectorAll !== 'function') return;
        const items = Array.prototype.slice.call(
          panel.querySelectorAll('button[role="menuitemradio"]'),
        );
        if (items.length === 0) return;
        event.preventDefault();
        const active = typeof document !== 'undefined' ? document.activeElement : null;
        const index = items.indexOf(active);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const next = index < 0 ? 0 : (index + step + items.length) % items.length;
        if (typeof items[next].focus === 'function') {
          items[next].focus({ preventScroll: true });
        }
      }

      const width = 190;
      const estimatedHeight = Math.min(300, groups.length * 32 + 43);
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - width - 8),
      );
      const below = rect.bottom + 6;
      const above =
        (typeof rect.top === 'number' ? rect.top : rect.bottom) - estimatedHeight - 6;
      const top =
        below + estimatedHeight <= window.innerHeight - 8 ? below : Math.max(8, above);

      return h(
        'div',
        {
          ref: panelRef,
          className: 'tdl-pop tdl-groupmenu',
          role: 'menu',
          'aria-label': t('group.menuTitle'),
          style: { position: 'fixed', left, top, width, maxHeight: estimatedHeight, zIndex: 9998 },
          onKeyDown: onMenuKeyDown,
        },
        h(
          'div',
          { className: 'tdl-panel-section-title', 'aria-hidden': true },
          t('group.menuTitle'),
        ),
        groups.map((group) => {
          const current = group.id === task.groupId;
          const label = groupLabel(group, t);
          return h(
            'button',
            {
              key: group.id,
              type: 'button',
              role: 'menuitemradio',
              'aria-checked': current,
              tabIndex: -1,
              className: 'tdl-groupmenu-item',
              title: label,
              onClick: () => {
                focusAnchor();
                onPick(group.id);
              },
            },
            h(
              'span',
              { className: 'tdl-groupmenu-check', 'aria-hidden': true },
              current ? checkGlyph(12) : null,
            ),
            h('span', { className: 'tdl-groupmenu-label' }, label),
          );
        }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Dialogs                                                             */
    /* ------------------------------------------------------------------ */

    function GroupDialog(props) {
      const { t, mode, group, groups, count, onClose, onSave, onDelete } = props;
      const [name, setName] = React.useState(mode === 'edit' && group ? group.name : '');
      const [error, setError] = React.useState('');
      const [confirmingDelete, setConfirmingDelete] = React.useState(false);
      const inputRef = React.useRef(null);

      React.useEffect(() => {
        if (inputRef.current !== null) inputRef.current.focus();
      }, []);

      React.useEffect(() => {
        function onKey(event) {
          if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);

      function validate(value) {
        const trimmed = value.trim();
        if (trimmed === '') return t('group.nameRequired');
        if ([...trimmed].length > MAX_GROUP_NAME) {
          return t('group.nameTooLong', { max: MAX_GROUP_NAME });
        }
        const lowered = trimmed.toLowerCase();
        const builtinLabels = BUILTIN_GROUPS.map((item) =>
          t(`group.${item.id}`).toLowerCase(),
        );
        if (builtinLabels.indexOf(lowered) >= 0) return t('group.nameDuplicate');
        const selfId = group ? group.id : '';
        const duplicate = groups.some(
          (item) => item.id !== selfId && item.name.toLowerCase() === lowered,
        );
        if (duplicate) return t('group.nameDuplicate');
        return '';
      }

      function submit(event) {
        event.preventDefault();
        const problem = validate(name);
        if (problem !== '') {
          setError(problem);
          return;
        }
        onSave(name.trim());
      }

      return h(
        'div',
        {
          className: 'tdl-backdrop',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          'form',
          {
            className: 'tdl-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': mode === 'edit' ? t('group.rename') : t('group.new'),
            onSubmit: submit,
          },
          h('h2', { className: 'tdl-dialog-title' }, mode === 'edit' ? t('group.rename') : t('group.new')),
          h(
            'div',
            { className: 'tdl-field' },
            h('label', { className: 'tdl-field-label' }, t('group.nameLabel')),
            h('input', {
              ref: inputRef,
              type: 'text',
              value: name,
              placeholder: t('group.namePlaceholder'),
              'aria-label': t('group.nameLabel'),
              onChange: (event) => {
                setName(event.target.value);
                if (error !== '') setError('');
              },
            }),
          ),
          error !== '' ? h('p', { className: 'tdl-dialog-error' }, error) : null,
          confirmingDelete
            ? h(
                'div',
                null,
                h(
                  'p',
                  { className: 'tdl-dialog-sub' },
                  t('group.deleteTitle', { name: group ? group.name : '' }),
                ),
                h('p', { className: 'tdl-dialog-sub' }, t('group.deleteBody', { count })),
              )
            : null,
          h(
            'div',
            { className: 'tdl-dialog-actions' },
            confirmingDelete
              ? h(
                  React.Fragment,
                  null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'tdl-btn tdl-btn-danger',
                      onClick: onDelete,
                    },
                    t('group.deleteConfirm'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'tdl-btn',
                      onClick: () => setConfirmingDelete(false),
                    },
                    t('group.cancel'),
                  ),
                )
              : h(
                  React.Fragment,
                  null,
                  mode === 'edit' && group
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'tdl-btn tdl-btn-danger',
                          onClick: () => setConfirmingDelete(true),
                        },
                        t('group.deleteConfirm'),
                      )
                    : null,
                  h('span', { className: 'tdl-spacer' }),
                  h(
                    'button',
                    { type: 'button', className: 'tdl-btn', onClick: onClose },
                    t('group.cancel'),
                  ),
                  h(
                    'button',
                    { type: 'submit', className: 'tdl-btn tdl-btn-primary' },
                    t('group.save'),
                  ),
                ),
          ),
        ),
      );
    }

    function HelpDialog(props) {
      const { t, onClose } = props;
      React.useEffect(() => {
        function onKey(event) {
          if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);

      function step(title, body) {
        return h(
          'div',
          { className: 'tdl-help-step' },
          h('h3', null, title),
          h('p', null, body),
        );
      }

      return h(
        'div',
        {
          className: 'tdl-backdrop',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          'div',
          {
            className: 'tdl-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('help.title'),
          },
          h('h2', { className: 'tdl-dialog-title' }, t('help.title')),
          h('p', { className: 'tdl-dialog-sub' }, t('help.intro')),
          h(
            'div',
            { className: 'tdl-help-steps' },
            step(t('help.dockTitle'), t('help.dockBody')),
            step(t('help.pageTitle'), t('help.pageBody')),
            step(t('help.dataTitle'), t('help.data')),
          ),
          h('p', { className: 'tdl-help-note' }, t('help.delete')),
          h(
            'div',
            { className: 'tdl-dialog-actions' },
            h('span', { className: 'tdl-spacer' }),
            h(
              'button',
              { type: 'button', className: 'tdl-btn tdl-btn-primary', onClick: onClose },
              t('help.close'),
            ),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Page                                                                */
    /* ------------------------------------------------------------------ */

    function TodoPanel(props) {
      const { store, t, locale } = props;
      const state = useStoreState(store);
      useLocaleRevision(locale);
      const [addTitle, setAddTitle] = React.useState('');
      const [addGroup, setAddGroup] = React.useState(
        state.ui.groupId === 'all' ? 'inbox' : state.ui.groupId,
      );
      const [notice, showNotice] = useTransientNotice();
      const [helpOpen, setHelpOpen] = React.useState(false);
      const [groupDialog, setGroupDialog] = React.useState(null);
      const [dueMenu, setDueMenu] = React.useState(null);
      const [groupMenu, setGroupMenu] = React.useState(null);
      const [clearConfirm, setClearConfirm] = React.useState(false);
      const [drag, setDrag] = React.useState(null);
      const [groupDrop, setGroupDrop] = React.useState(null);
      const fileRef = React.useRef(null);

      React.useEffect(() => {
        if (state.ui.groupId !== 'all') setAddGroup(state.ui.groupId);
      }, [state.ui.groupId]);

      React.useEffect(() => {
        if (dueMenu === null) return;
        if (!state.tasks.some((task) => task.id === dueMenu.taskId)) setDueMenu(null);
      }, [state.tasks, dueMenu]);

      React.useEffect(() => {
        if (groupMenu === null) return;
        if (!state.tasks.some((task) => task.id === groupMenu.taskId)) setGroupMenu(null);
      }, [state.tasks, groupMenu]);

      React.useEffect(() => {
        if (state.ui.filter !== 'done') setClearConfirm(false);
      }, [state.ui.filter, state.ui.groupId]);

      React.useEffect(() => {
        setGroupMenu(null);
      }, [state.ui.groupId, state.ui.filter]);

      const groups = allGroups(state.groups);
      const today = todayKey();

      function countFor(groupId, filter) {
        return state.tasks.filter((task) => {
          if (groupId !== 'all' && task.groupId !== groupId) return false;
          if (filter === 'done') return task.done;
          if (task.done) return false;
          if (filter === 'today') return task.due === today;
          if (filter === 'overdue') return task.due !== null && task.due < today;
          return true;
        }).length;
      }

      function tasksFor(groupId, filter) {
        const source = state.tasks.filter((task) => task.groupId === groupId);
        if (filter === 'done') {
          return source
            .filter((task) => task.done)
            .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0) || a.order - b.order);
        }
        if (filter === 'today') {
          return source.filter((task) => !task.done && task.due === today).sort(byOrder);
        }
        if (filter === 'overdue') {
          return source
            .filter((task) => !task.done && task.due !== null && task.due < today)
            .sort(byOrder);
        }
        return source.filter((task) => !task.done).sort(byOrder);
      }

      function submitAdd(event) {
        event.preventDefault();
        const title = addTitle.trim();
        if (title === '') return;
        const groupId = state.ui.groupId === 'all' ? addGroup : state.ui.groupId;
        const now = todayKey();
        const due = state.ui.filter === 'today' ? now : null;
        const task = store.addTask({ title, groupId, due, priority: 'none' });
        setAddTitle('');
        if (task === null) return;
        const visible =
          state.ui.filter === 'all' ||
          (state.ui.filter === 'today' && task.due === now) ||
          (state.ui.filter === 'overdue' && task.due !== null && task.due < now);
        if (!visible) store.setFilter('all');
      }

      function copyMarkdown() {
        const text = buildMarkdown(state, t, locale);
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
        if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
          showNotice(t('notice.copyFailed'), 'error');
          return;
        }
        clipboard
          .writeText(text)
          .then(() => showNotice(t('notice.copied'), 'ok'))
          .catch(() => showNotice(t('notice.copyFailed'), 'error'));
      }

      function exportJson() {
        try {
          if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
            throw new Error('blob download unsupported');
          }
          const payload = JSON.stringify(store.exportPayload(), null, 2);
          const blob = new Blob([payload], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `todo-list-${todayKey()}.json`;
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          showNotice(t('notice.exported'), 'ok');
        } catch (error) {
          showNotice(t('notice.exportFailed'), 'error');
        }
      }

      function pickImport() {
        if (fileRef.current !== null) fileRef.current.click();
      }

      function importFile(event) {
        const file = event.target.files !== null && event.target.files.length > 0 ? event.target.files[0] : null;
        event.target.value = '';
        if (file === null) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const payload = JSON.parse(String(reader.result));
            if (
              payload === null ||
              typeof payload !== 'object' ||
              !Array.isArray(payload.tasks)
            ) {
              throw new Error('invalid backup');
            }
            const result = store.importData(payload);
            showNotice(
              t('notice.imported', {
                added: result.added,
                updated: result.updated,
                skipped: result.skipped,
              }),
              'ok',
            );
          } catch (error) {
            showNotice(t('notice.importFailed'), 'error');
          }
        };
        reader.onerror = () => showNotice(t('notice.importFailed'), 'error');
        reader.readAsText(file);
      }

      function confirmClearDone() {
        const removed = store.clearCompleted(state.ui.groupId);
        setClearConfirm(false);
        if (removed > 0) showNotice(t('notice.clearedDone', { count: removed }), 'ok');
      }

      function beginDrag(id) {
        setDrag({ id, overId: null, after: false });
        setGroupDrop(null);
        setGroupMenu(null);
      }

      function hoverDrag(overId, after) {
        setDrag((current) => {
          if (current === null) return current;
          if (current.overId === overId && current.after === after) return current;
          return Object.assign({}, current, { overId, after });
        });
      }

      function endDrag() {
        setDrag(null);
        setGroupDrop(null);
      }

      function canDrop(targetTask) {
        if (drag === null || drag.id === targetTask.id) return false;
        const dragged = state.tasks.find((task) => task.id === drag.id);
        return dragged !== undefined && dragged.groupId === targetTask.groupId;
      }

      function dropOn(targetId) {
        if (drag === null) return;
        store.reorderTask(drag.id, targetId, drag.after);
        setDrag(null);
      }

      function canDropOnGroup(groupId) {
        if (drag === null) return false;
        const dragged = state.tasks.find((task) => task.id === drag.id);
        return dragged !== undefined && dragged.groupId !== groupId;
      }

      function hoverGroup(event, groupId) {
        if (!canDropOnGroup(groupId)) {
          if (groupDrop !== null) setGroupDrop(null);
          return;
        }
        event.preventDefault();
        if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
          event.dataTransfer.dropEffect = 'move';
        }
        if (drag !== null && drag.overId !== null) {
          setDrag(Object.assign({}, drag, { overId: null, after: false }));
        }
        if (groupDrop !== groupId) setGroupDrop(groupId);
      }

      function dropOnGroup(event, groupId) {
        event.preventDefault();
        if (!canDropOnGroup(groupId)) {
          setDrag(null);
          setGroupDrop(null);
          return;
        }
        const draggedId = drag.id;
        setDrag(null);
        setGroupDrop(null);
        moveTaskToGroup(draggedId, groupId);
      }

      function moveTaskToGroup(taskId, groupId) {
        const group = groups.find((item) => item.id === groupId);
        if (group === undefined) return;
        if (store.moveTaskToGroup(taskId, groupId)) {
          showNotice(t('notice.moved', { name: groupLabel(group, t) }), 'ok');
        }
        setGroupMenu(null);
      }

      function onGroupMenu(task, element) {
        setGroupMenu((current) =>
          current !== null && current.taskId === task.id
            ? null
            : { taskId: task.id, rect: element.getBoundingClientRect(), anchor: element },
        );
      }

      function onDue(task, element) {
        setDueMenu({ taskId: task.id, rect: element.getBoundingClientRect() });
      }

      function openGroupDialog(mode, groupId) {
        setGroupDialog({ mode, groupId: groupId || null });
      }

      function renderTask(task) {
        const group = groups.find((item) => item.id === task.groupId);
        return h(TaskRow, {
          key: task.id,
          task,
          t,
          locale,
          groupLabel: group ? groupLabel(group, t) : '',
          groupMenuOpen: groupMenu !== null && groupMenu.taskId === task.id,
          dragging: drag !== null && drag.id === task.id,
          drop:
            drag !== null && drag.overId === task.id
              ? drag.after
                ? 'after'
                : 'before'
              : null,
          canDrop,
          onGroupMenu,
          onDragStart: beginDrag,
          onDragOver: hoverDrag,
          onDrop: dropOn,
          onDragEnd: endDrag,
          onToggle: store.toggleTask,
          onRename: store.renameTask,
          onDelete: store.deleteTask,
          onCyclePriority: store.cyclePriority,
          onDue,
        });
      }

      const currentGroup =
        state.ui.groupId === 'all'
          ? null
          : groups.find((group) => group.id === state.ui.groupId) || null;
      const sections =
        currentGroup === null
          ? groups
              .map((group) => ({ group, tasks: tasksFor(group.id, state.ui.filter) }))
              .filter((section) => section.tasks.length > 0)
          : [{ group: currentGroup, tasks: tasksFor(currentGroup.id, state.ui.filter) }];

      const dialogGroup =
        groupDialog !== null && groupDialog.mode === 'edit'
          ? state.groups.find((group) => group.id === groupDialog.groupId)
          : null;
      const dialogTaskCount =
        dialogGroup === null
          ? 0
          : state.tasks.filter((task) => task.groupId === dialogGroup.id).length;

      const emptyText =
        state.ui.filter === 'done'
          ? t('empty.done')
          : state.ui.groupId === 'all'
            ? state.ui.filter === 'all'
              ? t('empty.all')
              : t('empty.filter')
            : state.ui.filter === 'all'
              ? t('empty.group')
              : t('empty.filter');

      const dueTask =
        dueMenu === null ? null : state.tasks.find((task) => task.id === dueMenu.taskId);
      const groupMenuTask =
        groupMenu === null
          ? null
          : state.tasks.find((task) => task.id === groupMenu.taskId);

      const filters = h(
        'div',
        { className: 'tdl-filters', role: 'tablist', 'aria-label': t('a11y.filters') },
        FILTERS.map((filter) => {
          const active = state.ui.filter === filter;
          const count = countFor(state.ui.groupId, filter);
          return h(
            'button',
            {
              key: filter,
              type: 'button',
              role: 'tab',
              'aria-selected': active,
              className: `tdl-filter${active ? ' tdl-filter-active' : ''}`,
              onClick: () => store.setFilter(filter),
            },
            t(`filter.${filter}`),
            count > 0 ? h('span', { className: 'tdl-filter-count' }, String(count)) : null,
          );
        }),
      );

      const doneCount = countFor(state.ui.groupId, 'done');

      return h(
        React.Fragment,
        null,
        h('style', { key: 'styles' }, CSS),
        h(
          'div',
          { key: 'page', className: 'tdl-page' },
          h(
            'div',
            { className: 'tdl-scroll' },
            h(
              'div',
              { className: 'tdl-content' },
              h(
                'div',
                { className: 'tdl-head' },
                h(
                  'div',
                  { className: 'tdl-title' },
                  h('h1', null, t('page.title')),
                  h('p', { className: 'tdl-sub' }, t('page.subtitle')),
                ),
                h(
                  'div',
                  { className: 'tdl-head-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'tdl-icon-btn',
                      onClick: copyMarkdown,
                      'aria-label': t('actions.copy'),
                      title: t('actions.copy'),
                    },
                    copyGlyph(),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'tdl-icon-btn',
                      onClick: exportJson,
                      'aria-label': t('actions.export'),
                      title: t('actions.export'),
                    },
                    downloadGlyph(),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'tdl-icon-btn',
                      onClick: pickImport,
                      'aria-label': t('actions.import'),
                      title: t('actions.import'),
                    },
                    uploadGlyph(),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'tdl-icon-btn',
                      onClick: () => setHelpOpen(true),
                      'aria-label': t('actions.help'),
                      title: t('actions.help'),
                    },
                    helpGlyph(),
                  ),
                ),
              ),
              notice !== null
                ? h(
                    'div',
                    {
                      className: 'tdl-notice',
                      'data-kind': notice.kind,
                      role: 'status',
                    },
                    notice.text,
                  )
                : null,
              h(
                'div',
                { className: 'tdl-body' },
                h(
                  'aside',
                  { className: 'tdl-rail', 'aria-label': t('a11y.groupRail') },
                  h(
                    'div',
                    { className: 'tdl-rail-row' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: `tdl-rail-item${
                          state.ui.groupId === 'all' ? ' tdl-rail-item-active' : ''
                        }`,
                        onClick: () => store.setSelectedGroup('all'),
                      },
                      h('span', { className: 'tdl-rail-label' }, t('group.all')),
                      h(
                        'span',
                        { className: 'tdl-rail-count' },
                        String(countFor('all', 'all')),
                      ),
                    ),
                  ),
                  groups.map((group) =>
                    h(
                      'div',
                      {
                        key: group.id,
                        className: 'tdl-rail-row',
                        onDragOver: (event) => hoverGroup(event, group.id),
                        onDragLeave: () => {
                          if (groupDrop === group.id) setGroupDrop(null);
                        },
                        onDrop: (event) => dropOnGroup(event, group.id),
                      },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: `tdl-rail-item${
                            state.ui.groupId === group.id ? ' tdl-rail-item-active' : ''
                          }${groupDrop === group.id ? ' tdl-rail-item-drop' : ''}`,
                          onClick: () => store.setSelectedGroup(group.id),
                        },
                        h('span', { className: 'tdl-rail-label' }, groupLabel(group, t)),
                        h(
                          'span',
                          { className: 'tdl-rail-count' },
                          String(countFor(group.id, 'all')),
                        ),
                      ),
                      group.builtin
                        ? null
                        : h(
                            'button',
                            {
                              type: 'button',
                              className: 'tdl-rail-edit',
                              onClick: () => openGroupDialog('edit', group.id),
                              'aria-label': t('group.edit'),
                              title: t('group.edit'),
                            },
                            editGlyph(13),
                          ),
                    ),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'tdl-rail-add',
                      onClick: () => openGroupDialog('create', null),
                    },
                    plusGlyph(13),
                    t('group.new'),
                  ),
                ),
                h(
                  'main',
                  { className: 'tdl-main' },
                  h(
                    'div',
                    { className: 'tdl-toolbar' },
                    filters,
                    h('span', { className: 'tdl-spacer' }),
                    state.ui.filter === 'done' && doneCount > 0
                      ? clearConfirm
                        ? h(
                            React.Fragment,
                            null,
                            h(
                              'button',
                              {
                                type: 'button',
                                className: 'tdl-clear',
                                onClick: confirmClearDone,
                              },
                              t('actions.clearDoneConfirm', { count: doneCount }),
                            ),
                            h(
                              'button',
                              {
                                type: 'button',
                                className: 'tdl-clear',
                                onClick: () => setClearConfirm(false),
                              },
                              t('actions.clearDoneCancel'),
                            ),
                          )
                        : h(
                            'button',
                            {
                              type: 'button',
                              className: 'tdl-clear',
                              onClick: () => setClearConfirm(true),
                            },
                            t('actions.clearDone'),
                          )
                      : null,
                  ),
                  h(
                    'form',
                    { className: 'tdl-add', onSubmit: submitAdd },
                    h('input', {
                      className: 'tdl-add-input',
                      type: 'text',
                      value: addTitle,
                      placeholder: t('add.placeholder'),
                      'aria-label': t('add.placeholder'),
                      onChange: (event) => setAddTitle(event.target.value),
                    }),
                    state.ui.groupId === 'all'
                      ? h(
                          'select',
                          {
                            className: 'tdl-add-select',
                            value: addGroup,
                            onChange: (event) => setAddGroup(event.target.value),
                            'aria-label': t('add.group'),
                          },
                          groups.map((group) =>
                            h(
                              'option',
                              { key: group.id, value: group.id },
                              groupLabel(group, t),
                            ),
                          ),
                        )
                      : null,
                    h(
                      'button',
                      {
                        type: 'submit',
                        className: 'tdl-add-btn',
                        'aria-label': t('add.submit'),
                        title: t('add.submit'),
                      },
                      plusGlyph(),
                    ),
                  ),
                  state.loadError
                    ? h('p', { className: 'tdl-warn' }, t('notice.loadFailed'))
                    : null,
                  state.storageError
                    ? h('p', { className: 'tdl-warn' }, t('notice.storageUnavailable'))
                    : null,
                  sections.length === 0
                    ? h('p', { className: 'tdl-empty' }, emptyText)
                    : h(
                        'div',
                        { className: 'tdl-list', role: 'list', 'aria-label': t('a11y.tasks') },
                        sections.map((section, index) =>
                          h(
                            'section',
                            {
                              key: section.group ? section.group.id : `one-${index}`,
                              className: 'tdl-section',
                            },
                            section.group !== null && state.ui.groupId === 'all'
                              ? h(
                                  'div',
                                  { className: 'tdl-section-head' },
                                  h('span', null, groupLabel(section.group, t)),
                                  h(
                                    'span',
                                    { className: 'tdl-section-count' },
                                    String(section.tasks.length),
                                  ),
                                )
                              : null,
                            section.tasks.map((task) => renderTask(task)),
                          ),
                        ),
                      ),
                  h('p', { className: 'tdl-foot' }, t('page.foot')),
                ),
              ),
            ),
          ),
          h('input', {
            key: 'file',
            ref: fileRef,
            className: 'tdl-file',
            type: 'file',
            accept: 'application/json,.json',
            onChange: importFile,
            tabIndex: -1,
            'aria-hidden': true,
          }),
          dueMenu !== null && dueTask !== undefined && dueTask !== null
            ? h(DueMenu, {
                key: 'due',
                task: dueTask,
                t,
                rect: dueMenu.rect,
                onSet: store.setDue,
                onClose: () => setDueMenu(null),
              })
            : null,
          groupMenu !== null && groupMenuTask !== undefined && groupMenuTask !== null
            ? h(GroupMenu, {
                key: 'group',
                task: groupMenuTask,
                groups,
                t,
                rect: groupMenu.rect,
                anchor: groupMenu.anchor,
                onPick: (groupId) => moveTaskToGroup(groupMenuTask.id, groupId),
                onClose: () => setGroupMenu(null),
              })
            : null,
          groupDialog !== null
            ? h(GroupDialog, {
                key: 'group-dialog',
                t,
                mode: groupDialog.mode,
                group: dialogGroup,
                groups: state.groups,
                count: dialogTaskCount,
                onClose: () => setGroupDialog(null),
                onSave: (name) => {
                  if (groupDialog.mode === 'create') store.addGroup(name);
                  else if (dialogGroup !== null) store.renameGroup(dialogGroup.id, name);
                  setGroupDialog(null);
                },
                onDelete: () => {
                  if (dialogGroup !== null) store.deleteGroup(dialogGroup.id);
                  setGroupDialog(null);
                },
              })
            : null,
          helpOpen ? h(HelpDialog, { key: 'help', t, onClose: () => setHelpOpen(false) }) : null,
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Dock entry                                                          */
    /* ------------------------------------------------------------------ */

    function DockEntry(props) {
      const { store, t, locale } = props;
      const state = useStoreState(store);
      useLocaleRevision(locale);
      const wrapperRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const mainRef = React.useRef(null);
      const inputRef = React.useRef(null);
      const [open, setOpen] = React.useState(false);
      const [autoFocus, setAutoFocus] = React.useState(false);
      const [rect, setRect] = React.useState(null);
      const [title, setTitle] = React.useState('');
      const [showDone, setShowDone] = React.useState(false);

      const today = todayKey();
      const todayTasks = state.tasks
        .filter((task) => !task.done && task.due === today)
        .sort(byOrder);
      const doneTasks = state.tasks.filter((task) => task.done && task.due === today);
      const overdueTasks = state.tasks
        .filter((task) => !task.done && task.due !== null && task.due < today)
        .sort(byOrder);
      const total = todayTasks.length + doneTasks.length;

      function openPanel(focusInput) {
        const element = wrapperRef.current;
        if (element === null) return;
        setRect(element.getBoundingClientRect());
        setAutoFocus(focusInput);
        setOpen(true);
      }

      function closePanel(restoreFocus) {
        setOpen(false);
        setAutoFocus(false);
        if (restoreFocus === true && mainRef.current !== null) mainRef.current.focus();
      }

      React.useEffect(() => {
        if (!open) return undefined;
        function measure() {
          const element = wrapperRef.current;
          if (element !== null) setRect(element.getBoundingClientRect());
        }
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
      }, [open]);

      React.useEffect(() => {
        if (!open) return undefined;
        function onPointerDown(event) {
          if (panelRef.current !== null && panelRef.current.contains(event.target)) return;
          if (wrapperRef.current !== null && wrapperRef.current.contains(event.target)) return;
          closePanel();
        }
        function onKeyDown(event) {
          if (event.key === 'Escape') closePanel(true);
        }
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('mousedown', onPointerDown);
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [open]);

      React.useEffect(() => {
        if (open && autoFocus && inputRef.current !== null) inputRef.current.focus();
      }, [open, autoFocus]);

      function submitQuick(event) {
        event.preventDefault();
        const value = title.trim();
        if (value === '') return;
        store.addTask({ title: value, groupId: 'inbox', due: todayKey(), priority: 'none' });
        setTitle('');
        if (inputRef.current !== null) inputRef.current.focus();
      }

      function panelTaskRow(task, kind) {
        return h(
          'div',
          { key: task.id, className: 'tdl-panel-item' },
          h('input', {
            className: 'tdl-check',
            type: 'checkbox',
            checked: task.done,
            onChange: () => store.toggleTask(task.id),
            'aria-label': task.done ? t('task.uncomplete') : t('task.complete'),
          }),
          h(
            'span',
            {
              className: `tdl-panel-task${task.done ? ' tdl-panel-task-done' : ''}`,
            },
            task.title,
          ),
          task.due !== null && task.due !== today
            ? h(
                'span',
                {
                  className: `tdl-panel-due${
                    task.due < today && !task.done ? ' tdl-panel-due-late' : ''
                  }`,
                },
                formatDue(task.due, t, locale),
              )
            : null,
        );
      }

      const panelWidth = Math.min(320, Math.max(200, window.innerWidth - 16));
      const panelStyle =
        rect === null
          ? { display: 'none' }
          : {
              position: 'fixed',
              left: Math.min(
                Math.max(8, rect.left),
                Math.max(8, window.innerWidth - panelWidth - 8),
              ),
              bottom: Math.max(8, window.innerHeight - rect.top + 8),
              width: panelWidth,
              maxHeight: Math.max(180, Math.min(420, rect.top - 16)),
              zIndex: 9998,
            };

      return h(
        React.Fragment,
        null,
        h('style', { key: 'styles' }, CSS),
        h(
          'span',
          { key: 'dock', ref: wrapperRef, className: 'tdl-dock' },
          h(
            'button',
            {
              ref: mainRef,
              type: 'button',
              className: 'tdl-dock-main',
              onClick: () => (open ? closePanel() : openPanel(false)),
              'aria-haspopup': 'dialog',
              'aria-expanded': open,
              title: t('dock.label'),
            },
            h('span', { className: 'tdl-dock-label' }, t('dock.label')),
            total > 0
              ? h(
                  'span',
                  { className: 'tdl-dock-today' },
                  t('dock.today', { done: doneTasks.length, total }),
                )
              : null,
          ),
          overdueTasks.length > 0
            ? h(
                'span',
                { className: 'tdl-dock-overdue' },
                t('dock.overdue', { count: overdueTasks.length }),
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: 'tdl-dock-add',
              onClick: () => (open ? closePanel() : openPanel(true)),
              'aria-label': t('dock.add'),
              title: t('dock.add'),
            },
            plusGlyph(13),
          ),
        ),
        open && rect !== null
          ? h(
              'div',
              {
                key: 'panel',
                ref: panelRef,
                className: 'tdl-pop',
                role: 'dialog',
                'aria-label': t('dock.label'),
                style: panelStyle,
              },
              h(
                'form',
                { className: 'tdl-quick', onSubmit: submitQuick },
                h('input', {
                  ref: inputRef,
                  className: 'tdl-quick-input',
                  type: 'text',
                  value: title,
                  placeholder: t('dock.quickPlaceholder'),
                  'aria-label': t('dock.quickPlaceholder'),
                  onChange: (event) => setTitle(event.target.value),
                }),
                h(
                  'button',
                  {
                    type: 'submit',
                    className: 'tdl-quick-add',
                    'aria-label': t('dock.add'),
                    title: t('dock.add'),
                  },
                  plusGlyph(),
                ),
              ),
              h(
                'div',
                { className: 'tdl-panel-head' },
                h('span', { className: 'tdl-panel-title' }, t('dock.todayTitle')),
                h('span', { className: 'tdl-panel-sub' }, t('dock.today', {
                  done: doneTasks.length,
                  total,
                })),
              ),
              overdueTasks.length > 0
                ? h(
                    'div',
                    { className: 'tdl-panel-section' },
                    h(
                      'div',
                      {
                        className:
                          'tdl-panel-section-title tdl-panel-section-title-warn',
                      },
                      h('span', null, t('dock.overdueTitle')),
                      h('span', null, String(overdueTasks.length)),
                    ),
                    overdueTasks.map((task) => panelTaskRow(task, 'overdue')),
                  )
                : null,
              h(
                'div',
                { className: 'tdl-panel-section' },
                todayTasks.length > 0
                  ? todayTasks.map((task) => panelTaskRow(task, 'today'))
                  : h('p', { className: 'tdl-panel-empty' }, t('dock.emptyToday')),
              ),
              doneTasks.length > 0
                ? h(
                    React.Fragment,
                    null,
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'tdl-panel-done-toggle',
                        onClick: () => setShowDone((value) => !value),
                        'aria-expanded': showDone,
                      },
                      showDone ? '▾' : '▸',
                      t('dock.doneToday', { count: doneTasks.length }),
                    ),
                    showDone
                      ? h(
                          'div',
                          { className: 'tdl-panel-section' },
                          doneTasks.map((task) => panelTaskRow(task, 'done')),
                        )
                      : null,
                  )
                : null,
              h('div', { className: 'tdl-panel-foot' }, t('dock.footer')),
            )
          : null,
      );
    }

    /* ------------------------------------------------------------------ */
    /* Plugin                                                              */
    /* ------------------------------------------------------------------ */

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, 'en', DICT.en),
        'todo-list: English dictionary',
      );
      ctx.effect(
        () => ctx.locale.register(NS, 'zh', DICT.zh),
        'todo-list: Chinese dictionary',
      );
      const translate = ctx.locale.bind(NS);
      const locale = ctx.locale;
      const store = createStore();

      function TodoPanelIcon(props) {
        return h(PanelGlyph, { size: props.size });
      }

      function ComposerDockEntry() {
        return h(DockEntry, { store, t: translate, locale });
      }

      function TodoPanelPage() {
        return h(TodoPanel, { store, t: translate, locale });
      }

      ctx.slots.inject('conversation.composer.dock', () =>
        ctx.slots.register(
          {
            name: 'conversation.composer.dock',
            id: PANEL_ID,
            order: 7,
          },
          ComposerDockEntry,
        ),
      );

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 30,
            label: () => translate('panel.label'),
          },
          TodoPanelIcon,
        ),
      );

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
          },
          TodoPanelPage,
        ),
      );
    }

    return { inject: ['slots', 'locale'], apply };
  },
});
