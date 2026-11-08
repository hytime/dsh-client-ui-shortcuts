# @takomitkm/dsh-shortcuts

[![npm version](https://img.shields.io/npm/v/%40hytime%2Fdsh-client-ui-shortcuts?logo=npm&label=upstream)](https://www.npmjs.com/package/@hytime/dsh-client-ui-shortcuts) [![license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit/)

DSH(DeepSeek Harness)Web/桌面端的**双轨快捷键插件**(基于 [hytime/dsh-client-ui-shortcuts](https://github.com/hytime/dsh-client-ui-shortcuts) 的 fork)。本插件把一批高频动作注册为 **DSH 官方快捷键命令**——它们直接出现在 **DSH 设置 → 通用 → 键盘快捷键**(`Ctrl+/`)里,享受官方的录制改键、冲突检测、按设备持久化;另有快速面板与可选的 Question/Approval 键盘增强。`mod` 在 macOS 上匹配 Cmd、其他平台匹配 Ctrl。

命令按**功能域**分组(Qoder 风格),快速面板里按组渲染:

## 通用(General)

| 命令 | 动作 | 默认键 |
|---|---|---|
| `dsh-shortcuts.open` | 呼出快速面板 | `Ctrl+Alt+Shift+S`(Linux Web 无默认) |

快速面板列出**全部官方命令**(含 DSH 自带的 7 条),搜索过滤、录制/重置/清除,与 DSH 官方设置双向同步;配置导入导出(完整快照,经官方服务逐条恢复,支持键位互换)。

## 输入(Input)

| 命令 | 动作 | 默认键 |
|---|---|---|
| `dsh-shortcuts.composerFocus` | 聚焦输入框 | 未绑定 |
| `dsh-shortcuts.pasteClipboard` | 粘贴剪贴板到输入框(光标处插入,替换选区,自动聚焦) | 未绑定 |

## 会话(Sessions)

| 命令 | 动作 | 默认键 |
|---|---|---|
| `dsh-shortcuts.newSession` | 新建会话 | 未绑定 |
| `dsh-shortcuts.prevSession` | 上一个会话(侧栏顺序,循环) | 未绑定 |
| `dsh-shortcuts.nextSession` | 下一个会话(侧栏顺序,循环) | 未绑定 |
| `dsh-shortcuts.forkSession` | 分叉当前会话 | 未绑定 |

会话切换镜像侧栏的完整显示顺序(工作区按注册表顺序、组内按最近活动排序、未分组桶垫底),跳过空白与归档行,两端循环。

## 视图(View)

| 命令 | 动作 | 默认键 |
|---|---|---|
| `dsh-shortcuts.toggleSidebar` | 切换侧栏 | 未绑定 |
| `dsh-shortcuts.toggleDetails` | 切换详情面板 | 未绑定 |
| `dsh-shortcuts.toggleTheme` | 切换浅色/深色主题 | 未绑定 |
| `dsh-shortcuts.scrollTop` | 滚动到对话顶部 | 未绑定 |
| `dsh-shortcuts.scrollBottom` | 滚动到对话底部 | 未绑定 |

## 老板键(Boss Key)——两种

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

## 可选交互增强(默认关闭)

| 开关 | 开启后 |
|---|---|
| Question 增强 | 问题卡片支持方向键选择、Enter 确认、Escape 取消任务 |
| Approval 增强 | 审批卡片支持键盘选择「允许一次/拒绝」;绝不自动授权 |

## 安装

```sh
dsh plugin --profile desktop add link:S:\apps\llm\agentwork\dsh-client-ui-shortcuts-fork   # 本地开发
dsh plugin --profile desktop add github:takomitkm/dsh-shortcuts                            # 发布后
```

装完**完全退出桌面端(含托盘)再打开**。浏览器 Web profile 同理(`--profile web`)。

## 上游与差异

基于 [hytime/dsh-client-ui-shortcuts](https://github.com/hytime/dsh-client-ui-shortcuts)(其本身已把快捷键管理交给 DSH 官方服务)。本仓库把 [blue-a11y/dsh-client-shortcuts](https://github.com/blue-a11y/dsh-client-shortcuts) 的全部动作集重新实现为官方命令(输入/会话/视图域 + 老板键),新增功能域分组与完整老板键区块;上游的快速面板、官方键位管理、Question/Approval 增强全部保留。

License: MIT(承上游)。
