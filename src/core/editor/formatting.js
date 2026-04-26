/**
 * LibreMD — Markdown Formatting Commands
 *
 * High-level formatting operations that wrap the editor manager.
 * These are the actions triggered by toolbar buttons and keyboard shortcuts.
 */

import { wrapSelection, insertAtCursor, insertLinePrefix, getEditorView } from './editor-manager.js';
import { emit, Events } from '../events.js';

/**
 * Toggle bold on selection: **text**
 */
export function toggleBold() {
  wrapSelection('**', '**');
}

/**
 * Toggle italic on selection: *text*
 */
export function toggleItalic() {
  wrapSelection('*', '*');
}

/**
 * Toggle strikethrough on selection: ~~text~~
 */
export function toggleStrikethrough() {
  wrapSelection('~~', '~~');
}

/**
 * Toggle inline code on selection: `text`
 */
export function toggleInlineCode() {
  wrapSelection('`', '`');
}

/**
 * Insert a code block with optional language.
 * @param {string} [lang=''] - Language identifier
 */
export function insertCodeBlock(lang = '') {
  insertAtCursor(`\n\`\`\`${lang}\n\n\`\`\`\n`);
}

/**
 * Insert a heading at the current line.
 * @param {number} level - 1-6
 */
export function insertHeading(level) {
  const prefix = '#'.repeat(Math.min(Math.max(level, 1), 6)) + ' ';
  insertLinePrefix(prefix);
}

/**
 * Insert a blockquote prefix at the current line.
 */
export function insertBlockquote() {
  insertLinePrefix('> ');
}

/**
 * Insert an unordered list item prefix.
 */
export function insertUnorderedList() {
  insertLinePrefix('- ');
}

/**
 * Insert an ordered list item prefix.
 */
export function insertOrderedList() {
  insertLinePrefix('1. ');
}

/**
 * Insert a task list item.
 */
export function insertTaskList() {
  insertLinePrefix('- [ ] ');
}

/**
 * Insert a horizontal rule.
 */
export function insertHorizontalRule() {
  insertAtCursor('\n---\n');
}

/**
 * Insert a link template.
 * Uses selected text as link text if available.
 */
export function insertLink() {
  const view = getEditorView();
  if (!view) return;

  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected.length > 0) {
    const replacement = `[${selected}](url)`;
    view.dispatch({
      changes: { from, to, insert: replacement },
      // Place cursor on "url" for easy replacement
      selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
    });
  } else {
    insertAtCursor('[link text](url)');
  }
}

/**
 * Insert an image template.
 */
export function insertImage() {
  const view = getEditorView();
  if (!view) return;

  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  emit(Events.UI_IMAGE_PICKER_OPEN, {
    altText: selected.length > 0 ? selected : '',
    from,
    to,
  });
}

/**
 * Insert a basic table template.
 * @param {number} [cols=3] - Number of columns
 * @param {number} [rows=3] - Number of rows (including header)
 */
export function insertTable(cols = 3, rows = 3) {
  const view = getEditorView();
  if (!view) return;

  const existingTable = findTableNearCursor(view);
  emit(Events.UI_TABLE_EDITOR_OPEN, existingTable ?? {
    table: createDefaultTableModel(cols, rows),
    range: view.state.selection.main,
  });
}

function createDefaultTableModel(cols = 3, rows = 3) {
  return {
    headers: Array.from({ length: cols }, (_, index) => `Header ${index + 1}`),
    rows: Array.from({ length: Math.max(rows - 1, 1) }, () => Array.from({ length: cols }, () => '')),
  };
}

function findTableNearCursor(view) {
  const { head } = view.state.selection.main;
  const currentLine = view.state.doc.lineAt(head);

  if (!isPipeTableLine(currentLine.text)) {
    return null;
  }

  let startLineNo = currentLine.number;
  let endLineNo = currentLine.number;

  while (startLineNo > 1) {
    const previous = view.state.doc.line(startLineNo - 1);
    if (!isPipeTableLine(previous.text)) break;
    startLineNo -= 1;
  }

  while (endLineNo < view.state.doc.lines) {
    const next = view.state.doc.line(endLineNo + 1);
    if (!isPipeTableLine(next.text)) break;
    endLineNo += 1;
  }

  const startLine = view.state.doc.line(startLineNo);
  const endLine = view.state.doc.line(endLineNo);
  const lines = [];

  for (let lineNo = startLineNo; lineNo <= endLineNo; lineNo += 1) {
    lines.push(view.state.doc.line(lineNo).text);
  }

  const parsed = parseMarkdownTable(lines);
  if (!parsed) return null;

  return {
    table: parsed,
    range: { from: startLine.from, to: endLine.to },
  };
}

function parseMarkdownTable(lines) {
  if (lines.length < 2) return null;

  const header = splitTableRow(lines[0]);
  const separator = splitTableRow(lines[1]);
  if (header.length === 0 || separator.length !== header.length || !separator.every(isSeparatorCell)) {
    return null;
  }

  const rows = [];
  for (const line of lines.slice(2)) {
    const row = splitTableRow(line);
    if (row.length !== header.length) return null;
    rows.push(row);
  }

  return { headers: header, rows };
}

function splitTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return [];

  return trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorCell(cell) {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function isPipeTableLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
}

function escapeTableCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

export function buildMarkdownTable(table) {
  const headers = Array.isArray(table?.headers) && table.headers.length > 0
    ? table.headers
    : ['Header 1'];
  const columnCount = headers.length;
  const rows = Array.isArray(table?.rows) ? table.rows : [];

  const normalizedRows = rows.map((row) => Array.from({ length: columnCount }, (_, index) => row?.[index] ?? ''));
  const headerLine = `| ${headers.map(escapeTableCell).join(' | ')} |`;
  const separatorLine = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;
  const bodyLines = normalizedRows.length > 0
    ? normalizedRows.map((row) => `| ${row.map(escapeTableCell).join(' | ')} |`)
    : [`| ${Array.from({ length: columnCount }, () => '').join(' | ')} |`];

  return [headerLine, separatorLine, ...bodyLines].join('\n');
}
