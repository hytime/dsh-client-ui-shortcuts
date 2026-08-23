状态：DONE

提交：`81e64db9207c24c1fcd2345191e888007acba769`

修改文件：
- `src/client/keyboard/resolve.ts`
- `src/client/apply.ts`
- `src/client/contract/slots.ts`
- `src/client/components/ShortcutComposer.tsx`
- `src/client/components/ApprovalFlow.tsx`
- `src/client/components/QuestionFlow.tsx`
- `tests/keyboard-resolve.client.spec.ts`

说明：基线已有 `navigator.platform + userAgent` 平台检测、视觉平台映射和 global router/settings 的同一平台值传递。任务 1 补齐并统一 resolver 契约：平台参数改为必传，`Mod` 只按 macOS 的 `meta && !ctrl` 或 Windows/Linux 的 `ctrl && !meta` 匹配；显式 Ctrl/Meta 保持平台限定。交互组件沿 composer props 使用同一平台值。未引入 task 2 默认安全组合、task 3 capture listener 或 task 4 action adapter。

RED：
- 命令：`CI=true pnpm exec vitest run --dir tests keyboard-visuals.client.spec.ts keyboard-resolve.client.spec.ts`
- 结果：失败，1 项；省略平台参数时旧实现仍将 Ctrl 视为 Mod，实际返回 command，预期 pass。

GREEN：
- 命令：`CI=true pnpm exec vitest run --dir tests keyboard-visuals.client.spec.ts keyboard-resolve.client.spec.ts`
- 结果：通过，2 个测试文件、25 个测试全部通过。

Typecheck：
- 命令：`CI=true pnpm run typecheck`
- 结果：通过，`tsc --noEmit` 无错误。

Diff check：
- 命令：`git diff --check`
- 结果：通过，无输出。

剩余疑虑：focused 测试和类型检查已通过；未运行完整测试套件，任务简报只要求 focused tests、typecheck 和 diff-check。

修复轮次：
- 修复内容：将 `tests/keyboard-resolve.client.spec.ts` 中误传给 `expect` 的 platform 字符串移至 `resolveKey` 第四参数；补齐 macOS Ctrl 反例、macOS Meta 正例、Windows/Linux Ctrl 正例，以及显式 Ctrl/Meta、Mod+Alt、Mod+Shift 的真实平台断言。将 `src/client/keyboard/resolve.ts` 的 `sameStroke` platform 参数改为必传 `ShortcutPlatform`，并移除 undefined 平台分支。
- 修改文件：
  - `src/client/keyboard/resolve.ts`
  - `tests/keyboard-resolve.client.spec.ts`
- 测试命令/结果：
  - 修复前：`CI=true pnpm exec vitest run --dir tests keyboard-visuals.client.spec.ts keyboard-resolve.client.spec.ts`，通过 2 个文件、25 个测试，但审查确认平台参数误传导致相关断言未实际验证平台行为。
  - 修复后：`CI=true pnpm exec vitest run --dir tests keyboard-visuals.client.spec.ts keyboard-resolve.client.spec.ts`，通过 2 个文件、25 个测试。
  - `CI=true pnpm run typecheck`，通过，`tsc --noEmit` 无错误。
  - `git diff --check`，通过，无输出。
- 提交 hash：`9096c2e`。
