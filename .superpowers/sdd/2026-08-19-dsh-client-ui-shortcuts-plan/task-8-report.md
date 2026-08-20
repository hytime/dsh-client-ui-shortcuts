状态：已完成

实现：
- 修改 `src/invariant.ts`，保留官方 `Context`、`InvariantInstaller`、registration name 与 package manifest name；将 UI-only 观察边界写成包专属 `No runtime invariant: shortcuts is UI-only` 说明，并保留可逆的 invariants registration。
- 新增根 `AGENTS.md`，记录独立包身份、contract/apply 依赖方向、React/Cordis 边界、DSH primitives 与 semantic tokens、Iconify local object、lazy-CJS bundle、复制 clientBundle 限制、最小检查与 DSH 集成方式；链接官方 checkout 文档，未复制整篇规则。
- 更新 `README.md`，说明 standard/vim、`shortcuts` namespace、单 active 规则、bundle/install/typecheck/tests 入口、`lib/client.js` loader、Iconify local inline、Model Experience 无直接模型影响及真实外部兼容限制；已消除旧包名 `claude-shortcuts`。
- 新增 `tests/invariant.client.spec.ts`，覆盖 manifest/registration name、单 active 与 disposal fallback、profile disposal 可观察性、registry/slot/locale disposer 等价 fixture，以及 superpowers ignore 边界。

裁定：
- 当前包是 UI-only Client plugin，invariant registry 没有可跨边界读取的 profile registry、slot 或 locale 状态；因此不扩展 DSH framework API，也不伪造通用 runtime invariant。实际 registry disposal 与 slot/locale disposal 关系由 Client lifecycle 测试契约覆盖，invariant companion 只负责官方 package registration。

验证：
- `CI=true pnpm exec vitest run tests/invariant.client.spec.ts`：6 tests passed。
- `CI=true pnpm run typecheck`：通过。
- `git diff --check`：通过。
- ignore 正向/反向检查：superpowers 资料被忽略，`AGENTS.md`、`src/`、`tests/`、`README.md` 未被忽略。


本轮追加（ID 分层迁移）：
- patch row id 从 `ui-shortcuts` 迁移为 `dsh-ui-shortcuts`；package/loader/tsdown/patch row.name 继续保持 `@hytime/dsh-client-ui-shortcuts`。
- Host settings namespace、Client `settingsScope.bind` 与 settings slot key 从 `ui-shortcuts` 迁移为 `dsh-ui-shortcuts`。
- locale namespace、`LocaleNamespaceMap`、locale/slot options 与浏览器测试从 `shortcuts` 迁移为 `dsh-shortcuts`；profile ids `standard`/`vim` 与 `profile.*` locale keys 保持不变。
- invariant companion name 从 `client-ui-shortcuts-invariant` 迁移为 `dsh-client-ui-shortcuts-invariant`。
- 未机械修改 CSS class/hash、command names 或业务 key；未修改 `/Volumes/hydisk/deepseek-harness`、task6 report 或计划资料。

备注：
- 工作树中已有 task-6 report 修改未纳入本次提交；未修改 `/Volumes/hydisk/deepseek-harness`，未提交 `pnpm-workspace.yaml`、`node_modules` 或 `lib`。
