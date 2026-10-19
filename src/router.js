/* 極簡 hash 路由，搭配 View Transitions 過場
   換頁要等超過 0.5 秒就蓋上等待畫面（src/loading.js）。
   上次打開就很慢的頁（例如第一次載入、要算很久的命盤），這次一開始就先蓋上、讓它畫出來再開始算 ——
   不然畫面整個卡住，等待畫面也出不來。 */
import { begin, nextFrame } from './loading.js';

const routes = new Map();
const SLOW_KEY = 'xj.slowpages';
const slowPages = (() => { try { return new Set(JSON.parse(localStorage.getItem(SLOW_KEY) || '[]')); } catch { return new Set(); } })();
function markSlow(p, slow) {
  if (slow === slowPages.has(p)) return;
  slow ? slowPages.add(p) : slowPages.delete(p);
  try { localStorage.setItem(SLOW_KEY, JSON.stringify([...slowPages])); } catch { /* 無痕模式 */ }
}
let current = null;
let seq = 0;                                       // 換頁序號：慢的舊頁載完時，若已經換到別頁就不要畫
let onRender = () => {};

export function register(path, loader) { routes.set(path, loader); }
export function setHook(fn) { onRender = fn; }

export const path = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];
export const query = () => Object.fromEntries(new URLSearchParams((location.hash.split('?')[1] || '')));

export function navigate(to, { back = false } = {}) {
  document.documentElement.dataset.nav = back ? 'back' : 'forward';
  if (path() === to.split('?')[0] && location.hash.slice(1) === to) { return resolve(); }
  location.hash = to;
}

export async function resolve() {
  const p = path();
  const loader = routes.get(p) || routes.get('/');
  const slow = slowPages.has(p);
  const done = begin('載入中⋯⋯', { delay: slow ? 0 : 500 });
  const t0 = performance.now(), my = ++seq;
  try {
    if (slow) await nextFrame();
    const view = await loader();
    if (my !== seq) return;
    current = p;
    await onRender(view, p);
  } finally {
    done();
    markSlow(p, performance.now() - t0 > 450);
  }
}

export function start() {
  addEventListener('hashchange', () => resolve());
  resolve();
}
export const currentPath = () => current;
