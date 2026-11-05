# DSH Plugins

面向 [DeepSeek Harness](https://deepseek.com)（DSH）Web UI 的插件集合。每个插件都是独立的 DSH bundle：
Host 半在 `index.js` 里只登记一行清单，界面全部在浏览器半 `client.js` 里实现，挂到 Harness 的
既定槽位（输入框 dock、左侧栏、整页 `main` 面板等）上。颜色统一走主题 token，跟随浅色 / 深色。

## 插件

| 插件 | 简介 | 呈现位置 |
| --- | --- | --- |
| [番茄时钟](pomodoro-clock/) | 专注 / 短休息 / 长休息循环计时器（默认 25 / 5 / 15 分钟，每 4 个专注进入长休息）：进度环倒计时、轮次圆点、今日番茄数、阶段结束提示音、时长与自动开始设置 | `conversation.composer.dock`，输入框下方的环境控件 |
| [人生九宫格](life-grid/) | 年度九宫格规划面板（方法参考《只管去做》第二章）：八个生活领域围绕年度主题，逐领域写目标、星标重点领域、记录五年愿景，按年度保存，支持 JSON 导出 / 导入与 Markdown 复制 | `sidebar.panellist` 侧栏图标 + 整页面板 |
| [待办清单](todo-list/) | 待办任务管理（内部分组 / 截止日期 / 优先级 / 今天与过期筛选 / 拖拽排序 / 行内删除确认）：输入框旁快速记一条，侧栏整页安排；支持 JSON 导出 / 导入与 Markdown 复制 | `conversation.composer.dock` 快速添加 + `sidebar.panellist` 侧栏图标 + 整页面板 |
| [知识树](knowledge-tree/) | 知识梳理工作台，严格按「先列举 → 再归类 → 后成树」三阶段推进：卡片分标题、内容与可选配图（粘贴/拖入，自动压缩）、默认收起点击展开；归类是自动布局的白板，可新建上位主题、把卡片拖到目标卡片上建立归属（拖到专门区域设为顶层，Shift 拖放加关联，不复制卡片），状态分待整理 / 顶层主题 / 已归入上级；成树后做结构检查（环、关联、过宽），树名与保存状态明确，支持 Markdown / Mermaid / JSON / 纯文本导出 | `sidebar.panellist` 侧栏图标 + 整页面板 |

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

各插件可以单独安装，互不依赖。安装后若界面没有立即变化，重启 DSH 或刷新页面。

## 兼容性

- 依赖 DSH 客户端插件机制：`package.json` 中的 `dsh.bundle.patch` 与 `dsh.client`、
  `cordis.patch.yml` 插入 Host 行、`client.js` 通过 `window.__ModuleLoader__.load` 注册浏览器半。
- 只从共享模块表取 `react`，不依赖 Harness 内部包。
- 组件、图标、字体与绘制元素全部随插件打包，无外部资源请求。

## 数据与隐私

所有插件的数据都保存在浏览器 `localStorage`，不经过 Host、不上传：

| 插件 | 存储键 | 内容 |
| --- | --- | --- |
| 番茄时钟 | `dsh-pomodoro-clock:settings:v1`、`dsh-pomodoro-clock:stats:v1` | 时长 / 每轮次数 / 自动开始 / 提示音设置，今日番茄数 |
| 人生九宫格 | `dsh-life-grid/v1` | 按年度保存的九宫格内容（目标、重点领域、年度主题、五年愿景） |
| 待办清单 | `dsh-todo-list/v1`、`dsh-todo-list:ui/v1` | 任务与自建分组，上次选中的分组与筛选 |
| 知识树 | `dsh-knowledge-tree/v2`、`dsh-knowledge-tree:ui/v2` | 阶段、树名、卡片（标题 / 内容 / 归属状态）与链接；上次视图、折叠与展开状态 |

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
└── knowledge-tree/
    ├── package.json        # 包清单：dsh.bundle.patch + dsh.client（web，立即加载）
    ├── cordis.patch.yml    # 插入 Host 行 knowledge-tree
    ├── index.js            # Host 半：空实现，只提供清单条目
    ├── client.js           # 浏览器半：三阶段 store、白板自动布局、拖拽归类、树视图、导出、i18n
    ├── locale/{zh,en}.json # 插件管理器的标题与描述
    ├── icon.svg            # 原创图标（树形节点）
    ├── README.md
    └── DESIGN.md           # 设计稿与决策记录（不随 bundle 发布）
```

## 开发

插件是纯前端 bundle，没有构建步骤，改完 `client.js` 后在 DSH 中重新加载插件即可：

- 元数据（名称、图标、加载方式）在 `package.json` 的 `dsh` 字段；
- 挂载点由 `cordis.patch.yml` 与 `client.js` 里的 slot / key 决定；
- 文案放在 `locale/` 与 `client.js` 内的词典中，支持中英文；
- 数据读写集中在各插件 `client.js` 的存储辅助函数里。

## 许可

尚未指定开源许可证。如需复用，请先联系仓库作者。

---

**English**: A small collection of plugins for the DeepSeek Harness Web UI: a Pomodoro
timer and a quick to-do capture docked under the composer, plus an annual nine-grid
planner, a full to-do page and a three-stage knowledge tree in the sidebar. Each plugin is
an installable DSH bundle; data stays in browser `localStorage`.
