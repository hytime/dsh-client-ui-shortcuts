# DSH Client UI Shortcuts

[English](README.md) | 中文

`@hytime/dsh-client-ui-shortcuts` 是一个独立的 DeepSeek Harness Web Client 插件，为待处理的 question 和 approval 交互提供按 profile 组织的键盘操作和设置卡片。它不修改 DSH core、agent loop 或模型协议。

## 提供的能力

- 内置 `standard` 和 `vim` 两套快捷键 profile，默认启用 `standard`。
- 为 question 和 approval 界面提供方向键、`j`/`k`、Enter 和 Escape 操作。
- 支持 question 的单选、多选、自定义答案、跳过和提交流程。
- 支持 approval 的允许一次、拒绝和按 session 取消。
- 通过 `dsh-ui-shortcuts` settings namespace 提供 profile 设置卡片。
- 同时只启用一个 profile；未知或已卸载的 profile 不会成为 active profile。

## 包契约

| 项目 | 值 |
| --- | --- |
| Package | `@hytime/dsh-client-ui-shortcuts` |
| Bundle row | `dsh-ui-shortcuts` |
| Settings namespace | `dsh-ui-shortcuts` |
| 持久化字段 | `activeProfile` |
| Locale namespace | `dsh-shortcuts` |
| 内置 profile | `standard`、`vim` |
| 浏览器入口 | `lib/client.js` |

本包包含 Host settings namespace 和 Client plugin。`cordis.patch.yml` 只负责插入 `dsh-ui-shortcuts` bundle row；周围的 Web runtime 和 Client module roster 由 DSH Web composition 提供。

## 安装

只能通过 DSH CLI 将插件安装或升级到 DSH profile：

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.4
```

完整的 DSH CLI 安装、本地 tarball 安装、profile 验证、升级和排错步骤见[安装指南](docs/installation.zh.md)。不要使用 `npm install`、`pnpm add`，也不要直接修改 DSH profile 的 `package.json` 或 lockfile。发布历史见[变更日志](CHANGELOG.zh.md)，英文版本见[English changelog](CHANGELOG.md)。

浏览器产物是由 DSH lazy-CJS loader 加载的 factory。不要直接打开 `apps/web` 的 Vite entry 验证插件，因为它依赖 DSH boot 注入和真实的 Web composition。

## 开发

下面的 `pnpm` 命令只用于开发本包；消费者必须通过 `dsh plugin --profile <name> add ...` 安装已发布包或本地 tarball。

```bash
pnpm install
pnpm run bundle
pnpm run typecheck
pnpm exec vitest run tests
```

`pnpm run bundle` 会生成 Node library、类型声明、浏览器 `lib/client.js` 和 source map。浏览器 bundle 将 DSH platform modules 保持为 external，拒绝普通的非平台 `@deepseek-ai/*` runtime import，使用 Lightning CSS 编译 CSS Modules，并内联本地 Iconify 图标数据。

## 架构边界

依赖方向为：

```text
contract -> profiles/keyboard -> settings/components -> apply
```

`src/client/apply.ts` 是 Client 组装入口。React 组件只接收普通 props 和 callbacks，不接触 Cordis context、runtime service 或 module-level singleton store。slot、locale、settings controller 和样式注册都属于当前 Client fiber，并随 fiber 一起释放。

本包使用以下 DSH extension points：

- `conversation.composer`：接管 question 和 approval。
- `settings.plugin.item`：提供 profile 设置卡片。
- Client locale registration：注册 `dsh-shortcuts` 文案。
- Host settings registration：注册 `dsh-ui-shortcuts`。

## Model Experience

无直接模型影响。本包只改变浏览器交互，不增加 prompt section、tool、模型可见 event 或 model request context。

#### KV Cache effect

无；本包不组装或发送模型请求。

## Known Limitations and Deferred Work

- 复制的 `clientBundle` 配置需要随目标 DSH 版本的 loader、external module 和 CSS 注入契约同步维护。
- 完整浏览器激活需要带有匹配 peer packages 和 boot data 的 DSH Web composition；本包不是独立的 React 或 Vite 应用。
- 当前只提供 `standard` 和 `vim` 内置 profile。新增 profile 需要按 Client plugin contract 注册 profile data 和 locale keys。
