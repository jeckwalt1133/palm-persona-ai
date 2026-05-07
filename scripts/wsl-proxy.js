// Windows 侧 HTTP 代理 → 转发到 WSL2 服务
// 运行方式（在 Windows cmd 中）: node scripts/wsl-proxy.js
// 监听 127.0.0.1:3009，转发到 WSL2 的 127.0.0.1:3001

const http = require('http');

const PROXY_PORT = 3009;
const WSL_PORT = 3001;
const WSL_HOST = '127.0.0.1';

http.createServer((req, res) => {
  const bodyChunks = [];
  req.on('data', (chunk) => bodyChunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(bodyChunks);
    const options = {
      hostname: WSL_HOST,
      port: WSL_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, 'x-forwarded-for': '127.0.0.1' },
      timeout: 120000,
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      console.error('[proxy] error:', e.message);
      res.writeHead(502);
      res.end('WSL2 unreachable: ' + e.message);
    });
    proxyReq.on('timeout', () => {
      console.error('[proxy] timeout');
      proxyReq.destroy();
      res.writeHead(504);
      res.end('timeout');
    });
    if (body.length > 0) proxyReq.write(body);
    proxyReq.end();
  });
}).listen(PROXY_PORT, '127.0.0.1', () => {
  console.log('[proxy] Windows:3009 → WSL2:3001 就绪');
});
