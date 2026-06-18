// src/screens/settings.js
import { el, clear } from '../utils/dom.js';
import { store } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { loadImageManifest } from '../utils/images.js';
import { addUserImage, getUserImages } from '../utils/media.js';
import { downloadConfig, copyConfig, importConfig, importConfigFromFile } from '../utils/config-io.js';

let overlayEl = null;
let lastRoot = null;
let lastSection = null;

export async function openSettings(root, section = 'lock') {
  if (overlayEl) return;
  lastRoot = root; lastSection = section;
  const manifest = await loadImageManifest();

  overlayEl = el('div', { class: 'settings-overlay settings-overlay--see-through' });
  const head = el('div', { class: 'settings-head' }, [
    el('h1', {}, 'Настройки'),
    el('button', { class: 'settings-close', onClick: closeSettings }, '✕'),
  ]);
  const body = el('div', { class: 'settings-body' });

  if (section === 'lock') body.append(buildLockSection(manifest));
  else if (section === 'home') body.append(buildHomeSection(manifest));

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

  frag.append(group('Экран блокировки', [
    rowTextarea('Текст подсказки', 'lock.hintTitle'),
    rowSelect('Количество знаков', 'lock.digits', [
      { value: 4, label: '4 знака' },
      { value: 6, label: '6 знаков' },
    ], Number),
    rowNumber('Длительность долгого нажатия (мс)', 'lock.longPressMs', { min: 300, max: 3000, step: 100 }),
  ]));

  frag.append(group('Клавиатура', [
    rowRange('Сдвиг по горизонтали', 'lock.padOffsetX', { min: -100, max: 100, step: 1, unit: 'px' }),
    rowRange('Сдвиг по вертикали', 'lock.padOffsetY', { min: -150, max: 150, step: 1, unit: 'px' }),
    rowRange('Размер кнопок', 'lock.keySize', { min: 50, max: 100, step: 1, unit: 'px' }),
    rowRange('Размер цифр', 'lock.keyFontSize', { min: 20, max: 48, step: 1, unit: 'px' }),
  ]));

  const modeRows = [
    rowSelect('Способ разблокировки', 'lock.unlockMode', [
      { value: 'afterSos', label: 'После SOS' },
      { value: 'afterAttempts', label: 'После N попыток' },
      { value: 'secret', label: 'Секретный код' },
    ], String),
  ];
  modeRows.push(rowNumber('SOS: с какой попытки открыть', 'lock.sosUnlockAttempt', { min: 1, max: 10, step: 1 }));
  modeRows.push(rowNumber('Открыть после N попыток', 'lock.attemptsToUnlock', { min: 1, max: 20, step: 1 }));
  modeRows.push(rowText('Секретный код', 'lock.secretCode'));
  frag.append(group('Разблокировка', modeRows));

  const wpOptions = [{ value: '', label: 'Нет' }, ...(manifest.wallpapers || []).map((w) => ({ value: w, label: w }))];
  frag.append(group('Фон', [
    rowSwitch('Показывать фон', 'lock.showWallpaper'),
    rowSelect('Изображение фона', 'lock.wallpaper', wpOptions, String),
  ]));

  return frag;
}

// ---------- Раздел «Рабочий стол» ----------
function buildHomeSection(manifest) {
  const frag = document.createDocumentFragment();
  const wpOptions = buildImageOptions(manifest.wallpapers || []);

  frag.append(group('Конфигурация', [
    rowButton('Сохранить в файл', 'Экспорт', () => downloadConfig()),
    rowButton('Скопировать', 'Копировать', async () => {
      const ok = await copyConfig();
      toast(ok ? 'Скопировано' : 'Не удалось');
    }),
    rowButton('Загрузить из файла', 'Импорт', () => importFilePicker()),
    rowButton('Вставить из буфера', 'Вставить', async () => {
      try {
        const text = await navigator.clipboard.readText();
        const res = importConfig(text);
        toast(res.ok ? 'Импортировано' : `Ошибка: ${res.error}`);
        if (res.ok) closeSettings();
      } catch { toast('Буфер недоступен'); }
    }),
  ]));

  frag.append(group('Открытие настроек', [
    rowSwitch('Долгое нажатие на экран', 'home.openLongPress'),
    rowNumber('Длительность нажатия (мс)', 'home.longPressMs', { min: 300, max: 3000, step: 100 }),
    rowSwitch('N тапов по экрану', 'home.openMultiTap'),
    rowNumber('Количество тапов', 'home.multiTapCount', { min: 2, max: 10, step: 1 }),
    rowNumber('Окно между тапами (мс)', 'home.multiTapWindowMs', { min: 200, max: 1500, step: 50 }),
    rowSwitch('Назначенная иконка (приоритет)', 'home.openViaIcon'),
    rowPickIcon('Иконка-триггер', 'home.triggerIconId'),
  ]));

  frag.append(group('Рабочий стол', [
    rowButton('Редактировать иконки', 'Открыть', () => {
      closeSettings();
      bus.emit('home:enterEdit');
    }),
  ]));

  // --- Бейджи (последние пароли) ---
  frag.append(group('Бейджи (последние пароли)', [
    rowSwitch('Включить бейджи', 'home.badges.enabled'),
    rowSelect('Режим', 'home.badges.mode', [
      { value: 'whole',  label: 'Код целиком' },
      { value: 'digits', label: 'По одной цифре' },
    ], String),
    rowNumber('Сколько кодов хранить', 'home.badges.keepCount', { min: 1, max: 12, step: 1 }),
    rowSwitch('Только успешные вводы', 'home.badges.onlySuccess'),
    rowPickReceivers('Иконки-приёмники', 'home.badges.receivers'),
    rowButton('Очистить историю', 'Очистить', () => {
      store.set('home.badges.history', []);
      toast('История очищена');
    }),
  ]));

  frag.append(group('Фон', [
    rowSwitch('Показывать фон', 'home.showWallpaper'),
    rowImage('Общий фон', 'home.wallpaperGlobal', wpOptions),
    rowImage('Фон этого экрана', 'home.wallpaperThis', wpOptions),
  ]));

  frag.append(group('Сетка и иконки', [
    rowNumber('Колонок', 'home.cols', { min: 2, max: 8, step: 1 }),
    rowNumber('Строк', 'home.rows', { min: 2, max: 10, step: 1 }),
    rowRange('Отступ по горизонтали', 'home.gapX', { min: 0, max: 60, step: 1, unit: 'px' }),
    rowRange('Отступ по вертикали', 'home.gapY', { min: 0, max: 60, step: 1, unit: 'px' }),
    rowRange('Сдвиг по горизонтали', 'home.offsetX', { min: -100, max: 100, step: 1, unit: 'px' }),
    rowRange('Сдвиг по вертикали', 'home.offsetY', { min: -100, max: 200, step: 1, unit: 'px' }),
    rowRange('Размер иконки', 'home.iconSize', { min: 40, max: 90, step: 1, unit: 'px' }),
    rowRange('Закругление', 'home.iconRadius', { min: 0, max: 45, step: 1, unit: 'px' }),
    rowRange('Прозрачность иконок', 'home.iconOpacity', { min: 0, max: 1, step: 0.05 }),
  ]));

  frag.append(group('Dock', [
    rowRange('Смещение Dock по вертикали', 'home.dockOffsetY', { min: -120, max: 60, step: 1, unit: 'px' }),
  ]));

  return frag;
}

// Слайдер с живым обновлением
function rowRange(label, path, { min, max, step, unit = '' } = {}) {
  const valueLabel = el('span', { class: 's-row__sub' });
  const input = el('input', { type: 'range', min, max, step, value: store.get(path) });
  const fmt = (v) => `${Number.isInteger(+v) ? v : (+v).toFixed(2)}${unit}`;
  valueLabel.textContent = fmt(input.value);
  input.addEventListener('input', () => {
    valueLabel.textContent = fmt(input.value);
    store.set(path, Number(input.value));
  });
  const left = el('div', {}, [el('div', { class: 's-row__label' }, label), valueLabel]);
  const right = el('div', { class: 's-control' }, input);
  return el('div', { class: 's-row' }, [left, right]);
}

function importFilePicker() {
  const input = el('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    if (!f) return;
    const res = await importConfigFromFile(f);
    toast(res.ok ? 'Импортировано' : `Ошибка: ${res.error}`);
    if (res.ok) closeSettings();
  });
  document.body.append(input);
  input.click();
  setTimeout(() => input.remove(), 1000);
}

let toastTimer = null;
function toast(text) {
  let t = document.querySelector('.app-toast');
  if (!t) {
    t = el('div', { class: 'app-toast' });
    document.querySelector('.screen')?.append(t) || document.body.append(t);
  }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
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
  const left = el('div', { class: 's-row__left' }, [
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

// Многострочный текст (для подсказки локскрина с переносом \n)
function rowTextarea(label, path) {
  const input = el('textarea', { rows: 2, style: { resize: 'vertical', width: '100%' } });
  input.value = store.get(path) ?? '';
  input.addEventListener('change', () => store.set(path, input.value));
  const left = el('div', { class: 's-row__left' }, el('div', { class: 's-row__label' }, label));
  const control = el('div', { class: 's-control' }, input);
  return el('div', { class: 's-row' }, [left, control]);
}

function rowSwitch(label, path) {
  const checkbox = el('input', { type: 'checkbox' });
  checkbox.checked = !!store.get(path);
  checkbox.addEventListener('change', () => store.set(path, checkbox.checked));
  const sw = el('label', { class: 'switch' }, [checkbox, el('span', { class: 'track' })]);
  return rowBase(label, sw);
}

// Список опций картинок: из img/ + пользовательские
function buildImageOptions(manifestList) {
  const opts = [{ value: '', label: 'Нет' }];
  manifestList.forEach((w) => opts.push({ value: w, label: w }));
  getUserImages().forEach((u) => opts.push({ value: `user:${u.id}`, label: `${u.name} (загружено)` }));
  return opts;
}

// Выбор картинки: select + кнопка загрузки с устройства
function rowImage(label, path, options) {
  const select = el('select');
  const fill = () => {
    clear(select);
    options.forEach((o) => {
      const opt = el('option', { value: o.value }, o.label);
      if (String(o.value) === String(store.get(path))) opt.selected = true;
      select.append(opt);
    });
  };
  fill();
  select.addEventListener('change', () => store.set(path, select.value));

  const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  const uploadBtn = el('button', { class: 's-btn' }, 'Загрузить');
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const item = await addUserImage(file);
    options.push({ value: `user:${item.id}`, label: `${item.name} (загружено)` });
    store.set(path, `user:${item.id}`);
    fill();
  });

  const control = el('div', { class: 's-control', style: { gap: '8px' } }, [select, uploadBtn, fileInput]);
  const left = el('div', { class: 's-row__left' }, el('div', { class: 's-row__label' }, label));
  return el('div', { class: 's-row' }, [left, control]);
}

function rowButton(label, btnText, onClick) {
  const btn = el('button', { class: 's-btn' }, btnText);
  btn.addEventListener('click', onClick);
  const left = el('div', { class: 's-row__left' }, el('div', { class: 's-row__label' }, label));
  const control = el('div', { class: 's-control' }, btn);
  return el('div', { class: 's-row' }, [left, control]);
}

// Выбор одной иконки тапом по рабочему столу
function rowPickIcon(label, path) {
  const sub = el('div', { class: 's-row__sub' });
  const updateSub = () => {
    const id = store.get(path);
    sub.textContent = id ? `Выбрано: ${id}` : 'Не выбрано';
  };
  updateSub();

  const btn = el('button', { class: 's-btn' }, 'Выбрать на экране');
  btn.addEventListener('click', () => {
    const root = lastRoot;
    closeSettings();
    bus.emit('home:pickIcon', {
      onPick: (iconId) => {
        store.set(path, iconId);
        openSettings(root, 'home');
      },
    });
  });

  const left = el('div', { class: 's-row__left' }, [el('div', { class: 's-row__label' }, label), sub]);
  const control = el('div', { class: 's-control' }, btn);
  return el('div', { class: 's-row' }, [left, control]);
}

// Выбор НЕСКОЛЬКИХ иконок-приёмников по порядку (тапами на экране)
function rowPickReceivers(label, path) {
  const sub = el('div', { class: 's-row__sub' });
  const render = () => {
    const arr = store.get(path) || [];
    sub.textContent = arr.length ? `Выбрано (${arr.length}): ${arr.join(', ')}` : 'Не выбрано';
  };
  render();

  const addBtn = el('button', { class: 's-btn' }, 'Добавить иконку');
  addBtn.addEventListener('click', () => {
    const root = lastRoot;
    closeSettings();
    bus.emit('home:pickIcon', {
      onPick: (iconId) => {
        const arr = (store.get(path) || []).slice();
        arr.push(iconId);
        store.set(path, arr);
        openSettings(root, 'home');
      },
    });
  });

  const clearBtn = el('button', { class: 's-btn' }, 'Сброс');
  clearBtn.addEventListener('click', () => {
    store.set(path, []);
    render();
  });

  const left = el('div', { class: 's-row__left' }, [el('div', { class: 's-row__label' }, label), sub]);
  const control = el('div', { class: 's-control', style: { gap: '8px' } }, [addBtn, clearBtn]);
  return el('div', { class: 's-row' }, [left, control]);
}