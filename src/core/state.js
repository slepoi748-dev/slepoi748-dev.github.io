// src/core/state.js
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
    hintTitle: 'Смахните вверх для Face ID\nили введите код-пароль',
    padOffsetX: 0,
    padOffsetY: 0,
    keySize: 75,
    keyFontSize: 32,
  },

  home: {
    showWallpaper: true,
    wallpaperGlobal: 'moon.jpg',
    wallpaperThis: '',
    editGesture: 'longpress',
    openLongPress: true,
    openMultiTap: false,
    openViaIcon: false,
    longPressMs: 1000,
    multiTapCount: 3,
    multiTapWindowMs: 600,
    triggerIconId: '',
    cols: 4,
    rows: 6,
    gapX: 18,
    gapY: 22,
    offsetX: 0,
    offsetY: 0,
    iconSize: 60,
    iconRadius: 14,
    iconOpacity: 1,
    dockOffsetY: 0,

    badges: {
      enabled: false,
      mode: 'whole',
      keepCount: 3,
      onlySuccess: false,
      receivers: [],
      history: [],
    },

    icons: [
      { id: 'i1', name: 'Сообщения', img: 'social.png', col: 1, row: 1 },
      { id: 'i2', name: 'Фото',      img: 'photos.png', col: 2, row: 1 },
      { id: 'i3', name: 'Видео',     img: 'video.png',  col: 3, row: 1 },
    ],
    dock: [
      { id: 'd1', name: 'Телефон', img: 'social.png' },
      { id: 'd2', name: 'Камера',  img: 'photos.png' },
      { id: 'd3', name: 'Заметки', img: 'video.png' },
      { id: 'd4', name: 'Музыка',  img: 'social.png' },
    ],
  },

  meta: { version: 3 },
};

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(base, override) {
  if (Array.isArray(override)) return override.slice();
  if (override && typeof override === 'object') {
    const out = { ...base };
    for (const k of Object.keys(override)) {
      out[k] = (base && typeof base[k] === 'object' && base[k] !== null)
        ? deepMerge(base[k], override[k])
        : override[k];
    }
    return out;
  }
  return override;
}

class Store {
  constructor() {
    const saved = storage.get('config', null);
    this.config = saved
      ? deepMerge(DEFAULT_CONFIG, saved)
      : structuredCloneSafe(DEFAULT_CONFIG);
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

  persist() {
    storage.set('config', this.config);
  }

  reset() {
    this.config = structuredCloneSafe(DEFAULT_CONFIG);
    this.persist();
    bus.emit(EVENTS.CONFIG_CHANGE, { path: '*', value: this.config });
  }

  getAll() {
    return structuredCloneSafe(this.config);
  }

  replaceAll(next) {
    this.config = deepMerge(structuredCloneSafe(DEFAULT_CONFIG), next);
    this.persist();
    bus.emit(EVENTS.CONFIG_CHANGE, { path: '*', value: this.config });
  }
}

const store = new Store();
export { store };