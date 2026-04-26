/**
 * LibreMD — UI Shell: Toolbar
 *
 * Creates toolbar buttons that execute commands from the registry.
 * SHELL — structure only, minimal inline styles for basic visibility.
 * Gemini PRO will handle all visual styling.
 */

import { executeCommand, getCommand, getTranslatedLabel } from '../../core/commands/index.js';
import { formatShortcutForDisplay } from '../../core/shortcuts/index.js';
import { on, Events } from '../../core/events.js';

/**
 * @typedef {object} ToolbarButtonConfig
 * @property {string} commandId - Command ID to execute
 * @property {string} label - Accessible label (fallback)
 * @property {string} icon - SVG icon content or text symbol
 */

const ICONS = {
  bold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>',
  italic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>',
  strikethrough: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"></path><path d="M14 12a4 4 0 0 1 0 8H6"></path><line x1="4" y1="12" x2="20" y2="12"></line></svg>',
  inlineCode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
  h1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v8"/></svg>',
  h2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>',
  h3: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>',
  bulletList: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
  numberedList: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>',
  taskList: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
  blockquote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11h-4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-2 4-4 4"/><path d="M19 11h-4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-2 4-4 4"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="9" x2="9" y2="21"></line><line x1="15" y1="9" x2="15" y2="21"></line></svg>',
  codeBlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><polyline points="8 10 5 13 8 16"></polyline><polyline points="16 10 19 13 16 16"></polyline></svg>',
  divider: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>',
  splitMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>',
  sourceMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
  wysiwygMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  zenMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle></svg>',
  exportHtml: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>',
  exportPdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V4a1 1 0 0 1 1-1h8l4 4v2"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v7H6z"></path></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
  sidebar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>',
};

/** Default toolbar button layout */
const TOOLBAR_BUTTONS = [
  // Left group: formatting
  { group: 'formatting', buttons: [
    { commandId: 'editor.toggleBold', label: 'Bold', icon: ICONS.bold },
    { commandId: 'editor.toggleItalic', label: 'Italic', icon: ICONS.italic },
    { commandId: 'editor.toggleStrikethrough', label: 'Strikethrough', icon: ICONS.strikethrough },
    { commandId: 'editor.toggleInlineCode', label: 'Inline Code', icon: ICONS.inlineCode },
  ]},
  { group: 'blocks', buttons: [
    { commandId: 'editor.heading1', label: 'Heading 1', icon: ICONS.h1 },
    { commandId: 'editor.heading2', label: 'Heading 2', icon: ICONS.h2 },
    { commandId: 'editor.heading3', label: 'Heading 3', icon: ICONS.h3 },
  ]},
  { group: 'lists', buttons: [
    { commandId: 'editor.unorderedList', label: 'Bullet List', icon: ICONS.bulletList },
    { commandId: 'editor.orderedList', label: 'Numbered List', icon: ICONS.numberedList },
    { commandId: 'editor.taskList', label: 'Task List', icon: ICONS.taskList },
    { commandId: 'editor.blockquote', label: 'Blockquote', icon: ICONS.blockquote },
  ]},
  { group: 'insert', buttons: [
    { commandId: 'editor.link', label: 'Link', icon: ICONS.link },
    { commandId: 'editor.image', label: 'Image', icon: ICONS.image },
    { commandId: 'editor.table', label: 'Table', icon: ICONS.table },
    { commandId: 'editor.insertCodeBlock', label: 'Code Block', icon: ICONS.codeBlock },
    { commandId: 'editor.horizontalRule', label: 'Divider', icon: ICONS.divider },
  ]},
  // Right group: view
  { group: 'view', align: 'right', buttons: [
    { commandId: 'view.splitMode', label: 'Split View', icon: ICONS.splitMode },
    { commandId: 'view.sourceMode', label: 'Source View', icon: ICONS.sourceMode },
    { commandId: 'view.wysiwygMode', label: 'WYSIWYG View', icon: ICONS.wysiwygMode },
    { commandId: 'view.zenMode', label: 'Zen Mode', icon: ICONS.zenMode },
  ]},
  { group: 'export', align: 'right', buttons: [
    { commandId: 'export.html', label: 'Export as HTML', icon: ICONS.exportHtml },
    { commandId: 'export.pdf', label: 'Export as PDF', icon: ICONS.exportPdf },
  ]},
  { group: 'app', buttons: [
    { commandId: 'view.cycleTheme', label: 'Theme', icon: ICONS.theme },
    { commandId: 'view.toggleSidebar', label: 'Sidebar', icon: ICONS.sidebar },
  ]},
];

let toolbarContainer = null;

/**
 * Mount the toolbar into a container element.
 * @param {HTMLElement} container - The toolbar container
 */
export function mountToolbar(container) {
  toolbarContainer = container;
  renderToolbar();

  on(Events.UI_LAYOUT_CHANGED, () => {
    if (toolbarContainer) renderToolbar();
  });
}

function renderToolbar() {
  const container = toolbarContainer;
  container.innerHTML = '';
  
  const leftWrapper = document.createElement('div');
  leftWrapper.className = 'toolbar-section toolbar-section--left';
  const rightWrapper = document.createElement('div');
  rightWrapper.className = 'toolbar-section toolbar-section--right';

  for (const group of TOOLBAR_BUTTONS) {
    const groupEl = document.createElement('div');
    groupEl.className = `toolbar-group toolbar-group--${group.group}`;

    for (const btn of group.buttons) {
      const command = getCommand(btn.commandId);
      const label = command ? getTranslatedLabel(command) : btn.label;
      const shortcut = command?.shortcut
        ? formatShortcutForDisplay(command.shortcut)
        : '';

      const button = document.createElement('button');
      button.className = 'toolbar-btn';
      button.id = `toolbar-btn-${btn.commandId.replace(/\./g, '-')}`;
      button.type = 'button';
      button.setAttribute('aria-label', label);
      
      const tooltip = document.createElement('span');
      tooltip.className = 'toolbar-tooltip';
      tooltip.textContent = shortcut ? `${label} (${shortcut})` : label;
      
      button.innerHTML = btn.icon;
      button.appendChild(tooltip);

      button.addEventListener('click', (e) => {
        e.preventDefault();
        executeCommand(btn.commandId);
      });

      groupEl.appendChild(button);
    }

    if (group.align === 'right' || group.group === 'app') {
      rightWrapper.appendChild(groupEl);
    } else {
      leftWrapper.appendChild(groupEl);
    }
  }
  
  container.appendChild(leftWrapper);
  container.appendChild(rightWrapper);
}
