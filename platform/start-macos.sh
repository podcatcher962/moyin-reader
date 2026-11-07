#!/usr/bin/env bash
# 墨吟阅读器 · macOS 启动（源码方式，不需要打包）
#
#   bash start-macos.sh
#
# macOS 自带 python3（Command Line Tools）与 WKWebView，装个 pywebview 就有原生窗口：
#   python3 -m pip install --user pywebview
#
# 不装 pywebview 也能用：会直接用 Safari/默认浏览器打开单文件 HTML，功能一样，
# 只是没有独立窗口；朗读走系统语音（macOS 的中文系统语音质量不错）。

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE" || exit 1

HTML="$HERE/MoYinReader.html"
APP="$HERE/app.py"

PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then
  echo "没找到 python3。装一下 Command Line Tools：xcode-select --install"
  echo "或者直接用浏览器打开：$HTML"
  open "$HTML" 2>/dev/null
  exit 0
fi

echo "使用 $($PY -V 2>&1)"

if ! "$PY" -c "import webview" >/dev/null 2>&1; then
  echo "没装 pywebview，先用浏览器打开。想要独立窗口就执行："
  echo "    $PY -m pip install --user pywebview"
  open "$HTML" 2>/dev/null || true
  exit 0
fi

"$PY" "$APP" || {
  echo "原生窗口退出，改从浏览器打开。"
  open "$HTML" 2>/dev/null || true
}
