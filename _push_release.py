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
    # 优先读环境变量，方便别人或 CI 用自己的 token；没有才退回本机文件
    t = (os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN') or '').strip()
    if t:
        return t
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
    tag = 'v1.14.21'
    apk = 'MoYinReader.apk'
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
        # Release 页面是给用户看的：优先用 _release_body.md（用户向说明），
        # _notes_*.md 是内部技术笔记，含函数名与调试细节，不适合直接贴出去。
        body_file = '_release_body.md'
        notes = os.path.join(os.path.dirname(os.path.abspath(__file__)), body_file)
        body_txt = (open(notes, encoding='utf-8').read() if os.path.isfile(notes)
                    else '语音系统升级：男女主角各一份 22.05 kHz 模型，配角库 16 kHz / 187 人。\n')
        payload = {'tag_name': tag, 'name': '墨吟阅读器 1.14.21',
                   'body': body_txt,
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
