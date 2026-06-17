// Обёртка хранилища. Мелкие настройки -> localStorage. Картинки -> IndexedDB.

export const KEYS = { STATE: 'app.state.v1' };

export function loadState(def) {
  try {
    const raw = localStorage.getItem(KEYS.STATE);
    return raw ? { ...def, ...JSON.parse(raw) } : structuredClone(def);
  } catch { return structuredClone(def); }
}

let saveTimer = null;
export function saveState(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEYS.STATE, JSON.stringify(state)); }
    catch (e) { console.warn('saveState failed', e); }
  }, 150);
}

// ---- IndexedDB для изображений (data-URL) ----
const DB_NAME = 'app.images', STORE = 'imgs';
let dbPromise = null;
function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbPromise;
}
export async function putImage(id, dataUrl) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(dataUrl, id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
export async function getImage(id) {
  if (!id) return null;
  const d = await db();
  return new Promise((res) => {
    const tx = d.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(id);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => res(null);
  });
}
export async function delImage(id) {
  if (!id) return;
  const d = await db();
  const tx = d.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
}

/** Прочитать File -> dataURL */
export function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
