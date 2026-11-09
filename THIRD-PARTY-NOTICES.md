# 第三方组件与许可 · Third-Party Notices

墨吟阅读器本体以 **MIT 许可证**发布，版权 © 2026 Lanlan Eternal（永远的兰兰）。
完整许可文本见 [LICENSE](LICENSE)。

本文件列出随软件分发或运行时依赖的第三方组件。它们各自遵循其原始许可证，本项目不修改其源码。

## 组件清单

| 组件 | 许可证 | 用途 | 来源 |
|---|---|---|---|
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0 | 本机离线语音合成引擎（CPU 推理） | k2-fsa / Next-gen Kaldi |
| 小雅 `xiao_ya` / 超文 `chaowen` 中文 VITS | 各自发布页条款（Piper 中文模型，Apache-2.0 系） | 男女主角与旁白用的 22.05 kHz 声线，也是分角色 8 个快声线的基干 | 随 sherpa-onnx Release 分发 |
| fanchen-C 中文多说话人 VITS | 按其 HuggingFace 发布页条款 | 187 个配角声线共用的 16 kHz 声学模型 | 随 sherpa-onnx Release 分发 |
| （可选）Piper `en_US` 英文 VITS + espeak-ng 音素数据 | MIT / Apache-2.0（随其发布页） | 中英混排里的英文单词，以及纯英文段落的本地合成。**不随包分发**，用户自行放入 `VoicePack/models/piper-en/` | Piper / rhasspy |
| [pywebview](https://github.com/r0x0r/pywebview) | BSD-3-Clause | Windows 桌面外壳的窗口与 WebView 绑定 | r0x0r |
| [pythonnet](https://github.com/pythonnet/pythonnet) | MIT | pywebview 与 .NET / WebView2 之间的桥接 | pythonnet |
| [PyInstaller](https://pyinstaller.org) | GPL-2.0 **附 bootloader 例外** | 打包为单文件 exe | PyInstaller 项目 |
| Microsoft Edge WebView2 Runtime | 微软随 Windows 分发的运行环境 | 渲染界面（不打包、不修改、不重新分发） | Microsoft |

### 关于 PyInstaller 的 GPL

PyInstaller 本身是 GPL-2.0，但其 **bootloader 例外条款**明确允许：使用 PyInstaller 打包的程序
可以按打包者自选的许可证分发，不因打包行为而被要求开源。因此本项目的 MIT 许可在此场景下有效。

### 关于模型

语音能力来自上述开源引擎与开源模型，**项目本身不包含、不训练、不再分发任何语音数据或书籍内容**。
模型文件不入仓库，由 `VoicePack/install.py` 从上游 GitHub Release 按需下载。可选的英文模型
（`VoicePack/models/piper-en/`）同样不入仓库、不随安装包分发，由用户自行放置；没有它也能正常朗读中文，
纯英文段落会交给系统英文语音或按长度留白。

## 免责

本软件不附带任何书籍内容，仅供阅读自己合法持有的电子书使用；不提供、不获取、不破解任何受版权保护的
内容，不绕过 DRM。软件按「现状」提供，不附带任何明示或默示担保。

---

## English

MoYin Reader itself is released under the **MIT License**, © 2026 Lanlan Eternal.

Third-party components keep their own licenses: sherpa-onnx (Apache-2.0), the Chinese VITS models
`xiao_ya` / `chaowen` (Piper, Apache-2.0 family) and `fanchen-C` (per its HuggingFace release page),
pywebview (BSD-3-Clause), pythonnet (MIT), PyInstaller (GPL-2.0 **with bootloader exception** — which
explicitly permits distributing the bundled application under a license of the packager's choice),
and the Microsoft Edge WebView2 Runtime (shipped with Windows, neither bundled nor modified).

No book content and no voice data are included in this repository. The speech model is downloaded
on demand by `VoicePack/install.py` from the upstream GitHub release. The optional English model
(Piper `en_US` + espeak-ng data) is neither bundled nor auto-downloaded; drop it into
`VoicePack/models/piper-en/` yourself. Chinese narration works without it — English passages fall
back to the system English voice, or to a timed pause.
