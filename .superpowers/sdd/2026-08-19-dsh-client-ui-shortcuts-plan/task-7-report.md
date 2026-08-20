状态：已完成

实现：
- 新增 `src/client/components/ShortcutProfileCard.tsx`，使用 `ShortcutSettingsFace` 和 profiles 注入，提供 standard/vim（及未来 profile）可访问 radio、当前选中状态、保存 pending/禁用、失败回滚与错误恢复、冲突和空状态。
- 新增 `ShortcutLegend.tsx`，以纯 `ShortcutBinding[]` + `t` 按 question/approval scope 分组展示 keycap 与命令文案。
- 新增 `ShortcutIcon.tsx`，仅使用本地 `@iconify-icons/lucide` icon objects 和 `@iconify/react`，固定尺寸/currentColor 继承并设置 `aria-hidden`。
- 新增 `src/client/styles/Shortcuts.module.css`，使用 `--dsw-alias-*` 语义 token、可滚动最大宽内容区、移动端单列、focus ring 与 reduced-motion。
- 更新 apply settings slot 注入 `settings`、`profiles`、`t`，替换 ProfileCard placeholder。
- 更新 zh/en locale，并保持 LocaleNamespaceMap 类型映射。

验证：
- `CI=true pnpm install --frozen-lockfile --offline --trust-lockfile --ignore-scripts --reporter=append-only`：通过。
- `CI=true pnpm exec vitest run tests/settings-card.client.spec.tsx tests/composer.client.spec.tsx tests/browser-plugin.client.spec.ts`：通过已有两项测试文件，共 11 tests；工作树中未发现 settings-card 测试文件。
- `CI=true pnpm run typecheck`：通过。
- `git diff --check`：通过。

## Repair round 1
- 创建 `tests/settings-card.client.spec.tsx`，覆盖真实 registry、可访问 radio、legend scope、pending/disabled、失败恢复、冲突/空状态、locale、Iconify 本地图标属性。
- 对齐 settings slot public props，修复 CSS 全局 `:root` 与裸 `kbd` selector，清理无用 locale key。
- 验证：离线安装通过；settings/composer/browser 共 18 tests 通过；typecheck 与 diff check 通过。

## Repair round 2
- 以 runtime 的最新 `activeProfileId()` snapshot 作为保存完成后的权威状态；subscription 不再在 pending 时丢弃外部更新。
- 保留 request id guard，旧请求 completion 不会覆盖新请求的 pending 状态；保存成功或失败后都会重新读取最新 active，外部 pending 更新不会被初始 previous 覆盖。
- 新增保存期间外部切换到不同 profile 的 failure/success 测试，锁定最终 selection 跟随最新 good snapshot。
- 补回实际使用的 `aria.profileOption` 中英文 locale，删除未使用 `error.unknownProfile`，保留 `error.saveFailed` 以兼容既有 namespace contract。
- 验证：离线安装通过；`settings-card`、`composer`、`browser-plugin` 共 3 files / 18 tests 通过；typecheck 与 `git diff --check` 通过。
