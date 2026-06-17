// src/homescreen/folder.js
import { el, clear } from '../utils/dom.js';
import { buildCell } from './icon.js';
import { pointer } from '../utils/gestures.js';
import { state, commit, removeIcon } from '../state.js';

export function createFolderView({ openIconMenu } = {}) {
  const root = el('div', { class: 'folderview', hidden: true });
  const title = el('input', { class: 'folderview__title', type: 'text', placeholder: 'Папка' });
  const box = el('div', { class: 'folderview__box' });
  root.append(title, box);

  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  title.addEventListener('input', () => {
    if (!current) return;
    current.name = title.value;
    commit('folderRename');
  });

  let current = null;

  function open(folder) {
    current = folder;
    title.value = folder.name || '';
    render();
    root.hidden = false;
  }

  function render() {
    clear(box);
    if (!current) return;
    const edit = !!state.home.editMode;

    (current.items || []).forEach((it) => {
      const cell = buildCell(it, {
        showBadges: !edit,
        attemptCode: null,
        onDelete: edit ? () => {
          const i = current.items.indexOf(it);
          if (i >= 0) current.items.splice(i, 1);
          commit('delete');
          render();
        } : null,
      });
      pointer(cell, {
        longMs: 550,
        onLongPress: () => openIconMenu(it, 'folder'),
        onTap: () => {},
      });
      box.append(cell);
    });
  }

  function close() { root.hidden = true; current = null; }
  function refresh() { if (current) render(); }

  return { root, open, close, refresh, get current() { return current; } };
}