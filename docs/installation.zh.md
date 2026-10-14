# 安装 DSH Client UI Shortcuts

[English](installation.md) | 中文

本指南用于将 `@hytime/dsh-client-ui-shortcuts` 安装到 DSH Web profile。插件由 DSH Web composition 加载，不是可以独立打开的浏览器应用。

## 前置条件

- 可使用 Web profile 的 DSH 安装或 source checkout。
- 满足该 DSH 安装要求的 Node.js 和 package manager 版本。
- DSH 安装或 profile 能解析本包声明的 peer packages。

DSH CLI 负责 profile 的插件安装、升级和移除。本包声明的 pnpm 版本只适用于开发或打包源码，不是将插件安装到 DSH profile 的命令。不要执行 `npm install`、`pnpm add`，也不要直接修改 profile manifest 或 lockfile。这些 package manager 命令和直接编辑 lockfile 只属于开发或打包上下文，不属于消费者安装流程。

## 安装已发布的 npm 包

推荐安装 npm 发布包。包内已经包含构建完成的 `lib/` 入口，因此安装时不需要执行包构建。

使用 DSH plugin command 安装到 Web profile：

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.2.0
```

该命令会把包安装到 profile，并根据包中声明的 `dsh.bundle.patch` 将它加入 `dsh.profile.bundles`。本包 `0.2.0` 支持 DSH `0.2.0-rc.1` 及更高版本（低于 `1.0.0`），详见下文「DSH 版本兼容边界」。

## 安装固定版本的 GitHub 源码

安装源码时必须使用 release tag 或完整 commit SHA，不要安装会持续变化的默认分支：

```bash
dsh plugin --profile web add github:hytime/dsh-client-ui-shortcuts#v0.2.0
```

Git dependency 包含源码，不包含仓库提交的 `lib/` 产物。pnpm 会在用户机器的 package installation 阶段执行 `prepare`，由它调用 `pnpm run bundle` 并生成发布入口。这是在 Agent 沙箱之外执行的安装期代码。

pnpm 最初可能会拒绝执行该构建。请按照 DSH 或 pnpm 错误信息，将其中报告的精确 package key 加入 Web profile 的 `pnpm-workspace.yaml`；本包预期使用以下条目：

```yaml
allowBuilds:
  '@hytime/dsh-client-ui-shortcuts': true
```

然后重新执行同一条固定版本的 `dsh plugin` 命令。只为可信源码授予构建权限，并保留 release tag 或 commit 后缀，避免默认分支的后续变更改变实际安装代码。

## 安装本地 tarball

从插件源码目录构建并打包：

```bash
cd /Volumes/hydisk/vsProject/dsh-claude-shortcuts
pnpm install
pnpm run bundle
pnpm pack --pack-destination /tmp/dsh-client-ui-shortcuts-pack
```

然后将生成的 tarball 安装到 DSH Web profile：

```bash
export DSH_HOME="$(mktemp -d)"

dsh plugin --profile web add \\
  /tmp/dsh-client-ui-shortcuts-pack/hytime-dsh-client-ui-shortcuts-0.2.0.tgz
```

如果希望 profile 在 shell 退出后继续存在，请将 `mktemp -d` 换成持久目录。发布 tarball 必须包含 `lib/client.js`、`lib/index.js`、`lib/invariant.js`、类型声明和 `cordis.patch.yml`。

## 验证 profile

先导出组合后的 profile 配置，不启动 Web server：

```bash
dsh --profile web --dump-config
```

输出中应包含安装包和 canonical row：

```yaml
# == @hytime/dsh-client-ui-shortcuts
- id: dsh-ui-shortcuts
  name: '@hytime/dsh-client-ui-shortcuts'
```

profile manifest 也应在 `dependencies` 和 `dsh.profile.bundles` 中列出该包。`--dump-config` 只能验证 Host 侧 composition 和 patch resolution；它不会启动浏览器、加载 `window.__DSH_BOOT__`，也不能单独证明 Client slot 已激活。安装完成后，需要重载 DSH Web composition，或刷新已经运行的 Web 页面，再检查 Client UI；安装包不会更新已经加载的页面。

## 启动 DSH Web

安装 profile 后，通过 DSH 启动 Web surface：

```bash
dsh --profile web
```

启动后，在任意界面按默认键（macOS `⌘⌥⇧S`、Windows `Ctrl+Alt+Shift+S`；Linux Web 默认不绑定）呼出插件的快速面板，或点击设置页插件区的「打开快速面板」入口。面板包含：呼出键显示、配置导入导出、快捷键搜索框、**官方全部快捷键**列表（每条可录入/恢复默认/清除），以及两个默认关闭的增强开关。键位由 DSH 官方保存（`dsh.keybindings.v1`）；插件自己的配置只保存 `questionEnabled` 与 `approvalEnabled`。「导出」会写出全部快捷键的完整快照（含未修改的默认项），可在另一台设备或另一个 profile 上「导入」还原。

## DSH 版本兼容边界

插件 `0.2.0` 以 DSH **`0.2.0-rc.1`** 为已验证基线。`peerDependencies` 中每个 `@deepseek-ai/dsh-*` 依赖都声明为 `>=0.2.0-rc.1 <1.0.0`：接受基线及更高版本（低于 `1.0.0`），拒绝旧版与 `1.0.0`+。`devDependencies` 仍精确固定 `0.2.0-rc.1` 作为编译与类型基线。

DSH 启动时会按 `evaluatePluginCompatibility` 校验这些对等依赖，并把预发布版本纳入范围判断。版本不匹配时，安装或启动会给出明确提示，并说明精确豁免方式（`dsh plugin allow-version` 或插件管理器）。**只有在你确认了解崩溃与数据丢失风险时，才应为确切的「插件版本 + DSH 版本」组合授予豁免。**

新版不再兼容旧版 DSH，也不读取 `0.1.x` 的方案配置：

- 不再使用 `settingsScope` 或旧版 Connection settings API；
- 不再探测 `settings.plugin.item` 坐席；
- 不再适配旧版 sessions 摘要与 question/approval payload；
- 不再保留插件自建的方案、键位存储与冲突检查。

旧版用户请继续使用 `0.1.23`。升级到 `0.2.0` 属于行为变更：请阅读[官方快捷键接入说明](official-shortcuts-integration.zh.md)。

## 快捷键与面板

插件只向官方注册一个可编辑命令「打开快速面板」：

| 平台 | 默认键 |
| --- | --- |
| Web / macOS | `⌘⌥⇧S` |
| Web / Windows | `Ctrl+Alt+Shift+S` |
| Web / Linux | 不设默认键（官方在该平台的允许集合更窄） |

可以在 **DSH 设置 → 通用 → 快捷键** 中修改，也可以在插件快速面板中修改——两处读写同一份官方配置，不会互相覆盖。面板还提供「恢复默认」「清除」，以及两个**默认关闭**的增强开关（增强 Question、增强 Approval）；开启增强批准**不会**自动授权。

不要直接打开 `apps/web`。该 Web entry 需要 DSH boot 注入和真实 composition 提供的 Client module table。

## DSH CLI

使用目标 DSH 安装提供的 `dsh` executable。CLI 负责选择 profile、协调 package、更新 bundle list 并启动 composition。不要在 profile 目录中绕过 CLI 直接执行 package-manager 命令。

## 升级或移除

使用 DSH plugin command 升级：

```bash
dsh plugin --profile web update @hytime/dsh-client-ui-shortcuts
```

移除时使用 DSH plugin command：

```bash
dsh plugin --profile web remove @hytime/dsh-client-ui-shortcuts
```

DSH 会在 package operation 后重新协调 bundle list。安装、升级或移除包后，请重载 Web composition 或刷新页面，让正在运行的 Web surface 使用新的 composition。移除包会移除 `dsh-ui-shortcuts` bundle layer，但不会修改 DSH core。

## 本地验证

在插件源码目录执行：

```bash
CI=true pnpm run typecheck
CI=true pnpm exec vitest run tests
CI=true pnpm run bundle
pnpm pack --pack-destination /tmp/dsh-client-ui-shortcuts-pack
```

要进行 Host 侧 profile composition 检查，请使用临时 `DSH_HOME` 执行 `dsh plugin --profile web add <tarball>`，再执行 `dsh --profile web --dump-config`。这两条命令验证安装、依赖协调和 Host patch 组合；`--dump-config` 不会激活浏览器 Client。

要验证浏览器激活，请启动 `dsh --profile web`，在真实 DSH Web 页面中确认：

- 设置页插件区出现「打开快速面板」入口，点击可打开面板；
- 官方 **设置 → 通用 → 快捷键** 中出现「打开快速面板」，默认键在 macOS 为 `⌘⌥⇧S`、Windows 为 `Ctrl+Alt+Shift+S`，Linux Web 默认不绑定；
- 在插件面板录入新键位后，官方设置同步显示同一绑定（两处是同一份官方配置）；
- 两个增强开关默认关闭；关闭时使用官方 Question/Approval 界面，开启后增强卡片生效；
- 浏览器控制台没有插件报错。

包内自动化 smoke 在目标 checkout 提供 `tsx` runner 时，会使用 DSH 的 `loadProfile` 和 `composeEntries` source path；该 smoke 验证 package/profile resolution，不等同于浏览器激活验证。

## 排错

- **固定版本的 Git source 构建被拒绝：** 将 DSH 或 pnpm 错误信息中的精确 package key 加入 profile 的 `allowBuilds`，再重新执行同一条固定版本安装命令。
- **找不到 `lib/client.js`：** 在打包前执行 `pnpm run bundle`。
- **看不到 bundle row：** 确认 tarball 包含 `cordis.patch.yml`，并且 profile manifest 列出了 `@hytime/dsh-client-ui-shortcuts`。
- **浏览器入口没有激活：** 使用 DSH Web profile，不要单独打开 Vite entry，并确认 peer packages 与 DSH 安装匹配。
- **pnpm 版本错误：** 使用目标 DSH checkout 声明的 package-manager 版本执行 DSH command。
- **没有「打开快速面板」入口：** 确认 Host profile 暴露了 `dsh-ui-shortcuts`，且 Web composition 包含 plugin manager 与 settings surface。
- **快捷键无效：** 先确认官方快捷键服务已随组合加载（`@deepseek-ai/dsh-client-shortcuts`）；Linux Web 默认不绑定，需自行录入；若命令显示冲突，请在官方快捷键设置或插件面板中更换组合。
- **安装或启动提示插件不兼容：** 说明当前 DSH 版本与 `0.2.0-rc.1` 不符。请改用受支持版本，或在确认风险后为该确切版本组合授予精确豁免。
