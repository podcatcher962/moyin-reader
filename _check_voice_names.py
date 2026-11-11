# -*- coding: utf-8 -*-
"""精选声线名单三方一致性检查。

同一份「精选 21 个」的名字存在三个地方，改一处忘两处就会出「手机上叫中年男 4、
桌面上还叫青年男 2」这种怪事，所以做成脚本每次改完跑一遍：

  1. VoicePack/tts_server.py   CURATED          —— 桌面/网页的引擎真身，/health 就返回它
  2. _pkg_apk/TtsEngine.java   CURATED_SID/LABEL —— 安卓 JNI 侧，不读 Python
  3. app.js                    LOCAL_VOICES      —— 引擎没起来时的前端兜底

用法：python _check_voice_names.py
退出码 0 = 一致，1 = 有不一致（会逐条列出）。
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


def from_py(txt):
    body = re.search(r'^CURATED = \[(.*?)^\]', txt, re.S | re.M)
    if not body:
        raise SystemExit('tts_server.py 里找不到 CURATED')
    out = []
    for m in re.finditer(r"\('(s\d+)',\s*'([^']+)'\)", body.group(1)):
        out.append((int(m.group(1)[1:]), m.group(2)))
    return out


def from_java(txt):
    sid = re.search(r'CURATED_SID = \{(.*?)\};', txt, re.S)
    lab = re.search(r'CURATED_LABEL = \{(.*?)\};', txt, re.S)
    if not sid or not lab:
        raise SystemExit('TtsEngine.java 里找不到 CURATED_SID / CURATED_LABEL')
    sids = [int(x) for x in re.findall(r'\d+', sid.group(1))]
    labels = re.findall(r'"([^"]+)"', lab.group(1))
    if len(sids) != len(labels):
        raise SystemExit('TtsEngine.java：%d 个 sid 对 %d 个名字，数量就对不上' % (len(sids), len(labels)))
    return list(zip(sids, labels))


def from_js(txt):
    body = re.search(r'var LOCAL_VOICES = \[(.*?)^  \];', txt, re.S | re.M)
    if not body:
        raise SystemExit('app.js 里找不到 LOCAL_VOICES')
    out = []
    for m in re.finditer(r"\['(s\d+)',\s*'([^']+)',\s*'([^']*)'\]", body.group(1)):
        out.append((int(m.group(1)[1:]), m.group(2)))
    return out


def main():
    py = from_py(read(os.path.join('VoicePack', 'tts_server.py')))
    jv = from_java(read(os.path.join('_pkg_apk', 'TtsEngine.java')))
    js = from_js(read('app.js'))

    bad = 0
    print('%-6s %-14s %-14s %-14s' % ('sid', 'tts_server.py', 'TtsEngine.java', 'app.js'))
    print('-' * 56)
    all_sid = [s for s, _ in py]
    for s, _ in jv:
        if s not in all_sid:
            all_sid.append(s)
    for s, _ in js:
        if s not in all_sid:
            all_sid.append(s)

    dpy, djava, djs = dict(py), dict(jv), dict(js)
    for s in all_sid:
        a, b, c = dpy.get(s), djava.get(s), djs.get(s)
        flag = ''
        if not (a == b == c):
            flag = '  ← 不一致'
            bad += 1
        print('s%-5d %-14s %-14s %-14s%s' % (s, a or '—', b or '—', c or '—', flag))

    # 顺序也要一致：精选列表的排列就是界面上的顺序
    if [s for s, _ in py] != [s for s, _ in jv]:
        print('\n排序不一致：tts_server.py 与 TtsEngine.java')
        print('  py  :', [s for s, _ in py])
        print('  java:', [s for s, _ in jv])
        bad += 1
    if [s for s, _ in py] != [s for s, _ in js]:
        print('\n排序不一致：tts_server.py 与 app.js')
        print('  py:', [s for s, _ in py])
        print('  js:', [s for s, _ in js])
        bad += 1

    # 重名会让下拉里出现两个一模一样的选项
    names = [n for _, n in py]
    dup = sorted({n for n in names if names.count(n) > 1})
    if dup:
        print('\n重名：', '、'.join(dup))
        bad += 1

    print('\n共 %d 个精选声线' % len(py))
    if bad:
        print('✗ 有 %d 处不一致' % bad)
        return 1
    print('√ 三处完全一致')
    return 0


if __name__ == '__main__':
    sys.exit(main())
