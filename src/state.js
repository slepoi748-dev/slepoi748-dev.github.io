// Единое состояние приложения + дефолты + reducer-подобные мутации.
import { loadState, saveState } from './storage.js';

let uid = 1;
const id = () => 'i' + (uid++) + Date.now().toString(36);

const DEFAULTS = {
  lock: {
    bg: null,
    codeLength: 6,
    longPressMs: 1000,
    method: 'sos',
    sosAttempt: 1,
    attemptsToUnlock: 3,
    combo: '1234',
  },
  home: {
    commonBg: null,
    cols: 4,
    iconSize: 60,
    iconRadius: 15,
    iconOpacity: 100,
    offX: 0, offY: 0,
    gapX: 14, gapY: 18,
    dockOffsetY: 0,
    editMode: false, // +NEW
    badge: { bx: 30, by: -2, bw: 22, bh: 22, radius: 11, fontSize: 12 },
    trigger: { hold: true, multiTap: false, icon: false, holdMs: 1000, tapCount: 2, tapTimeoutMs: 400, iconTapCount: 3, iconId: null },
    attemptsView: { count: 2, iconIds: [] },
    pages: null,
    dock: null,
  },
  attempts: [],
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

// --- миграция: дополняем недостающие поля у старых сохранений ---
if (!state.home.pages) state.home.pages = DEFAULTS.home.pages;
if (!state.home.dock) state.home.dock = DEFAULTS.home.dock;
if (!state.home.trigger) state.home.trigger = { ...DEFAULTS.home.trigger };
if (state.home.trigger.tapTimeoutMs == null) state.home.trigger.tapTimeoutMs = 400;
if (!state.home.attemptsView) state.home.attemptsView = { count: 2, iconIds: [] };
if (state.home.editMode == null) state.home.editMode = false; // +NEW
state.home.pages.forEach((p) => { if (p.bg === undefined) p.bg = null; });
// --- конец миграции ---

uid = state._uid || 1;

export function newId() { state._uid = ++uid; return 'i' + uid + Date.now().toString(36); }

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function commit(reason = '') {
  state._uid = uid;
  saveState(state);
  listeners.forEach((fn) => fn(reason));
}

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

export function addPage() {
  state.home.pages.push({ bg: null, icons: [] });
  return state.home.pages.length - 1;
}

export function addIcon(pageIndex, iconData) {
  const ic = { id: newId(), name: '', bg: '#3a3a3c', emoji: '📦', badge: 0, w: 1, h: 1, ...iconData };
  state.home.pages[pageIndex].icons.push(ic);
  return ic;
}

export function removeIcon(targetId) {
  const found = findIcon(targetId);
  if (!found) return false;
  const i = found.container.indexOf(found.icon);
  if (i > -1) found.container.splice(i, 1);
  return true;
}