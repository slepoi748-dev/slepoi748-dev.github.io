import { store } from '../core/state.js';

const APP_TAG = 'propphone-config';
const VERSION = 1;

export function exportConfig() {
  return JSON.stringify({ _tag: APP_TAG, _v: VERSION, data: store.getAll() }, null, 2);
}

export function downloadConfig() {
  const text = exportConfig();
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prop-config-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyConfig() {
  try {
    await navigator.clipboard.writeText(exportConfig());
    return true;
  } catch {
    return false;
  }
}

// Применяет конфиг из строки. Возвращает {ok, error}
export function importConfig(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return { ok: false, error: 'Не JSON' }; }

  const payload = parsed && parsed._tag === APP_TAG ? parsed.data : parsed;
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Нет данных' };

  store.replaceAll(payload);
  return { ok: true };
}

export function importConfigFromFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(importConfig(String(reader.result)));
    reader.onerror = () => resolve({ ok: false, error: 'Ошибка чтения' });
    reader.readAsText(file);
  });
}