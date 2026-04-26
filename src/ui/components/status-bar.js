/**
 * LibreMD — UI Shell: Status Bar
 *
 * Displays document metadata: word count, cursor position, mode, theme.
 * SHELL — structure only, ready for Gemini PRO styling.
 */

import { on, Events } from '../../core/events.js';
import { getDocumentStats } from '../../core/renderer/index.js';
import { getActiveDocument } from '../../core/store/index.js';
import { getEditorMode } from '../../core/editor/index.js';
import { getActiveTheme } from '../../core/themes/index.js';
import { t } from '../../core/i18n/index.js';

/** @type {HTMLElement|null} */
let container = null;

/** @type {object} Cached references to status bar segments */
let segments = {};

let currentStats = { words: 0, chars: 0, readingTimeMinutes: 1 };
let currentCursor = { ln: 1, col: 1 };
let currentDocTitle = 'Untitled';
let currentDirty = false;
let currentMode = 'split';
let currentTheme = 'Dark';

/**
 * Mount the status bar into a container.
 * @param {HTMLElement} el
 */
export function mountStatusBar(el) {
  container = el;
  container.innerHTML = '';

  // Left side
  const left = document.createElement('div');
  left.className = 'statusbar-left';

  segments.dirty = createSegment('statusbar-dirty', '');
  segments.filename = createSegment('statusbar-filename', t('statusBar.untitled'));

  left.appendChild(segments.dirty);
  left.appendChild(segments.filename);

  // Center
  const center = document.createElement('div');
  center.className = 'statusbar-center';

  segments.words = createSegment('statusbar-words', t('statusBar.words', { count: 0 }));
  segments.chars = createSegment('statusbar-chars', t('statusBar.chars', { count: 0 }));
  segments.readTime = createSegment('statusbar-readtime', t('statusBar.readTime', { count: 1 }));

  center.appendChild(segments.words);
  center.appendChild(segments.chars);
  center.appendChild(segments.readTime);

  // Right side
  const right = document.createElement('div');
  right.className = 'statusbar-right';

  segments.mode = createSegment('statusbar-mode', t('view.splitMode'));
  segments.theme = createSegment('statusbar-theme', 'Dark');
  segments.cursor = createSegment('statusbar-cursor', t('statusBar.line', { ln: 1, col: 1 }));

  right.appendChild(segments.mode);
  right.appendChild(segments.theme);
  right.appendChild(segments.cursor);

  container.appendChild(left);
  container.appendChild(center);
  container.appendChild(right);

  // Subscribe to events
  subscribeToEvents();
}

function createSegment(id, text) {
  const span = document.createElement('span');
  span.id = id;
  span.className = 'statusbar-segment';
  span.textContent = text;
  return span;
}

function updateTexts() {
  segments.filename.textContent = currentDocTitle || t('statusBar.untitled');
  segments.dirty.textContent = currentDirty ? '●' : '';
  segments.dirty.title = currentDirty ? t('statusBar.unsaved') : '';
  segments.words.textContent = t('statusBar.words', { count: currentStats.words });
  segments.chars.textContent = t('statusBar.chars', { count: currentStats.chars });
  segments.readTime.textContent = t('statusBar.readTime', { count: currentStats.readingTimeMinutes });
  
  const modeLabels = { split: 'view.splitMode', source: 'view.sourceMode', wysiwyg: 'view.wysiwygMode', zen: 'view.zenMode' };
  segments.mode.textContent = t(modeLabels[currentMode] || currentMode);
  
  // Theme could be translated or kept as is, currently the engine uses names like 'Dark', 'Light'.
  // I will just use the active theme name.
  segments.theme.textContent = currentTheme;
  segments.cursor.textContent = t('statusBar.line', { ln: currentCursor.ln, col: currentCursor.col });
}

function subscribeToEvents() {
  on(Events.DOCUMENT_CHANGED, (doc) => {
    if (!doc) return;
    currentStats = getDocumentStats(doc.content);
    updateTexts();
  });

  on(Events.DOCUMENT_DIRTY, ({ dirty }) => {
    currentDirty = dirty;
    updateTexts();
  });

  on(Events.DOCUMENT_SWITCHED, (doc) => {
    if (!doc) return;
    currentDocTitle = doc.title;
    currentDirty = doc.dirty;
    currentStats = getDocumentStats(doc.content);
    updateTexts();
  });

  on(Events.DOCUMENT_SAVED, (doc) => {
    if (!doc) return;
    currentDocTitle = doc.title;
    currentDirty = false;
    updateTexts();
  });

  on(Events.EDITOR_MODE_CHANGED, ({ mode }) => {
    currentMode = mode;
    updateTexts();
  });

  on(Events.THEME_CHANGED, ({ name }) => {
    currentTheme = name;
    updateTexts();
  });

  on(Events.EDITOR_SELECTION_CHANGED, ({ from }) => {
    const doc = getActiveDocument();
    if (!doc) return;
    const lines = doc.content.substring(0, from).split('\n');
    currentCursor.ln = lines.length;
    currentCursor.col = lines[lines.length - 1].length + 1;
    updateTexts();
  });

  on(Events.UI_LAYOUT_CHANGED, () => {
    updateTexts();
  });
}
