# DSH Client UI Shortcuts

[![npm version](https://img.shields.io/npm/v/%40hytime%2Fdsh-client-ui-shortcuts?logo=npm&label=npm)](https://www.npmjs.com/package/@hytime/dsh-client-ui-shortcuts) [![license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit/)

[English](README.md) | 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 提供**快速呼出面板**，以及**默认关闭**的 Question / Approval 交互增强。

快捷键由 DSH 官方管理：插件只向官方注册一个可编辑命令，不保留自己的按键存储或第二套快捷键配置。插件不修改 DSH core、agent loop 或模型协议。

## 为什么安装

- 一个快捷键即可呼出插件的快速面板。
- 改键使用官方服务，因此插件面板和 DSH 设置改的是同一份配置，不会互相覆盖。
- 需要时再开启键盘优先的 Question / Approval 交互；默认使用 DSH 官方界面。

## 60 秒安装

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.2.0
dsh --profile web
```

安装或升级后必须重新加载 Web composition，已打开的页面不会热更新。完整步骤见[安装指南](docs/installation.zh.md)。

## 界面

`⌘⌥⇧S`（默认）呼出的快速面板。顶部是配置导入导出与搜索，中间列出**官方全部快捷键**，每条都可单独改键，底部是两个默认关闭的增强开关：

![快速面板](https://raw.githubusercontent.com/hytime/dsh-client-ui-shortcuts/main/docs/panel-overview.png)

390×844 窄屏下同样完整可用：

![窄屏快速面板](https://raw.githubusercontent.com/hytime/dsh-client-ui-shortcuts/main/docs/panel-narrow.png)

在面板里改的绑定与 DSH 官方设置是同一份配置，官方侧同步可见：

![官方设置同步](https://raw.githubusercontent.com/hytime/dsh-client-ui-shortcuts/main/docs/official-settings-sync.png)

## 功能

### 快速呼出

插件注册一个官方命令 **打开快速面板**，默认键位：

| 平台 | 默认键 |
| --- | --- |
| Web / macOS | `⌘⌥⇧S` |
| Web / Windows | `Ctrl+Alt+Shift+S` |
| Web / Linux | 不设默认键（官方在该平台的允许集合更窄） |

面板内含：当前官方键位、录入 / 修改 / 恢复默认 / 清除、两个增强开关，以及入口按钮。设置页插件区也提供「打开快速面板」入口——即使没有绑定键位或键位冲突，仍可点击进入。

### 搜索与改键

快捷键列表上方的搜索框按命令名称、命令 ID 或键帽过滤当前列表，只影响显示、不改变保存内容。

### 面板内改键

面板调用官方 `describeBinding()`、`edit()` 与 `recording()`：

1. 进入录制并让官方在桌面端接管原生按键；
2. 收集一个候选组合（忽略 IME 组合、重复按键与纯修饰键）；
3. 由官方做规范化、保留组合与冲突检查；
4. 通过后按官方 revision 写入。

冲突、不支持、配置已变更、读取失败、写入失败都会显示对应说明。也可以在 **DSH 设置 → 通用 → 快捷键** 中改同一个命令，两处保持同步。

### 配置导入导出

面板顶部提供「导出」和「导入」，用于备份、迁移与团队分发。

导出的是**完整快捷键快照**——官方目录里的每一条命令都会写入，包含未修改的默认项，而不是只导出改过的：

```json
{
  "format": "dsh-client-ui-shortcuts/quick-panel",
  "version": 2,
  "configuration": {
    "questionEnabled": false,
    "approvalEnabled": false,
    "profile": "web:macos",
    "shortcuts": {
      "hytime.shortcuts.open": { "modified": false, "binding": { "code": "KeyS", "modifiers": ["alt","shift","meta"] }, "label": "打开快速面板", "keys": ["⌥","⇧","⌘","S"] },
      "session.new": { "modified": true, "binding": { "code": "KeyJ", "modifiers": ["shift","meta"] } }
    }
  }
}
```

`modified` 决定导入动作，避免把默认项固化成覆盖：

| 文件中的 `modified` | 当前状态 | 导入动作 |
| --- | --- | --- |
| `true` | — | 写入覆盖；`binding: null` 表示显式清除该键 |
| `false` | 已有覆盖 | 恢复官方默认 |
| `false` | 未修改 | 不写入，保持官方默认 |

导入先做严格校验（格式、版本、字段集合、命令 ID、物理键与修饰键，未知字段与更高版本整体拒绝，上限 1 MiB），再按目标快照整体规划：先释放本文件将要移动或清除的键，再经官方 `describeBinding()` 与 `edit()` 写回目标值，因此互换绑定也能正确恢复。两个开关通过一次原子写入提交。官方 `edit()` 没有批量事务，中途失败时会尽力回滚并列出仍未恢复的命令（「部分快捷键未能恢复」），不会谎报成功。导出时会经官方服务把逻辑修饰键 `primary` 归一化为设备明确的 `meta`/`control`，因此导出的文件导入后再导出**逐字节一致**。字段与限制见[接入说明](docs/official-shortcuts-integration.zh.md)。

### 可选交互增强

两个开关**默认关闭**，关闭时不接管任何界面，直接使用 DSH 官方实现：

| 开关 | 开启后的行为 |
| --- | --- |
| 增强 Question 交互 | 方向键选择、`Enter` 确认、`Escape` 取消任务 |
| 增强 Approval 交互 | 键盘选择「允许一次」或「拒绝」；**不会**自动授权 |

`Enter` 始终激活当前聚焦的操作；方向键把焦点移到「拒绝」后按 `Enter` 会拒绝，而不是沿用先前的选择。

## 版本兼容

- 插件 `0.2.0` 以 DSH **`0.2.0-rc.1`** 为已验证基线；`peerDependencies` 为 `>=0.2.0-rc.1 <1.0.0`，接受基线及更高版本（低于 `1.0.0`），拒绝旧版与 `1.0.0`+。
- DSH 会校验 `@deepseek-ai/dsh-*` 对等依赖（预发布版本参与范围判断）。版本不匹配时安装会给出明确提示和精确豁免方式——**不建议**在未验证版本上授予豁免。
- 新版**不兼容旧版 DSH**：不再使用 `settingsScope`、旧 Connection settings API、`settings.plugin.item` 坐席或旧交互载体，也不读取 `0.1.x` 的方案配置。旧版用户请继续使用 `0.1.23`。

详见[官方快捷键接入说明](docs/official-shortcuts-integration.zh.md)。

## 开发与验证

```bash
pnpm install
pnpm run typecheck
pnpm run bundle
pnpm exec vitest run tests
```

浏览器验收必须通过装有 `0.2.0-rc.1` 的真实 DSH Web composition；`apps/web` Vite entry 不是本插件的验证目标。

## 常见问题

### 会改变模型行为吗？

不会。本插件只改变浏览器交互，不增加 tool、prompt section、模型可见 event 或 model request context。

### 为什么快捷键没有生效？

按上面的默认键表确认当前平台是否有默认键（Linux Web 默认不绑定），并在 **DSH 设置 → 通用 → 快捷键** 或插件面板中检查是否被改键、清除或冲突。面板入口按钮始终可用。

### 在插件面板改键会影响 DSH 设置吗？

不会互相覆盖——两处读写的是同一份官方配置，只是界面不同。

### 不使用 DSH Web 可以运行吗？

不可以。浏览器产物是 DSH loader factory，依赖 DSH boot 注入、slots、locale、settings 与官方 shortcuts 服务。

## 相关链接

- [官方快捷键接入说明](docs/official-shortcuts-integration.zh.md)
- [安装指南](docs/installation.zh.md)
- [变更日志](CHANGELOG.zh.md)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## License

MIT
