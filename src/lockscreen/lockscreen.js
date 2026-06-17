// Экран блокировки: пин-клавиатура, точки, методы разблокировки, SOS/Отмена.
import { el, clear } from '../utils/dom.js';
import { pointer } from '../utils/gestures.js';
import { state, commit } from '../state.js';
import { setBgImage } from '../utils/dom.js';

const KEY_LETTERS = {
  2: 'АБВГ ABC', 3: 'ДЕЖЗ DEF', 4: 'ИЙКЛ GHI', 5: 'МНОП JKL',
  6: 'РСТУ MNO', 7: 'ФХЦЧ PQRS', 8: 'ШЩЪЫ TUV', 9: 'ЬЭЮЯ WXYZ',
};

export function createLockScreen({ onUnlock, onOpenSettings }) {
  let input = '';
  let attempts = 0;
  let sosArmed = false;

  const root = el('div', { class: 'lock' });
  const bg = el('div', { class: 'lock__bg' });
  const label = el('div', { class: 'lock__label' });
  const dots = el('div', { class: 'lock__dots' });
  const pad = el('div', { class: 'lock__pad' });
  const bottom = el('div', { class: 'lock__bottom' });

  function setLabel() {
    label.innerHTML = 'Смахните вверх для Face ID<br>или введите код-пароль';
  }
  function renderDots() {
    clear(dots);
    for (let i = 0; i < state.lock.codeLength; i++) {
      dots.append(el('div', { class: 'dot' + (i < input.length ? ' dot--on' : '') }));
    }
  }
  function press(d, keyEl) {
    keyEl?.classList.remove('key--press'); void keyEl?.offsetWidth; keyEl?.classList.add('key--press');
    setTimeout(() => keyEl?.classList.remove('key--press'), 200);
    if (input.length >= state.lock.codeLength) return;
    input += d; renderDots();
    if (input.length === state.lock.codeLength) setTimeout(check, 250);
  }
  function del() { if (input) { input = input.slice(0, -1); renderDots(); } }

  function recordAttempt(code) {
    state.attempts.unshift(code);
    if (state.attempts.length > 10) state.attempts.length = 10;
    commit('attempt');
  }

  function check() {
    attempts++;
    recordAttempt(input);
    const L = state.lock;
    let ok = false;
    if (L.method === 'combo') ok = input === L.combo;
    else if (L.method === 'sos') ok = sosArmed && attempts >= L.sosAttempt;
    else if (L.method === 'attempts') ok = attempts >= L.attemptsToUnlock;
    if (ok) { reset(); onUnlock(); } else wrong();
  }
  function wrong() {
    dots.classList.add('lock__dots--shake');
    dots.querySelectorAll('.dot').forEach((d) => d.classList.add('dot--err'));
    setTimeout(() => {
      dots.classList.remove('lock__dots--shake');
      input = ''; renderDots();
    }, 600);
  }
  function reset() { input = ''; attempts = 0; sosArmed = false; renderDots(); }

  // --- pad ---
  function buildPad() {
    clear(pad);
    for (let n = 1; n <= 9; n++) {
      const k = el('div', { class: 'key' }, [
        el('span', { class: 'key__num', text: String(n) }),
        el('span', { class: 'key__let', html: (KEY_LETTERS[n] || '').replace(' ', '<br>') }),
      ]);
      k.addEventListener('click', () => press(String(n), k));
      pad.append(k);
    }
  }
  const zeroKey = el('div', { class: 'key key--zero' }, [el('span', { class: 'key__num', text: '0' })]);
  zeroKey.addEventListener('click', () => press('0', zeroKey));

  const sosBtn = el('button', { class: 'lock__sos', text: 'SOS' });
  const cancelBtn = el('button', { class: 'lock__cancel', text: 'Отменить' });

  // SOS: тап -> arm; долгое -> смена длины кода
  pointer(sosBtn, {
    longMs: 1000,
    onTap: () => {
      if (state.lock.method === 'sos') sosArmed = true;
      input = ''; renderDots();
      sosBtn.style.opacity = '0.3'; setTimeout(() => (sosBtn.style.opacity = ''), 250);
    },
    onLongPress: () => {
      state.lock.codeLength = state.lock.codeLength === 4 ? 6 : 4;
      input = ''; sosArmed = false; commit('codeLen'); renderDots();
    },
  });
  // Отмена: тап -> backspace; долгое -> настройки
  pointer(cancelBtn, {
    longMs: state.lock.longPressMs,
    onTap: () => del(),
    onLongPress: () => onOpenSettings(),
  });

  bottom.append(sosBtn, zeroKey, cancelBtn);

  // +NEW --- маленькая матовая кнопка "Готово" по центру внизу ---
  // По умолчанию скрыта; показывается только в режиме редактирования (home).
  const doneBtn = el('button', { class: 'lock__done', text: 'Готово' });
  doneBtn.hidden = true;
  doneBtn.addEventListener('click', () => {
    root.dispatchEvent(new CustomEvent('lock-done', { bubbles: true }));
  });
  // +NEW конец

  // keyboard support
  document.addEventListener('keydown', (e) => {
    if (root.parentElement?.hidden || root.closest('[hidden]')) return;
    if (e.key >= '0' && e.key <= '9') press(e.key);
    else if (e.key === 'Backspace') del();
  });

  function refresh() {
    setBgImage(bg, state.lock.bg);
    setLabel();
    renderDots();
  }

  buildPad();
  // +NEW добавил doneBtn в секцию
  root.append(bg, label, dots, el('div', { class: 'lock__section' }, [pad, bottom, doneBtn]));
  refresh();

  // +NEW методы управления кнопкой "Готово"
  return {
    root, refresh, reset,
    showDone: () => { doneBtn.hidden = false; },
    hideDone: () => { doneBtn.hidden = true; },
  };
}