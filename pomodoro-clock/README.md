# 番茄时钟 (Pomodoro Clock)

DeepSeek Harness Web UI 的番茄时钟插件。它作为一条环境控件渲染在消息输入框下方的
`conversation.composer.dock` 槽位里，与上下文计量等控件并排。

## 功能

- **专注 / 短休息 / 长休息** 三阶段循环，默认 25 / 5 / 15 分钟，每 4 个专注后进入长休息。
- **进度环 + 倒计时**：点击计时器开始或暂停；点击进度环旁的阶段名称不改变状态。
- **重置**：把当前阶段重置为完整时长（不清空今日番茄数）。
- **轮次圆点**：显示本轮已完成的专注次数。
- **今日番茄数**：跨刷新保留（本地 `localStorage`），可在设置里重置。
- **设置**：点击右侧滑杆图标，可调整专注 / 短休息 / 长休息时长、每轮专注次数，开关
  “自动开始下一阶段”和“阶段结束提示音”（WebAudio 双音提示）。
- 界面文案走 Harness 客户端 `locale` 服务，支持中文 / 英文；颜色全部使用主题 token，
  跟随浅色 / 深色主题。

## 结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包清单：`dsh.bundle.patch` + `dsh.client`（web，立即加载） |
| `cordis.patch.yml` | 插入 Host 行 `pomodoro-clock` |
| `index.js` | Host 半：空实现，只提供插件清单条目 |
| `client.js` | 浏览器半：计时 store、dock 控件、设置对话框、样式、i18n |
| `locale/en.json`, `locale/zh.json` | 插件管理器的标题与描述元数据 |
| `icon.svg` | 原创图标（番茄 + 钟面） |

## 安装

在 DSH 中通过 Plugin Manager 安装本目录（bundle），或：

```bash
# 在会话里由 Agent 执行 plugin_manager install_bundle，target 指向本目录绝对路径
```

安装后置顶输入框下方会出现「专注 25:00」控件；若当前没有打开的会话，dock 不渲染，
计时器状态仍保留在模块内。

## 说明

- 计时状态保存在插件模块内，切换会话/滚动不会中断；页面刷新会重置进行中的计时
  （设置与今日统计保留）。
- 不依赖任何 Harness 客户端内部包，只从共享模块表取 `react`。
