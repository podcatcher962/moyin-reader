# -*- coding: utf-8 -*-
"""墨吟阅读器 · 安卓 APK 构建 + 体检（免 Gradle）"""
import hashlib
import io
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile

PKG_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(PKG_DIR)
AB = os.environ.get('MOYIN_ANDROID_BUILD') or os.path.join(os.path.expanduser('~'), '.moyin-android')
TPL = os.path.join(AB, 'tpl')
JDK = os.path.join(AB, 'dl', 'jdk-17.0.13+11')
SDK = os.path.join(AB, 'sdk')
BT = os.path.join(SDK, 'build-tools', '34.0.0')
JAR = os.path.join(SDK, 'platforms', 'android-34', 'android.jar')
KS = os.environ.get('MOYIN_KEYSTORE') or os.path.join(AB, 'release.keystore')
if not os.path.isfile(KS) and os.path.isdir(AB):
    # 构建目录里可能只有 lanlan.keystore 这类老名字，唯一一个就直接用它
    _ks = [os.path.join(AB, f) for f in os.listdir(AB)
           if f.lower().endswith(('.keystore', '.jks'))]
    if len(_ks) == 1:
        KS = _ks[0]
KS_PASS = os.environ.get('MOYIN_KS_PASS', '')
if not KS_PASS:
    # 口令不必每次手输，也不用塞进环境变量：放在构建目录下的 .kspass 里即可。
    # 这个文件在 D:\Workuddy\android-build\（不是仓库目录），不会被提交。
    _p = os.path.join(AB, '.kspass')
    if os.path.isfile(_p):
        KS_PASS = io.open(_p, encoding='utf-8').read().strip()
if not KS_PASS:
    sys.exit('缺少签名密钥库口令。三种给法，任选一种：\n'
             '  1) 把口令单独一行写进 %s（推荐，写一次以后都不用管）\n'
             '  2) set MOYIN_KS_PASS=<口令>\n'
             '  3) 命令行前加 MOYIN_KS_PASS=<口令>\n'
             '密钥库：%s' % (os.path.join(AB, '.kspass'), KS))

PY312 = os.environ.get('MOYIN_PYTHON') or sys.executable
JAVAC = os.path.join(JDK, 'bin', 'javac.exe')
AAPT2 = os.path.join(BT, 'aapt2.exe')
D8 = os.path.join(BT, 'd8.bat')
ZIPALIGN = os.path.join(BT, 'zipalign.exe')
APKSIGNER = os.path.join(BT, 'apksigner.bat')

PKG = 'com.lanlan.moyinreader'
APP_NAME = '墨吟'
PORT = 38973
HTML = os.path.join(ROOT, 'MoYinReader.html')
FINAL = os.path.join(ROOT, 'MoYinReader.apk')
STAGE = os.path.join(PKG_DIR, 'stage_' + time.strftime('%H%M%S'))

# ── 手机端离线神经语音：sherpa-onnx Android AAR + AISHELL3 中文多说话人模型 ──
# 引擎与模型只在打包时用，不进仓库。缺了也能打，只是 APK 里没有神经语音。
SHERPA = os.environ.get('MOYIN_SHERPA') or r'D:\Workuddy\_tools\sherpa_android'
SHERPA_AAR = os.path.join(SHERPA, 'aar')
SHERPA_JAR = os.path.join(SHERPA_AAR, 'classes.jar')
KOTLIN_JAR = os.path.join(SHERPA, 'kotlin-stdlib.jar')
SHERPA_ABI = 'arm64-v8a'
SHERPA_LIBS = ['libonnxruntime.so', 'libsherpa-onnx-c-api.so',
               'libsherpa-onnx-cxx-api.so', 'libsherpa-onnx-jni.so']
VOICE_MODEL = os.path.join(ROOT, 'VoicePack', 'models', 'aishell3')
VOICE_FILES = ['model.onnx', 'lexicon.txt', 'tokens.txt',
               'date.fst', 'number.fst', 'phone.fst']
NEURO = '--no-neuro' not in sys.argv

os.environ['JAVA_HOME'] = JDK
os.environ['ANDROID_HOME'] = SDK
os.makedirs(STAGE, exist_ok=True)

MANIFEST = '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="%s"
    android:versionCode="11202"
    android:versionName="1.12.2">
    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34" />
    <!-- 只有两条：WebView 访问本机 127.0.0.1 需要明文 http；
         不申请麦克风、定位、通讯录、存储，读书不需要这些。 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <application
        android:label="%s"
        android:icon="@mipmap/ic_launcher"
        android:allowBackup="false"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/LanTheme">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize|screenLayout"
            android:screenOrientation="unspecified">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
''' % (PKG, APP_NAME)


def sh(cmd, timeout=300):
    if str(cmd[0]).endswith('.bat'):
        cmd = ['cmd', '/c'] + list(cmd)
    r = subprocess.run(cmd, capture_output=True, text=True,
                       encoding='utf-8', errors='replace', timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError('CMD FAIL %s\n%s\n%s' %
                           (' '.join(str(x) for x in cmd)[:300],
                            (r.stdout or '')[-900:], (r.stderr or '')[-900:]))
    return r.stdout or ''


def md5(b):
    return hashlib.md5(b).hexdigest()


# ---------------------------------------------------------------- 模板 patch
def patch_main():
    s = io.open(os.path.join(TPL, 'MainActivityHttp.java'), encoding='utf-8').read()

    def rep(old, new, tag):
        nonlocal s
        assert s.count(old) == 1, '锚点不唯一/找不到: ' + tag + ' count=' + str(s.count(old))
        s = s.replace(old, new, 1)

    # 1) TTS 桥字段
    rep('    private android.webkit.ValueCallback<Uri[]> filePathCallback;\n'
        '    private static final int REQ_FILE = 4001;',
        '    private android.webkit.ValueCallback<Uri[]> filePathCallback;\n'
        '    private static final int REQ_FILE = 4001;\n'
        '    private TtsBridge bridge;', 'field')

    # 2) 初始化 TTS（必须在 WebView 之前，页面加载完就要能用）
    rep('        web = new WebView(this);\n        WebSettings s = web.getSettings();',
        '        bridge = new TtsBridge(this);\n'
        '        web = new WebView(this);\n'
        '        WebSettings s = web.getSettings();', 'init')

    # 3) 页面加载完把音色表换成系统语音并重新探测
    rep('                if (url != null && url.startsWith("http://127.0.0.1")) {\n'
        '                    injectSaveHook();\n'
        '                }',
        '                if (url != null && url.startsWith("http://127.0.0.1")) {\n'
        '                    injectSaveHook();\n'
        '                    if (bridge != null) bridge.injectMoyin(web, port);\n'
        '                }', 'pageFinished')

    # 4) /health 与 /tts 必须放在「非 GET 一律 405」之前
    rep('            if (path.equals("/__save")) { handleSave(c, in, lines, method, query); return; }\n',
        '            if (path.equals("/__save")) { handleSave(c, in, lines, method, query); return; }\n'
        '            if (path.equals("/health")) { bridge.handleHealth(c, port, method); return; }\n'
        '            if (path.equals("/tts")) { bridge.handleTts(c, in, lines, method); return; }\n',
        'routes')

    # 5) 退出时释放系统 TTS
    rep('    protected void onDestroy() {\n'
        '        try { if (server != null) server.close(); } catch (Exception e) { }',
        '    protected void onDestroy() {\n'
        '        try { if (server != null) server.close(); } catch (Exception e) { }\n'
        '        try { if (bridge != null) bridge.stop(); } catch (Throwable t) { }',
        'destroy')

    # 6) 备份目录名
    rep('        return AUDIO_EXT.indexOf("|" + ext + "|") >= 0 ? "拾声录音" : "拾声备份";',
        '        return "墨吟备份";', 'album')

    # 7.5) 返回键先交给页面：弹窗 → 侧栏 → 回书架，页面不管了才退出应用
    rep('''    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }''',
        '''    private long backAt = 0;

    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        // 单页应用没有浏览器历史，直接 goBack 是空操作，原来的实现等于「一按就退」。
        // 现在按常识来：弹窗开着关弹窗，侧栏开着收侧栏，在看书就回书架；
        // 页面说「我不管」才真的退出。900ms 内连按只算一次，免得手抖退掉。
        long now = System.currentTimeMillis();
        if (now - backAt < 900) return;
        backAt = now;
        try {
            web.evaluateJavascript(
                "(function(){try{return (window.MY&&MY.backKey&&MY.backKey())?'1':'0';}"
                    + "catch(e){return '0';}})()",
                new android.webkit.ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String v) {
                        if (v != null && v.indexOf('1') >= 0) return;
                        if (web != null && web.canGoBack()) { web.goBack(); return; }
                        finish();
                    }
                });
        } catch (Throwable t) {
            super.onBackPressed();
        }
    }''', 'backkey')

    # 7) 页面里 toast 是 IIFE 内的局部函数，注入脚本够不着；改成自带提示条
    #    JS 全部用单引号，Java 字符串里就不会出现需要转义的双引号
    rep('          + "var say=function(m,t){try{if(typeof toast===\'function\')toast(m,t||3500);}catch(e){}};"',
        '          + "var say=function(m){try{var d=document.createElement(\'div\');'
        'd.textContent=m;d.style.cssText=\'position:fixed;left:16px;right:16px;'
        'bottom:16px;z-index:99999;padding:12px 16px;background:#26303A;'
        'color:#F0E6CE;border-radius:8px;font-size:14px\';'
        'document.body.appendChild(d);setTimeout(function(){d.remove();},6500);'
        '}catch(e){}};"',
        'toast')

    s = s.replace('{PKG}', PKG).replace('{PORT}', str(PORT))
    assert '{PKG}' not in s and '{PORT}' not in s
    # 硬断言：TTS 桥的三处接线都在（防止以后换模板时静默丢掉）
    for kw in ('TtsBridge bridge', 'bridge.handleHealth', 'bridge.handleTts',
               'bridge.injectMoyin', 'bridge.stop()', 'MY.backKey'):
        assert kw in s, '接线缺失: ' + kw
    return s


def neuro_compile_deps():
    """编译 TtsEngine 必需的两个 jar（有它们才能过 javac，跟打不打包无关）。"""
    for p, what in ((SHERPA_JAR, 'sherpa classes.jar'), (KOTLIN_JAR, 'kotlin-stdlib.jar')):
        if not os.path.isfile(p):
            sys.exit('缺 %s：%s\n'
                     '这个包必须带上 sherpa-onnx 的 Android AAR 才能编译（TtsEngine.java 要调它的 API）。\n'
                     '从 https://github.com/k2-fsa/sherpa-onnx/releases 取 sherpa-onnx-2.0.1.aar，\n'
                     '解压到 %s（要 aar/classes.jar 和 aar/jni/），再用 MOYIN_SHERPA 指过去。\n'
                     'kotlin-stdlib 可从 maven.aliyun.com 取 '
                     'org/jetbrains/kotlin/kotlin-stdlib/2.0.21/。' % (what, p, SHERPA))
    return True


def neuro_available():
    """能否把神经语音真正打进包：so + 模型都得在，并且没被 --no-neuro 关掉。"""
    if not NEURO:
        return False, '命令行指定了 --no-neuro'
    for lib in SHERPA_LIBS:
        p = os.path.join(SHERPA_AAR, 'jni', SHERPA_ABI, lib)
        if not os.path.isfile(p):
            return False, '缺 so：' + p
    for f in VOICE_FILES:
        p = os.path.join(VOICE_MODEL, f)
        if not os.path.isfile(p):
            return False, '缺模型：' + p
    return True, ''


def prepare_sources():
    src = os.path.join(STAGE, 'src')
    os.makedirs(src, exist_ok=True)
    main = patch_main()
    io.open(os.path.join(src, 'MainActivity.java'), 'w', encoding='utf-8').write(main)
    bridge = io.open(os.path.join(PKG_DIR, 'TtsBridge.java'), encoding='utf-8').read()
    bridge = bridge.replace('{PKG}', PKG)
    io.open(os.path.join(src, 'TtsBridge.java'), 'w', encoding='utf-8').write(bridge)
    engine = io.open(os.path.join(PKG_DIR, 'TtsEngine.java'), encoding='utf-8').read()
    engine = engine.replace('{PKG}', PKG)
    io.open(os.path.join(src, 'TtsEngine.java'), 'w', encoding='utf-8').write(engine)
    io.open(os.path.join(STAGE, 'AndroidManifest.xml'), 'w', encoding='utf-8').write(MANIFEST)
    # res
    res = os.path.join(STAGE, 'res')
    for sub, f in [('values/themes.xml', 'themes.xml'), ('values/colors.xml', 'colors.xml')]:
        d = os.path.join(res, os.path.dirname(sub))
        os.makedirs(d, exist_ok=True)
        shutil.copy(os.path.join(TPL, f), os.path.join(res, sub))
    # assets（逐字节，稍后要和源文件比对 md5）
    assets = os.path.join(STAGE, 'assets')
    os.makedirs(assets, exist_ok=True)
    shutil.copy2(HTML, os.path.join(assets, 'index.html'))
    return src, res, assets


def stage_voice_model(assets):
    """把 32 MB 中文模型拷进 assets/tts/aishell3/，首次启动由 TtsEngine 解压到私有目录。"""
    dst = os.path.join(assets, 'tts', 'aishell3')
    os.makedirs(dst, exist_ok=True)
    total = 0
    for f in VOICE_FILES:
        s = os.path.join(VOICE_MODEL, f)
        shutil.copy2(s, os.path.join(dst, f))
        total += os.path.getsize(s)
    print('  语音模型入包：%d 个文件，%.1f MB' % (len(VOICE_FILES), total / 1048576), flush=True)
    return total


def make_icons(res):
    try:
        import PIL  # noqa: F401
        has_pil = True
    except Exception:
        has_pil = False
    if not has_pil:
        # 本机 pip 装不上 Pillow 时，直接从上一版 APK 里取图标复用：
        # 图标只在改版式时才需要重画，日常改页面不必为它去装依赖。
        assert os.path.isfile(FINAL), '没有 Pillow，也找不到上一版 APK 复用图标'
        got = 0
        with zipfile.ZipFile(FINAL) as z:
            for n in z.namelist():
                # aapt2 编出来的路径带版本后缀：res/mipmap-xxhdpi-v4/ic_launcher.png
                m = re.match(r'res/(mipmap-[a-z]+)(?:-v\d+)?/ic_launcher\.png$', n)
                if not m:
                    continue
                dst = os.path.join(res, m.group(1), 'ic_launcher.png')
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, 'wb') as f:
                    f.write(z.read(n))
                got += 1
        assert got >= 5, '上一版 APK 里的图标不全（%d 张）' % got
        print('复用上一版图标 %d 张（未安装 Pillow）' % got, flush=True)
        return
    script = (
        "from PIL import Image,ImageDraw,ImageFont\n"
        "im=Image.new('RGB',(256,256),'#26303A')\n"
        "d=ImageDraw.Draw(im)\n"
        "d.rounded_rectangle([12,12,243,243],radius=42,outline='#D8C9A8',width=5)\n"
        "f=ImageFont.truetype('C:/Windows/Fonts/simkai.ttf',150)\n"
        "d.text((128,124),'墨',font=f,fill='#F0E6CE',anchor='mm')\n"
        "r='%s'\n"
        "for n,s in {'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}.items():\n"
        "    p=r+'\\\\res\\\\mipmap-'+n\n"
        "    import os;os.makedirs(p,exist_ok=True)\n"
        "    im.resize((s,s),Image.LANCZOS).save(p+'\\\\ic_launcher.png')\n"
        % (STAGE.replace('\\', '/'))
    )
    p = os.path.join(STAGE, '_icon.py')
    io.open(p, 'w', encoding='utf-8').write(script)
    r = subprocess.run([PY312, p], capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    assert r.returncode == 0, '图标生成失败: ' + (r.stderr or '')[-600:]
    for dpi in ('mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'):
        assert os.path.isfile(os.path.join(res, 'mipmap-' + dpi, 'ic_launcher.png'))


def build(src, res, assets):
    cls = os.path.join(STAGE, 'classes')
    dex = os.path.join(STAGE, 'dex')
    os.makedirs(cls, exist_ok=True)
    os.makedirs(dex, exist_ok=True)
    has_neuro, why = neuro_available()
    srcs = [os.path.join(src, 'MainActivity.java'), os.path.join(src, 'TtsBridge.java'),
            os.path.join(src, 'TtsEngine.java')]
    # 编译期永远要这两个 jar（TtsEngine 直接调 sherpa 的 Kotlin API）；
    # has_neuro 只决定 so 和 32 MB 模型要不要进包。
    cp = JAR + os.pathsep + SHERPA_JAR + os.pathsep + KOTLIN_JAR
    if not has_neuro:
        print('  [!] 不打包神经语音：%s（引擎类仍会编进去，运行时找不到 so 自动退回系统语音）' % why,
              flush=True)
    # javac：中文注释必须 -encoding UTF-8
    sh([JAVAC, '-encoding', 'UTF-8', '-source', '8', '-target', '8',
        '-classpath', cp, '-d', cls] + srcs)
    # ★ 所有 .class（含 MainActivity$1..$N）都必须进 d8，否则一点图标就闪退
    allcls = sorted(os.path.join(dp, f)
                    for dp, dn, fn in os.walk(cls) for f in fn if f.endswith('.class'))
    assert len(allcls) >= 3, '编译产物太少: %r' % allcls
    print('javac 产物 %d 个 class' % len(allcls), flush=True)
    # d8 只吃 jar 或单个 class 文件，目录不收，所以把本项目 class 打成一个 jar
    mine = os.path.join(STAGE, 'mine.jar')
    sh([os.path.join(JDK, 'bin', 'jar.exe'), 'cf', mine, '-C', cls, '.'])
    inputs = [mine, SHERPA_JAR, KOTLIN_JAR]
    sh([D8, '--release', '--min-api', '21', '--lib', JAR, '--output', dex] + inputs)
    reszip = os.path.join(STAGE, 'res.zip')
    sh([AAPT2, 'compile', '--dir', res, '-o', reszip])
    base = os.path.join(STAGE, 'base.apk')
    sh([AAPT2, 'link', '-o', base, '--manifest', os.path.join(STAGE, 'AndroidManifest.xml'),
        '-I', JAR, '-A', assets, reszip])
    dexfile = os.path.join(dex, 'classes.dex')
    with zipfile.ZipFile(base, 'a', zipfile.ZIP_DEFLATED) as z:
        z.write(dexfile, 'classes.dex')
        if has_neuro:
            for lib in SHERPA_LIBS:
                p = os.path.join(SHERPA_AAR, 'jni', SHERPA_ABI, lib)
                z.write(p, 'lib/%s/%s' % (SHERPA_ABI, lib))
    aligned = os.path.join(STAGE, 'aligned.apk')
    sh([ZIPALIGN, '-f', '4', base, aligned])
    sh([APKSIGNER, 'sign', '--ks', KS, '--ks-pass', 'pass:' + KS_PASS,
        '--out', FINAL, aligned])
    return allcls, dexfile, has_neuro


def audit(allcls, dexfile, has_neuro):
    lines = []

    def ck(c, m):
        lines.append(('PASS ' if c else 'FAIL ') + m)
        print(lines[-1], flush=True)
        return bool(c)

    ok = True
    v = sh([APKSIGNER, 'verify', '--print-certs', FINAL])
    ok &= ck('Signer #1' in v and 'Lanlan Eternal' in v, '签名者 DN = Lanlan Eternal')
    bad = sh([AAPT2, 'dump', 'badging', FINAL])
    perms = set(re.findall(r"uses-permission: name='([^']+)'", bad))
    want = {'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'}
    ok &= ck(perms == want, '权限白名单精确匹配 %s' % sorted(perms))
    ok &= ck('package: name=\'%s\'' % PKG in bad, '包名正确')
    ok &= ck('application-label:\'%s\'' % APP_NAME in bad or
             "application-label:'" + APP_NAME + "'" in bad, '应用名为墨吟')
    ok &= ck('launchable-activity' in bad, '有启动 Activity')
    ok &= ck('sdkVersion:\'21\'' in bad, 'minSdk 21')
    with zipfile.ZipFile(FINAL) as z:
        names = z.namelist()
        page = z.read('assets/index.html')
        src = open(HTML, 'rb').read()
    ok &= ck(md5(page) == md5(src), '内嵌页面与源文件逐字节一致 md5=' + md5(page))
    ok &= ck('classes.dex' in names, 'dex 已打包')
    if has_neuro:
        allowed = {'assets/index.html'} | {'assets/tts/aishell3/' + f for f in VOICE_FILES}
        extra = sorted(set(n for n in names if n.startswith('assets/')) - allowed)
        ok &= ck(not extra, 'assets 只有页面与语音模型，多余项 %r' % extra[:3])
        ok &= ck(all('assets/tts/aishell3/' + f in names for f in VOICE_FILES),
                 '语音模型 6 个文件齐全')
        libs = [n for n in names if n.startswith('lib/')]
        ok &= ck(len(libs) == len(SHERPA_LIBS) and
                 all(n.startswith('lib/%s/' % SHERPA_ABI) for n in libs),
                 '只带 %s 的 so，没混入别的架构' % SHERPA_ABI)
        ok &= ck('native-code' in bad and SHERPA_ABI in bad,
                 'badging 认出 native 架构 %s' % SHERPA_ABI)
    else:
        ok &= ck(len([n for n in names if n.startswith('assets/')]) == 1,
                 'assets 只有 index.html，没夹带别的东西')
    ok &= ck('allowBackup="false"' in io.open(os.path.join(STAGE, 'AndroidManifest.xml'),
                                              encoding='utf-8').read(), 'allowBackup=false')
    # dex 里「真正定义」的类必须覆盖所有 javac 产物（挡住匿名内部类漏打）
    sys.path.insert(0, AB)
    from _dex_class_list import classes_in_dex
    defined = set(classes_in_dex(open(dexfile, 'rb').read()))
    need = set()
    for p in allcls:
        rel = os.path.relpath(p, os.path.join(STAGE, 'classes'))
        rel = rel.replace(os.sep, '/').replace('.class', '')
        # javac -d 已经按 package 建了目录，rel 本身就是全限定名，别再拼一次包名
        need.add('L' + rel + ';')
    missing = sorted(need - defined)
    ok &= ck(not missing, 'dex 类定义齐全 (%d 个)，缺 %r' % (len(defined), missing[:5]))
    third = [c for c in defined if any(k in c.lower() for k in
             ('umeng', 'tencent/qq', 'bytedance', 'alibaba', 'google/android/gms', 'facebook'))]
    ok &= ck(not third, 'dex 无第三方 SDK 类')
    size = os.path.getsize(FINAL)
    if has_neuro:
        ok &= ck(20 * 1048576 < size < 90 * 1048576,
                 'APK 体积 %.1f MB（含 32 MB 模型与 sherpa 引擎）' % (size / 1048576))
    else:
        # 不带模型时 dex 里仍有 sherpa + kotlin 的类，所以下限放宽到 8 MB 以内
        ok &= ck(50 * 1024 < size < 8 * 1024 * 1024, 'APK 体积 %.1f MB' % (size / 1048576))
    text = '\n'.join(lines) + '\n' + ('ALL PASS' if ok else 'HAS FAIL') + '\n'
    io.open(os.path.join(PKG_DIR, 'apk_audit.txt'), 'w', encoding='utf-8').write(text)
    assert ok, 'APK 体检有 FAIL'
    return True


def main():
    for t in (JAVAC, AAPT2, D8, ZIPALIGN, APKSIGNER, JAR, KS):
        assert os.path.exists(t), '缺工具: ' + t
    neuro_compile_deps()          # 缺 AAR 就直接报清楚，别拖到 javac 报一堆符号找不到
    src, res, assets = prepare_sources()
    if neuro_available()[0]:
        stage_voice_model(assets)
    make_icons(res)
    allcls, dexfile, has_neuro = build(src, res, assets)
    audit(allcls, dexfile, has_neuro)
    print('\n=== APK 全部通过 ===\n成品: %s (%.1f MB)' %
          (FINAL, os.path.getsize(FINAL) / 1048576), flush=True)


if __name__ == '__main__':
    main()
