"""生成 .deb 安装包的目录树。

真实的 .deb 用目标机器上的 dpkg-deb 打（那边才认包格式细节），这里只负责
把树铺好、打成 tar.gz 送过去：

    python _pkg_linux/make_deb.py
    # 传到 Linux 上：
    scp dist/deb-root.tar.gz user@host:/tmp/
    ssh user@host 'cd /tmp && tar xzf deb-root.tar.gz && \
        dpkg-deb --build --root-owner-group deb-root moyin-reader_1.1.0_amd64.deb'

1.14.39 起不再往包里塞 dist/MoYinReader-linux-x86_64。那个二进制是 1.10.0
时代（2026-11-07）在统信 UOS 上打的 PyInstaller onefile，页面是用
``--add-data MoYinReader.html:.`` **内嵌**进去的，解包实测内嵌 html 只有
371 KB；而 1.14.25 起页面内置了 PDF.js，现在是 2.1 MB。也就是说 1.11 到
1.14.35 的 Linux 包，x86_64 用户双击跑的一直是 1.10 的旧界面，外层那个
新 html 根本没被读到。

PyInstaller 不能交叉编译，Windows 上重打不了（本机 WSL 也被安全策略禁用），
没验证过的二进制比没有更危险——所以这版只放「app.py + 页面 + 启动器」，
两条路都能跑：系统 python3（信创机器基本都自带）或系统浏览器。想免 Python
就在目标机器上跑一次 build-linux.sh，打出来天然匹配本机架构与 glibc。
"""
import io
import os
import shutil
import tarfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'dist')
ROOTDIR = os.path.join(OUT, 'deb-root')

VER = '1.14.41'
PKG = 'moyin-reader'
ARCH = 'amd64'

CONTROL = """Package: moyin-reader
Version: {ver}
Section: office
Priority: optional
Architecture: {arch}
Depends: libc6
Installed-Size: {size}
Maintainer: Lanlan Eternal <podcatcher962@users.noreply.github.com>
Homepage: https://github.com/podcatcher962/moyin-reader
Description: 墨吟阅读器 — TXT / EPUB 阅读与朗读
 单文件离线的中文 TXT / EPUB 阅读器：翻页双栏、十种字体、六套主题、
 繁简转换、划线批注、阅读总结、听书朗读与阅读时钟。
 界面中英双语，书籍与笔记全部存在本机，默认零联网。
"""

WRAPPER = """#!/bin/sh
# 墨吟阅读器启动器。
#   ① 系统自带 python3 → 起原生窗口（不装任何第三方库也能跑，缺 pywebview 就开浏览器）
#   ② 没有 python3 → 用 Chromium 系浏览器的 --app 模式，开一个没有地址栏的窗口
#   ③ 都没有 → 普通浏览器打开
# 想免 Python：在任意装了 python3 的机器上跑一次 build-linux.sh，把产物改名成
# MoYinReader 放到 /usr/lib/moyin-reader/ 下，这里会自动优先用它。
DIR=/usr/lib/moyin-reader
if [ -x "$DIR/MoYinReader" ]; then
  exec "$DIR/MoYinReader" "$@"
fi
if command -v python3 >/dev/null 2>&1 && [ -f "$DIR/app.py" ]; then
  exec python3 "$DIR/app.py" "$@"
fi
for c in google-chrome google-chrome-stable chromium chromium-browser \\
         microsoft-edge microsoft-edge-stable org.deepin.browser kylin-browser; do
  if command -v "$c" >/dev/null 2>&1; then
    "$c" --app="file://$DIR/MoYinReader.html" >/dev/null 2>&1 &
    exit 0
  fi
done
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
    # 不再放 dist/MoYinReader-linux-x86_64（1.10 时代的旧内嵌页面，见文件头说明）
    cp(os.path.join(ROOT, 'MoYinReader.html'), os.path.join(lib, 'MoYinReader.html'))
    cp(os.path.join(ROOT, '_pkg_win', 'app.py'), os.path.join(lib, 'app.py'))
    w(os.path.join(ROOTDIR, 'usr', 'bin', PKG), WRAPPER, 0o755)
    w(os.path.join(ROOTDIR, 'usr', 'share', 'applications', PKG + '.desktop'), DESKTOP, 0o644)
    cp(os.path.join(ROOT, 'platform', 'moyin.png'),
       os.path.join(ROOTDIR, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps', PKG + '.png'))
    cp(os.path.join(ROOT, 'README.md'),
       os.path.join(ROOTDIR, 'usr', 'share', 'doc', PKG, 'README.md'))
    # Debian 惯例：LICENSE 放成 copyright。另外三份合规章程一并装进去，
    # 否则装完只剩一个 MIT 全文，用户看不到「MIT 不覆盖第三方资产」那句。
    cp(os.path.join(ROOT, 'LICENSE'),
       os.path.join(ROOTDIR, 'usr', 'share', 'doc', PKG, 'copyright'))
    for name in ('THIRD-PARTY-NOTICES.md', 'VOICE-POLICY.md', 'PRIVACY.md'):
        cp(os.path.join(ROOT, name), os.path.join(ROOTDIR, 'usr', 'share', 'doc', PKG, name))

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
