# -*- coding: utf-8 -*-
"""在 Windows 上直接产出 .deb（不依赖 dpkg-deb）。

deb 就是标准 ar 归档，三个成员：
    debian-binary   -> "2.0\n"
    control.tar.gz  -> DEBIAN/ 下的 control、postinst、prerm…
    data.tar.gz     -> 文件树（/usr/bin、/usr/share/applications…）

make_deb.py 在 Windows 只把目录树打成 deb-root.tar.gz，真正的 `dpkg-deb --build`
要在目标机跑。这里补上那一步，省得每发一版都得开一次虚拟机。
"""
import gzip
import io
import os
import shutil
import sys
import tarfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, 'dist')
DEB_ROOT = os.path.join(DIST, 'deb-root')
VER = '1.14.0'
OUT = os.path.join(DIST, 'moyin-reader_%s_amd64.deb' % VER)


def tar_gz(src_dir, arc_prefix, mode_rule):
    """把目录打成 tar.gz；权限位写死，否则 dpkg 会拒收或装完点不动。"""
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.GNU_FORMAT) as t:
        for dirpath, dirnames, filenames in os.walk(src_dir):
            dirnames.sort()
            for name in sorted(filenames):
                p = os.path.join(dirpath, name)
                rel = os.path.relpath(p, src_dir).replace(os.sep, '/')
                ti = tarfile.TarInfo(arc_prefix + rel)
                ti.size = os.path.getsize(p)
                ti.mtime = int(time.time())
                ti.mode = mode_rule(rel, name)
                ti.uid = ti.gid = 0
                ti.uname = ti.gname = 'root'
                with open(p, 'rb') as fh:
                    t.addfile(ti, fh)
    return gzip.compress(raw.getvalue(), 9, mtime=0)


def ar_member(name, data):
    """ar 头：名字 16、mtime 12、uid 6、gid 6、mode 8、长度 10、魔数 2。"""
    hdr = ('%-16s%-12s%-6s%-6s%-8s%-10s`\n' %
           ((name + '/')[:16], int(time.time()), '0', '0', '100644', len(data)))
    out = hdr.encode('ascii') + data
    if len(data) % 2:
        out += b'\n'                 # 成员按偶数字节对齐
    return out


def sync_payload():
    """把根目录里的最新产物同步进 deb-root。

    这个函数是补一个真出过的事故：本脚本原先直接沿用上次遗留的 dist/deb-root，
    页面重新 build 之后 deb 里躺的还是旧页面——1.12.0 的包里装着 1.11.0 的 html，
    版本号、检查更新全都不在，只有逐字节核对才发现。现在每次组装前先同步。
    """
    pairs = [
        ('MoYinReader.html', 'usr/lib/moyin-reader/MoYinReader.html'),
        (os.path.join('_pkg_win', 'app.py'), 'usr/lib/moyin-reader/app.py'),
        ('README.md', 'usr/share/doc/moyin-reader/README.md'),
        ('LICENSE', 'usr/share/doc/moyin-reader/copyright'),
    ]
    done = []
    for src_rel, dst_rel in pairs:
        src = os.path.join(ROOT, src_rel)
        if not os.path.isfile(src):
            continue
        dst = os.path.join(DEB_ROOT, dst_rel.replace('/', os.sep))
        if not os.path.isdir(os.path.dirname(dst)):
            continue                      # 目录树里没这一项，说明布局变了，别硬塞
        if os.path.isfile(dst) and os.path.getsize(dst) == os.path.getsize(src) \
                and open(dst, 'rb').read() == open(src, 'rb').read():
            continue                      # 已经一样，不动 mtime
        shutil.copyfile(src, dst)
        done.append(dst_rel)
    return done


def main():
    if not os.path.isdir(os.path.join(DEB_ROOT, 'DEBIAN')):
        sys.exit('没有 %s/DEBIAN，先跑 python _pkg_linux/make_deb.py' % DEB_ROOT)
    synced = sync_payload()
    if synced:
        print('已同步 %d 个文件进 deb-root：' % len(synced))
        for s in synced:
            print('    ' + s)
    # control 侧：DEBIAN/ 里的脚本必须是 755，control 本身 644
    ctl = tar_gz(os.path.join(DEB_ROOT, 'DEBIAN'), './',
                 lambda rel, name: 0o644 if name == 'control' else 0o755)
    # data 侧：可执行文件 755，其余 644
    def dmode(rel, name):
        if rel.startswith('usr/bin/') or rel.endswith('.sh'):
            return 0o755
        return 0o644
    data = tar_gz(DEB_ROOT, './', lambda rel, name: dmode(rel, name)
                  if not rel.startswith('DEBIAN/') else 0o644)
    # 上面把 DEBIAN 也扫进 data 了，重新打一次只留文件树
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.GNU_FORMAT) as t:
        for dirpath, dirnames, filenames in os.walk(DEB_ROOT):
            dirnames[:] = sorted(d for d in dirnames if d != 'DEBIAN')
            if os.path.relpath(dirpath, DEB_ROOT).split(os.sep)[0] == 'DEBIAN':
                continue
            for name in sorted(filenames):
                p = os.path.join(dirpath, name)
                rel = os.path.relpath(p, DEB_ROOT).replace(os.sep, '/')
                ti = tarfile.TarInfo('./' + rel)
                ti.size = os.path.getsize(p)
                ti.mtime = int(time.time())
                ti.mode = dmode(rel, name)
                ti.uid = ti.gid = 0
                ti.uname = ti.gname = 'root'
                with open(p, 'rb') as fh:
                    t.addfile(ti, fh)
    data = gzip.compress(raw.getvalue(), 9, mtime=0)

    blob = b'!<arch>\n' + ar_member('debian-binary', b'2.0\n') \
        + ar_member('control.tar.gz', ctl) + ar_member('data.tar.gz', data)
    with open(OUT, 'wb') as f:
        f.write(blob)
    print('成品：%s  %.1f MB' % (OUT, os.path.getsize(OUT) / 1048576))
    check(OUT)


def check(path):
    """自检：ar 成员顺序、debian-binary 内容、两个 tar.gz 能否解开、control 字段是否齐全。"""
    b = open(path, 'rb').read()
    assert b[:8] == b'!<arch>\n', '不是 ar 归档'
    pos, members = 8, []
    while pos + 60 <= len(b):
        hdr = b[pos:pos + 60]
        name = hdr[:16].decode('ascii').strip().rstrip('/')
        size = int(hdr[48:58].decode('ascii').strip())
        members.append((name, b[pos + 60:pos + 60 + size]))
        pos += 60 + size + (size % 2)
    names = [n for n, _ in members]
    assert names == ['debian-binary', 'control.tar.gz', 'data.tar.gz'], names
    assert members[0][1] == b'2.0\n', members[0][1]
    ctl = tarfile.open(fileobj=io.BytesIO(gzip.decompress(members[1][1])))
    ctl_names = [n.lstrip('./') for n in ctl.getnames()]
    assert any(n.endswith('control') for n in ctl_names), ctl_names
    ctl_txt = ctl.extractfile([n for n in ctl.getnames() if n.endswith('control')][0]).read().decode()
    for k in ('Package:', 'Version:', 'Architecture:', 'Maintainer:'):
        assert k in ctl_txt, 'control 缺 ' + k
    data = tarfile.open(fileobj=io.BytesIO(gzip.decompress(members[2][1])))
    data_names = [n.lstrip('./') for n in data.getnames()]
    assert not any(n.startswith('DEBIAN') for n in data_names), 'data 里混进了 DEBIAN'
    print('自检通过：%d 个成员，control %d 项，data %d 个文件'
          % (len(members), len(ctl_names), len(data_names)))
    for n in data_names[:6]:
        print('   ', n)


if __name__ == '__main__':
    main()
