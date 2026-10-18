#!/usr/bin/env node
/*
 * 北化昌平校区 · 等距像素数字校园 —— 网页端本地服务器（零依赖，Node.js 内置模块）
 *
 * 用法：node server.js [端口]   # 不带端口时默认 8080，被占用会自动顺延
 * 启动后自动打开浏览器；手机/同局域网设备可访问打印的局域网地址。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const ROOT = __dirname;
const DEFAULT_PORT = Number(process.argv[2]) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function lanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function openBrowser(url) {
  let cmd;
  if (process.platform === 'win32') cmd = `start "" "${url}"`;
  else if (process.platform === 'darwin') cmd = `open "${url}"`;
  else cmd = `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function start(port) {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.normalize(path.join(ROOT, urlPath));
    // 防路径穿越
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
      }
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache, must-revalidate' });
      console.log(`  ${req.method} ${req.url}`);
      res.end(data);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < DEFAULT_PORT + 100) {
      start(port + 1);
    } else {
      console.error('启动失败：', err.message);
      process.exit(1);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const localUrl = `http://127.0.0.1:${port}/`;
    const lanUrl = `http://${lanIp()}:${port}/`;
    console.log('====================================================');
    console.log('   北化昌平校区 · 等距像素数字校园（网页端）');
    console.log('====================================================');
    console.log(`   本机访问：    ${localUrl}`);
    console.log(`   局域网/手机： ${lanUrl}`);
    console.log('   停止服务：    关闭本窗口，或按 Ctrl+C');
    console.log('====================================================');
    setTimeout(() => openBrowser(localUrl), 600);
  });
}

start(DEFAULT_PORT);
