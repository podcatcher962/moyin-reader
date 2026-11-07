"""生成 .deb 安装包的目录树。

真实的 .deb 用目标机器上的 dpkg-deb 打（那边才认包格式细节），这里只负责
把树铺好、打成 tar.gz 送过去：

    python _pkg_linux/make_deb.py
    # 传到 Linux 上：
    scp dist/deb-root.tar.gz user@host:/tmp/
    ssh user@host 'cd /tmp && tar xzf deb-root.tar.gz && \
        dpkg-deb --build --root-owner-group deb-root moyin-reader_1.1.0_amd64.deb'
"""
import io
import os
import shutil
import tarfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'dist')
ROOTDIR = os.path.join(OUT, 'deb-root')

VER = '1.10.2'
PKG = 'moyin-reader'
ARCH = 'amd64'
BIN = os.path.join(OUT, 'MoYinReader-linux-x86_64')

CONTROL = """Package: moyin-reader
Version: {ver}
Section: office
Priority: optional
Architecture: {arch}
Depends: libc6 (>= 2.28)
Installed-Size: {size}
Maintainer: Lanlan Eternal <podcatcher962@users.noreply.github.com>
Homepage: https://github.com/podcatcher962/moyin-reader
Description: 墨吟阅读器 — TXT / EPUB 阅读与朗读
 单文件离线的中文 TXT / EPUB 阅读器：翻页双栏、十种字体、六套主题、
 繁简转换、划线批注、阅读总结、听书朗读与阅读时钟。
 界面中英双语，书籍与笔记全部存在本机，默认零联网。
"""

WRAPPER = """#!/bin/sh
# 墨吟阅读器启动器。优先跑独立程序，跑不了就退回 Python / 浏览器。
DIR=/usr/lib/moyin-reader
if [ -x "$DIR/MoYinReader" ]; then
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
    exec "$DIR/MoYinReader" "$@"
  fi
fi
if command -v python3 >/dev/null 2>&1 && [ -f "$DIR/app.py" ]; then
  exec python3 "$DIR/app.py" "$@"
fi
exec xdg-open "$DIR/MoYinReader.html"
"""

DESKTOP = """[Desktop Entry]
Type=Application
Name=墨吟阅读器
Name[en]=MoYin Reader
GenericName=TXT / EPUB 阅读器
GenericName[en]=TXT / EPUB reader
Comment=离线的中文 TXT / EPUB 阅读与朗读
Comment[en]=Offline Chinese TXT / EPUB reader with speech
Exec=moyin-reader %U
Icon=moyin-reader
Terminal=false
StartupWMClass=MoYinReader
Categories=Office;Viewer;Literature;
Keywords=reader;epub;txt;book;阅读;电子书;
MimeType=text/plain;application/epub+zip;
"""

POSTINST = """#!/bin/sh
set -e
# 刷新菜单与图标缓存（失败也不影响安装）
which update-desktop-database >/dev/null 2>&1 && update-desktop-database -q || true
which gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t /usr/share/icons/hicolor || true
exit 0
"""

POSTRM = """#!/bin/sh
set -e
which update-desktop-database >/dev/null 2>&1 && update-desktop-database -q || true
exit 0
"""


def w(path, text, mode=0o644):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(text.encode('utf-8'))
    os.chmod(path, mode)


def cp(src, dst, mode=0o644):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
    os.chmod(dst, mode)


def main():
    if os.path.isdir(ROOTDIR):
        shutil.rmtree(ROOTDIR)
    os.makedirs(ROOTDIR)

    lib = os.path.join(ROOTDIR, 'usr', 'lib', PKG)
    cp(BIN, os.path.join(lib, 'MoYinReader'), 0o755)
    cp(os.path.join(ROOT, 'MoYinReader.html'), os.path.join(lib, 'MoYinReader.html'))
    cp(os.path.join(ROOT, '_pkg_win', 'app.py'), os.path.join(lib, 'app.py'))
    w(os.path.join(ROOTDIR, 'usr', 'bin', PKG), WRAPPER, 0o755)
    w(os.path.join(ROOTDIR, 'usr', 'share', 'applications', PKG + '.desktop'), DESKTOP, 0o644)
    cp(os.path.join(ROOT, 'platform', 'moyin.png'),
       os.path.join(ROOTDIR, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps', PKG + '.png'))
    cp(os.path.join(ROOT, 'README.md'),
       os.path.join(ROOTDIR, 'usr', 'share', 'doc', PKG, 'README.md'))
    cp(os.path.join(ROOT, 'LICENSE'),
       os.path.join(ROOTDIR, 'usr', 'share', 'doc', PKG, 'copyright'))

    size_kb = 0
    for dirpath, _d, files in os.walk(ROOTDIR):
        for fn in files:
            size_kb += os.path.getsize(os.path.join(dirpath, fn)) // 1024

    os.makedirs(os.path.join(ROOTDIR, 'DEBIAN'), exist_ok=True)
    w(os.path.join(ROOTDIR, 'DEBIAN', 'control'),
      CONTROL.format(ver=VER, arch=ARCH, size=size_kb + 50))
    w(os.path.join(ROOTDIR, 'DEBIAN', 'postinst'), POSTINST, 0o755)
    w(os.path.join(ROOTDIR, 'DEBIAN', 'postrm'), POSTRM, 0o755)

    tgz = os.path.join(OUT, 'deb-root.tar.gz')
    with tarfile.open(tgz, 'w:gz') as t:
        for dirpath, _d, files in os.walk(ROOTDIR):
            for fn in files:
                p = os.path.join(dirpath, fn)
                arc = os.path.join('deb-root', os.path.relpath(p, ROOTDIR))
                ti = t.gettarinfo(p, arcname=arc)
                # Windows 上 chmod 改不了 tar 里的权限位，只能按路径规则写死：
                # DEBIAN 下的维护者脚本、usr/bin 下的启动器、主程序都必须是 755，
                # 否则 dpkg 会拒收（postinst 644）或者装完点不动（启动器 644）。
                base = os.path.basename(dirpath)
                if fn == 'control':
                    ti.mode = 0o644
                elif base == 'DEBIAN' or base == 'bin' or fn == 'MoYinReader' or p.endswith('.sh'):
                    ti.mode = 0o755
                else:
                    ti.mode = 0o644
                ti.uid = ti.gid = 0
                ti.uname = ti.gname = 'root'
                with open(p, 'rb') as fh:
                    t.addfile(ti, fh)
    print('目录树：%s' % ROOTDIR)
    print('传输包：%s  (%.1f KB)' % (tgz, os.path.getsize(tgz) / 1024))
    print('Installed-Size: %d KB' % (size_kb + 50))


if __name__ == '__main__':
    main()
