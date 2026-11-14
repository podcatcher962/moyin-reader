# 墨吟阅读器 · Linux / 信创系统

适用于：**统信 UOS / 银河麒麟 / 中标麒麟 / openEuler / 深度 Deepin / Ubuntu / Debian / 各种国产化发行版**，
以及 **x86_64、aarch64（飞腾、鲲鹏）、loongarch64（龙芯）、mips64el** 等架构。

## 最快用法（不需要装任何东西）

```bash
bash start-linux.sh
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

装完再跑 `bash start-linux.sh`，就是原生窗口。

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
bash build-linux.sh
# 产物：dist/MoYinReader-linux-<架构>
```

**必须在目标机器（或同架构、同发行版的构建机）上打**——PyInstaller 打不出跨架构、跨 glibc 的包。
龙芯（loongarch64）请直接在龙芯机器上跑这个脚本。

打包后自检：

```bash
./dist/MoYinReader-linux-x86_64 --selftest
```

## 桌面快捷方式

发行包里双击「安装到应用菜单.sh」即可，它会把入口写进
`~/.local/share/applications/moyin-reader.desktop`，并顺手放到桌面。
想撤掉就双击「卸载.sh」。

用 `.deb` 装的话，安装时自动就有了，不用管这一节。

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

## 许可与声明

包根目录有四份文件，请连着看，别拆散：

| 文件 | 说什么 |
|---|---|
| `LICENSE` | MIT 全文。覆盖**本项目自己写的代码与文档**，版权 © 2026 Lanlan Eternal |
| `THIRD-PARTY-NOTICES.md` | 逐组件许可状态。有例外：Windows 版随包的 fanchen-C 语音模型上游未声明许可 |
| `VOICE-POLICY.md` | 声音从哪来、三层权利怎么拆、移除通道在哪 |
| `PRIVACY.md` | 不采集、不上传、不录音、不克隆 |

**MIT 不覆盖任何第三方资产。** 谁要拿随包的语音模型去用（尤其商用），不能援引本项目的 MIT 声明——那份声明对模型无效，本项目也没有权利替上游授权。

本 Linux 包不含任何语音模型：朗读走系统语音（见上表），装机清单里只有 `app.py`、`MoYinReader.html` 和几个脚本。

用 `.deb` 装的，这四份在 `/usr/share/doc/moyin-reader/`（`LICENSE` 按 Debian 惯例叫 `copyright`）。

墨吟永久免费。作者从未授权任何人以本项目名义收费、代充、捆绑销售或做「付费版」；你若花了钱，那是卖方行为，与本项目无关。
