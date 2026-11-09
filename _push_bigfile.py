# -*- coding: utf-8 -*-
"""把单个大文件（70 MB 的 APK）推进仓库，走 Git Data API 的 blob 端点。

Git Data API 的 blob 单请求体上限比较宽，够放 70 MB 原文件（base64 后约 93 MB）；
若网关截断会回 4xx/5xx，这里只做一次尝试并原样打印状态码，不重试刷日志。

用法：python _push_bigfile.py docs/download/MoYinReader.apk
"""
import base64
import json
import os
import subprocess
import sys
import time

REPO = 'podcatcher962/moyin-reader'
TOKEN_FILE = r'D:\Desktop\send-to-mainpc\podcatcher962-token.txt'
API = 'https://api.github.com'
HERE = os.path.dirname(os.path.abspath(__file__))


def token():
    t = (os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN') or '').strip()
    if t:
        return t
    return open(TOKEN_FILE, encoding='utf-8').read().strip()


def curl(args, timeout=1200):
    cmd = ['curl', '-s', '-m', str(timeout),
           '-H', 'Authorization: token ' + token(),
           '-H', 'Accept: application/vnd.github+json',
           '-H', 'User-Agent: moyin-big',
           '-H', 'Expect:',
           '-w', '\n%{http_code}'] + args
    out = subprocess.run(cmd, capture_output=True).stdout.decode('utf-8', 'replace')
    body, _, code = out.rpartition('\n')
    return code.strip(), body


def main():
    rel = sys.argv[1] if len(sys.argv) > 1 else 'docs/download/MoYinReader.apk'
    path = os.path.join(HERE, rel)
    size = os.path.getsize(path)
    print('文件 %s  %.1f MB' % (rel, size / 1048576), flush=True)

    code, body = curl([API + '/repos/%s/git/ref/heads/main' % REPO], 60)
    if code != '200':
        print('取 ref 失败', code, body[:200])
        return 1
    head = json.loads(body)['object']['sha']
    code, body = curl([API + '/repos/%s/git/commits/%s' % (REPO, head)], 60)
    base_tree = json.loads(body)['tree']['sha']
    print('父提交 %s  树 %s' % (head[:8], base_tree[:8]), flush=True)

    print('上传 blob…（base64 后约 %.0f MB，预计几分钟）' % (size * 4 / 3 / 1048576), flush=True)
    payload = {'content': base64.b64encode(open(path, 'rb').read()).decode(), 'encoding': 'base64'}
    tmp = os.path.join(os.environ.get('TEMP', '.'), '_big_blob.json')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(payload, f)
    payload = None
    t0 = time.time()
    try:
        code, body = curl(['-X', 'POST', '-H', 'Content-Type: application/json',
                           '--data-binary', '@' + tmp, API + '/repos/%s/git/blobs' % REPO], 1200)
    finally:
        if os.path.isfile(tmp):
            os.remove(tmp)
    print('blob -> %s  %.0f 秒' % (code, time.time() - t0), flush=True)
    if code != '201':
        print(body[:300])
        return 1
    sha = json.loads(body)['sha']
    print('blob sha', sha[:8], flush=True)

    code, body = curl(['-X', 'POST', '-H', 'Content-Type: application/json',
                       '-d', json.dumps({'base_tree': base_tree,
                                         'tree': [{'path': rel, 'mode': '100644',
                                                   'type': 'blob', 'sha': sha}]}),
                       API + '/repos/%s/git/trees' % REPO], 120)
    if code != '201':
        print('建树失败', code, body[:200])
        return 1
    tree = json.loads(body)['sha']

    msg = '发布页的安卓包更新到 1.14.11'
    code, body = curl(['-X', 'POST', '-H', 'Content-Type: application/json',
                       '-d', json.dumps({'message': msg, 'tree': tree, 'parents': [head]}),
                       API + '/repos/%s/git/commits' % REPO], 120)
    if code != '201':
        print('建提交失败', code, body[:200])
        return 1
    commit = json.loads(body)['sha']

    code, body = curl(['-X', 'PATCH', '-H', 'Content-Type: application/json',
                       '-d', json.dumps({'sha': commit}), API + '/repos/%s/git/refs/heads/main' % REPO], 120)
    if code not in ('200', '201'):
        print('更新 ref 失败', code, body[:200])
        return 1
    print('已更新 main ->', commit[:8])
    subprocess.run(['git', 'fetch', '--quiet', 'origin', 'main'], cwd=HERE)
    return 0


if __name__ == '__main__':
    sys.exit(main())
