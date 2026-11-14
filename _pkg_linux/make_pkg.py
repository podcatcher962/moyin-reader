"""生成 Linux / 信创 与 macOS 的发行包。

    python _pkg_linux/make_pkg.py

产物：
    dist/MoYinReader-Linux-<ver>.tar.gz     Linux / 统信 / 麒麟 / 欧拉
    dist/MoYinReader-macOS-<ver>.zip        macOS（Intel / Apple Silicon 通用，用户自行打包）

1.14.39 起 Linux 包**不再带** dist/MoYinReader-linux-x86_64。原因不在体积，
在版本：那个二进制是 2026-11-07 在统信 UOS 上用 PyInstaller 打的 onefile，
页面靠 ``--add-data MoYinReader.html:.`` 内嵌，解包实测内嵌 html 只有 371 KB，
而 1.14.25 起页面内置 PDF.js，现在是 2.1 MB。也就是说 1.11~1.14.35 的包里，
x86_64 用户双击「墨吟阅读器.sh」跑的一直是 **1.10 的旧界面**，外层那个新
html 根本没被读过——启动脚本第一句就 exec 了旧二进制。

PyInstaller 打不出跨架构跨 glibc 的包，本机 WSL 又被安全策略禁用，没法在这台
Windows 上重打；发一个没在真机验证过的二进制比不发更糟。所以这版走两条稳的路：
系统 python3（信创机器基本自带）或系统浏览器，功能与独立程序完全一样
（墨吟本来就是单文件应用，数据存在浏览器 IndexedDB 里）。真要免 Python，
在目标机器上跑一次 build-linux.sh，打出来的天然匹配本机架构与 glibc。
"""
import os
import sys
import tarfile
import time
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VER = '1.14.41'
OUT = os.path.join(ROOT, 'dist')

LINUX_DIR = 'MoYinReader-Linux'
MAC_DIR = 'MoYinReader-macOS'

LINUX_NOTE = '''墨吟阅读器 {ver} · Linux / 信创版
=====================================

一、怎么用（统信 UOS / 麒麟 / openEuler / Deepin / 龙芯，一个文件都不用装）

  1. 把整个文件夹解压出来，别在压缩包里直接点。
  2. 双击「墨吟阅读器.sh」。它会按这个顺序找路：
     · 系统里有 python3 → 直接起原生窗口（信创机器的 python3 都是系统自带的，
       不需要装任何第三方库）；
     · 没有 python3 → 用 Chromium 系浏览器的「应用窗口」模式打开，没有地址栏，
       看起来和独立程序一样；
     · 连浏览器都没有 → 你手动双击 MoYinReader.html 也行，功能一模一样。
  3. 想让它出现在应用菜单 / 桌面：双击一次「安装到应用菜单.sh」。

  墨吟是单文件应用——界面、样式、脚本全在 MoYinReader.html 里，书籍和笔记
  存在浏览器本地数据库（IndexedDB）里。所以「用浏览器打开」和「用独立窗口」
  功能完全一样，只是少个独立窗口。

二、想要「不需要 Python 的独立程序」

  在你这台机器上执行一次（只要一次）：
      bash build-linux.sh
  会生成 dist/MoYinReader-linux-<架构>，把它改名成 MoYinReader 放到本文件夹里，
  以后双击「墨吟阅读器.sh」就会优先用它。

  为什么包里的不是独立程序：独立程序必须在本机架构 + 本机 glibc 上打，
  Windows 上打不出来。包内附的这个脚本靠系统 python3 打包，天生适配你的机器，
  比塞一个别处打好的二进制更可靠。

三、这个版本能做什么

  · TXT / EPUB / PDF 阅读，滚动或整屏翻页，双栏 / 单栏，十种字体，六套主题 + 十六色板
  · 划线批注、笔记、导出 Markdown、阅读总结
  · 自动翻页（3–180 秒可调）、沉浸全屏、阅读时钟、休息提醒
  · 书架分组、收藏、书签、全文搜索、中英双语界面
  · 拖拽导入：把 TXT / EPUB 拖到窗口里就导入
  · 网络位置：可填 /mnt/nas/books 这类已挂载的共享路径（SMB 请先用系统挂载）
  · 朗读：走系统语音（取决于系统装了哪些中文语音包）。分角色朗读需要
    Windows 版里那套神经语音引擎，Linux 上暂不支持。

四、自检

  装过 pywebview 的机器可以先自检：  python3 app.py --selftest
  会检查内嵌页面、本地服务、导入通道是否正常。

五、许可与声明（重要，请读一下）

  · LICENSE —— 本项目代码与文档以 MIT 许可证发布，版权 © 2026 Lanlan Eternal。
    MIT 只覆盖作者自己写的东西，**不覆盖任何第三方资产**。
  · THIRD-PARTY-NOTICES.md —— 逐组件许可状态。有例外：Windows 版随包的
    fanchen-C 语音模型上游未声明任何许可证，本项目只按原样分发、不作再许可、
    不声称它开源。任何人对它的使用不能援引本项目的 MIT 声明。
  · VOICE-POLICY.md —— 声音从哪来、三层权利怎么拆、移除通道在哪。
  · PRIVACY.md —— 不采集、不上传、不录音、不克隆。

  本 Linux 包**不含任何语音模型**（朗读走系统语音，见第三节），所以上面关于
  模型的那一条在这里不适用；列出来是为了让整套文档保持一份，别被拆散。

  墨吟永久免费。作者从未授权任何人以本项目名义收费、代充、捆绑销售或做
  "付费版"。你若花了钱，那是卖方行为，与本项目无关。

六、卸载

  如果跑过「安装到应用菜单.sh」，双击「卸载.sh」即可清掉菜单项。
  书籍与阅读记录存在 ~/.local/share/MoYinReader，删掉这个目录即彻底清空。

作者 / 版权 © 2026 永远的兰兰（Lanlan Eternal）
本工具仅供个人阅读自己合法持有的电子书使用。
'''

MAC_NOTE = '''墨吟阅读器 {ver} · macOS 版
=============================

macOS 上没法在 Windows 机器上交叉编译，所以这里给的是「源码 + 一键打包脚本」，
你在自己的 Mac 上跑一次就有原生程序。做法和 LanSpice 一样。

一、最快用法（不打包也能用）

  双击 MoYinReader.html，用 Safari / Chrome 打开即可，功能完整。

二、打成 .app（推荐）

  1. 打开「终端」，cd 到这个文件夹。
  2. 执行一次：
        bash build-macos.sh
  3. 产物在 dist/墨吟阅读器.app，拖到「应用程序」里即可。
     首次打开被 Gatekeeper 拦住时：右键 → 打开 → 再点「打开」。

  脚本会自动装 PyInstaller（用 pip --user，不动系统 Python）。

三、这个版本能做什么

  · TXT / EPUB 阅读，滚动或整屏翻页，双栏 / 单栏，十种字体，六套主题 + 十六色板
  · 划线批注、笔记、导出 Markdown、阅读总结
  · 自动翻页（3–180 秒可调）、沉浸全屏、阅读时钟、休息提醒
  · 书架分组、收藏、书签、全文搜索、中英双语界面
  · 朗读：走 macOS 系统语音（到「系统设置 → 辅助功能 → 朗读内容」装中文语音）

四、许可与声明（重要，请读一下）

  · LICENSE —— 本项目代码与文档以 MIT 许可证发布，版权 © 2026 Lanlan Eternal。
    MIT 只覆盖作者自己写的东西，**不覆盖任何第三方资产**。
  · THIRD-PARTY-NOTICES.md —— 逐组件许可状态。有例外：Windows 版随包的
    fanchen-C 语音模型上游未声明任何许可证，本项目只按原样分发、不作再许可、
    不声称它开源。任何人对它的使用不能援引本项目的 MIT 声明。
  · VOICE-POLICY.md —— 声音从哪来、三层权利怎么拆、移除通道在哪。
  · PRIVACY.md —— 不采集、不上传、不录音、不克隆。

  本 macOS 包**不含任何语音模型**（朗读走系统语音，见第三节），所以上面关于
  模型的那一条在这里不适用；列出来是为了让整套文档保持一份，别被拆散。

  墨吟永久免费。作者从未授权任何人以本项目名义收费、代充、捆绑销售或做
  "付费版"。你若花了钱，那是卖方行为，与本项目无关。

作者 / 版权 © 2026 永远的兰兰（Lanlan Eternal）
'''


def w(path, text, mode=0o644):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(text.encode('utf-8'))
    os.chmod(path, mode)


def copy(src, dst, mode=0o644):
    with open(src, 'rb') as f:
        data = f.read()
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'wb') as f:
        f.write(data)
    os.chmod(dst, mode)


LINUX_LAUNCH = '''#!/bin/bash
# 墨吟阅读器 · 双击我就能用（Linux / 统信 / 麒麟 / 欧拉 / 龙芯）
cd "$(dirname "$0")" || exit 1

# ① 你如果自己用 build-linux.sh 打过独立程序，放在这里就叫它
if [ -x "./MoYinReader" ]; then
  exec ./MoYinReader "$@"
fi

# ② 系统自带 python3 就够（不用装任何第三方库；缺 pywebview 会自动开浏览器）
if command -v python3 >/dev/null 2>&1 && [ -f app.py ]; then
  exec python3 app.py "$@"
fi

# ③ 没有 python3：用 Chromium 系浏览器的「应用窗口」模式，没有地址栏
for c in google-chrome google-chrome-stable chromium chromium-browser \\
         microsoft-edge microsoft-edge-stable org.deepin.browser kylin-browser; do
  if command -v "$c" >/dev/null 2>&1; then
    "$c" --app="file://$PWD/MoYinReader.html" >/dev/null 2>&1 &
    exit 0
  fi
done

# ④ 最后退回普通浏览器打开单文件
for c in xdg-open gio sensible-browser firefox; do
  if command -v "$c" >/dev/null 2>&1; then
    if [ "$c" = "gio" ]; then gio open "file://$PWD/MoYinReader.html"
    else "$c" "file://$PWD/MoYinReader.html" & fi
    exit 0
  fi
done
echo "没找到可用的启动方式，请手动用浏览器打开：$PWD/MoYinReader.html"
read -r -p "按回车关闭" _
'''

LINUX_INSTALL = '''#!/bin/bash
# 把墨吟装到应用菜单与桌面（双击一次即可）
cd "$(dirname "$0")" || exit 1
DIR="$PWD"
APP="$HOME/.local/share/applications"
mkdir -p "$APP"

ICON="$DIR/icon.png"
[ -f "$ICON" ] || ICON="applications-office"

cat > "$APP/moyin-reader.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=墨吟阅读器
Name[en]=MoYin Reader
Comment=TXT / EPUB 阅读与朗读，本地离线
Comment[en]=Offline TXT / EPUB reader
Exec=bash "$DIR/墨吟阅读器.sh" %U
Path=$DIR
Icon=$ICON
Terminal=false
StartupWMClass=MoYinReader
Categories=Office;Viewer;Literature;
MimeType=text/plain;application/epub+zip;
EOF

chmod +x "$APP/moyin-reader.desktop"

# 桌面快捷方式（有的发行版是 ~/桌面，有的是 ~/Desktop）
for D in "$HOME/桌面" "$HOME/Desktop"; do
  if [ -d "$D" ]; then
    cp "$APP/moyin-reader.desktop" "$D/"
    chmod +x "$D/moyin-reader.desktop"
    gio set "$D/moyin-reader.desktop" metadata::trusted true 2>/dev/null
  fi
done

echo "已安装：$APP/moyin-reader.desktop"
echo "如果菜单里没立刻出现，注销重新登录一次。"
read -r -p "按回车关闭" _
'''

LINUX_UNINSTALL = '''#!/bin/bash
# 清掉应用菜单与桌面上的入口（书和笔记不动）
rm -f "$HOME/.local/share/applications/moyin-reader.desktop"
rm -f "$HOME/桌面/moyin-reader.desktop" "$HOME/Desktop/moyin-reader.desktop"
echo "已移除菜单与桌面入口。"
echo "书与阅读记录仍在：$HOME/.local/share/MoYinReader"
echo "（想彻底清空就删掉那个目录）"
read -r -p "按回车关闭" _
'''

MAC_LAUNCH = '''#!/bin/bash
# 墨吟阅读器 · 双击我就能用（macOS）
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1 && [ -f app.py ]; then
  exec python3 app.py
fi
open "$PWD/MoYinReader.html"
'''


def mode_for(name):
    if name in ('MoYinReader',):
        return 0o755
    if name.endswith(('.sh', '.command', '.desktop')):
        return 0o755
    return 0o644


# 合规四件套：跟着每个包走，别让用户拿到的是被拆散的文档。
# LICENSE 是 MIT 全文（本体的权利），后三份说清「MIT 不覆盖什么」。
DOCS = ('LICENSE', 'THIRD-PARTY-NOTICES.md', 'VOICE-POLICY.md', 'PRIVACY.md')


def copy_docs(base):
    """把许可与声明文件拷进包根目录，缺一个就报出来。"""
    for name in DOCS:
        src = os.path.join(ROOT, name)
        if not os.path.isfile(src):
            raise SystemExit('缺文档：%s' % src)
        copy(src, os.path.join(base, name))


def build_linux():
    base = os.path.join(OUT, LINUX_DIR)
    if os.path.isdir(base):
        for f in os.listdir(base):
            p = os.path.join(base, f)
            if os.path.isfile(p):
                os.remove(p)

    # 放 dist/MoYinReader-linux-x86_64 是坑：那是 1.10 时代的 onefile，
    # 内嵌页面 371 KB，运行时根本读不到外层这份 2.1 MB 的新页面（见文件头）。
    # 想要独立程序，用户在自己机器上跑 build-linux.sh，别用旧的替。
    copy(os.path.join(ROOT, 'MoYinReader.html'), os.path.join(base, 'MoYinReader.html'))
    copy(os.path.join(ROOT, '_pkg_win', 'app.py'), os.path.join(base, 'app.py'))
    w(os.path.join(base, '墨吟阅读器.sh'), LINUX_LAUNCH, 0o755)
    w(os.path.join(base, '安装到应用菜单.sh'), LINUX_INSTALL, 0o755)
    w(os.path.join(base, '卸载.sh'), LINUX_UNINSTALL, 0o755)
    for extra in ('start-linux.sh', 'build-linux.sh'):
        src = os.path.join(ROOT, 'platform', extra)
        if os.path.isfile(src):
            copy(src, os.path.join(base, extra), 0o755)
    copy(os.path.join(ROOT, 'platform', 'moyin.png'), os.path.join(base, 'icon.png'))
    copy(os.path.join(ROOT, 'platform', 'README-Linux.md'), os.path.join(base, 'README-Linux.md'))
    copy_docs(base)
    w(os.path.join(base, '使用说明.txt'), LINUX_NOTE.format(ver=VER))

    tgz = os.path.join(OUT, 'MoYinReader-Linux-%s.tar.gz' % VER)
    with tarfile.open(tgz, 'w:gz') as t:
        for name in sorted(os.listdir(base)):
            src = os.path.join(base, name)
            if not os.path.isfile(src):
                continue
            ti = t.gettarinfo(src, arcname=os.path.join(LINUX_DIR, name))
            # Windows 上 chmod 改不了 tar 里的权限位，这里显式写死
            ti.mode = mode_for(name)
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = ''
            with open(src, 'rb') as fh:
                t.addfile(ti, fh)
    return tgz


def build_mac():
    base = os.path.join(OUT, MAC_DIR)
    if os.path.isdir(base):
        for f in os.listdir(base):
            p = os.path.join(base, f)
            if os.path.isfile(p):
                os.remove(p)

    copy(os.path.join(ROOT, 'MoYinReader.html'), os.path.join(base, 'MoYinReader.html'))
    copy(os.path.join(ROOT, '_pkg_win', 'app.py'), os.path.join(base, 'app.py'))
    w(os.path.join(base, '墨吟阅读器.command'), MAC_LAUNCH, 0o755)
    for extra in ('start-macos.sh', 'build-macos.sh'):
        src = os.path.join(ROOT, 'platform', extra)
        if os.path.isfile(src):
            copy(src, os.path.join(base, extra), 0o755)
    copy(os.path.join(ROOT, 'platform', 'README-macOS.md'), os.path.join(base, 'README-macOS.md'))
    copy_docs(base)
    w(os.path.join(base, '使用说明.txt'), MAC_NOTE.format(ver=VER))

    z = os.path.join(OUT, 'MoYinReader-macOS-%s.zip' % VER)
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
        for name in sorted(os.listdir(base)):
            p = os.path.join(base, name)
            if not os.path.isfile(p):
                continue
            zi = zipfile.ZipInfo.from_file(p, os.path.join(MAC_DIR, name))
            zi.external_attr = mode_for(name) << 16
            zi.compress_type = zipfile.ZIP_DEFLATED
            with open(p, 'rb') as fh:
                f.writestr(zi, fh.read())
    return z


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    a = build_linux()
    b = build_mac()
    for f in (a, b):
        print('%-46s %8.1f KB' % (os.path.basename(f), os.path.getsize(f) / 1024))
    print('用时 %.1fs' % (time.time() - t0))
