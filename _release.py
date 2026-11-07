# -*- coding: utf-8 -*-
"""创建/更新 GitHub Release 并上传资产（走 api.github.com + uploads.github.com）。"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse

REPO = sys.argv[1]
TAG = sys.argv[2]
TOKEN = sys.argv[3]
BODY_FILE = sys.argv[4]
ASSETS = sys.argv[5:]

API = 'https://api.github.com'


def gh(method, path, body=None, raw=False, ctype='application/json'):
    url = path if path.startswith('http') else API + path
    data = None
    if body is not None:
        data = body if raw else json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'token ' + TOKEN)
    req.add_header('Accept', 'application/vnd.github+json')
    req.add_header('User-Agent', 'moyin-release')
    if data:
        req.add_header('Content-Type', ctype)
    with urllib.request.urlopen(req, timeout=300) as r:
        txt = r.read().decode('utf-8')
    return json.loads(txt) if txt.strip() else {}


body = open(BODY_FILE, encoding='utf-8').read()

# 找已有 release
try:
    rel = gh('GET', '/repos/%s/releases/tags/%s' % (REPO, TAG))
    print('Release %s 已存在，id=%s' % (TAG, rel['id']))
except urllib.error.HTTPError as e:
    if e.code != 404:
        raise
    rel = None

if rel is None:
    head = gh('GET', '/repos/%s/git/ref/heads/main' % REPO)['object']['sha']
    try:
        gh('POST', '/repos/%s/git/refs' % REPO, {'ref': 'refs/tags/' + TAG, 'sha': head})
        print('已建 tag %s -> %s' % (TAG, head[:10]))
    except urllib.error.HTTPError as e:
        print('建 tag 失败（可能已存在）: %s' % e)
    rel = gh('POST', '/repos/%s/releases' % REPO, {
        'tag_name': TAG,
        'name': 'v1.9.5 — 十种字体 / 十六色板 / 人多自动扩容',
        'body': body,
        'draft': False,
        'prerelease': False,
    })
    print('已建 Release id=%s' % rel['id'])
else:
    rel = gh('PATCH', '/repos/%s/releases/%s' % (REPO, rel['id']), {'body': body, 'name': 'v1.9.5 — 十种字体 / 十六色板 / 人多自动扩容'})
    print('已更新 Release 说明')

existing = {a['name']: a for a in rel.get('assets', [])}

for path in ASSETS:
    name = os.path.basename(path)
    size = os.path.getsize(path)
    old = existing.get(name)
    if old and old['size'] == size:
        print('跳过（大小一致）%s %d B' % (name, size))
        continue
    if old:
        gh('DELETE', '/repos/%s/releases/assets/%s' % (REPO, old['id']))
        print('已删旧资产 %s' % name)
    upload_url = 'https://uploads.github.com/repos/%s/releases/%s/assets?name=%s' % (REPO, rel['id'], urllib.parse.quote(name))
    with open(path, 'rb') as f:
        blob = f.read()
    for attempt in range(1, 5):
        try:
            res = gh('POST', upload_url, blob, raw=True,
                     ctype='application/vnd.android.package-archive' if name.endswith('.apk') else ('text/html; charset=utf-8' if name.endswith('.html') else 'application/octet-stream'))
            print('上传完成 %s (%.1f MB)' % (name, size / 1048576.0))
            break
        except Exception as e:
            print('  第 %d 次上传 %s 失败: %s' % (attempt, name, e))
            if attempt == 4:
                raise
            time.sleep(6)

print('RELEASE_OK https://github.com/%s/releases/tag/%s' % (REPO, TAG))
