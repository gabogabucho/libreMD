/**
 * LibreMD — Document State Store
 *
 * Manages ALL document state: open tabs, content, dirty flags, undo history.
 * Pure state management — NO UI, NO DOM. Communicates via EventBus.
 *
 * Architecture:
 *   Store (this) ←→ EventBus ←→ UI Layer
 *   Store (this) ←→ EventBus ←→ Editor (CodeMirror)
 */

import { emit, Events } from '../events.js';

// ── Types (JSDoc) ──────────────────────────────────────────────────

/**
 * @typedef {object} DocumentState
 * @property {string} id - Unique document ID (uuid)
 * @property {string} content - Current markdown content
 * @property {string} originalContent - Content at last save (for dirty detection)
 * @property {string|null} filePath - Absolute file path (null = untitled)
 * @property {string} title - Display title (filename or "Untitled")
 * @property {boolean} dirty - Has unsaved changes
 * @property {number} cursorPos - Last cursor position
 * @property {number} scrollTop - Last scroll position
 * @property {number} createdAt - Timestamp
 * @property {number} updatedAt - Timestamp
 */

// ── State ──────────────────────────────────────────────────────────

/** @type {Map<string, DocumentState>} */
const documents = new Map();

/** @type {string|null} */
let activeDocumentId = null;

// ── Helpers ────────────────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID();
}

function titleFromPath(filePath) {
  if (!filePath) return 'Untitled';
  const segments = filePath.replace(/\\/g, '/').split('/');
  return segments[segments.length - 1];
}

function serializeDoc(doc) {
  return { ...doc };
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Create a new empty document and make it active.
 * @param {object} [options]
 * @param {string} [options.content] - Initial content
 * @param {string} [options.filePath] - File path if opening from disk
 * @returns {DocumentState}
 */
export function createDocument(options = {}) {
  const id = generateId();
  const content = options.content ?? '';
  const filePath = options.filePath ?? null;

  /** @type {DocumentState} */
  const doc = {
    id,
    content,
    originalContent: content,
    filePath,
    title: titleFromPath(filePath),
    dirty: false,
    cursorPos: 0,
    scrollTop: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  documents.set(id, doc);
  emit(Events.DOCUMENT_CREATED, serializeDoc(doc));

  setActiveDocument(id);
  return serializeDoc(doc);
}

/**
 * Update document content. Recalculates dirty state.
 * @param {string} id - Document ID
 * @param {string} content - New content
 * @param {object} [meta] - Optional metadata (cursorPos, scrollTop)
 */
export function updateContent(id, content, meta = {}) {
  const doc = documents.get(id);
  if (!doc) {
    console.warn(`[Store] updateContent: document ${id} not found`);
    return;
  }

  doc.content = content;
  doc.updatedAt = Date.now();

  if (meta.cursorPos !== undefined) doc.cursorPos = meta.cursorPos;
  if (meta.scrollTop !== undefined) doc.scrollTop = meta.scrollTop;

  const wasDirty = doc.dirty;
  doc.dirty = doc.content !== doc.originalContent;

  emit(Events.DOCUMENT_CHANGED, serializeDoc(doc));

  if (doc.dirty !== wasDirty) {
    emit(Events.DOCUMENT_DIRTY, { id, dirty: doc.dirty });
  }
}

/**
 * Mark a document as saved (resets dirty state).
 * @param {string} id
 * @param {string} [filePath] - New file path (for "Save As")
 */
export function markSaved(id, filePath) {
  const doc = documents.get(id);
  if (!doc) return;

  doc.originalContent = doc.content;
  doc.dirty = false;
  doc.updatedAt = Date.now();

  if (filePath !== undefined) {
    doc.filePath = filePath;
    doc.title = titleFromPath(filePath);
  }

  emit(Events.DOCUMENT_SAVED, serializeDoc(doc));
  emit(Events.DOCUMENT_DIRTY, { id, dirty: false });
}

/**
 * Close a document. Switches active doc if needed.
 * @param {string} id
 * @returns {{ needsSave: boolean }} Whether the doc had unsaved changes
 */
export function closeDocument(id) {
  const doc = documents.get(id);
  if (!doc) return { needsSave: false };

  const needsSave = doc.dirty;
  documents.delete(id);

  emit(Events.DOCUMENT_CLOSED, { id });

  // Switch to another document if we closed the active one
  if (activeDocumentId === id) {
    const remaining = Array.from(documents.keys());
    if (remaining.length > 0) {
      setActiveDocument(remaining[remaining.length - 1]);
    } else {
      activeDocumentId = null;
    }
  }

  return { needsSave };
}

/**
 * Set the active document (the one being edited).
 * @param {string} id
 */
export function setActiveDocument(id) {
  if (!documents.has(id)) {
    console.warn(`[Store] setActiveDocument: document ${id} not found`);
    return;
  }

  activeDocumentId = id;
  emit(Events.DOCUMENT_SWITCHED, serializeDoc(documents.get(id)));
}

/**
 * Get the current active document.
 * @returns {DocumentState|null}
 */
export function getActiveDocument() {
  if (!activeDocumentId) return null;
  const doc = documents.get(activeDocumentId);
  return doc ? serializeDoc(doc) : null;
}

/**
 * Get a document by ID.
 * @param {string} id
 * @returns {DocumentState|null}
 */
export function getDocument(id) {
  const doc = documents.get(id);
  return doc ? serializeDoc(doc) : null;
}

/**
 * Get all open documents (for tab bar rendering).
 * @returns {DocumentState[]}
 */
export function getAllDocuments() {
  return Array.from(documents.values()).map(serializeDoc);
}

/**
 * Get the active document ID.
 * @returns {string|null}
 */
export function getActiveDocumentId() {
  return activeDocumentId;
}

/**
 * Check if any document has unsaved changes.
 * @returns {boolean}
 */
export function hasUnsavedDocuments() {
  for (const doc of documents.values()) {
    if (doc.dirty) return true;
  }
  return false;
}

/**
 * Get count of open documents.
 * @returns {number}
 */
export function getDocumentCount() {
  return documents.size;
}
