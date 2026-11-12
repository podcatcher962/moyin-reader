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
    # 这个文件在构建目录下（仓库之外），不会被提交。
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
# MOYIN_DIAG=1 打「三色探针包」：窗口底色蓝、WebView 底色品红、页面顶部压一块米黄说明牌，
# 再配 Toast 报启动步骤。专治「没有 adb、只看得见一片颜色」的机器。正式构建不设这个变量，
# 走的完全是原来那条路，产物不受任何影响。
DIAG = os.environ.get('MOYIN_DIAG') == '1'
FINAL = os.path.join(ROOT, 'MoYinReader-diag.apk' if DIAG else 'MoYinReader.apk')
STAGE = os.path.join(PKG_DIR, 'stage_' + time.strftime('%H%M%S'))

# ── 手机端离线神经语音：sherpa-onnx Android AAR + 小雅/超文/fanchen 三套中文模型 ──
# 引擎与模型只在打包时用，不进仓库。缺了也能打，只是 APK 里没有神经语音。
SHERPA = os.environ.get('MOYIN_SHERPA') or ''
if not SHERPA:
    # 依次找：构建目录 → 仓库旁的 _tools → 家目录下的 _tools；都没有就按构建目录算（后续会提示缺件）
    for _c in (os.path.join(AB, 'sherpa_android'),
               os.path.join(os.path.dirname(ROOT), '_tools', 'sherpa_android'),
               os.path.join(os.path.expanduser('~'), '_tools', 'sherpa_android')):
        if os.path.isdir(_c):
            SHERPA = _c
            break
    else:
        SHERPA = os.path.join(AB, 'sherpa_android')
SHERPA_AAR = os.path.join(SHERPA, 'aar')
SHERPA_JAR = os.path.join(SHERPA_AAR, 'classes.jar')
KOTLIN_JAR = os.path.join(SHERPA, 'kotlin-stdlib.jar')
# 目标架构。默认 arm64-v8a（真机）；设 MOYIN_ABI=x86_64 可打模拟器调试包。
# sherpa 的 aar 四套 ABI 都有，所以模拟器不必靠 ARM 转译，能原生跑 onnxruntime。
SHERPA_ABI = os.environ.get('MOYIN_ABI', 'arm64-v8a').strip()
if SHERPA_ABI != 'arm64-v8a':
    # 非真机架构的包不能和正式包同名，否则一次误操作就把发行包覆盖成模拟器版
    FINAL = os.path.join(ROOT, ('MoYinReader-diag' if DIAG else 'MoYinReader')
                         + '-' + SHERPA_ABI.split('_')[0] + '.apk')
SHERPA_LIBS = ['libonnxruntime.so', 'libsherpa-onnx-c-api.so',
               'libsherpa-onnx-cxx-api.so', 'libsherpa-onnx-jni.so']
# 三套模型：女主小雅（22.05 kHz）+ 男主超文（22.05 kHz）+ 配角库 fanchen（187 人，16 kHz）
VOICE_GIRL = os.path.join(ROOT, 'VoicePack', 'models', 'xiaoya')
VOICE_GIRL_FILES = ['model.onnx', 'lexicon.txt', 'tokens.txt',
                    'date.fst', 'number.fst', 'phone.fst']
VOICE_BOY = os.path.join(ROOT, 'VoicePack', 'models', 'chaowen')
VOICE_BOY_FILES = ['model.onnx']
# 小雅与超文共用一套词表与数字规则（两份模型逐字节同源），桌面端放在 models/shared，
# 入包时合并进 assets/tts/xiaoya/，手机端只需认一个目录。
VOICE_SHARED = os.path.join(ROOT, 'VoicePack', 'models', 'shared')
VOICE_SHARED_FILES = ['lexicon.txt', 'tokens.txt',
                      'date.fst', 'number.fst', 'phone.fst']
# 英文模型（VoicePack/models/en-ljs）暂不入安卓包：native generate 会偶发
# 把库锁死（见 TtsEngine.EN_ON 的说明）。桌面 EXE 照旧内置。
VOICE_EN = os.path.join(ROOT, 'VoicePack', 'models', 'en-ljs')
VOICE_EN_FILES = ['model.onnx', 'lexicon.txt', 'tokens.txt']
VOICE_LIB = os.path.join(ROOT, 'VoicePack', 'models', 'fanchen')

VOICE_LIB_FILES = ['model.onnx', 'lexicon.txt', 'tokens.txt',
                   'dict/jieba.dict.utf8', 'dict/hmm_model.utf8', 'dict/idf.utf8',
                   'dict/stop_words.utf8', 'dict/user.dict.utf8']
NEURO = '--no-neuro' not in sys.argv

os.environ['JAVA_HOME'] = JDK
os.environ['ANDROID_HOME'] = SDK
os.makedirs(STAGE, exist_ok=True)

MANIFEST = '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="%s"
    android:versionCode="11435"
    android:versionName="1.14.35">
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
    # 模板平时在构建目录里；换了台机器、构建目录重建过就会缺。仓库里留了一份同样的，
    # 优先用构建目录那份（可能是本地调过的），没有才回退，免得「打包脚本第一步就崩」。
    tpl = os.path.join(TPL, 'MainActivityHttp.java')
    if not os.path.isfile(tpl):
        tpl = os.path.join(PKG_DIR, 'MainActivityHttp.java')
        assert os.path.isfile(tpl), '两处都找不到 MainActivityHttp.java'
    s = io.open(tpl, encoding='utf-8').read()

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
        '            if (path.equals("/diag")) { bridge.handleDiag(c, method); return; }\n'
        '            if (path.equals("/warm")) { bridge.handleWarm(c, query, method); return; }\n'
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
    if DIAG:
        s = patch_diag(s)
    return s


def patch_diag(s):
    """三色探针：把「窗口 / WebView / 页面」三层分别染成不同颜色，
    再加上 Toast 步骤，手机上看一眼就知道卡在哪一层。只用在这条诊断分支上。"""
    def rep(old, new, tag):
        assert s.count(old) == 1, 'diag 锚点不唯一: %s count=%d' % (tag, s.count(old))
        return s.replace(old, new, 1)

    # 1) 整段换掉 onCreate：去掉「上次崩溃记忆」那条 return 分支（它会让机器卡在旧记录上）
    a = s.index('    @Override\n    protected void onCreate(Bundle b) {')
    b = s.index('    private void init() {')
    s = s[:a] + '''    /** 落盘：native 崩溃时 Toast 会跟着进程一起消失，只有写盘能留下来。
     *  用裸文件而不是 SharedPreferences —— 后者在部分 ROM 上 commit 会静默失败，
     *  而且读回来时如果被同一轮的写覆盖掉，就什么都看不到了。 */
    private void ds(String m) {
        try {
            java.io.FileOutputStream o =
                    new java.io.FileOutputStream(new java.io.File(getFilesDir(), "boot.txt"));
            o.write(m.getBytes("UTF-8"));
            o.flush();
            o.close();
            return;
        } catch (Throwable x) { }
        try {
            getSharedPreferences("moyin_boot", MODE_PRIVATE).edit()
                    .putString("last", m).commit();
        } catch (Throwable y) { }
    }

    private String readLast() {
        try {
            java.io.File f = new java.io.File(getFilesDir(), "boot.txt");
            if (f.exists() && f.length() > 0) {
                byte[] b = new byte[(int) f.length()];
                java.io.FileInputStream in = new java.io.FileInputStream(f);
                int n = in.read(b);
                in.close();
                if (n > 0) return new String(b, 0, n, "UTF-8");
            }
        } catch (Throwable x) { }
        try {
            String pv = getSharedPreferences("moyin_boot", MODE_PRIVATE).getString("last", "");
            return pv == null ? "" : pv;
        } catch (Throwable x) { return ""; }
    }

    /** 探针：不依赖任何布局，窗口没建好也能弹出来。 */
    private void dg(final String m) {
        ds(m);
        try {
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        android.widget.Toast.makeText(MainActivity.this, m,
                                android.widget.Toast.LENGTH_SHORT).show();
                    } catch (Throwable x) { }
                }
            });
        } catch (Throwable x) { }
    }

    @Override
    protected void onCreate(Bundle b) {
        // 先读、后写。顺序反了就永远是「1 进来了」，等于什么都没记。
        String pv = readLast();
        dg("诊断V7｜上次=「" + (pv.length() == 0 ? "无记录" : pv) + "」");
        try {
            super.onCreate(b);
            dg("2 窗口好了");
            init();
        } catch (Throwable t) {
            dg("X " + t.getClass().getSimpleName() + ": " + String.valueOf(t.getMessage()));
            try { saveCrash(t); } catch (Throwable x) { }
            try { showText("启动失败\\n\\n" + trace(t), false); } catch (Throwable x) { }
        }
    }

''' + s[b:]

    # 2) WebView 底色改成品红：页面一铺上来就看不见它了
    s = rep('web.setBackgroundColor(0xFF1B1C1F);',
            'web.setBackgroundColor(0xFFFF00FF);', 'webBg')

    # 3) 各步骤打点
    s = rep('        bridge = new TtsBridge(this);\n        web = new WebView(this);',
            '        dg("3 语音桥开始");\n'
            '        bridge = new TtsBridge(this);\n'
            '        dg("4 语音桥好了");\n'
            '        ds("4.9 准备 new WebView");\n'
            '        web = new WebView(this);\n'
            '        dg("5 WebView 建好了");', 'steps')
    s = rep('        WebSettings s = web.getSettings();',
            '        WebSettings s = web.getSettings();\n'
            '        ds("5.2 getSettings 拿到");', 'settings')
    s = rep('        web.setBackgroundColor(0xFFFF00FF);',
            '        web.setBackgroundColor(0xFFFF00FF);\n'
            '        ds("5.3 所有设置项配好");', 'setdone')
    s = rep('        web.setWebViewClient(new WebViewClient() {',
            '        ds("5.5 准备挂 WebViewClient");\n'
            '        web.setWebViewClient(new WebViewClient() {', 'client')
    s = rep('        setContentView(web);',
            '        ds("5.9 准备 setContentView");\n'
            '        setContentView(web);\n'
            '        dg("6 界面挂上了");', 'content')
    s = rep('                        if (p > 0) {\n',
            '                        if (p > 0) {\n'
            '                            dg("7 服务端口 " + p);\n', 'port')
    s = rep('                            fellBack = true;\n'
            '                        mainErr = false;    // 换一种方式重新加载，失败标记清零\n'
            '                            web.loadUrl("file:///android_asset/index.html");\n'
            '                        }\n'
            '                    }\n'
            '                });',
            '                            fellBack = true;\n'
            '                        mainErr = false;    // 换一种方式重新加载，失败标记清零\n'
            '                            web.loadUrl("file:///android_asset/index.html");\n'
            '                        }\n'
            '                        dg("7 服务没起来，改用本地文件");\n'
            '                    }\n'
            '                });', 'noport')
    s = rep('            public void onPageFinished(WebView v, String url) {',
            '            public void onPageFinished(WebView v, String url) {\n'
            '                dg("8 页面完成 " + url);', 'finished')
    s = rep('                if (r != null && r.isForMainFrame() && !fellBack) {',
            '                dg("E " + e.getErrorCode() + " " + e.getDescription());\n'
            '                if (r != null && r.isForMainFrame() && !fellBack) {', 'err')
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
    for src_dir, files in ((VOICE_GIRL, [VOICE_GIRL_FILES[0]]),
                           (VOICE_SHARED, VOICE_SHARED_FILES),
                           (VOICE_BOY, VOICE_BOY_FILES),
                           (VOICE_LIB, VOICE_LIB_FILES)):
        for f in files:
            p = os.path.join(src_dir, f)
            if not os.path.isfile(p):
                return False, '缺模型：' + p
    return True, ''


DIAG_NOTE_METHOD = '''
    /** 诊断用：把当前走到哪一步写进 boot.txt，下次启动由 MainActivity 读出来。 */
    private void note(String m) {
        try {
            java.io.FileOutputStream o = new java.io.FileOutputStream(
                    new java.io.File(act.getFilesDir(), "boot.txt"));
            o.write(m.getBytes("UTF-8"));
            o.flush();
            o.close();
        } catch (Throwable x) { }
    }
'''


def prepare_sources():
    src = os.path.join(STAGE, 'src')
    os.makedirs(src, exist_ok=True)
    main = patch_main()
    io.open(os.path.join(src, 'MainActivity.java'), 'w', encoding='utf-8').write(main)
    bridge = io.open(os.path.join(PKG_DIR, 'TtsBridge.java'), encoding='utf-8').read()
    bridge = bridge.replace('{PKG}', PKG)
    if DIAG:
        bridge = (bridge
                  .replace('{DIAG_NOTE_METHOD}', DIAG_NOTE_METHOD)
                  .replace('{DIAG_N1}', 'note("N1 开始建引擎对象");')
                  .replace('{DIAG_N2}', 'note("N2 引擎对象已建（so 要到 new OfflineTts 时才加载）");')
                  .replace('{DIAG_N3}', 'note("N3 模型加载返回 ok=" + ok);'))
    else:
        for k in ('{DIAG_NOTE_METHOD}', '{DIAG_N1}', '{DIAG_N2}', '{DIAG_N3}'):
            bridge = bridge.replace(k, '')
    assert '{DIAG' not in bridge, '诊断占位符没清干净'
    io.open(os.path.join(src, 'TtsBridge.java'), 'w', encoding='utf-8').write(bridge)
    engine = io.open(os.path.join(PKG_DIR, 'TtsEngine.java'), encoding='utf-8').read()
    engine = engine.replace('{PKG}', PKG)
    engine = engine.replace('{DIAG_ON}', 'true' if DIAG else 'false')
    io.open(os.path.join(src, 'TtsEngine.java'), 'w', encoding='utf-8').write(engine)
    # 男声降噪：与桌面 VoicePack/denoise.py 对应的 Java 实现，无占位符，直接拷贝
    denoise = io.open(os.path.join(PKG_DIR, 'Denoise.java'), encoding='utf-8').read()
    io.open(os.path.join(src, 'Denoise.java'), 'w', encoding='utf-8').write(denoise)
    io.open(os.path.join(STAGE, 'AndroidManifest.xml'), 'w', encoding='utf-8').write(MANIFEST)
    # res
    res = os.path.join(STAGE, 'res')
    for sub, f in [('values/themes.xml', 'themes.xml'), ('values/colors.xml', 'colors.xml')]:
        d = os.path.join(res, os.path.dirname(sub))
        os.makedirs(d, exist_ok=True)
        shutil.copy(os.path.join(TPL, f), os.path.join(res, sub))
    if DIAG:
        # 窗口底色染成深蓝：只要屏幕是蓝的，就说明 setContentView 压根没跑
        p = os.path.join(res, 'values', 'colors.xml')
        x = io.open(p, encoding='utf-8').read().replace('#F2E6CD', '#0033CC')
        io.open(p, 'w', encoding='utf-8').write(x)
    # assets（逐字节，稍后要和源文件比对 md5）
    assets = os.path.join(STAGE, 'assets')
    os.makedirs(assets, exist_ok=True)
    shutil.copy2(HTML, os.path.join(assets, 'index.html'))
    if DIAG:
        stage_diag_page(os.path.join(assets, 'index.html'))
    return src, res, assets


DIAG_CARD = '''<div id="__dg" style="position:fixed;left:0;top:0;right:0;z-index:2147483647;background:#EDE3CE;color:#3A3227;font:14px/1.6 sans-serif;padding:14px 18px;box-sizing:border-box;box-shadow:0 3px 10px rgba(0,0,0,.28)"><b id="__dgs">诊断中…</b><div id="__dge" style="margin-top:6px;color:#B00020;font-size:12px;white-space:pre-wrap;word-break:break-all"></div><div style="margin-top:8px;font-size:12px;color:#6F6150">点这条可以收起（正常进界面后它会自己消失）</div></div><script>(function(){var d=document.getElementById('__dg'),s=document.getElementById('__dgs'),e=document.getElementById('__dge');var n=0;function tick(){n++;var r=document.documentElement.getAttribute('data-ready');if(r==='1'){s.textContent='页面脚本已跑完（data-ready=1），诊断条自动收起';setTimeout(function(){d.style.display='none';},900);return;}s.textContent='已过 '+(n*0.5).toFixed(1)+' 秒 · data-ready 还没出现 · 说明 init() 卡住了';}var t=setInterval(tick,500);tick();d.addEventListener('click',function(){d.style.display='none';});window.addEventListener('error',function(ev){try{e.textContent+=String(ev.message)+'\\n'+(ev.filename||'')+':'+(ev.lineno||'')+'\\n';}catch(x){}},true);window.addEventListener('unhandledrejection',function(ev){try{e.textContent+='Promise: '+String(ev.reason)+'\\n';}catch(x){}},true);})();</script>'''


def stage_diag_page(path):
    """往页面 <body> 最前面压一块说明牌，顺带把 JS 报错显示在上面。"""
    s = io.open(path, encoding='utf-8').read()
    i = s.index('<body')
    j = s.index('>', i) + 1
    s = s[:j] + DIAG_CARD + s[j:]
    io.open(path, 'w', encoding='utf-8').write(s)


def stage_voice_model(assets):
    """三套模型分别拷进 assets/tts/xiaoya、/chaowen、/fanchen，
    首次启动由 TtsEngine 解压到私有目录（男主和配角库等真正选中时才解压）。
    小雅的词表在 models/shared，入包时与 model.onnx 并进同一个目录。"""
    plan = (
        ('xiaoya', ((VOICE_GIRL, [VOICE_GIRL_FILES[0]]),
                    (VOICE_SHARED, VOICE_SHARED_FILES))),
        ('chaowen', ((VOICE_BOY, VOICE_BOY_FILES),)),
        ('fanchen', ((VOICE_LIB, VOICE_LIB_FILES),)),
        ('en', ((VOICE_EN, VOICE_EN_FILES),)),
    )
    total = 0
    for sub, groups in plan:
        dst = os.path.join(assets, 'tts', sub)
        os.makedirs(dst, exist_ok=True)
        n = 0
        for src_dir, files in groups:
            for f in files:
                src = os.path.join(src_dir, f)
                out = os.path.join(dst, f)
                parent = os.path.dirname(out)
                if parent and not os.path.isdir(parent):
                    os.makedirs(parent, exist_ok=True)
                shutil.copy2(src, out)
                total += os.path.getsize(src)
                n += 1
        print('  %-9s 入包 %d 个文件' % (sub, n), flush=True)
    print('  语音模型合计：%.1f MB' % (total / 1048576), flush=True)
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
        # 诊断包成品名不同，图标一律从正式包 MoYinReader.apk 里取。
        src_apk = FINAL if os.path.isfile(FINAL) else os.path.join(ROOT, 'MoYinReader.apk')
        assert os.path.isfile(src_apk), '没有 Pillow，也找不到上一版 APK 复用图标'
        got = 0
        with zipfile.ZipFile(src_apk) as z:
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
            os.path.join(src, 'TtsEngine.java'), os.path.join(src, 'Denoise.java')]
    # 编译期永远要这两个 jar（TtsEngine 直接调 sherpa 的 Kotlin API）；
    # has_neuro 只决定 so 和两套语音模型要不要进包。
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
    if DIAG:
        ok &= ck(md5(page) != md5(src), '诊断包页面已注入说明牌（与源文件本就不同）')
    else:
        ok &= ck(md5(page) == md5(src), '内嵌页面与源文件逐字节一致 md5=' + md5(page))
    ok &= ck('classes.dex' in names, 'dex 已打包')
    if has_neuro:
        allowed = ({'assets/index.html'}
                   | {'assets/tts/xiaoya/' + f for f in VOICE_GIRL_FILES}
                   | {'assets/tts/chaowen/' + f for f in VOICE_BOY_FILES}
                   | {'assets/tts/fanchen/' + f for f in VOICE_LIB_FILES}
                   | {'assets/tts/en/' + f for f in VOICE_EN_FILES}
)
        extra = sorted(set(n for n in names if n.startswith('assets/')) - allowed)
        ok &= ck(not extra, 'assets 只有页面与三套语音模型，多余项 %r' % extra[:3])
        ok &= ck(all('assets/tts/xiaoya/' + f in names for f in VOICE_GIRL_FILES),
                 '女主（小雅）6 个文件齐全')
        ok &= ck(all('assets/tts/chaowen/' + f in names for f in VOICE_BOY_FILES),
                 '男主（超文）模型齐全')
        ok &= ck(all('assets/tts/fanchen/' + f in names for f in VOICE_LIB_FILES),
                 '配角库（fanchen 187 人）8 个文件齐全')
        ok &= ck(all('assets/tts/en/' + f in names for f in VOICE_EN_FILES),
                 '英文模型 3 个文件齐全')
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
        # 上限放到 175 MB：配角库改回原版 fp32（121 MB）后成品约 158 MB。
        # 体积换音质是刻意的取舍——压缩过的 int8 版实测字错率翻倍（11% → 25%），
        # 耳朵里就是「每句有几个字囫囵吞枣」，再多省 80 MB 也不值得。
        ok &= ck(20 * 1048576 < size < 175 * 1048576,
                 'APK 体积 %.1f MB（含 209 MB 语音模型与 sherpa 引擎）' % (size / 1048576))
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
