# -*- coding: utf-8 -*-
"""把大文件传成 GitHub Release 资产。

api.github.com 的 blob/contents 端点今天对 >7 MB 的 form body 一律回 401
（body 完整发完才拒），而 uploads.github.com 是另一套后端、专收二进制，
所以这条路用于给 38.8 MB 的 APK 兜底。

只在 --apply 时真的建 Release；默认只探测上传是否可行。
"""
import json
import os
import subprocess
import sys
import time

REPO = 'podcatcher962/moyin-reader'
TOKEN_FILE = r'D:\Desktop\send-to-mainpc\podcatcher962-token.txt'
API = 'https://api.github.com'


def token():
    return open(TOKEN_FILE, encoding='utf-8').read().strip()


def curl(args, timeout=900):
    cmd = ['curl', '-s', '-m', str(timeout), '-H', 'Authorization: Bearer ' + token(),
           '-H', 'Accept: application/vnd.github+json',
           '-H', 'User-Agent: moyin-api', '-H', 'Expect:', '-w', '\n%{http_code}'] + args
    out = subprocess.run(cmd, capture_output=True).stdout.decode('utf-8', 'replace')
    body, _, code = out.rpartition('\n')
    return code.strip(), body


def main():
    apply = '--apply' in sys.argv
    tag = 'v1.12.0'
    apk = 'docs/download/MoYinReader.apk'
    if not os.path.isfile(apk):
        print('找不到', apk)
        return 1

    code, body = curl([API + '/repos/%s/releases/tags/%s' % (REPO, tag)], 60)
    rel = None
    if code == '200':
        rel = json.loads(body)
        print('已有 Release', tag, 'id=%s draft=%s' % (rel['id'], rel['draft']))
    else:
        print('还没有 Release', tag, '（%s）' % code)

    if not apply:
        print('探测模式：不建 Release。加 --apply 才真做。')
        return 0

    if rel is None:
        payload = {'tag_name': tag, 'name': '墨吟阅读器 1.12.0',
                   'body': ('手机端也能跑 174 个离线神经声线。\n\n'
                            '* 安卓包内置 sherpa-onnx 与 AISHELL3 模型，断网也能听\n'
                            '* 手机顶栏收进「⋯」，按键 44px；首启按屏宽给 18px/1.9\n'
                            '* 返回键逐层退：弹窗 → 批量选择 → 侧栏 → 书架\n'
                            '* 听书时屏幕常亮\n'),
                   'draft': False, 'prerelease': False}
        tmp = os.path.join(os.environ['TEMP'], '_rel.json')
        with open(tmp, 'w') as f:
            json.dump(payload, f)
        code, body = curl(['-X', 'POST', '-H', 'Content-Type: application/json',
                           '--data-binary', '@' + tmp, API + '/repos/%s/releases' % REPO], 120)
        os.remove(tmp)
        if code not in ('200', '201'):
            print('建 Release 失败', code, body[:200])
            return 1
        rel = json.loads(body)
        print('已建 Release', tag, 'id=%s' % rel['id'])

    up = rel['upload_url'].split('{')[0]
    name = os.path.basename(apk)
    for a in rel.get('assets', []):
        if a['name'] == name:
            print('资产已存在:', name, a['size'], '字节；先删旧的')
            code, body = curl(['-X', 'DELETE', API + '/repos/%s/releases/assets/%d' % (REPO, a['id'])], 120)
            print('  删除 ->', code)

    t = time.time()
    code, body = curl(['-X', 'POST', '-H', 'Content-Type: application/vnd.android.package-archive',
                       '--data-binary', '@' + apk,
                       up + '?name=' + name], 900)
    print('上传资产 -> %s  %.0f 秒  %s' % (code, time.time() - t, body[:200]), flush=True)
    if code in ('200', '201'):
        d = json.loads(body)
        print('大小', d['size'], '字节')
        print('浏览器下载', d['browser_download_url'])
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main())
