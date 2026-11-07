#!/usr/bin/env bash
# 墨吟阅读器 · 在 Mac 上自己打包成 .app
#
#   bash build-macos.sh            # 生成 dist/墨吟阅读器.app
#   bash build-macos.sh --onefile  # 生成单个可执行文件（不带 .app 外壳）
#
# 需要：Xcode Command Line Tools（xcode-select --install）、python3、pyinstaller
#   python3 -m pip install --user pyinstaller        # pywebview 可选，见下
#
# ⚠️ 打出来的包只在「本机架构」上跑（Intel 只会出 x86_64，Apple Silicon 只会出 arm64）。
#    要做通用包得在两种机器上各打一次，或者用 lipo 合并（这里不折腾）。

set -eu

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT" || exit 1

[ "$(uname -s)" = "Darwin" ] || { echo "这个脚本要在 macOS 上跑。"; exit 1; }

PY="$(command -v python3 || true)"
[ -n "$PY" ] || { echo "先装 Command Line Tools：xcode-select --install"; exit 1; }
echo "Python: $($PY -V 2>&1)   $(uname -m)"

"$PY" -c "import PyInstaller" >/dev/null 2>&1 || "$PY" -m pip install --user pyinstaller || {
  echo "装不上 PyInstaller。要么先解决网络/代理，要么直接双击 MoYinReader.html 用浏览器看。"
  exit 1
}

# pywebview 是「可选」的：装上就有 Cocoa 原生窗口，装不上也会用系统浏览器的
# --app 模式开一个无地址栏窗口（app.py 里已内置这条兜底），所以失败不算错。
if ! "$PY" -c "import webview" >/dev/null 2>&1; then
  "$PY" -m pip install --user pywebview >/dev/null 2>&1 || \
    echo "提示：pywebview 没装上，不影响使用——会用浏览器 --app 模式开窗口。"
fi

mkdir -p dist build
MODE="${1:-}"

if [ "$MODE" = "--onefile" ]; then
  "$PY" -m PyInstaller --noconfirm --clean --onefile \
    --name MoYinReader \
    --add-data "MoYinReader.html:." \
    --distpath dist --workpath build/macos \
    _pkg_win/app.py
  OUT="dist/MoYinReader"
else
  "$PY" -m PyInstaller --noconfirm --clean --windowed \
    --name "墨吟阅读器" \
    --add-data "MoYinReader.html:." \
    --distpath dist --workpath build/macos \
    _pkg_win/app.py
  OUT="dist/墨吟阅读器.app"
fi

echo
echo "好了：$OUT"
echo "第一次打开会被 Gatekeeper 拦（没有开发者签名），两种办法："
echo "  1) 右键点图标 → 打开 → 再点「打开」"
echo "  2) 终端执行： xattr -dr com.apple.quarantine \"$OUT\""
echo "自检：  \"$OUT/Contents/MacOS/墨吟阅读器\" --selftest   （.app 的情况）"
