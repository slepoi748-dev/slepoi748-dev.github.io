import { el, clear } from '../utils/dom.js';
import { store } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { loadImageManifest } from '../utils/images.js';

let overlayEl = null;

export async function openSettings(root, section = 'lock') {
  if (overlayEl) return; // уже открыто

  const manifest = await loadImageManifest();

  overlayEl = el('div', { class: 'settings-overlay' });

  const head = el('div', { class: 'settings-head' }, [
    el('h1', {}, 'Настройки'),
    el('button', { class: 'settings-close', onClick: closeSettings }, '✕'),
  ]);

  const body = el('div', { class: 'settings-body' });

  if (section === 'lock') {
    body.append(buildLockSection(manifest));
  }

  overlayEl.append(head, body);
  root.append(overlayEl);
  bus.emit(EVENTS.SETTINGS_OPEN, { section });
}

export function closeSettings() {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  bus.emit(EVENTS.SETTINGS_CLOSE);
}

// ---------- Раздел «Экран блокировки» ----------
function buildLockSection(manifest) {
  const frag = document.createDocumentFragment();

  // Группа: основное
  frag.append(group('Экран блокировки', [
    rowSelect('Количество знаков', 'lock.digits', [
      { value: 4, label: '4 знака' },
      { value: 6, label: '6 знаков' },
    ], Number),

    rowNumber('Длительность долгого нажатия (мс)', 'lock.longPressMs', { min: 300, max: 3000, step: 100 }),
  ]));

  // Группа: режим разблокировки
  const modeRows = [
    rowSelect('Способ разблокировки', 'lock.unlockMode', [
      { value: 'afterSos', label: 'После SOS' },
      { value: 'afterAttempts', label: 'После N попыток' },
      { value: 'secret', label: 'Секретный код' },
    ], String),
  ];

  // Зависимые поля (показываем все, чтобы фокуснику было удобно настроить заранее)
  modeRows.push(rowNumber('SOS: с какой попытки открыть', 'lock.sosUnlockAttempt', { min: 1, max: 10, step: 1 }));
  modeRows.push(rowNumber('Открыть после N попыток', 'lock.attemptsToUnlock', { min: 1, max: 20, step: 1 }));
  modeRows.push(rowText('Секретный код', 'lock.secretCode'));

  frag.append(group('Разблокировка', modeRows));

  // Группа: фон
  const wpOptions = [{ value: '', label: 'Нет' }, ...(manifest.wallpapers || []).map((w) => ({ value: w, label: w }))];
  frag.append(group('Фон', [
    rowSwitch('Показывать фон', 'lock.showWallpaper'),
    rowSelect('Изображение фона', 'lock.wallpaper', wpOptions, String),
  ]));

  return frag;
}

// ---------- Конструкторы UI-элементов ----------
function group(title, rows) {
  const wrap = el('div');
  wrap.append(el('p', { class: 's-group__title' }, title));
  const box = el('div', { class: 's-group' }, rows);
  wrap.append(box);
  return wrap;
}

function rowBase(label, controlNode, sub) {
  const left = el('div', {}, [
    el('div', { class: 's-row__label' }, label),
    sub ? el('div', { class: 's-row__sub' }, sub) : null,
  ]);
  const right = el('div', { class: 's-control' }, controlNode);
  return el('div', { class: 's-row' }, [left, right]);
}

function rowSelect(label, path, options, cast = String) {
  const select = el('select');
  const cur = store.get(path);
  options.forEach((o) => {
    const opt = el('option', { value: o.value }, o.label);
    if (String(o.value) === String(cur)) opt.selected = true;
    select.append(opt);
  });
  select.addEventListener('change', () => store.set(path, cast(select.value)));
  return rowBase(label, select);
}

function rowNumber(label, path, { min, max, step } = {}) {
  const input = el('input', {
    type: 'number',
    value: store.get(path),
    ...(min != null ? { min } : {}),
    ...(max != null ? { max } : {}),
    ...(step != null ? { step } : {}),
  });
  input.addEventListener('change', () => {
    let v = Number(input.value);
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    input.value = v;
    store.set(path, v);
  });
  return rowBase(label, input);
}

function rowText(label, path) {
  const input = el('input', { type: 'text', value: store.get(path) ?? '' });
  input.addEventListener('change', () => store.set(path, input.value));
  return rowBase(label, input);
}

function rowSwitch(label, path) {
  const checkbox = el('input', { type: 'checkbox' });
  checkbox.checked = !!store.get(path);
  checkbox.addEventListener('change', () => store.set(path, checkbox.checked));
  const sw = el('label', { class: 'switch' }, [checkbox, el('span', { class: 'track' })]);
  return rowBase(label, sw);
}