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

function getProfilesUrl(searchParams = '') {
  return `${getConfig().url}/rest/v1/nakshathram_profiles${searchParams}`;
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
    res.status(403).json({ message: 'Profile reads are available only through the admin panel.' });
    return;
  }

  if (req.method === 'POST') {
    const payload = req.body || {};
    if (!payload.user_id || !payload.display_name) {
      res.status(400).json({ message: 'user_id and display_name are required.' });
      return;
    }

    const response = await fetch(getProfilesUrl('?on_conflict=user_id'), {
      method: 'POST',
      headers: getHeaders({
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      }),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      res.status(response.status).json({ message: await response.text() });
      return;
    }

    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: 'Method not allowed.' });
}
