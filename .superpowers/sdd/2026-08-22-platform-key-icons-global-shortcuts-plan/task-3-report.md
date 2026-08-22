### TDD RED/GREEN
- RED 已运行并确认新增测试因缺少 platform props、键帽渲染、`findNewShortcutConflicts` 而失败。
- GREEN 未完成：聚焦测试仍有 3 个失败，见疑虑。

### 修改文件
- `src/client/components/ShortcutLegend.tsx`
- `src/client/components/ShortcutBindingEditor.tsx`
- `src/client/components/ShortcutProfileCard.tsx`
- `src/client/contract/slots.ts`
- `src/client/keyboard/conflicts.ts`
- `src/client/keyboard/visuals.ts`
- `src/client/apply.ts`
- 两个设置测试文件

### 测试结果
- `CI=true pnpm run typecheck`: PASS
- `git diff --check`: PASS
- 聚焦 Vitest: FAIL，editor 旧断言期望裸文本 `Ctrl`/小写 key；跨 scope 新冲突测试返回 2 而非 1。
- 完整测试未运行。
- 未提交 commit，因为实现尚未达到 GREEN。

### 疑虑
- `ShortcutBindingEditor` 已改为 SVG keycap，现有旧测试仍按文本断言，需要更新断言或提供兼容可访问文本。
- `findNewShortcutConflicts` 的 baseline 豁免必须基于 binding 内容是否修改，而非当前索引的简化判断；当前实现会额外报告 inherited pair。


### 修复轮次 2

#### 本轮修复
- `findNewShortcutConflicts` 按 mac/windows/linux 将 `Mod` 归一化为实际 Meta/Ctrl，再与显式 Ctrl/Meta 及 chord prefix 比较；补充三平台 cross-scope、prefix 和完整 normalized sequence 覆盖。
- baseline 豁免按 draft 原始 index 对齐，仅当 baseline 对应 pair 本身冲突，且两侧 command/scope 与 platform-specific normalized sequence 完全一致时豁免；修改任一侧或新增 scope 均报告冲突。
- 冲突去重 key 包含双方原始 index、command、scope 和完整 normalized sequence 集合，避免多 sequence 仅按首条序列去重。
- 删除 `displayStroke` 死代码及无效类型导入绕过；same-scope 校验改为完整 `draft`，平台过滤仅影响展示与平台相关冲突检查，隐藏 binding 保存时完整保留。
- `ShortcutLegend`、`ShortcutBindingEditor`、`ShortcutProfileCard` 的 `platform` 改为必填，并更新所有测试调用方；`apply.ts` 已使用运行时平台值注入 settings slot。
- 测试断言改为本地 Iconify SVG keycap 的可访问角色/标签，保留 Windows/Linux 的 Control 语义验证。

#### TDD RED/GREEN
- RED：先运行聚焦测试，确认 baseline 新增 global duplicate 产生额外 inherited pair；新增完整 pair 去重断言后再次确认失败（现有实现返回 4，期望行为区分 pair）。
- GREEN：完成冲突算法与契约调用方修复后聚焦测试通过。

#### 验证命令输出
- `CI=true pnpm exec vitest run --dir tests settings-card.client.spec.tsx shortcut-binding-editor.client.spec.tsx shortcut-keycap.client.spec.tsx`：PASS，3 files / 32 tests。
- `CI=true pnpm exec vitest run --dir tests`：PASS，15 files / 159 tests。
- `CI=true pnpm run typecheck`：PASS，`tsc --noEmit`。
- `git diff --check`：PASS。

#### 修改文件
- `src/client/components/ShortcutBindingEditor.tsx`
- `src/client/components/ShortcutLegend.tsx`
- `src/client/components/ShortcutProfileCard.tsx`
- `src/client/keyboard/conflicts.ts`
- `tests/settings-card.client.spec.tsx`
- `tests/shortcut-binding-editor.client.spec.tsx`

#### 疑虑
- 当前冲突结果仍按每个实际 binding pair 返回一条；同一 key 的不同 command/scope/index pair 会分别阻止保存，这是完整 pair 去重要求下的预期行为。


### 最终复核修复
- 文件：`tests/settings-card.client.spec.tsx`、`src/client/keyboard/conflicts.ts`。
- 清理设置卡测试中全部重复 `platform` JSX 属性；按 `git show HEAD:tests/settings-card.client.spec.tsx | grep -n 'platform='` 逐项核对，最终源码每个组件调用只保留一个平台值，并修正 Mac 键帽断言为 Command。
- 强化平台兼容过滤覆盖：symbolic/physical 的显式 Ctrl/Meta，以及 `sequence` 和 `sequences` 的后续 stroke，分别验证 mac 与 Windows/Linux 的过滤和冲突行为。兼容性实现遍历完整 sequence/sequences strokes，隐藏 binding 仍参与完整 draft/schema 校验并在保存时保留。
- 未修改已完成的 keycap 组件或任务 4 global action adapter。

#### 最终验证命令
- `CI=true pnpm exec vitest run --dir tests settings-card.client.spec.tsx shortcut-binding-editor.client.spec.tsx shortcut-keycap.client.spec.tsx`：PASS，3 files / 33 tests。
- `CI=true pnpm exec vitest run --dir tests`：PASS，15 files / 160 tests。
- `CI=true pnpm run typecheck`：PASS，`tsc --noEmit`。
- `git diff --check`：PASS。
- 重复属性静态检查：PASS；工作树测试文件无重复 JSX `platform` 属性。
