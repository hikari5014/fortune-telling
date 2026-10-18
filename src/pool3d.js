/* 許願池的 3D 畫面與操作
   ──────────────────────────────────────────────────────────
   物理在 src/engines/pool.js；這支負責「畫」與「怎麼投」。

   畫法跟擲筊一樣：Canvas 2D 自己做透視投影，不用 WebGL。
   不會動的東西（夜空、廣場、石池、池底的硬幣、石柱與月盞）先畫在兩張離屏畫布上，
   每一格只重畫會動的：水面的倒影與漣漪、飛在空中或正在下沉的硬幣、水花。
   一個圓投影到畫面上是橢圓 —— 直接拿圓周上的點去投影成多邊形，透視一定對。

   怎麼投（細操作）：
   ・手指：按住畫面往上拉 —— 往上拉多長決定多遠，往左右偏決定方向。
     拉的時候會畫出前半段的弧線，跟水面上的落點圈；放手就照那條線飛出去。
     空中沒有亂數：落點就是你瞄的地方。要投進中央的月盞，得自己算好它比水面高。
   ・手機：左右傾斜瞄方向、前後傾斜調遠近，落點圈會跟著動；往前輕輕一甩就投出。
     用的是「甩之前那一瞬間」的瞄準，甩的動作本身不會把準頭帶偏。 */

import { POOL, START, targetOf, launchFor, predict, zoneOf, createCoin, stepCoin, simulate, normalOf } from './engines/pool.js';
import { clink, plop, chime } from './rites/sound.js';
import { haptic } from './ui.js';
import { askMotion } from './rites/kit.js';

const fastMode = () => document.documentElement.dataset.motion === 'off'
  || matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── 小工具 ───────────────────────────────────────── */
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function camera(w, h) {
  const E = { x: 0, y: 1.35, z: 2.75 }, T = { x: 0, y: -0.1, z: -0.35 };
  const f = norm(sub(T, E)), r = norm(cross(f, { x: 0, y: 1, z: 0 })), u = cross(r, f);
  const F = w * 1.05;
  return {
    E,
    proj(p) {
      const d = sub(p, E);
      const zc = dot(d, f);
      return { x: w / 2 + F * dot(d, r) / zc, y: h * 0.6 - F * dot(d, u) / zc, z: zc, s: F / zc };
    },
  };
}

const L = norm({ x: 0.5, y: 1, z: -0.4 });      // 月光從右後方照過來
const DRAW_R = 0.07;                              // 畫面上的硬幣半徑（比物理的大一點，才看得清楚）

/** 水平圓（y 固定）投影成多邊形 */
function ring(cam, r, y, cx = 0, cz = 0, n = 72) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(cam.proj({ x: cx + r * Math.cos(a), y, z: cz + r * Math.sin(a) })); }
  return pts;
}
function pathOf(pts) { const p = new Path2D(); pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y))); p.closePath(); return p; }
const yRange = (pts) => [Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.y))];

/* ── 硬幣 ─────────────────────────────────────────── */
/* 一般硬幣是銀色；贊助者的福幣是金色 */
const METAL = {
  gold:   { base: [232, 186, 80], edge: '#a87c26', mark: [150, 100, 24], ring: [120, 80, 20], glow: '255,214,120' },
  silver: { base: [206, 212, 226], edge: '#8a90a2', mark: [120, 126, 142], ring: [100, 106, 122], glow: '220,230,255' },
};
function drawCoin(ctx, cam, p, n, { under = 0, alpha = 1, glow = 0, gold = true } = {}) {
  const M = gold ? METAL.gold : METAL.silver;
  n = norm(n);
  const ref = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const e1 = norm(cross(n, ref)), e2 = cross(n, e1);
  const th = 0.012;
  const face = (sgn, rad = DRAW_R, k = 20, star = false) => {
    const pts = [];
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2, rr = star ? (i % 2 ? rad * 0.3 : rad) : rad;
      pts.push(cam.proj({ x: p.x + sgn * n.x * th / 2 + rr * (Math.cos(a) * e1.x + Math.sin(a) * e2.x),
        y: p.y + sgn * n.y * th / 2 + rr * (Math.cos(a) * e1.y + Math.sin(a) * e2.y),
        z: p.z + sgn * n.z * th / 2 + rr * (Math.cos(a) * e1.z + Math.sin(a) * e2.z) }));
    }
    return pts;
  };
  const toEye = sub(cam.E, p), front = dot(n, toEye) >= 0 ? 1 : -1;
  const nf = { x: n.x * front, y: n.y * front, z: n.z * front };
  const lit = 0.35 + 0.65 * Math.max(0, dot(nf, L));
  const H = norm({ x: L.x + toEye.x, y: L.y + toEye.y, z: L.z + toEye.z });
  const spec = Math.pow(Math.max(0, dot(nf, H)), 24);
  const c = M.base.map(v => Math.min(255, Math.round(v * lit + 255 * spec * 0.8)));
  ctx.save();
  ctx.globalAlpha = alpha;
  if (glow) {
    const q = cam.proj(p);
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.s * DRAW_R * 3.2);
    g.addColorStop(0, `rgba(${M.glow},${0.35 * glow})`); g.addColorStop(1, `rgba(${M.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, q.s * DRAW_R * 3.2, 0, Math.PI * 2); ctx.fill();
  }
  const back = face(-front), top = face(front);
  ctx.fillStyle = M.edge;
  ctx.fill(pathOf(back));
  ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
  ctx.fill(pathOf(top));
  // 浮雕：內圈＋中央的四芒星
  ctx.strokeStyle = `rgba(${M.ring.join(',')},${0.55 * lit + 0.2})`; ctx.lineWidth = 0.8;
  ctx.stroke(pathOf(face(front, DRAW_R * 0.74, 20)));
  ctx.fillStyle = `rgba(${M.mark.join(',')},${0.5 * lit + 0.25})`;
  ctx.fill(pathOf(face(front, DRAW_R * 0.5, 8, true)));
  if (under) { ctx.fillStyle = `rgba(60,130,170,${under})`; ctx.fill(pathOf(top)); ctx.fill(pathOf(back)); }
  ctx.restore();
}

/* ── 不會動的部分 ─────────────────────────────────── */
function paintBackground(g, cam, w, h, coins, seed) {
  const R = rng(seed);
  // 夜空
  const hz = cam.proj({ x: 0, y: 0, z: -40 }).y;
  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#070a1c'); sky.addColorStop(.7, '#121838'); sky.addColorStop(1, '#232a55');
  g.fillStyle = sky; g.fillRect(0, 0, w, hz + 2);
  for (let i = 0; i < 90; i++) {
    const x = R() * w, y = R() * hz * 0.95, s = R() < 0.1 ? 1.4 : 0.7;
    g.fillStyle = `rgba(240,235,215,${0.3 + R() * 0.6})`; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
  }
  // 月亮
  const mx = w * 0.76, my = hz * 0.32, mr = w * 0.045;
  const halo = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 5);
  halo.addColorStop(0, 'rgba(255,236,190,.35)'); halo.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(mx, my, mr * 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f6ecd0'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(200,185,150,.35)';
  [[-.3, -.2, .22], [.25, .15, .18], [-.05, .35, .12]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2); g.fill(); });
  // 遠山與樹影，林間點著幾盞燈
  const k = w / 390;
  g.fillStyle = '#0d1230';
  g.beginPath(); g.moveTo(0, hz);
  for (let x = 0; x <= w; x += 6) g.lineTo(x, hz - (16 + 10 * Math.sin(x * 0.011 + 1) + 6 * Math.sin(x * 0.037)) * k);
  g.lineTo(w, hz + 2); g.lineTo(0, hz + 2); g.fill();
  g.fillStyle = '#080c22';
  for (let i = 0; i < 26; i++) {
    const x = (i + R() * 0.6) / 26 * w, th = (12 + R() * 22) * k, tw = (7 + R() * 7) * k;
    g.beginPath(); g.moveTo(x - tw, hz + 1); g.quadraticCurveTo(x - tw * 0.4, hz - th * 0.6, x, hz - th); g.quadraticCurveTo(x + tw * 0.4, hz - th * 0.6, x + tw, hz + 1); g.fill();
  }
  for (const fx of [0.12, 0.31, 0.66, 0.88]) {
    const x = fx * w, y = hz - 4 * k;
    const lg = g.createRadialGradient(x, y, 0, x, y, 14 * k);
    lg.addColorStop(0, 'rgba(255,196,110,.75)'); lg.addColorStop(.25, 'rgba(255,170,80,.25)'); lg.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = lg; g.beginPath(); g.arc(x, y, 14 * k, 0, Math.PI * 2); g.fill();
  }
  // 地平線上一層薄霧
  const mist = g.createLinearGradient(0, hz - 12 * k, 0, hz + 40 * k);
  mist.addColorStop(0, 'rgba(120,130,190,0)'); mist.addColorStop(.4, 'rgba(120,130,190,.12)'); mist.addColorStop(1, 'rgba(120,130,190,0)');
  g.fillStyle = mist; g.fillRect(0, hz - 12 * k, w, 52 * k);
  // 廣場：石板地，往遠處淡入夜色
  const gr = g.createLinearGradient(0, hz, 0, h);
  gr.addColorStop(0, '#141a33'); gr.addColorStop(.5, '#1d2340'); gr.addColorStop(1, '#262c4a');
  g.fillStyle = gr; g.fillRect(0, hz, w, h - hz);
  // 石板：一圈一圈鋪開，越遠越淡
  [1.6, 2.05, 2.6, 3.3].forEach((r, i) => { g.strokeStyle = `rgba(160,170,210,${0.1 - i * 0.02})`; g.lineWidth = 1; g.stroke(pathOf(ring(cam, r, POOL.GROUND))); });
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, p1 = cam.proj({ x: 1.3 * Math.cos(a), y: POOL.GROUND, z: 1.3 * Math.sin(a) }), p2 = cam.proj({ x: 2.6 * Math.cos(a), y: POOL.GROUND, z: 2.6 * Math.sin(a) });
    g.strokeStyle = 'rgba(160,170,210,.05)'; g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
  }
  // 地上的柔光（月光照在池子周圍）
  const c0 = cam.proj({ x: 0, y: POOL.GROUND, z: 0 });
  const glow = g.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, w * 0.62);
  glow.addColorStop(0, 'rgba(120,140,220,.14)'); glow.addColorStop(1, 'rgba(120,140,220,0)');
  g.fillStyle = glow; g.fillRect(0, hz, w, h - hz);

  // 池子後面左右各一座石燈籠
  for (const x of [-1.85, 1.85]) lantern(g, cam, x, -1.45);

  // 石池的外牆：先畫底圈，再蓋上頂圈 —— 前面露出來的就是牆
  const RO = POOL.R + POOL.RIM_W;
  const outerBot = ring(cam, RO, POOL.GROUND), outerTop = ring(cam, RO, POOL.RIM_H);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fill(pathOf(ring(cam, RO + 0.08, POOL.GROUND)));
  const [, yb] = yRange(outerBot);
  const wall = g.createLinearGradient(0, yRange(outerTop)[1] - 20, 0, yb);
  wall.addColorStop(0, '#4a4f68'); wall.addColorStop(1, '#2a2e44');
  g.fillStyle = wall; g.fill(pathOf(outerBot));
  // 牆面的石塊縫：只畫朝向鏡頭的那半圈
  g.strokeStyle = 'rgba(15,18,35,.45)'; g.lineWidth = 1;
  for (let i = 0; i < 28; i++) {
    const a = (i + 0.5) / 28 * Math.PI * 2;
    if (Math.sin(a) < 0.1) continue;
    const t = cam.proj({ x: RO * Math.cos(a), y: POOL.RIM_H, z: RO * Math.sin(a) }), b = cam.proj({ x: RO * Math.cos(a), y: POOL.GROUND, z: RO * Math.sin(a) });
    g.beginPath(); g.moveTo(t.x, t.y); g.lineTo(b.x, b.y); g.stroke();
  }
  // 石緣頂
  const [ty0, ty1] = yRange(outerTop);
  const top = g.createLinearGradient(0, ty0, 0, ty1);
  top.addColorStop(0, '#6f7593'); top.addColorStop(.5, '#8a90ab'); top.addColorStop(1, '#a3a8bf');
  g.fillStyle = top; g.fill(pathOf(outerTop));
  g.strokeStyle = 'rgba(255,240,200,.25)'; g.lineWidth = 1.2; g.stroke(pathOf(outerTop));
  for (let i = 0; i < 28; i++) {                    // 石緣上的接縫
    const a = i / 28 * Math.PI * 2;
    const p1 = cam.proj({ x: POOL.R * Math.cos(a), y: POOL.RIM_H, z: POOL.R * Math.sin(a) }), p2 = cam.proj({ x: RO * Math.cos(a), y: POOL.RIM_H, z: RO * Math.sin(a) });
    g.strokeStyle = 'rgba(30,34,56,.35)'; g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
  }
  // 池口：內壁（後半圈看得到）
  const opening = ring(cam, POOL.R, POOL.RIM_H);
  const [oy0, oy1] = yRange(opening);
  const inner = g.createLinearGradient(0, oy0, 0, oy1);
  inner.addColorStop(0, '#2b3150'); inner.addColorStop(1, '#151a32');
  g.fillStyle = inner; g.fill(pathOf(opening));
  // 池底（水裡）：深藍的磁磚圈
  g.save(); g.clip(pathOf(opening)); g.clip(pathOf(ring(cam, POOL.R, 0)));
  const bot = ring(cam, POOL.R, -POOL.DEPTH);
  const [by0, by1] = yRange(bot);
  const bg = g.createLinearGradient(0, by0, 0, by1);
  bg.addColorStop(0, '#16285a'); bg.addColorStop(1, '#1f3a73');
  g.fillStyle = '#122045'; g.fill(pathOf(ring(cam, POOL.R, 0)));
  g.fillStyle = bg; g.fill(pathOf(bot));
  g.strokeStyle = 'rgba(140,190,255,.12)';
  for (const r of [0.25, 0.45, 0.65, 0.85]) g.stroke(pathOf(ring(cam, r, -POOL.DEPTH)));
  // 池底的硬幣：越新的越亮
  coins.forEach((c, i) => {
    const age = coins.length - 1 - i;
    const n = { x: Math.sin(c.yaw || 0) * (c.tilt || 0.06), y: 1, z: Math.cos(c.yaw || 0) * (c.tilt || 0.06) };
    drawCoin(g, cam, { x: c.x, y: -POOL.DEPTH + 0.006, z: c.z }, n, { under: 0.22, alpha: 0.95, gold: !!c.gold, glow: (c.gold ? 0.5 : 0.15) + 0.5 * Math.max(0, 1 - age / 12) });
  });
  // 石柱在水裡的那一段
  column(g, cam, -POOL.DEPTH, 0, true);
  g.restore();
}

/** 石燈籠：台座、竿、火袋（亮著）、笠 —— 用那個深度的「每公尺幾像素」畫在畫面上 */
function lantern(g, cam, x, z) {
  const b = cam.proj({ x, y: POOL.GROUND, z }), s = b.s;
  const glow = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, s * 0.6);
  glow.addColorStop(0, 'rgba(255,190,110,.18)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = glow; g.beginPath(); g.ellipse(b.x, b.y, s * 0.6, s * 0.2, 0, 0, Math.PI * 2); g.fill();
  const stone = (y0, y1, hw, c) => { g.fillStyle = c; g.fillRect(b.x - hw * s, b.y - y1 * s, hw * 2 * s, (y1 - y0) * s); };
  stone(0, 0.06, 0.13, '#3c4260');                 // 台座
  stone(0.06, 0.42, 0.045, '#4a5070');             // 竿
  stone(0.42, 0.47, 0.11, '#3c4260');              // 中台
  const ly = b.y - 0.62 * s;                       // 火袋
  const lg = g.createRadialGradient(b.x, ly + 0.07 * s, 0, b.x, ly + 0.07 * s, s * 0.45);
  lg.addColorStop(0, 'rgba(255,200,120,.55)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = lg; g.beginPath(); g.arc(b.x, ly + 0.07 * s, s * 0.45, 0, Math.PI * 2); g.fill();
  stone(0.47, 0.62, 0.085, '#2e3350');
  g.fillStyle = '#ffd08a'; g.fillRect(b.x - 0.045 * s, b.y - 0.6 * s, 0.09 * s, 0.11 * s);
  g.fillStyle = '#3c4260';                         // 笠：兩端微微翹起
  g.beginPath(); g.moveTo(b.x - 0.2 * s, b.y - 0.62 * s); g.quadraticCurveTo(b.x, b.y - 0.66 * s, b.x + 0.2 * s, b.y - 0.62 * s);
  g.lineTo(b.x + 0.1 * s, b.y - 0.72 * s); g.lineTo(b.x - 0.1 * s, b.y - 0.72 * s); g.closePath(); g.fill();
  g.beginPath(); g.arc(b.x, b.y - 0.75 * s, 0.035 * s, 0, Math.PI * 2); g.fill();
}

function column(g, cam, y0, y1, under) {
  const a = cam.proj({ x: -POOL.COL_R, y: y0, z: 0 }), b = cam.proj({ x: POOL.COL_R, y: y0, z: 0 });
  const c = cam.proj({ x: POOL.COL_R, y: y1, z: 0 }), d = cam.proj({ x: -POOL.COL_R, y: y1, z: 0 });
  const gr = g.createLinearGradient(a.x, 0, b.x, 0);
  gr.addColorStop(0, under ? '#22305a' : '#4c5272'); gr.addColorStop(.6, under ? '#3a4a78' : '#959ab4'); gr.addColorStop(1, under ? '#253460' : '#5d6383');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill();
}

/** 石柱露出水面的部分、月盞，以及盞裡的硬幣 */
function paintForeground(g, cam, bowl) {
  column(g, cam, 0, POOL.BOWL_Y - 0.06, false);
  g.strokeStyle = 'rgba(200,225,255,.45)'; g.lineWidth = 1;
  g.stroke(pathOf(ring(cam, POOL.COL_R, 0, 0, 0, 24)));            // 水線
  const topY = POOL.BOWL_Y, botY = POOL.BOWL_Y - 0.075;
  const top = ring(cam, POOL.BOWL_R, topY, 0, 0, 40), bot = ring(cam, 0.06, botY, 0, 0, 24);
  // 盞身：兩圈的外輪廓用凸包連起來
  const all = [...top, ...bot];
  const left = all.reduce((m, p) => (p.x < m.x ? p : m)), right = all.reduce((m, p) => (p.x > m.x ? p : m));
  const lb = bot.reduce((m, p) => (p.x < m.x ? p : m)), rb = bot.reduce((m, p) => (p.x > m.x ? p : m));
  const body = g.createLinearGradient(left.x, 0, right.x, 0);
  body.addColorStop(0, '#8a6420'); body.addColorStop(.55, '#f0cb74'); body.addColorStop(1, '#a87a26');
  g.fillStyle = body;
  g.beginPath(); g.moveTo(left.x, left.y); g.lineTo(lb.x, lb.y); g.lineTo(rb.x, rb.y); g.lineTo(right.x, right.y); g.closePath(); g.fill();
  g.fill(pathOf(bot));
  // 盞口：裡面深、邊緣亮
  const [y0, y1] = yRange(top);
  const inside = g.createLinearGradient(0, y0, 0, y1);
  inside.addColorStop(0, '#3a2708'); inside.addColorStop(1, '#6b4a14');
  g.fillStyle = inside; g.fill(pathOf(top));
  g.save(); g.clip(pathOf(top));
  const R = rng(7);
  for (let i = 0; i < Math.min(bowl.length, 14); i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.07;
    drawCoin(g, cam, { x: r * Math.cos(a), y: topY - 0.035 + i * 0.002, z: r * Math.sin(a) }, { x: (R() - .5) * .3, y: 1, z: (R() - .5) * .3 }, { gold: bowl[bowl.length - 1 - i] });
  }
  g.restore();
  g.strokeStyle = '#ffe3a0'; g.lineWidth = 1.6; g.stroke(pathOf(top));
}

/* ── 掛到畫面上 ───────────────────────────────────── */
/**
 * @param {HTMLElement} host
 * @param {object} o
 *   coins       池底已有的硬幣 [{x, z, yaw, tilt}]
 *   bowlCoins   月盞裡的硬幣：[是否福幣, …]（也可以只給數量）
 *   isGold()    手上這枚是不是福幣（畫面用）
 *   canThrow()  現在能不能投
 *   onBeforeThrow()  出手的那一刻呼叫；回傳 false 就不投（硬幣回到手上），回傳 { gold } 決定投哪一種
 *   onLand({spot, x, z, yaw, tilt})  停下來了：spot = 'pool' | 'bowl' | 'miss'
 *   onAim(aim|null)  瞄準中（給畫面下方的文字用）
 */
export function mountPool(host, { coins = [], bowlCoins = 0, isGold = () => false, canThrow, onBeforeThrow, onLand, onAim } = {}) {
  host.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'pool3d__cv';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '星空許願池：按住畫面往上拉瞄準，放手投出硬幣');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const bgc = document.createElement('canvas'), fgc = document.createElement('canvas');
  let w = 0, h = 0, dpr = 1, cam = null;
  let bottom = coins.slice(-120), inBowl = Array.isArray(bowlCoins) ? bowlCoins.slice() : Array(bowlCoins).fill(false);
  const seed = 20261018;

  const layers = () => {
    for (const [cv, fn] of [[bgc, (g) => paintBackground(g, cam, w, h, bottom, seed)], [fgc, (g) => paintForeground(g, cam, inBowl)]]) {
      cv.width = w * dpr; cv.height = h * dpr;
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); fn(g);
    }
  };
  let waterPath = null, openPath = null, refl = [];
  const size = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = host.clientWidth || 360; h = Math.round(w * 1.06);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam = camera(w, h);
    openPath = pathOf(ring(cam, POOL.R, POOL.RIM_H));
    waterPath = pathOf(ring(cam, POOL.R, 0));
    const R = rng(99);
    refl = Array.from({ length: 70 }, () => { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * POOL.R * 0.97; return { x: r * Math.cos(a), z: r * Math.sin(a), ph: R() * 6.3, s: R() < .15 ? 1.4 : .8 }; });
    layers();
  };
  size();

  /* 狀態 */
  let coin = null, aim = null, aimFrom = null, motionAim = null, trail = [];
  let ripples = [], drops = [], sparks = [], pillar = 0, nextAmbient = 1.5;
  const flies = Array.from({ length: 9 }, (_, i) => ({ a: i * 0.7, r: 0.4 + (i % 4) * 0.22, y: 0.25 + (i % 3) * 0.18, ph: i * 1.3 }));
  let raf = 0, last = performance.now(), acc = 0, t = 0, alive = true;

  function event(e) {
    if (e.type === 'clink') { clink(e.speed); haptic(6); }
    if (e.type === 'splash') {
      plop(e.speed); haptic([8, 20, 6]);
      ripples.push({ x: e.x, z: e.z, t: 0, amp: 1 });
      if (coin?.gold) for (let i = 0; i < 14; i++) {              // 福幣落水：多一圈金色的光點
        const a = Math.random() * Math.PI * 2, s = 0.15 + Math.random() * 0.35;
        sparks.push({ p: { x: e.x, y: 0.02, z: e.z }, v: { x: Math.cos(a) * s, y: 0.5 + Math.random() * 0.8, z: Math.sin(a) * s }, life: 0.9 });
      }
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, s = 0.25 + Math.random() * 0.5;
        drops.push({ p: { x: e.x, y: 0.01, z: e.z }, v: { x: Math.cos(a) * s, y: 0.9 + Math.random() * 1.1, z: Math.sin(a) * s } });
      }
    }
    if (e.type === 'bowl') {
      chime(); haptic([12, 50, 12, 50, 20]); pillar = 1;
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2, s = 0.2 + Math.random() * 0.6;
        sparks.push({ p: { x: 0, y: POOL.BOWL_Y + 0.02, z: 0 }, v: { x: Math.cos(a) * s, y: 0.6 + Math.random() * 1.4, z: Math.sin(a) * s }, life: 1 });
      }
    }
    if (e.type === 'ground') clink(1.5);
  }

  function landed(c) {
    const r = { spot: c.spot, gold: !!c.gold, x: +c.p.x.toFixed(3), z: +c.p.z.toFixed(3), yaw: +c.yaw.toFixed(2), tilt: +(c.tilt || 0).toFixed(2) };
    if (c.spot === 'pool') { bottom = [...bottom, r].slice(-120); layers(); }
    if (c.spot === 'bowl') { inBowl.push(!!c.gold); layers(); }
    setTimeout(() => { if (coin === c) coin = null; }, c.spot === 'miss' ? 600 : 0);
    onLand?.(r);
  }

  function launch(a) {
    if (coin && coin.phase !== 'rest') return false;
    if (canThrow && !canThrow()) return false;
    const opt = onBeforeThrow ? onBeforeThrow(a) : {};
    if (opt === false) return false;
    const gold = !!opt?.gold;
    const v = launchFor(targetOf(a));
    if (fastMode()) {
      const { coin: c, events } = simulate(v);
      c.gold = gold;
      events.forEach(e => (e.type === 'splash' || e.type === 'bowl') && event(e));
      coin = c; landed(c); return true;
    }
    coin = createCoin(v); coin.gold = gold;
    acc = 0; trail = [];
    return true;
  }

  /* 每一格 */
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden) return;
    t += dt;
    // 物理：固定步長，跟瞄準預覽用的步長一樣
    if (coin && coin.phase !== 'rest') {
      acc += dt;
      while (acc >= 1 / 120 && coin.phase !== 'rest') {
        acc -= 1 / 120;
        const ev = stepCoin(coin, 1 / 120);
        ev.forEach(event);
        if (coin.phase === 'rest') { landed(coin); break; }
      }
    }
    // 水花、星火、漣漪
    for (const d of drops) { d.v.y -= POOL.G * dt; d.p.x += d.v.x * dt; d.p.y += d.v.y * dt; d.p.z += d.v.z * dt; }
    drops = drops.filter(d => d.p.y > 0);
    for (const s of sparks) { s.v.y -= 1.6 * dt; s.p.x += s.v.x * dt; s.p.y += s.v.y * dt; s.p.z += s.v.z * dt; s.life -= dt * 0.7; }
    sparks = sparks.filter(s => s.life > 0);
    ripples.forEach(r => { r.t += dt; });
    ripples = ripples.filter(r => r.t < 2.6);
    pillar = Math.max(0, pillar - dt * 0.45);
    nextAmbient -= dt;
    if (nextAmbient < 0) {                           // 偶爾一滴露水，水面才是活的
      nextAmbient = 2 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.6;
      ripples.push({ x: r * Math.cos(a), z: r * Math.sin(a), t: 0, amp: 0.3 });
    }
    paint();
  }

  function paint() {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bgc, 0, 0, w, h);
    // ── 水裡與水面 ──
    ctx.save(); ctx.clip(openPath); ctx.clip(waterPath);
    if (coin && coin.phase === 'sink') drawCoin(ctx, cam, coin.p, normalOf(coin), { gold: coin.gold, under: 0.08 + 0.18 * clamp(-coin.p.y / POOL.DEPTH, 0, 1), glow: 0.6 });
    const wp = ring(cam, POOL.R, 0);
    const [wy0, wy1] = yRange(wp);
    const wg = ctx.createLinearGradient(0, wy0, 0, wy1);
    wg.addColorStop(0, 'rgba(70,90,160,.5)'); wg.addColorStop(.35, 'rgba(25,45,100,.42)'); wg.addColorStop(1, 'rgba(12,28,70,.3)');
    ctx.fillStyle = wg; ctx.fill(waterPath);
    // 天上的星星倒映在水裡，水面輕輕晃
    for (const s of refl) {
      const q = cam.proj({ x: s.x + 0.012 * Math.sin(t * 1.4 + s.z * 9), y: 0, z: s.z });
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7 + s.ph));
      ctx.fillStyle = `rgba(235,230,210,${a})`;
      ctx.fillRect(q.x - s.s * 0.8, q.y - 0.4, s.s * 1.6, 0.8);
    }
    // 月亮的倒影：一道碎成好幾段的光
    const m = cam.proj({ x: 0.5, y: 0, z: -0.5 }), k = w / 390;
    const mg = ctx.createRadialGradient(m.x, m.y + 10 * k, 0, m.x, m.y + 10 * k, 30 * k);
    mg.addColorStop(0, 'rgba(255,236,190,.28)'); mg.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(m.x, m.y + 10 * k, 16 * k, 30 * k, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 7; i++) {                     // 碎成幾段、跟著水波晃的光
      const yy = m.y + i * 5 * k, ww = (12 - i * 1.2) * k * (0.7 + 0.35 * Math.sin(t * 2.1 + i * 1.9));
      ctx.fillStyle = `rgba(255,240,205,${0.32 - i * 0.04})`;
      ctx.beginPath(); ctx.ellipse(m.x + 2.5 * k * Math.sin(t * 1.6 + i * 1.3), yy, ww / 2, 1.1 * k, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 漣漪
    for (const r of ripples) {
      for (let k = 0; k < 3; k++) {
        const rad = 0.03 + r.t * 0.42 - k * 0.07;
        if (rad <= 0.01) continue;
        const a = r.amp * 0.55 * Math.pow(1 - r.t / 2.6, 2) * (1 - k * 0.28);
        ctx.strokeStyle = `rgba(210,230,255,${a})`; ctx.lineWidth = 1.2;
        ctx.stroke(pathOf(ring(cam, rad, 0, r.x, r.z, 36)));
      }
    }
    ctx.restore();
    // ── 石柱與月盞 ──
    ctx.drawImage(fgc, 0, 0, w, h);
    const b = cam.proj({ x: 0, y: POOL.BOWL_Y, z: 0 });
    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    const halo = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.s * 0.32);
    halo.addColorStop(0, `rgba(255,220,140,${0.18 + 0.1 * pulse})`); halo.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(b.x, b.y, b.s * 0.32, 0, Math.PI * 2); ctx.fill();
    if (pillar > 0) {
      const top = cam.proj({ x: 0, y: 3, z: 0 });
      const pg = ctx.createLinearGradient(0, top.y, 0, b.y);
      pg.addColorStop(0, 'rgba(255,230,160,0)'); pg.addColorStop(1, `rgba(255,230,160,${0.55 * pillar})`);
      ctx.fillStyle = pg; ctx.fillRect(b.x - b.s * 0.12, top.y, b.s * 0.24, b.y - top.y);
    }
    // 螢火
    for (const f of flies) {
      const a = f.a + t * 0.12, q = cam.proj({ x: f.r * Math.cos(a) * 1.3, y: f.y + 0.06 * Math.sin(t * 1.3 + f.ph), z: f.r * Math.sin(a) });
      const al = 0.35 + 0.35 * Math.sin(t * 2.1 + f.ph);
      const fg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 5);
      fg.addColorStop(0, `rgba(255,230,150,${al})`); fg.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    // ── 空中的東西 ──
    for (const d of drops) { const q = cam.proj(d.p); ctx.fillStyle = 'rgba(210,230,255,.8)'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.8, q.s * 0.008), 0, Math.PI * 2); ctx.fill(); }
    for (const s of sparks) { const q = cam.proj(s.p); ctx.fillStyle = `rgba(255,225,140,${s.life})`; ctx.beginPath(); ctx.arc(q.x, q.y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    if (coin && coin.phase === 'air') {
      // 一道淡淡的金色尾巴：飛遠了變小，也看得出它在哪
      trail.push({ ...coin.p }); if (trail.length > 14) trail.shift();
      const tc = coin.gold ? '255,214,120' : '220,230,255';
      trail.forEach((q, i) => { const s = cam.proj(q); ctx.fillStyle = `rgba(${tc},${0.4 * i / trail.length})`; ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1, s.s * 0.03 * i / trail.length), 0, Math.PI * 2); ctx.fill(); });
      drawCoin(ctx, cam, coin.p, normalOf(coin), { gold: coin.gold, glow: 0.7 });
    }
    if (coin && coin.phase === 'rest' && coin.spot === 'miss') drawCoin(ctx, cam, coin.p, { x: 0, y: 1, z: 0 }, { gold: coin.gold, alpha: 0.5 });
    // ── 手上的硬幣與瞄準 ──
    const cur = aim || motionAim;
    if (!coin || coin.phase === 'rest') {
      const pw = aim ? aim.power : 0;
      const hp = { x: START.x + (aim ? aim.yaw * 0.06 : 0), y: START.y - 0.04 * pw + 0.012 * Math.sin(t * 2.2), z: START.z + 0.1 * pw };
      const toEye = norm(sub(cam.E, hp));
      drawCoin(ctx, cam, hp, norm({ x: toEye.x * 0.6, y: 1, z: toEye.z * 0.6 }), { gold: isGold(), glow: 0.6 });
    }
    if (cur && (!coin || coin.phase === 'rest')) drawAim(cur);
  }

  function drawAim(a) {
    const tg = targetOf(a), v = launchFor(tg), { pts, land } = predict(v, 1 / 60);
    const zone = zoneOf(land);
    const col = zone === 'water' ? '255,214,120' : zone === 'rim' ? '255,170,90' : '240,120,110';
    // 只畫前四成的弧線 —— 方向與力道看得出來，剩下要靠自己的眼光
    const n = Math.max(2, Math.floor(pts.length * 0.42));
    for (let i = 2; i < n; i += 2) {
      const q = cam.proj(pts[i]);
      ctx.fillStyle = `rgba(${col},${0.85 * (1 - i / n)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.2, q.s * 0.012), 0, Math.PI * 2); ctx.fill();
    }
    const rr = 0.085 + 0.008 * Math.sin(t * 6);
    ctx.strokeStyle = `rgba(${col},.95)`; ctx.lineWidth = 1.6;
    ctx.stroke(pathOf(ring(cam, rr, 0, land.x, land.z, 36)));
    ctx.strokeStyle = `rgba(${col},.4)`; ctx.lineWidth = 1;
    ctx.stroke(pathOf(ring(cam, rr * 1.6, 0, land.x, land.z, 36)));
    const c = cam.proj(land);
    ctx.fillStyle = `rgba(${col},.95)`; ctx.beginPath(); ctx.arc(c.x, c.y, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  /* ── 手指：按住往上拉 ── */
  const aimOf = (e) => {
    const dx = e.clientX - aimFrom.x, dy = e.clientY - aimFrom.y;
    return { yaw: clamp(dx / (w * 0.5), -1, 1), power: clamp(-dy / (h * 0.62), 0, 1) };
  };
  const busy = () => !!coin && coin.phase !== 'rest';
  canvas.addEventListener('pointerdown', (e) => {
    if (busy() || (canThrow && !canThrow())) return;
    aimFrom = { x: e.clientX, y: e.clientY }; aim = { yaw: 0, power: 0 };
    canvas.setPointerCapture?.(e.pointerId);
    onAim?.(aim);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!aimFrom) return;
    aim = aimOf(e); onAim?.(aim);
  });
  const release = (e, cancel) => {
    if (!aimFrom) return;
    const a = cancel ? null : aimOf(e);
    aimFrom = null; aim = null; onAim?.(null);
    if (a && a.power > 0.03) launch(a);
  };
  canvas.addEventListener('pointerup', (e) => release(e, false));
  canvas.addEventListener('pointercancel', (e) => release(e, true));

  /* ── 手機：傾斜瞄準、往前一甩投出 ── */
  let stopMotion = () => {};
  function armMotion() {
    // iOS：兩種權限都要在點擊當下「同步」要
    const pm = askMotion();
    const DO = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;
    const po = DO && typeof DO.requestPermission === 'function' ? DO.requestPermission().then(r => r === 'granted').catch(() => false) : Promise.resolve(!!DO);
    return Promise.all([pm, po]).then(([okM, okO]) => {
      if (!okM || !okO) return false;
      stopMotion();
      let base = null, sm = null, hist = [], peak = 0, cool = 0;
      const ori = (e) => {
        if (e.beta == null || e.gamma == null) return;
        if (!base) base = { b: e.beta, g: e.gamma };
        const raw = { yaw: clamp((e.gamma - base.g) / 32, -1, 1), power: clamp(0.45 + (e.beta - base.b) / 50, 0, 1) };
        sm = sm ? { yaw: sm.yaw + (raw.yaw - sm.yaw) * 0.18, power: sm.power + (raw.power - sm.power) * 0.18 } : raw;
        motionAim = { ...sm };
        hist.push({ t: performance.now(), a: { ...sm } }); if (hist.length > 40) hist.shift();
        if (!aim) onAim?.(motionAim);
      };
      const mot = (e) => {
        const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null;
        if (!a) return;
        const m = Math.hypot(a.x, a.y, a.z || 0);
        const now = performance.now();
        if (now < cool) return;
        if (m > peak) peak = m;
        if (peak > 11 && m < peak * 0.4) {
          peak = 0; cool = now + 1500;
          // 用甩之前約 0.2 秒的瞄準：甩的動作會讓手機歪掉
          const old = hist.filter(x => x.t < now - 200).pop() || hist[0];
          if (old) launch(old.a);
        }
        if (m < 3) peak *= 0.9;
      };
      addEventListener('deviceorientation', ori);
      addEventListener('devicemotion', mot);
      stopMotion = () => { removeEventListener('deviceorientation', ori); removeEventListener('devicemotion', mot); motionAim = null; };
      return true;
    });
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { const ow = w; if ((host.clientWidth || 360) !== ow) size(); }) : null;
  ro?.observe(host);
  raf = requestAnimationFrame(frame);

  return {
    armMotion,
    busy,
    /** 測試與鍵盤用：直接照某個瞄準投出去 */
    throwAt: (a) => launch(a),
    destroy() { alive = false; cancelAnimationFrame(raf); ro?.disconnect(); stopMotion(); },
  };
}
