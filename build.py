#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把外壳 + ZIP 内核 + 主程序织成单文件 MoYinReader.html。"""
import io, os, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'MoYinReader.html')
# GitHub Pages 入口（站点从 main 的 /docs 发布），与 OUT 内容完全相同
PAGES = os.path.join(HERE, 'docs', 'index.html')

# 窄屏版式只写一份，构建时生成「自动（媒体查询）」与「强制手机版」两份
NARROW = r'''
#libTop,#readTop{gap:7px;padding:8px}
.brand{width:100%;font-size:1.1em}
.brand small{display:none}
#libSearch{width:100%;order:3}
#libTop .spacer,#readTop .spacer{display:none}
#libActs,#readActs{width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
#libActs button,#readActs button{font-size:.84em;padding:6px 3px;min-height:36px;overflow:hidden;text-overflow:ellipsis}
#readTitle{max-width:calc(100% - 92px)}
#libBody{padding:10px}
.shelf{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:9px}
.bk .cv{height:142px}
.bk .meta{padding:7px}
.bk .del{opacity:1}
#readMain{position:relative}
.side{position:absolute;left:0;top:0;bottom:0;width:86vw;max-width:330px;z-index:20;box-shadow:6px 0 24px rgba(0,0,0,.35)}
#page{padding:18px 16px 60px}
#page h1{font-size:1.3em}
#readFoot{padding:6px;gap:5px}
#readFoot button{padding:6px 8px;font-size:.82em}
#progTx{min-width:78px;font-size:.75em}
.speakbar{gap:6px;padding:8px}
.speakbar select{max-width:124px}
.speakbar #spVoice{max-width:min(48vw,200px)}
.speakbar #spQuality{display:none}
.speakbar #spTry{font-size:.8em;padding:5px 8px;min-height:30px}
.speakbar .spRateLabel{display:none}
.speakbar #spNow{display:none}
.mbox .mf button{flex:1}
.foot{font-size:.78em}
'''

def scoped(css, prefix):
    def one(m):
        sels = [s.strip() for s in m.group(1).split(',') if s.strip()]
        return ','.join(prefix + ' ' + s for s in sels) + '{' + m.group(2) + '}'
    return re.sub(r'([^{}]+)\{([^{}]*)\}', one, css, flags=re.S)

def narrow_css():
    auto = scoped(NARROW, 'html[data-lay="auto"]')
    phone = scoped(NARROW, 'html[data-lay="p"]')
    return ('/* 窄屏：自动（按屏幕宽度） */\n@media (max-width:860px){\n' + auto + '\n}\n'
            '/* 窄屏：强制手机版 */\n' + phone + '\n')

def main():
    shell = io.open(os.path.join(HERE, 'shell.html'), encoding='utf-8').read()
    core = io.open(os.path.join(HERE, 'zipcore.js'), encoding='utf-8').read()
    i18n = io.open(os.path.join(HERE, 'i18n.js'), encoding='utf-8').read()
    docsen = io.open(os.path.join(HERE, 'docs-en.js'), encoding='utf-8').read()
    app = io.open(os.path.join(HERE, 'app.js'), encoding='utf-8').read()
    js = core + '\n' + i18n + '\n' + docsen + '\n' + app
    # 脚本内不能直接出现结束标签，统一转义
    js = js.replace('</script', '<\\/script').replace('</SCRIPT', '<\\/SCRIPT')
    if '<!--' in js:
        print('FAIL: 脚本里含 <!--'); return 1
    if '/*__NARROW_CSS__*/' not in shell or '/*__APP_JS__*/' not in shell:
        print('FAIL: 锚点缺失'); return 1
    html = shell.replace('/*__NARROW_CSS__*/', narrow_css())
    html = html.replace('/*__APP_JS__*/', js)
    # 静态校验
    checks = [
        ('单一 script 标签', html.count('<script>') == 1 and html.count('</script>') == 1),
        ('无外部脚本/样式引用', not re.search(r'<(script|link)[^>]+(src|href)\s*=\s*["\']https?://', html, re.I)),
        ('无未替换锚点', '__APP_JS__' not in html and '__NARROW_CSS__' not in html),
        ('JS 无裸结束标签', '</script' not in js.lower().replace('<\\/script', '')),
        ('meta charset 在前 512 字节', 'charset="utf-8"' in html[:512]),
        ('含 viewport', 'name="viewport"' in html),
    ]
    for name, ok in checks:
        print(('  OK  ' if ok else ' FAIL ') + name)
    if not all(x[1] for x in checks):
        return 1
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(html)
    size = os.path.getsize(OUT)
    print('\n输出 %s  %d 字节 (%.1f KB)' % (OUT, size, size / 1024))
    os.makedirs(os.path.dirname(PAGES), exist_ok=True)
    io.open(PAGES, 'w', encoding='utf-8', newline='\n').write(html)
    print('输出 %s  %d 字节 (%.1f KB)  ← GitHub Pages 入口' % (PAGES, size, size / 1024))
    print('构建时间', datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    return 0

if __name__ == '__main__':
    sys.exit(main())
