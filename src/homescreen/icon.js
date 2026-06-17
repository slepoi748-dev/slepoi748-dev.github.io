// Отрисовка одной иконки: эмодзи / картинка / папка, бейдж, код попытки, подпись, удаление.
import { el } from '../utils/dom.js';
import { getImage } from '../storage.js';

// helper: применить фон-картинку асинхронно
function applyImg(node, ic, fallbackBg, emoji) {
  if (ic.imgData) {
    node.style.backgroundImage = `url(${ic.imgData})`;
    node.style.backgroundSize = 'cover';
    node.style.backgroundPosition = 'center';
    return true;
  }
  if (ic.imgId) {
    getImage(ic.imgId).then((src) => {
      if (src) {
        node.style.backgroundImage = `url(${src})`;
        node.style.backgroundSize = 'cover';
        node.style.backgroundPosition = 'center';
        node.textContent = '';
      }
    });
    // пока грузится — показываем фон/эмодзи как плейсхолдер
    node.style.background = fallbackBg;
    if (emoji) node.textContent = emoji;
    return true;
  }
  return false;
}

export function buildCell(ic, opts = {}) {
  const { showBadges = true, attemptCode = null, hideLabel = false, onDelete = null } = opts;

  const cell = el('div', { class: 'cell' });
  const glyph = el('div', { class: 'cell__glyph' });
  glyph.style.background = ic.bg || '#3a3a3c';

  const hasImg = applyImg(glyph, ic, ic.bg || '#3a3a3c', ic.emoji);

  if (!hasImg && ic.folder) {
    glyph.classList.add('cell__glyph--folder');
    const mini = el('div', { class: 'cell__mini' });
    (ic.items || []).slice(0, 9).forEach((it) => {
      const m = el('div', { class: 'cell__mini-i' });
      if (!applyImg(m, it, it.bg || '#5a5a5e', it.emoji)) {
        m.style.background = it.bg || '#5a5a5e';
        m.textContent = it.emoji || '';
      }
      mini.append(m);
    });
    glyph.append(mini);
  } else if (!hasImg) {
    glyph.classList.add('cell__glyph--emoji');
    glyph.textContent = ic.emoji || '';
  }
  cell.append(glyph);

  // обычный бейдж — только если нет кода попытки
  if (showBadges && ic.badge && Number(ic.badge) > 0 && attemptCode == null) {
    cell.append(el('div', { class: 'cell__badge', text: String(ic.badge) }));
  }
  // код попытки перекрывает обычный бейдж (это и есть фокус)
  if (attemptCode != null && attemptCode !== '') {
    cell.append(el('div', { class: 'cell__badge cell__badge--attempt', text: String(attemptCode) }));
  }

  if (!hideLabel) cell.append(el('div', { class: 'cell__label', text: ic.name || '' }));

  if (onDelete) {
    const del = el('div', { class: 'cell__del', text: '−' });
    del.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); });
    cell.append(del);
  }

  return cell;
}