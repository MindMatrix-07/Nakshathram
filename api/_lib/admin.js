export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-admin-password'
  );
}

export function getConfig() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    adminPassword: String(process.env.ADMIN_PANEL_PASSWORD || '').trim()
  };
}

export function getHeaders(extra = {}) {
  const { key } = getConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

export function verifyAdminRequest(req) {
  const { adminPassword, url, key } = getConfig();
  const providedPassword = String(req.headers['x-admin-password'] || '').trim();

  if (!url || !key) {
    return { ok: false, status: 503, message: 'Database backend is not configured in Vercel.' };
  }

  if (!adminPassword) {
    return { ok: false, status: 503, message: 'Admin panel password is not configured in Vercel.' };
  }

  if (!providedPassword || providedPassword !== adminPassword) {
    return { ok: false, status: 401, message: 'Invalid admin password.' };
  }

  return { ok: true };
}
