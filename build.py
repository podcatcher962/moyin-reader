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
/* 顶栏先只留 5 个常用键（各占 1/5 宽、44px 高，拇指点不错），
   书签 / 笔记 / 主题 / 自动 / 全屏 / 设置这些收进「⋯」，点开再摊平。
   原来 5 列 × 3 行、36px 高、.8em 小字，拇指经常摸到隔壁。 */
#libActs,#readActs{width:100%;display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
#libActs .sec,#readActs .sec{display:none}
#libActs.open .sec,#readActs.open .sec{display:block}
/* 展开后键多了，改 6 列：12 个正好两行排满，不会留半行空格 */
#libActs.open,#readActs.open{grid-template-columns:repeat(6,1fr)}
#libActs .only-narrow,#readActs .only-narrow{display:block}
#libActs button,#readActs button{font-size:.86em;padding:8px 2px;min-height:44px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#readTitle{max-width:100%}
#readTitle{max-width:calc(100% - 112px)}
#clock{font-size:.7em;padding:2px 6px;border-radius:9px;white-space:nowrap}
body.imm #clockFloat{font-size:.7em;top:6px;right:8px}
#restTip{bottom:60px;left:8px;right:8px;max-width:none}
#restTip.on{animation:none;transform:none}
#restTip .rtTx{font-size:.94em}
#libBody{padding:10px}
.shelf{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:9px}
.bk .cv{height:142px}
.bk .meta{padding:7px}
.bk .del{opacity:1}
#readMain{position:relative}
.side{position:absolute;left:0;top:0;bottom:0;width:86vw;max-width:330px;z-index:20;box-shadow:6px 0 24px rgba(0,0,0,.35)}
#page{padding:18px min(var(--padx),18px) 60px}
html[data-mode="page"] #page{padding:14px min(var(--padx),16px)}
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
#autoPill{bottom:56px;font-size:.8em;padding:6px 8px 6px 11px}
#pgHintL,#pgHintR{width:24%}
'''

def scoped(css, prefix):
    def one(m):
        sels = [s.strip() for s in m.group(1).split(',') if s.strip()]
        return ','.join(prefix + ' ' + s for s in sels) + '{' + m.group(2) + '}'
    return re.sub(r'([^{}]+)\{([^{}]*)\}', one, css, flags=re.S)

def narrow_css():
    # 手机/平板窄屏：只按屏宽自动生效，不再有「强制手机版」那一套
    return '/* 窄屏（按屏幕宽度自动） */\n@media (max-width:860px){\n' + NARROW + '\n}\n'

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
