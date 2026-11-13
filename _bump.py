# -*- coding: utf-8 -*-
"""墨吟 · 版本号统一工具

版本号散在 6 个脚本、1 个页面、1 份清单里，手工改必然漏。这个脚本做三件事：

  1) 查：当前各处版本号是否一致、安卓 versionCode 对不对得上；
  2) 升：一次改全，并按「主.次.修」自动算 versionCode；
  3) 锁：改完再查一遍，有不一致直接退出码 1（可挂进发版流程当门禁）。

用法：
  python _bump.py                 # 只看现状
  python _bump.py 1.12.0          # 升到 1.12.0
  python _bump.py --check         # 只校验，不一致返回 1
  python _bump.py 1.12.0 --dry    # 演练，不落盘

versionCode 规则（安卓要求它必须单调递增，而版本名是给人看的）：
  major * 10000 + minor * 100 + patch
  1.12.0 → 11200、1.12.1 → 11201、2.0.0 → 20000
  这样任意两个版本的大小关系和版本名一致，不用记「这次该 +1 还是 +2」。
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))

# (相对路径, 正则, 说明)  —— 正则里必须有一个名为 v 的分组
TARGETS = [
    ('app.js',                  r"var VER = '(?P<v>\d+\.\d+\.\d+)';",          '前端版本常量'),
    ('_pkg_win/app.py',         r"VER = '(?P<v>\d+\.\d+\.\d+)'",               'Windows/macOS 壳'),
    ('_pkg_linux/make_pkg.py',  r"VER = '(?P<v>\d+\.\d+\.\d+)'",               'Linux 打包'),
    ('_pkg_linux/make_deb.py',  r"VER = '(?P<v>\d+\.\d+\.\d+)'",               'deb 打包'),
    ('_pkg_linux/make_deb_win.py', r"VER = '(?P<v>\d+\.\d+\.\d+)'",            'deb 打包（Windows 端）'),
    ('_push_assets.py',         r"VER = '(?P<v>\d+\.\d+\.\d+)'",               'Release 资产上传'),
    ('_push_release.py',        r"tag = 'v(?P<v>\d+\.\d+\.\d+)'",              'Release 标签'),
    ('_push_release.py',        r"'v(?P<v>\d+\.\d+\.\d+) — ",                 'Release 标题'),
]
APK = ('_pkg_apk/build_apk.py', r'android:versionName="(?P<v>\d+\.\d+\.\d+)"', 'APK 版本名')
APK_CODE = ('_pkg_apk/build_apk.py', r'android:versionCode="(?P<v>\d+)"', 'APK versionCode')


def vcode(ver):
    m = re.match(r'^(\d+)\.(\d+)\.(\d+)$', ver)
    if not m:
        sys.exit('版本号必须是 主.次.修 三段数字，例如 1.12.0，收到：%s' % ver)
    a, b, c = (int(x) for x in m.groups())
    if b > 99 or c > 99:
        sys.exit('次版本与修订号都要 ≤ 99，否则 versionCode 会串位')
    return a * 10000 + b * 100 + c


def read(p):
    return io.open(os.path.join(ROOT, p), encoding='utf-8').read()


def write(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)


def scan():
    """返回 [(路径, 说明, 版本)]，找不到的记 None。"""
    rows = []
    for p, pat, what in TARGETS + [APK, APK_CODE]:
        s = read(p)
        m = re.search(pat, s)
        rows.append((p, what, m.group('v') if m else None))
    return rows


def check(quiet=False):
    rows = scan()
    # versionCode 是整数序号，不参与「版本名是否一致」的比较
    vers = sorted({v for _p, w, v in rows if v and 'versionCode' not in w})
    codes = [v for p, w, v in rows if 'versionCode' in w and v]
    ok = True
    if len(vers) != 1:
        ok = False
        if not quiet:
            print('✗ 版本号不一致：%s' % ', '.join(vers))
    if codes:
        want = str(vcode(vers[0])) if len(vers) == 1 else '?'
        if codes[0] != want:
            ok = False
            if not quiet:
                print('✗ versionCode=%s，按 %s 应为 %s' % (codes[0], vers[0], want))
    if not ok:
        if not quiet:
            for p, w, v in rows:
                print('    %-30s %-22s %s' % (p, w, v or '（没找到）'))
        return False
    if not quiet:
        print('✓ 全部一致：%s（versionCode %s）' % (vers[0], codes[0] if codes else '-'))
        for p, w, v in rows:
            print('    %-30s %-22s %s' % (p, w, v or '（没找到）'))
    return True


def bump(new, dry=False):
    cur = scan()
    vers = sorted({v for _p, w, v in cur if v and 'versionCode' not in w})
    if len(vers) != 1:
        sys.exit('改之前版本号就已经不一致（%s），先修好再升' % ', '.join(vers))
    old = vers[0]
    if vcode(new) <= vcode(old):
        sys.exit('新版本 %s 不比 %s 高（versionCode %d ≤ %d）。版本号只能往上走。'
                 % (new, old, vcode(new), vcode(old)))

    changed = []
    for p, pat, what in TARGETS + [APK]:
        s = read(p)
        s2, n = re.subn(pat, lambda m: m.group(0).replace(m.group('v'), new), s)
        if n != 1:
            sys.exit('%s 里匹配到 %d 处 %s，预期 1 处，先人工看一眼' % (p, n, what))
        if not dry:
            write(p, s2)
        changed.append((p, what, old, new))

    # versionCode 单独处理：整数字段，不能按版本名替换
    p, pat, what = APK_CODE
    s = read(p)
    m = re.search(pat, s)
    if not m:
        sys.exit('找不到 versionCode')
    s2 = s[:m.start('v')] + str(vcode(new)) + s[m.end('v'):]
    if not dry:
        write(p, s2)
    changed.append((p, 'APK versionCode', m.group('v'), str(vcode(new))))

    print('%s %s → %s' % ('演练' if dry else '已改', old, new))
    for p, what, a, b in changed:
        print('    %-30s %-22s %s → %s' % (p, what, a, b))
    print()
    print('接下来还要手动做三件事（脚本不替你写文案）：')
    print('  1) app.js 的 DOCS.about 里加一段「%s 改了什么」，写清这一版到底改了什么；' % new)
    print('  2) README.md 的版本与体积表按实际产物更新；')
    print('  3) 发版前跑 python _bump.py --check，绿了再打安装包。')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    if '--check' in flags:
        sys.exit(0 if check() else 1)
    if not args:
        check()
        return
    bump(args[0], dry='--dry' in flags)
    check()


if __name__ == '__main__':
    main()
