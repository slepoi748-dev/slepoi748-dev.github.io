import { el, clear, $$ } from '../utils/dom.js';
import { onLongPress } from '../utils/gestures.js';
import { store } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { imgUrl } from '../utils/images.js';
import { openSettings } from './settings.js';

const LETTERS = {
  1: '', 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL',
  6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ', 0: '',
};

export function renderLockscreen(root) {
  clear(root);

  let entered = '';            // введённые цифры
  let attempts = 0;            // счётчик попыток
  let sosPressed = false;      // нажата ли SOS
  let sosAttempts = 0;         // попытки после SOS

  const screen = el('div', { class: 'screen lock' });

  // Фон
  applyWallpaper(screen);

  // Верх: заголовок + точки
  const title = el('p', { class: 'lock__title' }, 'Введите код-пароль');
  const dots = el('div', { class: 'lock__dots' });
  const top = el('div', { class: 'lock__top' }, [title, dots]);

  function renderDots() {
    clear(dots);
    const total = store.get('lock.digits');
    for (let i = 0; i < total; i++) {
      dots.append(el('div', { class: 'dot' + (i < entered.length ? ' filled' : '') }));
    }
  }

  // Клавиатура
  const keypad = el('div', { class: 'keypad' });
  const layout = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];

  layout.forEach((val) => {
    if (val === null) { keypad.append(el('button', { class: 'key key--empty' })); return; }

        if (val === 'del') {
      const delKey = el('button', {
        class: 'key key--empty',
        style: { color: '#fff', fontSize: '15px', pointerEvents: 'none' },
      });
      const refreshDel = () => {
        delKey.textContent = entered.length ? 'Удалить' : '';
        delKey.style.pointerEvents = entered.length ? 'auto' : 'none';
      };
      bus.on('lock:refreshDel', refreshDel);
      delKey.addEventListener('click', () => {
        if (!entered.length) return;
        entered = entered.slice(0, -1);
        renderDots();
        refreshDel();
      });
      keypad.append(delKey);
      return;
    }

    const key = el('button', { class: 'key', dataset: { num: val } }, [
      el('span', { class: 'key__num' }, String(val)),
      LETTERS[val] ? el('span', { class: 'key__letters' }, LETTERS[val]) : null,
    ]);

    const press = () => {
      flash(key);
      onDigit(String(val));
    };
    key.addEventListener('click', press);
    keypad.append(key);
  });

  // Низ: SOS и Отмена
  const sosBtn = el('button', { class: 'lock__btn' }, 'SOS');
  const cancelBtn = el('button', { class: 'lock__btn' }, 'Отмена');
  const bottom = el('div', { class: 'lock__bottom' }, [sosBtn, cancelBtn]);

  // Долгое нажатие на SOS — переключение 4↔6
  onLongPress(sosBtn, () => {
    const cur = store.get('lock.digits');
    store.set('lock.digits', cur === 4 ? 6 : 4);
    entered = '';
    renderDots();
    bus.emit('lock:refreshDel');
    pulse(sosBtn);
  }, () => store.get('lock.longPressMs'));

  // Короткое нажатие на SOS — активирует режим SOS
  sosBtn.addEventListener('click', () => {
    sosPressed = true;
    sosAttempts = 0;
    flashBtn(sosBtn);
  });

  // Долгое нажатие на Отмена — скрытые настройки
  onLongPress(cancelBtn, () => {
    openSettings(root, 'lock');
  }, () => store.get('lock.longPressMs'));

  cancelBtn.addEventListener('click', () => {
    flashBtn(cancelBtn);
    entered = '';
    renderDots();
    bus.emit('lock:refreshDel');
  });

  // Логика ввода цифры
  function onDigit(d) {
    const total = store.get('lock.digits');
    if (entered.length >= total) return;
    entered += d;
    renderDots();
    bus.emit('lock:refreshDel');

    if (entered.length === total) {
      setTimeout(() => evaluate(), 180);
    }
  }

  // Проверка пароля по выбранному режиму
  function evaluate() {
    const mode = store.get('lock.unlockMode');
    attempts++;
    const code = entered;

    let success = false;

    if (mode === 'afterSos') {
      // Открывается только если был нажат SOS, начиная с N-й попытки после него
      if (sosPressed) {
        sosAttempts++;
        const need = Math.max(1, store.get('lock.sosUnlockAttempt'));
        if (sosAttempts >= need) success = true;
      }
    } else if (mode === 'afterAttempts') {
      // Открывается после N попыток любым кодом
      const need = Math.max(1, store.get('lock.attemptsToUnlock'));
      if (attempts >= need) success = true;
    } else if (mode === 'secret') {
      // Открывается только при точном совпадении с секретной комбинацией
      if (code === String(store.get('lock.secretCode'))) success = true;
    }

    // Сообщаем системе о вводе (понадобится для уведомлений на рабочем столе, Этап 4)
    bus.emit(EVENTS.PASSCODE_ENTERED, { code, attempt: attempts, success });

    if (success) {
      unlock();
    } else {
      rejectAnimation();
    }
  }

  // Успешная разблокировка
  function unlock() {
    entered = '';
    bus.emit(EVENTS.UNLOCK);
  }

  // Анимация ошибки: точки краснеют + тряска, затем сброс
  function rejectAnimation() {
    $$('.dot', dots).forEach((d) => d.classList.add('error'));
    dots.classList.add('shake');

    setTimeout(() => {
      dots.classList.remove('shake');
      entered = '';
      renderDots();
      bus.emit('lock:refreshDel');
    }, 600);
  }

  // Подсветка клавиши при нажатии (загорается и гаснет)
  function flash(key) {
    key.classList.add('active');
    setTimeout(() => key.classList.remove('active'), 150);
  }

  // Подсветка нижних кнопок SOS/Отмена
  function flashBtn(btn) {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 150);
  }

  // Короткий «пульс» (для подтверждения смены 4↔6)
  function pulse(btn) {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 250);
  }

  // Сборка экрана
  screen.append(top, keypad, bottom);
  root.append(screen);

  // Первичная отрисовка
  renderDots();
  bus.emit('lock:refreshDel');

  // Перерисовка при изменении конфига (например, сменили digits/фон в настройках)
  const offConfig = bus.on(EVENTS.CONFIG_CHANGE, ({ path }) => {
    if (path === 'lock.digits' || path === '*') {
      entered = '';
      renderDots();
      bus.emit('lock:refreshDel');
    }
    if (path === 'lock.wallpaper' || path === 'lock.showWallpaper' || path === '*') {
      applyWallpaper(screen);
    }
  });

  // Вернём функцию очистки (на будущее, когда будем переключать экраны)
  return () => { offConfig(); };
}

// Применение обоев экрана блокировки
function applyWallpaper(screen) {
  const show = store.get('lock.showWallpaper');
  const wp = store.get('lock.wallpaper');
  if (show && wp) {
    screen.style.backgroundImage = `url("${imgUrl(wp)}")`;
  } else {
    screen.style.backgroundImage = 'none';
  }
}