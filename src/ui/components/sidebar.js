/**
 * LibreMD — UI Shell: Sidebar (Document Outline / TOC)
 *
 * Renders an auto-generated table of contents from document headings.
 * Click on heading → scrolls editor to that line.
 * SHELL — minimal structure, ready for Gemini PRO styling.
 */

import { on, Events } from '../../core/events.js';
import { extractHeadings } from '../../core/renderer/index.js';
import { getEditorView } from '../../core/editor/index.js';
import { t } from '../../core/i18n/index.js';

let container = null;
let isVisible = true;
let currentHeadings = [];

export function mountSidebar(el) {
  container = el;
  renderOutline([]);
  subscribeToEvents();
}

function renderOutline(headings) {
  currentHeadings = headings;
  if (!container) return;
  container.innerHTML = '';

  const title = document.createElement('h3');
  title.className = 'sidebar-title';
  title.textContent = t('sidebar.outline');
  container.appendChild(title);

  if (headings.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'sidebar-empty';
    empty.textContent = t('sidebar.noHeadings');
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('nav');
  list.className = 'sidebar-outline';
  list.setAttribute('aria-label', t('sidebar.outline'));

  for (const heading of headings) {
    const item = document.createElement('a');
    item.className = `outline-item outline-item--h${heading.level}`;
    item.href = '#';
    item.textContent = heading.text;
    item.dataset.line = heading.line;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToLine(heading.line);
    });
    list.appendChild(item);
  }

  container.appendChild(list);
}

function scrollToLine(line) {
  const view = getEditorView();
  if (!view) return;
  const docLine = view.state.doc.line(Math.min(line, view.state.doc.lines));
  view.dispatch({ selection: { anchor: docLine.from }, scrollIntoView: true });
  view.focus();
}

function subscribeToEvents() {
  let debounceTimer = null;
  on(Events.DOCUMENT_CHANGED, (doc) => {
    if (!doc) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderOutline(extractHeadings(doc.content));
    }, 500);
  });

  on(Events.DOCUMENT_SWITCHED, (doc) => {
    if (!doc) return;
    renderOutline(extractHeadings(doc.content));
  });

  on(Events.UI_SIDEBAR_TOGGLE, () => {
    isVisible = !isVisible;
    if (container) container.classList.toggle('sidebar--hidden', !isVisible);
  });

  on(Events.UI_LAYOUT_CHANGED, () => {
    if (container) renderOutline(currentHeadings);
  });
}

export function isSidebarVisible() {
  return isVisible;
}
