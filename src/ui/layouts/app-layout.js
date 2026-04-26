/**
 * LibreMD — App Layout
 * Creates the DOM structure with custom titlebar.
 */

/**
 * Create the app layout DOM structure.
 * Returns references to all container elements.
 */
export function createAppLayout(root) {
  root.innerHTML = '';

  // ── Custom Titlebar ────────────────────────────────────────────
  const titlebar = document.createElement('header');
  titlebar.id = 'titlebar';
  titlebar.className = 'libremd-titlebar';

  const titlebarLeft = document.createElement('div');
  titlebarLeft.className = 'titlebar-left';

  // App icon + menu button
  const menuBtn = document.createElement('button');
  menuBtn.className = 'titlebar-btn';
  menuBtn.id = 'titlebar-menu';
  menuBtn.setAttribute('aria-label', 'Menu');
  menuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;

  const appTitle = document.createElement('span');
  appTitle.className = 'titlebar-app-title';
  appTitle.textContent = 'LibreMD';
  appTitle.style.cssText = 'font-size:12px;font-weight:600;color:var(--app-text,#cdd6f4);letter-spacing:0.02em;';

  titlebarLeft.appendChild(menuBtn);
  titlebarLeft.appendChild(appTitle);

  // Draggable center (document title)
  const titlebarCenter = document.createElement('div');
  titlebarCenter.className = 'titlebar-center';
  titlebarCenter.innerHTML = '<span class="doc-title" id="titlebar-doc-title">Untitled</span>';

  // Window controls
  const titlebarRight = document.createElement('div');
  titlebarRight.className = 'titlebar-right';

  const minBtn = document.createElement('button');
  minBtn.className = 'titlebar-btn';
  minBtn.id = 'titlebar-minimize';
  minBtn.setAttribute('aria-label', 'Minimize');
  minBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

  const maxBtn = document.createElement('button');
  maxBtn.className = 'titlebar-btn';
  maxBtn.id = 'titlebar-maximize';
  maxBtn.setAttribute('aria-label', 'Maximize');
  maxBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"></rect></svg>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'titlebar-btn titlebar-btn--close';
  closeBtn.id = 'titlebar-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="6" y1="18" x2="18" y2="6"></line></svg>`;

  titlebarRight.appendChild(minBtn);
  titlebarRight.appendChild(maxBtn);
  titlebarRight.appendChild(closeBtn);

  titlebar.appendChild(titlebarLeft);
  titlebar.appendChild(titlebarCenter);
  titlebar.appendChild(titlebarRight);

  // ── Tab Bar ──────────────────────────────────────────────────────
  const tabBar = document.createElement('div');
  tabBar.id = 'tab-bar';
  tabBar.className = 'libremd-tab-bar';

  // ── Toolbar (below tabs) ────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.id = 'toolbar';
  toolbar.className = 'libremd-toolbar';

  // ── Main Content ───────────────────────────────────────────────
  const main = document.createElement('main');
  main.id = 'main-content';
  main.className = 'libremd-main';

  const sidebar = document.createElement('aside');
  sidebar.id = 'sidebar';
  sidebar.className = 'libremd-sidebar';
  sidebar.style.display = 'flex';

  const editorPane = document.createElement('section');
  editorPane.id = 'editor-pane';
  editorPane.className = 'libremd-editor-pane';

  const previewPane = document.createElement('section');
  previewPane.id = 'preview-pane';
  previewPane.className = 'libremd-preview-pane';

  const previewContent = document.createElement('div');
  previewContent.id = 'preview-content';
  previewContent.className = 'libremd-preview-content markdown-body';
  previewPane.appendChild(previewContent);

  main.appendChild(sidebar);
  main.appendChild(editorPane);
  main.appendChild(previewPane);

  // ── Status Bar ─────────────────────────────────────────────────
  const statusBar = document.createElement('footer');
  statusBar.id = 'status-bar';
  statusBar.className = 'libremd-status-bar';

  // ── Command Palette ────────────────────────────────────────────
  const commandPalette = document.createElement('div');
  commandPalette.id = 'command-palette';
  commandPalette.className = 'libremd-command-palette';
  commandPalette.setAttribute('role', 'dialog');
  commandPalette.setAttribute('aria-label', 'Command palette');
  commandPalette.hidden = true;

  // ── Assemble ────────────────────────────────────────────────────
  root.appendChild(titlebar);
  root.appendChild(tabBar);
  root.appendChild(toolbar);
  root.appendChild(main);
  root.appendChild(statusBar);
  root.appendChild(commandPalette);

  return {
    titlebar,
    titlebarLeft,
    titlebarCenter,
    titlebarRight,
    minBtn,
    maxBtn,
    closeBtn,
    menuBtn,
    tabBar,
    toolbar,
    main,
    sidebar,
    editorPane,
    previewPane,
    previewContent,
    statusBar,
    commandPalette,
  };
}