// src/utils/swipe-down.js
// Свайп сверху вниз по экрану. Срабатывает, только если жест начат
// в верхней зоне и протянут вниз достаточно далеко.

export function onSwipeDown(target, callback, opts = {}) {
  const {
    minDistance = 90,    // минимальный вертикальный путь, px
    maxOffAxis = 80,     // максимальное горизонтальное отклонение, px
    startZone = 120,     // жест должен начаться в верхних N px
    maxTime = 800,       // максимум времени на жест, мс
  } = opts;

  let startX = 0, startY = 0, startT = 0, tracking = false;

  const onStart = (e) => {
    const t = e.touches ? e.touches[0] : e;
    if (t.clientY > startZone) { tracking = false; return; }
    startX = t.clientX;
    startY = t.clientY;
    startT = Date.now();
    tracking = true;
  };

  const onEnd = (e) => {
    if (!tracking) return;
    tracking = false;
    const t = (e.changedTouches ? e.changedTouches[0] : e) || {};
    const dx = (t.clientX ?? startX) - startX;
    const dy = (t.clientY ?? startY) - startY;
    const dt = Date.now() - startT;
    if (dt <= maxTime && dy >= minDistance && Math.abs(dx) <= maxOffAxis) {
      callback();
    }
  };

  target.addEventListener('touchstart', onStart, { passive: true });
  target.addEventListener('touchend', onEnd, { passive: true });
  // поддержка мыши для отладки на ПК
  target.addEventListener('mousedown', onStart);
  target.addEventListener('mouseup', onEnd);

  return () => {
    target.removeEventListener('touchstart', onStart);
    target.removeEventListener('touchend', onEnd);
    target.removeEventListener('mousedown', onStart);
    target.removeEventListener('mouseup', onEnd);
  };
}