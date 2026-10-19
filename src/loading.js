/* 等待畫面
   ──────────────────────────────────────────────────────────
   規則很簡單：點下去之後，如果 0.5 秒內就好了，什麼都不顯示（不會閃一下）；
   超過 0.5 秒還沒好，就蓋上一層「玄鑑」的星軌在轉，下面寫正在做什麼，必要時有進度條。
   一出現就至少停 0.35 秒再淡出，免得一閃而過看不清楚。

   用法：
     const done = begin('載入中⋯⋯');  …  done();
     await withLoading(() => 做事(), '產生圖片中⋯⋯');
     begin('點亮星空⋯⋯', { delay: 0 })   // 已知會很久的事：馬上顯示
     progress(0.4, '雕刻神獸⋯⋯')          // 更新文字與進度
   畫面要先「畫出來」才看得到等待畫面 —— 接下來要做的若是一大段會卡住畫面的計算，
   先 await nextFrame() 讓瀏覽器有機會把它畫上去。 */

const DELAY = 500, MIN_SHOW = 350;
let el = null, tasks = [], timer = 0, shownAt = 0, hideTimer = 0;

const MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle class="ld__orbit" cx="12" cy="12" r="10.1" stroke-dasharray="1.1 2.3"/>
  <circle class="ld__ring" cx="12" cy="12" r="6.1" stroke-dasharray="9 29"/>
  <path class="ld__star" d="M12 7.2Q12 12 16.8 12Q12 12 12 16.8Q12 12 7.2 12Q12 12 12 7.2Z"/>
  <circle cx="12" cy="12" r=".95" fill="currentColor" stroke="none"/></svg>`;

function ensure() {
  if (el || typeof document === 'undefined') return el;
  el = document.createElement('div');
  el.className = 'ld'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<div class="ld__box"><div class="ld__mark">${MARK}</div><p class="ld__text"></p><div class="ld__bar" hidden><i></i></div></div>`;
  document.body.appendChild(el);
  return el;
}

function paint() {
  const top = tasks[tasks.length - 1];
  if (!top || !el) return;
  el.querySelector('.ld__text').textContent = top.text;
  const bar = el.querySelector('.ld__bar');
  bar.hidden = top.p == null;
  if (top.p != null) bar.firstElementChild.style.width = `${Math.round(Math.max(0.04, Math.min(1, top.p)) * 100)}%`;
}

function show() {
  if (!ensure()) return;
  clearTimeout(hideTimer);
  paint();
  if (!el.classList.contains('is-on')) { shownAt = performance.now(); el.classList.add('is-on'); }
}

function hide() {
  if (!el || !el.classList.contains('is-on')) return;
  const wait = Math.max(0, MIN_SHOW - (performance.now() - shownAt));
  hideTimer = setTimeout(() => { if (!tasks.length) el.classList.remove('is-on'); }, wait);
}

/** 開始一件可能要等的事；回傳「做完了」的函式（呼叫幾次都沒關係） */
export function begin(text = '讀取中⋯⋯', { delay = DELAY, progress = null } = {}) {
  const t = { text, p: progress, done: false };
  tasks.push(t);
  if (delay <= 0) show();
  else if (!timer) timer = setTimeout(() => { timer = 0; if (tasks.length) show(); }, delay);
  else paint();
  return () => {
    if (t.done) return;
    t.done = true;
    tasks = tasks.filter(x => x !== t);
    if (!tasks.length) { clearTimeout(timer); timer = 0; hide(); } else paint();
  };
}

/** 更新最上面那件事的進度（0～1）與文字 */
export function progress(p, text) {
  const top = tasks[tasks.length - 1];
  if (!top) return;
  top.p = p; if (text) top.text = text;
  if (el?.classList.contains('is-on')) paint();
}

/** 包一件 async 的事 */
export async function withLoading(fn, text, opts) {
  const done = begin(text, opts);
  try { return await (typeof fn === 'function' ? fn() : fn); } finally { done(); }
}

/** 讓瀏覽器先把畫面畫出來（等待畫面才看得到），再繼續做會卡住的事 */
export const nextFrame = () => new Promise(r => {
  if (typeof requestAnimationFrame !== 'function') { setTimeout(r, 0); return; }
  requestAnimationFrame(() => setTimeout(r, 0));
});

export const isShowing = () => !!el?.classList.contains('is-on');
