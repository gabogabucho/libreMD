/**
 * LibreMD — UI Shell: Command Palette
 *
 * Modal overlay with fuzzy search across all commands.
 * SHELL — structure only, Gemini PRO styles.
 */

import { on, emit, Events } from '../../core/events.js';
import { searchCommands, executeCommand, getTranslatedLabel, getTranslatedCategory } from '../../core/commands/index.js';
import { formatShortcutForDisplay } from '../../core/shortcuts/index.js';
import { t } from '../../core/i18n/index.js';

let container = null;
let inputEl = null;
let listEl = null;
let isOpen = false;
let selectedIndex = 0;
let currentResults = [];

export function mountCommandPalette(el) {
  container = el;
  container.innerHTML = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'palette-backdrop';
  backdrop.addEventListener('click', close);

  const dialog = document.createElement('div');
  dialog.className = 'palette-dialog';

  inputEl = document.createElement('input');
  inputEl.className = 'palette-input';
  inputEl.type = 'text';
  inputEl.placeholder = t('commandPalette.placeholder');
  inputEl.setAttribute('aria-label', t('commandPalette.placeholder'));
  inputEl.addEventListener('input', onInput);
  inputEl.addEventListener('keydown', onKeydown);

  listEl = document.createElement('div');
  listEl.className = 'palette-results';
  listEl.setAttribute('role', 'listbox');

  dialog.appendChild(inputEl);
  dialog.appendChild(listEl);
  container.appendChild(backdrop);
  container.appendChild(dialog);

  // Ensure starts hidden
  container.hidden = true;
  container.style.display = 'none';

  on(Events.COMMAND_PALETTE_OPEN, open);
  
  on(Events.UI_LAYOUT_CHANGED, () => {
    if (inputEl) {
      inputEl.placeholder = t('commandPalette.placeholder');
      inputEl.setAttribute('aria-label', t('commandPalette.placeholder'));
    }
    if (isOpen) {
      renderResults(currentResults);
    }
  });
}

function open() {
  if (isOpen) return;
  isOpen = true;
  container.hidden = false;
  container.style.display = '';
  inputEl.value = '';
  selectedIndex = 0;
  renderResults(searchCommands(''));
  inputEl.focus();
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  container.hidden = true;
  container.style.display = 'none';
  emit(Events.COMMAND_PALETTE_CLOSE, {});
}

function onInput() {
  const query = inputEl.value.trim();
  const results = searchCommands(query);
  selectedIndex = 0;
  renderResults(results);
}

function onKeydown(e) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      updateSelection();
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection();
      break;
    case 'Enter':
      e.preventDefault();
      if (currentResults[selectedIndex]) {
        executeCommand(currentResults[selectedIndex].id);
        close();
      }
      break;
    case 'Escape':
      e.preventDefault();
      close();
      break;
  }
}

function renderResults(results) {
  currentResults = results;
  listEl.innerHTML = '';
  
  if (results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.textContent = t('commandPalette.noResults');
    listEl.appendChild(empty);
    return;
  }

  for (let i = 0; i < Math.min(results.length, 15); i++) {
    const cmd = results[i];
    const item = document.createElement('div');
    item.className = 'palette-item' + (i === selectedIndex ? ' palette-item--selected' : '');
    item.setAttribute('role', 'option');

    const label = document.createElement('span');
    label.className = 'palette-item-label';
    label.textContent = getTranslatedLabel(cmd);

    const meta = document.createElement('span');
    meta.className = 'palette-item-meta';

    if (cmd.category) {
      const cat = document.createElement('span');
      cat.className = 'palette-item-category';
      cat.textContent = getTranslatedCategory(cmd);
      meta.appendChild(cat);
    }
    if (cmd.shortcut) {
      const sc = document.createElement('kbd');
      sc.className = 'palette-item-shortcut';
      sc.textContent = formatShortcutForDisplay(cmd.shortcut);
      meta.appendChild(sc);
    }

    item.appendChild(label);
    item.appendChild(meta);
    item.addEventListener('click', () => {
      executeCommand(cmd.id);
      close();
    });

    listEl.appendChild(item);
  }
}

function updateSelection() {
  const items = listEl.querySelectorAll('.palette-item');
  items.forEach((el, i) => {
    el.classList.toggle('palette-item--selected', i === selectedIndex);
  });
}
