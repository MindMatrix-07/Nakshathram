const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const packageJson = require('./package.json');
const {
  STORAGE_KEYS,
  DEFAULT_BACKEND_URL,
  createDefaultProfile,
  createDefaultPreferences,
  createDefaultCloudConfig,
  clearPersistedAuthState,
  createEmptyLearningStore,
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
  buildStoreFromEvents
} = require('./api/typing-learning');
const editor = document.getElementById('editor');
const btnMl = document.getElementById('btn-ml');
const btnEn = document.getElementById('btn-en');
const suggestionsBox = document.getElementById('suggestions-box');
const debugLogBox = document.getElementById('debug-log-box');
const debugLogContent = document.getElementById('debug-log-content');
const btnClearLogs = document.getElementById('btn-clear-logs');

// Debug Logging Logic
function logToBox(message, type = 'info') {
  if (!debugLogContent) return;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
  debugLogContent.appendChild(entry);
  debugLogContent.scrollTop = debugLogContent.scrollHeight;
}

// Override console
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  originalLog(...args);
  logToBox(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'info');
};
console.error = (...args) => {
  originalError(...args);
  logToBox(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'error');
};

if (btnClearLogs) {
  btnClearLogs.addEventListener('click', () => {
    debugLogContent.innerHTML = '';
  });
}

console.log('Nakshathram Editor Initialized');

// Window Controls (Minimize & Close)
const winMin = document.getElementById('win-min');
const winClose = document.getElementById('win-close');

if (winMin) {
  winMin.addEventListener('click', () => ipcRenderer.send('minimize-window'));
}
if (winClose) {
  winClose.addEventListener('click', () => ipcRenderer.send('close-window'));
}

// Toolbar & Menu Elements
const btnMore = document.getElementById('btn-more');
const moreMenu = document.getElementById('more-menu');

let selectedCorrections = []; // Array for multi-selection

// Ghost Character Customization State
let ghostFontSize = 64;
let ghostOffsetX = 0;
let ghostOffsetY = 0;

const toggleSuggestions = document.getElementById('toggle-suggestions');
const btnLangSelector = document.getElementById('btn-lang-selector');
const langMenu = document.getElementById('lang-menu');
const langItems = document.querySelectorAll('.dropdown-item-lang');

// Styling Buttons
const btnFsDec = document.getElementById('btn-fs-dec');
const btnFsInc = document.getElementById('btn-fs-inc');
const fsDisplay = document.getElementById('current-fs');

// File Management Elements
const btnNewFileMain = document.getElementById('btn-new-file-main');
const newFileMenu = document.getElementById('new-file-menu');
const btnCreateNew = document.getElementById('btn-create-new');
const btnSelectFile = document.getElementById('btn-select-file');
const btnSaveTxt = document.getElementById('btn-save-txt');
const btnShareTxt = document.getElementById('btn-share-txt');
const listToday = document.getElementById('file-list-today');
const listYesterday = document.getElementById('file-list-yesterday');
const listEarlier = document.getElementById('file-list-earlier');

// Correction Modal Elements
const btnIsCorrect = document.getElementById('btn-is-correct');
const isCorrectModal = document.getElementById('is-correct-modal');
const btnCloseCorrectModal = document.getElementById('btn-close-correct-modal');
const btnClearCanvas = document.getElementById('btn-clear-canvas');
const btnVerifyUpdate = document.getElementById('btn-verify-update');
const btnEraser = document.getElementById('btn-eraser');
const drawingCanvas = document.getElementById('drawing-canvas');
const displayEnglishWord = document.getElementById('display-english-word');
const correctionResults = document.getElementById('correction-results');
const resultsList = document.getElementById('results-list');

// AI & Custom Word Modal Elements
const btnAddWordTarget = document.getElementById('btn-add-word');
const addWordModal = document.getElementById('add-word-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnSubmitWord = document.getElementById('btn-submit-word');
const inputPattern = document.getElementById('input-pattern');
const inputWord = document.getElementById('input-word');
const wordTableBody = document.getElementById('word-table-body');
const btnClearCustomDict = document.getElementById('btn-clear-custom-dict');
const btnAiDashboard = document.getElementById('btn-ai-dashboard');
const aiDashboardModal = document.getElementById('ai-dashboard-modal');
const btnCloseAiModal = document.getElementById('btn-close-ai-modal');
const btnClearAiMemory = document.getElementById('btn-clear-ai-memory');
const aiWordTableBody = document.getElementById('ai-word-table-body');
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
const btnOpenSettingsFromAi = document.getElementById('btn-open-settings-from-ai');
const btnSyncLearningNow = document.getElementById('btn-sync-learning-now');
const aiDashboardStatus = document.getElementById('ai-dashboard-status');
const dashboardSyncBadge = document.getElementById('dashboard-sync-badge');
const dashboardSummaryCopy = document.getElementById('dashboard-summary-copy');
const dashboardConsentText = document.getElementById('dashboard-consent-text');
const dashboardActiveLanguage = document.getElementById('dashboard-active-language');
const dashboardUserName = document.getElementById('dashboard-user-name');
const dashboardUserId = document.getElementById('dashboard-user-id');
const aiStatTotal = document.getElementById('ai-stat-total');
const aiStatPatterns = document.getElementById('ai-stat-patterns');
const aiStatWords = document.getElementById('ai-stat-words');
const aiStatSync = document.getElementById('ai-stat-sync');
const settingsUserName = document.getElementById('settings-user-name');
const settingsUserId = document.getElementById('settings-user-id');
const settingsConsentStatus = document.getElementById('settings-consent-status');
const btnSaveProfile = document.getElementById('btn-save-profile');
const btnCopyUserId = document.getElementById('btn-copy-user-id');
const settingsLocalLearningToggle = document.getElementById('settings-local-learning-toggle');
const settingsCloudSyncToggle = document.getElementById('settings-cloud-sync-toggle');
const settingsAutoSyncToggle = document.getElementById('settings-auto-sync-toggle');
const settingsPasswordEnabled = document.getElementById('settings-password-enabled');
const settingsPassword = document.getElementById('settings-password');
const settingsPasswordConfirm = document.getElementById('settings-password-confirm');
const btnSavePassword = document.getElementById('btn-save-password');
const btnSignOut = document.getElementById('btn-sign-out');
const btnDeleteAccount = document.getElementById('btn-delete-account');
const btnClearPassword = document.getElementById('btn-clear-password');
const settingsBackendUrl = document.getElementById('settings-backend-url');
const settingsSupabaseUrl = document.getElementById('settings-supabase-url');
const settingsSupabaseKey = document.getElementById('settings-supabase-key');
const btnTestSupabase = document.getElementById('btn-test-supabase');
const btnSyncNow = document.getElementById('btn-sync-now');
const supabaseConnectionBadge = document.getElementById('supabase-connection-badge');
const settingsSyncStatus = document.getElementById('settings-sync-status');
const settingsRestoreUserId = document.getElementById('settings-restore-user-id');
const settingsRestorePassword = document.getElementById('settings-restore-password');
const btnLinkExistingAccount = document.getElementById('btn-link-existing-account');
const settingsRestoreStatus = document.getElementById('settings-restore-status');
const authGatewayModal = document.getElementById('auth-gateway-modal');
const authGatewayTitle = document.getElementById('auth-gateway-title');
const authGatewayBadge = document.getElementById('auth-gateway-badge');
const authGatewayCopy = document.getElementById('auth-gateway-copy');
const authGatewayUserName = document.getElementById('auth-gateway-user-name');
const authGatewayUserId = document.getElementById('auth-gateway-user-id');
const authGatewayStatus = document.getElementById('auth-gateway-status');
const authGatewayButtonText = document.getElementById('auth-gateway-button-text');
const authGatewayIcon = document.getElementById('auth-gateway-icon');
const btnAuthPrimary = document.getElementById('btn-auth-primary');
const btnAuthCreateAccount = document.getElementById('btn-auth-create-account');
const welcomeModal = document.getElementById('welcome-modal');
const welcomeName = document.getElementById('welcome-name');
const welcomeUserId = document.getElementById('welcome-user-id');
const welcomePassword = document.getElementById('welcome-password');
const welcomePasswordConfirm = document.getElementById('welcome-password-confirm');
const welcomeConsent = document.getElementById('welcome-consent');
const welcomeCloudOptIn = document.getElementById('welcome-cloud-opt-in');
const welcomeStatus = document.getElementById('welcome-status');
const btnCompleteOnboarding = document.getElementById('btn-complete-onboarding');
const unlockModal = document.getElementById('unlock-modal');
const unlockUserId = document.getElementById('unlock-user-id');
const unlockPassword = document.getElementById('unlock-password');
const unlockStatus = document.getElementById('unlock-status');
const btnUnlockApp = document.getElementById('btn-unlock-app');

// Plugins Modal Elements
const btnPluginsTarget = document.getElementById('btn-plugins');
const pluginsModal = document.getElementById('plugins-modal');
const btnClosePluginsModal = document.getElementById('btn-close-plugins-modal');
const btnOfflineToolsTarget = document.getElementById('btn-offline-tools');
const offlineToolsModal = document.getElementById('offline-tools-modal');
const btnCloseOfflineToolsModal = document.getElementById('btn-close-offline-tools-modal');
const btnOpenInputSettings = document.getElementById('btn-open-input-settings');
const btnOpenOfflineToolsFolder = document.getElementById('btn-open-offline-tools-folder');
const offlineToolsGrid = document.getElementById('offline-tools-grid');
const offlineToolsSummary = document.getElementById('offline-tools-summary');
const offlineToolsSummaryText = document.getElementById('offline-tools-summary-text');

// Plugin Host Elements
const pluginSidebarHost = document.getElementById('plugin-sidebar-host');
const pluginModalHost = document.getElementById('plugin-modal-host');
const installedPluginCards = document.getElementById('installed-plugin-cards');
const pluginsEmptyState = document.getElementById('plugins-empty-state');
const btnAddPlugin = document.getElementById('btn-add-plugin');

// Editor Spotify Player (still used by spotify plugin)
const editorSpotifyPlayer = document.getElementById('editor-spotify-player');

let currentLang = localStorage.getItem('last_selected_lang') || 'ml'; // Active Indian language
let isEnglishMode = localStorage.getItem('last_is_english_mode') === 'true'; // Toggle between English and the current Indian language
let isTranslating = false;

// Correction state
let lastTranslitData = {
  english: '',
  malayalam: '',
  candidates: [],
  selectionPath: null, // Used to re-select the word if needed
  justTransliterated: false, // Flag for AI unlearning
  correctionRange: null, // The exact text node range for correction replacement
  learningEvent: null
};

// Custom words state - Refactored for language grouping
let customWordsData = JSON.parse(localStorage.getItem('manglish_custom_words') || '{}');
// Migration: check if it was an array (old format)
if (Array.isArray(customWordsData)) {
  const oldWords = customWordsData;
  customWordsData = { 'ml': oldWords };
  localStorage.setItem('manglish_custom_words', JSON.stringify(customWordsData));
}
let customWords = customWordsData[currentLang] || [];

const languages = {
  'ml': { name: 'മലയാളം', googleCode: 'ml-t-i0-und' },
  'as': { name: 'অসমীয়া', googleCode: 'as-t-i0-und' },
  'bn': { name: 'বাংলা', googleCode: 'bn-t-i0-und' },
  'gu': { name: 'ગુજરાતી', googleCode: 'gu-t-i0-und' },
  'hi': { name: 'हिन्दी', googleCode: 'hi-t-i0-und' },
  'kn': { name: 'ಕನ್ನಡ', googleCode: 'kn-t-i0-und' },
  'mr': { name: 'मराठी', googleCode: 'mr-t-i0-und' },
  'ne': { name: 'नेपाली', googleCode: 'ne-t-i0-und' },
  'or': { name: 'ଓଡ଼ିଆ', googleCode: 'or-t-i0-und' },
  'pa': { name: 'ਪੰਜਾਬੀ', googleCode: 'pa-t-i0-und' },
  'sa': { name: 'संस्कृतम्', googleCode: 'sa-t-i0-und' },
  'ta': { name: 'தமிழ்', googleCode: 'ta-t-i0-und' },
  'te': { name: 'తెలుగు', googleCode: 'te-t-i0-und' }
};

const googleInputToolInstallers = {
  gu: 'GoogleInputGujarati.exe',
  hi: 'GoogleInputHindi.exe',
  kn: 'GoogleInputKannada.exe',
  ml: 'GoogleInputMalayalam.exe',
  mr: 'GoogleInputMarathi.exe',
  ne: 'GoogleInputNepali.exe',
  or: 'GoogleInputOriya.exe',
  pa: 'GoogleInputPunjabi.exe',
  sa: 'GoogleInputSanskrit.exe',
  ta: 'GoogleInputTamil.exe',
  te: 'GoogleInputTelugu.exe'
};

let googleInputCatalog = null;
const DEVICE_ID_KEY = 'nakshathram_device_id_v1';
const deviceId = localStorage.getItem(DEVICE_ID_KEY) || `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
localStorage.setItem(DEVICE_ID_KEY, deviceId);

const legacyAiMemory = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
let learningStore = readStorage(localStorage, STORAGE_KEYS.learningStore, null);
if (!learningStore || !learningStore.version) {
  const migratedStore = migrateLegacyAiMemory(legacyAiMemory);
  learningStore = Object.keys(migratedStore.languages || {}).length > 0 ? migratedStore : createEmptyLearningStore();
  writeStorage(localStorage, STORAGE_KEYS.learningStore, learningStore);
}

clearPersistedAuthState(localStorage);
let syncQueue = readQueue(localStorage);
let userProfile = createDefaultProfile();
let privacyPreferences = createDefaultPreferences();
let cloudConfig = readStorage(localStorage, STORAGE_KEYS.cloudConfig, null) || createDefaultCloudConfig();
let isSyncInProgress = false;
let pendingCloudSyncTimer = null;
let isAppUnlocked = false;
let sessionToken = '';

function generateEightDigitUserId() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

if (!/^\d{8}$/.test(String(userProfile.userId || ''))) {
  userProfile.userId = generateEightDigitUserId();
}

if (!cloudConfig.backendUrl) {
  cloudConfig.backendUrl = DEFAULT_BACKEND_URL;
}

function saveUserProfile() {
  return;
}

function savePrivacyPreferences() {
  return;
}

function saveCloudConfig() {
  writeStorage(localStorage, STORAGE_KEYS.cloudConfig, cloudConfig);
}

function syncLegacyLearningMirror() {
  localStorage.setItem('manglish_ai_learning', JSON.stringify(buildLegacyMirror(learningStore)));
}

function saveLearningStore() {
  writeStorage(localStorage, STORAGE_KEYS.learningStore, learningStore);
  syncLegacyLearningMirror();
}

function saveSyncQueue() {
  writeQueue(localStorage, syncQueue);
}

syncLegacyLearningMirror();
saveCloudConfig();

// Toggle Languages
btnMl.addEventListener('click', () => {
  setEnglishMode(false);
});

btnEn.addEventListener('click', () => {
  setEnglishMode(true);
});

function setEnglishMode(isEn) {
  isEnglishMode = isEn;
  localStorage.setItem('last_is_english_mode', isEn);
  syncLanguageUI();
  editor.focus();
}

function syncLanguageUI() {
  // Update main toggle buttons
  if (isEnglishMode) {
    btnEn.classList.add('active');
    btnMl.classList.remove('active');
  } else {
    btnMl.classList.add('active');
    btnEn.classList.remove('active');
  }

  // Update Indian language button text
  if (languages[currentLang]) {
    btnMl.textContent = languages[currentLang].name;
  }

  // Update active state in dropdown menu
  langItems.forEach(item => {
    if (item.getAttribute('data-lang') === currentLang) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update Add Words modal placeholder based on language
  if (inputWord && languages[currentLang]) {
    inputWord.placeholder = `Word in ${languages[currentLang].name}`;
  }
}

function selectLanguage(langCode, options = {}) {
  const { closeMenus = true, focusEditor = true } = options;
  if (!languages[langCode]) return;

  currentLang = langCode;
  localStorage.setItem('last_selected_lang', langCode);

  customWords = customWordsData[currentLang] || [];
  renderWordTable();
  refreshLearningUI();

  isEnglishMode = false;
  localStorage.setItem('last_is_english_mode', false);

  syncLanguageUI();

  if (closeMenus && langMenu) {
    langMenu.classList.add('hidden');
  }

  if (focusEditor) {
    editor.focus();
  }

  if (lastTranslitData.english) {
    fetchCandidates(lastTranslitData.english, currentLang).then(cands => {
      lastTranslitData.candidates = cands;
      if (!isCorrectModal.classList.contains('hidden') && !correctionResults.classList.contains('hidden')) {
        runCorrectionVerification();
      }
    });
  }
}

function getOfflineToolCards() {
  const installerState = googleInputCatalog ? googleInputCatalog.installers || {} : {};
  const genericInstaller = googleInputCatalog ? googleInputCatalog.genericInstaller : null;

  return Object.entries(languages).map(([code, config]) => {
    const dedicatedInstaller = googleInputToolInstallers[code];
    const dedicatedState = dedicatedInstaller ? installerState[code] : null;
    const genericAvailable = Boolean(genericInstaller && genericInstaller.exists);

    let statusClass = 'online';
    let statusLabel = 'ONLINE ONLY';
    let installLabel = '';
    let installTarget = '';
    let description = 'Use Nakshathram built-in transliteration for this language.';

    if (dedicatedInstaller && dedicatedState && dedicatedState.exists) {
      statusClass = 'ready';
      statusLabel = 'OFFLINE READY';
      installLabel = 'Install Offline Tool';
      installTarget = dedicatedInstaller;
      description = `${dedicatedInstaller} is bundled with this build for Windows desktop IME input.`;
    } else if (!dedicatedInstaller && genericAvailable) {
      statusClass = 'online';
      statusLabel = 'TRY FULL PACKAGE';
      installLabel = 'Try Full Package';
      installTarget = genericInstaller.fileName;
      description = 'No dedicated installer was bundled for this language. You can still try the generic Google Input Tools package.';
    } else if (dedicatedInstaller) {
      statusClass = 'missing';
      statusLabel = 'INSTALLER MISSING';
      description = `${dedicatedInstaller} is not bundled in this build, so this language stays on the online path for now.`;
    } else {
      statusClass = 'online';
      statusLabel = 'ONLINE ONLY';
      description = 'Nakshathram supports this language, but no dedicated offline Google installer was provided.';
    }

    return {
      code,
      displayName: config.name,
      statusClass,
      statusLabel,
      installLabel,
      installTarget,
      description
    };
  });
}

function renderOfflineTools() {
  if (!offlineToolsGrid || !offlineToolsSummary || !offlineToolsSummaryText) return;

  const cards = getOfflineToolCards();
  const readyCount = cards.filter(card => card.statusClass === 'ready').length;
  const totalCount = cards.length;
  const genericAvailable = Boolean(googleInputCatalog && googleInputCatalog.genericInstaller && googleInputCatalog.genericInstaller.exists);

  offlineToolsSummary.textContent = `${readyCount}/${totalCount} READY`;
  offlineToolsSummaryText.textContent = genericAvailable
    ? `${readyCount} app languages have bundled dedicated offline installers. Assamese and Bengali can keep using the current online transliteration or try the full GoogleInputTools package.`
    : `${readyCount} app languages have bundled dedicated offline installers. Languages without a bundled installer stay on the current online transliteration path.`;

  offlineToolsGrid.innerHTML = cards.map(card => `
    <div class="offline-tool-card">
      <div class="offline-tool-top">
        <div class="offline-tool-meta">
          <h4>${card.displayName}</h4>
          <p>${card.code.toUpperCase()}</p>
        </div>
        <span class="offline-tool-chip ${card.statusClass}">${card.statusLabel}</span>
      </div>
      <p class="offline-tool-desc">${card.description}</p>
      <div class="offline-tool-actions">
        <button
          class="btn-primary"
          data-action="install-input-tool"
          data-installer="${card.installTarget}"
          ${card.installTarget ? '' : 'disabled'}
        >
          ${card.installLabel || 'Installer Not Available'}
        </button>
        <button class="btn-secondary" data-action="apply-language" data-lang="${card.code}">
          Use in App
        </button>
      </div>
    </div>
  `).join('');
}

async function refreshGoogleInputCatalog() {
  try {
    googleInputCatalog = await ipcRenderer.invoke('list-google-input-tools');
  } catch (error) {
    console.error('Could not read bundled Google Input Tools catalog:', error);
    googleInputCatalog = null;
  }

  renderOfflineTools();
}

function setStatusMessage(target, message, tone = 'default') {
  if (!target) return;
  target.textContent = message;

  if (tone === 'error') {
    target.style.color = '#ffb4b4';
  } else if (tone === 'success') {
    target.style.color = '#9fe3a8';
  } else if (tone === 'accent') {
    target.style.color = 'var(--accent-color)';
  } else {
    target.style.color = '';
  }
}

function clearCachedLearningArtifacts() {
  syncQueue = [];
  saveSyncQueue();
}

function resetInMemorySession() {
  userProfile = createDefaultProfile();
  privacyPreferences = createDefaultPreferences();
  sessionToken = '';
  isAppUnlocked = false;
  clearCachedLearningArtifacts();
  learningStore = createEmptyLearningStore();
  saveLearningStore();
}

function applyAuthenticatedSession(session) {
  if (!session) return;

  userProfile.userId = session.userId || generateEightDigitUserId();
  userProfile.displayName = session.displayName || '';
  userProfile.passwordEnabled = session.passwordEnabled === true;
  userProfile.passwordHash = '';
  userProfile.lastUnlockedAt = new Date().toISOString();
  privacyPreferences.collectionConsent = session.collectionConsent === true;
  privacyPreferences.localLearningEnabled = session.localLearningEnabled !== false;
  privacyPreferences.cloudSyncEnabled = session.cloudSyncEnabled === true;
  privacyPreferences.autoSyncEnabled = true;
  sessionToken = session.sessionToken || '';
}

async function hydrateLearningStoreForSession() {
  clearCachedLearningArtifacts();
  learningStore = createEmptyLearningStore();

  if (!userProfile.userId) {
    saveLearningStore();
    return;
  }

  const eventsResult = await fetchUserTypingEvents(cloudConfig, userProfile.userId, 1200);
  if (eventsResult.ok) {
    learningStore = buildStoreFromEvents(eventsResult.rows);
    saveLearningStore();
    refreshLearningUI(`Loaded ${eventsResult.rows.length} typing records from the database.`);
    return;
  }

  saveLearningStore();
  refreshLearningUI(eventsResult.message || 'Could not load typing records from the database.');
}

function isLearningCollectionEnabled() {
  return privacyPreferences.collectionConsent === true && privacyPreferences.localLearningEnabled === true;
}

function isCloudSyncEnabled() {
  return isLearningCollectionEnabled() && privacyPreferences.cloudSyncEnabled === true;
}

function getCurrentLanguageName() {
  return languages[currentLang] ? languages[currentLang].name : currentLang;
}

function updateConnectionBadge() {
  if (!supabaseConnectionBadge) return;

  if (!hasValidSupabaseConfig(cloudConfig)) {
    supabaseConnectionBadge.textContent = 'NOT CONNECTED';
    return;
  }

  if (cloudConfig.lastConnectionStatus === 'ok') {
    supabaseConnectionBadge.textContent = 'DATABASE READY';
    return;
  }

  if (cloudConfig.lastConnectionStatus === 'error') {
    supabaseConnectionBadge.textContent = 'DATABASE ISSUE';
    return;
  }

  supabaseConnectionBadge.textContent = 'MANAGED';
}

function updateDashboardSummary(statusMessage = null) {
  const summary = getLearningSummary(learningStore, currentLang, syncQueue.length);

  if (aiStatTotal) aiStatTotal.textContent = String(summary.totalSelections);
  if (aiStatPatterns) aiStatPatterns.textContent = String(summary.uniquePatterns);
  if (aiStatWords) aiStatWords.textContent = String(summary.uniqueWords);
  if (aiStatSync) aiStatSync.textContent = String(summary.pendingSyncCount);
  if (dashboardActiveLanguage) dashboardActiveLanguage.textContent = getCurrentLanguageName();
  if (dashboardUserName) dashboardUserName.textContent = userProfile.displayName || 'Unnamed profile';
  if (dashboardUserId) dashboardUserId.textContent = userProfile.userId;

  if (dashboardSyncBadge) {
    if (isCloudSyncEnabled() && hasValidSupabaseConfig(cloudConfig)) {
      dashboardSyncBadge.textContent = syncQueue.length > 0 ? 'DATABASE PENDING' : 'DATABASE READY';
    } else if (isLearningCollectionEnabled()) {
      dashboardSyncBadge.textContent = 'LOCAL ONLY';
    } else {
      dashboardSyncBadge.textContent = 'SHARING OFF';
    }
  }

  if (dashboardSummaryCopy) {
    dashboardSummaryCopy.textContent = isCloudSyncEnabled()
      ? 'Database-first lookup checks your learned language database first, then falls back to Google and Varnam when needed.'
      : 'Local learning stays on this device. Database-backed defaults still help the core typing experience.';
  }

  if (dashboardConsentText) {
    dashboardConsentText.textContent = isLearningCollectionEnabled()
      ? 'You approved single-word typing data sharing during first launch, so new mappings can help the database-backed typing experience.'
      : 'You declined first-launch sharing, so the app uses built-in providers and read-only database defaults without sending your new typing habits.';
  }

  if (statusMessage) {
    setStatusMessage(aiDashboardStatus, statusMessage, 'accent');
  } else if (aiDashboardStatus) {
    const syncText = cloudConfig.lastSyncAt
      ? `Last sync: ${new Date(cloudConfig.lastSyncAt).toLocaleString()}`
      : 'No sync activity yet.';
    setStatusMessage(aiDashboardStatus, syncText, cloudConfig.lastSyncError ? 'error' : 'default');
  }
}

function renderAiWordTable() {
  if (!aiWordTableBody) return;

  const entries = getLearningEntries(learningStore, currentLang);
  if (entries.length === 0) {
    aiWordTableBody.innerHTML = `<tr><td colspan="4" class="empty-data">No learned data available for this language.</td></tr>`;
    updateDashboardSummary();
    return;
  }

  aiWordTableBody.innerHTML = '';
  entries.forEach((entry) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.pattern}</td>
      <td>${entry.signature || '-'}</td>
      <td>${entry.word}</td>
      <td>${entry.frequency}</td>
    `;
    aiWordTableBody.appendChild(row);
  });

  updateDashboardSummary();
}

function updateSettingsUI(forceFields = false) {
  const shouldRefreshFields = forceFields || !settingsModal || settingsModal.classList.contains('hidden');

  if (shouldRefreshFields) {
    if (settingsUserName) settingsUserName.value = userProfile.displayName || '';
  }

  if (settingsUserId) settingsUserId.textContent = userProfile.userId;
  if (settingsConsentStatus) {
    settingsConsentStatus.textContent = privacyPreferences.collectionConsent === null
      ? 'Waiting for first-run choice'
      : privacyPreferences.collectionConsent
        ? 'Approved during first launch'
        : 'Declined during first launch';
  }

  updateConnectionBadge();

  if (settingsSyncStatus) {
    const syncText = cloudConfig.lastSyncAt
      ? `Last sync: ${new Date(cloudConfig.lastSyncAt).toLocaleString()}`
      : 'Database access is managed internally by Nakshathram.';
    setStatusMessage(settingsSyncStatus, cloudConfig.lastSyncError || syncText, cloudConfig.lastSyncError ? 'error' : 'default');
  }
}

function refreshLearningUI(statusMessage = null) {
  renderAiWordTable();
  updateSettingsUI();
  updateDashboardSummary(statusMessage);
}

function showAuthGateway(message = null) {
  if (!authGatewayModal) return;

  resetInMemorySession();
  if (welcomeModal) welcomeModal.classList.add('hidden');
  if (unlockModal) unlockModal.classList.add('hidden');

  if (authGatewayBadge) authGatewayBadge.textContent = 'LOGIN FIRST';
  if (authGatewayTitle) authGatewayTitle.textContent = 'Sign in or create an account';
  if (authGatewayCopy) {
    authGatewayCopy.textContent = 'Your sign-in happens against the database, not the local PC. Use your 8-digit user ID and password to sign in, or create a new account first.';
  }
  if (authGatewayUserName) authGatewayUserName.textContent = 'Use your 8-digit user ID and password';
  if (authGatewayUserId) authGatewayUserId.textContent = 'Create a new account to get your credentials PDF';
  if (authGatewayButtonText) authGatewayButtonText.textContent = 'Sign In';
  if (authGatewayIcon) authGatewayIcon.textContent = 'lock_open';
  setStatusMessage(authGatewayStatus, message || 'Choose sign in or create account to continue.', 'default');
  authGatewayModal.classList.remove('hidden');
}

function maybeShowOnboarding() {
  if (!welcomeModal) return;

  if (authGatewayModal) authGatewayModal.classList.add('hidden');
  if (unlockModal) unlockModal.classList.add('hidden');
  if (!/^\d{8}$/.test(String(userProfile.userId || ''))) {
    userProfile.userId = generateEightDigitUserId();
  }
  if (welcomeUserId) welcomeUserId.textContent = userProfile.userId;
  if (welcomeName) welcomeName.value = userProfile.displayName || '';
  if (welcomePassword) welcomePassword.value = '';
  if (welcomePasswordConfirm) welcomePasswordConfirm.value = '';
  if (welcomeConsent) welcomeConsent.checked = false;
  setStatusMessage(welcomeStatus, 'Accept the one-time sharing agreement to continue. This choice will be locked after you enter the app.');
  welcomeModal.classList.remove('hidden');
  isAppUnlocked = false;
}

function maybeShowUnlock(message = 'User ID and password are required to continue.') {
  if (!unlockModal) {
    isAppUnlocked = true;
    return;
  }

  if (authGatewayModal) authGatewayModal.classList.add('hidden');
  if (welcomeModal) welcomeModal.classList.add('hidden');
  if (unlockUserId) unlockUserId.value = '';
  if (unlockPassword) unlockPassword.value = '';
  setStatusMessage(unlockStatus, message);
  unlockModal.classList.remove('hidden');
  if (unlockUserId) unlockUserId.focus();
  isAppUnlocked = false;
}

function signOutCurrentSession() {
  isAppUnlocked = false;
  if (settingsModal) settingsModal.classList.add('hidden');
  if (aiDashboardModal) aiDashboardModal.classList.add('hidden');
  if (addWordModal) addWordModal.classList.add('hidden');
  if (pluginsModal) pluginsModal.classList.add('hidden');
  if (offlineToolsModal) offlineToolsModal.classList.add('hidden');
  if (isCorrectModal) isCorrectModal.classList.add('hidden');
  if (shareModal) shareModal.classList.add('hidden');
  if (suggestionsBox) suggestionsBox.classList.add('hidden');
  if (moreMenu) moreMenu.classList.add('hidden');
  if (newFileMenu) newFileMenu.classList.add('hidden');
  if (langMenu) langMenu.classList.add('hidden');
  showAuthGateway('Signed out. Sign in to continue.');
}

async function recordTypingSelection(romanInput, nativeWord, source = 'transliteration_auto', weight = 1, lang = currentLang) {
  if (!isLearningCollectionEnabled()) return null;

  const result = recordSelection(learningStore, {
    lang,
    romanInput,
    nativeWord,
    source,
    weight,
    deviceId,
    clientVersion: packageJson.version,
    notePath: activeFilePath || ''
  });

  if (!result) return null;

  syncQueue.push(result.event);
  saveLearningStore();
  saveSyncQueue();
  refreshLearningUI();
  schedulePendingCloudSync();
  return result.event;
}

async function downloadCredentialsPdf(passwordValue) {
  const result = await ipcRenderer.invoke('export-credentials-pdf', {
    displayName: userProfile.displayName,
    userId: userProfile.userId,
    password: passwordValue
  });

  if (!result || !result.ok) {
    return { ok: false, message: result && result.message ? result.message : 'Could not save credentials PDF.' };
  }

  return result;
}

function revertTypingSelection(eventMeta) {
  if (!eventMeta || !eventMeta.romanInput || !eventMeta.nativeWord) return;

  const reverted = revertSelection(learningStore, {
    lang: eventMeta.lang || currentLang,
    romanInput: eventMeta.romanInput,
    nativeWord: eventMeta.nativeWord,
    source: eventMeta.source || 'transliteration_auto',
    weight: eventMeta.weight || 1
  });

  if (!reverted) return;

  if (eventMeta.clientEventId) {
    syncQueue = syncQueue.filter((entry) => entry.clientEventId !== eventMeta.clientEventId);
  }

  saveLearningStore();
  saveSyncQueue();
  refreshLearningUI('Last learned selection was removed.');
}

function schedulePendingCloudSync() {
  if (!isCloudSyncEnabled() || !hasValidSupabaseConfig(cloudConfig)) {
    return;
  }

  clearTimeout(pendingCloudSyncTimer);
  pendingCloudSyncTimer = setTimeout(() => {
    syncPendingCloudData(true);
  }, 1800);
}

async function syncPendingCloudData(silent = false) {
  if (isSyncInProgress) return { ok: false, message: 'Sync already in progress.' };
  if (!isCloudSyncEnabled()) {
    return { ok: false, message: 'Database sharing is disabled for this profile.' };
  }
  if (!hasValidSupabaseConfig(cloudConfig)) {
    return { ok: false, message: 'Database connection is not available.' };
  }

  isSyncInProgress = true;
  if (!silent) {
    setStatusMessage(settingsSyncStatus, 'Syncing profile and typing data...', 'accent');
    setStatusMessage(aiDashboardStatus, 'Syncing profile and typing data...', 'accent');
  }

  const profileResult = await syncProfile(cloudConfig, userProfile, privacyPreferences);
  if (!profileResult.ok) {
    isSyncInProgress = false;
    cloudConfig.lastSyncError = profileResult.message;
    cloudConfig.lastConnectionStatus = 'error';
    saveCloudConfig();
    refreshLearningUI(profileResult.message);
    return profileResult;
  }

  const queueSnapshot = [...syncQueue];
  const eventsResult = await syncTypingEvents(cloudConfig, userProfile.userId, queueSnapshot);
  isSyncInProgress = false;

  if (!eventsResult.ok) {
    cloudConfig.lastSyncError = eventsResult.message;
    cloudConfig.lastConnectionStatus = 'error';
    saveCloudConfig();
    refreshLearningUI(eventsResult.message);
    return eventsResult;
  }

  syncQueue = syncQueue.filter((event) => !eventsResult.syncedIds.includes(event.clientEventId));
  cloudConfig.lastSyncAt = new Date().toISOString();
  cloudConfig.lastSyncError = '';
  cloudConfig.lastConnectionStatus = 'ok';
  cloudConfig.lastConnectionCheckAt = new Date().toISOString();
  saveCloudConfig();
  saveSyncQueue();
  refreshLearningUI(`Synced ${eventsResult.syncedIds.length} typing records.`);
  return { ok: true, message: `Synced ${eventsResult.syncedIds.length} typing records.` };
}

async function fetchRemoteRowsForWord(word, lang) {
  if (!isCloudSyncEnabled() || !hasValidSupabaseConfig(cloudConfig)) return [];

  const cachedRows = getCachedCloudRows(localStorage, lang, word);
  if (cachedRows) return cachedRows;

  const result = await fetchCloudCandidates(cloudConfig, lang, word);
  if (!result.ok) {
    cloudConfig.lastSyncError = result.message;
    cloudConfig.lastConnectionStatus = 'error';
    saveCloudConfig();
    updateSettingsUI();
    return [];
  }

  cloudConfig.lastConnectionStatus = 'ok';
  cloudConfig.lastConnectionCheckAt = new Date().toISOString();
  saveCloudConfig();
  setCachedCloudRows(localStorage, lang, word, result.rows);
  updateSettingsUI();
  return result.rows;
}

async function getDatabaseFirstCandidates(word, lang, options = {}) {
  const localCandidates = getLocalCandidates(learningStore, lang, word, options);
  const remoteRows = await fetchRemoteRowsForWord(word, lang);
  const remoteCandidates = aggregateCloudRows(remoteRows, word).map((entry) => ({
    word: entry.word,
    cloudCount: entry.cloudCount,
    exactCount: entry.exactCount,
    signatureCount: entry.signatureCount
  }));

  return mergeCandidateWords(localCandidates, remoteCandidates);
}

// Focus editor and sync UI on load
window.addEventListener('DOMContentLoaded', () => {
  syncLanguageUI();
  refreshGoogleInputCatalog();
  updateSettingsUI(true);
  refreshLearningUI();
  showAuthGateway();

  if (isAppUnlocked) {
    editor.focus();
  }

  schedulePendingCloudSync();
});

// Secret Debug Toggle State
let secretBuffer = [];
const secretHash = "NzM3MzkxNTczNzM5MTUj"; // Base64 for 73739157373915#

// Transliteration trigger
editor.addEventListener('keyup', async (e) => {
  if (isEnglishMode) return;
  
  // We trigger on Space (code: Space) and Enter (code: Enter)
  if (e.code === 'Space' || e.code === 'Enter') {
    await handleTransliteration(e.code === 'Space' ? ' ' : '\n');
  }
});

// AI Unlearning via Backspace and Secret Debug logic
editor.addEventListener('keydown', (e) => {
  // --- Secret Debug Trigger Logic (Global regardless of mode) ---
  if (e.key && e.key.length === 1) { // letters, numbers, symbols
    secretBuffer.push(e.key);
    if (secretBuffer.length > 15) {
      secretBuffer.shift();
    }
    if (secretBuffer.length === 15) {
      if (btoa(secretBuffer.join('')) === secretHash) {
        if (debugLogBox) debugLogBox.classList.toggle('hidden');
        secretBuffer = []; // Reset buffer
      }
    }
  }

  if (isEnglishMode) return;

  if (e.key === 'Backspace') {
    if (lastTranslitData && lastTranslitData.justTransliterated) {
      // User erased immediately after transliteration, so remove that fresh learning event.
      revertTypingSelection(lastTranslitData.learningEvent);

      // Reset flag to prevent multiple decrements
      lastTranslitData.justTransliterated = false;
      lastTranslitData.learningEvent = null;
    }
  } else if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta' && e.code !== 'Space' && e.code !== 'Enter') {
    // If they typed something else, they moved on
    if (lastTranslitData) {
      lastTranslitData.justTransliterated = false;
    }
  }
});

// Live typing logic for suggestions
editor.addEventListener('input', async () => {
  if (isEnglishMode || !isSuggestionsEnabled || isTranslating) {
    suggestionsBox.classList.add('hidden');
    return;
  }

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const node = selection.getRangeAt(0).startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return;

  const textBeforeCursor = node.textContent.substring(0, selection.getRangeAt(0).startOffset);
  const match = textBeforeCursor.match(/([a-zA-Z]+)$/);
  
  if (!match) {
    suggestionsBox.classList.add('hidden');
    return;
  }
  
  const word = match[1];

  const customArr = customWords
    .filter((customWord) => customWord.pattern.startsWith(word.toLowerCase()))
    .map((customWord) => customWord.word);

  try {
    const candidates = await fetchCandidates(word, currentLang, { includePrefix: true });
    const candidateWords = candidates.map((candidate) => typeof candidate === 'string' ? candidate : candidate.word);
    showSuggestionsForWord(word, customArr, candidateWords);
  } catch (e) {
    console.error("Suggestion fetch error:", e);
  }
});

async function fetchProviderCandidates(word, lang) {
  const langConfig = languages[lang];
  if (!langConfig) return [];
  
  try {
    const [varnamRes, googleRes] = await Promise.all([
      fetch(`https://api.varnamproject.com/tl/${lang}/${word}`).catch(() => null),
      fetch(`https://inputtools.google.com/request?text=${word}&itc=${langConfig.googleCode}&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=editor`).catch(() => null)
    ]);

    let varnamWords = [];
    if (varnamRes && varnamRes.ok) {
      const data = await varnamRes.json();
      if (data.success && data.result) varnamWords = data.result;
    }

    let searchEngineWords = [];
    if (googleRes && googleRes.ok) {
      const gData = await googleRes.json();
      if (gData[0] === 'SUCCESS' && gData[1] && gData[1][0] && gData[1][0][1]) {
        searchEngineWords = gData[1][0][1];
      }
    }

    return [...new Set([...searchEngineWords, ...varnamWords])];
  } catch (e) {
    console.error("Fetch candidates error:", e);
    return [];
  }
}

async function fetchCandidates(word, lang, options = {}) {
  const { includePrefix = false, limit = 8 } = options;
  const databaseCandidates = await getDatabaseFirstCandidates(word, lang, {
    includePrefix,
    limit
  });

  const databaseWords = databaseCandidates.map((candidate) => candidate.word);
  if (databaseWords.length >= limit && !includePrefix) {
    return databaseWords.slice(0, limit);
  }

  const providerWords = await fetchProviderCandidates(word, lang);
  return mergeCandidateWords(
    databaseWords,
    providerWords
  ).slice(0, limit).map((candidate) => typeof candidate === 'string' ? candidate : candidate.word);
}

async function handleTransliteration(triggerChar, forcedReplacement = null) {
  if (isTranslating) return;

  // We hide suggestions and correction trigger immediately
  suggestionsBox.classList.add('hidden');
  document.getElementById('btn-is-correct').classList.add('hidden');

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  
  // Only process if we are inside a text node
  if (node.nodeType !== Node.TEXT_NODE) return;

  const cursorPosition = range.startOffset;
  const text = node.textContent;

  // We need to look back from the cursor (excluding the space/enter that was just typed if it's there)
  // Actually, 'keyup' means the space is already in the text node, OR it resulted in a new line.
  // To be safe, let's parse the text before the cursor.
  
  // If the trigger was a space, there's usually a space at cursorPosition - 1.
  const checkOffset = triggerChar === ' ' ? cursorPosition - 1 : cursorPosition;
  if (checkOffset <= 0) return;

  const textBeforeCursor = text.substring(0, checkOffset);
  
  // Match the last English word
  const match = textBeforeCursor.match(/([a-zA-Z]+)$/);
  if (!match) return;

  const wordToTranslate = match[1];
  const wordStartOffset = checkOffset - wordToTranslate.length;
  const lowercaseWord = wordToTranslate.toLowerCase();

  try {
    isTranslating = true;
    let malayalamWord = forcedReplacement;
    let selectionSource = forcedReplacement ? 'suggestion_click' : 'provider_default';
    let candidatesForWord = forcedReplacement ? [forcedReplacement] : [];

    if (!malayalamWord) {
      console.log(`Fetching transliteration for: ${wordToTranslate}`);
      // Check custom dictionary first
      const customMatch = customWords.find(cw => cw.pattern === lowercaseWord);
      if (customMatch) {
        malayalamWord = customMatch.word;
        selectionSource = 'custom_dictionary';
        candidatesForWord = [customMatch.word];
      } else {
        const databaseCandidates = await getDatabaseFirstCandidates(wordToTranslate, currentLang, { includePrefix: false, limit: 8 });
        const databaseWords = databaseCandidates.map((candidate) => candidate.word);
        const providerWords = databaseWords.length > 0 ? await fetchProviderCandidates(wordToTranslate, currentLang) : await fetchProviderCandidates(wordToTranslate, currentLang);
        const allCandidates = mergeCandidateWords(databaseWords, providerWords)
          .slice(0, 8)
          .map((candidate) => typeof candidate === 'string' ? candidate : candidate.word);

        candidatesForWord = allCandidates;
        malayalamWord = allCandidates[0];
        selectionSource = databaseWords.length > 0 ? 'learned_database' : 'provider_default';
      }
    }

    if (malayalamWord) {
      // Create a range that selects exactly the typed English word
      const replaceRange = document.createRange();
      replaceRange.setStart(node, wordStartOffset);
      replaceRange.setEnd(node, checkOffset);
      
      // Delete the English word
      replaceRange.deleteContents();

      // Insert the Malayalam word
      const textNode = document.createTextNode(malayalamWord);
      replaceRange.insertNode(textNode);

      // Restore cursor position smoothly
      const newRange = document.createRange();
      newRange.setStart(textNode, textNode.length);
      newRange.setEnd(textNode, textNode.length);
      
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      selection.modify("move", "forward", "character");

      // Save the exact range covering the newly inserted word for the correction modal
      const wordRange = document.createRange();
      wordRange.selectNodeContents(textNode);

      const learningEvent = await recordTypingSelection(wordToTranslate, malayalamWord, selectionSource, 1, currentLang);

      // Store data for "Is it correct?" feature and unlearning
      lastTranslitData = {
        english: wordToTranslate,
        malayalam: malayalamWord,
        candidates: candidatesForWord,
        justTransliterated: true, // Flag for AI unlearning
        correctionRange: wordRange,
        learningEvent
      };
      console.log(`Transliterated: ${wordToTranslate} -> ${malayalamWord}`);
      document.getElementById('btn-is-correct').classList.remove('hidden');
    }
  } catch (error) {
    console.error("Transliteration Error:", error);
  } finally {
    isTranslating = false;
  }
}

// Basic Toolbar button functionality integration (Bold, Italic, U, etc.)
const styleButtons = {
  '.font-weight-bold': 'bold',
  '.font-style-italic': 'italic',
  '.text-decoration-underline': 'underline',
};

for (const [selector, command] of Object.entries(styleButtons)) {
  const btn = document.querySelector(selector);
  if (btn) {
    btn.addEventListener('click', () => {
      document.execCommand(command, false, null);
      editor.focus();
    });
  }
}

// Formatting buttons (Align left, List, etc.)
const alignLeftBtn = document.querySelector('[title="Align Left"]');
if (alignLeftBtn) {
  alignLeftBtn.addEventListener('click', () => {
    document.execCommand('justifyLeft', false, null);
    editor.focus();
  });
}

const listBtn = document.querySelector('[title="Bullet List"]');
if (listBtn) {
  listBtn.addEventListener('click', () => {
    document.execCommand('insertUnorderedList', false, null);
    editor.focus();
  });
}

const undoBtn = document.querySelector('[title="Undo"]');
if (undoBtn) {
  undoBtn.addEventListener('click', () => {
    document.execCommand('undo', false, null);
    editor.focus();
  });
}

const redoBtn = document.querySelector('[title="Redo"]');
if (redoBtn) {
  redoBtn.addEventListener('click', () => {
    document.execCommand('redo', false, null);
    editor.focus();
  });
}

// Font Size Logic (1 to 7 corresponds to standard HTML sizes)
// 1=10px, 2=13px, 3=16px (12pt), 4=18px, 5=24px, 6=32px, 7=48px
// We map the display number to internal execCommand sizes.

let currentHtmlSize = 3; // Corresponds to typical 12pt/16px visually 

function updateFontSize() {
  // Map internal sizes to arbitrary display values (just for UI)
  const displayMap = { 1: 8, 2: 10, 3: 12, 4: 16, 5: 20, 6: 28, 7: 36 };
  fsDisplay.textContent = displayMap[currentHtmlSize];
  document.execCommand("fontSize", false, currentHtmlSize);
  editor.focus();
}

btnFsInc.addEventListener('click', () => {
  if (currentHtmlSize < 7) {
    currentHtmlSize++;
    updateFontSize();
  }
});

btnFsDec.addEventListener('click', () => {
  if (currentHtmlSize > 1) {
    currentHtmlSize--;
    updateFontSize();
  }
});

// Copy button
const btnCopy = document.getElementById('btn-copy');
if (btnCopy) {
  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(editor.innerText || editor.textContent);
    
    // Quick tooltip feedback
    const originalText = btnCopy.innerHTML;
    btnCopy.innerHTML = `<span class="material-symbols-outlined">check</span> Copied`;
    setTimeout(() => {
      btnCopy.innerHTML = originalText;
    }, 2000);
  });
}

function renderWordTable() {
  if (!wordTableBody) return;
  const wordsForCurrentLang = customWordsData[currentLang] || [];
  
  if (wordsForCurrentLang.length === 0) {
    wordTableBody.innerHTML = `<tr><td colspan="3" class="empty-data">No custom words added for this language.</td></tr>`;
    return;
  }
  
  wordTableBody.innerHTML = '';
  wordsForCurrentLang.forEach(({ pattern, word }, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${word}</td>
      <td>${pattern}</td>
      <td style="text-align: center;">
        <button class="delete-btn" onclick="deleteCustomWord(${index})">
          <span class="material-symbols-outlined" style="font-size: 1.2rem; color: #ff7b72;">delete</span>
        </button>
      </td>
    `;
    wordTableBody.appendChild(row);
  });
}

window.deleteCustomWord = (index) => {
  if (confirm('Delete this word from dictionary?')) {
    customWordsData[currentLang].splice(index, 1);
    localStorage.setItem('manglish_custom_words', JSON.stringify(customWordsData));
    customWords = customWordsData[currentLang];
    renderWordTable();
  }
};

if (btnClearCustomDict) {
  btnClearCustomDict.addEventListener('click', () => {
    const langName = languages[currentLang] ? languages[currentLang].name : currentLang;
    if (confirm(`Are you sure you want to delete ALL custom words for ${langName}? This cannot be undone.`)) {
      customWordsData[currentLang] = [];
      localStorage.setItem('manglish_custom_words', JSON.stringify(customWordsData));
      customWords = [];
      renderWordTable();
      alert(`Dictionary cleared for ${langName}.`);
    }
  });
}

// Initial render
renderWordTable();

if (btnAddWordTarget) {
  btnAddWordTarget.addEventListener('click', () => {
    addWordModal.classList.remove('hidden');
    // Dynamically set placeholder just in case
    if (inputWord && languages[currentLang]) {
      inputWord.placeholder = `Word in ${languages[currentLang].name}`;
    }
    // Focus the 'Pattern' input instead of the 'Word' input per user request
    if (inputPattern) inputPattern.focus();
  });
}

if (btnCloseModal) {
  btnCloseModal.addEventListener('click', () => {
    addWordModal.classList.add('hidden');
  });
}

// Close modal when clicking outside
if (addWordModal) {
  addWordModal.addEventListener('click', (e) => {
    if (e.target === addWordModal) {
      addWordModal.classList.add('hidden');
    }
  });
}

if (btnSubmitWord) {
  btnSubmitWord.addEventListener('click', () => {
    const pattern = inputPattern.value.trim().toLowerCase(); // Ensure pattern is lowercase for easy matching
    const word = inputWord.value.trim();

    if (pattern && word) {
      // Add to array
      if (!customWordsData[currentLang]) customWordsData[currentLang] = [];
      customWordsData[currentLang].unshift({ pattern, word });
      // Save to local storage
      localStorage.setItem('manglish_custom_words', JSON.stringify(customWordsData));
      customWords = customWordsData[currentLang];
      
      renderWordTable();
      
      // Clear inputs
      inputPattern.value = '';
      inputWord.value = '';
      inputPattern.focus();
    }
  });
}

// -------- More Menu & Suggestions Logic --------

if (btnMore && moreMenu) {
  btnMore.addEventListener('click', (e) => {
    e.stopPropagation();
    moreMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!btnMore.contains(e.target) && !moreMenu.contains(e.target)) {
      moreMenu.classList.add('hidden');
    }
  });
}

// Global flag for suggestion mode
let isSuggestionsEnabled = false;
if (toggleSuggestions) {
  toggleSuggestions.addEventListener('change', (e) => {
    isSuggestionsEnabled = e.target.checked;
    if (!isSuggestionsEnabled) {
      if (suggestionsBox) suggestionsBox.classList.add('hidden');
    }
  });
}

// Render Suggestions
function showSuggestionsForWord(word, customMatches, apiMatches) {
  if (!suggestionsBox) return;

  if (!word) {
    suggestionsBox.classList.add('hidden');
    return;
  }
  
  // Combine unique suggestions
  const allSuggestions = [...new Set([...customMatches, ...apiMatches])].slice(0, 5); // Max 5
  
  if (allSuggestions.length === 0) {
    suggestionsBox.classList.add('hidden');
    return;
  }
  
  suggestionsBox.innerHTML = '';
  allSuggestions.forEach((sug, index) => {
    const div = document.createElement('div');
    div.className = `suggestion-item ${index === 0 ? 'selected' : ''}`;
    div.textContent = sug;
    
    // Clicking a suggestion triggers manual replacement
    div.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevents the editor from losing selection/focus
      handleTransliteration(' ', sug);
      suggestionsBox.classList.add('hidden');
    });
    
    suggestionsBox.appendChild(div);
  });
  
  // Position the box under the cursor
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Position directly under the typed word
    suggestionsBox.style.top = (rect.bottom + 8) + 'px';
    suggestionsBox.style.left = rect.left + 'px';
  } else {
    // Fallback if no selection range
    suggestionsBox.style.bottom = '100px';
    suggestionsBox.style.left = '50%';
    suggestionsBox.style.transform = 'translateX(-50%)';
  }
  
  suggestionsBox.classList.remove('hidden');
}


// Open external link for Varnam logo
const logoVarnam = document.getElementById('logo-varnam');
if (logoVarnam) {
  logoVarnam.addEventListener('click', () => {
    const { shell } = require('electron');
    shell.openExternal('https://varnamproject.com/');
  });
}

// Language Selector Logic
if (btnLangSelector && langMenu) {
  btnLangSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    langMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!btnLangSelector.contains(e.target) && !langMenu.contains(e.target)) {
      langMenu.classList.add('hidden');
    }
  });
}

langItems.forEach(item => {
  item.addEventListener('click', () => {
    const langCode = item.getAttribute('data-lang');
    selectLanguage(langCode);
  });
});

// Window Controls
const btnMin = document.getElementById('win-min');
const btnClose = document.getElementById('btn-close');

if (btnMin) {
  btnMin.addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
  });
}

if (btnClose) {
  btnClose.addEventListener('click', () => {
    ipcRenderer.send('close-window');
  });
}

// -------- AI Dashboard Logic --------
window.deleteAiWord = (pattern, word) => {
  if (confirm(`Delete "${word}" from AI memory?`)) {
    if (deleteLearnedMapping(learningStore, currentLang, pattern, word)) {
      syncQueue = syncQueue.filter((event) => !(event.language === currentLang && event.romanLower === pattern && event.nativeWord === word));
      saveLearningStore();
      saveSyncQueue();
      refreshLearningUI(`Deleted ${word} from ${getCurrentLanguageName()} learning.`);
    }
  }
};

if (btnAiDashboard) {
  btnAiDashboard.addEventListener('click', () => {
    refreshLearningUI();
    aiDashboardModal.classList.remove('hidden');
  });
}

if (btnCloseAiModal) {
  btnCloseAiModal.addEventListener('click', () => {
    aiDashboardModal.classList.add('hidden');
  });
}

if (aiDashboardModal) {
  aiDashboardModal.addEventListener('click', (e) => {
    if (e.target === aiDashboardModal) {
      aiDashboardModal.classList.add('hidden');
    }
  });
}

if (btnClearAiMemory) {
  btnClearAiMemory.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all learned AI memory? This cannot be undone.')) {
      learningStore = createEmptyLearningStore();
      syncQueue = [];
      saveLearningStore();
      saveSyncQueue();
      refreshLearningUI('Local learning memory cleared.');
    }
  });
}

if (btnOpenSettingsFromAi) {
  btnOpenSettingsFromAi.addEventListener('click', () => {
    updateSettingsUI(true);
    settingsModal.classList.remove('hidden');
  });
}

if (btnSyncLearningNow) {
  btnSyncLearningNow.addEventListener('click', async () => {
    const result = await syncPendingCloudData();
    if (!result.ok) {
      setStatusMessage(aiDashboardStatus, result.message, 'error');
    }
  });
}

if (btnSettings && settingsModal) {
  btnSettings.addEventListener('click', () => {
    updateSettingsUI(true);
    settingsModal.classList.remove('hidden');
  });
}

if (btnCloseSettingsModal) {
  btnCloseSettingsModal.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
}

if (settingsModal) {
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });
}

if (btnAuthPrimary) {
  btnAuthPrimary.addEventListener('click', () => {
    maybeShowUnlock('Enter your 8-digit user ID and password to continue.');
  });
}

if (btnAuthCreateAccount) {
  btnAuthCreateAccount.addEventListener('click', () => {
    maybeShowOnboarding();
    if (welcomeName) welcomeName.focus();
  });
}

if (btnSaveProfile) {
  btnSaveProfile.addEventListener('click', async () => {
    const displayName = settingsUserName.value.trim();
    if (!displayName) {
      setStatusMessage(settingsSyncStatus, 'Please enter a display name before saving.', 'error');
      return;
    }

    userProfile.displayName = displayName;
    saveUserProfile();
    updateSettingsUI();
    const syncResult = await syncProfile(cloudConfig, userProfile, privacyPreferences);
    if (!syncResult.ok) {
      setStatusMessage(settingsSyncStatus, syncResult.message, 'error');
      return;
    }

    refreshLearningUI('Profile saved.');
    setStatusMessage(settingsSyncStatus, 'Profile saved to the database.', 'success');
  });
}

if (btnCopyUserId) {
  btnCopyUserId.addEventListener('click', async () => {
    await navigator.clipboard.writeText(userProfile.userId);
    setStatusMessage(settingsSyncStatus, 'User ID copied to clipboard.', 'success');
  });
}

if (settingsLocalLearningToggle) {
  settingsLocalLearningToggle.addEventListener('change', () => {
    privacyPreferences.localLearningEnabled = settingsLocalLearningToggle.checked;
    if (settingsLocalLearningToggle.checked) {
      privacyPreferences.collectionConsent = true;
    }
    if (!settingsLocalLearningToggle.checked) {
      privacyPreferences.cloudSyncEnabled = false;
      if (settingsCloudSyncToggle) settingsCloudSyncToggle.checked = false;
    }
    savePrivacyPreferences();
    refreshLearningUI('Learning preference updated.');
  });
}

if (settingsCloudSyncToggle) {
  settingsCloudSyncToggle.addEventListener('change', () => {
    privacyPreferences.cloudSyncEnabled = settingsCloudSyncToggle.checked;
    if (privacyPreferences.cloudSyncEnabled) {
      privacyPreferences.collectionConsent = true;
      privacyPreferences.localLearningEnabled = true;
      if (settingsLocalLearningToggle) settingsLocalLearningToggle.checked = true;
    }
    savePrivacyPreferences();
    refreshLearningUI('Cloud sync preference updated.');
    schedulePendingCloudSync();
  });
}

if (settingsAutoSyncToggle) {
  settingsAutoSyncToggle.addEventListener('change', () => {
    privacyPreferences.autoSyncEnabled = settingsAutoSyncToggle.checked;
    savePrivacyPreferences();
    refreshLearningUI('Auto sync preference updated.');
    if (privacyPreferences.autoSyncEnabled) {
      schedulePendingCloudSync();
    }
  });
}

if (btnSavePassword) {
  btnSavePassword.addEventListener('click', async () => {
    const password = settingsPassword.value;
    const confirmPassword = settingsPasswordConfirm.value;
    if (password.length < 4) {
      setStatusMessage(settingsSyncStatus, 'Use at least 4 characters for the password.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage(settingsSyncStatus, 'Password and confirmation do not match.', 'error');
      return;
    }

    if (!password) {
      setStatusMessage(settingsSyncStatus, 'Enter a password before saving.', 'error');
      return;
    }

    if (!sessionToken) {
      setStatusMessage(settingsSyncStatus, 'Sign in again before changing the password.', 'error');
      return;
    }

    const passwordResult = await updateAccountPassword(cloudConfig, {
      sessionToken,
      newPassword: password,
      displayName: userProfile.displayName,
      collectionConsent: privacyPreferences.collectionConsent === true,
      localLearningEnabled: privacyPreferences.localLearningEnabled !== false,
      cloudSyncEnabled: privacyPreferences.cloudSyncEnabled === true
    });

    if (!passwordResult.ok) {
      setStatusMessage(settingsSyncStatus, passwordResult.message, 'error');
      return;
    }

    if (passwordResult.session) {
      applyAuthenticatedSession(passwordResult.session);
    }

    settingsPassword.value = '';
    settingsPasswordConfirm.value = '';
    updateSettingsUI(true);
    const pdfResult = await downloadCredentialsPdf(password);
    setStatusMessage(
      settingsSyncStatus,
      pdfResult.ok ? 'Password updated and credentials PDF saved.' : pdfResult.message,
      pdfResult.ok ? 'success' : 'error'
    );
  });
}

if (btnSignOut) {
  btnSignOut.addEventListener('click', () => {
    signOutCurrentSession();
  });
}

if (btnDeleteAccount) {
  btnDeleteAccount.addEventListener('click', async () => {
    if (!sessionToken) {
      setStatusMessage(settingsSyncStatus, 'Sign in again before deleting the account.', 'error');
      return;
    }

    const confirmed = confirm('Delete this account? The account will become unusable, but the existing database typing data will stay unchanged.');
    if (!confirmed) return;

    const result = await disableAccount(cloudConfig, { sessionToken });
    if (!result.ok) {
      setStatusMessage(settingsSyncStatus, result.message, 'error');
      return;
    }

    settingsModal.classList.add('hidden');
    showAuthGateway('This account has been disabled. Its stored database typing data was left unchanged.');
  });
}

if (btnTestSupabase) {
  btnTestSupabase.addEventListener('click', async () => {
    cloudConfig.backendUrl = sanitizeBackendUrl(settingsBackendUrl ? settingsBackendUrl.value : cloudConfig.backendUrl);
    cloudConfig.supabaseUrl = sanitizeSupabaseUrl(settingsSupabaseUrl.value);
    cloudConfig.supabaseAnonKey = settingsSupabaseKey.value.trim();
    saveCloudConfig();
    updateConnectionBadge();

    const result = await testSupabaseConnection(cloudConfig);
    cloudConfig.lastConnectionStatus = result.ok ? 'ok' : 'error';
    cloudConfig.lastConnectionCheckAt = new Date().toISOString();
    cloudConfig.lastSyncError = result.ok ? '' : result.message;
    saveCloudConfig();
    updateSettingsUI();
    setStatusMessage(settingsSyncStatus, result.message, result.ok ? 'success' : 'error');
  });
}

if (btnSyncNow) {
  btnSyncNow.addEventListener('click', async () => {
    cloudConfig.backendUrl = sanitizeBackendUrl(settingsBackendUrl ? settingsBackendUrl.value : cloudConfig.backendUrl);
    cloudConfig.supabaseUrl = sanitizeSupabaseUrl(settingsSupabaseUrl.value);
    cloudConfig.supabaseAnonKey = settingsSupabaseKey.value.trim();
    saveCloudConfig();
    updateConnectionBadge();
    await syncPendingCloudData();
  });
}

if (btnCompleteOnboarding) {
  btnCompleteOnboarding.addEventListener('click', async () => {
    const displayName = welcomeName.value.trim();
    const password = welcomePassword ? welcomePassword.value : '';
    const confirmPassword = welcomePasswordConfirm ? welcomePasswordConfirm.value : '';

    if (!displayName) {
      setStatusMessage(welcomeStatus, 'Please enter your name to continue.', 'error');
      return;
    }

    if (password.length < 4) {
      setStatusMessage(welcomeStatus, 'Create a password with at least 4 characters.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage(welcomeStatus, 'Password and confirmation do not match.', 'error');
      return;
    }

    if (!(welcomeConsent && welcomeConsent.checked)) {
      setStatusMessage(welcomeStatus, 'Accept the one-time sharing agreement before continuing.', 'error');
      return;
    }

    const registerResult = await registerAccount(cloudConfig, {
      userId: userProfile.userId,
      displayName,
      password,
      collectionConsent: true
    });

    if (!registerResult.ok || !registerResult.session) {
      if (registerResult.suggestedUserId) {
        userProfile.userId = registerResult.suggestedUserId;
        if (welcomeUserId) welcomeUserId.textContent = registerResult.suggestedUserId;
      }
      setStatusMessage(welcomeStatus, registerResult.message || 'Could not create the account.', 'error');
      return;
    }

    applyAuthenticatedSession(registerResult.session);
    updateSettingsUI(true);
    welcomeModal.classList.add('hidden');
    await hydrateLearningStoreForSession();
    refreshLearningUI('Welcome profile saved.');
    schedulePendingCloudSync();

    const pdfResult = await downloadCredentialsPdf(password);
    if (!pdfResult.ok) {
      alert(`Account created, but the credentials PDF could not be saved: ${pdfResult.message}`);
    }

    isAppUnlocked = true;
    editor.focus();
  });
}

if (btnUnlockApp) {
  btnUnlockApp.addEventListener('click', async () => {
    const enteredUserId = unlockUserId ? unlockUserId.value.trim() : '';
    const enteredPassword = unlockPassword.value;

    if (!enteredUserId || !/^\d{8}$/.test(enteredUserId)) {
      setStatusMessage(unlockStatus, 'Enter your valid 8-digit user ID.', 'error');
      return;
    }

    if (!enteredPassword) {
      setStatusMessage(unlockStatus, 'Enter your password to continue.', 'error');
      return;
    }

    const loginResult = await loginAccount(cloudConfig, {
      userId: enteredUserId,
      password: enteredPassword
    });

    if (!loginResult.ok || !loginResult.session) {
      setStatusMessage(unlockStatus, loginResult.message || 'User ID or password did not match.', 'error');
      return;
    }

    applyAuthenticatedSession(loginResult.session);
    unlockModal.classList.add('hidden');
    if (unlockUserId) unlockUserId.value = '';
    unlockPassword.value = '';
    await hydrateLearningStoreForSession();
    updateSettingsUI(true);
    isAppUnlocked = true;

    const pdfResult = await downloadCredentialsPdf(enteredPassword);
    if (!pdfResult.ok) {
      alert(`Signed in, but the credentials PDF could not be saved: ${pdfResult.message}`);
    }

    editor.focus();
  });
}

// -------- File Management Logic --------
const NOTES_DIR = path.join(__dirname, 'notes');
if (!fs.existsSync(NOTES_DIR)) {
  fs.mkdirSync(NOTES_DIR);
}

let activeFilePath = localStorage.getItem('last_active_file') || null;



function formatDate(date) {
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function getFileCategory(mtime) {
  const now = new Date();
  const date = new Date(mtime);
  
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (date.toDateString() === now.toDateString()) return 'today';
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'yesterday';
  
  return 'earlier';
}

function renderFileList() {
  if (!listToday) return;

  listToday.innerHTML = '';
  listYesterday.innerHTML = '';
  listEarlier.innerHTML = '';

  const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.txt'));
  
  const sortedFiles = files.map(filename => {
    const stats = fs.statSync(path.join(NOTES_DIR, filename));
    return { filename, mtime: stats.mtime };
  }).sort((a, b) => b.mtime - a.mtime);

  sortedFiles.forEach(file => {
    const li = document.createElement('li');
    li.className = 'file-item';
    if (path.join(NOTES_DIR, file.filename) === activeFilePath) {
      li.classList.add('active');
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = file.filename.replace('.txt', '');
    li.appendChild(nameSpan);
    li.title = file.filename;

    if (path.join(NOTES_DIR, file.filename) === activeFilePath) {
      // Edit Icon
      const editIcon = document.createElement('span');
      editIcon.className = 'material-symbols-outlined rename-icon';
      editIcon.textContent = 'edit';
      editIcon.title = 'Rename file';
      editIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        renameFile(file.filename);
      });
      li.appendChild(editIcon);

      // Delete Icon
      const deleteIcon = document.createElement('span');
      deleteIcon.className = 'material-symbols-outlined delete-icon';
      deleteIcon.textContent = 'delete';
      deleteIcon.title = 'Delete file';
      deleteIcon.style.marginLeft = '4px'; // Tiny gap
      deleteIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(file.filename);
      });
      li.appendChild(deleteIcon);
    }
    
    li.addEventListener('click', () => {
      loadNote(path.join(NOTES_DIR, file.filename));
    });

    const category = getFileCategory(file.mtime);
    if (category === 'today') listToday.appendChild(li);
    else if (category === 'yesterday') listYesterday.appendChild(li);
    else listEarlier.appendChild(li);
  });

  // Dynamic Visibility Check
  document.getElementById('section-today').classList.toggle('hidden', listToday.children.length === 0);
  document.getElementById('section-yesterday').classList.toggle('hidden', listYesterday.children.length === 0);
  document.getElementById('section-earlier').classList.toggle('hidden', listEarlier.children.length === 0);
}

function renameFile(oldName) {
  const renameModal = document.getElementById('rename-modal');
  const renameInput = document.getElementById('rename-input');
  const btnConfirm = document.getElementById('btn-confirm-rename');
  const btnCancel = document.getElementById('btn-cancel-rename');
  
  if (!renameModal || !renameInput) return;

  const oldBaseName = oldName.replace('.txt', '');
  renameInput.value = oldBaseName;
  renameModal.classList.remove('hidden');
  renameInput.focus();
  renameInput.select();

  const handleRename = () => {
    const newBaseName = renameInput.value.trim();
    if (!newBaseName || newBaseName === oldBaseName) {
      closeModal();
      return;
    }

    // Clean filename of invalid characters
    const cleanName = newBaseName.replace(/[<>:"/\\|?*]/g, '');
    if (!cleanName) {
      alert('Invalid file name.');
      return;
    }

    const oldPath = path.join(NOTES_DIR, oldName);
    const newName = cleanName + '.txt';
    const newPath = path.join(NOTES_DIR, newName);

    if (fs.existsSync(newPath)) {
      alert('A file with this name already exists.');
      return;
    }

    try {
      fs.renameSync(oldPath, newPath);
      activeFilePath = newPath;
      localStorage.setItem('last_active_file', newPath);
      closeModal();
      renderFileList();
      editor.focus();
    } catch (e) {
      console.error('Rename error:', e);
      alert('Failed to rename file.');
    }
  };

  const closeModal = () => {
    renameModal.classList.add('hidden');
    btnConfirm.removeEventListener('click', handleRename);
    btnCancel.removeEventListener('click', closeModal);
    window.removeEventListener('keydown', handleKey);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') closeModal();
  };

  btnConfirm.addEventListener('click', handleRename);
  btnCancel.addEventListener('click', closeModal);
  window.addEventListener('keydown', handleKey);
}

function deleteNote(filename) {
  if (confirm(`Are you sure you want to delete "${filename.replace('.txt', '')}"? This cannot be undone.`)) {
    const filePath = path.join(NOTES_DIR, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
        
        // If the deleted file was the active one, clear editor
        if (filePath === activeFilePath) {
          activeFilePath = null;
          localStorage.removeItem('last_active_file');
          editor.innerText = '';
        }
        
        renderFileList();
      }
    } catch (e) {
      console.error('Delete error:', e);
      alert('Failed to delete file.');
    }
  }
}

function loadNote(filePath) {
  if (!fs.existsSync(filePath)) return;
  activeFilePath = filePath;
  localStorage.setItem('last_active_file', filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  editor.innerText = content;
  renderFileList();
  editor.focus();
}

function createNewNote() {
  const createModal = document.getElementById('create-modal');
  const createInput = document.getElementById('create-input');
  const btnConfirm = document.getElementById('btn-confirm-create');
  const btnCancel = document.getElementById('btn-cancel-create');
  
  if (!createModal || !createInput) return;

  createInput.value = '';
  createModal.classList.remove('hidden');
  createInput.focus();

  const handleCreate = () => {
    const fileName = createInput.value.trim();
    if (!fileName) {
      closeModal();
      return;
    }

    const cleanName = fileName.replace(/[<>:"/\\|?*]/g, '');
    const filePath = path.join(NOTES_DIR, cleanName + '.txt');
    
    if (fs.existsSync(filePath)) {
      alert('A file with this name already exists.');
      return;
    }

    try {
      fs.writeFileSync(filePath, '');
      activeFilePath = filePath;
      localStorage.setItem('last_active_file', filePath);
      editor.innerText = '';
      closeModal();
      renderFileList();
      editor.focus();
    } catch (e) {
      console.error('Create error:', e);
      alert('Failed to create file.');
    }
  };

  const closeModal = () => {
    createModal.classList.add('hidden');
    btnConfirm.removeEventListener('click', handleCreate);
    btnCancel.removeEventListener('click', closeModal);
    window.removeEventListener('keydown', handleKey);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') closeModal();
  };

  btnConfirm.addEventListener('click', handleCreate);
  btnCancel.addEventListener('click', closeModal);
  window.addEventListener('keydown', handleKey);
}

async function selectFile() {
  console.log('Renderer: Requesting open-file-dialog...');
  try {
    // Check if ipcRenderer is actually available
    if (typeof ipcRenderer === 'undefined') {
      throw new Error('ipcRenderer is not defined');
    }
    
    const filePaths = await ipcRenderer.invoke('open-file-dialog');
    console.log('Renderer: File selected:', filePaths);
    
    if (filePaths && filePaths.length > 0) {
      loadNote(filePaths[0]);
    }
  } catch (e) {
    console.error('Renderer: Select file error details:', e);
    alert('Could not open file picker. Error: ' + e.message);
  }
}

function autoSave() {
  if (activeFilePath && fs.existsSync(activeFilePath)) {
    const content = editor.innerText || editor.textContent;
    fs.writeFileSync(activeFilePath, content);
  }
}

if (btnCreateNew) {
  btnCreateNew.addEventListener('click', () => {
    newFileMenu.classList.add('hidden');
    createNewNote();
  });
}

if (btnSelectFile) {
  btnSelectFile.addEventListener('click', () => {
    newFileMenu.classList.add('hidden');
    selectFile();
  });
}

if (btnSaveTxt) {
  btnSaveTxt.addEventListener('click', async () => {
    newFileMenu.classList.add('hidden');
    const content = editor.innerText || editor.textContent;
    const defaultName = activeFilePath ? path.basename(activeFilePath) : 'Untitled.txt';
    
    try {
      const savePath = await ipcRenderer.invoke('save-file-dialog', defaultName);
      if (savePath) {
        fs.writeFileSync(savePath, content);
        logToBox('File saved to: ' + savePath);
        // We use alert so user knows it worked
        alert('File saved successfully!');
      }
    } catch (e) {
      console.error('Save error:', e);
      alert('Could not save file as.');
    }
  });
}

// Share Modal Logic
const shareModal = document.getElementById('share-modal');
const btnCloseShare = document.getElementById('btn-close-share');
const shareFileName = document.getElementById('share-file-name');

const shareCopy = document.getElementById('share-copy');
const shareWhatsapp = document.getElementById('share-whatsapp');
const shareEmail = document.getElementById('share-email');
const shareTelegram = document.getElementById('share-telegram');
const shareTwitter = document.getElementById('share-twitter');

function closeShareModal() {
  if (shareModal) shareModal.classList.add('hidden');
}

if (btnCloseShare) {
  btnCloseShare.addEventListener('click', closeShareModal);
}

if (shareModal) {
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) closeShareModal();
  });
}

if (btnShareTxt) {
  btnShareTxt.addEventListener('click', () => {
    newFileMenu.classList.add('hidden');
    const title = activeFilePath ? path.basename(activeFilePath) : 'Untitled Note';
    if (shareFileName) shareFileName.textContent = title;
    if (shareModal) shareModal.classList.remove('hidden');
  });
}

function getShareContent() {
  return editor.innerText || editor.textContent;
}

if (shareCopy) {
  shareCopy.addEventListener('click', () => {
    require('electron').clipboard.writeText(getShareContent());
    alert('Text copied to clipboard!');
    closeShareModal();
  });
}

if (shareWhatsapp) {
  shareWhatsapp.addEventListener('click', () => {
    const text = encodeURIComponent(getShareContent());
    require('electron').shell.openExternal(`https://wa.me/?text=${text}`);
    closeShareModal();
  });
}

if (shareEmail) {
  shareEmail.addEventListener('click', () => {
    const subject = encodeURIComponent(activeFilePath ? path.basename(activeFilePath, '.txt') : 'Nakshathram Note');
    const body = encodeURIComponent(getShareContent());
    require('electron').shell.openExternal(`mailto:?subject=${subject}&body=${body}`);
    closeShareModal();
  });
}

if (shareTelegram) {
  shareTelegram.addEventListener('click', () => {
    const text = encodeURIComponent(getShareContent());
    require('electron').shell.openExternal(`https://t.me/share/url?url=&text=${text}`);
    closeShareModal();
  });
}

if (shareTwitter) {
  shareTwitter.addEventListener('click', () => {
    const text = encodeURIComponent(getShareContent());
    require('electron').shell.openExternal(`https://twitter.com/intent/tweet?text=${text}`);
    closeShareModal();
  });
}

// Auto-save on input
editor.addEventListener('input', () => {
  autoSave();
});

// -------- Correction / Drawing Modal Logic --------

let ctx = drawingCanvas.getContext('2d');
let drawing = false;
let isEraser = false;
let strokes = []; // Stores the paths for the handwriting API

function initCanvas() {
  const malayalamWord = lastTranslitData.malayalam || '';
  const charCount = malayalamWord.length;
  
  // Rely on the responsive CSS grid layout for width instead of forcing fixed widths
  const container = drawingCanvas.parentElement; // .canvas-container
  const canvasArea = document.querySelector('.canvas-area');
  const horizontalRow = document.querySelector('.horizontal-control-row');
  
  // Clear any previously forced inline widths that break grid
  if (container) container.style.width = '';
  if (canvasArea) canvasArea.style.width = '';
  if (horizontalRow) horizontalRow.style.width = '';

  // Get the actual width and height rendered by the CSS model
  const renderWidth = container ? container.offsetWidth : 500;
  const renderHeight = container ? container.offsetHeight : 300;

  // Set internal resolution for the canvas perfectly matching the CSS box
  drawingCanvas.width = renderWidth;
  drawingCanvas.height = renderHeight; 
  
  logToBox(`Canvas initialized: ${drawingCanvas.width}x${drawingCanvas.height}`);
  
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  updateBrushStyle();
  clearCanvas();
}

function updateBrushStyle() {
  if (isEraser) {
    ctx.lineWidth = 20;
    ctx.globalCompositeOperation = 'destination-out';
    if (btnEraser) btnEraser.classList.add('active-tool');
    drawingCanvas.classList.add('eraser-tool');
    drawingCanvas.classList.remove('pen-tool');
  } else {
    ctx.strokeStyle = '#58a6ff'; // Accent color
    ctx.lineWidth = 4;
    ctx.globalCompositeOperation = 'source-over';
    if (btnEraser) btnEraser.classList.remove('active-tool');
    drawingCanvas.classList.add('pen-tool');
    drawingCanvas.classList.remove('eraser-tool');
  }
}

if (btnEraser) {
  btnEraser.addEventListener('click', () => {
    isEraser = !isEraser;
    updateBrushStyle();
    logToBox(`Eraser mode: ${isEraser ? 'ON' : 'OFF'}`);
  });
}


function refreshCanvas() {
  ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  
  // 1. Draw ghost text
  if (lastTranslitData && lastTranslitData.malayalam) {
    const currentComp = ctx.globalCompositeOperation;
    const currentStyle = ctx.fillStyle;
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `${ghostFontSize}px "Noto Sans Malayalam", "Inter", sans-serif`;
    ctx.fillStyle = '#58a6ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const centerX = drawingCanvas.width / 2 + ghostOffsetX;
    const centerY = drawingCanvas.height / 2 + ghostOffsetY;
    ctx.fillText(lastTranslitData.malayalam, centerX, centerY);
    
    ctx.globalCompositeOperation = currentComp;
    ctx.fillStyle = currentStyle;
  }

  // 2. Draw existing strokes
  const currentComp = ctx.globalCompositeOperation;
  const currentStroke = ctx.strokeStyle;
  const currentWidth = ctx.lineWidth;

  // Ensure we draw strokes in source-over mode even if eraser was active
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 4;

  strokes.forEach(stroke => {
    if (stroke[0].length < 1) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0][0], stroke[1][0]);
    for (let i = 1; i < stroke[0].length; i++) {
      ctx.lineTo(stroke[0][i], stroke[1][i]);
    }
    ctx.stroke();
  });

  ctx.globalCompositeOperation = currentComp;
  ctx.strokeStyle = currentStroke;
  ctx.lineWidth = currentWidth;
}

function clearCanvas() {
  strokes = [];
  selectedCorrections = [];
  if (resultsList) resultsList.innerHTML = '';
  if (correctionResults) correctionResults.classList.add('hidden');
  if (btnVerifyUpdate) {
    btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Verify & Update`;
    btnVerifyUpdate.classList.remove('pulse-animation');
  }
  refreshCanvas();
}

if (btnIsCorrect) {
  btnIsCorrect.addEventListener('click', () => {
    displayEnglishWord.textContent = lastTranslitData.english;
    
    // Reset modal state for the new word
    resultsList.innerHTML = '';
    correctionResults.classList.add('hidden');
    selectedCorrections = [];
    btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Verify & Update`;
    btnVerifyUpdate.classList.remove('pulse-animation');
    
    isCorrectModal.classList.remove('hidden');
    initCanvas();
  });
}

// -------- Ghost Customization Listeners --------

const ghostSizeInput = document.getElementById('ghost-size');
const ghostXInput = document.getElementById('ghost-x');
const ghostYInput = document.getElementById('ghost-y');
const btnResetGhost = document.getElementById('btn-reset-ghost');

if (ghostSizeInput) {
  ghostSizeInput.addEventListener('input', (e) => {
    ghostFontSize = parseInt(e.target.value);
    refreshCanvas();
  });
}

if (ghostXInput) {
  ghostXInput.addEventListener('input', (e) => {
    ghostOffsetX = parseInt(e.target.value);
    refreshCanvas();
  });
}

if (ghostYInput) {
  ghostYInput.addEventListener('input', (e) => {
    ghostOffsetY = parseInt(e.target.value);
    refreshCanvas();
  });
}

if (btnResetGhost) {
  btnResetGhost.addEventListener('click', () => {
    ghostFontSize = 64;
    ghostOffsetX = 0;
    ghostOffsetY = 0;
    if (ghostSizeInput) ghostSizeInput.value = 64;
    if (ghostXInput) ghostXInput.value = 0;
    if (ghostYInput) ghostYInput.value = 0;
    refreshCanvas();
  });
}

if (btnCloseCorrectModal) {
  btnCloseCorrectModal.addEventListener('click', () => {
    isCorrectModal.classList.add('hidden');
  });
}

if (btnClearCanvas) {
  btnClearCanvas.addEventListener('click', clearCanvas);
}

// Event listeners for drawing on the canvas
drawingCanvas.addEventListener('mousedown', (e) => {
  drawing = true;
  const rect = drawingCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  strokes.push([[x], [y], [Date.now()]]);
  
  ctx.beginPath();
  ctx.moveTo(x, y);

  // Reset selection if user starts drawing again
  if (selectedCorrections.length > 0) {
    selectedCorrections = [];
    btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Verify & Update`;
    btnVerifyUpdate.classList.remove('pulse-animation');
  }
});

drawingCanvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const rect = drawingCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const currentStroke = strokes[strokes.length - 1];
  currentStroke[0].push(x);
  currentStroke[1].push(y);
  currentStroke[2].push(Date.now());
  
  ctx.lineTo(x, y);
  ctx.stroke();
});

drawingCanvas.addEventListener('mouseup', () => {
  drawing = false;
  ctx.closePath();
});

drawingCanvas.addEventListener('mouseleave', () => {
  drawing = false;
  ctx.closePath();
});

// Recognition API (using Google Web Handwriting API)
async function recognizeHandwriting() {
  if (strokes.length === 0) return null;

  const handwritingITC = languages[currentLang].googleCode.replace('-und', '-handwrit');

  const payload = {
    options: "enable_pre_space",
    requests: [{
      writing_guide: {
        writing_area_width: drawingCanvas.width,
        writing_area_height: drawingCanvas.height
      },
      ink: strokes,
      language: currentLang,
      pre_context: lastTranslitData.malayalam || ''
    }]
  };

  try {
    const url = `https://inputtools.google.com/request?itc=${handwritingITC}&app=editor&num=5`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`Handwriting recognition response:`, data);
    if (data[0] === 'SUCCESS' && data[1] && data[1][0] && data[1][0][1] && data[1][0][1].length > 0) {
      return data[1][0][1]; // Return the full list of candidates
    }
  } catch (e) {
    console.error("Handwriting recognition failed:", e);
  }
  return null;
}

if (btnVerifyUpdate) {
  btnVerifyUpdate.addEventListener('click', async () => {
    // If we already have a selection, this button acts as "Update"
    if (selectedCorrections.length > 0) {
      updateWithCorrection(selectedCorrections.join(''));
      isCorrectModal.classList.add('hidden');
      return;
    }

    await runCorrectionVerification();
  });
}

async function runCorrectionVerification() {
  if (!btnVerifyUpdate) return;
  
  btnVerifyUpdate.disabled = true;
  const originalText = btnVerifyUpdate.innerHTML;
  btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">sync</span> Verifying...`;
  
  // Clear previous results
  resultsList.innerHTML = '';
  correctionResults.classList.add('hidden');
  selectedCorrections = [];

  const handwritingCandidates = await recognizeHandwriting() || [];
  const translitCandidates = lastTranslitData.candidates || [];
  
  // Merge candidates, removing duplicates
  let candidates = [...new Set([...handwritingCandidates, ...translitCandidates])];

  if (candidates.length > 0) {
    // Add the ghost word itself as an option (useful for minor additions/strokes)
    if (lastTranslitData.malayalam && !candidates.includes(lastTranslitData.malayalam)) {
      candidates.unshift(lastTranslitData.malayalam);
    }

    correctionResults.classList.remove('hidden');
    candidates.forEach((word, index) => {
      const chip = document.createElement('div');
      chip.className = 'result-pill';
      chip.textContent = word;
      chip.addEventListener('click', () => {
        // Toggle selection
        if (selectedCorrections.includes(word)) {
          selectedCorrections = selectedCorrections.filter(c => c !== word);
          chip.classList.remove('selected');
        } else {
          selectedCorrections.push(word);
          chip.classList.add('selected');
        }
        
        if (selectedCorrections.length > 0) {
          const combined = selectedCorrections.join('');
          btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Update "${combined}"`;
          btnVerifyUpdate.classList.add('pulse-animation'); 
        } else {
          btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">touch_app</span> Pick words to join`;
          btnVerifyUpdate.classList.remove('pulse-animation');
        }
      });
      resultsList.appendChild(chip);
    });
    
    btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">touch_app</span> Pick words to join`;

  } else if (strokes.length > 0) {
    alert("No handwriting detected or recognition failed. Please try again.");
  } else {
    // If no strokes, just show transliteration candidates if available
    if (translitCandidates.length > 0) {
       // Re-run the loop for translit only
       correctionResults.classList.remove('hidden');
       translitCandidates.forEach(word => {
          const chip = document.createElement('div');
          chip.className = 'result-pill';
          chip.textContent = word;
          chip.addEventListener('click', () => {
             // Toggle selection
            if (selectedCorrections.includes(word)) {
              selectedCorrections = selectedCorrections.filter(c => c !== word);
              chip.classList.remove('selected');
            } else {
              selectedCorrections.push(word);
              chip.classList.add('selected');
            }
            
            if (selectedCorrections.length > 0) {
              const combined = selectedCorrections.join('');
              btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Update "${combined}"`;
              btnVerifyUpdate.classList.add('pulse-animation'); 
            } else {
              btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">touch_app</span> Pick words to join`;
              btnVerifyUpdate.classList.remove('pulse-animation');
            }
          });
          resultsList.appendChild(chip);
       });
    }
  }
  
  btnVerifyUpdate.disabled = false;
}

function updateWithCorrection(newWord) {
  const range = lastTranslitData.correctionRange;
  
  if (!range) {
    console.error("No valid correction range captured.");
    alert("Could not locate the word to replace. Please manually correct it.");
    return;
  }

  // To avoid `innerText` replacement which destroys formatting, we carefully update the node
  const textNode = range.startContainer;
  if (textNode.nodeType === Node.TEXT_NODE) {
    range.deleteContents();
    const newTextNode = document.createTextNode(newWord);
    range.insertNode(newTextNode);
    
    // Position cursor after the newly inserted correction
    const selection = window.getSelection();
    const newCursorRange = document.createRange();
    newCursorRange.setStart(newTextNode, newTextNode.length);
    newCursorRange.setEnd(newTextNode, newTextNode.length);
    selection.removeAllRanges();
    selection.addRange(newCursorRange);
  } else {
    // Fallback if somehow it's an element node
    range.deleteContents();
    const newTextNode = document.createTextNode(newWord);
    range.insertNode(newTextNode);
  }
  
  // Clear the range references after use
  lastTranslitData.correctionRange = null;

  // Persist the correction
  const pattern = lastTranslitData.english.toLowerCase();
  
  // Update Custom Words
  if (!customWordsData[currentLang]) customWordsData[currentLang] = [];
  customWordsData[currentLang].unshift({ pattern, word: newWord });
  localStorage.setItem('manglish_custom_words', JSON.stringify(customWordsData));
  customWords = customWordsData[currentLang];
  renderWordTable();

  recordTypingSelection(lastTranslitData.english, newWord, 'correction_update', 3, currentLang);

  btnIsCorrect.classList.add('hidden');
}


// -------- File Menu Actions --------

if (btnNewFileMain && newFileMenu) {
  btnNewFileMain.addEventListener('click', (e) => {
    e.stopPropagation();
    newFileMenu.classList.toggle('hidden');
  });
}

// Close New File menu when clicking outside of it
document.addEventListener('click', (e) => {
  if (newFileMenu && !newFileMenu.classList.contains('hidden')) {
    if (btnNewFileMain && !btnNewFileMain.contains(e.target) && !newFileMenu.contains(e.target)) {
      newFileMenu.classList.add('hidden');
    }
  }
});



// -------- Plugin Loader Engine --------

// Expose active file to plugins via global
Object.defineProperty(window, '__nakshathramActiveFile', {
  get: () => activeFilePath
});

// Installed plugins metadata persisted in localStorage
let installedPlugins = JSON.parse(localStorage.getItem('nakshathram_plugins') || '[]');

function saveInstalledPlugins() {
  localStorage.setItem('nakshathram_plugins', JSON.stringify(installedPlugins));
}

function updatePluginsModalUI() {
  if (!installedPluginCards) return;
  installedPluginCards.innerHTML = '';
  const hasPlugins = installedPlugins.length > 0;
  if (pluginsEmptyState) pluginsEmptyState.style.display = hasPlugins ? 'none' : 'block';

  installedPlugins.forEach((plugin, index) => {
    const card = document.createElement('div');
    card.className = 'plugin-card';
    card.innerHTML = `
      <div class="card-icon" style="color: ${plugin.color || '#aaa'};">
        <span class="material-symbols-outlined">${plugin.icon || 'extension'}</span>
      </div>
      <div class="card-info">
        <h4>${plugin.name}</h4>
        <p>${plugin.description || ''}</p>
      </div>
      <button class="plugin-remove-btn" title="Remove plugin" style="
        background: none; border: none; cursor: pointer; color: var(--text-muted);
        padding: 4px; border-radius: 50%; display: flex; align-items: center;
        transition: color 0.2s, background 0.2s;
      " data-index="${index}">
        <span class="material-symbols-outlined" style="font-size:18px;">close</span>
      </button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.plugin-remove-btn')) return;
      togglePluginUI(plugin);
    });

    const removeBtn = card.querySelector('.plugin-remove-btn');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Remove "${plugin.name}" plugin?`)) removePlugin(index);
    });
    removeBtn.addEventListener('mouseenter', () => { removeBtn.style.color = '#ff6b6b'; removeBtn.style.background = 'rgba(255,107,107,0.1)'; });
    removeBtn.addEventListener('mouseleave', () => { removeBtn.style.color = ''; removeBtn.style.background = ''; });

    installedPluginCards.appendChild(card);
  });
}

function togglePluginUI(plugin) {
  if (plugin.sidebar) {
    const host = document.getElementById(`plugin-host-${plugin.id}`);
    if (host) host.classList.toggle('hidden');
  } else {
    const host = document.getElementById(`plugin-modal-${plugin.id}`);
    if (host) host.classList.toggle('hidden');
  }
}

function removePlugin(index) {
  const plugin = installedPlugins[index];
  installedPlugins.splice(index, 1);
  saveInstalledPlugins();
  updatePluginsModalUI();
  const sidebarHost = document.getElementById(`plugin-host-${plugin.id}`);
  if (sidebarHost) sidebarHost.remove();
  const modalHost = document.getElementById(`plugin-modal-${plugin.id}`);
  if (modalHost) modalHost.remove();
  console.log(`Plugin "${plugin.name}" removed.`);
}

async function loadPlugin(filePath) {
  try {
    const raw = await ipcRenderer.invoke('read-plugin-file', filePath);
    if (!raw) throw new Error('Could not read plugin file');

    const plugin = JSON.parse(raw);
    if (!plugin.id || !plugin.name || !plugin.html || !plugin.script) {
      throw new Error('Invalid .star plugin format: missing required fields');
    }

    if (installedPlugins.find(p => p.id === plugin.id)) {
      alert(`"${plugin.name}" is already installed.`);
      return;
    }

    // Inject HTML
    const hostEl = document.createElement('div');
    if (plugin.sidebar) {
      hostEl.id = `plugin-host-${plugin.id}`;
      hostEl.className = 'plugin-sidebar-section';
      hostEl.innerHTML = plugin.html;
      if (pluginSidebarHost) pluginSidebarHost.appendChild(hostEl);
    } else {
      hostEl.id = `plugin-modal-${plugin.id}`;
      hostEl.style.cssText = 'margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;';
      hostEl.innerHTML = plugin.html;
      if (pluginModalHost) pluginModalHost.appendChild(hostEl);
    }

    // Expose context to plugin
    window.pluginContext = { ipcRenderer, localStorage, editor, path };

    // Execute plugin script
    const scriptFn = new Function(plugin.script);
    scriptFn();

    installedPlugins.push({
      id: plugin.id,
      name: plugin.name,
      icon: plugin.icon,
      color: plugin.color,
      description: plugin.description,
      sidebar: !!plugin.sidebar,
      filePath
    });
    saveInstalledPlugins();
    updatePluginsModalUI();
    console.log(`Plugin "${plugin.name}" loaded successfully.`);
  } catch (err) {
    console.error('Failed to load plugin:', err);
    alert('Failed to load plugin: ' + err.message);
  }
}

async function reloadInstalledPlugins() {
  const toReload = [...installedPlugins];
  installedPlugins = [];
  for (const savedPlugin of toReload) {
    await loadPlugin(savedPlugin.filePath);
  }
}

// -------- Offline Google Input Tools Wiring --------

if (btnOfflineToolsTarget && offlineToolsModal) {
  btnOfflineToolsTarget.addEventListener('click', async () => {
    await refreshGoogleInputCatalog();
    offlineToolsModal.classList.remove('hidden');
  });
}

if (btnCloseOfflineToolsModal) {
  btnCloseOfflineToolsModal.addEventListener('click', () => {
    offlineToolsModal.classList.add('hidden');
  });
}

if (offlineToolsModal) {
  offlineToolsModal.addEventListener('click', (e) => {
    if (e.target === offlineToolsModal) {
      offlineToolsModal.classList.add('hidden');
    }
  });
}

if (btnOpenInputSettings) {
  btnOpenInputSettings.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('open-input-settings');
    if (!result || !result.ok) {
      alert(result && result.message ? result.message : 'Could not open Windows keyboard settings.');
    }
  });
}

if (btnOpenOfflineToolsFolder) {
  btnOpenOfflineToolsFolder.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('open-google-input-tools-folder');
    if (!result || !result.ok) {
      alert(result && result.message ? result.message : 'Could not open the bundled installer folder.');
    }
  });
}

if (offlineToolsGrid) {
  offlineToolsGrid.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('button[data-action]');
    if (!actionButton) return;

    const action = actionButton.getAttribute('data-action');

    if (action === 'apply-language') {
      const langCode = actionButton.getAttribute('data-lang');
      selectLanguage(langCode, { closeMenus: true, focusEditor: true });
      offlineToolsModal.classList.add('hidden');
      return;
    }

    if (action === 'install-input-tool') {
      const installerName = actionButton.getAttribute('data-installer');
      if (!installerName) return;

      const originalText = actionButton.textContent;
      actionButton.disabled = true;
      actionButton.textContent = 'Opening...';

      try {
        const result = await ipcRenderer.invoke('install-google-input-tool', installerName);
        if (!result || !result.ok) {
          alert(result && result.message ? result.message : 'Could not launch the installer.');
        } else {
          alert(`${installerName} opened. Finish the Windows installer, then switch keyboards with Win + Space inside Nakshathram.`);
        }
      } finally {
        actionButton.disabled = false;
        actionButton.textContent = originalText;
      }
    }
  });
}

// -------- Plugins Modal Wiring --------

if (btnPluginsTarget && pluginsModal) {
  btnPluginsTarget.addEventListener('click', () => {
    pluginsModal.classList.remove('hidden');
  });
}

if (btnClosePluginsModal) {
  btnClosePluginsModal.addEventListener('click', () => {
    pluginsModal.classList.add('hidden');
  });
}

if (pluginsModal) {
  pluginsModal.addEventListener('click', (e) => {
    if (e.target === pluginsModal) pluginsModal.classList.add('hidden');
  });
}

if (btnAddPlugin) {
  btnAddPlugin.addEventListener('click', async () => {
    const filePaths = await ipcRenderer.invoke('open-plugin-dialog');
    if (filePaths && filePaths.length > 0) {
      await loadPlugin(filePaths[0]);
    }
  });
}

// -------- Initial Startup --------

updatePluginsModalUI();
reloadInstalledPlugins();

if (activeFilePath && fs.existsSync(activeFilePath)) {
  loadNote(activeFilePath);
} else {
  renderFileList();
}


