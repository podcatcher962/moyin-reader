# 墨吟 1.14.21 · 选书只看得见 TXT / EPUB

## 起因
用户实测后的两条要求：
1. 「PDF 如果不能阅读，导入的时候就直接不要读，给用户一种 APP 不完善的感觉」
2. 「导入的时候，PDF 就完全不可见就是了，只看见 TXT、epub」

同时把「以后要做 PDF（方案 A）」记进 `_backlog.md`，当前主线是让人能正常用起来，不加功能。

## 为什么 1.14.19 会走到「什么文件都显示」
1.14.19 为了让 epub 在国产 ROM 上能出现在选择器里，把类型过滤整个删掉，改成 `setType("*/*")`。
epub 是回来了，但 PDF、图片、压缩包也跟着涌进列表——点一下就是「读不了」，同样是残缺感。
所以这次不是退回按 `.epub` 扩展名过滤（那会把 epub 再藏起来），而是换成 **MIME 白名单**。

## 改动
1. `MainActivityHttp.java` 的 `onShowFileChooser`：`setType("*/*")` + `EXTRA_MIME_TYPES`：
   ```
   text/plain, application/epub+zip,
   application/octet-stream, application/zip, application/x-zip-compressed
   ```
   - 为什么要列 `octet-stream` / `zip`：国产 ROM 的 MIME 库里没登记 `application/epub+zip`，
     `.epub` 常被判成 `application/octet-stream` 或 zip——这正是 1.14.19 之前「epub 看不见」的真因。
   - 为什么 PDF 会消失：`application/pdf` 不在白名单里。
   - 兜底：万一某台机器把 epub 判成名单外的类型，还有「导入文件夹」（选目录、按扩展名扫，与 MIME 无关）。
2. `app.js` `importFiles`：认不出的文件（PDF / MOBI / 图片）**静默略过**，
   不再进「跳过」清单、不再说「不支持这种格式」；只有一份都没导进来时才轻说一句
   「这几本还读不了，先导入 TXT 或 EPUB 吧」。
3. 更新说明里加了鸣谢（9 位真实反馈的人）：
   @momo、@点赞提醒你开了仅限好友评论区、@终端虫虫、@“青青子衿，悠悠我心”、@常清静矣、
   @小红薯、@生活吖、@Apple、@如月隐。
   只用平台昵称、不写任何真实信息；若有人不愿被写，删掉一个名字重打包即可。
4. `build_exe.py` 的 `real_run` 修掉一个误报：Nuitka onefile 的引导进程有时在 6 秒内把活交给
   子进程就退出，原来的 `assert p.poll() is None, 'exe 秒退'` 会误判。现在先看服务与窗口，
   两个都不在才认崩，并把返回码打出来。

## 验证
- `_test_import.js`：**14 / 0**（PDF 不入库、且提示里不再出现「不支持这种格式」）。
- dex 里确认三个新 MIME 字符串都在（`application/epub+zip`、`application/octet-stream`、
  `application/x-zip-compressed`）。
- APK 101.0 MB（体检 18 项全 PASS，dex 1148 类）；EXE 149.0 MB、Lite 37.9 MB。
- EXE 手动启动复验：进程存活 10 秒以上、窗口起来、`/__ping` 正常。

## 风险
- 白名单是「猜 ROM 的判法」，理论上仍有被漏掉的可能。真出现「epub 又看不见」，
  一步退回 1.14.19 的做法（`*/*` + 页面静默跳过）即可，不会丢功能。
- 跳章问题的加固（1.14.19 的三处）仍需真机反馈确认，我们自己的手机复现不出来。

## 遗留
- PDF 支持（方案 A）见 `_backlog.md`，约 2.5 天、APK +1.6 MB。
- 1.14.14 ~ 1.14.21 未合并发 Release、未更新 versions.json。
