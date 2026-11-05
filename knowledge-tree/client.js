/**
 * Knowledge Tree — browser half (v2).
 *
 * A three-stage knowledge organiser, strictly ordered and gated:
 *   1. list     — dump every point you know, one card (title + content) at a time;
 *   2. classify — a self-arranging whiteboard: drag a card onto another card to
 *                 make it that card's child, drop it on empty canvas to keep it
 *                 independent;
 *   3. tree     — health-check the graph, settle it into one tree, export.
 *
 * The tree is never snapshotted: it is derived from `cards` + `links` on every
 * render, so what you export is always what you see. Board positions are also
 * derived — a deterministic layered layout, never stored. Registers a
 * left-sidebar panel icon and the matching main-column page.
 */
window.__ModuleLoader__.load({
  id: '@local/knowledge-tree',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'knowledge-tree';
    const PANEL_ID = 'knowledge-tree';
    const STORAGE_KEY = 'dsh-knowledge-tree/v3';
    const LEGACY_KEY = 'dsh-knowledge-tree/v2';
    const LEGACY_KEY_V1 = 'dsh-knowledge-tree/v1';
    const UI_KEY = 'dsh-knowledge-tree:ui/v2';
    const MAX_TITLE = 120;
    const MAX_CONTENT = 4000;
    const WIDE_LIMIT = 12;
    const UNDO_LIMIT = 50;
    const PROMPT_COUNT = 12;
    const PROMPTS_KEY = 'dsh-knowledge-tree:prompts/v1';
    const MAX_PROMPT_CHARS = 240;
    const MAX_PROMPT_ITEMS = 40;
    const STAGES = ['brainstorm', 'classify', 'tree'];
    const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const MAX_IMAGE_INPUT = 20 * 1024 * 1024;
    const MAX_IMAGE_STORED = 420 * 1024;
    const IMAGE_MAX_EDGE = 1280;
    const STORAGE_CHAR_BUDGET = 4_400_000;

    /* Whiteboard geometry (px). Everything is derived from these numbers. */
    const CARD_W = 236;
    const CARD_GAP_X = 46;
    const CARD_GAP_Y = 12;
    const ROOT_GAP = 30;
    const CARD_H = 62;
    const CARD_H_OPEN = 252;
    const CARD_H_OPEN_IMAGE = 372;
    const TRAY_COLS = 3;
    const TRAY_GAP = 20;
    const TRAY_HEADER = 30;
    const PAD = 20;

    const DICT = {
      en: {
        'panel.label': 'Knowledge Tree',
        'page.title': 'Knowledge Tree',
        'page.subtitle': 'List what you know, group it under themes, then settle it into one tree.',
        'page.foot':
          'Everything is stored in this browser only (localStorage) and never uploaded. Export a JSON backup before switching devices.',
        'default.title': 'My knowledge tree',
        'stage.brainstorm': 'List',
        'stage.classify': 'Group',
        'stage.tree': 'Tree',
        'stage.nextBrainstorm': 'Done listing — start grouping',
        'stage.nextClassify': 'Grouping done — build the tree',
        'stage.backToList': 'Back to list',
        'stage.backToClassify': 'Back to grouping (change parents)',
        'actions.undo': 'Undo',
        'actions.export': 'Export',
        'actions.copyMd': 'Copy Markdown',
        'actions.import': 'Import JSON',
        'actions.help': 'How to use',
        'bs.lead': 'Prompt',
        'bs.rotate': 'Another one',
        'bs.editPrompts': 'Edit',
        'bs.customTag': 'custom',
        'bs.promptsTitle': 'Prompts',
        'bs.promptsHint':
          'These are just questions to jog memory — “Another one” rotates through them. Changes stay in this browser.',
        'bs.promptsPlaceholder': 'Write a prompt…',
        'bs.promptsAdd': '＋ Add one',
        'bs.promptsDelete': 'Delete this prompt',
        'bs.promptsRestore': 'Restore defaults',
        'bs.promptsAtLeastOne': 'Keep at least one prompt, or use “Restore defaults”.',
        'bs.placeholderTitle': 'One thing you know, as a title…',
        'bs.placeholderContent': 'A sentence of detail (optional)',
        'bs.add': 'Add',
        'bs.count': '{count} cards',
        'bs.hint': 'One point per card: a title, plus an optional sentence. Click a card to open it.',
        'bs.empty': 'Nothing yet. Use a prompt, or start with the first thing that comes to mind.',
        'bs.enterHint': 'Enter in the title adds the card; Ctrl/⌘ + Enter works too.',
        'bs.nextHint': 'You can come back to this stage later to add more cards.',
        'bs.prompt.0': 'What have you explained to someone in the past month?',
        'bs.prompt.1': 'The pitfalls you have hit — one line each.',
        'bs.prompt.2': 'Which article or book changed the way you work?',
        'bs.prompt.3': 'Which kind of problem do you keep solving with the same method?',
        'bs.prompt.4': 'What do people come to ask you about?',
        'bs.prompt.5': 'Which processes can you describe step by step?',
        'bs.prompt.6': 'Where does your “A reminds me of B” intuition come from?',
        'bs.prompt.7': 'What have you done well without being able to explain why?',
        'bs.prompt.8': 'Which popular claim do you disagree with, and why?',
        'bs.prompt.9': 'Moving to a new field, which concepts would you carry over first?',
        'bs.prompt.10': 'Which judgments have you made many times with the same conclusion?',
        'bs.prompt.11': 'What recently changed your mind, and why?',
        'image.add': '＋ Image',
        'image.busy': 'Processing…',
        'image.replace': 'Replace',
        'image.remove': 'Remove',
        'image.hint': 'Paste a screenshot or drop an image (one per card)',
        'image.quota': 'Not enough local storage — the image was not saved',
        'image.pickOne': 'Open exactly one card, then paste the image',
        'image.close': 'Close image',
        'image.error.type': 'Only PNG / JPEG / WebP / GIF are supported',
        'image.error.big': 'Image is larger than 20MB',
        'image.error.large': 'Image is still too large after compression',
        'image.error.read': 'Could not read the image',
        'card.noContent': 'No content yet',
        'card.expand': 'Expand',
        'card.collapse': 'Collapse',
        'cl.title': 'Group',
        'cl.summaryPending': 'To sort',
        'cl.summaryRoots': 'Top-level',
        'cl.summaryFiled': 'Filed under a parent',
        'cl.hint':
          'Drag a card onto another card to file it under that card. For a top-level card, drag it onto the "keep as top-level" strip.',
        'cl.hintShift':
          'Hold Shift to add an association: the same card also appears under another theme — it is not copied.',
        'cl.gridLabel': 'Top-level / to sort · {count}',
        'cl.gridHint': 'Cards that are not part of any tree yet.',
        'cl.newTheme': 'New theme',
        'cl.newCard': 'Add a card',
        'cl.unplace': 'Un-classify',
        'cl.composerTheme': 'Theme name, e.g. “Tile rendering”',
        'cl.composerCard': 'Card title…',
        'cl.composerCreate': 'Create',
        'cl.composerCancel': 'Cancel',
        'cl.composerHint': 'After creating, drag the related cards into this theme. Esc closes this box.',
        'cl.composerCardHint': 'It starts as “to sort”; drag it onto a card to file it. Esc closes this box.',
        'cl.dropOn': 'File “{child}” under “{parent}”',
        'cl.dropAssoc': 'Associate “{child}” with “{parent}”',
        'cl.dropRoot': 'Keep “{name}” as a top-level theme',
        'cl.rootZone': 'Keep as top-level — drop a card here',
        'cl.rootZoneActive': 'Release to keep it top-level',
        'cl.blankDrop':
          'Dropped on empty canvas — nothing changed. Drop onto a card to file it, or onto the top-level strip.',
        'cl.affiliation': 'Filed under: {name}',
        'cl.affiliationRoot': 'Filed under: nothing (top-level)',
        'cl.affiliationPending': 'Not sorted yet',
        'cl.affilTop': 'Top-level',
        'cl.affilParent': '→ {name}',
        'cl.related': 'Also associated with: {names}',
        'cl.childrenBadge': '{count} sub-item(s)',
        'cl.refsBadge': '{count} assoc.',
        'cl.refTag': 'assoc.',
        'cl.pending': 'To sort',
        'cl.setRoot': 'Keep as top-level',
        'cl.attachTo': 'Change parent…',
        'cl.addRef': 'Add association…',
        'cl.attachTitle': 'Change parent: pick the new parent theme',
        'cl.refTitle': 'Add association: pick the theme to link',
        'cl.attachSearch': 'Search cards…',
        'cl.attachEmpty': 'No candidate cards',
        'cl.attachClose': 'Close',
        'cl.refNote':
          'An association does not copy the card: it stays under its main parent and also appears under this theme.',
        'cl.refNoPrimary':
          'This card has no parent yet, so this association will also become its parent.',
        'cl.settleRest': 'Keep the rest as top-level',
        'cl.empty': 'No structure yet. Drag one card onto another, or create a theme first.',
        'cl.cycle': 'A card cannot be filed under its own descendant.',
        'tr.titlePlaceholder': 'Name this tree',
        'tr.titleLabel': 'Tree name',
        'tr.titleHint':
          'Renames the document only — structure stays as it is; the export file uses this name too.',
        'tr.docNote':
          'Below are {count} top-level themes. The name above is the document title, not a root node.',
        'tr.health.ok': 'Structure check passed',
        'tr.health.cycle': 'Cycles {count}',
        'tr.health.assoc': 'Associations {count}',
        'tr.health.roots': 'Top-level {count}',
        'tr.health.wide': 'Too wide {count}',
        'tr.exportable': 'Ready to export',
        'tr.cycle': 'Cycle: {path}',
        'tr.break': 'Break this link',
        'tr.assocTitle': 'Associations · {count}',
        'tr.assoc': '“{name}” is also associated with {count} theme(s)',
        'tr.primary': 'Main parent',
        'tr.setPrimary': 'Make main parent',
        'tr.removeSecondary': 'Remove association',
        'tr.rootsHint':
          'Top-level themes all hang under the tree name. To get a single root, make one theme the root and file the rest under it.',
        'tr.wideHint': '“{name}” has {count} children — consider adding another layer.',
        'tr.view.indent': 'Outline editor',
        'tr.view.graph': 'Tree preview',
        'tr.expandChildren': 'Expand children',
        'tr.collapseChildren': 'Collapse children',
        'tr.expandAll': 'Expand all',
        'tr.collapseAll': 'Collapse all',
        'tr.addChild': 'Add child',
        'tr.addChildPlaceholder': 'New child…',
        'tr.content': 'Content',
        'tr.contentPlaceholder': 'Why it belongs here (optional)',
        'tr.editContent': 'Edit content',
        'tr.delete': 'Delete',
        'tr.deleteConfirm': 'Delete this node? Its children move up.',
        'tr.confirm': 'Delete',
        'tr.cancel': 'Cancel',
        'tr.moveUp': 'Move up',
        'tr.moveDown': 'Move down',
        'tr.edit': 'Edit title',
        'tr.empty': 'The tree is empty.',
        'tr.collapsedCount': '{count} hidden',
        'tr.graphHint':
          'Preview is read-only. Edit in “Outline editor”, or go back to grouping to change parents.',
        'tr.htmlCards': 'cards',
        'tr.htmlLinks': 'links',
        'tr.htmlFooter': 'Exported from the Knowledge Tree plugin',
        'tr.exportImages': 'includes {count} image(s)',
        'tr.exportNote':
          'Export includes all {cards} cards and {links} links, regardless of what is collapsed or hidden.',
        'tr.saveSaved': 'Saved in this browser · {time}',
        'tr.saveAuto': 'Saves to this browser automatically',
        'tr.saveFailed': 'Not saved — this browser refused to write',
        'ex.markdown': 'Markdown outline',
        'ex.html': 'Single HTML file',
        'ex.zip': 'ZIP (Markdown + images)',
        'ex.mermaid': 'Mermaid mindmap',
        'ex.json': 'JSON backup',
        'ex.text': 'Copy plain outline',
        'notice.copied': 'Copied',
        'notice.copyFailed': 'Copy failed — select the text manually',
        'notice.exportFailed': 'Download was blocked; the text was copied instead',
        'notice.exported': 'Exported',
        'notice.imported': 'Imported {count} new card(s)',
        'notice.importFailed': 'Import failed: this file is not a knowledge tree backup',
        'notice.storageUnavailable': 'This browser cannot save the tree (private mode or quota).',
        'notice.broken': 'Saved data could not be read and was reset. A previous export can be imported.',
        'help.title': 'How the three stages work',
        'help.intro': 'The order is enforced on purpose. Each stage solves one problem.',
        'help.s1t': '1 · List',
        'help.s1b':
          'One card per point: a title, an optional sentence of content, and one optional image (paste, drop or pick one — it is compressed automatically). Cards stay collapsed — click one to open its content. Do not sort while listing; sorting too early makes the list shrink.',
        'help.s2t': '2 · Group',
        'help.s2b':
          'All cards land on one whiteboard, arranged automatically. Create a theme when several cards share a parent that does not exist yet, then drag them into it. Drag a card onto another to file it; drag it onto the top-level strip to keep it top-level; Shift-drag to add an association. The next stage unlocks only when no card is left “to sort”.',
        'help.s3t': '3 · Tree',
        'help.s3b':
          'The plugin checks the hierarchy for cycles and describes top-level themes, associations and overly wide branches. You adjudicate. Rename the document, reorder, add content, then export.',
        'help.data': 'Everything is stored in this browser. Export a JSON backup to keep it.',
        'help.close': 'Close',
        'md.cross': '↪ also associated with: {path}',
        'a11y.stage': 'Stages',
        'a11y.cards': 'Knowledge cards',
        'a11y.board': 'Grouping whiteboard',
        'a11y.tree': 'Knowledge tree',
        'btn.cancel': 'Cancel',
        'btn.save': 'Save',
      },
      zh: {
        'panel.label': '知识树',
        'page.title': '知识树',
        'page.subtitle': '先一条条列出你知道的，再把它们挂到主题下，最后收成一棵树。',
        'page.foot':
          '只保存在当前浏览器（localStorage），不上传。换设备或清缓存前请用右上角「导出 → JSON」备份。',
        'default.title': '我的知识树',
        'stage.brainstorm': '列举',
        'stage.classify': '归类',
        'stage.tree': '成树',
        'stage.nextBrainstorm': '列完了，开始归类',
        'stage.nextClassify': '归类完成，生成树',
        'stage.backToList': '回到列举',
        'stage.backToClassify': '回到归类（改归属）',
        'actions.undo': '撤销',
        'actions.export': '导出',
        'actions.copyMd': '复制 Markdown',
        'actions.import': '导入 JSON',
        'actions.help': '怎么用',
        'bs.lead': '引导',
        'bs.rotate': '换一个',
        'bs.editPrompts': '编辑',
        'bs.customTag': '自定义',
        'bs.promptsTitle': '引导语',
        'bs.promptsHint': '这些只是帮你回忆的提问，点「换一个」轮换。修改只保存在本机浏览器。',
        'bs.promptsPlaceholder': '写一条引导语…',
        'bs.promptsAdd': '＋ 添加一条',
        'bs.promptsDelete': '删除这条引导语',
        'bs.promptsRestore': '恢复默认',
        'bs.promptsAtLeastOne': '至少保留一条；想用回内置的，点「恢复默认」。',
        'bs.placeholderTitle': '一条你知道的知识，写成标题…',
        'bs.placeholderContent': '一句话补充（可选）',
        'bs.add': '加入',
        'bs.count': '已列 {count} 条',
        'bs.hint': '一张卡一条：标题必填，内容可选。点卡片可以展开看内容。',
        'bs.empty': '还没有内容。用上面的引导起个头，或者直接写下第一个想到的。',
        'bs.enterHint': '标题里回车即加入，Ctrl/⌘ + 回车也可以。',
        'bs.nextHint': '开始归类后仍然可以回到这一步补充卡片。',
        'bs.prompt.0': '最近一个月，你向别人解释过什么？',
        'bs.prompt.1': '你踩过的坑，一句话一条。',
        'bs.prompt.2': '哪篇文章或哪本书改变了你的做法？',
        'bs.prompt.3': '你反复用同一套方法解决的，是哪类问题？',
        'bs.prompt.4': '别人常来问你什么？',
        'bs.prompt.5': '你说得出步骤的流程，有哪些？',
        'bs.prompt.6': '看到 A 就想到 B 的直觉，是从哪来的？',
        'bs.prompt.7': '你做得不错、但说不清为什么有效的，是什么？',
        'bs.prompt.8': '你不认同的流行说法，理由是什么？',
        'bs.prompt.9': '换到新领域，你会先迁移哪几个概念？',
        'bs.prompt.10': '哪些判断你做过很多次、结论都一样？',
        'bs.prompt.11': '最近让你改变主意的那件事，为什么？',
        'image.add': '＋ 图片',
        'image.busy': '处理中…',
        'image.replace': '更换',
        'image.remove': '移除',
        'image.hint': '可粘贴截图或拖入图片（每张卡一张）',
        'image.quota': '存储空间不足，图片未保存',
        'image.pickOne': '先展开一张卡片，再粘贴图片',
        'image.close': '关闭图片',
        'image.error.type': '只支持 PNG / JPEG / WebP / GIF',
        'image.error.big': '图片超过 20MB',
        'image.error.large': '图片压缩后仍然太大',
        'image.error.read': '图片读取失败',
        'card.noContent': '还没有内容',
        'card.expand': '展开',
        'card.collapse': '收起',
        'cl.title': '归类',
        'cl.summaryPending': '待整理',
        'cl.summaryRoots': '顶层主题',
        'cl.summaryFiled': '已归入上级',
        'cl.hint': '把卡片拖到另一张卡上 = 归入它。要设成顶层主题，拖到下面「设为顶层主题」的区域。',
        'cl.hintShift': '按住 Shift 拖放 = 添加关联：同一张卡在另一个主题下再出现一次，不是复制。',
        'cl.gridLabel': '顶层 / 待整理 · {count} 张',
        'cl.gridHint': '这些卡片还没有进入任何一棵树。',
        'cl.newTheme': '新建主题',
        'cl.newCard': '补一条知识',
        'cl.unplace': '取消归类',
        'cl.composerTheme': '主题名称，例如「Tile 开发」',
        'cl.composerCard': '知识标题…',
        'cl.composerCreate': '创建',
        'cl.composerCancel': '取消',
        'cl.composerHint': '创建后把相关的卡片拖进这个主题即可。Esc 关闭。',
        'cl.composerCardHint': '它会先落在「待整理」；拖到某张卡上即可归入。Esc 关闭。',
        'cl.dropOn': '将「{child}」归入「{parent}」',
        'cl.dropAssoc': '将「{child}」关联到「{parent}」',
        'cl.dropRoot': '将「{name}」设为顶层主题',
        'cl.rootZone': '设为顶层主题 —— 把卡片拖到这里',
        'cl.rootZoneActive': '松手 = 设为顶层主题',
        'cl.blankDrop': '这里是空白区域，已取消：拖到卡片上归入它，或拖到「设为顶层主题」区域。',
        'cl.affiliation': '归属：{name}',
        'cl.affiliationRoot': '归属：顶层主题',
        'cl.affiliationPending': '归属：待整理',
        'cl.affilTop': '顶层主题',
        'cl.affilParent': '→ {name}',
        'cl.related': '另关联：{names}',
        'cl.childrenBadge': '{count} 个子项',
        'cl.refsBadge': '{count} 个关联',
        'cl.refTag': '关联',
        'cl.pending': '待整理',
        'cl.setRoot': '设为顶层主题',
        'cl.attachTo': '改归属…',
        'cl.addRef': '添加关联…',
        'cl.attachTitle': '改归属：选择新的上级主题',
        'cl.refTitle': '添加关联：选择要关联的主题',
        'cl.attachSearch': '搜索卡片…',
        'cl.attachEmpty': '没有可选的卡片',
        'cl.attachClose': '关闭',
        'cl.refNote': '关联不复制卡片：它仍留在主归属下，只是在另一个主题里再出现一次。',
        'cl.refNoPrimary': '它还没有归属，这条关联会同时成为它的归属。',
        'cl.settleRest': '其余设为顶层主题',
        'cl.empty': '还没有层次。把一张卡拖到另一张卡上，或者先「新建主题」。',
        'cl.cycle': '不能把节点挂到自己的子孙下面。',
        'tr.titlePlaceholder': '给这棵树起个名字',
        'tr.titleLabel': '树名',
        'tr.titleHint': '只改文档名称，不影响结构；导出文件名也用它。',
        'tr.docNote': '下面是 {count} 个顶层主题。上面这个名字是文档名，不是根节点。',
        'tr.health.ok': '结构检查通过',
        'tr.health.cycle': '环 {count} 处',
        'tr.health.assoc': '关联 {count} 处',
        'tr.health.roots': '顶层主题 {count} 个',
        'tr.health.wide': '过宽 {count} 处',
        'tr.exportable': '可以导出',
        'tr.cycle': '环：{path}',
        'tr.break': '断开这条',
        'tr.assocTitle': '关联 · {count}',
        'tr.assoc': '「{name}」还关联到 {count} 个主题',
        'tr.primary': '主归属',
        'tr.setPrimary': '改为主归属',
        'tr.removeSecondary': '移除关联',
        'tr.rootsHint':
          '多个顶层主题会一起挂在树名下。想收成一个根，可以把其中一个主题提为根，再把其余归入它。',
        'tr.wideHint': '「{name}」下有 {count} 个子项，考虑再加一层分类。',
        'tr.view.indent': '大纲编辑',
        'tr.view.graph': '树形预览',
        'tr.expandChildren': '展开子项',
        'tr.collapseChildren': '折叠子项',
        'tr.expandAll': '全部展开',
        'tr.collapseAll': '全部折叠',
        'tr.addChild': '加子项',
        'tr.addChildPlaceholder': '新子项…',
        'tr.content': '内容',
        'tr.contentPlaceholder': '为什么它属于这里（可选）',
        'tr.editContent': '编辑内容',
        'tr.delete': '删除',
        'tr.deleteConfirm': '删除这个节点？它的子项会上移。',
        'tr.confirm': '确认删除',
        'tr.cancel': '取消',
        'tr.moveUp': '上移',
        'tr.moveDown': '下移',
        'tr.edit': '改标题',
        'tr.empty': '树还是空的。',
        'tr.collapsedCount': '藏了 {count} 个',
        'tr.graphHint': '预览只读。编辑请用「大纲编辑」，改归属请回到归类。',
        'tr.htmlCards': '张卡片',
        'tr.htmlLinks': '条关系',
        'tr.htmlFooter': '由知识树插件导出',
        'tr.exportImages': '含 {count} 张图片',
        'tr.exportNote': '导出包含全部 {cards} 张卡片与 {links} 条关系，不受折叠或隐藏影响。',
        'tr.saveSaved': '已保存到本机 · {time}',
        'tr.saveAuto': '自动保存到本机',
        'tr.saveFailed': '未保存：浏览器拒绝写入',
        'ex.markdown': 'Markdown 大纲',
        'ex.html': '单个 HTML 文件',
        'ex.zip': 'ZIP（Markdown + 图片）',
        'ex.mermaid': 'Mermaid 思维导图',
        'ex.json': 'JSON 备份',
        'ex.text': '复制纯文本大纲',
        'notice.copied': '已复制',
        'notice.copyFailed': '复制失败，请手动选中文本',
        'notice.exportFailed': '下载被拦截，已改为复制到剪贴板',
        'notice.exported': '已导出',
        'notice.imported': '导入 {count} 张新卡片',
        'notice.importFailed': '导入失败：这不是知识树备份文件',
        'notice.storageUnavailable': '这个浏览器无法保存（隐私模式或空间不足）。',
        'notice.broken': '上次保存的数据读不出来，已重置为空树。可以导入之前的备份。',
        'help.title': '三个阶段怎么用',
        'help.intro': '顺序是故意锁死的，每个阶段解决一种失败。',
        'help.s1t': '① 列举',
        'help.s1b':
          '一张卡一条：标题必填，内容可选、默认收起，点卡片展开；每张卡还可以配一张图（粘贴 / 拖入 / 选文件，自动压缩）。边写边分类会让清单越写越少，所以这一步只许倒不许整理。',
        'help.s2t': '② 归类',
        'help.s2b':
          '所有卡片落在同一块白板上，位置由插件自动排。几条知识共同的上位主题还不存在时，先「新建主题」，再把它们拖进去。拖到卡片上 = 归入；拖到「设为顶层主题」区域 = 保持顶层；按住 Shift 拖放 = 添加关联（同一张卡的多处引用）。没有「待整理」的卡片后，才能进入下一阶段。',
        'help.s3t': '③ 成树',
        'help.s3b':
          '插件会检查层级里的环，并统计顶层主题、关联和过宽的分支。你负责拍板：改树名、调顺序、补内容，最后导出。',
        'help.data': '所有内容都只存在这个浏览器里，记得导出 JSON 备份。',
        'help.close': '关闭',
        'md.cross': '↪ 另关联：{path}',
        'a11y.stage': '阶段',
        'a11y.cards': '知识卡片',
        'a11y.board': '归类白板',
        'a11y.tree': '知识树',
        'btn.cancel': '取消',
        'btn.save': '保存',
      },
    };

    const CSS = [
      '.kt-page{box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}',
      '.kt-head{flex:none;display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 16px;padding:26px clamp(20px,3.4vw,44px) 0}',
      '[data-platform=darwin] .kt-head{padding-top:calc(26px + var(--dsh-frame-top-clearance,0px))}',
      '.kt-titles{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.kt-titles h1{margin:0;font-size:20px;font-weight:500;line-height:28px}',
      '.kt-sub{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:20px}',
      '.kt-head-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.kt-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .15s,color .15s}',
      '.kt-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent));color:var(--dsw-alias-label-primary)}',
      '.kt-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;cursor:pointer;transition:background .15s}',
      '.kt-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent))}',
      '.kt-btn:disabled{opacity:.45;cursor:default}',
      '.kt-btn-primary{border-color:transparent;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);color:var(--dsw-alias-brand-primary);font-weight:500}',
      '.kt-btn-primary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}',
      '.kt-btn-brand{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,var(--dsw-alias-border-l1));color:var(--dsw-alias-brand-primary)}',
      '.kt-btn-brand:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}',
      '.kt-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,var(--dsw-alias-border-l1))}',
      '.kt-text-btn{padding:0 4px;border:0;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:12px;cursor:pointer;border-radius:5px}',
      '.kt-text-btn:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}',
      '.kt-danger-text{color:var(--dsw-alias-state-error-primary)}',
      '.kt-danger-text:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}',
      '.kt-stages{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:12px;padding:8px 0;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.kt-stage{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12.5px}',
      '.kt-stage-num{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:.5px solid var(--dsw-alias-border-l2);border-radius:50%;font-size:11px;line-height:1}',
      '.kt-stage-current{color:var(--dsw-alias-label-primary);font-weight:500}',
      '.kt-stage-current .kt-stage-num{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}',
      '.kt-stage-done .kt-stage-num{border-color:transparent;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.kt-stage-sep{color:var(--dsw-alias-border-l2);font-size:11px}',
      '.kt-stage-actions{margin-left:auto;display:flex;align-items:center;gap:8px}',
      '.kt-body{flex:1;min-height:0;display:flex;flex-direction:column;padding:0 clamp(20px,3.4vw,44px) 18px}',
      '.kt-warn{margin:8px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}',
      '.kt-guide{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:4px 0 12px;padding:9px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.kt-guide-label{flex:none;padding:1px 7px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary);font-size:11.5px}',
      '.kt-guide-body{flex:1;min-width:180px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}',
      '.kt-guide-text{flex:0 1 auto;font-size:13px;line-height:20px}',
      '.kt-prompt-list{display:flex;flex-direction:column;gap:6px;max-height:42vh;overflow:auto;scrollbar-gutter:stable;margin:0 -2px;padding:0 2px 2px}',
      '.kt-prompt-row{display:flex;align-items:center;gap:6px}',
      '.kt-prompt-row .kt-input{flex:1;height:32px;font-size:12.5px}',
      '.kt-prompt-error{margin:0;font-size:11.5px;line-height:17px;color:var(--dsw-alias-state-error-primary)}',
      '.kt-dialog-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:flex-end;margin-top:2px}',
      '.kt-dialog-foot .kt-restore{margin-right:auto}',
      '.kt-add-form{display:flex;flex-direction:column;gap:6px;margin-bottom:10px;max-width:720px}',
      '.kt-note-mark{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-secondary)}',
      '.kt-add-row{display:flex;gap:8px}',
      '.kt-input{flex:1;min-width:0;height:34px;padding:0 11px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}',
      '.kt-input::placeholder,.kt-textarea::placeholder{color:var(--dsw-alias-label-secondary)}',
      '.kt-textarea{width:100%;box-sizing:border-box;min-height:56px;resize:vertical;padding:8px 11px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:19px}',
      '.kt-cards{display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;overflow:auto;min-height:0;flex:1;padding:2px 0 10px}',
      '.kt-card{box-sizing:border-box;display:flex;flex-direction:column;width:258px;max-width:100%;border:.5px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-layer-1);transition:border-color .15s,box-shadow .15s}',
      '.kt-card:hover{border-color:var(--dsw-alias-border-l2)}',
      '.kt-card-open{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 35%,var(--dsw-alias-border-l1))}',
      '.kt-card-head{display:flex;align-items:center;gap:6px;padding:9px 10px;cursor:pointer}',
      '.kt-card-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:20px}',
      '.kt-card-chevron{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;color:var(--dsw-alias-label-secondary);font-size:10px}',
      '.kt-card-del{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);opacity:0;cursor:pointer}',
      '.kt-card:hover .kt-card-del,.kt-card-del:focus-visible{opacity:1}',
      '.kt-card-del:hover{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}',
      '.kt-card-body{display:flex;flex-direction:column;gap:6px;padding:0 10px 10px}',
      '.kt-img-panel{display:flex;flex-direction:column;gap:4px}',
      '.kt-img-drop{display:block;width:100%;box-sizing:border-box;padding:8px 10px;border:.5px dashed var(--dsw-alias-border-l2);border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:16px;text-align:center;cursor:pointer}',
      '.kt-img-drop:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.kt-img-over{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.kt-img-wrap{display:flex;flex-direction:column;align-items:flex-start;gap:4px}',
      '.kt-img{display:block;width:auto;height:auto;max-width:100%;max-height:118px;align-self:flex-start;object-fit:contain;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);cursor:zoom-in}',
      '.kt-img-actions{display:flex;gap:10px}',
      '.kt-bcard-fileover{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent)}',
      '.kt-lightbox{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:32px;background:color-mix(in srgb,#000 62%,transparent);cursor:zoom-out}',
      '.kt-lightbox img{max-width:min(1100px,92vw);max-height:88vh;border-radius:10px;background:var(--dsw-alias-bg-base);cursor:default}',
      '.kt-lightbox-close{position:absolute;top:16px;right:20px;width:34px;height:34px;border:.5px solid color-mix(in srgb,#fff 30%,transparent);border-radius:9px;background:color-mix(in srgb,#000 30%,transparent);color:#fff;font-size:20px;line-height:1;cursor:pointer}',
      '.kt-card-content{font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}',
      '.kt-empty{margin:0;padding:18px 0;color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.kt-meta-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px}',
      /* whiteboard */
      '.kt-board-head{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:2px 0 10px}',
      '.kt-board-title{font-size:13px;font-weight:500}',
      '.kt-progress{font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--dsw-alias-label-secondary)}',
      '.kt-bar{flex:1;max-width:180px;min-width:80px;height:4px;border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 18%,transparent);overflow:hidden}',
      '.kt-bar i{display:block;height:100%;background:var(--dsw-alias-brand-primary);transition:width .2s}',
      '.kt-board-hint{flex-basis:100%;margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:17px}',
      '.kt-board-scroll{flex:1;min-height:0;overflow:auto;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);background-image:radial-gradient(color-mix(in srgb,var(--dsw-alias-label-secondary) 9%,transparent) .7px,transparent .7px);background-size:18px 18px}',
      '.kt-board{position:relative}',
      '.kt-board-edges{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}',
      '.kt-bcard{position:absolute;box-sizing:border-box;display:flex;flex-direction:column;padding:0;border:.5px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-base);box-shadow:0 1px 2px color-mix(in srgb,#000 6%,transparent);overflow:hidden;cursor:grab;transition:left .18s ease,top .18s ease,height .18s ease,border-color .15s,box-shadow .15s}',
      '.kt-bcard:hover{border-color:var(--dsw-alias-border-l2);box-shadow:0 3px 10px color-mix(in srgb,#000 10%,transparent)}',
      '.kt-bcard:active{cursor:grabbing}',
      '.kt-bcard-open{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 38%,var(--dsw-alias-border-l1))}',
      '.kt-bcard-drop{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent)}',
      '.kt-bcard-dragging{opacity:.45}',
      '.kt-bcard-standalone{background:var(--dsw-alias-bg-layer-2)}',
      '.kt-bcard-pending{border-style:dashed}',
      '.kt-badge-pending{border:.5px dashed color-mix(in srgb,var(--dsw-alias-state-warn-primary) 60%,var(--dsw-alias-border-l2));color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 65%,var(--dsw-alias-label-primary));background:transparent}',
      '.kt-bcard-head{flex:none;display:flex;align-items:center;gap:6px;height:34px;padding:0 10px 0 11px}',
      '.kt-bcard-meta{flex:none;display:flex;align-items:center;gap:6px;height:28px;padding:0 10px 0 11px;overflow:hidden;font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-secondary)}',
      '.kt-bcard-affil{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.kt-bcard-head .kt-bcard-chevron{margin-left:2px}',
      '.kt-bcard-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:20px}',
      '.kt-bcard-tags{flex:none;display:flex;align-items:center;gap:4px}',
      '.kt-bcard-chevron{flex:none;color:var(--dsw-alias-label-secondary);font-size:10px}',
      '.kt-bcard-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:0 10px 10px;border-top:.5px solid var(--dsw-alias-border-l1);margin-top:0;padding-top:8px}',
      '.kt-bcard-content{flex:1;min-height:0;overflow:auto;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}',
      '.kt-bcard-actions{flex:none;display:flex;flex-wrap:wrap;gap:4px 10px}',
      '.kt-tray-label{position:absolute;color:var(--dsw-alias-label-secondary);font-size:12px;display:flex;align-items:center;gap:8px}',
      '.kt-tray-label::after{content:"";flex:1;border-top:.5px dashed var(--dsw-alias-border-l2);min-width:40px}',
      '.kt-tray-zone{position:absolute;border:.5px dashed var(--dsw-alias-border-l2);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 4%,transparent);pointer-events:none}',
      '.kt-badge{flex:none;padding:0 5px;border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 14%,transparent);color:color-mix(in srgb,var(--dsw-alias-label-primary) 62%,var(--dsw-alias-label-secondary));font-size:10.5px;line-height:15px;white-space:nowrap}',
      '.kt-badge-brand{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}',
      /* tree stage */
      '.kt-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:2px 0 10px}',
      '.kt-health{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
      '.kt-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:7px;font-size:11.5px;line-height:18px}',
      '.kt-chip-ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}',
      '.kt-chip-warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary)}',
      '.kt-chip-info{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 12%,transparent);color:var(--dsw-alias-label-secondary)}',
      '.kt-toolbar-right{margin-left:auto;display:flex;align-items:center;gap:6px}',
      '.kt-seg{display:inline-flex;padding:2px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}',
      '.kt-seg-btn{height:24px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}',
      '.kt-seg-btn-active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.kt-issues{display:flex;flex-direction:column;gap:6px;margin:8px 0 2px;padding:10px 12px;border:.5px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,var(--dsw-alias-border-l1));border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent)}',
      '.kt-issue{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12.5px;line-height:19px}',
      '.kt-issue-text{flex:1;min-width:200px;word-break:break-word}',
      '.kt-parents{display:flex;flex-wrap:wrap;gap:6px 12px;flex-basis:100%;padding-left:2px}',
      '.kt-parent-row{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.kt-parent-name{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}',
      '.kt-view{flex:1;min-height:0;overflow:auto;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}',
      '.kt-tree-title{width:100%;max-width:420px;margin:0 0 8px;padding:0 2px;border:0;border-bottom:.5px dashed transparent;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:16px;font-weight:500;line-height:26px}',
      '.kt-tree-title:hover{border-bottom-color:var(--dsw-alias-border-l2)}',
      '.kt-tree-title:focus{outline:none;border-bottom-color:var(--dsw-alias-brand-primary)}',
      '.kt-trow{display:flex;align-items:center;gap:4px;min-height:32px;padding:2px 6px;border-radius:8px;border:.5px solid transparent}',
      '.kt-trow:hover{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 7%,transparent)}',
      '.kt-trow-over{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 13%,transparent)}',
      '.kt-trow-dragging{opacity:.4}',
      '.kt-trow-main{flex:1;min-width:0;display:flex;align-items:center;gap:6px}',
      '.kt-trow-title{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:20px;cursor:pointer}',
      '.kt-trow-main .kt-input{flex:1}',
      '.kt-trow-actions{flex:none;display:flex;align-items:center;gap:1px;opacity:0;transition:opacity .12s}',
      '.kt-trow:hover .kt-trow-actions,.kt-trow:focus-within .kt-trow-actions,.kt-trow-editing .kt-trow-actions{opacity:1}',
      '.kt-tkids{margin-left:9px;padding-left:11px;border-left:.5px solid var(--dsw-alias-border-l2)}',
      '.kt-rail-hint{margin:0;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary)}',
      '.kt-graph-hint{margin:0 0 8px;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary)}',
      '.kt-mini-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.kt-mini-btn:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.kt-mini-btn:disabled{opacity:.35;cursor:default}',
      '.kt-mini-btn-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 15%,transparent);color:var(--dsw-alias-state-error-primary)}',
      '.kt-ref{display:flex;align-items:center;gap:5px;min-height:26px;margin-left:9px;padding:1px 6px 1px 11px;border-left:.5px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.kt-ref-text{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-style:italic}',
      '.kt-content-panel{display:flex;flex-direction:column;gap:6px;margin:2px 8px 8px 28px;padding:8px 10px;border-radius:9px;border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
      '.kt-content-text{margin:0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}',
      '.kt-content-placeholder{color:var(--dsw-alias-label-secondary);opacity:.8}',
      '.kt-inline-actions{display:flex;gap:6px}',
      '.kt-add-row-inline{display:flex;gap:6px;margin:2px 8px 8px 28px}',
      '.kt-confirm-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:2px 8px 8px 28px;font-size:12px;color:var(--dsw-alias-state-error-primary)}',
      '.kt-graph-scroll{width:100%;overflow:auto}',
      '.kt-graph{position:relative}',
      '.kt-graph-edges{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}',
      '.kt-graph-node{position:absolute;box-sizing:border-box;height:30px;display:flex;align-items:center;gap:4px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:12.5px;line-height:18px;cursor:pointer;overflow:hidden}',
      '.kt-graph-node:hover{border-color:var(--dsw-alias-brand-primary)}',
      '.kt-graph-root{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 35%,var(--dsw-alias-border-l1))}',
      '.kt-graph-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.kt-graph-more{flex:none;font-size:10.5px;color:var(--dsw-alias-brand-primary)}',
      '.kt-menu-wrap{position:relative}',
      '.kt-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:20;min-width:172px;padding:4px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1));box-shadow:0 8px 24px color-mix(in srgb,#000 18%,transparent)}',
      '.kt-menu-item{display:block;width:100%;padding:7px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer}',
      '.kt-menu-item:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}',
      '.kt-menu-sep{height:.5px;margin:4px 6px;background:var(--dsw-alias-border-l1)}',
      '.kt-notice{position:absolute;right:clamp(20px,3.4vw,44px);top:14px;z-index:40;max-width:320px;padding:7px 12px;border-radius:9px;font-size:12px;line-height:18px;box-shadow:0 6px 20px color-mix(in srgb,#000 16%,transparent)}',
      '.kt-notice-ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 18%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-success-primary)}',
      '.kt-notice-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 16%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-error-primary)}',
      '.kt-footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:2px 16px;padding:10px clamp(20px,3.4vw,44px) 0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:17px}',
      '.kt-overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;background:color-mix(in srgb,#000 32%,transparent)}',
      '.kt-dialog{box-sizing:border-box;width:min(520px,100%);max-height:80vh;display:flex;flex-direction:column;gap:10px;padding:18px 20px;border:.5px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-base);overflow:auto}',
      '.kt-dialog h2{margin:0;font-size:15px;font-weight:600}',
      '.kt-dialog p{margin:0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary)}',
      '.kt-help-step{padding:9px 11px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.kt-help-step h3{margin:0 0 2px;font-size:12.5px;font-weight:600;line-height:18px}',
      '.kt-help-step p{margin:0;font-size:12px;line-height:18px}',
      '.kt-attach-list{display:flex;flex-direction:column;gap:2px;max-height:44vh;overflow:auto;margin:0 -4px}',
      '.kt-attach-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer}',
      '.kt-attach-item:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}',
      '.kt-attach-path{color:var(--dsw-alias-label-secondary);font-size:11.5px}',
      '.kt-file{position:fixed;left:-9999px;width:1px;height:1px;opacity:0}',
      '.kt-summary{display:flex;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.kt-summary-item{padding:1px 8px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent);white-space:nowrap}',
      '.kt-summary-item strong{font-weight:600;color:var(--dsw-alias-label-primary);margin-left:3px;font-variant-numeric:tabular-nums}',
      '.kt-board-actions{margin-left:auto;display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
      '.kt-dropzone{flex-basis:100%;display:flex;align-items:center;justify-content:center;min-height:32px;padding:4px 10px;border:.5px dashed var(--dsw-alias-border-l2);border-radius:9px;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center;transition:background .12s,border-color .12s,color .12s}',
      '.kt-dropzone-hot{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.kt-preview{flex-basis:100%;margin:0;padding:5px 9px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent);color:var(--dsw-alias-brand-primary);font-size:12px;line-height:18px}',
      '.kt-composer{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px;padding:9px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.kt-composer .kt-input{max-width:420px}',
      '.kt-composer-hint{flex-basis:100%;margin:0;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary)}',
      '.kt-affil{flex:none;margin:0;font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.kt-affil strong{font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.kt-hint-box{display:flex;flex-direction:column;gap:4px;margin:8px 0 2px;padding:9px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.kt-panel-title{margin:0;font-size:12px;font-weight:600;line-height:18px}',
      '.kt-assoc-panel{display:flex;flex-direction:column;gap:6px;margin:8px 0 2px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.kt-assoc-panel .kt-issue-text{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.kt-doc-head{display:flex;flex-direction:column;gap:2px;margin:0 0 8px}',
      '.kt-field-label{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.kt-field-hint{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.kt-save{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.kt-save-bad{color:var(--dsw-alias-state-error-primary)}',
      '.kt-export-note{margin:0 0 8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.kt-notice-info{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-brand-primary)}',
      '.kt-bcard-actions{flex:none;display:flex;flex-wrap:wrap;gap:3px 10px}',
      '.kt-bcard-body{gap:6px}',
      '.kt-meta-row{gap:6px 14px}',
      '.kt-icon-btn:focus-visible,.kt-btn:focus-visible,.kt-text-btn:focus-visible,.kt-mini-btn:focus-visible,.kt-input:focus-visible,.kt-textarea:focus-visible,.kt-card-head:focus-visible,.kt-bcard:focus-visible,.kt-trow:focus-visible,.kt-trow-title:focus-visible,.kt-seg-btn:focus-visible,.kt-menu-item:focus-visible,.kt-tree-title:focus-visible,.kt-attach-item:focus-visible,.kt-dialog .kt-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '@media (max-width:820px){.kt-board-hint{display:none}}',
      '@media (max-width:760px){.kt-toolbar-right{margin-left:0;flex-wrap:wrap}.kt-head-actions{flex-wrap:wrap}.kt-summary{font-size:11.5px}}',
      '@media (max-width:560px){.kt-head-actions{gap:6px}.kt-stage-actions{width:100%;margin-left:0}}',
    ].join('');

    /* ------------------------------------------------------------------ */
    /* Small helpers                                                       */
    /* ------------------------------------------------------------------ */

    function clampText(value, max) {
      const text = typeof value === 'string' ? value : '';
      return text.length > max ? text.slice(0, max) : text;
    }

    function newId(prefix) {
      try {
        if (
          typeof window !== 'undefined' &&
          window.crypto &&
          typeof window.crypto.randomUUID === 'function'
        ) {
          return prefix + '_' + window.crypto.randomUUID();
        }
      } catch (error) {
        /* fall through */
      }
      return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    }

    function readJson(key) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        return parsed !== null && typeof parsed === 'object' ? parsed : null;
      } catch (error) {
        return null;
      }
    }

    function byOrder(a, b) {
      return a.order - b.order;
    }

    function formatClock(ms) {
      const date = new Date(ms);
      const pad = (value) => String(value).padStart(2, '0');
      return pad(date.getHours()) + ':' + pad(date.getMinutes());
    }

    function isImeEnter(event) {
      if (event === null || event === undefined) return false;
      if (event.key !== 'Enter') return false;
      if (event.nativeEvent && event.nativeEvent.isComposing === true) return true;
      return event.keyCode === 229;
    }

    /* ------------------------------------------------------------------ */
    /* Data normalization (v2, migrates v1 text/note)                      */
    /* ------------------------------------------------------------------ */

    function normalizeImage(raw) {
      if (raw === null || typeof raw !== 'object') return null;
      const data = typeof raw.data === 'string' ? raw.data : '';
      if (!data.startsWith('data:image/')) return null;
      const semicolon = data.indexOf(';');
      const mime =
        typeof raw.mime === 'string' && raw.mime.startsWith('image/')
          ? raw.mime
          : data.slice(5, semicolon === -1 ? undefined : semicolon) || 'image/png';
      return {
        data,
        mime,
        w: Number.isFinite(raw.w) ? Math.max(0, Math.round(raw.w)) : 0,
        h: Number.isFinite(raw.h) ? Math.max(0, Math.round(raw.h)) : 0,
      };
    }

    function normalizeData(raw) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      const rawCards = Array.isArray(source.cards) ? source.cards : [];
      const cards = [];
      const seen = new Set();
      rawCards.forEach((item, index) => {
        if (item === null || typeof item !== 'object') return;
        const rawTitle = typeof item.title === 'string' ? item.title : item.text;
        const rawContent = typeof item.content === 'string' ? item.content : item.note;
        const content = clampText(typeof rawContent === 'string' ? rawContent.trim() : '', MAX_CONTENT);
        let title = clampText(typeof rawTitle === 'string' ? rawTitle.trim() : '', MAX_TITLE);
        if (title === '' && content !== '') title = clampText(content.split('\n')[0].trim(), MAX_TITLE);
        if (title === '') return;
        let id = typeof item.id === 'string' && item.id !== '' ? item.id : newId('c');
        if (seen.has(id)) id = newId('c');
        seen.add(id);
        cards.push({
          id,
          title,
          content,
          image: normalizeImage(item.image),
          placed: item.placed === true,
          order: Number.isFinite(item.order) ? item.order : index,
          createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
        });
      });
      cards.sort(byOrder);
      cards.forEach((card, index) => {
        card.order = index;
      });

      const byId = new Map();
      cards.forEach((card) => byId.set(card.id, card));
      const rawLinks = Array.isArray(source.links) ? source.links : [];
      const pairs = new Set();
      const links = [];
      rawLinks.forEach((item) => {
        if (item === null || typeof item !== 'object') return;
        const parentId = item.parentId;
        const childId = item.childId;
        if (typeof parentId !== 'string' || typeof childId !== 'string') return;
        if (parentId === childId) return;
        if (!byId.has(parentId) || !byId.has(childId)) return;
        const key = parentId + '>' + childId;
        if (pairs.has(key)) return;
        pairs.add(key);
        links.push({
          id: typeof item.id === 'string' && item.id !== '' ? item.id : newId('l'),
          parentId,
          childId,
          primary: item.primary === true,
        });
      });

      const byChild = new Map();
      links.forEach((link) => {
        const list = byChild.get(link.childId);
        if (list === undefined) byChild.set(link.childId, [link]);
        else list.push(link);
      });
      byChild.forEach((list) => {
        const primaries = list.filter((link) => link.primary);
        if (primaries.length === 0) list[0].primary = true;
        else
          primaries.slice(1).forEach((link) => {
            link.primary = false;
          });
      });
      links.forEach((link) => {
        const child = byId.get(link.childId);
        if (child !== undefined) child.placed = true;
      });

      let stage = STAGES.indexOf(source.stage) >= 0 ? source.stage : 'brainstorm';
      if (cards.length < 2 && stage !== 'brainstorm') stage = 'brainstorm';
      if (stage === 'tree' && cards.some((card) => card.placed !== true)) stage = 'classify';

      return {
        version: 3,
        stage,
        title: clampText(typeof source.title === 'string' ? source.title : '', 60),
        cards,
        links,
        updatedAt: Number.isFinite(source.updatedAt) ? source.updatedAt : Date.now(),
      };
    }

    function normalizeUi(raw, data) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      const ids = new Set(data.cards.map((card) => card.id));
      const keep = (list) =>
        Array.isArray(list) ? list.filter((id) => typeof id === 'string' && ids.has(id)) : [];
      const prompt = Number.isInteger(source.prompt) && source.prompt >= 0 ? source.prompt : 0;
      return {
        view: source.view === 'graph' ? 'graph' : 'indent',
        collapsed: keep(source.collapsed),
        expanded: keep(source.expanded),
        prompt,
      };
    }

    function normalizePrompts(raw) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      if (!Array.isArray(source.items)) return null;
      const items = source.items
        .map((item) => clampText(typeof item === 'string' ? item.trim() : '', MAX_PROMPT_CHARS))
        .filter((item) => item !== '')
        .slice(0, MAX_PROMPT_ITEMS);
      return items.length > 0 ? items : null;
    }

    /* ------------------------------------------------------------------ */
    /* Graph helpers                                                       */
    /* ------------------------------------------------------------------ */

    function indexData(data) {
      const byId = new Map();
      data.cards.forEach((card) => byId.set(card.id, card));
      const primaryChildrenOf = new Map();
      const secondaryChildrenOf = new Map();
      const primaryParentOf = new Map();
      const parentsOf = new Map();

      data.links.forEach((link) => {
        const child = byId.get(link.childId);
        if (child === undefined) return;
        const parents = parentsOf.get(link.childId);
        if (parents === undefined) parentsOf.set(link.childId, [link]);
        else parents.push(link);
        if (link.primary) {
          primaryParentOf.set(link.childId, link.parentId);
          const kids = primaryChildrenOf.get(link.parentId);
          if (kids === undefined) primaryChildrenOf.set(link.parentId, [child]);
          else kids.push(child);
        } else {
          const kids = secondaryChildrenOf.get(link.parentId);
          if (kids === undefined) secondaryChildrenOf.set(link.parentId, [child]);
          else kids.push(child);
        }
      });
      primaryChildrenOf.forEach((kids) => kids.sort(byOrder));
      secondaryChildrenOf.forEach((kids) => kids.sort(byOrder));
      const roots = data.cards.filter((card) => !primaryParentOf.has(card.id)).sort(byOrder);
      return {
        byId,
        primaryChildrenOf,
        secondaryChildrenOf,
        primaryParentOf,
        parentsOf,
        roots,
      };
    }

    function detectCycles(cards, index) {
      const result = [];
      const seen = new Set();
      cards.forEach((card) => {
        const path = [];
        const local = new Set();
        let cur = card.id;
        while (cur !== undefined && !local.has(cur)) {
          local.add(cur);
          path.push(cur);
          cur = index.primaryParentOf.get(cur);
        }
        if (cur !== undefined && local.has(cur)) {
          const cycle = path.slice(path.indexOf(cur));
          const key = cycle.slice().sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            result.push(cycle);
          }
        }
      });
      return result;
    }

    function pathText(cardId, index) {
      const names = [];
      const guard = new Set();
      let cur = cardId;
      while (cur !== undefined && !guard.has(cur)) {
        guard.add(cur);
        const card = index.byId.get(cur);
        if (card === undefined) break;
        names.unshift(card.title);
        cur = index.primaryParentOf.get(cur);
      }
      return names.join(' / ');
    }

    function isDescendant(index, ancestorId, cardId) {
      const guard = new Set();
      let cur = cardId;
      while (cur !== undefined && !guard.has(cur)) {
        if (cur === ancestorId) return true;
        guard.add(cur);
        cur = index.primaryParentOf.get(cur);
      }
      return false;
    }

    function titleOf(state, t) {
      const title = typeof state.title === 'string' ? state.title.trim() : '';
      return title === '' ? t('default.title') : title;
    }

    /* ------------------------------------------------------------------ */
    /* Deterministic layered board layout                                   */
    /* ------------------------------------------------------------------ */

    function computeBoard(index, cards, expanded) {
      const pos = new Map();
      const heights = new Map();
      const ownHeight = (card) =>
        expanded.has(card.id)
          ? card.image
            ? CARD_H_OPEN_IMAGE
            : CARD_H_OPEN
          : CARD_H;
      let maxDepth = 0;

      function bandHeight(card, trail) {
        if (heights.has(card.id)) return heights.get(card.id);
        const kids = (index.primaryChildrenOf.get(card.id) || []).filter(
          (kid) => !trail.has(kid.id),
        );
        const own = ownHeight(card);
        let total = own;
        if (kids.length > 0) {
          const nextTrail = new Set(trail).add(card.id);
          let sum = 0;
          kids.forEach((kid, position) => {
            sum += bandHeight(kid, nextTrail);
            if (position > 0) sum += CARD_GAP_Y;
          });
          total = Math.max(own, sum);
        }
        heights.set(card.id, total);
        return total;
      }

      function place(card, depth, top, trail) {
        const kids = (index.primaryChildrenOf.get(card.id) || []).filter(
          (kid) => !trail.has(kid.id),
        );
        const own = ownHeight(card);
        const total = bandHeight(card, trail);
        pos.set(card.id, {
          x: depth * (CARD_W + CARD_GAP_X),
          y: top + (total - own) / 2,
          h: own,
          depth,
        });
        maxDepth = Math.max(maxDepth, depth);
        if (kids.length === 0) return;
        const nextTrail = new Set(trail).add(card.id);
        let sum = 0;
        kids.forEach((kid, position) => {
          sum += bandHeight(kid, nextTrail);
          if (position > 0) sum += CARD_GAP_Y;
        });
        let offset = top + (total - sum) / 2;
        kids.forEach((kid) => {
          place(kid, depth + 1, offset, nextTrail);
          offset += bandHeight(kid, nextTrail) + CARD_GAP_Y;
        });
      }

      // A root with children becomes the head of a tree; roots without children
      // (and any card a cycle keeps unreachable) go into the auto-grid below.
      const treeRoots = index.roots.filter(
        (card) => (index.primaryChildrenOf.get(card.id) || []).length > 0,
      );
      let bottom = 0;
      treeRoots.forEach((root) => {
        place(root, 0, bottom, new Set());
        bottom += bandHeight(root, new Set()) + ROOT_GAP;
      });
      if (treeRoots.length > 0) bottom -= ROOT_GAP;
      let maxWidth = (maxDepth + 1) * (CARD_W + CARD_GAP_X) - CARD_GAP_X;

      const gridCards = cards.filter((card) => !pos.has(card.id)).sort(byOrder);
      let gridTop = bottom;
      let gridHeight = 0;
      let gridWidth = 0;
      if (gridCards.length > 0) {
        gridTop = bottom + (bottom > 0 ? TRAY_GAP + TRAY_HEADER : TRAY_HEADER);
        let y = gridTop;
        let rowHeight = 0;
        let col = 0;
        gridCards.forEach((card) => {
          const height = ownHeight(card);
          pos.set(card.id, {
            x: col * (CARD_W + TRAY_GAP),
            y,
            h: height,
            grid: true,
          });
          rowHeight = Math.max(rowHeight, height);
          gridWidth = Math.max(gridWidth, (col + 1) * (CARD_W + TRAY_GAP) - TRAY_GAP);
          col += 1;
          if (col >= TRAY_COLS) {
            col = 0;
            y += rowHeight + TRAY_GAP;
            rowHeight = 0;
          }
        });
        if (col !== 0) y += rowHeight + TRAY_GAP;
        gridHeight = y - gridTop;
      }

      const width = Math.max(maxWidth, gridWidth, CARD_W);
      const height = gridTop + gridHeight;
      return {
        pos,
        width,
        height,
        gridTop,
        gridHeight,
        hasGrid: gridCards.length > 0,
        gridCount: gridCards.length,
      };
    }

    /* ------------------------------------------------------------------ */
    /* Export builders                                                     */
    /* ------------------------------------------------------------------ */

    function buildMarkdown(state, index, t) {
      const lines = ['# ' + titleOf(state, t), ''];
      function write(card, depth, trail) {
        const pad = '  '.repeat(depth);
        lines.push(pad + '- ' + card.title.replace(/\n/g, ' '));
        if (card.content !== '') {
          card.content.split('\n').forEach((line) => {
            lines.push(pad + '  > ' + line);
          });
        }
        (index.parentsOf.get(card.id) || []).forEach((link) => {
          if (link.primary) return;
          lines.push(pad + '  ' + t('md.cross', { path: pathText(link.parentId, index) }));
        });
        (index.primaryChildrenOf.get(card.id) || []).forEach((kid) => {
          if (trail.has(kid.id)) return;
          write(kid, depth + 1, new Set(trail).add(kid.id));
        });
      }
      index.roots.forEach((root) => {
        write(root, 0, new Set([root.id]));
      });
      return lines.join('\n') + '\n';
    }

    function hasImages(state) {
      return state.cards.some((card) => card.image !== null && card.image !== undefined);
    }

    function imageEntryName(card) {
      return 'images/' + card.id + '.' + imageExtension(card.image.mime);
    }

    function buildMarkdownForZip(state, index, t) {
      const lines = ['# ' + titleOf(state, t), ''];
      function write(card, depth, trail) {
        const pad = '  '.repeat(depth);
        lines.push(pad + '- ' + card.title.replace(/\n/g, ' '));
        if (card.content !== '') {
          card.content.split('\n').forEach((line) => {
            lines.push(pad + '  > ' + line);
          });
        }
        if (card.image !== null && card.image !== undefined) {
          const alt = card.title.replace(/[\[\]\n]/g, ' ');
          lines.push(pad + '  ![' + alt + '](' + imageEntryName(card) + ')');
        }
        (index.parentsOf.get(card.id) || []).forEach((link) => {
          if (link.primary) return;
          lines.push(pad + '  ' + t('md.cross', { path: pathText(link.parentId, index) }));
        });
        (index.primaryChildrenOf.get(card.id) || []).forEach((kid) => {
          if (trail.has(kid.id)) return;
          write(kid, depth + 1, new Set(trail).add(kid.id));
        });
      }
      index.roots.forEach((root) => {
        write(root, 0, new Set([root.id]));
      });
      return lines.join('\n') + '\n';
    }

    function buildHtml(state, index, t) {
      const escape = (value) =>
        String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      const title = titleOf(state, t);
      function renderNode(card, depth, trail) {
        const parts = [];
        parts.push('<div class="t">' + escape(card.title) + '</div>');
        if (card.content !== '') {
          parts.push('<div class="c">' + escape(card.content).replace(/\n/g, '<br>') + '</div>');
        }
        if (card.image !== null && card.image !== undefined) {
          parts.push(
            '<img src="' + escape(card.image.data) + '" alt="' + escape(card.title) + '">',
          );
        }
        (index.parentsOf.get(card.id) || []).forEach((link) => {
          if (link.primary) return;
          parts.push(
            '<div class="x">↪ ' +
              escape(t('md.cross', { path: pathText(link.parentId, index) })) +
              '</div>',
          );
        });
        const kids = (index.primaryChildrenOf.get(card.id) || []).filter(
          (kid) => !trail.has(kid.id),
        );
        if (kids.length > 0) {
          parts.push(
            '<ul>' +
              kids
                .map((kid) => '<li>' + renderNode(kid, depth + 1, new Set(trail).add(card.id)) + '</li>')
                .join('') +
              '</ul>',
          );
        }
        return parts.join('');
      }
      const body =
        index.roots.length === 0
          ? '<p class="empty">' + escape(t('tr.empty')) + '</p>'
          : '<ul class="tree">' +
            index.roots
              .map((root) => '<li>' + renderNode(root, 0, new Set([root.id])) + '</li>')
              .join('') +
            '</ul>';
      return (
        '<!doctype html>\n<html lang="zh">\n<head>\n<meta charset="utf-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
        '<title>' + escape(title) + '</title>\n<style>\n' +
        'body{margin:0;padding:32px 20px;background:#f7f7f5;color:#1f2328;font:14px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}\n' +
        'header{max-width:860px;margin:0 auto 18px}header h1{margin:0;font-size:22px;font-weight:600}\n' +
        '.meta{margin:4px 0 0;color:#6b7280;font-size:12px}\n' +
        'main{max-width:860px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px}\n' +
        'ul.tree,ul.tree ul{list-style:none;margin:0;padding-left:18px;border-left:1px solid #eceff1}\n' +
        'ul.tree{padding-left:0;border-left:0}li{margin:8px 0}\n' +
        '.t{font-weight:600}.c{margin:2px 0 0;color:#4b5563;font-size:13px;white-space:pre-wrap}\n' +
        'img{display:block;max-width:100%;max-height:320px;margin:6px 0;border:1px solid #e5e7eb;border-radius:8px}\n' +
        '.x{margin:2px 0 0;color:#6b7280;font-size:12px}\n' +
        '.empty{color:#6b7280}\n' +
        'footer{max-width:860px;margin:14px auto 0;color:#9ca3af;font-size:11px}\n' +
        '</style>\n</head>\n<body>\n<header><h1>' +
        escape(title) +
        '</h1><p class="meta">' +
        state.cards.length +
        ' ' +
        escape(t('tr.htmlCards')) +
        ' · ' +
        state.links.length +
        ' ' +
        escape(t('tr.htmlLinks')) +
        '</p></header>\n<main>' +
        body +
        '</main>\n<footer>' +
        escape(t('tr.htmlFooter')) +
        '</footer>\n</body>\n</html>\n'
      );
    }

    function buildZipBlob(state, index, t) {
      const markdown = buildMarkdownForZip(state, index, t);
      const entries = [{ name: 'tree.md', data: new TextEncoder().encode(markdown) }];
      state.cards.forEach((card) => {
        if (card.image === null || card.image === undefined) return;
        entries.push({ name: imageEntryName(card), data: dataUrlToBytes(card.image.data) });
      });
      return buildZip(entries);
    }

    function buildOutline(state, index) {
      const lines = [];
      function write(card, depth, trail) {
        lines.push('  '.repeat(depth) + card.title.replace(/\n/g, ' '));
        (index.primaryChildrenOf.get(card.id) || []).forEach((kid) => {
          if (trail.has(kid.id)) return;
          write(kid, depth + 1, new Set(trail).add(kid.id));
        });
      }
      index.roots.forEach((root) => {
        write(root, 0, new Set([root.id]));
      });
      return lines.join('\n') + '\n';
    }

    function sanitizeMermaid(text) {
      return text.replace(/[()[\]{}"`]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function buildMermaid(state, index, t) {
      const lines = ['mindmap'];
      let counter = 0;
      const ids = new Map();
      function idOf(card) {
        if (!ids.has(card.id)) {
          counter += 1;
          ids.set(card.id, 'n' + counter);
        }
        return ids.get(card.id);
      }
      lines.push('  root((' + sanitizeMermaid(titleOf(state, t)) + '))');
      function write(card, depth, trail) {
        lines.push('  '.repeat(depth) + idOf(card) + '["' + sanitizeMermaid(card.title) + '"]');
        (index.primaryChildrenOf.get(card.id) || []).forEach((kid) => {
          if (trail.has(kid.id)) return;
          write(kid, depth + 1, new Set(trail).add(kid.id));
        });
      }
      index.roots.forEach((root) => {
        write(root, 2, new Set([root.id]));
      });
      return lines.join('\n') + '\n';
    }

    function buildJson(state) {
      return (
        JSON.stringify(
          {
            version: 3,
            exportedAt: new Date().toISOString(),
            title: state.title,
            cards: state.cards,
            links: state.links,
          },
          null,
          2,
        ) + '\n'
      );
    }

    function downloadText(name, text, type) {
      try {
        const blob = new Blob([text], { type: type });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        return true;
      } catch (error) {
        return false;
      }
    }

    function fallbackCopy(text) {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
        area.remove();
        return ok === true;
      } catch (error) {
        return false;
      }
    }

    function copyText(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          return navigator.clipboard
            .writeText(text)
            .then(() => true)
            .catch(() => fallbackCopy(text));
        }
      } catch (error) {
        /* fall through */
      }
      return Promise.resolve(fallbackCopy(text));
    }

    /* ------------------------------------------------------------------ */
    /* Images                                                              */
    /* ------------------------------------------------------------------ */

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('read'));
        reader.readAsDataURL(file);
      });
    }

    function blobAsDataUrl(blob) {
      return readFileAsDataUrl(blob);
    }

    function canvasToBlob(canvas, quality) {
      return new Promise((resolve) => {
        if (typeof canvas.toBlob !== 'function') {
          resolve(null);
          return;
        }
        canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
      });
    }

    // One image per card: shrink to <=1280px, re-encode as WebP, cap at ~420KB.
    // Falls back to the raw data URL when the browser cannot draw/encode
    // (e.g. the jsdom test environment).
    async function prepareImage(file) {
      if (file === null || file === undefined) return { error: 'read' };
      if (typeof file.type !== 'string' || IMAGE_TYPES.indexOf(file.type) < 0) {
        return { error: 'type' };
      }
      if (file.size > MAX_IMAGE_INPUT) return { error: 'big' };

      if (file.type === 'image/gif') {
        const data = await readFileAsDataUrl(file);
        if (data.length > MAX_IMAGE_STORED * 1.45) return { error: 'large' };
        return { image: { data, mime: 'image/gif', w: 0, h: 0 } };
      }

      try {
        if (typeof createImageBitmap === 'function') {
          const bitmap = await createImageBitmap(file);
          const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
          const width = Math.max(1, Math.round(bitmap.width * scale));
          const height = Math.max(1, Math.round(bitmap.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (context !== null) {
            context.drawImage(bitmap, 0, 0, width, height);
            if (typeof bitmap.close === 'function') bitmap.close();
            let encoded = await canvasToBlob(canvas, 0.8);
            if (encoded !== null && encoded.size > MAX_IMAGE_STORED) {
              encoded = await canvasToBlob(canvas, 0.55);
            }
            if (encoded !== null && encoded.size > MAX_IMAGE_STORED) {
              const small = document.createElement('canvas');
              const nextWidth = Math.max(1, Math.round(width * 0.6));
              const nextHeight = Math.max(1, Math.round(height * 0.6));
              small.width = nextWidth;
              small.height = nextHeight;
              const smallContext = small.getContext('2d');
              if (smallContext !== null) {
                smallContext.drawImage(canvas, 0, 0, nextWidth, nextHeight);
                encoded = await canvasToBlob(small, 0.6);
                if (encoded !== null && encoded.size <= MAX_IMAGE_STORED) {
                  const data = await blobAsDataUrl(encoded);
                  return {
                    image: { data, mime: encoded.type || 'image/webp', w: nextWidth, h: nextHeight },
                  };
                }
              }
              return { error: 'large' };
            }
            if (encoded !== null && encoded.size <= MAX_IMAGE_STORED) {
              const data = await blobAsDataUrl(encoded);
              return {
                image: { data, mime: encoded.type || 'image/webp', w: width, h: height },
              };
            }
          }
        }
      } catch (error) {
        /* fall through to the raw data URL */
      }

      try {
        const data = await readFileAsDataUrl(file);
        if (data.length > MAX_IMAGE_STORED * 1.45) return { error: 'large' };
        return { image: { data, mime: file.type, w: 0, h: 0 } };
      } catch (error) {
        return { error: 'read' };
      }
    }

    function firstImageFile(dataTransfer) {
      if (dataTransfer === null || dataTransfer === undefined) return null;
      const files = dataTransfer.files;
      if (files === null || files === undefined || files.length === 0) return null;
      for (let position = 0; position < files.length; position += 1) {
        const file = files[position];
        if (file && typeof file.type === 'string' && file.type.indexOf('image/') === 0) return file;
      }
      return null;
    }

    function dataTransferHasFiles(dataTransfer) {
      if (dataTransfer === null || dataTransfer === undefined) return false;
      const types = dataTransfer.types;
      if (types === null || types === undefined) return false;
      for (let position = 0; position < types.length; position += 1) {
        if (types[position] === 'Files') return true;
      }
      return false;
    }

    async function applyImageFile(store, cardId, file, t, showNotice) {
      if (file === null) return;
      const result = await prepareImage(file);
      if (result.error !== undefined) {
        showNotice(t('image.error.' + result.error), 'error');
        return;
      }
      const status = store.setCardImage(cardId, result.image);
      if (status === 'quota') showNotice(t('image.quota'), 'error');
    }

    function imageExtension(mime) {
      if (mime === 'image/jpeg') return 'jpg';
      if (mime === 'image/webp') return 'webp';
      if (mime === 'image/gif') return 'gif';
      return 'png';
    }

    function dataUrlToBytes(dataUrl) {
      const comma = dataUrl.indexOf(',');
      if (comma === -1) return new Uint8Array(0);
      const header = dataUrl.slice(0, comma);
      const body = dataUrl.slice(comma + 1);
      if (header.indexOf('base64') >= 0) {
        const binary = atob(body);
        const bytes = new Uint8Array(binary.length);
        for (let position = 0; position < binary.length; position += 1) {
          bytes[position] = binary.charCodeAt(position);
        }
        return bytes;
      }
      return new TextEncoder().encode(decodeURIComponent(body));
    }

    const CRC_TABLE = (() => {
      const table = new Uint32Array(256);
      for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
          value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        table[index] = value >>> 0;
      }
      return table;
    })();

    function crc32(bytes) {
      let value = 0xffffffff;
      for (let position = 0; position < bytes.length; position += 1) {
        value = CRC_TABLE[(value ^ bytes[position]) & 0xff] ^ (value >>> 8);
      }
      return (value ^ 0xffffffff) >>> 0;
    }

    // Minimal ZIP writer (STORE, no compression) so image exports need no dependency.
    function buildZip(entries) {
      const encoder = new TextEncoder();
      const now = new Date();
      const dosTime =
        ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff;
      const dosDate =
        (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
      const locals = [];
      const centrals = [];
      let offset = 0;
      entries.forEach((entry) => {
        const name = encoder.encode(entry.name);
        const data = entry.data;
        const crc = crc32(data);
        const local = new Uint8Array(30 + name.length);
        const localView = new DataView(local.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0x0800, true);
        localView.setUint16(8, 0, true);
        localView.setUint16(10, dosTime, true);
        localView.setUint16(12, dosDate, true);
        localView.setUint32(14, crc, true);
        localView.setUint32(18, data.length, true);
        localView.setUint32(22, data.length, true);
        localView.setUint16(26, name.length, true);
        localView.setUint16(28, 0, true);
        local.set(name, 30);
        locals.push(local, data);

        const central = new Uint8Array(46 + name.length);
        const centralView = new DataView(central.buffer);
        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0x0800, true);
        centralView.setUint16(10, 0, true);
        centralView.setUint16(12, dosTime, true);
        centralView.setUint16(14, dosDate, true);
        centralView.setUint32(16, crc, true);
        centralView.setUint32(20, data.length, true);
        centralView.setUint32(24, data.length, true);
        centralView.setUint16(28, name.length, true);
        centralView.setUint16(30, 0, true);
        centralView.setUint16(32, 0, true);
        centralView.setUint16(34, 0, true);
        centralView.setUint16(36, 0, true);
        centralView.setUint32(38, 0, true);
        centralView.setUint32(42, offset, true);
        central.set(name, 46);
        centrals.push(central);
        offset += local.length + data.length;
      });
      const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
      const end = new Uint8Array(22);
      const endView = new DataView(end.buffer);
      endView.setUint32(0, 0x06054b50, true);
      endView.setUint16(8, entries.length, true);
      endView.setUint16(10, entries.length, true);
      endView.setUint32(12, centralSize, true);
      endView.setUint32(16, offset, true);
      return new Blob(locals.concat(centrals, [end]), { type: 'application/zip' });
    }

    function downloadBlob(name, blob) {
      try {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        return true;
      } catch (error) {
        return false;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Store                                                               */
    /* ------------------------------------------------------------------ */

    function createStore() {
      let data;
      let broken = false;
      let storageError = false;
      try {
        let rawText = window.localStorage.getItem(STORAGE_KEY);
        if (rawText === null) rawText = window.localStorage.getItem(LEGACY_KEY);
        if (rawText === null) rawText = window.localStorage.getItem(LEGACY_KEY_V1);
        if (rawText === null) {
          data = normalizeData(null);
        } else {
          let parsed = null;
          try {
            parsed = JSON.parse(rawText);
          } catch (error) {
            parsed = null;
            broken = true;
          }
          if (parsed === null && broken === false) broken = true;
          data = normalizeData(parsed);
        }
      } catch (error) {
        data = normalizeData(null);
        broken = true;
      }

      let ui = normalizeUi(readJson(UI_KEY), data);
      let prompts = normalizePrompts(readJson(PROMPTS_KEY));
      const history = [];
      const listeners = new Set();
      let snapshot = null;
      let savedAt = null;

      function buildSnapshot() {
        return {
          stage: data.stage,
          title: data.title,
          cards: data.cards,
          links: data.links,
          ui,
          broken,
          storageError,
          savedAt,
          prompts,
          undoable: history.length > 0,
        };
      }

      function emit() {
        snapshot = buildSnapshot();
        listeners.forEach((listener) => listener(snapshot));
      }

      function persist() {
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              version: 3,
              stage: data.stage,
              title: data.title,
              cards: data.cards,
              links: data.links,
            }),
          );
          storageError = false;
          broken = false;
          savedAt = Date.now();
        } catch (error) {
          storageError = true;
          savedAt = null;
        }
      }

      function persistUi() {
        try {
          window.localStorage.setItem(UI_KEY, JSON.stringify(ui));
        } catch (error) {
          /* UI state is a convenience only */
        }
      }

      function commit(mutator) {
        history.push({
          stage: data.stage,
          title: data.title,
          cards: data.cards,
          links: data.links,
        });
        if (history.length > UNDO_LIMIT) history.shift();
        mutator();
        data = Object.assign({}, data, { updatedAt: Date.now() });
        persist();
        emit();
      }

      function nextOrder() {
        return data.cards.reduce((max, card) => Math.max(max, card.order), -1) + 1;
      }

      function addCard(title, content) {
        const cleanTitle = clampText(String(title === undefined || title === null ? '' : title).trim(), MAX_TITLE);
        if (cleanTitle === '') return null;
        const card = {
          id: newId('c'),
          title: cleanTitle,
          content: clampText(String(content === undefined || content === null ? '' : content).trim(), MAX_CONTENT),
          placed: false,
          order: nextOrder(),
          createdAt: Date.now(),
        };
        commit(() => {
          data.cards = data.cards.concat([card]);
        });
        return card.id;
      }

      function createTheme(title) {
        const value = clampText(
          String(title === undefined || title === null ? '' : title).trim(),
          MAX_TITLE,
        );
        if (value === '') return null;
        const card = {
          id: newId('c'),
          title: value,
          content: '',
          placed: true,
          order: nextOrder(),
          createdAt: Date.now(),
        };
        commit(() => {
          data.cards = data.cards.concat([card]);
        });
        return card.id;
      }

      function updateCard(id, patch) {
        const clean = {};
        if (patch.title !== undefined) {
          const title = clampText(String(patch.title).trim(), MAX_TITLE);
          if (title === '') return;
          clean.title = title;
        }
        if (patch.content !== undefined) {
          clean.content = clampText(String(patch.content), MAX_CONTENT);
        }
        if (Object.keys(clean).length === 0) return;
        commit(() => {
          data.cards = data.cards.map((card) =>
            card.id === id ? Object.assign({}, card, clean) : card,
          );
        });
      }

      function setTitle(value) {
        data = Object.assign({}, data, {
          title: clampText(String(value === undefined || value === null ? '' : value), 60),
          updatedAt: Date.now(),
        });
        persist();
        emit();
      }

      function storageRisk(cards) {
        try {
          return (
            JSON.stringify({
              version: 3,
              stage: data.stage,
              title: data.title,
              cards,
              links: data.links,
            }).length > STORAGE_CHAR_BUDGET
          );
        } catch (error) {
          return true;
        }
      }

      function setCardImage(id, image) {
        if (!data.cards.some((card) => card.id === id)) return 'missing';
        const nextCards = data.cards.map((card) =>
          card.id === id ? Object.assign({}, card, { image: image }) : card,
        );
        if (storageRisk(nextCards)) return 'quota';
        commit(() => {
          data.cards = nextCards;
        });
        if (storageError) {
          undo();
          return 'quota';
        }
        return null;
      }

      function removeCard(id) {
        const index = indexData(data);
        const parentId = index.primaryParentOf.get(id);
        const kids = index.primaryChildrenOf.get(id) || [];
        commit(() => {
          let links = data.links.filter((link) => link.childId !== id && link.parentId !== id);
          if (parentId !== undefined) {
            kids.forEach((kid) => {
              if (kid.id !== parentId) {
                links = links.concat([
                  { id: newId('l'), parentId, childId: kid.id, primary: true },
                ]);
              }
            });
          }
          data.links = links;
          data.cards = data.cards
            .filter((card) => card.id !== id)
            .map((card) => {
              if (parentId === undefined && kids.some((kid) => kid.id === card.id)) {
                return Object.assign({}, card, { placed: true });
              }
              return card;
            });
        });
      }

      function addChild(parentId, title) {
        const value = clampText(String(title === undefined || title === null ? '' : title).trim(), MAX_TITLE);
        if (value === '' || !indexData(data).byId.has(parentId)) return;
        commit(() => {
          const card = {
            id: newId('c'),
            title: value,
            content: '',
            placed: true,
            order: nextOrder(),
            createdAt: Date.now(),
          };
          data.cards = data.cards.concat([card]);
          data.links = data.links.concat([
            { id: newId('l'), parentId, childId: card.id, primary: true },
          ]);
        });
      }

      function placeCard(childId, parentId) {
        if (childId === parentId) return 'cycle';
        const index = indexData(data);
        if (!index.byId.has(childId)) return null;
        if (parentId !== null) {
          if (!index.byId.has(parentId)) return null;
          if (isDescendant(index, childId, parentId)) return 'cycle';
        }
        commit(() => {
          let links =
            parentId === null
              ? data.links.filter((link) => link.childId !== childId)
              : data.links.filter(
                  (link) =>
                    !(link.childId === childId && (link.primary || link.parentId === parentId)),
                );
          if (parentId !== null) {
            links = links.concat([{ id: newId('l'), parentId, childId, primary: true }]);
          }
          data.links = links;
          data.cards = data.cards.map((card) =>
            card.id === childId ? Object.assign({}, card, { placed: true }) : card,
          );
        });
        return null;
      }

      function addSecondary(childId, parentId) {
        if (childId === parentId) return 'cycle';
        const index = indexData(data);
        if (!index.byId.has(childId) || !index.byId.has(parentId)) return null;
        if (isDescendant(index, childId, parentId)) return 'cycle';
        const exists = data.links.some(
          (link) => link.childId === childId && link.parentId === parentId,
        );
        if (exists) return null;
        const hasPrimary = data.links.some(
          (link) => link.childId === childId && link.primary,
        );
        commit(() => {
          data.links = data.links.concat([
            { id: newId('l'), parentId, childId, primary: !hasPrimary },
          ]);
          data.cards = data.cards.map((card) =>
            card.id === childId ? Object.assign({}, card, { placed: true }) : card,
          );
        });
        return null;
      }

      function unplaceCard(id) {
        const index = indexData(data);
        if (!index.byId.has(id)) return;
        const doomed = new Set([id]);
        const walk = (cardId) => {
          (index.primaryChildrenOf.get(cardId) || []).forEach((kid) => {
            if (doomed.has(kid.id)) return;
            doomed.add(kid.id);
            walk(kid.id);
          });
        };
        walk(id);
        commit(() => {
          data.links = data.links.filter(
            (link) => !doomed.has(link.childId) && !doomed.has(link.parentId),
          );
          data.cards = data.cards.map((card) =>
            doomed.has(card.id) ? Object.assign({}, card, { placed: false }) : card,
          );
        });
      }

      function settleRestIndependent() {
        const pending = data.cards.filter((card) => card.placed !== true);
        if (pending.length === 0) return;
        const pendingIds = new Set(pending.map((card) => card.id));
        commit(() => {
          data.links = data.links.filter((link) => !pendingIds.has(link.childId));
          data.cards = data.cards.map((card) =>
            pendingIds.has(card.id) ? Object.assign({}, card, { placed: true }) : card,
          );
        });
      }

      function removeLink(linkId) {
        const link = data.links.find((item) => item.id === linkId);
        if (link === undefined) return;
        commit(() => {
          let links = data.links.filter((item) => item.id !== linkId);
          const rest = links.filter((item) => item.childId === link.childId);
          if (rest.length > 0 && !rest.some((item) => item.primary)) {
            links = links.map((item) =>
              item.id === rest[0].id ? Object.assign({}, item, { primary: true }) : item,
            );
          }
          data.links = links;
          if (rest.length === 0) {
            data.cards = data.cards.map((card) =>
              card.id === link.childId
                ? Object.assign({}, card, { placed: data.stage === 'tree' })
                : card,
            );
          }
        });
      }

      function promoteLink(linkId) {
        const link = data.links.find((item) => item.id === linkId);
        if (link === undefined || link.primary) return null;
        const index = indexData(data);
        if (isDescendant(index, link.childId, link.parentId)) return 'cycle';
        commit(() => {
          data.links = data.links.map((item) =>
            item.childId === link.childId
              ? Object.assign({}, item, { primary: item.id === linkId })
              : item,
          );
        });
        return null;
      }

      function moveSibling(id, delta) {
        const index = indexData(data);
        const parentId = index.primaryParentOf.get(id);
        const siblings =
          parentId === undefined ? index.roots : index.primaryChildrenOf.get(parentId) || [];
        const position = siblings.findIndex((card) => card.id === id);
        const target = position + delta;
        if (position < 0 || target < 0 || target >= siblings.length) return;
        const a = siblings[position];
        const b = siblings[target];
        commit(() => {
          data.cards = data.cards.map((card) => {
            if (card.id === a.id) return Object.assign({}, card, { order: b.order });
            if (card.id === b.id) return Object.assign({}, card, { order: a.order });
            return card;
          });
        });
      }

      function goStage(stage) {
        if (STAGES.indexOf(stage) < 0 || stage === data.stage) return;
        if (stage !== 'brainstorm' && data.cards.length < 2) return;
        if (stage === 'tree' && data.cards.some((card) => card.placed !== true)) return;
        commit(() => {
          data.stage = stage;
        });
      }

      function undo() {
        const previous = history.pop();
        if (previous === undefined) {
          emit();
          return;
        }
        data = Object.assign({}, data, {
          stage: previous.stage,
          title: previous.title,
          cards: previous.cards,
          links: previous.links,
          updatedAt: Date.now(),
        });
        persist();
        emit();
      }

      function toggleIn(listName, id) {
        const set = new Set(ui[listName]);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        ui = Object.assign({}, ui, { [listName]: Array.from(set) });
        persistUi();
        emit();
      }

      function toggleCollapse(id) {
        toggleIn('collapsed', id);
      }

      function toggleExpand(id) {
        toggleIn('expanded', id);
      }

      function setView(view) {
        if (view !== 'indent' && view !== 'graph') return;
        ui = Object.assign({}, ui, { view });
        persistUi();
        emit();
      }

      function setPrompt(index) {
        ui = Object.assign({}, ui, { prompt: Math.max(0, index) });
        persistUi();
        emit();
      }

      function setPrompts(list) {
        let next = null;
        if (Array.isArray(list)) {
          const items = list
            .map((item) => clampText(typeof item === 'string' ? item.trim() : '', MAX_PROMPT_CHARS))
            .filter((item) => item !== '')
            .slice(0, MAX_PROMPT_ITEMS);
          next = items.length > 0 ? items : null;
        }
        prompts = next;
        ui = Object.assign({}, ui, { prompt: 0 });
        try {
          if (next === null) window.localStorage.removeItem(PROMPTS_KEY);
          else {
            window.localStorage.setItem(
              PROMPTS_KEY,
              JSON.stringify({ version: 1, items: next }),
            );
          }
          storageError = false;
          savedAt = Date.now();
        } catch (error) {
          storageError = true;
          savedAt = null;
        }
        persistUi();
        emit();
      }

      function importBundle(parsed) {
        const incoming = normalizeData(parsed);
        if (incoming.cards.length === 0) return null;
        const before = data.cards.length;
        commit(() => {
          const cards = data.cards.slice();
          incoming.cards.forEach((card) => {
            const position = cards.findIndex((item) => item.id === card.id);
            if (position >= 0) {
              cards[position] = Object.assign({}, cards[position], {
                title: card.title,
                content: card.content === '' ? cards[position].content : card.content,
                image: card.image !== null ? card.image : cards[position].image,
              });
            } else {
              cards.push(Object.assign({}, card, { order: cards.length }));
            }
          });
          const linkIds = new Set(data.links.map((link) => link.id));
          const links = data.links.slice();
          incoming.links.forEach((link) => {
            if (!linkIds.has(link.id)) links.push(link);
          });
          const normalized = normalizeData({
            version: 2,
            stage: data.stage,
            title: data.title,
            cards,
            links,
          });
          data.cards = normalized.cards;
          data.links = normalized.links;
          data.stage = normalized.stage;
          if (data.title.trim() === '' && incoming.title !== '') data.title = incoming.title;
        });
        return data.cards.length - before;
      }

      emit();

      return {
        getState: function getState() {
          return snapshot;
        },
        subscribe: function subscribe(listener) {
          listeners.add(listener);
          return function unsubscribe() {
            listeners.delete(listener);
          };
        },
        addCard,
        createTheme,
        addChild,
        updateCard,
        setCardImage,
        setTitle,
        removeCard,
        placeCard,
        addSecondary,
        unplaceCard,
        settleRestIndependent,
        removeLink,
        promoteLink,
        moveSibling,
        goStage,
        undo,
        toggleCollapse,
        toggleExpand,
        setView,
        setPrompt,
        setPrompts,
        importBundle,
      };
    }

    /* ------------------------------------------------------------------ */
    /* Hooks                                                               */
    /* ------------------------------------------------------------------ */

    function useStoreState(store) {
      const [state, setState] = React.useState(store.getState());
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
        setNotice({ text, kind: kind === 'error' ? 'error' : kind === 'info' ? 'info' : 'ok' });
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

    const ICON_PATHS = {
      plus: 'M8 3.4v9.2M3.4 8h9.2',
      close: 'M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8',
      check: 'M3.2 8.4l3.2 3.2 6.4-6.4',
      undo: 'M6.2 4.4L3.4 7.2l2.8 2.8M3.6 7.2h5.6a3.2 3.2 0 0 1 0 6.4H7',
      download: 'M8 3.4v6.2M5.4 7.4L8 10l2.6-2.6M3.4 12.4h9.2',
      upload: 'M8 10V3.8M5.4 6.4L8 3.8l2.6 2.6M3.4 12.4h9.2',
      copy: 'M5.8 5.6h6.8v6.8H5.8zM3.4 10.4V3.4h6.8',
      help: 'M8 13.6A5.6 5.6 0 1 0 8 2.4a5.6 5.6 0 0 0 0 11.2zM6.4 6.3a1.7 1.7 0 1 1 2.4 1.6c-.5.3-.8.6-.8 1.2M8 11.4v.2',
      up: 'M8 11.6V4.4M4.8 7.6L8 4.4l3.2 3.2',
      down: 'M8 4.4v7.2M4.8 8.4L8 11.6l3.2-3.2',
      trash: 'M3.6 5.2h8.8M6.6 5.2V3.6h2.8v1.6M5 5.2l.5 7.2h5l.5-7.2',
      edit: 'M3.6 12.4l.5-2.3 6.1-6.1 1.8 1.8-6.1 6.1zM9.6 4.6l1.8 1.8',
      note: 'M4 3.4h8v9.2H4zM6 6.4h4M6 8.6h4',
      link: 'M6.6 9.4l2.8-2.8M5.6 6.6L4.2 8a2.1 2.1 0 0 0 3 3l1.4-1.4M10.4 9.4L11.8 8a2.1 2.1 0 0 0-3-3L7.4 6.4',
      warn: 'M8 2.6l6 11.2H2zM8 6.6v3.2M8 11.8v.2',
      adopt: 'M3.4 4.2v4.4a2 2 0 0 0 2 2h5.4M8.6 8.2L11 10.6l-2.4 2.4',
    };

    function Icon(props) {
      const size = props.size || 14;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false' },
        h('path', {
          d: ICON_PATHS[props.name] || ICON_PATHS.note,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    function PanelGlyph(props) {
      const size = props.size || 16;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false' },
        h('path', {
          d: 'M4.5 4.2h6.6M4.5 4.2v6.6M4.5 10.8h6.6',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 4.5, cy: 3.4, r: 1.3, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
        h('circle', { cx: 11.9, cy: 7.6, r: 1.3, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
        h('circle', { cx: 5.6, cy: 11.8, r: 1.3, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Shared UI                                                           */
    /* ------------------------------------------------------------------ */

    function StageBar(props) {
      const { stage, t, canNext, onBack, onNext, undo, canUndo, backLabel } = props;
      const currentIndex = STAGES.indexOf(stage);
      const children = [];
      STAGES.forEach((item, index) => {
        if (index > 0)
          children.push(h('span', { key: 'sep' + item, className: 'kt-stage-sep' }, '›'));
        const done = index < currentIndex;
        children.push(
          h(
            'div',
            {
              key: item,
              className:
                'kt-stage' +
                (index === currentIndex ? ' kt-stage-current' : '') +
                (done ? ' kt-stage-done' : ''),
              'aria-current': index === currentIndex ? 'step' : undefined,
            },
            h('span', { className: 'kt-stage-num' }, done ? '✓' : String(index + 1)),
            h('span', null, t('stage.' + item)),
          ),
        );
      });
      return h(
        'div',
        { className: 'kt-stages', role: 'list', 'aria-label': t('a11y.stage') },
        children,
        h(
          'div',
          { className: 'kt-stage-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'kt-btn',
              onClick: undo,
              disabled: !canUndo,
              title: t('actions.undo'),
            },
            h(Icon, { name: 'undo' }),
            t('actions.undo'),
          ),
          currentIndex > 0
            ? h(
                'button',
                { type: 'button', className: 'kt-btn', onClick: onBack, title: backLabel },
                backLabel,
              )
            : null,
          currentIndex < STAGES.length - 1
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'kt-btn kt-btn-primary',
                  onClick: onNext,
                  disabled: !canNext,
                },
                t(currentIndex === 0 ? 'stage.nextBrainstorm' : 'stage.nextClassify'),
              )
            : null,
        ),
      );
    }

    function HelpDialog(props) {
      const { t, onClose } = props;
      const closeRef = React.useRef(null);
      React.useEffect(() => {
        function onKey(event) {
          if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        if (closeRef.current !== null) closeRef.current.focus();
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);
      return h(
        'div',
        {
          className: 'kt-overlay',
          role: 'presentation',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          'div',
          { className: 'kt-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('help.title') },
          h('h2', null, t('help.title')),
          h('p', null, t('help.intro')),
          h('div', { className: 'kt-help-step' }, h('h3', null, t('help.s1t')), h('p', null, t('help.s1b'))),
          h('div', { className: 'kt-help-step' }, h('h3', null, t('help.s2t')), h('p', null, t('help.s2b'))),
          h('div', { className: 'kt-help-step' }, h('h3', null, t('help.s3t')), h('p', null, t('help.s3b'))),
          h('p', null, t('help.data')),
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'flex-end' } },
            h('button', { type: 'button', className: 'kt-btn', onClick: onClose, ref: closeRef }, t('help.close')),
          ),
        ),
      );
    }

    function ExportMenu(props) {
      const { t, actions, hasImages: withImages } = props;
      const [open, setOpen] = React.useState(false);
      const wrapRef = React.useRef(null);
      React.useEffect(() => {
        if (!open) return undefined;
        function onDown(event) {
          if (wrapRef.current !== null && wrapRef.current.contains(event.target)) return;
          setOpen(false);
        }
        function onKey(event) {
          if (event.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('mousedown', onDown);
          document.removeEventListener('keydown', onKey);
        };
      }, [open]);
      function run(action) {
        setOpen(false);
        action();
      }
      return h(
        'div',
        { className: 'kt-menu-wrap', ref: wrapRef },
        h(
          'button',
          {
            type: 'button',
            className: 'kt-btn',
            'aria-haspopup': 'menu',
            'aria-expanded': open,
            onClick: () => setOpen((value) => !value),
          },
          h(Icon, { name: 'download' }),
          t('actions.export'),
        ),
        open
          ? h(
              'div',
              { className: 'kt-menu', role: 'menu' },
              withImages
                ? h('button', { type: 'button', className: 'kt-menu-item', role: 'menuitem', onClick: () => run(actions.zip) }, t('ex.zip'))
                : h('button', { type: 'button', className: 'kt-menu-item', role: 'menuitem', onClick: () => run(actions.markdown) }, t('ex.markdown')),
              h('button', { type: 'button', className: 'kt-menu-item', role: 'menuitem', onClick: () => run(actions.html) }, t('ex.html')),
              h('button', { type: 'button', className: 'kt-menu-item', role: 'menuitem', onClick: () => run(actions.mermaid) }, t('ex.mermaid')),
              h('button', { type: 'button', className: 'kt-menu-item', role: 'menuitem', onClick: () => run(actions.text) }, t('ex.text')),
              h('div', { className: 'kt-menu-sep' }),
              h('button', { type: 'button', className: 'kt-menu-item', role: 'menuitem', onClick: () => run(actions.json) }, t('ex.json')),
              h('button', { type: 'button', className: 'kt-menu-item', role: 'menuitem', onClick: () => run(actions.import) }, t('actions.import')),
            )
          : null,
      );
    }

    function AttachDialog(props) {
      const { store, state, cardId, mode, t, onClose, showNotice } = props;
      const [query, setQuery] = React.useState('');
      const inputRef = React.useRef(null);
      const index = indexData(state);
      const isRef = mode === 'ref';
      const card = index.byId.get(cardId);
      const hasPrimary = index.primaryParentOf.has(cardId);

      React.useEffect(() => {
        function onKey(event) {
          if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        if (inputRef.current !== null) inputRef.current.focus();
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);

      const needle = query.trim().toLowerCase();
      const candidates = state.cards
        .filter((item) => item.id !== cardId && !isDescendant(index, cardId, item.id))
        .filter((item) => needle === '' || item.title.toLowerCase().indexOf(needle) >= 0)
        .sort(byOrder);

      function pick(parentId) {
        const result = isRef
          ? store.addSecondary(cardId, parentId)
          : store.placeCard(cardId, parentId);
        if (result === 'cycle') showNotice(t('cl.cycle'), 'error');
        onClose();
      }

      return h(
        'div',
        {
          className: 'kt-overlay',
          role: 'presentation',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          'div',
          {
            className: 'kt-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': isRef ? t('cl.refTitle') : t('cl.attachTitle'),
          },
          h('h2', null, isRef ? t('cl.refTitle') : t('cl.attachTitle')),
          card === undefined ? null : h('p', null, card.title),
          h('input', {
            ref: inputRef,
            className: 'kt-input',
            value: query,
            placeholder: t('cl.attachSearch'),
            onChange: (event) => setQuery(event.target.value),
            'aria-label': t('cl.attachSearch'),
          }),
          isRef ? h('p', null, hasPrimary ? t('cl.refNote') : t('cl.refNoPrimary')) : null,
          candidates.length === 0
            ? h('p', null, t('cl.attachEmpty'))
            : h(
                'div',
                { className: 'kt-attach-list', role: 'list' },
                candidates.map((item) =>
                  h(
                    'button',
                    {
                      key: item.id,
                      type: 'button',
                      className: 'kt-attach-item',
                      role: 'listitem',
                      onClick: () => pick(item.id),
                    },
                    h(Icon, { name: 'adopt', size: 13 }),
                    h('span', null, item.title),
                    h('span', { className: 'kt-attach-path' }, pathText(item.id, index)),
                  ),
                ),
              ),
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'flex-end' } },
            h('button', { type: 'button', className: 'kt-btn', onClick: onClose }, t('cl.attachClose')),
          ),
        ),
      );
    }

    function PromptDialog(props) {
      const { t, initial, onSave, onClose } = props;
      const [items, setItems] = React.useState(initial.slice());
      const [error, setError] = React.useState('');
      const firstRef = React.useRef(null);

      React.useEffect(() => {
        function onKey(event) {
          if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        if (firstRef.current !== null) firstRef.current.focus();
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);

      function update(index, value) {
        setItems((prev) => prev.map((item, position) => (position === index ? value : item)));
        setError('');
      }

      function remove(index) {
        setItems((prev) => prev.filter((item, position) => position !== index));
        setError('');
      }

      function add() {
        setItems((prev) => (prev.length >= MAX_PROMPT_ITEMS ? prev : prev.concat([''])));
        setError('');
      }

      function save() {
        const cleaned = items
          .map((item) => item.trim())
          .filter((item) => item !== '');
        if (cleaned.length === 0) {
          setError(t('bs.promptsAtLeastOne'));
          return;
        }
        onSave(cleaned);
      }

      return h(
        'div',
        {
          className: 'kt-overlay',
          role: 'presentation',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          'div',
          {
            className: 'kt-dialog kt-prompt-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('bs.promptsTitle'),
          },
          h('h2', null, t('bs.promptsTitle')),
          h('p', null, t('bs.promptsHint')),
          h(
            'div',
            { className: 'kt-prompt-list' },
            items.length === 0
              ? h('p', { className: 'kt-empty' }, t('bs.promptsAtLeastOne'))
              : items.map((item, index) =>
                  h(
                    'div',
                    { className: 'kt-prompt-row', key: 'prompt-' + index },
                    h('input', {
                      ref: index === 0 ? firstRef : undefined,
                      className: 'kt-input',
                      value: item,
                      placeholder: t('bs.promptsPlaceholder'),
                      maxLength: MAX_PROMPT_CHARS,
                      'aria-label': t('bs.promptsPlaceholder'),
                      onChange: (event) => update(index, event.target.value),
                    }),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'kt-mini-btn kt-mini-btn-danger',
                        title: t('bs.promptsDelete'),
                        'aria-label': t('bs.promptsDelete'),
                        onClick: () => remove(index),
                      },
                      h(Icon, { name: 'trash', size: 12 }),
                    ),
                  ),
                ),
          ),
          items.length >= MAX_PROMPT_ITEMS
            ? null
            : h(
                'div',
                null,
                h('button', { type: 'button', className: 'kt-text-btn', onClick: add }, t('bs.promptsAdd')),
              ),
          error !== '' ? h('p', { className: 'kt-prompt-error', role: 'alert' }, error) : null,
          h(
            'div',
            { className: 'kt-dialog-foot' },
            h(
              'button',
              { type: 'button', className: 'kt-btn kt-restore', onClick: () => onSave(null) },
              t('bs.promptsRestore'),
            ),
            h('button', { type: 'button', className: 'kt-btn', onClick: onClose }, t('btn.cancel')),
            h(
              'button',
              { type: 'button', className: 'kt-btn kt-btn-primary', onClick: save },
              t('btn.save'),
            ),
          ),
        ),
      );
    }

    function Lightbox(props) {
      const { image, title, t, onClose } = props;
      React.useEffect(() => {
        function onKey(event) {
          if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);
      return h(
        'div',
        {
          className: 'kt-lightbox',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': title,
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h('img', { src: image.data, alt: title }),
        h(
          'button',
          { type: 'button', className: 'kt-lightbox-close', onClick: onClose, 'aria-label': t('image.close') },
          '×',
        ),
      );
    }

    function ImagePanel(props) {
      const { card, store, t, showNotice, compact } = props;
      const inputRef = React.useRef(null);
      const [busy, setBusy] = React.useState(false);
      const [over, setOver] = React.useState(false);
      const [open, setOpen] = React.useState(false);
      const image = card.image || null;

      async function accept(file) {
        if (busy || file === null || file === undefined) return;
        setBusy(true);
        await applyImageFile(store, card.id, file, t, showNotice);
        setBusy(false);
      }

      function onDragOver(event) {
        if (!dataTransferHasFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }

      function onDrop(event) {
        if (!dataTransferHasFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        accept(firstImageFile(event.dataTransfer));
      }

      return h(
        'div',
        {
          className: 'kt-img-panel' + (compact ? ' kt-img-panel-compact' : ''),
          onDragOver,
          onDragLeave: () => setOver(false),
          onDrop,
        },
        image === null
          ? h(
              'button',
              {
                type: 'button',
                className: 'kt-img-drop' + (over ? ' kt-img-over' : ''),
                onClick: () => {
                  if (inputRef.current !== null) inputRef.current.click();
                },
                title: t('image.hint'),
              },
              busy ? t('image.busy') : t('image.add'),
            )
          : h(
              React.Fragment,
              null,
              h(
                'div',
                { className: 'kt-img-wrap' },
                h('img', {
                  className: 'kt-img',
                  src: image.data,
                  alt: card.title,
                  onClick: () => setOpen(true),
                }),
                h(
                  'div',
                  { className: 'kt-img-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'kt-text-btn',
                      onClick: () => {
                        if (inputRef.current !== null) inputRef.current.click();
                      },
                    },
                    busy ? t('image.busy') : t('image.replace'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'kt-text-btn kt-danger-text',
                      onClick: () => store.setCardImage(card.id, null),
                    },
                    t('image.remove'),
                  ),
                ),
              ),
              open ? h(Lightbox, { image, title: card.title, t, onClose: () => setOpen(false) }) : null,
            ),
        h('input', {
          ref: inputRef,
          type: 'file',
          accept: IMAGE_TYPES.join(','),
          className: 'kt-file',
          onChange: (event) => {
            const file = event.target.files && event.target.files[0];
            event.target.value = '';
            accept(file);
          },
        }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Stage 1 · List                                                      */
    /* ------------------------------------------------------------------ */

    function BrainstormStage(props) {
      const { store, state, t, showNotice } = props;
      const [title, setTitle] = React.useState('');
      const [content, setContent] = React.useState('');
      const titleRef = React.useRef(null);
      const composingRef = React.useRef(false);
      const expanded = new Set(state.ui.expanded);
      const [promptOpen, setPromptOpen] = React.useState(false);
      const defaultPrompts = [];
      for (let index = 0; index < PROMPT_COUNT; index += 1) {
        defaultPrompts.push(t('bs.prompt.' + index));
      }
      const custom = Array.isArray(state.prompts) && state.prompts.length > 0;
      const bank = custom ? state.prompts : defaultPrompts;
      const currentPrompt = bank[state.ui.prompt % bank.length];

      function submit() {
        if (composingRef.current) return;
        if (title.trim() === '') return;
        store.addCard(title, content);
        setTitle('');
        setContent('');
        if (titleRef.current !== null) titleRef.current.focus();
      }

      const cards = state.cards.map((card) => {
        const open = expanded.has(card.id);
        return h(
          'div',
          { className: 'kt-card' + (open ? ' kt-card-open' : ''), key: card.id },
          h(
            'div',
            {
              className: 'kt-card-head',
              role: 'button',
              tabIndex: 0,
              'aria-expanded': open,
              'aria-label': card.title,
              onClick: () => store.toggleExpand(card.id),
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  store.toggleExpand(card.id);
                }
              },
            },
            h('span', { className: 'kt-card-title', title: card.title }, card.title),
            card.content !== ''
              ? h('span', { className: 'kt-badge' }, t('tr.content'))
              : null,
            h(
              'span',
              { className: 'kt-card-chevron', title: open ? t('card.collapse') : t('card.expand') },
              open ? '▴' : '▾',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'kt-card-del',
                'aria-label': t('tr.delete'),
                title: t('tr.delete'),
                onClick: (event) => {
                  event.stopPropagation();
                  store.removeCard(card.id);
                },
              },
              h(Icon, { name: 'close', size: 12 }),
            ),
          ),
          open
            ? h(
                'div',
                { className: 'kt-card-body' },
                h('input', {
                  className: 'kt-input',
                  defaultValue: card.title,
                  maxLength: MAX_TITLE,
                  'aria-label': t('tr.edit'),
                  onBlur: (event) => store.updateCard(card.id, { title: event.target.value }),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') store.toggleExpand(card.id);
                  },
                }),
                h('textarea', {
                  className: 'kt-textarea',
                  defaultValue: card.content,
                  placeholder: t('bs.placeholderContent'),
                  maxLength: MAX_CONTENT,
                  'aria-label': t('tr.content'),
                  onBlur: (event) => store.updateCard(card.id, { content: event.target.value }),
                }),
                h(ImagePanel, { card, store, t, showNotice, compact: true }),
              )
            : null,
        );
      });

      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'kt-guide' },
          h('span', { className: 'kt-guide-label' }, t('bs.lead')),
          h(
            'span',
            { className: 'kt-guide-body' },
            h('span', { className: 'kt-guide-text' }, currentPrompt),
            custom ? h('span', { className: 'kt-badge' }, t('bs.customTag')) : null,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'kt-text-btn',
              onClick: () => store.setPrompt((state.ui.prompt + 1) % bank.length),
            },
            t('bs.rotate'),
          ),
          h(
            'button',
            { type: 'button', className: 'kt-text-btn', onClick: () => setPromptOpen(true) },
            t('bs.editPrompts'),
          ),
        ),
        h(
          'form',
          {
            className: 'kt-add-form',
            onSubmit: (event) => {
              event.preventDefault();
              submit();
            },
          },
          h(
            'div',
            { className: 'kt-add-row' },
            h('input', {
              ref: titleRef,
              className: 'kt-input',
              value: title,
              placeholder: t('bs.placeholderTitle'),
              maxLength: MAX_TITLE,
              'aria-label': t('bs.placeholderTitle'),
              onCompositionStart: () => {
                composingRef.current = true;
              },
              onCompositionEnd: () => {
                composingRef.current = false;
              },
              onChange: (event) => setTitle(event.target.value),
              onKeyDown: (event) => {
                if (isImeEnter(event)) return;
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              },
            }),
            h(
              'button',
              { type: 'submit', className: 'kt-btn kt-btn-primary', disabled: title.trim() === '' },
              h(Icon, { name: 'plus' }),
              t('bs.add'),
            ),
          ),
          h('textarea', {
            className: 'kt-textarea',
            value: content,
            placeholder: t('bs.placeholderContent'),
            maxLength: MAX_CONTENT,
            rows: 2,
            'aria-label': t('bs.placeholderContent'),
            onChange: (event) => setContent(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !isImeEnter(event)) {
                event.preventDefault();
                submit();
              }
            },
          }),
        ),
        state.cards.length === 0
          ? h('p', { className: 'kt-empty' }, t('bs.empty'))
          : h('div', { className: 'kt-cards', role: 'list', 'aria-label': t('a11y.cards') }, cards),
        promptOpen
          ? h(PromptDialog, {
              t,
              initial: bank,
              onSave: (list) => {
                store.setPrompts(list);
                setPromptOpen(false);
              },
              onClose: () => setPromptOpen(false),
            })
          : null,
        h(
          'div',
          { className: 'kt-meta-row' },
          h('span', null, t('bs.count', { count: state.cards.length })),
          h('span', null, t('bs.hint')),
          h('span', null, t('bs.enterHint')),
          h('span', null, t('bs.nextHint')),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Stage 2 · Classify whiteboard                                       */
    /* ------------------------------------------------------------------ */

    function affiliationText(card, index, t) {
      if (card.placed !== true) return t('cl.affiliationPending');
      const parentId = index.primaryParentOf.get(card.id);
      if (parentId === undefined) return t('cl.affiliationRoot');
      const parent = index.byId.get(parentId);
      return t('cl.affiliation', { name: parent === undefined ? '?' : parent.title });
    }

    function relatedTitles(card, index) {
      return (index.parentsOf.get(card.id) || [])
        .filter((link) => !link.primary)
        .map((link) => index.byId.get(link.parentId))
        .filter(Boolean)
        .map((parent) => parent.title);
    }

    function BoardCard(props) {
      const { card, point, api, t } = props;
      const index = api.index;
      const open = api.expanded.has(card.id);
      const kids = index.primaryChildrenOf.get(card.id) || [];
      const related = relatedTitles(card, index);
      const pending = card.placed !== true;
      const parentId = index.primaryParentOf.get(card.id);
      const parent = parentId === undefined ? null : index.byId.get(parentId);

      function stop(event) {
        event.stopPropagation();
      }

      return h(
        'div',
        {
          className:
            'kt-bcard' +
            (open ? ' kt-bcard-open' : '') +
            (api.dragId === card.id ? ' kt-bcard-dragging' : '') +
            (api.overId === card.id ? ' kt-bcard-drop' : '') +
            (point.grid ? ' kt-bcard-standalone' : '') +
            (api.fileOverId === card.id ? ' kt-bcard-fileover' : '') +
            (pending ? ' kt-bcard-pending' : ''),
          style: {
            left: point.x + PAD,
            top: point.y + PAD,
            width: CARD_W,
            height: point.h,
          },
          draggable: true,
          role: 'button',
          tabIndex: 0,
          'aria-expanded': open,
          'aria-label': card.title,
          onDragStart: (event) => api.beginDrag(event, card.id),
          onDragEnd: api.endDrag,
          onDragOver: (event) => api.dragOver(event, card.id),
          onDragLeave: () => {
            api.setOverId(null);
            api.setFileOver(null);
          },
          onDrop: (event) => api.drop(event, card.id),
          onClick: () => api.toggle(card.id),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              api.toggle(card.id);
            }
          },
        },
        h(
          'div',
          { className: 'kt-bcard-head' },
          h('span', { className: 'kt-bcard-title', title: card.title }, card.title),
          h(
            'span',
            { className: 'kt-bcard-chevron', title: open ? t('card.collapse') : t('card.expand') },
            open ? '▴' : '▾',
          ),
        ),
        h(
          'div',
          { className: 'kt-bcard-meta' },
          pending ? h('span', { className: 'kt-badge kt-badge-pending' }, t('cl.pending')) : null,
          kids.length > 0
            ? h(
                'span',
                { className: 'kt-badge', title: t('cl.childrenBadge', { count: kids.length }) },
                t('cl.childrenBadge', { count: kids.length }),
              )
            : null,
          related.length > 0
            ? h(
                'span',
                { className: 'kt-badge kt-badge-brand', title: related.join('、') },
                t('cl.refsBadge', { count: related.length }),
              )
            : null,
          h(
            'span',
            { className: 'kt-bcard-affil', title: affiliationText(card, index, t) },
            pending
              ? ''
              : parent === null
                ? t('cl.affilTop')
                : t('cl.affilParent', { name: parent.title }),
          ),
        ),
        open
          ? h(
              'div',
              { className: 'kt-bcard-body', onClick: stop },
              h('p', { className: 'kt-affil' }, affiliationText(card, index, t)),
              related.length > 0
                ? h('p', { className: 'kt-affil' }, t('cl.related', { names: related.join('、') }))
                : null,
              h(
                'div',
                { className: 'kt-bcard-content' },
                card.content === ''
                  ? h('span', { className: 'kt-content-placeholder' }, t('card.noContent'))
                  : card.content,
              ),
              h(ImagePanel, { card, store: api.store, t, showNotice: api.showNotice, compact: true }),
              h(
                'div',
                { className: 'kt-bcard-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'kt-text-btn',
                    onClick: (event) => {
                      event.stopPropagation();
                      api.openAttach(card.id, 'parent');
                    },
                  },
                  t('cl.attachTo'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'kt-text-btn',
                    onClick: (event) => {
                      event.stopPropagation();
                      api.openAttach(card.id, 'ref');
                    },
                  },
                  t('cl.addRef'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'kt-text-btn',
                    onClick: (event) => {
                      event.stopPropagation();
                      api.setRoot(card.id);
                    },
                  },
                  t('cl.setRoot'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'kt-text-btn kt-danger-text',
                    onClick: (event) => {
                      event.stopPropagation();
                      api.store.unplaceCard(card.id);
                    },
                  },
                  t('cl.unplace'),
                ),
              ),
            )
          : null,
      );
    }

    function ClassifyStage(props) {
      const { store, state, t, showNotice } = props;
      const index = indexData(state);
      const expanded = new Set(state.ui.expanded);
      const board = computeBoard(index, state.cards, expanded);
      const total = state.cards.length;
      const counts = { pending: 0, roots: 0, filed: 0 };
      state.cards.forEach((card) => {
        if (card.placed !== true) counts.pending += 1;
        else if (index.primaryParentOf.has(card.id)) counts.filed += 1;
        else counts.roots += 1;
      });

      const [dragId, setDragId] = React.useState(null);
      const [overId, setOverId] = React.useState(null);
      const [overShift, setOverShift] = React.useState(false);
      const [rootOver, setRootOver] = React.useState(false);
      const [fileOverId, setFileOverId] = React.useState(null);
      const [attachFor, setAttachFor] = React.useState(null);
      const [composerMode, setComposerMode] = React.useState(null);
      const [composerValue, setComposerValue] = React.useState('');
      const composerRef = React.useRef(null);
      const composingRef = React.useRef(false);
      const suppressRef = React.useRef(0);

      function beginDrag(event, id) {
        setDragId(id);
        try {
          event.dataTransfer.setData('text/plain', id);
          event.dataTransfer.effectAllowed = 'move';
        } catch (error) {
          /* ignore */
        }
      }

      function endDrag() {
        setDragId(null);
        setOverId(null);
        setOverShift(false);
        setRootOver(false);
        suppressRef.current = Date.now();
      }

      function dragOver(event, targetId) {
        if (dataTransferHasFiles(event.dataTransfer)) {
          event.preventDefault();
          event.stopPropagation();
          if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
          setOverId(null);
          setFileOverId(targetId);
          return;
        }
        if (dragId === null || dragId === targetId) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
        setRootOver(false);
        setOverId(targetId);
        setOverShift(event.shiftKey === true);
      }

      function drop(event, targetId) {
        if (dataTransferHasFiles(event.dataTransfer)) {
          event.preventDefault();
          event.stopPropagation();
          setFileOverId(null);
          applyImageFile(store, targetId, firstImageFile(event.dataTransfer), t, showNotice);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const id = dragId !== null ? dragId : event.dataTransfer.getData('text/plain');
        const secondary = event.shiftKey === true;
        endDrag();
        if (id === null || id === '' || id === targetId) return;
        const result = secondary ? store.addSecondary(id, targetId) : store.placeCard(id, targetId);
        if (result === 'cycle') showNotice(t('cl.cycle'), 'error');
      }

      function toggle(id) {
        if (Date.now() - suppressRef.current < 150) return;
        store.toggleExpand(id);
      }

      function setRoot(id) {
        const result = store.placeCard(id, null);
        if (result === 'cycle') showNotice(t('cl.cycle'), 'error');
      }

      function openComposer(mode) {
        if (composerMode === mode) {
          setComposerMode(null);
          setComposerValue('');
          return;
        }
        setComposerMode(mode);
        setComposerValue('');
      }

      function submitComposer() {
        if (composingRef.current) return;
        const value = composerValue.trim();
        if (value === '') return;
        if (composerMode === 'theme') {
          store.createTheme(value);
          setComposerMode(null);
        } else {
          store.addCard(value, '');
        }
        setComposerValue('');
        if (composerRef.current !== null) composerRef.current.focus();
      }

      const dragCard = dragId === null ? null : index.byId.get(dragId) || null;
      const overCard = overId === null ? null : index.byId.get(overId) || null;
      let preview = '';
      if (dragCard !== null) {
        if (rootOver) {
          preview = t('cl.dropRoot', { name: dragCard.title });
        } else if (overCard !== null) {
          preview = overShift
            ? t('cl.dropAssoc', { child: dragCard.title, parent: overCard.title })
            : t('cl.dropOn', { child: dragCard.title, parent: overCard.title });
        }
      }

      const api = {
        store,
        t,
        index,
        expanded,
        dragId,
        overId,
        setOverId,
        showNotice,
        fileOverId,
        setFileOver: setFileOverId,
        beginDrag,
        endDrag,
        dragOver,
        drop,
        toggle,
        setRoot,
        openAttach: (id, mode) => setAttachFor({ id, mode }),
      };

      const edges = [];
      board.pos.forEach((point, id) => {
        (index.primaryChildrenOf.get(id) || []).forEach((kid) => {
          const child = board.pos.get(kid.id);
          if (child === undefined) return;
          const x1 = point.x + CARD_W + PAD;
          const y1 = point.y + point.h / 2 + PAD;
          const x2 = child.x + PAD;
          const y2 = child.y + child.h / 2 + PAD;
          const mid = (x1 + x2) / 2;
          edges.push(
            h('path', {
              key: 'e-' + id + '-' + kid.id,
              d: 'M' + x1 + ' ' + y1 + ' C' + mid + ' ' + y1 + ', ' + mid + ' ' + y2 + ', ' + x2 + ' ' + y2,
              fill: 'none',
              stroke: 'color-mix(in srgb, var(--dsw-alias-label-secondary) 52%, transparent)',
              strokeWidth: 1.6,
            }),
          );
        });
        (index.secondaryChildrenOf.get(id) || []).forEach((kid) => {
          const child = board.pos.get(kid.id);
          if (child === undefined) return;
          const x1 = point.x + CARD_W + PAD;
          const y1 = point.y + point.h / 2 + PAD;
          const x2 = child.x + PAD;
          const y2 = child.y + child.h / 2 + PAD;
          edges.push(
            h('path', {
              key: 's-' + id + '-' + kid.id,
              d: 'M' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2,
              fill: 'none',
              stroke: 'var(--dsw-alias-brand-primary)',
              strokeOpacity: 0.55,
              strokeWidth: 1.1,
              strokeDasharray: '4 4',
            }),
          );
        });
      });

      const boardWidth = board.width + PAD * 2;
      const boardHeight = board.height + PAD * 2;
      const cards = state.cards
        .map((card) => {
          const point = board.pos.get(card.id);
          if (point === undefined) return null;
          return h(BoardCard, { key: card.id, card, point, api, t });
        })
        .filter(Boolean);

      const composer =
        composerMode === null
          ? null
          : h(
              'form',
              {
                className: 'kt-composer',
                onSubmit: (event) => {
                  event.preventDefault();
                  submitComposer();
                },
              },
              h('input', {
                ref: composerRef,
                className: 'kt-input',
                autoFocus: true,
                value: composerValue,
                placeholder:
                  composerMode === 'theme' ? t('cl.composerTheme') : t('cl.composerCard'),
                maxLength: MAX_TITLE,
                'aria-label': composerMode === 'theme' ? t('cl.composerTheme') : t('cl.composerCard'),
                onCompositionStart: () => {
                  composingRef.current = true;
                },
                onCompositionEnd: () => {
                  composingRef.current = false;
                },
                onChange: (event) => setComposerValue(event.target.value),
                onKeyDown: (event) => {
                  if (isImeEnter(event)) return;
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setComposerMode(null);
                    setComposerValue('');
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    submitComposer();
                  }
                },
              }),
              h(
                'button',
                {
                  type: 'submit',
                  className: 'kt-btn kt-btn-primary',
                  disabled: composerValue.trim() === '',
                },
                t('cl.composerCreate'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'kt-btn',
                  onClick: () => {
                    setComposerMode(null);
                    setComposerValue('');
                  },
                },
                t('cl.composerCancel'),
              ),
              h(
                'p',
                { className: 'kt-composer-hint' },
                composerMode === 'theme' ? t('cl.composerHint') : t('cl.composerCardHint'),
              ),
            );

      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'kt-board-head' },
          h('span', { className: 'kt-board-title' }, t('cl.title')),
          h(
            'div',
            { className: 'kt-summary' },
            h(
              'span',
              { className: 'kt-summary-item' },
              t('cl.summaryPending'),
              h('strong', null, String(counts.pending)),
            ),
            h(
              'span',
              { className: 'kt-summary-item' },
              t('cl.summaryRoots'),
              h('strong', null, String(counts.roots)),
            ),
            h(
              'span',
              { className: 'kt-summary-item' },
              t('cl.summaryFiled'),
              h('strong', null, String(counts.filed)),
            ),
          ),
          h(
            'div',
            { className: 'kt-board-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'kt-btn kt-btn-brand',
                'aria-expanded': composerMode === 'theme',
                onClick: () => openComposer('theme'),
              },
              h(Icon, { name: 'plus' }),
              t('cl.newTheme'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'kt-btn',
                'aria-expanded': composerMode === 'card',
                onClick: () => openComposer('card'),
              },
              h(Icon, { name: 'plus' }),
              t('cl.newCard'),
            ),
            counts.pending > 0
              ? h(
                  'button',
                  { type: 'button', className: 'kt-btn', onClick: () => store.settleRestIndependent() },
                  t('cl.settleRest'),
                )
              : null,
          ),
          composer,
          h(
            'div',
            {
              className: 'kt-dropzone' + (rootOver ? ' kt-dropzone-hot' : ''),
              onDragOver: (event) => {
                if (dragId === null) return;
                event.preventDefault();
                event.stopPropagation();
                if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
                setOverId(null);
                setRootOver(true);
              },
              onDragLeave: () => setRootOver(false),
              onDrop: (event) => {
                event.preventDefault();
                event.stopPropagation();
                const id = dragId !== null ? dragId : event.dataTransfer.getData('text/plain');
                endDrag();
                if (id === null || id === '') return;
                setRoot(id);
              },
            },
            rootOver ? t('cl.rootZoneActive') : t('cl.rootZone'),
          ),
          preview !== ''
            ? h('p', { className: 'kt-preview', role: 'status' }, preview)
            : h(
                'p',
                { className: 'kt-board-hint' },
                counts.pending === total && total > 0
                  ? t('cl.empty') + ' ' + t('cl.hintShift')
                  : t('cl.hint') + ' ' + t('cl.hintShift'),
              ),
        ),
        h(
          'div',
          {
            className: 'kt-board-scroll',
            'aria-label': t('a11y.board'),
            onDragOver: (event) => {
              if (dragId === null) return;
              event.preventDefault();
              if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
            },
            onDrop: (event) => {
              event.preventDefault();
              if (dataTransferHasFiles(event.dataTransfer)) return;
              const id = dragId !== null ? dragId : event.dataTransfer.getData('text/plain');
              endDrag();
              if (id === null || id === '') return;
              showNotice(t('cl.blankDrop'), 'info');
            },
          },
          h(
            'div',
            { className: 'kt-board', style: { width: boardWidth, height: boardHeight } },
            h(
              'svg',
              { className: 'kt-board-edges', width: boardWidth, height: boardHeight, 'aria-hidden': true },
              edges,
            ),
            board.hasGrid
              ? h(
                  'div',
                  {
                    className: 'kt-tray-zone',
                    style: {
                      left: PAD - 10,
                      top: board.gridTop + PAD - 26,
                      width: boardWidth - PAD * 2 + 20,
                      height: board.gridHeight + 33,
                    },
                  },
                )
              : null,
            board.hasGrid
              ? h(
                  'div',
                  {
                    className: 'kt-tray-label',
                    style: { left: PAD, top: board.gridTop + PAD - 26, width: boardWidth - PAD * 2 },
                    title: t('cl.gridHint'),
                  },
                  t('cl.gridLabel', { count: board.gridCount }),
                )
              : null,
            cards,
          ),
        ),
        attachFor !== null
          ? h(AttachDialog, {
              store,
              state,
              cardId: attachFor.id,
              mode: attachFor.mode,
              t,
              showNotice,
              onClose: () => setAttachFor(null),
            })
          : null,
      );
    }

    /* ------------------------------------------------------------------ */
    /* Stage 3 · Tree                                                      */
    /* ------------------------------------------------------------------ */

    function TreeNode(props) {
      const { card, index, store, t, collapsed, expanded, dragApi, trail, depth, showNotice } = props;
      const [editingTitle, setEditingTitle] = React.useState(false);
      const [editingContent, setEditingContent] = React.useState(false);
      const [addOpen, setAddOpen] = React.useState(false);
      const [confirming, setConfirming] = React.useState(false);
      const [over, setOver] = React.useState(false);
      const kids = index.primaryChildrenOf.get(card.id) || [];
      const refs = index.secondaryChildrenOf.get(card.id) || [];
      const otherParents = (index.parentsOf.get(card.id) || []).filter((link) => !link.primary);
      const hidden = collapsed.has(card.id);
      const open = expanded.has(card.id);
      const guarded = trail.has(card.id);

      const row = h(
        'div',
        {
          className:
            'kt-trow' +
            (over ? ' kt-trow-over' : '') +
            (dragApi.dragId === card.id ? ' kt-trow-dragging' : '') +
            (editingTitle || editingContent || addOpen ? ' kt-trow-editing' : ''),
          draggable: !editingTitle && !editingContent && !addOpen,
          role: 'treeitem',
          tabIndex: 0,
          'aria-level': depth + 1,
          'aria-expanded': kids.length > 0 ? !hidden : undefined,
          onDragStart: (event) => dragApi.begin(event, card.id),
          onDragEnd: dragApi.end,
          onDragOver: (event) => {
            if (dataTransferHasFiles(event.dataTransfer)) {
              event.preventDefault();
              event.stopPropagation();
              setOver(true);
              return;
            }
            if (dragApi.dragId === null || dragApi.dragId === card.id) return;
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
            setOver(true);
          },
          onDragLeave: () => setOver(false),
          onDrop: (event) => {
            event.preventDefault();
            event.stopPropagation();
            setOver(false);
            if (dataTransferHasFiles(event.dataTransfer)) {
              applyImageFile(store, card.id, firstImageFile(event.dataTransfer), t, showNotice);
              return;
            }
            dragApi.drop(event, card.id);
          },
        },
        h(
          'button',
          {
            type: 'button',
            className: 'kt-mini-btn',
            'aria-label': hidden ? t('tr.expandChildren') : t('tr.collapseChildren'),
            title: hidden ? t('tr.expandChildren') : t('tr.collapseChildren'),
            disabled: kids.length === 0,
            onClick: (event) => {
              event.stopPropagation();
              store.toggleCollapse(card.id);
            },
            tabIndex: -1,
          },
          kids.length === 0 ? '·' : hidden ? '▸' : '▾',
        ),
        h(
          'div',
          { className: 'kt-trow-main' },
          editingTitle
          ? h('input', {
              className: 'kt-input',
              defaultValue: card.title,
              autoFocus: true,
              maxLength: MAX_TITLE,
              'aria-label': t('tr.edit'),
              onBlur: (event) => {
                store.updateCard(card.id, { title: event.target.value });
                setEditingTitle(false);
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  store.updateCard(card.id, { title: event.currentTarget.value });
                  setEditingTitle(false);
                } else if (event.key === 'Escape') {
                  setEditingTitle(false);
                }
              },
            })
          : h(
              'span',
              {
                className: 'kt-trow-title',
                title:
                  card.content === '' ? card.title : card.title + ' · ' + t('card.expand'),
                onClick: () => store.toggleExpand(card.id),
                onDoubleClick: () => setEditingTitle(true),
              },
              card.title,
            ),
          card.content !== ''
            ? h(
                'span',
                { className: 'kt-note-mark', title: t('tr.content') },
                h(Icon, { name: 'note', size: 11 }),
              )
            : null,
          otherParents.length > 0
            ? h(
                'span',
                { className: 'kt-badge kt-badge-brand', title: t('cl.refsBadge', { count: otherParents.length }) },
                t('cl.refsBadge', { count: otherParents.length }),
              )
            : null,
          hidden && kids.length > 0
            ? h('span', { className: 'kt-badge' }, t('tr.collapsedCount', { count: kids.length }))
            : null,
        ),
        h(
          'div',
          { className: 'kt-trow-actions' },
          h(
            'button',
            { type: 'button', className: 'kt-mini-btn', title: t('tr.moveUp'), 'aria-label': t('tr.moveUp'), onClick: () => store.moveSibling(card.id, -1) },
            h(Icon, { name: 'up', size: 12 }),
          ),
          h(
            'button',
            { type: 'button', className: 'kt-mini-btn', title: t('tr.moveDown'), 'aria-label': t('tr.moveDown'), onClick: () => store.moveSibling(card.id, 1) },
            h(Icon, { name: 'down', size: 12 }),
          ),
          h(
            'button',
            { type: 'button', className: 'kt-mini-btn', title: t('tr.addChild'), 'aria-label': t('tr.addChild'), onClick: () => setAddOpen(true) },
            h(Icon, { name: 'plus', size: 12 }),
          ),
          h(
            'button',
            { type: 'button', className: 'kt-mini-btn', title: t('tr.editContent'), 'aria-label': t('tr.editContent'), onClick: () => setEditingContent(true) },
            h(Icon, { name: 'note', size: 12 }),
          ),
          h(
            'button',
            { type: 'button', className: 'kt-mini-btn', title: t('tr.edit'), 'aria-label': t('tr.edit'), onClick: () => setEditingTitle(true) },
            h(Icon, { name: 'edit', size: 12 }),
          ),
          h(
            'button',
            { type: 'button', className: 'kt-mini-btn kt-mini-btn-danger', title: t('tr.delete'), 'aria-label': t('tr.delete'), onClick: () => setConfirming(true) },
            h(Icon, { name: 'trash', size: 12 }),
          ),
        ),
      );

      const extras = [];
      if (confirming) {
        extras.push(
          h(
            'div',
            { className: 'kt-confirm-row', key: 'confirm' },
            h('span', null, t('tr.deleteConfirm')),
            h('button', { type: 'button', className: 'kt-btn kt-btn-danger', onClick: () => store.removeCard(card.id) }, t('tr.confirm')),
            h('button', { type: 'button', className: 'kt-btn', onClick: () => setConfirming(false) }, t('tr.cancel')),
          ),
        );
      }
      if (open || editingContent) {
        extras.push(
          h(
            'div',
            { className: 'kt-content-panel', key: 'content' },
            editingContent
              ? h(
                  React.Fragment,
                  null,
                  h('textarea', {
                    className: 'kt-textarea',
                    defaultValue: card.content,
                    placeholder: t('tr.contentPlaceholder'),
                    maxLength: MAX_CONTENT,
                    autoFocus: true,
                    'aria-label': t('tr.content'),
                    onKeyDown: (event) => {
                      if (event.key === 'Escape') setEditingContent(false);
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                        store.updateCard(card.id, { content: event.currentTarget.value });
                        setEditingContent(false);
                      }
                    },
                  }),
                  h(
                    'div',
                    { className: 'kt-inline-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'kt-btn kt-btn-primary',
                        onClick: (event) => {
                          const area = event.currentTarget
                            .closest('.kt-content-panel')
                            .querySelector('textarea');
                          store.updateCard(card.id, { content: area === null ? '' : area.value });
                          setEditingContent(false);
                        },
                      },
                      t('btn.save'),
                    ),
                    h('button', { type: 'button', className: 'kt-btn', onClick: () => setEditingContent(false) }, t('btn.cancel')),
                  ),
                )
              : h(
                  React.Fragment,
                  null,
                  h(ImagePanel, { card, store, t, showNotice }),
                  h('p', { className: 'kt-affil' }, affiliationText(card, index, t)),
                  relatedTitles(card, index).length > 0
                    ? h(
                        'p',
                        { className: 'kt-affil' },
                        t('cl.related', { names: relatedTitles(card, index).join('、') }),
                      )
                    : null,
                  card.content === ''
                    ? h('p', { className: 'kt-content-text kt-content-placeholder' }, t('card.noContent'))
                    : h('p', { className: 'kt-content-text' }, card.content),
                  h(
                    'div',
                    { className: 'kt-inline-actions' },
                    h('button', { type: 'button', className: 'kt-text-btn', onClick: () => setEditingContent(true) }, t('tr.editContent')),
                  ),
                ),
          ),
        );
      }
      if (addOpen) {
        extras.push(
          h(
            'div',
            { className: 'kt-add-row-inline', key: 'add' },
            h('input', {
              className: 'kt-input',
              autoFocus: true,
              placeholder: t('tr.addChildPlaceholder'),
              maxLength: MAX_TITLE,
              'aria-label': t('tr.addChild'),
              onKeyDown: (event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  store.addChild(card.id, event.currentTarget.value);
                  setAddOpen(false);
                } else if (event.key === 'Escape') {
                  setAddOpen(false);
                }
              },
            }),
            h('button', { type: 'button', className: 'kt-btn', onClick: () => setAddOpen(false) }, t('btn.cancel')),
          ),
        );
      }

      const children = [];
      if (guarded) {
        children.push(h('div', { className: 'kt-ref', key: 'guard' }, '…'));
      } else if (!hidden) {
        kids.forEach((kid) => {
          children.push(
            h(TreeNode, {
              key: kid.id,
              card: kid,
              index,
              store,
              t,
              collapsed,
              expanded,
              dragApi,
              depth: depth + 1,
              trail: new Set(trail).add(card.id),
              showNotice,
            }),
          );
        });
        refs.forEach((ref) => {
          children.push(
            h(
              'div',
              { className: 'kt-ref', key: 'ref-' + ref.id },
              h(Icon, { name: 'link', size: 12 }),
              h('span', { className: 'kt-ref-text', title: ref.title }, ref.title),
              h('span', { className: 'kt-badge' }, t('cl.refTag')),
            ),
          );
        });
      }

      return h(
        'div',
        { className: 'kt-tnode' },
        row,
        extras,
        children.length > 0 ? h('div', { className: 'kt-tkids' }, children) : null,
      );
    }

    function TreeGraph(props) {
      const { index, collapsed, expanded, t, onToggle } = props;
      const COL = 190;
      const ROW = 42;
      const NODE_H = 30;
      const NODE_W = COL - 34;
      const pos = new Map();
      let cursor = 0;
      let maxDepth = 0;

      function walk(card, depth, trail) {
        if (pos.has(card.id) || trail.has(card.id)) return cursor * ROW;
        const kids = collapsed.has(card.id) ? [] : index.primaryChildrenOf.get(card.id) || [];
        let y;
        if (kids.length === 0) {
          y = cursor * ROW;
          cursor += 1;
        } else {
          const nextTrail = new Set(trail).add(card.id);
          const ys = kids.map((kid) => walk(kid, depth + 1, nextTrail));
          y = (ys[0] + ys[ys.length - 1]) / 2;
        }
        maxDepth = Math.max(maxDepth, depth);
        pos.set(card.id, { x: depth * COL, y, depth });
        return y;
      }

      index.roots.forEach((root) => walk(root, 0, new Set()));
      if (pos.size === 0) return h('p', { className: 'kt-empty' }, t('tr.empty'));

      const width = (maxDepth + 1) * COL + 20;
      const height = Math.max(cursor, 1) * ROW + 10;
      const edges = [];
      pos.forEach((point, id) => {
        if (collapsed.has(id)) return;
        (index.primaryChildrenOf.get(id) || []).forEach((kid) => {
          const child = pos.get(kid.id);
          if (child === undefined) return;
          const x1 = point.x + NODE_W;
          const y1 = point.y + NODE_H / 2;
          const x2 = child.x;
          const y2 = child.y + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          edges.push(
            h('path', {
              key: 'e-' + id + '-' + kid.id,
              d: 'M' + x1 + ' ' + y1 + ' C' + mid + ' ' + y1 + ', ' + mid + ' ' + y2 + ', ' + x2 + ' ' + y2,
              fill: 'none',
              stroke: 'var(--dsw-alias-border-l2)',
              strokeWidth: 1.2,
            }),
          );
        });
      });

      const nodes = [];
      pos.forEach((point, id) => {
        const card = index.byId.get(id);
        if (card === undefined) return;
        const kids = index.primaryChildrenOf.get(id) || [];
        const hidden = collapsed.has(id);
        nodes.push(
          h(
            'div',
            {
              key: 'n-' + id,
              className: 'kt-graph-node' + (point.depth === 0 ? ' kt-graph-root' : ''),
              style: { left: point.x, top: point.y, width: NODE_W },
              title: card.content === '' ? card.title : card.title + '\n' + card.content,
              role: 'treeitem',
              'aria-level': point.depth + 1,
              'aria-expanded': kids.length > 0 ? !hidden : undefined,
              onClick: () => {
                if (kids.length > 0) onToggle(id);
              },
            },
            h('span', { className: 'kt-graph-text' }, card.title),
            hidden && kids.length > 0 ? h('span', { className: 'kt-graph-more' }, '+' + kids.length) : null,
          ),
        );
      });

      return h(
        'div',
        { className: 'kt-graph-scroll' },
        h(
          'div',
          { className: 'kt-graph', style: { width, height } },
          h('svg', { className: 'kt-graph-edges', width, height, 'aria-hidden': true }, edges),
          nodes,
        ),
      );
    }

    function TreeStage(props) {
      const { store, state, t, showNotice } = props;
      const index = indexData(state);
      const collapsed = new Set(state.ui.collapsed);
      const expanded = new Set(state.ui.expanded);
      const cycles = detectCycles(state.cards, index);
      const multi = [];
      index.parentsOf.forEach((links, childId) => {
        if (links.length > 1) {
          const card = index.byId.get(childId);
          if (card !== undefined) multi.push({ card, links });
        }
      });
      const wide = [];
      index.primaryChildrenOf.forEach((kids, parentId) => {
        if (kids.length > WIDE_LIMIT) {
          const card = index.byId.get(parentId);
          if (card !== undefined) wide.push({ card, count: kids.length });
        }
      });
      const roots = index.roots;
      const healthy = cycles.length === 0;

      const [dragId, setDragId] = React.useState(null);

      const dragApi = {
        dragId,
        begin(event, id) {
          setDragId(id);
          try {
            event.dataTransfer.setData('text/plain', id);
            event.dataTransfer.effectAllowed = 'move';
          } catch (error) {
            /* ignore */
          }
        },
        end() {
          setDragId(null);
        },
        drop(event, targetId) {
          const id = dragId !== null ? dragId : event.dataTransfer.getData('text/plain');
          const secondary = event.shiftKey === true;
          setDragId(null);
          if (id === null || id === '' || id === targetId) return;
          const result = secondary ? store.addSecondary(id, targetId) : store.placeCard(id, targetId);
          if (result === 'cycle') showNotice(t('cl.cycle'), 'error');
        },
      };

      const chips = [];
      if (healthy) {
        chips.push(
          h('span', { className: 'kt-chip kt-chip-ok', key: 'ok' }, h(Icon, { name: 'check', size: 12 }), t('tr.health.ok')),
        );
      } else {
        chips.push(h('span', { className: 'kt-chip kt-chip-warn', key: 'cy' }, t('tr.health.cycle', { count: cycles.length })));
      }
      if (multi.length > 0)
        chips.push(h('span', { className: 'kt-chip kt-chip-info', key: 'mp' }, t('tr.health.assoc', { count: multi.length })));
      if (roots.length > 1)
        chips.push(h('span', { className: 'kt-chip kt-chip-info', key: 'roots' }, t('tr.health.roots', { count: roots.length })));
      if (wide.length > 0)
        chips.push(h('span', { className: 'kt-chip kt-chip-info', key: 'wide' }, t('tr.health.wide', { count: wide.length })));

      const issues = [];
      if (cycles.length > 0) {
        cycles.forEach((cycle, cycleIndex) => {
          const names = cycle.map((id) => {
            const card = index.byId.get(id);
            return card === undefined ? '?' : card.title;
          });
          issues.push(
            h(
              'div',
              { className: 'kt-issue', key: 'cycle-' + cycleIndex },
              h('span', { className: 'kt-issue-text' }, t('tr.cycle', { path: names.join(' → ') + ' → ' + names[0] })),
              h(
                'button',
                {
                  type: 'button',
                  className: 'kt-btn kt-btn-danger',
                  onClick: () => {
                    const link = state.links.find(
                      (item) => item.primary && item.childId === cycle[0] && item.parentId === cycle[1],
                    );
                    if (link !== undefined) store.removeLink(link.id);
                  },
                },
                t('tr.break'),
              ),
            ),
          );
        });
      }

      const assocPanel =
        multi.length === 0
          ? null
          : h(
              'div',
              { className: 'kt-assoc-panel' },
              h('p', { className: 'kt-panel-title' }, t('tr.assocTitle', { count: multi.length })),
              h('p', { className: 'kt-issue-text' }, t('cl.refNote')),
              multi.map((entry) =>
                h(
                  'div',
                  { className: 'kt-issue', key: 'multi-' + entry.card.id },
                  h(
                    'span',
                    { className: 'kt-issue-text' },
                    t('tr.assoc', { name: entry.card.title, count: entry.links.length - 1 }),
                  ),
                  h(
                    'div',
                    { className: 'kt-parents' },
                    entry.links.map((link) => {
                      const parent = index.byId.get(link.parentId);
                      return h(
                        'div',
                        { className: 'kt-parent-row', key: link.id },
                        h(
                          'span',
                          { className: 'kt-parent-name', title: parent === undefined ? '' : parent.title },
                          parent === undefined ? '?' : parent.title,
                        ),
                        link.primary
                          ? h('span', { className: 'kt-badge' }, t('tr.primary'))
                          : h(
                              React.Fragment,
                              null,
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'kt-text-btn',
                                  onClick: () => {
                                    const result = store.promoteLink(link.id);
                                    if (result === 'cycle') showNotice(t('cl.cycle'), 'error');
                                  },
                                },
                                t('tr.setPrimary'),
                              ),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'kt-text-btn kt-danger-text',
                                  onClick: () => store.removeLink(link.id),
                                },
                                t('tr.removeSecondary'),
                              ),
                            ),
                      );
                    }),
                  ),
                ),
              ),
            );

      const hints = [];
      if (roots.length > 1) hints.push(h('p', { key: 'roots', className: 'kt-rail-hint' }, t('tr.rootsHint')));
      wide.forEach((entry) => {
        hints.push(
          h('p', { key: 'wide-' + entry.card.id, className: 'kt-rail-hint' }, t('tr.wideHint', { name: entry.card.title, count: entry.count })),
        );
      });

      const view =
        state.ui.view === 'graph'
          ? h(TreeGraph, { index, collapsed, expanded, t, onToggle: (id) => store.toggleCollapse(id) })
          : roots.length === 0
            ? h('p', { className: 'kt-empty' }, t('tr.empty'))
            : h(
                'div',
                { className: 'kt-tree', role: 'tree', 'aria-label': t('a11y.tree') },
                roots.map((root) =>
                  h(TreeNode, {
                    key: root.id,
                    card: root,
                    index,
                    store,
                    t,
                    collapsed,
                    expanded,
                    dragApi,
                    depth: 0,
                    trail: new Set(),
                    showNotice,
                  }),
                ),
              );

      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'kt-toolbar' },
          h('div', { className: 'kt-health' }, chips),
          h(
            'div',
            { className: 'kt-toolbar-right' },
            h(
              'div',
              { className: 'kt-seg', role: 'tablist' },
              h(
                'button',
                {
                  type: 'button',
                  role: 'tab',
                  'aria-selected': state.ui.view === 'indent',
                  className: 'kt-seg-btn' + (state.ui.view === 'indent' ? ' kt-seg-btn-active' : ''),
                  onClick: () => store.setView('indent'),
                },
                t('tr.view.indent'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  role: 'tab',
                  'aria-selected': state.ui.view === 'graph',
                  className: 'kt-seg-btn' + (state.ui.view === 'graph' ? ' kt-seg-btn-active' : ''),
                  onClick: () => store.setView('graph'),
                },
                t('tr.view.graph'),
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'kt-btn',
                onClick: () => {
                  state.cards.forEach((card) => {
                    if (state.ui.collapsed.indexOf(card.id) >= 0) store.toggleCollapse(card.id);
                  });
                },
              },
              t('tr.expandAll'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'kt-btn',
                onClick: () => {
                  state.cards.forEach((card) => {
                    const kids = index.primaryChildrenOf.get(card.id) || [];
                    if (kids.length > 0 && state.ui.collapsed.indexOf(card.id) < 0) {
                      store.toggleCollapse(card.id);
                    }
                  });
                },
              },
              t('tr.collapseAll'),
            ),
            h(
              'span',
              { className: 'kt-save' + (state.storageError ? ' kt-save-bad' : '') },
              state.storageError
                ? t('tr.saveFailed')
                : state.savedAt !== null
                  ? t('tr.saveSaved', { time: formatClock(state.savedAt) })
                  : t('tr.saveAuto'),
            ),
          ),
        ),
        issues.length > 0 ? h('div', { className: 'kt-issues' }, issues) : null,
        assocPanel,
        hints.length > 0 ? h('div', { className: 'kt-hint-box' }, hints) : null,
        h(
          'p',
          { className: 'kt-export-note' },
          t('tr.exportable') +
            ' · ' +
            t('tr.exportNote', { cards: state.cards.length, links: state.links.length }) +
            (hasImages(state)
              ? ' ' +
                t('tr.exportImages', {
                  count: state.cards.filter((card) => card.image !== null && card.image !== undefined).length,
                })
              : ''),
        ),
        h(
          'div',
          { className: 'kt-view' },
          h(
            'div',
            { className: 'kt-doc-head' },
            h('label', { className: 'kt-field-label', htmlFor: 'kt-tree-name' }, t('tr.titleLabel')),
            h('input', {
              id: 'kt-tree-name',
              className: 'kt-tree-title',
              value: state.title,
              placeholder: t('tr.titlePlaceholder'),
              maxLength: 60,
              'aria-label': t('tr.titleLabel'),
              onChange: (event) => store.setTitle(event.target.value),
            }),
            h('p', { className: 'kt-field-hint' }, t('tr.titleHint')),
            h('p', { className: 'kt-field-hint' }, t('tr.docNote', { count: roots.length })),
          ),
          state.ui.view === 'graph' ? h('p', { className: 'kt-graph-hint' }, t('tr.graphHint')) : null,
          view,
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Page                                                               */
    /* ------------------------------------------------------------------ */

    function KnowledgePage(props) {
      const { store, t, locale } = props;
      const state = useStoreState(store);
      useLocaleRevision(locale);
      const [helpOpen, setHelpOpen] = React.useState(false);
      const [notice, showNotice] = useTransientNotice();
      const fileRef = React.useRef(null);

      React.useEffect(() => {
        function onPaste(event) {
          const target = event.target;
          if (
            target !== null &&
            target !== undefined &&
            typeof target.closest === 'function' &&
            target.closest('input, textarea, [contenteditable="true"]') !== null
          ) {
            return;
          }
          const datatype = event.clipboardData;
          if (datatype === null || datatype === undefined) return;
          const file = firstImageFile(datatype);
          if (file === null) return;
          const expandedIds = state.ui.expanded.filter((id) =>
            state.cards.some((card) => card.id === id),
          );
          if (expandedIds.length !== 1) {
            showNotice(t('image.pickOne'), 'info');
            return;
          }
          event.preventDefault();
          applyImageFile(store, expandedIds[0], file, t, showNotice);
        }
        document.addEventListener('paste', onPaste);
        return () => document.removeEventListener('paste', onPaste);
      }, [state.ui.expanded, state.cards, store, t, showNotice]);

      const currentStage = STAGES.indexOf(state.stage);
      const index = indexData(state);
      const unsettled = state.cards.filter((card) => card.placed !== true).length;
      const canNext =
        currentStage === 0 ? state.cards.length >= 2 : currentStage === 1 ? unsettled === 0 : false;

      function exportFile(kind) {
        const title = titleOf(state, t);
        const safe = title.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) || 'knowledge-tree';
        let content = '';
        let name = '';
        let type = 'text/plain;charset=utf-8';
        if (kind === 'markdown') {
          content = buildMarkdown(state, index, t);
          name = safe + '.md';
          type = 'text/markdown;charset=utf-8';
        } else if (kind === 'mermaid') {
          content = buildMermaid(state, index, t);
          name = safe + '.mmd';
        } else if (kind === 'html') {
          content = buildHtml(state, index, t);
          name = safe + '.html';
          type = 'text/html;charset=utf-8';
        } else if (kind === 'json') {
          content = buildJson(state);
          name = safe + '.json';
          type = 'application/json;charset=utf-8';
        }
        if (kind === 'zip') {
          const blob = buildZipBlob(state, index, t);
          if (downloadBlob(safe + '.zip', blob)) showNotice(t('notice.exported'));
          else showNotice(t('notice.exportFailed'), 'error');
          return;
        }
        if (downloadText(name, content, type)) {
          showNotice(t('notice.exported'));
        } else {
          copyText(content).then((ok) => {
            showNotice(ok ? t('notice.exportFailed') : t('notice.copyFailed'), ok ? 'ok' : 'error');
          });
        }
      }

      function copyOutline() {
        copyText(buildOutline(state, index)).then((ok) => {
          showNotice(ok ? t('notice.copied') : t('notice.copyFailed'), ok ? 'ok' : 'error');
        });
      }

      function copyMarkdown() {
        copyText(buildMarkdown(state, index, t)).then((ok) => {
          showNotice(ok ? t('notice.copied') : t('notice.copyFailed'), ok ? 'ok' : 'error');
        });
      }

      function pickImport() {
        if (fileRef.current !== null) fileRef.current.click();
      }

      function importFile(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          let parsed = null;
          try {
            parsed = JSON.parse(String(reader.result));
          } catch (error) {
            parsed = null;
          }
          const added = parsed === null ? null : store.importBundle(parsed);
          if (added === null) showNotice(t('notice.importFailed'), 'error');
          else showNotice(t('notice.imported', { count: added }));
        };
        reader.onerror = () => showNotice(t('notice.importFailed'), 'error');
        reader.readAsText(file);
      }

      const actions = h(
        'div',
        { className: 'kt-head-actions' },
        state.stage === 'tree'
          ? h(
              'button',
              { type: 'button', className: 'kt-icon-btn', title: t('actions.copyMd'), 'aria-label': t('actions.copyMd'), onClick: copyMarkdown },
              h(Icon, { name: 'copy' }),
            )
          : null,
        state.stage === 'tree'
          ? h(ExportMenu, {
              t,
              hasImages: hasImages(state),
              actions: {
                markdown: () => exportFile('markdown'),
                html: () => exportFile('html'),
                zip: () => exportFile('zip'),
                mermaid: () => exportFile('mermaid'),
                json: () => exportFile('json'),
                text: copyOutline,
                import: pickImport,
              },
            })
          : null,
        h(
          'button',
          { type: 'button', className: 'kt-icon-btn', title: t('actions.help'), 'aria-label': t('actions.help'), onClick: () => setHelpOpen(true) },
          h(Icon, { name: 'help' }),
        ),
      );

      let body = null;
      if (state.stage === 'brainstorm') {
        body = h(BrainstormStage, { store, state, t, showNotice });
      } else if (state.stage === 'classify') {
        body = h(ClassifyStage, { store, state, t, showNotice });
      } else {
        body = h(TreeStage, { store, state, t, showNotice });
      }

      return h(
        React.Fragment,
        null,
        h('style', { key: 'styles' }, CSS),
        h(
          'div',
          { key: 'page', className: 'kt-page', style: { position: 'relative' } },
          h(
            'div',
            { className: 'kt-head' },
            h(
              'div',
              { className: 'kt-titles' },
              h('h1', null, t('page.title')),
              h('p', { className: 'kt-sub' }, t('page.subtitle')),
            ),
            actions,
            h(StageBar, {
              stage: state.stage,
              t,
              canNext,
              undo: () => store.undo(),
              canUndo: state.undoable,
              backLabel:
                state.stage === 'tree'
                  ? t('stage.backToClassify')
                  : state.stage === 'classify'
                    ? t('stage.backToList')
                    : '',
              onBack: () => store.goStage(STAGES[currentStage - 1]),
              onNext: () => store.goStage(STAGES[currentStage + 1]),
            }),
          ),
          state.broken ? h('p', { className: 'kt-warn' }, t('notice.broken')) : null,
          state.storageError ? h('p', { className: 'kt-warn' }, t('notice.storageUnavailable')) : null,
          h('div', { className: 'kt-body' }, body),
          h(
            'div',
            { className: 'kt-footer' },
            h('span', null, t('page.foot')),
            h(
              'span',
              { className: 'kt-save' + (state.storageError ? ' kt-save-bad' : '') },
              state.storageError
                ? t('tr.saveFailed')
                : state.savedAt !== null
                  ? t('tr.saveSaved', { time: formatClock(state.savedAt) })
                  : t('tr.saveAuto'),
            ),
          ),
          notice !== null
            ? h('div', { className: 'kt-notice kt-notice-' + notice.kind, role: 'status' }, notice.text)
            : null,
          helpOpen ? h(HelpDialog, { t, onClose: () => setHelpOpen(false) }) : null,
          h('input', {
            key: 'file',
            ref: fileRef,
            className: 'kt-file',
            type: 'file',
            accept: 'application/json,.json',
            onChange: importFile,
            tabIndex: -1,
            'aria-hidden': true,
          }),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Plugin                                                             */
    /* ------------------------------------------------------------------ */

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, 'en', DICT.en), 'knowledge-tree: English dictionary');
      ctx.effect(() => ctx.locale.register(NS, 'zh', DICT.zh), 'knowledge-tree: Chinese dictionary');
      const translate = ctx.locale.bind(NS);
      const locale = ctx.locale;
      const store = createStore();

      function KnowledgeIcon(props) {
        return h(PanelGlyph, { size: props.size });
      }

      function KnowledgePanel() {
        return h(KnowledgePage, { store, t: translate, locale });
      }

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 40,
            label: () => translate('panel.label'),
          },
          KnowledgeIcon,
        ),
      );

      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID }, KnowledgePanel),
      );
    }

    return { inject: ['slots', 'locale'], apply };
  },
});
