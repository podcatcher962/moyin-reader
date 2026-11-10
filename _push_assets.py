# -*- coding: utf-8 -*-
"""把本地产物传成 GitHub Release 资产（走 uploads.github.com，专收大二进制）。

为什么不用 api.github.com 的 contents 端点：它对 >7 MB 的请求体一律回
``401 Bad credentials``（body 完整发完才拒，实测边界在 5 MB 成 / 20 MB 挂），
40 MB 的 APK 必然失败。``uploads.github.com`` 是另一套后端，走流式，
实测 40,683,120 字节 122 秒传完，一分不差。

用法
----
    python _push_assets.py --tag v1.11.0 --list           # 只看会传什么
    python _push_assets.py --tag v1.11.0 MoYinReader.exe dist/*.deb
    python _push_assets.py --tag v1.11.0 --all            # 传当前版本全套

已存在且字节数一致的资产会自动跳过，所以重复跑是安全的。
"""
import argparse
import json
import os
import subprocess
import sys
import time

REPO = 'podcatcher962/moyin-reader'
TOKEN_FILE = r'D:\Desktop\send-to-mainpc\podcatcher962-token.txt'
API = 'https://api.github.com'
VER = '1.14.12'

# --all 时传的全套（改版本号时一起改）
ALL = [
    'MoYinReader.exe',
    'MoYinReader_Lite.exe',
    'MoYinReader.html',
    'docs/download/MoYinReader.apk',
    'dist/moyin-reader_%s_amd64.deb' % VER,
    'dist/MoYinReader-Linux-%s.tar.gz' % VER,
    'dist/MoYinReader-macOS-%s.zip' % VER,
]


def token():
    # 优先读环境变量，方便别人或 CI 用自己的 token；没有才退回本机文件
    t = (os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN') or '').strip()
    if t:
        return t
    return open(TOKEN_FILE, encoding='utf-8').read().strip()


def curl(args, timeout=900):
    cmd = ['curl', '-s', '-m', str(timeout), '-H', 'Authorization: Bearer ' + token(),
           '-H', 'Accept: application/vnd.github+json',
           '-H', 'User-Agent: release-hub', '-H', 'Expect:', '-w', '\n%{http_code}'] + args
    out = subprocess.run(cmd, capture_output=True).stdout.decode('utf-8', 'replace')
    body, _, code = out.rpartition('\n')
    return code.strip(), body


def ctype(name):
    low = name.lower()
    if low.endswith('.apk'):
        return 'application/vnd.android.package-archive'
    if low.endswith('.exe'):
        return 'application/vnd.microsoft.portable-executable'
    if low.endswith('.html'):
        return 'text/html; charset=utf-8'
    if low.endswith('.deb'):
        return 'application/vnd.debian.binary-package'
    if low.endswith('.zip'):
        return 'application/zip'
    if low.endswith('.gz'):
        return 'application/gzip'
    return 'application/octet-stream'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tag', default='v' + VER)
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('files', nargs='*')
    args = ap.parse_args()

    files = list(args.files) or (ALL if args.all else [])
    if not files:
        ap.error('要么给文件，要么加 --all')

    todo = []
    for f in files:
        if not os.path.isfile(f):
            print('✗ 本地没有：%s' % f)
            continue
        todo.append((f, os.path.basename(f), os.path.getsize(f)))
    if not todo:
        return 1

    print('仓库 %s  tag %s\n共 %d 个文件 / %.1f MB\n'
          % (REPO, args.tag, len(todo), sum(t[2] for t in todo) / 1048576))
    for f, n, s in todo:
        print('   %-32s %9.1f MB' % (n, s / 1048576))
    if args.list:
        print('\n--list，未上传')
        return 0

    code, body = curl([API + '/repos/%s/releases/tags/%s' % (REPO, args.tag)], 60)
    if code != '200':
        print('取 Release 失败 HTTP %s：%s' % (code, body[:200]))
        return 1
    rel = json.loads(body)
    up = rel['upload_url'].split('{')[0]
    existing = {a['name']: a for a in rel.get('assets', [])}
    print('\nRelease id=%s，已有 %d 个资产\n' % (rel['id'], len(existing)))

    ok = fail = skip = 0
    for path, name, size in todo:
        old = existing.get(name)
        if old and old['size'] == size:
            print('= 跳过（大小一致）%s' % name)
            skip += 1
            continue
        if old:
            c, _b = curl(['-X', 'DELETE', API + '/repos/%s/releases/assets/%d' % (REPO, old['id'])], 120)
            print('  删旧资产 %s -> %s' % (name, c))
        print('↑ 上传 %s（%.1f MB）…' % (name, size / 1048576), end='', flush=True)
        t = time.time()
        c, b = curl(['-X', 'POST', '-H', 'Content-Type: ' + ctype(name),
                     '--data-binary', '@' + path, up + '?name=' + name], 1800)
        dt = time.time() - t
        if c in ('200', '201'):
            d = json.loads(b)
            sp = d['size'] / dt / 1048576 if dt else 0
            print(' ok %d B / %.0fs / %.1f MB/s' % (d['size'], dt, sp))
            ok += 1
        else:
            print(' 失败 %s %s' % (c, b[:180]))
            fail += 1

    print('\n完成：成功 %d / 跳过 %d / 失败 %d' % (ok, skip, fail))
    if not fail:
        print('https://github.com/%s/releases/tag/%s' % (REPO, args.tag))
    return 0 if not fail else 1


if __name__ == '__main__':
    sys.exit(main())
