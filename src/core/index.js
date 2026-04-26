/**
 * LibreMD — Core Index
 *
 * Main entry point for all core logic.
 * Initializes all subsystems in the correct order.
 * The UI layer imports from here — never from individual modules directly.
 */

// Re-export everything for clean imports
export * as Store from './store/index.js';
export * as Editor from './editor/index.js';
export * as Renderer from './renderer/index.js';
export * as Themes from './themes/index.js';
export * as Commands from './commands/index.js';
export * as Shortcuts from './shortcuts/index.js';
export * as I18n from './i18n/index.js';
export * as EventBus from './events.js';
export { Events } from './events.js';

// ── App Initialization ─────────────────────────────────────────────

import { registerDefaultCommands } from './commands/index.js';
import { rebuildShortcutMap, startListening } from './shortcuts/index.js';
import { applyTheme } from './themes/index.js';
import { createDocument } from './store/index.js';
import { detectLocale } from './i18n/index.js';
import { initFileOps } from './file-ops.js';
import { emit, Events } from './events.js';

/**
 * Initialize the LibreMD core.
 * Call this once when the app starts, BEFORE mounting any UI.
 *
 * @param {object} [options]
 * @param {string} [options.theme='dark-default'] - Initial theme ID
 * @param {string} [options.initialContent] - Content for the first document
 */
export async function initCore(options = {}) {
  const { theme = 'dark-default', initialContent } = options;

  // 1. Detect user's locale
  detectLocale();

  // 2. Register all commands
  registerDefaultCommands();

  // 3. Build shortcut map from commands
  rebuildShortcutMap();

  // 4. Start listening for keyboard shortcuts
  startListening();

  // 5. Apply initial theme
  applyTheme(theme);

  // 6. Initialize file operations (Tauri or browser fallback)
  await initFileOps();

  // 7. Create first document
  createDocument({ content: initialContent || getWelcomeContent() });

  // 8. Signal that core is ready
  emit(Events.APP_READY, { theme });

  console.log('[LibreMD] Core initialized');
}

/**
 * Welcome content shown when the app opens with no file.
 */
function getWelcomeContent() {
  return `# Welcome to LibreMD

A lightweight, cross-platform Markdown editor.

## Getting Started

- **Bold** text with \`Ctrl+B\`
- *Italic* text with \`Ctrl+I\`
- Open the Command Palette with \`Ctrl+Shift+P\`
- Cycle themes with \`Ctrl+Shift+T\`

## Features

- [x] Split view with live preview
- [x] Multiple editor modes (Split, Source, Preview, Zen)
- [x] Theme engine (Dark, Light, Sepia)
- [x] GFM support (tables, task lists, code blocks)
- [x] Visual table editor — click the table button in the toolbar
- [x] Image insertion — drag & drop or use the image button
- [x] Export to HTML
- [x] Export to PDF (text-based; for images, use Export HTML → Print to PDF)

## Export Note

PDF export renders text content natively. If your document contains images, use **Export as HTML** and print to PDF from your browser for best results.

## Example Table

| Feature | Status |
| --- | --- |
| Editor | ✅ Ready |
| Preview | ✅ Ready |
| Themes | ✅ Ready |
| Tables | ✅ Ready |
| Images | ✅ Ready |
| Export HTML | ✅ Ready |
| Export PDF | ✅ Text only |

## Code Block

\`\`\`javascript
function hello() {
  console.log("Welcome to LibreMD!");
}
\`\`\`

> "The best Markdown editor is the one that gets out of your way."

---

*Start typing or open a file to begin.*
`;
}
