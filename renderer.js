const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
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

// Plugins Modal Elements
const btnPluginsTarget = document.getElementById('btn-plugins');
const pluginsModal = document.getElementById('plugins-modal');
const btnClosePluginsModal = document.getElementById('btn-close-plugins-modal');

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
  correctionRange: null // The exact text node range for correction replacement
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

// Focus editor and sync UI on load
window.addEventListener('DOMContentLoaded', () => {
  syncLanguageUI();
  editor.focus();
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
      // User erased immediately after transliteration! Unlearn from AI memory.
      const aiMemory = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
      const learned = migrateAiMemory(aiMemory);
      const pattern = lastTranslitData.english.toLowerCase();
      const word = lastTranslitData.malayalam;
      
      if (learned[currentLang] && learned[currentLang][pattern] && learned[currentLang][pattern][word]) {
        learned[currentLang][pattern][word] -= 1; // Decrement score
        
        if (learned[currentLang][pattern][word] <= 0) {
          delete learned[currentLang][pattern][word];
          if (Object.keys(learned[currentLang][pattern]).length === 0) {
             delete learned[currentLang][pattern];
          }
        }
        localStorage.setItem('manglish_ai_learning', JSON.stringify(learned));
        console.log(`Unlearned: ${pattern} -> ${word}`);
      }
      
      // Reset flag to prevent multiple decrements
      lastTranslitData.justTransliterated = false;
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
  
  // Custom dict check
  const customMatch = customWords.find(cw => cw.pattern.startsWith(word.toLowerCase()));
  const customArr = customMatch ? [customMatch.word] : [];

  try {
    const langConfig = languages[currentLang];
    // Fetch from both APIs simultaneously
    const [varnamRes, googleRes] = await Promise.all([
      fetch(`https://api.varnamproject.com/tl/${currentLang}/${word}`).catch(() => null),
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

    // Combine them, giving priority to search engine (Google) results for accuracy
    let combinedApiMatches = [...new Set([...searchEngineWords, ...varnamWords])];
    
    // Local AI Sorting Strategy
    const learned = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
    const wordLearnings = learned[word.toLowerCase()];
    if (wordLearnings) {
      combinedApiMatches.sort((a, b) => {
        const scoreA = wordLearnings[a] || 0;
        const scoreB = wordLearnings[b] || 0;
        return scoreB - scoreA; // descending
      });
    }

    showSuggestionsForWord(word, customArr, combinedApiMatches);
    
  } catch (e) {
    console.error("Suggestion fetch error:", e);
  }
});

async function fetchCandidates(word, lang) {
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

    if (!malayalamWord) {
      console.log(`Fetching transliteration for: ${wordToTranslate}`);
      // Check custom dictionary first
      const customMatch = customWords.find(cw => cw.pattern === lowercaseWord);
      if (customMatch) {
        malayalamWord = customMatch.word;
      } else {
        // Fetch from both APIs for the final space/enter replacement
        const allCandidates = await fetchCandidates(wordToTranslate, currentLang);
        malayalamWord = allCandidates[0];
        
        // Store for correction modal
        lastTranslitData.candidates = allCandidates;
      }
    }

    if (malayalamWord) {
      // Local AI Learning - Boost future suggestions
      const aiMemory = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
      // Migration: check if old flat format
      const learned = migrateAiMemory(aiMemory);
      
      if (!learned[currentLang]) learned[currentLang] = {};
      if (!learned[currentLang][lowercaseWord]) learned[currentLang][lowercaseWord] = {};
      
      learned[currentLang][lowercaseWord][malayalamWord] = (learned[currentLang][lowercaseWord][malayalamWord] || 0) + 1;
      localStorage.setItem('manglish_ai_learning', JSON.stringify(learned));

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

      // Store data for "Is it correct?" feature and unlearning
      lastTranslitData = {
        english: wordToTranslate,
        malayalam: malayalamWord,
        candidates: lastTranslitData.candidates || [],
        justTransliterated: true, // Flag for AI unlearning
        correctionRange: wordRange
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
    
    currentLang = langCode;
    localStorage.setItem('last_selected_lang', langCode);
    
    // Refresh tables for the new language
    customWords = customWordsData[currentLang] || [];
    renderWordTable();
    
    // Switch to Indian language mode automatically
    isEnglishMode = false;
    localStorage.setItem('last_is_english_mode', false);
    
    syncLanguageUI();
    langMenu.classList.add('hidden');
    editor.focus();

    // If correction modal is open or a word was just typed, refresh candidates
    if (lastTranslitData.english) {
      fetchCandidates(lastTranslitData.english, currentLang).then(cands => {
        lastTranslitData.candidates = cands;
        // If results are currently showing in modal, refresh them automatically
        if (!isCorrectModal.classList.contains('hidden') && !correctionResults.classList.contains('hidden')) {
          runCorrectionVerification();
        }
      });
    }
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
function migrateAiMemory(data) {
  // If the data has keys that are not likely language codes (e.g. they are patterns), 
  // it means it's the old format.
  const langCodes = Object.keys(languages);
  const firstKey = Object.keys(data)[0];
  if (firstKey && !langCodes.includes(firstKey)) {
    // Old format detected
    const migrated = { 'ml': data };
    localStorage.setItem('manglish_ai_learning', JSON.stringify(migrated));
    return migrated;
  }
  return data;
}

function renderAiWordTable() {
  const aiMemory = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
  const learned = migrateAiMemory(aiMemory)[currentLang] || {};
  const entries = [];

  for (const pattern in learned) {
    for (const word in learned[pattern]) {
      entries.push({
        pattern,
        word,
        frequency: learned[pattern][word]
      });
    }
  }

  // Sort by frequency descending
  entries.sort((a, b) => b.frequency - a.frequency);

  if (entries.length === 0) {
    aiWordTableBody.innerHTML = `<tr><td colspan="4" class="empty-data">No learned data available for this language.</td></tr>`;
    return;
  }

  aiWordTableBody.innerHTML = '';
  entries.forEach(entry => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.pattern}</td>
      <td>${entry.word}</td>
      <td>${entry.frequency}</td>
      <td style="text-align: center;">
        <button class="delete-btn" onclick="deleteAiWord('${entry.pattern}', '${entry.word}')">
          <span class="material-symbols-outlined" style="font-size: 1.2rem; color: #ff7b72;">delete</span>
        </button>
      </td>
    `;
    aiWordTableBody.appendChild(row);
  });
}

window.deleteAiWord = (pattern, word) => {
  if (confirm(`Delete "${word}" from AI memory?`)) {
    const aiMemory = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
    const learned = migrateAiMemory(aiMemory);
    if (learned[currentLang] && learned[currentLang][pattern]) {
      delete learned[currentLang][pattern][word];
      if (Object.keys(learned[currentLang][pattern]).length === 0) {
        delete learned[currentLang][pattern];
      }
      localStorage.setItem('manglish_ai_learning', JSON.stringify(learned));
      renderAiWordTable();
    }
  }
};

if (btnAiDashboard) {
  btnAiDashboard.addEventListener('click', () => {
    renderAiWordTable();
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
      localStorage.removeItem('manglish_ai_learning');
      renderAiWordTable();
      alert('AI Memory cleared successfully.');
    }
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

  // Update AI Learning
  const aiMemory = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
  const learned = migrateAiMemory(aiMemory);
  
  if (!learned[currentLang]) learned[currentLang] = {};
  if (!learned[currentLang][pattern]) learned[currentLang][pattern] = {};
  learned[currentLang][pattern][newWord] = (learned[currentLang][pattern][newWord] || 0) + 10; 
  localStorage.setItem('manglish_ai_learning', JSON.stringify(learned));

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

