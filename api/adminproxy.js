// Flat serverless proxy for OmniRoute admin endpoints (no catch-all route).
// Usage from the frontend:  /api/adminproxy?p=providers
//                           /api/adminproxy?p=combos
//                           /api/adminproxy?p=provider/add      (POST)
//                           /api/adminproxy?p=provider/delete   (POST)
// The admin token is injected SERVER-SIDE (env var ADMIN_TOKEN).

const ADMIN_BASE = 'https://admin.susilo.my.id/admin';
const ALLOWED = new Set(['providers', 'combos', 'provider/add', 'provider/delete', 'provider/models']);

async function fetchModelsFromProvider(baseUrl, apiKey) {
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) return { models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = data.data?.map(m => m.id) || data.models?.map(m => m.id || m) || [];
    return { models };
  } catch (e) {
    return { models: [], error: e.message };
  }
}

export default async function handler(req, res) {
  const adminToken = process.env.ADMIN_TOKEN || '';
  if (!adminToken) {
    res.status(500).json({ error: 'ADMIN_TOKEN not configured on server' });
    return;
  }

  const p = String((req.query && req.query.p) || '');
  if (!ALLOWED.has(p)) {
    res.status(400).json({ error: `invalid or missing p param: "${p}"` });
    return;
  }

  // Special case: provider/models - fetch directly from provider, not admin API
  if (p === 'provider/models') {
    const { baseUrl, apiKey } = req.body || {};
    if (!baseUrl) {
      res.status(400).json({ error: 'baseUrl required' });
      return;
    }
    const result = await fetchModelsFromProvider(baseUrl, apiKey);
    res.json(result);
    return;
  }

  const target = `${ADMIN_BASE}/${p}`;

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
