墨吟阅读器 v1.10.1 — Linux / 信创版这次是真程序了。

## 这一版最重要的事

上一版给的 Linux 包是「网页 + 启动脚本」，得靠系统的 Python 或浏览器。这次换成**真正的独立程序**：

- **10 MB 单文件，双击就跑**，不需要装 Python、不需要装任何依赖
- 只依赖系统自带的 `libc` / `libz` / `libpthread`（glibc 2.28+）
- 在**统信 UOS 20 专业版（x86_64）**上真机实测：书架、导入、翻页、主题、对话框全部正常
- 窗口用系统浏览器内核的「应用模式」打开 —— 没有地址栏、没有标签页，是个独立窗口，关掉就退出

实测环境：统信 UOS Desktop 20 Professional，内核 6.6.28-amd64-desktop-hwe，1280×800，53 个中文字体。

## 怎么用（Linux / 信创）

1. 下载 `MoYinReader-Linux-1.10.1.tar.gz`，**解压出来**（别在压缩包里直接点）
2. 双击「墨吟阅读器.sh」—— 它会优先跑同目录的 `MoYinReader`
3. 想放进应用菜单 / 桌面：双击一次「安装到应用菜单.sh」

想清掉菜单项：双击「卸载.sh」（书和笔记不动）。

## 其它架构怎么办

飞腾 / 鲲鹏（aarch64）、龙芯（loongarch64）用不了 x86_64 的二进制，但**照样能用**：

- 双击「墨吟阅读器.sh」会自动退回 Python 方式（系统自带 python3 就够）
- 或者直接双击 `MoYinReader.html`，用浏览器打开，功能一模一样
- 想打成自己架构的独立程序：在本机跑一次 `bash build-linux.sh`

## 这一版还修了什么

- **Linux 上的路径判断**：以前会把 `/tmp/x` 当成 Windows 网络路径、改写成 `\\tmp\x`，导致「网络位置」在 Linux 上完全失效。现在按平台分开处理，Linux 直接认挂载点（`/mnt/nas/books`、`~/books`）。
- 自检项按平台分开断言，不再拿 Windows 的 UNC 规则去测 Linux。

## 各平台产物

| 文件 | 说明 |
|---|---|
| `MoYinReader.exe` (47.3 MB) | Windows 完整版，174 个离线语音 + 分角色朗读 |
| `MoYinReader_Lite.exe` (17.1 MB) | Windows 轻量版，需同目录 `VoicePack` |
| `MoYinReader.apk` (176.8 KB) | 安卓，versionCode 16 |
| `MoYinReader.html` (347.7 KB) | 单文件网页版，任何系统都能跑 |
| `MoYinReader-Linux-1.10.1.tar.gz` (9.75 MB) | **本期主角**：x86_64 独立程序 + 兜底网页 |
| `MoYinReader-macOS-1.10.1.zip` (138.7 KB) | macOS 源码 + 一键打包脚本 |

五个包（apk / html / linux 里的 html / mac 里的 html）内嵌页面 md5 完全一致：`9d1eafe653a1`。

## 验证

| 项目 | 结果 |
|---|---|
| Linux 二进制自检（27 项：内嵌页、本地服务、导入通道、路径判断） | 全过 |
| 统信 UOS 真机：启动 / 窗口 / 页面渲染 / 选择文件夹对话框 | 全过（截图见 README） |
| `_check_v19.js` / `_check_v18.js` | 124 / 95 |
| `_cdp_verify.js` | 118 |
| `_check_role.js` / `_check_voices.js` | 48 / 22 |
| `_check_v17.js` / `_check_v171.js` | 57 / 17 |
| exe 打包验收 / apk 体检 | 全过（标题 1.10.1）/ 全过 |

## 已知限制

- Linux 上朗读走系统语音；**分角色朗读需要 Windows 版那套神经语音引擎**，Linux 暂不支持
- Linux 的「网络位置」要用系统已挂载的路径（SMB 请先用系统挂载到 `/mnt/...`），不像 Windows 能直接填 `\\主机\共享`
- macOS 版仍是「源码 + 打包脚本」：这个虚拟机环境里没法交叉编译 Mac 二进制，需要你在 Mac 上跑一次

作者 / 版权 © 2026 永远的兰兰（Lanlan Eternal）
本工具仅供个人阅读自己合法持有的电子书使用。
