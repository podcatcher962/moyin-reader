# 墨吟 1.14.20 · 桌面版跟齐手机版 + 不再把 PDF 当 TXT

## 起因
用户问：「我在测试手机版，这个修改也会在桌面版实现吧，桌面的声线库和 EPUB 问题和跳章问题
也是有可能需要改对吧」

## 查证结论（哪些是共用、哪些是各自一份）
| 层 | 位置 | 手机 / 桌面 |
|---|---|---|
| 页面逻辑（EPUB 判定、分页、文件夹导入） | `app.js` → `MoYinReader.html` | **共用一份**，改一次两边都有 |
| 安卓文件选择器 MIME 过滤 | `MainActivityHttp.java`（`setType("*/*")`） | 仅手机 |
| 安卓选目录（`moyin://pick-dir` + `DocumentsContract`） | `MainActivityHttp.java` | 仅手机 |
| 桌面选文件夹 | `app.py` `ask_folder()` 原生 IFileDialog | 仅桌面（本来就是选目录，不需要改） |
| 语音库 | `VoicePack/models/fanchen/model.onnx` | 同一份模型，手机打进 APK、桌面压进 EXE 尾部 |

问题在于**打包产物是快照**：1.14.19 只重打了 APK，`MoYinReader.exe` 还是上午 08:06 的旧包，
页面与语音库都是旧的。所以桌面不是「要不要改」，而是「要用新包重打」。

## 关键验证：fp16 模型在 Windows 引擎上能不能跑（不能只看安卓）
- 命令行引擎 `sherpa-onnx-offline-tts.exe`（1.12.15）：加载 fp16 模型正常，4.0 s 音频耗时 1.88 s（单线程）。
- Python 绑定 `sherpa_onnx`（桌面常驻路径，默认走这条）：
  加载 1.13 s，合成长句 0.88 s / 4.0 s、1.31 s / 5.8 s，采样数正常。
- 结论：**fp16 与桌面引擎完全兼容，不需要换引擎、不需要动 `install.py` 的默认路径**。

## 改动
1. `sniffExt()` 加二进制判据（1.14.19 放开文件筛选后的副作用）：
   `%PDF` → 跳过；偏移 60 处 `BOOKMOBI` / `TPZ` → 跳过；UTF-16 BOM → TXT；
   其余看前 4 KB 是否有 NUL / 成片控制字符，有则跳过。跳过提示写明书名与「不支持这种格式」。
   否则 PDF 会被当 TXT 解码，往书架塞一本满屏乱码的书。
2. `_pkg_win/app.py`：`BUNDLE_MUST` 注释同步（fanchen 已是 fp16 61 MB，不再是 int8 41 MB）。
3. 版本 1.14.19 → 1.14.20（`app.js` / `app.py` / `build_apk.py` versionCode=11420）。
4. `_test_import.js` 新增 PDF 用例（夹具 `_tmp/imp/不是书.pdf`，2.1 KB，ASCII + 全字节）。

## 验证
- `_test_import.js`：**14 通过 / 0 失败**（原 12 项 + PDF 不入库、跳过原因两项）。
- APK：101.0 MB，体检 18 项全 PASS，dex 1148 类，页面 md5 `788d0d16…`。
- EXE：完整版与精简版重打，页面 md5 与 APK 相同（同一份 HTML 快照）。

## 遗留
- 中英混排生词 415 容错仍未修。
- 1.14.14 ~ 1.14.20 未合并发 Release、未更新 versions.json。
- 若嫌 101 MB 仍大，唯一可行方向仍是「配角库移出安装包、首次选用再下载」。
