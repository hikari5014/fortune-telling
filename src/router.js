/* 極簡 hash 路由，搭配 View Transitions 過場 */
const routes = new Map();
let current = null;
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
  const view = await loader();
  current = p;
  await onRender(view, p);
}

export function start() {
  addEventListener('hashchange', () => resolve());
  resolve();
}
export const currentPath = () => current;
