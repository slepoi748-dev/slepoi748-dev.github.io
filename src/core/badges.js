// src/core/badges.js
import { store } from './state.js';
import { bus, EVENTS } from './events.js';

// Подписка на ввод кода — пополняем историю.
// Вызывать ОДИН раз при старте приложения.
let inited = false;

export function initBadges() {
  if (inited) return;
  inited = true;

  bus.on(EVENTS.PASSCODE_ENTERED, ({ code, success }) => {
    const cfg = store.get('home.badges');
    if (!cfg || !cfg.enabled) return;
    if (cfg.onlySuccess && !success) return;
    pushCode(code);
  });
}

// Добавить код в начало истории, обрезать по keepCount (минимум 1).
export function pushCode(code) {
  const cfg = store.get('home.badges') || {};
  const keep = Math.max(1, Number(cfg.keepCount) || 1);
  const history = Array.isArray(cfg.history) ? cfg.history.slice() : [];
  history.unshift({ code: String(code), ts: Date.now() });
  history.length = Math.min(history.length, keep);
  store.set('home.badges.history', history);
}

export function clearHistory() {
  store.set('home.badges.history', []);
}

// Вычислить, что показать на каждой иконке-приёмнике.
// Возвращает Map<iconId, string> — текст бейджа.
export function computeBadgeMap() {
  const cfg = store.get('home.badges') || {};
  const result = new Map();
  if (!cfg.enabled) return result;

  const receivers = Array.isArray(cfg.receivers) ? cfg.receivers : [];
  const history = Array.isArray(cfg.history) ? cfg.history : [];
  if (!receivers.length || !history.length) return result;

  if (cfg.mode === 'digits') {
    // Самый свежий код раскидываем по цифрам на иконки по порядку
    const latest = history[0]?.code ?? '';
    const digits = String(latest).split('');
    receivers.forEach((iconId, i) => {
      if (digits[i] != null) result.set(iconId, digits[i]);
    });
  } else {
    // 'whole': i-я иконка показывает i-й по свежести код целиком
    receivers.forEach((iconId, i) => {
      const item = history[i];
      if (item) result.set(iconId, String(item.code));
    });
  }

  return result;
}