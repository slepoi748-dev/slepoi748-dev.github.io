// src/screens/lockscreen.js
import { el, clear } from '../utils/dom.js';
import { onLongPress } from '../utils/gestures.js';
import { store } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { openSettings } from './settings.js';
import { imgUrl } from '../utils/images.js';

const LETTERS = {
  '1': '\u00A0',
  '2': 'АБВГ<br>ABC', '3': 'ДЕЖЗ<br>DEF', '4': 'ИЙКЛ<br>GHI',
  '5': 'МНОП<br>JKL', '6': 'РСТУ<br>MNO', '7': 'ФХЦЧ<br>PQRS',
  '8': 'ШЩЪЫ<br>TUV', '9': 'ЬЭЮЯ<br>WXYZ',
};

export function renderLockscreen(root) {
  clear(root);

  // ---- состояние ----
  let currentInput = '';
  let attemptCount = 0;
  let sosArmed = false;

  // текущая длина ПИНа (базовая из настроек; длинный тап SOS -> 6)
  let pinLength = Number(store.get('lock.digits')) || 4;

  // глобальный слой фона из index.html
  const appBg = document.getElementById('app-bg');

  // ---- DOM ----
  const wallpaper = el('div', { class: 'wallpaper' });
  const screen = el('div', { class: 'lock-screen' });

  const topLabel = el('div', { class: 'top-label' });
  const dotsContainer = el('div', { class: 'dots-container' });

  // --- Клавиатура (только цифры) ---
  const keyboard = el('div', { class: 'keyboard' });
  ['1','2','3','4','5','6','7','8','9'].forEach((d) => {
    const key = el('div', { class: 'key', dataset: { digit: d } }, [
      el('span', { class: 'key-number' }, d),
      el('span', { class: 'key-letters', html: LETTERS[d] || '' }),
    ]);
    key.addEventListener('click', () => pressKey(d, key));
    keyboard.append(key);
  });

  // Ноль по центру нижнего ряда клавиатуры
  const zeroKey = el('div', { class: 'key key-zero', dataset: { digit: '0' } }, [
    el('span', { class: 'key-number' }, '0'),
    el('span', { class: 'key-letters', html: '\u00A0' }),
  ]);
  zeroKey.addEventListener('click', () => pressKey('0', zeroKey));

  // Пустые ячейки, чтобы 0 встал строго под "8"
  const spacerL = el('div', { class: 'key key-spacer' });
  const spacerR = el('div', { class: 'key key-spacer' });
  keyboard.append(spacerL, zeroKey, spacerR);

  const passcodeSection = el('div', { class: 'passcode-section' }, [keyboard]);

  // --- Нижняя панель: SOS / Отменить (независимы) ---
  const sosKey = el('button', { class: 'btn-sos' }, 'SOS');
  const cancelKey = el('button', { class: 'btn-cancel' }, 'Отменить');
  const bottomBar = el('div', { class: 'lock-bottom' }, [sosKey, cancelKey]);

  // порядок в потоке: подсказка, точки, клавиатура (центр), нижняя панель
  screen.append(topLabel, dotsContainer, passcodeSection, bottomBar);
  root.append(wallpaper, screen);

  // ---- применить визуальные настройки ----
  applyAll();
  buildDots();
  updateDots();

  // =================== функции ===================

  function applyAll() {
    applyHint();
    applyKeySize();
    applyFontSize();
    applyPadOffset();
    applyWallpaper();
  }

  function applyHint() {
    const txt = store.get('lock.hintTitle') || 'Смахните вверх для Face ID\nили введите код-пароль';
    topLabel.innerHTML = String(txt).replace(/\n/g, '<br>');
  }

  function applyKeySize() {
    const v = Number(store.get('lock.keySize')) || 75;
    document.documentElement.style.setProperty('--key-size', v + 'px');
  }

  function applyFontSize() {
    const v = Number(store.get('lock.keyFontSize')) || 32;
    document.documentElement.style.setProperty('--key-font-size', v + 'px');
  }

  function applyPadOffset() {
    const x = Number(store.get('lock.padOffsetX')) || 0;
    const y = Number(store.get('lock.padOffsetY')) || 0;
    document.documentElement.style.setProperty('--pin-block-x', x + 'px');
    document.documentElement.style.setProperty('--pin-block-y', y + 'px');
  }

  function applyWallpaper() {
    const show = store.get('lock.showWallpaper');
    const bg = store.get('lock.wallpaper');
    const url = show && bg ? imgUrl(bg) : '';

    if (appBg) {
      if (url) {
        appBg.style.backgroundImage = `url('${url}')`;
        appBg.style.backgroundColor = '#000';
      } else {
        appBg.style.backgroundImage = 'none';
        appBg.style.backgroundColor = '#000';
      }
    }
    wallpaper.style.backgroundImage = 'none';
    wallpaper.style.background = 'transparent';
  }

  // Точки строятся по актуальной pinLength
  function buildDots() {
    clear(dotsContainer);
    for (let i = 0; i < pinLength; i++) dotsContainer.append(el('div', { class: 'dot' }));
  }

  function updateDots() {
    dotsContainer.querySelectorAll('.dot').forEach((d, i) =>
      d.classList.toggle('filled', i < currentInput.length));
  }

  function pressKey(num, node) {
    if (node) {
      node.classList.remove('pressed');
      void node.offsetWidth;
      node.classList.add('pressed');
      setTimeout(() => node.classList.remove('pressed'), 220);
    }
    if (currentInput.length >= pinLength) return;
    currentInput += num;
    updateDots();
    if (currentInput.length === pinLength) setTimeout(checkCode, 300);
  }

  function deleteKey() {
    if (!currentInput.length) return;
    currentInput = currentInput.slice(0, -1);
    updateDots();
  }

  function checkCode() {
    attemptCount++;
    const mode = store.get('lock.unlockMode') || 'afterSos';
    const code = currentInput;
    let success = false;

    if (mode === 'secret') {
      success = code === String(store.get('lock.secretCode'));
    } else if (mode === 'afterSos') {
      const need = Number(store.get('lock.sosUnlockAttempt')) || 1;
      if (sosArmed && attemptCount >= need) success = true;
    } else if (mode === 'afterAttempts') {
      const need = Number(store.get('lock.attemptsToUnlock')) || 3;
      if (attemptCount >= need) success = true;
    }

    bus.emit(EVENTS.PASSCODE_ENTERED, { code, attempt: attemptCount, success });

    if (success) doUnlock();
    else wrongPasswordAnimation();
  }

  function wrongPasswordAnimation() {
    dotsContainer.classList.add('wrong-animation');
    dotsContainer.querySelectorAll('.dot').forEach((d) => {
      d.style.background = '#ff3b30';
      d.style.borderColor = '#ff3b30';
    });
    setTimeout(() => {
      dotsContainer.classList.remove('wrong-animation');
      dotsContainer.querySelectorAll('.dot').forEach((d) => {
        d.style.background = '';
        d.style.borderColor = '';
        d.classList.remove('filled');
      });
      currentInput = '';
    }, 600);
  }

  function doUnlock() {
    currentInput = '';
    updateDots();
    bus.emit(EVENTS.UNLOCK);
  }

  function resetScreen() {
    currentInput = '';
    attemptCount = 0;
    sosArmed = false;
    // длину ПИНа возвращаем к базовой из настроек
    pinLength = Number(store.get('lock.digits')) || 4;
    buildDots();
    updateDots();
  }

  // ========================================================
  //  SOS
  // ========================================================
  // Короткий тап SOS — "вооружить" разблокировку (режим afterSos)
  sosKey.addEventListener('click', () => {
    if ((store.get('lock.unlockMode') || 'afterSos') === 'afterSos') {
      sosArmed = true;
    }
    currentInput = '';
    updateDots();

    // визуальный отклик
    sosKey.classList.add('active');
    setTimeout(() => sosKey.classList.remove('active'), 200);
  });

  // Долгий тап SOS — переключить ПИН на 6 знаков
  onLongPress(
    sosKey,
    () => {
      pinLength = pinLength === 6 ? 4 : 6;
      currentInput = '';
      buildDots();
      updateDots();
      // отклик
      sosKey.classList.add('active');
      setTimeout(() => sosKey.classList.remove('active'), 250);
    },
    () => Number(store.get('lock.longPressMs')) || 1000
  );

  // ========================================================
  //  Отменить
  // ========================================================
  // Короткий тап — удалить цифру / сбросить ввод
  cancelKey.addEventListener('click', () => {
    if (currentInput.length) deleteKey();
    else { currentInput = ''; updateDots(); }
  });

  // Долгий тап — открыть настройки экрана блокировки
  onLongPress(
    cancelKey,
    () => {
      resetScreen();
      openSettings(root, 'lock');
    },
    () => Number(store.get('lock.longPressMs')) || 1000
  );

  // ========================================================
  //  Реакция на изменения конфига
  // ========================================================
  const off = bus.on(EVENTS.CONFIG_CHANGE, ({ path } = {}) => {
    if (path === '*' || path === 'lock.digits') {
      pinLength = Number(store.get('lock.digits')) || 4;
      buildDots(); updateDots(); resetScreen();
    }
    if (path === '*' || path === 'lock.hintTitle') applyHint();
    if (path === '*' || path === 'lock.keySize') applyKeySize();
    if (path === '*' || path === 'lock.keyFontSize') applyFontSize();
    if (path === '*' || path === 'lock.padOffsetX' || path === 'lock.padOffsetY') applyPadOffset();
    if (path === '*' || path === 'lock.showWallpaper' || path === 'lock.wallpaper') applyWallpaper();
  });

  return () => { off && off(); };
}