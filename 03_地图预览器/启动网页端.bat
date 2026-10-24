@echo off
chcp 65001 >nul
title 北化数字校园 · 网页端服务
cd /d "%~dp0"

echo ========================================
echo   北化昌平校区 · 等距像素数字校园
echo   正在启动网页端本地服务...
echo ========================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    echo 使用 Python 启动服务...
    python server.py
    goto :end
)

where py >nul 2>nul
if %errorlevel%==0 (
    echo 使用 Python 启动服务...
    py -3 server.py
    goto :end
)

where node >nul 2>nul
if %errorlevel%==0 (
    echo 使用 Node.js 启动服务...
    node server.js
    goto :end
)

echo [错误] 未检测到 Python 或 Node.js。
echo 请先安装其中一个（二选一即可，安装时勾选加入 PATH）：
echo   Python : https://www.python.org/downloads/
echo   Node.js: https://nodejs.org/
echo.
pause

:end
