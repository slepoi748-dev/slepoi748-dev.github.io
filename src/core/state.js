import { storage } from './storage.js';
import { bus, EVENTS } from './events.js';

const DEFAULT_CONFIG = {
  lock: {
    digits: 4,
    longPressMs: 1000,
    unlockMode: 'afterSos',
    sosUnlockAttempt: 1,
    attemptsToUnlock: 3,
    secretCode: '0000',
    showWallpaper: true,
    wallpaper: 'moon.jpg',
  },

  home: {
    // Фоны
    showWallpaper: true,
    wallpaperGlobal: 'moon.jpg',   // общий фон
    wallpaperThis: '',             // фон именно этого экрана (приоритетнее общего)

    // Способы открытия настроек (можно несколько одновременно):
    openLongPress: true,           // долгое нажатие на экран
    openMultiTap: false,           // N тапов по экрану
    openViaIcon: false,            // назначенная иконка (имеет приоритет)
    longPressMs: 1000,             // длительность долгого нажатия
    multiTapCount: 3,              // сколько тапов
    multiTapWindowMs: 600,         // окно между тапами
    triggerIconId: '',             // id иконки-триггера

    // Сетка
    cols: 4,
    rows: 6,
    gapX: 18,                      // расстояние по горизонтали (px)
    gapY: 22,                      // расстояние по вертикали (px)
    offsetX: 0,                    // сдвиг сетки по горизонтали (px)
    offsetY: 0,                    // сдвиг сетки по вертикали (px)
    iconSize: 60,                  // размер иконки (px)
    iconRadius: 14,                // закругление (px)
    iconOpacity: 1,                // прозрачность иконок (0..1)

    // Dock
    dockOffsetY: 0,                // смещение дока по вертикали (px)

    // Иконки рабочего стола: позиция grid (col,row), 1-based
    icons: [
      { id: 'i1', name: 'Сообщения', img: 'social.png', col: 1, row: 1 },
      { id: 'i2', name: 'Фото',      img: 'photos.png', col: 2, row: 1 },
      { id: 'i3', name: 'Видео',     img: 'video.png',  col: 3, row: 1 },
    ],
    // Иконки в доке
    dock: [
      { id: 'd1', name: 'Телефон', img: 'social.png' },
      { id: 'd2', name: 'Камера',  img: 'photos.png' },
      { id: 'd3', name: 'Заметки', img: 'video.png' },
      { id: 'd4', name: 'Музыка',  img: 'social.png' },
    ],
  },

  meta: { version: 2 },
};

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(patch || {})) {
    const v = patch[key];
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[key] === 'object') {
      out[key] = deepMerge(out[key], v);
    } else {
      out[key] = v;
    }
  }
  return out;
}

class Store {
  constructor() {
    const saved = storage.get('config', null);
    this.config = saved ? deepMerge(DEFAULT_CONFIG, saved) : structuredClone(DEFAULT_CONFIG);
  }
  get(path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), this.config);
  }
  set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] ??= {}), this.config);
    target[last] = value;
    this.persist();
    bus.emit(EVENTS.CONFIG_CHANGE, { path, value });
  }
  persist() { storage.set('config', this.config); }
  reset() {
    this.config = structuredClone(DEFAULT_CONFIG);
    this.persist();
    bus.emit(EVENTS.CONFIG_CHANGE, { path: '*', value: this.config });
  }
}

export const store = new Store();