状态：DONE_WITH_CONCERNS

两个任务 4 子会话未能完成稳定落盘；其中一个留下了 settings/index 草稿，主会话依据已完成的 DSH API 研究接管并修正。未修改 `/Volumes/hydisk/deepseek-harness`。

修改：
- `src/settings.ts`：公开 `shortcuts` settings namespace、`ShortcutSettings` 和 standard 默认 schema。
- `src/index.ts`：使用真实 `Context` 与 `ctx.inject(['settings'])` 注册 namespace；无 settings provider 时不阻塞；validate 拒绝未知/空 profile 并保留 last-good 值。
- `tests/host-settings.spec.ts`：真实 Cordis Context + 本地 MemorySettings provider，覆盖 optional provider、默认值、vim update、invalid update rollback 和 fiber disposal。
- `package.json` / `pnpm-lock.yaml`：增加 `@deepseek-ai/dsh-settings@0.1.0-rc.8` devDependency，保持 DSH 包 peer+dev 分层。

验证：
- `CI=true pnpm install --offline --no-frozen-lockfile --trust-lockfile --ignore-scripts --reporter=append-only`：通过，lock importer 与 manifest 同步。
- `CI=true pnpm exec vitest run tests/host-settings.spec.ts`：2 tests passed。
- `CI=true pnpm run typecheck`：通过。

限制：普通联网 `pnpm install` 受外层 minimumReleaseAge/registry metadata 策略影响；任务验证使用已锁定依赖的 pnpm 离线模式。

修复记录（基于 HEAD `0489fd5`）：
- `tests/host-settings.spec.ts` 增加真实 `ctx.settings.update` 对 `activeProfile: 'unknown'` 的 reject 断言，并确认拒绝后 last-good 值仍为 `vim`。
- 未改变 Schemastery unknown-key 策略；本次 unknown 明确指未知 shortcut profile id，而非 settings object 的额外字段。
- `src/settings.ts` 为 `ShortcutSettings` 与 `ShortcutSettingsSchema` 增加简洁 JSDoc。
