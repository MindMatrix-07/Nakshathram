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
  const limit = Math.min(Number(req.query.limit || 100), 250);
  const response = await fetch(
    `${url}/rest/v1/nakshathram_profiles?select=user_id,display_name,password_enabled,collection_consent,local_learning_enabled,cloud_sync_enabled,created_at,updated_at&order=updated_at.desc&limit=${limit}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    res.status(response.status).json({ message: await response.text() });
    return;
  }

  res.status(200).json({ rows: await response.json() });
}
