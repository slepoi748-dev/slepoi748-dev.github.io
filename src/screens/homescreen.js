import { el, clear } from '../utils/dom.js';
import { onLongPress } from '../utils/gestures.js';
import { store } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { imgUrl } from '../utils/images.js';
import { openSettings } from './settings.js';
import { openIconDialog } from './icon-dialog.js';
import { openBadgeDialog } from './badge-dialog.js';
import { computeBadgeMap } from '../core/badges.js';

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

  // ============================================================
  //  ПОСТРОЕНИЕ СЕТКИ
  // ============================================================
  function buildGrid() {
    clear(grid);
    const c = store.get('home');
    grid.style.gridTemplateColumns = `repeat(${c.cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${c.rows}, ${c.iconSize + 26}px)`;
    grid.style.columnGap = `${c.gapX}px`;
    grid.style.rowGap = `${c.gapY}px`;
    grid.style.transform = `translate(${c.offsetX}px, ${c.offsetY}px)`;

    const occupied = new Map(); // "col,row" -> icon
    c.icons.forEach((ic) => occupied.set(`${ic.col},${ic.row}`, ic));

    for (let row = 1; row <= c.rows; row++) {
      for (let col = 1; col <= c.cols; col++) {
        const icon = occupied.get(`${col},${row}`);
        if (icon) {
          const node = buildIcon(icon, c);
          node.style.gridColumn = String(col);
          node.style.gridRow = String(row);
          grid.append(node);
        } else if (editing) {
          grid.append(buildEmptyCell(col, row));
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

  // ============================================================
  //  ПУСТАЯ ЯЧЕЙКА (только в редакторе)
  // ============================================================
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

  // ============================================================
  //  ИКОНКА
  // ============================================================
  function buildIcon(icon, c, isDock = false) {
    const imgNode = el('div', {
      class: 'app-icon__img',
      style: {
        width: `${c.iconSize}px`,
        height: `${c.iconSize}px`,
        borderRadius: `${c.iconRadius}px`,
        opacity: String(c.iconOpacity),
        backgroundImage: icon.img ? `url("${imgUrl(icon.img)}")` : 'none',
      },
    });

    // Превью папки — мини-сетка
    if (icon.folder) {
      imgNode.classList.add('folder-preview');
      imgNode.style.backgroundImage = 'none';
      icon.folder.slice(0, 9).forEach((sub) => {
        const mini = el('div', { class: 'folder-mini' });
        mini.style.backgroundImage = sub.img ? `url("${imgUrl(sub.img)}")` : 'none';
        imgNode.append(mini);
      });
    }

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

    // Лёгкая анимация нажатия
    node.addEventListener('pointerdown', () => { if (!editing) node.classList.add('active'); });
    const release = () => node.classList.remove('active');
    node.addEventListener('pointerup', release);
    node.addEventListener('pointerleave', release);
    node.addEventListener('pointercancel', release);

    // Клик
    node.addEventListener('click', (e) => {
      if (pickMode) {
        e.stopPropagation();
        const cb = pickMode.onPick;
        exitPickMode();
        cb(icon.id);
        return;
      }
      if (editing) return;
      if (icon.folder) { openFolder(icon, isDock); return; }
      handleIconClick(icon);
    });

    // Долгое нажатие на иконку → меню (вне редактора и pickMode)
    onLongPress(node, () => {
      if (pickMode || editing) return;
      const cfg = store.get('home');
      // если это иконка-триггер с режимом долгого нажатия — открываем настройки
      if (cfg.openViaIcon && cfg.triggerIconId === icon.id && cfg.openLongPress) {
        openSettings(root, 'home');
        return;
      }
      openIconMenu(icon, node, isDock);
    }, () => store.get('home.longPressMs'));

    // Перетаскивание в режиме редактирования (только на основном экране)
    if (editing && !isDock) enableDrag(node, icon);

    return node;
  }

  // ============================================================
  //  ПЕРЕТАСКИВАНИЕ
  // ============================================================
  function enableDrag(node, icon) {
    let startX, startY, dragging = false, holdTimer = null;

    node.addEventListener('pointerdown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      holdTimer = setTimeout(() => {
        dragging = true;
        node.classList.add('dragging');
        node.style.pointerEvents = 'none';
        try { node.setPointerCapture(e.pointerId); } catch {}
      }, 150);
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
      node.style.left = '';
      node.style.top = '';
      node.style.position = '';
      node.style.pointerEvents = '';

      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = target?.closest('.app-icon, .cell-empty');
      if (!cellEl) return;

      if (
        cellEl.classList.contains('app-icon') &&
        cellEl.dataset.id !== icon.id &&
        cellEl.dataset.dock === '0'
      ) {
        mergeIntoFolder(icon.id, cellEl.dataset.id); // → в папку / своп с папкой
      } else {
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
    const id = cellEl.dataset.id;
    const ic = store.get('home.icons').find((x) => x.id === id);
    return ic ? { col: ic.col, row: ic.row } : {};
  }

  function moveIcon(id, col, row) {
    const icons = store.get('home.icons').map((x) => ({ ...x }));
    const moving = icons.find((x) => x.id === id);
    if (!moving) return;
    const occupant = icons.find((x) => x.col === col && x.row === row && x.id !== id);
    if (occupant) {
      occupant.col = moving.col;
      occupant.row = moving.row;
    }
    moving.col = col;
    moving.row = row;
    store.set('home.icons', icons);
  }

  function removeIcon(id, isDock) {
    const key = isDock ? 'home.dock' : 'home.icons';
    store.set(key, store.get(key).filter((x) => x.id !== id));
  }

  // ============================================================
  //  ПАПКИ
  // ============================================================
  function mergeIntoFolder(dragId, targetId) {
    const icons = store.get('home.icons').map((x) => ({ ...x }));
    const drag = icons.find((x) => x.id === dragId);
    const target = icons.find((x) => x.id === targetId);
    if (!drag || !target) return;

    const dragItems = drag.folder
      ? drag.folder
      : [{ id: drag.id, name: drag.name, img: drag.img, badge: drag.badge }];

    if (target.folder) {
      target.folder = [...target.folder, ...dragItems];
    } else {
      target.folder = [
        { id: target.id + '_a', name: target.name, img: target.img, badge: target.badge },
        ...dragItems,
      ];
      target.name = target.name || 'Папка';
      target.img = '';
    }

    store.set('home.icons', icons.filter((x) => x.id !== dragId));
  }

  function openFolder(folderIcon, isDock) {
    const c = store.get('home');
    const gridInner = el('div', { class: 'folder-grid' });

    folderIcon.folder.forEach((sub) => {
      const img = el('div', {
        class: 'app-icon__img',
        style: {
          width: `${c.iconSize}px`,
          height: `${c.iconSize}px`,
          borderRadius: `${c.iconRadius}px`,
          backgroundImage: sub.img ? `url("${imgUrl(sub.img)}")` : 'none',
        },
      });
      const label = el('div', { class: 'app-icon__label' }, sub.name || '');
      const item = el('div', { class: 'app-icon' }, [img, label]);

      item.addEventListener('click', () => {
        const cfg = store.get('home');
        if (cfg.openViaIcon && cfg.triggerIconId === sub.id) {
          closeFolder();
          openSettings(root, 'home');
        }
      });

      // Долгое нажатие внутри папки → вынести на экран
      onLongPress(item, () => {
        ejectFromFolder(folderIcon.id, sub.id, isDock);
        closeFolder();
      }, () => store.get('home.longPressMs'));

      gridInner.append(item);
    });

    const title = el('div', { class: 'folder-title', contentEditable: 'true' }, folderIcon.name || 'Папка');
    title.addEventListener('blur', () => {
      const key = isDock ? 'home.dock' : 'home.icons';
      store.set(key, store.get(key).map((x) =>
        x.id === folderIcon.id ? { ...x, name: title.textContent.trim() || 'Папка' } : x
      ));
    });

    const sheet = el('div', { class: 'folder-sheet' }, [title, gridInner]);
    const backdrop = el('div', { class: 'folder-backdrop' }, [sheet]);
    const closeFolder = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeFolder(); });
    screen.append(backdrop);
  }

  // Вынос иконки из папки на свободную ячейку; пустые/одиночные папки распускаются
  function ejectFromFolder(folderId, subId, isDock) {
    const key = isDock ? 'home.dock' : 'home.icons';
    let list = store.get(key).map((x) => ({ ...x }));
    const folder = list.find((x) => x.id === folderId);
    if (!folder || !folder.folder) return;

    const sub = folder.folder.find((s) => s.id === subId);
    if (!sub) return;

    folder.folder = folder.folder.filter((s) => s.id !== subId);

    // Куда положить вынесенную иконку (только для основного экрана)
    let place = {};
    if (!isDock) place = findFreeCell();

    const newIcon = {
      id: uid(),
      name: sub.name,
      img: sub.img,
      badge: sub.badge,
      ...place,
    };

    // Если в папке осталась 1 иконка — распускаем папку
    if (folder.folder.length === 1) {
      const last = folder.folder[0];
      folder.folder = undefined;
      folder.name = last.name;
      folder.img = last.img;
      folder.badge = last.badge;
    } else if (folder.folder.length === 0) {
      // пустую папку удаляем
      list = list.filter((x) => x.id !== folderId);
    }

    if (isDock) {
      list.push(newIcon);
    } else {
      list.push(newIcon);
    }

    store.set(key, list);
  }

  function findFreeCell() {
    const c = store.get('home');
    const occupied = new Set(c.icons.map((i) => `${i.col},${i.row}`));
    for (let row = 1; row <= c.rows; row++) {
      for (let col = 1; col <= c.cols; col++) {
        if (!occupied.has(`${col},${row}`)) return { col, row };
      }
    }
    return { col: 1, row: 1 };
  }

  // ============================================================
  //  КОНТЕКСТНОЕ МЕНЮ ИКОНКИ
  // ============================================================
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
        const res = await openIconDialog(screen, {
          title: 'Изменить иконку',
          data: { name: icon.name, img: icon.img },
        });
        if (!res) return;
        const key = isDock ? 'home.dock' : 'home.icons';
        store.set(key, store.get(key).map((x) =>
          x.id === icon.id ? { ...x, name: res.name, img: res.img } : x
        ));
      }),
      item('Бейдж…', async () => {
        const cur = typeof icon.badge === 'object'
          ? icon.badge
          : { type: icon.badge ? 'number' : 'none', value: icon.badge || '' };
        const res = await openBadgeDialog(screen, cur);
        if (!res) return;
        const key = isDock ? 'home.dock' : 'home.icons';
        store.set(key, store.get(key).map((x) =>
          x.id === icon.id ? { ...x, badge: res } : x
        ));
      }),
      item('Редактировать экран', () => enterEditMode()),
      item('Удалить', () => removeIcon(icon.id, isDock), true),
    );

    const backdrop = el('div', { class: 'icon-menu-backdrop' }, [menu]);
    const closeMenu = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeMenu(); });
    screen.append(backdrop);

    // Позиционирование рядом с иконкой
    let top = rect.bottom - screenRect.top + 6;
    let left = rect.left - screenRect.left;
    menu.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const mw = menu.offsetWidth;
      const mh = menu.offsetHeight;
      if (left + mw > screenRect.width - 10) left = screenRect.width - mw - 10;
      if (top + mh > screenRect.height - 10) top = rect.top - screenRect.top - mh - 6;
      if (left < 10) left = 10;
      if (top < 10) top = 10;
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.style.visibility = 'visible';
    });
  }

  // ============================================================
  //  РЕЖИМ РЕДАКТИРОВАНИЯ
  // ============================================================
  function enterEditMode() {
    editing = true;
    screen.classList.add('editing');
    buildGrid();
    buildDock();
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
    buildGrid();
    buildDock();
  }

  // ============================================================
  //  ОТКРЫТИЕ НАСТРОЕК (тапы / иконка-триггер)
  // ============================================================
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
      tapCount = 0;
      tapSource = null;
      cb();
      return;
    }
    tapTimer = setTimeout(() => { tapCount = 0; tapSource = null; }, c.multiTapWindowMs);
  }

  // ============================================================
  //  ЖЕСТЫ ЭКРАНА
  // ============================================================
  // Долгое нажатие на пустой экран — ТОЛЬКО при включённом тумблере
  onLongPress(gridWrap, () => {
    if (pickMode || editing) return;
    if (!store.get('home.openLongPress')) return;
    const c = store.get('home');
    if (c.openViaIcon && c.triggerIconId) return; // приоритет у иконки-триггера
    openSettings(root, 'home');
  }, () => store.get('home.longPressMs'));

  // N тапов по пустому месту экрана
  gridWrap.addEventListener('click', (e) => {
    if (pickMode || editing) return;
    if (e.target.closest('.app-icon')) return;
    const c = store.get('home');
    if (c.openMultiTap) registerTap('screen', () => openSettings(root, 'home'));
  });

  // ============================================================
  //  РЕЖИМ ВЫБОРА ИКОНКИ (из настроек)
  // ============================================================
  function enterPickMode(onPick) {
    pickMode = { onPick };
    buildGrid();
    buildDock();
    const hint = el('div', { class: 'pick-hint' }, 'Коснитесь иконки для выбора (тап здесь — отмена)');
    hint.addEventListener('click', (e) => {
      e.stopPropagation();
      exitPickMode();
      openSettings(root, 'home');
    });
    const overlay = el('div', { class: 'pick-overlay', dataset: { pick: '1' } }, [hint]);
    screen.append(overlay);
  }

  function exitPickMode() {
    pickMode = null;
    screen.querySelector('[data-pick="1"]')?.remove();
    buildGrid();
    buildDock();
  }

  // ============================================================
  //  БЕЙДЖИ
  // ============================================================
  function applyBadges() {
    const all = [...store.get('home.icons'), ...store.get('home.dock')];
    screen.querySelectorAll('.app-icon__badge').forEach((b) => {
      const ic = all.find((x) => x.id === b.dataset.for);
      const badge = ic && ic.badge;

      if (!badge || badge.type === 'none' || (!badge.value && badge.type !== 'dot')) {
        b.style.display = 'none';
        b.classList.remove('badge-dot');
        return;
      }

      if (badge.type === 'dot') {
        b.textContent = '';
        b.classList.add('badge-dot');
      } else {
        b.textContent = String(badge.value);
        b.classList.remove('badge-dot');
      }
      b.style.display = 'flex';
    });
  }

  // ============================================================
  //  СБОРКА И ПОДПИСКИ
  // ============================================================
  buildGrid();
  buildDock();
  screen.append(gridWrap, dock);
  root.append(screen);

  const offPick = bus.on('home:pickIcon', ({ onPick }) => enterPickMode(onPick));
  const offEdit = bus.on('home:enterEdit', () => enterEditMode());

  const offConfig = bus.on(EVENTS.CONFIG_CHANGE, ({ path }) => {
    if (path === '*' || path.startsWith('home')) {
      buildGrid();
      buildDock();
      applyWallpaper(screen);
      applyBadges();
    }
  });

  applyBadges();

  return () => {
    offConfig();
    offPick();
    offEdit();
  };
}

// ============================================================
//  ОБОИ
// ============================================================
function applyWallpaper(screen) {
  const show = store.get('home.showWallpaper');
  const wp = store.get('home.wallpaperThis') || store.get('home.wallpaperGlobal');
  const url = show && wp ? `url("${imgUrl(wp)}")` : 'none';

  // фон самого экрана
  screen.style.backgroundImage = url;

  // дублируем обои на body — чтобы зона статус-бара в PWA
  // заполнялась той же картинкой и на «холодном» старте
  document.body.style.backgroundImage = url;
}