import {
  applyCors,
  buildSession,
  createSessionToken,
  createUserLookup,
  createUniqueUserId,
  encryptVaultPayload,
  ensureAccountBackend,
  getAccountConfig,
  hashAccountPassword,
  insertAccountRecord,
  upsertProfileRecord
} from './_lib/account-vault.js';

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const backend = ensureAccountBackend();
  if (!backend.ok) {
    res.status(backend.status).json({ message: backend.message });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  const payload = req.body || {};
  const displayName = String(payload.displayName || '').trim();
  const password = String(payload.password || '');
  const preferredUserId = String(payload.userId || '').trim();
  const collectionConsent = payload.collectionConsent === true;

  if (!displayName) {
    res.status(400).json({ message: 'Display name is required.' });
    return;
  }

  if (password.length < 4) {
    res.status(400).json({ message: 'Password must be at least 4 characters.' });
    return;
  }

  if (!collectionConsent) {
    res.status(400).json({ message: 'The one-time sharing agreement must be accepted.' });
    return;
  }

  try {
    const { vaultSecret, sessionSecret } = getAccountConfig();
    const userId = await createUniqueUserId(preferredUserId);
    const passwordHash = hashAccountPassword(password);
    const encryptedPayload = encryptVaultPayload({
      userId,
      passwordHash
    }, vaultSecret);

    await insertAccountRecord({
      ...encryptedPayload,
      account_lookup: createUserLookup(userId),
      account_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      disabled_at: null
    });

    const profile = await upsertProfileRecord({
      user_id: userId,
      display_name: displayName,
      password_hash: null,
      password_enabled: true,
      collection_consent: true,
      local_learning_enabled: true,
      cloud_sync_enabled: true,
      updated_at: new Date().toISOString()
    });

    const sessionToken = createSessionToken({ userId }, sessionSecret);
    res.status(200).json({
      session: buildSession(profile, sessionToken)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
