/**
 * LibreMD — Store Index
 *
 * Re-exports all store modules for clean imports.
 */

export {
  createDocument,
  updateContent,
  markSaved,
  closeDocument,
  setActiveDocument as switchToDocument,
  setActiveDocument,
  getActiveDocument,
  getDocument,
  getAllDocuments,
  getActiveDocumentId,
  hasUnsavedDocuments,
  getDocumentCount,
} from './document-store.js';
