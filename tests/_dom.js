/* 最小 DOM 墊片：只為了讓「每個模組都能載入」這件事在 Node 裡跑得起來。
   不模擬版面或事件行為 —— 那是瀏覽器煙霧測試的工作，這裡只要攔住
   「模組載入就炸掉」這一類問題（重複匯出、import 路徑錯、頂層存取 DOM）。 */
const noop = () => {};
const el = () => ({
  dataset: {}, style: { setProperty: noop }, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
  appendChild: noop, remove: noop, querySelector: () => el(), querySelectorAll: () => [],
  insertAdjacentHTML: noop, focus: noop, click: noop, animate: noop,
  innerHTML: '', textContent: '', value: '', hidden: false, isConnected: false,
});

export function installDOM() {
  if (globalThis.document) return;
  const store = new Map();
  // querySelector 一律回傳存根而不是 null：這裡的目的是攔住「載入就炸掉」，
  // 不是驗 DOM 邏輯（那是瀏覽器煙霧測試的事），回 null 只會製造假失敗
  globalThis.document = {
    documentElement: el(), body: el(), head: el(),
    createElement: el, createTextNode: el,
    querySelector: el, querySelectorAll: () => [], getElementById: el, getElementsByTagName: () => [],
    addEventListener: noop, removeEventListener: noop,
    fonts: { ready: Promise.resolve() },
  };
  globalThis.window = globalThis;
  globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
  globalThis.addEventListener = noop;
  globalThis.removeEventListener = noop;
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.scrollTo = noop;
  globalThis.scrollBy = noop;
  globalThis.scrollY = 0;
  globalThis.devicePixelRatio = 1;
  globalThis.innerWidth = 390;
  globalThis.innerHeight = 664;
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.cancelAnimationFrame = noop;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.location = { hash: '#/', href: 'http://localhost/' };
  globalThis.history = { replaceState: noop, pushState: noop, back: noop };
  // Node 22 的 navigator 只有 getter，補上缺的屬性而不是整個換掉
  if (!globalThis.navigator) globalThis.navigator = { vibrate: noop };
  else if (!globalThis.navigator.vibrate) {
    try { Object.defineProperty(globalThis.navigator, 'vibrate', { value: noop, configurable: true }); } catch { /* 唯讀就算了 */ }
  }
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!globalThis.performance) globalThis.performance = { now: () => Date.now() };
}
