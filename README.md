# DSH Plugins

面向 [DeepSeek Harness](https://deepseek.com)（DSH）Web UI 的插件集合。每个插件都是独立的 DSH bundle：
基础插件的 Host 半只登记清单；知识树另有已鉴权的 GitHub 同步 Host 服务；提示库另有可选的 AI 评价 Host 路由（复用 DSH 已配置的模型服务）。界面在浏览器半 `client.js` 里实现，挂到 Harness 的
既定槽位（输入框 dock、左侧栏、整页 `main` 面板等）上。颜色统一走主题 token，跟随浅色 / 深色。

## 插件

| 插件 | 简介 | 呈现位置 |
| --- | --- | --- |
| [番茄时钟](pomodoro-clock/) | 专注 / 短休息 / 长休息循环计时器（默认 25 / 5 / 15 分钟，每 4 个专注进入长休息）：进度环倒计时、轮次圆点、今日番茄数、阶段结束提示音、时长与自动开始设置 | `conversation.composer.dock`，输入框下方的环境控件 |
| [人生九宫格](life-grid/) | 年度九宫格规划面板（方法参考《只管去做》第二章）：八个生活领域围绕年度主题，逐领域写目标、星标重点领域、记录五年愿景，按年度保存，支持 JSON 导出 / 导入与 Markdown 复制 | `sidebar.panellist` 侧栏图标 + 整页面板 |
| [待办清单](todo-list/) | 待办任务管理（内部分组 / 条目切换分组 / 截止日期 / 优先级 / 今天与过期筛选 / 拖拽排序 / 行内删除确认）：输入框旁快速记一条，侧栏整页安排；点任务的分组徽标或拖到侧栏分组即可换组；支持 JSON 导出 / 导入与 Markdown 复制 | `conversation.composer.dock` 快速添加 + `sidebar.panellist` 侧栏图标 + 整页面板 |
| [知识树](knowledge-tree/) | 知识梳理工作台，严格按「先列举 → 再归类 → 后成树」三阶段推进：卡片分标题、内容与可选配图（粘贴/拖入，自动压缩）、默认收起点击展开；归类是自动布局的白板，可新建上位主题、把卡片拖到目标卡片上建立归属（拖到专门区域设为顶层，Shift 拖放加关联，不复制卡片），状态分待整理 / 顶层主题 / 已归入上级；成树后做结构检查（环、关联、过宽），树名与保存状态明确，支持 Markdown / Mermaid / JSON / 纯文本导出 | `sidebar.panellist` 侧栏图标 + 整页面板 |
| [提示库](prompt-library/) | 提示词管理：集中保存、标签分类、收藏 / 置顶 / 最近使用、搜索与组合筛选、1～5 星半星个人评分（评分关联正文版本，改正文后标记「待复评」）、评价备注、可选的 AI 辅助评价（仅用户主动触发、≤200 字、仅供参考）、CSV 交换与 JSON 完整备份；复制或安全插入当前草稿 | `sidebar.panellist` 侧栏图标 + 整页面板；`conversation.input.right` 输入框旁快捷选择面板 |

## 安装

前置条件：已安装 DeepSeek Harness，插件管理器（`plugin_manager`）可用。

```bash
git clone git@github.com:wngzwng/dsh-plugins.git
```

然后在 DSH 的 Plugin Manager 中安装对应目录（bundle），或在会话中让 Agent 执行
`plugin_manager install_bundle`，`target` 指向仓库内插件目录的绝对路径：

- `<repo>/pomodoro-clock` — 输入框下方出现「专注 25:00」控件
- `<repo>/life-grid` — 左侧栏出现九宫格图标，点开是整页面板
- `<repo>/todo-list` — 输入框下方出现「待办」控件，左侧栏出现待办图标
- `<repo>/knowledge-tree` — 左侧栏出现知识树图标，点开是整页工作台
- `<repo>/prompt-library` — 左侧栏出现提示库图标，点开是整页管理；输入框旁出现「提示库」快捷入口（安装前先运行 `node prompt-library/build-client.mjs`）

各插件可以单独安装，互不依赖。安装后若界面没有立即变化，重启 DSH 或刷新页面。

## 兼容性

- 依赖 DSH 客户端插件机制：`package.json` 中的 `dsh.bundle.patch` 与 `dsh.client`、
  `cordis.patch.yml` 插入 Host 行、`client.js` 通过 `window.__ModuleLoader__.load` 注册浏览器半。
- 只从共享模块表取 `react` / `react-dom`（提示库用 `createPortal` 在 composer 外层渲染弹层），不依赖 Harness 内部包。
- 组件、图标、字体与绘制元素随插件打包。知识树仅在用户主动操作 GitHub 同步时通过 Host 访问 GitHub API。

## 数据与隐私

默认保存在当前浏览器：基础插件使用 `localStorage`，知识树 v2.0 使用 IndexedDB。知识树可选择连接 GitHub，经 Host 手动读取/推送；只有主动 Push 才上传正文与图片，公开仓库内容公开可见。其他插件不上传：

| 插件 | 存储键 | 内容 |
| --- | --- | --- |
| 番茄时钟 | `dsh-pomodoro-clock:settings:v1`、`dsh-pomodoro-clock:stats:v1` | 时长 / 每轮次数 / 自动开始 / 提示音设置，今日番茄数 |
| 人生九宫格 | `dsh-life-grid/v1` | 按年度保存的九宫格内容（目标、重点领域、年度主题、五年愿景） |
| 待办清单 | `dsh-todo-list/v1`、`dsh-todo-list:ui/v1` | 任务与自建分组，上次选中的分组与筛选 |
| 知识树 | IndexedDB `dsh-knowledge-tree-library`；引导语 localStorage `dsh-knowledge-tree:prompts/v1` | 多棵本地树、配图、同步基线、远端只读缓存与恢复快照；保留旧 localStorage 迁移源 |
| 提示库 | `dsh-prompt-library/v1`、`dsh-prompt-library:ui/v1` | 提示词、标签及排序、收藏 / 置顶 / 使用记录、个人评分与备注（含正文版本关联）、AI 评价（含模型、时间与输入快照），以及视图 / 筛选偏好 |

换浏览器、清缓存或换设备前，建议用各插件右上角的「导出 JSON」留一份备份。

## 目录结构

```text
dsh-plugins/
├── README.md
├── .gitignore
├── pomodoro-clock/
│   ├── package.json        # 包清单：dsh.bundle.patch + dsh.client（web，立即加载）
│   ├── cordis.patch.yml    # 插入 Host 行 pomodoro-clock
│   ├── index.js            # Host 半：空实现，只提供清单条目
│   ├── client.js           # 浏览器半：计时 store、dock 控件、设置对话框、样式、i18n
│   ├── locale/{zh,en}.json # 插件管理器的标题与描述
│   ├── icon.svg            # 原创图标（番茄 + 钟面）
│   └── README.md
├── life-grid/
│   ├── package.json        # 包清单：dsh.bundle.patch + dsh.client（web，立即加载）
│   ├── cordis.patch.yml    # 插入 Host 行 life-grid
│   ├── index.js            # Host 半：空实现，只提供清单条目
│   ├── client.js           # 浏览器半：九宫格页面、侧栏图标、数据读写、i18n、样式
│   ├── locale/{zh,en}.json # 插件管理器的标题与描述
│   ├── icon.svg            # 原创图标（九宫格，中心格高亮）
│   └── README.md
├── todo-list/
│   ├── package.json        # 包清单：dsh.bundle.patch + dsh.client（web，立即加载）
│   ├── cordis.patch.yml    # 插入 Host 行 todo-list
│   ├── index.js            # Host 半：空实现，只提供清单条目
│   ├── client.js           # 浏览器半：store、dock 快速添加、整页面板、样式、i18n
│   ├── locale/{zh,en}.json # 插件管理器的标题与描述
│   ├── icon.svg            # 原创图标（清单卡片 + 勾选框）
│   ├── README.md
│   └── DESIGN.md           # 设计稿与决策记录（不随 bundle 发布）
├── knowledge-tree/
    ├── package.json        # 包清单：dsh.bundle.patch + dsh.client（web，立即加载）
    ├── cordis.patch.yml    # 插入 Host 行 knowledge-tree
    ├── index.js            # Host 半：空实现，只提供清单条目
    ├── client.js           # 浏览器半：三阶段 store、白板自动布局、拖拽归类、树视图、导出、i18n
    ├── locale/{zh,en}.json # 插件管理器的标题与描述
    ├── icon.svg            # 原创图标（树形节点）
    ├── README.md
    └── DESIGN.md           # 设计稿与决策记录（不随 bundle 发布）
```

`prompt-library/` 的结构不同于基础插件：Host 半有两条 AI 评价路由，浏览器半由
`client.js` 骨架 + `core.js` 纯逻辑 + `src/full-panel.js` / `src/quick-picker.js` 两个 UI
片段组成，构建脚本把它们嵌入 `client.js`：

```text
prompt-library/
├── package.json        # 包清单：dsh.bundle.patch + dsh.client（web，立即加载）
├── cordis.patch.yml    # 插入 Host 行 prompt-library
├── index.js            # Host 半：AI 评价 status/review 路由（可选 webServer / llm）
├── core.js             # 纯数据逻辑（评分版本、排序、搜索、CSV / JSON、200 字校验），Host 与 Client 共享
├── client.js           # 浏览器半骨架：i18n、store、共享组件、槽位注册；含生成块
├── src/full-panel.js   # UI 源片段：整页管理面板（被 build 嵌入 client.js）
├── src/quick-picker.js # UI 源片段：输入框快捷入口与快捷选择面板
├── build-client.mjs    # 构建：把 core.js 与 src/*.js 嵌入 client.js
├── locale/{zh,en}.json # 插件管理器的标题与描述
├── icon.svg            # 原创图标（书页 + 星标）
├── README.md
└── DESIGN.md           # 设计契约与实现记录（不随 bundle 发布）
```

## 开发

基础插件为纯前端 bundle；知识树增加 Host 服务，修改 `library.js` 或 `workspace-ui.js` 后先运行 `node knowledge-tree/build-client.mjs` 重新嵌入 Client；提示库修改 `core.js` 或 `src/*.js` 后先运行 `node prompt-library/build-client.mjs`。之后重新加载插件并刷新现有 DSH 页面：

- 元数据（名称、图标、加载方式）在 `package.json` 的 `dsh` 字段；
- 挂载点由 `cordis.patch.yml` 与 `client.js` 里的 slot / key 决定；
- 文案放在 `locale/` 与 `client.js` 内的词典中，支持中英文；
- 数据读写集中在各插件 `client.js` 的存储辅助函数里；
- 集成检查：`node prompt-library/build-client.mjs && node --test tests/*.test.js`（各插件，无额外依赖）。

## 许可

尚未指定开源许可证。如需复用，请先联系仓库作者。

---

**English**: A small collection of plugins for the DeepSeek Harness Web UI: a Pomodoro
timer and a quick to-do capture docked under the composer, plus an annual nine-grid
planner, a full to-do page, a three-stage knowledge tree and a prompt library in the
sidebar. Each plugin is an installable DSH bundle; data stays in the browser
`localStorage`. The prompt library adds a quick picker beside the composer for copying or
safely inserting a prompt into the current draft, local half-star personal ratings with
body-version awareness, CSV exchange / JSON backup, and an optional user-triggered AI review
that runs on the Host through the configured DSH model service.
