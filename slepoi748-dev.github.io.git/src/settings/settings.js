// Панель настроек. Один файл-генератор: слайдеры/тогглы -> state -> commit.
import { el, clear } from '../utils/dom.js';
import { state, commit } from '../state.js';

export function createSettings({ home, onClose }) {
  const root = el('div', { class: 'settings', hidden: true });

  const slider = (label, val, min, max, get, set, unit = 'px') => {
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

  const h = state.home;
  function build() {
    clear(root);
    root.append(
      el('h2', { text: '⚙️ Настройки' }),
      section('🎨 Внешний вид', [
        slider('Колонок', null, 3, 6, () => h.cols, (v) => (h.cols = v), ''),
        slider('Размер иконок', null, 36, 100, () => h.iconSize, (v) => (h.iconSize = v)),
        slider('Скругление', null, 0, 50, () => h.iconRadius, (v) => (h.iconRadius = v)),
        slider('Прозрачность', null, 0, 100, () => h.iconOpacity, (v) => (h.iconOpacity = v), '%'),
        slider('Отступ X', null, 0, 40, () => h.gapX, (v) => (h.gapX = v)),
        slider('Отступ Y', null, 0, 40, () => h.gapY, (v) => (h.gapY = v)),
        slider('Сдвиг иконок X', null, -60, 60, () => h.offX, (v) => (h.offX = v)),
        slider('Сдвиг иконок Y', null, -60, 120, () => h.offY, (v) => (h.offY = v)),
      ]),
      section('🔴 Бейджи', [
        slider('По X', null, -40, 60, () => h.badge.bx, (v) => (h.badge.bx = v)),
        slider('По Y', null, -30, 60, () => h.badge.by, (v) => (h.badge.by = v)),
        slider('Ширина', null, 10, 60, () => h.badge.bw, (v) => (h.badge.bw = v)),
        slider('Высота', null, 10, 50, () => h.badge.bh, (v) => (h.badge.bh = v)),
        slider('Шрифт', null, 7, 30, () => h.badge.fontSize, (v) => (h.badge.fontSize = v)),
      ]),
      section('📲 Иконки', [
        toggle('Режим редактирования', () => home.editMode, (v) => v ? home.enterEdit() : home.exitEdit()),
        el('div', { class: 'srow', on: { click: () => { home.addIcon(); close(); } }, text: '➕ Добавить иконку' }),
        el('div', { class: 'srow', on: { click: () => home.addPage() }, text: '➕ Добавить экран' }),
        el('div', { class: 'srow', on: { click: () => home.delPage() }, text: '🗑 Удалить экран' }),
      ]),
            section('🚪 Вызов настроек', [
        toggle('Долгое нажатие на стол', () => h.trigger.hold, (v) => (h.trigger.hold = v)),
        slider('Длит. удержания', null, 400, 2500, () => h.trigger.holdMs, (v) => (h.trigger.holdMs = v), 'мс'),
        toggle('Мультитап по столу', () => h.trigger.multiTap, (v) => (h.trigger.multiTap = v)),
        slider('Кол-во тапов', null, 2, 6, () => h.trigger.tapCount, (v) => (h.trigger.tapCount = v), ''),
        toggle('Тап по иконке', () => h.trigger.icon, (v) => (h.trigger.icon = v)),
        slider('Тапов по иконке', null, 2, 6, () => h.trigger.iconTapCount, (v) => (h.trigger.iconTapCount = v), ''),
        pickIcon('Иконка-триггер', () => h.trigger.iconId, (id) => (h.trigger.iconId = id)),
      ]),
      section('🔢 Показ попыток (фокус)', [
        slider('Сколько показывать', null, 0, 5, () => h.attemptsView.count, (v) => (h.attemptsView.count = v), ''),
        multiPickIcon('Иконки для кодов', () => h.attemptsView.iconIds, (ids) => (h.attemptsView.iconIds = ids)),
        el('div', { class: 'hint', text: 'Введённые на экране блокировки коды появятся бейджем на выбранных иконках по порядку.' }),
      ]),
      section('🔒 Экран блокировки', [
        el('div', { class: 'seg' }, [4, 6].map((n) =>
          el('button', { class: state.lock.codeLength === n ? 'on' : '', text: n + ' цифр', on: { click: (e) => { state.lock.codeLength = n; markSeg(e); commit('lock'); } } }))),
        slider('Удержание «Отменить»', null, 400, 2500, () => state.lock.longPressMs, (v) => (state.lock.longPressMs = v), 'мс'),
        el('div', { class: 'srow__lbl', text: 'Метод разблокировки' }),
        el('div', { class: 'seg' }, [['sos', 'SOS'], ['attempts', 'Попытки'], ['combo', 'Код']].map(([m, t]) =>
          el('button', { class: state.lock.method === m ? 'on' : '', text: t, on: { click: (e) => { state.lock.method = m; markSeg(e); commit('lock'); } } }))),
        numRow('Разблок. на попытке после SOS', () => state.lock.sosAttempt, (v) => (state.lock.sosAttempt = v)),
        numRow('Разблок. через N попыток', () => state.lock.attemptsToUnlock, (v) => (state.lock.attemptsToUnlock = v)),
        textRow('Секретный код', () => state.lock.combo, (v) => (state.lock.combo = v)),
      ]),
      section('🖼 Обои', [
        wallpaperPick('Общие обои', () => state.home.commonBg, async (url) => { state.home.commonBg = url; }),
        wallpaperPick('Обои блокировки', () => state.lock.bg, async (url) => { state.lock.bg = url; }),
      ]),
      el('button', { class: 'settings__close', text: '✕ Закрыть', on: { click: close } }),
      el('button', { class: 'settings__reset', text: '♻️ Сбросить всё', on: { click: () => { if (confirm('Сбросить все настройки?')) { localStorage.clear(); location.reload(); } } } }),
    );
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
  function pickIcon(label, get, set) {
    const sel = el('select', { class: 'sel', on: { change: (e) => { set(e.target.value || null); commit('set'); } } });
    sel.append(el('option', { value: '', text: '— нет —' }));
    allIcons().forEach((i) => sel.append(el('option', { value: i.id, text: i.name || i.emoji || i.id, selected: get() === i.id })));
    return el('div', { class: 'srow' }, [el('span', { class: 'srow__txt', text: label }), sel]);
  }
  function multiPickIcon(label, get, set) {
    const box = el('div', { class: 'chiplist' });
    allIcons().forEach((i) => {
      const on = get().includes(i.id);
      const chip = el('button', { class: 'chip' + (on ? ' on' : ''), text: i.name || i.emoji || '·' });
      chip.addEventListener('click', () => {
        const ids = get().slice();
        const idx = ids.indexOf(i.id);
        if (idx > -1) ids.splice(idx, 1); else ids.push(i.id);
        set(ids); chip.classList.toggle('on'); commit('set'); home.render();
      });
      box.append(chip);
    });
    return el('div', { class: 'srow srow--col' }, [el('span', { class: 'srow__txt', text: label }), box]);
  }
  function wallpaperPick(label, get, set) {
    const file = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    file.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const { fileToDataURL } = await import('../storage.js');
      const data = await fileToDataURL(f);
      await set(data); commit('wp'); home.render();
    });
    const clearBtn = el('button', { class: 'im__btn', text: 'Убрать', on: { click: async () => { await set(null); commit('wp'); home.render(); } } });
    return el('div', { class: 'srow srow--col' }, [
      el('span', { class: 'srow__txt', text: label }),
      el('div', { class: 'wp__btns' }, [el('button', { class: 'im__btn', text: '🖼 Выбрать', on: { click: () => file.click() } }), clearBtn, file]),
    ]);
  }

  function open() { build(); root.hidden = false; }
  function close() { root.hidden = true; onClose?.(); }
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  return { root, open, close };
}