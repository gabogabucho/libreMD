/**
 * LibreMD — Theme Engine
 *
 * Manages application themes via CSS custom properties.
 * Themes are plain JSON objects — no CSS files, no build step.
 * Switching themes = updating CSS custom properties on :root.
 *
 * Architecture:
 *   Theme definition (JSON) → CSS custom properties → UI renders
 *   Theme engine ← EventBus → UI (theme picker, etc.)
 */

import { emit, Events } from '../events.js';

// ── Theme Schema ───────────────────────────────────────────────────

/**
 * @typedef {object} ThemeDefinition
 * @property {string} id - Unique theme ID
 * @property {string} name - Display name
 * @property {string} type - 'light' | 'dark' | 'sepia'
 * @property {object} colors - Color tokens
 */

// ── Built-in Themes ────────────────────────────────────────────────

const builtinThemes = {
  'dark-default': {
    id: 'dark-default',
    name: 'Dark',
    type: 'dark',
    colors: {
      // App chrome
      '--app-bg': '#1e1e2e',
      '--app-bg-secondary': '#181825',
      '--app-surface': '#252536',
      '--app-border': '#313244',
      '--app-text': '#cdd6f4',
      '--app-text-secondary': '#a6adc8',
      '--app-text-muted': '#6c7086',
      '--app-accent': '#89b4fa',
      '--app-accent-hover': '#74c7ec',
      '--app-accent-text': '#1e1e2e',

      // Editor
      '--editor-bg': '#1e1e2e',
      '--editor-font-size': '15px',
      '--editor-font-family': '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      '--editor-line-height': '1.7',
      '--editor-caret-color': '#89b4fa',
      '--editor-gutter-bg': 'transparent',
      '--editor-gutter-color': '#6c7086',
      '--editor-gutter-active-color': '#a6adc8',
      '--editor-active-line-bg': 'rgba(255, 255, 255, 0.04)',
      '--editor-selection-bg': 'rgba(137, 180, 250, 0.2)',
      '--editor-selection-match-bg': 'rgba(137, 180, 250, 0.1)',
      '--editor-link-color': '#89b4fa',

      // Preview
      '--preview-bg': '#1e1e2e',
      '--preview-text': '#cdd6f4',
      '--preview-heading-color': '#cdd6f4',
      '--preview-link-color': '#89b4fa',
      '--preview-code-bg': '#313244',
      '--preview-code-text': '#f38ba8',
      '--preview-blockquote-border': '#89b4fa',
      '--preview-blockquote-bg': 'rgba(137, 180, 250, 0.06)',
      '--preview-table-border': '#313244',
      '--preview-table-header-bg': '#252536',
      '--preview-hr-color': '#313244',

      // Toolbar
      '--toolbar-bg': '#181825',
      '--toolbar-border': '#313244',
      '--toolbar-button-hover': 'rgba(137, 180, 250, 0.12)',
      '--toolbar-button-active': 'rgba(137, 180, 250, 0.2)',

      // Sidebar
      '--sidebar-bg': '#181825',
      '--sidebar-border': '#313244',

      // Status bar
      '--statusbar-bg': '#181825',
      '--statusbar-text': '#6c7086',
    },
  },

  'light-default': {
    id: 'light-default',
    name: 'Light',
    type: 'light',
    colors: {
      '--app-bg': '#ffffff',
      '--app-bg-secondary': '#f5f5f7',
      '--app-surface': '#ffffff',
      '--app-border': '#e5e5e7',
      '--app-text': '#1d1d1f',
      '--app-text-secondary': '#424245',
      '--app-text-muted': '#86868b',
      '--app-accent': '#0071e3',
      '--app-accent-hover': '#0077ED',
      '--app-accent-text': '#ffffff',

      '--editor-bg': '#ffffff',
      '--editor-font-size': '15px',
      '--editor-font-family': '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      '--editor-line-height': '1.7',
      '--editor-caret-color': '#0071e3',
      '--editor-gutter-bg': 'transparent',
      '--editor-gutter-color': '#86868b',
      '--editor-gutter-active-color': '#424245',
      '--editor-active-line-bg': 'rgba(0, 0, 0, 0.03)',
      '--editor-selection-bg': 'rgba(0, 113, 227, 0.15)',
      '--editor-selection-match-bg': 'rgba(0, 113, 227, 0.08)',
      '--editor-link-color': '#0071e3',

      '--preview-bg': '#ffffff',
      '--preview-text': '#1d1d1f',
      '--preview-heading-color': '#1d1d1f',
      '--preview-link-color': '#0071e3',
      '--preview-code-bg': '#f5f5f7',
      '--preview-code-text': '#d63384',
      '--preview-blockquote-border': '#0071e3',
      '--preview-blockquote-bg': 'rgba(0, 113, 227, 0.04)',
      '--preview-table-border': '#e5e5e7',
      '--preview-table-header-bg': '#f5f5f7',
      '--preview-hr-color': '#e5e5e7',

      '--toolbar-bg': '#f5f5f7',
      '--toolbar-border': '#e5e5e7',
      '--toolbar-button-hover': 'rgba(0, 113, 227, 0.08)',
      '--toolbar-button-active': 'rgba(0, 113, 227, 0.15)',

      '--sidebar-bg': '#f5f5f7',
      '--sidebar-border': '#e5e5e7',

      '--statusbar-bg': '#f5f5f7',
      '--statusbar-text': '#86868b',
    },
  },

  'sepia': {
    id: 'sepia',
    name: 'Sepia',
    type: 'sepia',
    colors: {
      '--app-bg': '#f4ecd8',
      '--app-bg-secondary': '#ede3cb',
      '--app-surface': '#f4ecd8',
      '--app-border': '#d5c9a4',
      '--app-text': '#433422',
      '--app-text-secondary': '#5c4a32',
      '--app-text-muted': '#8a7558',
      '--app-accent': '#9b6b2f',
      '--app-accent-hover': '#b07a35',
      '--app-accent-text': '#ffffff',

      '--editor-bg': '#f4ecd8',
      '--editor-font-size': '15px',
      '--editor-font-family': '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      '--editor-line-height': '1.7',
      '--editor-caret-color': '#9b6b2f',
      '--editor-gutter-bg': 'transparent',
      '--editor-gutter-color': '#8a7558',
      '--editor-gutter-active-color': '#5c4a32',
      '--editor-active-line-bg': 'rgba(0, 0, 0, 0.04)',
      '--editor-selection-bg': 'rgba(155, 107, 47, 0.2)',
      '--editor-selection-match-bg': 'rgba(155, 107, 47, 0.1)',
      '--editor-link-color': '#9b6b2f',

      '--preview-bg': '#f4ecd8',
      '--preview-text': '#433422',
      '--preview-heading-color': '#433422',
      '--preview-link-color': '#9b6b2f',
      '--preview-code-bg': '#ede3cb',
      '--preview-code-text': '#9b4d2f',
      '--preview-blockquote-border': '#9b6b2f',
      '--preview-blockquote-bg': 'rgba(155, 107, 47, 0.08)',
      '--preview-table-border': '#d5c9a4',
      '--preview-table-header-bg': '#ede3cb',
      '--preview-hr-color': '#d5c9a4',

      '--toolbar-bg': '#ede3cb',
      '--toolbar-border': '#d5c9a4',
      '--toolbar-button-hover': 'rgba(155, 107, 47, 0.1)',
      '--toolbar-button-active': 'rgba(155, 107, 47, 0.18)',

      '--sidebar-bg': '#ede3cb',
      '--sidebar-border': '#d5c9a4',

      '--statusbar-bg': '#ede3cb',
      '--statusbar-text': '#8a7558',
    },
  },
};

// ── State ──────────────────────────────────────────────────────────

/** @type {Map<string, ThemeDefinition>} All registered themes */
const themes = new Map();

/** @type {string} Current active theme ID */
let activeThemeId = 'dark-default';

// Register built-ins
for (const [id, theme] of Object.entries(builtinThemes)) {
  themes.set(id, theme);
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Apply a theme by ID. Sets CSS custom properties on :root.
 * @param {string} themeId
 */
export function applyTheme(themeId) {
  const theme = themes.get(themeId);
  if (!theme) {
    console.warn(`[Theme] Theme "${themeId}" not found`);
    return;
  }

  const root = document.documentElement;

  // Apply all CSS custom properties
  for (const [prop, value] of Object.entries(theme.colors)) {
    root.style.setProperty(prop, value);
  }

  // Set data-theme attribute for CSS selectors
  root.setAttribute('data-theme', theme.type);

  activeThemeId = themeId;
  emit(Events.THEME_CHANGED, { id: themeId, name: theme.name, type: theme.type });
}

/**
 * Get the current active theme.
 * @returns {ThemeDefinition}
 */
export function getActiveTheme() {
  return themes.get(activeThemeId);
}

/**
 * Get the active theme ID.
 * @returns {string}
 */
export function getActiveThemeId() {
  return activeThemeId;
}

/**
 * Get all available themes.
 * @returns {ThemeDefinition[]}
 */
export function getAllThemes() {
  return Array.from(themes.values());
}

/**
 * Register a custom theme.
 * @param {ThemeDefinition} theme
 */
export function registerTheme(theme) {
  if (!theme.id || !theme.name || !theme.colors) {
    console.warn('[Theme] Invalid theme definition:', theme);
    return;
  }

  themes.set(theme.id, theme);
  emit(Events.THEME_LIST_UPDATED, getAllThemes());
}

/**
 * Remove a custom theme (cannot remove built-ins).
 * @param {string} themeId
 */
export function removeTheme(themeId) {
  if (builtinThemes[themeId]) {
    console.warn(`[Theme] Cannot remove built-in theme: ${themeId}`);
    return;
  }

  themes.delete(themeId);

  // Switch to default if we removed the active theme
  if (activeThemeId === themeId) {
    applyTheme('dark-default');
  }

  emit(Events.THEME_LIST_UPDATED, getAllThemes());
}

/**
 * Cycle through themes: dark → light → sepia → dark...
 */
export function cycleTheme() {
  const order = ['dark-default', 'light-default', 'sepia'];
  const currentIndex = order.indexOf(activeThemeId);
  const nextIndex = (currentIndex + 1) % order.length;
  applyTheme(order[nextIndex]);
}

/**
 * Export a theme as JSON string (for sharing).
 * @param {string} themeId
 * @returns {string|null}
 */
export function exportTheme(themeId) {
  const theme = themes.get(themeId);
  if (!theme) return null;
  return JSON.stringify(theme, null, 2);
}

/**
 * Import a theme from JSON string.
 * @param {string} json
 * @returns {ThemeDefinition|null}
 */
export function importTheme(json) {
  try {
    const theme = JSON.parse(json);
    if (!theme.id || !theme.name || !theme.colors) {
      console.warn('[Theme] Invalid theme JSON');
      return null;
    }
    registerTheme(theme);
    return theme;
  } catch (err) {
    console.error('[Theme] Failed to parse theme JSON:', err);
    return null;
  }
}
