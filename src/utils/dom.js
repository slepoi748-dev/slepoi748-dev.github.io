// Утилиты DOM: безопасное создание элементов, экранирование, делегирование.

/** Создать элемент. attrs: {class, text, html(только доверенное), dataset, style, on:{click:fn}} */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // использовать ТОЛЬКО для статических шаблонов
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style') Object.assign(node.style, v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Безопасно задать фоновую картинку (data: или относительный путь). */
export function setBgImage(node, url) {
  if (!url) { node.style.backgroundImage = ''; return; }
  const safe = String(url).replace(/["\\]/g, '');
  node.style.backgroundImage = `url("${safe}")`;
  node.style.backgroundSize = 'cover';
  node.style.backgroundPosition = 'center';
}

export const $ = (sel, root = document) => root.querySelector(sel);