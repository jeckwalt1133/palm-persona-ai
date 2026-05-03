import https from 'node:https';
import fs from 'node:fs';
import http from 'node:http';

const HTTP_PORT = 3001;
const HTTPS_PORT = 3002;
const CERT_DIR = process.env.CERT_DIR || '/tmp';

const options = {
  key: fs.readFileSync(`${CERT_DIR}/server-key.pem`),
  cert: fs.readFileSync(`${CERT_DIR}/server-cert.pem`),
};

const proxy = https.createServer(options, (req, res) => {
  const proxyReq = http.request(
    { hostname: '127.0.0.1', port: HTTP_PORT, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${HTTP_PORT}` } },
    (proxyRes) => {
      const headers = { ...proxyRes.headers };
      delete headers['transfer-encoding'];
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end('Proxy Error');
  });
  req.pipe(proxyReq);
});

proxy.listen(HTTPS_PORT, () => {
  console.log(`HTTPS dev proxy: https://localhost:${HTTPS_PORT} → http://127.0.0.1:${HTTP_PORT}`);
});
