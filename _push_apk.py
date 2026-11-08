# -*- coding: utf-8 -*-
"""单独重试上传大文件（APK 38.8 MB）。

api.github.com 对超大 form body 的处理不稳定：实测 5 MB 必成、20 MB 必 401，
而此前也曾成功推过 39 MB，说明瓶颈是上传吞吐 / 网关时序而不是硬上限。
所以这里用 Contents API（一次请求 = 一个提交，最省往返）反复重试，
每次重新读远端文件 sha，天然处理中途被别人改动的情况。

用法：python _push_apk.py [文件相对路径] [尝试次数]
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time

REPO = 'podcatcher962/moyin-reader'
TOKEN_FILE = r'D:\Desktop\send-to-mainpc\podcatcher962-token.txt'
API = 'https://api.github.com'
BRANCH = 'main'


def token():
    return open(TOKEN_FILE, encoding='utf-8').read().strip()


def call(method, path, payload=None, timeout=900):
    cmd = ['curl', '-s', '-m', str(timeout), '-X', method,
           '-H', 'Authorization: Bearer ' + token(),
           '-H', 'Accept: application/vnd.github+json',
           '-H', 'User-Agent: moyin-api',
           '-H', 'Expect:',
           '-w', '\n%{http_code}']
    tmp = None
    if payload is not None:
        tmp = os.path.join(os.environ.get('TEMP', '.'), '_gh_apk.json')
        with open(tmp, 'w') as f:
            json.dump(payload, f)
        cmd += ['-H', 'Content-Type: application/json',
                '--data-binary', '@' + tmp]
    cmd.append(API + path)
    try:
        out = subprocess.run(cmd, capture_output=True).stdout.decode('utf-8', 'replace')
    finally:
        if tmp and os.path.isfile(tmp):
            os.remove(tmp)
    body, _, code = out.rpartition('\n')
    return code.strip(), body


def blob_sha(path):
    data = open(path, 'rb').read()
    h = hashlib.sha1(b'blob %d\0' % len(data))
    h.update(data)
    return h.hexdigest()


def main():
    rel = sys.argv[1] if len(sys.argv) > 1 else 'docs/download/MoYinReader.apk'
    tries = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    if not os.path.isfile(rel):
        print('文件不存在:', rel)
        return 1
    want = blob_sha(rel)
    size_mb = os.path.getsize(rel) / 1048576.0
    print('本地 %s  %.1f MB  blob %s' % (rel, size_mb, want[:12]), flush=True)

    for n in range(1, tries + 1):
        code, body = call('GET', '/repos/%s/contents/%s?ref=%s' % (REPO, rel, BRANCH), timeout=120)
        cur = None
        if code == '200':
            cur = json.loads(body).get('sha')
        elif code != '404':
            print('  第%d次：读远端失败 %s %s' % (n, code, body[:120]), flush=True)
            time.sleep(5)
            continue
        if cur == want:
            print('远端已是同一份（%s），不用再传' % want[:12])
            return 0

        payload = {'message': '安卓包更新：修 healthJson 引号，声线表恢复完整 174 条',
                   'content': base64.b64encode(open(rel, 'rb').read()).decode(),
                   'branch': BRANCH}
        if cur:
            payload['sha'] = cur
        t = time.time()
        code, body = call('PUT', '/repos/%s/contents/%s' % (REPO, rel), payload)
        dt = time.time() - t
        if code in ('200', '201'):
            c = json.loads(body).get('commit', {}).get('sha', '')[:8]
            print('  第%d次：成功，%.0f 秒，提交 %s' % (n, dt, c), flush=True)
            return 0
        print('  第%d次：%s %.0f 秒  %s' % (n, code, dt, body[:110].replace('\n', ' ')), flush=True)
        if code == '409':
            print('  （远端被别人改动，下一轮重读 sha）', flush=True)
        time.sleep(3)
    print('重试 %d 次仍未通过，等网络好一点再跑本脚本即可，命令不变' % tries)
    return 1


if __name__ == '__main__':
    sys.exit(main())
