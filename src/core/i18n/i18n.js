/**
 * LibreMD — i18n (Internationalization)
 *
 * Simple, zero-dependency translation system.
 * Translations are plain objects keyed by dotted paths.
 * Supports interpolation: t('greeting', { name: 'Gabo' }) → "Hello, Gabo"
 *
 * Architecture:
 *   Locale files (JSON objects) → i18n engine → UI reads via t()
 *   i18n engine → EventBus → UI re-renders on locale change
 */

import { emit, Events } from '../events.js';

// ── Locale Definitions ─────────────────────────────────────────────

const locales = {
  en: {
    app: {
      name: 'LibreMD',
      tagline: 'A lightweight, cross-platform Markdown editor',
      commandPalette: 'Command Palette',
    },
    menu: {
      file: 'File',
      edit: 'Edit',
      view: 'View',
      help: 'Help',
    },
    file: {
      new: 'New Document',
      open: 'Open File...',
      save: 'Save',
      saveAs: 'Save As...',
      export: 'Export',
      exportPdf: 'Export as PDF',
      exportHtml: 'Export as HTML',
      close: 'Close',
      closeTab: 'Close Tab',
    },
    editor: {
      bold: 'Bold',
      italic: 'Italic',
      strikethrough: 'Strikethrough',
      inlineCode: 'Inline Code',
      codeBlock: 'Code Block',
      heading1: 'Heading 1',
      heading2: 'Heading 2',
      heading3: 'Heading 3',
      heading4: 'Heading 4',
      heading: 'Heading',
      blockquote: 'Blockquote',
      bulletList: 'Bullet List',
      numberedList: 'Numbered List',
      taskList: 'Task List',
      horizontalRule: 'Horizontal Rule',
      link: 'Insert Link',
      image: 'Insert Image',
      table: 'Insert Table',
    },
    view: {
      splitMode: 'Split View',
      sourceMode: 'Source View',
      wysiwygMode: 'WYSIWYG View',
      zenMode: 'Zen Mode',
      toggleSidebar: 'Toggle Sidebar',
      cycleTheme: 'Cycle Theme',
    },
    sidebar: {
      outline: 'Outline',
      noHeadings: 'No headings found',
    },
    statusBar: {
      words: '{count} words',
      chars: '{count} chars',
      readTime: '~{count} min read',
      line: 'Ln {ln}, Col {col}',
      unsaved: 'Unsaved changes',
      untitled: 'Untitled',
    },
    commandPalette: {
      placeholder: 'Type a command...',
      noResults: 'No commands found',
    },
    export: {
      html: 'Export as HTML',
      pdf: 'Export as PDF',
      copyHtml: 'Copy HTML to Clipboard',
    },
    help: {
      about: 'About LibreMD',
      shortcuts: 'Keyboard Shortcuts',
    },
    dialog: {
      unsavedTitle: 'Unsaved Changes',
      unsavedMessage: 'Do you want to save changes before closing?',
      save: 'Save',
      dontSave: "Don't Save",
      cancel: 'Cancel',
    },
    welcome: {
      title: 'Welcome to LibreMD',
      subtitle: 'A lightweight, cross-platform Markdown editor.',
      gettingStarted: 'Getting Started',
      boldHint: '**Bold** text with `Ctrl+B`',
      italicHint: '*Italic* text with `Ctrl+I`',
      paletteHint: 'Open the Command Palette with `Ctrl+Shift+P`',
      themeHint: 'Cycle themes with `Ctrl+Shift+T`',
    },
    theme: {
      dark: 'Dark',
      light: 'Light',
      sepia: 'Sepia',
    },
    category: {
      File: 'File',
      Editor: 'Editor',
      View: 'View',
      Export: 'Export',
      Help: 'Help',
      App: 'App',
    }
  },

  es: {
    app: {
      name: 'LibreMD',
      tagline: 'Un editor Markdown visual, ligero y multiplataforma',
      commandPalette: 'Paleta de Comandos',
    },
    menu: {
      file: 'Archivo',
      edit: 'Editar',
      view: 'Vista',
      help: 'Ayuda',
    },
    file: {
      new: 'Nuevo documento',
      open: 'Abrir archivo...',
      save: 'Guardar',
      saveAs: 'Guardar como...',
      export: 'Exportar',
      exportPdf: 'Exportar como PDF',
      exportHtml: 'Exportar como HTML',
      close: 'Cerrar',
      closeTab: 'Cerrar pestaña',
    },
    editor: {
      bold: 'Negrita',
      italic: 'Cursiva',
      strikethrough: 'Tachado',
      inlineCode: 'Código en línea',
      codeBlock: 'Bloque de código',
      heading1: 'Encabezado 1',
      heading2: 'Encabezado 2',
      heading3: 'Encabezado 3',
      heading4: 'Encabezado 4',
      heading: 'Encabezado',
      blockquote: 'Cita',
      bulletList: 'Lista con viñetas',
      numberedList: 'Lista numerada',
      taskList: 'Lista de tareas',
      horizontalRule: 'Línea horizontal',
      link: 'Insertar enlace',
      image: 'Insertar imagen',
      table: 'Insertar tabla',
    },
    view: {
      splitMode: 'Modo dividido',
      sourceMode: 'Modo código',
      wysiwygMode: 'Modo visual',
      zenMode: 'Modo Zen',
      toggleSidebar: 'Mostrar/ocultar panel lateral',
      cycleTheme: 'Cambiar tema',
    },
    sidebar: {
      outline: 'Índice',
      noHeadings: 'Sin encabezados',
    },
    statusBar: {
      words: '{count} palabras',
      chars: '{count} caracteres',
      readTime: '~{count} min lectura',
      line: 'Ln {ln}, Col {col}',
      unsaved: 'Cambios sin guardar',
      untitled: 'Sin título',
    },
    commandPalette: {
      placeholder: 'Escribe un comando...',
      noResults: 'No se encontraron comandos',
    },
    export: {
      html: 'Exportar como HTML',
      pdf: 'Exportar como PDF',
      copyHtml: 'Copiar HTML al portapapeles',
    },
    help: {
      about: 'Acerca de LibreMD',
      shortcuts: 'Atajos de teclado',
    },
    dialog: {
      unsavedTitle: 'Cambios sin guardar',
      unsavedMessage: '¿Deseas guardar los cambios antes de cerrar?',
      save: 'Guardar',
      dontSave: 'No guardar',
      cancel: 'Cancelar',
    },
    welcome: {
      title: 'Bienvenido a LibreMD',
      subtitle: 'Un editor Markdown visual, ligero y multiplataforma.',
      gettingStarted: 'Primeros pasos',
      boldHint: '**Negrita** con `Ctrl+B`',
      italicHint: '*Cursiva* con `Ctrl+I`',
      paletteHint: 'Abre la paleta de comandos con `Ctrl+Shift+P`',
      themeHint: 'Cambia el tema con `Ctrl+Shift+T`',
    },
    theme: {
      dark: 'Oscuro',
      light: 'Claro',
      sepia: 'Sepia',
    },
    category: {
      File: 'Archivo',
      Editor: 'Editor',
      View: 'Vista',
      Export: 'Exportar',
      Help: 'Ayuda',
      App: 'App',
    }
  },
};

// ── State ──────────────────────────────────────────────────────────

let currentLocale = 'en';

// ── Public API ─────────────────────────────────────────────────────

/**
 * Translate a key path with optional interpolation.
 * @param {string} key - Dotted path (e.g., 'file.save', 'statusBar.words')
 * @param {object} [params] - Interpolation values (e.g., { count: 42 })
 * @returns {string} Translated string, or the key itself if not found
 *
 * @example
 * t('file.save') → 'Guardar' (if locale is 'es')
 * t('statusBar.words', { count: 150 }) → '150 palabras'
 */
export function t(key, params = {}) {
  const value = getNestedValue(locales[currentLocale], key)
    ?? getNestedValue(locales['en'], key)  // Fallback to English
    ?? key;  // Fallback to key itself

  if (typeof value !== 'string') return key;

  // Interpolate {param} placeholders
  return value.replace(/\{(\w+)\}/g, (_, param) => {
    return params[param] !== undefined ? String(params[param]) : `{${param}}`;
  });
}

/**
 * Get the current locale.
 * @returns {string}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Set the active locale.
 * @param {string} locale - 'en' | 'es' | any registered locale
 */
export function setLocale(locale) {
  if (!locales[locale]) {
    console.warn(`[i18n] Locale "${locale}" not registered, falling back to "en"`);
    locale = 'en';
  }
  currentLocale = locale;
  emit(Events.UI_LAYOUT_CHANGED, { locale });
}

/**
 * Get all available locales.
 * @returns {{ id: string, name: string }[]}
 */
export function getAvailableLocales() {
  return [
    { id: 'en', name: 'English' },
    { id: 'es', name: 'Español' },
  ];
}

/**
 * Register a new locale or extend an existing one.
 * @param {string} localeId
 * @param {object} translations
 */
export function registerLocale(localeId, translations) {
  if (locales[localeId]) {
    locales[localeId] = deepMerge(locales[localeId], translations);
  } else {
    locales[localeId] = translations;
  }
}

/**
 * Detect browser/system locale and set it if available.
 * Falls back to 'en'.
 */
export function detectLocale() {
  const browserLang = navigator.language?.split('-')[0] || 'en';
  setLocale(locales[browserLang] ? browserLang : 'en');
}

// ── Helpers ────────────────────────────────────────────────────────

function getNestedValue(obj, path) {
  if (!obj) return undefined;
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current[key] === undefined) return undefined;
    current = current[key];
  }
  return current;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
