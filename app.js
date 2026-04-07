// ========================
//   TAB NAVIGATION
// ========================
const navTabs = document.querySelectorAll('.nav-tab');
const panels = document.querySelectorAll('.panel');

navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    navTabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// ========================
//        CLOCK
// ========================
function updateClock() {
  const now = new Date();

  // Digital
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clockTime').textContent = `${h}:${m}:${s}`;

  // Date
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('clockDate').textContent = now.toLocaleDateString('en-US', opts);

  // Analog hands
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  document.getElementById('secondHand').style.transform = `rotate(${seconds * 6}deg)`;
  document.getElementById('minuteHand').style.transform = `rotate(${minutes * 6}deg)`;
  document.getElementById('hourHand').style.transform = `rotate(${hours * 30}deg)`;
}

updateClock();
setInterval(updateClock, 100);

// ========================
//      POMODORO
// ========================

// Load custom durations from localStorage or use defaults
const POMO_DEFAULTS = { work: 25, short: 5, long: 15 };
let pomoMinutes = JSON.parse(localStorage.getItem('pomoMinutes') || 'null') || { ...POMO_DEFAULTS };
const POMO_DURATIONS = {
  get work() { return pomoMinutes.work * 60; },
  get short() { return pomoMinutes.short * 60; },
  get long() { return pomoMinutes.long * 60; }
};
const CIRCUMFERENCE = 2 * Math.PI * 90; // matches SVG circle r=90

let pomoMode = 'work';
let pomoTime = POMO_DURATIONS.work;
let pomoTotal = POMO_DURATIONS.work;
let pomoRunning = false;
let pomoInterval = null;
let pomoSessions = Number(localStorage.getItem('pomoSessions') || '0');

const pomoTimerEl = document.getElementById('pomoTimer');
const pomoProgressEl = document.getElementById('pomoProgress');
const pomoStartBtn = document.getElementById('pomoStartPause');
const pomoResetBtn = document.getElementById('pomoReset');
const pomoSessionEl = document.getElementById('pomoSessionCount');
const pomoModes = document.querySelectorAll('.pomo-mode');

function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updatePomoDisplay() {
  pomoTimerEl.textContent = formatTime(pomoTime);
  const fraction = 1 - pomoTime / pomoTotal;
  pomoProgressEl.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
}

// Sync the minute display spans
function syncPomoMinuteDisplay() {
  document.getElementById('pomoWorkMin').textContent = pomoMinutes.work;
  document.getElementById('pomoShortMin').textContent = pomoMinutes.short;
  document.getElementById('pomoLongMin').textContent = pomoMinutes.long;
}

// Bell sound using Web Audio API
function playBellSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;

    // Strike 1 — main bell hit
    function strike(startTime) {
      // Fundamental tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(830, startTime);
      osc1.frequency.exponentialRampToValueAtTime(810, startTime + 1.5);
      gain1.gain.setValueAtTime(0.35, startTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(startTime);
      osc1.stop(startTime + 2.0);

      // Overtone 1
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1660;
      gain2.gain.setValueAtTime(0.15, startTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(startTime);
      osc2.stop(startTime + 1.2);

      // Overtone 2 (shimmer)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.value = 2490;
      gain3.gain.setValueAtTime(0.07, startTime);
      gain3.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(startTime);
      osc3.stop(startTime + 0.8);

      // Impact click
      const bufSize = ctx.sampleRate * 0.02;
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 3000;
      bandpass.Q.value = 2;
      noise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(startTime);
      noise.stop(startTime + 0.05);
    }

    // Play 3 bell strikes
    strike(t);
    strike(t + 0.6);
    strike(t + 1.2);
  } catch (_) {}
}

function startPomo() {
  if (pomoRunning) {
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoStartBtn.textContent = 'Resume';
    return;
  }
  pomoRunning = true;
  pomoStartBtn.textContent = 'Pause';
  pomoInterval = setInterval(() => {
    pomoTime--;
    updatePomoDisplay();
    if (pomoTime <= 0) {
      clearInterval(pomoInterval);
      pomoRunning = false;
      pomoStartBtn.textContent = 'Start';
      if (pomoMode === 'work') {
        pomoSessions++;
        pomoSessionEl.textContent = pomoSessions;
        localStorage.setItem('pomoSessions', pomoSessions);
      }
      playBellSound();
    }
  }, 1000);
}

function resetPomo() {
  clearInterval(pomoInterval);
  pomoRunning = false;
  pomoTime = pomoTotal;
  pomoStartBtn.textContent = 'Start';
  updatePomoDisplay();
}

pomoStartBtn.addEventListener('click', startPomo);
pomoResetBtn.addEventListener('click', resetPomo);

pomoModes.forEach(btn => {
  btn.addEventListener('click', () => {
    pomoModes.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pomoMode = btn.dataset.mode;
    pomoTotal = POMO_DURATIONS[pomoMode];
    resetPomo();
  });
});

// Time adjustment buttons (+/-)
document.querySelectorAll('.pomo-adj').forEach(btn => {
  btn.addEventListener('click', () => {
    if (pomoRunning) return; // don't allow changes while running
    const target = btn.dataset.target; // 'work', 'short', 'long'
    const dir = Number(btn.dataset.dir); // 1 or -1
    pomoMinutes[target] = Math.max(1, Math.min(120, pomoMinutes[target] + dir));
    localStorage.setItem('pomoMinutes', JSON.stringify(pomoMinutes));
    syncPomoMinuteDisplay();
    // If adjusting the currently active mode, update the timer
    if (pomoMode === target) {
      pomoTotal = POMO_DURATIONS[target];
      pomoTime = pomoTotal;
      updatePomoDisplay();
    }
  });
});

// Init display
pomoProgressEl.style.strokeDasharray = CIRCUMFERENCE;
syncPomoMinuteDisplay();
updatePomoDisplay();
pomoSessionEl.textContent = pomoSessions;

// ========================
//        TODOS
// ========================
let todos = JSON.parse(localStorage.getItem('todos') || '[]');
let filter = 'all';

const todoInput = document.getElementById('todoInput');
const todoAddBtn = document.getElementById('todoAdd');
const todoListEl = document.getElementById('todoList');
const todoCountEl = document.getElementById('todoCount');
const todoClearBtn = document.getElementById('todoClearDone');
const todoFilters = document.querySelectorAll('.todo-filter');

function saveTodos() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

function renderTodos() {
  const filtered = todos.filter(t => {
    if (filter === 'active') return !t.done;
    if (filter === 'completed') return t.done;
    return true;
  });

  todoListEl.innerHTML = '';
  filtered.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item${todo.done ? ' done' : ''}`;
    li.innerHTML = `
      <div class="todo-checkbox" data-id="${todo.id}"></div>
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button class="todo-delete" data-id="${todo.id}">&times;</button>
    `;
    todoListEl.appendChild(li);
  });

  const left = todos.filter(t => !t.done).length;
  todoCountEl.textContent = `${left} item${left !== 1 ? 's' : ''} left`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  todos.push({ id: Date.now(), text, done: false });
  todoInput.value = '';
  saveTodos();
  renderTodos();
}

todoAddBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

todoListEl.addEventListener('click', e => {
  const id = Number(e.target.dataset.id);
  if (!id) return;
  if (e.target.classList.contains('todo-checkbox')) {
    const todo = todos.find(t => t.id === id);
    if (todo) todo.done = !todo.done;
  } else if (e.target.classList.contains('todo-delete')) {
    todos = todos.filter(t => t.id !== id);
  }
  saveTodos();
  renderTodos();
});

todoClearBtn.addEventListener('click', () => {
  todos = todos.filter(t => !t.done);
  saveTodos();
  renderTodos();
});

todoFilters.forEach(btn => {
  btn.addEventListener('click', () => {
    todoFilters.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    renderTodos();
  });
});

renderTodos();

// ========================
//        NOTES
// ========================
let notes = JSON.parse(localStorage.getItem('notes') || '[]');
let activeNoteId = null;
let noteSearchTerm = '';

const notesListEl = document.getElementById('notesList');
const notesEmpty = document.getElementById('notesEmpty');
const notesEditArea = document.getElementById('notesEditArea');
const noteTitleEl = document.getElementById('noteTitle');
const noteBodyEl = document.getElementById('noteBody');
const noteTimestampEl = document.getElementById('noteTimestamp');
const noteSearchEl = document.getElementById('noteSearch');

function saveNotes() {
  localStorage.setItem('notes', JSON.stringify(notes));
}

function formatNoteDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function renderNotesList() {
  const term = noteSearchTerm.toLowerCase();
  const filtered = notes
    .filter(n => {
      if (!term) return true;
      return n.title.toLowerCase().includes(term) || n.body.toLowerCase().includes(term);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  notesListEl.innerHTML = '';
  filtered.forEach(note => {
    const li = document.createElement('li');
    li.className = 'notes-list-item' + (note.id === activeNoteId ? ' active' : '');
    li.dataset.id = note.id;
    const preview = note.body.replace(/\n/g, ' ').substring(0, 60);
    li.innerHTML = `
      <div class="notes-list-item-title">${escapeHtml(note.title || 'Untitled')}</div>
      <div class="notes-list-item-preview">${escapeHtml(preview || 'No content')}</div>
      <div class="notes-list-item-date">${formatNoteDate(note.updatedAt)}</div>
    `;
    notesListEl.appendChild(li);
  });
}

function openNote(id) {
  activeNoteId = id;
  const note = notes.find(n => n.id === id);
  if (!note) return;

  notesEmpty.style.display = 'none';
  notesEditArea.style.display = 'flex';
  noteTitleEl.value = note.title;
  noteBodyEl.value = note.body;
  noteTimestampEl.textContent = 'Last edited: ' + new Date(note.updatedAt).toLocaleString();
  renderNotesList();
}

function closeEditor() {
  activeNoteId = null;
  notesEmpty.style.display = 'flex';
  notesEditArea.style.display = 'none';
  renderNotesList();
}

// Auto-save on typing
function onNoteInput() {
  if (!activeNoteId) return;
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  note.title = noteTitleEl.value;
  note.body = noteBodyEl.value;
  note.updatedAt = Date.now();
  noteTimestampEl.textContent = 'Last edited: ' + new Date(note.updatedAt).toLocaleString();
  saveNotes();
  renderNotesList();
}

noteTitleEl.addEventListener('input', onNoteInput);
noteBodyEl.addEventListener('input', onNoteInput);

// New note
document.getElementById('newNote').addEventListener('click', () => {
  const note = {
    id: Date.now(),
    title: '',
    body: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  notes.unshift(note);
  saveNotes();
  openNote(note.id);
  noteTitleEl.focus();
});

// Click to open note
notesListEl.addEventListener('click', (e) => {
  const item = e.target.closest('.notes-list-item');
  if (!item) return;
  openNote(Number(item.dataset.id));
});

// Delete note
document.getElementById('deleteNote').addEventListener('click', () => {
  if (!activeNoteId) return;
  notes = notes.filter(n => n.id !== activeNoteId);
  saveNotes();
  closeEditor();
});

// Search
noteSearchEl.addEventListener('input', () => {
  noteSearchTerm = noteSearchEl.value;
  renderNotesList();
});

renderNotesList();

// ========================
//       SETTINGS
// ========================

// --- Theme Presets ---
const THEME_PRESETS = {
  dark: {
    bg: '#0f1117', surface: '#1a1d27', surface2: '#242836', border: '#2e3345',
    text: '#e4e6f0', textMuted: '#8b8fa3', accent: '#7c5cfc', accentLight: '#9b82fc'
  },
  light: {
    bg: '#f0f2f5', surface: '#ffffff', surface2: '#e8eaed', border: '#d1d5db',
    text: '#1a1a2e', textMuted: '#6b7280', accent: '#6d4aff', accentLight: '#8b6fff'
  },
  midnight: {
    bg: '#0a0e27', surface: '#111638', surface2: '#1a2048', border: '#252d5c',
    text: '#d4d8f0', textMuted: '#7b82a8', accent: '#4a6cf7', accentLight: '#6d8bff'
  },
  forest: {
    bg: '#0b1a0b', surface: '#122112', surface2: '#1a2e1a', border: '#2a4a2a',
    text: '#d4e8d4', textMuted: '#7ea87e', accent: '#2ea043', accentLight: '#4cc764'
  },
  sunset: {
    bg: '#1a0a0a', surface: '#261212', surface2: '#331a1a', border: '#4a2828',
    text: '#f0d4d4', textMuted: '#a87e7e', accent: '#e8553a', accentLight: '#f07856'
  },
  ocean: {
    bg: '#04111d', surface: '#0a1929', surface2: '#122236', border: '#1e3a52',
    text: '#d4e4f0', textMuted: '#7e9ab0', accent: '#2196f3', accentLight: '#42a5f5'
  }
};

// --- Gradient Presets ---
const GRADIENT_PRESETS = {
  'purple-haze':   { c1: '#0f0c29', c2: '#302b63' },
  'ocean-blue':    { c1: '#003973', c2: '#005c97' },
  'sunset-warm':   { c1: '#3a1c71', c2: '#d76d77' },
  'emerald':       { c1: '#0f2027', c2: '#2c5364' },
  'midnight-city': { c1: '#232526', c2: '#414345' }
};

// --- Defaults ---
const DEFAULT_SETTINGS = {
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontSize: 16,
  themePreset: 'dark',
  accentColor: '#7c5cfc',
  bgColor: '#0f1117',
  bgMode: 'solid',
  gradientPreset: 'custom',
  gradColor1: '#0f0c29',
  gradColor2: '#302b63',
  bgImageData: null,
  paperPattern: 'none',
  patternColor: '#2e3345',
  patternOpacity: 30,
  patternSize: 28
};

// --- Load / Save ---
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('appSettings'));
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s) {
  localStorage.setItem('appSettings', JSON.stringify(s));
}

// --- Color Helper ---
function adjustColor(hex, amount) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  let r = parseInt(hex.substring(0, 2), 16) + amount;
  let g = parseInt(hex.substring(2, 4), 16) + amount;
  let b = parseInt(hex.substring(4, 6), 16) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function getLuminance(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// --- Apply Settings ---
function applySettings(s) {
  const root = document.documentElement;

  // Theme colors
  if (s.themePreset !== 'custom' && THEME_PRESETS[s.themePreset]) {
    const t = THEME_PRESETS[s.themePreset];
    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--surface', t.surface);
    root.style.setProperty('--surface2', t.surface2);
    root.style.setProperty('--border', t.border);
    root.style.setProperty('--text', t.text);
    root.style.setProperty('--text-muted', t.textMuted);
  } else {
    // Custom: derive surface colors from bgColor
    const lum = getLuminance(s.bgColor);
    const dir = lum > 0.5 ? -1 : 1; // darken for light bg, lighten for dark
    root.style.setProperty('--bg', s.bgColor);
    root.style.setProperty('--surface', adjustColor(s.bgColor, dir * 15));
    root.style.setProperty('--surface2', adjustColor(s.bgColor, dir * 25));
    root.style.setProperty('--border', adjustColor(s.bgColor, dir * 40));

    if (lum > 0.5) {
      root.style.setProperty('--text', '#1a1a2e');
      root.style.setProperty('--text-muted', '#6b7280');
    } else {
      root.style.setProperty('--text', '#e4e6f0');
      root.style.setProperty('--text-muted', '#8b8fa3');
    }
  }

  // Accent color (always applied, overrides preset accent)
  root.style.setProperty('--accent', s.accentColor);
  root.style.setProperty('--accent-light', adjustColor(s.accentColor, 40));

  // Font family
  root.style.setProperty('--font', s.fontFamily);
  // Load Google Font if needed
  const fontSelect = document.getElementById('fontFamily');
  const selectedOption = fontSelect.options[fontSelect.selectedIndex];
  const googleFont = selectedOption ? selectedOption.dataset.google : null;
  const fontLink = document.getElementById('googleFontLink');
  if (googleFont) {
    fontLink.href = `https://fonts.googleapis.com/css2?family=${googleFont}:wght@300;400;500;600;700&display=swap`;
  } else {
    fontLink.href = '';
  }

  // Font size
  root.style.fontSize = s.fontSize + 'px';

  // Background mode
  if (s.bgMode === 'solid') {
    document.body.style.backgroundImage = 'none';
  } else if (s.bgMode === 'gradient') {
    let c1 = s.gradColor1, c2 = s.gradColor2;
    if (s.gradientPreset !== 'custom' && GRADIENT_PRESETS[s.gradientPreset]) {
      c1 = GRADIENT_PRESETS[s.gradientPreset].c1;
      c2 = GRADIENT_PRESETS[s.gradientPreset].c2;
    }
    document.body.style.backgroundImage = `linear-gradient(135deg, ${c1}, ${c2})`;
  } else if (s.bgMode === 'image' && s.bgImageData) {
    document.body.style.backgroundImage = `url(${s.bgImageData})`;
  }

  // Paper pattern overlay
  const overlay = document.getElementById('paperOverlay');
  if (s.paperPattern === 'none') {
    overlay.style.backgroundImage = 'none';
  } else {
    // Parse hex color and apply opacity
    const hex = s.patternColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const a = s.patternOpacity / 100;
    const lineColor = `rgba(${r}, ${g}, ${b}, ${a})`;
    const size = s.patternSize;

    if (s.paperPattern === 'lined') {
      overlay.style.backgroundImage =
        `repeating-linear-gradient(0deg, transparent, transparent ${size - 1}px, ${lineColor} ${size - 1}px, ${lineColor} ${size}px)`;
      overlay.style.backgroundSize = `100% ${size}px`;
    } else if (s.paperPattern === 'graph') {
      overlay.style.backgroundImage =
        `repeating-linear-gradient(0deg, transparent, transparent ${size - 1}px, ${lineColor} ${size - 1}px, ${lineColor} ${size}px),` +
        `repeating-linear-gradient(90deg, transparent, transparent ${size - 1}px, ${lineColor} ${size - 1}px, ${lineColor} ${size}px)`;
      overlay.style.backgroundSize = `${size}px ${size}px`;
    }
  }
}

// --- Sync form controls to settings object ---
function syncFormToSettings(s) {
  document.getElementById('fontFamily').value = s.fontFamily;
  document.getElementById('fontSize').value = s.fontSize;
  document.getElementById('fontSizeValue').textContent = s.fontSize;
  document.getElementById('themePreset').value = s.themePreset;
  document.getElementById('accentColor').value = s.accentColor;
  document.getElementById('bgColor').value = s.bgColor;
  document.getElementById('bgMode').value = s.bgMode;
  document.getElementById('gradientPreset').value = s.gradientPreset;
  document.getElementById('gradColor1').value = s.gradColor1;
  document.getElementById('gradColor2').value = s.gradColor2;

  // Toggle sub-panels
  document.getElementById('gradientOptions').style.display = s.bgMode === 'gradient' ? 'block' : 'none';
  document.getElementById('imageOptions').style.display = s.bgMode === 'image' ? 'block' : 'none';

  // Paper pattern
  document.getElementById('paperPattern').value = s.paperPattern;
  document.getElementById('patternColor').value = s.patternColor;
  document.getElementById('patternOpacity').value = s.patternOpacity;
  document.getElementById('patternOpacityValue').textContent = s.patternOpacity + '%';
  document.getElementById('patternSize').value = s.patternSize;
  document.getElementById('patternSizeValue').textContent = s.patternSize + 'px';
  const showPatternOpts = s.paperPattern !== 'none';
  document.getElementById('patternColorRow').style.display = showPatternOpts ? 'flex' : 'none';
  document.getElementById('patternSizeRow').style.display = showPatternOpts ? 'flex' : 'none';

  // Image preview
  const preview = document.getElementById('bgImagePreview');
  const clearBtn = document.getElementById('clearBgImage');
  if (s.bgImageData) {
    preview.style.display = 'block';
    preview.style.backgroundImage = `url(${s.bgImageData})`;
    clearBtn.style.display = 'inline-block';
  } else {
    preview.style.display = 'none';
    clearBtn.style.display = 'none';
  }
}

// --- Event Listeners ---
let settings = loadSettings();

// Font family
document.getElementById('fontFamily').addEventListener('change', () => {
  settings.fontFamily = document.getElementById('fontFamily').value;
  saveSettings(settings);
  applySettings(settings);
});

// Font size
document.getElementById('fontSize').addEventListener('input', () => {
  settings.fontSize = Number(document.getElementById('fontSize').value);
  document.getElementById('fontSizeValue').textContent = settings.fontSize;
  saveSettings(settings);
  applySettings(settings);
});

// Theme preset
document.getElementById('themePreset').addEventListener('change', () => {
  const preset = document.getElementById('themePreset').value;
  settings.themePreset = preset;
  if (preset !== 'custom' && THEME_PRESETS[preset]) {
    settings.accentColor = THEME_PRESETS[preset].accent;
    settings.bgColor = THEME_PRESETS[preset].bg;
    document.getElementById('accentColor').value = settings.accentColor;
    document.getElementById('bgColor').value = settings.bgColor;
  }
  saveSettings(settings);
  applySettings(settings);
});

// Accent color
document.getElementById('accentColor').addEventListener('input', () => {
  settings.accentColor = document.getElementById('accentColor').value;
  settings.themePreset = 'custom';
  document.getElementById('themePreset').value = 'custom';
  saveSettings(settings);
  applySettings(settings);
});

// Background color
document.getElementById('bgColor').addEventListener('input', () => {
  settings.bgColor = document.getElementById('bgColor').value;
  settings.themePreset = 'custom';
  document.getElementById('themePreset').value = 'custom';
  saveSettings(settings);
  applySettings(settings);
});

// Background mode
document.getElementById('bgMode').addEventListener('change', () => {
  settings.bgMode = document.getElementById('bgMode').value;
  document.getElementById('gradientOptions').style.display = settings.bgMode === 'gradient' ? 'block' : 'none';
  document.getElementById('imageOptions').style.display = settings.bgMode === 'image' ? 'block' : 'none';
  saveSettings(settings);
  applySettings(settings);
});

// Gradient preset
document.getElementById('gradientPreset').addEventListener('change', () => {
  settings.gradientPreset = document.getElementById('gradientPreset').value;
  if (settings.gradientPreset !== 'custom' && GRADIENT_PRESETS[settings.gradientPreset]) {
    settings.gradColor1 = GRADIENT_PRESETS[settings.gradientPreset].c1;
    settings.gradColor2 = GRADIENT_PRESETS[settings.gradientPreset].c2;
    document.getElementById('gradColor1').value = settings.gradColor1;
    document.getElementById('gradColor2').value = settings.gradColor2;
  }
  saveSettings(settings);
  applySettings(settings);
});

// Gradient custom colors
document.getElementById('gradColor1').addEventListener('input', () => {
  settings.gradColor1 = document.getElementById('gradColor1').value;
  settings.gradientPreset = 'custom';
  document.getElementById('gradientPreset').value = 'custom';
  saveSettings(settings);
  applySettings(settings);
});
document.getElementById('gradColor2').addEventListener('input', () => {
  settings.gradColor2 = document.getElementById('gradColor2').value;
  settings.gradientPreset = 'custom';
  document.getElementById('gradientPreset').value = 'custom';
  saveSettings(settings);
  applySettings(settings);
});

// Image upload
document.getElementById('bgImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Compress large images via canvas
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1920;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

      if (dataUrl.length > 3 * 1024 * 1024) {
        alert('Image is too large even after compression. Please choose a smaller image.');
        return;
      }

      settings.bgImageData = dataUrl;
      settings.bgMode = 'image';
      document.getElementById('bgMode').value = 'image';
      document.getElementById('imageOptions').style.display = 'block';

      const preview = document.getElementById('bgImagePreview');
      preview.style.display = 'block';
      preview.style.backgroundImage = `url(${dataUrl})`;
      document.getElementById('clearBgImage').style.display = 'inline-block';

      saveSettings(settings);
      applySettings(settings);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Clear image
document.getElementById('clearBgImage').addEventListener('click', () => {
  settings.bgImageData = null;
  settings.bgMode = 'solid';
  document.getElementById('bgMode').value = 'solid';
  document.getElementById('imageOptions').style.display = 'none';
  document.getElementById('bgImagePreview').style.display = 'none';
  document.getElementById('clearBgImage').style.display = 'none';
  document.getElementById('bgImage').value = '';
  saveSettings(settings);
  applySettings(settings);
});

// Paper pattern
document.getElementById('paperPattern').addEventListener('change', () => {
  settings.paperPattern = document.getElementById('paperPattern').value;
  const show = settings.paperPattern !== 'none';
  document.getElementById('patternColorRow').style.display = show ? 'flex' : 'none';
  document.getElementById('patternSizeRow').style.display = show ? 'flex' : 'none';
  saveSettings(settings);
  applySettings(settings);
});

document.getElementById('patternColor').addEventListener('input', () => {
  settings.patternColor = document.getElementById('patternColor').value;
  saveSettings(settings);
  applySettings(settings);
});

document.getElementById('patternOpacity').addEventListener('input', () => {
  settings.patternOpacity = Number(document.getElementById('patternOpacity').value);
  document.getElementById('patternOpacityValue').textContent = settings.patternOpacity + '%';
  saveSettings(settings);
  applySettings(settings);
});

document.getElementById('patternSize').addEventListener('input', () => {
  settings.patternSize = Number(document.getElementById('patternSize').value);
  document.getElementById('patternSizeValue').textContent = settings.patternSize + 'px';
  saveSettings(settings);
  applySettings(settings);
});

// Reset all
document.getElementById('resetSettings').addEventListener('click', () => {
  settings = { ...DEFAULT_SETTINGS };
  syncFormToSettings(settings);
  saveSettings(settings);
  applySettings(settings);
  document.getElementById('bgImage').value = '';
});

// ========================
//    EXPORT / IMPORT
// ========================
function showImportStatus(message, isError) {
  const el = document.getElementById('importStatus');
  el.textContent = message;
  el.className = 'settings-status ' + (isError ? 'error' : 'success');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// Export all user data as JSON file
document.getElementById('exportData').addEventListener('click', () => {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos: JSON.parse(localStorage.getItem('todos') || '[]'),
    notes: JSON.parse(localStorage.getItem('notes') || '[]'),
    settings: JSON.parse(localStorage.getItem('appSettings') || '{}'),
    pomoSessions: Number(localStorage.getItem('pomoSessions') || '0'),
    pomoMinutes: JSON.parse(localStorage.getItem('pomoMinutes') || 'null')
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `productivity-hub-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showImportStatus('Data exported successfully!', false);
});

// Import user data from JSON file
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);

      // Validate structure
      if (!data.version || typeof data !== 'object') {
        showImportStatus('Invalid file format. Please use a Productivity Hub export file.', true);
        return;
      }

      // Import todos
      if (Array.isArray(data.todos)) {
        todos = data.todos;
        saveTodos();
        renderTodos();
      }

      // Import pomodoro sessions
      if (typeof data.pomoSessions === 'number') {
        pomoSessions = data.pomoSessions;
        localStorage.setItem('pomoSessions', pomoSessions);
        pomoSessionEl.textContent = pomoSessions;
      }

      // Import pomodoro custom times
      if (data.pomoMinutes && typeof data.pomoMinutes === 'object') {
        Object.assign(pomoMinutes, data.pomoMinutes);
        localStorage.setItem('pomoMinutes', JSON.stringify(pomoMinutes));
        syncPomoMinuteDisplay();
        pomoTotal = POMO_DURATIONS[pomoMode];
        pomoTime = pomoTotal;
        updatePomoDisplay();
      }

      // Import notes
      if (Array.isArray(data.notes)) {
        notes = data.notes;
        saveNotes();
        closeEditor();
        renderNotesList();
      }

      // Import settings
      if (data.settings && typeof data.settings === 'object') {
        settings = { ...DEFAULT_SETTINGS, ...data.settings };
        saveSettings(settings);
        syncFormToSettings(settings);
        applySettings(settings);
      }

      showImportStatus(`Data imported! (${data.todos?.length || 0} todos, ${data.notes?.length || 0} notes, ${data.pomoSessions || 0} sessions)`, false);
    } catch (err) {
      showImportStatus('Failed to read file. Make sure it is a valid JSON export.', true);
    }

    // Reset file input so the same file can be re-imported
    e.target.value = '';
  };
  reader.readAsText(file);
});

// --- Init settings on load ---
syncFormToSettings(settings);
applySettings(settings);
