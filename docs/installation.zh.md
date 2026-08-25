# 安装 DSH Client UI Shortcuts

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
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.13
```

该命令会把包安装到 profile，并根据包中声明的 `dsh.bundle.patch` 将它加入 `dsh.profile.bundles`。

## 安装固定版本的 GitHub 源码

安装源码时必须使用 release tag 或完整 commit SHA，不要安装会持续变化的默认分支：

```bash
dsh plugin --profile web add github:hytime/dsh-client-ui-shortcuts#v0.1.13
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
  /tmp/dsh-client-ui-shortcuts-pack/hytime-dsh-client-ui-shortcuts-0.1.13.tgz
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

快捷键设置卡片会出现在已组合的 settings plugin surface 中。持久化 settings namespace 是 `dsh-ui-shortcuts`，包含 `activeProfile` 和 `customProfiles` 字段。内置的 `standard` 与 `vim` profile 均为只读；`customProfiles` 保存多个可命名、可编辑的 profile。

## 管理命名 Custom profile

可在设置卡片中创建、导入、导出和删除多个命名 Custom profile。New 会使用 Standard binding 创建方案。Import 每次只读取一个方案，并且始终分配新的内部 ID；重复导入同名方案会依次使用 `Name 1`、`Name 2`、`Name 3` 等连续数字后缀。Delete 需要确认；删除 active Custom profile 前会先切回 Standard。

Custom profile 文件使用以下严格的单方案 JSON v1 envelope：

```json
{
  "format": "dsh-client-ui-shortcuts/custom-profile",
  "version": 1,
  "profile": {
    "name": "Review",
    "bindings": [
      {
        "command": "question.next",
        "key": {
          "code": "KeyJ"
        }
      }
    ]
  }
}
```

每个导入文件最大为 1 MiB。Envelope 只能包含 `format`、`version` 和 `profile`，其中 profile 只能包含 `name` 与 `bindings`。文件特意不保存内部 profile ID，因此导入不会替换或更新已有方案。

只有当前 active Custom profile 的名称与 binding 均已保存时，才能执行 Export。导出内容来自当前 authoritative saved snapshot，不包含编辑器中的未保存更改，并且每个 JSON v1 文件只保存一个方案。Standard 与 Vim 不能编辑或导出。

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

要验证浏览器激活，请启动 `dsh --profile web`，在真实 DSH Web 页面中确认设置卡片出现，并实际操作 question/approval 快捷键。包内自动化 smoke 在目标 checkout 提供 `tsx` runner 时，会使用 DSH 的 `loadProfile` 和 `composeEntries` source path；该 smoke 验证 package/profile resolution，不等同于浏览器激活验证。

## 排错

- **固定版本的 Git source 构建被拒绝：** 将 DSH 或 pnpm 错误信息中的精确 package key 加入 profile 的 `allowBuilds`，再重新执行同一条固定版本安装命令。
- **找不到 `lib/client.js`：** 在打包前执行 `pnpm run bundle`。
- **看不到 bundle row：** 确认 tarball 包含 `cordis.patch.yml`，并且 profile manifest 列出了 `@hytime/dsh-client-ui-shortcuts`。
- **浏览器入口没有激活：** 使用 DSH Web profile，不要单独打开 Vite entry，并确认 peer packages 与 DSH 安装匹配。
- **pnpm 版本错误：** 使用目标 DSH checkout 声明的 package-manager 版本执行 DSH command。
- **没有设置卡片：** 确认 Host profile 暴露了 `dsh-ui-shortcuts`，且 Web composition 包含 settings plugins surface。
