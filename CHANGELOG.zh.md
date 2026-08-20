# Changelog

`@hytime/dsh-client-ui-shortcuts` 的重要变更记录如下。

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
