/* 3D 籤筒：畫面與操作（物理在 src/engines/tube.js）
   ──────────────────────────────────────────────────────────
   跟擲筊一樣用 Canvas 2D 自己投影。籤筒是一個開口的竹筒，裡面插著所有的籤。
   畫的順序分四層 —— 筒是空心的，單純依深度排序會把籤畫到筒壁外面：
     1. 筒的內壁（背對鏡頭的那半圈）、筒底、後半圈的口緣
     2. 筒裡的籤（由遠到近）
     3. 筒的外壁（面向鏡頭的那半圈）、前半圈的口緣、箍與「靈籤」字樣
     4. 已經出筒的那一支
   這樣籤在筒裡的那一截會被前面的筒壁擋住，只露出口外的部分。

   操作：
   ・手機（按「用手機搖」之後）：傾斜手機 → 筒跟著歪；搖手機 → 籤在筒裡跳，搖久了一支會被擠出來
   ・拖著筒身甩：左右來回就是搖，往自己這邊拉就是往前傾
   ・按住某一支籤往上拉：拉出筒口就是抽中它
   ・「搖出一支籤」：自動搖到有一支出來 */

import { createTube, shake, step, pull, release, shakeUntilOut, TUBE } from './engines/tube.js';
import { rot, qFromAxis, qmul } from './engines/jiao.js';
import { rattle, knock } from './rites/sound.js';
import { haptic } from './ui.js';
import { askMotion } from './rites/kit.js';
import { store } from './store.js';

const fastMode = () => document.documentElement.dataset.motion === 'off'
  || matchMedia('(prefers-reduced-motion: reduce)').matches;

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const L = norm({ x: -0.5, y: 0.9, z: 0.7 });
const BAMBOO = [204, 160, 98], BAMBOO_IN = [120, 84, 46], STICK = [232, 200, 140], TIP = [196, 40, 30], BAND = [150, 110, 40];

function shadeRGB(base, n, view, spec = 0.25) {
  const k = 0.28 + 0.8 * Math.max(0, dot(n, L));
  const H = norm(add(L, view));
  const s = spec * Math.pow(Math.max(0, dot(n, H)), 30);
  return `rgb(${base.map(v => Math.min(255, Math.round(v * k + 255 * s))).join(',')})`;
}

function camera(w, h) {
  const E = { x: 0, y: 5.9, z: 8.2 }, T = { x: 0, y: 2.7, z: 0 };
  const f = norm(sub(T, E)), r = norm(cross(f, { x: 0, y: 1, z: 0 })), u = cross(r, f);
  const F = w * 1.55;
  return {
    E,
    proj(p) { const d = sub(p, E), zc = dot(d, f); return { x: w / 2 + F * dot(d, r) / zc, y: h * 0.5 - F * dot(d, u) / zc, z: zc }; },
  };
}

/** 筒身的轉向：先往前後傾（繞 x），再左右歪（繞 z） */
const tubeQ = (st) => qmul(qFromAxis({ x: 0, y: 0, z: 1 }, -st.tilt.z), qFromAxis({ x: 1, y: 0, z: 0 }, st.tilt.x));

/** 一支籤的四角柱（本體＋紅頭），回傳要畫的面 */
function stickFaces(st, s, toW, q, view) {
  let d = norm(rot(q, rot(qmul(qFromAxis({ x: 0, y: 0, z: 1 }, -s.lz), qFromAxis({ x: 1, y: 0, z: 0 }, s.lx)), { x: 0, y: 1, z: 0 })));
  let base = toW({ x: s.bx, y: 0.12 + s.base + s.h, z: s.bz });
  // 抽出來之後：從筒口的位置，慢慢移到「拿在手上」—— 斜橫在筒前、籤頭朝右上
  if (s.present) {
    const k = s.present * s.present * (3 - 2 * s.present);
    const hd = norm({ x: 0.92, y: 0.36, z: 0.12 }), hb = { x: -1.55, y: 2.2, z: 1.9 };
    d = norm(add(mul(d, 1 - k), mul(hd, k)));
    base = add(mul(base, 1 - k), mul(hb, k));
  }
  const wv = norm(cross(d, { x: 0, y: 0, z: 1 })), nv = norm(cross(wv, d));
  const seg = (t0, t1, color) => {
    const A = add(base, mul(d, t0)), B = add(base, mul(d, t1));
    const c = (P, sw, sn) => add(add(P, mul(wv, 0.058 * sw)), mul(nv, 0.02 * sn));
    const P = [c(A, -1, -1), c(A, 1, -1), c(A, 1, 1), c(A, -1, 1), c(B, -1, -1), c(B, 1, -1), c(B, 1, 1), c(B, -1, 1)];
    return [[0, 1, 5, 4, mul(nv, -1)], [1, 2, 6, 5, wv], [2, 3, 7, 6, nv], [3, 0, 4, 7, mul(wv, -1)], [4, 5, 6, 7, d]]
      .map(([a, b, c2, e, n]) => ({ pts: [P[a], P[b], P[c2], P[e]], n, color }));
  };
  return { d, base, faces: [...seg(0, TUBE.STICK - 0.32, STICK), ...seg(TUBE.STICK - 0.32, TUBE.STICK, TIP)] };
}

function poly(ctx, cam, pts, fill) {
  const P = pts.map(cam.proj);
  ctx.fillStyle = fill; ctx.strokeStyle = fill;
  ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill(); ctx.stroke();
}

function draw(ctx, cam, w, h, st, t, label) {
  ctx.clearRect(0, 0, w, h);
  const q = tubeQ(st);
  const jx = Math.sin(t * 47) * st.jolt * 0.09, jz = Math.cos(t * 39) * st.jolt * 0.05;
  const toW = (p) => { const r = rot(q, p); return { x: r.x + jx, y: r.y, z: r.z + jz }; };
  const N = 28, R = TUBE.R, Ri = R - 0.07, H = TUBE.H;
  // 地上的影子
  const sc = cam.proj({ x: jx, y: 0, z: jz });
  const rg = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, w * 0.2);
  rg.addColorStop(0, 'rgba(0,0,0,.5)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(sc.x, sc.y, w * 0.2, w * 0.07, 0, 0, Math.PI * 2); ctx.fill();

  ctx.lineWidth = 0.8; ctx.lineJoin = 'round';
  const seg = (k) => { const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2; return { a0, a1, am }; };
  const P3 = (r, a, y) => ({ x: r * Math.cos(a), y, z: r * Math.sin(a) });
  const facing = (pLocal, nLocal) => { const p = toW(pLocal), n = norm(rot(q, nLocal)); return { n, view: norm(sub(cam.E, p)), f: dot(n, norm(sub(cam.E, p))) }; };

  // 1. 內壁（看得到的是背後那半圈的內面）＋筒底＋後半圈口緣
  poly(ctx, cam, Array.from({ length: N }, (_, k) => toW(P3(Ri, (k / N) * Math.PI * 2, 0.12))), 'rgb(58,40,24)');
  const back = [], front = [];
  for (let k = 0; k < N; k++) {
    const { a0, a1, am } = seg(k);
    const out = facing(P3(R, am, H / 2), { x: Math.cos(am), y: 0, z: Math.sin(am) });
    (out.f > 0 ? front : back).push(k);
  }
  for (const k of back) {
    const { a0, a1, am } = seg(k);
    const inn = facing(P3(Ri, am, H / 2), { x: -Math.cos(am), y: 0, z: -Math.sin(am) });
    poly(ctx, cam, [P3(Ri, a0, 0.12), P3(Ri, a1, 0.12), P3(Ri, a1, H), P3(Ri, a0, H)].map(toW), shadeRGB(BAMBOO_IN, inn.n, inn.view, 0.05));
    const top = facing(P3(R, am, H), { x: 0, y: 1, z: 0 });
    poly(ctx, cam, [P3(Ri, a0, H), P3(R, a0, H), P3(R, a1, H), P3(Ri, a1, H)].map(toW), shadeRGB(BAMBOO, top.n, top.view));
  }

  // 2. 筒裡的籤：由遠到近
  const inside = st.sticks.map((s, i) => ({ s, i })).filter(({ s }) => !s.out);
  const built = inside.map(({ s, i }) => ({ i, ...stickFaces(st, s, toW, q) }));
  built.sort((a, b) => cam.proj(b.base).z - cam.proj(a.base).z);
  const drawStick = (bs) => {
    for (const f of bs.faces) {
      const c = f.pts.reduce((m, p) => add(m, mul(p, 0.25)), { x: 0, y: 0, z: 0 });
      const view = norm(sub(cam.E, c));
      if (dot(f.n, view) <= 0) continue;
      poly(ctx, cam, f.pts, shadeRGB(f.color, f.n, view, 0.2));
    }
  };
  built.forEach(drawStick);

  // 3. 前半圈的外壁、口緣、兩道箍、正面的「靈籤」
  front.sort((a, b) => cam.proj(toW(P3(R, seg(b).am, H / 2))).z - cam.proj(toW(P3(R, seg(a).am, H / 2))).z);
  for (const k of front) {
    const { a0, a1, am } = seg(k);
    const out = facing(P3(R, am, H / 2), { x: Math.cos(am), y: 0, z: Math.sin(am) });
    poly(ctx, cam, [P3(R, a0, 0), P3(R, a1, 0), P3(R, a1, H), P3(R, a0, H)].map(toW), shadeRGB(BAMBOO, out.n, out.view, 0.35));
    for (const y of [0.35, H - 0.3]) {                                   // 箍
      poly(ctx, cam, [P3(R + 0.01, a0, y - 0.06), P3(R + 0.01, a1, y - 0.06), P3(R + 0.01, a1, y + 0.06), P3(R + 0.01, a0, y + 0.06)].map(toW), shadeRGB(BAND, out.n, out.view, 0.6));
    }
    const top = facing(P3(R, am, H), { x: 0, y: 1, z: 0 });
    poly(ctx, cam, [P3(Ri, a0, H), P3(R, a0, H), P3(R, a1, H), P3(Ri, a1, H)].map(toW), shadeRGB(BAMBOO, top.n, top.view));
  }
  // 正面貼一張紅紙「靈籤」（貼在面向鏡頭的那一面）
  const lab = cam.proj(toW(P3(R + 0.02, Math.PI / 2, H * 0.52)));
  const labTop = cam.proj(toW(P3(R + 0.02, Math.PI / 2, H * 0.78))), labBot = cam.proj(toW(P3(R + 0.02, Math.PI / 2, H * 0.26)));
  const lh = Math.abs(labBot.y - labTop.y);
  if (lh > 10) {
    ctx.fillStyle = 'rgba(176,36,28,.92)';
    ctx.fillRect(lab.x - lh * 0.17, labTop.y, lh * 0.34, lh);
    ctx.fillStyle = '#f3dfa8'; ctx.font = `700 ${Math.round(lh * 0.26)}px "Noto Serif TC", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('靈', lab.x, labTop.y + lh * 0.3); ctx.fillText('籤', lab.x, labTop.y + lh * 0.7);
  }

  // 4. 出筒的那一支（畫在最上面），尖端標籤號
  const outS = st.sticks.find(s => s.out);
  if (outS) {
    const bs = stickFaces(st, outS, toW, q);
    drawStick(bs);
    if (label && (outS.present || 0) > 0.8) {
      const tip = cam.proj(add(add(bs.base, mul(bs.d, TUBE.STICK * 0.5)), { x: 0, y: 0.55, z: 0 }));
      ctx.font = `700 ${Math.round(w * 0.05)}px "Noto Serif TC", serif`;
      const tw = ctx.measureText(label).width + 22;
      ctx.fillStyle = 'rgba(11,16,48,.85)'; ctx.strokeStyle = '#d9b25f'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect?.(tip.x - tw / 2, tip.y - 18, tw, 34, 17); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f3e4b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, tip.x, tip.y);
    }
  }
}

/**
 * @param {HTMLElement} host
 * @param {object} o {count 籤數, labelOf(poemIndex) 出筒時顯示的字, onPick(poemIndex)}
 */
export function mountTube3D(host, { count, labelOf = (i) => `第 ${i + 1} 首`, onPick } = {}) {
  host.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'tube3d__cv';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '籤筒：拖著甩可以搖，按住一支籤往上拉可以抽出來');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, cam = null;
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = host.clientWidth || 320; h = Math.round(w * 1.12);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam = camera(w, h);
  };
  size();
  const st = createTube(count);
  let raf = 0, last = performance.now(), t = 0, done = false, label = null;
  let tiltTarget = null;                  // 手機的傾斜（有的話筒跟著它）
  let dragTilt = null;                    // 拖曳時的傾斜
  let stopMotion = () => {};
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => size()) : null;
  ro?.observe(host);

  const doShake = (m) => {
    if (done) return;
    shake(st, m);
    rattle(); haptic(8 + Math.round(m * 8));
  };

  function picked(i) {
    if (done) return;
    done = true;
    const s = st.sticks[i];
    label = labelOf(s.poem);
    knock(320, .35); haptic([10, 40, 14]);
    // 出筒那支拿到手上：從筒口移到筒前、轉成斜橫，看得清楚號碼
    s.vh = 0; s.present = 0;
    const t0 = performance.now();
    const move = () => {
      s.present = Math.min(1, (performance.now() - t0) / 700);
      if (s.present < 1) requestAnimationFrame(move);
    };
    requestAnimationFrame(move);
    setTimeout(() => onPick?.(s.poem), fastMode() ? 10 : 1900);   // 停一下，讓人看清楚手上這支是第幾首
  }

  const loop = (now) => {
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now; t += dt;
    // 筒身傾斜：拖曳 > 手機 > 慢慢回正
    const target = dragTilt || tiltTarget || { x: 0, z: 0 };
    st.tilt.x += (target.x - st.tilt.x) * Math.min(1, dt * 10);
    st.tilt.z += (target.z - st.tilt.z) * Math.min(1, dt * 10);
    const sub2 = 4;
    for (let k = 0; k < sub2; k++) { const p = step(st, dt / sub2); if (p != null) picked(p); }
    draw(ctx, cam, w, h, st, t, label);
    raf = requestAnimationFrame(loop);
  };
  if (fastMode()) { draw(ctx, cam, w, h, st, 0, null); } else raf = requestAnimationFrame(loop);

  /* ── 指標：拉籤，或甩筒 ─────────────────────────── */
  const hitStick = (x, y) => {
    const q = tubeQ(st);
    const toW = (p) => rot(q, p);
    let best = null;
    st.sticks.forEach((s, i) => {
      if (s.out) return;
      const { base, d } = stickFaces(st, s, toW, q);
      const A = cam.proj(add(base, mul(d, TUBE.STICK))), B = cam.proj(add(base, mul(d, TUBE.STICK - 0.9)));
      // 點到「露出來的那一截」的距離
      const vx = B.x - A.x, vy = B.y - A.y, l2 = vx * vx + vy * vy || 1;
      const k = clamp(((x - A.x) * vx + (y - A.y) * vy) / l2, 0, 1);
      const dd = Math.hypot(x - (A.x + vx * k), y - (A.y + vy * k));
      if (dd < 16 && (!best || dd < best.dd - 2 || (Math.abs(dd - best.dd) <= 2 && A.z < best.z))) best = { i, dd, z: A.z, A, B };
    });
    return best;
  };

  let mode = null, sx = 0, sy = 0, h0 = 0, pxPerUnit = 1, axis = { x: 0, y: -1 }, lastDx = 0, lastDir = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (done) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    sx = e.clientX; sy = e.clientY; lastDx = 0; lastDir = 0;
    canvas.setPointerCapture?.(e.pointerId);
    const hit = hitStick(x, y);
    if (hit) {
      mode = { kind: 'pull', i: hit.i };
      const s = st.sticks[hit.i];
      h0 = s.base + s.h;
      const len = Math.hypot(hit.A.x - hit.B.x, hit.A.y - hit.B.y) / 0.9;
      pxPerUnit = len || 40;
      axis = { x: (hit.A.x - hit.B.x) / (len * 0.9 || 1), y: (hit.A.y - hit.B.y) / (len * 0.9 || 1) };
      haptic(6);
    } else mode = { kind: 'tilt' };
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!mode || done) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (mode.kind === 'pull') {
      const along = dx * axis.x + dy * axis.y;             // 沿著籤的方向拉了多少像素
      const got = pull(st, mode.i, h0 + Math.max(0, along) / pxPerUnit);
      if (got != null) { mode = null; picked(got); }
    } else {
      dragTilt = { x: clamp(dy * 0.006, -0.35, 0.6), z: clamp(dx * 0.007, -0.6, 0.6) };
      // 左右來回：方向一換、而且幅度夠，就算搖一下
      const dir = Math.sign(dx - lastDx);
      if (dir && dir !== lastDir && Math.abs(dx - lastDx) > 2) {
        if (lastDir && Math.abs(dx) > 16) doShake(clamp(Math.abs(dx) / 70, 0.5, 1.4));
        lastDir = dir;
      }
      lastDx = dx;
    }
  });
  const up = () => {
    if (mode?.kind === 'pull') release(st);
    if (mode?.kind === 'tilt' && Math.hypot(lastDx, 0) < 4) doShake(0.8);    // 點一下＝搖一下
    mode = null; dragTilt = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  /* ── 手機：傾斜跟著歪，搖晃就是搖 ─────────────────── */
  async function armMotion() {
    const okM = await askMotion();
    const O = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;
    const okO = O && typeof O.requestPermission === 'function'
      ? await O.requestPermission().then(r => r === 'granted').catch(() => false) : !!O;
    if (!okM && !okO) return false;
    let beta0 = null, prev = null, lastShake = 0;
    const th = { soft: 8, mid: 12, hard: 18 }[store.settings.omikujiShake || 'mid'] || 12;
    const onO = (e) => {
      if (e.beta == null) return;
      if (beta0 == null) beta0 = e.beta;
      tiltTarget = { x: clamp((e.beta - beta0) * Math.PI / 180 * 0.9, -0.4, 0.7), z: clamp((e.gamma || 0) * Math.PI / 180 * 0.9, -0.7, 0.7) };
    };
    const onM = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a || a.x == null) return;
      const v = [a.x, a.y, a.z || 0];
      if (prev) {
        const d = Math.hypot(v[0] - prev[0], v[1] - prev[1], v[2] - prev[2]);
        st.jolt = Math.min(1, st.jolt + d / 60);
        const now = Date.now();
        if (d > th && now - lastShake > 220) { lastShake = now; doShake(clamp(d / 20, 0.5, 1.5)); }
      }
      prev = v;
    };
    if (okO) addEventListener('deviceorientation', onO);
    if (okM) addEventListener('devicemotion', onM);
    stopMotion = () => { removeEventListener('deviceorientation', onO); removeEventListener('devicemotion', onM); };
    return true;
  }

  /** 自動搖到有一支出來 */
  async function autoShake() {
    if (done) return;
    if (fastMode()) { const i = shakeUntilOut(st); picked(i); return; }
    for (let k = 0; k < 60 && !done; k++) {
      dragTilt = { x: 0.35, z: (k % 2 ? 1 : -1) * 0.22 };
      doShake(1);
      await new Promise(r => setTimeout(r, 170));
    }
    dragTilt = null;
    if (!done) picked(shakeUntilOut(st));
  }

  return {
    armMotion, autoShake,
    destroy() { cancelAnimationFrame(raf); ro?.disconnect(); stopMotion(); },
    state: st,
  };
}
