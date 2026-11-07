# 墨吟阅读器 · macOS

适用：macOS 11+（Intel / Apple Silicon 都可以）。

## 最快用法（不需要打包）

```bash
bash platform/start-macos.sh
```

或者直接双击 `MoYinReader.html`，Safari 打开就能用。

墨吟是单文件应用，所有界面都在那一个 HTML 里，书籍存在浏览器本地数据库——浏览器打开和独立窗口**功能完全一样**。

## 要独立窗口

macOS 自带 WKWebView，装个 pywebview 就有原生窗口：

```bash
python3 -m pip install --user pywebview
bash platform/start-macos.sh
```

没装 pywebview 时脚本会自动用 Safari 打开，不会报错卡住。

## 自己打包成 .app

```bash
bash platform/build-macos.sh
# 产物：dist/墨吟阅读器.app
```

只想要单文件（不带 .app 外壳）：

```bash
bash platform/build-macos.sh --onefile
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
| 朗读 | ✅ 174 个离线神经语音 | ⚠️ 走 macOS 系统语音（中文系统语音质量不错） |
| 分角色朗读 | ✅ | ❌ 需要 Windows 版打包的语音引擎 |

## 常见问题

**Q：双击 HTML 提示「无法打开」？**
右键 → 打开方式 → Safari / Chrome。

**Q：朗读没声音？**
系统设置 → 辅助功能 → 朗读内容 → 系统声音，先装一个中文语音（如「婷婷」）。
