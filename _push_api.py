# -*- coding: utf-8 -*-
"""通过 GitHub Git Data API 推送（绕过 git push 的代理 502 问题）。
用法: python _push_api.py <owner/repo> <branch> <token> <commit-message>
以当前工作区 HEAD 提交为源，把 HEAD 树的全部文件与远端树做 diff，只上传变化的 blob。
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request

REPO = sys.argv[1]
BRANCH = sys.argv[2]
TOKEN = sys.argv[3]
MSG = sys.argv[4]

API = 'https://api.github.com'
HERE = os.path.dirname(os.path.abspath(__file__))


def gh(method, path, body=None):
    url = path if path.startswith('http') else API + path
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'token ' + TOKEN)
    req.add_header('Accept', 'application/vnd.github+json')
    req.add_header('User-Agent', 'moyin-push')
    if data:
        req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode('utf-8')
    return json.loads(raw) if raw.strip() else {}


def git(*args):
    env = dict(os.environ)
    env['MSYS_NO_PATHCONV'] = '1'
    out = subprocess.run(['git'] + list(args), cwd=HERE, capture_output=True, env=env)
    if out.returncode != 0:
        raise SystemExit('git %s 失败: %s' % (' '.join(args), out.stderr.decode('utf-8', 'replace')))
    return out.stdout.decode('utf-8', 'replace').strip()


# 1. 本地 HEAD 树
local_tree = git('rev-parse', 'HEAD^{tree}')
local_files = {}
for line in git('ls-tree', '-r', '-z', '--full-tree', 'HEAD').split('\0'):
    if not line.strip():
        continue
    meta, path = line.split('\t', 1)
    mode, typ, sha = meta.split()
    if typ != 'blob':
        continue
    local_files[path] = (mode, sha)

# 2. 远端当前树
try:
    ref = gh('GET', '/repos/%s/git/ref/heads/%s' % (REPO, BRANCH))
    remote_commit = ref['object']['sha']
except urllib.error.HTTPError as e:
    if e.code != 404:
        raise
    remote_commit = None

remote_files = {}
remote_tree = None
if remote_commit:
    rc = gh('GET', '/repos/%s/git/commits/%s' % (REPO, remote_commit))
    remote_tree = rc['tree']['sha']
    entries = gh('GET', '/repos/%s/git/trees/%s?recursive=1' % (REPO, remote_tree))['tree']
    for it in entries:
        if it['type'] == 'blob':
            remote_files[it['path']] = (it['mode'], it['sha'])

changed = [p for p in local_files if remote_files.get(p, (None, None))[1] != local_files[p][1]]
deleted = [p for p in remote_files if p not in local_files]
print('本地 %d 个文件 / 远端 %d 个；需上传 %d，需删除 %d' % (len(local_files), len(remote_files), len(changed), len(deleted)))

if not changed and not deleted:
    print('远端已是最新，无需推送')
    sys.exit(0)

# 3. 上传 blob
tree_entries = []
for i, p in enumerate(sorted(changed), 1):
    full = os.path.join(HERE, p)
    with open(full, 'rb') as f:
        content = f.read()
    blob = gh('POST', '/repos/%s/git/blobs' % REPO, {
        'content': base64.b64encode(content).decode('ascii'),
        'encoding': 'base64',
    })
    mode = local_files[p][0]
    tree_entries.append({'path': p, 'mode': mode, 'type': 'blob', 'sha': blob['sha']})
    print('  [%d/%d] %s (%.1f KB)' % (i, len(changed), p, len(content) / 1024.0))

for p in deleted:
    tree_entries.append({'path': p, 'mode': '100644', 'type': 'blob', 'sha': None})

# 4. 新树
new_tree = gh('POST', '/repos/%s/git/trees' % REPO, {
    'base_tree': remote_tree,
    'tree': tree_entries,
})

# 5. 新提交
commit_body = {'message': MSG, 'tree': new_tree['sha']}
if remote_commit:
    commit_body['parents'] = [remote_commit]
new_commit = gh('POST', '/repos/%s/git/commits' % REPO, commit_body)
print('新提交 %s' % new_commit['sha'])

# 6. 移动分支
if remote_commit:
    gh('PATCH', '/repos/%s/git/refs/heads/%s' % (REPO, BRANCH), {'sha': new_commit['sha'], 'force': True})
else:
    gh('POST', '/repos/%s/git/refs' % REPO, {'ref': 'refs/heads/' + BRANCH, 'sha': new_commit['sha']})
print('分支 %s 已指向 %s' % (BRANCH, new_commit['sha'][:10]))
print('PUSH_OK')
