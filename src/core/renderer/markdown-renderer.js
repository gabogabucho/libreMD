/**
 * LibreMD — Markdown Rendering Pipeline
 *
 * Converts Markdown to HTML using unified/remark/rehype.
 * Supports GFM (tables, task lists, strikethrough, autolinks).
 * Pure function — NO DOM, NO side effects.
 *
 * Pipeline:
 *   Markdown string → remark-parse → remark-gfm → remark-rehype → rehype-highlight → rehype-stringify → HTML string
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeHighlight from 'rehype-highlight';

// ── Pipeline Singleton ─────────────────────────────────────────────

let pipeline = null;

/**
 * Get or create the rendering pipeline.
 * Lazy-initialized for faster startup.
 * @returns {import('unified').Processor}
 */
function getPipeline() {
  if (!pipeline) {
    pipeline = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, {
        allowDangerousHtml: true,
      })
      .use(rehypeHighlight, {
        detect: true,
        ignoreMissing: true,
      })
      .use(rehypeStringify, {
        allowDangerousHtml: true,
      });
  }
  return pipeline;
}

// ── Render Cache ───────────────────────────────────────────────────

/** @type {Map<string, string>} Simple content hash → HTML cache */
const renderCache = new Map();
const MAX_CACHE_SIZE = 50;

/**
 * Simple hash for cache keys. Not cryptographic, just fast.
 * @param {string} str
 * @returns {string}
 */
function quickHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Render Markdown to HTML.
 * Results are cached — identical input returns cached output.
 *
 * @param {string} markdownContent - Raw markdown string
 * @returns {Promise<string>} Rendered HTML string
 */
export async function renderMarkdown(markdownContent) {
  if (!markdownContent || markdownContent.trim().length === 0) {
    return '';
  }

  // Check cache
  const hash = quickHash(markdownContent);
  if (renderCache.has(hash)) {
    return renderCache.get(hash);
  }

  try {
    const result = await getPipeline().process(markdownContent);
    const html = String(result);

    // Store in cache (evict oldest if full)
    if (renderCache.size >= MAX_CACHE_SIZE) {
      const firstKey = renderCache.keys().next().value;
      renderCache.delete(firstKey);
    }
    renderCache.set(hash, html);

    return html;
  } catch (err) {
    console.error('[Renderer] Failed to render markdown:', err);
    return `<pre class="render-error">Render error: ${err.message}</pre>`;
  }
}

/**
 * Render Markdown synchronously (blocking).
 * Use sparingly — prefer async version.
 *
 * @param {string} markdownContent
 * @returns {string}
 */
export function renderMarkdownSync(markdownContent) {
  if (!markdownContent || markdownContent.trim().length === 0) {
    return '';
  }

  const hash = quickHash(markdownContent);
  if (renderCache.has(hash)) {
    return renderCache.get(hash);
  }

  try {
    const result = getPipeline().processSync(markdownContent);
    const html = String(result);

    if (renderCache.size >= MAX_CACHE_SIZE) {
      const firstKey = renderCache.keys().next().value;
      renderCache.delete(firstKey);
    }
    renderCache.set(hash, html);

    return html;
  } catch (err) {
    console.error('[Renderer] Sync render failed:', err);
    return `<pre class="render-error">Render error: ${err.message}</pre>`;
  }
}

/**
 * Extract headings from markdown for TOC/outline.
 * Returns a flat array of heading objects.
 *
 * @param {string} markdownContent
 * @returns {{ level: number, text: string, line: number }[]}
 */
export function extractHeadings(markdownContent) {
  if (!markdownContent) return [];

  const headings = [];
  const lines = markdownContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/#+\s*$/, '').trim(), // Remove trailing #
        line: i + 1, // 1-indexed
      });
    }
  }

  return headings;
}

/**
 * Extract word count and reading time.
 * @param {string} markdownContent
 * @returns {{ words: number, chars: number, readingTimeMinutes: number }}
 */
export function getDocumentStats(markdownContent) {
  if (!markdownContent) return { words: 0, chars: 0, readingTimeMinutes: 0 };

  // Strip markdown syntax for accurate word count
  const plain = markdownContent
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '')       // Remove inline code
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Keep link text
    .replace(/[#*_~>`|-]/g, '')    // Remove markdown chars
    .trim();

  const words = plain.split(/\s+/).filter(Boolean).length;
  const chars = markdownContent.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return { words, chars, readingTimeMinutes };
}

/**
 * Clear the render cache.
 */
export function clearCache() {
  renderCache.clear();
}
