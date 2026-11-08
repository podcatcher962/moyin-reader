# 墨吟阅读器 · Linux / 信创系统

适用于：**统信 UOS / 银河麒麟 / 中标麒麟 / openEuler / 深度 Deepin / Ubuntu / Debian / 各种国产化发行版**，
以及 **x86_64、aarch64（飞腾、鲲鹏）、loongarch64（龙芯）、mips64el** 等架构。

## 最快用法（不需要装任何东西）

```bash
bash platform/start-linux.sh
```

或者干脆：**双击 `MoYinReader.html`**，用系统自带浏览器打开。

墨吟是单文件应用——所有界面、样式、脚本都在这一个 HTML 里，书籍数据存在浏览器本地数据库（IndexedDB）里。
所以「用浏览器打开」和「用独立窗口」功能完全一样，只是少了独立窗口和托盘。

## 想要独立窗口（推荐）

需要一个能创建桌面窗口的壳。按发行版装一次即可：

| 发行版 | 命令 |
|---|---|
| 统信 UOS / Deepin | `sudo apt install python3 python3-pip python3-gi gir1.2-webkit2-4.0` 然后 `pip3 install --user pywebview` |
| 银河麒麟 V10 / 中标麒麟 | `sudo apt install python3 python3-pip python3-gi gir1.2-webkit2-4.1` 然后 `pip3 install --user pywebview` |
| openEuler / 欧拉 | `sudo dnf install python3 python3-pip python3-gobject webkit2gtk4.1` 然后 `pip3 install --user pywebview` |
| Debian / Ubuntu | `sudo apt install python3 python3-pip python3-gi gir1.2-webkit2-4.0` 然后 `pip3 install --user pywebview` |

装完再跑 `bash platform/start-linux.sh`，就是原生窗口。

> **信创内网 / 离线机器**：把 pywebview 的 wheel 拷进去离线装
> ```bash
> pip3 install --no-index --find-links=./wheels pywebview
> ```
> 或者干脆不装——`start-linux.sh` 会自动退回浏览器，功能一样。

## 起不来怎么办

脚本和 `app.py` 都有兜底：**窗口起不来就自动用浏览器打开**，不会黑屏或闪退。
如果连浏览器都没弹出来，手动打开 `MoYinReader.html` 即可。

## 自己打包成可执行文件

```bash
bash platform/build-linux.sh
# 产物：dist/MoYinReader-linux-<架构>
```

**必须在目标机器（或同架构、同发行版的构建机）上打**——PyInstaller 打不出跨架构、跨 glibc 的包。
龙芯（loongarch64）请直接在龙芯机器上跑这个脚本。

打包后自检：

```bash
./dist/MoYinReader-linux-x86_64 --selftest
```

## 桌面快捷方式

`platform/moyin.desktop` 是桌面入口文件，按下面的方式装：

```bash
mkdir -p ~/.local/share/applications
cp platform/moyin.desktop ~/.local/share/applications/
# 把 Exec/Icon 里的 %k/.. 改成你的实际安装目录，例如 /opt/moyin
```

## 与 Windows 版的差别

| 功能 | Windows | Linux / 信创 |
|---|---|---|
| 阅读、翻页、分栏、主题、字体、颜色 | ✅ | ✅ 完全一样 |
| 划线批注、笔记、导出、阅读总结 | ✅ | ✅ 完全一样 |
| 书籍、进度、书签存储 | ✅ 本地 | ✅ 本地（浏览器 IndexedDB） |
| 局域网共享（SMB）导入 | ✅ | ✅（系统已挂载的路径 / `/mnt/nas/...`） |
| 朗读 | ✅ 187 个离线神经语音 | ⚠️ **走系统语音**，具体取决于系统装了哪些中文语音包 |
| 分角色朗读 | ✅ | ❌ 需要本机神经语音引擎，Linux 版未打包 |

分角色朗读依赖随 Windows 版打包的 sherpa-onnx 语音引擎（Windows 二进制）。
Linux 上如果装了 `espeak-ng` 或系统中文 TTS，朗读能出声，但只能一个声音。
