# -*- coding: utf-8 -*-
"""github.com 主域 502 时，用 api.github.com 的 Git Data 通道把本地 commit 逐个重放。

与 _push_api.py 的区别：那个把 HEAD 压成一个 commit；这个保留每个 commit 的
message / 作者 / 时间 / 父子关系，历史与原样一致（sha 会变，因为父链被重写）。

原理：GitHub 的 blob sha 就是 git 的 sha1，本地算出的 blob 原样上传后返回的 sha
必须相同——这就是逐文件强校验。tree 用 base_tree 只提交差量，不重传整棵树。

用法：python _push_api_commits.py <起点commit> [--tag v1.14.28]
起点必须是远端已存在的 commit（分支或某个 tag 指向的）。
"""
import subprocess, json, base64, io, sys

REPO = 'podcatcher962/moyin-reader'
API = 'https://api.github.com/repos/' + REPO
TOK = io.open(r'D:\Desktop\send-to-mainpc\podcatcher962-token.txt', encoding='utf-8').read().strip()
BODY = '_tmp_api_body.json'


def api(method, path, body=None):
    args = ['curl', '-s', '-m', '300', '-X', method, API + path,
            '-H', 'Authorization: Bearer ' + TOK,
            '-H', 'Accept: application/vnd.github+json',
            '-H', 'Content-Type: application/json']
    if body is not None:
        io.open(BODY, 'w', encoding='utf-8').write(json.dumps(body, ensure_ascii=False))
        args += ['--data-binary', '@' + BODY]
    txt = subprocess.run(args, capture_output=True).stdout.decode('utf-8', 'replace')
    try:
        return json.loads(txt)
    except Exception:
        raise SystemExit('接口返回非 JSON（%s %s）：%s' % (method, path, txt[:300]))


def git(*a, **kw):
    p = subprocess.run(['git'] + list(a), capture_output=True)
    if p.returncode:
        raise SystemExit('git %s 失败：%s' % (' '.join(a), p.stderr.decode('utf-8', 'replace')[:300]))
    return p.stdout if kw.get('binary') else p.stdout.decode('utf-8', 'replace')


def tree_map(commit):
    """path -> (mode, blob sha)；-z 保证中文路径不被转义"""
    out = git('ls-tree', '-r', '-z', commit, binary=True)
    m = {}
    for ent in out.split(b'\0'):
        if not ent:
            continue
        meta, path = ent.split(b'\t', 1)
        mode, _typ, sha = meta.split(b' ')
        m[path.decode('utf-8')] = (mode.decode(), sha.decode())
    return m


def main():
    start = sys.argv[1]
    want_tag = sys.argv[sys.argv.index('--tag') + 1] if '--tag' in sys.argv else None
    # 本地起点与远端起点可能不是同一个 sha（上一次 API 推送重写过父链），
    # 只要两边树内容一致，就能用本地树当 base_tree、用远端 sha 当 parents。
    remote_base = (sys.argv[sys.argv.index('--remote-base') + 1]
                   if '--remote-base' in sys.argv else start)

    r = api('GET', '/git/ref/heads/main')
    remote_main = r.get('object', {}).get('sha')
    print('远端 main =', remote_main)

    commits = git('rev-list', '--reverse', '%s..HEAD' % start).split()
    if not commits:
        raise SystemExit('没有要推的 commit')
    print('待重放 %d 个：' % len(commits))
    for c in commits:
        print('   ', c[:8], git('log', '-1', '--format=%s', c).strip())

    prev, prev_tree = start, git('rev-parse', start + '^{tree}').strip()
    local_prev = start          # 本地 sha：只用来读差异
    remote_prev = remote_base   # 远端 sha：新 commit 的父

    for c in commits:
        new, old = tree_map(c), tree_map(local_prev)
        changed = [p for p in new if old.get(p) != new[p]]
        deleted = [p for p in old if p not in new]
        entries, nbytes = [], 0
        for p in changed:
            mode, sha = new[p]
            blob = git('cat-file', 'blob', sha, binary=True)
            nbytes += len(blob)
            got = api('POST', '/git/blobs', {'content': base64.b64encode(blob).decode(), 'encoding': 'base64'})
            if got.get('sha') != sha:
                raise SystemExit('blob 校验失败 %s：本地 %s ≠ 远端 %s' % (p, sha, got.get('sha')))
            entries.append({'path': p, 'mode': mode, 'type': 'blob', 'sha': sha})
        for p in deleted:
            entries.append({'path': p, 'mode': old[p][0], 'type': 'blob', 'sha': None})
        print('  %s 改 %d 删 %d 上传 %.1f KB' % (c[:8], len(changed), len(deleted), nbytes / 1024.0))

        t = api('POST', '/git/trees', {'base_tree': prev_tree, 'tree': entries})
        if not t.get('sha'):
            raise SystemExit('tree 创建失败：%s' % str(t)[:300])

        meta = git('log', '-1', '--format=%an%x00%ae%x00%aI', c).rstrip('\n').split('\x00')
        nc = api('POST', '/git/commits', {
            'message': git('log', '-1', '--format=%B', c).rstrip('\n'),
            'tree': t['sha'], 'parents': [remote_prev],
            'author': {'name': meta[0], 'email': meta[1], 'date': meta[2]},
            'committer': {'name': meta[0], 'email': meta[1], 'date': meta[2]},
        })
        if not nc.get('sha'):
            raise SystemExit('commit 创建失败：%s' % str(nc)[:300])
        print('     -> %s' % nc['sha'][:8])
        local_prev, remote_prev, prev_tree = c, nc['sha'], t['sha']
        prev = nc['sha']

    r = api('PATCH', '/git/refs/heads/main', {'sha': prev, 'force': False})
    if not r.get('object'):
        raise SystemExit('更新 main 失败：%s' % str(r)[:300])
    print('main 已更新 ->', r['object']['sha'][:8])

    if want_tag:
        meta = git('log', '-1', '--format=%an%x00%ae%x00%aI', prev).rstrip('\n').split('\x00')
        tg = api('POST', '/git/tags', {
            'tag': want_tag, 'message': '墨吟阅读器 ' + want_tag.lstrip('v'),
            'object': prev, 'type': 'commit',
            'tagger': {'name': meta[0], 'email': meta[1], 'date': meta[2]},
        })
        if not tg.get('sha'):
            raise SystemExit('tag 创建失败：%s' % str(tg)[:300])
        rf = api('POST', '/git/refs', {'ref': 'refs/tags/' + want_tag, 'sha': tg['sha']})
        if not rf.get('ref'):
            raise SystemExit('tag 引用创建失败：%s' % str(rf)[:300])
        print('tag %s -> %s' % (want_tag, tg['sha'][:8]))

    # 远端新 commit 的 tree 与本地 HEAD 的 tree 内容必须逐文件相同
    hc = api('GET', '/git/commits/%s' % remote_prev)
    head_tree = (hc.get('tree') or {}).get('sha')
    if not head_tree:
        raise SystemExit('取新 commit 的 tree 失败：%s' % str(hc)[:300])
    rt = api('GET', '/git/trees/%s?recursive=1' % head_tree)
    remote = {e['path']: (e['mode'], e['sha']) for e in rt.get('tree', []) if e['type'] == 'blob'}
    local = tree_map('HEAD')
    if remote == local:
        print('✓ 远端 tree 与本地 HEAD 逐文件一致（%d 个文件）' % len(local))
    else:
        miss = [p for p in local if remote.get(p) != local[p]]
        extra = [p for p in remote if p not in local]
        print('✗ 不一致：本地有而远端不同 %d，远端多出 %d' % (len(miss), len(extra)))
        for p in miss[:5]:
            print('   ', p, local[p], remote.get(p))
        raise SystemExit(1)

    print('\n新 head =', prev)
    print('本地对齐：git update-ref refs/remotes/origin/main %s' % prev)


if __name__ == '__main__':
    main()
