// Рендер одной ячейки/иконки/папки. Без innerHTML с пользовательскими данными.
import { el, setBgImage } from '../utils/dom.js';
import { state } from '../state.js';
import { getImage } from '../storage.js';

function badgeText(n) {
  if (!n || n <= 0) return '';
  return n > 9999 ? Math.floor(n / 1000) + 'k' : String(n);
}

/** Визуальная часть иконки (без подписи). */
function iconVisual(ic) {
  if (ic.folder) {
    const grid = el('div', { class: 'folder' });
    const items = (ic.items || []).slice(0, 9);
    for (let i = 0; i < 9; i++) {
      const it = items[i];
      const mini = el('div', { class: 'folder__mini' });
      if (it) {
        if (it.imgId) loadImg(mini, it.imgId);
        else { mini.style.background = it.bg || '#444'; mini.textContent = it.emoji || ''; }
      } else mini.style.background = 'transparent';
      grid.append(mini);
    }
    return grid;
  }
  const icon = el('div', { class: 'icon' });
  if (ic.imgId) loadImg(icon, ic.imgId);
  else { icon.style.background = ic.bg || '#444'; icon.textContent = ic.emoji || ''; }
  return icon;
}

async function loadImg(node, imgId) {
  const url = await getImage(imgId);
  if (url) { setBgImage(node, url); node.textContent = ''; }
}

/** Собрать ячейку. opts.attemptIndex — индекс для показа кода попытки. */
export function buildCell(ic, opts = {}) {
  const cell = el('div', { class: 'cell', dataset: { id: ic.id } });
  if (ic.w > 1 || ic.h > 1) {
    cell.classList.add('cell--big');
    cell.style.gridColumn = `span ${ic.w || 1}`;
    cell.style.gridRow = `span ${ic.h || 1}`;
  }
  cell.append(iconVisual(ic));
  if (ic.name != null && !opts.hideLabel) cell.append(el('div', { class: 'label', text: ic.name }));

  const b = state.home.badge;
  // обычный бейдж
  const bt = badgeText(ic.badge);
  if (bt && opts.showBadges) {
    cell.append(makeBadge(bt, '#ff3b30', b));
  }
  // бейдж с кодом попытки
  if (opts.attemptCode != null) {
    cell.append(makeBadge(opts.attemptCode, '#ff9f0a', b, true));
  }
  // крестик удаления в режиме edit
  const del = el('div', { class: 'cell__del', text: '×' });
  if (opts.onDelete) del.addEventListener('click', (e) => { e.stopPropagation(); opts.onDelete(); });
  cell.append(del);

  return cell;
}

function makeBadge(text, bg, cfg, wide = false) {
  return el('div', {
    class: 'badge', text,
    style: {
      background: bg,
      transform: `translate(calc(-50% + ${cfg.bx}px), calc(-50% + ${cfg.by}px))`,
      minWidth: wide ? 'auto' : cfg.bw + 'px',
      height: cfg.bh + 'px',
      borderRadius: cfg.radius + 'px',
      fontSize: cfg.fontSize + 'px',
      padding: '0 5px',
    },
  });
}