import { store } from './core/state.js';
import { bus, EVENTS } from './core/events.js';
import { loadImageManifest } from './utils/images.js';
import { $, clear } from './utils/dom.js';
import { renderLockscreen } from './screens/lockscreen.js';

let root;
let cleanup = null;

async function boot() {
  root = $('#app');
  await loadImageManifest();
  showLock();

  // Пока рабочего стола нет — после разблокировки покажем заглушку.
  // На Этапе 2 здесь будет renderHomescreen(root).
  bus.on(EVENTS.UNLOCK, () => {
    if (cleanup) cleanup();
    clear(root);
    root.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;align-items:center;
        justify-content:center;flex-direction:column;color:#fff;text-align:center;padding:24px">
        <h2 style="font-weight:600">Разблокировано</h2>
        <p style="color:rgba(235,235,245,0.6)">Экран рабочего стола появится на Этапе 2.</p>
        <button id="back" style="margin-top:20px;padding:10px 20px;border:none;border-radius:10px;
          background:rgba(120,120,128,0.32);color:#fff;font-size:15px">На экран блокировки</button>
      </div>`;
    $('#back').addEventListener('click', showLock);
  });
}

function showLock() {
  if (cleanup) cleanup();
  clear(root);
  cleanup = renderLockscreen(root);
}

boot();