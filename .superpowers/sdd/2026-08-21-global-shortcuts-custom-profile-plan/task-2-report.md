# Task 2 report: persist custom shortcut bindings

状态：DONE

提交：05517a2 (`feat: persist custom shortcut bindings`)

实现内容：
- Host settings namespace 增加 `customBindings`，默认值覆盖 standard bindings 的 JSON 形态。
- Host schema 使用 schemastery 的 JSON-safe object/array schema 保留 persisted binding 数据；语义校验放在 `src/settings-validation.ts`，不导入 React、DOM 或 Client runtime。
- 修复 `src/index.ts` settings 注入注册失败问题：Host 不再导入 Client registry，namespace 可正常注册、describe、update 和 fiber dispose。
- 复用 registry 的规范化/冲突检查用于 Client custom profile；custom profile 替换保持 immutable snapshot。
- Client controller 在 scope 持久化成功后才替换 custom profile；失败时保持原 custom bindings、active profile 和 registry 状态。
- 有效 persisted custom bindings 在 controller 初始化时加载；无效数据被忽略并回退 standard bindings。

测试驱动过程：
- Red：先运行 `CI=true pnpm exec vitest run tests/host-settings.spec.ts tests/settings-card.client.spec.tsx`，Host tests 复现 `settings namespace "dsh-ui-shortcuts" is not registered`，确认新增 custom settings 行为失败。
- Green：补齐 Host schema/boundary validator、registry custom profile 和 controller persistence 后，focused suite 通过。
- Controller fixture 明确提供初始 persisted custom profile，覆盖加载、保存成功更新和保存失败保留旧值行为。

验证：
- `CI=true pnpm exec vitest run tests/host-settings.spec.ts tests/settings-card.client.spec.tsx`：通过，39 tests passed。
- `CI=true pnpm run typecheck`：通过。
- `git diff --check`：通过。

范围：
- 未实现 UI editor、global router、DSH action adapter、DOM listeners 或 DSH core changes。

## Task 2 repair results

- 保留 `z.dict(z.any())` 的 lossless binding schema，避免当前 Schemastery 版本在显式嵌套对象注册时失败。
- 将完整语义校验集中到纯 `src/shortcut-binding-contract.ts`；Host 与 Client 共用同一 validator，Host 不依赖 Client 路径。
- 恢复 `registry.ts` 对 `standardProfile` 与 `vimProfile` 的运行时导入，并保留 `ShortcutProfileRegistry` 类型及 `normalizePersistedShortcutBindings` 值导入；新增 built-in registry 运行时回归断言。
- controller 使用单一 bounded write tail 与 generation，写入前校验，保存成功后发布最新数据；无效 persisted custom bindings 回退 standard，且 dispose 后不再发布异步结果。
- 验证：Host/Client focused suite 44 tests passed；扩展 registry 回归后的 focused suite 97 tests passed；typecheck 与 `git diff --check` 均通过。

## Follow-up diagnostic repair

- 只读诊断确认 Schemastery 3.18.1 中 `z.dict(z.any())` 嵌套于 array default 会使 `toJSON` 的 shared schema/default graph 递归；settings schema 改为非递归 `z.array(z.any()).default(freshPlainDefaults)`，精确语义继续由 `validatePersistedShortcutBindings` 在 `src/index.ts` 的 `validate` 执行。
- `defaultShortcutBindings()` 现在每次返回 fresh owned plain copy；controller 使用显式递归 plain clone，不再使用 `JSON.stringify`/`JSON.parse` 做 ownership clone。
- registry binding shape 读取改为显式 `!== undefined`，保留合法空值形态并避免 truthiness 误判。
- Follow-up focused suite：45 tests passed；typecheck 与 `git diff --check` 均通过。

## Test diff audit

- 核对 `4cb7fbd..HEAD` 后确认 Task 2 测试差异已由 `190f6c4` 纳入：Host fresh default ownership 测试结构完整，controller successful persistence 测试保留 standard fallback、成功替换断言，并验证写入数据为独立副本。
- 当前工作区无未提交差异，因此未创建空的补充提交；未开始 Task 3。

## Repair round 2 review findings

- Registry custom validation now consumes the shared canonical contract result through `canonicalShortcutBindings`; Client no longer performs a separate semantic normalization pass for custom persisted bindings.
- Added Host/Client parity coverage for Mod+Alt/Shift acceptance, Mod+Ctrl/Meta and dual-platform rejection, key aliases, alias-equivalent prefix conflicts, duplicate alternatives, and canonical sequence conflicts.
- Added recursive Host JSON-boundary validation rejecting undefined, function, symbol, bigint, non-finite numbers, non-plain objects, and cycles while retaining the non-recursive Schemastery array schema.
- Disposal now cancels queued custom writes before they call `scope.set`; a regression test verifies only an already-started write executes after disposal and no queued write starts.
- Repair round 3: shared `normalizePersistedShortcutResult` now preserves legacy physical and declarative stroke representation per stroke across `key`, `sequence`, and `sequences`; `replaceCustom` continues to use this shared contract path. Added Client regression coverage for physical multi-stroke sequence preservation.
- Controller disposal semantics remain explicit: queued writes are canceled before `scope.set`; an already-started `scope.set` may complete after disposal, but generation/disposed checks suppress registry publication. The focused test verifies only the started write executes.
- Schemastery 3.18.1 limitation: nested `undefined` values are stripped during schema resolution before the Host provider's `validate` callback, so Host update cannot reject that value. The direct shared validator still rejects nested `undefined`; the Host test documents the environmental behavior without faking rejection. The registration-safe `z.array(z.any())` schema remains in place.
- Repair round 3 verification: focused Host/Client suite passed; typecheck and `git diff --check` passed.
