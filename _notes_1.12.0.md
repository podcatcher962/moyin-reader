能查新版本了，但依然默认不联网。

* 阅读设置里多了「检查更新」，点一下才去读一次版本清单（约 90 KB，不传本机信息、不传书、不传阅读记录）
* 有新版本会写清你这台设备该下哪个包、多大、sha256 是多少；「启动时自动查新」默认关闭，开了也一天最多一次
* 版本号一处改全局同步：页面 / Windows / Linux / deb / 安卓包 / versionCode 全部对得上（1.12.0 → 11200）
* 下载优先走实测最快的那条镜像，GitHub 原站慢或断了也下得动
* 安卓包签名指纹不变（FA:02:37…），可直接覆盖安装 1.11.0，不用卸载
* 修 deb 里装的是上一版页面（复用旧 deb-root 没刷新）

安卓：`MoYinReader.apk`（38.8 MB，内含 sherpa-onnx + AISHELL3，断网 174 个声线）
电脑免安装：`MoYinReader.exe`（含语音，单文件）；`MoYinReader_Lite.exe`（不带语音，17 MB）
Linux：`moyin-reader_1.12.0_amd64.deb` 或 `MoYinReader-Linux-1.12.0.tar.gz`
macOS：`MoYinReader-macOS-1.12.0.zip`
不想装任何东西：直接下 `MoYinReader.html`，双击用浏览器打开
