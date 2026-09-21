/* UI 小工具：安全模板、吐司、底部抽屜、複製、簡易 Markdown */
import { icon } from './icons.js';
import { store } from './store.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 標籤模板：一般值自動跳脫；html`` 的結果與 raw(x) 會原樣插入 */
const RAW = Symbol('raw');
class Html {
  constructor(s) { this[RAW] = s; }
  toString() { return this[RAW]; }
}
export const raw = (s) => new Html(String(s ?? ''));
const isRaw = (v) => v instanceof Html || (v && typeof v === 'object' && RAW in v);
const piece = (v) => {
  if (v == null || v === false || v === true) return v === true ? 'true' : '';
  if (isRaw(v)) return String(v[RAW]);
  if (Array.isArray(v)) return v.map(piece).join('');
  return esc(v);
};
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += piece(values[i]) + strings[i + 1];
  return new Html(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function haptic(ms = 8) {
  if (!store.settings.haptics) return;
  try { navigator.vibrate?.(ms); } catch {}
}

/* ── 吐司 ─────────────────────────────── */
export function toast(msg, ms = 2000) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  }, ms);
}

/* ── 背景捲動鎖（iOS 需要 position: fixed 才鎖得住）─────── */
let locked = false, lockedY = 0, lockedHash = '';
function lockScroll() {
  if (locked) return;                      // 抽屜互相替換時不重複上鎖
  locked = true;
  lockedY = window.scrollY;
  lockedHash = location.hash;
  const b = document.body;
  b.style.position = 'fixed';
  b.style.top = `-${lockedY}px`;
  b.style.left = '0';
  b.style.right = '0';
  b.style.width = '100%';
}
function unlockScroll() {
  if (!locked) return;
  locked = false;
  const b = document.body;
  b.style.position = '';
  b.style.top = '';
  b.style.left = '';
  b.style.right = '';
  b.style.width = '';
  // 若期間換了頁，回到頂端而不是舊頁的捲動位置
  window.scrollTo({ top: location.hash === lockedHash ? lockedY : 0, behavior: 'instant' });
}

/* ── 底部抽屜 ─────────────────────────── */
export function sheet({ title, body, actions = '', onMount } = {}) {
  const root = $('#sheet-root');
  root.innerHTML = html`
    <div class="sheet-scrim" data-close></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${title || '對話框'}">
      <div class="sheet__drag">
        <div class="sheet__grip"></div>
      </div>
      <header class="sheet__head sheet__drag">
        <h3>${title || ''}</h3>
        <button class="iconbtn" data-close aria-label="關閉">${raw(icon('close'))}</button>
      </header>
      <div class="sheet__body">${raw(body || '')}</div>
      ${actions ? raw(`<div class="sheet__body" style="padding-top:0">${actions}</div>`) : ''}
    </section>`;

  const panel = $('.sheet', root);
  lockScroll();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    unlockScroll();
    panel.style.transition = 'transform var(--dur-3) var(--ease-in), opacity var(--dur-3)';
    panel.style.transform = 'translateX(-50%) translate3d(0,100%,0)';
    $('.sheet-scrim', root).style.opacity = '0';
    setTimeout(() => { root.innerHTML = ''; }, 260);
  };
  $$('[data-close]', root).forEach(b => b.addEventListener('click', close));
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  // 下拉關閉：非被動監聽 + preventDefault，避免同時捲動底層造成晃動
  let y0 = null, dy = 0, raf = 0;
  const handles = $$('.sheet__drag', root);
  const paint = () => { raf = 0; panel.style.transform = `translateX(-50%) translate3d(0,${dy}px,0)`; };
  const start = (e) => {
    if (e.touches && e.touches.length !== 1) return;
    y0 = e.touches ? e.touches[0].clientY : e.clientY;
    dy = 0;
    panel.style.transition = 'none';
    panel.style.willChange = 'transform';
  };
  const move = (e) => {
    if (y0 == null) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dy = Math.max(0, y - y0);
    if (dy > 0 && e.cancelable) e.preventDefault();   // 底層不要跟著捲
    if (!raf) raf = requestAnimationFrame(paint);
  };
  const end = () => {
    if (y0 == null) return;
    const travelled = dy;
    y0 = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    panel.style.willChange = '';
    panel.style.transition = 'transform var(--dur-3) var(--ease-out)';
    if (travelled > 110) close(); else panel.style.transform = 'translateX(-50%)';
  };
  handles.forEach(el => {
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
  });

  // iOS 鍵盤彈出時把聚焦的欄位帶進可視範圍
  $$('.sheet input, .sheet textarea, .sheet select', root).forEach(el => {
    el.addEventListener('focus', () => {
      setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 260);
    });
  });

  onMount?.(root, close);
  setTimeout(() => $('.sheet input, .sheet textarea, .sheet button:not([data-close])', root)?.focus?.(), 240);
  return close;
}

export function confirmSheet(title, message, confirmText = '確定') {
  return new Promise(resolve => {
    let done = false;
    const close = sheet({
      title,
      body: html`<p class="hint" style="font-size:var(--step-0);color:var(--ink-2)">${message}</p>`,
      actions: html`<div class="row" style="gap:var(--sp-2)">
        <button class="btn btn--ghost" data-no style="flex:1">取消</button>
        <button class="btn btn--primary" data-yes style="flex:1">${confirmText}</button></div>`,
      onMount(root, close) {
        $('[data-yes]', root).addEventListener('click', () => { done = true; resolve(true); close(); });
        $('[data-no]', root).addEventListener('click', () => { done = true; resolve(false); close(); });
      },
    });
    const obs = setInterval(() => {
      if (!document.querySelector('.sheet')) { clearInterval(obs); if (!done) resolve(false); }
    }, 300);
  });
}

/* ── 複製 ─────────────────────────────── */
export async function copyText(text, okMsg = '已複製') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  haptic(12);
  toast(okMsg);
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ── 極簡 Markdown ────────────────────── */
export function md(src) {
  const lines = esc(src).split('\n');
  let out = '', inUl = false, inOl = false, inQuote = false;
  const closeLists = () => {
    if (inUl) { out += '</ul>'; inUl = false; }
    if (inOl) { out += '</ol>'; inOl = false; }
    if (inQuote) { out += '</blockquote>'; inQuote = false; }
  };
  const inline = (t) => t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  for (const ln of lines) {
    const t = ln.trimEnd();
    if (/^\s*$/.test(t)) { closeLists(); continue; }
    let m;
    if ((m = t.match(/^(#{1,4})\s+(.*)$/))) { closeLists(); out += `<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`; continue; }
    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(t)) { closeLists(); out += '<hr>'; continue; }
    if ((m = t.match(/^\s*>\s?(.*)$/))) { if (!inQuote) { closeLists(); out += '<blockquote>'; inQuote = true; } out += `<p>${inline(m[1])}</p>`; continue; }
    if ((m = t.match(/^\s*[-*•]\s+(.*)$/))) { if (!inUl) { closeLists(); out += '<ul>'; inUl = true; } out += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = t.match(/^\s*\d+[.)]\s+(.*)$/))) { if (!inOl) { closeLists(); out += '<ol>'; inOl = true; } out += `<li>${inline(m[1])}</li>`; continue; }
    closeLists();
    out += `<p>${inline(t)}</p>`;
  }
  closeLists();
  return out;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
