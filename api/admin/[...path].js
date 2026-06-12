// Serverless proxy for OmniRoute admin endpoints.
// The admin token is injected SERVER-SIDE here, so it is never shipped to the
// browser bundle. Any request to /api/admin/* is forwarded to the admin base
// URL with the Authorization header added on the server.
//
// Env vars (set in Vercel -> Settings -> Environment Variables):
//   ADMIN_BASE_URL   e.g. https://admin.susilo.my.id/admin   (optional)
//   ADMIN_TOKEN      the admin bearer token

export default async function handler(req, res) {
  const adminBase = (process.env.ADMIN_BASE_URL || 'https://admin.susilo.my.id/admin').replace(/\/$/, '');
  const adminToken = process.env.ADMIN_TOKEN || '';

  if (!adminToken) {
    res.status(500).json({ error: 'ADMIN_TOKEN not configured on server' });
    return;
  }

  // Derive the sub-path after /api/admin/ directly from the request URL.
  // (More reliable than req.query.path across Vercel runtimes.)
  const url = new URL(req.url, 'http://localhost');
  let subPath = url.pathname.replace(/^\/api\/admin\/?/, '');

  // Fallback: catch-all query param (used by some runtimes)
  if (!subPath) {
    const segments = req.query && req.query.path ? req.query.path : [];
    subPath = Array.isArray(segments) ? segments.join('/') : String(segments || '');
  }

  url.searchParams.delete('path');
  const qs = url.searchParams.toString();
  const target = `${adminBase}/${subPath}${qs ? `?${qs}` : ''}`;

  try {
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const body = hasBody
      ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}))
      : undefined;

    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...(hasBody ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body } : {})
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: `Proxy error: ${e.message} (target: ${target})` });
  }
}
