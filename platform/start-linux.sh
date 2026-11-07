#!/usr/bin/env bash
# 墨吟阅读器 · Linux / 信创系统启动脚本
#
# 用法：把整个目录拷到本机，双击本文件，或在终端里：
#     bash start-linux.sh
#
# 三级策略，哪级能用用哪级：
#   1) python3 + pywebview（GTK/Qt 内核）→ 原生窗口
#   2) python3 有但 pywebview 起不来 → 自动退回系统浏览器（app.py 内部兜底）
#   3) 连 python3 都没有 → 直接用系统浏览器打开单文件 HTML
#
# 不需要联网，不需要 pip install，不需要编译。

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE" || exit 1

HTML="$HERE/MoYinReader.html"
APP="$HERE/app.py"

say() { printf '%s\n' "$*"; }

open_browser() {
  # 信创系统上常见：xdg-open / 各自浏览器的启动器
  for c in xdg-open gio sensible-browser x-www-browser firefox chromium chromium-browser \
           uos-browser kylin-browser 360browser; do
    if command -v "$c" >/dev/null 2>&1; then
      if [ "$c" = "gio" ]; then
        gio open "file://$HTML" >/dev/null 2>&1 && return 0
      else
        "$c" "file://$HTML" >/dev/null 2>&1 &
        return 0
      fi
    fi
  done
  say "没找到可用的浏览器启动命令，请手动用浏览器打开："
  say "    file://$HTML"
  return 1
}

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done

if [ -z "$PY" ]; then
  say "这台机器没有 python3，直接用浏览器打开（功能一样，朗读走系统语音）。"
  open_browser
  exit $?
fi

say "使用 $($PY -V 2>&1)"

if [ -f "$APP" ] && [ -f "$HTML" ]; then
  # 有 pywebview 就走原生窗口；没有也没关系，app.py 会退回浏览器
  "$PY" "$APP" || {
    code=$?
    say "原生窗口退出（码 $code），改从浏览器打开。"
    open_browser
  }
else
  say "目录里缺 app.py 或 MoYinReader.html，直接打开 HTML。"
  open_browser
fi
