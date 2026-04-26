/**
 * LibreMD — File Operations Bridge
 *
 * Handles file open/save using Tauri APIs when available,
 * falls back to browser File API for web-only dev mode.
 *
 * This module listens to file-related events from the command registry
 * and performs the actual I/O operations.
 */

import { on, emit, Events } from './events.js';
import { getActiveDocument, markSaved, createDocument } from './store/index.js';
import { getContent, setContent, bindToDocument } from './editor/index.js';

// In-memory cache of data URLs for images inserted this session.
// Key: markdown relative path (e.g. "./images/foo.png")
const sessionImageDataUrls = new Map();

// ── Tauri Detection ────────────────────────────────────────────────

let tauriAvailable = false;
let tauriDialog = null;
let tauriFs = null;
let tauriPath = null;
let tauriCore = null;

async function initTauri() {
  try {
    tauriDialog = await import('@tauri-apps/plugin-dialog');
    tauriFs = await import('@tauri-apps/plugin-fs');
    tauriPath = await import('@tauri-apps/api/path');
    tauriCore = await import('@tauri-apps/api/core');
    tauriAvailable = true;
    console.log('[FileOps] Tauri APIs available');
  } catch {
    tauriAvailable = false;
    console.log('[FileOps] Running in browser mode (no Tauri)');
  }
}

// ── File Filters ───────────────────────────────────────────────────

const MD_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
  { name: 'All Files', extensions: ['*'] },
];

// ── Open File ──────────────────────────────────────────────────────

async function openFile() {
  if (tauriAvailable) {
    const path = await tauriDialog.open({
      multiple: false,
      filters: MD_FILTERS,
    });

    if (!path) return; // User cancelled

    try {
      const content = await tauriFs.readTextFile(path);
      createDocument({ content, filePath: path });
    } catch (err) {
      console.error('[FileOps] Failed to read file:', err);
      emit(Events.APP_ERROR, { message: `Failed to open file: ${err.message}` });
    }
  } else {
    // Browser fallback
    browserOpenFile();
  }
}

// ── Save File ──────────────────────────────────────────────────────

async function saveFile() {
  const doc = getActiveDocument();
  if (!doc) return;

  if (doc.filePath) {
    // Save to existing path
    return writeFile(doc.filePath, doc.content, doc.id);
  } else {
    // No path yet — trigger Save As
    return saveFileAs();
  }
}

async function saveFileAs() {
  const doc = getActiveDocument();
  if (!doc) return null;

  if (tauriAvailable) {
    const path = await tauriDialog.save({
      filters: MD_FILTERS,
      defaultPath: doc.title !== 'Untitled' ? doc.title : 'document.md',
    });

    if (!path) return null; // User cancelled

    await writeFile(path, doc.content, doc.id);
    return path;
  } else {
    // Browser fallback
    browserSaveFile(doc.content, doc.title);
    markSaved(doc.id);
    return doc.title;
  }
}

async function writeFile(path, content, docId) {
  if (tauriAvailable) {
    try {
      await tauriFs.writeTextFile(path, content);
      markSaved(docId, path);
      return path;
    } catch (err) {
      console.error('[FileOps] Failed to write file:', err);
      emit(Events.APP_ERROR, { message: `Failed to save file: ${err.message}` });
      throw err;
    }
  }

  return null;
}

export function isTauriFileAccessAvailable() {
  return tauriAvailable;
}

export async function ensureActiveDocumentFilePath() {
  const doc = getActiveDocument();
  if (!doc) return null;
  if (doc.filePath) return doc.filePath;

  if (!tauriAvailable) {
    alert('Image insertion requires the desktop app with file access. Save the document in LibreMD first.');
    return null;
  }

  const shouldSave = await tauriDialog.ask(
    'LibreMD stores inserted images in an images/ folder next to the Markdown file. Save this document first?',
    {
      kind: 'info',
      title: 'Save document first',
      okLabel: 'Save now',
      cancelLabel: 'Cancel',
    },
  );

  if (!shouldSave) return null;
  await saveFileAs();
  return getActiveDocument()?.filePath ?? null;
}

export async function importImageFilesForActiveDocument(files, { altText = '' } = {}) {
  const docPath = await ensureActiveDocumentFilePath();
  if (!docPath) return [];

  if (!tauriAvailable) {
    throw new Error('Desktop file access is required to import images.');
  }

  return Promise.all(Array.from(files ?? []).map(async (file) => {
    const originalName = String(file?.name ?? '').trim() || 'image';
    const rawBytes = new Uint8Array(await file.arrayBuffer());
    const bytes = Array.from(rawBytes);

    // Build a data URL immediately so preview/export can use it
    // without relying on Tauri asset protocol.
    const mime = file?.type || mimeTypeFromPath(originalName);
    const dataUrl = bytesToDataUrl(rawBytes, mime);

    const imported = await tauriCore.invoke('save_image_for_document', {
      request: {
        docPath,
        originalName,
        mediaType: file?.type || null,
        bytes,
      },
    });

    // Cache data URL for this session so preview works reliably
    console.log('[importImage] caching data URL for key:', imported.markdownPath);
    sessionImageDataUrls.set(imported.markdownPath, dataUrl);

    const resolvedAlt = altText || sanitizeImageBaseName(originalName).replace(/[-_]+/g, ' ').trim() || 'image';
    return {
      altText: resolvedAlt,
      fileName: imported.fileName,
      markdownPath: imported.markdownPath,
      absolutePath: imported.absolutePath,
    };
  }));
}

export async function resolveImagesInHtml(html, documentFilePath) {
  console.log('[resolveImagesInHtml] called, tauriAvailable:', tauriAvailable, 'filePath:', documentFilePath);
  if (!html || !documentFilePath || !tauriAvailable) return html;

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');
  const imageElements = Array.from(parsed.querySelectorAll('img[src]'));
  console.log('[resolveImagesInHtml] found images:', imageElements.length);
  console.log('[resolveImagesInHtml] cache keys:', Array.from(sessionImageDataUrls.keys()));
  if (imageElements.length === 0) return html;

  await Promise.all(imageElements.map(async (image) => {
    const source = image.getAttribute('src')?.trim();
    console.log('[resolveImagesInHtml] processing image src:', source);
    if (!source || isExternalImageSource(source)) return;

    // 1. Use in-memory data URL if this image was inserted this session
    if (sessionImageDataUrls.has(source)) {
      console.log('[resolveImagesInHtml] using cached data URL for:', source);
      image.setAttribute('src', sessionImageDataUrls.get(source));
      return;
    }

    // 2. Fall back to Rust backend read
    try {
      console.log('[resolveImagesInHtml] calling Rust for:', source);
      const { dataUrl } = await tauriCore.invoke('resolve_image', {
        request: { docPath: documentFilePath, imagePath: source },
      });
      image.setAttribute('src', dataUrl);
    } catch (error) {
      console.warn('[FileOps] Failed to resolve preview image source:', source, error);
    }
  }));

  return parsed.body.innerHTML;
}

export async function rewriteRelativeImageSourcesInContainer(container, documentFilePath) {
  if (!container || !documentFilePath || !tauriAvailable) return;

  const imageElements = Array.from(container.querySelectorAll('img[src]'));
  if (imageElements.length === 0) return;

  await Promise.all(imageElements.map(async (image) => {
    const source = image.getAttribute('src')?.trim();
    if (!source || isExternalImageSource(source)) return;

    // 1. Use in-memory data URL if this image was inserted this session
    if (sessionImageDataUrls.has(source)) {
      image.src = sessionImageDataUrls.get(source);
      return;
    }

    // 2. Fall back to Rust backend read
    try {
      const { dataUrl } = await tauriCore.invoke('resolve_image', {
        request: { docPath: documentFilePath, imagePath: source },
      });
      image.src = dataUrl;
    } catch (error) {
      console.warn('[FileOps] Failed to resolve preview image source:', source, error);
    }
  }));
}

export async function inlineRelativeImageSourcesForExport(html, documentFilePath) {
  if (!html || !documentFilePath || !tauriAvailable) return html;

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');
  const imageElements = Array.from(parsed.querySelectorAll('img[src]'));
  if (imageElements.length === 0) return html;

  await Promise.all(imageElements.map(async (image) => {
    const source = image.getAttribute('src')?.trim();
    if (!source || isExternalImageSource(source)) return;

    // 1. Use in-memory data URL if this image was inserted this session
    if (sessionImageDataUrls.has(source)) {
      image.setAttribute('src', sessionImageDataUrls.get(source));
      return;
    }

    // 2. Fall back to Rust backend read
    try {
      const { dataUrl } = await tauriCore.invoke('resolve_image', {
        request: { docPath: documentFilePath, imagePath: source },
      });
      image.setAttribute('src', dataUrl);
    } catch (error) {
      console.warn('[FileOps] Failed to inline export image source:', source, error);
    }
  }));

  return parsed.body.innerHTML;
}

function sanitizeImageBaseName(fileName) {
  const rawName = String(fileName ?? '').replace(/\.[^.]+$/, '').trim().toLowerCase();
  const safeName = rawName
    .normalize('NFKD')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');

  return safeName || 'image';
}

function isExternalImageSource(source) {
  return /^(?:[a-z]+:|\/\/|#)/i.test(source);
}

function bytesToDataUrl(bytes, mimeType) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

function mimeTypeFromPath(filePath) {
  const lowerPath = String(filePath ?? '').toLowerCase();

  if (lowerPath.endsWith('.png')) return 'image/png';
  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerPath.endsWith('.gif')) return 'image/gif';
  if (lowerPath.endsWith('.webp')) return 'image/webp';
  if (lowerPath.endsWith('.svg')) return 'image/svg+xml';
  if (lowerPath.endsWith('.bmp')) return 'image/bmp';

  return 'application/octet-stream';
}

// ── Browser Fallbacks ──────────────────────────────────────────────

function browserOpenFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.markdown,.mdown,.mkd,.txt';

  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      createDocument({ content, filePath: file.name });
    } catch (err) {
      console.error('[FileOps] Browser file read failed:', err);
    }
  });

  input.click();
}

function browserSaveFile(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Initialize ─────────────────────────────────────────────────────

export async function initFileOps() {
  await initTauri();

  // Listen for file commands from the event bus
  on('file:open-dialog', openFile);
  on('file:save', saveFile);
  on('file:save-as', saveFileAs);
}
