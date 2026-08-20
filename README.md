# DSH Client UI Shortcuts

`@hytime/dsh-client-ui-shortcuts` 是一个独立的 DeepSeek Harness Client 插件，为 question 与 approval 载体提供 profile-aware 键盘操作和配置界面。它只扩展 DSH 的公开 Client 插件、slot、locale 与 settings 能力，不修改 DSH core，也不改变模型协议或 agent loop。

## 当前契约

- 内置 profile：`standard` 与 `vim`。
- settings namespace：`dsh-ui-shortcuts`，持久化字段为 `activeProfile`。
- locale namespace：`dsh-shortcuts`，与 settings namespace 独立。
- 任意时刻只有一个 active profile；未知或已卸载 profile 不会成为 active。
- profile registry、slot entry、locale registration 都由所属 Client fiber 管理，卸载时必须不可观察。
- Model Experience：本包没有直接模型影响。快捷键和设置只改变浏览器交互；它们不会向模型注入上下文、工具或事件。

## 安装与开发

这是可被 DSH composition 加载的独立包。浏览器入口是构建后的 `lib/client.js`，由 DSH lazy-CJS loader 加载；不要直接打开 `apps/web` 的 Vite entry 验证插件，因为该 entry 依赖 DSH 注入的 boot 数据。

```bash
pnpm install
pnpm run bundle
pnpm run typecheck
pnpm test
```

`lib/client.js` 是实际浏览器产物，`pnpm run bundle` 会先生成类型，再生成 Node library 与 browser loader artifact。Iconify 图标使用本地 `@iconify-icons/lucide` object 并内联到 bundle，不调用 Iconify 网络服务或 API。

## 架构边界

本包维护一份独立的 `clientBundle` 配置，因为 DSH 当前没有公开发布可复用的稳定 preset。该复制配置只负责复用 DSH runtime externals、生成 lazy-CJS loader 和注入 CSS；它不引入新的 DSH framework API。普通 `@deepseek-ai/*` value import 不得进入 browser bundle。

插件组装遵循 `contract -> profiles/keyboard -> settings/components -> apply`。React 组件接收 plain props 和 callbacks，不接触 Cordis `ctx` 或 runtime service。样式使用 DSH primitives、CSS Modules 与 semantic `--dsw-*` tokens。

## 验证

```bash
CI=true pnpm exec vitest run tests/invariant.client.spec.ts
CI=true pnpm run typecheck
git diff --check
```

需要验证完整浏览器行为时，先运行 `pnpm run bundle`，再通过真实 DSH composition 安装并加载本包。更多 DSH 扩展约束参见官方 checkout 中的 [architecture guide](/Volumes/hydisk/deepseek-harness/docs/architecture.md)、[extension cookbook](/Volumes/hydisk/deepseek-harness/docs/cookbook/extension-cookbook.md) 与 [package guide](/Volumes/hydisk/deepseek-harness/docs/cookbook/adding-a-package.md)。

## Known Limitations and Deferred Work

- `clientBundle` 复制配置需要随 DSH 发布版本的 loader、external 清单或 CSS 注入契约变化同步维护。
- 独立包的真实 composition 验证依赖目标 DSH 安装环境提供匹配版本的 peer packages；本地包测试不会替代该外部兼容性检查。
