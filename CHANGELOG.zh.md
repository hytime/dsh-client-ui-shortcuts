# Changelog

`@hytime/dsh-client-ui-shortcuts` 的重要变更记录如下。

## 0.1.4 - 交互卡片与快捷键列表修复

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
