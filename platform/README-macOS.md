# 墨吟阅读器 · macOS

适用：macOS 11+（Intel / Apple Silicon 都可以）。

## 最快用法（不需要打包）

```bash
bash start-macos.sh
```

或者直接双击 `MoYinReader.html`，Safari 打开就能用。

墨吟是单文件应用，所有界面都在那一个 HTML 里，书籍存在浏览器本地数据库——浏览器打开和独立窗口**功能完全一样**。

## 要独立窗口

macOS 自带 WKWebView，装个 pywebview 就有原生窗口：

```bash
python3 -m pip install --user pywebview
bash start-macos.sh
```

没装 pywebview 时脚本会自动用 Safari 打开，不会报错卡住。

## 自己打包成 .app

```bash
bash build-macos.sh
# 产物：dist/墨吟阅读器.app
```

只想要单文件（不带 .app 外壳）：

```bash
bash build-macos.sh --onefile
# 产物：dist/MoYinReader
```

第一次打开会被 Gatekeeper 拦（没有 Apple 开发者签名），两种办法：

1. 右键点图标 → **打开** → 再点一次「打开」
2. 终端里：`xattr -dr com.apple.quarantine "dist/墨吟阅读器.app"`

> 打出来的包只在本机架构上跑：Intel 出 x86_64，Apple Silicon 出 arm64。
> 要做通用包，得两种机器各打一次再合并，这里不折腾。

## 与 Windows 版的差别

| 功能 | Windows | macOS |
|---|---|---|
| 阅读、翻页、分栏、主题、字体、颜色 | ✅ | ✅ 完全一样 |
| 划线批注、笔记、导出、阅读总结 | ✅ | ✅ 完全一样 |
| 朗读 | ✅ 187 个离线神经语音 | ⚠️ 走 macOS 系统语音（中文系统语音质量不错） |
| 分角色朗读 | ✅ | ❌ 需要 Windows 版打包的语音引擎 |

## 许可与声明

包根目录有四份文件，请连着看，别拆散：

| 文件 | 说什么 |
|---|---|
| `LICENSE` | MIT 全文。覆盖**本项目自己写的代码与文档**，版权 © 2026 Lanlan Eternal |
| `THIRD-PARTY-NOTICES.md` | 逐组件许可状态。有例外：Windows 版随包的 fanchen-C 语音模型上游未声明许可 |
| `VOICE-POLICY.md` | 声音从哪来、三层权利怎么拆、移除通道在哪 |
| `PRIVACY.md` | 不采集、不上传、不录音、不克隆 |

**MIT 不覆盖任何第三方资产。** 谁要拿随包的语音模型去用（尤其商用），不能援引本项目的 MIT 声明——那份声明对模型无效，本项目也没有权利替上游授权。

本 macOS 包不含任何语音模型：朗读走系统语音，装机清单里只有 `app.py`、`MoYinReader.html` 和几个脚本。

墨吟永久免费。作者从未授权任何人以本项目名义收费、代充、捆绑销售或做「付费版」；你若花了钱，那是卖方行为，与本项目无关。

## 常见问题

**Q：双击 HTML 提示「无法打开」？**
右键 → 打开方式 → Safari / Chrome。

**Q：朗读没声音？**
系统设置 → 辅助功能 → 朗读内容 → 系统声音，先装一个中文语音（如「婷婷」）。
