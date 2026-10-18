/* 許願池的物理（只算，不畫；畫在 src/pool3d.js）
   ──────────────────────────────────────────────────────────
   單位是公尺，y 朝上，水面在 y = 0，池子中心在原點。

     ・圓形石池：水面半徑 R，外面一圈石緣（寬 RIM_W、比水面高 RIM_H），池底在 -DEPTH
     ・正中央一塊石島，島邊坐著四隻動物，每隻都帶著一個「容器」：
         金蟾（張口的青蛙）── 嘴巴　財運
         靈龜（背著碗）　　── 碗　　長壽平安
         錦鯉（躍出水面）　── 嘴巴　學業事業（鯉躍龍門）
         玉兔（抱著搗藥臼）── 臼　　團圓姻緣
       硬幣投進容器，願望就一定會實現。
     ・丟的人可以繞著池子走（angle），從任何一邊丟

   操作的手感靠「同一套算式」：空中沒有風、沒有亂數 —— 同樣的出手，一定落在同一個地方。
   碰到石緣、石島、動物的身體才會彈開，那是物理，不是運氣。
   落水之後：撞水面會掉很多速度，然後左右飄著往下沉，最後平躺在池底。 */

export const POOL = {
  R: 1.15,         // 水面（內壁）半徑
  RIM_W: 0.24,     // 石緣寬
  RIM_H: 0.16,     // 石緣頂比水面高多少
  GROUND: -0.06,   // 池外地面
  DEPTH: 0.34,     // 水深
  ISLE_R: 0.34,    // 中央石島半徑
  ISLE_H: 0.08,    // 石島頂比水面高多少
  CR: 0.045,       // 硬幣半徑
  G: 7,            // 重力（比地球小一點，弧線看得清楚）
};

/* 四隻動物。φ 是牠面朝的方向（0 = 朝 +z，也就是一開始站的那一邊）。
   位置用「往外多遠 out、離水面多高 h」描述，換算成世界座標見 animalWorld()。
   catch：容器的口（中心、半徑、口朝哪裡 —— tilt 是口往外傾的角度）
   body：身體的碰撞球（打到會彈開） */
export const ANIMALS = [
  { k: 'frog', t: '金蟾', d: '張口的青蛙', wish: '財運亨通', phi: 0,
    catch: { out: 0.47, h: 0.19, r: 0.105, tilt: 40 },
    body: [{ out: 0.37, h: 0.1, r: 0.12 }, { out: 0.42, h: 0.2, r: 0.07 }] },
  { k: 'rabbit', t: '玉兔', d: '抱著搗藥臼的月兔', wish: '團圓姻緣', phi: Math.PI / 2,
    catch: { out: 0.52, h: 0.16, r: 0.1, tilt: 0 },
    body: [{ out: 0.31, h: 0.13, r: 0.11 }, { out: 0.31, h: 0.3, r: 0.075 }, { out: 0.52, h: 0.08, r: 0.075 }] },
  { k: 'turtle', t: '靈龜', d: '背著碗的烏龜', wish: '長壽平安', phi: Math.PI,
    catch: { out: 0.33, h: 0.3, r: 0.1, tilt: 0 },
    body: [{ out: 0.33, h: 0.12, r: 0.15 }, { out: 0.5, h: 0.12, r: 0.06 }, { out: 0.33, h: 0.24, r: 0.06 }] },
  { k: 'koi', t: '錦鯉', d: '躍出水面的錦鯉', wish: '學業事業', phi: Math.PI * 1.5,
    catch: { out: 0.38, h: 0.44, r: 0.09, tilt: 12 },
    body: [{ out: 0.38, h: 0.12, r: 0.08 }, { out: 0.38, h: 0.24, r: 0.075 }, { out: 0.38, h: 0.35, r: 0.06 }] },
];
export const animalOf = (k) => ANIMALS.find(a => a.k === k) || null;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const deg = Math.PI / 180;

/** 動物身上某一點（往外 out、高 h）的世界座標 */
export function animalWorld(a, out, h) {
  return { x: out * Math.sin(a.phi), y: h, z: out * Math.cos(a.phi) };
}
/** 容器口：中心、半徑、口的朝向（單位向量） */
export function catchOf(a) {
  const c = animalWorld(a, a.catch.out, a.catch.h);
  const t = a.catch.tilt * deg;
  const n = { x: Math.sin(t) * Math.sin(a.phi), y: Math.cos(t), z: Math.sin(t) * Math.cos(a.phi) };
  return { c, r: a.catch.r, n };
}

/* ── 丟的人站在哪裡 ─────────────────────────────────── */
export const HAND = { r: 1.75, y: 0.32 };            // 手離池中心多遠、多高
/** 站在 angle（弧度，0 = +z 那一側）時，手的位置與面朝的方向（朝池中心） */
export function standAt(angle = 0) {
  const s = Math.sin(angle), c = Math.cos(angle);
  return { from: { x: HAND.r * s, y: HAND.y, z: HAND.r * c }, fwd: { x: -s, y: 0, z: -c } };
}
/** 預設站位（測試與舊程式用） */
export const START = standAt(0).from;

const ANGLE = 55 * deg;     // 固定的出手仰角：高高的拋物線，比較好看也比較好控制
export const DIST = { min: 0.25, max: 3.6 };
export const YAW_MAX = 0.62;          // 左右最多偏多少（弧度）

/** 瞄準 → 落在水面高度的那一點。aim = { yaw: -1..1, power: 0..1 }；from 出手位置、fwd 面朝方向 */
export function targetOf({ yaw = 0, power = 0.5 }, from = START, fwd = standAt(0).fwd) {
  const a = clamp(yaw, -1, 1) * YAW_MAX;
  const d = DIST.min + clamp(power, 0, 1) * (DIST.max - DIST.min);
  const right = { x: -fwd.z, z: fwd.x };
  const dx = fwd.x * Math.cos(a) + right.x * Math.sin(a), dz = fwd.z * Math.cos(a) + right.z * Math.sin(a);
  return { x: from.x + d * dx, y: 0, z: from.z + d * dz, d };
}

/** 要剛好落在 target（水面高度）需要的出手速度 —— 拋物線公式解出來，不是試誤 */
export function launchFor(target, from = START) {
  const dx = target.x - from.x, dz = target.z - from.z;
  const d = Math.hypot(dx, dz) || 1e-6, h0 = Math.max(0.02, from.y - (target.y || 0));
  const c = Math.cos(ANGLE), t = Math.tan(ANGLE);
  const v = Math.sqrt(POOL.G * d * d / (2 * c * c * (h0 + d * t)));
  const vh = v * c;
  return { x: vh * dx / d, y: v * Math.sin(ANGLE), z: vh * dz / d };
}

/** 空中的那一步（預覽與實際飛行共用，所以畫出來的落點跟真的一樣） */
function airStep(p, v, dt) {
  v.y -= POOL.G * dt;
  p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
}

/** 預覽：從出手到落到水面高度的弧線（不含碰撞）。回傳點列與落點 */
export function predict(v0, dt = 1 / 120, from = START) {
  const p = { ...from }, v = { ...v0 }, pts = [{ ...p }];
  for (let i = 0; i < 2000; i++) {
    const py = p.y;
    airStep(p, v, dt);
    if (p.y <= 0 && py > 0) {
      const k = py / (py - p.y);
      const land = { x: p.x - v.x * dt * (1 - k), y: 0, z: p.z - v.z * dt * (1 - k) };
      pts.push(land);
      return { pts, land };
    }
    pts.push({ ...p });
  }
  return { pts, land: { ...p } };
}

/**
 * 寶可夢 GO 式的「甩」：手指放開前那一小段的速度（每秒幾個螢幕高）換成瞄準。
 *   vy：往上為負；vx：往右為正；h：畫面高（px）
 * 太慢、或往下甩 → null（硬幣回到手上）。同樣的甩法一定得到同樣的落點。
 */
export const FLICK = { min: 0.9, max: 4.2, maxAngle: 0.5 };
export function flickAim(vx, vy, h) {
  const up = -vy / h;
  if (up < FLICK.min) return null;
  return {
    power: clamp((up - FLICK.min) / (FLICK.max - FLICK.min), 0, 1),
    yaw: clamp(Math.atan2(vx, -vy) / FLICK.maxAngle, -1, 1),
  };
}

/** 落點在哪一區（給瞄準圈上色用） */
export function zoneOf({ x, z }) {
  const r = Math.hypot(x, z);
  if (r < POOL.ISLE_R) return 'isle';
  if (r < POOL.R - POOL.CR) return 'water';
  if (r < POOL.R + POOL.RIM_W) return 'rim';
  return 'out';
}

/* ── 一枚硬幣 ───────────────────────────────────────── */
export function createCoin(v0, { spin = 17 } = {}, from = START) {
  const sp = Math.hypot(v0.x, v0.z) || 1;
  return {
    p: { ...from }, v: { ...v0 },
    phase: 'air',              // air → sink → rest（spot: pool | animal | miss）
    axis: { x: -v0.z / sp, y: 0, z: v0.x / sp },
    phi: 0, spin,
    tilt: 0, yaw: Math.atan2(v0.x, -v0.z),
    t: 0, sinkT: 0, bounces: 0, hits: 0,
  };
}

const BODIES = ANIMALS.flatMap(a => a.body.map(b => ({ c: animalWorld(a, b.out, b.h), r: b.r, k: a.k })));
const CATCHES = ANIMALS.map(a => ({ a, ...catchOf(a) }));

/** 撞到球形的身體：推出來、沿法線反彈 */
function bounceSphere(c, s, out) {
  const dx = c.p.x - s.c.x, dy = c.p.y - s.c.y, dz = c.p.z - s.c.z;
  const d = Math.hypot(dx, dy, dz), lim = s.r + POOL.CR;
  if (d >= lim || d < 1e-6) return false;
  const n = { x: dx / d, y: dy / d, z: dz / d };
  c.p.x = s.c.x + n.x * lim; c.p.y = s.c.y + n.y * lim; c.p.z = s.c.z + n.z * lim;
  const vn = c.v.x * n.x + c.v.y * n.y + c.v.z * n.z;
  if (vn < 0) {
    const speed = Math.hypot(c.v.x, c.v.y, c.v.z);
    c.v.x -= 1.4 * vn * n.x; c.v.y -= 1.4 * vn * n.y; c.v.z -= 1.4 * vn * n.z;
    c.v.x *= 0.75; c.v.y *= 0.75; c.v.z *= 0.75;
    c.spin *= -0.6; c.hits++;
    out.push({ type: 'clink', speed, k: s.k });
  }
  return true;
}

/**
 * 往前推進 dt 秒。發生的事件放進 out：
 *   { type: 'clink', speed }   撞到石頭或動物
 *   { type: 'splash', speed }  落水
 *   { type: 'catch', k }       投進某隻動物的容器
 *   { type: 'ground' }         掉到池外的地上
 *   { type: 'rest', spot, k }  停下來了：spot = 'pool' | 'animal' | 'miss'
 */
export function stepCoin(c, dt, out = []) {
  const P = POOL;
  c.t += dt;
  if (c.phase === 'rest') return out;

  if (c.phase === 'air') {
    const prev = { ...c.p };
    airStep(c.p, c.v, dt);
    c.phi += c.spin * dt;
    const r = Math.hypot(c.p.x, c.p.z), r0 = Math.hypot(prev.x, prev.z);
    const radial = r > 1e-6 ? { x: c.p.x / r, z: c.p.z / r } : { x: 0, z: 1 };
    const speed = Math.hypot(c.v.x, c.v.y, c.v.z);

    // 容器：硬幣進到口附近、而且是「往裡面」飛 —— 接住
    for (const q of CATCHES) {
      const dx = c.p.x - q.c.x, dy = c.p.y - q.c.y, dz = c.p.z - q.c.z;
      if (Math.hypot(dx, dy, dz) < q.r && c.v.x * q.n.x + c.v.y * q.n.y + c.v.z * q.n.z < 0) {
        c.p = { x: q.c.x - q.n.x * 0.03, y: q.c.y - q.n.y * 0.03, z: q.c.z - q.n.z * 0.03 };
        c.v = { x: 0, y: 0, z: 0 }; c.phase = 'rest'; c.spot = 'animal'; c.k = q.a.k; c.tilt = 0.15;
        out.push({ type: 'catch', k: q.a.k }, { type: 'rest', spot: 'animal', k: q.a.k });
        return out;
      }
    }
    // 動物的身體
    if (r < 0.75 && c.p.y < 0.6) for (const s of BODIES) bounceSphere(c, s, out);
    // 石島：從上面落下來
    if (prev.y >= P.ISLE_H && c.p.y < P.ISLE_H && r < P.ISLE_R) {
      c.p.y = P.ISLE_H; c.bounces++; c.hits++;
      out.push({ type: 'clink', speed });
      if (Math.abs(c.v.y) > 0.7 && c.bounces < 4) { c.v.y = Math.abs(c.v.y) * 0.35; c.v.x *= 0.6; c.v.z *= 0.6; }
      else c.v = { x: radial.x * 0.6, y: 0.4, z: radial.z * 0.6 };   // 滑下石島
      return out;
    }
    // 石島側面（低低地撞上）
    if (c.p.y < P.ISLE_H && c.p.y > -P.DEPTH && r < P.ISLE_R + P.CR && r0 >= P.ISLE_R + P.CR) {
      c.p.x = radial.x * (P.ISLE_R + P.CR); c.p.z = radial.z * (P.ISLE_R + P.CR);
      const vr = c.v.x * radial.x + c.v.z * radial.z;
      if (vr < 0) { c.v.x -= 1.45 * vr * radial.x; c.v.z -= 1.45 * vr * radial.z; }
      c.hits++; out.push({ type: 'clink', speed });
    }
    // 石緣頂：從上面落下來
    if (prev.y >= P.RIM_H && c.p.y < P.RIM_H && r >= P.R && r <= P.R + P.RIM_W) {
      c.p.y = P.RIM_H;
      c.bounces++; c.hits++;
      out.push({ type: 'clink', speed });
      if (Math.abs(c.v.y) > 0.7 && c.bounces < 4) {
        c.v.y = Math.abs(c.v.y) * 0.38; c.v.x *= 0.55; c.v.z *= 0.55; c.spin *= 0.6;
      } else {
        const inward = r < P.R + P.RIM_W * 0.5 ? -1 : 1;
        c.v = { x: radial.x * 0.55 * inward, y: 0.5, z: radial.z * 0.55 * inward };
        c.spin = 6 * inward;
      }
      return out;
    }
    // 石緣的外牆與內壁
    if (c.p.y < P.RIM_H && c.p.y > P.GROUND && r0 > P.R + P.RIM_W && r <= P.R + P.RIM_W) {
      c.p.x = radial.x * (P.R + P.RIM_W + 0.001); c.p.z = radial.z * (P.R + P.RIM_W + 0.001);
      const vr = c.v.x * radial.x + c.v.z * radial.z;
      if (vr < 0) { c.v.x -= 1.45 * vr * radial.x; c.v.z -= 1.45 * vr * radial.z; }
      c.hits++; out.push({ type: 'clink', speed });
    }
    if (c.p.y < P.RIM_H && c.p.y > 0 && r0 < P.R && r >= P.R - P.CR * 0.5) {
      c.p.x = radial.x * (P.R - P.CR * 0.5); c.p.z = radial.z * (P.R - P.CR * 0.5);
      const vr = c.v.x * radial.x + c.v.z * radial.z;
      if (vr > 0) { c.v.x -= 1.45 * vr * radial.x; c.v.z -= 1.45 * vr * radial.z; }
      c.hits++; out.push({ type: 'clink', speed });
    }
    // 落水
    if (prev.y >= 0 && c.p.y < 0 && r < P.R && r >= P.ISLE_R) {
      out.push({ type: 'splash', speed, x: c.p.x, z: c.p.z });
      c.phase = 'sink'; c.sinkT = 0;
      c.v.x *= 0.22; c.v.z *= 0.22; c.v.y = Math.min(c.v.y * 0.25, -0.25);
      c.spin *= 0.25;
      return out;
    }
    // 掉到池外的地上
    if (c.p.y <= P.GROUND && r > P.R + P.RIM_W) {
      c.p.y = P.GROUND;
      if (c.bounces < 2 && Math.abs(c.v.y) > 0.8) {
        c.bounces++; c.v.y = Math.abs(c.v.y) * 0.3; c.v.x *= 0.5; c.v.z *= 0.5;
        out.push({ type: 'ground' });
      } else {
        c.phase = 'rest'; c.spot = 'miss'; c.v = { x: 0, y: 0, z: 0 };
        out.push({ type: 'ground' }, { type: 'rest', spot: 'miss' });
      }
      return out;
    }
    if (r > 7 || c.p.y < -2 || c.t > 8) {
      c.phase = 'rest'; c.spot = 'miss';
      out.push({ type: 'rest', spot: 'miss' });
    }
    return out;
  }

  // 水裡：阻力很大、慢慢沉，左右飄
  if (c.phase === 'sink') {
    c.sinkT += dt;
    const k = Math.exp(-4.5 * dt);
    c.v.x *= k; c.v.z *= k;
    c.v.y += (-0.3 - c.v.y) * (1 - Math.exp(-5 * dt));
    const wob = Math.sin(c.sinkT * 8.5) * Math.exp(-c.sinkT * 1.3);
    c.p.x += (c.v.x + c.axis.x * wob * 0.12) * dt;
    c.p.z += (c.v.z + c.axis.z * wob * 0.12) * dt;
    c.p.y += c.v.y * dt;
    c.tilt = 0.75 * wob;
    c.phi *= Math.exp(-6 * dt);
    const r = Math.hypot(c.p.x, c.p.z);
    const lim = POOL.R - POOL.CR, inner = POOL.ISLE_R + POOL.CR;
    if (r > lim) { c.p.x *= lim / r; c.p.z *= lim / r; }
    if (r < inner && r > 1e-6) { c.p.x *= inner / r; c.p.z *= inner / r; }
    if (c.p.y <= -POOL.DEPTH + 0.004) {
      c.p.y = -POOL.DEPTH + 0.004; c.phase = 'rest'; c.spot = 'pool'; c.phi = 0;
      c.tilt = 0.08 * Math.sin(c.yaw * 7);
      out.push({ type: 'rest', spot: 'pool' });
    }
  }
  return out;
}

/** 從出手一路算到停下來（減少動態、測試用） */
export function simulate(v0, { dt = 1 / 120, max = 20, from = START } = {}) {
  const c = createCoin(v0, {}, from), events = [];
  for (let t = 0; t < max && c.phase !== 'rest'; t += dt) stepCoin(c, dt, events);
  if (c.phase !== 'rest') { c.phase = 'rest'; c.spot = c.spot || 'miss'; }
  return { coin: c, events };
}

/** 硬幣現在的法線（畫面用）：沿著翻轉軸轉 phi，再往旁邊歪 tilt */
export function normalOf(c) {
  const a = c.axis, ph = c.phi;
  const cs = Math.cos(ph), sn = Math.sin(ph);
  // Rodrigues：v' = v cos + (a×v) sin + a(a·v)(1-cos)；v=(0,1,0)、a.y=0 → a×v = (-a.z, 0, a.x)
  let n = { x: -a.z * sn, y: cs, z: a.x * sn };
  if (c.tilt) {
    const f = { x: -a.z, y: 0, z: a.x };
    const ct = Math.cos(c.tilt), st = Math.sin(c.tilt);
    const fx = f.y * n.z - f.z * n.y, fy = f.z * n.x - f.x * n.z, fz = f.x * n.y - f.y * n.x;
    const fd = f.x * n.x + f.z * n.z;
    n = { x: n.x * ct + fx * st + f.x * fd * (1 - ct), y: n.y * ct + fy * st, z: n.z * ct + fz * st + f.z * fd * (1 - ct) };
  }
  return n;
}
