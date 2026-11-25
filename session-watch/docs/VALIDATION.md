# 验证记录与待验收项

日期：2026-11-19。插件：1.2.3。目标 DSH：0.2.2-rc.3。

## 1.2.3 物理键识别与解释

只读检查实际存储确认快捷键 enabled=true、prefix=Ctrl+;、显示工作台绑定 Ctrl+Alt+M 且局内/局外均开启；不是据用户现象猜测配置。没有直接改写运行中的存储。

新增物理 code 优先解析，覆盖 KeyA–Z、Digit0–9、已支持标点与命名键；未知 code 回退 key，保留 IME229/isComposing/Dead/Process 的禁止路径。新增真实 DOM KeyboardEvent 测试以 key=µ/code=KeyM 在输入区、局外打开工作台，以全角分号/code=Semicolon 和全角字母/code=KeyL 完成局内序列；保留 Ctrl+B 按物理 KeyB 的原生放行，包括录制。当前 build/check及117项测试通过；不将这些测试等同于用户 Desktop 上真实按键验收。

原生主进程同版本 keyboard.ts 已反证“普遍拦截未注册组合键”的猜测：主 frame 非匹配分支在 preventDefault 之前返回。因此未接入实验性原生桥，不以存在独立 native 通道认定本次根因。

诊断在现有设置浮窗内展示就绪、配置和有限事件理由；不增加持久化或新的日志系统。可解释例：ready=true；enabled=true；physical=KeyM；stroke=Ctrl+Alt+M；scope=outside；editing=true；decision=已派发动作。若 events 为空，只能说明未观察到主窗口事件，不能进一步断定系统拦截、焦点错误或业务失败。普通输入不进入诊断，记录上限8条，仅停留在内存。关闭浮窗测试后再打开刷新；打开浮窗时暂停是明确规则，不是失效。

## 1.2.2 Ctrl+B 原生避让

默认公共前缀更换为 Ctrl+;；严格校验拒绝新的 Ctrl+B 前缀、单步和固定序列。旧有效 Ctrl+B 公共前缀在加载时迁移，保留开关、作用域、其它有效键位、关注和布局；冲突则安全禁用。读盘不主动写入，下一次成功状态保存才持久化迁移结果。自定义其它有效前缀不改。

匹配器在前缀等待中也放行 Ctrl+B；录制组合键、序列、公共前缀时遇到 Ctrl+B 会取消录制并交还原生，不 preventDefault、不阻止传播。真实 DOM 测试验证原生 document 监听能收到事件；同时验证输入区、局内/局外、等待序列、配置迁移及后续成功保存。全110项测试通过，build/check通过；JSDOM依然不是已认证原生页面或OS键位验收。

仅核对同版本 ui-layout/ui-sidebar 及 shortcuts binding/native 的部分声明，未发现 Ctrl+; 已占用；不承诺全平台或用户自定义覆盖都无冲突。原生 Web registry 对 Control+Semicolon 的支持限制不等于本插件现有 DOM 适配器已通过所有浏览器验收。此版本不处理或宣称修复右侧栏卡死，也不自动启用插件。

## 1.2.1 快捷键设置浮窗

设置区改为独立于 main/aside 的工作台根节点覆盖层，绝对定位，不占分屏空间；不移动或卸载已有原生会话。打开时 main/aside 设置 inert，设置浮层使用 dialog 语义、焦点约束、关闭后焦点恢复；未保存/保存中/录制时 Esc 与遮罩均保留原有安全边界。

build/check/test 全部通过：103项，0失败。新增浮窗语义、Tab/Shift+Tab 循环、背景焦点约束、Esc/遮罩关闭守卫及录制取消测试；整包挂载同时断言浮窗为工作台根直接覆盖层、背景 inert 恢复、原生输入 DOM 不重建和关闭后恢复焦点。仍未把JSDOM行为断言视为当前已认证GUI像素验收。

## 1.2.0 快捷键与设置

最终执行 npm run build、npm run check、npm test：100项通过，0失败。Node官方bridge类型擦除实验性警告仅来自测试，不进入运行时代码。

新增独立纯配置/匹配模块、浏览器按键适配器和工作台内设置页。7组默认操作拆成13个可单独配置的动作；配置附加到version1状态，不清空关注或布局。局内/局外非互斥，省略默认local，workbench.show默认明确同时启用两者。

匹配器覆盖组合键、公共前缀/固定两步序列、1200ms超时、作用域交集冲突、单步与前缀冲突、非法/保留键、输入法229与composing、编辑区箭头保护及重复按键。DOM适配器在window capture只消费可执行绑定，关闭/卸载会移除监听和定时器；失焦清前缀并解除陈旧输入法锁。

React模块挂载回归使用native Factory替身验证真实键盘事件路径：选中与实际焦点同步、保持textarea选区、空窗格、边界、上一窗格、搜索、聚焦原生输入、最大化切窗、设置总开关与录制、未保存草稿不生效、ACK后应用、恢复默认和局外显示入口。没有新增prompt/cancel/批准快捷动作。设置页另有真实helpers及测试替身覆盖，不冒充真正DSH原生编辑器。

真实HTTP→官方bridge→官方JSON后端新增配置保存/GET重新读取/磁盘内容一致性校验；真实JSON后端关闭重启后核实自定义前缀和总开关恢复。还测试过期配置不能覆盖其他页面设置，以及未收到ACK时有效键位仍为旧值。

当前自动化不证明OS会向网页交付全部组合键，也不证明Lexical原生选区在所有重挂情况下恢复。安装结果另以plugin_manager返回为准；当前已认证GUI视觉和系统快捷键仍需实际验收。

## 1.1.0 原生 Conversation 多窗格

用户明确确认不再要求 readOnly，允许原生输入、审批和停止交互。已将分屏正文替换为官方 conversation.content 的 embedded Factory，删除旧纯文本 Transcript 组件。main 只声明自有 session-watch.native/session Slot，不覆盖全局原生 Composer/View。可见窗格各自持有原始 SessionReference 对象并传入 SessionProvider；不是传字符串 id，也不借用全局当前 Session。

通用 CSS 重置排除了原生区域，防止工作台把原生 Markdown 段落和输入控件重新格式化。标题仍为原生 displayTitle，并加大加粗。卡片保留轻量安全摘要；分屏不再限制最近 80/400 条文本预览，历史/滚动由原生会话处理。

自动化新增官方 SlotCore 注册/卸载合同测试，确认自有 Session 子 Slot 可声明并正确级联移除；React fixture 使用 native Factory 测试替身，严格检查 Provider 收到 retain 返回的原对象、a/b 两窗格隔离、仅显式发送 b/停止 a 才触发对应调用、自动调用为零、模式切换/最大化/卸载释放引用且重挂不重放动作。该 fixture 不等于真实 DSH 原生 Chat 的像素或审批业务验收。

实际安装结果仍以 plugin_manager 返回为准；当前登录页的原生 Markdown、附件、批准、快捷键与长历史滚动恢复需要实际 GUI 确认，不以 Slot 注册成功替代视觉验收。详见 NATIVE_RENDERING 文档。

## 1.0.4 真实会话名称

已核实原生标题使用 SessionSummary.displayTitle，title projection 是 string|null，不是 {title:string}。标题 helper 现优先采用 displayTitle，缺失时读取指定 title projection，最后显示“未命名会话”；不再扫描其它 projection 或以 session ID 共有前缀充当标题。原生重命名随列表快照更新传播到卡片、窗格、搜索及关注列表。

窗格标题由 12px 改为 16px/700，允许两行；卡片标题也加大加粗。53 项测试通过，新增四项标题回归，并将 React 挂载数据改成真实合同的 displayTitle+字符串 projection，断言窗格选择正确标题而非旧 projection。

1.0.4 调查阶段当时尚未启用原生渲染（此限制已由用户在 1.1.0 明确取消）：工作台可作为 presentation host 复用 conversation.content embedded Factory，但该 Factory 包括 Composer/审批，且正文也可能触发原生交互。没有以 CSS 隐藏输入框冒充严格只读；需明确是否允许工作台内原生操作后继续接入，详见 NATIVE_RENDERING 文档。

## 1.0.3 星标无响应修复

用户截图中的按钮无响应，根因是初始化 GET 所在路由配置了 streaming。官方 http-bridge 对 streaming 请求无条件附加 ReadableStream 请求体，构造 GET Request 时因此抛错，导致初始化失败；旧按钮随后一直 disabled，且没有反馈。这是旧模拟测试直接调用 handler、没有经过实际桥接层而漏测的缺陷。

修复为 GET `/api/session-watch/state` + buffered、POST `/api/session-watch/update` + streaming。保留认证与 owner 限制，保存仍以流读取并限制 32 KiB。客户端刷新去重；失败后星标可点击重试，显示加载中/保存中/已关注/失败提示，不再静默禁用。

`npm test`：49 项通过，0 失败。新增测试执行同版本官方发布的 http-bridge 源码（只用 Node 内置 stripTypeScriptTypes 去除类型，不改逻辑），通过隔离的真实 loopback HTTP 服务复现旧 GET 500，并验证修复后的 GET 200 → POST 关注 → GET 重新读取 → POST 取消关注。底层为真实 JsonStorageBackend，测试身份仅存在于隔离环境，不获取或绕过当前 DSH 认证。未带测试身份的 GET/POST 均为 403。这个临时服务只在单元测试内存在，测试结束关闭，不是替代当前 GUI 的服务器。

React 挂载回归另补标题星标关注/取消关注、保存失败回滚与可见提示、初始化失败后一次点击重试并关注成功。此前的 48 项检查继续通过。测试会输出 Node 类型擦除 API 的实验性警告，不影响通过结果；该 API 仅用于开发测试，不进入插件运行时代码。

本版本实际安装结果以 plugin_manager 的返回为准；没有声称在未经认证的自动化浏览器中点击过用户当前页面。

## 1.0.2 历史真实激活结果

- plugin_manager 安装并启用 `@local/session-watch@1.0.2`：`application: applied`、`enabled: true`、`warnings: []`。
- 运行时 Client Slots 检查：`sidebar.panellist` 中 `session-watch` 为 `active: true`，order 24；证明客户端模块已加载并注册侧栏入口。
- 没有启动替代服务器，没有更改文件工具设置，没有获取或导出浏览器认证凭据。

## 已修复的激活错误

### 存储单元名称

初版使用 `session-watch`，官方 JSON 后端拒绝。已从与安装版本一致的公开官方包源码核实 `UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/`：连字符非法。生产描述符现为 `session_watch`。

显式依赖 `storage.backend.json` 并选择已注册的 `json` 后端，避免后端注册竞态或误选其它 KV 提供者。旧非法名称在后端校验阶段即被拒绝，没有成功建立存储文件，因此不需要搬迁旧文件。

### 精确 Fetch 路由

存储修复后，真实激活继续指出注册路径 `/session-watch/state` 不合法。官方 Connection 的精确路由要求包含 `/api/` 前缀，现注册 `/api/session-watch/state`、`/api/session-watch/status`，与客户端访问地址一致。保留原有 DSH 认证、所有者限制、请求体上限和修订号检查。

契约来源：[官方存储包 0.2.2-rc.3](https://registry.npmjs.org/@deepseek-ai%2Fdsh-storage-json/0.2.2-rc.3)，以及同版本 `@deepseek-ai/dsh-storage` 和 `@deepseek-ai/dsh-client-connection` 的公开 npm 包源码；它们仅作开发依赖或核对资料，不增加插件的第三方运行时依赖。

## 1.0.2 基础验证：48 项全部通过（1.0.3 为 49 项）

- `npm run build` 和 `npm run check` 通过。
- 状态核心：关注去重、200 项上限、窗格绑定唯一、隐藏窗格恢复、布局比例、已读单调递增、排序、异常持久化数据。
- 消息预览：白名单文本、推理/开发者/系统消息过滤、工具只显示名称、流式文本聚合、历史替换处理与稳定消息身份。
- Host 模拟集成：串行持久化、CAS 冲突、保存失败恢复、未知版本拒绝、请求体大小限制、所有者认证、被动状态查询，以及完整 API 路径的注册断言。
- 客户端模拟集成：乐观队列、409 重试、迟到响应不覆盖新状态、订阅去重与上限、初始化异常释放、翻页保留未读水位、按消息锚点恢复阅读窗口。
- React + JSDOM：批量关注、卡片、四宫格、最大化/恢复、移出分屏、取消关注/撤销、原会话导航、返回入口、卸载后订阅归零；不调用 prompt/cancel，不展示推理内容。
- 三项新增官方后端测试（不使用存储替身）：旧非法名称真实拒绝、新生产描述符真实打开；关注/布局/已读真实写盘，关闭并新建后端实例后原样读取；插件初始化及卸载释放存储句柄，关闭后可重新打开。

## 尚未宣称完成的验收

自动化浏览器尚未通过当前 DSH 本地页面认证，先前用户选择暂不现场操作，因此没有声称完成生产页面全动线验收或提供生产页面截图。仍需人工或后续已认证浏览器检查：真实标题 projection、菜单主动关闭、消息替换区间边界、transient 收敛、断线重连、阅读恢复、窄屏与深浅主题。

后续动线：关注四个已有会话 → 卡片确认标题/状态 → 放入四屏 → 独立滚动及暂停跟随 → 检查新输出/未读 → 打开原会话 → 返回阅读位置 → 刷新恢复布局 → 断线重连。

**结论：激活错误已修复，当前配置档成功启用，侧栏入口已挂载；不将这些证据扩大为完整 GUI 验收完成。**
