/**
 * LibreMD — Keyboard Shortcuts Manager
 *
 * Listens for keyboard events at the document level and dispatches
 * to the command registry. Handles platform-specific modifiers
 * (Ctrl on Windows/Linux, Cmd on macOS).
 */

import { executeCommand, getAllCommands } from '../commands/index.js';

// ── Platform Detection ─────────────────────────────────────────────

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

// ── Shortcut Parsing ───────────────────────────────────────────────

/**
 * Parse a shortcut string like "Ctrl+Shift+B" into a normalized object.
 * @param {string} shortcutStr
 * @returns {{ ctrl: boolean, shift: boolean, alt: boolean, meta: boolean, key: string }}
 */
function parseShortcut(shortcutStr) {
  const parts = shortcutStr.toLowerCase().split('+').map(p => p.trim());
  const result = { ctrl: false, shift: false, alt: false, meta: false, key: '' };

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        result.ctrl = true;
        break;
      case 'shift':
        result.shift = true;
        break;
      case 'alt':
      case 'option':
        result.alt = true;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
        result.meta = true;
        break;
      case '\\':
        result.key = 'backslash';
        break;
      default:
        result.key = part;
    }
  }

  return result;
}

/**
 * Check if a keyboard event matches a parsed shortcut.
 * On macOS, Ctrl in shortcut = metaKey (Cmd).
 * On Windows/Linux, Ctrl in shortcut = ctrlKey.
 * @param {KeyboardEvent} event
 * @param {object} shortcut - Parsed shortcut object
 * @returns {boolean}
 */
function eventMatchesShortcut(event, shortcut) {
  // On macOS: "Ctrl" shortcuts map to Cmd key
  const modCtrl = isMac ? event.metaKey : event.ctrlKey;
  const modMeta = isMac ? event.ctrlKey : event.metaKey;

  if (shortcut.ctrl !== modCtrl) return false;
  if (shortcut.shift !== event.shiftKey) return false;
  if (shortcut.alt !== event.altKey) return false;
  if (shortcut.meta !== modMeta) return false;

  const eventKey = event.key.toLowerCase();

  // Special key mappings
  if (shortcut.key === 'backslash') return eventKey === '\\';

  return eventKey === shortcut.key;
}

// ── State ──────────────────────────────────────────────────────────

/** @type {Map<string, { commandId: string, parsed: object }>} */
const shortcutMap = new Map();

/** @type {boolean} */
let isListening = false;

/** @type {((e: KeyboardEvent) => void)|null} */
let keydownHandler = null;

// ── Build Shortcut Map ─────────────────────────────────────────────

/**
 * Rebuild the shortcut map from registered commands.
 * Call after registering commands.
 */
export function rebuildShortcutMap() {
  shortcutMap.clear();

  for (const cmd of getAllCommands()) {
    if (cmd.shortcut) {
      const parsed = parseShortcut(cmd.shortcut);
      // Use a normalized string key for lookup
      const key = normalizeKey(parsed);
      shortcutMap.set(key, { commandId: cmd.id, parsed });
    }
  }
}

/**
 * Create a unique string key from a parsed shortcut for Map lookup.
 */
function normalizeKey(parsed) {
  const parts = [];
  if (parsed.ctrl) parts.push('ctrl');
  if (parsed.shift) parts.push('shift');
  if (parsed.alt) parts.push('alt');
  if (parsed.meta) parts.push('meta');
  parts.push(parsed.key);
  return parts.join('+');
}

// ── Listener ───────────────────────────────────────────────────────

/**
 * Start listening for keyboard shortcuts.
 */
export function startListening() {
  if (isListening) return;

  keydownHandler = (event) => {
    // Don't intercept when typing in inputs (except our CodeMirror editor)
    const target = event.target;
    const tagName = target.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return;
    }

    // Check against all registered shortcuts
    for (const [, entry] of shortcutMap) {
      if (eventMatchesShortcut(event, entry.parsed)) {
        event.preventDefault();
        event.stopPropagation();
        executeCommand(entry.commandId);
        return;
      }
    }
  };

  document.addEventListener('keydown', keydownHandler, { capture: true });
  isListening = true;
}

/**
 * Stop listening for keyboard shortcuts.
 */
export function stopListening() {
  if (!isListening || !keydownHandler) return;

  document.removeEventListener('keydown', keydownHandler, { capture: true });
  keydownHandler = null;
  isListening = false;
}

/**
 * Get the display string for a shortcut, adjusted for platform.
 * e.g., "Ctrl+B" → "⌘B" on macOS.
 * @param {string} shortcutStr
 * @returns {string}
 */
export function formatShortcutForDisplay(shortcutStr) {
  if (!shortcutStr) return '';

  if (isMac) {
    return shortcutStr
      .replace(/Ctrl\+/gi, '⌘')
      .replace(/Alt\+/gi, '⌥')
      .replace(/Shift\+/gi, '⇧')
      .replace(/Meta\+/gi, '⌃');
  }

  return shortcutStr;
}
