function applyCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

function getConfig() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  };
}

function getHeaders(extra = {}) {
  const { key } = getConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

function getEventsUrl(searchParams = '') {
  return `${getConfig().url}/rest/v1/nakshathram_typing_events${searchParams}`;
}

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url, key } = getConfig();
  if (!url || !key) {
    res.status(503).json({ message: 'Supabase backend is not configured in Vercel.' });
    return;
  }

  if (req.method === 'GET') {
    const mode = String(req.query.mode || 'lookup');
    const params = new URLSearchParams();
    const limit = String(req.query.limit || '120');

    if (mode === 'user') {
      res.status(403).json({ message: 'User event browsing is available only through the admin panel.' });
      return;
    } else {
      const language = String(req.query.language || '').trim();
      const roman = String(req.query.roman || '').trim().toLowerCase();
      const signature = String(req.query.signature || '').trim().toLowerCase();

      if (!language || !roman) {
        res.status(400).json({ message: 'Missing language or roman query parameter.' });
        return;
      }

      params.set('language', `eq.${language}`);
      params.set('select', 'roman_lower,roman_signature,native_word,created_at,source');
      params.set('or', `(roman_lower.eq.${roman},roman_signature.eq.${signature})`);
      params.set('order', 'created_at.desc');
      params.set('limit', limit);
    }

    const response = await fetch(getEventsUrl(`?${params.toString()}`), {
      headers: getHeaders()
    });

    if (!response.ok) {
      res.status(response.status).json({ message: await response.text() });
      return;
    }

    const rows = await response.json();
    res.status(200).json({ rows });
    return;
  }

  if (req.method === 'POST') {
    const payload = Array.isArray(req.body) ? req.body : [];
    if (payload.length === 0) {
      res.status(400).json({ message: 'Expected an array of typing events.' });
      return;
    }

    const response = await fetch(getEventsUrl('?on_conflict=client_event_id'), {
      method: 'POST',
      headers: getHeaders({
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal'
      }),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      res.status(response.status).json({ message: await response.text() });
      return;
    }

    res.status(200).json({ inserted: payload.length });
    return;
  }

  res.status(405).json({ message: 'Method not allowed.' });
}
