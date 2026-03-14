import crypto from 'node:crypto';

export const ACCOUNT_TABLE = 'nakshathram_account_vault';
export const PROFILES_TABLE = 'nakshathram_profiles';
export const TYPING_EVENTS_TABLE = 'nakshathram_typing_events';

const USER_ID_PATTERN = /^\d{8}$/;

export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-admin-password'
  );
}

export function getAccountConfig() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    vaultSecret: String(process.env.ACCOUNT_VAULT_SECRET || process.env.AUTH_VAULT_SECRET || '').trim(),
    sessionSecret: String(process.env.ACCOUNT_SESSION_SECRET || process.env.ACCOUNT_VAULT_SECRET || process.env.AUTH_VAULT_SECRET || '').trim()
  };
}

export function getServiceHeaders(extra = {}) {
  const { key } = getAccountConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

export function ensureAccountBackend() {
  const { url, key, vaultSecret, sessionSecret } = getAccountConfig();

  if (!url || !key) {
    return { ok: false, status: 503, message: 'Database backend is not configured in Vercel.' };
  }

  if (!vaultSecret) {
    return { ok: false, status: 503, message: 'Account vault secret is not configured in Vercel.' };
  }

  if (!sessionSecret) {
    return { ok: false, status: 503, message: 'Account session secret is not configured in Vercel.' };
  }

  return { ok: true };
}

export function normalizeUserId(userId) {
  return String(userId || '').trim();
}

export function isValidUserId(userId) {
  return USER_ID_PATTERN.test(normalizeUserId(userId));
}

export function createEightDigitUserId() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export function createUserLookup(userId) {
  return crypto.createHash('sha256').update(normalizeUserId(userId)).digest('hex');
}

function getEncryptionKey(secret) {
  return crypto.createHash('sha256').update(String(secret || '')).digest();
}

export function hashAccountPassword(password) {
  const value = String(password || '');
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(value, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyAccountPassword(password, storedHash) {
  const [salt, storedValue] = String(storedHash || '').split(':');
  if (!salt || !storedValue) return false;

  const storedBuffer = Buffer.from(storedValue, 'hex');
  const computedBuffer = crypto.scryptSync(String(password || ''), salt, storedBuffer.length);
  return storedBuffer.length === computedBuffer.length && crypto.timingSafeEqual(storedBuffer, computedBuffer);
}

export function encryptVaultPayload(payload, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload || {}), 'utf8'),
    cipher.final()
  ]);

  return {
    account_iv: iv.toString('base64'),
    account_ciphertext: encrypted.toString('base64'),
    account_tag: cipher.getAuthTag().toString('base64')
  };
}

export function decryptVaultPayload(row, secret) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(secret),
    Buffer.from(String(row.account_iv || ''), 'base64')
  );
  decipher.setAuthTag(Buffer.from(String(row.account_tag || ''), 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(String(row.account_ciphertext || ''), 'base64')),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

export function createSessionToken(payload, secret, maxAgeMs = 12 * 60 * 60 * 1000) {
  const sessionPayload = {
    ...payload,
    exp: Date.now() + maxAgeMs
  };

  const encodedPayload = Buffer.from(JSON.stringify(sessionPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', String(secret || '')).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token, secret) {
  const [encodedPayload, signature] = String(token || '').split('.');
  if (!encodedPayload || !signature) {
    return { ok: false, message: 'Session token is missing or invalid.' };
  }

  const expectedSignature = crypto.createHmac('sha256', String(secret || '')).update(encodedPayload).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return { ok: false, message: 'Session token signature is invalid.' };
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload || payload.exp <= Date.now()) {
      return { ok: false, message: 'Session token expired.' };
    }

    return { ok: true, payload };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

export function buildSession(profile, sessionToken) {
  return {
    userId: profile.user_id,
    displayName: profile.display_name || '',
    collectionConsent: profile.collection_consent === true,
    localLearningEnabled: profile.local_learning_enabled !== false,
    cloudSyncEnabled: profile.cloud_sync_enabled === true,
    passwordEnabled: true,
    sessionToken
  };
}

export async function fetchRows(table, query = '') {
  const { url } = getAccountConfig();
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: getServiceHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function fetchAccountRecord(userId) {
  const { url } = getAccountConfig();
  const query = `?account_lookup=eq.${createUserLookup(userId)}&select=account_lookup,account_iv,account_ciphertext,account_tag,account_status,created_at,updated_at,disabled_at&limit=1`;
  const response = await fetch(`${url}/rest/v1/${ACCOUNT_TABLE}${query}`, {
    headers: getServiceHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = await response.json();
  return rows[0] || null;
}

export async function fetchProfileRecord(userId) {
  const { url } = getAccountConfig();
  const query = '?select=user_id,display_name,collection_consent,local_learning_enabled,cloud_sync_enabled,created_at,updated_at,password_hash,password_enabled&limit=1';
  const response = await fetch(`${url}/rest/v1/${PROFILES_TABLE}${query}&user_id=eq.${encodeURIComponent(normalizeUserId(userId))}`, {
    headers: getServiceHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = await response.json();
  return rows[0] || null;
}

export async function upsertProfileRecord(profile) {
  const { url } = getAccountConfig();
  const response = await fetch(`${url}/rest/v1/${PROFILES_TABLE}?on_conflict=user_id`, {
    method: 'POST',
    headers: getServiceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    }),
    body: JSON.stringify(profile)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = await response.json();
  return rows[0] || profile;
}

export async function insertAccountRecord(record) {
  const { url } = getAccountConfig();
  const response = await fetch(`${url}/rest/v1/${ACCOUNT_TABLE}`, {
    method: 'POST',
    headers: getServiceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }),
    body: JSON.stringify(record)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = await response.json();
  return rows[0] || record;
}

export async function updateAccountRecord(accountLookup, patch) {
  const { url } = getAccountConfig();
  const response = await fetch(`${url}/rest/v1/${ACCOUNT_TABLE}?account_lookup=eq.${accountLookup}`, {
    method: 'PATCH',
    headers: getServiceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }),
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = await response.json();
  return rows[0] || patch;
}

export async function createUniqueUserId(preferredUserId = '') {
  const preferred = normalizeUserId(preferredUserId);
  const candidates = [];

  if (isValidUserId(preferred)) {
    candidates.push(preferred);
  }

  while (candidates.length < 12) {
    candidates.push(createEightDigitUserId());
  }

  for (const candidate of candidates) {
    const account = await fetchAccountRecord(candidate);
    const profile = await fetchProfileRecord(candidate);
    if (!account && !profile) {
      return candidate;
    }
  }

  throw new Error('Could not allocate a unique 8-digit user ID.');
}
