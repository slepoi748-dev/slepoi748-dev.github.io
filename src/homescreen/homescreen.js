// Рабочий стол: страницы, dock, свайпы, edit-режим, слоты, меню иконки, папки,
// триггеры открытия настроек, показ попыток пароля.
import { el, clear, setBgImage } from '../utils/dom.js';
import { swipe, pointer, multiTap } from '../utils/gestures.js';
import { state, commit, newId, findIcon } from '../state.js';
import { getImage } from '../storage.js';
import { buildCell } from './icon.js';

export function createHomeScreen({ onLock, onOpenSettings, openIconMenu, openFolder }) {
  let currentPage = 0;
  let editMode = false;
  const mergeSel = new Set();

  const root = el('div', { class: 'home' });
  const wallpaper = el('div', { class: 'home__bg' });
  const viewport = el('div', { class: 'home__viewport' });
  const track = el('div', { class: 'home__track' });
  const dots = el('div', { class: 'home__dots' });
  const search = el('div', { class: 'home__search', text: '🔍 Поиск' });
  const dock = el('div', { class: 'home__dock' });

  // +NEW маленькая матовая кнопка "Готово" вместо широкой плашки
  const doneBtn = el('button', { class: 'home__done', text: 'Готово' });
  doneBtn.hidden = true;
  doneBtn.addEventListener('click', (e) => { e.stopPropagation(); exitEdit(); });

  viewport.append(track);
  root.append(wallpaper, viewport, dots, search, dock, doneBtn);

  // +NEW триггеры храним в переменных, пересоздаём при каждом render
  let screenTapFn = null;
  let iconTapFn = null;
  function rebuildTriggers() {
    const t = state.home.trigger;
    screenTapFn = multiTap(t.tapCount, () => onOpenSettings(), t.tapTimeoutMs || 400);
    iconTapFn = multiTap(t.iconTapCount, () => onOpenSettings(), t.tapTimeoutMs || 400);
  }
  rebuildTriggers();

  // ---- триггеры открытия настроек (стол) ----
  // +NEW тап по пустому месту: выход из edit ИЛИ мультитап-триггер
  pointer(viewport, {
    longMs: state.home.trigger.holdMs,
    onLongPress: () => {
      if (editMode) return;                                  // в edit долгий тап не открывает настройки
      if (state.home.trigger.hold) onOpenSettings();
    },
    onTap: (e) => {
      if (editMode) {
        // выход только если тап НЕ по иконке/слоту
        if (!e || !e.target.closest('.cell, .slot, .home__done')) exitEdit();
        return;
      }
      if (state.home.trigger.multiTap) screenTapFn();
    },
  });

  // ---- свайпы ----
  swipe(viewport, (dir, startY) => {
    if (editMode) return;
    if (dir === 'left' && currentPage < state.home.pages.length - 1) goPage(currentPage + 1);
    else if (dir === 'right' && currentPage > 0) goPage(currentPage - 1);
    else if (dir === 'down' && startY < 160) onLock();
  });

  function applyVars() {
    const h = state.home, r = root.style;
    r.setProperty('--cols', h.cols);
    r.setProperty('--icon-size', h.iconSize + 'px');
    r.setProperty('--icon-radius', h.iconRadius + 'px');
    r.setProperty('--icon-opacity', h.iconOpacity / 100);
    r.setProperty('--gap-x', h.gapX + 'px');
    r.setProperty('--gap-y', h.gapY + 'px');
    r.setProperty('--icon-x', h.offX + 'px');
    r.setProperty('--icon-y', h.offY + 'px');
  }

  function cellOpts(ic, ctx) {
    const av = state.home.attemptsView;
    const ai = av.iconIds.indexOf(ic.id);
    const attemptCode = (ai > -1 && ai < av.count) ? (state.attempts[ai] ?? null) : null;
    return {
      showBadges: true,
      attemptCode,
      hideLabel: ctx === 'dock',
      onDelete: () => deleteIcon(ic.id),
    };
  }

  function attachTap(cell, ic, ctx) {
    let long = false;
    pointer(cell, {
      longMs: 550,
      onLongPress: () => { long = true; if (!editMode) enterEdit(); openIconMenu(ic, ctx); },
      onTap: () => {
        if (long) { long = false; return; }
        if (editMode) {
          if (ctx === 'folder') { openIconMenu(ic, ctx); return; }
          toggleMerge(ic.id, cell);
          return;
        }
        const t = state.home.trigger;
        if (t.icon && t.iconId === ic.id) { iconTapFn(); return; }
        if (ic.folder) openFolder(ic);
      },
    });
  }

  // +NEW пустой слот (только в edit) — тап = добавить иконку в эту позицию
  function buildSlot(pageIndex, slotIndex) {
    const slot = el('div', { class: 'slot' }, [el('span', { class: 'slot__plus', text: '+' })]);
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      addIconAt(pageIndex, slotIndex);
    });
    return slot;
  }

  function render() {
    applyVars();
    rebuildTriggers();                 // +NEW всегда актуальные tapCount/timeout
    clear(track);
    const cols = state.home.cols;
    state.home.pages.forEach((pg, pageIndex) => {
      const page = el('div', { class: 'page' });
      if (pg.bg) setBgImage(page, pg.bg);
      const grid = el('div', { class: 'grid' });
      pg.icons.forEach((ic) => {
        const cell = buildCell(ic, cellOpts(ic, 'page'));
        attachTap(cell, ic, 'page');
        grid.append(cell);
      });
      // +NEW в edit-режиме дорисовываем пустые слоты до кратности cols (минимум 1 ряд)
      if (editMode) {
        const filled = pg.icons.length;
        const rows = Math.max(1, Math.ceil((filled + 1) / cols));
        const total = rows * cols;
        for (let s = filled; s < total; s++) grid.append(buildSlot(pageIndex, s));
      }
      page.append(grid);
      track.append(page);
    });
    clear(dock);
    state.home.dock.forEach((ic) => {
      const cell = buildCell(ic, cellOpts(ic, 'dock'));
      attachTap(cell, ic, 'dock');
      dock.append(cell);
    });
    track.style.width = state.home.pages.length * 100 + '%';
    track.querySelectorAll('.page').forEach((p) => (p.style.width = 100 / state.home.pages.length + '%'));
    renderDots();
    renderWallpaper();
    goPage(currentPage, false);

    // +NEW кнопка "Готово" вместо editbar
    doneBtn.hidden = !editMode;
    root.classList.toggle('home--edit', editMode);
  }

  function renderWallpaper() {
    const pg = state.home.pages[currentPage];
    setBgImage(wallpaper, pg?.bg || state.home.commonBg);
  }
  function renderDots() {
    clear(dots);
    state.home.pages.forEach((_, i) => {
      const d = el('div', { class: 'pdot' + (i === currentPage ? ' pdot--on' : '') });
      d.addEventListener('click', () => goPage(i));
      dots.append(d);
    });
  }
  function goPage(i, anim = true) {
    currentPage = Math.max(0, Math.min(state.home.pages.length - 1, i));
    track.style.transition = anim ? '' : 'none';
    track.style.transform = `translateX(${-currentPage * (100 / state.home.pages.length)}%)`;
    if (!anim) requestAnimationFrame(() => (track.style.transition = ''));
    renderDots();
    renderWallpaper();
  }

  // ---- edit / merge ----
  function enterEdit() { editMode = true; render(); }
  function exitEdit() { editMode = false; mergeSel.clear(); commit('edit'); render(); }
  function toggleMerge(id, cell) {
    if (mergeSel.has(id)) { mergeSel.delete(id); cell.classList.remove('cell--sel'); }
    else { mergeSel.add(id); cell.classList.add('cell--sel'); }
    // +NEW editbar убрали — кнопку "Объединить" покажем, если выбрано 2+
    doneBtn.textContent = mergeSel.size >= 2 ? `Объединить (${mergeSel.size})` : 'Готово';
    doneBtn.classList.toggle('home__done--merge', mergeSel.size >= 2);
  }
  function mergeSelected() {
    if (mergeSel.size < 2) return;
    const items = [];
    let host = null;
    [...mergeSel].forEach((id, idx) => {
      const f = findIcon(id); if (!f) return;
      if (idx === 0 && !f.dock) host = f;
      if (f.icon.folder) items.push(...f.icon.items);
      else items.push({ id: f.icon.id, bg: f.icon.bg, emoji: f.icon.emoji, imgId: f.icon.imgId, name: f.icon.name });
    });
    [...mergeSel].forEach((id) => { const f = findIcon(id); if (f) f.container.splice(f.container.indexOf(f.icon), 1); });
    const target = host ? state.home.pages[host.page].icons : state.home.pages[currentPage].icons;
    target.push({ id: newId(), folder: true, name: 'Папка', badge: 0, items });
    mergeSel.clear(); commit('merge'); render();
  }
  function deleteIcon(id) {
    const f = findIcon(id); if (!f) return;
    f.container.splice(f.container.indexOf(f.icon), 1);
    commit('delete'); render();
  }

  // +NEW клик по "Готово" с учётом merge
  doneBtn.addEventListener('click', () => {}, { once: false });
  // (заменяем обработчик выше) — единый клик:
  doneBtn.onclick = (e) => {
    e.stopPropagation();
    if (mergeSel.size >= 2) { mergeSelected(); return; }
    exitEdit();
  };

  // +NEW добавление иконки в конкретный слот
  function addIconAt(pageIndex, slotIndex) {
    const icons = state.home.pages[pageIndex].icons;
    const ic = { id: newId(), name: 'Новая', bg: '#3a3a3c', emoji: '✨', badge: 0, w: 1, h: 1 };
    if (slotIndex >= icons.length) icons.push(ic);
    else icons.splice(slotIndex, 0, ic);
    commit('addIcon'); render();
    // сразу открываем меню редактирования новой иконки
    openIconMenu(ic, 'page');
  }

  return {
    root, render,
    enterEdit, exitEdit,
    goPage: (i) => goPage(i),
    addIcon() {                                  // добавить на текущий экран (из настроек)
      addIconAt(currentPage, state.home.pages[currentPage].icons.length);
      enterEdit();
    },
    addPage() { state.home.pages.push({ bg: null, icons: [] }); commit('addPage'); render(); goPage(state.home.pages.length - 1); },
    delPage() {
      if (state.home.pages.length <= 1) return alert('Нельзя удалить последний экран');
      if (!confirm('Удалить текущий экран?')) return;
      state.home.pages.splice(currentPage, 1);
      currentPage = Math.min(currentPage, state.home.pages.length - 1);
      commit('delPage'); render();
    },
    get currentPage() { return currentPage; },
    get editMode() { return editMode; },
  };
}