/**
 * LibreMD — Editor Index
 */

export {
  EditorMode,
  createEditor,
  destroyEditor,
  bindToDocument,
  getContent,
  setContent,
  insertAtCursor,
  replaceRange,
  wrapSelection,
  insertLinePrefix,
  setEditorMode,
  getEditorMode,
  focusEditor,
  getEditorView,
} from './editor-manager.js';

export {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  insertCodeBlock,
  insertHeading,
  insertBlockquote,
  insertUnorderedList,
  insertOrderedList,
  insertTaskList,
  insertHorizontalRule,
  insertLink,
  insertImage,
  insertTable,
  buildMarkdownTable,
} from './formatting.js';
