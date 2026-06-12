// Serverless proxy for chat completions.
// Forwards the browser request to OmniRoute from the server side so the
// router URL/key never need to be exposed to mixed-content rules, and the
// upstream API key can stay server-side.
//
// Env vars (set in Vercel → Settings → Environment Variables):
//   OMNIROUTE_BASE_URL   e.g. https://router.susilo.my.id/v1   (no trailing slash needed)
//   OMNIROUTE_API_KEY    optional - upstream key for the router (Bearer)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const baseUrl = (process.env.OMNIROUTE_BASE_URL || 'https://router.susilo.my.id/v1').replace(/\/$/, '');
  const serverKey = process.env.OMNIROUTE_API_KEY || '';

  // Prefer server-side key; fall back to a key the client passed (optional).
  const clientAuth = req.headers['authorization'];
  const authHeader = serverKey ? `Bearer ${serverKey}` : (clientAuth || '');

  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: { message: `Proxy error: ${e.message}` } });
  }
}
