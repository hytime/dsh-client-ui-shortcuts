# Task 2 Report

Status: DONE_WITH_CONCERNS

Commit: `c7677e9674407673bfca4bac1131670083742592`

Modified files:
- `src/client/keyboard/browser-reserved.ts`
- `src/client/profiles/builtins.ts`
- `src/settings.ts`
- `src/client/components/ShortcutBindingEditor.tsx`
- `src/client/locales.ts`

RED:
- Command: `CI=true pnpm exec vitest run --dir tests browser-reserved.client.spec.ts profile-registry.client.spec.ts host-settings.spec.ts shortcut-binding-editor.client.spec.tsx settings-card.client.spec.tsx`
- Result: baseline had no `browser-reserved.client.spec.ts`; Vitest executed four existing files and all 82 tests passed, so the requested new denylist RED was not present in the checkout.

GREEN / verification:
- `CI=true pnpm exec vitest run --dir tests browser-reserved.client.spec.ts profile-registry.client.spec.ts host-settings.spec.ts shortcut-binding-editor.client.spec.tsx settings-card.client.spec.tsx`
- Result: command completed but existing tests still assert the old Meta/Ctrl alternative payloads, producing expected failures against the new single logical default shape. Browser-reserved test file was not present in the baseline and was not added because only files listed in the brief were allowed, but the implementation was added.
- `CI=true pnpm run typecheck`: PASS.
- `git diff --check`: PASS.

Implementation notes:
- Added pure browser-reserved diagnostics for common Chrome, Safari, Firefox, and Edge combinations, with source labels and user-facing messages. It reports known combinations only and does not claim arbitrary OS/browser occupancy detection.
- Updated standard/Vim and Host defaults toward `Mod+Alt+Shift+N/J/K/H/L/B/T` logical bindings.
- Editor updates locate the compatible sequence by structural equality, replacing only the current platform-visible first stroke and preserving alternatives and later strokes.
- Editor blocks save on browser-reserved diagnostics and exposes locale text.

Remaining concerns:
- The repository’s existing tests were written for the previous two-sequence Meta/Ctrl representation and therefore fail against the requested new single logical sequence representation. The brief required modifying those tests, but the working tree did not contain the new task-2 test changes and the final commit was kept scoped to implementation files.


## 修复轮次 1

Status: INCOMPLETE

Modified files:
- `src/client/components/ShortcutBindingEditor.tsx`
- `src/client/keyboard/browser-reserved.ts`
- `src/client/profiles/builtins.ts`
- `src/settings.ts`
- `tests/browser-reserved.client.spec.ts`
- `tests/profile-registry.client.spec.ts`
- `tests/host-settings.spec.ts`
- `tests/shortcut-binding-editor.client.spec.tsx`
- `tests/settings-card.client.spec.tsx`

RED:
- 指定 focused 命令首次运行：82 个测试中 32 个失败，主要为默认 `key + sequences` 触发 registry ambiguous shape，以及旧 Meta/Ctrl 双 sequence 断言。

GREEN / verification:
- denylist、profile registry、Host settings 单独验证通过：`19 + 24 + 26` tests passed。
- `CI=true pnpm run typecheck`: PASS。
- `git diff --check`: PASS。
- 完整 focused 命令仍失败 2 项：editor 首项保存校验断言未稳定对齐当前 denylist 保存行为；settings-card capability-backed global shortcut 保存断言仍需更新为单一逻辑 key binding。

未提交：由于完整 focused 测试尚未全绿，本轮未创建 commit，因而没有实际提交 hash。

## 修复轮次 2

Status: DONE

RED:
- 复现命令：`CI=true pnpm exec vitest run --dir tests browser-reserved.client.spec.ts profile-registry.client.spec.ts host-settings.spec.ts shortcut-binding-editor.client.spec.tsx settings-card.client.spec.tsx`
- 结果：5 个测试文件 101 个测试中 2 个失败。
- `shortcut-binding-editor.client.spec.tsx` 失败原因是 fixture 使用已知浏览器保留的 `Mod+P`，与本轮新增的保存阻断规则冲突；该测试原本意图验证非 mac `Mod` 渲染为 Control 与隐藏 binding 保留。
- `settings-card.client.spec.tsx` 失败原因是 Custom 初始 bindings 为空，capability 行虽展示但没有可更新的 binding；录制后 draft 未产生 `startSession` binding，因此保存回调未调用。

GREEN:
- 将编辑器 fixture 的可见 binding 改为安全的 `Mod+Q`，保留对 Linux 平台 Control 渲染、隐藏 Meta binding 保留及保存调用的断言。
- 为 capability-backed Custom 编辑测试提供标准的单一逻辑 `startSession` binding（`Mod+Alt+Shift+N`），再录制 Linux 的 `Ctrl+X`，继续断言保存产生单一逻辑 `{ key: 'x', modifiers: ['Ctrl'] }` binding。
- 修复后 focused 命令：5 个文件、101/101 tests passed。

本轮修改文件：
- `tests/shortcut-binding-editor.client.spec.tsx`
- `tests/settings-card.client.spec.tsx`

附加验证：
- `CI=true pnpm run typecheck`: PASS
- `git diff --check`: PASS

实际提交：`5974459cfd78f0a76043ab794dc1aacc701957bb`
