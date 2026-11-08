# -*- coding: utf-8 -*-
"""建一个 Release（tag + 标题 + 说明），不含资产上传。

资产上传交给 _push_assets.py（走 uploads.github.com）。
本脚本只做一件事：确保 tag vX.Y.Z 的 Release 存在且说明是最新的。

用法：
    python _mk_release.py            # 用 VERSIONING.md 里的当前版本
    python _mk_release.py 1.12.0 "标题" notes.md
"""
import json
import os
import subprocess
import sys

REPO = 'podcatcher962/moyin-reader'
TOKEN_FILE = r'D:\Desktop\send-to-mainpc\podcatcher962-token.txt'
API = 'https://api.github.com'


def curl(args, timeout=120):
    tok = open(TOKEN_FILE, encoding='utf-8').read().strip()
    cmd = ['curl', '-s', '-m', str(timeout),
           '-H', 'Authorization: Bearer ' + tok,
           '-H', 'Accept: application/vnd.github+json',
           '-H', 'User-Agent: mk-release',
           '-w', '\n%{http_code}'] + args
    out = subprocess.run(cmd, capture_output=True).stdout.decode('utf-8', 'replace')
    body, _, code = out.rpartition('\n')
    return code.strip(), body


def cur_ver():
    txt = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.js'),
               encoding='utf-8').read()
    for line in txt.splitlines():
        if "var VER = '" in line:
            return line.split("'")[1]
    raise SystemExit('app.js 里找不到 VER')


def main():
    ver = sys.argv[1] if len(sys.argv) > 1 else cur_ver()
    tag = 'v' + ver
    title = sys.argv[2] if len(sys.argv) > 2 else '墨吟阅读器 ' + ver
    if len(sys.argv) > 3:
        body = open(sys.argv[3], encoding='utf-8').read().strip()
    else:
        body = '占位：用 _push_assets.py 传完资产后重跑本脚本补说明'

    code, b = curl([API + '/repos/%s/releases/tags/%s' % (REPO, tag)], 60)
    if code == '200':
        d = json.loads(b)
        print('Release 已存在 id=%s，%d 个资产，更新说明' % (d['id'], len(d.get('assets', []))))
        payload = {'name': title, 'body': body}
        code, b = curl(['-X', 'PATCH', '-H', 'Content-Type: application/json',
                        '--data-binary', json.dumps(payload, ensure_ascii=False),
                        API + '/repos/%s/releases/%s' % (REPO, d['id'])])
        if code != '200':
            print('更新失败 %s %s' % (code, b[:200]))
            return 1
        print('OK https://github.com/%s/releases/tag/%s' % (REPO, tag))
        return 0

    payload = {'tag_name': tag, 'target_commitish': 'main',
               'name': title, 'body': body,
               'draft': False, 'prerelease': False}
    tmp = os.path.join(os.environ.get('TEMP', '.'), '_rel_body.json')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    code, b = curl(['-X', 'POST', '-H', 'Content-Type: application/json',
                    '--data-binary', '@' + tmp,
                    API + '/repos/%s/releases' % REPO])
    os.remove(tmp)
    if code not in ('200', '201'):
        print('建 Release 失败 %s %s' % (code, b[:300]))
        return 1
    d = json.loads(b)
    print('建好 Release id=%s  tag=%s  目标 main' % (d['id'], d['tag_name']))
    print('https://github.com/%s/releases/tag/%s' % (REPO, tag))
    return 0


if __name__ == '__main__':
    sys.exit(main())
