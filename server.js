import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import investigate from './api/investigate.js';
import health from './api/health.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');

// Load .env if present (KEY=value lines).
const envFile = path.join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Apply the same security headers locally as vercel.json sets in production.
const SECURITY_HEADERS = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')).headers[0].headers;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.json': 'application/json' };
const routes = { '/api/investigate': investigate, '/api/health': health };

function shim(res) {
  return {
    status(code) { res.statusCode = code; return this; },
    json(obj) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return this; }
  };
}

http.createServer(async (req, res) => {
  for (const { key, value } of SECURITY_HEADERS) res.setHeader(key, value);
  const url = new URL(req.url, 'http://localhost');
  const route = routes[url.pathname];
  if (route) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 20000) break; }
    try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = undefined; }
    return route(req, shim(res));
  }
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(publicDir, rel));
  if (!file.startsWith(publicDir)) { res.statusCode = 403; return res.end('Forbidden'); }
  try {
    const data = await readFile(file);
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404; res.end('Not found');
  }
}).listen(process.env.PORT || 3000, () => {
  console.log(`Trace running at http://localhost:${process.env.PORT || 3000}`);
  console.log(process.env.ANTHROPIC_API_KEY ? 'AI agent: ON' : 'AI agent: OFF (no ANTHROPIC_API_KEY), rule engine only');
});
