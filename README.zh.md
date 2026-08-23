# DSH Client UI Shortcuts

[![npm version](https://img.shields.io/npm/v/%40hytime%2Fdsh-client-ui-shortcuts?logo=npm&label=npm)](https://www.npmjs.com/package/@hytime/dsh-client-ui-shortcuts) [![license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit/)

[English](README.md) | 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web Client 提供按 profile 管理的快捷键和紧凑交互卡片。

当 DSH 向你提出问题、请求权限确认，或你需要重复执行会话导航操作时，这个插件可以提供更稳定的键盘工作流。插件运行在 DSH Web 内，跟随当前 conversation composer，不修改 DSH core、agent loop 或模型协议。

## 60 秒安装

通过 DSH CLI 安装插件，然后重启或重新加载 Web composition：

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.12
dsh --profile web
```

本插件不是独立的 React 或 Vite 应用。不要直接打开 `apps/web`，也不要使用 `npm install`、`pnpm add` 或手动修改 DSH profile manifest/lockfile 的方式安装到 profile。

升级、移除、本地 tarball、profile 检查和排错步骤见[安装指南](docs/installation.zh.md)。

## 你将获得什么

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Question 卡片 | 已发布 | 紧凑单选、多选、自定义答案、跳过、上一题和提交流程。 |
| Approval 卡片 | 已发布 | 允许一次、拒绝、详情、取消和键盘确认流程。 |
| Standard profile | 已发布 | 使用方向键、`Enter` 和 `Escape` 操作 question/approval。 |
| Vim profile | 已发布 | 使用 `j`/`k`、`Enter` 和 `Escape` 操作 question/approval。 |
| 设置卡片 | 已发布 | 通过 `dsh-ui-shortcuts` settings namespace 切换 active profile。 |
| Custom profile | 已发布 | 编辑 question、approval 和具备 capability 的全局绑定，包括修饰键、候选绑定和两段 chord。 |
| 全局动作 | 已发布 | 通过 DSH public face 路由会话、Workspace、会话分支和主题动作。 |
| 能力过滤 | 已发布 | 只有当前 DSH composition 提供所需 public action face 时，才注册并显示对应全局动作。 |

当前版本包含 interaction takeover、`standard`/`vim` profile、可编辑的 `Custom` profile 和 capability-aware global router。由于 DSH 尚未提供公开的设置 opener，设置快捷键仍保持隐藏且不会激活；插件不会通过私有 DOM 点击或猜测路由来模拟它。

## 快捷键参考

### 当前已发布

插件目前在两个交互面板上提供四个逻辑命令：

| 命令 | Question | Approval |
| --- | --- | --- |
| 聚焦上一项 | `ArrowUp` | `ArrowUp` |
| 聚焦下一项 | `ArrowDown` | `ArrowDown` |
| 确认当前项 | `Enter` | `Enter` |
| 取消当前任务 | `Escape` | `Escape` |

Vim profile 会将两个聚焦快捷键替换为 `k` 和 `j`；确认和取消仍然使用 `Enter` 与 `Escape`。

这里的口径是：4 个逻辑命令、8 个 question/approval 作用域绑定，以及 `standard`/`vim` 两套 profile 合计 16 个内置绑定行。它们只在 active interaction card 内生效，不会成为全局 document 快捷键。

### 全局快捷键

active profile 现在提供 global router。内置全局绑定如下：

| 动作 | 默认键位 | 能力要求 |
| --- | --- | --- |
| 新建会话 | `Meta+Alt+Shift+N` | `workspaces.startSession()` |
| 上一个会话 | `Mod+Alt+Shift+J` | 当前 Workspace 的会话顺序、`sessions.open()`，以及非空白会话元数据 |
| 下一个会话 | `Mod+Alt+Shift+K` | 当前 Workspace 的会话顺序、`sessions.open()`，以及非空白会话元数据 |
| 上一个 Workspace | `Mod+Alt+Shift+H` | Workspace 列表、目标 Workspace 中已有的非空白会话，以及 `sessions.open()` |
| 下一个 Workspace | `Mod+Alt+Shift+L` | Workspace 列表、目标 Workspace 中已有的非空白会话，以及 `sessions.open()` |
| 创建当前会话分支 | `Mod+Alt+Shift+B` | `sessions.fork()` 和 `sessions.open()` |
| 切换浅色/深色主题 | `Mod+Alt+Shift+T` | `theme.getTheme()` 和 `theme.setTheme()` |

`Meta+,` 设置绑定仍保留在 profile 数据中，但由于 DSH 没有公开设置 opener，它保持隐藏且不激活。能力过滤会同时从路由和快捷键列表中移除不可用的全局动作，不留下 dead row，也不模拟 DSH 私有 UI 行为。

### 值得预留的 DSH 常用动作

当前 DSH Web composition 已经提供相关 public face，后续可以优先考虑这些动作：

| 候选动作 | DSH face | 说明 |
| --- | --- | --- |
| 展开/收起侧边栏 | `layout.toggleSidebar()` | 适合作为全局布局快捷键。 |
| 打开详情面板 | `layout.openDetails()` | 适合查看选中的 tool call。 |
| 关闭详情面板 | `layout.closeDetails()` | 面板已关闭时应保持安全的 no-op 语义。 |
| 打开子代理 | `sessions.openSubagent(address)` | 适合在 agent task 之间导航。 |
| 提交当前草稿 | session `inputActions.submit()` | 必须让位给文本输入、IME 和 pending takeover 卡片。 |
| 归档当前会话 | `workspaces.archiveSession(sessionId)` | 具有破坏性，需要确认，默认不绑定快捷键。 |

## 快捷键设计

Custom profile 会参考 Claude Code 和 Codex 熟悉的修饰键习惯，但不会声称完整复制它们的默认键位：

全局 router 使用显式物理修饰键。`Meta` 在所有平台都只匹配 `metaKey`，macOS 显示 Command，Windows/Linux 显示 Windows/窗口键；`Ctrl` 只匹配 `ctrlKey`，所有平台都显示 Control；macOS 将 `Alt` 显示为 Option。默认全局组合为 `Meta+Alt+Shift+N/J/K/H/L/B/T`。读取旧持久化数据时会把 `Mod` 迁移为 `Meta`，保存时绝不写回 `Mod`。

在 macOS 上，Option 和 Shift 可能让 `KeyboardEvent.key` 产生布局字符（例如 `Option+Shift+N` 可能得到 `˜`）。快捷键 resolver 使用 `KeyboardEvent.code`（例如 `KeyN`），并将其归一化为逻辑键 `n`；诊断仍可能显示原始 `key` 值。

- 会话导航会尽量停留在当前 Workspace，遵循 Workspace 保存的 `sessionIds` 顺序，并跳过 archived、subagent 和 blank 会话。导航只打开已有的非 blank session，不会调用 `connectWorkspace` 创建导航目标。
- Workspace 导航只打开目标 Workspace 中已有的非 blank session；导航不会创建 blank session 或新会话作为副作用，也不会调用 `connectWorkspace` 创建目标。
- global router 在 capture 阶段处理事件。即使焦点位于 `input`、`textarea`、`select` 或 `contenteditable`，匹配的全局动作仍会执行并阻止事件。普通未匹配文本、IME composition、重复事件和 pending `Enter`/`Escape` takeover 会继续让位。
- capture listener 只能阻止浏览器已经分发到页面的 DOM 事件。浏览器或 OS 保留的快捷键可能根本不会到达页面，而 Web 平台也没有查询任意 OS/浏览器快捷键占用情况的通用 API。
- browser denylist 用于提示已知的 Chrome、Safari、Firefox 和 Edge 组合冲突，不是查询任意 OS/浏览器快捷键占用的权威机制。
- UI 会将 `Meta` 显示为 macOS 的 Command 或其他平台的 Windows/窗口键，将 `Ctrl` 显示为 Control，macOS 的 `Alt` 显示为 Option。一个 binding 支持单键或两段 chord，例如 `Ctrl+X Ctrl+S`。
- 一个 command 可以拥有多个候选绑定，用于平台兼容或用户选择备用键。
- 比较前会归一化常见别名，包括 `Esc`/`Escape` 和 `Return`/`Enter`。
- chord 最多两段；同一 scope 中不能让一个 binding 成为另一个 binding 的前缀。

global router 在 capture 阶段注册。它会让位于未匹配的文本输入、IME composition、重复 key event、pending question/approval takeover 和宿主拥有焦点的 popup。每个 listener 都属于当前 Client fiber，插件停止或更新时会被移除。

## DSH 兼容边界

本插件是 DSH Web 的 out-of-tree Client extension，通过公开 composition point 工作，不修改 DSH 内部实现：

- `conversation.composer`：接管 question 和 approval；
- `settings.plugin.item`：提供 profile 设置卡片；
- `dsh-ui-shortcuts`：保存 Host settings；
- `dsh-shortcuts`：注册 Client locale 文案；
- fiber-owned effects：管理 slot、settings、locale 以及未来 keyboard registration 的生命周期。

当前版本会注入 active global actions 所需的 session、Workspace 和 theme faces。传给 React 的只有提取后的普通 action callbacks；DSH live service 不会进入 React props 或持久化 settings。

## 路线图

### 当前集成

- 在 DSH conversation composer 内显示紧凑 question 和 approval 卡片。
- Standard、Vim 和可编辑 Custom profile，且同一时间只启用一个 profile。
- 持久化 Custom binding，支持显式 `Meta`、`Ctrl`、`Alt`、`Shift` 修饰键、候选绑定和两段 chord。
- capability-aware global action adapter 和由 Client fiber 管理的 keyboard router。
- 使用 session 和 Workspace list snapshot 实现导航。
- 创建分支后自动打开新的 child session。
- 通过公开 theme face 切换浅色/深色主题。
- 按 question、approval、global 分组显示快捷键，不显示不可用动作。
- global router 对输入框、IME、重复事件、pending interaction 和宿主 popup 提供保护。

### 等待 DSH 公开能力

- 直接打开设置面板；现有设置绑定保持隐藏。
- 在 DSH 提供公开 opener 后打开 session switcher 或 command palette。
- 切换 transcript/trajectory view。
- 打开 model、permission mode、Plan Mode 或后台任务选择器。
- 向第三方 extension package 暴露 queue steering、undo/redo、clipboard 和其他 InputBar 私有操作。

## 开发

下面的命令只用于开发本包，不是 profile 安装命令：

```bash
pnpm install
pnpm run bundle
pnpm run typecheck
pnpm exec vitest run tests
```

`pnpm run bundle` 会生成 Node library、类型声明、浏览器 `lib/client.js` 和 source map。浏览器 bundle 会保持 DSH platform modules 为 external，拒绝普通的非平台 `@deepseek-ai/*` runtime import，使用 Lightning CSS 编译 CSS Modules，并内联本地 Iconify 图标数据。

完整 DSH composition 流程见[安装指南](docs/installation.zh.md)。浏览器验证必须通过带有 boot data 的真实 DSH Web profile；`apps/web` Vite entry 不是独立的验证目标。

## 包契约

| 项目 | 值 |
| --- | --- |
| Package | `@hytime/dsh-client-ui-shortcuts` |
| 当前版本 | `0.1.12` |
| Bundle row | `dsh-ui-shortcuts` |
| Settings namespace | `dsh-ui-shortcuts` |
| 持久化字段 | `activeProfile`、`customBindings` |
| Locale namespace | `dsh-shortcuts` |
| 内置 profile | `standard`、`vim` |
| 可编辑 profile | `custom` |
| 浏览器入口 | `lib/client.js` |

## 常见问题

### 会改变模型行为吗？

不会。本插件只改变浏览器交互，不增加 tool、prompt section、模型可见 event 或 model request context。

### 为什么没有看到某个全局动作？

全局动作按 capability 过滤。如果当前 DSH composition 没有提供所需 public face，该 action 不会注册，快捷键行也不会渲染。

### 安装更新后，当前打开的页面为什么没变化？

DSH 需要重新加载 Web composition，浏览器才会加载新的 Client bundle。安装包不会替换已经运行中的浏览器代码。

### 不使用 DSH Web 可以运行吗？

不可以。浏览器产物是 DSH lazy-CJS loader factory，依赖 DSH boot 注入、slot、settings、locale 和 runtime service。

## 相关链接

- [安装指南](docs/installation.zh.md)
- [English README](README.md)
- [变更日志](CHANGELOG.zh.md)
- [English changelog](CHANGELOG.md)
- [DeepSeek Harness extension 文档](https://github.com/deepseek-ai/deepseek-harness/tree/main/docs)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## License

MIT
