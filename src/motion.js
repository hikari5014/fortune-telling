/* 動態引擎：進場、漣漪、指標光暈、滑動切頁、數值計數 */
import { store } from './store.js';

const motionOn = () => document.documentElement.dataset.motion !== 'off';

/* 逐項進場 */
let io = null;
export function observeReveal(root = document) {
  const items = [...root.querySelectorAll('.reveal:not(.is-in)')];
  if (!motionOn()) { items.forEach(el => el.classList.add('is-in')); return; }
  if (!io) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((en, i) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${Math.min(i * 45, 260)}ms`);
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
  }
  items.forEach((el, i) => {
    el.style.setProperty('--d', `${Math.min(i * 42, 300)}ms`);
    io.observe(el);
  });
  // 首屏保險：避免高度為 0 時卡住
  setTimeout(() => items.forEach(el => {
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in');
  }), 60);
}

/* 漣漪 + 指標光暈（事件委派，全站生效） */
export function initFeedback() {
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.btn, .iconbtn, .tab, .tile, .chip, .tmpl, .profile, .rec, .zw__cell');
    if (!t || !motionOn()) return;
    const r = t.getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'ripple';
    const size = Math.max(r.width, r.height) * 2.1;
    span.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${size}px;height:${size}px`;
    if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
    t.appendChild(span);
    setTimeout(() => span.remove(), 820);
  }, { passive: true });

  document.addEventListener('pointermove', (e) => {
    if (!store.settings.pointerGlow || !motionOn()) return;
    const root = document.documentElement;
    root.style.setProperty('--px', `${(e.clientX / innerWidth) * 100}%`);
    root.style.setProperty('--py', `${(e.clientY / innerHeight) * 100}%`);
    const card = e.target.closest('.track');
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
  }, { passive: true });

  // 觸控時也要有光暈
  document.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.track');
    if (!card || !motionOn()) return;
    const t = e.touches[0], r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${t.clientX - r.left}px`);
    card.style.setProperty('--my', `${t.clientY - r.top}px`);
    card.classList.add('is-touched');
    setTimeout(() => card.classList.remove('is-touched'), 700);
  }, { passive: true });
}

/* 左右滑動切頁 */
export function initSwipe(onSwipe) {
  let x0 = 0, y0 = 0, t0 = 0, active = false;
  const view = document.getElementById('view');
  addEventListener('touchstart', (e) => {
    if (!store.settings.swipeNav || e.touches.length !== 1) return;
    if (e.target.closest('.sheet, .textarea, .preview, [data-noswipe], input[type="range"]')) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); active = true;
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (!active) return;
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (Math.abs(dy) > Math.abs(dx)) { active = false; view.style.transform = ''; return; }
    if (Math.abs(dx) > 14 && motionOn()) {
      view.dataset.dragging = '1';
      view.style.transform = `translateX(${dx * 0.22}px)`;
      view.style.opacity = String(1 - Math.min(Math.abs(dx) / 700, 0.22));
    }
  }, { passive: true });
  addEventListener('touchend', (e) => {
    if (!active) return;
    active = false;
    const dx = e.changedTouches[0].clientX - x0;
    const dt = Date.now() - t0;
    view.removeAttribute('data-dragging');
    view.style.transform = ''; view.style.opacity = '';
    if (Math.abs(dx) > 68 && dt < 700) onSwipe(dx < 0 ? 1 : -1);
  });
}

/* 數值計數動畫 */
export function countUp(el, to, { from = 0, dur = 900, decimals = 0, suffix = '' } = {}) {
  if (!motionOn()) { el.textContent = to.toFixed(decimals) + suffix; return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min((t - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = (from + (to - from) * e).toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* 環形進度 */
export function dial(percent, label) {
  const r = 54, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
  return `<div class="dial">
    <svg viewBox="0 0 128 128" aria-label="${label || ''} ${Math.round(percent)} 分">
      <circle class="dial__track" cx="64" cy="64" r="${r}"/>
      <circle class="dial__value" cx="64" cy="64" r="${r}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        style="--dash-from:${c.toFixed(1)}"/>
    </svg>
    <div class="dial__num" data-countup="${percent}">0</div>
  </div>`;
}

export function runCountUps(root = document) {
  root.querySelectorAll('[data-countup]').forEach(el => {
    const v = parseFloat(el.dataset.countup);
    countUp(el, v, { decimals: Number.isInteger(v) ? 0 : 1 });
    el.removeAttribute('data-countup');
  });
}
