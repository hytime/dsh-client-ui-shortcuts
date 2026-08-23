# DSH Client UI Shortcuts

[![npm version](https://img.shields.io/npm/v/%40hytime%2Fdsh-client-ui-shortcuts?logo=npm&label=npm)](https://www.npmjs.com/package/@hytime/dsh-client-ui-shortcuts) [![license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit/)

[English](README.md) | 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 提供 browser-safe、profile-aware 的键盘控制。

插件运行在 DSH Web 内，为 Question 和 Approval 流程提供可预测的键盘操作，并提供按 capability 过滤的 Session 与 Workspace 导航。它不修改 DSH core、agent loop 或模型协议。

## 为什么安装

- 无需离开键盘即可回答 DSH Question 和 Approval。
- 为交互卡片和全局动作选择 Standard、Vim 或 Custom profile。
- 使用显式的物理 `Meta`、`Ctrl`、`Alt` 和 `Shift` 修饰键导航 Session 与 Workspace。
- 打开已有的可用 Session 前，自动展开处于折叠状态的目标 Workspace。
- 通过 capability filtering 将不可用动作从路由和快捷键列表中移除。
- 遵守浏览器和操作系统边界：浏览器保留的快捷键可能不会到达网页。

## 60 秒安装

通过 DSH CLI 安装插件，然后重启或重新加载 Web composition：

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.12
dsh --profile web
```

本插件不是独立的 React 或 Vite 应用。不要直接打开 `apps/web`，也不要使用 `npm install`、`pnpm add` 或手动修改 DSH profile manifest、lockfile 的方式安装到 profile。

升级、移除、本地 tarball、profile 检查和排错步骤见[安装指南](docs/installation.zh.md)。

## 当前包含的能力

- Question 卡片：单选、多选、自定义答案、跳过、上一题和提交。
- Approval 卡片：允许一次、拒绝、详情、取消和键盘确认。
- Standard、Vim 和可编辑的 Custom profile；同一时间只有一个 profile 处于 active 状态。
- 显式物理 `Meta`、`Ctrl`、`Alt` 和 `Shift` 修饰键、候选绑定和两段 chord。
- 浏览器保留快捷键 denylist 与冲突检查。
- 对不可用 DSH public face 的 capability filtering。
- 在所需 public face 可用时提供 Session、Workspace、session branch 和主题操作。

## 快捷键参考

### Question 和 Approval 卡片

| 命令 | Question | Approval |
| --- | --- | --- |
| 聚焦上一项 | `ArrowUp` | `ArrowUp` |
| 聚焦下一项 | `ArrowDown` | `ArrowDown` |
| 激活当前项 | `Enter` | `Enter` |
| 取消当前任务 | `Escape` | `Escape` |

Vim profile 会将两个聚焦绑定替换为 `k` 和 `j`；确认和取消仍使用 `Enter` 与 `Escape`。这些绑定只在 active interaction card 内生效。

### 全局动作

active profile 的默认全局绑定如下：

| 动作 | 默认绑定 |
| --- | --- |
| 创建 Session | `Meta+Alt+Shift+N` |
| 上一个 Session | `Meta+Alt+Shift+J` |
| 下一个 Session | `Meta+Alt+Shift+K` |
| 上一个 Workspace | `Meta+Alt+Shift+H` |
| 下一个 Workspace | `Meta+Alt+Shift+L` |
| Fork 当前 Session | `Meta+Alt+Shift+B` |
| 切换浅色/深色主题 | `Meta+Alt+Shift+T` |

只有在 DSH 暴露所需 public capability 时，才会注册全局动作。隐藏的 `Meta+,` 设置绑定仍保留在 profile 数据中，但由于 DSH 没有公开的设置 opener，它不是可用功能，不会被激活。

## Profile 与 Custom binding

`Standard` 使用方向键、`Enter` 和 `Escape` 处理 Question 与 Approval 交互。`Vim` 使用 `j`/`k`、`Enter` 和 `Escape`。`Custom` 可以编辑 Question、Approval 以及由 capability 支持的全局 binding，包括显式修饰键、候选绑定和两段 chord。

resolver 根据物理 `KeyboardEvent.code` 匹配按键，并归一化 `Esc`/`Escape`、`Return`/`Enter` 等别名；它会拒绝前缀冲突，并将 chord 限制为最多两段。在 macOS 上，`Meta` 显示为 Command，`Alt` 显示为 Option；其他平台将 `Meta` 显示为 Windows 键，`Ctrl` 显示为 Control。

当前公开的物理修饰键只有 `Meta`、`Ctrl`、`Alt` 和 `Shift`。`Mod` 仅用于旧持久化配置的迁移：读取旧配置时会迁移为 `Meta`，保存时不会写回 `Mod`。

## 浏览器和平台边界

路由器使用由 active Client fiber 管理的 capture-phase listener。它会让位于未匹配的文本输入、IME composition、重复事件、待处理的 Question 或 Approval takeover，以及由宿主拥有焦点的 popup。由于全局 binding 是显式配置的，全局动作即使从 input 或 contenteditable 元素中触发，也可以执行。

浏览器 denylist 覆盖已知的 Chrome、Safari、Firefox 和 Edge 组合，并用于冲突检查。它无法查询任意操作系统或浏览器快捷键的占用情况；浏览器或操作系统保留的快捷键可能根本不会把事件分发给网页。capture listener 只能阻止浏览器已经分发到页面的快捷键。

## Workspace 与 Session 导航

Session 导航遵循当前 Workspace 保存的 Session 顺序，并跳过 archived、subagent 和 blank Session。Workspace 导航会在目标 Workspace 中打开已有的非 blank Session。

如果目标 Workspace 处于折叠状态，插件会先自动展开它，再打开符合条件的已有 Session。导航不会创建 blank Session，也不会调用 `connectWorkspace` 来制造目标。

## DSH 兼容边界

这是一个 DSH Web 的 out-of-tree Client extension。插件使用 conversation composer、profile settings card、settings persistence 和 locale dictionaries 等公开 composition point，同时不把 DSH live service 传入 React props 或持久化 settings。

插件不会修改 DSH core。它只能通过真实的 DSH Web composition 和 DSH boot/module loader 加载。安装更新不会替换已经在打开页面中运行的代码；请重新加载 Web composition，才能加载新的 Client bundle。

## 开发与验证

下面的命令用于开发本包，不是 profile 安装命令：

```bash
pnpm install
pnpm run bundle
pnpm run typecheck
pnpm exec vitest run tests
```

完整的 DSH composition 流程见[安装指南](docs/installation.zh.md)。浏览器验证必须通过带有 boot data 的真实 DSH Web profile；`apps/web` Vite entry 不是独立的验证目标。

## 常见问题

### 会改变模型行为吗？

不会。本插件只改变浏览器交互，不增加 tool、prompt section、模型可见 event 或 model request context。

### 为什么没有看到某个全局动作？

全局动作按 capability 过滤。如果当前 DSH composition 没有提供所需的 public face，该动作不会注册，快捷键行也不会渲染。

### 安装更新后，当前打开的页面为什么没有变化？

DSH 需要重新加载 Web composition，浏览器才会加载新的 Client bundle。安装包不会替换已经在浏览器中运行的代码。

### 不使用 DSH Web 可以运行吗？

不可以。浏览器产物是 DSH lazy-CJS loader factory，依赖 DSH boot 注入、slots、settings、locale 和运行时环境。

## 相关链接

- [安装指南](docs/installation.zh.md)
- [English README](README.md)
- [变更日志](CHANGELOG.zh.md)
- [English changelog](CHANGELOG.md)
- [DeepSeek Harness extension 文档](https://github.com/deepseek-ai/deepseek-harness/tree/main/docs)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## License

MIT
