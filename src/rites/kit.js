/* 神社各處共用的小工具：動畫開關、長按、拖曳拋擲、搖手機、今天做了什麼。 */

import { store } from '../store.js';

export const fast = () => document.documentElement.dataset.motion === 'off'
  || matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = (ms) => new Promise(r => setTimeout(r, fast() ? 10 : ms));

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ── 今天在神社做過什麼（只放這台裝置，隔天自動歸零）───────── */
const TODAY = 'xj.shrineday';
export function today() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(TODAY)); } catch { /* 壞掉就當沒有 */ }
  return s && s.day === dayKey() ? s : { day: dayKey(), torii: false, temizu: false, haiden: false, kuji: null };
}
export function mark(patch) {
  const next = { ...today(), ...patch };
  try { localStorage.setItem(TODAY, JSON.stringify(next)); } catch { /* 私密模式 */ }
  return next;
}

/* ── 和曆日期：令和八年十月三日（御朱印上要寫的）────────────── */
const DIG = '〇一二三四五六七八九';
export function kanjiNum(n) {
  if (n < 10) return DIG[n];
  if (n < 20) return `十${n % 10 ? DIG[n % 10] : ''}`;
  return `${DIG[Math.floor(n / 10)]}十${n % 10 ? DIG[n % 10] : ''}`;
}
export function wareki(d = new Date()) {
  const y = d.getFullYear() - 2018;                // 令和元年 = 2019
  return `令和${y === 1 ? '元' : kanjiNum(y)}年${kanjiNum(d.getMonth() + 1)}月${kanjiNum(d.getDate())}日`;
}

/* ── 長按：按住 ms 毫秒才算數，中途放開就重來 ────────────────
   el 上會多一個 --p（0→1）可以拿來畫進度環。 */
export function hold(el, ms, onDone, { onStart, onCancel, when } = {}) {
  let t0 = 0, raf = 0, done = false;
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / (fast() ? 1 : ms));
    el.style.setProperty('--p', p);
    if (p >= 1) { done = true; el.classList.remove('is-holding'); onDone(); return; }
    raf = requestAnimationFrame(tick);
  };
  const down = (e) => {
    if (el.disabled || done || (when && !when())) return;   // when()：這一步才有作用（同一顆按鈕在別的步驟另有用途）
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    t0 = performance.now(); el.classList.add('is-holding'); onStart?.();
    raf = requestAnimationFrame(tick);
  };
  const up = () => {
    if (done || !t0) return;
    cancelAnimationFrame(raf); t0 = 0;
    el.classList.remove('is-holding'); el.style.setProperty('--p', 0); onCancel?.();
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
  // 鍵盤：Enter / 空白鍵按住也算
  el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) down(e); });
  el.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') up(); });
  return { reset() { done = false; el.style.setProperty('--p', 0); } };
}

/* ── 拖曳拋擲：按住物件往上甩，速度夠就算「丟出去」──────────
   onMove(dx, dy) 跟著手指走；放手時呼叫 onRelease({vy, dy})。 */
export function drag(el, { onMove, onRelease, onStart }) {
  let sx = 0, sy = 0, last = [], active = false;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    active = true; sx = e.clientX; sy = e.clientY; last = [{ y: e.clientY, x: e.clientX, t: performance.now() }];
    onStart?.();
  });
  el.addEventListener('pointermove', (e) => {
    if (!active) return;
    last.push({ y: e.clientY, x: e.clientX, t: performance.now() });
    if (last.length > 6) last.shift();
    onMove?.(e.clientX - sx, e.clientY - sy);
  });
  const end = (e) => {
    if (!active) return;
    active = false;
    const a = last[0], b = last[last.length - 1];
    const dt = Math.max(1, b.t - a.t);
    onRelease?.({ vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt, dx: e.clientX - sx, dy: e.clientY - sy });
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/* ── 搖手機 ─────────────────────────────────────────────── */
const SENSE = { soft: 9, mid: 13, hard: 19 };     // 加速度變化量的門檻（m/s²）

export function listenShake(onShake, level = store.settings.omikujiShake || 'mid') {
  const th = SENSE[level];
  if (!th || typeof DeviceMotionEvent === 'undefined') return () => {};
  let prev = null, last = 0;
  const h = (e) => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || a.x == null) return;
    const v = [a.x, a.y, a.z || 0];
    if (prev) {
      const d = Math.hypot(v[0] - prev[0], v[1] - prev[1], v[2] - prev[2]);
      const now = Date.now();
      if (d > th && now - last > 300) { last = now; onShake(); }
    }
    prev = v;
  };
  addEventListener('devicemotion', h);
  return () => removeEventListener('devicemotion', h);
}

/** iOS 13+ 的動作感測器權限：一定要在點擊事件裡「同步」呼叫 */
export function askMotion() {
  const D = typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : null;
  if (!D || typeof D.requestPermission !== 'function') return Promise.resolve(!!D);
  return D.requestPermission().then(r => r === 'granted').catch(() => false);
}

/** 換頁時自動收掉的監聽 */
export function onLeave(fn) {
  const h = () => { fn(); removeEventListener('hashchange', h); };
  addEventListener('hashchange', h);
}
