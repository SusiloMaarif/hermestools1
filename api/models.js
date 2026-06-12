// Serverless proxy for listing models from OmniRoute.
// Lets the client fetch /api/models instead of hitting the router directly.
//
// Env vars:
//   OMNIROUTE_BASE_URL   e.g. https://router.susilo.my.id/v1
//   OMNIROUTE_API_KEY    optional - upstream key (Bearer)

export default async function handler(req, res) {
  const baseUrl = (process.env.OMNIROUTE_BASE_URL || 'https://router.susilo.my.id/v1').replace(/\/$/, '');
  const serverKey = process.env.OMNIROUTE_API_KEY || '';
  const clientAuth = req.headers['authorization'];
  const authHeader = serverKey ? `Bearer ${serverKey}` : (clientAuth || '');

  try {
    const upstream = await fetch(`${baseUrl}/models`, {
      headers: authHeader ? { Authorization: authHeader } : {}
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: { message: `Proxy error: ${e.message}` } });
  }
}
