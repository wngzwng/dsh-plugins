# 原生会话嵌入（1.1.0）

用户已确认取消只读限制，允许原生输入、审批及停止等交互。当前源码使用官方 embedded Conversation，不是复制消息文本或自己写 Markdown。

## 渲染结构

工作台在其 main 注册中声明自有的 `session-watch.native` 子 Slot（single/session），因而获得 SessionProvider/renderSlot。每个可见窗格明确 retain 自己的 SessionReference，将原始引用对象传给 SessionProvider；其下的自有 Session Slot 获得会话标准 hooks 和正确 sessionId，调用 renderFactorySlot('conversation.content', {variant:'embedded', phase, hero})。

Provider 的 session 参数必须是 **SessionReference**，不是 ID 字符串。该精确类型来自 0.2.2-rc.3 官方 ui-session 的 SlotScopeTargetMap。phase/hero 按同版本主会话的生命周期派生。

输入、Composer/批准选择链、Chat 节点、Markdown、图片及工具展示由 DSH 的原生工厂拥有。没有替换全局 conversation.session、conversation.view 或 conversation.composer.bar，没有隐藏输入伪装只读，也不把 workbench 注册成新的业务处理 target。

## 状态与生命周期

- 标题直接采用原生 SessionSummary.displayTitle，再回退到字符串 title projection。
- 每个可见窗格拥有自己的引用；切换卡片、隐藏、替换及卸载时释放。框架 Provider 只消费引用，不替插件拥有它。
- 原生正文和输入在同一个显式 Session Provider 下，不借用主面板当前选择；不同会话不应串输入目标。
- 相同 Session 的原生草稿/视图共享语义仍保留；这里没有制造独立会话副本。
- 原生布局区域排除工作台通用按钮/段落/input CSS 重置，避免破坏原生 Markdown 段落和控件样式。
- 原生渲染异常提供可见错误、重试及打开原会话入口。不会降级成纯文本却声称原生成功。
- 读到 native scrollport 底部时更新工作台已读水位；内容自身的滚动、历史消费和跟随由原生视图负责。

## 验证边界

使用同版本官方 SlotCore 校验子 Slot 声明和卸载级联；React fixture 使用 **native Factory 测试替身**，验证原始 Reference 身份、会话作用域、没有自动 prompt/cancel、显式用户动作只作用对应会话，以及卸载/模式切换的引用释放。该 fixture 不证明原生 Chat 的最终像素或所有业务控件行为。

仍需在已认证的当前 GUI 中确认真实 Markdown/工具卡片、原生批准控件、长对话滚动恢复、窄屏和焦点/快捷键。运行时 Slots 检查也只证明注册状态，不冒充真实页面视觉验收。没有修改 DSH 核心或启动替代 GUI 服务。
