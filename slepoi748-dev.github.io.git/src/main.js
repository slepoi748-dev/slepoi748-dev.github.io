// Точка входа: связывает lock <-> home <-> settings <-> папки <-> меню иконки.
import { $, } from './utils/dom.js';
import { createLockScreen } from './lockscreen/lockscreen.js';
import { createHomeScreen } from './homescreen/homescreen.js';
import { createFolderView } from './homescreen/folder.js';
import { createIconMenu } from './homescreen/iconmenu.js';
import { createSettings } from './settings/settings.js';
import { subscribe } from './state.js';

const lockRoot = $('#lock-root');
const homeRoot = $('#home-root');

let lock, home, folder, iconMenu, settings;

function showHome() { lockRoot.hidden = true; homeRoot.hidden = false; home.render(); }
function showLock() { homeRoot.hidden = true; lockRoot.hidden = false; lock.reset(); lock.refresh(); }

const openIconMenu = (ic, ctx) => iconMenu.open(ic, ctx);
const openFolder = (f) => folder.open(f);

lock = createLockScreen({
  onUnlock: showHome,
  onOpenSettings: () => { showHome(); settings.open(); },
});
home = createHomeScreen({
  onLock: showLock,
  onOpenSettings: () => settings.open(),
  openIconMenu,
  openFolder,
});
folder = createFolderView({ openIconMenu });
iconMenu = createIconMenu({ onChange: () => { home.render(); folder.refresh(); }, openFolder });
settings = createSettings({ home, onClose: () => home.render() });

lockRoot.append(lock.root);
homeRoot.append(home.root, folder.root, iconMenu.root, settings.root);

// перерисовка при изменении состояния (точечно по причинам)
subscribe((reason) => {
  if (reason === 'attempt') return; // не дёргаем home при вводе на локскрине
  if (!homeRoot.hidden) home.render();
});

showLock();