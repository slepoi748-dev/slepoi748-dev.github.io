import { storage } from '../core/storage.js';

// Без Vite: относительный путь к папке img рядом с index.html.
const BASE = './';

export function imgUrl(name) {
  if (!name) return '';
  return `${BASE}img/${name}`;
}

let _cache = null;

export async function loadImageManifest() {
  if (_cache) return _cache;
  try {
    const res = await fetch(imgUrl('manifest.json'), { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    _cache = await res.json();
  } catch (e) {
    console.warn('[images] manifest не загружен, использую кэш/запас', e);
    _cache = storage.get('imageManifest', { wallpapers: [], icons: [] });
  }
  storage.set('imageManifest', _cache);
  return _cache;
}