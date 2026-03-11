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
  if (debugLogBox) debugLogBox.classList.remove('hidden');
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

// Toolbar & Menu Elements
const btnMore = document.getElementById('btn-more');
const moreMenu = document.getElementById('more-menu');

let selectedCorrection = null;
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
const btnAiDashboard = document.getElementById('btn-ai-dashboard');
const aiDashboardModal = document.getElementById('ai-dashboard-modal');
const btnCloseAiModal = document.getElementById('btn-close-ai-modal');
const btnClearAiMemory = document.getElementById('btn-clear-ai-memory');
const aiWordTableBody = document.getElementById('ai-word-table-body');

let currentLang = localStorage.getItem('last_selected_lang') || 'ml'; // Active Indian language
let isEnglishMode = localStorage.getItem('last_is_english_mode') === 'true'; // Toggle between English and the current Indian language
let isTranslating = false;

// Correction state
let lastTranslitData = {
  english: '',
  malayalam: '',
  selectionPath: null // Used to re-select the word if needed
};

// Custom words state
let customWords = JSON.parse(localStorage.getItem('manglish_custom_words') || '[]');

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
}

// Focus editor and sync UI on load
window.addEventListener('DOMContentLoaded', () => {
  syncLanguageUI();
  editor.focus();
});

// Transliteration trigger
editor.addEventListener('keyup', async (e) => {
  if (isEnglishMode) return;
  
  // We trigger on Space (code: Space) and Enter (code: Enter)
  if (e.code === 'Space' || e.code === 'Enter') {
    await handleTransliteration(e.code === 'Space' ? ' ' : '\n');
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
        try {
          const langConfig = languages[currentLang];
          const [varnamRes, googleRes] = await Promise.all([
            fetch(`https://api.varnamproject.com/tl/${currentLang}/${wordToTranslate}`).catch(() => null),
            fetch(`https://inputtools.google.com/request?text=${wordToTranslate}&itc=${langConfig.googleCode}&num=3&cp=0&cs=1&ie=utf-8&oe=utf-8&app=editor`).catch(() => null)
          ]);

          let bestMatch = null;

          if (googleRes && googleRes.ok) {
            const gData = await googleRes.json();
            if (gData[0] === 'SUCCESS' && gData[1] && gData[1][0] && gData[1][0][1]) {
              bestMatch = gData[1][0][1][0]; // Top search-engine result
            }
          }

          if (!bestMatch && varnamRes && varnamRes.ok) {
            const vData = await varnamRes.json();
            if (vData.success && vData.result && vData.result.length > 0) {
              bestMatch = vData.result[0];
            }
          }

          malayalamWord = bestMatch;
        } catch (e) {
          console.error("Transliteration fetch error:", e);
        }
      }
    }

    if (malayalamWord) {
      // Local AI Learning - Boost future suggestions
      const learned = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
      if (!learned[lowercaseWord]) {
        learned[lowercaseWord] = {};
      }
      learned[lowercaseWord][malayalamWord] = (learned[lowercaseWord][malayalamWord] || 0) + 1;
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

      // Store data for "Is it correct?" feature
      lastTranslitData = {
        english: wordToTranslate,
        malayalam: malayalamWord
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
  if (customWords.length === 0) {
    wordTableBody.innerHTML = `<tr><td colspan="2" class="empty-data">No data available</td></tr>`;
    return;
  }
  
  wordTableBody.innerHTML = '';
  customWords.forEach(({ pattern, word }) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${word}</td>
      <td>${pattern}</td>
    `;
    wordTableBody.appendChild(row);
  });
}

// Initial render
renderWordTable();

if (btnAddWordTarget) {
  btnAddWordTarget.addEventListener('click', () => {
    addWordModal.classList.remove('hidden');
    if (inputWord) inputWord.focus();
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
      customWords.unshift({ pattern, word });
      // Save to local storage
      localStorage.setItem('manglish_custom_words', JSON.stringify(customWords));
      
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
    
    // Switch to Indian language mode automatically
    isEnglishMode = false;
    localStorage.setItem('last_is_english_mode', false);
    
    syncLanguageUI();
    langMenu.classList.add('hidden');
    editor.focus();
  });
});

// Window Controls
const btnMin = document.getElementById('win-min');
const btnClose = document.getElementById('win-close');

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
function renderAiWordTable() {
  const learned = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
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
    aiWordTableBody.innerHTML = `<tr><td colspan="3" class="empty-data">No learned data available yet. Start typing to train the AI!</td></tr>`;
    return;
  }

  aiWordTableBody.innerHTML = '';
  entries.forEach(entry => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.pattern}</td>
      <td>${entry.word}</td>
      <td>${entry.frequency}</td>
    `;
    aiWordTableBody.appendChild(row);
  });
}

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

if (btnNewFileMain && newFileMenu) {
  btnNewFileMain.addEventListener('click', (e) => {
    e.stopPropagation();
    newFileMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    newFileMenu.classList.add('hidden');
  });
}

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
      const editIcon = document.createElement('span');
      editIcon.className = 'material-symbols-outlined rename-icon';
      editIcon.textContent = 'edit';
      editIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        renameFile(file.filename);
      });
      li.appendChild(editIcon);
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
  
  // Calculate dynamic width: min 300, max 600, ~70px per char
  const dynamicWidth = Math.min(600, Math.max(300, charCount * 70));
  
  // Set container width
  const container = drawingCanvas.parentElement;
  if (container) {
    container.style.width = dynamicWidth + 'px';
  }

  // Set internal resolution for the canvas
  drawingCanvas.width = dynamicWidth;
  drawingCanvas.height = 300; 
  
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

function clearCanvas() {
  ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  
  if (lastTranslitData && lastTranslitData.malayalam) {
    // Save current state
    const currentComp = ctx.globalCompositeOperation;
    const currentStyle = ctx.fillStyle;
    
    // Draw ghost text
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '64px "Noto Sans Malayalam", "Inter", sans-serif';
    ctx.fillStyle = '#58a6ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lastTranslitData.malayalam, drawingCanvas.width / 2, drawingCanvas.height / 2);
    
    // Restore state
    ctx.globalCompositeOperation = currentComp;
    ctx.fillStyle = currentStyle;
  }
  
  strokes = [];
}

if (btnIsCorrect) {
  btnIsCorrect.addEventListener('click', () => {
    displayEnglishWord.textContent = lastTranslitData.english;
    isCorrectModal.classList.remove('hidden');
    initCanvas();
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

// Drawing Logic
drawingCanvas.addEventListener('mousedown', (e) => {
  drawing = true;
  const rect = drawingCanvas.getBoundingClientRect();
  const scaleX = drawingCanvas.width / rect.width;
  const scaleY = drawingCanvas.height / rect.height;
  
  // Offset by hotspot (0, 20) in visual pixels
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top - 20) * scaleY;
  
  ctx.beginPath();
  ctx.moveTo(x, y);
  strokes.push([[x], [y], [Date.now()]]); 
});

drawingCanvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const rect = drawingCanvas.getBoundingClientRect();
  const scaleX = drawingCanvas.width / rect.width;
  const scaleY = drawingCanvas.height / rect.height;
  
  // Offset by hotspot (0, 20) in visual pixels
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top - 20) * scaleY;
  
  ctx.lineTo(x, y);
  ctx.stroke();
  
  if (!isEraser) {
    const currentStroke = strokes[strokes.length - 1];
    currentStroke[0].push(x);
    currentStroke[1].push(y);
    currentStroke[2].push(Date.now());
  }
});

window.addEventListener('mouseup', () => {
  drawing = false;
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
      language: currentLang
    }]
  };

  try {
    const url = `https://inputtools.google.com/request?itc=${handwritingITC}&app=autofill`;
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
    if (selectedCorrection) {
      updateWithCorrection(selectedCorrection);
      isCorrectModal.classList.add('hidden');
      return;
    }

    btnVerifyUpdate.disabled = true;
    const originalText = btnVerifyUpdate.innerHTML;
    btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">sync</span> Verifying...`;
    
    // Clear previous results
    resultsList.innerHTML = '';
    correctionResults.classList.add('hidden');
    selectedCorrection = null;

    const candidates = await recognizeHandwriting();
    
    if (candidates && candidates.length > 0) {
      correctionResults.classList.remove('hidden');
      candidates.forEach((word, index) => {
        const chip = document.createElement('div');
        chip.className = 'result-chip';
        chip.textContent = word;
        chip.addEventListener('click', () => {
          // Highlight selection
          document.querySelectorAll('.result-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          
          selectedCorrection = word;
          btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Update Editor`;
          btnVerifyUpdate.classList.add('pulse-animation'); // Optional visual cue
        });
        resultsList.appendChild(chip);
      });
      
      // Auto-select first one as default but require "Update" click
      // (Or let user pick)
      btnVerifyUpdate.innerHTML = `<span class="material-symbols-outlined">touch_app</span> Pick a Word`;

    } else {
      alert("No handwriting detected or recognition failed. Please try again.");
    }
    
    btnVerifyUpdate.disabled = false;
  });
}

function updateWithCorrection(newWord) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    const lastWord = lastTranslitData.malayalam;
    
    // Find last index of the word before current cursor
    // More robust matching: search globally in the editor if current node fails
    let lastIdx = text.lastIndexOf(lastWord, selection.focusOffset);
    if (lastIdx === -1) {
       // Try without offset constraint if fails
       lastIdx = text.lastIndexOf(lastWord);
    }

    if (lastIdx !== -1) {
      console.log(`Replacing "${lastWord}" with "${newWord}" at index ${lastIdx}`);
      const newText = text.substring(0, lastIdx) + newWord + text.substring(lastIdx + lastWord.length);
      node.textContent = newText;
      
      // Reset cursor position
      const newRange = document.createRange();
      newRange.setStart(node, lastIdx + newWord.length);
      newRange.setEnd(node, lastIdx + newWord.length);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      console.error(`Could not find "${lastWord}" in current node text.`);
      // Fallback: Try to find in the entire editor if possible
      if (editor.innerText.includes(lastWord)) {
        console.log("Found word in editor full text, but not in current node. Correcting...");
        editor.innerText = editor.innerText.replace(new RegExp(lastWord + "$"), newWord);
      }
    }
  }

  // Persist the correction
  const pattern = lastTranslitData.english.toLowerCase();
  
  // Update Custom Words
  customWords.unshift({ pattern, word: newWord });
  localStorage.setItem('manglish_custom_words', JSON.stringify(customWords));
  renderWordTable();

  // Update AI Learning
  const learned = JSON.parse(localStorage.getItem('manglish_ai_learning') || '{}');
  if (!learned[pattern]) learned[pattern] = {};
  learned[pattern][newWord] = (learned[pattern][newWord] || 0) + 10; 
  localStorage.setItem('manglish_ai_learning', JSON.stringify(learned));

  btnIsCorrect.classList.add('hidden');
}

// Initial Load
if (activeFilePath && fs.existsSync(activeFilePath)) {
  loadNote(activeFilePath);
} else {
  renderFileList();
}
