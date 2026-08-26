# Task 3 报告：文档、回归和真实 DSH Web 验收

## 范围

- 仅修改 `CHANGELOG.md`、`CHANGELOG.zh.md`、`docs/future-roadmap-and-operations.zh.md`。
- 未修改 package version、README 安装版本、源码、依赖、发布配置或规划材料。
- 提交：`a647442 docs(引导): 记录首次使用引导`。
- 提交后工作树干净。

## 文档结果

- 双语 changelog 增加 Unreleased 首次使用引导条目，记录可关闭的设置卡片内联引导、Custom New/JSON Import 直接入口，以及仅保存 versioned browser-local completion marker 的契约。
- 中文路线图 P0「首次使用引导」补充已实现状态：设置卡片内联、browser-local v1 marker、New/Import 入口、无第三方 tour library，以及后续依据真实反馈调整文案和触发条件。

## 自动化验证

以下命令均成功：

```text
CI=true pnpm install --frozen-lockfile
CI=true pnpm run bundle
CI=true pnpm run typecheck
CI=true pnpm test
CI=true pnpm pack --dry-run --json
git diff --check
git status --short
```

测试结果：23 个测试文件通过，395 个测试通过。

Bundle 结果：`lib/client.js` 生成成功；bundle 检测到的依赖只有既有的 `clsx`、`@iconify/react`、`@iconify-icons/lucide`，没有第三方 onboarding/tour 依赖。

Pack 结果：版本为 `0.1.14`；tarball 内容包含预期 changelog、README、`cordis.patch.yml`、`lib/` 和类型文件。`lib/` 为 ignored 产物，未进入提交。

## 真实 DSH Web 验收

使用临时 profile 构建并安装 tarball：

- `dsh plugin --profile web add <temporary-tgz>` 成功。
- `dsh --profile web --dump-config` 成功，并确认：

```yaml
- id: dsh-ui-shortcuts
  name: '@hytime/dsh-client-ui-shortcuts'
```

- 使用 managed background job 启动临时 Web 服务成功，实际地址为 `http://127.0.0.1:49310`。
- 通过 HTTP 请求确认 Web HTML 可达。
- 验收后已停止 managed service job，并删除临时 profile 目录。

## Fix round1

### 修改

- 修正 `CHANGELOG.zh.md` 的 Unreleased 首次使用引导条目，明确记录可关闭的内联设置引导、创建 Custom profile 的 New 入口和 JSON Import 入口，以及仅保存 browser-local v1 marker、不改变快捷键设置和 profile JSON。
- 重写路线图 P0「首次使用引导」段，拆分为「已实现能力」与「后续优化」两个小节；已交付行为不再列为未完成待办，并保留根据真实反馈调整文案和触发条件的后续事项。

### 验证

- `git diff --check`：通过。
- 修改范围核对：仅涉及 `CHANGELOG.md`、`CHANGELOG.zh.md`、`docs/future-roadmap-and-operations.zh.md` 与本报告；未修改源码、README 安装版本、package version、依赖或规划材料。
- 本轮未重复运行完整测试、typecheck、bundle；上一轮自动化验证结果仍见上文。

### 环境限制

- 当前环境没有可用的 Chromium、Google Chrome、Playwright 命令行或浏览器/GIF 录制工具，无法执行真实浏览器点击和视觉检查；未伪造相关证据。
