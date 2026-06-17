import { el, clear } from '../utils/dom.js';
import { onLongPress } from '../utils/gestures.js';
import { store } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { imgUrl } from '../utils/images.js';
import { openSettings } from './settings.js';

export function renderHomescreen(root) {
  clear(root);

  const screen = el('div', { class: 'screen home' });
  applyWallpaper(screen);

  // --- Слой сетки ---
  const gridWrap = el('div', { class: 'home__grid-wrap' });
  const grid = el('div', { class: 'home__grid' });
  gridWrap.append(grid);

  // --- Dock ---
  const dock = el('div', { class: 'home__dock' });

  function buildGrid() {
    clear(grid);
    const c = store.get('home');

    grid.style.gridTemplateColumns = `repeat(${c.cols}, 1fr)`;
    grid.style.gridAutoRows = `${c.iconSize + 26}px`;
    grid.style.columnGap = `${c.gapX}px`;
    grid.style.rowGap = `${c.gapY}px`;
    grid.style.transform = `translate(${c.offsetX}px, ${c.offsetY}px)`;

    c.icons.forEach((icon) => {
      const node = buildIcon(icon, c);
      node.style.gridColumn = String(icon.col);
      node.style.gridRow = String(icon.row);
      grid.append(node);
    });
  }

  function buildDock() {
    clear(dock);
    const c = store.get('home');
    dock.style.transform = `translateY(${c.dockOffsetY}px)`;
    c.dock.forEach((icon) => dock.append(buildIcon(icon, c)));
  }

  // Создание одной иконки
  function buildIcon(icon, c) {
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

    const badge = el('span', { class: 'app-icon__badge', dataset: { for: icon.id } });

    const label = el('div', { class: 'app-icon__label' }, icon.name || '');
    const node = el('div', { class: 'app-icon', dataset: { id: icon.id } }, [imgNode, badge, label]);

    // Подсветка/нажатие
    node.addEventListener('pointerdown', () => node.classList.add('active'));
    const release = () => node.classList.remove('active');
    node.addEventListener('pointerup', release);
    node.addEventListener('pointerleave', release);
    node.addEventListener('pointercancel', release);

    // Привязка триггера открытия настроек через иконку
    attachIconTrigger(node, icon);

    return node;
  }

  // --- Логика открытия настроек ---
  function attachIconTrigger(node, icon) {
    const c = store.get('home');
    if (!c.openViaIcon || c.triggerIconId !== icon.id) return;

    // Иконка в приоритете. Поведение зависит от второго включённого режима:
    if (c.openLongPress) {
      // зажать иконку
      onLongPress(node, () => openSettings(root, 'home'), () => store.get('home.longPressMs'));
    } else if (c.openMultiTap) {
      // N нажатий по иконке
      attachMultiTap(node, () => openSettings(root, 'home'));
    } else {
      // только иконка-триггер: одиночный тап
      node.addEventListener('click', () => openSettings(root, 'home'));
    }
  }

  // Мульти-тап по элементу
  function attachMultiTap(target, cb) {
    let count = 0, timer = null;
    target.addEventListener('click', () => {
      const c = store.get('home');
      count++;
      clearTimeout(timer);
      if (count >= c.multiTapCount) { count = 0; cb(); return; }
      timer = setTimeout(() => { count = 0; }, c.multiTapWindowMs);
    });
  }

  // Привязка жестов к экрану (когда иконка НЕ в приоритете)
  function attachScreenGestures() {
    const c = store.get('home');
    // Если включён режим иконки — экранные жесты для долгого нажатия/мультитапа
    // переходят на иконку (приоритет). На пустой экран не вешаем.
    const iconHasPriority = c.openViaIcon && c.triggerIconId;

    if (c.openLongPress && !iconHasPriority) {
      onLongPress(gridWrap, () => openSettings(root, 'home'), () => store.get('home.longPressMs'));
    }
    if (c.openMultiTap && !iconHasPriority) {
      attachMultiTap(gridWrap, () => openSettings(root, 'home'));
    }
  }

  // Сборка
  buildGrid();
  buildDock();
  attachScreenGestures();

  screen.append(gridWrap, dock);
  root.append(screen);

  // Реакция на изменения конфига из настроек
  const offConfig = bus.on(EVENTS.CONFIG_CHANGE, ({ path }) => {
    if (path === '*' || path.startsWith('home')) {
      buildGrid();
      buildDock();
      applyWallpaper(screen);
    }
  });

  return () => { offConfig(); };
}

// Фон: фон экрана приоритетнее общего
function applyWallpaper(screen) {
  const show = store.get('home.showWallpaper');
  const thisWp = store.get('home.wallpaperThis');
  const globalWp = store.get('home.wallpaperGlobal');
  const wp = thisWp || globalWp;
  screen.style.backgroundImage = show && wp ? `url("${imgUrl(wp)}")` : 'none';
}