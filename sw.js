/* 玄鑑 Service Worker：應用程式外殼快取 + 執行期快取 */
const VERSION = 'xj-0.27.0';   // 與 src/data/changelog.js 的 APP_VERSION 同步
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './styles/tokens.css', './styles/base.css', './styles/motion.css',
  './styles/components.css', './styles/views.css',
  './src/app.js', './src/router.js', './src/store.js', './src/ui.js', './src/palette.js', './src/platform.js', './src/install.js', './src/onboarding.js', './src/qrcode.js', './src/starfield.js', './src/tarotdraw.js', './src/orbcast.js', './src/decks.js', './src/relics.js', './src/llm.js', './src/sharelink.js', './src/privacy.js', './src/navmenu.js', './src/quickadd.js', './src/share.js', './src/sharecards.js', './src/motion.js', './src/icons.js',
  './src/engines/calendar.js', './src/engines/planets.js', './src/engines/bazi.js', './src/engines/unknown.js', './src/engines/astro.js', './src/engines/ziwei.js',
  './src/engines/naming.js', './src/engines/numbers.js', './src/engines/fortune.js', './src/engines/synastry.js', './src/engines/iching.js', './src/engines/tarot.js', './src/engines/qian.js', './src/engines/daily.js', './src/engines/bagua.js',
  './src/data/strokes.js', './src/data/kangxi.js', './src/data/lucky81.js', './src/data/magnetic.js', './src/data/changelog.js', './src/data/wenyan.js', './src/data/hexagrams.js', './src/data/tarot.js', './src/data/qian.js', './src/data/cities.js', './src/data/nav.js',
  './src/prompt/context.js', './src/prompt/templates.js', './src/prompt/builder.js', './src/prompt/quick.js',
  './src/views/_shared.js', './src/views/home.js', './src/views/profile.js', './src/views/astro.js',
  './src/views/ziwei.js', './src/views/bazi.js', './src/views/naming.js', './src/views/numbers.js', './src/views/prompt.js',
  './src/views/records.js', './src/views/settings.js', './src/views/about.js', './src/views/fortune.js', './src/views/synastry.js', './src/views/hire.js', './src/views/iching.js', './src/views/tarot.js', './src/views/qian.js', './src/views/daily.js', './src/views/direction.js', './src/views/paste.js',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
// 換版時清掉舊快取，但 KEEP 裡的不動 —— 那些東西的內容不隨版本改變，
// 重抓只是浪費使用者的流量（塔羅牌圖有 2.3 MB）。
const KEEP = (k) => k === VERSION || k === 'xj-tarot' || k === 'xj-art';
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !KEEP(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts：快取優先，背景更新
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.open(VERSION + '-fonts').then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // 塔羅牌圖：78 張約 2.3 MB，不進安裝時的外殼（不然第一次開就要等）。
  // 放在跟版號無關的快取，改版時不用重抓 —— 圖片內容不會跟著版本變。
  if (url.pathname.includes('/assets/tarot/')) {
    e.respondWith(caches.open('xj-tarot').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      return fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
    }));
    return;
  }

  // 起卦那一段的插圖：跟塔羅牌圖一樣，內容不隨版本改變，
  // 放在跟版號無關的快取，改版時不用重抓。不進安裝外殼 ——
  // 圖還沒放進去的時候，addAll 遇到 404 會讓整個 Service Worker 裝不起來。
  if (url.pathname.includes('/assets/ceremony/')) {
    e.respondWith(caches.open('xj-art').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      return fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
    }));
    return;
  }

  // 導覽請求：網路優先，離線回退到外殼
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    const copy = r.clone();
    caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
    return r;
  }).catch(() => hit)));
});
