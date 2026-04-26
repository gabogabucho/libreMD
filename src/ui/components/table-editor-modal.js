/**
 * LibreMD — Table Editor Modal
 */

export function openTableEditorModal({ initialTable, onSave }) {
  const state = {
    headers: [...(initialTable?.headers ?? ['Header 1', 'Header 2', 'Header 3'])],
    rows: (initialTable?.rows?.length ? initialTable.rows : [['', '', ''], ['', '', '']]).map((row) => [...row]),
  };

  normalizeTableState(state);

  const overlay = document.createElement('div');
  overlay.className = 'table-editor-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'table-editor-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Table editor');

  dialog.innerHTML = `
    <div class="table-editor-header">
      <div>
        <h2>Table editor</h2>
        <p>Edit a Markdown table visually, then save it back to the document.</p>
      </div>
      <button type="button" class="table-editor-close" aria-label="Close table editor">×</button>
    </div>
    <div class="table-editor-actions">
      <div class="table-editor-action-group">
        <button type="button" data-action="add-column">+ Column</button>
        <button type="button" data-action="remove-column">− Column</button>
      </div>
      <div class="table-editor-action-group">
        <button type="button" data-action="add-row">+ Row</button>
        <button type="button" data-action="remove-row">− Row</button>
      </div>
    </div>
    <div class="table-editor-grid-wrap">
      <table class="table-editor-grid">
        <thead></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="table-editor-footer">
      <span class="table-editor-meta"></span>
      <div class="table-editor-footer-actions">
        <button type="button" class="table-editor-btn table-editor-btn--ghost" data-action="cancel">Cancel</button>
        <button type="button" class="table-editor-btn table-editor-btn--primary" data-action="save">Save table</button>
      </div>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const thead = dialog.querySelector('thead');
  const tbody = dialog.querySelector('tbody');
  const meta = dialog.querySelector('.table-editor-meta');
  const closeButton = dialog.querySelector('.table-editor-close');

  const close = () => {
    document.removeEventListener('keydown', handleKeydown);
    overlay.remove();
  };

  const save = () => {
    onSave({
      headers: state.headers.map((value) => value.trim() || 'Header'),
      rows: state.rows.map((row) => row.map((value) => value.trim())),
    });
    close();
  };

  const render = () => {
    normalizeTableState(state);

    thead.innerHTML = '';
    tbody.innerHTML = '';
    meta.textContent = `${state.rows.length + 1} rows × ${state.headers.length} columns`;

    const headerRow = document.createElement('tr');
    state.headers.forEach((value, columnIndex) => {
      headerRow.appendChild(createCellInput('th', value, (nextValue) => {
        state.headers[columnIndex] = nextValue;
      }, `Header ${columnIndex + 1}`));
    });
    thead.appendChild(headerRow);

    state.rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      row.forEach((value, columnIndex) => {
        tr.appendChild(createCellInput('td', value, (nextValue) => {
          state.rows[rowIndex][columnIndex] = nextValue;
        }, `R${rowIndex + 1}C${columnIndex + 1}`));
      });
      tbody.appendChild(tr);
    });
  };

  const handleAction = (action) => {
    if (action === 'add-column') {
      const nextColumn = state.headers.length + 1;
      state.headers.push(`Header ${nextColumn}`);
      state.rows.forEach((row) => row.push(''));
      render();
      return;
    }

    if (action === 'remove-column' && state.headers.length > 1) {
      state.headers.pop();
      state.rows.forEach((row) => row.pop());
      render();
      return;
    }

    if (action === 'add-row') {
      state.rows.push(Array.from({ length: state.headers.length }, () => ''));
      render();
      return;
    }

    if (action === 'remove-row' && state.rows.length > 1) {
      state.rows.pop();
      render();
    }
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'enter') {
      event.preventDefault();
      save();
    }
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  dialog.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'cancel') {
      close();
      return;
    }

    if (action === 'save') {
      save();
      return;
    }

    handleAction(action);
  });

  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', handleKeydown);

  render();
  requestAnimationFrame(() => {
    dialog.querySelector('input')?.focus();
    dialog.querySelector('input')?.select();
  });
}

function createCellInput(tagName, value, onInput, placeholder) {
  const cell = document.createElement(tagName);
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener('input', (event) => onInput(event.target.value));
  cell.appendChild(input);
  return cell;
}

function normalizeTableState(state) {
  if (state.headers.length === 0) {
    state.headers.push('Header 1');
  }

  state.rows = state.rows.map((row) => Array.from({ length: state.headers.length }, (_, index) => row[index] ?? ''));

  if (state.rows.length === 0) {
    state.rows.push(Array.from({ length: state.headers.length }, () => ''));
  }
}
