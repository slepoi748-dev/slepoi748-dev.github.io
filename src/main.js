const isPWA = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;
console.log('PWA standalone:', isPWA);
document.documentElement.dataset.pwa = isPWA ? '1' : '0';

import { store } from './core/state.js';
import { bus, EVENTS } from './core/events.js';
import { loadImageManifest } from './utils/images.js';
import { $, clear } from './utils/dom.js';
import { renderLockscreen } from './screens/lockscreen.js';
import { renderHomescreen } from './screens/homescreen.js';
import { initBadges } from './core/badges.js';

initBadges();

let root;
let cleanup = null;

async function boot() {
  root = $('#app');
  await loadImageManifest();
  showLock();

  bus.on(EVENTS.UNLOCK, showHome);
  bus.on(EVENTS.LOCK, showLock);
}

function showLock() {
  if (cleanup) cleanup();
  clear(root);
  cleanup = renderLockscreen(root);
}

function showHome() {
  if (cleanup) cleanup();
  clear(root);
  cleanup = renderHomescreen(root);
}

boot();