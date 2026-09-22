/* 分類選單
   ──────────────────────────────────────────────────────────
   點一下分類，底下的功能排成一列停在畫面上；再點一下要的那一項。
   停住之後也可以「按著滑過去再放開」—— 滑鼠靠 hover，觸控自己追手指。

   刻意不做長按：長按每次都要先等三百毫秒，天天用的東西不該每次都等；
   而且長按加拖曳對手指不方便的人很不友善。

   幾何只有一條規矩不能破：**看得到哪一項，放開就要選到那一項**。
   所以命中判斷是拿「畫出來的位置」去比，不是拿理論座標。 */

import { $, $$, haptic } from './ui.js';
import { icon } from './icons.js';
import { itemsOf } from './data/nav.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ROW = 46, GAP = 4, W = 216, PAD = 14;

/**
 * 算出清單要擺在哪裡。分類在畫面下方，所以預設往上長；
 * 上面擺不下才翻到下面。
 */
export function place(anchor, n, vw = innerWidth, vh = innerHeight) {
  const total = n * ROW + (n - 1) * GAP;
  const cx = clamp(anchor.x, W / 2 + 10, vw - W / 2 - 10);
  let top = anchor.y - 58 - total;
  if (top < PAD) top = anchor.y + 58;
  top = clamp(top, PAD, Math.max(PAD, vh - total - PAD));
  return {
    cx, top, total,
    pts: Array.from({ length: n }, (_, i) => ({ x: cx, y: top + i * (ROW + GAP) + ROW / 2 })),
    hit(px, py) {
      if (Math.abs(px - cx) > W / 2 + 46) return -1;
      if (py < top - 26 || py > top + total + 26) return -1;
      return clamp(Math.floor((py - top) / (ROW + GAP)), 0, n - 1);
    },
  };
}

let openEl = null, onClose = null;

export const isOpen = () => !!openEl;

export function closeMenu() {
  if (!openEl) return;
  const el = openEl;
  openEl = null;
  el.classList.remove('is-in');
  setTimeout(() => el.remove(), 260);
  removeEventListener('keydown', onKey);
  onClose?.();
  onClose = null;
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
}

/**
 * 叫出某一類的選單。
 * @param {object} cat  分類
 * @param {object} anchor {x, y} 按下的位置
 * @param {object} o {current 目前所在的路徑, onPick(item), onClose()}
 */
export function openCat(cat, anchor, { current = '', onPick, onClose: closed } = {}) {
  closeMenu();
  const items = itemsOf(cat);
  const plan = place(anchor, items.length);

  const root = document.createElement('div');
  root.className = 'navmenu';
  root.setAttribute('role', 'menu');
  root.setAttribute('aria-label', cat.name);
  root.innerHTML = `<div class="navmenu__scrim"></div>
    <div class="navmenu__list" style="left:${plan.cx}px;top:${plan.top}px;width:${W}px">
      ${items.map((n, i) => `
        <a class="navmenu__i" role="menuitem" href="#${n.p}" data-i="${i}" draggable="false"
           aria-current="${n.p === current ? 'page' : 'false'}" style="--i:${i}">
          ${icon(n.icon)}<span>${n.t}</span><em>${n.eyebrow}</em>
        </a>`).join('')}
    </div>`;
  document.body.append(root);
  openEl = root;
  onClose = closed;

  const els = $$('.navmenu__i', root);
  let hot = -1;
  const setHot = (i) => {
    if (hot === i) return;
    hot = i;
    els.forEach((el, k) => el.classList.toggle('is-hot', k === i));
    if (i >= 0) haptic(5);
  };
  const choose = (i) => {
    const n = items[i];
    if (!n) return;
    haptic(12);
    closeMenu();
    onPick?.(n);
  };

  els.forEach((el, i) => {
    el.addEventListener('pointerenter', () => setHot(i));       // 滑鼠
    el.addEventListener('click', (e) => { e.preventDefault(); choose(i); });
  });

  /* 觸控沒有 hover，自己追手指：按著滑過去，放開就選中。
     單純點一下交給上面每一項的 click，不然會被算兩次。 */
  let from = null, moved = false;
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.navmenu__scrim')) return;
    // 項目是 <a>，不擋的話瀏覽器會把「按著拖」當成拖曳連結，
    // 送出 pointercancel，滑到一半就斷了
    e.preventDefault();
    from = { x: e.clientX, y: e.clientY };
    moved = false;
    setHot(plan.hit(e.clientX, e.clientY));
  });
  root.addEventListener('pointermove', (e) => {
    if (!from) return;
    if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10) moved = true;
    setHot(plan.hit(e.clientX, e.clientY));
  });
  root.addEventListener('pointerup', (e) => {
    if (!from) return;
    from = null;
    if (!moved) return;
    const i = plan.hit(e.clientX, e.clientY);
    if (i >= 0) choose(i); else closeMenu();
  });
  root.addEventListener('pointercancel', () => { from = null; });
  $('.navmenu__scrim', root).addEventListener('click', closeMenu);
  addEventListener('keydown', onKey);
  addEventListener('hashchange', closeMenu, { once: true });   // 換頁就收起來

  requestAnimationFrame(() => root.classList.add('is-in'));
  return root;
}
