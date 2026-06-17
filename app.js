const LS_KEY = 'fauxphone.state.v1';
const DEFAULT_COLORS = ['#0a84ff','#34c759','#ff9500','#ff3b30','#af52de','#ff2d55','#5ac8fa','#ffcc00'];

const DEFAULT_APPS = [
  {id:'phone',   name:'Телефон',   emoji:'📞', color:'#34c759', badge:0, dock:true},
  {id:'safari',  name:'Safari',    emoji:'🧭', color:'#0a84ff', badge:0, dock:true},
  {id:'messages',name:'Сообщения', emoji:'💬', color:'#34c759', badge:3, dock:true},
  {id:'music',   name:'Музыка',    emoji:'🎵', color:'#ff2d55', badge:0, dock:true},
  {id:'camera',  name:'Камера',    emoji:'📷', color:'#3a3a3c', badge:0},
  {id:'photos',  name:'Фото',      emoji:'🌸', color:'#fff',    badge:0},
  {id:'clock',   name:'Часы',      emoji:'⏰', color:'#1c1c1e', badge:0},
  {id:'weather', name:'Погода',    emoji:'⛅', color:'#0a84ff', badge:0},
  {id:'maps',    name:'Карты',     emoji:'🗺️', color:'#34c759', badge:0},
  {id:'notes',   name:'Заметки',   emoji:'📝', color:'#ffcc00', badge:0},
  {id:'calc',    name:'Калькулятор',emoji:'🧮',color:'#1c1c1e', badge:0},
  {id:'settings',name:'Настройки', emoji:'⚙️', color:'#8e8e93', badge:1},
  {id:'mail',    name:'Почта',     emoji:'✉️', color:'#0a84ff', badge:12},
  {id:'store',   name:'App Store', emoji:'🅰️', color:'#0a84ff', badge:0},
];

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.warn('bad state', e); }
  return freshState();
}

function freshState(){
  const apps = {};
  DEFAULT_APPS.forEach(a => apps[a.id] = {...a});
  return {
    apps,
    pages: [DEFAULT_APPS.filter(a=>!a.dock).map(a=>a.id)],
    dock:  DEFAULT_APPS.filter(a=>a.dock).map(a=>a.id),
    folders:{},
    wallpaper:'grad-1',
    locked:true,
  };
}

function saveState(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch(e){ console.warn('save failed', e); }
}
const $screen = document.getElementById('screen');
const $pages  = document.getElementById('pages');
const $dock   = document.getElementById('dock');
const $dots   = document.getElementById('pageDots');

let currentPage = 0;

function render(){
  renderPages();
  renderDock();
  renderDots();
  renderClock();
}

function renderPages(){
  $pages.innerHTML = '';
  state.pages.forEach((ids, pageIdx) => {
    const page = document.createElement('div');
    page.className = 'home-page';
    page.dataset.page = pageIdx;
    const grid = document.createElement('div');
    grid.className = 'icon-grid';
    ids.forEach(id => grid.appendChild(buildIcon(id)));
    page.appendChild(grid);
    $pages.appendChild(page);
  });
  $pages.style.width = `${state.pages.length * 100}%`;
  $pages.style.transform = `translateX(-${currentPage * (100/state.pages.length)}%)`;
}

function renderDock(){
  const grid = $dock.querySelector('.icon-grid');
  grid.innerHTML = '';
  state.dock.forEach(id => grid.appendChild(buildIcon(id, true)));
}
function buildIcon(id, inDock=false){
  const folder = state.folders[id];
  const el = document.createElement('div');
  el.className = 'app-icon';
  el.dataset.id = id;

  const box = document.createElement('div');
  box.className = 'icon-box';

  if(folder){
    el.classList.add('is-folder');
    box.classList.add('folder-box');
    folder.apps.slice(0,9).forEach(aid => {
      const mini = document.createElement('div');
      mini.className = 'mini-ic';
      const a = state.apps[aid];
      mini.textContent = a ? a.emoji : '';
      box.appendChild(mini);
    });
  }else{
    const a = state.apps[id];
    box.style.background = a.image ? `center/cover url(${a.image})` : a.color;
    const em = document.createElement('span');
    em.className = 'emoji';
    if(!a.image) em.textContent = a.emoji;
    box.appendChild(em);
    if(a.badge > 0){
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = a.badge > 99 ? '99+' : a.badge;
      box.appendChild(b);
    }
  }

  el.appendChild(box);
  if(!inDock){
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = folder ? folder.name : state.apps[id].name;
    el.appendChild(label);
  }

  attachIconHandlers(el, id);
  return el;
}
function renderDots(){
  $dots.innerHTML = '';
  state.pages.forEach((_, i) => {
    const d = document.createElement('span');
    d.className = 'dot' + (i === currentPage ? ' active' : '');
    d.addEventListener('click', () => goToPage(i));
    $dots.appendChild(d);
  });
}

function renderClock(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const $lt = document.getElementById('lockTime');
  const $ld = document.getElementById('lockDate');
  if($lt) $lt.textContent = `${hh}:${mm}`;
  if($ld) $ld.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
  document.querySelectorAll('.sb-time').forEach(e => e.textContent = `${hh}:${mm}`);
}

setInterval(renderClock, 1000 * 10);
function goToPage(i){
  currentPage = Math.max(0, Math.min(state.pages.length - 1, i));
  $pages.style.transform = `translateX(-${currentPage * (100/state.pages.length)}%)`;
  renderDots();
}

(function pageSwipe(){
  let startX = 0, startY = 0, dragging = false, locked = null;
  const w = () => $screen.clientWidth;

  $pages.addEventListener('touchstart', e => {
    if(editMode) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true; locked = null;
    $pages.style.transition = 'none';
  }, {passive:true});

  $pages.addEventListener('touchmove', e => {
    if(!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if(locked === null) locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if(locked !== 'x') return;
    const base = -currentPage * (100 / state.pages.length);
    const pct = (dx / w()) * (100 / state.pages.length);
    $pages.style.transform = `translateX(${base + pct}%)`;
  }, {passive:true});

  $pages.addEventListener('touchend', e => {
    if(!dragging) return;
    dragging = false;
    $pages.style.transition = '';
    const dx = e.changedTouches[0].clientX - startX;
    if(locked === 'x' && Math.abs(dx) > w() * 0.25){
      goToPage(currentPage + (dx < 0 ? 1 : -1));
    }else{
      goToPage(currentPage);
    }
  });
})();
let editMode = false;
let pressTimer = null;

function attachIconHandlers(el, id){
  el.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => enterEditMode(), 550);
  }, {passive:true});

  ['touchend','touchmove','touchcancel'].forEach(ev =>
    el.addEventListener(ev, () => clearTimeout(pressTimer), {passive:true}));

  el.addEventListener('click', e => {
    if(editMode){
      e.stopPropagation();
      return;
    }
    state.folders[id] ? openFolder(id) : launchApp(id);
  });

  const del = document.createElement('span');
  del.className = 'icon-delete';
  del.textContent = '×';
  del.addEventListener('click', e => {
    e.stopPropagation();
    removeApp(id);
  });
  el.appendChild(del);
}

function enterEditMode(){
  if(editMode) return;
  editMode = true;
  $screen.classList.add('edit-mode');
  if(navigator.vibrate) navigator.vibrate(15);
}

function exitEditMode(){
  editMode = false;
  $screen.classList.remove('edit-mode');
  saveState();
}
function removeApp(id){
  state.pages = state.pages
    .map(p => p.filter(x => x !== id))
    .filter(p => p.length);
  if(!state.pages.length) state.pages = [[]];
  state.dock = state.dock.filter(x => x !== id);
  if(currentPage >= state.pages.length) currentPage = state.pages.length - 1;
  render();
  saveState();
}
const $appLayer = document.getElementById('appLayer');
let openAppId = null;

function launchApp(id){
  const a = state.apps[id];
  openAppId = id;

  const iconBox = document.querySelector(`.app-icon[data-id="${id}"] .icon-box`);
  const view = document.createElement('div');
  view.className = 'app-view';
  view.dataset.id = id;
  view.innerHTML = renderAppContent(id);
  $appLayer.appendChild(view);
  $appLayer.classList.add('open');

  if(iconBox){
    const r = iconBox.getBoundingClientRect();
    const sr = $screen.getBoundingClientRect();
    const ox = ((r.left + r.width/2) - sr.left) / sr.width * 100;
    const oy = ((r.top + r.height/2) - sr.top) / sr.height * 100;
    view.style.transformOrigin = `${ox}% ${oy}%`;
  }

  requestAnimationFrame(() => view.classList.add('in'));

  if(a.badge){ a.badge = 0; renderPages(); renderDock(); saveState(); }
}

function closeApp(){
  if(openAppId === null) return;
  const view = $appLayer.querySelector('.app-view');
  if(!view){ $appLayer.classList.remove('open'); openAppId = null; return; }

  const iconBox = document.querySelector(`.app-icon[data-id="${openAppId}"] .icon-box`);
  if(iconBox){
    const r = iconBox.getBoundingClientRect();
    const sr = $screen.getBoundingClientRect();
    const ox = ((r.left + r.width/2) - sr.left) / sr.width * 100;
    const oy = ((r.top + r.height/2) - sr.top) / sr.height * 100;
    view.style.transformOrigin = `${ox}% ${oy}%`;
  }

  view.classList.remove('in');
  view.classList.add('out');
  view.addEventListener('transitionend', () => {
    view.remove();
    $appLayer.classList.remove('open');
    openAppId = null;
  }, {once:true});
}
const $home = document.getElementById('homeBtn');
$home.addEventListener('click', () => {
  if(editMode) return exitEditMode();
  if(openAppId !== null) return closeApp();
  if(state.locked) return; // на залоченном — игнор
});

(function homeSwipe(){
  let startY = 0, active = false;
  $screen.addEventListener('touchstart', e => {
    const y = e.touches[0].clientY;
    if(y > $screen.getBoundingClientRect().bottom - 40){ startY = y; active = true; }
  }, {passive:true});
  $screen.addEventListener('touchend', e => {
    if(!active) return;
    active = false;
    if(startY - e.changedTouches[0].clientY > 60){
      if(openAppId !== null) closeApp();
      else if(editMode) exitEditMode();
    }
  });
})();
function renderAppContent(id){
  const a = state.apps[id];
  const head = `
    <div class="app-bar">
      <button class="app-back" onclick="closeApp()">‹ Домой</button>
      <span class="app-title">${a.name}</span>
    </div>`;
  const body = (BUILTIN[a.kind] || builtinDefault)(a);
  return head + `<div class="app-body" data-kind="${a.kind}">${body}</div>`;
}

function builtinDefault(a){
  return `<div class="placeholder">
            <div class="ph-emoji">${a.emoji}</div>
            <p>${a.name} — демо-экран</p>
          </div>`;
}

const BUILTIN = {};
BUILTIN.calc = () => `
  <div class="calc">
    <div class="calc-display" id="calcDisp">0</div>
    <div class="calc-keys">
      ${['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','=']
        .map(k => `<button class="ck ${'÷×−+='.includes(k)?'op':''} ${k==='0'?'zero':''}" data-k="${k}">${k}</button>`)
        .join('')}
    </div>
  </div>`;

function wireCalc(root){
  const disp = root.querySelector('#calcDisp');
  let cur = '0', prev = null, op = null, fresh = false;
  const show = () => disp.textContent = cur;
  const calc = (a,b,o) => ({'+':a+b,'−':a-b,'×':a*b,'÷':b?a/b:0}[o]);

  root.querySelectorAll('.ck').forEach(btn => btn.addEventListener('click', () => {
    const k = btn.dataset.k;
    if(k === 'C'){ cur='0'; prev=null; op=null; }
    else if(k === '±') cur = String(parseFloat(cur) * -1);
    else if(k === '%') cur = String(parseFloat(cur) / 100);
    else if('÷×−+'.includes(k)){ prev = parseFloat(cur); op = k; fresh = true; }
    else if(k === '='){
      if(op !== null){ cur = String(calc(prev, parseFloat(cur), op)); op = null; fresh = true; }
    }
    else if(k === '.'){ if(!cur.includes('.')) cur += '.'; }
    else { cur = (fresh || cur === '0') ? k : cur + k; fresh = false; }
    show();
  }));
}
const WIRE = { calc: wireCalc, notes: wireNotes, clock: wireClock };

// в launchApp после appendChild(view):
const w = WIRE[a.kind];
if(w) w(view);
BUILTIN.notes = () => `
  <div class="notes">
    <div class="notes-list" id="notesList"></div>
    <textarea class="notes-edit" id="notesEdit" placeholder="Новая заметка…"></textarea>
    <div class="notes-toolbar">
      <button id="noteNew">+ Новая</button>
      <button id="noteDel">Удалить</button>
    </div>
  </div>`;

function wireNotes(root){
  const KEY = 'phone.notes';
  let notes = JSON.parse(localStorage.getItem(KEY) || '[]');
  let active = notes.length ? 0 : -1;
  const list = root.querySelector('#notesList');
  const edit = root.querySelector('#notesEdit');

  const persist = () => localStorage.setItem(KEY, JSON.stringify(notes));

  function renderList(){
    list.innerHTML = '';
    notes.forEach((n, i) => {
      const row = document.createElement('div');
      row.className = 'note-row' + (i === active ? ' active' : '');
      row.textContent = (n.split('\n')[0] || 'Без названия').slice(0, 28);
      row.addEventListener('click', () => { active = i; sync(); });
      list.appendChild(row);
    });
  }
  function sync(){
    renderList();
    edit.value = active >= 0 ? notes[active] : '';
    edit.disabled = active < 0;
  }

  edit.addEventListener('input', () => {
    if(active < 0) return;
    notes[active] = edit.value;
    persist();
    const row = list.children[active];
    if(row) row.textContent = (edit.value.split('\n')[0] || 'Без названия').slice(0, 28);
  });

  root.querySelector('#noteNew').addEventListener('click', () => {
    notes.unshift(''); active = 0; persist(); sync(); edit.focus();
  });
  root.querySelector('#noteDel').addEventListener('click', () => {
    if(active < 0) return;
    notes.splice(active, 1);
    active = notes.length ? 0 : -1;
    persist(); sync();
  });

  sync();
}
BUILTIN.clock = () => `
  <div class="clock-app">
    <div class="analog" id="analog">
      <div class="hand hour" id="hHour"></div>
      <div class="hand minute" id="hMin"></div>
      <div class="hand second" id="hSec"></div>
      <div class="pin"></div>
    </div>
    <div class="digital" id="digi">00:00:00</div>
  </div>`;

function wireClock(root){
  const hHour = root.querySelector('#hHour');
  const hMin  = root.querySelector('#hMin');
  const hSec  = root.querySelector('#hSec');
  const digi  = root.querySelector('#digi');

  function tick(){
    const n = new Date();
    const s = n.getSeconds(), m = n.getMinutes(), h = n.getHours();
    hSec.style.transform  = `rotate(${s * 6}deg)`;
    hMin.style.transform  = `rotate(${m * 6 + s * 0.1}deg)`;
    hHour.style.transform = `rotate(${(h % 12) * 30 + m * 0.5}deg)`;
    digi.textContent = [h, m, s].map(x => String(x).padStart(2,'0')).join(':');
  }
  tick();
  const id = setInterval(tick, 1000);

  // остановить таймер при закрытии экрана
  new MutationObserver((muts, obs) => {
    if(!document.body.contains(root)){ clearInterval(id); obs.disconnect(); }
  }).observe(document.body, {childList:true, subtree:true});
}
BUILTIN.settings = () => `
  <div class="settings">
    <div class="set-group">
      <div class="set-label">Обои</div>
      <div class="wallpapers" id="wallPick">
        ${WALLPAPERS.map((w,i) =>
          `<button class="wall-swatch" data-i="${i}" style="background:${w}"></button>`).join('')}
      </div>
    </div>
    <div class="set-row">
      <span>Тёмная тема</span>
      <label class="switch">
        <input type="checkbox" id="setDark">
        <span class="slider"></span>
      </label>
    </div>
    <div class="set-row">
      <span>Вибрация</span>
      <label class="switch">
        <input type="checkbox" id="setVibe">
        <span class="slider"></span>
      </label>
    </div>
    <div class="set-group">
      <button class="set-reset" id="setReset">Сбросить рабочий стол</button>
    </div>
  </div>`;

WIRE.settings = wireSettings;

function wireSettings(root){
  const wall = root.querySelector('#wallPick');
  wall.querySelectorAll('.wall-swatch').forEach(b => {
    if(+b.dataset.i === state.wallpaper) b.classList.add('active');
    b.addEventListener('click', () => {
      state.wallpaper = +b.dataset.i;
      wall.querySelectorAll('.wall-swatch').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      applyWallpaper();
      saveState();
    });
  });

  const dark = root.querySelector('#setDark');
  dark.checked = state.dark;
  dark.addEventListener('change', () => {
    state.dark = dark.checked;
    document.body.classList.toggle('dark', state.dark);
    saveState();
  });

  const vibe = root.querySelector('#setVibe');
  vibe.checked = state.vibrate;
  vibe.addEventListener('change', () => { state.vibrate = vibe.checked; saveState(); });

  root.querySelector('#setReset').addEventListener('click', () => {
    if(confirm('Сбросить расположение приложений?')){
      localStorage.removeItem(STORE_KEY);
      location.reload();
    }
  });
}
function applyWallpaper(){
  $screen.style.background = WALLPAPERS[state.wallpaper] || WALLPAPERS[0];
}
function init(){
  loadState();
  document.body.classList.toggle('dark', state.dark);
  applyWallpaper();
  render();
  startClockTicker();   // часы в статус-баре
  wireLockScreen();
}

document.addEventListener('DOMContentLoaded', init);
function startClockTicker(){
  const el = document.getElementById('statusTime');
  const upd = () => {
    const n = new Date();
    el.textContent = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  };
  upd();
  setInterval(upd, 10000);
}
function wireLockScreen(){
  const lock = document.getElementById('lockScreen');
  const handle = document.getElementById('lockHandle');
  const timeEl = document.getElementById('lockTime');
  const dateEl = document.getElementById('lockDate');

  function paint(){
    const n = new Date();
    timeEl.textContent = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
    dateEl.textContent = n.toLocaleDateString('ru-RU',
      {weekday:'long', day:'numeric', month:'long'});
  }
  paint();
  setInterval(paint, 10000);

  lock.classList.toggle('hidden', !state.locked);

  let startY = null, dy = 0;
  const begin = y => { if(state.locked) startY = y; };
  const move  = y => {
    if(startY === null) return;
    dy = Math.min(0, y - startY);
    lock.style.transform = `translateY(${dy}px)`;
    lock.style.opacity = String(1 + dy / lock.offsetHeight);
  };
  const end = () => {
    if(startY === null) return;
    if(-dy > lock.offsetHeight * 0.3) unlock();
    else { lock.style.transform = ''; lock.style.opacity = ''; }
    startY = null; dy = 0;
  };

  function unlock(){
    lock.classList.add('lifting');
    lock.addEventListener('transitionend', () => {
      lock.classList.add('hidden');
      lock.classList.remove('lifting');
      lock.style.transform = '';
      lock.style.opacity = '';
    }, {once:true});
    state.locked = false;
    saveState();
    if(state.vibrate && navigator.vibrate) navigator.vibrate(15);
  }

  handle.addEventListener('touchstart', e => begin(e.touches[0].clientY), {passive:true});
  handle.addEventListener('touchmove',  e => move(e.touches[0].clientY),  {passive:true});
  handle.addEventListener('touchend',   end);

  // мышь — для десктопа
  let mouseDown = false;
  handle.addEventListener('mousedown', e => { mouseDown = true; begin(e.clientY); });
  window.addEventListener('mousemove', e => { if(mouseDown) move(e.clientY); });
  window.addEventListener('mouseup',   () => { if(mouseDown){ mouseDown = false; end(); } });

  // блокировка по кнопке питания
  const power = document.getElementById('powerBtn');
  if(power) power.addEventListener('click', () => {
    if(openAppId !== null) closeApp();
    state.locked = true;
    lock.classList.remove('hidden');
    paint();
    saveState();
  });
}
