# 墨吟 · MoYin Reader

**[中文](#中文) | [English](#english)**

🌐 **[在线使用（免安装）](https://podcatcher962.github.io/moyin-reader/)** — 浏览器直接打开，导入的书与进度存在本机，不上传任何服务器。


一个单文件、默认离线的中文 TXT / EPUB 阅读器，带朗读、划线批注与阅读总结；版式做到成熟阅读软件的水准——滚动或整屏翻页、宽屏双栏手机单栏、六套主题、自动阅读与沉浸全屏。174 个离线中文说话人（148 女 26 男，精选 11 个直接可选），支持分角色朗读；界面中英双语一键切换。Windows 一个 exe 直接跑，安卓一个 apk，浏览器双击 HTML 也能用。

> 名字取「以墨为文、吟而出声」：把纸上的字念出来。与任何同名公司、配音平台、有声主播无关。

---

## 中文

### 它是什么

把一本书丢进去，安静地读，或者让它念给你听。没有账号、没有广告、不联网也能用，书和进度都存在本机。

### 截图

| 翻页 · 双栏 · 1920 宽 | 翻页 · 单栏 · 羊皮纸 |
|---|---|
| ![双栏](docs/screenshots/read-2col-wide.png) | ![单栏](docs/screenshots/read-1col-sepia.png) |

| 翻页 · 双栏 · 夜间 | 翻页 · 双栏 · 明亮 |
|---|---|
| ![翻页双栏夜间](docs/screenshots/read-paged-dark.png) | ![翻页双栏明亮](docs/screenshots/read-paged-light.png) |

| 主题一处挑完（点卡片即生效） | 护眼绿 |
|---|---|
| ![主题面板](docs/screenshots/theme-panel.png) | ![护眼绿](docs/screenshots/theme-panel-green.png) |

| 阅读时钟与休息提醒 | 沉浸模式 · 右上角淡时钟 |
|---|---|
| ![时钟面板](docs/screenshots/clock-panel.png) | ![沉浸](docs/screenshots/immersive-clock.png) |

| 排版与外观（一处调完） | 休息提醒 |
|---|---|
| ![排版面板](docs/screenshots/type-panel.png) | ![休息提醒](docs/screenshots/rest-tip.png) |

| 手机 · 顶栏两行 | 手机 · 选双栏也单列 |
|---|---|
| ![手机顶栏](docs/screenshots/phone-toolbar.png) | ![手机双栏](docs/screenshots/phone-2col.png) |

| 分角色朗读 | 书架 · 一键续听 |
|---|---|
| ![分角色朗读](docs/screenshots/role-bar.png) | ![续听](docs/screenshots/shelf-resume.png) |

| 划线批注 | 阅读总结 |
|---|---|
| ![笔记](docs/screenshots/notes-panel.png) | ![总结](docs/screenshots/reading-summary.png) |

| 网络位置 · 读局域网共享 | 174 个离线声线 |
|---|---|
| ![网络位置](docs/screenshots/net-import.png) | ![声线](docs/screenshots/settings-voices.png) |

| 英文界面 | 分角色朗读 |
|---|---|
| ![英文界面](docs/screenshots/shelf-en.png) | ![分角色](docs/screenshots/role-bar.png) |

### 功能

| 类别 | 说明 |
|---|---|
| 📚 格式 | TXT（自动识别 UTF-8 / GBK / Big5 / UTF-16）、EPUB（内置 ZIP/OPF/NCX/Nav 解析，正文与插图都支持） |
| 🗣️ 朗读 | 174 个离线中文说话人共用一份 29 MB 模型，按实测音高分 7 档；朗读条随时切换 |
| 🎭 分角色 | 旁白用所选声线，引号里的对白按人物自动换声（同一人物全书同一声音） |
| ⏯️ 听书 | 段落高亮自动跟随、念完自动接下一章、定时停止、语速调节、整句朗读保语调 |
| 🖍️ 划线批注 | 选中正文四色高亮、随手写笔记；「笔记」页按章汇总，可跳转 / 改色 / 编辑 / 删除 |
| 📤 导出分享 | 笔记一键导出 Markdown；划线生成带书名与署名的分享图（PNG），也可只复制文字 |
| 📊 阅读总结 | 累计时长、进度、批注 / 书签数、逐章摘录一页看完，可复制或导出成笔记 |
| 🗂️ 书架 | 自建书架分组、★收藏、批量移动 / 移除、改书名作者、整目录导入、阅读计时 |
| 🖧 网络位置 | **桌面版**可直接读局域网共享（SMB）：填 `\\192.168.1.10\Books`、映射盘 `Z:\书` 或本机任意路径，像本地文件夹一样扫描导入，凭据交给 Windows 记住 |
| 🌐 双语 | 全窗口中英切换（含设置、弹窗、提示与全部说明文档），选择记住 |
| 🔖 续听 | 「听到哪」与「读到哪」分开记，书架卡片一键「续听 · 第 N 章」接着念 |
| ✍️ 阅读 | **滚动 / 翻页**两种读法：分栏只有**自动 / 单栏 / 双栏**（够宽自动双栏、手机永远单栏，选双栏自动切翻页）。字号、行距、段间距、字间距、首行缩进、五种字体、两端 / 左对齐、版心宽度、页边距全部可调 |
| 🎨 主题 | 六套配色（夜间 / 明亮 / 羊皮纸 / 护眼绿 / 雾蓝 / 纯黑），点「主题」弹出卡片一次挑完，可自定义底色字色与亮度 |
| 🕐 时钟 | 顶栏显示当前时间与本次已读时长，30 分钟转黄、60 分钟转红；沉浸模式右上角保留淡时钟 |
| ☕ 护眼 | 连续读满 30 / 45 / 60 / 90 分钟（可关）提醒休息，可「休息一下」重新计时或「稍后再提」 |
| ▶️ 自动阅读 | 滚动模式匀速下滚，翻页模式按秒自动翻页；一键暂停 / 继续，章末自动接下一章 |
| 🖥️ 沉浸全屏 | 上下工具栏自动收起，鼠标移到屏幕边缘唤出；F11 / Esc 快捷键 |
| 🔍 导航 | 目录跳章、全文搜索、书签、章节内跳转；翻页模式下点两侧、滚轮、空格、← →、手机左右滑都能翻页 |
| 💾 数据 | IndexedDB 本机存储，可导出/导入备份（含书籍文件），换设备不丢 |
| 🔒 隐私 | 默认零联网；语音在本机 127.0.0.1 合成，朗读文字不出本机 |

### 三个版本

| 版本 | 体积 | 说明 |
|---|---|---|
| `MoYinReader.exe` | 约 47 MB | **完整版**，语音库打包在 exe 尾部，只拷这一个文件就能听，首次启动自动释放到缓存 |
| `MoYinReader_Lite.exe` | 约 17 MB | 轻量版，需同目录放 `VoicePack` 文件夹（约 53 MB） |
| `MoYinReader.html` | 约 324 KB | 单文件网页版，双击即用；朗读走系统语音，点击可连接本机语音引擎 |
| `MoYinReader.apk` | 约 169 KB | 安卓壳，页面内嵌，朗读走系统 TTS |

不想自己构建的话，直接到 **[Releases](https://github.com/podcatcher962/moyin-reader/releases)** 下载编译好的版本；或者用 **[在线版](https://podcatcher962.github.io/moyin-reader/)** 什么都不装。

### 使用

1. 双击 `MoYinReader.exe`（或 `MoYinReader.html`）。
2. 「＋ 导入书籍」选一本 `.txt` / `.epub`。
3. 点书打开，点右上「朗读」开始听；朗读条最左边可换声线。
4. 回到书架能看见「▶ 续听 · 第 N 章」，接着上次听的地方继续。
5. 选中正文任意一句即可高亮、写批注、复制或生成分享图；右侧「笔记」页汇总全部批注，可导出 Markdown 或打开阅读总结。
6. 想换版式点顶栏「排版」：切滚动 / 翻页、选单栏或双栏（选双栏会自动切到翻页，TXT 和 EPUB 一样）、调字号行距段距、换六套主题；点「自动」进自动阅读，点「全屏」进沉浸阅读。
7. 书架顶栏右侧的 `EN` / `中` 一键切换界面语言。

### 语音是怎么来的

朗读用的是开源引擎 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 加一份 AISHELL3 中文多说话人 VITS 模型，全部在本机 CPU 上跑：不联网、不收费、不需要账号和 Key。174 个说话人共用同一份模型，只是切换说话人编号，所以**放开到 174 个也完全不增加体积**。

![174 个离线声线](docs/screenshots/settings-voices.png)

### 从源码构建

仓库只放源码，`exe` / `apk` / 语音模型都不入库（体积大，且模型是第三方资产）。克隆后按下面两步即可复现：

```bash
# 1) 生成单文件网页版（纯 Python 标准库，无需依赖）
python build.py                       # → MoYinReader.html

# 2) 拉语音引擎与模型（约 55 MB，走 GitHub Release，带 gh-proxy 备用线路）
python VoicePack/install.py           # → VoicePack/engine + VoicePack/models

# 可选：打包 Windows exe（需要 pip install pyinstaller pywebview pythonnet）
python _pkg_win/build_exe.py          # → MoYinReader.exe / MoYinReader_Lite.exe

# 可选：打包安卓 apk（需要 JDK 17 + Android SDK build-tools 34）
set MOYIN_ANDROID_BUILD=<你的构建目录>
set MOYIN_KS_PASS=<签名密钥库口令>
python _pkg_apk/build_apk.py          # → MoYinReader.apk
```

目录结构：

```
app.js  shell.html  zipcore.js     前端（无框架，build.py 内联成一个 HTML）
build.py                           单文件 HTML 打包器（同时输出 docs/index.html 供 Pages）
docs/index.html                    GitHub Pages 在线版入口
VoicePack/tts_server.py            本机语音服务（127.0.0.1:8177，174 声线）
VoicePack/install.py               引擎与模型下载器
VoicePack/voice_table.json         174 个说话人的实测音高表
_pkg_win/app.py                    Windows 外壳（pywebview + 内嵌 HTTP）
_pkg_win/build_exe.py              exe 打包 + 验收
_pkg_apk/TtsBridge.java            安卓 TTS 桥（系统语音）
_pkg_apk/build_apk.py              apk 打包 + 体检
_cdp_verify.js                     117 项界面回归（headless Edge，CDP）
_check_v19.js                      87 项回归（分栏 / 主题面板 / 时钟 / 休息提醒 / 网络位置）
_check_v18.js                      95 项版式回归（分栏 / 翻页 / 主题 / 自动阅读 / 全屏）
_check_v17.js  _check_v171.js      1.7 与 1.7.1 的回归
_check_voices.js  _check_role.js   声线 / 分角色朗读回归
_unit_zip.js                       ZIP 解压内核单测（482 项）
```

回归脚本请配合 `_samples/` 使用：`expect.json` 已入库，书籍样本因版权不入库，自备一本 `.txt` 或 `.epub` 放进 `_samples/` 即可。

### 许可与致谢

本项目以 **MIT 许可证**发布，版权 © 2026 永远的兰兰（Lanlan Eternal）。第三方组件（sherpa-onnx、AISHELL3 模型、pywebview、pythonnet、PyInstaller）各自遵循其原始许可证，详见 [LICENSE](LICENSE) 与 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)（也写在软件内「开源与许可」）。

### 免责

仅供阅读自己合法持有的电子书使用；不提供、不获取、不破解任何受版权保护的内容，不绕过 DRM。导入文件、书签、进度只存在本机。软件按「现状」提供，不附带任何担保。

---

## English

A single-file, offline-first Chinese TXT / EPUB reader with text-to-speech, highlights, notes and reading summaries — and typography that can hold its own: scroll or turn whole pages, two columns on wide screens and one on phones, six themes, auto reading and immersive full screen. 174 offline Chinese speakers (148 female, 26 male; 11 curated by default), with role-based reading that switches voices per character in dialogue. The whole interface toggles between Chinese and English. One portable exe on Windows, one apk on Android, or just double-click the HTML.

Try it in the browser: **<https://podcatcher962.github.io/moyin-reader/>**

### Screenshots

| Paged · two columns · dark | Paged · two columns · light |
|---|---|
| ![paged dark](docs/screenshots/read-paged-dark.png) | ![paged light](docs/screenshots/read-paged-light.png) |

| Sepia · first-line indent | Green |
|---|---|
| ![sepia](docs/screenshots/read-sepia.png) | ![green](docs/screenshots/theme-green.png) |

| Type &amp; appearance, all in one panel | Six themes and custom colours |
|---|---|
| ![type panel](docs/screenshots/type-panel.png) | ![colours](docs/screenshots/type-colors.png) |

| Immersive full screen | Phone · single-column pages |
|---|---|
| ![immersive](docs/screenshots/immersive.png) | ![phone](docs/screenshots/phone-paged.png) |

| Role-based reading | Shelf with one-click resume |
|---|---|
| ![roles](docs/screenshots/role-bar.png) | ![resume](docs/screenshots/shelf-resume.png) |

| Highlights & notes | Reading summary |
|---|---|
| ![notes](docs/screenshots/notes-panel.png) | ![summary](docs/screenshots/reading-summary.png) |

| English interface | 174 offline voices |
|---|---|
| ![english](docs/screenshots/shelf-en.png) | ![voices](docs/screenshots/settings-voices.png) |

### Features

- **Formats** — TXT (auto-detects UTF-8 / GBK / Big5 / UTF-16) and EPUB, with a built-in ZIP / OPF / NCX / Nav parser and image support.
- **Speech** — 174 offline Chinese speakers sharing a single 29 MB model, grouped by measured pitch; switch voices right from the playback bar, even mid-sentence.
- **Role reading** — narration keeps your chosen voice while quoted dialogue switches per character, consistently for the whole book.
- **Listening** — paragraph highlight with auto-scroll, auto-advance to the next chapter, sleep timer, speed control.
- **Resume** — listening position is tracked separately from reading position; one click on a shelf card resumes "chapter N".
- **Reading** — continuous scroll, or whole-screen page turns with **one or two columns** (Auto / 1 / 2; wide screens get two, phones always one). Font size, line height, paragraph gap, letter spacing, first-line indent, five families, justified or ragged right, measure width and side margins are all adjustable.
- **Appearance** — dark / light / sepia / green / slate / pure black, picked from a card panel in one go, plus your own paper and text colour and a brightness dimmer for reading in the dark.
- **Network share (desktop)** — read straight from a LAN share (SMB): type `\\192.168.1.10\Books`, a mapped drive such as `Z:\books`, or any local path, and its TXT / EPUB are imported as if they were on this machine. Credentials are handled by Windows, so anything File Explorer can open, the reader can scan.
- **Reading clock & breaks** — the toolbar shows the time and how long you have read this session (amber at 30 minutes, red at 60); a reminder offers a break or a ten-minute snooze after your chosen stretch.
- **Auto read** — continuous scrolling, or timed page turns; pause and resume from a pill, and the next chapter starts by itself.
- **Immersive full screen** — both bars slide away and come back when the pointer reaches an edge; F11 and Esc work too.
- **Highlights & notes** — select text for four highlight colours, a note, copy or a share card; the Notes panel lists every annotation by chapter with jump / recolour / edit / delete.
- **Export & summary** — export notes as Markdown; a reading summary shows time read, progress, annotation counts and chapter-by-chapter excerpts.
- **Shelves** — custom shelves, favorites, batch move / remove, edit title and author, whole-folder import, reading time per book.
- **Bilingual** — the entire window, including settings, dialogs and all documentation, switches between Chinese and English.
- **Navigation** — table of contents, full-text search, bookmarks, arrow keys.
- **Data** — everything in local IndexedDB, with export / import backup.
- **Privacy** — zero network by default; speech is synthesized on `127.0.0.1`, text never leaves the machine.

### Builds

| File | Size | Notes |
|---|---|---|
| `MoYinReader.exe` | ~47 MB | Full build, voice pack appended inside the exe |
| `MoYinReader_Lite.exe` | ~17 MB | Needs a `VoicePack` folder (~53 MB) next to it |
| `MoYinReader.html` | ~324 KB | Standalone web build |
| `MoYinReader.apk` | ~169 KB | Android shell with the page embedded |

Prebuilt binaries: **[Releases](https://github.com/podcatcher962/moyin-reader/releases)** — or open the **[web version](https://podcatcher962.github.io/moyin-reader/)** and install nothing.

### Build from source

Only source lives in this repo — `exe` / `apk` and the speech model are not committed (they are large, and the model is a third-party asset).

```bash
python build.py                 # bundle the web app  → MoYinReader.html
python VoicePack/install.py     # fetch engine + model (~55 MB, GitHub Releases)
python _pkg_win/build_exe.py    # optional Windows exe (needs pyinstaller, pywebview, pythonnet)
python _pkg_apk/build_apk.py    # optional Android apk (needs JDK 17 + build-tools 34;
                                #   set MOYIN_ANDROID_BUILD and MOYIN_KS_PASS first)
```

### License

MIT © 2026 Lanlan Eternal. Third-party components keep their own licenses — see [LICENSE](LICENSE) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

### Disclaimer

For reading e-books you legally own. No copyrighted content is provided, downloaded or decrypted, and no DRM is bypassed. Provided "as is", without warranty of any kind.
