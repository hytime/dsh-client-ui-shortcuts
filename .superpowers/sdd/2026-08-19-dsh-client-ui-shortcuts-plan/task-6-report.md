状态：repair in progress

Repair round 1:
- Corrected question response envelope to `{ sessionId, answer: { answers: [{ id, selected, custom? }] } }`.
- Replaced `document.activeElement` focus lookup with component-owned roving focus state and refs, including zero-option-safe cycling and activation.
- Added cancelTask rejection recovery for question and approval flows; approval defaults to allow-once focus.
- Offline install was attempted as requested but remains blocked by missing pnpm store tarball for `@deepseek-ai/dsh-client-locale@0.1.0-rc.8`.

- 创建 `src/client/components/ShortcutComposer.tsx`，按 question/approval carrier 分派并以 carrier key 隔离状态。
- 创建 `src/client/components/QuestionFlow.tsx`，实现结构化问题答案、单选/多选、custom textarea Enter 保护、profile keyboard routing、Escape cancelTask、receipt error recovery。
- 创建 `src/client/components/ApprovalFlow.tsx`，实现 allow-once/reject、默认 allow-once、profile activation/focus、Escape cancelTask、receipt error recovery。
- 创建 `src/client/components/ProfileCard.tsx` 替换 task5 settings placeholder。
- 修改 `src/client/contract/slots.ts` 增加 t 注入。
- 修改 `src/client/apply.ts` 增加 sessions inject、session-scoped conversation cancel、真实 composer/card 组件注册。

验证：
- `CI=true pnpm run typecheck`：通过。
- `git diff --check`：通过。
- `CI=true pnpm exec vitest run tests/composer.client.spec.tsx`：阻塞，工作树缺少 `@testing-library/react`；按要求执行 `pnpm add` 时 pnpm 报 shared store 路径/SQLite 权限错误，无法安装依赖。
## Repair round 2
- Rebuilt question focus indexing from actually rendered controls: options, custom, skip, and conditional next/submit only.
- Removed fixed `options.length + 3` cycling; zero-option and single-question non-multi flows no longer target hidden controls.
- Skip activation clears selected/custom state and selecting an option clears skip state.
- Approval initial focus effect now tracks carrier key and uses the same IME detection as questions.
- Simplified `ShortcutComposerProps` to the props supplied by the slot injector; unused owner currency is no longer part of the component contract.
- Verification: offline install passed; focused/regression Vitest passed (4 files, 36 tests); typecheck passed after updating the public client type export; `git diff --check` passed.

状态：已完成待审查。

- 使用 pnpm 添加 `@testing-library/react@16.3.2`、`react-dom@18.3.1`，并同步 lockfile。
- 使用本地结构化 PendingWait fixtures，避免测试依赖 browser ModuleLoader boot；补齐 QuestionResponsePayload/ApprovalResponsePayload envelope、multi/custom/IME/repeat/disabled/roving focus/cancel failure/receipt rejection assertions。
- 修正 ApprovalFlow answer 函数与 default/keyboard focus，补齐 standard/vim question/approval activation/focus bindings。
- task5 browser fixture 更新 sessions injection，task3/task5/task6 回归共 36 tests 通过。

验证：
- `CI=true pnpm install --frozen-lockfile --offline --trust-lockfile --ignore-scripts --reporter=append-only`：通过。
- `CI=true pnpm exec vitest run tests/composer.client.spec.tsx`：7 tests passed。
- `CI=true pnpm exec vitest run tests/browser-plugin.client.spec.ts tests/composer.client.spec.tsx tests/keyboard-resolve.client.spec.ts tests/profile-registry.client.spec.ts`：4 files, 36 tests passed。
- `CI=true pnpm run typecheck`：通过。
- `git diff --check`：通过。

临时 `pnpm-workspace.yaml` 已删除，未纳入提交。