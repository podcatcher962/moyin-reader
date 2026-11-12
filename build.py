#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把外壳 + ZIP 内核 + 主程序织成单文件 MoYinReader.html。"""
import io, json, os, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'MoYinReader.html')
# GitHub Pages 入口（站点从 main 的 /docs 发布），与 OUT 内容完全相同
PAGES = os.path.join(HERE, 'docs', 'index.html')

# 窄屏版式只写一份，构建时生成「自动（媒体查询）」与「强制手机版」两份
NARROW = r'''
#libTop{gap:7px;padding:8px}
.brand{width:100%;font-size:1.1em}
.brand small{display:none}
#libSearch{width:100%;order:3}
#libTop .spacer{display:none}
/* 书架顶栏：先只留 5 个常用键（各占 1/5 宽、44px 高，拇指点不错），
   书签 / 笔记 / 主题 / 自动 / 全屏 / 设置这些收进「⋯」，点开再摊平。 */
#libActs{width:100%;display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
#libActs .sec{display:none}
#libActs.open .sec{display:block}
/* 展开后键多了，改 6 列：12 个正好两行排满，不会留半行空格 */
#libActs.open{grid-template-columns:repeat(6,1fr)}
#libActs .only-narrow{display:block}
#libActs button{font-size:.86em;padding:8px 2px;min-height:44px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* ---- 阅读器顶栏：单行，不再把两行按钮堆成 100 多像素高 ----
   第一行只放 返回 / 书名 / 时钟 / 目录 / 朗读 / ⋯；搜索、排版、书签、笔记、
   主题、自动、全屏、设置都收进「⋯」，展开成悬浮面板，压正文不撑顶栏。 */
#readTop{padding:6px 8px;gap:6px;flex-wrap:nowrap;min-height:50px;position:relative}
#readTop .spacer{display:none}
#readTop #btnBack{font-size:0;padding:7px 11px;flex:0 0 auto}
#readTop #btnBack::before{content:'←';font-size:17px;line-height:1}
#readTitle{flex:1 1 auto;min-width:0;max-width:none;font-size:.94em}
#clock{font-size:.68em;padding:2px 5px;border-radius:9px;white-space:nowrap;flex:0 0 auto}
#readActs{width:auto;flex:0 0 auto;display:flex;flex-wrap:nowrap;gap:5px}
#readActs .sec,#readActs #btnFind,#readActs #btnType{display:none}
#readActs .only-narrow{display:block}
#readActs button{font-size:.85em;padding:7px 9px;min-height:38px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#readActs.open{position:absolute;left:6px;right:6px;top:calc(100% + 2px);z-index:40;display:grid;
  grid-template-columns:repeat(4,1fr);gap:6px;padding:8px 8px 10px;background:var(--card);
  border:1px solid var(--line);border-radius:0 0 12px 12px;box-shadow:0 18px 40px rgba(0,0,0,.52)}
#readActs.open .sec,#readActs.open #btnFind,#readActs.open #btnType{display:block}
#readActs.open button{min-height:42px;padding:6px 2px;font-size:.84em}
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
/* 翻页时底部要多留一点：不然最后一行会贴住屏幕下沿（收起工具栏后更明显） */
html[data-mode="page"] #page{padding:14px min(var(--padx),16px) calc(16px + .8em)}
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
#pgHintL,#pgHintR{width:33.3%}
'''

def scoped(css, prefix):
    def one(m):
        sels = [s.strip() for s in m.group(1).split(',') if s.strip()]
        return ','.join(prefix + ' ' + s for s in sels) + '{' + m.group(2) + '}'
    return re.sub(r'([^{}]+)\{([^{}]*)\}', one, css, flags=re.S)

def narrow_css():
    # 手机/平板窄屏：只按屏宽自动生效，不再有「强制手机版」那一套
    return '/* 窄屏（按屏幕宽度自动） */\n@media (max-width:860px){\n' + NARROW + '\n}\n'

PDFJS_DIR = os.path.join(HERE, '_vendor', 'pdfjs')


def pdf_parts():
    """PDF.js（Apache-2.0）：核心与 worker 都内联，成品仍是一个文件、零外链。

    worker 源码塞进 PDF_WORKER_SRC 字符串，运行时转成 Blob URL 交给 PDF.js
    （见 pdfbook.js）。不开 worker 的话，几百页的册子抽字时界面会僵住。
    """
    core = io.open(os.path.join(PDFJS_DIR, 'pdf.min.js'), encoding='utf-8').read()
    worker = io.open(os.path.join(PDFJS_DIR, 'pdf.worker.min.js'), encoding='utf-8').read()
    head = '/* PDF.js r3.11.174 · Apache-2.0 · https://mozilla.github.io/pdf.js/ */\n'
    return head + 'var PDF_WORKER_SRC = ' + json.dumps(worker) + ';\n' + core


def main():
    shell = io.open(os.path.join(HERE, 'shell.html'), encoding='utf-8').read()
    core = io.open(os.path.join(HERE, 'zipcore.js'), encoding='utf-8').read()
    i18n = io.open(os.path.join(HERE, 'i18n.js'), encoding='utf-8').read()
    docsen = io.open(os.path.join(HERE, 'docs-en.js'), encoding='utf-8').read()
    pdfbook = io.open(os.path.join(HERE, 'pdfbook.js'), encoding='utf-8').read()
    docfmt = io.open(os.path.join(HERE, 'docfmt.js'), encoding='utf-8').read()
    app = io.open(os.path.join(HERE, 'app.js'), encoding='utf-8').read()
    js = pdf_parts() + '\n' + pdfbook + '\n' + docfmt + '\n' + core + '\n' + i18n + '\n' + docsen + '\n' + app
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
        ('PDF.js 已内联', 'pdfjsLib' in js and 'PDF_WORKER_SRC' in js),
        ('DOCX/MOBI 解析器已内联', 'root.DocFmt' in js and 'palmdoc' in js),
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
