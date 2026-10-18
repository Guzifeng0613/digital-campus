#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
北化昌平校区 · 等距像素数字校园 —— 网页端本地服务器（零依赖，Python 3 标准库）

用法：
    python3 server.py [端口]   # 不带端口时默认 8080，被占用会自动顺延

启动后：
    - 自动用默认浏览器打开页面；
    - 同一局域网内的手机/平板可访问打印的“局域网地址”；
    - 关闭本窗口或按 Ctrl+C 即停止服务。
"""
import http.server
import socketserver
import os
import sys
import socket
import threading
import webbrowser

DEFAULT_PORT = 8090
ROOT = os.path.dirname(os.path.abspath(__file__))

# 需要显式声明的 MIME（避免个别系统把 .js 当成 text/plain 导致脚本不执行）
EXTRA_MIME = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".json": "application/json; charset=utf-8",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}


class CampusHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in EXTRA_MIME:
            return EXTRA_MIME[ext]
        return super().guess_type(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 只打印简洁的访问行
        sys.stdout.write("  %s\n" % (fmt % args))


class ThreadingServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def find_port(start):
    """从 start 开始寻找可用端口。"""
    port = start
    while port < start + 100:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                port += 1
    raise RuntimeError("从 %d 起没有找到可用端口" % start)


def lan_ip():
    """尽力获取本机在局域网中的 IP（不实际发包）。"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    start_port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            start_port = int(sys.argv[1])
        except ValueError:
            print("端口参数无效，使用默认 %d" % DEFAULT_PORT)
    os.chdir(ROOT)
    port = find_port(start_port)
    local_url = "http://127.0.0.1:%d/" % port
    lan_url = "http://%s:%d/" % (lan_ip(), port)

    with ThreadingServer(("0.0.0.0", port), CampusHandler) as httpd:
        print("=" * 52)
        print("   北化昌平校区 · 等距像素数字校园（网页端）")
        print("=" * 52)
        print("   本机访问：    %s" % local_url)
        print("   局域网/手机： %s" % lan_url)
        print("   停止服务：    关闭本窗口，或按 Ctrl+C")
        print("=" * 52)
        threading.Timer(0.6, lambda: webbrowser.open(local_url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止服务。")


if __name__ == "__main__":
    main()
