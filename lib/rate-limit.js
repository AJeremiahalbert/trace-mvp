// Simple in-memory rate limit: a fixed number of requests per IP per window.
// Good enough for a demo. Serverless instances don't share memory, so use a
// shared store (for example Upstash Redis) before real traffic.
export const LIMIT = 10;
export const WINDOW_MS = 60_000;

export function createLimiter({ limit = LIMIT, windowMs = WINDOW_MS } = {}) {
  const hits = new Map();
  return function allow(key, now = Date.now()) {
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= limit) { hits.set(key, recent); return false; }
    hits.set(key, [...recent, now]);
    return true;
  };
}

export function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket?.remoteAddress || 'unknown';
}
