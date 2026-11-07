#!/usr/bin/env bash
# 墨吟阅读器 · 在本机打 Linux / 信创 可执行包
#
#   bash build-linux.sh
#
# 产物：dist/MoYinReader-linux-<架构>
#   x86_64 / aarch64(飞腾·鲲鹏) / loongarch64(龙芯) / mips64el(部分麒麟)
#
# 说明：
#   * PyInstaller 只能打「本机架构 + 本机 glibc」的包，交叉打包基本不可行。
#     所以这个脚本必须在目标机器（或同架构同发行版的构建机）上跑。
#   * 不想打包也完全能用：直接 bash start-linux.sh，靠系统 python3 跑源码。
#   * 离线机器：先把 pyinstaller 的轮子拷过来，
#     pip install --no-index --find-links=./wheels pyinstaller
#   * 不需要 pywebview：Linux 上它依赖 WebKit2 的 typelib（很多信创机器没装），
#     程序会改用系统浏览器的 --app 模式开窗口。

set -eu

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT" || exit 1

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)   TAG="x86_64" ;;
  aarch64|arm64)  TAG="aarch64" ;;
  loongarch64)    TAG="loongarch64" ;;
  mips64*)        TAG="mips64el" ;;
  *)              TAG="$ARCH" ;;
esac

PY="$(command -v python3 || command -v python || true)"
[ -n "$PY" ] || { echo "没有 python3，装一个再来（统信/麒麟一般自带）。"; exit 1; }
echo "Python: $($PY -V 2>&1)   架构: $ARCH"

command -v pyinstaller >/dev/null 2>&1 || "$PY" -m pip install --user pyinstaller
command -v pyinstaller >/dev/null 2>&1 || {
  echo "没装上 pyinstaller。离线机器请把轮子拷来："
  echo "  $PY -m pip install --no-index --find-links=./wheels pyinstaller"
  exit 1
}

# app.py 用 --add-data 把页面塞进去；POSIX 下分隔符是冒号
mkdir -p dist build
"$PY" -m PyInstaller --noconfirm --clean --onefile \
  --name "MoYinReader-linux-$TAG" \
  --add-data "MoYinReader.html:." \
  --add-data "LICENSE:." \
  --distpath dist --workpath build/linux \
  _pkg_win/app.py

OUT="dist/MoYinReader-linux-$TAG"
[ -f "$OUT" ] && chmod +x "$OUT"
echo
echo "好了：$OUT  ($(du -h "$OUT" | cut -f1))"
echo "跑一下：  $OUT --selftest"
echo "正常启动：$OUT"
