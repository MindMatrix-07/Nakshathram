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
  const profilesResponse = await fetch(`${url}/rest/v1/nakshathram_profiles?select=user_id`, {
    headers: getHeaders({ Prefer: 'count=exact' })
  });

  const eventsResponse = await fetch(`${url}/rest/v1/nakshathram_typing_events?select=language,created_at&order=created_at.desc&limit=500`, {
    headers: getHeaders({ Prefer: 'count=exact' })
  });

  if (!profilesResponse.ok || !eventsResponse.ok) {
    res.status(500).json({ message: 'Could not read admin summary from the database.' });
    return;
  }

  const profileCount = Number(profilesResponse.headers.get('content-range')?.split('/')[1] || 0);
  const eventCount = Number(eventsResponse.headers.get('content-range')?.split('/')[1] || 0);
  const recentEvents = await eventsResponse.json();
  const languageCounts = {};

  recentEvents.forEach((row) => {
    languageCounts[row.language] = (languageCounts[row.language] || 0) + 1;
  });

  res.status(200).json({
    totals: {
      profiles: profileCount,
      events: eventCount
    },
    recentLanguageActivity: Object.entries(languageCounts)
      .map(([language, count]) => ({ language, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8)
  });
}
