/**
 * LibreMD — Event Bus
 * 
 * Lightweight pub/sub system that decouples core logic from UI.
 * The UI layer subscribes to events. The core layer emits them.
 * This is the ONLY bridge between core and UI — no direct imports.
 */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/** @type {Map<string, any>} */
const lastValues = new Map();

/**
 * Subscribe to an event. Returns an unsubscribe function.
 * @param {string} event - Event name (e.g., 'document:changed', 'theme:applied')
 * @param {Function} callback - Handler function
 * @param {object} [options] - Options
 * @param {boolean} [options.replay] - If true, immediately call with last emitted value
 * @returns {() => void} Unsubscribe function
 */
export function on(event, callback, options = {}) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  // Replay last value if requested and available
  if (options.replay && lastValues.has(event)) {
    try {
      callback(lastValues.get(event));
    } catch (err) {
      console.error(`[EventBus] Error replaying "${event}":`, err);
    }
  }

  return () => {
    const set = listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) listeners.delete(event);
    }
  };
}

/**
 * Subscribe to an event, but only fire once.
 * @param {string} event
 * @param {Function} callback
 * @returns {() => void} Unsubscribe function
 */
export function once(event, callback) {
  const unsub = on(event, (data) => {
    unsub();
    callback(data);
  });
  return unsub;
}

/**
 * Emit an event with optional data.
 * @param {string} event - Event name
 * @param {*} [data] - Payload
 */
export function emit(event, data) {
  lastValues.set(event, data);
  const set = listeners.get(event);
  if (!set) return;

  for (const callback of set) {
    try {
      callback(data);
    } catch (err) {
      console.error(`[EventBus] Error in handler for "${event}":`, err);
    }
  }
}

/**
 * Remove all listeners for a specific event, or all events.
 * @param {string} [event] - If omitted, clears everything
 */
export function clear(event) {
  if (event) {
    listeners.delete(event);
    lastValues.delete(event);
  } else {
    listeners.clear();
    lastValues.clear();
  }
}

/**
 * Debug: get count of active listeners
 * @returns {object} Map of event -> listener count
 */
export function debug() {
  const result = {};
  for (const [event, set] of listeners) {
    result[event] = set.size;
  }
  return result;
}

// ── Event Name Constants ───────────────────────────────────────────
// Centralized event names prevent typo bugs and serve as documentation.

export const Events = {
  // Document lifecycle
  DOCUMENT_CREATED: 'document:created',
  DOCUMENT_OPENED: 'document:opened',
  DOCUMENT_CHANGED: 'document:changed',
  DOCUMENT_SAVED: 'document:saved',
  DOCUMENT_CLOSED: 'document:closed',
  DOCUMENT_SWITCHED: 'document:switched',
  DOCUMENT_DIRTY: 'document:dirty',

  // Editor
  EDITOR_READY: 'editor:ready',
  EDITOR_MODE_CHANGED: 'editor:mode-changed',
  EDITOR_SELECTION_CHANGED: 'editor:selection-changed',
  EDITOR_SCROLL: 'editor:scroll',
  EDITOR_IMAGE_DROPPED: 'editor:image-dropped',

  // Rendering
  RENDER_REQUESTED: 'render:requested',
  RENDER_COMPLETE: 'render:complete',

  // Theme
  THEME_CHANGED: 'theme:changed',
  THEME_LIST_UPDATED: 'theme:list-updated',

  // Commands
  COMMAND_EXECUTED: 'command:executed',
  COMMAND_PALETTE_OPEN: 'command:palette-open',
  COMMAND_PALETTE_CLOSE: 'command:palette-close',

  // UI
  UI_SIDEBAR_TOGGLE: 'ui:sidebar-toggle',
  UI_LAYOUT_CHANGED: 'ui:layout-changed',
  UI_NOTIFICATION: 'ui:notification',
  UI_TABLE_EDITOR_OPEN: 'ui:table-editor-open',
  UI_IMAGE_PICKER_OPEN: 'ui:image-picker-open',

  // App
  APP_READY: 'app:ready',
  APP_ERROR: 'app:error',
};
