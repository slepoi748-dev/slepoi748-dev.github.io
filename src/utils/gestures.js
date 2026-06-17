// Единый хелпер жестов: tap, longPress, swipe, multiTap. Без дублирования touch/mouse.

export function pointer(node, { onTap, onLongPress, onMove, longMs = 1000, moveTol = 12 } = {}) {
  let timer = null, sx = 0, sy = 0, moved = false, long = false;

  const start = (x, y) => {
    moved = false; long = false; sx = x; sy = y;
    if (onLongPress) {
      timer = setTimeout(() => { if (!moved) { long = true; onLongPress(); } }, longMs);
    }
  };
  const move = (x, y) => {
    if (Math.abs(x - sx) > moveTol || Math.abs(y - sy) > moveTol) {
      moved = true; clearTimeout(timer);
    }
    onMove?.(x, y);
  };
  const end = () => {
    clearTimeout(timer);
    if (!moved && !long) onTap?.();
  };
  const cancel = () => clearTimeout(timer);

  node.addEventListener('touchstart', (e) => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  node.addEventListener('touchmove', (e) => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  node.addEventListener('touchend', end);
  node.addEventListener('touchcancel', cancel);
  let mouseDown = false;
  node.addEventListener('mousedown', (e) => { mouseDown = true; start(e.clientX, e.clientY); });
  node.addEventListener('mousemove', (e) => { if (mouseDown) move(e.clientX, e.clientY); });
  node.addEventListener('mouseup', () => { mouseDown = false; end(); });
  node.addEventListener('mouseleave', () => { if (mouseDown) { mouseDown = false; cancel(); } });
}

// gestures.js — исправленный multiTap
// Возвращает функцию: вызывай её на каждый тап. Срабатывает cb ровно при N тапах
// внутри окна timeoutMs между касаниями.
export function multiTap(count, cb, timeoutMs = 400) {
  let n = 0;
  let timer = null;
  return function () {
    n++;
    clearTimeout(timer);
    if (n >= count) {
      n = 0;
      cb();
      return;
    }
    timer = setTimeout(() => { n = 0; }, timeoutMs);
  };
}

/** Свайп по контейнеру. onSwipe('up'|'down'|'left'|'right', startY). */
export function swipe(node, onSwipe, threshold = 50) {
  let x0 = 0, y0 = 0, down = false;
  const s = (x, y) => { x0 = x; y0 = y; down = true; };
  const e = (x, y) => {
    if (!down) return; down = false;
    const dx = x - x0, dy = y - y0;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > threshold) onSwipe(dx < 0 ? 'left' : 'right', y0);
    } else if (Math.abs(dy) > threshold) onSwipe(dy < 0 ? 'up' : 'down', y0);
  };
  node.addEventListener('touchstart', (ev) => s(ev.touches[0].clientX, ev.touches[0].clientY), { passive: true });
  node.addEventListener('touchend', (ev) => e(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY), { passive: true });
  node.addEventListener('mousedown', (ev) => s(ev.clientX, ev.clientY));
  node.addEventListener('mouseup', (ev) => e(ev.clientX, ev.clientY));
}