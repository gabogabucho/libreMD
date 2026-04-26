/**
 * LibreMD — Editor Manager
 *
 * Creates and manages CodeMirror 6 instances.
 * Pure logic — receives a DOM element from the UI layer but does NOT create it.
 *
 * Responsibilities:
 *   - Create/destroy CodeMirror editor views
 *   - Configure extensions (markdown, keybindings, themes)
 *   - Sync content changes to the document store via EventBus
 *   - Handle editor modes (source, split, wysiwyg, zen)
 */

import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

import { emit, on, Events } from '../events.js';
import { updateContent, getActiveDocument } from '../store/index.js';

// ── Editor Modes ───────────────────────────────────────────────────

export const EditorMode = {
  SOURCE: 'source',
  SPLIT: 'split',
  WYSIWYG: 'wysiwyg',
  ZEN: 'zen',
};

// ── State ──────────────────────────────────────────────────────────

/** @type {EditorView|null} */
let editorView = null;

/** @type {string} */
let currentMode = EditorMode.SPLIT;

/** @type {string|null} Current document ID bound to the editor */
let boundDocId = null;

/** @type {boolean} Prevents circular updates */
let suppressNextUpdate = false;

// ── Theme Compartment (for live theme switching) ───────────────────

import { Compartment } from '@codemirror/state';

const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

// ── Base Theme ─────────────────────────────────────────────────────

function createBaseTheme() {
  return EditorView.theme({
    '&': {
      height: '100%',
      fontSize: 'var(--editor-font-size, 15px)',
      fontFamily: 'var(--editor-font-family, "Inter", system-ui, sans-serif)',
    },
    '.cm-content': {
      fontFamily: 'var(--editor-font-family, "Inter", system-ui, sans-serif)',
      padding: '16px 0',
      caretColor: 'var(--editor-caret-color, #528bff)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--editor-caret-color, #528bff)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--editor-gutter-bg, transparent)',
      color: 'var(--editor-gutter-color, #636d83)',
      border: 'none',
      paddingRight: '8px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--editor-gutter-active-color, #abb2bf)',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--editor-active-line-bg, rgba(255,255,255,0.04))',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'var(--editor-selection-match-bg, rgba(82, 139, 255, 0.15))',
    },
    '.cm-scroller': {
      overflow: 'auto',
      lineHeight: 'var(--editor-line-height, 1.7)',
    },
    '.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--editor-selection-bg, rgba(82, 139, 255, 0.25))',
    },
    '.cm-panels': {
      backgroundColor: 'var(--editor-panel-bg, #21252b)',
      color: 'var(--editor-panel-color, #abb2bf)',
    },
    // Markdown-specific styling
    '.cm-header-1': { fontSize: '1.8em', fontWeight: '700' },
    '.cm-header-2': { fontSize: '1.5em', fontWeight: '600' },
    '.cm-header-3': { fontSize: '1.25em', fontWeight: '600' },
    '.cm-header-4': { fontSize: '1.1em', fontWeight: '600' },
    '.cm-strong': { fontWeight: '700' },
    '.cm-emphasis': { fontStyle: 'italic' },
    '.cm-strikethrough': { textDecoration: 'line-through' },
    '.cm-url': { color: 'var(--editor-link-color, #61afef)', textDecoration: 'underline' },
  });
}

// ── Extensions ─────────────────────────────────────────────────────

function createExtensions() {
  return [
    // Core
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    foldGutter(),
    highlightSelectionMatches(),
    history(),
    autocompletion(),

    // Syntax highlighting
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

    // Markdown language with nested code block highlighting
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),

    // Keymaps
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),

    // Theme
    themeCompartment.of(createBaseTheme()),

    // Read-only compartment (for preview modes)
    readOnlyCompartment.of(EditorState.readOnly.of(false)),

    // Change listener — sync to store
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !suppressNextUpdate) {
        const content = update.state.doc.toString();
        const cursorPos = update.state.selection.main.head;

        if (boundDocId) {
          updateContent(boundDocId, content, { cursorPos });
        }
      }

      // Emit selection changes for toolbar state (bold active, etc.)
      if (update.selectionSet) {
        const { from, to } = update.state.selection.main;
        emit(Events.EDITOR_SELECTION_CHANGED, { from, to });
      }
    }),

    EditorView.domEventHandlers({
      dragover(event, view) {
        if (!hasImageFiles(event.dataTransfer)) return false;
        event.preventDefault();
        view.dom.classList.add('cm-editor--image-drop-target');
        return true;
      },
      dragleave(event, view) {
        if (!hasImageFiles(event.dataTransfer)) return false;
        if (!view.dom.contains(event.relatedTarget)) {
          view.dom.classList.remove('cm-editor--image-drop-target');
        }
        return false;
      },
      drop(event, view) {
        const files = getImageFilesFromDataTransfer(event.dataTransfer);
        if (files.length === 0) return false;

        event.preventDefault();
        event.stopPropagation();
        view.dom.classList.remove('cm-editor--image-drop-target');

        const position = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length;
        emit(Events.EDITOR_IMAGE_DROPPED, { files, position });
        return true;
      },
    }),
  ];
}

function hasImageFiles(dataTransfer) {
  if (!dataTransfer) return false;
  return getImageFilesFromDataTransfer(dataTransfer).length > 0;
}

function getImageFilesFromDataTransfer(dataTransfer) {
  const files = [];
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (const file of dataTransfer.files) {
      if (file.type.startsWith('image/')) files.push(file);
    }
  }
  if (files.length === 0 && dataTransfer.items) {
    for (const item of dataTransfer.items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  return files;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Initialize the editor inside a container element.
 * @param {HTMLElement} container - DOM element to mount into
 * @param {string} [initialContent=''] - Starting content
 * @returns {EditorView}
 */
export function createEditor(container, initialContent = '') {
  if (editorView) {
    destroyEditor();
  }

  const state = EditorState.create({
    doc: initialContent,
    extensions: createExtensions(),
  });

  editorView = new EditorView({
    state,
    parent: container,
  });

  emit(Events.EDITOR_READY, { mode: currentMode });
  return editorView;
}

/**
 * Destroy the current editor instance.
 */
export function destroyEditor() {
  if (editorView) {
    editorView.destroy();
    editorView = null;
    boundDocId = null;
  }
}

/**
 * Bind the editor to a document from the store.
 * Loads content and sets up sync.
 * @param {string} docId - Document ID to bind to
 */
export function bindToDocument(docId) {
  const doc = getActiveDocument();
  if (!doc || doc.id !== docId) return;

  boundDocId = docId;

  // Replace editor content without triggering store update
  suppressNextUpdate = true;
  if (editorView) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: doc.content,
      },
    });

    // Restore cursor position
    if (doc.cursorPos <= doc.content.length) {
      editorView.dispatch({
        selection: { anchor: doc.cursorPos },
      });
    }
  }
  suppressNextUpdate = false;
}

/**
 * Get the current editor content.
 * @returns {string}
 */
export function getContent() {
  if (!editorView) return '';
  return editorView.state.doc.toString();
}

/**
 * Set editor content programmatically (e.g., from file open).
 * @param {string} content
 */
export function setContent(content) {
  if (!editorView) return;

  suppressNextUpdate = true;
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: content,
    },
  });
  suppressNextUpdate = false;
}

/**
 * Insert text at the current cursor position.
 * @param {string} text
 */
export function insertAtCursor(text) {
  if (!editorView) return;

  const { from, to } = editorView.state.selection.main;
  editorView.dispatch({
    changes: { from, to, insert: text },
  });
  editorView.focus();
}

/**
 * Replace a document range and move the cursor.
 * @param {number} from
 * @param {number} to
 * @param {string} text
 * @param {{ anchor?: number, head?: number }} [selection]
 */
export function replaceRange(from, to, text, selection = {}) {
  if (!editorView) return;

  const anchor = selection.anchor ?? from + text.length;
  const head = selection.head ?? anchor;

  editorView.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor, head },
  });
  editorView.focus();
}

/**
 * Wrap selected text with prefix/suffix (e.g., bold: **text**).
 * If no selection, inserts prefix+suffix and places cursor between them.
 * @param {string} prefix
 * @param {string} suffix
 */
export function wrapSelection(prefix, suffix) {
  if (!editorView) return;

  const { from, to } = editorView.state.selection.main;
  const selected = editorView.state.sliceDoc(from, to);

  if (selected.length > 0) {
    editorView.dispatch({
      changes: { from, to, insert: `${prefix}${selected}${suffix}` },
      selection: { anchor: from + prefix.length, head: to + prefix.length },
    });
  } else {
    editorView.dispatch({
      changes: { from, to, insert: `${prefix}${suffix}` },
      selection: { anchor: from + prefix.length },
    });
  }
  editorView.focus();
}

/**
 * Insert a line prefix at the beginning of the current line (e.g., "## ").
 * @param {string} prefix
 */
export function insertLinePrefix(prefix) {
  if (!editorView) return;

  const { from } = editorView.state.selection.main;
  const line = editorView.state.doc.lineAt(from);

  editorView.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
  });
  editorView.focus();
}

/**
 * Set the current editor mode.
 * @param {string} mode - One of EditorMode values
 */
export function setEditorMode(mode) {
  if (!Object.values(EditorMode).includes(mode)) {
    console.warn(`[Editor] Unknown mode: ${mode}`);
    return;
  }

  currentMode = mode;

  // Zen mode = no line numbers, no gutter
  // WYSIWYG = could be read-only for preview (future)
  // These will be extended as modes are fully implemented

  emit(Events.EDITOR_MODE_CHANGED, { mode });
}

/**
 * Get the current editor mode.
 * @returns {string}
 */
export function getEditorMode() {
  return currentMode;
}

/**
 * Focus the editor.
 */
export function focusEditor() {
  if (editorView) editorView.focus();
}

/**
 * Get the raw EditorView instance (escape hatch for advanced usage).
 * @returns {EditorView|null}
 */
export function getEditorView() {
  return editorView;
}

// ── Event Subscriptions ────────────────────────────────────────────

// When a document is switched, rebind the editor
on(Events.DOCUMENT_SWITCHED, (doc) => {
  if (editorView && doc) {
    bindToDocument(doc.id);
  }
});
