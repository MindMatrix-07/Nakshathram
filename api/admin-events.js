import { applyCors, getConfig, getHeaders, verifyAdminRequest } from './_lib/admin.js';

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const auth = verifyAdminRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ message: auth.message });
    return;
  }

  const { url } = getConfig();
  const limit = Math.min(Number(req.query.limit || 200), 500);
  const language = String(req.query.language || '').trim();
  const userId = String(req.query.userId || '').trim();
  const params = new URLSearchParams();

  params.set('select', 'client_event_id,user_id,language,roman_input,roman_lower,roman_signature,native_word,source,device_id,client_version,note_path,created_at');
  params.set('order', 'created_at.desc');
  params.set('limit', String(limit));

  if (language) {
    params.set('language', `eq.${language}`);
  }

  if (userId) {
    params.set('user_id', `eq.${userId}`);
  }

  const response = await fetch(`${url}/rest/v1/nakshathram_typing_events?${params.toString()}`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    res.status(response.status).json({ message: await response.text() });
    return;
  }

  res.status(200).json({ rows: await response.json() });
}
