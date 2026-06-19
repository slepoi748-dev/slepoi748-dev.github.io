import { storage } from '../core/storage.js';
import { resolveImage } from './media.js';

const BASE = './';

export function imgUrl(name) {
  if (!name) return '';
  const resolved = resolveImage(name);
  if (resolved !== null) return resolved; // user: или data:
  return `${BASE}img/${name}`;            // файл из img/
}

let _cache = null;

export async function loadImageManifest() {
  if (_cache) return _cache;
  try {
    const res = await fetch(imgUrl('manifest.json'), { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    _cache = await res.json();
  } catch (e) {
    console.warn('[images] manifest не загружен', e);
    _cache = storage.get('imageManifest', { wallpapers: [], icons: [] });
  }
  storage.set('imageManifest', _cache);
  return _cache;
}