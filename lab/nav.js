/* 導覽方案試玩
   ──────────────────────────────────────────────────────────
   這是原型，不是產品程式碼：目的是讓人「用手感」決定方向，
   所以四種互動共用同一套手勢控制與同一份資料，差別只在版面怎麼擺、
   以及「手指現在指到哪一項」怎麼算。

   共用的手勢合約（觸控與滑鼠完全一致，用 Pointer Events）：
     按下 → 撐過長按時間 → 選單彈出（錨在按下的位置）
     不放手繼續滑 → 依方向／位置即時高亮
     放開 → 選中；放開在中心死區或選單外 → 取消
     輕點一下（還沒撐到長按就放開）→ 選單留在畫面上，改成用點的

   最後那條很重要：長按＋拖曳對手指不方便的人很不友善，
   一定要留一條「用點的」的路，不然這個設計沒辦法上線。 */

import { icon } from '../src/icons.js';

/* ── 分類 ─────────────────────────────────────────── */
/* 五個分類排成扇形，正中間下面放首頁。
   工具放最左邊 —— 那是最少用、也最不想誤觸的一類。
   「關係」是人際與名數合併來的：合盤、面談是你跟人的關係，
   姓名、數字是你跟自己名號的關係。這個歸類有點勉強，名字待定。 */
const CATS = [
  { key: 'tool', name: '工具', icon: 'settings', items: [
    { t: '提示', icon: 'prompt' }, { t: '紀錄', icon: 'records' }, { t: '檔案', icon: 'profile' },
    { t: '設定', icon: 'settings' }, { t: '關於', icon: 'info' }] },
  { key: 'chart', name: '命盤', icon: 'astro', items: [
    { t: '星盤', icon: 'astro' }, { t: '紫微', icon: 'ziwei' },
    { t: '八字', icon: 'pillars' }, { t: '運勢', icon: 'clock' }] },
  { key: 'divine', name: '占卜', icon: 'dice', items: [
    { t: '卜卦', icon: 'dice' }, { t: '塔羅', icon: 'star' }, { t: '求籤', icon: 'folder' }] },
  { key: 'time', name: '時空', icon: 'calendar', items: [
    { t: '擇日', icon: 'calendar' }, { t: '方位', icon: 'compass' }] },
  { key: 'bond', name: '關係', icon: 'link', items: [
    { t: '合盤', icon: 'link' }, { t: '面談', icon: 'edit' },
    { t: '姓名', icon: 'naming' }, { t: '數字', icon: 'numbers' }] },
];

/** 扇形的弧度：t 是 -1（最左）到 1（最右），中間是 0 */
const ARC = { rise: 30, tilt: 13 };   // 兩端比中間低幾 px、外傾幾度

/* ── 小工具 ───────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const range = (n) => [...Array(n).keys()];
/** 把角度收到 -180..180，比較兩個角度差多少才不會在 ±180 那裡爆掉 */
const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const vw = () => innerWidth, vh = () => innerHeight;
/* 圓心永遠留在手指上，不夾 —— 一夾住，「手指沒動」就不等於「正中心」，
   放開會變成誤選。改成把超出畫面的那幾項「沿著圓周滑回來」：
   半徑不變、角度稍微偏，所以絕對不會壓到中央的取消區。
   代價是靠邊時有兩三項會擠在同一側 —— 那就是輪盤在手機上的真實樣子，
   不修掉才看得出它跟拇指扇差在哪。 */
function fitPts(pts, cx, cy, R, w = 44, h = 34) {
  const L = w + 6, Rt = vw() - w - 6, T = h + 6, B = vh() - h - 6;
  const onCircle = (v) => Math.sqrt(Math.max(0, R * R - v * v));
  return pts.map(p => {
    const sx = Math.sign(p.x - cx) || 1, sy = Math.sign(p.y - cy) || 1;
    let x = clamp(p.x, L, Rt);
    let y = x === p.x ? p.y : cy + sy * onCircle(x - cx);
    const y2 = clamp(y, T, B);
    if (y2 !== y) x = clamp(cx + sx * onCircle(y2 - cy), L, Rt);
    // 位置被搬過，角度就跟著變 —— 下面的命中判斷要用搬完的角度，
    // 不然會發生「明明指著這一項，選到的卻是隔壁」
    return { ...p, x, y: y2, deg: Math.atan2(y2 - cy, x - cx) * DEG };
  });
}

/** 指到哪一項：比的是「畫出來的位置」的角度，不是理論角度 —— 看到什麼就選到什麼 */
function nearestByAngle(pts, cx, cy, px, py) {
  const a = Math.atan2(py - cy, px - cx) * DEG;
  let best = 0, bestD = Infinity;
  pts.forEach((p, i) => {
    const d = Math.abs(wrap180(a - p.deg));
    if (d < bestD) { bestD = d; best = i; }
  });
  return { i: best, off: bestD };
}

const buzz = (ms = 8) => { if (opts.haptic && navigator.vibrate) { try { navigator.vibrate(ms); } catch {} } };
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toast-root').append(el);
  setTimeout(() => el.remove(), 1500);
}

/* ── 參數 ─────────────────────────────────────────── */
const opts = { hold: 260, radius: 118, haptic: true, ray: true, calm: false };

/* 圓環整個轉一個角度，讓「離畫面邊緣最近的那一項」離得越遠越好。
   只要掃過一格（360/n）就掃完所有不重複的可能。 */
function bestSpin(cx, cy, R, n, step) {
  let best = 0, bestScore = -Infinity;
  for (let k = 0; k < 24; k++) {
    const off = (k / 24) * step;
    let worst = Infinity;
    for (let i = 0; i < n; i++) {
      const deg = (-90 + off + i * step) * RAD;
      const x = cx + Math.cos(deg) * R, y = cy + Math.sin(deg) * R;
      worst = Math.min(worst, x - 46, vw() - 46 - x, y - 36, vh() - 36 - y);
    }
    if (worst > bestScore) { bestScore = worst; best = off; }
  }
  return best;
}

/* 在半徑 R 的圓周上，找出「整張卡片都還在畫面裡」的那一段角度。
   回傳最長的一段；一樣長就挑離正上方最近的。 */
function safeArc(cx, cy, R, w = 44, h = 34) {
  const S = 2, N = 360 / S;
  const okAt = (deg) => {
    const x = cx + Math.cos(deg * RAD) * R, y = cy + Math.sin(deg * RAD) * R;
    return x >= w + 6 && x <= vw() - w - 6 && y >= h + 6 && y <= vh() - h - 6;
  };
  const ok = range(N).map(i => okAt(-180 + i * S));
  if (ok.every(Boolean)) return { mid: -90, room: 360 };
  if (!ok.some(Boolean)) return null;
  let best = null;
  for (let i = 0; i < N; i++) {
    if (ok[i] || !ok[(i + 1) % N]) continue;       // 只從「關→開」的邊界起算
    let len = 0;
    while (len < N && ok[(i + 1 + len) % N]) len++;
    const mid = -180 + ((i + 1 + (len - 1) / 2) % N) * S;
    const near = Math.abs(wrap180(mid + 90));
    if (!best || len > best.len || (len === best.len && near < best.near)) {
      best = { len, mid: wrap180(mid), near };
    }
  }
  return best && { mid: best.mid, room: best.len * S };
}

/* 兩張卡片之間至少要差這麼多角度才不會黏在一起（半徑越大，同樣距離佔的角度越小） */
const MIN_SEP = 58;
const sepDeg = (R) => 2 * Math.asin(Math.min(1, MIN_SEP / 2 / R)) * DEG;

/**
 * 環狀擺法 —— 輪盤與拇指扇共用這一段。
 *
 * 這裡有一件必須誠實面對的事：**整圈的輪盤在手機上幾乎放不下**。
 * 圓心要咬著手指（不然「沒移動」就不等於取消），而分類列在畫面邊上，
 * 左右各要 R + 半張卡片的空間 —— 390px 寬的螢幕上，只有正中間按得出整圈。
 * 所以放不下的時候就自動退化成扇形，開口朝向放得下的那一側。
 *
 * 半徑也不是固定的：先照使用者設的值試，放不下就往上下找一個放得下的。
 * 放大常常比縮小有效 —— 半徑越大，同樣的間距佔掉的角度越少。
 */
function ringPlace(cx, cy, n, wantSpan) {
  const need = (R) => (n > 1 ? (n - 1) * sepDeg(R) : 0);
  const base = opts.radius;
  const ladder = [...new Set([1, 1.18, 0.86, 1.38, 0.74, 1.6, 1.85]
    .map(k => clamp(Math.round(base * k), 52, 230)).concat([150, 190, 230]))];
  let pick = null;
  for (const R of ladder) {
    const win = safeArc(cx, cy, R);
    if (!win) continue;
    const room = win.room - (win.room >= 360 ? 0 : 12);
    const score = room - need(R);
    if (!pick || score > pick.score) pick = { R, win, room, score };
    if (score >= 0 && room >= Math.min(wantSpan, need(R) + 8)) break;
  }
  if (!pick) pick = { R: base, win: { mid: -90, room: 360 }, room: 360, score: 0 };

  const { R, win, room } = pick;
  if (wantSpan >= 360 && room >= 358) {            // 整圈放得下
    const step = 360 / n;
    const off = bestSpin(cx, cy, R, n, step);
    const pts = fitPts(range(n).map(i => {
      const deg = -90 + off + i * step;
      return { x: cx + Math.cos(deg * RAD) * R, y: cy + Math.sin(deg * RAD) * R, deg };
    }), cx, cy, R);
    return { R, full: true, pts, start: -90 + off, step, span: 360, mid: -90 };
  }
  // 放不下 → 扇形：張開角度取「想要的」與「放得下的」之中小的那個，
  // 但至少要撐開到卡片不會互相疊住
  // 想要的、放得下的、不會疊住的 —— 三者之間取一個站得住的值
  const span = Math.min(340, Math.max(Math.min(wantSpan === 360 ? 300 : wantSpan, room), Math.min(need(R), room)));
  const step = n > 1 ? span / (n - 1) : 0;
  const start = win.mid - span / 2;
  const pts = fitPts(range(n).map(i => {
    const deg = start + i * step;
    return { x: cx + Math.cos(deg * RAD) * R, y: cy + Math.sin(deg * RAD) * R, deg };
  }), cx, cy, R);
  return { R, full: false, pts, start, step, span, mid: win.mid };
}

/* ── 四種版面 ─────────────────────────────────────────
   每一種都回傳同樣形狀的「擺法」：中心點、每一項的座標、
   還有一個 hit(x, y) 告訴你手指現在指到第幾項（-1 代表沒指到／取消）。 */
const LAYOUTS = {

  /* 正圓環：靠「方向」選。學會之後最快，因為方向可以變成肌肉記憶。 */
  radial: {
    name: '輪盤', tag: 'RADIAL', trigger: 'cats',
    desc: '點一下分類，功能繞成一圈停在畫面上；點一下要的那一項，或按著滑過去再放開。',
    pros: ['學會之後最快，方向能變肌肉記憶', '不用看也能選，適合每天用的那幾個'],
    cons: ['手機上幾乎排不出整圈 —— 分類在畫面邊上，左右都沒有半徑的空間，'
      + '所以按在邊邊時它會自動退化成扇形（也就是下一個方案）',
      '只有按在畫面正中間附近才是真的整圈，方向感因此不穩定',
      '一圈最多放八項，再多角度就太窄'],
    place(a, n) {
      const cx = a.x, cy = a.y;                 // 圓心咬著手指，絕不夾
      const r = ringPlace(cx, cy, n, 360);
      return {
        cx, cy, pts: r.pts, dead: 40, hub: '放開取消', full: r.full,
        hit(px, py) {
          // 圓環是「看方向」的，滑多遠都算數；只有回到中心才是取消
          if (Math.hypot(px - cx, py - cy) < 40) return -1;
          return nearestByAngle(r.pts, cx, cy, px, py).i;
        },
      };
    },
  },

  /* 拇指扇：只往上開一個扇形，永遠不會被畫面邊緣切掉，
     而且落在拇指自然的擺動弧線上。 */
  arc: {
    name: '拇指扇', tag: 'ARC', trigger: 'cats',
    desc: '點一下分類，功能排成一道扇形往上開；左右擺動拇指掃過去。',
    pros: ['永遠不會被邊緣切到，單手最好按', '項目之間角度大，不容易選錯', '文字有位置放，看得懂'],
    cons: ['沒有「正圓」那種四面八方的方向感', '扇形一次頂多六、七項'],
    place(a, n) {
      const cx = a.x, cy = a.y;
      const want = n > 1 ? Math.min(186, n * 42) : 0;
      const r = ringPlace(cx, cy, n, want);
      // 「離最近那一項有多遠」當界線，比用名目角度算穩 ——
      // 卡片被搬過位置之後，名目角度就不準了
      const slack = n > 1 ? r.step * 0.62 + 8 : 62;
      return {
        cx, cy, pts: r.pts, dead: 38, hub: '放開取消',
        hit(px, py) {
          if (Math.hypot(px - cx, py - cy) < 38) return -1;
          const { i, off } = nearestByAngle(r.pts, cx, cy, px, py);
          return off > slack ? -1 : i;
        },
      };
    },
  },

  /* 直列滑選：最好讀，也最像 iOS 的長按選單。
     犧牲速度換可讀性 —— 項目多、名字長的時候反而是這個贏。 */
  list: {
    name: '滑選清單', tag: 'LIST · 採用', trigger: 'cats',
    desc: '點一下分類，功能排成一列停住；點一項，或按著上下滑再放開。（已採用）',
    pros: ['名字完整看得到，最好讀', '十幾項也排得下，不用分頁', '最接近大家熟悉的長按選單'],
    cons: ['最慢，每次都要用眼睛找', '會遮掉一大塊畫面'],
    place(a, n) {
      const H = 46, GAP = 4, W = 208, pad = 16;
      const total = n * H + (n - 1) * GAP;
      const cx = clamp(a.x, W / 2 + 10, vw() - W / 2 - 10);
      // 分類在畫面下方，所以預設往上長；上面擺不下才翻到下面
      let top = a.y - 64 - total;
      if (top < pad) top = a.y + 64;
      top = clamp(top, pad, vh() - total - pad);
      const pts = range(n).map(i => ({ x: cx, y: top + i * (H + GAP) + H / 2 }));
      return {
        cx: a.x, cy: a.y, pts, dead: 0, row: true, hub: null,
        hit(px, py) {
          if (Math.abs(px - cx) > W / 2 + 46) return -1;
          if (py < top - 30 || py > top + total + 30) return -1;
          return clamp(Math.floor((py - top) / (H + GAP)), 0, n - 1);
        },
      };
    },
  },

};

/* ── 選單 ─────────────────────────────────────────── */
const root = $('#menu-root');
let menu = null;    // { plan, els, items, mode, sticky, onPick, openedAt }

function render({ anchor, items, plan, sticky, rowStyle, onPick, hubText }) {
  root.hidden = false;
  root.innerHTML = '';
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  root.append(scrim);

  let ray = null;
  if (opts.ray && !rowStyle) {
    ray = document.createElement('div');
    ray.className = 'ray';
    root.append(ray);
  }

  let hub = null;
  if (hubText) {
    hub = document.createElement('div');
    hub.className = 'hub';
    hub.style.left = `${plan.cx}px`;
    hub.style.top = `${plan.cy}px`;
    hub.textContent = hubText;
    root.append(hub);
  }

  const els = items.map((it, i) => {
    const el = document.createElement('div');
    el.className = 'item' + (rowStyle ? ' item--row' : '');
    el.dataset.i = String(i);
    el.style.setProperty('--x', `${plan.pts[i].x}px`);
    el.style.setProperty('--y', `${plan.pts[i].y}px`);
    // 先收在中心，下一影格才彈到定位 —— 這樣才有「從手指長出來」的感覺
    el.style.transform = `translate(-50%,-50%) translate(${plan.cx}px, ${plan.cy}px) scale(.35)`;
    el.style.transitionDelay = `${Math.min(i * 16, 120)}ms`;
    el.innerHTML = `${icon(it.icon || 'star')}<small>${it.t || it.name}</small>`;
    root.append(el);
    return el;
  });

  requestAnimationFrame(() => {
    root.classList.add('is-open');
    els.forEach((el, i) => {
      el.style.transform = `translate(-50%,-50%) translate(${plan.pts[i].x}px, ${plan.pts[i].y}px) scale(1)`;
      el.style.opacity = '1';
    });
  });

  menu = { plan, els, items, sticky, ray, hub, onPick, hot: -1, openedAt: performance.now(), rowStyle };

  if (sticky) {
    els.forEach((el, i) => {
      el.addEventListener('pointerenter', () => setHot(i));     // 滑鼠
      el.addEventListener('click', () => commit(i));
    });
    /* 觸控沒有 hover，所以自己追手指：按著滑過去，放開就選中。
       單純點一下不在這裡處理 —— 交給上面每一項自己的 click，
       不然「按下去沒動就放開」會被算兩次。 */
    let from = null, moved = false;
    root.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.scrim')) return;
      from = { x: e.clientX, y: e.clientY };
      moved = false;
      aim(e.clientX, e.clientY);
    });
    root.addEventListener('pointermove', (e) => {
      if (!from) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10) moved = true;
      aim(e.clientX, e.clientY);
    });
    root.addEventListener('pointerup', (e) => {
      if (!from) return;
      from = null;
      if (!moved) return;                                   // 純點擊交給 click
      const i = menu?.plan.hit ? menu.plan.hit(e.clientX, e.clientY) : -1;
      if (i >= 0) commit(i); else close('取消');
    });
    root.addEventListener('pointercancel', () => { from = null; });
    scrim.addEventListener('click', () => close('取消'));
  }
  return menu;
}

function setHot(i) {
  if (!menu || menu.hot === i) return;
  menu.hot = i;
  menu.els.forEach((el, k) => el.classList.toggle('is-hot', k === i));
  if (menu.hub) menu.hub.classList.toggle('is-hot', i === -1);
  if (i >= 0) buzz(6);
}

function aim(x, y) {
  if (!menu) return;
  setHot(menu.plan.hit ? menu.plan.hit(x, y) : -1);
  if (menu.ray) {
    const dx = x - menu.plan.cx, dy = y - menu.plan.cy;
    const len = Math.hypot(dx, dy);
    menu.ray.style.left = `${menu.plan.cx}px`;
    menu.ray.style.top = `${menu.plan.cy}px`;
    menu.ray.style.width = `${len}px`;
    menu.ray.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  }
}

function commit(i) {
  if (!menu) return;
  const it = menu.items[i];
  const ms = Math.round(performance.now() - menu.openedAt);
  const el = menu.els[i];
  el?.classList.add('is-picked');
  buzz(14);
  const cb = menu.onPick;
  closeVisual();
  cb?.(it, ms);
}

function close(why = '取消') {
  if (!menu) return;
  const ms = Math.round(performance.now() - menu.openedAt);
  closeVisual();
  if (why === '取消') record(null, ms);
}

function closeVisual() {
  root.classList.remove('is-open');
  menu?.els.forEach(el => {
    if (el.classList.contains('is-picked')) return;
    el.style.opacity = '0';
    el.style.transitionDelay = '0ms';
    el.style.transform = `translate(-50%,-50%) translate(${menu.plan.cx}px, ${menu.plan.cy}px) scale(.5)`;
  });
  menu = null;
  setTimeout(() => { if (!menu) { root.hidden = true; root.innerHTML = ''; } }, 360);
}

/* ── 手勢 ─────────────────────────────────────────────
   一個 pointerdown 開始，之後所有事件都靠 setPointerCapture 綁在同一顆元素上，
   手指滑出去也追得到。滑鼠與觸控走同一條路。 */
/* 手勢
   ──────────────────────────────────────────────────────────
   點一下就叫出選單，選單停在畫面上，再點一下要的那一項。

   原本做的是「長按叫出、不放手滑到底、放開選中」。拿掉的理由有兩個：
   一是長按每次都要先等三百毫秒，天天用的東西不該每次都等；
   二是長按加拖曳對手指不方便的人很不友善。

   停住之後仍然可以「按著滑過去再放開」——
   滑鼠靠 hover、觸控靠 pointermove，兩邊都通。 */
function arm(el, open) {
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button > 0) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const onMove = (ev) => {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 12) moved = true;
    };
    const onUp = () => {
      cleanup();
      if (moved) return;                 // 在按鈕上滑來滑去多半是想捲畫面
      buzz(8);
      el.classList.add('is-armed');
      setTimeout(() => el.classList.remove('is-armed'), 180);
      open({ anchor: start, sticky: true });
    };
    const cleanup = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', cleanup);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', cleanup);
  });
}

/* ── 紀錄 ─────────────────────────────────────────── */
const stats = {};
const log = [];
const statOf = (m) => (stats[m] ||= { picks: 0, cancels: 0, ms: 0 });

function record(item, ms) {
  const s = statOf(mode);
  if (item) { s.picks++; s.ms += ms; log.unshift({ t: item.t || item.name, ms, mode }); }
  else s.cancels++;
  paintStats();
}

function paintStats() {
  const s = statOf(mode);
  const avg = s.picks ? Math.round(s.ms / s.picks) : 0;
  const rate = s.picks + s.cancels ? Math.round(s.cancels / (s.picks + s.cancels) * 100) : 0;
  $('#stats').innerHTML = `
    <div class="stat"><b>${s.picks}</b><span>選中</span></div>
    <div class="stat"><b>${avg || '—'}</b><span>平均 ms</span></div>
    <div class="stat"><b>${rate}%</b><span>取消率</span></div>`;
  $('#log').innerHTML = log.length
    ? log.slice(0, 20).map(x => `<li><span>${x.t}<em> · ${LAYOUTS[x.mode].name}</em></span><em>${x.ms} ms</em></li>`).join('')
    : '<li class="log__empty">還沒選過東西。</li>';
}

/* ── 組裝：把某個方案接到假畫面上 ─────────────────── */
let mode = 'list';        // 已經選定：分類底下的細項用滑選清單

function openCat(cat) {
  return ({ anchor, sticky }) => {
    const L = LAYOUTS[mode];
    const plan = L.place(anchor, cat.items.length);
    render({
      anchor, items: cat.items, plan, sticky,
      rowStyle: !!plan.row, hubText: plan.hub,
      onPick: (it, ms) => { record(it, ms); toast(`選了「${it.t}」`); },
    });
  };
}

/* ── 畫面 ─────────────────────────────────────────── */
/* 分類列本身排成扇形：中間最高、兩端往下沉，按鈕也跟著微微外傾。
   弧度用「index 換算成 -1..1 再取平方」算，不必去量容器寬度，
   所以轉螢幕、換字級都自己會跟上。
   正中間下方那顆是首頁 —— 拇指最好按的位置留給最常按的東西。 */
function buildDock() {
  const dock = $('#dock');
  dock.innerHTML = '';
  const arc = document.createElement('div');
  arc.className = 'arcbar';
  const mid = (CATS.length - 1) / 2;
  CATS.forEach((cat, i) => {
    const t = mid ? (i - mid) / mid : 0;
    const b = document.createElement('button');
    b.className = 'cat';
    b.style.setProperty('--dy', `${(ARC.rise * t * t).toFixed(1)}px`);
    b.style.setProperty('--rot', `${(ARC.tilt * t).toFixed(1)}deg`);
    b.innerHTML = `${icon(cat.icon)}<span>${cat.name}</span>`;
    arc.append(b);
    arm(b, openCat(cat));
  });
  dock.append(arc);

  const home = document.createElement('button');
  home.className = 'cat cat--home';
  home.innerHTML = `${icon('home')}<span>首頁</span>`;
  home.addEventListener('click', () => { buzz(10); toast('回到首頁'); });
  dock.append(home);
}

function buildModes() {
  const nav = $('#modes');
  nav.innerHTML = '';
  for (const [key, L] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.className = 'mode';
    b.setAttribute('aria-pressed', String(key === mode));
    b.innerHTML = `<b>${L.name}</b><small>${L.tag}</small>`;
    b.addEventListener('click', () => { mode = key; sync(); });
    nav.append(b);
  }
}

function sync() {
  const L = LAYOUTS[mode];
  buildModes();
  buildDock();
  paintStats();
  $('#note').innerHTML = `<p>${L.desc}</p>
    <div class="pm">
      ${L.pros.map(x => `<span><i>好</i>${x}</span>`).join('')}
      ${L.cons.map(x => `<span><i>代價</i>${x}</span>`).join('')}
    </div>`;
  $('#stage-hint').textContent = '點一下下方的分類';
}

/* ── 參數與雜項 ───────────────────────────────────── */
function bind() {
  const set = (id, key, fmt) => {
    const el = $(`#${id}`);
    const out = $(`#${id}-v`);
    const apply = () => { opts[key] = Number(el.value); if (out) out.textContent = fmt(el.value); };
    el.addEventListener('input', apply);
    apply();
  };
  set('rad', 'radius', v => `${v} px`);
  // 扇形的起伏與傾斜可以即時調，找到喜歡的數字就定下來
  const arcIn = (id, out, apply) => {
    const el = $(`#${id}`);
    const f = () => { apply(Number(el.value)); $(`#${out}`).textContent = el.value + (id === 'tilt' ? '°' : ' px'); buildDock(); };
    el.addEventListener('input', f);
    f();
  };
  arcIn('rise', 'rise-v', v => { ARC.rise = v; });
  arcIn('tilt', 'tilt-v', v => { ARC.tilt = v; });
  $('#haptic').addEventListener('change', e => { opts.haptic = e.target.checked; });
  $('#ray').addEventListener('change', e => { opts.ray = e.target.checked; });
  $('#calm').addEventListener('change', e => {
    opts.calm = e.target.checked;
    document.body.classList.toggle('calm', opts.calm);
  });
  $('#reset').addEventListener('click', () => {
    Object.keys(stats).forEach(k => delete stats[k]);
    log.length = 0; paintStats(); toast('歸零了');
  });
  $('#haptic-note').textContent = navigator.vibrate
    ? '這台裝置有震動 API，高亮換項時會有很輕的一下。'
    : 'iPhone 的 Safari 沒有震動 API，所以這台按起來不會有震動 —— 正式做的時候只能靠視覺回饋。';

  const themeBtn = $('#theme');
  const paintTheme = () => {
    const dark = document.documentElement.dataset.theme !== 'light';
    themeBtn.innerHTML = icon(dark ? 'sun' : 'moon');
  };
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('xj.lab.theme', next); } catch {}
    paintTheme();
  });
  paintTheme();

  addEventListener('keydown', (e) => { if (e.key === 'Escape') close('取消'); });
  $('#fake').innerHTML = '<i></i>'.repeat(9);

  $('#verdict').innerHTML = `
    <h3>這一版改了什麼</h3>
    <p><b>分類列自己排成扇形。</b>中間最高、兩端往下沉，按鈕也跟著微微外傾。
      弧度是用「第幾個換算成 -1 到 1 再取平方」算出來的，不必去量容器寬度，
      所以轉螢幕、換字級都自己會跟上。</p>
    <p><b>首頁卡在扇形正中央下面的凹處。</b>那是拇指最好按的位置，留給最常按的東西。</p>
    <p><b>工具移到最左邊。</b>設定、關於這些最少用、也最不想誤觸的，放在最遠的角落。</p>
    <p><b>人際與名數合併成「關係」。</b>合盤、面談是你跟人的關係，姓名、數字是你跟自己名號的關係 ——
      老實說這個歸類有點勉強，名字你可以改，我先取一個能用的。</p>
    <p><b>長按拿掉了，改成點一下叫出停住的選單。</b>理由有兩個：長按每次都要先等三百毫秒，
      天天用的東西不該每次都等；而且長按加拖曳對手指不方便的人很不友善。
      停住之後仍然可以「按著滑過去再放開」，兩種都通。</p>
    <p><b>兩段輪盤拿掉了。</b>它整個設計就建立在「長按住再往外拖」上，沒有長按就沒有它。</p>
    <h3>還沒決定的</h3>
    <p>一、「關係」這個名字。<br>
      二、扇形的弧度與傾斜角（下面可以即時調，找到喜歡的告訴我數字）。<br>
      三、要不要把這一版套進 App 本體 —— 本體的導覽目前還沒動。</p>`;
}

/* 測試只要幾何那一段，不要整個畫面跑起來 */
export { LAYOUTS, CATS, opts, ARC, fitPts, bestSpin };
if (!globalThis.__LAB_NO_BOOT) { bind(); sync(); }
