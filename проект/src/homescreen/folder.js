// src/homescreen/folder.js
import { el, clear } from '../utils/dom.js';
import { buildCell } from './icon.js';
import { pointer } from '../utils/gestures.js';

export function createFolderView({ openIconMenu }) {
  const root = el('div', { class: 'folderview', hidden: true });
  const title = el('div', { class: 'folderview__title' });
  const box = el('div', { class: 'folderview__box' });
  root.append(title, box);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  let current = null;
  function open(folder) {
    current = folder; title.textContent = folder.name || 'Папка';
    clear(box);
    (folder.items || []).forEach((it) => {
      const cell = buildCell(it, { showBadges: false });
      pointer(cell, { longMs: 550, onLongPress: () => openIconMenu(it, 'folder'), onTap: () => {} });
      box.append(cell);
    });
    root.hidden = false;
  }
  function close() { root.hidden = true; current = null; }
  function refresh() { if (current) open(current); }
  return { root, open, close, refresh, get current() { return current; } };
}