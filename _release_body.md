墨吟阅读器 v1.10.0 — Windows 版补了几处桌面体验，并首次提供 Linux / 信创 与 macOS 版。

## Windows 版新增

**把书拖进窗口就导入**
TXT / EPUB 直接拖到窗口上，松手就开始导入，不用先点「导入」再翻目录；拖整个文件夹也行（里面的书一起进来）。正在看书时拖也不打断，导入完回书架就能看到。拖进来不是书的文件会明确提示。

**记住窗口大小和位置**
下次打开还是你上次调好的样子，不用每次重新拉。上次窗口如果在屏幕外（比如拔了外接显示器），会自动回到默认位置。

**目录能搜了**
长书几百章，侧栏「目录」顶部有搜索框，输关键字即时过滤，并显示「匹配 N 章」；搜不到会说「没有匹配的章节」。

**字重可选**
细 / 常规 / 中粗 / 粗 四档，在「设置 → 外观与版式」或「排版」面板里，中文正文看久了换一档更顺眼。

**顺带**：版本号比较改成按段判断（`1.10.0` 不会被误判成小于 `1.9.0`）。

## 首次提供 Linux / 信创 与 macOS 版

| 包 | 覆盖 |
|---|---|
| `MoYinReader-Linux-1.10.0.tar.gz` | 统信 UOS、银河麒麟、中标麒麟、openEuler、Deepin，以及 x86_64 / aarch64（飞腾、鲲鹏）/ loongarch64（龙芯） |
| `MoYinReader-macOS-1.10.0.zip` | Intel 与 Apple Silicon |

两个包都是**解压双击即用**：不需要装 Python、不需要敲命令。
包里同时带了 `start-linux.sh` / `start-macos.sh`（有 pywebview 就走原生窗口）、`build-linux.sh` / `build-macos.sh`（想打成二进制/`.app` 就在自己机器上跑一次）。

> ⚠️ 说明白：这两个包里的可执行入口是脚本，不是 ELF/Mach-O 二进制。
> 原因是 PyInstaller 只能打「本机架构 + 本机 glibc」的包，我这台 Windows 机器上没有可用的 Linux 环境（WSL 被本机安全策略禁用、没装 Docker），做不出能在你机器上跑的二进制。
> 如果你愿意开一台统信虚拟机并给我 SSH，我可以直接在虚拟机里打一次，产出真正的 `MoYinReader-linux-x86_64` 二进制再发上来。

## 验证

| 套件 | 结果 |
|---|---|
| `_check_v19.js`（112 → **124 项**：拖拽导入/非书拦截、字重、目录搜索过滤与空结果） | 124 / 124 |
| `_check_v18.js` / `_cdp_verify.js` | 95 / 95、118 / 118 |
| `_check_role.js` / `_check_voices.js` | 48 / 48、22 / 22 |
| `_check_v17.js` / `_check_v171.js` | 57 / 57、17 / 17 |
| exe 打包验收 / apk 体检 | 全过 / 全过 |

## 下载

| 文件 | 说明 |
|---|---|
| `MoYinReader.exe` | **Windows 完整版**，语音库打包在 exe 内，单文件即可朗读与分角色 |
| `MoYinReader_Lite.exe` | Windows 轻量版，需同目录放 `VoicePack` |
| `MoYinReader.apk` | 安卓版（versionCode 15） |
| `MoYinReader.html` | 单文件网页版（任何系统双击即用） |
| `MoYinReader-Linux-1.10.0.tar.gz` | Linux / 信创 |
| `MoYinReader-macOS-1.10.0.zip` | macOS |

默认零联网，书籍与进度只存在本机。
