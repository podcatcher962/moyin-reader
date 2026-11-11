package {PKG};

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 单文件 HTML 的安卓壳：页面整个内嵌进 assets，启动时在 127.0.0.1 起一个
 * 极小 HTTP 服务，页面从 http://127.0.0.1:<port>/ 进来。
 *
 * 为什么不用 file:///android_asset/index.html：
 *   file:// 不是「安全上下文」——localStorage 行为受限、跨域 XHR 被
 *   setAllowUniversalAccessFromFileURLs 在 targetSdk>=30 后被忽略，
 *   hls.js 拉 m3u8 会被 CORS 拦掉，电台放不出来。
 *   走 127.0.0.1 就是正经 http 来源，跟电脑桌面版完全同构。
 *
 * ══════════════════════════════════════════════════════════════════
 *  安全模型（写这个文件的人请先读完再改）
 * ══════════════════════════════════════════════════════════════════
 *  1. 服务只 bind 127.0.0.1，不对外，也不监听任何其他网卡。
 *  2. **不使用 addJavascriptInterface** —— 那是 WebView 里最经典的攻击面
 *     （API<17 上任意方法可被反射调用、任意页面都能碰到）。
 *     需要跟页面通信的地方，全部走「页面主动 fetch 本地 HTTP」这一条路。
 *  3. 写文件的口子只有一个：POST /__save。它必须同时过四道门：
 *       a. 方法必须是 POST（GET 一律 405，不做任何事）
 *       b. ?token= 必须等于本次启动随机生成的令牌（见 saveToken）
 *          —— 令牌**只通过 evaluateJavascript 注入给内嵌页面**，
 *             不写在 HTML 里，所以任何别的浏览器/App 拿不到它；
 *       c. Origin 头若存在，必须是本机这一个来源
 *       d. 文件名过白名单（只允许音频与纯文本后缀），大小有上限
 *  4. 落盘只落在「下载」目录下的两个固定子目录，文件名做净化，
 *     拒绝路径分隔符、拒绝以点开头（防 . 与 .. ），不做任何覆盖。
 *  5. 读接口只读 assets 里自己打包进去的文件，且拒绝 .. 与反斜杠。
 */
public class MainActivity extends Activity {
    private WebView web;
    private ServerSocket server;
    private int port = 0;
    /** 同时处理的连接数：页面会为「下一句」「下下句」各排一条 /tts。 */
    private final java.util.concurrent.atomic.AtomicInteger serving =
            new java.util.concurrent.atomic.AtomicInteger();
    private static final int MAX_SERVE = 6;
    private volatile boolean fellBack = false;      // 是否已退回 file:// 加载
    private volatile boolean pageOk = false;        // 页面是否已经加载出来
    private volatile boolean mainErr = false;       // 主框架加载失败过（错误页同样会触发 onPageFinished）

    /** 每次启动随机生成；只在注入脚本里给内嵌页面，绝不写进 HTML。 */
    private String saveToken = null;
    /** 单个文件上限：300 MB（录音再长也够了，同时挡住拿它当磁盘写的行为） */
    private static final long MAX_SAVE = 300L * 1024 * 1024;
    /** 允许落盘的后缀白名单（音频 / 纯文本）。其余一律拒绝。 */
    private static final String AUDIO_EXT = "|mp3|aac|ogg|webm|m4a|mp4|wav|opus|flac|mka|";
    private static final String DOC_EXT = "|json|txt|m3u|csv|";

    private android.webkit.ValueCallback<Uri[]> filePathCallback;
    private static final int REQ_FILE = 4001;
    /**
     * 「导入文件夹」走系统目录选择器（SAF）。
     *
     * 页面里的 <input webkitdirectory> 在安卓 WebView 上根本不生效——点下去只会
     * 弹出普通的多选文件框，用户还得进两层目录自己挑，跟「导入文件夹」四个字对不上。
     * 所以这里自己接一个：选目录 → 原生递归扫出 .txt/.epub → 页面按名字和大小列出来
     * 确认 → 逐个从本地端点取字节，走跟单选导入完全一样的入库流程。
     */
    private static final int REQ_DIR = 4002;
    /** 扫描结果：顺序一一对应。体积只看 DocumentFile 报的大小，不读内容。 */
    private final java.util.ArrayList<Uri> dirUris = new java.util.ArrayList<Uri>();
    private final java.util.ArrayList<String> dirNames = new java.util.ArrayList<String>();
    private final java.util.ArrayList<Long> dirSizes = new java.util.ArrayList<Long>();
    private String dirRoot = "";
    private String dirErr = "";
    private int dirSkipped = 0;

    private static final Map<String, String> MIME = new HashMap<String, String>();
    static {
        MIME.put("html", "text/html; charset=utf-8");
        MIME.put("htm", "text/html; charset=utf-8");
        MIME.put("js", "application/javascript; charset=utf-8");
        MIME.put("css", "text/css; charset=utf-8");
        MIME.put("json", "application/json; charset=utf-8");
        MIME.put("webmanifest", "application/manifest+json; charset=utf-8");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("ico", "image/x-icon");
        MIME.put("svg", "image/svg+xml");
        MIME.put("mp3", "audio/mpeg");
        MIME.put("m4a", "audio/mp4");
        MIME.put("ttf", "font/ttf");
        MIME.put("woff2", "font/woff2");
    }

    @Override
    protected void onCreate(Bundle b) {
        // 连 super 一起包住：主题/资源层面的问题也要能显示出来，而不是静默退出
        try {
            super.onCreate(b);

            // 上一轮如果崩过，这一屏直接把栈打出来 —— 没 adb 也能自己报错
            final String prev = readLastCrash();
            if (prev != null) {
                showText("上一次运行崩了（点屏幕清掉，再进一次）\n\n" + prev, true);
                return;
            }
            init();
        } catch (Throwable t) {
            try {
                saveCrash(t);
                showText("启动失败（把这段发给阿砚）\n\n" + trace(t), false);
            } catch (Throwable x) { }
        }
    }

    private void init() {
        // 任何线程上没接住的异常都落盘，下次进来就能看见
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread t, Throwable e) {
                saveCrash(e);
                android.os.Process.killProcess(android.os.Process.myPid());
            }
        });

        saveToken = UUID.randomUUID().toString().replace("-", "")
                  + Long.toHexString(System.nanoTime());

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // 兜底用 file:// 时也要能读 assets、也要能用 localStorage，
        // 所以文件访问保持打开（页面是我们自己内嵌的，没有外部内容）
        s.setAllowFileAccess(true);
        // 页面里三个 <input type=file>（恢复备份 / 导入音频）要靠它读用户选中的 content://
        s.setAllowContentAccess(true);
        // targetSdk>=30 上这一项已被系统强制忽略；留着只为极端情况下的 file:// 兜底
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setBackgroundColor(0xFF1B1C1F);

        // 权限请求：一律拒绝。
        // 页面里 getUserMedia / mediaDevices / Notification / geolocation 出现次数**都是 0**，
        // 「边听边录」抓的是播放流（captureStream），不需要任何系统权限。
        // 既然一次都用不到，就别留「默认放行」这种后门 —— 真需要时再明确放开。
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                try { r.deny(); } catch (Throwable t) { }
            }

            /**
             * 页面里 <input type=file> 不接这个回调的话，点了**完全没反应**。
             * 只在用户主动点击时打开系统选择器；类型不做过滤，见下方说明。
             */
            @Override
            public boolean onShowFileChooser(WebView v,
                    android.webkit.ValueCallback<Uri[]> cb,
                    FileChooserParams params) {
                try {
                    if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                    filePathCallback = cb;

                    /**
                     * 只让 TXT / EPUB 出现在选择器里，PDF 这类干脆不显示。
                     *
                     * 踩过两次坑，原因都在 MIME：
                     * 1) 早先按 accept 里的 .epub 过滤，而 application/epub+zip 在不少
                     *    定制系统（小米 / HyperOS、部分华为）的 MIME 库里没登记，于是
                     *    目录里明明躺着 epub，选择器一个都不显示——用户以为「读不了 epub」。
                     * 2) 1.14.19 干脆放开成「所有文件」，epub 回来了，但 PDF、图片、
                     *    压缩包也跟着涌进列表，选到 PDF 就是「读不了」，同样是残缺感。
                     *
                     * 现在用 EXTRA_MIME_TYPES 列一个白名单：epub 在国产 ROM 上常被判成
                     * application/octet-stream 或 zip（这就是第 1 条的原因），所以把这几种
                     * 形态一并列上；PDF 是 application/pdf，不在名单里，自然就不显示了。
                     * 万一某台机器把 epub 判成了别的类型，还有「导入文件夹」可以兜底
                     * （那个是选目录，按扩展名扫，与 MIME 无关）。
                     */
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                            "text/plain",
                            "application/epub+zip",
                            "application/octet-stream",
                            "application/zip",
                            "application/x-zip-compressed"
                    });
                    boolean many = params != null
                            && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE;
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, many);
                    startActivityForResult(Intent.createChooser(i, "选文件"), REQ_FILE);
                    return true;
                } catch (Throwable t) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) {
                // 加载失败时 WebView 会显示一张自带的错误页，onPageFinished 照样触发。
                // 以前无条件置 true，兜底倒计时就被这张错误页取消了 —— 表现为永远白屏。
                if (!mainErr) pageOk = true;
                // 只在正经 http 来源下挂「存到手机」；file:// 兜底模式下服务本来就没起来
                if (url != null && url.startsWith("http://127.0.0.1")) {
                    injectSaveHook();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String h = u.getHost();
                /* 页面要「选文件夹」时跳一下这个自定义 scheme，我们拦下来开系统选择器。
                   不用 addJavascriptInterface（那是 WebView 最经典的攻击面），
                   一个自定义协议就够传这个意图。 */
                if ("moyin".equals(u.getScheme())) {
                    if ("pick-dir".equals(h)) pickFolder();
                    return true;
                }
                if (h != null && (h.equals("127.0.0.1") || h.equals("localhost"))) {
                    return false;                       // 自己的页面，照常加载
                }
                String p = u.getScheme();
                if ("file".equals(p)) {
                    return false;                       // 兜底页面
                }
                if ("http".equals(p) || "https".equals(p)) {
                    try {                            // 站外链接丢给系统浏览器
                        startActivity(new Intent(Intent.ACTION_VIEW, u));
                    } catch (Exception e) { /* 没有浏览器就算了 */ }
                    return true;
                }
                return false;
            }

            /**
             * 兜底：个别手机上安全软件会拦 WebView 的 127.0.0.1（电脑上真发生过），
             * 表现为窗口正常但页面永远转圈。主框架一旦出错就退回本地文件方式加载，
             * 保证「至少能用」——虽然跨域 XHR（hls.js 拉 m3u8）在 file:// 下可能被拦。
             */
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r,
                                        android.webkit.WebResourceError e) {
                if (r != null && r.isForMainFrame() && !fellBack) {
                    String u = String.valueOf(r.getUrl());
                    mainErr = true;
                    if (u.startsWith("http://127.0.0.1")) {
                        fellBack = true;
                        mainErr = false;    // 换一种方式重新加载，失败标记清零
                        v.loadUrl("file:///android_asset/index.html");
                    }
                }
            }
        });

        setContentView(web);

        // ★ bind 必须离开主线程：Android 把 ServerSocket 的 bind 也算「网络操作」，
        //   在主线程上做会直接 NetworkOnMainThreadException —— 表现就是点开图标立刻闪退。
        new Thread(new Runnable() {
            public void run() {
                bindServer();
                final int p = port;
                runOnUiThread(new Runnable() {
                    public void run() {
                        if (p > 0) {
                            web.loadUrl("http://127.0.0.1:" + p + "/index.html");
                            // 8 秒还没出页面就换file://：防「本地服务被安全软件拦 → 一直转圈」
                            web.postDelayed(new Runnable() {
                                public void run() {
                                    if (!pageOk && !fellBack) {
                                        fellBack = true;
                        mainErr = false;    // 换一种方式重新加载，失败标记清零
                                        web.loadUrl("file:///android_asset/index.html");
                                    }
                                }
                            }, 8000);
                        } else {
                            fellBack = true;
                        mainErr = false;    // 换一种方式重新加载，失败标记清零
                            web.loadUrl("file:///android_asset/index.html");
                        }
                    }
                });
            }
        }).start();
    }
    // ── 「存到手机」：把页面里的 blob 搬进下载目录 ─────────────────────
    //
    //  Android WebView 不支持 <a href="blob:…" download> 下载，连
    //  setDownloadListener 对 blob: 都不会被调用。所以做法是：注入一小段脚本，
    //  只在「href 是 blob: 且带 download 属性」时把它拦下来，自己 fetch 取字节
    //  POST 给本地服务落盘；其它一切点击原样放行（保留回退，不改页面行为）。
    private void injectSaveHook() {
        if (saveToken == null) return;
        String js =
            "(function(){"
          + "if(window.__xianSave)return;"
          + "if(location.protocol!=='http:')return;"
          + "window.__xianSave=1;"
          + "var TK='" + saveToken + "';"
          + "/* 网盘同步：WebDAV 对方不发 CORS 头，页面里 fetch 必被拦，交给 Java 发 */"
          + "window.__moyinWebdav=function(o){"
          + "  return fetch('/__webdav?token='+TK,{method:'POST',"
          + "    headers:{'Content-Type':'application/json'},"
          + "    body:JSON.stringify(o||{})}).then(function(r){"
          + "      return r.text().then(function(s){"
          + "        var j={};try{j=JSON.parse(s);}catch(e){throw new Error('通道返回异常');}"
          + "        if(j.error)throw new Error(j.error);"
          + "        return {status:(j.status|0),body:j.body||''};"
          + "      });"
          + "  });"
          + "};"
          + "var say=function(m,t){try{if(typeof toast==='function')toast(m,t||3500);}catch(e){}};"
          + "var orig=HTMLAnchorElement.prototype.click;"
          + "function back(el,why){say('没存成（'+(why||'没连上')+'），已改走原来的方式',4200);"
          + "try{orig.apply(el,[]);}catch(e){}}"
          + "function push(el,h,nm){"
          + "  say('正在存到手机……',2200);"
          + "  fetch(h).then(function(r){return r.blob();}).then(function(b){"
          + "    return fetch('/__save?token='+TK+'&name='+encodeURIComponent(nm),"
          + "      {method:'POST',body:b,"
          + "       headers:{'Content-Type':'application/octet-stream'}});"
          + "  }).then(function(r){return r.text().then(function(s){"
          + "      return {t:s||'',st:r.status};});}).then(function(o){"
          + "    if(o.t.indexOf('ok:')===0){"
          + "      say('已存到手机：'+o.t.slice(3)+'（用文件管理器打开「下载」就能看到）',5200);"
          + "    } else { back(el, o.st+' '+o.t); }"
          + "  }).catch(function(){ back(el, ''); });"
          + "}"
          + "HTMLAnchorElement.prototype.click=function(){"
          + "  try{var h=this.href||'';var nm=this.getAttribute('download');"
          + "    if(nm&&h.indexOf('blob:')===0){push(this,h,nm);return;}}catch(e){}"
          + "  return orig.apply(this,arguments);"
          + "};"
          + "/* 「导入文件夹」：安卓 WebView 不支持 webkitdirectory，点下去只出普通多选框。"
          + "   这里把意图转成自定义 scheme 交给原生（开系统目录选择器、递归扫描），"
          + "   原生扫完回调 __moyinDirDone，再来取列表和每个文件的字节。 */"
          + "window.__moyinPickDir=function(){"
          + "  if(window.__moyinPicking) return Promise.resolve({cancel:true});"
          + "  window.__moyinPicking=1;"
          + "  return new Promise(function(res){"
          + "    window.__moyinDirDone=function(){"
          + "      window.__moyinPicking=0;"
          + "      fetch('/__dir?token='+TK).then(function(r){return r.json();}).then(function(j){"
          + "        if(j.cancel){res({cancel:true});return;}"
          + "        if(j.error){res({files:[],error:j.error,dir:j.dir||''});return;}"
          + "        var files=(j.files||[]).map(function(f){return {"
          + "          name:f.name,size:f.size,"
          + "          arrayBuffer:function(){return fetch('/__dirfile?token='+TK+'&i='+f.i)"
          + "            .then(function(r){if(!r.ok)throw new Error('读取失败 '+r.status);return r.arrayBuffer();});}"
          + "        };});"
          + "        res({dir:j.dir,files:files,skipped:j.skipped});"
          + "      }).catch(function(e){res({files:[],error:String((e&&e.message)||e)});});"
          + "    };"
          + "    try{location.href='moyin://pick-dir';}"
          + "    catch(e){window.__moyinPicking=0;res({cancel:true});}"
          + "  });"
          + "};"
          + "})();";
        try { web.evaluateJavascript(js, null); } catch (Throwable t) { }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_DIR) {
            dirUris.clear(); dirNames.clear(); dirSizes.clear();
            dirSkipped = 0; dirErr = ""; dirRoot = "";
            if (res == RESULT_OK && data != null && data.getData() != null) {
                Uri tree = data.getData();
                try {
                    // 记下长期读权限：下次在同一台手机上还能读这个目录
                    getContentResolver().takePersistableUriPermission(
                            tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Throwable t) { }
                try {
                    dirRoot = android.provider.DocumentsContract.getTreeDocumentId(tree);
                    scanTree(tree, dirRoot, 0);
                } catch (Throwable t) {
                    dirErr = "扫描失败：" + t.getMessage();
                }
            } else {
                dirErr = "cancel";
            }
            notifyDirDone();
            return;
        }
        if (req != REQ_FILE) {
            super.onActivityResult(req, res, data);
            return;
        }
        Uri[] out = null;
        try {
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    if (n > 0) {
                        out = new Uri[n];
                        for (int i = 0; i < n; i++) {
                            out[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                } else if (data.getData() != null) {
                    out = new Uri[] { data.getData() };
                }
            }
        } catch (Throwable t) {
            out = null;
        }
        // 无论如何都要回一次，否则页面那个 input 会一直卡在禁用状态
        try { if (filePathCallback != null) filePathCallback.onReceiveValue(out); }
        catch (Throwable t) { }
        filePathCallback = null;
    }

    // ── 崩溃自留证：没有 adb 也能把原因显示在屏幕上 ─────────────────────
    private String crashFile() {
        return new File(getFilesDir(), "last_crash.txt").getAbsolutePath();
    }

    private static String trace(Throwable t) {
        java.io.StringWriter sw = new java.io.StringWriter();
        t.printStackTrace(new java.io.PrintWriter(sw));
        String s = sw.toString();
        return s.length() > 4000 ? s.substring(0, 4000) : s;
    }

    private void saveCrash(Throwable t) {
        try {
            FileOutputStream fo = new FileOutputStream(crashFile());
            fo.write(trace(t).getBytes("UTF-8"));
            fo.close();
        } catch (Throwable x) { }
    }

    private String readLastCrash() {
        try {
            File f = new File(crashFile());
            if (!f.exists()) return null;
            byte[] buf = new byte[(int) f.length()];
            InputStream in = new java.io.FileInputStream(f);
            int n = in.read(buf);
            in.close();
            return n > 0 ? new String(buf, 0, n, "UTF-8") : null;
        } catch (Throwable x) {
            return null;
        }
    }

    private void showText(String msg, final boolean tapToClear) {
        android.widget.ScrollView sv = new android.widget.ScrollView(this);
        android.widget.TextView tv = new android.widget.TextView(this);
        tv.setText(msg);
        tv.setTextSize(11f);
        tv.setTextColor(0xFFE8E8E8);
        tv.setPadding(28, 28, 28, 28);
        sv.setBackgroundColor(0xFF1B1C1F);
        sv.addView(tv);
        if (tapToClear) {
            sv.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    try { new File(crashFile()).delete(); } catch (Throwable x) { }
                    recreate();
                }
            });
        }
        setContentView(sv);
    }

    // ── 极小 HTTP 服务（读 assets + 一个写口）───────────────────────────

    private void bindServer() {
        // 端口固定：来源（origin）稳定，收藏/主题才不会每次启动都换一份存储。
        // 万一被占就退回随机端口，功能不受影响。**这个方法只在后台线程里调。**
        int[] tries = new int[] { {PORT}, 0 };
        for (int i = 0; i < tries.length && server == null; i++) {
            try {
                ServerSocket ss = new ServerSocket(tries[i], 16,
                        InetAddress.getByName("127.0.0.1"));
                server = ss;
                port = ss.getLocalPort();
            } catch (Exception e) {
                server = null;
            }
        }
        if (server == null) {
            port = 0;
            return;
        }
        Thread t = new Thread(new Runnable() {
            public void run() {
                while (true) {
                    Socket c = null;
                    try {
                        c = server.accept();
                    } catch (Exception e) {
                        continue;
                    }
                    // 每条连接单开一条线程。
                    // 以前是 accept 之后原地 serve()：一个 /tts 要合成几秒，
                    // 这段时间整个服务是停的——分角色朗读时页面会同时排两条
                    // （旁白与对白各用一套模型），串行处理让「角色那句」永远
                    // 等在前一句合成完，听感就是换声前干等一大截。
                    final Socket cs = c;
                    if (serving.get() >= MAX_SERVE) { serve(cs); continue; }
                    serving.incrementAndGet();
                    try {
                        Thread w = new Thread(new Runnable() {
                            public void run() {
                                try { serve(cs); }
                                finally { serving.decrementAndGet(); }
                            }
                        }, "moyin-http");
                        w.setDaemon(true);
                        w.start();
                    } catch (Throwable e) {
                        serving.decrementAndGet();
                        serve(cs);
                    }
                }
            }
        });
        t.setDaemon(true);
        t.start();
    }

    /** 逐字节读到 \r\n\r\n 为止并返回请求头（不含正文，正文留在流里给后面精确读）。 */
    private static String readHead(InputStream in) throws Exception {
        ByteArrayOutputStream hb = new ByteArrayOutputStream();
        int state = 0, b, n = 0;
        while ((b = in.read()) >= 0) {
            if (++n > 16384) return null;               // 请求头不可能这么大
            hb.write(b);
            if (state == 0 && b == '\r') state = 1;
            else if (state == 1 && b == '\n') state = 2;
            else if (state == 2 && b == '\r') state = 3;
            else if (state == 3 && b == '\n') return hb.toString("UTF-8");
            else state = (b == '\r') ? 1 : 0;
        }
        return null;
    }

    private void serve(Socket c) {
        try {
            c.setSoTimeout(15000);
            InputStream in = c.getInputStream();
            String head = readHead(in);
            if (head == null) { c.close(); return; }
            String[] lines = head.split("\r\n");
            String[] parts = lines[0].split(" ");
            String method = parts.length >= 3 ? parts[0] : "GET";
            String target = parts.length >= 2 ? parts[1] : "/";
            int q = target.indexOf('?');
            String query = q >= 0 ? target.substring(q + 1) : "";
            String path = q >= 0 ? target.substring(0, q) : target;

            if (path.equals("/__save")) { handleSave(c, in, lines, method, query); return; }

            /* 网盘同步：页面发不出去，由这里代发（见 handleWebdav 注释） */
            if (path.equals("/__webdav")) { handleWebdav(c, in, lines, method, query); return; }

            /* 「导入文件夹」的两个读口，同样只认本次启动的令牌（书的内容不能给同机
               别的 App 读到）。都走 GET，只读不写。 */
            if (path.equals("/__dir") || path.equals("/__dirfile")) {
                String tk = qval(query, "token");
                if (saveToken == null || tk == null || !saveToken.equals(tk)) {
                    err(c, 403, "令牌不对");
                    return;
                }
                if (path.equals("/__dir")) { handleDirList(c); return; }
                handleDirFile(c, qval(query, "i"));
                return;
            }

            if (!"GET".equals(method) && !"HEAD".equals(method)) { err(c, 405, "只读"); return; }
            if (path.equals("/")) path = "/index.html";
            String rel = path.startsWith("/") ? path.substring(1) : path;
            if (rel.contains("..") || rel.indexOf('\\') >= 0) { err(c, 403, "路径不合法"); return; }

            InputStream a;
            try {
                a = getAssets().open(rel);
            } catch (Exception e) {
                err(c, 404, "没有这个文件");
                return;
            }
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            int n;
            while ((n = a.read(buf)) > 0) bos.write(buf, 0, n);
            a.close();
            byte[] body = bos.toByteArray();

            String ext = "";
            int d = rel.lastIndexOf('.');
            if (d >= 0) ext = rel.substring(d + 1).toLowerCase();
            String mime = MIME.containsKey(ext) ? MIME.get(ext)
                                                : "application/octet-stream";

            OutputStream out = c.getOutputStream();
            out.write(("HTTP/1.1 200 OK\r\nContent-Type: " + mime +
                       "\r\nContent-Length: " + body.length +
                       "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n")
                      .getBytes("UTF-8"));
            out.write(body);
            out.flush();
            c.close();
        } catch (Exception e) {
            try { c.close(); } catch (Exception x) { }
        }
    }

    // ── 「导入文件夹」：系统目录选择器 + 递归扫描 ─────────────────────────
    //
    //  项目是纯 javac 编译、不引任何第三方库，所以这里不使 androidx.documentfile，
    //  直接用 DocumentsContract 查游标，等价于 DocumentFile 的最小实现。
    private void pickFolder() {
        try {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            startActivityForResult(i, REQ_DIR);
        } catch (Throwable t) {
            dirErr = "这台手机打不开目录选择器：" + t.getMessage();
            notifyDirDone();
        }
    }
    private void notifyDirDone() {
        try { web.evaluateJavascript("window.__moyinDirDone&&window.__moyinDirDone()", null); }
        catch (Throwable t) { }
    }
    private static final class Ent {
        final String id, name, mime;
        final long size;
        Ent(String id, String name, String mime, long size) {
            this.id = id; this.name = name; this.mime = mime; this.size = size;
        }
    }
    private java.util.List<Ent> listChildren(Uri tree, String parentId) {
        java.util.ArrayList<Ent> out = new java.util.ArrayList<Ent>();
        Uri kids = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
        android.database.Cursor c = null;
        try {
            c = getContentResolver().query(kids, new String[] {
                    android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    android.provider.DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    android.provider.DocumentsContract.Document.COLUMN_MIME_TYPE,
                    android.provider.DocumentsContract.Document.COLUMN_SIZE
            }, null, null, null);
            while (c != null && c.moveToNext()) {
                String id = c.getString(0);
                String nm = c.getString(1);
                String mt = c.getString(2);
                long sz = c.isNull(3) ? 0L : c.getLong(3);
                out.add(new Ent(id == null ? "" : id, nm == null ? "" : nm,
                                mt == null ? "" : mt, sz));
            }
        } catch (Throwable t) {
            if (dirErr == null || dirErr.isEmpty()) dirErr = "读目录失败：" + t.getMessage();
        } finally {
            try { if (c != null) c.close(); } catch (Throwable t) { }
        }
        return out;
    }
    private void scanTree(Uri tree, String docId, int depth) {
        if (depth > 6 || dirNames.size() >= 500) return;
        for (Ent e : listChildren(tree, docId)) {
            if (dirNames.size() >= 500) return;
            if (android.provider.DocumentsContract.Document.MIME_TYPE_DIR.equals(e.mime)) {
                scanTree(tree, e.id, depth + 1);
                continue;
            }
            String low = e.name.toLowerCase();
            boolean book = low.endsWith(".txt") || low.endsWith(".text") || low.endsWith(".epub")
                    || (low.indexOf('.') < 0
                        && (e.mime.startsWith("text/") || "application/epub+zip".equals(e.mime)));
            if (!book) { dirSkipped++; continue; }
            if (e.size == 0) { dirSkipped++; continue; }
            dirUris.add(android.provider.DocumentsContract.buildDocumentUriUsingTree(tree, e.id));
            dirNames.add(e.name);
            dirSizes.add(e.size);
        }
    }
    /** 响应模板：静态资源那段是内联写的，这里抽一个给新端点复用。 */
    private void ok(Socket c, String mime, byte[] body) {
        try {
            OutputStream out = c.getOutputStream();
            out.write(("HTTP/1.1 200 OK\r\nContent-Type: " + mime +
                       "\r\nContent-Length: " + body.length +
                       "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n")
                      .getBytes("UTF-8"));
            out.write(body);
            out.flush();
            c.close();
        } catch (Throwable t) {
            try { c.close(); } catch (Throwable x) { }
        }
    }
    private void handleDirList(Socket c) {
        try {
            org.json.JSONObject o = new org.json.JSONObject();
            if ("cancel".equals(dirErr)) o.put("cancel", true);
            else if (dirErr != null && dirErr.length() > 0) o.put("error", dirErr);
            o.put("dir", dirRoot == null ? "" : dirRoot);
            o.put("skipped", dirSkipped);
            org.json.JSONArray arr = new org.json.JSONArray();
            for (int i = 0; i < dirNames.size(); i++) {
                org.json.JSONObject f = new org.json.JSONObject();
                f.put("i", i);
                f.put("name", dirNames.get(i));
                f.put("size", dirSizes.get(i));
                arr.put(f);
            }
            o.put("files", arr);
            ok(c, "application/json; charset=utf-8", o.toString().getBytes("UTF-8"));
        } catch (Throwable t) {
            err(c, 500, "列表生成失败");
        }
    }
    private void handleDirFile(Socket c, String idx) {
        try {
            int i = Integer.parseInt(idx == null ? "-1" : idx);
            if (i < 0 || i >= dirUris.size()) { err(c, 404, "没有这个文件"); return; }
            if (dirSizes.get(i) > 120L * 1024 * 1024) { err(c, 413, "文件太大"); return; }
            InputStream is = getContentResolver().openInputStream(dirUris.get(i));
            if (is == null) { err(c, 404, "打不开这个文件"); return; }
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            is.close();
            ok(c, "application/octet-stream", bos.toByteArray());
        } catch (Throwable t) {
            err(c, 500, "读取失败");
        }
    }

    // ── 网盘同步：代发一次 WebDAV 请求 ─────────────────────────────────
    //  页面碰不到 WebDAV：对方几乎都不发 Access-Control-Allow-Origin，WebView 直接拦在
    //  预检那一步。所以由 Java 发。只放 GET / PUT / POST / DELETE / HEAD 出去——
    //  HttpURLConnection 的 setRequestMethod 不接受 MKCOL / PROPFIND（会抛
    //  ProtocolException），所以页面侧也不用这两个方法（探测用 GET，目录要么留空
    //  要么先在网盘里建好）。
    private static final long MAX_WD = 4L * 1024 * 1024;

    private void handleWebdav(Socket c, InputStream in, String[] lines,
                              String method, String query) {
        if (!"POST".equals(method)) { err(c, 405, "只收 POST"); return; }
        String token = qval(query, "token");
        if (saveToken == null || token == null || !saveToken.equals(token)) {
            err(c, 403, "令牌不对");
            return;
        }
        String origin = header(lines, "origin");
        if (origin != null && !origin.equals("http://127.0.0.1:" + port)) {
            err(c, 403, "来源不对");
            return;
        }
        long len;
        try {
            len = Long.parseLong(String.valueOf(header(lines, "content-length")).trim());
        } catch (Exception e) { err(c, 411, "缺长度"); return; }
        if (len <= 0 || len > MAX_WD) { err(c, 413, "太大或太小"); return; }

        String json;
        try {
            c.setSoTimeout(90000);        // 网盘慢起来比本地读文件慢得多
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            long left = len;
            int got;
            while (left > 0 && (got = in.read(buf, 0, (int) Math.min(buf.length, left))) > 0) {
                bos.write(buf, 0, got); left -= got;
            }
            json = new String(bos.toByteArray(), "UTF-8");
        } catch (Exception e) { err(c, 500, "读不到请求"); return; }

        String mtd = jstr(json, "method");
        String url = jstr(json, "url");
        String body = jstr(json, "body");
        if (mtd == null) mtd = "GET";
        mtd = mtd.trim().toUpperCase();
        if (url == null) url = "";
        String low = url.toLowerCase();
        if (!(low.startsWith("http://") || low.startsWith("https://"))) {
            jsonOut(c, "{\"error\":\"只支持 http / https 地址\"}");
            return;
        }
        if (!("GET".equals(mtd) || "PUT".equals(mtd) || "POST".equals(mtd)
                || "DELETE".equals(mtd) || "HEAD".equals(mtd))) {
            jsonOut(c, "{\"error\":\"Android 版不支持 " + mtd + "：把「远端目录」留空，或在网盘里先建好\"}");
            return;
        }

        int status = 0;
        String out = "";
        HttpURLConnection conn = null;
        try {
            URL u = new URL(url);
            conn = (HttpURLConnection) u.openConnection();
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(45000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestMethod(mtd);
            /* 关掉压缩协商：自己解压要多引一套代码，同步文件才几十 KB，不值 */
            conn.setRequestProperty("Accept-Encoding", "identity");
            Map<String, String> hs = jmap(json, "headers");
            for (Map.Entry<String, String> en : hs.entrySet()) {
                String k = en.getKey(), lk = k.toLowerCase();
                if (lk.equals("host") || lk.equals("content-length") || lk.equals("connection")) continue;
                conn.setRequestProperty(k, en.getValue());
            }
            if (body != null && body.length() > 0) {
                conn.setDoOutput(true);
                byte[] bs = body.getBytes("UTF-8");
                conn.setFixedLengthStreamingMode(bs.length);
                OutputStream os = conn.getOutputStream();
                os.write(bs); os.flush(); os.close();
            }
            status = conn.getResponseCode();
            InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (is != null) {
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                long tot = 0;
                int n2;
                while ((n2 = is.read(buf)) > 0) {
                    bos.write(buf, 0, n2); tot += n2;
                    if (tot > MAX_WD) break;      // 云端被人塞了个大文件也别把内存吃光
                }
                is.close();
                out = new String(bos.toByteArray(), "UTF-8");
            }
        } catch (Throwable t) {
            jsonOut(c, "{\"error\":\"" + jsonEsc("连不上：" + t) + "\"}");
            return;
        } finally {
            if (conn != null) conn.disconnect();
        }
        jsonOut(c, "{\"status\":" + status + ",\"body\":\"" + jsonEsc(out) + "\"}");
    }

    private void jsonOut(Socket c, String s) {
        try {
            byte[] b = s.getBytes("UTF-8");
            OutputStream out = c.getOutputStream();
            out.write(("HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
                     + "Content-Length: " + b.length + "\r\nConnection: close\r\n\r\n")
                      .getBytes("UTF-8"));
            out.write(b);
            out.flush();
            c.close();
        } catch (Exception e) {
            try { c.close(); } catch (Exception x) { }
        }
    }

    private static String jsonEsc(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (ch < 0x20) sb.append(String.format("\\u%04x", (int) ch));
                    else sb.append(ch);
            }
        }
        return sb.toString();
    }

    /* 取顶层字符串字段。项目不引 JSON 库（纯 javac 编译），同步用的信封就四个键，
       手写一遍比塞进来一个 gson 省 300 KB 体积。 */
    private static String jstr(String s, String key) {
        if (s == null) return null;
        String pat = "\"" + key + "\"";
        int i = s.indexOf(pat);
        while (i >= 0) {
            int j = i + pat.length();
            while (j < s.length() && Character.isWhitespace(s.charAt(j))) j++;
            if (j < s.length() && s.charAt(j) == ':') {
                j++;
                while (j < s.length() && Character.isWhitespace(s.charAt(j))) j++;
                if (j < s.length() && s.charAt(j) == '"') {
                    StringBuilder sb = new StringBuilder();
                    j++;
                    while (j < s.length()) {
                        char ch = s.charAt(j);
                        if (ch == '\\' && j + 1 < s.length()) {
                            char nx = s.charAt(j + 1);
                            if (nx == 'n') sb.append('\n');
                            else if (nx == 'r') sb.append('\r');
                            else if (nx == 't') sb.append('\t');
                            else if (nx == 'u' && j + 5 < s.length()) {
                                try {
                                    sb.append((char) Integer.parseInt(s.substring(j + 2, j + 6), 16));
                                } catch (Exception e) { }
                                j += 4;
                            } else sb.append(nx);
                            j += 2;
                        } else if (ch == '"') {
                            break;
                        } else {
                            sb.append(ch); j++;
                        }
                    }
                    return sb.toString();
                }
            }
            i = s.indexOf(pat, i + pat.length());
        }
        return null;
    }

    private static Map<String, String> jmap(String s, String key) {
        Map<String, String> out = new HashMap<String, String>();
        if (s == null) return out;
        int i = s.indexOf("\"" + key + "\"");
        if (i < 0) return out;
        int a = s.indexOf('{', i);
        int b = a < 0 ? -1 : s.indexOf('}', a);
        if (a < 0 || b < 0 || b < a) return out;
        String seg = s.substring(a + 1, b);
        int p = 0;
        while (true) {
            int q1 = seg.indexOf('"', p);
            if (q1 < 0) break;
            int q2 = seg.indexOf('"', q1 + 1);
            if (q2 < 0) break;
            String k = seg.substring(q1 + 1, q2);
            int colon = seg.indexOf(':', q2);
            if (colon < 0) break;
            int q3 = seg.indexOf('"', colon);
            if (q3 < 0) break;
            StringBuilder sb = new StringBuilder();
            int q4 = q3 + 1;
            while (q4 < seg.length()) {
                char ch = seg.charAt(q4);
                if (ch == '\\' && q4 + 1 < seg.length()) { sb.append(seg.charAt(q4 + 1)); q4 += 2; }
                else if (ch == '"') break;
                else { sb.append(ch); q4++; }
            }
            out.put(k, sb.toString());
            p = q4 + 1;
        }
        return out;
    }

    // ── 唯一的写口：POST /__save ───────────────────────────────────────
    //  四道门全过才落盘。任何一道不过都直接拒，不留痕、不动盘。
    private void handleSave(Socket c, InputStream in, String[] lines,
                            String method, String query) {
        if (!"POST".equals(method)) { err(c, 405, "只收 POST"); return; }

        // 门 1：令牌。它只注入给内嵌页面，别的浏览器/App 拿不到。
        String token = qval(query, "token");
        if (saveToken == null || token == null || !saveToken.equals(token)) {
            err(c, 403, "令牌不对");
            return;
        }
        // 门 2：来源。同源 fetch 一定带上 Origin；带着别的来源来的一律拒。
        String origin = header(lines, "origin");
        if (origin != null && !origin.equals("http://127.0.0.1:" + port)) {
            err(c, 403, "来源不对");
            return;
        }
        // 门 3：长度必须是明确的数字，且有上限。
        long len;
        try {
            len = Long.parseLong(String.valueOf(header(lines, "content-length")).trim());
        } catch (Exception e) {
            err(c, 411, "缺长度");
            return;
        }
        if (len <= 0 || len > MAX_SAVE) { err(c, 413, "太大或太小"); return; }

        // 门 4：文件名净化 + 后缀白名单。
        String name = safeName(qval(query, "name"));
        if (name == null) { err(c, 400, "文件名不合法"); return; }

        String where;
        try {
            where = saveBytes(in, len, name);
        } catch (Throwable t) {
            err(c, 500, "写不进去");
            return;
        }

        try {
            byte[] bb = ("ok:" + where).getBytes("UTF-8");
            OutputStream out = c.getOutputStream();
            out.write(("HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\n"
                     + "Content-Length: " + bb.length + "\r\nConnection: close\r\n\r\n")
                      .getBytes("UTF-8"));
            out.write(bb);
            out.flush();
            c.close();
        } catch (Exception e) {
            try { c.close(); } catch (Exception x) { }
        }
    }

    private static String header(String[] lines, String key) {
        if (lines == null) return null;
        for (int i = 1; i < lines.length; i++) {
            String l = lines[i];
            int e = l.indexOf(':');
            if (e <= 0) continue;
            if (l.substring(0, e).trim().equalsIgnoreCase(key)) {
                return l.substring(e + 1).trim();
            }
        }
        return null;
    }

    private static String qval(String query, String key) {
        if (query == null || query.isEmpty()) return null;
        String[] ps = query.split("&");
        for (String p : ps) {
            int e = p.indexOf('=');
            String k = e >= 0 ? p.substring(0, e) : p;
            if (!k.equals(key)) continue;
            String v = e >= 0 ? p.substring(e + 1) : "";
            try { return java.net.URLDecoder.decode(v, "UTF-8"); }
            catch (Exception x) { return v; }
        }
        return null;
    }

    /**
     * 文件名净化：去掉控制字符、把路径分隔符换成短横、剥掉开头的点
     * （防隐藏文件与 ".."），后缀必须在白名单里。任何一个不满足就返回 null。
     */
    private static String safeName(String raw) {
        if (raw == null) return null;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < raw.length() && sb.length() < 90; i++) {
            char ch = raw.charAt(i);
            if (ch < 0x20 || ch == 0x7f) continue;
            if ("\\/:*?\"<>|".indexOf(ch) >= 0) { sb.append('-'); continue; }
            sb.append(ch);
        }
        String s = sb.toString().trim();
        while (s.startsWith(".")) s = s.substring(1).trim();
        if (s.length() > 90) s = s.substring(0, 90).trim();
        if (s.isEmpty()) return null;

        int dot = s.lastIndexOf('.');
        String ext = dot > 0 ? s.substring(dot + 1).toLowerCase() : "";
        boolean audio = AUDIO_EXT.indexOf("|" + ext + "|") >= 0;
        boolean doc = DOC_EXT.indexOf("|" + ext + "|") >= 0;
        if (ext.isEmpty()) return s + ".bin";          // 没后缀的给个中性后缀
        if (!audio && !doc) return null;               // .apk / .html / .dex 之类一律拒
        return s;
    }

    private static String albumFor(String name) {
        int d = name.lastIndexOf('.');
        String ext = d > 0 ? name.substring(d + 1).toLowerCase() : "";
        return AUDIO_EXT.indexOf("|" + ext + "|") >= 0 ? "拾声录音" : "拾声备份";
    }

    private static String mimeOf(String name) {
        int d = name.lastIndexOf('.');
        String ext = d > 0 ? name.substring(d + 1).toLowerCase() : "";
        if (ext.equals("json")) return "application/json";
        if (ext.equals("txt") || ext.equals("m3u") || ext.equals("csv")) return "text/plain";
        String m = MIME.get(ext);
        return m != null ? m : "application/octet-stream";
    }

    private static void copy(InputStream in, OutputStream out, long len) throws Exception {
        byte[] buf = new byte[65536];
        long left = len;
        while (left > 0) {
            int n = in.read(buf, 0, (int) Math.min(buf.length, left));
            if (n < 0) break;
            out.write(buf, 0, n);
            left -= n;
        }
    }

    /** 落盘：Android 10+ 写公共「下载」目录（不需要任何权限）。 */
    private String saveBytes(InputStream in, long len, String name) throws Exception {
        String album = albumFor(name);
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            return SaveApi29.write(this, in, len, name, mimeOf(name), album);
        }
        File dir = new File(getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS),
                            album);
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("建目录失败");
        File f = new File(dir, name);
        String base = name, e = "";
        int d = name.lastIndexOf('.');
        if (d > 0) { base = name.substring(0, d); e = name.substring(d); }
        int i = 2;
        while (f.exists() && i < 100) f = new File(dir, base + " (" + (i++) + ")" + e);
        FileOutputStream fo = new FileOutputStream(f);
        copy(in, fo, len);
        fo.flush();
        fo.close();
        return "Android/data/" + getPackageName() + "/files/Download/" + album + "/";
    }

    /**
     * API 29 以上单独放一个类里：老机型上这个类根本不会被加载，
     * 免得 ART 在类校验阶段碰到 MediaStore.Downloads 报错。
     */
    private static class SaveApi29 {
        static String write(Activity act, InputStream in, long len,
                            String name, String mime, String album) throws Exception {
            android.content.ContentValues cv = new android.content.ContentValues();
            cv.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, name);
            cv.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mime);
            cv.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH,
                   android.os.Environment.DIRECTORY_DOWNLOADS + "/" + album);
            cv.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1);
            Uri item = act.getContentResolver().insert(
                    android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (item == null) throw new Exception("MediaStore 不收");
            OutputStream os = null;
            try {
                os = act.getContentResolver().openOutputStream(item);
                if (os == null) throw new Exception("打不开输出流");
                copy(in, os, len);
                os.flush();
            } catch (Throwable t) {
                try { act.getContentResolver().delete(item, null, null); } catch (Throwable x) { }
                throw new Exception(t);
            } finally {
                try { if (os != null) os.close(); } catch (Throwable x) { }
            }
            android.content.ContentValues done = new android.content.ContentValues();
            done.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0);
            act.getContentResolver().update(item, done, null, null);
            return "Download/" + album + "/";
        }
    }

    private void err(Socket c, int code, String why) {
        try {
            byte[] b = String.valueOf(why).getBytes("UTF-8");
            OutputStream out = c.getOutputStream();
            out.write(("HTTP/1.1 " + code + " Error\r\n"
                     + "Content-Type: text/plain; charset=utf-8\r\n"
                     + "Content-Length: " + b.length + "\r\n"
                     + "Connection: close\r\n\r\n").getBytes("UTF-8"));
            out.write(b);
            out.flush();
            c.close();
        } catch (Exception e) { }
    }

    // ── 生命周期 ────────────────────────────────────────────────────────

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        try { if (server != null) server.close(); } catch (Exception e) { }
        super.onDestroy();
    }

    /** 备用：把 assets 里的文件落一份到应用私有目录（调试用，正常流程用不到）。 */
    @SuppressWarnings("unused")
    private File dump(String name) {
        try {
            InputStream in = getAssets().open(name);
            File f = new File(getFilesDir(), name);
            FileOutputStream fo = new FileOutputStream(f);
            byte[] b = new byte[65536];
            int n;
            while ((n = in.read(b)) > 0) fo.write(b, 0, n);
            fo.close();
            in.close();
            return f;
        } catch (Exception e) {
            return null;
        }
    }
}
