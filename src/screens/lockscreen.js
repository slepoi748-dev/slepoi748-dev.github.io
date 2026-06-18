// src/screens/lockscreen.js
import { el, clear, $$ } from '../utils/dom.js';
import { onLongPress } from '../utils/gestures.js';
import { store } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { openSettings } from './settings.js';

const LETTERS = {
  1: '', 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL',
  6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ', 0: '',
};

// Строим URL картинки без внешних зависимостей.
// Поддержка пользовательских картинок user:... — это dataURL/имя как есть.
function wallpaperUrl(name) {
  if (!name) return '';
  if (name.startsWith('user:')) return ''; // на локскрине пользовательские не используем
  if (name.startsWith('data:') || name.startsWith('http') || name.startsWith('/')) return name;
  return `img/${name}`;
}

export function renderLockscreen(root) {
  clear(root);

  let entered = '';
  let attempts = 0;
  let sosPressed = false;
  let sosAttempts = 0;

  const screen = el('div', { class: 'screen lock' });
  applyWallpaper(screen);

  const title = el('p', { class: 'lock__title' });
  const dots = el('div', { class: 'lock__dots' });
  const top = el('div', { class: 'lock__top' }, [title, dots]);

  function renderTitle() {
    clear(title);
    const text = store.get('lock.hintTitle') || 'Введите код-пароль';
    String(text).split('\n').forEach((line, i) => {
      if (i > 0) title.append(el('br'));
      title.append(document.createTextNode(line));
    });
  }

  function renderDots() {
    clear(dots);
    const total = store.get('lock.digits');
    for (let i = 0; i < total; i++) {
      dots.append(el('div', { class: 'dot' + (i < entered.length ? ' filled' : '') }));
    }
  }

  const keypad = el('div', { class: 'keypad' });

  function applyPadStyle() {
    const ox = store.get('lock.padOffsetX') || 0;
    const oy = store.get('lock.padOffsetY') || 0;
    keypad.style.transform = `translate(${ox}px, ${oy}px)`;
    keypad.style.setProperty('--key-size', `${store.get('lock.keySize') || 75}px`);
    keypad.style.setProperty('--key-font', `${store.get('lock.keyFontSize') || 32}px`);
  }

  const layout = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, null];

  layout.forEach((val) => {
    if (val === null) {
      keypad.append(el('button', { class: 'key key--empty' }));
      return;
    }
    const key = el('button', { class: 'key', dataset: { num: val } }, [
      el('span', { class: 'key__num' }, String(val)),
      LETTERS[val] ? el('span', { class: 'key__letters' }, LETTERS[val]) : null,
    ]);
    key.addEventListener('click', () => {
      flash(key);
      onDigit(String(val));
    });
    keypad.append(key);
  });

  const sosBtn = el('button', { class: 'lock__btn' }, 'SOS');
  const cancelBtn = el('button', { class: 'lock__btn' }, 'Отменить');
  const bottom = el('div', { class: 'lock__bottom' }, [sosBtn, cancelBtn]);

  function refreshCancel() {
    if (entered.length) {
      cancelBtn.textContent = 'Отменить';
      cancelBtn.style.visibility = 'visible';
    } else {
      cancelBtn.textContent = '';
      cancelBtn.style.visibility = 'hidden';
    }
  }

  onLongPress(sosBtn, () => {
    const cur = store.get('lock.digits');
    store.set('lock.digits', cur === 4 ? 6 : 4);
    entered = '';
    renderDots();
    refreshCancel();
    pulse(sosBtn);
  }, () => store.get('lock.longPressMs') || 1000);

  sosBtn.addEventListener('click', () => {
    sosPressed = true;
    sosAttempts = 0;
    flashBtn(sosBtn);
  });

  onLongPress(cancelBtn, () => {
    openSettings(root, 'lock');
  }, () => store.get('lock.longPressMs') || 1000);

  cancelBtn.addEventListener('click', () => {
    if (!entered.length) return;
    flashBtn(cancelBtn);
    entered = entered.slice(0, -1);
    renderDots();
    refreshCancel();
  });

  function onDigit(d) {
    const total = store.get('lock.digits');
    if (entered.length >= total) return;
    entered += d;
    renderDots();
    refreshCancel();
    if (entered.length === total) setTimeout(() => evaluate(), 180);
  }

  function evaluate() {
    const mode = store.get('lock.unlockMode');
    attempts++;
    const code = entered;
    let success = false;

    if (mode === 'afterSos') {
      if (sosPressed) {
        sosAttempts++;
        const need = Math.max(1, store.get('lock.sosUnlockAttempt') || 1);
        if (sosAttempts >= need) success = true;
      }
    } else if (mode === 'afterAttempts') {
      const need = Math.max(1, store.get('lock.attemptsToUnlock') || 1);
      if (attempts >= need) success = true;
    } else if (mode === 'secret') {
      if (code === String(store.get('lock.secretCode'))) success = true;
    }

    bus.emit(EVENTS.PASSCODE_ENTERED, { code, attempt: attempts, success });

    if (success) unlock();
    else rejectAnimation();
  }

  function unlock() {
    entered = '';
    bus.emit(EVENTS.UNLOCK);
  }

  function rejectAnimation() {
    $$('.dot', dots).forEach((d) => d.classList.add('error'));
    dots.classList.add('shake');
    setTimeout(() => {
      dots.classList.remove('shake');
      entered = '';
      renderDots();
      refreshCancel();
    }, 600);
  }

  function flash(key) {
    key.classList.add('active');
    setTimeout(() => key.classList.remove('active'), 150);
  }
  function flashBtn(btn) {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 150);
  }
  function pulse(btn) {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 250);
  }

  screen.append(top, keypad, bottom);
  root.append(screen);

  renderTitle();
  renderDots();
  applyPadStyle();
  refreshCancel();

  const offConfig = bus.on(EVENTS.CONFIG_CHANGE, ({ path }) => {
    if (path === 'lock.digits' || path === '*') {
      entered = '';
      renderDots();
      refreshCancel();
    }
    if (path === 'lock.hintTitle' || path === '*') renderTitle();
    if (
      path === 'lock.padOffsetX' || path === 'lock.padOffsetY' ||
      path === 'lock.keySize' || path === 'lock.keyFontSize' || path === '*'
    ) applyPadStyle();
    if (path === 'lock.wallpaper' || path === 'lock.showWallpaper' || path === '*') {
      applyWallpaper(screen);
    }
  });

  return () => { offConfig(); };
}

function applyWallpaper(screen) {
  const show = store.get('lock.showWallpaper');
  const wp = store.get('lock.wallpaper');
  const url = show ? wallpaperUrl(wp) : '';
  screen.style.backgroundImage = url ? `url("${url}")` : 'none';
}