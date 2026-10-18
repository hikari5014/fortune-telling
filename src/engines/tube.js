/* 籤筒的簡易物理（只算，不畫；畫在 src/qian3d.js）
   ──────────────────────────────────────────────────────────
   不是完整的剛體模擬 —— 一把籤擠在筒裡，真正重要的只有兩件事：
     ・每一支「沿著筒身」上下跳：重力把它拉回筒底，搖一下就往上彈
     ・整把籤跟著筒身傾斜：往哪邊歪，籤就靠向筒口的那一邊
   所以每支籤只有一個「升起量」h（沿筒軸）跟兩個傾斜角，各自用彈簧與阻尼。

   搖出一支籤：廟裡的作法是把筒稍微往前傾、一直搖，總有一支會被擠出來。
   這裡每搖一下，最突出的那幾支裡挑一支多推一把（筒越往前傾推越多）——
   搖個幾下，領先的那支就會越升越高、整支滑出筒口。

   用手抽：直接把某一支拉高，超過筒口就算抽出來。

   每次開新的一筒都重新洗牌：哪一支對到哪一首籤是隨機的，
   所以「挑」哪一支跟「搖」出哪一支，抽中每一首的機會都一樣。 */

export const TUBE = { R: 0.78, H: 2.6, STICK: 3.3, OUT: 2.55 };   // 筒半徑、筒高、籤長、升多高算出筒

export function createTube(count, rand = Math.random) {
  // 籤號隨機對應：perm[i] = 第 i 支籤對到第幾首（0 起算）
  const perm = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  // 向日葵排列：一把籤在圓形截面裡均勻散開
  const golden = Math.PI * (3 - Math.sqrt(5));
  const sticks = perm.map((poem, i) => {
    const r = TUBE.R * 0.82 * Math.sqrt((i + 0.5) / count), a = i * golden;
    return {
      poem, bx: r * Math.cos(a), bz: r * Math.sin(a),
      base: rand() * 0.45,               // 每一支平常就高低不齊
      h: 0, vh: 0,
      lx: 0, lz: 0, vlx: 0, vlz: 0,      // 傾斜（弧度），繞 x、繞 z
      out: false,
    };
  });
  return {
    sticks,
    tilt: { x: 0, z: 0 },                // 筒身傾斜（弧度）：x 往前後、z 往左右
    jolt: 0,                             // 搖晃造成的筒身抖動（畫面用）
    shakes: 0,
    picked: null,                        // 出來的那一支（index）
    grab: null,                          // 正被手拉著的那一支
  };
}

/** 搖一下。m 是力道（0.3–1.5，手機的加速度或滑鼠甩的速度換算） */
export function shake(st, m = 1, rand = Math.random) {
  if (st.picked != null) return;
  st.shakes++;
  st.jolt = Math.min(1, st.jolt + 0.5 * m);
  const forward = Math.max(0, st.tilt.x);       // 往前傾（朝自己）才容易倒出來
  for (const s of st.sticks) {
    if (s.out || s === st.sticks[st.grab]) continue;
    const r = rand();
    s.vh += m * (0.6 + 3.2 * r * r * r);       // 大部分只跳一點點，偶爾有一支跳得高
    s.vlx += (rand() - 0.5) * 0.9 * m;
    s.vlz += (rand() - 0.5) * 0.9 * m;
  }
  // 最突出的前三支裡挑一支多推一把 —— 它會越推越高，直到整支滑出來
  const lead = st.sticks.map((s, i) => [s.base + s.h, i]).filter(([, i]) => !st.sticks[i].out).sort((a, b) => b[0] - a[0]).slice(0, 3);
  if (lead.length) {
    const [, i] = lead[Math.floor(rand() * lead.length)];
    st.sticks[i].base += m * (0.18 + 0.35 * forward + 0.04 * Math.min(st.shakes, 12));
  }
}

/** 往前推進 dt 秒；有籤出筒時回傳它的 index（只回一次） */
export function step(st, dt) {
  const g = 26 * Math.cos(Math.min(1.2, Math.hypot(st.tilt.x, st.tilt.z)));
  st.jolt *= Math.exp(-dt * 6);
  let popped = null;
  st.sticks.forEach((s, i) => {
    if (s.out || st.grab === i) return;
    // 沿筒軸：重力往下，碰到筒底停住
    s.vh -= g * dt;
    s.h += s.vh * dt;
    if (s.h < 0) { s.h = 0; s.vh = s.vh < -2 ? -s.vh * 0.18 : 0; }
    // 傾斜：彈簧拉向「跟著筒身倒」的角度，加阻尼
    const tx = st.tilt.x * 0.45, tz = st.tilt.z * 0.45;
    s.vlx += ((tx - s.lx) * 60 - s.vlx * 9) * dt; s.lx += s.vlx * dt;
    s.vlz += ((tz - s.lz) * 60 - s.vlz * 9) * dt; s.lz += s.vlz * dt;
    if (st.picked == null && s.base + s.h > TUBE.OUT) { s.out = true; st.picked = i; popped = i; }
  });
  return popped;
}

/** 用手拉：把第 i 支的升起量設成 h；超過筒口就算抽出來 */
export function pull(st, i, h) {
  const s = st.sticks[i];
  if (!s || s.out || st.picked != null) return null;
  st.grab = i;
  s.h = Math.max(0, h - s.base); s.vh = 0;
  if (s.base + s.h > TUBE.OUT) { s.out = true; st.picked = i; st.grab = null; return i; }
  return null;
}
/** 放手：沒拉出筒口就滑回去 */
export function release(st) { st.grab = null; }

/** 自動搖到有一支出來為止（給「搖出一支籤」按鈕與減少動態用） */
export function shakeUntilOut(st, rand = Math.random, maxShakes = 60) {
  st.tilt.x = 0.35;
  for (let k = 0; k < maxShakes && st.picked == null; k++) {
    shake(st, 1, rand);
    for (let t = 0; t < 12 && st.picked == null; t++) step(st, 1 / 60);
  }
  if (st.picked == null) {                       // 保險：還是沒有就讓最高的那支出來
    const i = st.sticks.reduce((b, s, k) => (s.base + s.h > st.sticks[b].base + st.sticks[b].h ? k : b), 0);
    st.sticks[i].out = true; st.picked = i;
  }
  return st.picked;
}
