const nodeCrypto = require('crypto');

const STORAGE_KEYS = {
  learningStore: 'nakshathram_learning_store_v2',
  syncQueue: 'nakshathram_learning_sync_queue_v1',
  cloudCache: 'nakshathram_learning_cloud_cache_v1',
  userProfile: 'nakshathram_user_profile_v1',
  preferences: 'nakshathram_preferences_v1',
  cloudConfig: 'nakshathram_cloud_config_v1'
};

const SUPABASE_TABLES = {
  profiles: 'nakshathram_profiles',
  typingEvents: 'nakshathram_typing_events'
};

const DEFAULT_BACKEND_URL = 'https://nakshathram.vercel.app';

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function readStorage(storage, key, fallback) {
  return safeJsonParse(storage.getItem(key), fallback);
}

function writeStorage(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

function createUserId() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function createClientEventId() {
  if (typeof nodeCrypto.randomUUID === 'function') {
    return nodeCrypto.randomUUID();
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultProfile() {
  return {
    userId: createUserId(),
    displayName: '',
    createdAt: new Date().toISOString(),
    passwordHash: '',
    passwordEnabled: false,
    lastUnlockedAt: null
  };
}

function createDefaultPreferences() {
  return {
    collectionConsent: null,
    localLearningEnabled: false,
    cloudSyncEnabled: false,
    autoSyncEnabled: true
  };
}

function createDefaultCloudConfig() {
  return {
    backendUrl: DEFAULT_BACKEND_URL,
    supabaseUrl: '',
    supabaseAnonKey: '',
    lastSyncAt: null,
    lastSyncError: '',
    lastConnectionCheckAt: null,
    lastConnectionStatus: 'not_configured'
  };
}

function clearPersistedAuthState(storage) {
  if (!storage || typeof storage.removeItem !== 'function') return;

  storage.removeItem(STORAGE_KEYS.userProfile);
  storage.removeItem(STORAGE_KEYS.preferences);
}

function createEmptyLearningStore() {
  return {
    version: 2,
    languages: {}
  };
}

function createEmptyCloudCache() {
  return {
    version: 1,
    entries: {}
  };
}

function normalizeRomanInput(input) {
  return String(input || '').trim().toLowerCase();
}

function createRomanSignature(input) {
  const cleaned = normalizeRomanInput(input).replace(/[^a-z]/g, '');
  if (!cleaned) return '';

  let signature = cleaned[0];
  for (let index = 1; index < cleaned.length; index += 1) {
    if (cleaned[index] !== signature[signature.length - 1]) {
      signature += cleaned[index];
    }
  }

  return signature;
}

function ensureLanguageBucket(store, lang) {
  if (!store.languages[lang]) {
    store.languages[lang] = {
      patterns: {}
    };
  }

  return store.languages[lang];
}

function createPatternEntry(romanLower, signature) {
  return {
    romanLower,
    signature,
    originals: {},
    selections: {},
    totalCount: 0,
    lastSelectedAt: null,
    lastSource: null
  };
}

function createSelectionEntry() {
  return {
    count: 0,
    sources: {},
    lastSelectedAt: null
  };
}

function migrateLegacyAiMemory(legacyData) {
  const store = createEmptyLearningStore();
  const data = legacyData && typeof legacyData === 'object' ? legacyData : {};

  for (const [lang, patterns] of Object.entries(data)) {
    if (!patterns || typeof patterns !== 'object') continue;
    const langBucket = ensureLanguageBucket(store, lang);

    for (const [pattern, words] of Object.entries(patterns)) {
      const romanLower = normalizeRomanInput(pattern);
      if (!romanLower || !words || typeof words !== 'object') continue;

      const entry = createPatternEntry(romanLower, createRomanSignature(romanLower));
      entry.originals[romanLower] = 1;

      for (const [nativeWord, countValue] of Object.entries(words)) {
        const count = Math.max(1, Number(countValue) || 0);
        const selectionEntry = createSelectionEntry();
        selectionEntry.count = count;
        selectionEntry.sources.legacy = count;
        selectionEntry.lastSelectedAt = null;
        entry.selections[nativeWord] = selectionEntry;
        entry.totalCount += count;
      }

      langBucket.patterns[romanLower] = entry;
    }
  }

  return store;
}

function cloneStore(store) {
  return JSON.parse(JSON.stringify(store || createEmptyLearningStore()));
}

function recordSelection(store, payload) {
  const {
    lang,
    romanInput,
    nativeWord,
    source = 'unknown',
    weight = 1,
    userId = '',
    deviceId = '',
    clientVersion = '',
    notePath = ''
  } = payload || {};

  const romanLower = normalizeRomanInput(romanInput);
  if (!lang || !romanLower || !nativeWord) {
    return null;
  }

  const signature = createRomanSignature(romanLower);
  const languageBucket = ensureLanguageBucket(store, lang);
  const patternEntry = languageBucket.patterns[romanLower] || createPatternEntry(romanLower, signature);
  patternEntry.signature = signature;
  patternEntry.originals[romanInput] = (patternEntry.originals[romanInput] || 0) + weight;

  const selectionEntry = patternEntry.selections[nativeWord] || createSelectionEntry();
  selectionEntry.count += weight;
  selectionEntry.sources[source] = (selectionEntry.sources[source] || 0) + weight;
  selectionEntry.lastSelectedAt = new Date().toISOString();

  patternEntry.selections[nativeWord] = selectionEntry;
  patternEntry.totalCount += weight;
  patternEntry.lastSelectedAt = selectionEntry.lastSelectedAt;
  patternEntry.lastSource = source;
  languageBucket.patterns[romanLower] = patternEntry;

  return {
    event: {
      clientEventId: createClientEventId(),
      userId,
      language: lang,
      romanInput: String(romanInput || ''),
      romanLower,
      romanSignature: signature,
      nativeWord,
      source,
      deviceId,
      clientVersion,
      notePath,
      createdAt: new Date().toISOString()
    },
    patternEntry
  };
}

function revertSelection(store, payload) {
  const { lang, romanInput, nativeWord, source = 'unknown', weight = 1 } = payload || {};
  const romanLower = normalizeRomanInput(romanInput);
  if (!lang || !romanLower || !nativeWord) return false;

  const languageBucket = store.languages[lang];
  if (!languageBucket || !languageBucket.patterns[romanLower]) return false;

  const patternEntry = languageBucket.patterns[romanLower];
  const selectionEntry = patternEntry.selections[nativeWord];
  if (!selectionEntry) return false;

  selectionEntry.count = Math.max(0, selectionEntry.count - weight);
  if (selectionEntry.sources[source]) {
    selectionEntry.sources[source] = Math.max(0, selectionEntry.sources[source] - weight);
    if (selectionEntry.sources[source] === 0) {
      delete selectionEntry.sources[source];
    }
  }

  patternEntry.totalCount = Math.max(0, patternEntry.totalCount - weight);

  if (selectionEntry.count === 0) {
    delete patternEntry.selections[nativeWord];
  }

  if (Object.keys(patternEntry.selections).length === 0) {
    delete languageBucket.patterns[romanLower];
  }

  return true;
}

function deleteLearnedMapping(store, lang, romanLower, nativeWord) {
  const languageBucket = store.languages[lang];
  if (!languageBucket || !languageBucket.patterns[romanLower]) return false;

  delete languageBucket.patterns[romanLower].selections[nativeWord];
  const remainingSelections = Object.values(languageBucket.patterns[romanLower].selections);

  if (remainingSelections.length === 0) {
    delete languageBucket.patterns[romanLower];
    return true;
  }

  languageBucket.patterns[romanLower].totalCount = remainingSelections.reduce((sum, entry) => sum + (entry.count || 0), 0);
  return true;
}

function buildLegacyMirror(store) {
  const mirror = {};

  for (const [lang, languageBucket] of Object.entries(store.languages || {})) {
    mirror[lang] = {};
    for (const [romanLower, patternEntry] of Object.entries(languageBucket.patterns || {})) {
      mirror[lang][romanLower] = {};
      for (const [nativeWord, selectionEntry] of Object.entries(patternEntry.selections || {})) {
        mirror[lang][romanLower][nativeWord] = selectionEntry.count || 0;
      }
    }
  }

  return mirror;
}

function getLearningEntries(store, lang) {
  const languageBucket = (store.languages || {})[lang];
  if (!languageBucket) return [];

  const entries = [];

  for (const [romanLower, patternEntry] of Object.entries(languageBucket.patterns || {})) {
    for (const [nativeWord, selectionEntry] of Object.entries(patternEntry.selections || {})) {
      entries.push({
        pattern: romanLower,
        signature: patternEntry.signature || createRomanSignature(romanLower),
        word: nativeWord,
        frequency: selectionEntry.count || 0,
        sources: Object.keys(selectionEntry.sources || {}),
        lastSelectedAt: selectionEntry.lastSelectedAt || patternEntry.lastSelectedAt || null
      });
    }
  }

  entries.sort((left, right) => {
    if ((right.frequency || 0) !== (left.frequency || 0)) {
      return (right.frequency || 0) - (left.frequency || 0);
    }

    return String(right.lastSelectedAt || '').localeCompare(String(left.lastSelectedAt || ''));
  });

  return entries;
}

function getLearningSummary(store, lang, queueLength) {
  const entries = getLearningEntries(store, lang);
  const uniquePatterns = new Set(entries.map((entry) => entry.pattern)).size;
  const uniqueWords = new Set(entries.map((entry) => entry.word)).size;
  const totalSelections = entries.reduce((sum, entry) => sum + (entry.frequency || 0), 0);

  return {
    totalSelections,
    uniquePatterns,
    uniqueWords,
    pendingSyncCount: queueLength
  };
}

function rankWord(target, bucket, score, matchType) {
  const current = bucket.get(target.word) || {
    word: target.word,
    score: 0,
    localCount: 0,
    exactCount: 0,
    signatureCount: 0,
    prefixCount: 0,
    matchTypes: new Set()
  };

  current.score += score;
  current.localCount += target.count || 0;
  if (matchType === 'exact') current.exactCount += target.count || 0;
  if (matchType === 'signature') current.signatureCount += target.count || 0;
  if (matchType === 'prefix') current.prefixCount += target.count || 0;
  current.matchTypes.add(matchType);
  bucket.set(target.word, current);
}

function getLocalCandidates(store, lang, romanInput, options = {}) {
  const { limit = 8, includePrefix = true } = options;
  const romanLower = normalizeRomanInput(romanInput);
  const signature = createRomanSignature(romanLower);
  const languageBucket = (store.languages || {})[lang];
  if (!romanLower || !languageBucket) return [];

  const ranked = new Map();

  for (const [patternKey, patternEntry] of Object.entries(languageBucket.patterns || {})) {
    const selections = Object.entries(patternEntry.selections || {}).map(([word, value]) => ({
      word,
      count: value.count || 0
    }));

    if (patternKey === romanLower) {
      selections.forEach((selection) => rankWord(selection, ranked, (selection.count || 0) * 10, 'exact'));
      continue;
    }

    if (signature && patternEntry.signature === signature) {
      selections.forEach((selection) => rankWord(selection, ranked, (selection.count || 0) * 5, 'signature'));
      continue;
    }

    if (includePrefix && patternKey.startsWith(romanLower)) {
      selections.forEach((selection) => rankWord(selection, ranked, (selection.count || 0) * 2, 'prefix'));
    }
  }

  return [...ranked.values()]
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.localCount !== left.localCount) return right.localCount - left.localCount;
      return left.word.localeCompare(right.word);
    })
    .slice(0, limit)
    .map((entry) => ({
      word: entry.word,
      localCount: entry.localCount,
      matchTypes: [...entry.matchTypes],
      exactCount: entry.exactCount,
      signatureCount: entry.signatureCount,
      prefixCount: entry.prefixCount
    }));
}

function aggregateCloudRows(rows, romanInput) {
  const romanLower = normalizeRomanInput(romanInput);
  const signature = createRomanSignature(romanInput);
  const ranked = new Map();

  for (const row of rows || []) {
    if (!row || !row.native_word) continue;
    const isExact = row.roman_lower === romanLower;
    const isSignature = row.roman_signature === signature;
    const key = row.native_word;
    const current = ranked.get(key) || {
      word: key,
      cloudCount: 0,
      exactCount: 0,
      signatureCount: 0,
      score: 0
    };

    current.cloudCount += 1;
    if (isExact) {
      current.exactCount += 1;
      current.score += 10;
    } else if (isSignature) {
      current.signatureCount += 1;
      current.score += 5;
    } else {
      current.score += 1;
    }

    ranked.set(key, current);
  }

  return [...ranked.values()].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.cloudCount !== left.cloudCount) return right.cloudCount - left.cloudCount;
    return left.word.localeCompare(right.word);
  });
}

function mergeCandidateWords(...groups) {
  const seen = new Set();
  const merged = [];

  for (const group of groups) {
    for (const candidate of group || []) {
      const word = typeof candidate === 'string' ? candidate : candidate.word;
      if (!word || seen.has(word)) continue;
      seen.add(word);
      merged.push(candidate);
    }
  }

  return merged;
}

function readQueue(storage) {
  return readStorage(storage, STORAGE_KEYS.syncQueue, []);
}

function writeQueue(storage, queue) {
  writeStorage(storage, STORAGE_KEYS.syncQueue, queue);
}

function readCloudCache(storage) {
  return readStorage(storage, STORAGE_KEYS.cloudCache, createEmptyCloudCache());
}

function writeCloudCache(storage, cache) {
  writeStorage(storage, STORAGE_KEYS.cloudCache, cache);
}

function getCloudCacheKey(lang, romanInput) {
  return `${lang}:${normalizeRomanInput(romanInput)}`;
}

function getCachedCloudRows(storage, lang, romanInput, ttlMs = 5 * 60 * 1000) {
  const cache = readCloudCache(storage);
  const cacheKey = getCloudCacheKey(lang, romanInput);
  const entry = cache.entries[cacheKey];
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > ttlMs) {
    return null;
  }

  return entry.rows || [];
}

function setCachedCloudRows(storage, lang, romanInput, rows) {
  const cache = readCloudCache(storage);
  cache.entries[getCloudCacheKey(lang, romanInput)] = {
    cachedAt: Date.now(),
    rows: rows || []
  };
  writeCloudCache(storage, cache);
}

function sanitizeSupabaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function sanitizeBackendUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function hasValidSupabaseConfig(config) {
  return Boolean(
    sanitizeBackendUrl(config.backendUrl) ||
    (sanitizeSupabaseUrl(config.supabaseUrl) && String(config.supabaseAnonKey || '').trim())
  );
}

function getSupabaseHeaders(config, extra = {}) {
  const key = String(config.supabaseAnonKey || '').trim();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

function getBackendHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...extra
  };
}

function shouldUseBackend(config) {
  return Boolean(sanitizeBackendUrl(config.backendUrl));
}

async function testSupabaseConnection(config) {
  if (!hasValidSupabaseConfig(config)) {
    return { ok: false, message: 'Enter a Vercel backend URL or direct Supabase credentials first.' };
  }

  if (shouldUseBackend(config)) {
    try {
      const response = await fetch(`${sanitizeBackendUrl(config.backendUrl)}/api/typing-config`);
      const payload = await response.json();
      if (!response.ok || payload.configured === false) {
        return { ok: false, message: payload.message || 'Vercel backend is reachable, but Supabase is not configured there yet.' };
      }

      return { ok: true, message: payload.message || 'Vercel typing backend connection successful.' };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  const baseUrl = sanitizeSupabaseUrl(config.supabaseUrl);
  const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.profiles}?select=user_id&limit=1`;

  try {
    const response = await fetch(url, {
      headers: getSupabaseHeaders(config)
    });

    if (!response.ok) {
      return { ok: false, message: `Supabase connection failed: ${response.status} ${response.statusText}` };
    }

    return { ok: true, message: 'Supabase connection successful.' };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function syncProfile(config, profile, preferences) {
  if (!hasValidSupabaseConfig(config)) {
    return { ok: false, message: 'Supabase credentials are missing.' };
  }

  const payload = {
    user_id: profile.userId,
    display_name: profile.displayName,
    collection_consent: preferences.collectionConsent === true,
    local_learning_enabled: preferences.localLearningEnabled === true,
    cloud_sync_enabled: preferences.cloudSyncEnabled === true,
    updated_at: new Date().toISOString()
  };

  if (shouldUseBackend(config)) {
    try {
      const response = await fetch(`${sanitizeBackendUrl(config.backendUrl)}/api/typing-profiles`, {
        method: 'POST',
        headers: getBackendHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        return { ok: false, message: text || `Profile sync failed with ${response.status}.` };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  const baseUrl = sanitizeSupabaseUrl(config.supabaseUrl);
  const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.profiles}?on_conflict=user_id`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getSupabaseHeaders(config, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      }),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: text || `Profile sync failed with ${response.status}.` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function registerAccount(config, payload) {
  const backendUrl = sanitizeBackendUrl(config.backendUrl);
  if (!backendUrl) {
    return { ok: false, message: 'Database backend is not available.', session: null };
  }

  try {
    const response = await fetch(`${backendUrl}/api/auth-register`, {
      method: 'POST',
      headers: getBackendHeaders(),
      body: JSON.stringify(payload || {})
    });

    const body = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        message: body.message || `Account creation failed with ${response.status}.`,
        session: null,
        suggestedUserId: body.suggestedUserId || ''
      };
    }

    return { ok: true, session: body.session || null };
  } catch (error) {
    return { ok: false, message: error.message, session: null };
  }
}

async function loginAccount(config, payload) {
  const backendUrl = sanitizeBackendUrl(config.backendUrl);
  if (!backendUrl) {
    return { ok: false, message: 'Database backend is not available.', session: null };
  }

  try {
    const response = await fetch(`${backendUrl}/api/auth-login`, {
      method: 'POST',
      headers: getBackendHeaders(),
      body: JSON.stringify(payload || {})
    });

    const body = await response.json();
    if (!response.ok) {
      return { ok: false, message: body.message || `Sign in failed with ${response.status}.`, session: null };
    }

    return { ok: true, session: body.session || null };
  } catch (error) {
    return { ok: false, message: error.message, session: null };
  }
}

async function updateAccountPassword(config, payload) {
  const backendUrl = sanitizeBackendUrl(config.backendUrl);
  if (!backendUrl) {
    return { ok: false, message: 'Database backend is not available.' };
  }

  try {
    const response = await fetch(`${backendUrl}/api/auth-account`, {
      method: 'POST',
      headers: getBackendHeaders(),
      body: JSON.stringify({
        action: 'updatePassword',
        ...(payload || {})
      })
    });

    const body = await response.json();
    if (!response.ok) {
      return { ok: false, message: body.message || `Password update failed with ${response.status}.` };
    }

    return { ok: true, session: body.session || null, message: body.message || 'Password updated.' };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function disableAccount(config, payload) {
  const backendUrl = sanitizeBackendUrl(config.backendUrl);
  if (!backendUrl) {
    return { ok: false, message: 'Database backend is not available.' };
  }

  try {
    const response = await fetch(`${backendUrl}/api/auth-account`, {
      method: 'POST',
      headers: getBackendHeaders(),
      body: JSON.stringify({
        action: 'disableAccount',
        ...(payload || {})
      })
    });

    const body = await response.json();
    if (!response.ok) {
      return { ok: false, message: body.message || `Account delete failed with ${response.status}.` };
    }

    return { ok: true, message: body.message || 'Account disabled.' };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function syncTypingEvents(config, userId, events) {
  if (!hasValidSupabaseConfig(config)) {
    return { ok: false, message: 'Supabase credentials are missing.', syncedIds: [] };
  }

  if (!events || events.length === 0) {
    return { ok: true, syncedIds: [] };
  }

  const payload = events.map((event) => ({
    client_event_id: event.clientEventId,
    user_id: userId,
    language: event.language,
    roman_input: event.romanInput,
    roman_lower: event.romanLower,
    roman_signature: event.romanSignature,
    native_word: event.nativeWord,
    source: event.source,
    device_id: event.deviceId || null,
    client_version: event.clientVersion || null,
    note_path: event.notePath || null,
    created_at: event.createdAt
  }));

  if (shouldUseBackend(config)) {
    try {
      const response = await fetch(`${sanitizeBackendUrl(config.backendUrl)}/api/typing-events`, {
        method: 'POST',
        headers: getBackendHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        return { ok: false, message: text || `Typing data sync failed with ${response.status}.`, syncedIds: [] };
      }

      return {
        ok: true,
        syncedIds: events.map((event) => event.clientEventId)
      };
    } catch (error) {
      return { ok: false, message: error.message, syncedIds: [] };
    }
  }

  const baseUrl = sanitizeSupabaseUrl(config.supabaseUrl);
  const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.typingEvents}?on_conflict=client_event_id`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getSupabaseHeaders(config, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal'
      }),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: text || `Typing data sync failed with ${response.status}.`, syncedIds: [] };
    }

    return {
      ok: true,
      syncedIds: events.map((event) => event.clientEventId)
    };
  } catch (error) {
    return { ok: false, message: error.message, syncedIds: [] };
  }
}

async function fetchCloudCandidates(config, lang, romanInput, limit = 120) {
  if (!hasValidSupabaseConfig(config)) {
    return { ok: false, message: 'Supabase credentials are missing.', rows: [] };
  }

  const romanLower = normalizeRomanInput(romanInput);
  if (!romanLower) {
    return { ok: true, rows: [] };
  }

  const signature = createRomanSignature(romanLower);

  if (shouldUseBackend(config)) {
    const params = new URLSearchParams();
    params.set('mode', 'lookup');
    params.set('language', lang);
    params.set('roman', romanLower);
    params.set('signature', signature);
    params.set('limit', String(limit));

    try {
      const response = await fetch(`${sanitizeBackendUrl(config.backendUrl)}/api/typing-events?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        return { ok: false, message: payload.message || `Cloud lookup failed with ${response.status}.`, rows: [] };
      }

      return { ok: true, rows: payload.rows || [] };
    } catch (error) {
      return { ok: false, message: error.message, rows: [] };
    }
  }

  const params = new URLSearchParams();
  params.set('language', `eq.${lang}`);
  params.set('select', 'roman_lower,roman_signature,native_word,user_id,created_at,source');
  params.set('or', `(roman_lower.eq.${romanLower},roman_signature.eq.${signature})`);
  params.set('limit', String(limit));
  params.set('order', 'created_at.desc');

  const baseUrl = sanitizeSupabaseUrl(config.supabaseUrl);
  const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.typingEvents}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: getSupabaseHeaders(config)
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: text || `Cloud lookup failed with ${response.status}.`, rows: [] };
    }

    return {
      ok: true,
      rows: await response.json()
    };
  } catch (error) {
    return { ok: false, message: error.message, rows: [] };
  }
}

async function fetchRemoteProfile(config, userId) {
  if (!hasValidSupabaseConfig(config)) {
    return { ok: false, message: 'Supabase credentials are missing.', profile: null };
  }

  if (shouldUseBackend(config)) {
    const params = new URLSearchParams();
    params.set('userId', userId);

    try {
      const response = await fetch(`${sanitizeBackendUrl(config.backendUrl)}/api/typing-profiles?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        return { ok: false, message: payload.message || `Profile lookup failed with ${response.status}.`, profile: null };
      }

      return { ok: true, profile: payload.profile || null };
    } catch (error) {
      return { ok: false, message: error.message, profile: null };
    }
  }

  const params = new URLSearchParams();
  params.set('user_id', `eq.${userId}`);
  params.set('select', 'user_id,display_name,password_hash,password_enabled,collection_consent,local_learning_enabled,cloud_sync_enabled');
  params.set('limit', '1');

  const baseUrl = sanitizeSupabaseUrl(config.supabaseUrl);
  const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.profiles}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: getSupabaseHeaders(config)
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: text || `Profile lookup failed with ${response.status}.`, profile: null };
    }

    const profiles = await response.json();
    return { ok: true, profile: profiles[0] || null };
  } catch (error) {
    return { ok: false, message: error.message, profile: null };
  }
}

async function fetchUserTypingEvents(config, userId, limit = 500) {
  if (!hasValidSupabaseConfig(config)) {
    return { ok: false, message: 'Supabase credentials are missing.', rows: [] };
  }

  if (shouldUseBackend(config)) {
    const params = new URLSearchParams();
    params.set('mode', 'user');
    params.set('userId', userId);
    params.set('limit', String(limit));

    try {
      const response = await fetch(`${sanitizeBackendUrl(config.backendUrl)}/api/typing-events?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        return { ok: false, message: payload.message || `User typing history fetch failed with ${response.status}.`, rows: [] };
      }

      return { ok: true, rows: payload.rows || [] };
    } catch (error) {
      return { ok: false, message: error.message, rows: [] };
    }
  }

  const params = new URLSearchParams();
  params.set('user_id', `eq.${userId}`);
  params.set('select', 'client_event_id,language,roman_input,roman_lower,roman_signature,native_word,source,created_at');
  params.set('order', 'created_at.desc');
  params.set('limit', String(limit));

  const baseUrl = sanitizeSupabaseUrl(config.supabaseUrl);
  const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.typingEvents}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: getSupabaseHeaders(config)
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: text || `User typing history fetch failed with ${response.status}.`, rows: [] };
    }

    return { ok: true, rows: await response.json() };
  } catch (error) {
    return { ok: false, message: error.message, rows: [] };
  }
}

function buildStoreFromEvents(events) {
  const store = createEmptyLearningStore();

  for (const event of events || []) {
    recordSelection(store, {
      lang: event.language,
      romanInput: event.romanInput || event.roman_input || event.romanLower || event.roman_lower,
      nativeWord: event.nativeWord || event.native_word,
      source: event.source || 'cloud_import',
      weight: 1,
      userId: event.userId || event.user_id || '',
      deviceId: event.deviceId || event.device_id || '',
      clientVersion: event.clientVersion || event.client_version || '',
      notePath: event.notePath || event.note_path || ''
    });
  }

  return store;
}

async function hashPassword(password) {
  const value = String(password || '');
  if (!value) return '';

  return nodeCrypto.createHash('sha256').update(value).digest('hex');
}

async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  const computed = await hashPassword(password);
  return computed === passwordHash;
}

module.exports = {
  STORAGE_KEYS,
  DEFAULT_BACKEND_URL,
  createDefaultProfile,
  createDefaultPreferences,
  createDefaultCloudConfig,
  clearPersistedAuthState,
  createEmptyLearningStore,
  createEmptyCloudCache,
  normalizeRomanInput,
  createRomanSignature,
  migrateLegacyAiMemory,
  cloneStore,
  recordSelection,
  revertSelection,
  deleteLearnedMapping,
  buildLegacyMirror,
  getLearningEntries,
  getLearningSummary,
  getLocalCandidates,
  aggregateCloudRows,
  mergeCandidateWords,
  readStorage,
  writeStorage,
  readQueue,
  writeQueue,
  getCachedCloudRows,
  setCachedCloudRows,
  sanitizeBackendUrl,
  sanitizeSupabaseUrl,
  hasValidSupabaseConfig,
  testSupabaseConnection,
  registerAccount,
  loginAccount,
  updateAccountPassword,
  disableAccount,
  syncProfile,
  syncTypingEvents,
  fetchCloudCandidates,
  fetchRemoteProfile,
  fetchUserTypingEvents,
  buildStoreFromEvents,
  hashPassword,
  verifyPassword
};
