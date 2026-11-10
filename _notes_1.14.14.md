# 1.14.14 · 配角声线不再「每段等半分钟」

## 用户反馈

> 用配角声线，第一次提示等待 30 秒，然后能读出来，但是换段落又等，而且又弹框：等待 30 秒，每次换段落都这样。

（1.14.13 修好了「点了没声音」，但用起来每段都在等，还每段弹一次提示。）

## 根因：不是缓存，是模型的 int8 量化方式

一开始怀疑是 `TtsEngine` 每次重建会话（`lib` 字段没缓存住）。读代码排除了：
`ensureLib()` 命中 `lib != null` 就直接返回，`assets` 解压也有 stamp（`.v3_lib`），
每次换段都不会重解压。

真的原因在模型本身。桌面端用同一份模型实测（`_bench_fc3.py`）：

| 模型 | 加载 | 15 字一句 | RTF | 体积 |
|---|---|---|---|---|
| 现网 int8（动态量化） | 1.13 s | **12.92 s** | 5.41 | 39.8 MB |
| 官方 fp32 | 0.77 s | 0.66 s | 0.26 | 121.3 MB |
| 静态量化 QDQ int8（新） | 2.16 s | **0.24 s** | 0.09 | 33.3 MB |

动态量化版比 fp32 **慢 20 倍**。原因在算子：`quantize_dynamic` 把 189 个卷积一起
量化成 `ConvInteger`，而 onnxruntime 的 CPU provider 对这种算子只有参考实现，
走不到 MLAS 优化内核。查模型确认过：现网版 `ConvInteger 189 / QLinearConv 0`。

手机上一句要半分钟，就是这 20 倍再叠上 ARM 上参考实现更慢。

## 改法

1. **模型换成静态量化（QDQ）int8**：`quantize_static` + `QuantFormat.QDQ` +
   `QUInt8` 激活 / `QInt8` 权重 + per-channel，卷积生成 `QLinearConv`（优化内核）。
   标定数据用 `tokens.txt` 的音素 id 随机拼 12 条 8~36 音素序列——解码器帧数由
   文本长度决定，激活范围能落在真实区间。
   - 脚本：`_quant_qdq.py`（离线一次性，产物 `_tools/dl/fc_qdq_int8.onnx`）
   - 产物已替换 `VoicePack/models/fanchen/model.onnx`（33.3 MB）
   - `MODEL_VER` 3 → 4，老用户升级会重新解压，不会拿旧文件跑
2. **`VoicePack/install.py` 的 `quantize()` 改成静态量化**，并在 docstring 里写明
   「千万别用 quantize_dynamic」的原因；没装 onnxruntime 就保留 fp32（也快）。
3. **提示只弹一次**：`/health` 增加 `"lib"` 字段（配角库会话是否建好），页面记
   `LOCAL.lib`；只有 `libVoice && !LOCAL.lib` 才在 5 秒后提示「正在准备 187 人
   语音库」。出一句音后置 `LOCAL.lib = true`，之后再慢也不弹。

## 验证

- 桌面 `/tts` 实测（20 字一句）：x0 0.52 s，s13 3.17 s（含进程/会话开销），
  s52 3.11 s；音频峰值/rms 正常。改之前同句约 17 s。
- 音质：fp32 / QDQ 同句对比——rms 0.0522 vs 0.0512、频谱质心 1937 vs 1969 Hz，
  时长 2.50 vs 2.66 s，属量化正常波动。
- APK：68.3 MB（比 1.14.13 的 73.4 MB 小 5 MB），体积体检全 PASS；
  `_test_tap.js` 24/24。

## 遗留

- 桌面完整版 EXE 仍内嵌旧模型（动态量化）。桌面默认走 8 个音高变体不受影响，
  但选「音色 N」那档会慢；要根治需重打 EXE。
- `VoicePack/models/` 下旧模型备份在 `_tools/dl/fc_dyn_int8_backup.onnx`。
