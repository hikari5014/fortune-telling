/* 玄鑑 Service Worker：應用程式外殼快取 + 執行期快取 */
const VERSION = 'xj-0.10.0';   // 與 src/data/changelog.js 的 APP_VERSION 同步
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './styles/tokens.css', './styles/base.css', './styles/motion.css',
  './styles/components.css', './styles/views.css',
  './src/app.js', './src/router.js', './src/store.js', './src/ui.js', './src/palette.js', './src/share.js', './src/sharecards.js', './src/motion.js', './src/icons.js',
  './src/engines/calendar.js', './src/engines/planets.js', './src/engines/bazi.js', './src/engines/astro.js', './src/engines/ziwei.js',
  './src/engines/naming.js', './src/engines/numbers.js', './src/engines/fortune.js', './src/engines/synastry.js', './src/engines/iching.js', './src/engines/tarot.js', './src/engines/qian.js', './src/engines/daily.js', './src/engines/bagua.js',
  './src/data/strokes.js', './src/data/kangxi.js', './src/data/lucky81.js', './src/data/magnetic.js', './src/data/changelog.js', './src/data/wenyan.js', './src/data/hexagrams.js', './src/data/tarot.js', './src/data/qian.js',
  './src/prompt/context.js', './src/prompt/templates.js', './src/prompt/builder.js',
  './src/views/_shared.js', './src/views/home.js', './src/views/profile.js', './src/views/astro.js',
  './src/views/ziwei.js', './src/views/bazi.js', './src/views/naming.js', './src/views/numbers.js', './src/views/prompt.js',
  './src/views/records.js', './src/views/settings.js', './src/views/about.js', './src/views/fortune.js', './src/views/synastry.js', './src/views/iching.js', './src/views/tarot.js', './src/views/qian.js', './src/views/daily.js', './src/views/direction.js',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
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
