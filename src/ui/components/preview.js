/**
 * LibreMD — UI Shell: Preview Pane
 *
 * Renders markdown content as HTML and keeps it synced with editor.
 * Handles synchronized scrolling between editor and preview.
 * SHELL — structure is already in app-layout, this handles behavior.
 */

import { on, Events } from '../../core/events.js';
import { renderMarkdown } from '../../core/renderer/index.js';
import { resolveImagesInHtml } from '../../core/file-ops.js';
import { getActiveDocument } from '../../core/store/index.js';

let previewContent = null;
let renderTimer = null;
const RENDER_DEBOUNCE = 150; // ms

export function mountPreview(el) {
  previewContent = el;
  subscribeToEvents();
}

function subscribeToEvents() {
  // Initial render - do it immediately since doc is already created by initCore()
  import('../../core/store/index.js').then(({ getActiveDocument }) => {
    const doc = getActiveDocument();
    if (doc && doc.content) renderToPreview(doc);
  });

  on(Events.DOCUMENT_CHANGED, (doc) => {
    if (!doc) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => renderToPreview(doc), RENDER_DEBOUNCE);
  });

  on(Events.DOCUMENT_SWITCHED, (doc) => {
    if (!doc) return;
    renderToPreview(doc);
  });

  on(Events.EDITOR_MODE_CHANGED, ({ mode }) => {
    if (previewContent) {
      const pane = previewContent.closest('.libremd-preview-pane');
      if (pane) {
        pane.classList.toggle('preview-hidden', mode === 'source' || mode === 'zen');
      }
    }
  });
}

async function renderToPreview(docOrContent) {
  if (!previewContent) return;
  try {
    const doc = typeof docOrContent === 'string'
      ? { content: docOrContent, filePath: null }
      : (docOrContent ?? { content: '', filePath: null });
    const html = await renderMarkdown(doc.content);
    // Resolve image paths BEFORE inserting into DOM so the browser
    // never attempts to load an invalid local path.
    const activeDoc = getActiveDocument();
    const filePath = activeDoc?.filePath || doc.filePath;
    console.log('[Preview] filePath:', filePath);
    console.log('[Preview] html before:', html.substring(0, 500));
    const htmlWithImages = filePath
      ? await resolveImagesInHtml(html, filePath)
      : html;
    console.log('[Preview] html after:', htmlWithImages.substring(0, 500));
    previewContent.innerHTML = htmlWithImages;
  } catch (err) {
    previewContent.innerHTML = `<p class="render-error">Preview error: ${err.message}</p>`;
  }
}
