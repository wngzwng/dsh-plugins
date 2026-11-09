/**
 * Full management panel — generated/embedded fragment (owner: panel-ui).
 *
 * Plain script in the client factory scope: no module syntax. `FullPanel` is the
 * `main` slot page. Everything the fragment renders is data-driven through the
 * shared store (see client.js/DESIGN.md §4) and the pure core helpers (§3):
 * list selection/filtering/sorting come from `selectPrompts`, tag ordering from
 * `sortTags`, rating validity from `isScoreValid`/`isScoreStale`, AI review
 * staleness from `isAiReviewStale`, imports from `parseCsv`/`planJsonImport`.
 *
 * The panel never writes storage directly and never persists anything by
 * itself; it only calls store mutations and shows their results.
 */

const FULL_PANEL_DICT = {
  zh: {
    'full.header.subtitle': '本地保存 · 评分 · AI 辅助评价',
    'full.aria.nav': '导航与筛选',
    'full.aria.list': '提示词列表',
    'full.aria.detail': '提示词详情',
    'full.aria.exportMenu': '导出菜单',
    'full.nav.title': '导航',
    'full.nav.all': '全部提示词',
    'full.nav.favorites': '收藏',
    'full.nav.recent': '最近使用',
    'full.nav.quality': '质量筛选',
    'full.nav.rated4': '4 星及以上',
    'full.nav.rated3': '3 星及以上',
    'full.nav.unrated': '未评分',
    'full.nav.stale': '待复评',
    'full.nav.tags': '标签',
    'full.nav.noTags': '还没有标签',
    'full.nav.storageFoot': '数据保存在当前浏览器的 localStorage；清理站点数据、换浏览器或换设备前请先导出 JSON 备份。',
    'full.nav.manageTags': '管理标签',
    'full.nav.tagOption': '{name}（{count}）',
    'full.nav.tagAria': '按标签筛选：{name}',
    'full.nav.clearTag': '全部标签',
    'full.search.placeholder': '搜索标题、正文或标签',
    'full.list.new': '新建提示词',
    'full.list.count': '{count} 条',
    'full.list.clearFilters': '清除筛选',
    'full.list.snippetEmpty': '（无正文摘要）',
    'full.list.pinnedMark': '已置顶',
    'full.list.favoriteMark': '已收藏',
    'full.list.noResults.title': '没有匹配的提示词',
    'full.list.noResults.body': '当前搜索或筛选条件下没有结果，可以清除筛选后再试。',
    'full.list.noSelection': '从列表中选择提示词查看详情',
    'full.sort.label': '排序',
    'full.sort.default': '默认（置顶优先，最近更新）',
    'full.sort.updated': '最近更新',
    'full.sort.recent': '最近使用',
    'full.sort.ratingDesc': '评分从高到低',
    'full.sort.ratingAsc': '评分从低到高',
    'full.sortRule.default': '排序规则：置顶优先 → 最近更新时间倒序。',
    'full.sortRule.updated': '排序规则：最近更新时间倒序（置顶不插队）。',
    'full.sortRule.recent': '排序规则：最近使用时间倒序，无使用记录排最后。',
    'full.sortRule.ratingDesc': '排序规则：有效评分从高到低；有效评分优先，未评分与待复评一律排在有效评分之后；同分时置顶优先，再按更新时间倒序。',
    'full.sortRule.ratingAsc': '排序规则：有效评分从低到高；有效评分优先，未评分与待复评一律排在有效评分之后；同分时置顶优先，再按更新时间倒序。',
    'full.welcome.title': '欢迎使用提示库',
    'full.welcome.body': '集中保存、搜索、评分和复用提示词。新建第一条提示词，或从 CSV / JSON 导入现有内容。',
    'full.welcome.local': '数据只保存在本机浏览器 localStorage，不会上传；建议定期使用“导出 → JSON 完整备份”备份。',
    'full.welcome.new': '新建提示词',
    'full.welcome.import': '导入提示词',
    'full.backToList': '返回列表',
    'full.detail.created': '创建于 {value}',
    'full.detail.updated': '更新于 {value}',
    'full.detail.lastUsed': '最近使用：{value}',
    'full.detail.neverUsed': '尚未使用',
    'full.detail.bodyTitle': '正文',
    'full.detail.usageTitle': '使用场景 / 预期效果',
    'full.detail.tagsTitle': '标签',
    'full.detail.noTags': '无标签',
    'full.detail.edit': '编辑',
    'full.detail.copy': '复制正文',
    'full.detail.favorite': '收藏',
    'full.detail.unfavorite': '取消收藏',
    'full.detail.pin': '置顶',
    'full.detail.unpin': '取消置顶',
    'full.detail.share': '分享',
    'full.detail.delete': '删除',
    'full.detail.missing': '提示词不存在或已被删除',
    'full.detail.rateAfterUse': '给这条提示词评分',
    'full.detail.rateAfterUseHint': '刚复制过正文，记录你的使用体验（可选）',
    'full.detail.rateLater': '稍后',
    'full.detail.aiReviewTitle': 'AI 辅助评价',
    'full.rating.title': '个人评分',
    'full.rating.hint': '1~5 星，支持半星与清除；只有正文变化才需要重新评分。',
    'full.rating.personal': '个人评分反映你自己的实际使用体验，不代表提示词在所有模型和任务中都有效。',
    'full.rating.noteLabel': '个人评价备注',
    'full.rating.notePlaceholder': '记录你的使用体验（可选，不影响正文）',
    'full.rating.noteAria': '个人评价备注',
    'full.rating.saveNote': '保存备注',
    'full.rating.noteSaved': '备注已保存',
    'full.rating.noteSaveFailed': '备注保存失败：{message}',
    'full.rating.referenceTitle': '评分参考',
    'full.rating.ref5': '5 星：效果稳定，可直接复用',
    'full.rating.ref4': '4 星：效果好，偶有可调之处',
    'full.rating.ref3': '3 星：一般，需要较多修改',
    'full.rating.ref2': '2 星：效果不佳',
    'full.rating.ref1': '1 星：基本不可用',
    'full.rating.explain': '评分与正文版本关联；修改正文后旧评分保留但标记为“待复评”，可确认沿用或重新评分。',
    'full.rating.staleHint': '正文已修改，旧评分不再参与排序与筛选。',
    'full.rating.keep': '沿用原评分',
    'full.rating.current': '当前评分',
    'full.rating.old': '原评分（已失效）',
    'full.edit.titleNew': '新建提示词',
    'full.edit.titleEdit': '编辑提示词',
    'full.edit.titleLabel': '标题',
    'full.edit.titlePlaceholder': '例如：产品需求评审',
    'full.edit.bodyLabel': '正文',
    'full.edit.bodyPlaceholder': '粘贴或编写提示词正文，换行会被保留',
    'full.edit.usageLabel': '使用场景 / 预期效果（可选）',
    'full.edit.usagePlaceholder': '描述使用场景、目标或预期效果',
    'full.edit.tagsLabel': '标签',
    'full.edit.noTags': '还没有标签，可在下方新建',
    'full.edit.newTagPlaceholder': '新标签名称',
    'full.edit.addTag': '新建标签',
    'full.edit.discardTitle': '放弃未保存的修改？',
    'full.edit.discardMessage': '当前编辑内容尚未保存，关闭后将丢失这些修改。',
    'full.edit.discardConfirm': '放弃修改',
    'full.edit.discardCancel': '继续编辑',
    'full.edit.saveError': '保存失败：{message}',
    'full.notice.aiNotAttached': '内容已保存。AI 评价针对修改前的内容，未关联到保存后的提示词；请重新生成评价。',
    'full.tags.title': '管理标签',
    'full.tags.hint': '标签顺序会同时影响导航与编辑器中的选择顺序。',
    'full.tags.empty': '还没有标签，可在下方新建。',
    'full.tags.usage': '用于 {count} 条提示词',
    'full.tags.newPlaceholder': '新标签名称',
    'full.tags.create': '新建标签',
    'full.tags.rename': '重命名',
    'full.tags.renameAria': '重命名标签：{name}',
    'full.tags.renameInputAria': '标签新名称',
    'full.tags.saveRename': '保存名称',
    'full.tags.moveUp': '上移',
    'full.tags.moveDown': '下移',
    'full.tags.moveUpAria': '上移标签：{name}',
    'full.tags.moveDownAria': '下移标签：{name}',
    'full.tags.delete': '删除',
    'full.tags.deleteAria': '删除标签：{name}',
    'full.tags.deleteTitle': '删除标签',
    'full.tags.deleteMessage': '将删除标签「{name}」。只会移除分类关系，不会删除任何提示词。确定删除？',
    'full.tags.deleteConfirm': '删除标签',
    'full.ai.title': 'AI 辅助评价',
    'full.ai.draftSectionTitle': 'AI 评价（当前草稿）',
    'full.ai.statusLoading': '正在检查 AI 评价服务…',
    'full.ai.unavailable': 'AI 评价不可用',
    'full.ai.unavailableHint': '本机未配置可用的模型，或插件 Host 半未启用。你仍可使用个人评分与备注。',
    'full.ai.statusReason': '原因：{code}',
    'full.ai.retry': '重试',
    'full.ai.modelInfo': '将使用 {provider} / {model}',
    'full.ai.sendNote': '将发送标题、正文和使用场景，可能产生模型费用；不会发送备注、评分或其他提示词。',
    'full.ai.generate': 'AI 评价',
    'full.ai.regenerate': '重新生成',
    'full.ai.generating': '正在生成 AI 评价…',
    'full.ai.empty': '还没有 AI 评价。',
    'full.ai.modelLine': '模型：{model} · 生成于 {time}',
    'full.ai.delete': '删除 AI 评价',
    'full.ai.deleteTitle': '删除 AI 评价',
    'full.ai.deleteMessage': '将删除这条提示词的 AI 评价，此操作不可恢复；个人评分与备注不受影响。确定删除？',
    'full.ai.deleteConfirm': '删除评价',
    'full.ai.errorPrefix': 'AI 评价失败：',
    'full.ai.inputChanged': '请求对应的内容已变化，评价未关联。',
    'full.ai.targetChanged': '提示词已变化或不存在，评价未关联。',
    'full.ai.emptyInput': '请先填写标题与正文',
    'full.ai.draftNote': '编辑页的 AI 评价先保存在草稿中；保存时若内容未变会自动关联到该提示词。',
    'full.aiErr.NO_SERVICE': '宿主未提供 AI 评价路由（插件 Host 半未启用）',
    'full.aiErr.NO_MODEL': '没有可用的模型配置',
    'full.aiErr.NO_LLM': '没有可用的模型配置',
    'full.aiErr.NETWORK': '网络请求失败',
    'full.aiErr.ABORTED': '请求已取消',
    'full.aiErr.BUSY': '当前评价请求过多，请稍后重试',
    'full.aiErr.MODEL_ERROR': '模型生成失败',
    'full.aiErr.TRUNCATED': '模型输出被截断',
    'full.aiErr.TIMEOUT': '请求超时',
    'full.aiErr.EMPTY_RESPONSE': '模型返回为空',
    'full.aiErr.TOO_LONG': '评价超过 200 字上限',
    'full.aiErr.INPUT_TOO_LARGE': '输入内容过长',
    'full.aiErr.INVALID_RESPONSE': '响应格式不正确',
    'full.aiErr.unknown': '未知错误',
    'full.tools.import': '导入',
    'full.tools.export': '导出',
    'full.tools.manageTags': '标签管理',
    'full.tools.exportJson': 'JSON 完整备份',
    'full.tools.exportCsv': '导出 CSV',
    'full.tools.exportTemplate': 'CSV 模板',
    'full.tools.exportJsonHint': '含标签、评分与 AI 评价版本关联，用于完整恢复',
    'full.tools.exportCsvHint': '仅用于交换，不含评分备注与 AI 评价',
    'full.tools.exportTemplateHint': '下载空 CSV 模板（仅表头）',
    'full.import.title': '导入提示词',
    'full.import.fileLabel': '选择文件',
    'full.import.fileAria': '选择 CSV 或 JSON 文件',
    'full.import.acceptHint': '支持 .csv 与 .json：CSV 用于交换，JSON 用于完整备份。',
    'full.import.reading': '正在读取文件…',
    'full.import.fileReadError': '读取文件失败：{message}',
    'full.import.csvPreviewTitle': 'CSV 导入预览',
    'full.import.jsonPreviewTitle': 'JSON 导入预览',
    'full.import.newCount': '新增 {count}',
    'full.import.duplicateCount': '重复跳过 {count}',
    'full.import.invalidCount': '无效 {count}',
    'full.import.tagsCount': '将新建标签 {count}',
    'full.import.invalidTitle': '无效原因（前 {count} 条）',
    'full.import.invalidLine': '第 {line} 行：{message}',
    'full.import.tagsToCreate': '将新建的标签：{names}',
    'full.import.mode': '导入方式',
    'full.import.merge': '合并',
    'full.import.mergeHint': '按提示词 id 去重，不覆盖现有数据',
    'full.import.replace': '替换',
    'full.import.replaceHint': '删除现有全部数据后导入，需二次确认',
    'full.import.replacedCount': '将替换现有 {count} 条提示词',
    'full.import.apply': '确认导入',
    'full.import.replaceTitle': '确认替换导入',
    'full.import.replaceMessage': '替换导入会先删除现有全部提示词与标签，此操作不可恢复。建议先导出 JSON 完整备份。确定继续？',
    'full.import.replaceConfirm': '删除现有数据并导入',
    'full.import.noPlan': '尚未读取到可导入的内容',
    'full.import.fieldTitle': '字段说明',
    'full.import.fieldCsv': 'CSV 列：title、body、tags、usage、rating、note；也接受中文表头（标题、正文、标签、使用场景、评分、评价备注）。',
    'full.import.fieldTags': '多标签用 JSON 数组编码，例如 ["写作","营销"]；正文与标签中的换行、引号按 RFC 4180 转义。',
    'full.import.fieldRating': '评分范围 1~5，支持 0.5 步进；留空表示未评分。CSV 导入的评分会先标记为“待复评”，因为无法恢复正文版本关联。',
    'full.import.fieldFormula': '导出时对以 = + - @ 开头的内容加前导单引号防止表格公式注入，导入时会自动还原；CSV 往返保留多行与引号。',
    'full.import.fieldRoundtrip': 'CSV 用于交换；JSON 用于完整备份，保留评分与 AI 评价的正文版本关联。',
    'full.share.title': '分享提示词',
    'full.share.hint': '分享内容只包含标题与正文，不包含个人评分备注或 AI 评价。',
    'full.share.copy': '复制正文',
    'full.share.downloadMd': '下载 .md',
    'full.share.downloadTxt': '下载 .txt',
    'full.share.copied': '已复制正文',
    'full.share.copyFailed': '复制失败，请检查浏览器剪贴板权限',
    'full.share.downloaded': '已开始下载',
    'full.storage.corrupt': '本地提示词数据已损坏。为保护原始数据，写入已暂停。可下载原始数据备份，或重置为空数据库。',
    'full.storage.downloadRaw': '下载原始数据',
    'full.storage.reset': '重置为空数据库',
    'full.storage.resetTitle': '重置为空数据库',
    'full.storage.resetMessage': '将放弃损坏的本地数据并重置为空数据库，此操作不可恢复。建议先下载原始数据备份。确定继续？',
    'full.storage.resetConfirm': '重置数据库',
    'full.storage.errorTitle': '本地存储不可用',
    'full.storage.errorBody': '当前浏览器不允许访问 localStorage，修改不会持久化，刷新页面后会丢失。请检查隐私设置，或导出 JSON 备份。',
    'full.delete.title': '删除提示词',
    'full.delete.message': '将永久删除「{title}」以及它的评分、备注和 AI 评价。此操作不可恢复，确定删除？',
    'full.delete.confirm': '永久删除',
  },
  en: {
    'full.header.subtitle': 'Local-first · ratings · AI-assisted review',
    'full.aria.nav': 'Navigation and filters',
    'full.aria.list': 'Prompt list',
    'full.aria.detail': 'Prompt details',
    'full.aria.exportMenu': 'Export menu',
    'full.nav.title': 'Navigate',
    'full.nav.all': 'All prompts',
    'full.nav.favorites': 'Favorites',
    'full.nav.recent': 'Recently used',
    'full.nav.quality': 'Quality filter',
    'full.nav.rated4': '4 stars and up',
    'full.nav.rated3': '3 stars and up',
    'full.nav.unrated': 'Unrated',
    'full.nav.stale': 'Needs re-rating',
    'full.nav.tags': 'Tags',
    'full.nav.noTags': 'No tags yet',
    'full.nav.storageFoot': 'Data lives in this browser\u2019s localStorage. Export a JSON backup before clearing site data, switching browsers or devices.',
    'full.nav.manageTags': 'Manage tags',
    'full.nav.tagOption': '{name} ({count})',
    'full.nav.tagAria': 'Filter by tag: {name}',
    'full.nav.clearTag': 'All tags',
    'full.search.placeholder': 'Search title, text or tags',
    'full.list.new': 'New prompt',
    'full.list.count': '{count}',
    'full.list.clearFilters': 'Clear filters',
    'full.list.snippetEmpty': '(no text excerpt)',
    'full.list.pinnedMark': 'Pinned',
    'full.list.favoriteMark': 'Favorite',
    'full.list.noResults.title': 'No matching prompts',
    'full.list.noResults.body': 'Nothing matches the current search or filters. Clear the filters and try again.',
    'full.list.noSelection': 'Select a prompt on the left to see its details',
    'full.sort.label': 'Sort',
    'full.sort.default': 'Default (pinned first, recently updated)',
    'full.sort.updated': 'Recently updated',
    'full.sort.recent': 'Recently used',
    'full.sort.ratingDesc': 'Rating high to low',
    'full.sort.ratingAsc': 'Rating low to high',
    'full.sortRule.default': 'Sort rule: pinned first, then most recently updated.',
    'full.sortRule.updated': 'Sort rule: most recently updated first (pinned does not jump the queue).',
    'full.sortRule.recent': 'Sort rule: most recently used first; unused prompts come last.',
    'full.sortRule.ratingDesc': 'Sort rule: effective rating high to low; effective ratings come first, unrated and stale-rating prompts always follow; ties break by pinned first, then most recently updated.',
    'full.sortRule.ratingAsc': 'Sort rule: effective rating low to high; effective ratings come first, unrated and stale-rating prompts always follow; ties break by pinned first, then most recently updated.',
    'full.welcome.title': 'Welcome to Prompt Library',
    'full.welcome.body': 'Save, search, rate and reuse prompts in one place. Create your first prompt or import existing content from CSV / JSON.',
    'full.welcome.local': 'Data stays in this browser\u2019s localStorage and is never uploaded. Export a JSON backup from time to time.',
    'full.welcome.new': 'New prompt',
    'full.welcome.import': 'Import prompts',
    'full.backToList': 'Back to list',
    'full.detail.created': 'Created {value}',
    'full.detail.updated': 'Updated {value}',
    'full.detail.lastUsed': 'Last used: {value}',
    'full.detail.neverUsed': 'Never used',
    'full.detail.bodyTitle': 'Prompt text',
    'full.detail.usageTitle': 'Use case / expected result',
    'full.detail.tagsTitle': 'Tags',
    'full.detail.noTags': 'No tags',
    'full.detail.edit': 'Edit',
    'full.detail.copy': 'Copy text',
    'full.detail.favorite': 'Favorite',
    'full.detail.unfavorite': 'Remove favorite',
    'full.detail.pin': 'Pin',
    'full.detail.unpin': 'Unpin',
    'full.detail.share': 'Share',
    'full.detail.delete': 'Delete',
    'full.detail.missing': 'This prompt no longer exists',
    'full.detail.rateAfterUse': 'Rate this prompt',
    'full.detail.rateAfterUseHint': 'You just copied the text. Rate your experience (optional).',
    'full.detail.rateLater': 'Later',
    'full.detail.aiReviewTitle': 'AI review',
    'full.rating.title': 'Personal rating',
    'full.rating.hint': '1 to 5 stars, half stars and clearing supported; only prompt text changes require a re-rating.',
    'full.rating.personal': 'A personal rating reflects your own experience; it does not mean the prompt works equally well on every model or task.',
    'full.rating.noteLabel': 'Personal note',
    'full.rating.notePlaceholder': 'Record how it worked for you (optional, separate from the prompt text)',
    'full.rating.noteAria': 'Personal note',
    'full.rating.saveNote': 'Save note',
    'full.rating.noteSaved': 'Note saved',
    'full.rating.noteSaveFailed': 'Saving the note failed: {message}',
    'full.rating.referenceTitle': 'Rating guide',
    'full.rating.ref5': '5 stars: consistently great, reuse as-is',
    'full.rating.ref4': '4 stars: good, minor tweaks',
    'full.rating.ref3': '3 stars: average, needs more work',
    'full.rating.ref2': '2 stars: weak results',
    'full.rating.ref1': '1 star: barely usable',
    'full.rating.explain': 'Ratings are tied to the prompt-text version. After a text change the old rating is kept but marked needs re-rating; keep it or rate again.',
    'full.rating.staleHint': 'The prompt text changed, so the old rating no longer counts for sorting or filtering.',
    'full.rating.keep': 'Keep old rating',
    'full.rating.current': 'Current rating',
    'full.rating.old': 'Old rating (no longer effective)',
    'full.edit.titleNew': 'New prompt',
    'full.edit.titleEdit': 'Edit prompt',
    'full.edit.titleLabel': 'Title',
    'full.edit.titlePlaceholder': 'e.g. Product requirements review',
    'full.edit.bodyLabel': 'Prompt text',
    'full.edit.bodyPlaceholder': 'Write or paste the prompt text; line breaks are preserved',
    'full.edit.usageLabel': 'Use case / expected result (optional)',
    'full.edit.usagePlaceholder': 'Describe the use case, goal or expected result',
    'full.edit.tagsLabel': 'Tags',
    'full.edit.noTags': 'No tags yet — create one below',
    'full.edit.newTagPlaceholder': 'New tag name',
    'full.edit.addTag': 'Create tag',
    'full.edit.discardTitle': 'Discard unsaved changes?',
    'full.edit.discardMessage': 'The current edits have not been saved; closing now loses them.',
    'full.edit.discardConfirm': 'Discard changes',
    'full.edit.discardCancel': 'Keep editing',
    'full.edit.saveError': 'Save failed: {message}',
    'full.notice.aiNotAttached': 'Saved. The AI review was for the previous content, so it was not attached; generate a new review if needed.',
    'full.tags.title': 'Manage tags',
    'full.tags.hint': 'Tag order affects both the navigation list and the tag picker in the editor.',
    'full.tags.empty': 'No tags yet — create one below.',
    'full.tags.usage': 'Used by {count} prompts',
    'full.tags.newPlaceholder': 'New tag name',
    'full.tags.create': 'Create tag',
    'full.tags.rename': 'Rename',
    'full.tags.renameAria': 'Rename tag: {name}',
    'full.tags.renameInputAria': 'New tag name',
    'full.tags.saveRename': 'Save name',
    'full.tags.moveUp': 'Move up',
    'full.tags.moveDown': 'Move down',
    'full.tags.moveUpAria': 'Move tag up: {name}',
    'full.tags.moveDownAria': 'Move tag down: {name}',
    'full.tags.delete': 'Delete',
    'full.tags.deleteAria': 'Delete tag: {name}',
    'full.tags.deleteTitle': 'Delete tag',
    'full.tags.deleteMessage': 'Delete the tag "{name}". This only removes the tag relation; no prompt is deleted. Continue?',
    'full.tags.deleteConfirm': 'Delete tag',
    'full.ai.title': 'AI review',
    'full.ai.draftSectionTitle': 'AI review (current draft)',
    'full.ai.statusLoading': 'Checking the AI review service…',
    'full.ai.unavailable': 'AI review is unavailable',
    'full.ai.unavailableHint': 'No usable model is configured, or the plugin host half is not active. You can still use personal ratings and notes.',
    'full.ai.statusReason': 'Reason: {code}',
    'full.ai.retry': 'Retry',
    'full.ai.modelInfo': 'Will use {provider} / {model}',
    'full.ai.sendNote': 'Sends the title, prompt text and use case; this may incur model usage costs. Notes, ratings and other prompts are never sent.',
    'full.ai.generate': 'AI review',
    'full.ai.regenerate': 'Regenerate',
    'full.ai.generating': 'Generating AI review…',
    'full.ai.empty': 'No AI review yet.',
    'full.ai.modelLine': 'Model: {model} · generated {time}',
    'full.ai.delete': 'Delete AI review',
    'full.ai.deleteTitle': 'Delete AI review',
    'full.ai.deleteMessage': 'This deletes the AI review for this prompt and cannot be undone; the personal rating and note are kept. Continue?',
    'full.ai.deleteConfirm': 'Delete review',
    'full.ai.errorPrefix': 'AI review failed: ',
    'full.ai.inputChanged': 'The content changed while reviewing, so the review was not attached.',
    'full.ai.targetChanged': 'The prompt changed or no longer exists, so the review was not attached.',
    'full.ai.emptyInput': 'Fill in the title and prompt text first',
    'full.ai.draftNote': 'AI reviews in the editor are kept in the draft; when saved with unchanged content they are attached automatically.',
    'full.aiErr.NO_SERVICE': 'the host does not expose the AI review route (plugin host half inactive)',
    'full.aiErr.NO_MODEL': 'no usable model is configured',
    'full.aiErr.NO_LLM': 'no usable model is configured',
    'full.aiErr.NETWORK': 'network request failed',
    'full.aiErr.ABORTED': 'request cancelled',
    'full.aiErr.BUSY': 'too many reviews in flight, try again later',
    'full.aiErr.MODEL_ERROR': 'the model failed to generate',
    'full.aiErr.TRUNCATED': 'the model output was truncated',
    'full.aiErr.TIMEOUT': 'request timed out',
    'full.aiErr.EMPTY_RESPONSE': 'the model returned nothing',
    'full.aiErr.TOO_LONG': 'the review exceeded the 200 character limit',
    'full.aiErr.INPUT_TOO_LARGE': 'the input is too large',
    'full.aiErr.INVALID_RESPONSE': 'the response format is invalid',
    'full.aiErr.unknown': 'unknown error',
    'full.tools.import': 'Import',
    'full.tools.export': 'Export',
    'full.tools.manageTags': 'Tags',
    'full.tools.exportJson': 'JSON full backup',
    'full.tools.exportCsv': 'Export CSV',
    'full.tools.exportTemplate': 'CSV template',
    'full.tools.exportJsonHint': 'Includes tags, ratings and AI review version links for a complete restore',
    'full.tools.exportCsvHint': 'For exchange only; no rating notes or AI reviews',
    'full.tools.exportTemplateHint': 'Download an empty CSV template (header only)',
    'full.import.title': 'Import prompts',
    'full.import.fileLabel': 'Choose a file',
    'full.import.fileAria': 'Choose a CSV or JSON file',
    'full.import.acceptHint': 'Supports .csv and .json: CSV for exchange, JSON for a complete backup.',
    'full.import.reading': 'Reading the file…',
    'full.import.fileReadError': 'Reading the file failed: {message}',
    'full.import.csvPreviewTitle': 'CSV import preview',
    'full.import.jsonPreviewTitle': 'JSON import preview',
    'full.import.newCount': '{count} new',
    'full.import.duplicateCount': '{count} duplicates skipped',
    'full.import.invalidCount': '{count} invalid',
    'full.import.tagsCount': '{count} tags to create',
    'full.import.invalidTitle': 'Invalid rows (first {count})',
    'full.import.invalidLine': 'Line {line}: {message}',
    'full.import.tagsToCreate': 'Tags to create: {names}',
    'full.import.mode': 'Import mode',
    'full.import.merge': 'Merge',
    'full.import.mergeHint': 'Deduplicate by prompt id; existing data is not overwritten',
    'full.import.replace': 'Replace',
    'full.import.replaceHint': 'Delete all current data first; requires confirmation',
    'full.import.replacedCount': '{count} current prompts will be replaced',
    'full.import.apply': 'Confirm import',
    'full.import.replaceTitle': 'Confirm replace import',
    'full.import.replaceMessage': 'Replace import deletes all current prompts and tags first and cannot be undone. Export a JSON backup first. Continue?',
    'full.import.replaceConfirm': 'Delete current data and import',
    'full.import.noPlan': 'No importable content has been read yet',
    'full.import.fieldTitle': 'Field guide',
    'full.import.fieldCsv': 'CSV columns: title, body, tags, usage, rating, note; Chinese headers (标题/正文/标签/使用场景/评分/评价备注) are accepted too.',
    'full.import.fieldTags': 'Multiple tags are encoded as a JSON array, e.g. ["writing","marketing"]; line breaks and quotes follow RFC 4180 escaping.',
    'full.import.fieldRating': 'Rating is 1 to 5 in steps of 0.5; leave empty for unrated. CSV ratings start as needs-re-rating because the body-version link cannot be restored.',
    'full.import.fieldFormula': 'Exports prefix values starting with = + - @ to prevent spreadsheet formula injection, and imports strip it again; CSV round-trips keep line breaks and quotes.',
    'full.import.fieldRoundtrip': 'CSV is for exchange; JSON is the full backup that keeps rating and AI review version links.',
    'full.share.title': 'Share prompt',
    'full.share.hint': 'Shared content contains only the title and prompt text, without the personal note or AI review.',
    'full.share.copy': 'Copy text',
    'full.share.downloadMd': 'Download .md',
    'full.share.downloadTxt': 'Download .txt',
    'full.share.copied': 'Prompt text copied',
    'full.share.copyFailed': 'Copy failed — check the browser clipboard permission',
    'full.share.downloaded': 'Download started',
    'full.storage.corrupt': 'The locally stored prompt data is corrupted. Writing is paused to protect the original data. Download a raw backup, or reset to an empty library.',
    'full.storage.downloadRaw': 'Download raw data',
    'full.storage.reset': 'Reset to empty library',
    'full.storage.resetTitle': 'Reset to an empty library',
    'full.storage.resetMessage': 'This discards the corrupted local data and resets to an empty library; it cannot be undone. Download the raw backup first. Continue?',
    'full.storage.resetConfirm': 'Reset library',
    'full.storage.errorTitle': 'Local storage unavailable',
    'full.storage.errorBody': 'This browser does not allow localStorage access; changes will not persist and are lost on refresh. Check privacy settings or export a JSON backup.',
    'full.delete.title': 'Delete prompt',
    'full.delete.message': 'This permanently deletes "{title}" including its rating, note and AI review. It cannot be undone. Delete?',
    'full.delete.confirm': 'Delete permanently',
  },
};

const FULL_PANEL_CSS = [
  '.pl-panel{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13.5px}',
  '.pl-header{flex:none;display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
  '.pl-header-heading{min-width:0}',
  '.pl-header-title{margin:0;font-size:16px;font-weight:600;line-height:1.3}',
  '.pl-header-subtitle{margin:2px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
  '.pl-header-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.pl-export{position:relative}',
  '.pl-menu{position:absolute;right:0;top:calc(100% + 5px);z-index:30;display:flex;flex-direction:column;gap:2px;min-width:240px;padding:5px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-shadow-lv2,0 10px 28px color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent))}',
  '.pl-menu .pl-btn{justify-content:flex-start;border-color:transparent;background:transparent;text-align:left}',
  '.pl-menu-hint{margin:2px 6px 6px;font-size:11.5px;color:var(--dsw-alias-label-secondary);line-height:1.5}',
  '.pl-banners{flex:none;padding:8px 18px 0}',
  '.pl-notice-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}',
  '.pl-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(190px,220px) minmax(260px,340px) minmax(0,1fr);overflow:hidden}',
  '.pl-main-narrow{grid-template-columns:minmax(0,1fr);overflow:auto}',
  '.pl-nav{min-height:0;overflow:auto;padding:12px 10px 24px;border-right:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
  '.pl-nav-group{margin:0 0 15px}',
  '.pl-nav-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:0 0 6px;padding:0 7px;font-size:11.5px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);text-transform:none}',
  '.pl-nav-item{display:flex;align-items:center;width:100%;min-height:29px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}',
  '.pl-nav-item:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent))}',
  '.pl-nav-item-active,.pl-nav-item[aria-pressed="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary);font-weight:600}',
  '.pl-nav-item-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.pl-nav-empty{margin:2px 7px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
  '.pl-nav-foot{margin:18px 7px 2px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);opacity:.9}',
  '.pl-list-pane{min-height:0;display:flex;flex-direction:column;border-right:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}',
  '.pl-list-tools{flex:none;display:flex;flex-direction:column;gap:7px;padding:10px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1)}',
  '.pl-list-tools-row{display:flex;align-items:center;gap:8px}',
  '.pl-list-tools-row .pl-label{margin:0;flex:none}',
  '.pl-list-tools-row .pl-select{flex:1;min-width:0}',
  '.pl-sort-rule{margin:0;font-size:11.5px;line-height:1.55;color:var(--dsw-alias-label-secondary)}',
  '.pl-list-summary{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
  '.pl-list{flex:1;min-height:0;overflow:auto;padding:6px}',
  '.pl-list-item{display:flex;flex-direction:column;gap:4px;width:100%;padding:9px 10px;border:0;border-radius:9px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
  '.pl-list-item:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-secondary) 10%,transparent))}',
  '.pl-list-item-active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 13%,transparent)}',
  '.pl-list-item-head{display:flex;align-items:center;gap:5px;min-width:0}',
  '.pl-list-title{min-width:0;font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.pl-list-snippet{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
  '.pl-list-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px}',
  '.pl-flag{flex:none;font-size:11px;line-height:1;color:var(--dsw-alias-state-warn-primary)}',
  '.pl-detail-pane{min-height:0;overflow:auto;padding:16px 20px 36px}',
  '.pl-detail-empty{display:flex;align-items:center;justify-content:center}',
  '.pl-back-btn{margin:0 0 10px}',
  '.pl-detail-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}',
  '.pl-detail-title{flex:1;min-width:180px;margin:0;font-size:18px;font-weight:650;overflow-wrap:anywhere}',
  '.pl-detail-actions{display:flex;flex-wrap:wrap;gap:6px}',
  '.pl-detail-meta{margin:8px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
  '.pl-detail-tags{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:8px 0 0}',
  '.pl-detail-section{margin:18px 0 0;padding:14px;border:.5px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-layer-1)}',
  '.pl-section-title{margin:0 0 10px;font-size:12.5px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary)}',
  '.pl-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px}',
  '.pl-section-title-inline{margin:0}',
  '.pl-detail-body-md{font-family:inherit;white-space:normal;font-size:13px;line-height:1.7}',
  '.pl-detail-body{margin:0;max-height:46vh;overflow:auto;padding:10px;border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:12.8px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}',
  '.pl-detail-usage{margin:0;color:var(--dsw-alias-label-primary);font-size:12.8px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}',
  '.pl-field{margin:0 0 14px}',
  '.pl-field .pl-label{margin:0 0 5px}',
  '.pl-field-error{margin:4px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}',
  '.pl-field-hint{margin:4px 0 0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}',
  '.pl-inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.pl-inline-grow{flex:1;min-width:140px}',
  '.pl-tag-options{display:flex;flex-wrap:wrap;gap:4px 12px;margin:2px 0 8px}',
  '.pl-tag-option{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;line-height:20px;color:var(--dsw-alias-label-primary);cursor:pointer}',
  '.pl-rating-stale{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 0;padding:8px 10px;border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:1.5}',
  '.pl-rating-note{display:flex;flex-direction:column;gap:8px;margin:14px 0 0}',
  '.pl-rating-note .pl-label{margin:0}',
  '.pl-rating-reference{margin:12px 0 0;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-bg-base)}',
  '.pl-rating-reference-title{margin:0;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
  '.pl-rating-reference ul{margin:6px 0 0;padding:0 0 0 18px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.7}',
  '.pl-rating-reference p{margin:8px 0 0;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
  '.pl-status-text{font-size:12px;color:var(--dsw-alias-state-success-primary)}',
  '.pl-ai-disclaimer{margin:0 0 10px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
  '.pl-ai-line{margin:0 0 6px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
  '.pl-ai-text{margin:10px 0 0;max-height:320px;overflow:auto;padding:10px;border-radius:8px;background:var(--dsw-alias-bg-base);white-space:pre-wrap;overflow-wrap:anywhere;font:12.8px/1.65 inherit;color:var(--dsw-alias-label-primary)}',
  '.pl-ai-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0 0}',
  '.pl-rate-after-use{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:12px 0 0;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}',
  '.pl-rate-after-use-text{margin:0;font-size:12px;color:var(--dsw-alias-label-primary)}',
  '.pl-welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:40px 22px;text-align:center}',
  '.pl-welcome-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:12px 0 0}',
  '.pl-welcome-local{max-width:52ch;margin:14px auto 0;text-align:center;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary)}',
  '.pl-empty-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:10px 0 0}',
  '.pl-tag-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}',
  '.pl-tag-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 9px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}',
  '.pl-tag-name{min-width:96px;font-weight:600;overflow-wrap:anywhere}',
  '.pl-tag-usage{font-size:12px;color:var(--dsw-alias-label-secondary)}',
  '.pl-tag-row-actions{margin-left:auto;display:flex;flex-wrap:wrap;gap:5px}',
  '.pl-tag-create{display:flex;align-items:center;gap:8px;margin:14px 0 0}',
  '.pl-import-counts{display:flex;flex-wrap:wrap;gap:8px 16px;margin:10px 0;font-size:12.5px;color:var(--dsw-alias-label-primary)}',
  '.pl-import-block{margin:0 0 14px;padding:12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
  '.pl-import-mode{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}',
  '.pl-import-mode-hint{margin:8px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
  '.pl-import-issues{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:12px;line-height:1.55;color:var(--dsw-alias-state-error-primary)}',
  '.pl-import-guide{margin:14px 0 0;padding:12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary)}',
  '.pl-import-guide-title{margin:0 0 6px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
  '.pl-import-guide p{margin:0 0 6px;overflow-wrap:anywhere}',
  '.pl-file-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.pl-share-actions{display:flex;flex-direction:column;gap:8px;margin:12px 0 0}',
  '.pl-share-actions .pl-btn{justify-content:flex-start}',
].join('');

const FP_AI_TIMEOUT_MS = 120000;
const FP_AI_STATUS_TIMEOUT_MS = 20000;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function fpPad2(value) {
  return value < 10 ? '0' + String(value) : String(value);
}

/** Local calendar date as YYYYMMDD, used by export file names. */
function fpDateStamp(date) {
  const moment = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return String(moment.getFullYear()) + fpPad2(moment.getMonth() + 1) + fpPad2(moment.getDate());
}

/** Filesystem-safe-ish base name derived from a prompt title. */
function fpFileBase(title) {
  const text = String(title === null || title === undefined ? '' : title);
  let base = '';
  for (const ch of text) {
    if (/[A-Za-z0-9\u4e00-\u9fff_-]/.test(ch)) base += ch;
    else if (ch === ' ' || ch === '\t' || ch === '\n') base += '-';
    if (base.length >= 48) break;
  }
  base = base.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'prompt';
}

/** Current active locale id, with a Chinese fallback. */
function fpActiveLocale(locale) {
  try {
    const snapshot = locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : null;
    return snapshot && snapshot.active === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

/** Map `explainSort` output (e.g. 'sortRule.default') to the fragment dict. */
function fpSortRuleText(t, sort) {
  const rule = typeof explainSort === 'function' ? explainSort(sort) : 'sortRule.default';
  const key = 'full.' + String(rule);
  const text = t(key);
  if (typeof text === 'string' && text !== key) return text;
  return t('full.sortRule.default');
}

/** Translate the machine code of an AI failure and keep the code visible. */
function fpAiFailureText(t, failure) {
  const code = failure && failure.code ? String(failure.code) : 'unknown';
  const key = 'full.aiErr.' + code;
  let text = t(key);
  if (typeof text !== 'string' || text === key) text = t('full.aiErr.unknown');
  const suffix = code && code !== 'unknown' ? ' (' + code + ')' : '';
  return t('full.ai.errorPrefix') + text + suffix;
}

/** Translate a store error result into a readable message. */
function fpDescribe(t, error) {
  return describeError(t, error);
}

/* ------------------------------------------------------------------ */
/* Reusable bits                                                       */
/* ------------------------------------------------------------------ */

/** Local (non-store) notice bar; store notices use the shared NoticeBar. */
function FPLocalNotice(props) {
  if (!props.text) return null;
  const kind = props.kind === 'error' ? 'error' : props.kind === 'success' ? 'success' : 'info';
  return h(
    'div',
    { className: 'pl-notice pl-notice-' + kind, role: kind === 'error' ? 'alert' : 'status' },
    h('span', { className: 'pl-notice-text' }, props.text),
    props.onDismiss
      ? h(
          'button',
          {
            type: 'button',
            className: 'pl-notice-dismiss',
            'aria-label': props.dismissLabel || 'Dismiss',
            onClick: props.onDismiss,
          },
          '×',
        )
      : null,
  );
}

/** Centered empty state with optional actions. */
function FPEmptyState(props) {
  return h(
    'div',
    { className: 'pl-empty' },
    h('p', { className: 'pl-empty-title' }, props.title),
    props.body ? h('p', { className: 'pl-empty-body' }, props.body) : null,
    props.actions && props.actions.length
      ? h('div', { className: 'pl-empty-actions' }, props.actions)
      : null,
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar navigation                                                  */
/* ------------------------------------------------------------------ */

function FPNav(props) {
  const { t, data, view, quality, tagId, onView, onQuality, onTag, onManageTags } = props;
  const tags = sortTags(data.tags);
  const viewItem = (key, label) =>
    h(
      'button',
      {
        type: 'button',
        className: 'pl-nav-item',
        'aria-pressed': view === key,
        onClick: () => onView(key),
      },
      h('span', { className: 'pl-nav-item-text' }, label),
    );
  const qualityItem = (key, label) =>
    h(
      'button',
      {
        type: 'button',
        className: 'pl-nav-item',
        'aria-pressed': quality === key,
        onClick: () => onQuality(quality === key ? 'any' : key),
      },
      h('span', { className: 'pl-nav-item-text' }, label),
    );
  const tagItems = tags.map((tag) =>
    h(
      'button',
      {
        key: tag.id,
        type: 'button',
        className: 'pl-nav-item',
        'aria-pressed': tagId === tag.id,
        'aria-label': t('full.nav.tagAria', { name: tag.name }),
        onClick: () => onTag(tagId === tag.id ? null : tag.id),
      },
      h(
        'span',
        { className: 'pl-nav-item-text' },
        t('full.nav.tagOption', { name: tag.name, count: tagUsageCount(data, tag.id) }),
      ),
    ),
  );
  return h(
    'nav',
    { className: 'pl-nav', 'aria-label': t('full.aria.nav') },
    h(
      'div',
      { className: 'pl-nav-group' },
      h('h2', { className: 'pl-nav-heading' }, t('full.nav.title')),
      viewItem('all', t('full.nav.all')),
      viewItem('favorites', t('full.nav.favorites')),
      viewItem('recent', t('full.nav.recent')),
    ),
    h(
      'div',
      { className: 'pl-nav-group' },
      h('h2', { className: 'pl-nav-heading' }, t('full.nav.quality')),
      qualityItem('rated4', t('full.nav.rated4')),
      qualityItem('rated3', t('full.nav.rated3')),
      qualityItem('unrated', t('full.nav.unrated')),
      qualityItem('stale', t('full.nav.stale')),
    ),
    h(
      'div',
      { className: 'pl-nav-group' },
      h(
        'h2',
        { className: 'pl-nav-heading' },
        h('span', null, t('full.nav.tags')),
        h(
          'button',
          { type: 'button', className: 'pl-link-btn', onClick: onManageTags },
          t('full.nav.manageTags'),
        ),
      ),
      tagItems.length ? tagItems : h('p', { className: 'pl-nav-empty' }, t('full.nav.noTags')),
      tagId
        ? h(
            'button',
            { type: 'button', className: 'pl-nav-item', onClick: () => onTag(null) },
            h('span', { className: 'pl-nav-item-text' }, t('full.nav.clearTag')),
          )
        : null,
    ),
    h('p', { className: 'pl-nav-foot' }, t('full.nav.storageFoot')),
  );
}

/* ------------------------------------------------------------------ */
/* Prompt list                                                         */
/* ------------------------------------------------------------------ */

function FPPromptListItem(props) {
  const { t, data, prompt, active, onSelect } = props;
  const tags = tagsForPrompt(data, prompt);
  const body = String(prompt.body || '');
  const snippet = body.length > 140 ? body.slice(0, 140) + '…' : body;
  return h(
    'button',
    {
      type: 'button',
      className: 'pl-list-item' + (active ? ' pl-list-item-active' : ''),
      'aria-label': prompt.title,
      'aria-current': active ? 'true' : undefined,
      onClick: () => onSelect(prompt.id),
    },
    h(
      'span',
      { className: 'pl-list-item-head' },
      prompt.pinned
        ? h(
            'span',
            { className: 'pl-flag', title: t('full.list.pinnedMark'), 'aria-hidden': 'true' },
            '📌',
          )
        : null,
      prompt.favorite
        ? h(
            'span',
            { className: 'pl-flag', title: t('full.list.favoriteMark'), 'aria-hidden': 'true' },
            '★',
          )
        : null,
      h('span', { className: 'pl-list-title' }, prompt.title),
    ),
    h(
      'span',
      { className: 'pl-list-snippet' },
      snippet.trim() ? snippet : t('full.list.snippetEmpty'),
    ),
    h(
      'span',
      { className: 'pl-list-meta' },
      tags.length ? h(TagChips, { tags, limit: 3 }) : null,
      h(ScoreBadge, { prompt, t }),
      h(AiReviewBadge, { prompt, t }),
    ),
  );
}

function FPPromptList(props) {
  const {
    t,
    data,
    prompts,
    hasFilters,
    search,
    sort,
    selectedId,
    onSearch,
    onSort,
    onSelect,
    onNew,
    onImport,
    onClearFilters,
  } = props;
  const child = [];
  if (data.prompts.length === 0) {
    child.push(
      h(
        'div',
        { key: 'welcome', className: 'pl-welcome' },
        h('h2', { className: 'pl-empty-title' }, t('full.welcome.title')),
        h('p', { className: 'pl-empty-body' }, t('full.welcome.body')),
        h(
          'div',
          { className: 'pl-welcome-actions' },
          h(
            'button',
            { type: 'button', className: 'pl-btn pl-btn-primary', onClick: onNew },
            t('full.welcome.new'),
          ),
          h('button', { type: 'button', className: 'pl-btn', onClick: onImport }, t('full.welcome.import')),
        ),
        h('p', { className: 'pl-welcome-local' }, t('full.welcome.local')),
      ),
    );
  } else if (prompts.length === 0) {
    child.push(
      h(FPEmptyState, {
        key: 'no-results',
        title: t('full.list.noResults.title'),
        body: t('full.list.noResults.body'),
        actions: hasFilters
          ? [
              h(
                'button',
                { key: 'clear', type: 'button', className: 'pl-btn', onClick: onClearFilters },
                t('full.list.clearFilters'),
              ),
            ]
          : [],
      }),
    );
  } else {
    for (const prompt of prompts) {
      child.push(
        h(FPPromptListItem, {
          key: prompt.id,
          t,
          data,
          prompt,
          active: prompt.id === selectedId,
          onSelect,
        }),
      );
    }
  }
  return h(
    'section',
    { className: 'pl-list-pane', 'aria-label': t('full.aria.list') },
    h(
      'div',
      { className: 'pl-list-tools' },
      h('input', {
        type: 'search',
        className: 'pl-input',
        'aria-label': 'search',
        placeholder: t('full.search.placeholder'),
        value: search,
        onChange: (event) => onSearch(event && event.target ? event.target.value : ''),
      }),
      h(
        'div',
        { className: 'pl-list-tools-row' },
        h('label', { className: 'pl-label' }, t('full.sort.label')),
        h(
          'select',
          {
            className: 'pl-select',
            'aria-label': 'sort',
            value: sort,
            onChange: (event) => onSort(event && event.target ? event.target.value : 'default'),
          },
          SORTS.map((key) =>
            h('option', { key, value: key }, t('full.sort.' + key)),
          ),
        ),
      ),
      h('p', { className: 'pl-sort-rule' }, fpSortRuleText(t, sort)),
      h(
        'div',
        { className: 'pl-list-summary' },
        h('span', null, t('full.list.count', { count: prompts.length })),
        hasFilters
          ? h(
              'button',
              { type: 'button', className: 'pl-link-btn', onClick: onClearFilters },
              t('full.list.clearFilters'),
            )
          : null,
      ),
    ),
    h('div', { className: 'pl-list', role: 'list' }, child),
  );
}

/* ------------------------------------------------------------------ */
/* Detail: rating section                                              */
/* ------------------------------------------------------------------ */

function FPRatingSection(props) {
  const { t, prompt, store } = props;
  const [note, setNote] = React.useState(() => (prompt.score && prompt.score.note) || '');
  const [noteStatus, setNoteStatus] = React.useState(null);
  const savedNoteRef = React.useRef((prompt.score && prompt.score.note) || '');
  const stale = isScoreStale(prompt);
  const valid = isScoreValid(prompt);
  const noteText = t('full.rating.noteLabel');
  function changeStars(stars) {
    const result = store.setRating(prompt.id, stars);
    setNoteStatus(null);
    return result;
  }
  function clearStars() {
    store.setRating(prompt.id, null);
    setNoteStatus(null);
  }
  function keepRating() {
    store.keepRating(prompt.id);
    setNoteStatus(null);
  }
  function saveNote() {
    const result = store.setNote(prompt.id, note);
    if (result && result.ok) {
      savedNoteRef.current = note;
      setNoteStatus({ kind: 'success', text: t('full.rating.noteSaved') });
    } else {
      setNoteStatus({ kind: 'error', text: t('full.rating.noteSaveFailed', { message: fpDescribe(t, result && result.error) }) });
    }
  }
  /* Leaving the field (or switching prompts) must not silently drop a typed
   * note; an explicit save button remains for keyboard users. */
  function noteBlur() {
    if (note === savedNoteRef.current) return;
    saveNote();
  }
  const stars = prompt.score ? prompt.score.stars : null;
  return h(
    'section',
    { className: 'pl-detail-section pl-rating' },
    h('h3', { className: 'pl-section-title' }, t('full.rating.title')),
    h(StarRating, {
      value: stars,
      onChange: changeStars,
      onClear: clearStars,
      t,
      label: t('full.rating.title'),
    }),
    valid
      ? h('p', { className: 'pl-status-text' }, t('full.rating.current'))
      : stale
        ? h('p', { className: 'pl-status-text' }, t('full.rating.old'))
        : h('p', { className: 'pl-muted' }, t('common.unrated')),
    stale
      ? h(
          'div',
          { className: 'pl-rating-stale' },
          h('span', null, t('full.rating.staleHint')),
          h(
            'button',
            { type: 'button', className: 'pl-btn', onClick: keepRating },
            t('full.rating.keep'),
          ),
        )
      : null,
    h('p', { className: 'pl-muted' }, t('full.rating.hint')),
    h('p', { className: 'pl-field-hint' }, t('full.rating.personal')),
    h(
      'div',
      { className: 'pl-rating-note' },
      h('label', { className: 'pl-label' }, noteText),
      h('textarea', {
        className: 'pl-textarea',
        'aria-label': 'rating-note',
        placeholder: t('full.rating.notePlaceholder'),
        value: note,
        onChange: (event) => setNote(event && event.target ? event.target.value : ''),
        onBlur: noteBlur,
      }),
      h(
        'div',
        { className: 'pl-inline' },
        h('button', { type: 'button', className: 'pl-btn', onClick: saveNote }, t('full.rating.saveNote')),
        noteStatus
          ? h(FPLocalNotice, {
              kind: noteStatus.kind,
              text: noteStatus.text,
              onDismiss: () => setNoteStatus(null),
              dismissLabel: t('common.dismiss'),
            })
          : null,
      ),
    ),
    h(
      'div',
      { className: 'pl-rating-reference' },
      h('h4', { className: 'pl-rating-reference-title' }, t('full.rating.referenceTitle')),
      h(
        'ul',
        null,
        h('li', null, t('full.rating.ref5')),
        h('li', null, t('full.rating.ref4')),
        h('li', null, t('full.rating.ref3')),
        h('li', null, t('full.rating.ref2')),
        h('li', null, t('full.rating.ref1')),
      ),
      h('p', null, t('full.rating.explain')),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Detail: AI review section (shared by detail page and editor)        */
/* ------------------------------------------------------------------ */

function FPAiSection(props) {
  const { t, locale, input, review, stale, aiStatus, onRetryStatus, onGenerated, onDelete, draft } = props;
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState(null);
  const seqRef = React.useRef(0);
  const cleanupRef = React.useRef(null);

  React.useEffect(
    () => () => {
      seqRef.current += 1;
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch {
          /* ignore */
        }
        cleanupRef.current = null;
      }
    },
    [],
  );

  const available = aiStatus && aiStatus.state === 'ready' && aiStatus.info;
  const inputTitle = String((input && input.title) || '');
  const inputBody = String((input && input.body) || '');
  const canGenerate = Boolean(inputTitle.trim() && inputBody.trim());
  const reviewInput = review && review.input ? review.input : null;
  const reviewStale =
    typeof stale === 'boolean'
      ? stale
      : Boolean(reviewInput && reviewInputKey(reviewInput) !== reviewInputKey(input || {}));

  function generate() {
    if (generating || !available || !canGenerate) return;
    const snapshotInput = {
      title: inputTitle,
      body: inputBody,
      usage: String((input && input.usage) || ''),
    };
    const key = reviewInputKey(snapshotInput);
    seqRef.current += 1;
    const requestId = seqRef.current;
    let timedOut = false;
    let controller = null;
    try {
      if (typeof AbortController === 'function') controller = new AbortController();
    } catch {
      controller = null;
    }
    if (controller) {
      cleanupRef.current = () => controller.abort();
    }
    const timer = controller
      ? setTimeout(() => {
          timedOut = true;
          try {
            controller.abort();
          } catch {
            /* ignore */
          }
        }, FP_AI_TIMEOUT_MS)
      : null;
    setGenerating(true);
    setError(null);
    const finish = (failure) => {
      if (timer) clearTimeout(timer);
      if (cleanupRef.current) cleanupRef.current = null;
      if (seqRef.current !== requestId) return;
      setGenerating(false);
      if (failure) setError(failure);
    };
    requestAiReview(
      {
        title: snapshotInput.title,
        body: snapshotInput.body,
        usage: snapshotInput.usage,
        language: fpActiveLocale(locale),
      },
      controller ? controller.signal : undefined,
    ).then(
      (result) => {
        if (seqRef.current !== requestId) {
          if (timer) clearTimeout(timer);
          return;
        }
        if (!result || result.ok !== true || !result.review) {
          finish(fpAiFailureText(t, timedOut ? { code: 'TIMEOUT' } : result || { code: 'NETWORK' }));
          return;
        }
        const generatedReview = {
          ...result.review,
          input: {
            title: snapshotInput.title,
            body: snapshotInput.body,
            usage: snapshotInput.usage,
          },
        };
        finish(null);
        const rejection = onGenerated ? onGenerated(generatedReview, { inputKey: key, input: snapshotInput }) : null;
        if (rejection) setError(rejection);
      },
      (failure) => {
        finish(fpAiFailureText(t, timedOut ? { code: 'TIMEOUT' } : failure || { code: 'NETWORK' }));
      },
    );
  }

  const generateLabel = review ? t('full.ai.regenerate') : t('full.ai.generate');
  const statusLine = [];
  if (aiStatus && aiStatus.state === 'loading') {
    statusLine.push(h('p', { key: 'loading', className: 'pl-ai-line' }, t('full.ai.statusLoading')));
  } else if (!available) {
    statusLine.push(
      h(
        'div',
        { key: 'unavailable', className: 'pl-notice pl-notice-error', role: 'status' },
        h('span', { className: 'pl-notice-text' }, t('full.ai.unavailable')),
        aiStatus && aiStatus.error && aiStatus.error.code
          ? h('span', { className: 'pl-notice-text' }, t('full.ai.statusReason', { code: aiStatus.error.code }))
          : null,
        h(
          'button',
          {
            type: 'button',
            className: 'pl-btn',
            onClick: () => {
              if (onRetryStatus) onRetryStatus();
            },
          },
          t('full.ai.retry'),
        ),
      ),
    );
  } else {
    statusLine.push(
      h(
        'p',
        { key: 'model', className: 'pl-ai-line' },
        t('full.ai.modelInfo', {
          provider: aiStatus.info.provider || t('common.notAvailable'),
          model: aiStatus.info.model || aiStatus.info.displayName || t('common.notAvailable'),
        }),
      ),
      h('p', { key: 'send', className: 'pl-ai-line' }, t('full.ai.sendNote')),
    );
  }

  const reviewBlock = review
    ? h(
        'div',
        null,
        h(
          'p',
          { className: 'pl-ai-line' },
          t('full.ai.modelLine', {
            model: review.model || t('common.notAvailable'),
            time: formatDateTime(review.generatedAt, fpActiveLocale(locale)) || t('common.notAvailable'),
          }),
        ),
        reviewStale ? h('p', { className: 'pl-notice pl-notice-warn', role: 'status' }, t('common.aiStale')) : null,
        h('pre', { className: 'pl-ai-text' }, review.text),
      )
    : h('p', { className: 'pl-muted' }, t('full.ai.empty'));

  return h(
    'section',
    { className: 'pl-detail-section pl-ai' },
    h('h3', { className: 'pl-section-title' }, draft ? t('full.ai.draftSectionTitle') : t('full.ai.title')),
    h('p', { className: 'pl-ai-disclaimer' }, t('common.aiDisclaimer')),
    ...statusLine,
    reviewBlock,
    error ? h(FPLocalNotice, { kind: 'error', text: error, onDismiss: () => setError(null), dismissLabel: t('common.dismiss') }) : null,
    h(
      'div',
      { className: 'pl-ai-actions' },
      h(
        'button',
        {
          type: 'button',
          className: 'pl-btn',
          disabled: generating || !available || !canGenerate,
          onClick: generate,
        },
        generating ? t('full.ai.generating') : generateLabel,
      ),
      !canGenerate ? h('span', { className: 'pl-muted' }, t('full.ai.emptyInput')) : null,
      generating ? h('span', { className: 'pl-muted' }, t('common.loading')) : null,
      review && onDelete
        ? h(
            'button',
            { type: 'button', className: 'pl-btn pl-btn-danger', onClick: onDelete },
            t('full.ai.delete'),
          )
        : null,
      draft ? h('p', { className: 'pl-field-hint' }, t('full.ai.draftNote')) : null,
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Detail page                                                         */
/* ------------------------------------------------------------------ */

function FPDetail(props) {
  const { t, locale, data, prompt, store, narrow, onBack, onEdit, onDelete, onShare, aiStatus, onRetryStatus } = props;
  const [rateAfterUse, setRateAfterUse] = React.useState(false);
  const [copyNotice, setCopyNotice] = React.useState(null);
  const [aiDeleteOpen, setAiDeleteOpen] = React.useState(false);
  const [bodyMode, setBodyMode] = useBodyRenderMode(store);
  const tags = tagsForPrompt(data, prompt);
  const localeId = fpActiveLocale(locale);
  const created = formatDateTime(prompt.createdAt, localeId);
  const updated = formatDateTime(prompt.updatedAt, localeId);
  const lastUsed = formatDateTime(prompt.lastUsedAt, localeId);
  const metaParts = [];
  if (created) metaParts.push(t('full.detail.created', { value: created }));
  if (updated) metaParts.push(t('full.detail.updated', { value: updated }));
  metaParts.push(t('common.usedCount', { n: prompt.useCount || 0 }));
  metaParts.push(lastUsed ? t('full.detail.lastUsed', { value: lastUsed }) : t('full.detail.neverUsed'));

  async function copyBody() {
    const ok = await copyText(prompt.body);
    if (ok) {
      store.markUsed(prompt.id);
      setCopyNotice({ kind: 'success', text: t('common.copyOk') });
      setRateAfterUse(true);
    } else {
      setCopyNotice({ kind: 'error', text: t('common.copyFailed') });
    }
  }

  function rateOnStar(stars) {
    store.setRating(prompt.id, stars);
    setRateAfterUse(false);
    setCopyNotice({ kind: 'success', text: t('full.rating.current') });
  }

  function aiGenerated(review, meta) {
    const live = store.getSnapshot().data.prompts.find((item) => item.id === prompt.id);
    if (!live) return t('full.ai.targetChanged');
    const key = reviewInputKey(promptReviewInput(live));
    if (key !== meta.inputKey) return t('full.ai.inputChanged');
    const result = store.attachAiReview(live.id, review);
    if (result && !result.ok) return fpDescribe(t, result.error);
    return null;
  }

  function confirmDeleteAi() {
    const result = store.deleteAiReview(prompt.id);
    setAiDeleteOpen(false);
    if (result && !result.ok) return;
  }

  return h(
    'section',
    { className: 'pl-detail-pane', 'aria-label': t('full.aria.detail') },
    narrow
      ? h(
          'button',
          {
            type: 'button',
            className: 'pl-btn pl-btn-ghost pl-back-btn',
            'aria-label': t('full.backToList'),
            onClick: onBack,
          },
          '← ' + t('full.backToList'),
        )
      : null,
    h(
      'div',
      { className: 'pl-detail-head' },
      h('h2', { className: 'pl-detail-title' }, prompt.title),
      h(
        'div',
        { className: 'pl-detail-actions' },
        h('button', { type: 'button', className: 'pl-btn', onClick: onEdit }, t('full.detail.edit')),
        h('button', { type: 'button', className: 'pl-btn', onClick: copyBody }, t('full.detail.copy')),
        h(
          'button',
          {
            type: 'button',
            className: 'pl-btn',
            'aria-pressed': Boolean(prompt.favorite),
            onClick: () => store.setFlag(prompt.id, 'favorite', !prompt.favorite),
          },
          t(prompt.favorite ? 'full.detail.unfavorite' : 'full.detail.favorite'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'pl-btn',
            'aria-pressed': Boolean(prompt.pinned),
            onClick: () => store.setFlag(prompt.id, 'pinned', !prompt.pinned),
          },
          t(prompt.pinned ? 'full.detail.unpin' : 'full.detail.pin'),
        ),
        h('button', { type: 'button', className: 'pl-btn', onClick: onShare }, t('full.detail.share')),
        h(
          'button',
          { type: 'button', className: 'pl-btn pl-btn-danger', onClick: onDelete },
          t('full.detail.delete'),
        ),
      ),
    ),
    h('p', { className: 'pl-detail-meta' }, metaParts.join(' · ')),
    h(
      'div',
      { className: 'pl-detail-tags' },
      h('span', { className: 'pl-muted' }, t('full.detail.tagsTitle') + '：'),
      tags.length
        ? h(TagChips, { tags, limit: 20 })
        : h('span', { className: 'pl-muted' }, t('full.detail.noTags')),
    ),
    copyNotice
      ? h(FPLocalNotice, {
          kind: copyNotice.kind,
          text: copyNotice.text,
          onDismiss: () => setCopyNotice(null),
          dismissLabel: t('common.dismiss'),
        })
      : null,
    rateAfterUse
      ? h(
          'div',
          { className: 'pl-rate-after-use' },
          h('p', { className: 'pl-rate-after-use-text' }, t('full.detail.rateAfterUseHint')),
          h(StarRating, {
            value: prompt.score ? prompt.score.stars : null,
            onChange: rateOnStar,
            t,
            size: 'small',
            label: t('full.detail.rateAfterUse'),
          }),
          h(
            'button',
            { type: 'button', className: 'pl-btn pl-btn-ghost', onClick: () => setRateAfterUse(false) },
            t('full.detail.rateLater'),
          ),
        )
      : null,
    h(
      'div',
      { className: 'pl-detail-section' },
      h(
        'div',
        { className: 'pl-section-head' },
        h('h3', { className: 'pl-section-title pl-section-title-inline' }, t('full.detail.bodyTitle')),
        h(BodyViewToggle, { mode: bodyMode, onChange: setBodyMode, t }),
      ),
      bodyMode === 'markdown'
        ? h(MarkdownView, { text: prompt.body, className: 'pl-detail-body pl-detail-body-md' })
        : h('pre', { className: 'pl-detail-body' }, prompt.body),
      bodyMode === 'markdown'
        ? h('p', { className: 'pl-field-hint' }, t('common.markdownHint'))
        : null,
    ),
    prompt.usage
      ? h(
          'div',
          { className: 'pl-detail-section' },
          h('h3', { className: 'pl-section-title' }, t('full.detail.usageTitle')),
          h('pre', { className: 'pl-detail-usage' }, prompt.usage),
        )
      : null,
    h(FPRatingSection, { t, prompt, store }),
    h(FPAiSection, {
      t,
      locale,
      input: promptReviewInput(prompt),
      review: prompt.aiReview,
      stale: isAiReviewStale(prompt),
      aiStatus,
      onRetryStatus,
      onGenerated: aiGenerated,
      onDelete: prompt.aiReview ? () => setAiDeleteOpen(true) : null,
    }),
    aiDeleteOpen
      ? h(ConfirmDialog, {
          title: t('full.ai.deleteTitle'),
          message: t('full.ai.deleteMessage'),
          confirmLabel: t('full.ai.deleteConfirm'),
          cancelLabel: t('common.cancel'),
          danger: true,
          t,
          onConfirm: confirmDeleteAi,
          onCancel: () => setAiDeleteOpen(false),
        })
      : null,
  );
}

/* ------------------------------------------------------------------ */
/* Editor modal                                                        */
/* ------------------------------------------------------------------ */

function FPEditorModal(props) {
  const { store, t, locale, prompt, tags, aiStatus, onRetryStatus, onClose, onSaved } = props;
  const editing = Boolean(prompt);
  const [title, setTitle] = React.useState(() => (prompt ? prompt.title : ''));
  const [body, setBody] = React.useState(() => (prompt ? prompt.body : ''));
  const [usage, setUsage] = React.useState(() => (prompt ? prompt.usage : ''));
  const [tagIds, setTagIds] = React.useState(() => (prompt && Array.isArray(prompt.tagIds) ? prompt.tagIds.slice() : []));
  const [fieldErrors, setFieldErrors] = React.useState({});
  const [saveError, setSaveError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [tagInput, setTagInput] = React.useState('');
  const [tagError, setTagError] = React.useState(null);
  const [draftAiReview, setDraftAiReview] = React.useState(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const titleRef = React.useRef(null);
  const initialRef = React.useRef({
    title: prompt ? prompt.title : '',
    body: prompt ? prompt.body : '',
    usage: prompt ? prompt.usage : '',
    tagIds: prompt && Array.isArray(prompt.tagIds) ? prompt.tagIds.slice().sort().join('|') : '',
  });
  const currentTagKey = tagIds.slice().sort().join('|');
  const dirty =
    title !== initialRef.current.title ||
    body !== initialRef.current.body ||
    usage !== initialRef.current.usage ||
    currentTagKey !== initialRef.current.tagIds;

  function requestClose() {
    if (dirty) setDiscardOpen(true);
    else onClose();
  }

  function toggleTag(id) {
    setTagIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : previous.concat([id]),
    );
    setTagError(null);
  }

  function createTagInline() {
    const name = normalizeTagName(tagInput);
    if (!name) {
      setTagError(t('err.TAG_NAME_REQUIRED'));
      return;
    }
    const result = store.createTag(name);
    if (!result || !result.ok) {
      setTagError(fpDescribe(t, result && result.error));
      return;
    }
    const created = findTagByName(store.getData().tags, name);
    setTagInput('');
    setTagError(null);
    if (created) setTagIds((previous) => (previous.includes(created.id) ? previous : previous.concat([created.id])));
  }

  function save() {
    const errors = {};
    if (!title.trim()) errors.title = t('err.TITLE_REQUIRED');
    if (!body.trim()) errors.body = t('err.BODY_REQUIRED');
    setFieldErrors(errors);
    if (errors.title || errors.body) {
      setSaveError(null);
      return;
    }
    setSaving(true);
    const input = {
      title: title.trim(),
      body,
      usage,
      tagIds: tagIds.slice(),
    };
    let result;
    let savedId = editing ? prompt.id : null;
    if (editing) {
      result = store.updatePrompt(prompt.id, input);
    } else {
      const before = new Set(store.getData().prompts.map((item) => item.id));
      result = store.createPrompt(input);
      if (result && result.ok) {
        const created = store.getData().prompts.find((item) => !before.has(item.id));
        savedId = created ? created.id : null;
      }
    }
    setSaving(false);
    if (!result || !result.ok) {
      setSaveError(t('full.edit.saveError', { message: fpDescribe(t, result && result.error) }));
      return;
    }
    const meta = { stale: false, attached: false, aiError: null };
    if (draftAiReview && savedId) {
      const saved = store.getData().prompts.find((item) => item.id === savedId);
      const savedInput = saved ? promptReviewInput(saved) : input;
      if (reviewInputKey(draftAiReview.input) === reviewInputKey(savedInput)) {
        const attached = store.attachAiReview(savedId, draftAiReview);
        if (attached && attached.ok) {
          meta.attached = true;
        } else {
          meta.aiError = fpDescribe(t, attached && attached.error);
        }
      } else {
        meta.stale = true;
      }
    }
    if (onSaved) onSaved(savedId, meta);
  }

  const modalTitle = editing ? t('full.edit.titleEdit') : t('full.edit.titleNew');
  const sortedTags = tags;
  const draftInput = { title, body, usage };
  const reviewIsStale = Boolean(
    draftAiReview && reviewInputKey(draftAiReview.input) !== reviewInputKey(draftInput),
  );

  return h(
    Modal,
    {
      title: modalTitle,
      onClose: requestClose,
      wide: true,
      closeLabel: t('common.close'),
      initialFocusRef: titleRef,
      footer: h(
        React.Fragment,
        null,
        h('button', { type: 'button', className: 'pl-btn', onClick: requestClose }, t('common.cancel')),
        h(
          'button',
          { type: 'button', className: 'pl-btn pl-btn-primary', disabled: saving, onClick: save },
          t('common.save'),
        ),
      ),
    },
    h(
      'div',
      null,
      h(
        'div',
        { className: 'pl-field' },
        h('label', { className: 'pl-label' }, t('full.edit.titleLabel')),
        h('input', {
          ref: titleRef,
          type: 'text',
          className: 'pl-input',
          'aria-label': 'title',
          placeholder: t('full.edit.titlePlaceholder'),
          value: title,
          onChange: (event) => {
            setTitle(event && event.target ? event.target.value : '');
            setFieldErrors((previous) => ({ ...previous, title: null }));
          },
        }),
        fieldErrors.title ? h('p', { className: 'pl-field-error', role: 'alert' }, fieldErrors.title) : null,
      ),
      h(
        'div',
        { className: 'pl-field' },
        h('label', { className: 'pl-label' }, t('full.edit.bodyLabel')),
        h('textarea', {
          className: 'pl-textarea',
          'aria-label': 'body',
          placeholder: t('full.edit.bodyPlaceholder'),
          value: body,
          onChange: (event) => {
            setBody(event && event.target ? event.target.value : '');
            setFieldErrors((previous) => ({ ...previous, body: null }));
          },
        }),
        fieldErrors.body ? h('p', { className: 'pl-field-error', role: 'alert' }, fieldErrors.body) : null,
      ),
      h(
        'div',
        { className: 'pl-field' },
        h('label', { className: 'pl-label' }, t('full.edit.usageLabel')),
        h('textarea', {
          className: 'pl-textarea',
          'aria-label': 'usage',
          placeholder: t('full.edit.usagePlaceholder'),
          value: usage,
          onChange: (event) => setUsage(event && event.target ? event.target.value : ''),
        }),
      ),
      h(
        'div',
        { className: 'pl-field' },
        h('label', { className: 'pl-label' }, t('full.edit.tagsLabel')),
        sortedTags.length
          ? h(
              'div',
              { className: 'pl-tag-options' },
              sortedTags.map((tag) =>
                h(
                  'label',
                  { key: tag.id, className: 'pl-tag-option' },
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
          : h('p', { className: 'pl-muted' }, t('full.edit.noTags')),
        h(
          'div',
          { className: 'pl-inline pl-tag-create' },
          h('input', {
            type: 'text',
            className: 'pl-input pl-inline-grow',
            'aria-label': 'new-tag',
            placeholder: t('full.edit.newTagPlaceholder'),
            value: tagInput,
            onChange: (event) => {
              setTagInput(event && event.target ? event.target.value : '');
              setTagError(null);
            },
          }),
          h('button', { type: 'button', className: 'pl-btn', onClick: createTagInline }, t('full.edit.addTag')),
        ),
        tagError ? h('p', { className: 'pl-field-error', role: 'alert' }, tagError) : null,
      ),
      saveError ? h(FPLocalNotice, { kind: 'error', text: saveError, onDismiss: () => setSaveError(null), dismissLabel: t('common.dismiss') }) : null,
      h(FPAiSection, {
        t,
        locale,
        draft: true,
        input: draftInput,
        review: draftAiReview,
        stale: reviewIsStale,
        aiStatus,
        onRetryStatus,
        onGenerated: (review) => {
          setDraftAiReview(review);
          return null;
        },
        onDelete: draftAiReview ? () => setDraftAiReview(null) : null,
      }),
    ),
    discardOpen
      ? h(ConfirmDialog, {
          title: t('full.edit.discardTitle'),
          message: t('full.edit.discardMessage'),
          confirmLabel: t('full.edit.discardConfirm'),
          cancelLabel: t('full.edit.discardCancel'),
          danger: true,
          t,
          onConfirm: () => {
            setDiscardOpen(false);
            onClose();
          },
          onCancel: () => setDiscardOpen(false),
        })
      : null,
  );
}

/* ------------------------------------------------------------------ */
/* Tag manager modal                                                   */
/* ------------------------------------------------------------------ */

function FPTagManagerModal(props) {
  const { store, t, data, onClose } = props;
  const tags = sortTags(data.tags);
  const [newName, setNewName] = React.useState('');
  const [newError, setNewError] = React.useState(null);
  const [renameId, setRenameId] = React.useState(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [renameError, setRenameError] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  function createTag() {
    const name = normalizeTagName(newName);
    if (!name) {
      setNewError(t('err.TAG_NAME_REQUIRED'));
      return;
    }
    const result = store.createTag(name);
    if (!result || !result.ok) {
      setNewError(fpDescribe(t, result && result.error));
      return;
    }
    setNewName('');
    setNewError(null);
  }

  function startRename(tag) {
    setRenameId(tag.id);
    setRenameValue(tag.name);
    setRenameError(null);
  }

  function commitRename(tag) {
    const name = normalizeTagName(renameValue);
    if (!name) {
      setRenameError(t('err.TAG_NAME_REQUIRED'));
      return;
    }
    const result = store.renameTag(tag.id, name);
    if (!result || !result.ok) {
      setRenameError(fpDescribe(t, result && result.error));
      return;
    }
    setRenameId(null);
    setRenameValue('');
    setRenameError(null);
  }

  const rows = tags.map((tag, index) => {
    const renaming = renameId === tag.id;
    return h(
      'li',
      { key: tag.id, className: 'pl-tag-row' },
      renaming
        ? h(
            React.Fragment,
            null,
            h('input', {
              type: 'text',
              className: 'pl-input pl-inline-grow',
              'aria-label': 'tag-rename',
              value: renameValue,
              onChange: (event) => setRenameValue(event && event.target ? event.target.value : ''),
            }),
            h('button', { type: 'button', className: 'pl-btn', onClick: () => commitRename(tag) }, t('full.tags.saveRename')),
            h('button', { type: 'button', className: 'pl-btn', onClick: () => setRenameId(null) }, t('common.cancel')),
          )
        : h(
            React.Fragment,
            null,
            h('span', { className: 'pl-tag-name' }, tag.name),
            h('span', { className: 'pl-tag-usage' }, t('full.tags.usage', { count: tagUsageCount(data, tag.id) })),
            h(
              'span',
              { className: 'pl-tag-row-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'pl-btn pl-btn-ghost',
                  disabled: index === 0,
                  'aria-label': t('full.tags.moveUpAria', { name: tag.name }),
                  onClick: () => store.moveTag(tag.id, -1),
                },
                t('full.tags.moveUp'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'pl-btn pl-btn-ghost',
                  disabled: index === tags.length - 1,
                  'aria-label': t('full.tags.moveDownAria', { name: tag.name }),
                  onClick: () => store.moveTag(tag.id, 1),
                },
                t('full.tags.moveDown'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'pl-btn pl-btn-ghost',
                  'aria-label': t('full.tags.renameAria', { name: tag.name }),
                  onClick: () => startRename(tag),
                },
                t('full.tags.rename'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'pl-btn pl-btn-ghost',
                  'aria-label': t('full.tags.deleteAria', { name: tag.name }),
                  onClick: () => setDeleteTarget(tag),
                },
                t('full.tags.delete'),
              ),
            ),
          ),
    );
  });

  return h(
    Modal,
    {
      title: t('full.tags.title'),
      onClose,
      closeLabel: t('common.close'),
      footer: h(
        'button',
        { type: 'button', className: 'pl-btn', onClick: onClose },
        t('common.close'),
      ),
    },
    h(
      'div',
      null,
      h('p', { className: 'pl-muted' }, t('full.tags.hint')),
      rows.length ? h('ul', { className: 'pl-tag-list' }, rows) : h('p', { className: 'pl-muted' }, t('full.tags.empty')),
      h(
        'div',
        { className: 'pl-tag-create' },
        h('input', {
          type: 'text',
          className: 'pl-input pl-inline-grow',
          'aria-label': 'new-tag',
          placeholder: t('full.tags.newPlaceholder'),
          value: newName,
          onChange: (event) => {
            setNewName(event && event.target ? event.target.value : '');
            setNewError(null);
          },
        }),
        h('button', { type: 'button', className: 'pl-btn', onClick: createTag }, t('full.tags.create')),
      ),
      newError ? h('p', { className: 'pl-field-error', role: 'alert' }, newError) : null,
      renameError ? h('p', { className: 'pl-field-error', role: 'alert' }, renameError) : null,
      deleteTarget
        ? h(ConfirmDialog, {
            title: t('full.tags.deleteTitle'),
            message: t('full.tags.deleteMessage', { name: deleteTarget.name }),
            confirmLabel: t('full.tags.deleteConfirm'),
            cancelLabel: t('common.cancel'),
            danger: true,
            t,
            onConfirm: () => {
              store.deleteTag(deleteTarget.id);
              setDeleteTarget(null);
            },
            onCancel: () => setDeleteTarget(null),
          })
        : null,
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Import modal                                                        */
/* ------------------------------------------------------------------ */

function FPImportModal(props) {
  const { store, t, onClose } = props;
  const [reading, setReading] = React.useState(false);
  const [fileName, setFileName] = React.useState('');
  const [kind, setKind] = React.useState(null);
  const [jsonValue, setJsonValue] = React.useState(null);
  const [csvPreview, setCsvPreview] = React.useState(null);
  const [jsonMode, setJsonMode] = React.useState('merge');
  const [jsonPlan, setJsonPlan] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [replaceOpen, setReplaceOpen] = React.useState(false);

  async function handleFile(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    setReading(true);
    setError(null);
    setCsvPreview(null);
    setJsonPlan(null);
    setKind(null);
    setJsonValue(null);
    setFileName(file.name || '');
    try {
      const text = await file.text();
      const trimmed = String(text === null || text === undefined ? '' : text)
        .replace(/^\uFEFF/, '')
        .trim();
      if (!trimmed) {
        setReading(false);
        setError(t('err.CSV_EMPTY'));
        return;
      }
      if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
        let parsedJson = null;
        try {
          parsedJson = JSON.parse(String(text));
        } catch {
          setReading(false);
          setError(t('err.INVALID_JSON'));
          return;
        }
        setJsonValue(parsedJson);
        setKind('json');
        setReading(false);
        return;
      }
      const parsed = parseCsv(String(text));
      if (!parsed.ok || !parsed.ok) {
        setReading(false);
        setError(fpDescribe(t, parsed.error));
        return;
      }
      const planned = store.planCsvImportRows(parsed.rows);
      setReading(false);
      if (!planned.ok) {
        setError(fpDescribe(t, planned.error));
        return;
      }
      setCsvPreview(planned.preview);
      setKind('csv');
    } catch (readError) {
      setReading(false);
      setError(
        t('full.import.fileReadError', {
          message: String((readError && readError.message) || readError),
        }),
      );
    }
  }

  React.useEffect(() => {
    if (kind !== 'json' || !jsonValue) return;
    const planned = store.planJsonImport(jsonValue, jsonMode);
    if (!planned.ok) {
      setJsonPlan(null);
      setError(fpDescribe(t, planned.error));
      return;
    }
    setError(null);
    setJsonPlan(planned.plan);
  }, [kind, jsonValue, jsonMode]);

  function applyCsv() {
    if (!csvPreview) {
      setError(t('full.import.noPlan'));
      return;
    }
    const result = store.applyCsvImport(csvPreview);
    if (!result.ok) {
      setError(fpDescribe(t, result.error));
      return;
    }
    onClose();
  }

  function applyJson() {
    if (!jsonPlan) {
      setError(t('full.import.noPlan'));
      return;
    }
    const result = store.applyJsonImport(jsonPlan);
    setReplaceOpen(false);
    if (!result.ok) {
      setError(fpDescribe(t, result.error));
      return;
    }
    onClose();
  }

  function requestApply() {
    if (kind === 'json') {
      if (!jsonPlan) {
        setError(t('full.import.noPlan'));
        return;
      }
      if (jsonMode === 'replace') {
        setReplaceOpen(true);
        return;
      }
      applyJson();
      return;
    }
    applyCsv();
  }

  const blocks = [];
  if (csvPreview) {
    const invalid = Array.isArray(csvPreview.invalid) ? csvPreview.invalid : [];
    const duplicates = Array.isArray(csvPreview.duplicates) ? csvPreview.duplicates : [];
    const tagNames = Array.isArray(csvPreview.toCreateTags) ? csvPreview.toCreateTags : [];
    blocks.push(
      h(
        'div',
        { key: 'csv', className: 'pl-import-block' },
        h('h4', { className: 'pl-section-title' }, t('full.import.csvPreviewTitle')),
        h(
          'div',
          { className: 'pl-import-counts' },
          h('span', null, t('full.import.newCount', { count: csvPreview.counts ? csvPreview.counts.newPrompts : 0 })),
          h('span', null, t('full.import.duplicateCount', { count: duplicates.length })),
          h('span', null, t('full.import.invalidCount', { count: invalid.length })),
          h('span', null, t('full.import.tagsCount', { count: tagNames.length })),
        ),
        invalid.length
          ? h(
              'div',
              null,
              h('p', { className: 'pl-muted' }, t('full.import.invalidTitle', { count: Math.min(invalid.length, 5) })),
              h(
                'ul',
                { className: 'pl-import-issues' },
                invalid.slice(0, 5).map((issue, index) =>
                  h(
                    'li',
                    { key: 'issue-' + String(index) },
                    t('full.import.invalidLine', {
                      line: issue.line,
                      message: issue.message || issue.code,
                    }),
                  ),
                ),
              ),
            )
          : null,
        tagNames.length
          ? h(
              'p',
              { className: 'pl-muted' },
              t('full.import.tagsToCreate', { names: tagNames.join('、') }),
            )
          : null,
      ),
    );
  }
  if (kind === 'json' && jsonPlan) {
    blocks.push(
      h(
        'div',
        { key: 'json', className: 'pl-import-block' },
        h('h4', { className: 'pl-section-title' }, t('full.import.jsonPreviewTitle')),
        h(
          'div',
          { className: 'pl-import-counts' },
          h('span', null, t('full.import.newCount', { count: jsonPlan.added || 0 })),
          h('span', null, t('full.import.duplicateCount', { count: jsonPlan.duplicates || 0 })),
          h('span', null, t('full.import.tagsCount', { count: jsonPlan.tagsAdded || 0 })),
          jsonMode === 'replace'
            ? h('span', null, t('full.import.replacedCount', { count: jsonPlan.replaced || 0 }))
            : null,
        ),
        h('p', { className: 'pl-label' }, t('full.import.mode')),
        h(
          'div',
          { className: 'pl-import-mode' },
          h(
            'button',
            {
              type: 'button',
              className: 'pl-btn' + (jsonMode === 'merge' ? ' pl-btn-primary' : ''),
              'aria-pressed': jsonMode === 'merge',
              onClick: () => setJsonMode('merge'),
            },
            t('full.import.merge'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pl-btn' + (jsonMode === 'replace' ? ' pl-btn-primary' : ''),
              'aria-pressed': jsonMode === 'replace',
              onClick: () => setJsonMode('replace'),
            },
            t('full.import.replace'),
          ),
        ),
        h(
          'p',
          { className: 'pl-import-mode-hint' },
          jsonMode === 'replace' ? t('full.import.replaceHint') : t('full.import.mergeHint'),
        ),
      ),
    );
  }

  const applyDisabled = kind === 'json' ? !jsonPlan : !csvPreview;

  return h(
    Modal,
    {
      title: t('full.import.title'),
      onClose,
      closeLabel: t('common.close'),
      wide: true,
      footer: h(
        React.Fragment,
        null,
        h('button', { type: 'button', className: 'pl-btn', onClick: onClose }, t('common.cancel')),
        h(
          'button',
          { type: 'button', className: 'pl-btn pl-btn-primary', disabled: applyDisabled, onClick: requestApply },
          t('full.import.apply'),
        ),
      ),
    },
    h(
      'div',
      null,
      h(
        'div',
        { className: 'pl-file-row' },
        h('label', { className: 'pl-label' }, t('full.import.fileLabel')),
        h('input', {
          type: 'file',
          className: 'pl-input',
          'aria-label': 'import-file',
          accept: '.csv,.json,text/csv,application/json',
          onChange: handleFile,
        }),
      ),
      h('p', { className: 'pl-field-hint' }, t('full.import.acceptHint')),
      fileName ? h('p', { className: 'pl-muted' }, fileName) : null,
      reading ? h('p', { className: 'pl-muted' }, t('full.import.reading')) : null,
      error ? h(FPLocalNotice, { kind: 'error', text: error, onDismiss: () => setError(null), dismissLabel: t('common.dismiss') }) : null,
      ...blocks,
      h(
        'div',
        { className: 'pl-import-guide' },
        h('h4', { className: 'pl-import-guide-title' }, t('full.import.fieldTitle')),
        h('p', null, t('full.import.fieldCsv')),
        h('p', null, t('full.import.fieldTags')),
        h('p', null, t('full.import.fieldRating')),
        h('p', null, t('full.import.fieldFormula')),
        h('p', null, t('full.import.fieldRoundtrip')),
      ),
      replaceOpen
        ? h(ConfirmDialog, {
            title: t('full.import.replaceTitle'),
            message: t('full.import.replaceMessage'),
            confirmLabel: t('full.import.replaceConfirm'),
            cancelLabel: t('common.cancel'),
            danger: true,
            t,
            onConfirm: applyJson,
            onCancel: () => setReplaceOpen(false),
          })
        : null,
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Share modal                                                         */
/* ------------------------------------------------------------------ */

function FPShareModal(props) {
  const { t, prompt, onClose } = props;
  const [status, setStatus] = React.useState(null);
  async function copyBody() {
    const ok = await copyText(prompt.body);
    setStatus({
      kind: ok ? 'success' : 'error',
      text: ok ? t('full.share.copied') : t('full.share.copyFailed'),
    });
  }
  function download(ext, mime) {
    const content = ext === 'md' ? '# ' + prompt.title + '\n\n' + prompt.body + '\n' : prompt.title + '\n\n' + prompt.body + '\n';
    const ok = downloadBlob(fpFileBase(prompt.title) + '.' + ext, content, mime);
    setStatus({
      kind: ok ? 'success' : 'error',
      text: ok ? t('full.share.downloaded') : t('common.unknown'),
    });
  }
  return h(
    Modal,
    {
      title: t('full.share.title'),
      onClose,
      closeLabel: t('common.close'),
      footer: h('button', { type: 'button', className: 'pl-btn', onClick: onClose }, t('common.close')),
    },
    h(
      'div',
      null,
      h('p', { className: 'pl-muted' }, t('full.share.hint')),
      h(
        'div',
        { className: 'pl-share-actions' },
        h('button', { type: 'button', className: 'pl-btn', onClick: copyBody }, t('full.share.copy')),
        h(
          'button',
          { type: 'button', className: 'pl-btn', onClick: () => download('md', 'text/markdown;charset=utf-8') },
          t('full.share.downloadMd'),
        ),
        h(
          'button',
          { type: 'button', className: 'pl-btn', onClick: () => download('txt', 'text/plain;charset=utf-8') },
          t('full.share.downloadTxt'),
        ),
      ),
      status
        ? h(FPLocalNotice, {
            kind: status.kind,
            text: status.text,
            onDismiss: () => setStatus(null),
            dismissLabel: t('common.dismiss'),
          })
        : null,
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Entry component                                                     */
/* ------------------------------------------------------------------ */

/** Restore UI preferences defensively; anything invalid falls back to defaults. */
function fpReadUiPrefs(store) {
  let raw = null;
  try {
    raw = store.readUiPrefs();
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') return {};
  const prefs = {};
  if (typeof raw.view === 'string' && VIEWS.includes(raw.view)) prefs.view = raw.view;
  if (typeof raw.quality === 'string' && QUALITY_FILTERS.includes(raw.quality)) prefs.quality = raw.quality;
  if (typeof raw.sort === 'string' && SORTS.includes(raw.sort)) prefs.sort = raw.sort;
  if (typeof raw.tagId === 'string' && raw.tagId) prefs.tagId = raw.tagId;
  if (typeof raw.search === 'string') prefs.search = raw.search;
  return prefs;
}

function FullPanel(props) {
  const store = props.store;
  const locale = props.locale;
  const t = useT(locale);
  const snap = useStore(store);
  const data = snap.data;
  const rootRef = React.useRef(null);
  const narrow = useNarrow(rootRef);
  const initialPrefsRef = React.useRef(undefined);
  if (initialPrefsRef.current === undefined) initialPrefsRef.current = fpReadUiPrefs(store);
  const initialPrefs = initialPrefsRef.current || {};

  const [view, setView] = React.useState(initialPrefs.view || 'all');
  const [tagId, setTagId] = React.useState(typeof initialPrefs.tagId === 'string' ? initialPrefs.tagId : null);
  const [quality, setQuality] = React.useState(initialPrefs.quality || 'any');
  const [sort, setSort] = React.useState(initialPrefs.sort || 'default');
  const [search, setSearch] = React.useState(typeof initialPrefs.search === 'string' ? initialPrefs.search : '');
  const [selectedId, setSelectedId] = React.useState(null);
  const [editor, setEditor] = React.useState(null);
  const [tagsOpen, setTagsOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [shareTarget, setShareTarget] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [flash, setFlash] = React.useState(null);
  const [aiStatus, setAiStatus] = React.useState({ state: 'loading', info: null, error: null });

  /* Persist UI preferences after the first render only: an untouched library
   * must not write to storage just because the panel was opened. */
  const prefsReadyRef = React.useRef(false);
  React.useEffect(() => {
    if (!prefsReadyRef.current) {
      prefsReadyRef.current = true;
      return;
    }
    store.writeUiPrefs({ view, tagId, quality, sort, search });
  }, [view, tagId, quality, sort, search]);

  /* A restored tag may no longer exist; fall back to all tags. */
  React.useEffect(() => {
    if (tagId && !data.tags.some((tag) => tag.id === tagId)) setTagId(null);
  }, [tagId, data.tags]);

  /* AI service status is fetched once per panel mount and retried on demand. */
  const aiStatusSeq = React.useRef(0);
  const aiStatusCleanup = React.useRef(null);
  function reloadAiStatus() {
    aiStatusSeq.current += 1;
    const requestId = aiStatusSeq.current;
    setAiStatus({ state: 'loading', info: null, error: null });
    let controller = null;
    try {
      if (typeof AbortController === 'function') controller = new AbortController();
    } catch {
      controller = null;
    }
    let timer = null;
    if (controller) {
      timer = setTimeout(() => {
        try {
          controller.abort();
        } catch {
          /* ignore */
        }
      }, FP_AI_STATUS_TIMEOUT_MS);
      aiStatusCleanup.current = () => controller.abort();
    }
    const stop = () => {
      if (timer) clearTimeout(timer);
      aiStatusCleanup.current = null;
    };
    requestAiStatus(controller ? controller.signal : undefined).then(
      (result) => {
        stop();
        if (aiStatusSeq.current !== requestId) return;
        if (result && result.ok && result.available) {
          setAiStatus({
            state: 'ready',
            info: {
              provider: result.provider || '',
              model: result.model || '',
              displayName: result.displayName || result.model || '',
              source: result.source || '',
            },
            error: null,
          });
        } else {
          setAiStatus({ state: 'unavailable', info: null, error: result || { code: 'NETWORK' } });
        }
      },
      (failure) => {
        stop();
        if (aiStatusSeq.current !== requestId) return;
        setAiStatus({
          state: 'unavailable',
          info: null,
          error: { code: 'NETWORK', message: String((failure && failure.message) || failure) },
        });
      },
    );
  }
  React.useEffect(() => {
    reloadAiStatus();
    return () => {
      aiStatusSeq.current += 1;
      if (aiStatusCleanup.current) {
        try {
          aiStatusCleanup.current();
        } catch {
          /* ignore */
        }
        aiStatusCleanup.current = null;
      }
    };
  }, []);

  const selectedPrompt = selectedId ? data.prompts.find((prompt) => prompt.id === selectedId) || null : null;
  const prompts = selectPrompts(data, { view, tagId, quality, search }, sort);
  const hasFilters = view !== 'all' || Boolean(tagId) || quality !== 'any' || search.trim() !== '';
  const tags = sortTags(data.tags);
  const sharePrompt = shareTarget ? data.prompts.find((prompt) => prompt.id === shareTarget) || null : null;
  const deletePromptObj = deleteTarget ? data.prompts.find((prompt) => prompt.id === deleteTarget) || null : null;

  function clearFilters() {
    setView('all');
    setTagId(null);
    setQuality('any');
    setSearch('');
  }

  function openEditor(promptId) {
    setExportOpen(false);
    setEditor({ promptId: typeof promptId === 'string' ? promptId : null });
  }

  function handleEditorSaved(id, meta) {
    setEditor(null);
    if (id) setSelectedId(id);
    if (meta && meta.stale) {
      setFlash({ kind: 'info', text: t('full.notice.aiNotAttached') });
    } else if (meta && meta.aiError) {
      setFlash({ kind: 'error', text: meta.aiError });
    } else {
      setFlash(null);
    }
  }

  function confirmDeletePrompt() {
    if (!deletePromptObj) return;
    const result = store.deletePrompt(deletePromptObj.id);
    setDeleteTarget(null);
    if (result && result.ok && selectedId === deletePromptObj.id) setSelectedId(null);
  }

  function downloadRaw() {
    downloadBlob('prompt-library-raw.txt', String(snap.corruptRaw || ''), 'text/plain');
  }

  function resetCorrupted() {
    store.resetCorruptedData();
    setResetOpen(false);
  }

  function exportJson() {
    setExportOpen(false);
    const backup = store.exportBackup();
    downloadBlob(
      'prompt-library-backup-' + fpDateStamp(new Date()) + '.json',
      JSON.stringify(backup, null, 2),
      'application/json;charset=utf-8',
    );
  }

  function exportCsv() {
    setExportOpen(false);
    downloadBlob(
      'prompt-library-' + fpDateStamp(new Date()) + '.csv',
      store.exportCsvText(),
      'text/csv;charset=utf-8',
    );
  }

  function exportTemplate() {
    setExportOpen(false);
    downloadBlob('prompt-library-template.csv', csvTemplate(), 'text/csv;charset=utf-8');
  }

  const bannerList = [];
  if (snap.status === 'corrupt') {
    bannerList.push(
      h(
        'div',
        { key: 'corrupt', className: 'pl-notice pl-notice-error', role: 'alert' },
        h('span', { className: 'pl-notice-text' }, t('full.storage.corrupt')),
        h(
          'div',
          { className: 'pl-notice-actions' },
          h('button', { type: 'button', className: 'pl-btn', onClick: downloadRaw }, t('full.storage.downloadRaw')),
          h(
            'button',
            { type: 'button', className: 'pl-btn pl-btn-danger', onClick: () => setResetOpen(true) },
            t('full.storage.reset'),
          ),
        ),
      ),
    );
  }
  if (snap.status === 'storage-error') {
    bannerList.push(
      h(
        'div',
        { key: 'storage-error', className: 'pl-notice pl-notice-error', role: 'alert' },
        h('span', { className: 'pl-notice-text' }, t('full.storage.errorBody')),
      ),
    );
  }
  if (flash) {
    bannerList.push(
      h(FPLocalNotice, {
        key: 'flash',
        kind: flash.kind,
        text: flash.text,
        onDismiss: () => setFlash(null),
        dismissLabel: t('common.dismiss'),
      }),
    );
  }
  bannerList.push(
    h(NoticeBar, {
      key: 'store-notice',
      notice: snap.notice,
      t,
      onDismiss: () => store.dismissNotice(),
    }),
  );

  const header = h(
    'header',
    { className: 'pl-header' },
    h(
      'div',
      { className: 'pl-header-heading' },
      h('h1', { className: 'pl-header-title' }, t('panel.title')),
      h('p', { className: 'pl-header-subtitle' }, t('full.header.subtitle')),
    ),
    h(
      'div',
      { className: 'pl-header-actions' },
      h(
        'button',
        { type: 'button', className: 'pl-btn pl-btn-primary', onClick: () => openEditor(null) },
        t('full.list.new'),
      ),
      h('button', { type: 'button', className: 'pl-btn', onClick: () => setTagsOpen(true) }, t('full.tools.manageTags')),
      h('button', { type: 'button', className: 'pl-btn', onClick: () => setImportOpen(true) }, t('full.tools.import')),
      h(
        'div',
        { className: 'pl-export' },
        h(
          'button',
          {
            type: 'button',
            className: 'pl-btn',
            'aria-expanded': exportOpen,
            onClick: () => setExportOpen(!exportOpen),
          },
          t('full.tools.export'),
        ),
        exportOpen
          ? h(
              'div',
              { className: 'pl-menu', role: 'menu', 'aria-label': t('full.aria.exportMenu') },
              h(
                'button',
                { type: 'button', className: 'pl-btn', role: 'menuitem', onClick: exportJson },
                t('full.tools.exportJson'),
              ),
              h('p', { className: 'pl-menu-hint' }, t('full.tools.exportJsonHint')),
              h(
                'button',
                { type: 'button', className: 'pl-btn', role: 'menuitem', onClick: exportCsv },
                t('full.tools.exportCsv'),
              ),
              h('p', { className: 'pl-menu-hint' }, t('full.tools.exportCsvHint')),
              h(
                'button',
                { type: 'button', className: 'pl-btn', role: 'menuitem', onClick: exportTemplate },
                t('full.tools.exportTemplate'),
              ),
              h('p', { className: 'pl-menu-hint' }, t('full.tools.exportTemplateHint')),
            )
          : null,
      ),
    ),
  );

  const nav = h(FPNav, {
    key: 'nav',
    t,
    data,
    view,
    quality,
    tagId,
    onView: setView,
    onQuality: setQuality,
    onTag: setTagId,
    onManageTags: () => setTagsOpen(true),
  });
  const list = h(FPPromptList, {
    key: 'list',
    t,
    data,
    prompts,
    hasFilters,
    search,
    sort,
    selectedId,
    onSearch: setSearch,
    onSort: setSort,
    onSelect: setSelectedId,
    onNew: () => openEditor(null),
    onImport: () => setImportOpen(true),
    onClearFilters: clearFilters,
  });
  const detail = selectedPrompt
    ? h(FPDetail, {
        key: 'detail-' + selectedPrompt.id,
        t,
        locale,
        data,
        prompt: selectedPrompt,
        store,
        narrow,
        aiStatus,
        onRetryStatus: reloadAiStatus,
        onBack: () => setSelectedId(null),
        onEdit: () => openEditor(selectedPrompt.id),
        onDelete: () => setDeleteTarget(selectedPrompt.id),
        onShare: () => setShareTarget(selectedPrompt.id),
      })
    : h(
        'section',
        { key: 'detail-empty', className: 'pl-detail-pane pl-detail-empty', 'aria-label': t('full.aria.detail') },
        h(FPEmptyState, { title: t('full.list.noSelection') }),
      );

  const mainChildren = narrow
    ? selectedPrompt
      ? [detail]
      : [nav, list]
    : [nav, list, detail];

  return h(
    'div',
    { ref: rootRef, className: 'pl-panel' + (narrow ? ' pl-panel-narrow' : '') },
    header,
    bannerList.length ? h('div', { className: 'pl-banners' }, bannerList) : null,
    h('div', { className: 'pl-main' + (narrow ? ' pl-main-narrow' : '') }, mainChildren),
    editor
      ? h(FPEditorModal, {
          key: 'editor-' + String(editor.promptId || 'new'),
          store,
          t,
          locale,
          prompt: editor.promptId ? data.prompts.find((prompt) => prompt.id === editor.promptId) || null : null,
          tags,
          aiStatus,
          onRetryStatus: reloadAiStatus,
          onClose: () => setEditor(null),
          onSaved: handleEditorSaved,
        })
      : null,
    tagsOpen ? h(FPTagManagerModal, { store, t, data, onClose: () => setTagsOpen(false) }) : null,
    importOpen ? h(FPImportModal, { store, t, onClose: () => setImportOpen(false) }) : null,
    sharePrompt ? h(FPShareModal, { t, prompt: sharePrompt, onClose: () => setShareTarget(null) }) : null,
    deletePromptObj
      ? h(ConfirmDialog, {
          title: t('full.delete.title'),
          message: t('full.delete.message', { title: deletePromptObj.title }),
          confirmLabel: t('full.delete.confirm'),
          cancelLabel: t('common.cancel'),
          danger: true,
          t,
          onConfirm: confirmDeletePrompt,
          onCancel: () => setDeleteTarget(null),
        })
      : null,
    resetOpen
      ? h(ConfirmDialog, {
          title: t('full.storage.resetTitle'),
          message: t('full.storage.resetMessage'),
          confirmLabel: t('full.storage.resetConfirm'),
          cancelLabel: t('common.cancel'),
          danger: true,
          t,
          onConfirm: resetCorrupted,
          onCancel: () => setResetOpen(false),
        })
      : null,
  );
}
