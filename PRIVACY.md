# 隐私说明 · Privacy

最后更新：2026-11-10　适用版本：墨吟阅读器 1.14.11 及之后

## 一句话

**不收集、不上传、不需要账号。** 你的书、书架、书签、进度和设置全部留在你自己的设备上，作者没有任何服务器可以看到它们。

## 一、本地存了什么，存在哪

| 内容 | 存放位置 | 说明 |
|---|---|---|
| 导入的书（TXT / EPUB） | 浏览器 IndexedDB；桌面版在 `%LOCALAPPDATA%` 下的 WebView 数据目录；安卓版在应用私有目录 | 只在你的设备上，换设备不会同步过去 |
| 书架分组、书签、阅读进度、阅读计时 | 同上 | 卸载、清缓存、清站点数据即随之删除，不可恢复 |
| 界面设置（主题、字号、音色、语速等） | 浏览器 localStorage | 同上 |

本软件没有云同步、没有账号体系、没有导出到服务器的通道。

## 二、什么时候会联网

只有三种情况，且都需要你主动触发或明确同意：

1. **检查更新**：启动或你点「检查更新」时，向 `podcatcher962.github.io/versions.json` 发一个普通 GET 请求，只取版本号与体积这几个公开字段。请求里不携带书名、书内容、设备标识或任何可追溯到个人的信息。
2. **下载安装包与语音模型**：默认走 GitHub 官方地址，中间没有别的服务器。国内线路不通时，下载页会另外列出 `gh-proxy.com` 这类第三方反向代理——**只有你自己点了才会走**，其运营方能够看到请求的 IP 与浏览器标识（User-Agent），这一点本项目无法代为控制。语音模型（`VoicePack/install.py`）同样是直连优先，直连失败才退到镜像。
3. **系统在线语音（默认不使用）**：如果你自己在语音列表里选了名称含 `Online (Natural)` 的在线音色，浏览器或系统会把**当前要朗读的那段文字**发给他们对应的语音服务合成。这是浏览器/系统语音引擎的行为，与本软件的书籍存储无关；换成任何离线音色即不再发生。

除此之外没有任何网络请求——没有统计、没有埋点、没有广告 SDK、没有崩溃上报、没有第三方分析。

## 三、语音合成在哪做

- **桌面版 / 安卓版**：随包的 sherpa-onnx 引擎在你本机合成，语音服务只监听 `127.0.0.1` 的本地端口（8177 起），**不对外网监听**，不接收外部请求。朗读的文字不出本机。
- **网页版**：只有你自己装了本地引擎、或使用设备自带离线音色时才在本机合成；见第二节第 3 条。
- 分角色朗读要分析「这句是谁说的」，这一步也纯在本机完成，不需要也不会上传任何文本。

## 四、安卓权限

安装包里只声明了两个权限：

| 权限 | 用途 |
|---|---|
| `INTERNET` | 检查更新、下载更新包 |
| `ACCESS_NETWORK_STATE` | 判断当前是否有网络，避免无网时反复重试 |

**没有**存储、位置、通讯录、相机、麦克风、短信、电话状态等权限；不读取 IMEI、Android ID、MAC 地址、广告 ID；不读取已安装应用列表。

## 五、局域网共享（桌面版）

桌面版可以读局域网 SMB 共享（如 `\\192.168.1.10\Books`）。登录凭据由 **Windows 凭据管理器**保管和复用，本软件自身不保存你的共享密码，也不把它写进任何配置文件。

## 六、儿童

本软件不面向儿童设计，也不区分用户年龄，不收集任何个人信息（包括儿童的个人信息）。

## 七、你的权利

因为没有服务器、没有账号、也没有任何数据被收集，所以不存在「请求查阅 / 更正 / 删除我的数据」这一流程——数据本来就只在你手上。要彻底清除，删除书库或清除应用数据即可。若你发现本软件存在与上述说明不符的行为，请在 [Issues](https://github.com/podcatcher962/moyin-reader/issues) 提出，核实后会立即修正。

## 八、变更

本说明若修改，会更新文首日期并随版本发布；涉及扩大收集范围的变化，会在软件的更新说明里单独写明。

---

## English (short version)

**No collection, no upload, no account.** Books, shelves, bookmarks, reading progress and settings stay on your device (browser IndexedDB / localStorage; `%LOCALAPPDATA%` WebView storage on desktop; app-private storage on Android). There is no cloud sync and no telemetry — no analytics, ads, crash reporting or third-party SDKs.

The app reaches the network only when you ask it to: (1) a plain `GET` to `podcatcher962.github.io/versions.json` to check for updates, carrying no book content and no device identifiers; (2) downloading the installer or voice models from GitHub Releases, with the third-party mirror `gh-proxy.com` as a fallback — that mirror's operator can see your IP and User-Agent; (3) if *you* explicitly pick an `Online (Natural)` system voice, the current sentence is sent to that browser/OS speech service, which is outside this app's control.

Speech synthesis runs locally via sherpa-onnx and listens on `127.0.0.1` only. The Android build requests just `INTERNET` and `ACCESS_NETWORK_STATE` — no storage, location, contacts, camera, microphone or device-identifier access. SMB credentials are handled by the Windows Credential Manager, not stored by this app.
