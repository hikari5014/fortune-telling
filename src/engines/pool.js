/* 許願池的物理（只算，不畫；畫在 src/pool3d.js）
   ──────────────────────────────────────────────────────────
   單位是公尺，y 朝上，水面在 y = 0，丟的人站在 +z 那一側往 -z 丟。

     ・圓形石池：水面半徑 R，外面一圈石緣（寬 RIM_W、比水面高 RIM_H）
     ・池底在 y = -DEPTH
     ・正中央一根石柱，頂上一個小小的「月盞」—— 投進去就是正中目標

   操作的手感靠「同一套算式」：瞄準時畫出來的落點，跟真的丟出去的落點是同一個積分，
   空中沒有風、沒有亂數 —— 你拉多遠、往哪邊，硬幣就照那條弧線飛。
   碰到石緣、石柱、月盞的邊才會彈開，那是物理，不是運氣。

   落水之後：撞水面會掉很多速度，然後像真的硬幣一樣左右飄著往下沉，最後平躺在池底。 */

export const POOL = {
  R: 1.0,          // 水面（內壁）半徑
  RIM_W: 0.22,     // 石緣寬
  RIM_H: 0.14,     // 石緣頂比水面高多少
  GROUND: -0.06,   // 池外地面
  DEPTH: 0.32,     // 水深
  COL_R: 0.07,     // 中央石柱半徑
  BOWL_Y: 0.3,     // 月盞口的高度
  BOWL_R: 0.15,    // 月盞外緣半徑
  BOWL_IN: 0.12,   // 月盞口內緣半徑（落在這圈裡面就是投進）
  CR: 0.045,       // 硬幣半徑
  G: 7,            // 重力（比地球小一點，弧線看得清楚）
};

/** 硬幣從這裡出手（手在池子前方、略高於石緣） */
export const START = { x: 0, y: 0.32, z: 1.6 };
const ANGLE = 55 * Math.PI / 180;     // 固定的出手仰角：高高的拋物線，比較好看也比較好控制
export const DIST = { min: 0.25, max: 3.35 };
export const YAW_MAX = 0.62;          // 左右最多偏多少（弧度）

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** 瞄準 → 落在水面高度的那一點。aim = { yaw: -1..1, power: 0..1 }；from 是出手的位置（手指放開的地方） */
export function targetOf({ yaw = 0, power = 0.5 }, from = START) {
  const a = clamp(yaw, -1, 1) * YAW_MAX;
  const d = DIST.min + clamp(power, 0, 1) * (DIST.max - DIST.min);
  return { x: from.x + d * Math.sin(a), y: 0, z: from.z - d * Math.cos(a), d };
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

/** 空中的那一步（瞄準預覽與實際飛行共用，所以畫出來的落點跟真的一樣） */
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
    if (p.y <= 0 && py > 0) {                       // 在水面高度內插出精確的落點
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
export const FLICK = { min: 0.9, max: 4.2, maxAngle: 0.5 };     // 每秒 0.9～4.2 個螢幕高；左右最多偏約 29°
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
  if (r < POOL.R - POOL.CR) return 'water';
  if (r < POOL.R + POOL.RIM_W) return 'rim';
  return 'out';
}

/* ── 一枚硬幣 ───────────────────────────────────────── */
export function createCoin(v0, { spin = 17 } = {}, from = START) {
  const sp = Math.hypot(v0.x, v0.z) || 1;
  return {
    p: { ...from }, v: { ...v0 },
    phase: 'air',              // air → sink → rest | bowl | miss
    axis: { x: -v0.z / sp, y: 0, z: v0.x / sp },     // 翻轉軸：水平、跟前進方向垂直
    phi: 0, spin,              // 翻了幾圈、每秒翻多快
    tilt: 0, yaw: Math.atan2(v0.x, -v0.z),
    t: 0, sinkT: 0, bounces: 0, hits: 0,
  };
}

/**
 * 往前推進 dt 秒。發生的事件放進 out：
 *   { type: 'clink', speed }   撞到石頭或月盞邊
 *   { type: 'splash', speed }  落水
 *   { type: 'bowl' }           投進月盞
 *   { type: 'ground' }         掉到池外的地上
 *   { type: 'rest', spot }     停下來了：spot = 'pool' | 'bowl' | 'miss'
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

    // 月盞：從上面穿過盞口那一刻
    if (prev.y >= P.BOWL_Y && c.p.y < P.BOWL_Y && r < P.BOWL_R + P.CR * 0.4) {
      if (r < P.BOWL_IN) {
        c.p.y = P.BOWL_Y - 0.035; c.v = { x: 0, y: 0, z: 0 };
        c.phase = 'rest'; c.spot = 'bowl'; c.tilt = 0.12;
        out.push({ type: 'bowl' }, { type: 'rest', spot: 'bowl' });
        return out;
      }
      // 打在盞緣：往外彈
      c.p.y = P.BOWL_Y;
      c.v.y = Math.abs(c.v.y) * 0.42;
      const vr = c.v.x * radial.x + c.v.z * radial.z;
      c.v.x += radial.x * (Math.abs(vr) + 0.9); c.v.z += radial.z * (Math.abs(vr) + 0.9);
      c.spin *= -0.7; c.hits++;
      out.push({ type: 'clink', speed });
      return out;
    }
    // 石柱：比盞口低的地方撞到柱身，往外推開
    if (c.p.y < P.BOWL_Y && c.p.y > -P.DEPTH && r < P.COL_R + P.CR) {
      c.p.x = radial.x * (P.COL_R + P.CR); c.p.z = radial.z * (P.COL_R + P.CR);
      const vr = c.v.x * radial.x + c.v.z * radial.z;
      if (vr < 0) { c.v.x -= 1.6 * vr * radial.x; c.v.z -= 1.6 * vr * radial.z; }
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
        // 彈不起來了：看硬幣停在石緣的哪一半，滑進池裡或掉到外面
        const inward = r < P.R + P.RIM_W * 0.5 ? -1 : 1;
        c.v = { x: radial.x * 0.55 * inward, y: 0.5, z: radial.z * 0.55 * inward };
        c.spin = 6 * inward;
      }
      return out;
    }
    // 石緣的外牆（從池外低低地飛過來）與內壁（在水面之上撞到）
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
    if (prev.y >= 0 && c.p.y < 0 && r < P.R) {
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
    if (r > 6 || c.p.y < -2 || c.t > 8) {
      c.phase = 'rest'; c.spot = 'miss';
      out.push({ type: 'rest', spot: 'miss' });
    }
    return out;
  }

  // 水裡：阻力很大、慢慢沉，左右飄 —— 硬幣在水裡就是會這樣
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
    c.phi *= Math.exp(-6 * dt);                 // 翻轉慢慢停下來，平躺
    const r = Math.hypot(c.p.x, c.p.z);
    const lim = POOL.R - POOL.CR;
    if (r > lim) { c.p.x *= lim / r; c.p.z *= lim / r; }
    if (r < POOL.COL_R + POOL.CR && r > 1e-6) { const s = (POOL.COL_R + POOL.CR) / r; c.p.x *= s; c.p.z *= s; }
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
  // 繞水平軸 a 轉 phi：up 向量 (0,1,0) 轉出來的方向
  const cs = Math.cos(ph), sn = Math.sin(ph);
  // Rodrigues：v' = v cos + (a×v) sin + a(a·v)(1-cos)；v=(0,1,0)、a.y=0 → a×v = (-a.z, 0, a.x)
  let n = { x: -a.z * sn, y: cs, z: a.x * sn };
  // 再繞「前進方向」歪 tilt（水裡飄的時候）
  if (c.tilt) {
    const f = { x: -a.z, y: 0, z: a.x };                 // 前進方向（水平）
    const ct = Math.cos(c.tilt), st = Math.sin(c.tilt);
    const fx = f.y * n.z - f.z * n.y, fy = f.z * n.x - f.x * n.z, fz = f.x * n.y - f.y * n.x;
    const fd = f.x * n.x + f.z * n.z;
    n = { x: n.x * ct + fx * st + f.x * fd * (1 - ct), y: n.y * ct + fy * st, z: n.z * ct + fz * st + f.z * fd * (1 - ct) };
  }
  return n;
}
