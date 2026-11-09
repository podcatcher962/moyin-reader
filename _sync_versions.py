# -*- coding: utf-8 -*-
"""把墨吟这一条更新进 podcatcher962.github.io 的 versions.json。

只改 id=moyin-reader 的条目，其它 35 个工具原样保留；stats 按全量重算。
默认只打印将要写的内容，加 --apply 才真的提交。

用法：
    python _sync_versions.py                 # 预演
    python _sync_versions.py --apply         # 写回远端
    python _sync_versions.py --apply --no-pages
                                             # APK 还没推到 git 时用：不给 apk 加 pages 镜像
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time

REPO = 'podcatcher962/moyin-reader'
SITE = 'podcatcher962/podcatcher962.github.io'
TOKEN_FILE = r'D:\Desktop\send-to-mainpc\podcatcher962-token.txt'
API = 'https://api.github.com'
VER = '1.14.11'
TAG = 'v' + VER
HERE = os.path.dirname(os.path.abspath(__file__))

# 顺序即客户端尝试顺序：先国内镜像，最后官方原始地址
MIRRORS = [
    ('ghproxy', 'https://gh-proxy.com/https://github.com/%s/releases/download/%s/%s'),
    ('ghfast', 'https://ghfast.top/https://github.com/%s/releases/download/%s/%s'),
    ('ghnet', 'https://ghproxy.net/https://github.com/%s/releases/download/%s/%s'),
    ('release', 'https://github.com/%s/releases/download/%s/%s'),
]
PAGES_APK = 'https://podcatcher962.github.io/moyin-reader/download/MoYinReader.apk'

BUILDS = [
    ('dist/moyin-reader_%s_amd64.deb' % VER, 'linux', 'amd64'),
    ('dist/MoYinReader-Linux-%s.tar.gz' % VER, 'linux', 'x64'),
    ('dist/MoYinReader-macOS-%s.zip' % VER, 'macos', 'universal'),
    ('docs/download/MoYinReader.apk', 'android', 'universal'),
    ('MoYinReader.exe', 'windows', 'x64'),
    ('MoYinReader.html', 'web', None),
    ('MoYinReader_Lite.exe', 'windows', 'x64'),
]


def token():
    t = (os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN') or '').strip()
    if t:
        return t
    return open(TOKEN_FILE, encoding='utf-8').read().strip()


def curl(args, timeout=120):
    cmd = ['curl', '-s', '-m', str(timeout),
           '-H', 'Authorization: token ' + token(),
           '-H', 'Accept: application/vnd.github+json',
           '-H', 'User-Agent: moyin-versions',
           '-H', 'Expect:',
           '-w', '\n%{http_code}'] + args
    out = subprocess.run(cmd, capture_output=True).stdout.decode('utf-8', 'replace')
    body, _, code = out.rpartition('\n')
    return code.strip(), body


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def build_entry(path, os_name, arch, with_pages):
    if not os.path.isfile(path):
        raise SystemExit('缺文件: ' + path)
    name = os.path.basename(path)
    urls = []
    if with_pages and name == 'MoYinReader.apk':
        urls.append({'m': 'pages', 'u': PAGES_APK})
    for m, tpl in MIRRORS:
        urls.append({'m': m, 'u': tpl % (REPO, TAG, name)})
    e = {'file': name, 'os': os_name, 'arch': arch,
         'size': os.path.getsize(path), 'sha256': sha256_of(path), 'urls': urls}
    return e


def main():
    apply = '--apply' in sys.argv
    with_pages = '--no-pages' not in sys.argv

    code, body = curl([API + '/repos/%s/contents/versions.json' % SITE])
    if code != '200':
        print('取 versions.json 失败', code, body[:200])
        return 1
    d = json.loads(body)
    blob_sha, file_sha = d['sha'], d['sha']
    vj = json.loads(base64.b64decode(d['content']).decode('utf-8'))
    print('拿到底稿：sha %s，工具 %d 个' % (blob_sha[:8], len(vj['tools'])))

    idx = [i for i, t in enumerate(vj['tools']) if t.get('id') == 'moyin-reader']
    if not idx:
        print('底稿里没有 moyin-reader 这一条')
        return 1
    old = vj['tools'][idx[0]]
    print('原来：%s / %s / %d 个 build' % (old['version'], old['tag'], len(old['builds'])))

    entries = [build_entry(p, o, a, with_pages) for p, o, a in BUILDS]
    for e in entries:
        print('   %-46s %-9s %-10s %10d' % (e['file'], e['os'], e['arch'], e['size']))

    new = dict(old)
    new['version'] = VER
    new['tag'] = TAG
    new['released'] = time.strftime('%Y-%m-%d')
    new['blurb'] = '全离线 TXT/EPUB 阅读 + 分角色多声线听书'
    new['builds'] = entries

    total_builds = sum(len(t.get('builds') or []) for t in vj['tools'])
    total_bytes = sum(b.get('size') or 0 for t in vj['tools'] for b in (t.get('builds') or []))
    # 先扣掉旧条目再累加新的，避免重复计数
    total_bytes -= sum(b.get('size') or 0 for b in old.get('builds') or [])
    total_bytes += sum(e['size'] for e in entries)

    vj['tools'][idx[0]] = new
    vj['updated'] = time.strftime('%Y-%m-%dT%H:%M:%S+08:00')
    vj['stats'] = {'tools': len(vj['tools']), 'builds': total_builds, 'bytes': total_bytes}
    print('stats ->', vj['stats'])

    txt = json.dumps(vj, ensure_ascii=False, indent=1) + '\n'
    print('新文件 %d 字节（原 %d）' % (len(txt.encode()), d['size']))

    if not apply:
        print('预演模式，没写回。加 --apply 才提交。')
        return 0

    payload = {'message': 'versions.json: 墨吟阅读器 %s' % VER,
               'content': base64.b64encode(txt.encode()).decode(),
               'sha': file_sha, 'branch': 'main'}
    tmp = os.path.join(os.environ.get('TEMP', '.'), '_vj_put.json')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    try:
        code, body = curl(['-X', 'PUT', '-H', 'Content-Type: application/json',
                           '--data-binary', '@' + tmp,
                           API + '/repos/%s/contents/versions.json' % SITE], 300)
    finally:
        if os.path.isfile(tmp):
            os.remove(tmp)
    if code not in ('200', '201'):
        print('写回失败', code, body[:300])
        return 1
    r = json.loads(body)
    print('已提交 %s' % r['commit']['sha'][:8])
    print('新 sha %s' % r['content']['sha'][:8])
    return 0


if __name__ == '__main__':
    sys.exit(main())
