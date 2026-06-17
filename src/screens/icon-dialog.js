import { el, clear } from '../utils/dom.js';
import { imgUrl, loadImageManifest } from '../utils/images.js';
import { addUserImage, getUserImages } from '../utils/media.js';

// Открывает диалог. data = { name, img } (для редактирования) или {} (новая).
// Возвращает Promise<{name, img} | null>
export async function openIconDialog(parent, { title = 'Иконка', data = {} } = {}) {
  const manifest = await loadImageManifest();
  return new Promise((resolve) => {
    let current = { name: data.name || '', img: data.img || '' };

    const preview = el('div', { class: 'icon-dialog__preview' });
    const setPreview = () => {
      preview.style.backgroundImage = current.img ? `url("${imgUrl(current.img)}")` : 'none';
    };
    setPreview();

    const nameInput = el('input', { type: 'text', placeholder: 'Название', value: current.name });
    nameInput.addEventListener('input', () => { current.name = nameInput.value; });

    // Выбор картинки
    const select = el('select');
    const buildOptions = () => {
      clear(select);
      select.append(el('option', { value: '' }, '— картинка —'));
      (manifest.icons || []).forEach((ic) => {
        const o = el('option', { value: ic }, ic);
        if (ic === current.img) o.selected = true;
        select.append(o);
      });
      getUserImages().forEach((u) => {
        const o = el('option', { value: `user:${u.id}` }, `${u.name} (загр.)`);
        if (`user:${u.id}` === current.img) o.selected = true;
        select.append(o);
      });
    };
    buildOptions();
    select.addEventListener('change', () => { current.img = select.value; setPreview(); });

    // Загрузка с устройства
    const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    const uploadBtn = el('button', { class: 's-btn' }, 'Загрузить');
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const item = await addUserImage(file);
      current.img = `user:${item.id}`;
      buildOptions();
      setPreview();
    });

    const body = el('div', { class: 'icon-dialog__body' }, [
      preview,
      nameInput,
      el('div', { class: 'icon-dialog__row' }, [select, uploadBtn, fileInput]),
    ]);

    const cancelBtn = el('button', {}, 'Отмена');
    const okBtn = el('button', { class: 'primary' }, 'Готово');

    const backdrop = el('div', { class: 'icon-dialog-backdrop' }, [
      el('div', { class: 'icon-dialog' }, [
        el('div', { class: 'icon-dialog__head' }, title),
        body,
        el('div', { class: 'icon-dialog__actions' }, [cancelBtn, okBtn]),
      ]),
    ]);

    const close = (result) => { backdrop.remove(); resolve(result); };
    cancelBtn.addEventListener('click', () => close(null));
    okBtn.addEventListener('click', () => {
      if (!current.name && !current.img) { close(null); return; }
      close({ name: current.name || 'Иконка', img: current.img });
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });

    parent.append(backdrop);
    nameInput.focus();
  });
}