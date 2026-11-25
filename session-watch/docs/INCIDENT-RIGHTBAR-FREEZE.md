# 原会话右侧栏卡住：调查记录（未确认根因）

## 用户报告与边界

- 路径：会话工作台 → 打开原会话 → 打开右侧文件／终端／浏览器侧栏 → DSH 无响应。
- 用户确认当时快捷键设置浮窗已关闭，或没有打开过；不应直接归因于设置浮窗焦点约束。
- 已经用户授权，临时停用 @local/session-watch；管理器返回 applied，并通过 Client Slots 确认 session-watch.native 不再可用。
- 未卸载插件，未删除关注配置或会话数据，未重启应用，未重新启用插件。
- 当前仍等待停用后的同会话、同窗口宽度对照结果。

## 已取得的证据

1. 当前 Host HTTP 入口立即返回认证状态，Client Inspect 也能响应。因此采样时不是持续的 Host/Client 全面失联，不代表故障路径不会再次触发。
2. 系统存在 2026-11-18 13:55:31（UTC+8）的旧 Renderer 崩溃记录：EXC_BREAKPOINT / SIGTRAP，触发线程 CrRendererMain。应用日志没有捕获到 error-level Renderer console 输出。未取得该故障与用户本次操作的时间对应关系，不能将这份日志直接认作右侧栏根因。
3. 当前 Renderer 的两秒系统栈采样（17:27）主线程大多数采样停在事件等待，物理占用约 616 MiB。此采样不是故障瞬间，不能用于排除瞬时循环、内存峰值或布局问题。
4. 崩溃前两分钟的系统 error/fault 日志仅看到输入法服务的 NSSecureCoding 告警，没有能够把崩溃归到本插件的 JS 堆栈或右侧栏错误。不能将时间接近当因果。

## 源码排查

- 同版本官方 MainPanel 根据 activePanelId 渲染唯一 main keyed entry；uiWorkspace.openSession 最后选择原生 Conversation。源码不支持默认保活全部历史工作台面板的猜测。
- 工作台与 NativePane 卸载时分别释放监控订阅与 controllerOperation 引用；动态返回工作台按钮有单独的插件级生命周期。
- openSession 会额外注册原会话标题区的返回按钮。这是离开工作台后明确仍存在的 UI 增量，可能影响窄宽度布局，但没有证据证明它会造成 ResizeObserver 振荡。
- 设置浮窗存在 document 级 focusin 回抢与全窗口 Esc/Tab 捕获的防御性风险；但用户报告未开设置，正常导航也应卸载其监听。不能冒充本次根因。
- refresh 在通知订阅者后才建立在途 Promise；隔离诊断已复现同步订阅重入打穿去重：限制为4次重入时出现5次模拟GET和15次通知。仅在诊断VM内先建立锁再通知，得到1次模拟GET和3次通知。可通过 diagnostics/refresh-reentry.mjs（加 --candidate 比较内存候选）重做；不联系真实DSH、不修改生产代码或配置。但当前实际 React 订阅链没有明确再次调用 refresh 的路径，不能冒充侧栏根因。

## 新增隔离回归

新增 test/incident-navigation.test.js，执行现有 client.js：

- 用共享 Session binding/generation 与 source 计数，而不是每次 retain 制造互不相关 binding。
- 模拟经源码核实的 main keyed 切换，以及真实打开会话时的 mainView retain/旧引用释放语义。
- 连续 20 次工作台 → 原会话 → 返回；交替覆盖未开设置与打开后关闭设置两种前置状态。
- 每次离开后 controllerOperation 引用归零，mainView 恰为一个，document capture focusin 监听归零，返回按钮占位不增长。
- 侧栏输入自动聚焦可用；最终所有引用和订阅释放。

该测试通过，但使用简化的右侧栏与原生会话展示替身，不含真正 Electron 原生键盘桥、CSS 尺寸测量、ResizeObserver 或右侧文件／终端／浏览器业务组件。它只排除所模拟条件下的生命周期泄漏，不证明用户故障已修复。

## 原生右侧栏的额外核实

- 原生右栏 Session View 有自己的 sidebarView 引用。已初始化的 keepMounted 正文可以在切会话、收起右栏或切换全局 main 面板后保留；其释放不由 session-watch 决定。
- 本版本内建 Desktop browser 的注册明确为 keepMounted: desktop !== undefined。terminal 正文没有设置 keepMounted，默认 false；终端进程独立存活不能当作 React 正文保活。这两者必须分开。
- 非当前 View 没有正文 hold 后会先 retire，再等最后一个 React mount 清理后释放 reference；右栏插件本身 dispose 才直接清理所有 View。
- SidebarRight 的滑入动画确实驱动 window-drag 几何标记逐帧测量；全屏路径也等待 transform transition 后报告布局。存在该链不等于已经证明它造成崩溃，源码引用的 Electron #32341 不能视为本次 SIGTRAP 的匹配证据。
- 同进程停用 session-watch 不等于清空原生 sidebarView。因此停用对照只用于缩小范围，不能仅凭仍卡就完全排除历史触发影响；未获授权时不重启或关闭原生视图。

同版本公开证据：

- https://unpkg.com/@deepseek-ai/dsh-client-ui-sidebar-browser@0.2.2-rc.3/src/client/index.ts
- https://unpkg.com/@deepseek-ai/dsh-client-ui-sidebar-terminal@0.2.2-rc.3/src/client/index.ts
- https://unpkg.com/@deepseek-ai/dsh-client-ui-sidebar-right@0.2.2-rc.3/src/client/session-view.ts
- https://unpkg.com/@deepseek-ai/dsh-client-ui-sidebar-right@0.2.2-rc.3/src/client/session-views.ts
- https://unpkg.com/@deepseek-ai/dsh-client-ui-sidebar-right@0.2.2-rc.3/src/client/shell/SidebarRight.tsx

公开源码中的只读取证点：sidebarRight 的 mounted/openTabs（元数据不等于正文已挂载），sessions 目录的 retainedBy.sidebarView，DOM 的 data-sidebar-right-session/hidden、data-sidebar-right-panel、data-sidebar-right-open、data-sidebar-right-opening 与 webview[data-sidebar-browser-frame="webview"]。当前 Client Inspect 返回 no catalogued Service named sidebarRight；这是目录未提供该查询，不证明服务没有运行，更不能把这次查询报错当成 UI 冻结证据。仅返回契约的 Inspect 也不能直接读取上述业务快照；实际取值仍需要已认证页面的观察权限。

## 待验证

1. 停用插件后，原会话相同右侧面板是否仍卡住。
2. 明确右侧具体哪个面板，以及鼠标点击还是快捷键触发、是否固定会话与窗口宽度才出现。
3. 如只在启用时出现，获授权后分别隔离返回按钮、原生标题关注按钮、全局快捷键处理；不同时改变多个变量。
4. 需要真实已认证 GUI 与故障瞬间性能/控制台证据，才能验证原生布局与右侧业务链。当前自动化浏览器只有认证提示，未绕过认证。
