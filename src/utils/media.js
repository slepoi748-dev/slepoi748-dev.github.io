import { storage } from '../core/storage.js';

// Пользовательские изображения хранятся как { id, name, dataUrl }
export function getUserImages() {
  return storage.get('userImages', []);
}

export function addUserImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const list = getUserImages();
      const item = {
        id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: file.name || 'image',
        dataUrl: reader.result,
      };
      list.push(item);
      storage.set('userImages', list);
      resolve(item);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function removeUserImage(id) {
  storage.set('userImages', getUserImages().filter((i) => i.id !== id));
}

// Универсальный резолвер источника картинки.
// Если value начинается с 'user:' — берём dataUrl, иначе это файл из img/.
export function resolveImage(value) {
  if (!value) return '';
  if (value.startsWith('user:')) {
    const id = value.slice(5);
    const found = getUserImages().find((i) => i.id === id);
    return found ? found.dataUrl : '';
  }
  if (value.startsWith('data:')) return value;
  return null; // null = это обычный файл из img/, резолвим через imgUrl
}