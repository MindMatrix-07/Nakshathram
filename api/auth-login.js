import crypto from 'node:crypto';
import {
  applyCors,
  buildSession,
  createSessionToken,
  decryptVaultPayload,
  ensureAccountBackend,
  fetchAccountRecord,
  fetchProfileRecord,
  getAccountConfig,
  hashAccountPassword,
  insertAccountRecord,
  upsertProfileRecord,
  verifyAccountPassword,
  createUserLookup,
  encryptVaultPayload
} from './_lib/account-vault.js';

function verifyLegacyShaPassword(password, passwordHash) {
  const computed = crypto.createHash('sha256').update(String(password || '')).digest('hex');
  return computed === String(passwordHash || '');
}

async function migrateLegacyProfileAccount(userId, password, profile) {
  if (!profile || !profile.password_hash) {
    return { ok: false, message: 'Account not found.' };
  }

  if (!verifyLegacyShaPassword(password, profile.password_hash)) {
    return { ok: false, message: 'User ID or password did not match.' };
  }

  const { vaultSecret } = getAccountConfig();
  const encryptedPayload = encryptVaultPayload({
    userId,
    passwordHash: hashAccountPassword(password)
  }, vaultSecret);

  await insertAccountRecord({
    account_lookup: createUserLookup(userId),
    ...encryptedPayload,
    account_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    disabled_at: null
  });

  return upsertProfileRecord({
    user_id: userId,
    display_name: profile.display_name || '',
    password_hash: null,
    password_enabled: true,
    collection_consent: profile.collection_consent === true,
    local_learning_enabled: profile.local_learning_enabled !== false,
    cloud_sync_enabled: profile.cloud_sync_enabled === true,
    updated_at: new Date().toISOString()
  }).then((updatedProfile) => ({ ok: true, profile: updatedProfile }));
}

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
  const userId = String(payload.userId || '').trim();
  const password = String(payload.password || '');

  if (!userId || !password) {
    res.status(400).json({ message: 'User ID and password are required.' });
    return;
  }

  try {
    const { vaultSecret, sessionSecret } = getAccountConfig();
    let accountRecord = await fetchAccountRecord(userId);
    let profile = await fetchProfileRecord(userId);

    if (!accountRecord && profile && profile.password_hash) {
      const migrated = await migrateLegacyProfileAccount(userId, password, profile);
      if (!migrated.ok) {
        res.status(401).json({ message: migrated.message });
        return;
      }

      accountRecord = await fetchAccountRecord(userId);
      profile = migrated.profile;
    }

    if (!accountRecord) {
      res.status(401).json({ message: 'User ID or password did not match.' });
      return;
    }

    if (accountRecord.account_status !== 'active') {
      res.status(403).json({ message: 'This account is disabled and can no longer be used.' });
      return;
    }

    const decrypted = decryptVaultPayload(accountRecord, vaultSecret);
    if (String(decrypted.userId || '') !== userId || !verifyAccountPassword(password, decrypted.passwordHash || '')) {
      res.status(401).json({ message: 'User ID or password did not match.' });
      return;
    }

    if (!profile) {
      profile = await upsertProfileRecord({
        user_id: userId,
        display_name: '',
        password_hash: null,
        password_enabled: true,
        collection_consent: false,
        local_learning_enabled: false,
        cloud_sync_enabled: false,
        updated_at: new Date().toISOString()
      });
    }

    const sessionToken = createSessionToken({ userId }, sessionSecret);
    res.status(200).json({
      session: buildSession(profile, sessionToken)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
