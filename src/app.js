/* 應用程式入口：導覽、路由、過場、全域互動 */
import { store, applyChrome, onStore } from './store.js';
import { icon } from './icons.js';
import { html, raw, $, $$, toast, haptic } from './ui.js';
import { observeReveal, initFeedback, initSwipe, runCountUps, initSeg } from './motion.js';
import { register, navigate, resolve, start, path, query } from './router.js';
import { computeAll } from './prompt/context.js';
import { APP_VERSION } from './data/changelog.js';

export const NAV = [
  { p: '/',          t: '首頁', icon: 'home',     eyebrow: 'XUAN JIAN',      tab: 1 },
  { p: '/astro',     t: '星盤', icon: 'astro',    eyebrow: 'NATAL CHART',    tab: 1 },
  { p: '/ziwei',     t: '紫微', icon: 'ziwei',    eyebrow: 'ZI WEI DOU SHU', tab: 1 },
  { p: '/bazi',      t: '八字', icon: 'pillars',  eyebrow: 'FOUR PILLARS' },
  { p: '/fortune',   t: '運勢', icon: 'clock',    eyebrow: 'LUCK CYCLES',    tab: 1 },
  { p: '/daily',     t: '擇日', icon: 'calendar', eyebrow: 'DAY PICKER' },
  { p: '/direction', t: '方位', icon: 'compass',  eyebrow: 'EIGHT MANSIONS' },
  { p: '/synastry',  t: '合盤', icon: 'link',     eyebrow: 'SYNASTRY' },
  { p: '/iching',    t: '卜卦', icon: 'dice',     eyebrow: 'I CHING' },
  { p: '/tarot',     t: '塔羅', icon: 'star',     eyebrow: 'TAROT' },
  { p: '/qian',      t: '求籤', icon: 'folder',   eyebrow: 'ORACLE POEM' },
  { p: '/naming',    t: '姓名', icon: 'naming',   eyebrow: 'NAME STUDY' },
  { p: '/numbers',   t: '數字', icon: 'numbers',  eyebrow: 'NUMEROLOGY' },
  { p: '/prompt',    t: '提示', icon: 'prompt',   eyebrow: 'PROMPT STUDIO',  tab: 1 },
  { p: '/records',   t: '紀錄', icon: 'records',  eyebrow: 'READINGS' },
  { p: '/profile',   t: '檔案', icon: 'profile',  eyebrow: 'PROFILES' },
  { p: '/settings',  t: '設定', icon: 'settings', eyebrow: 'SETTINGS' },
  { p: '/about',     t: '關於', icon: 'info',     eyebrow: 'ABOUT' },
];

const VIEWS = {
  '/':         () => import('./views/home.js'),
  '/astro':    () => import('./views/astro.js'),
  '/ziwei':    () => import('./views/ziwei.js'),
  '/bazi':     () => import('./views/bazi.js'),
  '/fortune':  () => import('./views/fortune.js'),
  '/daily':    () => import('./views/daily.js'),
  '/direction':() => import('./views/direction.js'),
  '/synastry': () => import('./views/synastry.js'),
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

/* ── 導覽列：手機顯示主要分頁 + 更多，桌機側欄顯示全部 ── */
const link = (n) => html`
  <a class="tab" href="#${n.p}" data-path="${n.p}" aria-label="${n.t}">
    ${raw(icon(n.icon))}<span>${n.t}</span>
  </a>`;

function buildNav() {
  $('#tabbar').innerHTML = `<span class="tabbar__ind" aria-hidden="true"></span>`
    + NAV.filter(n => n.tab).map(link).join('')
    + `<button class="tab" id="tab-more" aria-label="更多功能">${icon('folder')}<span>更多</span></button>`;
  $('#rail').innerHTML = `<div class="rail__logo">${icon('astro')}</div>` + NAV.map(link).join('');
  $('#tab-more').addEventListener('click', openMore);
}

function openMore() {
  haptic(8);
  import('./ui.js').then(({ sheet }) => sheet({
    title: '全部功能',
    body: `<div class="grid grid--3 stagger" style="--stagger-base:90ms">` + NAV.map(n => `
      <a class="tile press track" href="#${n.p}" data-close>
        ${icon(n.icon)}<h3>${n.t}</h3><p>${n.eyebrow}</p>
      </a>`).join('') + `</div>`,
  }));
}

function syncNav(p) {
  const isPrimary = NAV.some(n => n.p === p && n.tab);
  $$('#rail .tab').forEach(a => a.setAttribute('aria-current', a.dataset.path === p ? 'page' : 'false'));
  $$('#tabbar .tab').forEach(a => {
    const on = a.id === 'tab-more' ? !isPrimary : a.dataset.path === p;
    a.setAttribute('aria-current', on ? 'page' : 'false');
    if (on) {
      const ind = $('.tabbar__ind');
      ind.style.width = `${a.offsetWidth}px`;
      ind.style.transform = `translateX(${a.offsetLeft - 5}px)`;
      ind.style.opacity = '1';
      a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  });
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
let lastPath = '/';
async function paint(view, p) {
  const c = ctx();
  const nav = NAV.find(n => n.p === p) || NAV[0];
  const doRender = (animateFallback) => {
    const root = $('#view');
    root.innerHTML = view.render(c);
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
    const i = NAV.findIndex(n => n.p === path());
    const next = NAV[Math.min(NAV.length - 1, Math.max(0, i + dir))];
    if (next && next.p !== path()) { haptic(6); navigate(next.p); }
  });

  onStore((kind) => {
    if (kind === 'settings' || kind === 'profiles' || kind === 'all') { invalidate(); syncThemeBtn(); }
  });

  addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const i = NAV.findIndex(n => n.p === path());
    if (e.key === 'ArrowRight' && i < NAV.length - 1) navigate(NAV[i + 1].p);
    if (e.key === 'ArrowLeft' && i > 0) navigate(NAV[i - 1].p);
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
