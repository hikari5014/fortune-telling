/* 應用程式入口：導覽、路由、過場、全域互動 */
import { store, applyChrome, onStore } from './store.js';
import { icon } from './icons.js';
import { html, raw, $, $$, toast, haptic } from './ui.js';
import { observeReveal, initFeedback, initSwipe, runCountUps, initSeg } from './motion.js';
import { register, navigate, resolve, start, path, query } from './router.js';
import { computeAll } from './prompt/context.js';
import { APP_VERSION } from './data/changelog.js';
import { isPrivate, CHART_WARNING } from './privacy.js';
import { NAV, CATS, HOME, FLOW, catOf } from './data/nav.js';
import { openCat, closeMenu, isOpen as menuOpen } from './navmenu.js';

export { NAV } from './data/nav.js';

const VIEWS = {
  '/':         () => import('./views/home.js'),
  '/astro':    () => import('./views/astro.js'),
  '/ziwei':    () => import('./views/ziwei.js'),
  '/bazi':     () => import('./views/bazi.js'),
  '/fortune':  () => import('./views/fortune.js'),
  '/daily':    () => import('./views/daily.js'),
  '/direction':() => import('./views/direction.js'),
  '/synastry': () => import('./views/synastry.js'),
  '/hire':     () => import('./views/hire.js'),
  '/iching':   () => import('./views/iching.js'),
  '/tarot':    () => import('./views/tarot.js'),
  '/qian':     () => import('./views/qian.js'),
  '/naming':   () => import('./views/naming.js'),
  '/numbers':  () => import('./views/numbers.js'),
  '/prompt':   () => import('./views/prompt.js'),
  '/records':  () => import('./views/records.js'),
  '/profile':  () => import('./views/profile.js'),
  '/settings': () => import('./views/settings.js'),
  '/about':    () => import('./views/about.js'),
};
for (const [p, loader] of Object.entries(VIEWS)) register(p, async () => (await loader()).default);

/** 目前對象的全部推算結果（快取） */
let cache = { key: null, value: null };
export function ctx() {
  const settings = store.settings;
  const profile = store.current;
  const key = JSON.stringify([profile, settings.tzOffset, settings.lat, settings.lon,
    settings.trueSolarTime, settings.lateZiRule, settings.wageWaiRule, settings.register]);
  if (cache.key !== key) cache = { key, value: profile ? computeAll(profile, settings) : null };
  return { settings, profile, all: cache.value, navigate, query: query() };
}
export const invalidate = () => { cache = { key: null, value: null }; };

/* ── 導覽列 ─────────────────────────────────────────
   手機：四個分類排成扇形，正中央下面一顆圓形的首頁鍵。
        點一下分類就叫出停住的選單（見 navmenu.js）。
   桌機：側欄照樣把全部頁面列出來 —— 那裡空間夠、滑鼠也快，
        分兩層反而變慢；但順序照分類排，跟手機是同一套結構。 */
const link = (n) => html`
  <a class="tab" href="#${n.p}" data-path="${n.p}" aria-label="${n.t}">
    ${raw(icon(n.icon))}<span>${n.t}</span>
  </a>`;

function buildNav() {
  const dock = $('#tabbar');
  dock.className = 'dock';
  // 一般的橫條：分類平均分配，首頁擺正中間（五格的中點）
  const cells = [...CATS];
  cells.splice(Math.ceil(CATS.length / 2), 0, null);   // null 代表首頁
  dock.innerHTML = cells.map(c => c
    ? `<button class="tab dock__cat" data-cat="${c.key}" aria-haspopup="menu" aria-expanded="false">
         ${icon(c.icon)}<span>${c.name}</span></button>`
    : `<a class="tab dock__home" href="#/" data-path="/">${icon('home')}<span>首頁</span></a>`
  ).join('');

  dock.querySelectorAll('.dock__cat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = CATS.find(c => c.key === btn.dataset.cat);
      if (menuOpen() && btn.getAttribute('aria-expanded') === 'true') { closeMenu(); return; }
      haptic(8);
      const r = btn.getBoundingClientRect();
      btn.setAttribute('aria-expanded', 'true');
      openCat(cat, { x: r.left + r.width / 2, y: r.top }, {
        current: path(),
        onPick: (n) => navigate(n.p),
        onClose: () => btn.setAttribute('aria-expanded', 'false'),
      });
    });
  });

  // 桌機側欄：首頁在最上面，其餘照分類分段
  $('#rail').innerHTML = `<div class="rail__logo">${icon('astro')}</div>`
    + link(HOME)
    + CATS.map(c => `<span class="rail__sep" aria-hidden="true"></span>`
        + c.paths.map(p => link(NAV.find(n => n.p === p))).join('')).join('');
}

function syncNav(p) {
  $$('#rail .tab').forEach(a => a.setAttribute('aria-current', a.dataset.path === p ? 'page' : 'false'));
  const cat = catOf(p);
  $$('#tabbar .dock__cat').forEach(b =>
    b.setAttribute('aria-current', cat && b.dataset.cat === cat.key ? 'page' : 'false'));
  $('#tabbar .dock__home')?.setAttribute('aria-current', p === '/' ? 'page' : 'false');
}

/* ── 主題切換 ───────────────────────────── */
function syncThemeBtn() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#btn-theme').innerHTML = icon(dark ? 'sun' : 'moon');
  const label = dark ? '切換為淺色' : '切換為深色';
  $('#btn-theme').setAttribute('aria-label', label);
  $('#btn-theme').dataset.tip = label;
}

/* ── 繪製 ──────────────────────────────── */

/* 保密檔案在命盤頁上的提醒：擋不住的事要先講，不要讓人誤以為擋得住 */
const CHART_PAGES = new Set(['/astro', '/ziwei', '/bazi', '/fortune', '/direction',
  '/synastry', '/numbers', '/naming', '/prompt']);
const privacyNote = (c, p) => (CHART_PAGES.has(p) && isPrivate(c.profile)
  ? `<div class="warn" style="margin-bottom:var(--sp-4)">
       <div class="warn__head">${icon('info')} 保密檔案</div>
       <p class="warn__p">${CHART_WARNING}</p>
     </div>`
  : '');

let lastPath = '/';
async function paint(view, p) {
  const c = ctx();
  const nav = NAV.find(n => n.p === p) || NAV[0];
  const doRender = (animateFallback) => {
    const root = $('#view');
    root.innerHTML = privacyNote(c, p) + view.render(c);
    $('#top-title').textContent = typeof view.title === 'function' ? view.title(c) : (view.title || nav.t);
    $('#top-eyebrow').textContent = view.eyebrow || nav.eyebrow;
    $('#btn-back').hidden = p === '/';
    view.mount?.(root, c);
    observeReveal(root);
    runCountUps(root);
    initSeg(root);
    // 只有在沒有 View Transition 時才跑退場動畫，否則兩段動畫疊加會抖
    root.classList.remove('is-entering');
    if (animateFallback) { void root.offsetWidth; root.classList.add('is-entering'); }
  };
  const back = NAV.findIndex(n => n.p === p) < NAV.findIndex(n => n.p === lastPath);
  document.documentElement.dataset.nav = back ? 'back' : 'forward';
  lastPath = p;

  // 先歸零捲動再拍快照，避免過場中途又跳一次
  scrollTo({ top: 0, behavior: 'instant' });

  const useVT = typeof document.startViewTransition === 'function'
    && document.documentElement.dataset.motion !== 'off';
  if (useVT) document.startViewTransition(() => doRender(false));
  else doRender(true);
  syncNav(p);
}

/* ── 啟動 ──────────────────────────────── */
/** 以 visualViewport 追蹤虛擬鍵盤高度，寫進 --kb 供抽屜使用 */
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const sync = () => {
    const kb = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--kb', `${kb}px`);
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  sync();
}

/** 比對上次看過的版號，決定是否顯示「有新版本」提示 */
function checkVersionSeen() {
  const seen = store.settings.seenVersion;
  if (seen === APP_VERSION) return;
  if (!seen) { store.setSettings({ seenVersion: APP_VERSION }); return; }   // 初次使用不提示
  document.documentElement.dataset.updated = '1';
  setTimeout(() => toast(`已更新到 v${APP_VERSION}，點「關於」看更新內容`, 4200), 1400);
}

function boot() {
  applyChrome();
  trackKeyboard();
  checkVersionSeen();
  import('./onboarding.js').then(m => m.maybeStartTour());
  buildNav();
  syncThemeBtn();
  initFeedback();

  $('#btn-back').innerHTML = icon('back');
  $('#btn-back').dataset.tip = '返回';
  $('#btn-theme').dataset.tipPos = 'right';
  $('#btn-theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    store.setSettings({ theme: dark ? 'light' : 'dark' });
    syncThemeBtn();
    haptic(10);
  });
  $('#btn-back').addEventListener('click', () => history.back());

  // 快速搜尋：吸頂列的放大鏡，或桌機的 ⌘K／Ctrl+K
  const palette = () => import('./palette.js').then(m => m.openPalette(NAV));
  $('#btn-search').innerHTML = icon('search');
  $('#btn-search').dataset.tip = '快速搜尋';
  $('#btn-search').addEventListener('click', () => { haptic(8); palette(); });
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
  });

  addEventListener('scroll', () => {
    $('#topbar').classList.toggle('is-stuck', scrollY > 8);
  }, { passive: true });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (store.settings.theme === 'system') { applyChrome(); syncThemeBtn(); }
  });

  initSwipe((dir) => {
    const i = FLOW.indexOf(path());
    const next = FLOW[Math.min(FLOW.length - 1, Math.max(0, i + dir))];
    if (next && next !== path()) { haptic(6); navigate(next); }
  });

  onStore((kind) => {
    if (kind === 'settings' || kind === 'profiles' || kind === 'all') { invalidate(); syncThemeBtn(); }
  });

  addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const i = FLOW.indexOf(path());
    if (e.key === 'ArrowRight' && i >= 0 && i < FLOW.length - 1) navigate(FLOW[i + 1]);
    if (e.key === 'ArrowLeft' && i > 0) navigate(FLOW[i - 1]);
  });

  import('./router.js').then(r => { r.setHook(paint); r.start(); });

  setTimeout(() => $('#boot').classList.add('is-done'), 520);
  addEventListener('resize', () => syncNav(path()));

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;   // 首次安裝不重載
      reloading = true;
      location.reload();
    });
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js')
      .then(reg => { window.__swReg = reg; })
      .catch(() => {}));
  }
  let deferred = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; window.__installPrompt = e; });
}
boot();
export { toast };
