"""生成 Linux / 信创 与 macOS 的发行包。

    python _pkg_linux/make_pkg.py

产物：
    dist/MoYinReader-Linux-<ver>.tar.gz     Linux / 统信 / 麒麟 / 欧拉（x86_64 带真二进制）
    dist/MoYinReader-macOS-<ver>.zip        macOS（Intel / Apple Silicon 通用，用户自行打包）

Linux 包里第一优先是 dist/MoYinReader-linux-x86_64（在统信 UOS 20 上用
PyInstaller 5.13.2 + Python 3.7 打出来的真 ELF，只依赖 libc/libz/libpthread）。
其余架构（飞腾/鲲鹏 aarch64、龙芯 loongarch64）目前给「HTML + 启动脚本」，
并在包里附 build-linux.sh，可在本机打自己的二进制。
"""
import os
import sys
import tarfile
import time
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VER = '1.12.1'
OUT = os.path.join(ROOT, 'dist')

LINUX_DIR = 'MoYinReader-Linux'
MAC_DIR = 'MoYinReader-macOS'

# 在统信 UOS 上打出来的 x86_64 二进制
LINUX_BIN = os.path.join(OUT, 'MoYinReader-linux-x86_64')

LINUX_NOTE = '''墨吟阅读器 {ver} · Linux / 信创版
=====================================

一、最快的用法（x86_64 机器，含统信 UOS / 麒麟 / openEuler 的常见整机）

  1. 把整个文件夹解压出来，别在压缩包里直接点。
  2. 双击「墨吟阅读器.sh」。
     · 它会优先运行同目录的 MoYinReader（10 MB 的独立程序，不需要 Python、
       不需要装任何依赖，双击就走）。
     · 若系统问「要如何打开」，选「运行」或「在终端中运行」。
  3. 想让它出现在应用菜单 / 桌面：双击一次「安装到应用菜单.sh」。

  这个 MoYinReader 是在统信 UOS 20 专业版上编译的，只依赖 libc / libz /
  libpthread / libdl（glibc 2.28+）。UOS 20、银河麒麟 V10、openEuler 20.03+
  都能直接跑。

二、其它架构（飞腾 / 鲲鹏 aarch64、龙芯 loongarch64）

  这些机器用不了 x86_64 的二进制，但**照样能用**：
  · 双击「墨吟阅读器.sh」会自动退回 Python 方式（系统自带 python3 就行）；
  · 或者直接双击 MoYinReader.html，用浏览器打开，功能一模一样。
  想打成自己架构的独立程序：在本机执行一次
      bash build-linux.sh
  会生成 dist/MoYinReader-linux-<架构>，之后替换掉同名文件即可。

三、这个版本能做什么

  · TXT / EPUB 阅读，滚动或整屏翻页，双栏 / 单栏，十种字体，六套主题 + 十六色板
  · 划线批注、笔记、导出 Markdown、阅读总结
  · 自动翻页（3–180 秒可调）、沉浸全屏、阅读时钟、休息提醒
  · 书架分组、收藏、书签、全文搜索、中英双语界面
  · 拖拽导入：把 TXT / EPUB 拖到窗口里就导入
  · 网络位置：可填 /mnt/nas/books 这类已挂载的共享路径（SMB 请先用系统挂载）
  · 朗读：走系统语音（取决于系统装了哪些中文语音包）。分角色朗读需要
    Windows 版里那套神经语音引擎，Linux 上暂不支持。

四、自检

  终端里执行：  ./MoYinReader --selftest
  会检查内嵌页面、本地服务、导入通道是否正常（27 项）。

五、卸载

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

# ① 优先用同目录的独立程序（x86_64，不需要 Python）
if [ -x "./MoYinReader" ]; then
  ARCH=$(uname -m 2>/dev/null)
  if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
    exec ./MoYinReader "$@"
  fi
fi

# ② 退回 Python（系统自带 python3 就够，不需要任何第三方库）
if command -v python3 >/dev/null 2>&1 && [ -f app.py ]; then
  exec python3 app.py "$@"
fi

# ③ 再退：直接用浏览器打开单文件
for c in xdg-open gio sensible-browser firefox chromium chromium-browser org.deepin.browser kylin-browser; do
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


def build_linux():
    base = os.path.join(OUT, LINUX_DIR)
    if os.path.isdir(base):
        for f in os.listdir(base):
            p = os.path.join(base, f)
            if os.path.isfile(p):
                os.remove(p)

    has_bin = os.path.isfile(LINUX_BIN)
    if has_bin:
        copy(LINUX_BIN, os.path.join(base, 'MoYinReader'), 0o755)

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
    copy(os.path.join(ROOT, 'LICENSE'), os.path.join(base, 'LICENSE'))
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
    copy(os.path.join(ROOT, 'LICENSE'), os.path.join(base, 'LICENSE'))
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
    if not os.path.isfile(LINUX_BIN):
        print('⚠ 没找到 %s，Linux 包将只有脚本兜底' % LINUX_BIN)
    a = build_linux()
    b = build_mac()
    for f in (a, b):
        print('%-46s %8.1f KB' % (os.path.basename(f), os.path.getsize(f) / 1024))
    print('用时 %.1fs' % (time.time() - t0))
