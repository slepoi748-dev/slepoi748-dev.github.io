import { el } from '../utils/dom.js';

// Возвращает Promise<{type, value} | null>
export function openBadgeDialog(parent, current = {}) {
  return new Promise((resolve) => {
    let type = current.type || (current.value ? 'number' : 'none');
    let value = current.value || '';

    const valInput = el('input', { type: 'text', placeholder: 'Значение', value });
    valInput.addEventListener('input', () => { value = valInput.value; });

    const syncVisibility = () => {
      valInput.style.display = (type === 'number' || type === 'text') ? 'block' : 'none';
      if (type === 'number') valInput.setAttribute('inputmode', 'numeric');
      else valInput.removeAttribute('inputmode');
    };

    const select = el('select');
    [['none', 'Нет'], ['dot', 'Точка'], ['number', 'Число'], ['text', 'Текст']].forEach(([v, t]) => {
      const o = el('option', { value: v }, t);
      if (v === type) o.selected = true;
      select.append(o);
    });
    select.addEventListener('change', () => { type = select.value; syncVisibility(); });
    syncVisibility();

    const cancelBtn = el('button', {}, 'Отмена');
    const okBtn = el('button', { class: 'primary' }, 'Готово');

    const backdrop = el('div', { class: 'icon-dialog-backdrop' }, [
      el('div', { class: 'icon-dialog' }, [
        el('div', { class: 'icon-dialog__head' }, 'Бейдж'),
        el('div', { class: 'icon-dialog__body' }, [
          el('div', { class: 'icon-dialog__row' }, [select]),
          valInput,
        ]),
        el('div', { class: 'icon-dialog__actions' }, [cancelBtn, okBtn]),
      ]),
    ]);

    const close = (res) => { backdrop.remove(); resolve(res); };
    cancelBtn.addEventListener('click', () => close(null));
    okBtn.addEventListener('click', () => {
      if (type === 'none') return close({ type: 'none', value: '' });
      if (type === 'dot') return close({ type: 'dot', value: '' });
      close({ type, value: value.trim() });
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });

    parent.append(backdrop);
  });
}