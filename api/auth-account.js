import {
  applyCors,
  buildSession,
  createSessionToken,
  createUserLookup,
  decryptVaultPayload,
  encryptVaultPayload,
  ensureAccountBackend,
  fetchAccountRecord,
  fetchProfileRecord,
  getAccountConfig,
  hashAccountPassword,
  updateAccountRecord,
  upsertProfileRecord,
  verifySessionToken
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

  const { sessionSecret, vaultSecret } = getAccountConfig();
  const payload = req.body || {};
  const action = String(payload.action || '').trim();
  const tokenCheck = verifySessionToken(payload.sessionToken, sessionSecret);

  if (!tokenCheck.ok || !tokenCheck.payload?.userId) {
    res.status(401).json({ message: tokenCheck.message || 'Session expired. Sign in again.' });
    return;
  }

  const userId = String(tokenCheck.payload.userId || '').trim();

  try {
    const accountRecord = await fetchAccountRecord(userId);
    if (!accountRecord || accountRecord.account_status !== 'active') {
      res.status(403).json({ message: 'This account is disabled and can no longer be used.' });
      return;
    }

    const decrypted = decryptVaultPayload(accountRecord, vaultSecret);

    if (action === 'updatePassword') {
      const newPassword = String(payload.newPassword || '');
      if (newPassword.length < 4) {
        res.status(400).json({ message: 'Password must be at least 4 characters.' });
        return;
      }

      const encryptedPayload = encryptVaultPayload({
        userId,
        passwordHash: hashAccountPassword(newPassword)
      }, vaultSecret);

      await updateAccountRecord(createUserLookup(userId), {
        ...encryptedPayload,
        account_status: 'active',
        updated_at: new Date().toISOString()
      });

      const profile = await upsertProfileRecord({
        user_id: userId,
        display_name: String(payload.displayName || payload.currentDisplayName || '').trim(),
        password_hash: null,
        password_enabled: true,
        collection_consent: payload.collectionConsent === true,
        local_learning_enabled: payload.localLearningEnabled !== false,
        cloud_sync_enabled: payload.cloudSyncEnabled === true,
        updated_at: new Date().toISOString()
      });

      const sessionToken = createSessionToken({ userId }, sessionSecret);
      res.status(200).json({
        message: 'Password updated.',
        session: buildSession({
          ...profile,
          display_name: profile.display_name || String(payload.displayName || payload.currentDisplayName || '').trim()
        }, sessionToken)
      });
      return;
    }

    if (action === 'disableAccount') {
      await updateAccountRecord(createUserLookup(userId), {
        account_status: 'disabled',
        disabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      res.status(200).json({ message: 'Account disabled. Existing database data was left unchanged.' });
      return;
    }

    res.status(400).json({ message: 'Unknown account action.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
