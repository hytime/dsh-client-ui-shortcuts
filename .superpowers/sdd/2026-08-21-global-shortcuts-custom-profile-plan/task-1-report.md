DONE

Commit hash: 1fb8eebb80a4b514b5ffb5a1230ec5369ac700bd

Files changed:
- src/client/contract/profile.ts
- src/client/contract/keyboard.ts
- src/client/keyboard/resolve.ts
- src/client/profiles/builtins.ts
- src/client/profiles/registry.ts
- src/client/components/ShortcutLegend.tsx
- tests/profile-registry.client.spec.ts
- tests/keyboard-resolve.client.spec.ts

Tests and checks:
- Red phase: `CI=true pnpm exec vitest run tests/profile-registry.client.spec.ts tests/keyboard-resolve.client.spec.ts` failed for the intended missing global command/scope/sequence behavior after test structure was corrected.
- Green phase: targeted Vitest command passed, 80 tests passed.
- `CI=true pnpm run typecheck` passed.
- `git diff --check` passed.

Concerns:
- DOM listeners, settings persistence, global action adapters, and UI editing were intentionally not implemented.
- Multi-stroke prefixes return the existing `pass` decision shape to preserve question/approval consumers; sequence state remains internal to the pure resolver.


## 修复轮 1

状态：DONE

修复提交：b67581f3c2a070ee4d37006c404011421755e780

逐条修复说明：
- High resolver 状态：移除 module-level pending；新增 `createKeyResolver()` 显式实例状态和 `reset()`，保留无状态 `resolveKey()` API，避免不同调用方、profile、scope 互相污染。
- High Mod 语义：ShortcutBinding 新增显式 `modifier: 'Mod' | ...`；仅声明 Mod 时允许 Ctrl/Meta 等价，显式 Ctrl/Meta 保持精确匹配。
- High binding 形态：registry 拒绝 key/sequence/sequences 混用，统一校验 sequence 长度和 stroke，并对 profile snapshot 做深度冻结。
- Medium registry 冲突：冲突检查改为结构化序列比较，使用 Mod-aware stroke 等价和前缀判断，不再依赖字符串 startsWith。
- Medium conflicts：alternatives 展平后逐序列比较，同 scope 下检测重复及 prefix 冲突。
- Medium legend：保留现有 icon map 的编译兼容，但不在 Task 1 扩展 legend 的 question/approval 分组；global UI 展示留给后续任务。
- Low canonical API：单 stroke `canonicalBindingKey` 保持原有 modifier-slot 输出；新增 `canonicalSequenceKey` 表达多 stroke 序列。
- Low 可读性：registry/resolve/conflicts 恢复分段函数、显式校验和规范化辅助函数，避免密集单行逻辑。

新增/调整覆盖测试：
- resolver 实例之间的 partial sequence 状态隔离。
- Mod 对 Ctrl/Meta 的等价匹配及显式 Ctrl 的精确匹配。
- ambiguous binding shape 拒绝和 sequence 深度冻结。
- Mod-equivalent registry conflict 拒绝。
- 原有标准/Vim、question/approval、canonical key、alternative sequence 行为继续覆盖。

实际命令与输出：
- 修复前 focused red：`CI=true pnpm exec vitest run tests/profile-registry.client.spec.ts tests/keyboard-resolve.client.spec.ts`，新增回归用例按预期失败；中间一次测试结构修复后确认失败来自 ambiguous shape、Mod/conflict 和 resolver API 缺失，而非 production parse error。
- 修复后：`CI=true pnpm exec vitest run tests/profile-registry.client.spec.ts tests/keyboard-resolve.client.spec.ts`，通过，6 个匹配文件、83 tests passed（workspace 的现有 pnpm-store/worktree 镜像也被 Vitest glob 收集）。
- 修复后：`CI=true pnpm run typecheck`，通过，`tsc --noEmit` 无错误。
- 修复后：`git diff --check`，通过。

关注事项：


## 修复轮 1 最终验证

状态：DONE

验证提交：b67581f3c2a070ee4d37006c404011421755e780（当前工作区无新增未提交变更，因此未创建空提交）

实际命令与结果：
- `CI=true pnpm exec vitest run tests/profile-registry.client.spec.ts tests/keyboard-resolve.client.spec.ts`：通过，6 个测试文件、83 tests passed。
- `CI=true pnpm run typecheck`：通过，`tsc --noEmit` 无错误。
- `git diff --check`：通过，无输出。


## 修复轮 2

状态：DONE

修复提交：392ade71bcfa438d6b9f4bcbb4174454d34540c8

修复内容：
- 建立显式 modifier 一致性校验：Mod、Ctrl、Meta、Alt、Shift 与 key flags 不得矛盾；Mod 只允许 Ctrl 或 Meta 单平台事件等价匹配，双 Ctrl+Meta 事件不匹配并在 registry 声明中拒绝。
- 将 normalizeBinding 结果写入 profile snapshot，规范化 Esc，并深复制/冻结 key、sequence、sequences，避免 registry 持有调用方可变对象。
- 保留 `canonicalBindingKey` 的 established single-stroke 输出格式，继续通过单独的 `canonicalSequenceKey` 表达 sequence。
- 未回退 resolver 状态隔离/reset、structured conflict/prefix、alternatives flatten、legend 范围和可读性整理。

覆盖测试名称：
- `does not match Mod against a dual-platform modifier event`
- `preserves the legacy single-stroke key and exposes sequence canonicalization separately`
- `rejects contradictory modifier declarations and dual-platform conflicts`
- `stores normalized frozen bindings instead of caller-owned objects`
- 以及既有的 resolver 状态隔离、Mod/显式 Ctrl/Meta、sequence、冲突和标准/Vim 行为测试。

实际命令与结果：
- `CI=true pnpm exec vitest run tests/profile-registry.client.spec.ts tests/keyboard-resolve.client.spec.ts`：通过，6 个测试文件、86 tests passed。
- `CI=true pnpm run typecheck`：通过，`tsc --noEmit` 无错误。
- `git diff --check`：通过，无输出。
- 本轮代码修复已提交为 `392ade71bcfa438d6b9f4bcbb4174454d34540c8`。

关注事项：


## 修复轮 3 最终实现

状态：DONE

修复提交：f5141b9

文件：
- src/client/contract/profile.ts
- src/client/profiles/registry.ts
- src/client/profiles/builtins.ts
- src/client/keyboard/resolve.ts
- src/client/components/ShortcutLegend.tsx
- tests/profile-registry.client.spec.ts
- tests/keyboard-resolve.client.spec.ts

测试与检查：
- `CI=true pnpm exec vitest run tests/profile-registry.client.spec.ts tests/keyboard-resolve.client.spec.ts`：通过，88 tests passed。
- `CI=true pnpm run typecheck`：通过。
- `git diff --check`：通过。

关注事项：
- 未实现 DOM listener、settings persistence、DSH adapter 或 UI editor。
- Vitest 同时收集了既有 worktree 和 pnpm-store 镜像测试文件；目标工作区测试本身通过。


状态：BLOCKED

原因：本轮发现的 `ShortcutStroke` contract 改动是不完整的实验性残留，且包含解析失败的类型语法；它没有完整接入 registry/resolve/tests，因此按要求不继续设计新 contract，也未提交。

处理：将 `src/client/contract/profile.ts` 恢复到提交 `392ade71bcfa438d6b9f4bcbb4174454d34540c8` 的版本。

实际命令与结果：
- `git diff --check`：通过，无输出。
- `git status --short`：通过，无输出，工作区干净。

本轮未运行 focused Vitest/typecheck，未创建提交，未进入 Task 2。

## 修复轮 4

状态：DONE

修复提交：ea3c1b5

修复内容：
- 拒绝 `Mod` 与 `Ctrl` 或 `Meta` 同时声明；`Mod` 匹配和冲突判断要求事件恰好包含一个平台修饰键，双平台事件不再等价。
- `normalizeProfileBindings` 使用已计算的 normalized 数据；快照按输入形态保存独立拥有的 legacy `KeyStroke` 或 declarative `ShortcutStroke`，不泄漏内部 `modifier` 字段，并继续深度冻结嵌套结构。
- 保持 legacy 单 stroke `canonicalBindingKey` 的 `[alt, ctrl, meta, shift, key]` 序列化，sequence 使用 `canonicalSequenceKey`。

文件：
- `src/client/profiles/registry.ts`
- `src/client/keyboard/resolve.ts`
- `src/client/keyboard/conflicts.ts`
- `tests/profile-registry.client.spec.ts`

测试与检查：
- Red phase：新增 `Mod + Ctrl` 声明拒绝及 declarative snapshot ownership 测试后，focused Vitest 按预期失败（1 个失败，原因是未拒绝矛盾声明）。
- `CI=true pnpm exec vitest run tests/profile-registry.client.spec.ts tests/keyboard-resolve.client.spec.ts`：通过，6 files、89 tests passed。
- `CI=true pnpm run typecheck`：通过，`tsc --noEmit` 无错误。
- `git diff --check`：通过。

关注事项：
- DOM listener、settings persistence、DSH adapter 和 UI editor 仍属于后续任务；本轮未进入 Task 2。
