import { storage } from './storage.js';
import { bus, EVENTS } from './events.js';

const DEFAULT_CONFIG = {
  lock: {
    digits: 4,                 // 4 или 6
    longPressMs: 1000,         // длительность долгого нажатия (мс)

    // Режимы разблокировки:
    // 'afterSos'      — после нажатия SOS пускает с N-й попытки
    // 'afterAttempts' — пускает после N попыток любым кодом
    // 'secret'        — пускает только по секретной комбинации
    unlockMode: 'afterSos',

    sosUnlockAttempt: 1,       // с какой попытки после SOS открыть (1 = сразу)
    attemptsToUnlock: 3,       // для режима afterAttempts
    secretCode: '0000',        // для режима secret

    showWallpaper: true,
    wallpaper: 'moon.jpg',
  },
  meta: { version: 1 },
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