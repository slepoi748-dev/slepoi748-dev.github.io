// Единое состояние приложения + дефолты + reducer-подобные мутации.
import { loadState, saveState } from './storage.js';

let uid = 1;
const id = () => 'i' + (uid++) + Date.now().toString(36);

const DEFAULTS = {
  // --- Lock screen ---
  lock: {
    bg: null,                 // dataURL или путь из img/
    codeLength: 6,            // 4 | 6
    longPressMs: 1000,        // длительность долгого нажатия
    method: 'sos',            // 'sos' | 'attempts' | 'combo'
    sosAttempt: 1,            // на какой попытке после SOS разблокировать
    attemptsToUnlock: 3,      // для method='attempts'
    combo: '1234',            // для method='combo'
  },
  // --- Home ---
  home: {
    commonBg: null,
    cols: 4,
    iconSize: 60,
    iconRadius: 15,
    iconOpacity: 100,
    offX: 0, offY: 0,
    gapX: 14, gapY: 18,
    dockOffsetY: 0,
    badge: { bx: 30, by: -2, bw: 22, bh: 22, radius: 11, fontSize: 12 },
    // вызов настроек
    trigger: { hold: true, multiTap: false, icon: false, holdMs: 1000, tapCount: 2, iconTapCount: 3, iconId: null },
    // показ попыток пароля
    attemptsView: { count: 2, iconIds: [] },
    pages: null,  // заполняется ниже
    dock: null,
  },
  attempts: [],   // история ввода (последние коды)
  _uid: 1,
};

function seed() {
  const folder = (name, items) => ({ id: id(), name, folder: true, items: items.map((i) => ({ id: id(), ...i })), badge: 0 });
  const app = (name, bg, emoji, badge = 0) => ({ id: id(), name, bg, emoji, badge, w: 1, h: 1 });
  DEFAULTS.home.pages = [
    {
      bg: null,
      icons: [
        folder('ФОТО', [{ bg: '#ff5ea0', emoji: '🌸' }, { bg: '#222', emoji: '📷' }, { bg: '#5c6bc0', emoji: '🎨' }]),
        folder('СОЦ.СЕТИ', [{ bg: '#e1306c', emoji: '📷' }, { bg: '#29a9eb', emoji: '✈️' }, { bg: '#25d366', emoji: '💬' }]),
        folder('ВИДЕО', [{ bg: '#ff3b50', emoji: '🎞' }, { bg: '#000', emoji: '✂️' }]),
        folder('STORIES', [{ bg: '#888', emoji: '📖' }, { bg: '#3949ab', emoji: '📰' }]),
        app('SmartHome', '#f5c518', '🏠'),
        app('Т-Банк', '#ffdd2d', 'T'),
        app('HitVPN', '#1a1a1a', '✊'),
        app('ChatGPT', '#fff', '🟢'),
        app('STEPN', '#2ecc71', '👟'),
      ],
    },
  ];
  DEFAULTS.home.dock = [
    app('Телефон', '#34c759', '📞'),
    app('Сообщ.', '#34c759', '💬', 570),
    app('Камера', '#3a3a3c', '📷'),
    app('Почта', '#fff', '✉️', 2738),
  ];
}
seed();

export const state = loadState(DEFAULTS);
if (!state.home.pages) state.home.pages = DEFAULTS.home.pages;
if (!state.home.dock) state.home.dock = DEFAULTS.home.dock;
uid = state._uid || 1;

export function newId() { state._uid = ++uid; return 'i' + uid + Date.now().toString(36); }

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function commit(reason = '') {
  state._uid = uid;
  saveState(state);
  listeners.forEach((fn) => fn(reason));
}

/** Найти иконку по id в страницах/доке/папках. */
export function findIcon(targetId) {
  const { pages, dock } = state.home;
  for (let p = 0; p < pages.length; p++) {
    const i = pages[p].icons.find((x) => x.id === targetId);
    if (i) return { icon: i, container: pages[p].icons, page: p };
    for (const ic of pages[p].icons) {
      if (ic.folder) {
        const f = ic.items.find((x) => x.id === targetId);
        if (f) return { icon: f, container: ic.items, page: p, folder: ic };
      }
    }
  }
  const d = dock.find((x) => x.id === targetId);
  if (d) return { icon: d, container: dock, dock: true };
  return null;
}
