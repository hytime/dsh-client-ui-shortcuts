# Changelog

`@hytime/dsh-client-ui-shortcuts` 的重要变更记录如下。

## 0.1.13 - Git 源码安装与包元数据

### 修复

- 新增 `prepare` 生命周期脚本并复用独立的 `bundle` 构建，使固定 GitHub source 的安装能够生成全部发布用 `lib/` 入口。
- 补齐规范的仓库、主页和 issue tracker 元数据，使 npm 消费者及插件目录能够将包映射到对应 GitHub 源码仓库。

### 变更

- 文档明确推荐安装预构建的 npm 包，并说明固定 GitHub source 安装及 pnpm `allowBuilds` 要求。

## 0.1.12 - 物理修饰键与可靠的全局导航

### 新增

- 新增平台感知的 SVG 键帽，覆盖 Command、Windows/Meta、Control、Option/Alt、Shift、导航键和普通字符。
- 新增浏览器安全的全局快捷键，可在可编辑控件获得焦点时工作，并在不创建空白替代项的情况下导航现有 Session 和 Workspace。
- 切换到折叠的目标 Workspace 时，先自动展开该分组，再打开选中的 Session。

### 修复

- 保存自定义 binding 后继续保持 `Custom` profile，并在持久化过程中保留 settings controller 上下文。
- 在交互卡片中展示问题选项描述，并正确处理长文本换行。
- 根据物理事件 code 规范化受键盘布局影响的输入，包括 macOS Option/Shift 组合。
- 从导航目标中过滤空白、已归档及 subagent Session，并拒绝已知的浏览器保留组合键和冲突 binding。

### 变更

- 移除公开的 `Mod` 修饰键。设置和规范化 binding 只使用物理 `Meta`、`Ctrl`、`Alt`、`Shift`；旧持久化数据中的 `Mod` 会迁移为 `Meta`，且不会再次写回。
- 快捷键冲突标识不再依赖平台，平台差异只用于键帽展示。

## 0.1.11 - 全局快捷键与 Custom profile

### 新增

- 新增可编辑的 `Custom` profile，支持持久化 binding，以及 `Meta`、`Ctrl`、`Alt`、`Shift` 这几种显式修饰键、候选绑定和有界两段 chord。旧的持久化 `Mod` 仅作为兼容输入迁移为 `Meta`，不会写回。
- 新增 capability-aware 全局动作，支持 session/Workspace 导航、新建及分支会话，以及主题切换。
- 新增由 Client fiber 管理的全局 keyboard router，并保护可编辑控件、IME composition、重复事件、pending question/approval takeover 和宿主 popup。
- 新增按 global scope 分组的快捷键行；当前 DSH composition 不具备能力时会隐藏对应动作。

### 修复

- 进入带有 pending interaction 的 session 时，自动聚焦 question/approval 的首个可操作控件；当前版本优先保证键盘可立即操作，不保留外部编辑器或 popup 焦点。
- 修复 question 自定义输入框和无选项 textarea 在受控文本更新时丢失焦点的问题。

### 变更

- 由于 DSH 没有公开的设置 opener，设置绑定保持隐藏且不激活；插件不会使用私有 DOM 路由。
- 文档明确 DSH CLI 安装和真实 composition 验证是受支持的集成路径。

## 之前的版本

### 修复

- 单选选项已选中时按 Enter，现在会提交当前答案。


### 修复

- 增加上一题操作，并在多题流程中保留之前的答案。
- 使用 DSH foreground token 修复键盘 focus 时主提交按钮文字对比度问题。


### 修复

- 恢复 DSH button reset，避免问题选项渲染成过大的原生灰色按钮。
- 增加键盘 focus/hover 状态，并为多选项增加明确的 check icon。
- 分离审批状态标题和审批详情，并收紧操作区间距。


### 变更

- 缩小问题选项和输入控件高度，统一选项间距，并让单选问题始终显示主要提交操作。
- 明确设置界面的 profile 层级，区分分组标题和当前方案标签。


### 修复

- 通过 Client dictionaries 本地化 approval 操作按钮和无障碍标签。
- 为 question 跳过/下一题/提交按钮补齐 DSH 操作间距和 focus 样式。

### 变更

- 为 question/approval 快捷键列表增加对应操作图标。
- 将 profile radio 控件改为紧凑的原生下拉框。
- 清理 legacy profile card 中剩余的硬编码文案。


### 变更

- 明确 DSH CLI 是 profile 安装和升级的唯一入口。
- 增加用于 DSH plugin 检索的 npm keywords，其中包含 `dsh-plugin`。


### 修复

- 修复 question/approval 交互卡片脱离 DSH 对话 composer 的问题，增加限高滚动和始终可见的操作区。
- 修复 question 跳过文案，以及点击和键盘激活后的跳过提交行为。
- 新增 approval semantic warning 样式和响应式卡片布局。

### 变更

- 将 question/approval 快捷键摘要改为 DSH 风格的分组列表。


### 修复

- 修复 shortcuts composer 的 priority 顺序，使其先于 DSH 官方 question/approval composer 尝试。
- 新增针对 DSH chain 低 priority 优先选举规则的 slot wiring 回归。

## 0.1.2 - Composer priority metadata

### 修复

- 新增 composer priority metadata 和 slot wiring 回归，开始对齐 DSH chain routing。

## 0.1.1 - 交互修复

### 修复

- 修复 question 选项控件无 DSH 样式的问题，改为使用 DSH token 风格的选项卡和操作按钮。
- 修复 question 初始 focus 和 roving `tabIndex`，支持方向键/Enter 键盘选择。
- 新增与 DSH plugin card disclosure 模式一致的可折叠 settings card。
- 保留 session-scoped cancel，并在取消时重新获取当前 conversation。

## 0.1.0 - 首次发布

### 新增

- 新增独立的 DSH Client UI shortcuts plugin，为 Web question 和 approval 交互提供快捷操作。
- 新增 `standard` 和 `vim` profile，并保证同一时间只有一个 active profile。
- 新增 question/approval 的方向键、`j`/`k`、Enter 和 Escape 操作。
- 新增单选、多选、自定义答案、跳过、提交、允许一次、拒绝和按 session 取消流程。
- 新增 `dsh-ui-shortcuts` Host settings namespace，持久化字段为 `activeProfile`。
- 新增 `dsh-shortcuts` locale namespace 和 profile 设置卡片。
- 新增 CSS Modules、DSH semantic design tokens、本地 offline Iconify 图标、响应式布局和 reduced-motion 样式。

### 包与集成

- 新增 bundle patch，row id 为 `dsh-ui-shortcuts`。
- 新增 `lib/client.js` lazy-CJS 浏览器产物以及 Node/invariant 产物。
- 新增 browser bundle purity 检查，拒绝非平台 DSH runtime import。
- 新增 profile、composer、slot 生命周期、settings、bundle、tarball 和 DSH composition 验证。
- 新增双语包说明和安装文档。
