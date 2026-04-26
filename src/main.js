/**
 * LibreMD — Application Entry Point
 */

import { initCore } from './core/index.js';
import { createEditor, bindToDocument } from './core/editor/index.js';
import { getActiveDocument, createDocument, getAllDocuments, getActiveDocumentId, switchToDocument, closeDocument } from './core/store/index.js';
import { executeCommand } from './core/commands/index.js';
import { setEditorMode, EditorMode } from './core/editor/index.js';
import { getEditorView, replaceRange, buildMarkdownTable } from './core/editor/index.js';
import { renderMarkdown } from './core/renderer/index.js';
import { on, Events, emit } from './core/events.js';
import { importImageFilesForActiveDocument, inlineRelativeImageSourcesForExport } from './core/file-ops.js';
import { openTableEditorModal } from './ui/components/table-editor-modal.js';

window.addEventListener('error', (e) => {
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;z-index:999999;padding:10px;font-family:monospace;white-space:pre-wrap;';
  errDiv.textContent = `Uncaught error: ${e.error ? e.error.stack : e.message}`;
  document.body.appendChild(errDiv);
});
window.addEventListener('unhandledrejection', (e) => {
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:darkred;color:white;z-index:999999;padding:10px;font-family:monospace;white-space:pre-wrap;';
  errDiv.textContent = `Unhandled rejection: ${e.reason ? e.reason.stack || e.reason : 'Unknown reason'}`;
  document.body.appendChild(errDiv);
});

// UI shells
import { createAppLayout } from './ui/layouts/app-layout.js';
import { mountToolbar } from './ui/components/toolbar.js';
import { mountStatusBar } from './ui/components/status-bar.js';
import { mountSidebar } from './ui/components/sidebar.js';
import { mountCommandPalette } from './ui/components/command-palette.js';
import { mountPreview } from './ui/components/preview.js';

// Styles
import './ui/styles/base.css';
import './ui/styles/layout.css';

// ── Tauri Window API ─────────────────────────────────────────────

async function getTauriWindow() {
  try {
    const mod = await import('@tauri-apps/api/window');
    return mod.getCurrentWindow();
  } catch {
    return null;
  }
}

// ── Tauri Menu + Titlebar Setup ────────────────────────────────────

function setupTitlebarControls(layout) {
  const { minBtn, maxBtn, closeBtn, menuBtn } = layout;

  // Minimize
  minBtn.addEventListener('click', async () => {
    try {
      const win = await getTauriWindow();
      if (win) await win.minimize();
    } catch(e) { console.error('[LibreMD] Minimize error:', e); }
  });

  // Maximize/Restore
  maxBtn.addEventListener('click', async () => {
    try {
      const win = await getTauriWindow();
      if (win) {
        const maximized = await win.isMaximized();
        if (maximized) {
          await win.unmaximize();
        } else {
          await win.maximize();
        }
        const isMaxNow = await win.isMaximized();
        updateMaximizeIcon(maxBtn, isMaxNow);
      }
    } catch(e) { console.error('[LibreMD] Maximize error:', e); }
  });

  // Close
  closeBtn.addEventListener('click', async () => {
    try {
      const win = await getTauriWindow();
      if (win) {
        await win.close();
      }
    } catch(e) {
      window.close();
    }
  });

  // Double-click titlebar center to maximize
  layout.titlebarCenter.addEventListener('dblclick', async () => {
    try {
      const win = await getTauriWindow();
      if (win) {
        const maximized = await win.isMaximized();
        if (maximized) {
          await win.unmaximize();
        } else {
          await win.maximize();
        }
        const isMaxNow = await win.isMaximized();
        updateMaximizeIcon(maxBtn, isMaxNow);
      }
    } catch(e) { console.error('[LibreMD] DblClick error:', e); }
  });

  // Menu button -> command palette
  menuBtn.addEventListener('click', () => {
    emit(Events.COMMAND_PALETTE_OPEN, {});
  });
}

function updateMaximizeIcon(btn, isMaximized) {
  if (isMaximized) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="1"></rect><path d="M4 4h12v12"></path></svg>`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"></rect></svg>`;
  }
  btn.setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
}

function updateTitlebarDocTitle(title, dirty) {
  const el = document.getElementById('titlebar-doc-title');
  if (el) {
    el.textContent = dirty ? title + ' •' : title;
  }
}

function setupMenuEvents() {
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('menu-event', (event) => {
      handleMenuCommand(event.payload);
    });
  }).catch(() => {
    setupBrowserMenuFallback();
  });
}

function handleMenuCommand(id) {
  switch (id) {
    case 'file.new': createDocument(); break;
    case 'file.open': emit('file:open-dialog', {}); break;
    case 'file.save': emit('file:save', {}); break;
    case 'file.save_as': emit('file:save-as', {}); break;
    case 'file.closeTab': executeCommand('file.closeTab'); break;
    case 'file.close_tab': executeCommand('file.closeTab'); break;
    case 'export.html': doExportHTML(); break;
    case 'export.pdf': doExportPDF(); break;
    case 'view.split': setEditorMode(EditorMode.SPLIT); break;
    case 'view.source': setEditorMode(EditorMode.SOURCE); break;
    case 'view.wysiwyg': setEditorMode(EditorMode.WYSIWYG); break;
    case 'view.zen': setEditorMode(EditorMode.ZEN); break;
    case 'view.toggle_sidebar': executeCommand('view.toggleSidebar'); break;
    case 'view.toggle_fullscreen': toggleFullscreen(); break;
    case 'view.cycle_theme': executeCommand('view.cycleTheme'); break;
    case 'help.about': showAboutDialog(); break;
    case 'help.shortcuts': emit(Events.COMMAND_PALETTE_OPEN, {}); break;
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
}

async function doExportHTML() {
  console.log('[DEBUG] doExportHTML called');
  const doc = getActiveDocument();
  if (!doc) { alert('No document open'); return; }
  console.log('[DEBUG] Rendering for doc:', doc.title, 'content length:', doc.content?.length);
  
  const renderedHtml = await renderMarkdown(doc.content);
  const html = await inlineRelativeImageSourcesForExport(renderedHtml, doc.filePath);
  const filename = (doc.title || 'untitled').replace(/\.md$/i, '') + '.html';
  const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${doc.title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.8; }
  pre { background: #f5f5f5; padding: 16px; border-radius: 8px; }
  blockquote { border-left: 3px solid #89b4fa; padding-left: 16px; }
</style>
</head>
<body>${html}</body>
</html>`;

  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({
      defaultPath: filename,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    });
    if (filePath) {
      await writeTextFile(filePath, fullHTML);
      alert('HTML exported successfully!');
    }
  } catch (err) {
    console.log('[DEBUG] Tauri dialog failed, using fallback', err);
    // Fallback: download directly
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    alert('HTML exported!');
  }
}

function getExportBaseName(doc) {
  return (doc?.title || 'untitled').replace(/\.[^.]+$/i, '') || 'untitled';
}

function ensurePdfExtension(filePath) {
  return /\.pdf$/i.test(filePath) ? filePath : `${filePath}.pdf`;
}

async function doExportPDF() {
  const doc = getActiveDocument();
  if (!doc) {
    alert('No document open');
    return;
  }

  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const requestedPath = await save({
      defaultPath: `${getExportBaseName(doc)}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (!requestedPath) return;

    await invoke('export_pdf', {
      request: {
        title: getExportBaseName(doc),
        markdown: doc.content || '',
        outputPath: ensurePdfExtension(requestedPath),
      },
    });

    alert('PDF exported successfully!');
  } catch (e) {
    console.error('[LibreMD] PDF export failed:', e);
    const message = e?.message || e?.toString?.() || 'Unknown error';
    alert(`PDF export failed: ${message}`);
  }
}

function showAboutDialog() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:var(--app-surface,#252536);border:1px solid var(--app-border,#313244);border-radius:16px;padding:32px 40px;text-align:center;max-width:380px;box-shadow:0 24px 64px rgba(0,0,0,0.4);';
  dialog.innerHTML = `
    <img src="/icons/256x256.png" alt="LibreMD" style="width:64px;height:64px;margin-bottom:16px;border-radius:12px;" />
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:var(--app-text,#cdd6f4);">LibreMD</h2>
    <p style="margin:0 0 12px;color:var(--app-text-muted,#6c7086);font-size:14px;">Version 0.1.0</p>
    <p style="margin:0 0 16px;color:var(--app-text-secondary,#a6adc8);font-size:13px;line-height:1.6;">
      A lightweight, cross-platform<br>visual Markdown editor
    </p>
    <p style="margin:0;font-size:12px;color:var(--app-text-muted,#6c7086);">
      Created by <strong style="color:var(--app-accent,#89b4fa);">@gabogabucho</strong>
    </p>
    <p style="margin:4px 0 20px;font-size:11px;color:var(--app-text-muted,#6c7086);">
      github.com/gabogabucho/libremd
    </p>
    <button id="about-close-btn" style="padding:10px 32px;background:var(--app-accent,#89b4fa);border:none;border-radius:8px;color:var(--app-accent-text,#1e1e2e);font-weight:600;font-size:14px;cursor:pointer;">OK</button>
  `;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  document.getElementById('about-close-btn').addEventListener('click', () => overlay.remove());
}

function setupBrowserMenuFallback() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); createDocument(); }
  });
}

// ── Tab Bar Rendering ──────────────────────────────────────────────

function renderTabs(tabBar) {
  if (!tabBar) return;
  const docs = getAllDocuments();
  const activeId = getActiveDocumentId();
  tabBar.innerHTML = '';

  for (const doc of docs) {
    const tab = document.createElement('button');
    tab.className = 'libremd-tab' + (doc.id === activeId ? ' tab--active' : '') + (doc.dirty ? ' tab--dirty' : '');
    tab.textContent = doc.title || 'Untitled';
    tab.title = doc.title || 'Untitled';
    tab.addEventListener('click', () => {
      switchToDocument(doc.id);
      bindToDocument(doc.id);
      updateTitlebarDocTitle(doc.title, doc.dirty);
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'libremd-tab-close';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close tab';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDocument(doc.id);
      const newDoc = getActiveDocument();
      if (newDoc) {
        bindToDocument(newDoc.id);
        updateTitlebarDocTitle(newDoc.title, newDoc.dirty);
      }
      renderTabs(tabBar);
    });

    tab.appendChild(closeBtn);
    tabBar.appendChild(tab);
  }

  const newBtn = document.createElement('button');
  newBtn.className = 'libremd-tab-new';
  newBtn.title = 'New tab';
  newBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  newBtn.addEventListener('click', () => {
    createDocument();
    const doc = getActiveDocument();
    if (doc) {
      bindToDocument(doc.id);
      updateTitlebarDocTitle(doc.title, doc.dirty);
    }
    renderTabs(tabBar);
  });
  tabBar.appendChild(newBtn);
}

// ── Splash Screen ──────────────────────────────────────────────────

function showSplash() {
  const splash = document.createElement('div');
  splash.id = 'splash-screen';
  splash.style.cssText = 'position:fixed;inset:0;background:#1e1e2e;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;transition:opacity 0.4s ease-out;';
  splash.innerHTML = `
    <img src="/icons/256x256.png" alt="LibreMD" style="width:80px;height:80px;margin-bottom:20px;animation:splashPulse 1.2s ease-in-out infinite;border-radius:16px;" />
    <h1 style="margin:0 0 4px;font-size:32px;font-weight:700;color:#cdd6f4;font-family:'Inter',system-ui,sans-serif;">LibreMD</h1>
    <p style="margin:0 0 16px;color:#585b70;font-size:12px;font-family:'Inter',system-ui,sans-serif;letter-spacing:0.05em;">v0.1.0</p>
    <p style="margin:0 0 16px;color:#6c7086;font-size:14px;font-family:'Inter',system-ui,sans-serif;">A lightweight visual Markdown editor</p>
    <div style="display:flex;gap:8px;align-items:center;color:#6c7086;font-size:12px;font-family:'Inter',system-ui,sans-serif;">
      <span>Created by</span>
      <strong style="color:#89b4fa;">@gabogabucho</strong>
    </div>
    <p style="margin:8px 0 0;color:#6c7086;font-size:11px;font-family:'Inter',system-ui,sans-serif;">github.com/gabogabucho/libremd</p>
    <style>
      @keyframes splashPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.08); } }
    </style>
  `;
  document.documentElement.appendChild(splash);
  return splash;
}

function hideSplash(splash) {
  splash.style.opacity = '0';
  setTimeout(() => { splash.remove(); }, 400);
}

function setupRichInsertionFeatures() {
  on(Events.UI_TABLE_EDITOR_OPEN, ({ table, range }) => {
    openTableEditorModal({
      initialTable: table,
      onSave: (nextTable) => {
        const markdown = buildMarkdownTable(nextTable);
        const view = getEditorView();
        if (!view) return;

        const from = range?.from ?? view.state.selection.main.from;
        const to = range?.to ?? view.state.selection.main.to;
        const prefix = from > 0 && view.state.sliceDoc(from - 1, from) !== '\n' ? '\n' : '';
        const suffix = to < view.state.doc.length && view.state.sliceDoc(to, to + 1) !== '\n' ? '\n' : '';
        const content = `${prefix}${markdown}${suffix}`;
        replaceRange(from, to, content);
      },
    });
  });

  on(Events.UI_IMAGE_PICKER_OPEN, async ({ altText = '', from = null, to = null } = {}) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const files = Array.from(input.files ?? []);
      await insertImageFiles(files, { altText, from, to });
      input.remove();
    }, { once: true });

    input.click();
  });

  on(Events.EDITOR_IMAGE_DROPPED, async ({ files, position }) => {
    await insertImageFiles(files, { position });
  });
}

async function insertImageFiles(files, { altText = '', position = null, from = null, to = null } = {}) {
  const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));
  if (imageFiles.length === 0) return;

  try {
    const importedImages = await importImageFilesForActiveDocument(imageFiles, { altText });
    if (importedImages.length === 0) return;

    const markdownImages = importedImages.map((image) => (
      `![${escapeMarkdownAltText(image.altText)}](${image.markdownPath})`
    ));

    const block = `${markdownImages.join('\n\n')}\n`;
    const view = getEditorView();
    if (!view) return;

    const start = position ?? from ?? view.state.selection.main.from;
    const end = position ?? to ?? view.state.selection.main.to;
    const prefix = start > 0 && view.state.sliceDoc(start - 1, start) !== '\n' ? '\n' : '';
    replaceRange(start, end, `${prefix}${block}`);
  } catch (error) {
    console.error('[LibreMD] Failed to insert image:', error);
    alert(`Image insertion failed: ${error?.message || error}`);
  }
}

function escapeMarkdownAltText(text) {
  return String(text ?? '').replace(/[\[\]]/g, '');
}

// ── Boot ───────────────────────────────────────────────────────────

async function boot() {
  const splash = showSplash();

  await initCore({ theme: 'dark-default' });

  const root = document.getElementById('app');
  if (!root) {
    console.error('[LibreMD] #app element not found');
    return;
  }

  const layout = createAppLayout(root);

  setupTitlebarControls(layout);

  mountToolbar(layout.toolbar);
  mountStatusBar(layout.statusBar);
  mountSidebar(layout.sidebar);
  mountCommandPalette(layout.commandPalette);
  mountPreview(layout.previewContent);

  createEditor(layout.editorPane);
  setupRichInsertionFeatures();

  const activeDoc = getActiveDocument();
  if (activeDoc) {
    bindToDocument(activeDoc.id);
    updateTitlebarDocTitle(activeDoc.title, activeDoc.dirty);
  }
  renderTabs(layout.tabBar);

  setupMenuEvents();

  // Export event listeners (command palette emits these)
  on('file:export-html', () => doExportHTML());
  on('file:export-pdf', () => doExportPDF());

  on(Events.EDITOR_MODE_CHANGED, ({ mode }) => {
    root.dataset.mode = mode;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const palette = document.getElementById('command-palette');
      if (palette && !palette.hidden) return;
      const currentMode = root.dataset.mode;
      if (currentMode === 'zen' || currentMode === 'wysiwyg') {
        setEditorMode(EditorMode.SPLIT);
      }
    }
  });

  on(Events.DOCUMENT_SWITCHED, (doc) => {
    if (doc) updateTitlebarDocTitle(doc.title, doc.dirty);
    renderTabs(layout.tabBar);
  });

  on(Events.DOCUMENT_SAVED, (doc) => {
    if (doc) updateTitlebarDocTitle(doc.title, false);
    renderTabs(layout.tabBar);
  });

  on(Events.DOCUMENT_DIRTY, ({ dirty }) => {
    const doc = getActiveDocument();
    if (doc) updateTitlebarDocTitle(doc.title, dirty);
    renderTabs(layout.tabBar);
  });

  on(Events.DOCUMENT_CHANGED, () => {
    renderTabs(layout.tabBar);
  });

  root.dataset.mode = 'split';

  console.log('[LibreMD] App ready');

  setTimeout(() => hideSplash(splash), 1200);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
