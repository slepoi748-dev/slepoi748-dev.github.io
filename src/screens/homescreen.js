import { el, clear } from '../utils/dom.js';
import { onLongPress } from '../utils/gestures.js';
import { store } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { imgUrl } from '../utils/images.js';
import { openSettings } from './settings.js';
import { openIconDialog } from './icon-dialog.js';

let pickMode = null;

function uid() {
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function renderHomescreen(root) {
  clear(root);

  let editing = false;

  const screen = el('div', { class: 'screen home' });
  applyWallpaper(screen);

  const gridWrap = el('div', { class: 'home__grid-wrap' });
  const grid = el('div', { class: 'home__grid' });
  gridWrap.append(grid);

  const dock = el('div', { class: 'home__dock' });

  // ---------- Построение сетки ----------
  function buildGrid() {
    clear(grid);
    const c = store.get('home');
    grid.style.gridTemplateColumns = `repeat(${c.cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${c.rows}, ${c.iconSize + 26}px)`;
    grid.style.columnGap = `${c.gapX}px`;
    grid.style.rowGap = `${c.gapY}px`;
    grid.style.transform = `translate(${c.offsetX}px, ${c.offsetY}px)`;

    // Карта занятых ячеек
    const occupied = new Map(); // "col,row" -> icon
    c.icons.forEach((ic) => occupied.set(`${ic.col},${ic.row}`, ic));

    for (let row = 1; row <= c.rows; row++) {
      for (let col = 1; col <= c.cols; col++) {
        const key = `${col},${row}`;
        const icon = occupied.get(key);
        if (icon) {
          const node = buildIcon(icon, c);
          node.style.gridColumn = String(col);
          node.style.gridRow = String(row);
          grid.append(node);
        } else if (editing) {
          const cell = buildEmptyCell(col, row);
          grid.append(cell);
        }
      }
    }
  }

  function buildDock() {
    clear(dock);
    const c = store.get('home');
    dock.style.transform = `translateY(${c.dockOffsetY}px)`;
    c.dock.forEach((icon) => dock.append(buildIcon(icon, c, true)));
  }

  // ---------- Пустая ячейка ----------
  function buildEmptyCell(col, row) {
    const cell = el('div', { class: 'cell-empty', dataset: { col, row } }, '+');
    cell.style.gridColumn = String(col);
    cell.style.gridRow = String(row);
    cell.style.minHeight = `${store.get('home.iconSize')}px`;
    cell.addEventListener('click', async () => {
      const res = await openIconDialog(screen, { title: 'Новая иконка' });
      if (!res) return;
      const icons = [...store.get('home.icons')];
      icons.push({ id: uid(), name: res.name, img: res.img, col, row });
      store.set('home.icons', icons);
    });
    return cell;
  }

  // ---------- Иконка ----------
  function buildIcon(icon, c, isDock = false) {
    const imgNode = el('div', {
      class: 'app-icon__img',
      style: {
        width: `${c.iconSize}px`, height: `${c.iconSize}px`,
        borderRadius: `${c.iconRadius}px`, opacity: String(c.iconOpacity),
        backgroundImage: icon.img ? `url("${imgUrl(icon.img)}")` : 'none',
      },
    });
    const badge = el('span', { class: 'app-icon__badge', dataset: { for: icon.id } });
    const label = el('div', { class: 'app-icon__label' }, icon.name || '');
    const removeBtn = el('button', { class: 'app-icon__remove' }, '×');

    const node = el('div', {
      class: 'app-icon',
      dataset: { id: icon.id, dock: isDock ? '1' : '0' },
    }, [imgNode, badge, removeBtn, label]);

    if (pickMode) node.classList.add('pickable');

    // Удаление в режиме редактирования
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeIcon(icon.id, isDock);
    });

    // Нажатие — лёгкая анимация
    node.addEventListener('pointerdown', () => { if (!editing) node.classList.add('active'); });
    const release = () => node.classList.remove('active');
    node.addEventListener('pointerup', release);
    node.addEventListener('pointerleave', release);
    node.addEventListener('pointercancel', release);

    // Клик
    node.addEventListener('click', (e) => {
      if (pickMode) {
        e.stopPropagation();
        const cb = pickMode.onPick; exitPickMode(); cb(icon.id);
        return;
      }
      if (editing) return; // в редакторе клик не открывает приложение
      handleIconClick(icon);
    });

    // Долгое нажатие на иконку → меню (вне редактора)
    onLongPress(node, () => {
      if (pickMode || editing) return;
      // если это иконка-триггер с режимом долгого нажатия — открываем настройки
      const cfg = store.get('home');
      if (cfg.openViaIcon && cfg.triggerIconId === icon.id && cfg.openLongPress) {
        openSettings(root, 'home');
        return;
      }
      openIconMenu(icon, node, isDock);
    }, () => store.get('home.longPressMs'));

    // Перетаскивание в режиме редактирования
    if (editing && !isDock) enableDrag(node, icon);

    return node;
  }

  // ---------- Перетаскивание ----------
  function enableDrag(node, icon) {
    let startX, startY, dragging = false, holdTimer = null;

    node.addEventListener('pointerdown', (e) => {
      startX = e.clientX; startY = e.clientY;
      holdTimer = setTimeout(() => { dragging = true; node.classList.add('dragging'); node.setPointerCapture(e.pointerId); }, 150);
    });

    node.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      node.style.position = 'relative';
      node.style.left = `${e.clientX - startX}px`;
      node.style.top = `${e.clientY - startY}px`;
    });

    const finish = (e) => {
      clearTimeout(holdTimer);
      if (!dragging) return;
      dragging = false;
      node.classList.remove('dragging');
      node.style.left = ''; node.style.top = ''; node.style.position = '';

      // Определяем ячейку по координате
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = target?.closest('.app-icon, .cell-empty');
      if (cellEl) {
        const { col, row } = cellTargetCoords(cellEl);
        if (col && row) moveIcon(icon.id, col, row);
      }
    };
    node.addEventListener('pointerup', finish);
    node.addEventListener('pointercancel', finish);
  }

  function cellTargetCoords(cellEl) {
    if (cellEl.classList.contains('cell-empty')) {
      return { col: +cellEl.dataset.col, row: +cellEl.dataset.row };
    }
    // целевая иконка — берём её координаты
    const id = cellEl.dataset.id;
    const ic = store.get('home.icons').find((x) => x.id === id);
    return ic ? { col: ic.col, row: ic.row } : {};
  }

  function moveIcon(id, col, row) {
    const icons = store.get('home.icons').map((x) => ({ ...x }));
    const moving = icons.find((x) => x.id === id);
    if (!moving) return;
    const occupant = icons.find((x) => x.col === col && x.row === row && x.id !== id);
    if (occupant) { occupant.col = moving.col; occupant.row = moving.row; } // меняем местами
    moving.col = col; moving.row = row;
    store.set('home.icons', icons);
  }

  function removeIcon(id, isDock) {
    const key = isDock ? 'home.dock' : 'home.icons';
    store.set(key, store.get(key).filter((x) => x.id !== id));
  }

  // ---------- Контекстное меню иконки ----------
  function openIconMenu(icon, node, isDock) {
    const rect = node.getBoundingClientRect();
    const screenRect = screen.getBoundingClientRect();

    const menu = el('div', { class: 'icon-menu' });
    const item = (label, handler, danger = false) => {
      const b = el('button', danger ? { class: 'danger' } : {}, label);
      b.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); handler(); });
      return b;
    };

    menu.append(
      item('Изменить', async () => {
        const res = await openIconDialog(screen, { title: 'Изменить иконку', data: { name: icon.name, img: icon.img } });
        if (!res) return;
        const key = isDock ? 'home.dock' : 'home.icons';
        store.set(key, store.get(key).map((x) => x.id === icon.id ? { ...x, name: res.name, img: res.img } : x));
      }),
      item('Бейдж…', () => openBadgeDialog(icon, isDock)),
      item('Редактировать экран', () => enterEditMode()),
      item('Удалить', () => removeIcon(icon.id, isDock), true),
    );

    const backdrop = el('div', { class: 'icon-menu-backdrop' }, [menu]);
    const closeMenu = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeMenu(); });

    screen.append(backdrop);

    // Позиционируем меню рядом с иконкой
    let top = rect.bottom - screenRect.top + 6;
    let left = rect.left - screenRect.left;
    menu.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      if (left + mw > screenRect.width - 10) left = screenRect.width - mw - 10;
      if (top + mh > screenRect.height - 10) top = rect.top - screenRect.top - mh - 6;
      if (left < 10) left = 10;
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.style.visibility = 'visible';
    });
  }

  // Простой диалог бейджа (число или пусто)
  function openBadgeDialog(icon, isDock) {
    const cur = icon.badge || '';
    const val = prompt('Значение бейджа (пусто — убрать):', cur);
    if (val === null) return;
    const key = isDock ? 'home.dock' : 'home.icons';
    store.set(key, store.get(key).map((x) => x.id === icon.id ? { ...x, badge: val.trim() } : x));
  }

  // ---------- Режим редактирования ----------
  function enterEditMode() {
    editing = true;
    screen.classList.add('editing');
    buildGrid(); buildDock();
    if (!screen.querySelector('.edit-bar')) {
      const doneBtn = el('button', {}, 'Готово');
      doneBtn.addEventListener('click', exitEditMode);
      screen.append(el('div', { class: 'edit-bar' }, [doneBtn]));
    }
  }
  function exitEditMode() {
    editing = false;
    screen.classList.remove('editing');
    screen.querySelector('.edit-bar')?.remove();
    buildGrid(); buildDock();
  }

  // ---------- Клики/тапы для настроек ----------
  function handleIconClick(icon) {
    const c = store.get('home');
    if (c.openViaIcon && c.triggerIconId === icon.id) {
      if (c.openMultiTap) { registerTap('icon', () => openSettings(root, 'home')); return; }
      if (!c.openLongPress) { openSettings(root, 'home'); return; }
    }
  }

    let tapCount = 0, tapTimer = null, tapSource = null;
  function registerTap(source, cb) {
    const c = store.get('home');
    if (tapSource && tapSource !== source) tapCount = 0;
    tapSource = source;
    tapCount++;
    clearTimeout(tapTimer);
    if (tapCount >= c.multiTapCount) {
      tapCount = 0; tapSource = null;
      cb();
      return;
    }
    tapTimer = setTimeout(() => { tapCount = 0; tapSource = null; }, c.multiTapWindowMs);
  }

  // ---------- Жесты экрана ----------
  // Долгое нажатие на пустой экран — ТОЛЬКО при включённом тумблере (правка из этапа 2)
  onLongPress(gridWrap, () => {
    if (pickMode || editing) return;
    if (!store.get('home.openLongPress')) return;
    const c = store.get('home');
    if (c.openViaIcon && c.triggerIconId) return; // приоритет у иконки
    openSettings(root, 'home');
  }, () => store.get('home.longPressMs'));

  // N тапов по пустому экрану
  gridWrap.addEventListener('click', (e) => {
    if (pickMode || editing) return;
    // клик именно по пустому месту, не по иконке
    if (e.target.closest('.app-icon')) return;
    const c = store.get('home');
    if (c.openMultiTap) registerTap('screen', () => openSettings(root, 'home'));
  });

  // ---------- Режим выбора иконки (из настроек) ----------
  function enterPickMode(onPick) {
    pickMode = { onPick };
    buildGrid(); buildDock();
    const hint = el('div', { class: 'pick-hint' }, 'Коснитесь иконки для выбора (тап здесь — отмена)');
    hint.addEventListener('click', (e) => {
      e.stopPropagation();
      exitPickMode();
      openSettings(root, 'home');
    });
    const overlay = el('div', { class: 'pick-overlay' }, [hint]);
    overlay.dataset.pick = '1';
    screen.append(overlay);
  }
  function exitPickMode() {
    pickMode = null;
    screen.querySelector('[data-pick="1"]')?.remove();
    buildGrid(); buildDock();
  }

  // ---------- Сборка ----------
  buildGrid();
  buildDock();
  screen.append(gridWrap, dock);
  root.append(screen);

  // ---------- Подписки ----------
  const offPick = bus.on('home:pickIcon', ({ onPick }) => enterPickMode(onPick));
  const offEdit = bus.on('home:enterEdit', () => enterEditMode());

  const offConfig = bus.on(EVENTS.CONFIG_CHANGE, ({ path }) => {
    if (path === '*' || path.startsWith('home')) {
      buildGrid(); buildDock(); applyWallpaper(screen);
      applyBadges();
    }
  });

  applyBadges();

  function applyBadges() {
    const all = [...store.get('home.icons'), ...store.get('home.dock')];
    screen.querySelectorAll('.app-icon__badge').forEach((b) => {
      const ic = all.find((x) => x.id === b.dataset.for);
      const v = ic && ic.badge ? String(ic.badge) : '';
      b.textContent = v;
      b.style.display = v ? 'flex' : 'none';
    });
  }

  return () => { offConfig(); offPick(); offEdit(); };
}

function applyWallpaper(screen) {
  const show = store.get('home.showWallpaper');
  const wp = store.get('home.wallpaperThis') || store.get('home.wallpaperGlobal');
  screen.style.backgroundImage = show && wp ? `url("${imgUrl(wp)}")` : 'none';
}