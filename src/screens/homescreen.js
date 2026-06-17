import { el, clear } from '../utils/dom.js';
import { onLongPress } from '../utils/gestures.js';
import { store } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { imgUrl } from '../utils/images.js';
import { openSettings } from './settings.js';

let pickMode = null; // { onPick(iconId) } когда выбираем иконку тапом

export function renderHomescreen(root) {
  clear(root);

  const screen = el('div', { class: 'screen home' });
  applyWallpaper(screen);

  const gridWrap = el('div', { class: 'home__grid-wrap' });
  const grid = el('div', { class: 'home__grid' });
  gridWrap.append(grid);

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

  function buildIcon(icon, c) {
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
    const node = el('div', { class: 'app-icon', dataset: { id: icon.id } }, [imgNode, badge, label]);

    node.addEventListener('pointerdown', () => node.classList.add('active'));
    const release = () => node.classList.remove('active');
    node.addEventListener('pointerup', release);
    node.addEventListener('pointerleave', release);
    node.addEventListener('pointercancel', release);

    // Режим выбора иконки (правка 4)
    if (pickMode) node.classList.add('pickable');

    node.addEventListener('click', (e) => {
      if (pickMode) {
        e.stopPropagation();
        const cb = pickMode.onPick;
        exitPickMode();
        cb(icon.id);
        return;
      }
      handleIconClick(icon);
    });

    // Иконка-триггер: зажать (если включено долгое нажатие)
    const cfg = store.get('home');
    if (cfg.openViaIcon && cfg.triggerIconId === icon.id && cfg.openLongPress) {
      onLongPress(node, () => openSettings(root, 'home'), () => store.get('home.longPressMs'));
    }

    return node;
  }

  // Клик по иконке: учитываем режим иконки-триггера с N-тапов
  function handleIconClick(icon) {
    const c = store.get('home');
    if (c.openViaIcon && c.triggerIconId === icon.id) {
      if (c.openMultiTap) {
        registerTap('icon', () => openSettings(root, 'home'));
        return;
      }
      if (!c.openLongPress) {
        // только иконка-триггер, одиночный тап
        openSettings(root, 'home');
        return;
      }
    }
    // обычный клик по приложению — пока ничего
  }

  // --- Счётчик тапов (правка 2) ---
  let tapCount = 0, tapTimer = null, tapSource = null;
  function registerTap(source, cb) {
    const c = store.get('home');
    if (tapSource && tapSource !== source) { tapCount = 0; }
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

    // --- Жесты экрана ---
  // Долгое нажатие открывает настройки ТОЛЬКО если включён соответствующий тумблер
  onLongPress(gridWrap, () => {
    if (pickMode) return;
    if (!store.get('home.openLongPress')) return;   // ← проверка флага

    // Если иконка-триггер в приоритете и её режим — долгое нажатие,
    // то долгое нажатие на пустой экран НЕ открывает настройки (открывает только зажатие иконки)
    const c = store.get('home');
    if (c.openViaIcon && c.triggerIconId) return;    // приоритет у иконки

    openSettings(root, 'home');
  }, () => store.get('home.longPressMs'));
  // N тапов по пустому экрану (правка 2)
  gridWrap.addEventListener('click', () => {
    if (pickMode) return;
    const c = store.get('home');
    if (c.openMultiTap) registerTap('screen', () => openSettings(root, 'home'));
  });

  buildGrid();
  buildDock();
  screen.append(gridWrap, dock);
  root.append(screen);

  // Запрос на выбор иконки (из настроек)
  const offPick = bus.on('home:pickIcon', ({ onPick }) => {
    enterPickMode(onPick);
  });

  function enterPickMode(onPick) {
    pickMode = { onPick };
    buildGrid(); buildDock();
    const overlay = el('div', { class: 'pick-overlay' }, [
      el('div', { class: 'pick-hint' }, 'Коснитесь иконки для выбора'),
    ]);
    overlay.dataset.pick = '1';
    screen.append(overlay);
  }
  function exitPickMode() {
    pickMode = null;
    screen.querySelector('[data-pick="1"]')?.remove();
    buildGrid(); buildDock();
  }

  const offConfig = bus.on(EVENTS.CONFIG_CHANGE, ({ path }) => {
    if (path === '*' || path.startsWith('home')) {
      buildGrid(); buildDock(); applyWallpaper(screen);
    }
  });

  return () => { offConfig(); offPick(); };
}

function applyWallpaper(screen) {
  const show = store.get('home.showWallpaper');
  const wp = store.get('home.wallpaperThis') || store.get('home.wallpaperGlobal');
  screen.style.backgroundImage = show && wp ? `url("${imgUrl(wp)}")` : 'none';
}