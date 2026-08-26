# DSH Client UI Shortcuts：未来路线图与运营计划

> 本文是 `@hytime/dsh-client-ui-shortcuts` 的长期维护参考。功能开发、版本规划、内容发布和社区运营都应以本文为起点；已经完成的功能以源码、测试和当前 Release 为准。

## 当前基线

当前稳定版本：`0.1.14`

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
- 基于 settings revision 的并发安全写入。

安装入口：

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.14
```

GitHub 源码安装必须固定 tag 或 commit：

```bash
dsh plugin --profile web add github:hytime/dsh-client-ui-shortcuts#v0.1.14
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

当前状态：已在设置卡片内联实现首次使用引导，使用 browser-local v1 marker 记录完成状态，并提供 New 与 Import 的直接入口；未使用第三方 tour library。后续根据真实反馈调整文案和触发条件。

- 第一次打开设置卡片时展示简短引导；
- 说明 Standard、Vim、Custom 的适用场景；
- 说明 New、Import、Export、Delete 的作用；
- 引导不重复展示完整快捷键表，避免设置卡片过于拥挤；
- 引导必须支持关闭，不能阻塞现有设置操作。

#### 重置当前方案

- Custom profile 增加「恢复默认」操作；
- 重置前显示当前方案名称；
- 重置必须保留方案名称和方案 ID，只替换 bindings；
- 写入失败时保留原方案和编辑草稿；
- Standard、Vim 不显示重置操作。

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
| `0.1.14` | `0.1.0-rc.8` 系列 | 已验证 | 使用公开 Client settings 与 slots 接口 |

新增 DSH 版本后，先运行自动化测试和真实 composition 验证，再更新表格。

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
- description 用于设置卡片详情；
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

在 DSH 已提供公开能力后，考虑增加插件自己的动作查看入口：

- 展示当前可用 command；
- 显示当前 binding 和 scope；
- 显示不可用 action 的原因；
- 不替换 DSH 官方 command palette；
- 不通过私有 DOM 路由调用 DSH UI。

#### Capability 诊断

设置卡片可显示简短诊断：

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
| P0 | 首次使用引导 | 提高首次激活率 | 当前设置卡片 |
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
- [ ] 多页面并发修改不会静默覆盖方案；
- [ ] connection、settings、slots 等 DSH public API 依赖已声明。

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
- [ ] 检查设置卡片和至少一条实际快捷键；
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
