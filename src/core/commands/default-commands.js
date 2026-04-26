/**
 * LibreMD — Default Commands Registration
 *
 * Registers all built-in commands. Called once at app startup.
 * This wires together the command registry with editor operations,
 * file operations, view operations, etc.
 */

import { registerCommands } from './command-registry.js';
import {
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
  setEditorMode,
  EditorMode,
} from '../editor/index.js';
import { cycleTheme } from '../themes/index.js';
import { createDocument, closeDocument, getActiveDocumentId } from '../store/index.js';
import { emit, Events } from '../events.js';

/**
 * Register all default commands.
 * Call this once during app initialization.
 */
export function registerDefaultCommands() {
  registerCommands([
    // ── File ───────────────────────────────────────────────────────
    {
      id: 'file.new',
      label: 'New Document',
      i18nKey: 'file.new',
      category: 'File',
      shortcut: 'Ctrl+N',
      icon: 'file-plus',
      execute: () => createDocument(),
    },
    {
      id: 'file.open',
      label: 'Open File...',
      i18nKey: 'file.open',
      category: 'File',
      shortcut: 'Ctrl+O',
      icon: 'folder-open',
      execute: () => emit('file:open-dialog', {}),
    },
    {
      id: 'file.save',
      label: 'Save',
      i18nKey: 'file.save',
      category: 'File',
      shortcut: 'Ctrl+S',
      icon: 'save',
      execute: () => emit('file:save', {}),
    },
    {
      id: 'file.saveAs',
      label: 'Save As...',
      i18nKey: 'file.saveAs',
      category: 'File',
      shortcut: 'Ctrl+Shift+S',
      icon: 'save',
      execute: () => emit('file:save-as', {}),
    },
    {
      id: 'file.closeTab',
      label: 'Close Tab',
      i18nKey: 'file.closeTab',
      category: 'File',
      shortcut: 'Ctrl+W',
      icon: 'x',
      execute: () => {
        const docId = getActiveDocumentId();
        if (docId) closeDocument(docId);
      },
    },

    // ── Export ─────────────────────────────────────────────────────
    {
      id: 'export.html',
      label: 'Export as HTML',
      i18nKey: 'export.html',
      category: 'Export',
      shortcut: 'Ctrl+Shift+E',
      execute: () => emit('file:export-html', {}),
    },
    {
      id: 'export.pdf',
      label: 'Export as PDF (Print)',
      i18nKey: 'export.pdf',
      category: 'Export',
      shortcut: 'Ctrl+P',
      execute: () => emit('file:export-pdf', {}),
    },


    // ── Editor Formatting ──────────────────────────────────────────
    {
      id: 'editor.toggleBold',
      label: 'Toggle Bold',
      i18nKey: 'editor.bold',
      category: 'Editor',
      shortcut: 'Ctrl+B',
      icon: 'bold',
      execute: toggleBold,
    },
    {
      id: 'editor.toggleItalic',
      label: 'Toggle Italic',
      i18nKey: 'editor.italic',
      category: 'Editor',
      shortcut: 'Ctrl+I',
      icon: 'italic',
      execute: toggleItalic,
    },
    {
      id: 'editor.toggleStrikethrough',
      label: 'Toggle Strikethrough',
      i18nKey: 'editor.strikethrough',
      category: 'Editor',
      shortcut: 'Ctrl+Shift+X',
      icon: 'strikethrough',
      execute: toggleStrikethrough,
    },
    {
      id: 'editor.toggleInlineCode',
      label: 'Toggle Inline Code',
      i18nKey: 'editor.inlineCode',
      category: 'Editor',
      shortcut: 'Ctrl+E',
      icon: 'code',
      execute: toggleInlineCode,
    },
    {
      id: 'editor.insertCodeBlock',
      label: 'Insert Code Block',
      i18nKey: 'editor.codeBlock',
      category: 'Editor',
      shortcut: 'Ctrl+Shift+K',
      icon: 'code-block',
      execute: () => insertCodeBlock(),
    },
    {
      id: 'editor.heading1',
      label: 'Heading 1',
      i18nKey: 'editor.heading1',
      category: 'Editor',
      shortcut: 'Ctrl+1',
      execute: () => insertHeading(1),
    },
    {
      id: 'editor.heading2',
      label: 'Heading 2',
      i18nKey: 'editor.heading2',
      category: 'Editor',
      shortcut: 'Ctrl+2',
      execute: () => insertHeading(2),
    },
    {
      id: 'editor.heading3',
      label: 'Heading 3',
      i18nKey: 'editor.heading3',
      category: 'Editor',
      shortcut: 'Ctrl+3',
      execute: () => insertHeading(3),
    },
    {
      id: 'editor.heading4',
      label: 'Heading 4',
      i18nKey: 'editor.heading4',
      category: 'Editor',
      shortcut: 'Ctrl+4',
      execute: () => insertHeading(4),
    },
    {
      id: 'editor.blockquote',
      label: 'Insert Blockquote',
      i18nKey: 'editor.blockquote',
      category: 'Editor',
      shortcut: 'Ctrl+Shift+.',
      icon: 'quote',
      execute: insertBlockquote,
    },
    {
      id: 'editor.unorderedList',
      label: 'Insert Bullet List',
      i18nKey: 'editor.bulletList',
      category: 'Editor',
      icon: 'list',
      execute: insertUnorderedList,
    },
    {
      id: 'editor.orderedList',
      label: 'Insert Numbered List',
      i18nKey: 'editor.numberedList',
      category: 'Editor',
      icon: 'list-ordered',
      execute: insertOrderedList,
    },
    {
      id: 'editor.taskList',
      label: 'Insert Task List',
      i18nKey: 'editor.taskList',
      category: 'Editor',
      icon: 'check-square',
      execute: insertTaskList,
    },
    {
      id: 'editor.horizontalRule',
      label: 'Insert Horizontal Rule',
      i18nKey: 'editor.horizontalRule',
      category: 'Editor',
      execute: insertHorizontalRule,
    },
    {
      id: 'editor.link',
      label: 'Insert Link',
      i18nKey: 'editor.link',
      category: 'Editor',
      shortcut: 'Ctrl+K',
      icon: 'link',
      execute: insertLink,
    },
    {
      id: 'editor.image',
      label: 'Insert Image',
      i18nKey: 'editor.image',
      category: 'Editor',
      icon: 'image',
      execute: insertImage,
    },
    {
      id: 'editor.table',
      label: 'Insert Table',
      i18nKey: 'editor.table',
      category: 'Editor',
      icon: 'table',
      execute: () => insertTable(3, 3),
    },

    // ── View ───────────────────────────────────────────────────────
    {
      id: 'view.splitMode',
      label: 'Split Mode',
      i18nKey: 'view.splitMode',
      category: 'View',
      shortcut: 'Ctrl+Alt+1',
      execute: () => setEditorMode(EditorMode.SPLIT),
    },
    {
      id: 'view.sourceMode',
      label: 'Source Mode',
      i18nKey: 'view.sourceMode',
      category: 'View',
      shortcut: 'Ctrl+Alt+2',
      execute: () => setEditorMode(EditorMode.SOURCE),
    },
    {
      id: 'view.wysiwygMode',
      label: 'WYSIWYG Mode',
      i18nKey: 'view.wysiwygMode',
      category: 'View',
      shortcut: 'Ctrl+Alt+3',
      execute: () => setEditorMode(EditorMode.WYSIWYG),
    },
    {
      id: 'view.zenMode',
      label: 'Zen Mode',
      i18nKey: 'view.zenMode',
      category: 'View',
      shortcut: 'Ctrl+Alt+4',
      execute: () => setEditorMode(EditorMode.ZEN),
    },
    {
      id: 'view.toggleSidebar',
      label: 'Toggle Sidebar',
      i18nKey: 'view.toggleSidebar',
      category: 'View',
      shortcut: 'Ctrl+\\',
      execute: () => emit(Events.UI_SIDEBAR_TOGGLE, {}),
    },
    {
      id: 'view.cycleTheme',
      label: 'Cycle Theme',
      i18nKey: 'view.cycleTheme',
      category: 'View',
      shortcut: 'Ctrl+Shift+T',
      icon: 'palette',
      execute: cycleTheme,
    },

    // ── Command Palette ────────────────────────────────────────────
    {
      id: 'app.commandPalette',
      label: 'Command Palette',
      i18nKey: 'app.commandPalette',
      category: 'App',
      shortcut: 'Ctrl+Shift+P',
      execute: () => emit(Events.COMMAND_PALETTE_OPEN, {}),
    },

    // ── Help ───────────────────────────────────────────────────────────
    {
      id: 'help.about',
      label: 'About LibreMD',
      i18nKey: 'help.about',
      category: 'Help',
      execute: () => {
        // Trigger the about dialog
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
        
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#252536;border:1px solid #313244;border-radius:16px;padding:32px 40px;text-align:center;max-width:380px;';
        dialog.innerHTML = `
          <div style="font-size:48px;margin-bottom:16px;">📝</div>
          <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#cdd6f4;">LibreMD</h2>
          <p style="margin:0 0 12px;color:#6c7086;font-size:14px;">Version 0.1.0</p>
          <p style="margin:0 0 16px;color:#a6adc8;font-size:13px;line-height:1.6;">
            A lightweight, cross-platform<br>visual Markdown editor
          </p>
          <p style="margin:0 0 4px;color:#6c7086;font-size:12px;">
            Created by <strong style="color:#89b4fa;">@gabogabucho</strong>
          </p>
          <p style="margin:0 0 20px;color:#6c7086;font-size:11px;">
            github.com/gabogabucho/libremd
          </p>
          <button id="about-close-btn" style="padding:10px 32px;background:#89b4fa;border:none;border-radius:8px;color:#1e1e2e;font-weight:600;font-size:14px;cursor:pointer;">OK</button>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('about-close-btn').addEventListener('click', () => overlay.remove());
      },
    },
  ]);
}
