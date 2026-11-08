# 墨吟 · MoYin Reader

**墨吟**（拼音 mó yín）｜英文名 **MoYin Reader**｜仓库 `moyin-reader` — 搜「墨吟」或「moyin reader」都能找到这里。

**[中文](#中文) | [English](#english)**

🌐 **[在线使用（免安装）](https://podcatcher962.github.io/moyin-reader/)** — 浏览器直接打开，导入的书与进度存在本机，不上传任何服务器。


一个单文件、默认离线的中文 TXT / EPUB 阅读器，带朗读、划线批注与阅读总结；版式做到成熟阅读软件的水准——滚动或整屏翻页、宽屏双栏手机单栏、六套主题、自动阅读与沉浸全屏。174 个离线中文说话人（148 女 26 男，精选 11 个直接可选），支持分角色朗读；界面中英双语一键切换。Windows 一个 exe 直接跑，安卓一个 apk，浏览器双击 HTML 也能用。

> 名字取「以墨为文、吟而出声」：把纸上的字念出来。与任何同名公司、配音平台、有声主播无关。

---

## 中文

### 它是什么

把一本书丢进去，安静地读，或者让它念给你听。没有账号、没有广告、不联网也能用，书和进度都存在本机。

### 截图

**统信 UOS 20 专业版上运行**（真机实测，独立窗口、无地址栏）：

![统信 UOS 上运行](docs/screenshots/linux-uos.png)

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

### 平台

| 平台 | 怎么用 | 说明 |
|---|---|---|
| **Windows** | 下载 `MoYinReader.exe` 双击 | 完整版，174 个离线语音与分角色朗读都在这一版 |
| **安卓** | 下载 [`MoYinReader.apk`](https://podcatcher962.github.io/moyin-reader/download/MoYinReader.apk) 安装 | 页面内嵌，朗读走系统 TTS；手机下载见下方说明 |
| **任意系统** | 双击 `MoYinReader.html` | 单文件网页版，功能与桌面版一致 |
| **Linux / 信创**（统信 UOS、麒麟、openEuler、Deepin） | `sudo dpkg -i moyin-reader_*.deb` 装进应用菜单；或用 `MoYinReader-Linux-*.tar.gz` 解压后双击「墨吟阅读器.sh」 | **x86_64 是 10 MB 独立程序，不用装 Python**（已在统信 UOS 20 专业版实测安装与启动）；飞腾 / 鲲鹏 / 龙芯会自动走 Python 或网页方式 |
| **macOS**（Intel / Apple Silicon） | 解压 `MoYinReader-macOS-*.zip`，双击「墨吟阅读器.command」 | 免安装 Python |

> **手机上装安卓版，下载卡住怎么办**
>
> GitHub 的下载按钮会先跳 `github.com`，再跳 `objects.githubusercontent.com`，这两跳在国内手机网络里经常十几秒不动或直接被掐断（电脑上能下，多是因为走了代理）。所以安卓包另外给三个**不经过 github.com** 的入口，按顺序试：
>
> 1. 主直链：`https://podcatcher962.github.io/moyin-reader/download/MoYinReader.apk`
> 2. 备用 CDN（Cloudflare 节点，国内通常更快）：`https://gcore.jsdelivr.net/gh/podcatcher962/moyin-reader@v1.10.3/docs/download/MoYinReader.apk`
>
> 两个都打不开时，可以先把 apk 存到网盘（夸克 / 蓝奏）再发给对方。下完先看一眼文件大小（约 201 KB）；如果只有几十 KB 或装了打不开，多半是没下完整，重下一次。
>
> **为什么半夜更容易失败**：GitHub Pages 的地址段（185.199.108–111.153）在国内移动网络和家宽晚高峰后常被限速或重置，凌晨并不等于网络空闲；手机还会优先解析 IPv6，部分移动网络到 GitHub 的 IPv6 路由更差。换 Wi-Fi / 流量、或换上面的备用 CDN，通常就能下。
>
> 三点注意：① 一定要在**系统浏览器**里打开，微信 / QQ 的内置浏览器会直接拦掉 apk，请在右上角「…」→「在浏览器打开」；② 小米 / 华为浏览器可能提示「该文件可能有害」，选「仍要下载」；③ 装之前系统会提示「未知来源」，允许「墨吟」安装即可。

Linux 包里那个 `MoYinReader` 是在统信 UOS 20 专业版上编译的 ELF，只依赖系统自带的 libc / libz / libpthread / libdl（glibc 2.28+），UOS 20、银河麒麟 V10、openEuler 20.03 及更新版本都能直接运行。窗口用系统浏览器内核的「应用模式」打开——没有地址栏和标签页，是个独立窗口，关掉即退出。

其余架构（aarch64 / loongarch64）仍走 Python 或网页方式；包里附 `build-linux.sh`，可在本机打自己架构的二进制。macOS 同理附 `build-macos.sh`，打 `.app`。

朗读在两个平台都走系统语音；分角色朗读需要 Windows 版打包的神经语音引擎。

### 功能

| 类别 | 说明 |
|---|---|
| 📚 格式 | TXT（自动识别 UTF-8 / GBK / Big5 / UTF-16）、EPUB（内置 ZIP/OPF/NCX/Nav 解析，正文与插图都支持） |
| 🗣️ 朗读 | 174 个离线中文说话人共用一份 29 MB 模型，按实测音高分 7 档；朗读条随时切换 |
| 🎭 分角色 | **默认开启**：旁白用所选声线，对白按人物换声，同一人物全书同一声音。认识「张三说」「他盯我一眼，说」「我说」「他突然问我」，不会把「我对某人说」的听话人当说话人；人物多时声线池自动从 11 个扩到全部 174 个 |
| ⏯️ 听书 | 段落高亮自动跟随、念完自动接下一章、定时停止、语速调节、整句朗读保语调 |
| 🖍️ 划线批注 | 选中正文四色高亮、随手写笔记；「笔记」页按章汇总，可跳转 / 改色 / 编辑 / 删除 |
| 📤 导出分享 | 笔记一键导出 Markdown；划线生成带书名与署名的分享图（PNG），也可只复制文字 |
| 📊 阅读总结 | 累计时长、进度、批注 / 书签数、逐章摘录一页看完，可复制或导出成笔记 |
| 🗂️ 书架 | 自建书架分组、★收藏、批量移动 / 移除、改书名作者、整目录导入、阅读计时 |
| 📥 拖拽导入 | 把 TXT / EPUB（或整个文件夹）直接拖进窗口，松手就导入，正在看书也不打断 |
| 🖧 网络位置 | **桌面版**可直接读局域网共享（SMB）：填 `\\192.168.1.10\Books`、映射盘 `Z:\书` 或本机任意路径，像本地文件夹一样扫描导入，凭据交给 Windows 记住 |
| 🌐 双语 | 全窗口中英切换（含设置、弹窗、提示与全部说明文档），选择记住 |
| 🔖 续听 | 「听到哪」与「读到哪」分开记，书架卡片一键「续听 · 第 N 章」接着念 |
| ✍️ 阅读 | **滚动 / 翻页**两种读法：分栏只有**自动 / 单栏 / 双栏**（够宽自动双栏、手机永远单栏，选双栏自动切翻页）。字号、行距、段间距、字间距、首行缩进、**十种字体**、两端 / 左对齐、版心宽度、页边距全部可调 |
| 🈵 繁简 | 设置里一键把繁体书显示成简体（OpenCC 对照表，2965 个常用字）；**只改显示、不动原文**，关掉即还原，划线笔记位置不受影响 |
| 🖼️ 插图 | EPUB 里的地图、人物关系表、插图页点一下全屏看，点任意处或 Esc 关闭 |
| 🎨 主题 | 六套配色（夜间 / 明亮 / 羊皮纸 / 护眼绿 / 雾蓝 / 纯黑），点「主题」弹出卡片一次挑完；另有 8 种常用字色 + 8 种底色色板与取色器，选深底会自动配浅字 |
| 🕐 时钟 | 顶栏显示当前时间与本次已读时长，30 分钟转黄、60 分钟转红；沉浸模式右上角保留淡时钟 |
| ☕ 护眼 | 连续读满 30 / 45 / 60 / 90 分钟（可关）提醒休息，可「休息一下」重新计时或「稍后再提」 |
| ▶️ 自动阅读 | 滚动模式匀速下滚（速度 1–10），翻页模式按秒自动翻页（**停留 3–180 秒可调**）；一键暂停 / 继续，章末自动接下一章 |
| 🖥️ 沉浸全屏 | 上下工具栏自动收起，鼠标移到屏幕边缘唤出；F11 / Esc 快捷键 |
| 🔍 导航 | 目录跳章、全文搜索、书签、章节内跳转；翻页模式下点两侧、滚轮、空格、← →、手机左右滑都能翻页 |
| 💾 数据 | IndexedDB 本机存储，可导出/导入备份（含书籍文件），换设备不丢 |
| 🔒 隐私 | 默认零联网；语音在本机 127.0.0.1 合成，朗读文字不出本机 |

### 下载什么

| 文件 | 体积 | 说明 |
|---|---|---|
| `MoYinReader.exe` | 约 47 MB | **Windows 完整版**，语音库打包在 exe 尾部，只拷这一个文件就能听，首次启动自动释放到缓存 |
| `MoYinReader_Lite.exe` | 约 17 MB | Windows 轻量版，需同目录放 `VoicePack` 文件夹（约 53 MB） |
| `MoYinReader.apk` | 约 201 KB | 安卓壳，页面内嵌，朗读走系统 TTS |
| `MoYinReader.html` | 约 372 KB | 单文件网页版，双击即用，任何系统都能跑 |
| `moyin-reader_*_amd64.deb` | 约 9.7 MB | 统信 / 麒麟 / openEuler，**双击安装即进应用菜单**，卸载走系统正常流程 |
| `MoYinReader-Linux-*.tar.gz` | 约 9.8 MB | 免安装版：解压双击「墨吟阅读器.sh」，U 盘带走也能用 |
| `MoYinReader-macOS-*.zip` | 约 157 KB | macOS 源码 + 打包脚本，在本机跑一次 `build-macos.sh` 出 `.app` |

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

仓库只放源码，`exe` 和语音模型不入库（体积大，且模型是第三方资产）。唯一的例外是 `docs/download/MoYinReader.apk`——201 KB 的成品，放在 Pages 上只为给手机一个不用访问 github.com 的下载口，正式版仍以 Release 为准。克隆后按下面两步即可复现：

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
_check_v19.js                     131 项回归（分栏 / 主题面板 / 时钟 / 休息提醒 / 网络位置）
_check_v18.js                      95 项版式回归（分栏 / 翻页 / 主题 / 自动阅读 / 全屏）
_check_v17.js  _check_v171.js      1.7 与 1.7.1 的回归
_check_voices.js  _check_role.js   声线 / 分角色朗读回归（22 / 48 项）
_unit_zip.js                       ZIP 解压内核单测（482 项）
```

回归脚本请配合 `_samples/` 使用：`expect.json` 已入库，书籍样本因版权不入库，自备一本 `.txt` 或 `.epub` 放进 `_samples/` 即可。

### 许可与致谢

本项目以 **MIT 许可证**发布，版权 © 2026 永远的兰兰（Lanlan Eternal）。第三方组件（sherpa-onnx、AISHELL3 模型、pywebview、pythonnet、PyInstaller）各自遵循其原始许可证，详见 [LICENSE](LICENSE) 与 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)（也写在软件内「开源与许可」）。

### 免责

仅供阅读自己合法持有的电子书使用；不提供、不获取、不破解任何受版权保护的内容，不绕过 DRM。导入文件、书签、进度只存在本机。软件按「现状」提供，不附带任何担保。

---

## English

**MoYin Reader** (Chinese: 墨吟, pinyin *mó yín* — "ink" + "to chant") is a single-file, offline-first Chinese TXT / EPUB reader with text-to-speech, highlights, notes and reading summaries — and typography that can hold its own: scroll or turn whole pages, two columns on wide screens and one on phones, six themes, auto reading and immersive full screen. 174 offline Chinese speakers (148 female, 26 male; 11 curated by default), with role-based reading that switches voices per character in dialogue. The whole interface toggles between Chinese and English. One portable exe on Windows, one apk on Android, or just double-click the HTML.

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
- **Reading** — continuous scroll, or whole-screen page turns with **one or two columns** (Auto / 1 / 2; wide screens get two, phones always one). Font size, line height, paragraph gap, letter spacing, first-line indent, **ten typefaces** (Song / YaHei / Hei / Kai / FangSong / ZhongSong / LiSu / YouYuan / DengXian / Mono, each button previewed in its own face), four font weights, justified or ragged right, measure width and side margins are all adjustable.
- **Traditional → Simplified** — a Chinese switch in Settings renders Traditional books in Simplified; body and contents both convert. It is a **same-length substitution** done at display time, so the file is untouched, switching back restores it, and highlight / note / speech positions never drift. Full-text search follows the switch too.
- **Illustrations** — tap any image in an EPUB for a full-screen view; tap anywhere or press Esc to close.
- **Touch** — swipe left/right to turn pages, pinch to change text size (saved on release).
- **Drag & drop** — drop TXT / EPUB (or a whole folder) onto the window to import; dropping while reading does not interrupt you.
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

### Platforms

| Platform | How |
|---|---|
| **Windows** | `MoYinReader.exe` — full build with the voice pack inside |
| **Android** | `MoYinReader.apk` — page embedded, speech via system TTS |
| **Any system** | Double-click `MoYinReader.html` |
| **Linux / domestic (UOS, Kylin, openEuler)** | `sudo dpkg -i moyin-reader_*.deb`, or unzip the tarball and run the launcher — a 10 MB standalone binary, **no Python needed** (verified on UOS Desktop 20 Professional, x86_64) |
| **macOS** | Unzip, then run `build-macos.sh` on your Mac to produce a `.app` |

The Linux binary only needs `libc` / `libz` / `libpthread` / `libdl` (glibc 2.28+). On aarch64 (Phytium / Kunpeng) and loongarch64 (Loongson) it falls back to the Python or web route; `build-linux.sh` builds a native binary on such a machine.

### Builds

| File | Size | Notes |
|---|---|---|
| `MoYinReader.exe` | ~47 MB | Full build, voice pack appended inside the exe |
| `MoYinReader_Lite.exe` | ~17 MB | Needs a `VoicePack` folder (~53 MB) next to it |
| `MoYinReader.html` | ~372 KB | Standalone web build |
| `MoYinReader.apk` | ~201 KB | Android shell with the page embedded |
| `moyin-reader_*_amd64.deb` | ~9.7 MB | UOS / Kylin / openEuler, installs into the app menu |
| `MoYinReader-Linux-*.tar.gz` | ~9.8 MB | Portable build, same x86_64 binary, unzip and run |
| `MoYinReader-macOS-*.zip` | ~157 KB | Source + `build-macos.sh`; run it once on your Mac to get a `.app` |

Prebuilt binaries: **[Releases](https://github.com/podcatcher962/moyin-reader/releases)** — or open the **[web version](https://podcatcher962.github.io/moyin-reader/)** and install nothing.

### Build from source

Only source lives in this repo — `exe` and the speech model are not committed (they are large, and the model is a third-party asset). The one exception is `docs/download/MoYinReader.apk`, a 201 KB build kept on Pages purely so phones get a download link that never touches `github.com` (which is slow or unreachable on many Chinese mobile networks); Releases remain the canonical source.

> **Android download stalls?** The GitHub button redirects through `github.com`, which often hangs for 10+ seconds on mobile networks in China. Use the direct link instead:
>
> `https://podcatcher962.github.io/moyin-reader/download/MoYinReader.apk`
>
> Open it in a real browser — WeChat / QQ in-app browsers block apk downloads (tap "open in browser"). Allow "unknown sources" when the system asks.

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
