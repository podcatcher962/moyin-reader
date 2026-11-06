#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从真实 EPUB 生成 ZIP / DEFLATE 期望值，供 Node 单测对照。"""
import io, os, json, zipfile, hashlib, struct, base64

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_samples')
BOOKS = [
    r'D:\C geng\书籍下载\2021年1月余秋雨书籍\中国文脉.epub',
    r'D:\C geng\书籍下载\好读\吳敬梓 儒林外史.epub',
    r'D:\C geng\书籍下载\侯卫东官场笔记（1-8册 巴国侯氏）.epub',
]

def raw_entries(path):
    b = open(path, 'rb').read()
    out = []
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            # 从本地文件头定位真实压缩数据
            with open(path, 'rb') as f:
                f.seek(info.header_offset)
                lh = f.read(30)
                nl, xl = struct.unpack('<HH', lh[26:30])
                f.seek(info.header_offset + 30 + nl + xl)
                comp = f.read(info.compress_size)
            raw = z.read(info.filename)
            out.append({
                'name': info.filename,
                'method': info.compress_type,
                'clen': len(comp),
                'ulen': len(raw),
                'sha': hashlib.sha256(raw).hexdigest(),
                'head': raw[:60].decode('utf-8', 'ignore'),
                'deflate': base64.b64encode(comp).decode() if len(comp) < 900000 else None,
            })
    return out

def main():
    data = []
    for p in BOOKS:
        if not os.path.isfile(p):
            print('skip', p); continue
        ents = raw_entries(p)
        # 每本挑：前两个 deflate 小文件、一个 stored 文件、一个较大的正文
        defl = [e for e in ents if e['method'] == 8 and e['clen'] < 300000]
        stor = [e for e in ents if e['method'] == 0]
        pick = defl[:2] + stor[:1] + defl[-1:]
        print(os.path.basename(p), 'entries', len(ents), 'picked', [x['name'] for x in pick])
        data.append({'book': os.path.basename(p), 'path': p, 'picks': pick,
                     'allsha': [{'n': e['name'], 'm': e['method'], 'u': e['ulen'], 's': e['sha']}
                                for e in ents]})
    io.open(os.path.join(OUT, 'expect.json'), 'w', encoding='utf-8').write(
        json.dumps(data, ensure_ascii=False, indent=1))
    print('wrote', os.path.join(OUT, 'expect.json'))

if __name__ == '__main__':
    main()
