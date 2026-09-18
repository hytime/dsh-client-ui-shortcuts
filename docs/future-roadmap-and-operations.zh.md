# DSH Client UI Shortcuts：未来路线图与运营计划

> 本文是 `@hytime/dsh-client-ui-shortcuts` 的长期维护参考。功能开发、版本规划、内容发布和社区运营都应以本文为起点；已经完成的功能以源码、测试和当前 Release 为准。

## 当前基线

当前基线版本：`0.1.22`（后续版本号由 GitHub Release 触发 publish action 写入）

当前核心能力：

- Question 和 Approval 流程的键盘操作；
- 只读的 Standard、Vim profile；
- 多个可命名的 Custom profile；
- Custom profile 的 New、Import、Export、Delete；
- 单方案 JSON v1 导入导出；
- 导入时生成新 ID，同名方案使用连续数字后缀；
- `Meta`、`Ctrl`、`Alt`、`Shift` 物理修饰键；
- 最多两段 chord、候选 binding 和冲突检测；
- 浏览器保留快捷键过滤；
- Session、Workspace、分支 Session 和主题操作；
- DSH capability 缺失时自动隐藏不可用动作；
- 旧 `customBindings` 配置迁移；
- 基于 settings revision 的并发安全写入；
- `showShortcuts` 全局命令（默认 `Meta+Alt+Shift+S`，Custom 可改绑）打开完整快捷键管理面板：方案切换、New / Import / Export / Delete、Custom 键位编辑，以及一个带搜索、按 Question/Approval/Global 分组、标注不可用动作的统一快捷键列表；
- 设置页「呼出面板快捷键」轻入口卡片：显示当前呼出键，点击打开面板并定位该行，只读方案下提示切换 Custom 后可改（不自动切换）；DSH `0.1.6` 起渲染在插件详情页，此前渲染在插件设置区；
- 界面语言除 DSH 自带的简体中文与英文外，另注册日文与韩文为可选语言；两者通过 locale 服务的 `addLanguage` 加入，该 API 在 `0.1.2-alpha.1` 才出现，旧版按能力探测跳过并仅保留中英；
- 设置页入口卡片按运行中 composition 实际声明的插槽挂载：DSH `0.1.6` 及以后用 `plugins.bundle.config`（按 bundle 包名寻址），此前各代用 `settings.plugin.item`（按 settings namespace 寻址），两者都由兼容层注入探测，无版本判断；
- Custom 方案按 Standard 默认补全其未定义的「命令 + scope」，使方案保存之后新增的命令不会静默失去默认键（与已有绑定冲突的默认键跳过；方案存储、导出与 fingerprint 不变）；
- 支持边界为 DSH `0.1.6-alpha.2` 及以后（该版本是引入 `plugins.bundle.config` 的第一个版本）；`0.1.0-rc.8` 至 `0.1.1-rc.2`、`0.1.2-alpha.1`、`0.1.5-*` 已不再支持，仅保留兼容层的运行时能力探测，使其退化而不崩溃。

安装入口：

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.22
```

GitHub 源码安装必须固定 tag 或 commit：

```bash
dsh plugin --profile web add github:hytime/dsh-client-ui-shortcuts#v0.1.22
```

## 产品目标

插件的长期目标不是堆积快捷键数量，而是形成稳定的使用闭环：

1. 用户能在 1 分钟内完成安装；
2. 第一次打开就能理解 Standard、Vim 和 Custom 的区别；
3. 用户可以安全创建、保存、导入、导出和删除方案；
4. 用户可以分享一个 JSON 方案，而不需要分享整个 DSH 配置；
5. 插件不会抢占 DSH 自己的输入、Question、Approval 或浏览器保留快捷键；
6. DSH capability 变化时，插件能自动适配并保持错误可解释；
7. 每次发布都有可复现的测试、打包和真实 DSH composition 验证。

## 功能路线图

### P0：体验打磨

目标：降低首次使用成本和配置失败后的恢复成本。

#### 首次使用引导

**已实现能力**

- 在完整快捷键管理面板内联展示首次使用引导，并支持关闭，不阻塞现有设置操作；
- 说明 Standard、Vim、Custom 和 JSON profile 的适用场景与基本流程；
- 提供创建 Custom profile 的 New 入口，以及导入 JSON profile 的 Import 入口；
- 使用带版本的 browser-local v1 marker 记录完成状态，不修改快捷键设置或 profile JSON；
- 不使用第三方 tour library，也不重复展示完整快捷键表，避免管理面板过于拥挤。

**后续优化**

- 根据真实使用反馈调整引导文案；
- 根据真实使用反馈调整首次触发和再次展示的条件。

#### 重置当前方案

**已实现能力**

- Custom profile 增加「恢复默认」操作，并在确认前显示当前方案名称；
- 重置保留方案名称和方案 ID，只替换 bindings；
- 写入失败时保留原方案和编辑草稿；
- Standard、Vim 不显示重置操作。

**后续优化**

- 根据真实使用反馈调整确认文案、错误提示和恢复路径；
- 持续验证只读方案、写入失败及 390×844 窄屏下的交互体验。

#### 冲突解释增强

保存失败时显示具体原因：

- 与哪个 command 冲突；
- 冲突属于哪个 scope；
- 是完全重复还是 chord 前缀冲突；
- 哪些平台会受到影响；
- 当前 binding 如何修改才能保存。

错误信息必须来自共享校验结果，不能在 React 组件中复制第二套冲突判断。

#### 搜索与筛选

当方案和动作继续增加后，为编辑器增加：

- 按 command 名称搜索；
- 按 scope 筛选：Question、Approval、Global；
- 只显示当前 composition 可用动作；
- 搜索不会改变保存顺序或持久化结构。

#### 兼容性说明

README 和安装指南维护 DSH 兼容性表：

| 插件版本 | DSH 版本 | 状态 | 备注 |
| --- | --- | --- | --- |
| `0.1.16` | `0.1.0-rc.8` 系列 | 历史 | 使用公开 Client settings 与 slots 接口；该世代已不在支持范围内 |
| `0.1.20` | `0.1.5-alpha.1` | 历史 | 移除 `dsh-client-runtime` 依赖；真实 composition 验收（面板、搜索、方案切换、设置页入口、窄屏） |
| `0.1.21` | `0.1.5-rc.2` | 历史 | 真实 composition 验收：插件进入 boot graph（54 项）且控制台 0 报错、面板几何/遮罩/搜索与 alpha.1 一致、设置页入口 Portal 与层级正常、日韩可选可切换。`0.1.5-alpha.2`、`0.1.5-rc.1` 为中间版本，仅静态核对 |
| `0.1.22` | `0.1.6-alpha.2` | **当前最低支持版本**（已在 peer 区间与 `dsh.client.inject` 中声明），已验证 | 真实 composition 验收：`settings.plugin.item` 被 `plugins.bundle.config` 取代，兼容层改按运行中声明的插槽挂载卡片（插件详情页渲染出入口卡片、按钮可打开面板、`Meta+Alt+Shift+S` 可打开面板、插件无控制台报错）；同时补全 Custom 方案缺失命令的默认键 |

新增 DSH 版本后，先运行自动化测试和真实 composition 验证，再更新表格。核对方式：从 npm 拉取新旧版本的 `@deepseek-ai/dsh-client-*` 包，逐文件比对 `lib/types/**/*.d.ts` 与主题 token 集合，而不是只看版本号；随后用真实 composition 做端到端验收。rc.2 的静态核对结论：locale / ui-slots / ui-settings / ui-settings-plugins / ui-renderer / ui-theme 声明无变化，`conversation.composer` 与 `ComposerChainProps` 无变化，新增 `main.conversation` 插槽为增量，`Menu` 新增可选 `autoFocus`，主题 359 个 token 集合一致，bundle loader 包装格式一致。`0.1.6` 的核对结论：`settings.plugin.item` 移除、`plugins.bundle.config` 与 `plugins.row.config` 新增（由 `ui-plugin-manager` 声明），`settings.plugins.tab` 保留；`conversation.composer`、`shell.overlay`、主题 token 与 bundle loader 格式无变化。插槽声明变更无法靠版本号判断，因此由兼容层探测。

两点核对经验（均已在 `0.1.6-alpha.2` 上实证）：

- **`dsh.client.inject` 是信息性依赖边，不是硬依赖**：加载器按 `if (dependency !== undefined)` 解析，指向组合中不存在的包时静默跳过（`packages/client/modules/src/client/system.ts`）。因此把新包加进 `inject` 不会让老组合加载失败。
- **peerDependencies 的预发布区间必须按「元组」书写**：npm semver 规定，带预发布段的版本只能被「同一 `major.minor.patch` 且同样带预发布段」的比较器匹配。因此旧的 `>=0.1.2-alpha.1 <1.0.0` 实际**不匹配** `0.1.5-rc.2`、`0.1.6-alpha.2`（可用 `semver.satisfies` 复核）。新增 DSH 版本时若沿用旧区间字符串，声明是失真的；下一个 minor 出现预发布版时同样需要再次加宽。

#### 收窄声明：已完成（`0.1.6-alpha.2` 为最低支持版本）

支持边界收窄到 `0.1.6-alpha.2` 时，`package.json` 与类型基线已同步如下（全部落在同一批提交，因为类型基线随 peer 区间一起前进）：

1. `dsh.client.inject` 与 `peerDependencies` 补 `@deepseek-ai/dsh-client-ui-plugin-manager`（`plugins.bundle.config` 的声明者）与 `@deepseek-ai/dsh-client-ui-renderer`（`0.1.6` 起 `Context.slots` 的声明者，`ui-slots` 在该版本已不是 client row）；
2. `Context.sessions` 在 `0.1.6` 不再声明，已按官方 client 插件写法改为读取 `ctx.get('sessions')`（本地最小类型 `SessionsLike`，服务本身仍在运行）；
3. `ui-settings-plugins@0.1.6-alpha.2` 不再声明 `settings.plugin.item`，已在插件内像 `plugins.bundle.config` 一样保留本地 SlotMap 合并；
4. 区间统一改为 `>=0.1.6-alpha.2 <1.0.0`，`tests/package-shape.spec.ts` 期望值同步；
5. `devDependencies` 的 `dsh-invariants` / `dsh-settings` 一并固定到 `0.1.6-alpha.2`，使编译与类型检查基线与 peer 区间一致；
6. chain 插槽 inject 的会话 id 在 `0.1.6` 是普通 `string`，已把该参数放宽为同时接受两代类型。

**供应链策略（新增 `pnpm-workspace.yaml`）**：pnpm 11 默认 `minimumReleaseAge` 为 24 小时，而本插件采纳某个 DSH 版本时该版本必然比这个窗口更「新」。实测症状是：lockfile 一旦固定 `0.1.6-alpha.2`，`pnpm install` 与**任何** `pnpm run`（其依赖状态检查会重新校验策略）都会以 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 失败，共 21 个条目。处理方式与 DSH 仓库自身对其一方包的做法一致——在 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 中逐条列出被固定的确切版本。每条只针对一个版本、不含范围，因此这些版本过龄后该列表自动失效，可直接删除。

#### 下一次收窄声明时的检查点

- **peerDependencies 的预发布区间必须按「元组」书写**：npm semver 只匹配「区间里同样写出该 `major.minor.patch` 元组」的预发布版。下一次 DSH minor 出现预发布版（例如 `0.1.7-*`）时，必须把该元组加进区间，否则声明会像 `>=0.1.2-alpha.1 <1.0.0` 那样失真。
- 先确认插槽声明者是否又迁移过（`Slots.listSubTree` 查 `available`），再决定 `Context.*` 服务是否仍需本地类型；`dsh.client.inject` 边可以放心增补，指向不存在的包会被跳过。

### P1：增强方案分享

目标：让用户有理由分享配置和插件。

#### 导入预览

导入 JSON 后、写入设置前显示预览：

- 方案名称；
- binding 总数；
- Question、Approval、Global 分布；
- 是否存在冲突；
- 是否会产生重名后缀。

预览失败时不得写入 `customProfiles`，也不得改变当前 active profile。

#### 方案描述

在自定义方案中增加可选 description：

- 名称保持用于下拉列表；
- description 用于管理面板详情；
- JSON v1 兼容增加字段前，必须先更新 codec、迁移策略和文档；
- Standard、Vim 的描述仍由 locale 提供；
- 自定义 description 按持久化字面显示，不经过 locale 翻译。

#### 示例 profile 目录

新增 `profiles/` 示例目录，优先提供：

- `minimal.json`：只保留 Question 和 Approval；
- `vim.json`：适合 Vim 用户的 Question/Approval 操作；
- `macos.json`：以 Meta 为主；
- `windows.json`：以 Ctrl 为主；
- `global-navigation.json`：展示 Session/Workspace 动作。

每个示例必须通过真实 `decodeCustomProfileJson()` 和完整冲突校验，并在 README 中提供导入方式。

#### 方案贡献流程

用户提交 profile 时要求：

1. 使用 JSON v1 格式；
2. 不包含内部 ID；
3. 通过测试和冲突校验；
4. 说明目标平台和 DSH capability；
5. 提供实际使用场景；
6. 不包含个人信息、Token 或 workspace 路径。

### P2：提升日常使用频率

#### 快捷键命令面板

**已实现（完整快捷键管理面板，随 `showShortcuts` 落地）：** 新增全局命令 `showShortcuts`（默认 `Meta+Alt+Shift+S`，可编辑），打开完整快捷键管理面板。面板使用一个统一快捷键列表：搜索只作用于当前 active profile；Standard / Vim 只读展示，Custom 直接编辑。方案切换、新建 / 导入 / 导出 / 删除与 Custom 键位编辑都围绕这份列表完成，取代了原先折叠在设置卡片里的管理功能：

- 展示当前 active profile 可用的 command，按 Question / Approval / Global 分组；
- 显示每个 command 的当前 binding（键帽沿用既有平台适配）；
- 对当前 DSH 不可用的全局 action 标注原因；
- 带搜索过滤；
- 方案管理（切 / 建 / 导 / 删）与 Custom 编辑全部内嵌；
- 设置页保留「呼出面板快捷键」轻入口卡片：显示当前呼出键，点击打开面板并定位该行（只读方案提示切换 Custom 后可改，不自动切换）；DSH `0.1.6` 起该卡片渲染在插件详情页的 `plugins.bundle.config` 坐席，此前渲染在插件设置区的 `settings.plugin.item` 坐席；
- 不替换 DSH 官方 command palette，不通过私有 DOM 路由调用 DSH UI。

**后续优化：** 根据真实使用反馈调整展示密度、快捷键记忆引导与窄屏布局。

#### Capability 诊断

管理面板可显示简短诊断：

- 当前 composition 缺少哪些公开 capability；
- 哪些全局动作因此不可用；
- 如何确认 DSH profile 是否包含所需插件。

诊断不展示完整 Cordis registry，不把 live service 对象传入 React。

#### 无障碍增强

持续覆盖：

- 键盘-only 操作；
- Tab 顺序；
- Enter/Escape 行为；
- 屏幕阅读器的名称、状态和错误；
- 高对比度；
- 390×844 窄屏；
- 方案切换、导入、删除确认和保存失败后的焦点位置。

### P3：团队分发与生态

只有出现真实需求后再考虑：

- 团队 profile 仓库；
- Git profile 集合；
- 受控的远程 profile registry；
- profile 版本兼容检查；
- 团队默认配置分发。

暂不做云同步、账号系统、后台服务或强制遥测。

## 优先级判断

| 优先级 | 功能 | 主要价值 | 依赖 |
| --- | --- | --- | --- |
| P0 | 首次使用引导 | 提高首次激活率 | 当前管理面板 |
| P0 | 重置当前方案 | 降低误配置恢复成本 | CAS settings 写入 |
| P0 | 冲突解释 | 降低保存失败后的困惑 | shared binding contract |
| P0 | 搜索和筛选 | 支持更多动作与方案 | editor 状态模型 |
| P1 | 导入预览 | 提高 JSON 分享安全感 | JSON codec |
| P1 | 示例 profile 目录 | 形成可分享内容 | JSON v1 |
| P1 | 方案描述 | 提高多个方案的可识别性 | settings schema migration |
| P2 | 命令面板 | 提升日常使用频率 | DSH 公共 action 能力 |
| P2 | Capability 诊断 | 降低兼容问题处理成本 | composition 检测 |
| P3 | 团队分发 | 支持组织使用 | 真实用户需求和安全评估 |

## 90 天排期

### 第 1–30 天：降低流失

交付：

- 首次使用引导；
- 重置当前 Custom 方案；
- 冲突解释；
- DSH 兼容性表；
- 安装故障排查补充；
- 收集真实用户反馈。

验收：

- 新用户无需阅读源码即可完成安装和第一次保存；
- reset、save failure、conflict error 都有明确恢复路径；
- 不改变默认键位或 Question/Approval 行为。

### 第 31–60 天：提高分享

交付：

- 导入预览；
- 示例 profile 目录；
- 方案 description；
- 双语使用文章；
- 至少一个经过真实 DSH Web 验证的 profile。

验收：

- 示例 JSON 可直接导入；
- 导入失败不会修改现有方案；
- 导入后用户能清楚看到新方案的名称、平台和 binding 数量。

### 第 61–90 天：建立生态

交付：

- 命令面板可行性评估；
- 更多公开 DSH capability 适配；
- profile 贡献指南；
- 兼容性自动化检查；
- 第二次稳定版本发布。

验收：

- 新增 capability 有对应缺失能力测试；
- profile 贡献不依赖内部实现细节；
- 版本升级有 migration、pack 和真实 composition 证据。

## 运营节奏

### 每周

- 回复新 Issue 和 Discussion；
- 标记可复现 Bug、兼容性问题和功能建议；
- 检查 npm 下载量、GitHub Stars、Unique Clones 和打开的 Issue 数量；
- 从用户问题中提取下一轮开发任务；
- 记录 DSH 新版本可能影响的公开接口。

### 每两周

发布一篇只围绕一个使用场景的短内容：

- 使用 Vim profile 操作 DSH Question；
- 为不同项目准备多个快捷键方案；
- 导出和分享团队快捷键配置；
- 处理浏览器保留快捷键冲突；
- 在 macOS、Windows、Linux 之间迁移方案。

每篇内容必须包含：

- 真实操作截图或录制；
- 安装命令；
- 适用 DSH 版本；
- 一个可复现的配置示例；
- 已知限制。

### 每月

- 发布一个稳定版本或维护版本；
- 创建 GitHub Release；
- 更新中英文 changelog；
- 检查 npm tarball 和 GitHub tag；
- 更新截图、JSON 示例和兼容性表；
- 只在有真实版本或内容变化时更新 awesome-dsh-plugin 投稿。

## GitHub 仓库运营

### Issue 模板

维护以下模板：

- Bug report；
- Feature request；
- DSH compatibility issue；
- Profile contribution。

Issue 必须尽量要求：

- 插件版本；
- DSH 版本；
- 操作系统和浏览器；
- 当前 profile 类型；
- 最小复现步骤；
- 是否能通过 JSON 导入复现；
- 是否包含截图或错误文本。

### Label 建议

- `good first issue`
- `help wanted`
- `compatibility`
- `profile`
- `keyboard`
- `json`
- `documentation`
- `needs reproduction`

### Release 内容模板

每次 Release 至少包含：

```markdown
## Highlights

- 面向用户的主要变化。
- 兼容性或迁移说明。
- 重要限制。

## Verification

- Test files and test count。
- Typecheck、bundle、pack 结果。
- 真实 DSH composition 验证结果。

## Install

npm 安装命令和固定 tag 的 GitHub 安装命令。
```

## Star 增长原则

Star 应该是用户完成价值体验后的自然反馈，不应通过刷量或骚扰获得。

合适的触发点：

1. README 安装说明后：如果插件让 DSH 键盘操作更顺手，欢迎留下 Star；
2. GitHub Release 末尾：如果正在使用这个插件，Star 可以帮助更多用户发现它；
3. Issue 关闭后：问题已修复并包含在某个版本，欢迎 Star 或分享 profile；
4. profile 贡献指南：欢迎提交经过验证的方案。

不要做：

- 购买或互刷 Star；
- 在无关项目 Issue 中推广；
- 通过隐藏遥测强行追踪用户；
- 频繁发布没有用户价值的版本；
- 用无意义的 README 修改制造活动记录。

## 指标

不要只看 Star，至少每月记录：

| 指标 | 目的 |
| --- | --- |
| GitHub Stars | 发现度和长期认可 |
| GitHub Unique Clones | 仓库曝光 |
| npm 月下载量 | 实际安装需求 |
| npm 版本分布 | 用户升级情况 |
| Release 点击量 | 版本触达情况 |
| Open Issues 数量 | 维护压力 |
| 首次响应时间 | 社区维护质量 |
| JSON profile 提交数 | 分享生态活跃度 |

前三个月可采用以下目标：

- 第 1 个月：获得 3–5 个真实 Issue 或 Discussion，收集至少 2 个外部使用反馈；
- 第 2 个月：提供 3–5 个可复用 profile，完成首次使用引导；
- 第 3 个月：完成一轮体验增强版本，建立兼容性表和 profile 贡献流程。

目标应根据实际基线调整，不把 Star 数量作为唯一发布成功标准。

## 发布前检查清单

### 功能与兼容性

- [ ] 默认 Standard/Vim 键位没有改变；
- [ ] Question/Approval 流程没有回归；
- [ ] Session/Workspace navigation 没有回归；
- [ ] 内置 profile 仍然只读；
- [ ] Custom profile 新建、保存、导入、导出、删除通过；
- [ ] 旧 `customBindings` 配置可以迁移；
- [ ] Custom 方案补全缺失命令的默认键后，键盘、面板列表与设置入口一致，且存储、导出与 fingerprint 未被改写；
- [ ] 设置页入口卡片在目标 DSH 版本的坐席上渲染（`0.1.6` 及以后为 `plugins.bundle.config`，此前为 `settings.plugin.item`）；
- [ ] 多页面并发修改不会静默覆盖方案；
- [ ] connection、settings、slots 等 DSH public API 依赖已声明；新增的插槽/服务拥有者（如 `plugins.bundle.config` 的 `ui-plugin-manager`、`Context.slots` 的 `ui-renderer`）同样已声明。
- [ ] `peerDependencies` 的 DSH 区间以当前目标版本的预发布元组书写（例如 `>=0.1.6-alpha.2 <1.0.0`），并用 `semver.satisfies` 复核其确实接受该版本。
- [ ] 若固定了发布不足 24 小时的 DSH 包，`pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 已列出这些确切版本（否则 `pnpm install` 与 `pnpm run` 均会失败）。

### 自动化验证

```bash
CI=true pnpm install --frozen-lockfile
CI=true pnpm run bundle
CI=true pnpm run typecheck
CI=true pnpm test
CI=true pnpm pack --dry-run --json
git diff --check
git status --short
```

### 发布操作

- [ ] `package.json.version` 与 changelog 版本一致；
- [ ] Git commit 已推送；
- [ ] Git tag 已推送；
- [ ] npm tarball 内容已检查；
- [ ] npm `latest` 指向目标版本；
- [ ] GitHub Release 已创建；
- [ ] Release 安装命令使用 npm 版本和固定 Git tag；
- [ ] 已确认现有 PR、awesome 列表和 README 是否需要同步。

### 发布后

- [ ] 使用 DSH CLI 安装 npm 版本；
- [ ] 使用 `--dump-config` 确认 `dsh-ui-shortcuts` row；
- [ ] 重载真实 Web composition；
- [ ] 检查完整快捷键管理面板和至少一条实际快捷键；
- [ ] 记录 npm 下载量和 Issue 反馈；
- [ ] 将发现的问题转入下一轮路线图。

## 明确不做

- 不为增长引入隐式遥测；
- 不把 Standard/Vim 改成可覆盖的动态配置；
- 不把所有自定义方案合并成一个难以分享的备份文件；
- 不在没有公开 DSH API 的情况下依赖私有 DOM 或内部 service；
- 不为尚无真实需求的团队同步、账号系统和云端 registry 提前建基础设施；
- 不因为运营指标压力改变快捷键安全边界或数据迁移规则。

## 文档维护规则

每次新增功能都应同步更新：

1. 适用的路线图阶段；
2. 优先级表；
3. 90 天排期中的对应交付物；
4. 发布前检查清单；
5. 中英文 README、installation 文档和 changelog（如果用户可见行为发生变化）。

如果路线图与源码、测试或当前 DSH public API 不一致，以源码和验证结果为准，并在下一次开发任务中修正文档。
