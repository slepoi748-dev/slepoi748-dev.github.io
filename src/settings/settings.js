// Панель настроек. Два раздела: Экран блокировки / Рабочий стол.
import { el, clear } from '../utils/dom.js';
import { state, commit } from '../state.js';

export function createSettings({ home, onClose }) {
  const root = el('div', { class: 'settings', hidden: true });
  const sheet = el('div', { class: 'settings__sheet' });
  root.append(sheet);

  let activeTab = 'lock'; // 'lock' | 'home'

  // --- генераторы строк ---
  const slider = (label, min, max, get, set, unit = 'px') => {
    const v = el('span', { text: get() + unit });
    const inp = el('input', {
      type: 'range', class: 'slider', min, max, value: get(),
      on: { input: (e) => { set(parseInt(e.target.value)); v.textContent = get() + unit; commit('set'); home.render(); } },
    });
    return el('div', { class: 'srow' }, [el('div', { class: 'srow__lbl' }, [label, v]), inp]);
  };
  const toggle = (label, get, set) => {
    const t = el('div', { class: 'toggle' + (get() ? ' on' : '') });
    return el('div', { class: 'trow', on: { click: () => { set(!get()); t.classList.toggle('on', get()); commit('set'); home.render(); } } },
      [el('span', { class: 'trow__txt', text: label }), t]);
  };
  const section = (title, body) => {
    const sec = el('div', { class: 'sec' });
    const head = el('div', { class: 'sec__head' }, [el('span', { text: title }), el('span', { class: 'sec__chev', text: '›' })]);
    head.addEventListener('click', () => sec.classList.toggle('open'));
    sec.append(head, el('div', { class: 'sec__body' }, [el('div', { class: 'sec__inner' }, body)]));
    return sec;
  };
  function secRow(label, getMs, setMs) {
    const inp = el('input', {
      type: 'number', min: 0.2, step: 0.1, value: (getMs() / 1000).toFixed(1), class: 'numinp',
      inputmode: 'decimal',
      on: { change: (e) => {
        let s = parseFloat(e.target.value);
        if (isNaN(s) || s < 0.2) s = 0.2;
        setMs(Math.round(s * 1000)); e.target.value = s.toFixed(1);
        commit('set'); home.render();
      } },
    });
    return el('div', { class: 'srow' }, [el('span', { class: 'srow__txt', text: label }), el('div', { class: 'sec-input' }, [inp, el('span', { class: 'sec-unit', text: 'сек' })])]);
  }

  function markSeg(e) {
    [...e.target.parentElement.children].forEach((c) => c.classList.remove('on'));
    e.target.classList.add('on');
  }
  function numRow(label, get, set) {
    const inp = el('input', { type: 'number', min: 1, value: get(), class: 'numinp',
      on: { change: (e) => { set(Math.max(1, parseInt(e.target.value) || 1)); commit('lock'); } } });
    return el('div', { class: 'srow' }, [el('span', { class: 'srow__txt', text: label }), inp]);
  }
  function textRow(label, get, set) {
    const inp = el('input', { type: 'text', value: get(), class: 'txtinp',
      on: { change: (e) => { set(e.target.value); commit('lock'); } } });
    return el('div', { class: 'srow' }, [el('span', { class: 'srow__txt', text: label }), inp]);
  }
  function allIcons() {
    const out = [];
    state.home.pages.forEach((p) => p.icons.forEach((i) => { out.push(i); if (i.folder) i.items.forEach((x) => out.push(x)); }));
    state.home.dock.forEach((i) => out.push(i));
    return out;
  }

  // выбор ОДНОЙ иконки тапом
  function pickIconVisual(label, get, set) {
    const grid = el('div', { class: 'iconpick' });
    const noneBtn = el('button', { class: 'iconpick__none' + (!get() ? ' on' : ''), text: 'нет' });
    noneBtn.addEventListener('click', () => { set(null); commit('set'); rebuild(get, set, grid, noneBtn, false); });
    grid.append(noneBtn);
    allIcons().forEach((i) => grid.append(iconTile(i, () => get() === i.id, () => {
      set(i.id); commit('set'); rebuild(get, set, grid, noneBtn, false);
    })));
    return el('div', { class: 'srow srow--col' }, [el('span', { class: 'srow__txt', text: label }), grid]);
  }
  // выбор НЕСКОЛЬКИХ иконок тапом
  function pickIconsVisual(label, get, set) {
    const grid = el('div', { class: 'iconpick' });
    allIcons().forEach((i) => grid.append(iconTile(i, () => get().includes(i.id), () => {
      const ids = get().slice(); const idx = ids.indexOf(i.id);
      if (idx > -1) ids.splice(idx, 1); else ids.push(i.id);
      set(ids); commit('set'); rebuild(get, set, grid, null, true);
    })));
    return el('div', { class: 'srow srow--col' }, [el('span', { class: 'srow__txt', text: label }), grid]);
  }
  function iconTile(i, isOn, onTap) {
    const tile = el('button', { class: 'iconpick__tile' + (isOn() ? ' on' : '') });
    const ic = el('div', { class: 'iconpick__icon' });
    ic.style.background = i.bg || '#3a3a3c';
    ic.textContent = i.folder ? '📁' : (i.emoji || '');
    tile.append(ic, el('span', { class: 'iconpick__name', text: i.name || '' }));
    tile.addEventListener('click', onTap);
    return tile;
  }
  // точечное обновление выделения — без полной пересборки (сохраняет скролл)
  function rebuild(get, set, grid, noneBtn, multi) {
    if (noneBtn) noneBtn.classList.toggle('on', !get());
    const icons = allIcons();
    [...grid.querySelectorAll('.iconpick__tile')].forEach((t, idx) => {
      const ic = icons[idx];
      if (!ic) return;
      const on = multi ? get().includes(ic.id) : (get() === ic.id);
      t.classList.toggle('on', on);
    });
  }

  function wallpaperPick(label, get, set) {
    const file = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    file.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const { fileToDataURL } = await import('../storage.js');
      const data = await fileToDataURL(f);
      await set(data); commit('wp'); home.render(); build();
    });
    const preview = el('div', { class: 'wp__preview' });
    if (get()) preview.style.backgroundImage = `url(${get()})`;
    const clearBtn = el('button', { class: 'im__btn', text: 'Убрать', on: { click: async () => { await set(null); commit('wp'); home.render(); build(); } } });
    return el('div', { class: 'srow srow--col' }, [
      el('span', { class: 'srow__txt', text: label }),
      el('div', { class: 'wp__row' }, [preview, el('div', { class: 'wp__btns' }, [
        el('button', { class: 'im__btn', text: '🖼 Выбрать', on: { click: () => file.click() } }), clearBtn, file,
      ])]),
    ]);
  }

  const h = state.home;

  // --- раздел "Экран блокировки" ---
  function lockTab() {
    return [
      section('🔒 Код-пароль', [
        el('div', { class: 'srow__lbl', text: 'Длина кода' }),
        el('div', { class: 'seg' }, [4, 6].map((n) =>
          el('button', { class: state.lock.codeLength === n ? 'on' : '', text: n + ' цифр', on: { click: (e) => { state.lock.codeLength = n; markSeg(e); commit('lock'); } } }))),
        secRow('Удержание «Отменить»', () => state.lock.longPressMs, (v) => (state.lock.longPressMs = v)),
      ]),
      section('🔓 Метод разблокировки', [
        el('div', { class: 'seg' }, [['sos', 'SOS'], ['attempts', 'Попытки'], ['combo', 'Код']].map(([m, t]) =>
          el('button', { class: state.lock.method === m ? 'on' : '', text: t, on: { click: (e) => { state.lock.method = m; markSeg(e); commit('lock'); } } }))),
        numRow('Разблок. на попытке после SOS', () => state.lock.sosAttempt, (v) => (state.lock.sosAttempt = v)),
        numRow('Разблок. через N попыток', () => state.lock.attemptsToUnlock, (v) => (state.lock.attemptsToUnlock = v)),
        textRow('Секретный код', () => state.lock.combo, (v) => (state.lock.combo = v)),
      ]),
      section('🔢 Показ попыток (фокус)', [
        slider('Сколько показывать', 0, 5, () => h.attemptsView.count, (v) => (h.attemptsView.count = v), ''),
        pickIconsVisual('Иконки для кодов (тап по иконке)', () => h.attemptsView.iconIds, (ids) => (h.attemptsView.iconIds = ids)),
        el('div', { class: 'hint', text: 'Введённые на экране блокировки коды появятся бейджем на выбранных иконках по порядку.' }),
      ]),
      section('🖼 Обои блокировки', [
        wallpaperPick('Обои блокировки', () => state.lock.bg, async (url) => { state.lock.bg = url; }),
      ]),
    ];
  }

  // --- раздел "Рабочий стол" ---
  function homeTab() {
    return [
      section('🎨 Внешний вид', [
        slider('Колонок', 3, 6, () => h.cols, (v) => (h.cols = v), ''),
        slider('Размер иконок', 36, 100, () => h.iconSize, (v) => (h.iconSize = v)),
        slider('Скругление', 0, 50, () => h.iconRadius, (v) => (h.iconRadius = v)),
        slider('Прозрачность', 0, 100, () => h.iconOpacity, (v) => (h.iconOpacity = v), '%'),
        slider('Отступ X', 0, 40, () => h.gapX, (v) => (h.gapX = v)),
        slider('Отступ Y', 0, 40, () => h.gapY, (v) => (h.gapY = v)),
        slider('Сдвиг иконок X', -60, 60, () => h.offX, (v) => (h.offX = v)),
        slider('Сдвиг иконок Y', -60, 120, () => h.offY, (v) => (h.offY = v)),
      ]),
      section('🔴 Бейджи', [
        slider('По X', -40, 60, () => h.badge.bx, (v) => (h.badge.bx = v)),
        slider('По Y', -30, 60, () => h.badge.by, (v) => (h.badge.by = v)),
        slider('Ширина', 10, 60, () => h.badge.bw, (v) => (h.badge.bw = v)),
        slider('Высота', 10, 50, () => h.badge.bh, (v) => (h.badge.bh = v)),
        slider('Шрифт', 7, 30, () => h.badge.fontSize, (v) => (h.badge.fontSize = v)),
      ]),
      section('📲 Иконки и экраны', [
        toggle('Режим редактирования', () => home.editMode, (v) => v ? home.enterEdit() : home.exitEdit()),
        el('div', { class: 'srow srow--action', on: { click: () => { home.addPage(); commit('set'); home.render(); } }, text: '➕ Добавить экран' }),
        el('div', { class: 'srow srow--action', on: { click: () => { home.delPage(); commit('set'); home.render(); } }, text: '🗑 Удалить текущий экран' }),
      ]),
      section('🚪 Вызов настроек', [
        toggle('Долгое нажатие на стол', () => h.trigger.hold, (v) => (h.trigger.hold = v)),
        secRow('Длит. удержания', () => h.trigger.holdMs, (v) => (h.trigger.holdMs = v)),
        toggle('Мультитап по столу', () => h.trigger.multiTap, (v) => (h.trigger.multiTap = v)),
        slider('Кол-во тапов', 2, 6, () => h.trigger.tapCount, (v) => (h.trigger.tapCount = v), ''),
        secRow('Окно между тапами', () => h.trigger.tapTimeoutMs, (v) => (h.trigger.tapTimeoutMs = v)),
        toggle('Тап по иконке', () => h.trigger.icon, (v) => (h.trigger.icon = v)),
        slider('Тапов по иконке', 2, 6, () => h.trigger.iconTapCount, (v) => (h.trigger.iconTapCount = v), ''),
        pickIconVisual('Иконка-триггер (тап по иконке)', () => h.trigger.iconId, (id) => (h.trigger.iconId = id)),
      ]),
      section('🖼 Обои рабочего стола', [
        wallpaperPick('Общие обои', () => state.home.commonBg, async (url) => { state.home.commonBg = url; }),
      ]),
    ];
  }

  function build() {
    clear(sheet);
    const tabs = el('div', { class: 'settings__tabs' }, [
      el('button', { class: 'settings__tab' + (activeTab === 'lock' ? ' on' : ''), text: '🔒 Блокировка', on: { click: () => { activeTab = 'lock'; build(); } } }),
      el('button', { class: 'settings__tab' + (activeTab === 'home' ? ' on' : ''), text: '📱 Рабочий стол', on: { click: () => { activeTab = 'home'; build(); } } }),
    ]);
    const scroll = el('div', { class: 'settings__scroll' }, activeTab === 'lock' ? lockTab() : homeTab());
    scroll.append(
      el('button', { class: 'settings__reset', text: '♻️ Сбросить всё', on: { click: () => { if (confirm('Сбросить все настройки?')) { localStorage.clear(); location.reload(); } } } }),
    );
    sheet.append(
      el('div', { class: 'settings__bar' }, [
        el('span', { class: 'settings__title', text: '⚙️ Настройки' }),
        el('button', { class: 'settings__close', text: '✕', on: { click: close } }),
      ]),
      tabs, scroll,
    );
  }

  function open() { build(); root.hidden = false; }
  function close() { root.hidden = true; onClose?.(); }
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  return { root, open, close };
}