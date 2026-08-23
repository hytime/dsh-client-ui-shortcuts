状态：完成

提交 hash：c5df40b420d2df956ba1cc2aac30a3b88992de8c

修改文件：
- tests/keyboard-router.client.spec.ts

实现审计：
- `src/client/keyboard/router.ts` 基线已包含稳定的 `{ capture: true }` 注册与移除。
- 完整 command 和 chord prefix 均通过 `consume()` 调用 `preventDefault()`、`stopPropagation()` 和可选的 `stopImmediatePropagation()`。
- chord prefix 在等待第二 stroke 期间保留 resolver state；完整 command、无效输入、650ms timeout 和 dispose/update 的 reset 路径会清理状态。
- input、textarea、select、contenteditable、IME、repeat、pending interaction 的让位规则保持不变。
- 不声称拦截 OS/Chrome 未分发给 DOM 的保留键。

RED/GREEN：
- RED：先补充 chord 连续消费、guard/IME/repeat/pending 让位、timeout 清理测试；首次运行暴露测试环境误用 `document`，修正为 HTMLElement-like target 后重新确认测试有效。
- GREEN：8/8 focused tests 通过，覆盖 capture options、传播阻止、chord 连续解析、timeout 清理及让位规则。

验证：
- `CI=true pnpm exec vitest run --dir tests keyboard-router.client.spec.ts`：8/8 通过。
- `CI=true pnpm run typecheck`：通过。
- `git diff --check`：通过。

剩余疑虑：
- 浏览器/操作系统在 keydown 之前拦截、或根本不向 DOM 分发的保留快捷键不属于页面 capture listener 可拦截范围。


## 修复轮次 1

状态：完成

RED：
- 首次 focused 命令：`CI=true pnpm exec vitest run --dir tests keyboard-router.client.spec.ts`，基线 8/8 通过。
- 新增真实 DOM 事件测试后首次运行正确暴露问题：事件 target 在 jsdom dispatch 场景需要显式提供，且真实 command/prefix 断言在 listener 异常时未成立；修正测试 setup 后进入 GREEN。

GREEN：
- `CI=true pnpm exec vitest run --dir tests keyboard-router.client.spec.ts`：10/10 通过，无未处理错误。
- `CI=true pnpm run typecheck`：通过。
- `git diff --check`：通过。

真实事件测试说明：
- 测试文件启用 jsdom，使用真实 `KeyboardEvent`、`window.dispatchEvent` 和真实 EventTarget listener 注册。
- command 与 prefix 分别注册 capture、same-target capture、same-target bubble listeners，断言 `defaultPrevented` 及传播顺序均被阻止。
- guarded input、IME、repeat、pending Enter/Escape 使用真实事件并断言不消费；现有 mock-path 行为覆盖保留。

本轮修改：
- `tests/keyboard-router.client.spec.ts`
- 生产 router 未修改，现有 capture 与消费实现满足真实事件行为。

实际提交 hash：`905d0c95e000b762d6baaf6dfb814ecb291ce6eb`。

