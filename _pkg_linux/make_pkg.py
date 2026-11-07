"""生成 Linux / 信创 与 macOS 的发行包。

    python _pkg_linux/make_pkg.py

产物：
    dist/MoYinReader-Linux-<ver>.tar.gz     Linux / 统信 / 麒麟 / 欧拉 / 龙芯（与架构无关）
    dist/MoYinReader-macOS-<ver>.zip        macOS（Intel / Apple Silicon 通用）

为什么是「单文件 HTML + 启动脚本」而不是 ELF 二进制：
PyInstaller 只能打「本机构架 + 本机 glibc」的包，不能在 Windows 上交叉编译；
而信创机器有 x86_64 / aarch64 / loongarch64 / mips64el 四种架构，
真正的通用做法是前端包（任何架构的浏览器都能跑）+ 可选的原生窗口。
"""
import os
import sys
import tarfile
import time
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VER = '1.10.0'
OUT = os.path.join(ROOT, 'dist')

LINUX_DIR = 'MoYinReader-Linux'
MAC_DIR = 'MoYinReader-macOS'

LINUX_NOTE = '''墨吟阅读器 {ver} · Linux / 信创版
=====================================

一、怎么用（不需要装任何东西）

  1. 把整个文件夹解压出来（别在压缩包里直接点）。
  2. 双击「墨吟阅读器.sh」。
     · 如果系统问「要如何打开」，选「在终端中运行」或「运行」。
     · 如果没反应，直接双击 MoYinReader.html，用浏览器打开，功能完全一样。
  3. 想放到桌面/应用菜单：双击「安装到应用菜单.sh」一次即可。

  首次打开可以在书架点「＋ 导入书籍」或「导入文件夹」，也可以点「网络位置」
  填 /mnt/nas/books 这类已挂载的共享路径。书籍和进度都存在本机，不上传。

二、这个版本能做什么

  · TXT / EPUB 阅读，滚动或整屏翻页，双栏/单栏，十种字体，六套主题 + 十六色板
  · 划线批注、笔记、导出 Markdown、阅读总结
  · 自动翻页（3–180 秒可调）、沉浸全屏、阅读时钟、休息提醒
  · 书架分组、收藏、书签、全文搜索、中英双语界面
  · 朗读：走系统语音（取决于系统装的语音包）；分角色朗读需要 Windows 版的神经语音引擎

三、想有独立窗口（可选）

  装一次 pywebview 就有原生窗口：
      sudo apt install python3 python3-gi gir1.2-webkit2-4.0   # 统信/麒麟/Debian 系
      sudo dnf install python3 python3-gobject webkit2gtk4.1     # 欧拉/openEuler 系
      pip3 install --user pywebview
  然后再双击「墨吟阅读器.sh」。没装也能用，会自动用浏览器打开。

四、想要真正的可执行文件

  在目标机器上执行一次（需要 pyinstaller）：
      bash build-linux.sh
  会生成 dist/MoYinReader-linux-<架构>。
  ⚠️ 必须在目标架构上打：x86_64 / aarch64（飞腾、鲲鹏）/ loongarch64（龙芯）不能互相通用。

五、自检

  用 python3 跑：python3 app.py --selftest
  会检查内嵌页面、本地服务、导入通道是否正常。

作者 / 版权 © 2026 永远的兰兰（Lanlan Eternal）
本工具仅供个人阅读自己合法持有的电子书使用。
'''

MAC_NOTE = '''墨吟阅读器 {ver} · macOS 版
=============================

一、怎么用

  方式一（最快）：双击 MoYinReader.html，用 Safari 打开即可。
  方式二（独立窗口）：终端里执行一次
        python3 -m pip install --user pywebview
      然后双击「墨吟阅读器.command」。
      （macOS 可能提示「未验证的开发者」，右键 → 打开 → 再点「打开」）

二、这个版本能做什么

  · TXT / EPUB 阅读，滚动或整屏翻页，双栏/单栏，十种字体，六套主题 + 十六色板
  · 划线批注、笔记、导出 Markdown、阅读总结
  · 自动翻页（3–180 秒可调）、沉浸全屏、阅读时钟、休息提醒
  · 书架分组、收藏、书签、全文搜索、中英双语界面
  · 朗读：走 macOS 系统语音（到「系统设置 → 辅助功能 → 朗读内容」装中文语音）

三、想打包成 .app

       bash build-macos.sh
  产物 dist/墨吟阅读器.app。首次打开被 Gatekeeper 拦时：
       右键 → 打开 → 再点「打开」
  或终端：xattr -dr com.apple.quarantine "dist/墨吟阅读器.app"

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

if command -v python3 >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  if python3 -c "import webview" >/dev/null 2>&1; then
    python3 app.py
    exit $?
  fi
  # 没有 pywebview 也照跑：app.py 会起本地服务并打开浏览器
  python3 app.py
  exit $?
fi

# 连 python3 都没有：直接用浏览器打开单文件
for c in xdg-open gio sensible-browser firefox chromium chromium-browser uos-browser kylin-browser; do
  if command -v "$c" >/dev/null 2>&1; then
    if [ "$c" = "gio" ]; then gio open "file://$PWD/MoYinReader.html"; else "$c" "file://$PWD/MoYinReader.html" & fi
    exit 0
  fi
done
echo "没找到浏览器，请手动打开：$PWD/MoYinReader.html"
read -r -p "按回车关闭" _
'''

LINUX_INSTALL = '''#!/bin/bash
# 把墨吟装到应用菜单（双击一次即可，随时可再删）
cd "$(dirname "$0")" || exit 1
DIR="$PWD"
APP="$HOME/.local/share/applications"
mkdir -p "$APP"

cat > "$APP/moyin-reader.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=墨吟阅读器
Name[en]=MoYin Reader
Comment=TXT / EPUB 阅读与朗读，本地离线
Exec=bash "$DIR/墨吟阅读器.sh"
Icon=$DIR/icon.png
Terminal=false
Categories=Office;Viewer;Literature;
EOF

chmod +x "$APP/moyin-reader.desktop"
# 也放一份到桌面（有的发行版桌面目录是 ~/桌面 或 ~/Desktop）
for D in "$HOME/桌面" "$HOME/Desktop"; do
  if [ -d "$D" ]; then cp "$APP/moyin-reader.desktop" "$D/"; chmod +x "$D/moyin-reader.desktop"; fi
done
echo "已安装：$APP/moyin-reader.desktop"
echo "（如果图标没出现，注销重新登录一次）"
read -r -p "按回车关闭" _
'''

MAC_LAUNCH = '''#!/bin/bash
# 墨吟阅读器 · 双击我就能用（macOS）
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1 && python3 -c "import webview" >/dev/null 2>&1; then
  python3 app.py
else
  open "$PWD/MoYinReader.html"
fi
'''


def build_linux():
    base = os.path.join(OUT, LINUX_DIR)
    copy(os.path.join(ROOT, 'MoYinReader.html'), os.path.join(base, 'MoYinReader.html'))
    copy(os.path.join(ROOT, '_pkg_win', 'app.py'), os.path.join(base, 'app.py'))
    w(os.path.join(base, '墨吟阅读器.sh'), LINUX_LAUNCH, 0o755)
    w(os.path.join(base, '安装到应用菜单.sh'), LINUX_INSTALL, 0o755)
    copy(os.path.join(ROOT, 'platform', 'start-linux.sh'), os.path.join(base, 'start-linux.sh'), 0o755)
    copy(os.path.join(ROOT, 'platform', 'build-linux.sh'), os.path.join(base, 'build-linux.sh'), 0o755)
    copy(os.path.join(ROOT, 'platform', 'moyin.png'), os.path.join(base, 'icon.png'))
    copy(os.path.join(ROOT, 'platform', 'README-Linux.md'), os.path.join(base, 'README-Linux.md'))
    copy(os.path.join(ROOT, 'LICENSE'), os.path.join(base, 'LICENSE'))
    w(os.path.join(base, '使用说明.txt'), LINUX_NOTE.format(ver=VER))

    tgz = os.path.join(OUT, 'MoYinReader-Linux-%s.tar.gz' % VER)
    with tarfile.open(tgz, 'w:gz') as t:
        for name in sorted(os.listdir(base)):
            src = os.path.join(base, name)
            ti = t.gettarinfo(src, arcname=os.path.join(LINUX_DIR, name))
            # Windows 上 chmod 改不了 tar 里的权限位，这里显式写死
            ti.mode = 0o755 if name.endswith('.sh') else 0o644
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = ''
            with open(src, 'rb') as fh:
                t.addfile(ti, fh)
    return tgz


def build_mac():
    base = os.path.join(OUT, MAC_DIR)
    copy(os.path.join(ROOT, 'MoYinReader.html'), os.path.join(base, 'MoYinReader.html'))
    copy(os.path.join(ROOT, '_pkg_win', 'app.py'), os.path.join(base, 'app.py'))
    w(os.path.join(base, '墨吟阅读器.command'), MAC_LAUNCH, 0o755)
    copy(os.path.join(ROOT, 'platform', 'start-macos.sh'), os.path.join(base, 'start-macos.sh'), 0o755)
    copy(os.path.join(ROOT, 'platform', 'build-macos.sh'), os.path.join(base, 'build-macos.sh'), 0o755)
    copy(os.path.join(ROOT, 'platform', 'README-macOS.md'), os.path.join(base, 'README-macOS.md'))
    copy(os.path.join(ROOT, 'LICENSE'), os.path.join(base, 'LICENSE'))
    w(os.path.join(base, '使用说明.txt'), MAC_NOTE.format(ver=VER))

    z = os.path.join(OUT, 'MoYinReader-macOS-%s.zip' % VER)
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
        for name in sorted(os.listdir(base)):
            p = os.path.join(base, name)
            zi = zipfile.ZipInfo.from_file(p, os.path.join(MAC_DIR, name))
            zi.external_attr = (0o755 if name.endswith(('.sh', '.command')) else 0o644) << 16
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
        print('%-56s %7.1f KB' % (os.path.basename(f), os.path.getsize(f) / 1024))
    print('用时 %.1fs' % (time.time() - t0))
