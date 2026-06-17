// src/homescreen/iconmenu.js — редактирование иконки
import { el, clear } from '../utils/dom.js';
import { state, commit, newId } from '../state.js';
import { putImage, delImage, fileToDataURL } from '../storage.js';

export function createIconMenu({ onChange, openFolder }) {
  const root = el('div', { class: 'iconmenu', hidden: true });
  const card = el('div', { class: 'iconmenu__card', on: { click: (e) => e.stopPropagation() } });
  root.append(card);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  let ic = null, ctx = null;
  const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f || !ic) return;
    const data = await fileToDataURL(f);
    const imgId = ic.imgId || newId();
    await putImage(imgId, data);
    ic.imgId = imgId; ic.emoji = ''; e.target.value = '';
    save(); build();
  });
  document.body.append(fileInput);

  function row(label, ...children) {
    return el('div', { class: 'im__row' }, [el('div', { class: 'im__sub', text: label }), ...children]);
  }
  function save() { commit('icon'); onChange(); }

  function build() {
    clear(card);
    const nameInput = el('input', { type: 'text', value: ic.name || '', placeholder: 'Название' });
    const emojiInput = el('input', { type: 'text', maxLength: 4, value: ic.emoji || '', placeholder: '📷' });
    const colorInput = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(ic.bg || '') ? ic.bg : '#444444' });
    const badgeInput = el('input', { type: 'number', min: 0, value: ic.badge || 0 });

    const btn = (label, cls, fn) => el('button', { class: 'im__btn ' + (cls || ''), text: label, on: { click: fn } });

    card.append(
      el('div', { class: 'im__title', text: ic.name || 'Иконка' }),
      row('Название', nameInput, el('button', { class: 'im__ok', text: 'OK', on: { click: () => { ic.name = nameInput.value; save(); } } })),
      row('Эмодзи', emojiInput, el('button', { class: 'im__ok', text: 'OK', on: { click: () => { ic.emoji = emojiInput.value; if (ic.imgId) { delImage(ic.imgId); ic.imgId = null; } save(); build(); } } })),
      row('Цвет', colorInput, el('button', { class: 'im__ok', text: 'OK', on: { click: () => { ic.bg = colorInput.value; save(); } } })),
      el('div', { class: 'im__seg' }, [[1, 1], [2, 1], [2, 2]].map(([w, h]) =>
        el('button', { class: (ic.w || 1) === w && (ic.h || 1) === h ? 'on' : '', text: `${w}×${h}`, on: { click: () => { ic.w = w; ic.h = h; save(); build(); } } }))),
      row('Бейдж', badgeInput, el('button', { class: 'im__ok', text: 'OK', on: { click: () => { ic.badge = parseInt(badgeInput.value) || 0; save(); } } })),
      btn('🖼 Фото', '', () => fileInput.click()),
      btn('🚫 Убрать фото', '', () => { if (ic.imgId) delImage(ic.imgId); ic.imgId = null; save(); build(); }),
      btn(ic.folder ? '📂 Открыть папку' : '📁 Сделать папкой', '', () => {
        if (ic.folder) { close(); openFolder(ic); return; }
        ic.folder = true; ic.items = [{ id: newId(), bg: ic.bg, emoji: ic.emoji, name: ic.name }]; save(); build();
      }),
      el('button', { class: 'im__close', text: 'Закрыть', on: { click: close } }),
    );
  }

  function open(icon, context) { ic = icon; ctx = context; build(); root.hidden = false; }
  function close() { root.hidden = true; ic = null; }
  return { root, open, close };
}