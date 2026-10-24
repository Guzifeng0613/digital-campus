#!/bin/bash
# 北化昌平校区 · 等距像素数字校园 —— 网页端启动脚本（macOS / Linux）
cd "$(dirname "$0")"

echo "========================================"
echo "  北化昌平校区 · 等距像素数字校园"
echo "  正在启动网页端本地服务..."
echo "========================================"
echo

if command -v python3 >/dev/null 2>&1; then
    echo "使用 Python 3 启动服务..."
    python3 server.py "$@"
elif command -v python >/dev/null 2>&1; then
    echo "使用 Python 启动服务..."
    python server.py "$@"
elif command -v node >/dev/null 2>&1; then
    echo "使用 Node.js 启动服务..."
    node server.js "$@"
else
    echo "[错误] 未检测到 Python 或 Node.js。"
    echo "请先安装其中一个（二选一）："
    echo "  Python : https://www.python.org/downloads/"
    echo "  Node.js: https://nodejs.org/"
    read -r -p "按回车关闭..."
fi
