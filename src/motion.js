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
const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)').matches;

const RIPPLE_SEL = '.btn, .iconbtn, .tab, .tile, .chip, .tmpl, .profile, .rec, .zw__cell, .luckstep, .yearstrip__y, .pair, .signcard';

export function initFeedback() {
  // 水波紋：按住不放時停在滿版，放開或移出才淡出（跟 Material 的手感一致）
  document.addEventListener('pointerdown', (e) => {
    const host = e.target.closest(RIPPLE_SEL);
    if (!host || host.disabled || !motionOn() || e.button !== 0) return;
    const r = host.getBoundingClientRect();
    let box = host.querySelector(':scope > .ripple-box');
    if (!box) {
      box = document.createElement('span');
      box.className = 'ripple-box';
      host.append(box);
    }
    const span = document.createElement('span');
    span.className = 'ripple';
    const size = Math.hypot(r.width, r.height) * 2;
    span.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${size}px;height:${size}px`;
    box.append(span);
    const leave = () => {
      span.classList.add('is-out');
      setTimeout(() => span.remove(), 340);
    };
    host.addEventListener('pointerup', leave, { once: true });
    host.addEventListener('pointerleave', leave, { once: true });
    addEventListener('pointercancel', leave, { once: true });
  }, { passive: true });

  // 指標光暈只在真正有滑鼠時啟用：觸控裝置上每次拖曳都重繪固定層會造成畫面抖動
  if (!FINE_POINTER) return;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !store.settings.pointerGlow || !motionOn()) return;
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
}

/* ── 分段控制：選中色塊滑到新位置 ─────────────────────── */
export function moveSegThumb(seg) {
  const ind = seg.querySelector(':scope > .seg__ind');
  if (!ind) return;
  const on = seg.querySelector('button[aria-pressed="true"]');
  if (!on || !on.offsetWidth) { ind.hidden = true; return; }   // 隱藏中量不到寬度
  ind.hidden = false;
  ind.style.setProperty('--seg-x', `${on.offsetLeft}px`);
  ind.style.setProperty('--seg-w', `${on.offsetWidth}px`);
}

export function initSeg(root = document) {
  root.querySelectorAll('.seg').forEach(seg => {
    let ind = seg.querySelector(':scope > .seg__ind');
    const first = !ind;
    if (first) {
      ind = document.createElement('span');
      ind.className = 'seg__ind';
      ind.setAttribute('aria-hidden', 'true');
      ind.style.transition = 'none';                 // 第一次定位不要從 0 滑過來
      seg.prepend(ind);
    }
    if (!seg.dataset.segBound) {
      seg.dataset.segBound = '1';
      // 各頁自己的 click 監聽先跑完改好 aria-pressed，這裡再量位置
      seg.addEventListener('click', () => requestAnimationFrame(() => moveSegThumb(seg)));
    }
    moveSegThumb(seg);
    if (first) requestAnimationFrame(() => { ind.style.transition = ''; });
  });
}
addEventListener('resize', () => document.querySelectorAll('.seg').forEach(moveSegThumb));

/* ── 左右滑動切頁 ──────────────────────────────────────────
   iOS 上會晃動的成因與對策：
   1. 方向沒有鎖定 → 每次 touchmove 重新判斷，手指稍微偏斜就在水平／垂直之間跳動
      → 超過門檻後鎖定軸向，整個手勢不再改變
   2. 慣性捲動途中起手 → 瀏覽器還在捲，又疊加 transform
      → 最近一次捲動 250ms 內不啟動
   3. 每個 touchmove 直接寫 style → 一幀可能寫多次
      → 用 requestAnimationFrame 節流，且只寫 translate3d（合成層，不觸發重排）
   4. 螢幕邊緣起手會和 Safari 的返回手勢打架 → 左右 28px 不啟動
   5. 手勢起點在水平捲動容器內（年份尺、大運軌道、牌陣）→ 不攔截           */
let lastScrollAt = 0;
addEventListener('scroll', () => { lastScrollAt = Date.now(); }, { passive: true, capture: true });

function inHorizontalScroller(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.hasAttribute?.('data-noswipe')) return true;
    if (n.scrollWidth > n.clientWidth + 4) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

export function initSwipe(onSwipe) {
  const view = document.getElementById('view');
  const LATCH = 14;          // 判定軸向所需的位移
  const MAX_PULL = 26;       // 拖曳預覽最多位移這麼多，避免大面積重繪
  let x0 = 0, y0 = 0, t0 = 0;
  let axis = null;           // null 尚未鎖定 / 'x' / 'y'
  let tracking = false, raf = 0, pending = 0;

  const paint = () => {
    raf = 0;
    view.style.transform = pending ? `translate3d(${pending}px,0,0)` : '';
  };
  const reset = (animate) => {
    tracking = false; axis = null; pending = 0;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    view.style.willChange = '';
    view.removeAttribute('data-dragging');
    view.style.transition = animate ? 'transform var(--dur-3) var(--ease-out)' : '';
    view.style.transform = '';
    if (animate) setTimeout(() => { view.style.transition = ''; }, 320);
  };

  addEventListener('touchstart', (e) => {
    if (!store.settings.swipeNav || e.touches.length !== 1) { tracking = false; return; }
    const t = e.touches[0];
    if (t.clientX < 28 || t.clientX > innerWidth - 28) { tracking = false; return; }  // 讓給系統返回手勢
    if (Date.now() - lastScrollAt < 250) { tracking = false; return; }                // 慣性捲動中不接手
    if (e.target.closest('.sheet, input, textarea, select')) { tracking = false; return; }
    if (inHorizontalScroller(e.target)) { tracking = false; return; }
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
    axis = null; tracking = true; pending = 0;
    view.style.transition = '';
  }, { passive: true });

  addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;

    if (!axis) {
      if (Math.abs(dx) < LATCH && Math.abs(dy) < LATCH) return;     // 還看不出方向，先不動
      axis = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';          // 一旦鎖定就不再改變
      if (axis === 'x' && motionOn()) {
        view.dataset.dragging = '1';
        view.style.willChange = 'transform';
      }
      return;
    }
    if (axis !== 'x' || !motionOn()) return;

    // 阻尼：越拖越難拖，且上限 MAX_PULL，避免整頁大面積重繪
    const pull = dx - Math.sign(dx) * LATCH;
    pending = Math.sign(pull) * MAX_PULL * (1 - Math.exp(-Math.abs(pull) / 90));
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });

  const finish = (e) => {
    if (!tracking) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dt = Date.now() - t0;
    const fired = axis === 'x' && Math.abs(dx) > 62 && dt < 700;
    reset(axis === 'x');
    if (fired) onSwipe(dx < 0 ? 1 : -1);
  };
  addEventListener('touchend', finish, { passive: true });
  addEventListener('touchcancel', () => reset(true), { passive: true });
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
/* 分數色階：0 紅 → 100 綠。
   停點刻意讓紅色分量單調遞減、綠色分量單調遞增，
   中段才不會出現「綠先多後少」的糊掉感。

   顏色永遠只是輔助 —— 同一個分數同時由三個管道表達：
   圓環填滿的長度、圈中央的數字、以及顏色。
   紅綠色盲看不出色相差異時，前兩個照樣讀得到。
   深色模式另一組較亮的停點，由 CSS 依主題挑，不需要 JS 重算。 */
const SCALE_LIGHT = [[0, 190, 40, 34], [25, 188, 96, 30], [50, 170, 130, 30], [75, 108, 142, 48], [100, 30, 150, 78]];
const SCALE_DARK = [[0, 255, 110, 96], [25, 252, 150, 78], [50, 235, 195, 80], [75, 150, 215, 110], [100, 80, 230, 135]];

function rampAt(stops, pct) {
  const v = Math.max(0, Math.min(100, pct));
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) { a = stops[i - 1]; b = stops[i]; break; }
  }
  const span = b[0] - a[0] || 1;
  const t = (v - a[0]) / span;
  const ch = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${ch(1)} ${ch(2)} ${ch(3)})`;
}

/** 分數對應的顏色（給長圖之類非 CSS 的地方用） */
export const scoreColor = (pct, dark = false) => rampAt(dark ? SCALE_DARK : SCALE_LIGHT, pct);

/**
 * 分數環
 * @param {number} percent 0–100
 * @param {string} label 無障礙標籤
 * @param {object} o {scale 是否用色階（僅適用「越高越好」的分數）}
 */
export function dial(percent, label, { scale = false } = {}) {
  const r = 54, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  const off = c * (1 - pct / 100);
  // 色階由設定決定；關閉時不輸出變數，CSS 會退回單色
  const on = scale && store.settings.scoreColor !== false;
  const vars = on ? ` style="--dial-c:${rampAt(SCALE_LIGHT, pct)};--dial-cd:${rampAt(SCALE_DARK, pct)}"` : '';
  return `<div class="dial"${vars}>
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
