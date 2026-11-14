# 第三方组件与许可 · Third-Party Notices

墨吟阅读器本体以 **MIT 许可证**发布，版权 © 2026 Lanlan Eternal（永远的兰兰）。
完整许可文本见 [LICENSE](LICENSE)。

**MIT 的覆盖范围只到本项目的源代码与文档。** 本仓库与发行包内的第三方资产——`VoicePack/models/` 下的模型权重（`fanchen/`、`en-ljs/`）、`VoicePack/engine/` 下的引擎二进制、`_vendor/` 下的内联库——**不在 MIT 范围内**。本项目对它们只做原样再分发，**不作授权、不作再许可、不声称可商用**，因为本项目没有这个权利。需要将这些资产用于本项目之外的目的，请自行向上游取得许可。

本文件列出随软件分发或运行时依赖的第三方组件。它们各自遵循其原始许可证（**有例外，见「关于模型」：fanchen-C 上游未声明任何许可证**），本项目不修改其源码。

## 组件清单

| 组件 | 许可证 | 用途 | 来源 |
|---|---|---|---|
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0 | 本机离线语音合成引擎（CPU 推理） | k2-fsa / Next-gen Kaldi |
| 小雅 `xiao_ya` 中文 VITS（22.05 kHz） | 训练数据 BZNSYP（标贝）**仅限非商用** | 女主声线 | **1.14.40 起已从安装器与安装包中移除**，不再分发（见下「关于声音」） |
| 超文 `chaowen` 中文 VITS（22.05 kHz） | 数据集 CC0，由小雅微调而来 | 原男主声线 | **1.14.40 起已移除**，同上 |
| fanchen-C 中文多说话人 VITS | **上游未声明任何许可**（社区贡献） | 187 个配角声线共用的 16 kHz 声学模型 | 随 sherpa-onnx Release 分发。本项目不主张权利，权利人可要求移除 |
| jieba 词典（`dict/*.utf8`） | MIT | fanchen 模型的多音字分词 | jieba 项目 |
| （可选）`vits-ljs` 英文 VITS（icefall / LJSpeech） | 权重 Apache-2.0，语料为公有领域 | 中英混排里的英文单词，以及纯英文段落的本地合成 | icefall / k2-fsa。安卓完整版与桌面完整版**已内置**；Lite 版与网页版不含 |
| [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist` r3.11.174) | Apache-2.0 | 读取 PDF 的文字层（不渲染版面）；核心与 worker 以源码形式内联进单文件 HTML | Mozilla |
| [pywebview](https://github.com/r0x0r/pywebview) | BSD-3-Clause | Windows 桌面外壳的窗口与 WebView 绑定 | r0x0r |
| [pythonnet](https://github.com/pythonnet/pythonnet) | MIT | pywebview 与 .NET / WebView2 之间的桥接 | pythonnet |
| [PyInstaller](https://pyinstaller.org) | GPL-2.0 **附 bootloader 例外** | 打包为单文件 exe | PyInstaller 项目 |
| Microsoft Edge WebView2 Runtime | 微软随 Windows 分发的运行环境 | 渲染界面（不打包、不修改、不重新分发） | Microsoft |

### 关于 PDF.js

PDF 解析用 Mozilla 的 PDF.js（`pdfjs-dist` r3.11.174，Apache-2.0）。**只做文字层抽取，不做版面渲染**，
也不用它的 viewer 界面；`pdf.min.js` 与 `pdf.worker.min.js` 的源码（含原始许可头）由 `build.py`
内联进单文件 HTML，未做任何修改，因此仍按 Apache-2.0 分发。副本见 `_vendor/pdfjs/`。

### 关于 PyInstaller 的 GPL

PyInstaller 本身是 GPL-2.0，但其 **bootloader 例外条款**明确允许：使用 PyInstaller 打包的程序
可以按打包者自选的许可证分发，不因打包行为而被要求开源。因此本项目的 MIT 许可在此场景下有效。

### 关于模型

语音能力来自上述开源引擎与公开发布的模型，**项目本身不包含、不训练、不再分发任何语音数据或书籍内容**。

- 引擎与配角库由 `VoicePack/install.py` 从上游 GitHub Release 下载；安卓与桌面**完整版**把权重打进安装包，**Lite 版与网页版不含任何权重**。
- 英文模型（`en-ljs`）随完整版内置，也可由用户自行放入 `VoicePack/models/en-ljs/`；没有它也能正常朗读中文。

各模型的许可状态必须逐条看清，不能一概称为「开源」：

| 模型 | 上游声明 | 本项目处置 |
|---|---|---|
| fanchen-C（187 人） | **无许可声明**（社区贡献，见 sherpa-onnx issue #4023） | 保留在完整版；文档如实标注「未声明许可」；权利人一经通知即可从下载链与安装包中移除 |
| 小雅 `xiao_ya` | 训练数据 BZNSYP（标贝）**仅限非商用** | **1.14.40 起已从 `install.py` 的下载清单移除**，改用 187 人库中的声线顶上 |
| 超文 `chaowen` | 数据集 CC0，由小雅微调 | 随小雅一并移除 |
| `en-ljs` | 权重 Apache-2.0，语料 LJSpeech 公有领域 | 保留 |

### 关于声音

全部中文声线（主角、旁白、配角）来自**社区公开的一份多说话人模型**（fanchen-C，187 人）；这些声音是**合成音色**，本项目：

- 只把音色用于朗读文字，不做声纹识别、不做身份识别，也不声称任何声音对应某位具体的人；
- 不提供「克隆我的声音」功能，不采集、不上传用户本人的录音；
- 界面里给声音起的名字（如「成年女 1」「老生 · 低沉 1」）是按实测基频分档的产品标签，不是对真人的称呼或代言；
- 宣传中不拿真人录音与合成音做对比，不使用「某某同款」这类指向特定人的表述。

自然人声音参照肖像权受法律保护（《民法典》第一千零二十三条），判断核心是**可识别性**——合成声音能否让公众联想到特定自然人。上述音色均为匿名档位，不指向任何具体个人。若你是上游数据集中的说话人或其权利人，认为某个音色的使用不妥，请通过仓库 Issue 联系，核实后会从声线列表、下载链与安装包中移除。

生成内容的标识：本软件在本机离线合成语音，不提供生成内容的发布或传播服务。**用户把合成音频对外发布时，应按《人工智能生成合成内容标识办法》自行添加标识**；若将来提供音频导出，导出文件将默认附带显式与隐式标识。

声线的来源、三层权利分析、自我约束清单与移除流程，另见 **[VOICE-POLICY.md](VOICE-POLICY.md)**。

## 免责

本软件不附带任何书籍内容，仅供阅读自己合法持有的电子书使用；不提供、不获取、不破解任何受版权保护的
内容，不绕过 DRM。软件按「现状」提供，不附带任何明示或默示担保。

---

## English

MoYin Reader itself is released under the **MIT License**, © 2026 Lanlan Eternal.

Third-party components keep their own licenses: sherpa-onnx (Apache-2.0), PDF.js r3.11.174
(vendored as source, Apache-2.0 — its licence header is kept verbatim), pywebview (BSD-3-Clause),
pythonnet (MIT), PyInstaller (GPL-2.0 **with bootloader exception** — which explicitly permits
distributing the bundled application under a license of the packager's choice), and the
Microsoft Edge WebView2 Runtime (shipped with Windows, neither bundled nor modified).

Model weights are **not** all "open source" and are listed one by one:

| Model | Upstream statement | Status here |
|---|---|---|
| `fanchen-C` (187 speakers) | **No licence declared** — community contribution, see sherpa-onnx issue #4023 | Shipped in the full build; removal on notice |
| `xiao_ya` | Training corpus BZNSYP (DataBaker), **non-commercial only** | **Removed** from the installer and packages in 1.14.40 |
| `chaowen` | Corpus CC0, fine-tuned from `xiao_ya` | **Removed** together with `xiao_ya` |
| `vits-ljs` (English) | Weights Apache-2.0, LJSpeech public domain | Bundled in full builds; not in Lite / web |

No book content and no voice data are included in this repository. The Android and desktop **full**
builds embed the weights; the **Lite** and **web** builds contain none.

**About the voices.** Every Chinese voice — leads, narration and supporting cast — comes from one
community-released multi-speaker model (fanchen-C, 187 speakers). They are synthetic timbres used only to read
text aloud: no speaker verification, no identity inference, no claim that a voice belongs to any
particular person. The app does not clone your voice and never records or uploads audio. Voice names
shown in the UI are product labels, not endorsements by real people.

Voice is protected by law in China by reference to portrait rights (Civil Code art. 1023); the test
is **identifiability** — whether the synthetic voice leads the public to a specific natural person.
All timbres here are anonymous slots that point to no one in particular. If you are a speaker in an
upstream corpus and object to a timbre being used, open an issue and it will be removed from the
voice list, the download chain and the installers.

As this app synthesises speech locally and offers no publishing or distribution of generated content,
the Chinese AI-generated-content labelling rules do not currently apply; any future audio export
feature will carry both explicit and metadata labels as required.
