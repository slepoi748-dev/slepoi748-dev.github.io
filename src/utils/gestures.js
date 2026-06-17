export function onLongPress(node, handler, getDelay = () => 1000) {
  let timer = null, fired = false, startX = 0, startY = 0;
  const TOL = 12;

  const start = (x, y) => {
    fired = false; startX = x; startY = y;
    timer = setTimeout(() => { fired = true; handler(); }, getDelay());
  };
  const cancel = () => { clearTimeout(timer); timer = null; };

  node.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; start(t.clientX, t.clientY);
  }, { passive: true });
  node.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - startX) > TOL || Math.abs(t.clientY - startY) > TOL) cancel();
  }, { passive: true });
  node.addEventListener('touchend', cancel);
  node.addEventListener('touchcancel', cancel);

  node.addEventListener('mousedown', (e) => start(e.clientX, e.clientY));
  node.addEventListener('mousemove', (e) => {
    if (timer && (Math.abs(e.clientX - startX) > TOL || Math.abs(e.clientY - startY) > TOL)) cancel();
  });
  node.addEventListener('mouseup', cancel);
  node.addEventListener('mouseleave', cancel);

  node.addEventListener('click', (e) => {
    if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; }
  }, true);

  return () => cancel();
}