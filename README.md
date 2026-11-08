# @takomitkm/dsh-shortcuts

[![npm version](https://img.shields.io/npm/v/%40hytime%2Fdsh-client-ui-shortcuts?logo=npm&label=upstream)](https://www.npmjs.com/package/@hytime/dsh-client-ui-shortcuts) [![license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit/)

DSH(DeepSeek Harness)Web/桌面端的**双轨快捷键插件**(基于 [hytime/dsh-client-ui-shortcuts](https://github.com/hytime/dsh-client-ui-shortcuts) 的 fork,在其官方快捷键接入之上扩展)。`mod` 在 macOS 上匹配 Cmd、其他平台匹配 Ctrl。

## 两种老板键

| | 第一种:官方轨 `boss-hide` | 第二种:OS 轨 dsh-bosskey(配套插件) |
|---|---|---|
| 形态 | 本插件注册的**官方快捷键命令** `dsh-shortcuts.bossHide` | 独立 Host 插件 [takomitkm/dsh-bosskey](https://github.com/takomitkm/dsh-bosskey) |
| 键位 | 在 **DSH 官方设置 → 通用 → 键盘快捷键**(`Ctrl+/`)里录制,按设备持久化 | OS 级全局热键(默认 **F9**),`~/.dsh/bosskey/config.json` 可改,**改动即时生效** |
| 能力 | **只藏**:按一下把 DSH 窗口收进托盘(走官方 `ctx.shortcuts.closeWindow()` 桥,与托盘点击同一份账本) | **完整 toggle**:前台→隐藏、后台→唤回(唤回走壳的官方 `dsh://open` 路径,输入正常) |
| 范围 | DSH 窗口获得过焦点后的应用内按键 | **任意应用前台**都响应(游戏全屏除外) |
| 平台 | 桌面端有效;浏览器 Web GUI 静默 no-op | 仅 Windows(桌面端);热键只在 DSH 运行期间有效 |

**怎么选**:装了 dsh-bosskey 就用 F9(一键双向,全局);只想"窗口在前台时一键藏起来"、不想装 Host 插件,录一个 `boss-hide` 的键即可。两者可并存,互不冲突。

## 双轨架构

本插件的键位分两条轨,互不抢键:

- **官方轨**:`dsh-shortcuts.open`(呼出快速面板,默认 `Ctrl+Alt+Shift+S`)、`dsh-shortcuts.composerFocus`(聚焦输入框,默认未绑定)、`dsh-shortcuts.bossHide`(老板键·隐藏,默认未绑定)——三个命令都注册进 DSH 官方快捷键服务,在 **DSH 设置 → 通用 → 键盘快捷键** 与快速面板里双向同步改键,冲突检测、录制、持久化全由 DSH 官方管理
- **插件轨**:快速面板内的搜索/跳转、Question/Approval 键盘增强(**默认关闭**,开启才接管)、完整老板键区块(dsh-bosskey 开关、状态页/冲突检测入口)

OS 级全局热键(F9)不属于任何一轨——浏览器插件够不着 OS 窗口,它由 dsh-bosskey 的监听器进程(Win32 `RegisterHotKey`)承担。

## 安装

```sh
dsh plugin --profile desktop add link:S:\apps\llm\agentwork\dsh-client-ui-shortcuts-fork
```

或 GitHub(发布后):

```sh
dsh plugin --profile desktop add github:takomitkm/dsh-shortcuts
```

装完**完全退出桌面端(含托盘)再打开**。浏览器 Web profile 同理(`--profile web`)。

### 完整老板键(可选)

```sh
dsh plugin --profile desktop add github:takomitkm/dsh-bosskey
```

装完重启,按 F9 即完整 toggle;改键/冲突检测/状态页见插件设置页的「完整老板键」区块(`dsh://bosskey/status`、`dsh://bosskey/conflict`)。

## 使用

### 官方轨命令(在 DSH 官方键盘设置里改键)

| 命令 | 动作 | 默认键 |
|---|---|---|
| `dsh-shortcuts.open` | 呼出快速面板 | `Ctrl+Alt+Shift+S`(Linux Web 无默认) |
| `dsh-shortcuts.composerFocus` | 聚焦输入框 | 未绑定 |
| `dsh-shortcuts.bossHide` | 老板键:隐藏窗口到托盘 | 未绑定 |
| `dsh-shortcuts.newSession` | 新建会话 | 未绑定 |
| `dsh-shortcuts.prevSession` | 上一个会话(侧栏顺序,循环) | 未绑定 |
| `dsh-shortcuts.nextSession` | 下一个会话(侧栏顺序,循环) | 未绑定 |
| `dsh-shortcuts.forkSession` | 分叉当前会话 | 未绑定 |
| `dsh-shortcuts.toggleSidebar` | 切换侧栏 | 未绑定 |
| `dsh-shortcuts.toggleDetails` | 切换详情面板 | 未绑定 |
| `dsh-shortcuts.toggleTheme` | 切换浅色/深色主题 | 未绑定 |
| `dsh-shortcuts.scrollTop` | 滚动到对话顶部 | 未绑定 |
| `dsh-shortcuts.scrollBottom` | 滚动到对话底部 | 未绑定 |

除面板外的命令默认未绑定——在官方设置页或快速面板里录制一次,按设备持久化。会话切换镜像侧栏的完整显示顺序(工作区按注册表顺序、组内按最近活动排序、未分组桶垫底),跳过空白与归档行,两端循环。

### 插件轨(快速面板 `Ctrl+Alt+Shift+S`)

- **官方快捷键**页签:列出全部官方命令(含上面三个),录制/重置/清除,与 DSH 官方设置双向同步;冲突、不支持组合、配置过期、读写失败各有独立提示
- **配置**:Question/Approval 增强开关(默认关)、配置导入导出(完整快照,经官方服务逐条恢复)
- **完整老板键区块**:dsh-bosskey 开关(本浏览器偏好)、`dsh://bosskey/status` 状态页、`dsh://bosskey/conflict` 冲突检测对话框(PowerToys 式试探:瞬时 `RegisterHotKey`,1409=占用)

## 上游与差异

基于 [hytime/dsh-client-ui-shortcuts](https://github.com/hytime/dsh-client-ui-shortcuts)(其本身已把快捷键管理交给 DSH 官方服务)。本仓库在其之上把 [blue-a11y/dsh-client-shortcuts](https://github.com/blue-a11y/dsh-client-shortcuts) 的**全部动作集**(聚焦输入框、新建/切换/分叉会话、切侧栏/详情、主题、滚动、老板键·隐藏)重新实现为**官方命令**,外加完整老板键区块、包名与命令 id 命名空间(`@takomitkm/dsh-shortcuts` / `dsh-shortcuts.*`)。上游的快速面板、官方键位管理、Question/Approval 增强全部保留。

License: MIT(承上游)。
