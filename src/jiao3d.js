/* 擲筊的 3D 畫面與操作
   ──────────────────────────────────────────────────────────
   物理在 src/engines/jiao.js；這支負責「畫」與「怎麼丟」。

   畫法：不用 WebGL，Canvas 2D 自己做透視投影 ——
   每片筊杯四百多個三角形，背面剔除、依深度由遠到近畫（畫家演算法），
   平面著色（蘭伯特）＋漆面的高光。兩片加起來不到一千個三角形，手機也跑得動。
   地上畫一個柔和的影子，離地越高越淡、越大 —— 看得出「飛起來」。

   怎麼丟：
   ・點「擲筊」：一般力道
   ・在畫面上往上一甩：甩越快丟越高
   ・手機：雙手捧著，輕輕往上一拋（手機不離手）—— 偵測往上的加速度尖峰，力道跟著它 */

import { throwScene, advance, buildMesh, makeBody, faceOf, domeUp, qFromAxis, qmul, rot, simulate, SHAPE } from './engines/jiao.js';
import { knock } from './rites/sound.js';
import { haptic } from './ui.js';
import { askMotion } from './rites/kit.js';

const fastMode = () => document.documentElement.dataset.motion === 'off'
  || matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── 相機 ─────────────────────────────────────────── */
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

function camera(w, h) {
  const E = { x: 0, y: 6.4, z: 5.9 }, T = { x: 0, y: 0, z: 0.25 };
  const f = norm(sub(T, E)), r = norm(cross(f, { x: 0, y: 1, z: 0 })), u = cross(r, f);
  const F = w * 1.12;
  return {
    E,
    proj(p) {
      const d = sub(p, E);
      const zc = dot(d, f);
      return { x: w / 2 + F * dot(d, r) / zc, y: h * 0.46 - F * dot(d, u) / zc, z: zc };
    },
  };
}

const L = norm({ x: -0.45, y: 1, z: 0.55 });               // 光從左上方來

/* 隆起面是亮紅漆；平面是原木色 —— 兩面一眼分得出來，結果才看得懂 */
const DOME = [200, 36, 28], FLAT = [214, 162, 108];

function shade(base, n, viewDir, spec) {
  const k = 0.2 + 0.85 * Math.max(0, dot(n, L));
  const H = norm({ x: L.x + viewDir.x, y: L.y + viewDir.y, z: L.z + viewDir.z });
  const s = spec * Math.pow(Math.max(0, dot(n, H)), 36);
  const c = base.map(v => Math.min(255, Math.round(v * k + 255 * s)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ── 畫一格 ───────────────────────────────────────── */
function draw(ctx, cam, w, h, bodies, labels = null) {
  ctx.clearRect(0, 0, w, h);
  // 地板：深色的木地板，遠處淡進夜色
  const corners = [{ x: -7, y: 0, z: -5 }, { x: 7, y: 0, z: -5 }, { x: 7, y: 0, z: 4.5 }, { x: -7, y: 0, z: 4.5 }].map(cam.proj);
  const g = ctx.createLinearGradient(0, corners[0].y, 0, h);
  g.addColorStop(0, 'rgba(60,40,26,0)'); g.addColorStop(.25, 'rgba(70,46,30,.85)'); g.addColorStop(1, 'rgba(96,64,40,1)');
  ctx.fillStyle = g;
  ctx.beginPath(); corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(30,18,10,.35)'; ctx.lineWidth = 1;
  for (let z = -5; z <= 4.5; z += 0.9) {                     // 木板的縫
    const a = cam.proj({ x: -7, y: 0, z }), b = cam.proj({ x: 7, y: 0, z });
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // 影子
  for (const b of bodies) {
    const c = cam.proj({ x: b.p.x, y: 0, z: b.p.z });
    const hgt = Math.max(0, b.p.y);
    const s = (1 + hgt * 0.18) * w * 0.065;
    const a = 0.5 * Math.max(0, 1 - hgt / 5);
    const rg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, s);
    rg.addColorStop(0, `rgba(0,0,0,${a})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, s, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 三角形：收集兩片的所有面，背面剔除，由遠到近
  const tris = [];
  for (const b of bodies) {
    const W = b.mesh.verts.map(v => { const r = rot(b.q, v); return { x: r.x + b.p.x, y: r.y + b.p.y, z: r.z + b.p.z }; });
    const P = W.map(cam.proj);
    for (const [list, base, spec] of [[b.mesh.top, DOME, 0.55], [b.mesh.bottom, FLAT, 0.12]]) {
      for (const [i, j, k] of list) {
        const A = W[i], B = W[j], C = W[k];
        const n = norm(cross(sub(B, A), sub(C, A)));
        const cen = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3, z: (A.z + B.z + C.z) / 3 };
        const view = norm(sub(cam.E, cen));
        if (dot(n, view) <= 0) continue;
        tris.push({ z: (P[i].z + P[j].z + P[k].z) / 3, a: P[i], b: P[j], c: P[k], fill: shade(base, n, view, spec) });
      }
    }
  }
  tris.sort((p, q) => q.z - p.z);
  ctx.lineJoin = 'round'; ctx.lineWidth = 0.7;
  for (const t of tris) {
    ctx.fillStyle = t.fill; ctx.strokeStyle = t.fill;
    ctx.beginPath(); ctx.moveTo(t.a.x, t.a.y); ctx.lineTo(t.b.x, t.b.y); ctx.lineTo(t.c.x, t.c.y); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  // 外緣描一圈深色的邊：漆與木頭的交界，形狀才讀得出來
  const { NU, NV } = SHAPE;
  for (const b of bodies) {
    const loop = [];
    for (let i = 0; i <= NU; i++) loop.push(i * (NV + 1));                 // 直邊
    for (let i = NU; i >= 0; i--) loop.push(i * (NV + 1) + NV);            // 彎邊
    ctx.strokeStyle = 'rgba(60,10,6,.75)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    loop.forEach((k, n) => { const r = rot(b.q, b.mesh.verts[k]); const P = cam.proj({ x: r.x + b.p.x, y: r.y + b.p.y, z: r.z + b.p.z }); n ? ctx.lineTo(P.x, P.y) : ctx.moveTo(P.x, P.y); });
    ctx.closePath(); ctx.stroke();
  }
  // 落定之後在每一片上方標「平」「凸」
  if (labels) bodies.forEach((b, i) => {
    const P = cam.proj({ x: b.p.x, y: b.p.y + 0.9, z: b.p.z });
    ctx.font = `700 ${Math.round(w * 0.05)}px "Noto Serif TC", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(11,16,48,.75)';
    ctx.beginPath(); ctx.arc(P.x, P.y, w * 0.042, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d9b25f'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#f3e4b8'; ctx.fillText(labels[i], P.x, P.y + 1);
  });
}

/* 還沒丟之前：兩片併排放在前面（凸面朝上，像捧在手裡） */
function restingPose() {
  const mesh = buildMesh();
  const lift = -Math.min(...mesh.verts.map(v => v.y));   // 平面貼地時質心的高度
  return [-0.95, 0.95].map((x, i) => makeBody(mesh, {
    p: { x, y: lift, z: 1.6 },
    q: qmul(qFromAxis({ x: 0, y: 1, z: 0 }, i ? Math.PI + 0.25 : -0.25), { w: 1, x: 0, y: 0, z: 0 }),
  }));
}

/**
 * 掛到 host 上。
 * @param {object} o {onResult(faces), onThrow(), canThrow() 現在能不能丟（例如正在等重新搖籤）}
 * @returns {{ toss(power):void, armMotion():Promise<boolean>, busy():boolean, destroy():void }}
 */
export function mountJiao3D(host, { onResult, onThrow, canThrow } = {}) {
  host.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'jiao3d__cv';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '擲筊的地方：在這裡往上甩就能擲筊');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, cam = null;
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = host.clientWidth || 320; h = Math.round(w * 0.72);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam = camera(w, h);
  };
  size();
  let bodies = restingPose();
  let scene = null, raf = 0, last = 0, flying = false, lastHit = 0, stopMotion = () => {};
  let labels = null;
  const paint = () => draw(ctx, cam, w, h, bodies, labels);
  paint();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { size(); paint(); }) : null;
  ro?.observe(host);

  const hit = (speed) => {
    const now = performance.now();
    if (now - lastHit < 70) return;
    lastHit = now;
    knock(260 + Math.random() * 120, Math.min(0.55, speed / 16));
    if (speed > 5) haptic(Math.min(24, Math.round(speed)));
  };

  function finish() {
    flying = false;
    const faces = bodies.map(b => faceOf(b) || (domeUp(b) > 0 ? '凸' : '平'));
    labels = faces; paint();
    onResult?.(faces);
  }

  function toss(power = 1) {
    if (flying || (canThrow && !canThrow())) return;
    flying = true;
    labels = null;
    onThrow?.();
    power = Math.max(0.45, Math.min(1.4, power));
    if (fastMode()) {                               // 減少動態：直接算完、畫最後一格
      const r = simulate({ power });
      bodies = r.scene.bodies; paint(); finish(); return;
    }
    scene = throwScene({ power });
    bodies = scene.bodies;
    last = performance.now();
    const loop = (t) => {
      const dt = Math.min(1 / 30, (t - last) / 1000); last = t;
      const done = advance(scene, dt, hit);
      paint();
      if (done) { finish(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  // 在畫面上往上甩
  let start = null, trail = [];
  canvas.addEventListener('pointerdown', (e) => {
    if (flying) return;
    start = { x: e.clientX, y: e.clientY }; trail = [{ y: e.clientY, t: performance.now() }];
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!start) return;
    trail.push({ y: e.clientY, t: performance.now() }); if (trail.length > 6) trail.shift();
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!start) return;
    const a = trail[0], b = { y: e.clientY, t: performance.now() };
    const vy = (b.y - a.y) / Math.max(1, b.t - a.t);       // px/ms，往上為負
    const dy = e.clientY - start.y;
    start = null;
    if (dy < -30 || vy < -0.4) toss(0.55 + Math.min(0.85, -vy * 0.45));
  });
  canvas.addEventListener('pointercancel', () => { start = null; });

  /* 手機：捧著往上一拋。用「去掉重力的加速度」看尖峰；
     沒有的話用「含重力」的值減掉一路平均出來的重力。 */
  async function armMotion() {
    const ok = await askMotion();                  // 必須在點擊當下呼叫（呼叫端負責）
    if (!ok) return false;
    let gx = 0, gy = 0, gz = 0, peak = 0, armed = true;
    const h2 = (e) => {
      if (flying || !armed) return;
      let ax, ay, az;
      if (e.acceleration && e.acceleration.x != null) ({ x: ax, y: ay, z: az } = e.acceleration);
      else {
        const a = e.accelerationIncludingGravity; if (!a) return;
        gx = gx * 0.9 + a.x * 0.1; gy = gy * 0.9 + a.y * 0.1; gz = gz * 0.9 + (a.z || 0) * 0.1;
        ax = a.x - gx; ay = a.y - gy; az = (a.z || 0) - gz;
      }
      const m = Math.hypot(ax, ay, az || 0);
      if (m > peak) peak = m;
      // 往上拋：加速度先衝高再掉下來 —— 掉下來的那一刻放手
      if (peak > 13 && m < peak * 0.35) {
        const power = 0.6 + Math.min(0.8, (peak - 13) / 22);
        peak = 0; armed = false;
        toss(power);
        setTimeout(() => { armed = true; }, 1500);
      }
      if (m < 3) peak = Math.max(0, peak * 0.9);
    };
    addEventListener('devicemotion', h2);
    stopMotion = () => removeEventListener('devicemotion', h2);
    return true;
  }

  return {
    toss,
    armMotion,
    busy: () => flying,
    destroy() { cancelAnimationFrame(raf); ro?.disconnect(); stopMotion(); },
  };
}

export { SHAPE };
