// Serverless proxy for OmniRoute admin endpoints.
// The admin token is injected SERVER-SIDE here, so it is never shipped to the
// browser bundle. Any request to /api/admin/* is forwarded to the admin base
// URL with the Authorization header added on the server.
//
// Env vars (set in Vercel → Settings → Environment Variables):
//   ADMIN_BASE_URL   e.g. https://admin.susilo.my.id/admin   (no trailing slash needed)
//   ADMIN_TOKEN      the admin bearer token (rotate the old leaked one!)

export default async function handler(req, res) {
  const adminBase = (process.env.ADMIN_BASE_URL || 'https://admin.susilo.my.id/admin').replace(/\/$/, '');
  const adminToken = process.env.ADMIN_TOKEN || '';

  if (!adminToken) {
    res.status(500).json({ error: 'ADMIN_TOKEN not configured on server' });
    return;
  }

  // Reconstruct the sub-path after /api/admin/
  const segments = req.query.path || [];
  const subPath = (Array.isArray(segments) ? segments.join('/') : String(segments));

  // Preserve any query string (besides the catch-all "path" param).
  const url = new URL(req.url, 'http://localhost');
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
    res.status(502).json({ error: `Proxy error: ${e.message}` });
  }
}
