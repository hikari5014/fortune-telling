/* 筊杯的簡易 3D 物理
   ──────────────────────────────────────────────────────────
   這支只算，不畫（畫在 src/jiao3d.js）。所以能在 Node 裡跑幾千次，
   檢查「平面朝上」的機率是不是接近一半 —— 物理模擬很容易不小心偏向某一面。

   形狀：從上面看是半月形（一邊直、一邊彎），一面平、一面隆起。
   本體座標：x 是長邊（-1…1），z 從直邊（0）往彎邊，y 是厚度（平面在 y=0，往 +y 隆起）。
   原點移到質心，所以「平面的法線」就是本體的 -y。

   物理：剛體（位置、速度、轉向四元數、角速度），重力，跟地面用頂點逐點碰撞：
   每個穿進地面的頂點算一次衝量（含反彈與摩擦），再把整體推回地面上。
   兩片之間用兩顆球近似（夠用 —— 它們很少真的疊在一起）。
   靜止判定：速度、角速度都很小，而且持續一小段時間。 */

/* ── 小小的向量／四元數工具 ───────────────────────────── */
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, s) => v3(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a) => Math.hypot(a.x, a.y, a.z);

export const qmul = (a, b) => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});
const qnorm = (q) => { const n = Math.hypot(q.w, q.x, q.y, q.z) || 1; return { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n }; };
/** 用四元數旋轉向量 */
export function rot(q, v) {
  const u = v3(q.x, q.y, q.z), s = q.w;
  const t = mul(cross(u, v), 2);
  return add(add(v, mul(t, s)), cross(u, t));
}
const conj = (q) => ({ w: q.w, x: -q.x, y: -q.y, z: -q.z });
export const qFromAxis = (ax, ang) => { const s = Math.sin(ang / 2), n = len(ax) || 1; return { w: Math.cos(ang / 2), x: ax.x / n * s, y: ax.y / n * s, z: ax.z / n * s }; };

/* ── 形狀 ─────────────────────────────────────────── */
/* 厚度 H 與反彈係數 e 是拿模擬調出來的（tests/jiao.test.js 會檢查）：
   隆起越高，「平面朝上」越容易（它會靠在弧背上停住）。H=0.34、e=0.5 時
   平面朝上約 55%，聖筊約五成、笑筊約三成、陰筊約兩成 —— 跟一般說的機率差不多，
   而且是真的「丟出來」的結果，不是先決定答案再演動畫。 */
export const SHAPE = { W: 0.72, H: 0.34, NU: 16, NV: 7 };

/**
 * 產生網格：頂面（隆起）與底面（平）共用邊界，所以是封閉的。
 * 回傳 { verts, top, bottom, com }，verts 已經減掉質心。
 */
export function buildMesh({ W, H, NU, NV } = SHAPE) {
  const raw = [];
  const idx = (i, j, side) => side * (NU + 1) * (NV + 1) + i * (NV + 1) + j;
  for (const side of [0, 1]) {               // 0 = 頂（隆起）、1 = 底（平）
    for (let i = 0; i <= NU; i++) {
      const x = -1 + 2 * i / NU;
      const zmax = W * Math.pow(Math.max(0, 1 - x * x), 0.55);
      for (let j = 0; j <= NV; j++) {
        const t = j / NV, z = zmax * t;
        // 隆起：兩端與邊緣為 0，中間最高；做成稍微偏向彎邊、像真的筊
        const y = side === 0 ? H * Math.pow(Math.max(0, 1 - x * x), 0.7) * Math.pow(Math.sin(Math.PI * t), 0.8) : 0;
        raw.push(v3(x, y, z));
      }
    }
  }
  // 質心（用體積近似：每一點的高度當權重）
  let cx = 0, cy = 0, cz = 0, m = 0;
  for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
    const p = raw[idx(i, j, 0)], w = p.y + 1e-6;
    cx += p.x * w; cy += p.y / 2 * w; cz += p.z * w; m += w;
  }
  const com = v3(cx / m, cy / m, cz / m);
  const verts = raw.map(p => sub(p, com));
  const top = [], bottom = [];
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = idx(i, j, 0), b = idx(i + 1, j, 0), c = idx(i + 1, j + 1, 0), d = idx(i, j + 1, 0);
    // 三角形的頂點順序決定法線朝哪：頂面要朝 +y、底面朝 -y，畫面才剔除得對
    top.push([a, c, b], [a, d, c]);
    const A = idx(i, j, 1), B = idx(i + 1, j, 1), C = idx(i + 1, j + 1, 1), D = idx(i, j + 1, 1);
    bottom.push([A, B, C], [A, C, D]);
  }
  return { verts, top, bottom, com };
}

/* ── 剛體 ─────────────────────────────────────────── */
const MASS = 1;
function inertiaInv({ W, H }) {
  // 近似成長 2、寬 W、厚 H 的實心方塊
  const L = 2;
  return v3(12 / (MASS * (H * H + W * W)), 12 / (MASS * (L * L + W * W)), 12 / (MASS * (L * L + H * H)));
}

export const WORLD = {
  g: -32,                       // 重力（單位/秒²；一單位約等於筊杯半長）
  e: 0.5,                       // 反彈係數
  mu: 0.45,                     // 摩擦
  bounds: { x: 3.1, zMin: -2.5, zMax: 2.5 },
  dt: 1 / 240,
};

export function makeBody(mesh, { p = v3(), q = { w: 1, x: 0, y: 0, z: 0 }, v = v3(), w = v3() } = {}) {
  // 碰撞只用一部分頂點：邊界一圈＋頂面中間一排，夠準又快
  const { NU, NV } = SHAPE;
  const pick = [];
  for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
    if (i === 0 || i === NU || j === 0 || j === NV || j === Math.round(NV / 2) || i % 4 === 0) pick.push(i * (NV + 1) + j);
  }
  return { p, q, v, w, mesh, hull: pick.map(k => mesh.verts[k]).concat(mesh.verts.slice((NU + 1) * (NV + 1)).filter((_, k) => k % 3 === 0)),
    Iinv: inertiaInv(SHAPE), rest: 0, settled: false };
}

/** 世界座標的 I⁻¹ 乘上向量 */
function applyIinv(b, vec) {
  const local = rot(conj(b.q), vec);
  return rot(b.q, v3(local.x * b.Iinv.x, local.y * b.Iinv.y, local.z * b.Iinv.z));
}

function stepBody(b, W, hit) {
  const { dt, g, e, mu, bounds } = W;
  if (b.settled) return;
  b.v.y += g * dt;
  b.p = add(b.p, mul(b.v, dt));
  // 轉向積分：q += 0.5 * ω * q * dt
  const wq = { w: 0, x: b.w.x, y: b.w.y, z: b.w.z };
  const dq = qmul(wq, b.q);
  b.q = qnorm({ w: b.q.w + dq.w * dt / 2, x: b.q.x + dq.x * dt / 2, y: b.q.y + dq.y * dt / 2, z: b.q.z + dq.z * dt / 2 });

  // 地面碰撞：逐點衝量
  let deepest = 0, touching = false;
  const n = v3(0, 1, 0);
  for (const r0 of b.hull) {
    const r = rot(b.q, r0);
    const y = b.p.y + r.y;
    if (y >= 0) continue;
    touching = true;
    deepest = Math.min(deepest, y);
    const vp = add(b.v, cross(b.w, r));
    const vn = dot(vp, n);
    if (vn >= 0) continue;
    const rn = cross(r, n);
    const kN = 1 / MASS + dot(n, cross(applyIinv(b, rn), r));
    // 慢慢碰到地面時不反彈 —— 不然靠在弧面上會一直微微彈跳，永遠停不下來
    const j = -(1 + (-vn > 1.2 ? e : 0)) * vn / kN;
    b.v = add(b.v, mul(n, j / MASS));
    b.w = add(b.w, applyIinv(b, mul(rn, j)));
    if (-vn > 2.5) hit?.(-vn);
    // 摩擦
    const vp2 = add(b.v, cross(b.w, r));
    const vt = sub(vp2, mul(n, dot(vp2, n)));
    const vtl = len(vt);
    if (vtl > 1e-6) {
      const t = mul(vt, -1 / vtl);
      const rt = cross(r, t);
      const kT = 1 / MASS + dot(t, cross(applyIinv(b, rt), r));
      const jt = Math.max(-mu * j, Math.min(mu * j, vtl / kT));
      b.v = add(b.v, mul(t, jt / MASS));
      b.w = add(b.w, applyIinv(b, mul(rt, jt)));
    }
  }
  if (deepest < 0) b.p.y -= deepest;           // 推回地面上
  if (touching) {                               // 滾動阻力：不然會在弧面上搖很久
    b.w = mul(b.w, 0.992);
    b.v = v3(b.v.x * 0.996, b.v.y, b.v.z * 0.996);
  }
  // 四面的牆（看不見的圍欄）
  if (Math.abs(b.p.x) > bounds.x) { b.p.x = Math.sign(b.p.x) * bounds.x; b.v.x *= -0.5; }
  if (b.p.z < bounds.zMin) { b.p.z = bounds.zMin; b.v.z *= -0.5; }
  if (b.p.z > bounds.zMax) { b.p.z = bounds.zMax; b.v.z *= -0.5; }

  // 靜止判定
  const calm = touching && len(b.v) < 0.12 && len(b.w) < 0.25;
  b.rest = calm ? b.rest + dt : 0;
  if (b.rest > 0.35) { b.settled = true; b.v = v3(); b.w = v3(); }
}

/** 兩片之間：用兩顆球近似 */
function collidePair(a, b, W) {
  const d = sub(b.p, a.p), dist = len(d), R = 1.5;
  if (dist >= R || dist < 1e-6) return;
  const n = mul(d, 1 / dist);
  const push = (R - dist) / 2;
  a.p = sub(a.p, mul(n, push)); b.p = add(b.p, mul(n, push));
  const rel = dot(sub(b.v, a.v), n);
  if (rel < 0) {
    const j = -(1 + W.e) * rel / 2;
    a.v = sub(a.v, mul(n, j)); b.v = add(b.v, mul(n, j));
    a.settled = b.settled = false;
  }
}

/** 本體的「隆起方向」（+y）在世界裡朝哪裡 */
export const domeUp = (b) => rot(b.q, v3(0, 1, 0)).y;

/**
 * 結果：凸面朝上（隆起朝上）＝「凸」；平面朝上（隆起朝下）＝「平」。
 * 立起來（側面著地）時回 null，由呼叫端輕推一下讓它倒。
 */
export function faceOf(b) {
  const u = domeUp(b);
  if (Math.abs(u) < 0.3) return null;
  return u > 0 ? '凸' : '平';
}

/**
 * 建立一場擲筊：兩片從「手的位置」拋出去。
 * @param {number} power 0.4–1.4，手機往上拋的力道或滑動的速度
 * @param {function} rand 亂數（測試時可以固定）
 */
export function throwScene({ power = 1, rand = Math.random } = {}) {
  const mesh = buildMesh();
  const rnd = (a, b) => a + (b - a) * rand();
  const bodies = [-0.9, 0.9].map(x0 => {
    // 起始轉向完全隨機：先隨機一軸轉隨機角度
    const ax = v3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1));
    const q = qFromAxis(len(ax) > 0.01 ? ax : v3(1, 0, 0), rnd(0, Math.PI * 2));
    return makeBody(mesh, {
      p: v3(x0 + rnd(-0.2, 0.2), rnd(1.0, 1.6), 2.0),
      q,
      v: v3(rnd(-1.0, 1.0) - x0 * 0.4, rnd(7, 10) * power, rnd(-5, -3) * power),
      w: v3(rnd(-18, 18) * power, rnd(-8, 8), rnd(-14, 14) * power),
    });
  });
  return { mesh, bodies, t: 0 };
}

/**
 * 往前推進 dtTotal 秒（內部用固定小步長）。
 * @param {function} onHit (速度) 每次撞地夠用力時呼叫 —— 給音效與震動
 */
export function advance(scene, dtTotal, onHit) {
  const W = WORLD;
  const steps = Math.max(1, Math.round(dtTotal / W.dt));
  for (let s = 0; s < steps; s++) {
    scene.t += W.dt;
    for (const b of scene.bodies) stepBody(b, W, onHit);
    collidePair(scene.bodies[0], scene.bodies[1], W);
    // 立起來的那片輕推一下，讓它倒向一邊
    for (const b of scene.bodies) {
      if (b.settled && faceOf(b) === null) {
        b.settled = false; b.rest = 0;
        b.w = add(b.w, v3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
      }
    }
    // 保險：太久沒停就硬停（七秒）
    if (scene.t > 7) for (const b of scene.bodies) if (!b.settled) { b.settled = true; b.v = v3(); b.w = v3(); }
  }
  return scene.bodies.every(b => b.settled);
}

/** 整場跑完，回傳兩片的結果（測試用，也給「減少動態」時直接出結果） */
export function simulate(opts = {}) {
  const sc = throwScene(opts);
  let guard = 0;
  while (!advance(sc, 1 / 30) && guard++ < 400) { /* 跑到停 */ }
  return { faces: sc.bodies.map(b => faceOf(b) || (domeUp(b) > 0 ? '凸' : '平')), scene: sc };
}
