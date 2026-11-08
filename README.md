# @takomitkm/dsh-shortcuts

[![version](https://img.shields.io/badge/version-0.3.0-blue)](https://github.com/takomitkm/dsh-shortcuts) [![upstream](https://img.shields.io/npm/v/%40hytime%2Fdsh-client-ui-shortcuts?logo=npm&label=upstream)](https://www.npmjs.com/package/@hytime/dsh-client-ui-shortcuts) [![license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit/)

当前版本 **0.3.0**(插件自身版本,与 DSH 版本独立)· 包名 `@takomitkm/dsh-shortcuts` · 基于 [hytime/dsh-client-ui-shortcuts](https://github.com/hytime/dsh-client-ui-shortcuts) 的 fork。

兼容性:适配 **DSH 0.2.x**(本机实测 `0.2.1-rc.5`;`peerDependencies` 声明 `>=0.2.0-rc.1 <1.0.0`)。DSH 大版本升级导致 API 变更时,本插件升次版本号并同步放宽/收紧 peer 范围。

## 安装

```sh
# 本地源码目录(开发)
dsh plugin --profile desktop add link:S:\apps\llm\agentwork\dsh-client-ui-shortcuts-fork
# GitHub(发布后)
dsh plugin --profile desktop add github:takomitkm/dsh-shortcuts@0.3.0
```

装完**完全退出桌面端(含托盘)再打开**。浏览器 Web profile 同理:`dsh plugin --profile web add …`。

## 简介

DSH(DeepSeek Harness)Web/桌面端的**纯快捷键插件**:把一批高频动作注册为 **DSH 官方快捷键命令**——直接出现在 **DSH 设置 → 通用 → 键盘快捷键**(`Ctrl+/`)里,享受官方的录制改键、冲突检测、按设备持久化;另有快速面板。`mod` 在 macOS 上匹配 Cmd、其他平台匹配 Ctrl。

## 命令(按功能域分组,快速面板里同款分组渲染)

### 通用(General)

| 命令 | 动作 | 默认键 |
|---|---|---|
| `dsh-shortcuts.open` | 呼出快速面板 | `Ctrl+Alt+Shift+S`(Linux Web 无默认) |

快速面板列出**全部官方命令**(含 DSH 自带的),搜索过滤、录制/重置/清除,与 DSH 官方设置双向同步;配置导入导出(完整快照,经官方服务逐条恢复,支持键位互换)。DSH 官方自带的「打开键盘设置」= `shortcuts.open`(`Ctrl+/`),注册位置见 [ui-shortcuts/src/client/index.ts:48](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-shortcuts/src/client/index.ts#L48)。

### 输入(Input)

| 命令 | 动作 | 默认键 |
|---|---|---|
| `dsh-shortcuts.composerFocus` | 聚焦输入框 | 未绑定 |
| `dsh-shortcuts.pasteClipboard` | 粘贴剪贴板到输入框(光标处插入,替换选区,自动聚焦) | 未绑定 |

### 会话(Sessions)

| 命令 | 动作 | 默认键 |
|---|---|---|
| `dsh-shortcuts.newSession` | 新建会话 | 未绑定 |
| `dsh-shortcuts.prevSession` | 上一个会话(侧栏顺序,循环) | `Ctrl+Shift+[`(Linux Web 无默认) |
| `dsh-shortcuts.nextSession` | 下一个会话(侧栏顺序,循环) | `Ctrl+Shift+]`(Linux Web 无默认) |
| `dsh-shortcuts.forkSession` | 分叉当前会话 | 未绑定 |

会话切换镜像侧栏的完整显示顺序(工作区按注册表顺序、组内按最近活动排序、未分组桶垫底),跳过空白与归档行,两端循环。

### 视图(View)

| 命令 | 动作 | 默认键 |
|---|---|---|
| `dsh-shortcuts.toggleSidebar` | 切换侧栏 | 未绑定(DSH 官方已有 `Ctrl+B`,勿重复录制) |
| `dsh-shortcuts.toggleDetails` | 切换详情面板 | 未绑定 |
| `dsh-shortcuts.toggleTheme` | 切换浅色/深色主题 | 未绑定 |
| `dsh-shortcuts.scrollTop` | 滚动到对话顶部 | 未绑定 |
| `dsh-shortcuts.scrollBottom` | 滚动到对话底部 | 未绑定 |

### 老板键(Boss Key)——两种

| | 第一种:官方轨 `dsh-shortcuts.bossHide` | 第二种:OS 轨 dsh-bosskey(配套插件) |
|---|---|---|
| 形态 | 本插件注册的官方快捷键命令 | 独立 Host 插件 [takomitkm/dsh-bosskey](https://github.com/takomitkm/dsh-bosskey) |
| 键位 | 官方键盘设置里录制,按设备持久化 | OS 级全局热键(默认 **F9**),`~/.dsh/bosskey/config.json` 即时改 |
| 能力 | **只藏**:按一下把 DSH 窗口收进托盘(走官方 `ctx.shortcuts.closeWindow()` 桥,与托盘点击同一份账本) | **完整 toggle**:前台→隐藏、后台→唤回(壳官方 `dsh://open` 路径,输入正常) |
| 范围 | 桌面端应用内;浏览器 Web GUI 静默 no-op | **任意应用前台**全局响应(仅 Windows 桌面端) |

**怎么选**:装了 dsh-bosskey 用 F9(一键双向,全局);只想"窗口在前台时一键藏起来",录一个 `boss-hide` 即可。两者可并存。

```sh
dsh plugin --profile desktop add github:takomitkm/dsh-bosskey   # 可选:完整 toggle
```

装完重启,设置页的「完整老板键」区块提供开关、状态页(`dsh://bosskey/status`)与 **PowerToys 式冲突检测**(`dsh://bosskey/conflict`:瞬时 `RegisterHotKey` 试探,1409=被系统/其他应用占用)。

## 常见客户端键位对照

对照 ZCode 会话里贴的键位表、Qoder IDE、DSH 官方与其他插件,标注每个键位的归属——**哪些不用本插件做、哪些已由本插件覆盖**。

### AI IDE 常见键位(Qoder / ZCode 贴表)

| 按键 | 动作 | 归属 |
|---|---|---|
| `Ctrl+L` / `Ctrl+I` / `Ctrl+Shift+L` | 开关聊天面板 / inline chat | **DSH 官方 UI 自带**(侧栏常驻,无开关语义,官方未注册命令) |
| `Ctrl+,` / `Ctrl+Shift+,` | 设置 / 个人设置 | **DSH 官方自带**(`settings.open`,见 [ui-settings-general/src/client/index.ts:214](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-settings-general/src/client/index.ts#L214)) |
| `Ctrl+Shift+P` | 命令面板 | **DSH 官方自带**(快速命令菜单) |
| Enter / Shift+Enter | 发送 / 换行 | **DSH 官方 fixed 输入**(`fixed.send` / `fixed.newline`,见 [ui-conversation/src/client/apply.ts:273](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-conversation/src/client/apply.ts#L273)、[:275](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-conversation/src/client/apply.ts#L275)) |
| `#` / `/` / `@` | 加上下文 / 快捷命令 | **DSH 官方 UI 自带**(`fixed.slash` / `fixed.mention`,见 [ui-conversation/src/client/apply.ts:281](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-conversation/src/client/apply.ts#L281)) |
| `Ctrl+Enter` / `Ctrl+Backspace` | 接受/拒绝全部变更 | **DSH 官方 diff UI 自带**(无插件介入点) |
| `Ctrl+Shift+⏎` / `Ctrl+Shift+⌫` | 接受/拒绝单条变更 | 同上 |
| `Ctrl+Shift+[` / `]` | 上一个/下一个任务 | **本插件** `prevSession`/`nextSession`(会话级;默认键已对齐) |
| `Alt+J` / `Alt+K` | 下一个/上一个变更 | **DSH 官方 diff UI 自带** |
| `Ctrl+F` | 任务内查找 | **deja 插件专属**([vshulcz/deja-vu PR #5978](https://github.com/vshulcz/deja-vu/pull/5978) 把会话内查找交给 deja;勿在本插件重复) |
| `Ctrl+M` | 打开模型菜单 | ❌ 超出插件能力:模型菜单是会话 UI 内部组件,官方无命令 id、无服务可触发 |
| `Ctrl+Shift+M` | 切换会话模式 | ❌ 超出插件能力(无公开服务;第三方用 DOM 点击实现,脆弱,本仓库不做) |
| `Ctrl+T` | 切换思考深度 | ❌ 同上(官方 reasoning-effort 控件无命令化) |
| `Ctrl+[` / `Ctrl+]` | 后退 / 前进 | ❌ 超出插件能力:客户端无视图历史栈可寻址 |
| `Ctrl+N` | 新建任务 | **本插件** `newSession`(官方 `session.new` 未注册成命令,且 Ctrl+N 是浏览器保留键;本插件默认未绑定,规避此问题) |
| `Ctrl+O` | 打开工作区 | **DSH 官方自带**(`workspace.openLocal`,见 [ui-open-in-app/src/client/index.ts:84](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-open-in-app/src/client/index.ts#L84)) |
| `Ctrl+W` | 关闭当前上下文 | **DSH 官方自带**(`page.close`,见 [ui-sidebar-right/src/client/shortcuts.ts:65](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-sidebar-right/src/client/shortcuts.ts#L65);桌面端兜底 closeWindow) |
| `Ctrl+B` | 切换左侧栏 | **DSH 官方自带**(`sidebar.left.toggle`,见 [ui-layout/src/client/index.ts:207](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-layout/src/client/index.ts#L207);本插件另有 `toggleSidebar` 未绑定,别录重) |
| `` Ctrl+` `` | 切换终端 | **DSH 官方自带**(`terminal.new`,见 [ui-sidebar-terminal/src/client/index.ts:55](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-sidebar-terminal/src/client/index.ts#L55)) |
| `Ctrl+Alt` | 切换右侧面板 | **DSH 官方自带**(`sidebar.right.toggle`,见 [ui-sidebar-right/src/client/shortcuts.ts:28](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-sidebar-right/src/client/shortcuts.ts#L28)) |
| `Ctrl+Shift`(全屏 chord) | 进入/退出完整视图 | **DSH 官方自带**(fullscreen,见 [ui-sidebar-right/src/client/shortcuts.ts:43](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-sidebar-right/src/client/shortcuts.ts#L43)) |
| `Ctrl+±` / `Ctrl+0` | 放大/缩小/恢复缩放 | **壳/浏览器层**(桌面壳未注册 zoom 加速器;网页继承 Chromium,插件无法注册浏览器保留键) |
| `Ctrl+Alt+Space` | Quick Ask 小框 | **壳级能力**(MochiNek0/dsh-desktop 等客户端实现);超出浏览器插件范围 |
| `Ctrl+Alt+D` | 显隐主窗 toggle | **OS 轨**:dsh-bosskey F9 同义;完整 toggle 需 OS 级热键 |

### 结论

- **本插件 13 条命令** = Qoder/贴表里"做得了且值得做"的那部分全集 + 老板键;其余键位要么 DSH 官方已内置,要么被 deja 占用,要么是主动取舍或架构边界(见上节,取舍项在官方命令化后可一行接入)。

### 本插件未实现 / 超出浏览器插件能力的键位(候选官方命令化清单)

> 关联**已有**请求(均已有人提过,故本插件**未新发** discussion;若要跟进,可在 [Ideas](https://github.com/deepseek-ai/deepseek-harness/discussions/categories/ideas) 分类下回复):
> - 完整窗口唤起/隐藏(半实现项):[#8749 希望支持全局唤起/隐藏快捷键,以及输入框聚焦快捷键](https://github.com/deepseek-ai/deepseek-harness/discussions/8749)
> - 桌面端缩放 `Ctrl+±/0`(做不了项):[#8355 [Feature] Windows 桌面版支持 Ctrl+= / Ctrl+- 页面缩放](https://github.com/deepseek-ai/deepseek-harness/discussions/8355) · 另见 [#7769](https://github.com/deepseek-ai/deepseek-harness/discussions/7769)、[#8648](https://github.com/deepseek-ai/deepseek-harness/discussions/8648)、[#8646](https://github.com/deepseek-ai/deepseek-harness/discussions/8646)、[#8962](https://github.com/deepseek-ai/deepseek-harness/discussions/8962)
> - **若上游接手本 fork(合并本 PR 或采纳本仓库实现),本 fork 将停止维护并删除**(届时无需再维护本仓库)。

以下键位**本插件未实现**。其中大部分是主动取舍(价值低/使用频率不足以抵消维护面),并非全部做不了;确实做不了的也在表里标明机制。每条附现状与机制,可直接用于向 DSH 官方提 discussion/issue 请求命令化:

| 按键 | 动作 | 状态 | 机制与说明 |
|---|---|---|---|
| `Ctrl+M` | 打开模型菜单 | **取舍不做** | 模型选择弹层是会话 UI 内部组件:官方未注册命令 id,没有公开服务可从外部触发;硬做只能模拟点击 DOM,脆弱且随版本漂移。若官方命令化(`session.modelMenu`)本插件可一行接入 |
| `Ctrl+Shift+M` | 切换会话模式(plan/agent) | **取舍不做** | 模式 chip 无公开服务;第三方 dsh-quick-keys 用 DOM 点击实现,本仓库不采纳此路径。官方命令化(`session.toggleMode`)后可接入 |
| `Ctrl+T` | 切换思考深度 | **取舍不做** | reasoning-effort 控件同属会话 UI 内部状态,未命令化。官方命令化(`session.cycleThinking`)后可接入 |
| `Ctrl+[` / `Ctrl+]` | 视图后退 / 前进 | **取舍不做** | 客户端没有可寻址的视图历史栈(导航是 React 状态机,无 back/forward API),官方先建栈才有的接 |
| `Ctrl+Alt+Space` | Quick Ask 小框(全局) | **取舍不做** | 需要全局热键 + 独立悬浮窗,超出本插件定位;如需此形态,dsh-bosskey 的监听器架构(Win32 RegisterHotKey + 独立进程)是现成路径,但目前只有老板键 |
| `Ctrl+±` / `Ctrl+0` | 放大 / 缩小 / 恢复缩放 | **做不了**([#8355](https://github.com/deepseek-ai/deepseek-harness/discussions/8355)) | 属壳/浏览器层:桌面壳未注册 zoom 加速器,页面层无法注册浏览器保留键。桌面端 Ctrl+±/0 本来就由 Chromium 处理 |
| `Ctrl+Alt+D` | 显隐主窗完整 toggle | **半实现**([#8749](https://github.com/deepseek-ai/deepseek-harness/discussions/8749)) | 隐藏半边已做(boss-hide);唤回半边需要 OS 窗口能力,完整 toggle 归桌面壳或 OS 级插件 |

共性的机制边界三条(适用于所有"做不了"的行):

1. **命令化缺失**:动作存在于官方 UI,但没有注册为 `ctx.shortcuts` 命令、也没有公开服务——插件只能触达服务与命令,不能触达组件内部状态。
2. **浏览器保留键**:页面层 `preventDefault` 之前就被浏览器消费的组合(`Ctrl+T/N/W` 等)永远绑不住,web 端做不了,desktop 端原生拦截可以。
3. **OS 窗口/全局热键**:BrowserWindow 的显隐、全局热键、独立悬浮窗都在壳或独立进程手里;Host 插件是普通 Node 进程,client 插件在浏览器里,都够不着。

## 自定义能力

判定标准:**出现在官方命令目录(catalog)里的命令 = 可改键**;**fixed 输入 / 壳与 OS 级 / 浏览器保留组合 = 不可改**。

### 可自定义(官方命令,改键即生效)

| 命令 id | 动作 | 默认键(桌面) |
|---|---|---|
| `browser.new` | 新浏览器页 | `Ctrl+T` |
| `terminal.new` | 新终端 | `` Ctrl+` `` |
| `settings.open` | 打开设置 | `Ctrl+,` |
| `shortcuts.open` | 打开键盘设置 | `Ctrl+/` |
| `sidebar.left.toggle` | 切换左栏 | `Ctrl+B` |
| `sidebar.right.toggle` | 切换右栏 | 以官方设置为准 |
| `workspace.files` | 工作区文件 | `Ctrl+P` |
| `workspace.openLocal` | 打开本地工作区 | `Ctrl+Alt+O` |
| `page.close` | 关闭当前上下文 | `Ctrl+W` |
| `page.refresh` | 刷新当前上下文 | `Ctrl+R` |
| `fullscreen` | 进入/退出完整视图 | `Mod+Alt+Enter` |
| **本插件 13 条** `dsh-shortcuts.*` | 面板 / 聚焦输入框 / 粘贴剪贴板 / 新建 / 上一个 / 下一个 / 分叉会话 / 切侧栏 / 切详情 / 切主题 / 滚到顶 / 滚到底 / 老板键·隐藏 | 见上方各节 |

改键位置:DSH 官方设置页(`Ctrl+/`)或插件快速面板,两处读写同一份官方配置;Web 存 `dsh.keybindings.v1`,Desktop 存 `userData/keybindings.json`;冲突会提示,重置一键恢复默认。

### 不可自定义(改不了,别费劲)

| 键 | 归属 / 原因 |
|---|---|
| `fixed.send`(Enter)、`fixed.newline`(Shift+Enter) | 官方 fixed 输入,官方契约固定,插件与设置都改不了 |
| `fixed.slash`(`/`)、`fixed.mention`(`@`)、`fixed.complementary` | 同上,输入法级触发符 |
| `Ctrl+T` / `Ctrl+N` / `Ctrl+W` 等浏览器保留组合(Web) | 页面层被浏览器先消费;Desktop 端由壳原生拦截,才可绑 |
| `Ctrl+±` / `Ctrl+0` 缩放 | 壳/浏览器层,未注册成命令(见"未实现"节) |
| 全局热键(如 dsh-bosskey 的 F9) | OS 级监听器注册,不在 DSH 命令目录内 |

## 上游与差异

基于 [hytime/dsh-client-ui-shortcuts](https://github.com/hytime/dsh-client-ui-shortcuts)(其本身已把快捷键管理交给 DSH 官方服务)。本仓库把 [blue-a11y/dsh-client-shortcuts](https://github.com/blue-a11y/dsh-client-shortcuts) 的全部动作集重新实现为官方命令,新增功能域分组、完整老板键区块与键位对照表。上游的快速面板与官方键位管理全部保留。已向上游提 PR:[hytime/dsh-client-ui-shortcuts#2](https://github.com/hytime/dsh-client-ui-shortcuts/pull/2);**若上游接手本 fork(合并本 PR 或采纳本仓库实现),将删除本 fork,不再维护**。

License: MIT(承上游)。
