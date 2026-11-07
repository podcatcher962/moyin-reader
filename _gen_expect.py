#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从真实 EPUB 生成 ZIP / DEFLATE 期望值，供 Node 单测对照。"""
import io, os, json, zipfile, hashlib, struct, base64

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_samples')
# 真实书库路径写在 _local_books.json（已在 .gitignore，不入库），
# 这样生成脚本照常能用，但个人路径不会进公开仓库。
_cfg = {}
_cfg_path = os.path.join(HERE, '_local_books.json')
if os.path.isfile(_cfg_path):
    with io.open(_cfg_path, encoding='utf-8') as _f:
        _cfg = json.load(_f)
BOOKS = [v for v in _cfg.values() if v]

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
        # 用 _local_books.json 的键名（如 zhongguo.epub）作为中性标识，
        # 不把真实书名和真实路径写进公开的 expect.json。
        _hit = [k for k, v in _cfg.items() if v == p]
        safe = _hit[0] if _hit else ('book%d.epub' % (len(data) + 1))
        data.append({'book': safe, 'path': 'D:\\\\Books\\\\' + safe, 'picks': pick,
                     'allsha': [{'n': e['name'], 'm': e['method'], 'u': e['ulen'], 's': e['sha']}
                                for e in ents]})
    io.open(os.path.join(OUT, 'expect.json'), 'w', encoding='utf-8').write(
        json.dumps(data, ensure_ascii=False, indent=1))
    print('wrote', os.path.join(OUT, 'expect.json'))

if __name__ == '__main__':
    main()
