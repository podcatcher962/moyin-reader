# 声线政策 · Voice Policy

墨吟阅读器随附的全部中文声线说明：它们是什么、从哪来、许可状态如何、我们不做什么、以及你觉得不妥时怎么让我们改。

适用版本：1.14.41 及之后　最后更新：2026-11-14

---

## 一句话

**这些声音是合成音色，不是真人录音；不对应任何可识别的人；软件不采集、不上传、不克隆任何人的声音。**

下面把每一句的依据摊开写，方便你自己核对。

---

## 许可范围（先看这个）

**MIT 许可只覆盖墨吟自己的代码与文档，不覆盖声音模型。**

本项目以 MIT 发布、永久免费、不设付费版本。但 `LICENSE` 里的 MIT 授权，范围只到本项目创作的部分（`app.js`、`build.py`、`platform/`、`VoicePack/*.py`、文档）。`VoicePack/models/` 下的模型权重属于上游，**本项目对它们只做原样再分发，不作授权、不作再许可、不声称可商用**——因为没有这个权利。

这条区分写在这里，是因为它比「模型没许可」本身更容易被误读：看到一个 MIT 仓库里躺着 `model.onnx`，很容易以为那份权重也是 MIT 的、也可以商用。**不是。** 本项目不替上游做这个决定，也不替下游承担这个后果。

（技术上还有一层保障：`VoicePack/models/` 与 `VoicePack/engine/` 都被 `.gitignore` 排除，git 仓库里根本不含权重，只有发行包与安装器会取到它们。）

---

## 一、我们在用什么

| 项 | 内容 |
|---|---|
| 引擎 | sherpa-onnx 2.0.1（Apache-2.0），本机 CPU 推理，不联网 |
| 中文模型 | **fanchen-C**，单模型多说话人 VITS，16 kHz，**187 个说话人**（男 39 / 女 148） |
| 上游完整标识 | HuggingFace `csukuangfj/vits-zh-hf-fanchen-C`　·　Release 资产 `vits-zh-hf-fanchen-C.tar.bz2`　·　包内 ONNX `vits-zh-hf-fanchen-C.onnx`（本仓库重命名为 `model.onnx`） |
| 模型体积 | 61.4 MB（fp16）；量化到 int8 只有 41 MB，但字错率从 11% 涨到 25%，所以不用 |
| 换人方式 | `generate(text, sid=N)`，换一个整数编号，**不重载模型、不增体积** |
| 英文模型（可选） | vits-ljs（LJSpeech，Apache-2.0），不随包分发，用户自行放入 |
| 已移除 | `xiao_ya`、`chaowen` 两份 22.05 kHz 模型，1.14.40 起彻底不再下载、不再打包（训练数据授权为「仅限非商用」） |

关于 187 这个数字：它不是一个宣传口径，是模型权重里实际存在的说话人向量条数。软件里的七档分类（男声低沉 / 中年 / 偏高，女声低音 / 成年 / 青年 / 高音）是按每个说话人实测的中位基频分出来的，实测范围 118–316 Hz、中位 249 Hz。

**这个模型的许可状态，做了四重核查，四个结果指向同一个结论：没有许可证。**

1. HuggingFace 仓库的 `README.md` 直接返回 **404** —— 连说明文件都没有；
2. 仓库元数据的 tags 只有 `["onnx", "region:us"]`，**没有 `license` 字段**；
3. 分发的 `.tar.bz2` 包里只有模型、词表、词典、规则四类文件，**没有 LICENSE**；
4. ONNX 文件内部的元数据（`model_type` / `comment` / `language` / `n_speakers` / `sample_rate` …）里，`license`、`author`、`copyright` 的**出现次数全部为 0**。

同一 release 下的其它模型（例如 pocket-tts）是带 README 指向 LICENSE 的，说明分发方在能标注时是会标的。这个模型没有，是因为没有可标的东西。

（ModelScope 上有第三方转载标注了 Apache-2.0，那是转载者自行标注，不具有授权效力，本项目不以它为依据。）

**为什么不用音质更好的 theresa / eula（804 人、22.05 kHz）？** 因为它们来自《原神》《崩坏3》的角色语音——同一批 `vits-zh-hf-*` 模型里还有刻晴、布洛妮娅、德丽莎、禅雅塔、回声。用游戏角色的声线朗读小说，是 IP 侵权叠加声优人格权的双重风险，比 fanchen-C 严重得多。这也解释了为什么 fanchen-C 虽然许可不明，却是这批模型里唯一适合朗读的选项。

**这 187 个人是谁？查不出来，也不该查。** 训练配置 `G_C.json` 里的说话人表是 `["0", "1", …, "186"]`——纯数字编号，没有任何姓名。性别分布 148 女 / 39 男，不像游戏角色集，更像有声书或配音社群的构成，但没有证据可以确认。来源不可考这一点，在第二层（权重许可）上是缺陷，在第三层（声音人格权）上反而是有利的：无姓名、无指向、不可识别。

---

## 二、三个层级要分开看

讨论「声音有没有风险」时，最容易把三件事混成一件。它们各自独立，任一层出问题都不因另一层干净而消失。

**第一层：训练数据集的许可。**
模型是用什么录音训出来的、那批录音允许做什么。这一层最容易出事——数据集写「仅限非商用」，那么用它训出来的模型拿去商用就站不住。这也是我们把 `xiao_ya`（训练语料 BZNSYP，明写 non-commercial only）从下载链和安装包里撤掉的原因。

**第二层：模型权重的许可。**
贡献者把模型公开出来时声明了什么。fanchen-C 的情况是：**上游未单独声明许可证**。sherpa-onnx 维护者在 issue #4023 中说明，该模型由社区成员贡献、原作者未指定任何许可。未声明不等于授权，这一点我们照实写进 `THIRD-PARTY-NOTICES.md`，没有把它称作「开源」了事。

**第三层：自然人对自己声音的权利。**
《中华人民共和国民法典》第一千零二十三条第二款规定，对自然人声音的保护参照适用肖像权保护的有关规定。这一层与模型许可无关——哪怕模型完全合规，如果某个音色能被明确指向某一个具体的人并被商业化使用，仍可能触及这一层。

**这三层里，我们卡在第二层（fanchen-C 上游未声明），第三层靠产品约束规避（不指向任何具体的人）。** 第一层已通过移除小雅 / 超文解决。

---

## 三、我们做了什么（七条，都可核查）

1. **只分发、不改动。** 模型文件按上游原样随包，本项目不改权重、不做微调、不重新训练。
2. **不声称是开源。** 文档里写的是「社区公开模型，上游未单独声明许可证」，不是「开源模型」。
3. **不指向具体的人。** 界面里只出现编号与音高描述（「成年女 1」「老生 · 低沉 1」），没有姓名、职业、地域、年龄，也不做「这位像谁」的联想。
4. **不做声纹识别。** 软件没有 speaker verification、没有身份推断，也不存在「这是谁」的功能——一组说话人向量认不出任何人，也验证不了身份。
5. **不碰用户的麦克风。** 安卓包只申请 `INTERNET` 与 `ACCESS_NETWORK_STATE` 两个权限；不读存储、位置、通讯录、相机、麦克风，不读 IMEI / Android ID / MAC。
6. **不做克隆。** 没有「录音生成我的声线」这类功能，不采集、不上传任何用户音频，本机也不留存音频文件。
7. **留移除通道。** 见下一节。

---

## 四、如果你是其中的说话人，或权利人

**怎么提**：开一个 Issue 说明——哪一条声线（编号或界面名称）、你认为不妥的理由：

<https://github.com/podcatcher962/moyin-reader/issues>

**不需要先找律师，也不需要证明到什么程度。** 能说清是哪一条、为什么，就会先处理。

**我们会做什么**：
1. 核实（确认该 `sid` 是否确由你的录音训练而来）；
2. 核实成立后，在下个版本把该条从声线列表里移除，并说明是哪一版改的；
3. 若涉及范围较广，整个 fanchen-C 模型下线，改为不含该模型的构建，或者退回系统语音；
4. 已经在用户机器上的旧版本无法远程撤回（软件不联网、没有遥测），但我们会在发行说明里明确写出「从 X 版起不再包含」。

**不要求你举证到什么程度**：能说明是哪一条、为什么，我们就会先按「疑则移除」处理，再核实。187 条里少一条不影响软件可用。

---

## 五、我们不做的事

- 不做「克隆我的声音」（理由见下）。
- 不做「模仿某位名人 / 主播 / 角色」的音色包，也不引导用户这么用。
- 不提供「把某人的录音变成他的声音」的转换功能。
- 不把合成音频上传到任何服务器——合成只在本机完成，输出只写本地播放缓冲。

**为什么不做克隆**：真正的克隆要同时满足六条才站得住——本人声纹校验、单独同意、只在本机、默认加 AI 标识、不给导出分享、能一键彻底删除。六条少一条都有坑，工程量比「调音」大一个数量级。而用户实际想要的多半是「像我在读」（语速、音高、停顿、句气），不是「听起来是我」。所以我们做调音参数，不动音色，不产生新的「声音人格」。

---

## 六、你把合成音频发出去的时候

本软件的合成只在本机播放，不对外提供服务。但如果你把生成的音频剪进视频、播客或其它内容里发布：

- 按《人工智能生成合成内容标识办法》（2025 年 9 月 1 日施行）的要求，**在音频或伴随的元数据、片头片尾中添加显式标识**，说明这是 AI 合成语音；
- 不要用它冒充他人声音，不要用它制造或传播误导性内容；
- 用于商业用途前，请自行确认你所在地区的相关规定。

---

## 七、许可状态的不确定性，我们怎么处理

fanchen-C 上游未声明许可证，这是本软件声线部分**唯一**的未决事项。我们的处置是：

| 风险 | 处置 |
|---|---|
| 上游日后声明限制性许可 | 按声明执行：能保留就保留、需替换就换模型，并在发行说明里写清 |
| 权利人提出异议 | 按第四节流程移除，不拖延、不要求对方先打官司 |
| 你所在机构要求「只用许可明确的资产」 | 可删掉 `VoicePack/models/fanchen/` 整个目录，软件自动退回系统语音，阅读功能不受影响；APK / EXE 请使用 Lite 版或不含模型的构建 |
| 商业化 / 上架审核被追问 | 本文档即为答复：模型来源、许可状态、产品约束、移除机制四条齐全，不隐瞒「未声明」这一点 |

我们选择如实披露而不是含糊过去，理由很实际：**含糊的许可状态，在被追问时是负债；写清楚的许可状态，是尽调材料。**

---

## 八、附：核查清单

想自己验证上面这些说法：

```bash
# 1) 安装包里到底有哪些模型（应只有 fanchen 与 en）
python -c "import zipfile;print([n for n in zipfile.ZipFile('MoYinReader.apk').namelist() if 'tts/' in n])"

# 2) 运行中一共几条声线、默认哪条
curl -s http://127.0.0.1:8177/health | python -m json.tool | head -40

# 3) 代码里有没有录音 / 上传音频的调用（应为空）
grep -n "getUserMedia\|MediaRecorder\|audio/webm" app.js
```

第 3 条如果在你手上跑出了东西，那是我漏了，请直接告诉我。（Windows 上没有 `grep` 的话，
用编辑器打开 `app.js` 搜 `getUserMedia`、`MediaRecorder`、`audio/webm` 三个词，结果应当同样为空。）

---

## English summary

All Chinese voices in MoYin Reader come from one community-released multi-speaker VITS model
(`fanchen-C`, 16 kHz, 187 speakers). They are **synthetic timbres, not recordings of real people**,
and they do not correspond to any identifiable individual. The app performs **no speaker
verification and no voice cloning**, requests no microphone permission, and never records or
uploads audio. The model is redistributed unmodified; its upstream authors stated no separate
licence, which we disclose rather than describe as "open source". Speakers or rights holders who
object to a timbre being included can contact us via the issue tracker in the README — the voice
will be removed, and if necessary the whole model taken down. Two 22.05 kHz models
(`xiao_ya`, `chaowen`, trained on a non-commercial corpus) were removed from the installer and
packages as of 1.14.40. If you publish audio synthesised with this app, label it as AI-generated
content in accordance with applicable law.
