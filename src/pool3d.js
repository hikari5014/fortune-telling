/* 許願池的 3D 畫面與操作（three.js / WebGL）
   ──────────────────────────────────────────────────────────
   物理在 src/engines/pool.js、模型在 src/pool/models.js、貼圖在 src/pool/textures.js。

   場景：星空（也是水面倒影的環境貼圖）、遠方樹林、石板廣場、一圈石燈籠、
   石池（金色嵌線、馬賽克池底）、會動的水面、中央石島上的四隻動物（金蟾、玉兔、靈龜、錦鯉）。

   怎麼玩：
   ・繞著池子走：在畫面上半部左右滑，就繞著池子轉到另一邊 —— 從哪一邊丟，決定瞄得到哪隻動物
   ・祈禱：按住畫面下方的硬幣不放，越久光越強（最多約 3 秒）
   ・投：像寶可夢 GO 丟球，往上一甩放開。甩多快決定多遠、往哪甩決定左右、空中沒有亂數
   ・飛出去的硬幣拖著流星般的光；落水之後光慢慢退掉，回到一枚普通的硬幣
   ・投進動物的嘴、碗、臼：願望一定會實現 —— 動物會亮起來，之後一直輕輕閃著
   ・手機：左右傾斜瞄方向、前後傾斜調遠近，往前一甩投出 */

import * as THREE from '../vendor/three.module.min.js';
import { POOL, ANIMALS, standAt, targetOf, launchFor, zoneOf, createCoin, stepCoin, simulate, normalOf, flickAim, catchOf } from './engines/pool.js';
import * as MD from './pool/models.js';
import * as TX from './pool/textures.js';
import { clink, plop, chime } from './rites/sound.js';
import { haptic } from './ui.js';
import { askMotion } from './rites/kit.js';

const fastMode = () => document.documentElement.dataset.motion === 'off'
  || matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const UP = new THREE.Vector3(0, 1, 0);
const PRAY_MS = 3000;                                  // 祈禱集滿光的時間

export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/**
 * @param {HTMLElement} host
 * @param {object} o
 *   coins         池底已有的硬幣 [{x, z, yaw, tilt, gold}]
 *   animalCoins   各動物容器裡已有的硬幣 { frog: [是否福幣…], … }
 *   isGold()      手上這枚是不是福幣
 *   onBeforeThrow(aim)  出手那一刻；回傳 false 不投，回傳 { gold } 決定投哪一種
 *   onLand(r)     停下來了：{ spot: 'pool'|'animal'|'miss', k, gold, pray, x, z, … }
 *   onAim(aim|null)、onFacing(animal|null)、onCharge(0..1|null)
 */
export function mountPool(host, { coins = [], animalCoins = {}, isGold = () => false, canThrow, onBeforeThrow, onLand, onAim, onFacing, onCharge } = {}) {
  host.querySelectorAll('canvas, .pool3d__no').forEach(n => n.remove());   // 留著願望升空的那一層
  if (!webglOK()) {
    host.insertAdjacentHTML('beforeend', '<p class="pool3d__no">這台裝置不支援 3D 畫面，許願池暫時無法顯示。</p>');
    return { armMotion: async () => false, busy: () => false, throwAt: () => false, walkTo() {}, destroy() {} };
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'pool3d__cv';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '星空許願池：按住硬幣祈禱，往上一甩投出；左右滑動畫面上方可以繞著池子走');
  host.appendChild(canvas);

  /* ── 場景 ── */
  const scene = new THREE.Scene();
  const skyTex = TX.sky();
  scene.background = skyTex;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(skyTex).texture;
  scene.environment = env;
  scene.fog = new THREE.FogExp2(0x0a0e26, 0.055);

  scene.add(new THREE.HemisphereLight(0x8a98e8, 0x2a2236, 1.05));
  const moon = new THREE.DirectionalLight(0xdbe2ff, 1.7);
  moon.position.copy(TX.MOON_DIR).multiplyScalar(8);
  moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 1, far: 20 });
  moon.shadow.bias = -0.0008;
  scene.add(moon);
  const warm = new THREE.PointLight(0xffc27a, 1.6, 3.2, 1.6); warm.position.set(0, 1.1, 0); scene.add(warm);

  const M = MD.materials();
  scene.add(MD.ground(M), MD.pool(M), MD.island(M));
  const wat = MD.water(env); scene.add(wat.mesh);
  // 石燈籠：一圈，離池子遠一點；擋到鏡頭的那座先藏起來
  const lanterns = [];
  const glowTex = TX.glow();
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * Math.PI * 2, l = MD.lantern(M);
    l.position.set(3.3 * Math.sin(a), POOL.GROUND, 3.3 * Math.cos(a)); l.rotation.y = a;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffbe6a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(0.9, 0.9, 1); halo.position.y = 0.6; l.add(halo);
    scene.add(l); lanterns.push(l);
  }
  const beasts = MD.animals(M);
  beasts.forEach(b => scene.add(b.group));

  /* ── 硬幣 ── */
  const kit = MD.coinKit();
  const metal = (gold) => (gold ? kit.gold : kit.silver);
  const MAXC = 160;
  const rest = { gold: new THREE.InstancedMesh(kit.geo, kit.gold, MAXC), silver: new THREE.InstancedMesh(kit.geo, kit.silver, MAXC) };
  Object.values(rest).forEach(m => { m.count = 0; m.receiveShadow = true; scene.add(m); });
  const tmp = new THREE.Object3D();
  function placeRest(list) {
    const by = { gold: [], silver: [] };
    list.slice(-MAXC).forEach(c => by[c.gold ? 'gold' : 'silver'].push(c));
    for (const k of ['gold', 'silver']) {
      by[k].forEach((c, i) => {
        tmp.position.set(c.x, -POOL.DEPTH + 0.006, c.z);
        tmp.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.sin(c.yaw || 0) * (c.tilt || 0.05), 1, Math.cos(c.yaw || 0) * (c.tilt || 0.05)).normalize());
        tmp.updateMatrix(); rest[k].setMatrixAt(i, tmp.matrix);
      });
      rest[k].count = by[k].length; rest[k].instanceMatrix.needsUpdate = true;
    }
  }
  let bottom = coins.slice(-MAXC);
  placeRest(bottom);
  // 容器裡的硬幣：每隻最多看得到三枚
  const inBox = {};
  function boxCoins(k) {
    inBox[k]?.forEach(m => scene.remove(m));
    const a = ANIMALS.find(x => x.k === k), q = catchOf(a), list = (animalCoins[k] || []).slice(-3);
    inBox[k] = list.map((gold, i) => {
      const m = new THREE.Mesh(kit.geo, metal(gold)), d = 0.035 - i * 0.008;
      m.position.set(q.c.x - q.n.x * d, q.c.y - q.n.y * d, q.c.z - q.n.z * d);
      m.quaternion.setFromUnitVectors(UP, new THREE.Vector3(q.n.x + (i - 1) * 0.15, q.n.y, q.n.z + (i % 2) * 0.1).normalize());
      m.scale.setScalar(0.8); scene.add(m); return m;
    });
  }
  ANIMALS.forEach(a => boxCoins(a.k));
  const lit = {};                                     // 被投中過的動物：之後一直輕輕閃
  ANIMALS.forEach(a => { lit[a.k] = (animalCoins[a.k] || []).length > 0; });
  const pulse = {};

  // 手上的硬幣、飛行中的硬幣（材質各自一份，才能各自發光）
  const own = (mats) => mats.map(m => m.clone());
  const handMats = { gold: own(kit.gold), silver: own(kit.silver) }, flyMats = { gold: own(kit.gold), silver: own(kit.silver) };
  const hand = new THREE.Mesh(kit.geo, handMats.silver); hand.castShadow = true; scene.add(hand);
  const flying = new THREE.Mesh(kit.geo, flyMats.silver); flying.castShadow = true; flying.visible = false; scene.add(flying);
  const addSprite = (color, opacity = 1) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(s); return s;
  };
  const handGlow = addSprite(0xffd98a, 0);
  const coinGlow = addSprite(0xffe1a0, 0); coinGlow.visible = false;
  const TRAIL = 36, trail = Array.from({ length: TRAIL }, () => { const s = addSprite(0xffcf7a, 0); s.visible = false; return s; });
  const trailPos = [];

  /* 粒子：水花、星火、祈禱的光點、螢火蟲 —— 都用同一種點雲 */
  function points(n, color, size) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ map: glowTex, color, size, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    const p = new THREE.Points(geo, mat); p.frustumCulled = false; scene.add(p);
    return { p, arr: geo.attributes.position.array, attr: geo.attributes.position, n, items: [] };
  }
  const drops = points(60, 0xcfe4ff, 0.035);
  const sparks = points(140, 0xffd27a, 0.06);
  const prayer = points(24, 0xfff0c0, 0.04);
  const flies = points(22, 0xffe2a0, 0.07);
  const flyItems = Array.from({ length: 22 }, (_, i) => ({ a: i * 0.9, r: 0.6 + (i % 5) * 0.35, y: 0.25 + (i % 4) * 0.25, ph: i * 1.7 }));
  function flush(P, list, fn) {
    for (let i = 0; i < P.n; i++) {
      const it = list[i];
      if (it !== undefined) { const [x, y, z] = fn(it); P.arr[i * 3] = x; P.arr[i * 3 + 1] = y; P.arr[i * 3 + 2] = z; } else P.arr[i * 3 + 1] = -99;
    }
    P.attr.needsUpdate = true;
  }
  // 漣漪
  let ripples = [];
  const ringGeo = new THREE.RingGeometry(0.94, 1, 64);
  function ripple(x, z, amp = 1) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xd8e8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.004, z); m.renderOrder = 3; scene.add(m);
    ripples.push({ m, t: 0, amp });
  }
  // 手機瞄準時的落點圈
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.085, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, depthWrite: false }));
  reticle.rotation.x = -Math.PI / 2; reticle.visible = false; reticle.renderOrder = 4; scene.add(reticle);

  /* ── 鏡頭：繞著池子走 ── */
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
  // 跟著人走的一盞暖光（像手上提著燈）：石緣、動物、手上的硬幣才看得清楚
  const fill = new THREE.PointLight(0xffe2b8, 2.4, 7, 1.1); fill.position.set(0, 0.5, 0.2);
  camera.add(fill); scene.add(camera);
  let w = 1, h = 1, angle = 0, angleGoal = 0;
  function size() {
    w = host.clientWidth || 360; h = host.clientHeight || 640;
    renderer.setSize(w, h, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    camera.aspect = w / h;
    // 池子寬度要裝得下：直拿的手機視角較寬
    camera.fov = clamp(2 * Math.atan(Math.tan(27 * Math.PI / 180) / camera.aspect) * 180 / Math.PI, 42, 88);
    camera.updateProjectionMatrix();
  }
  const tall = () => clamp((h / w - 1.1) / 0.9, 0, 1);
  function placeCamera() {
    const k = tall(), D = 2.85 - 0.3 * k, H = 1.45 + 0.6 * k, look = 0.05 + 0.1 * k;
    camera.position.set(D * Math.sin(angle), H, D * Math.cos(angle));
    camera.lookAt(-look * Math.sin(angle), -0.05, -look * Math.cos(angle));   // 看向池中心偏遠一點，手上的硬幣才在畫面下方
    lanterns.forEach(l => { l.visible = Math.hypot(l.position.x - camera.position.x, l.position.z - camera.position.z) > 1.4; });
  }
  /** 畫面上的一點，在鏡頭前方 dist 處的世界座標（拿著硬幣用） */
  const ray = new THREE.Vector3(), fwdV = new THREE.Vector3();
  function atScreen(sx, sy, dist = 0.95) {
    ray.set((sx / w) * 2 - 1, -(sy / h) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
    camera.getWorldDirection(fwdV);
    return camera.position.clone().addScaledVector(ray, dist / Math.max(0.2, ray.dot(fwdV)));
  }
  const restScreen = () => ({ x: w / 2, y: h * 0.8 });

  /* ── 狀態 ── */
  let coin = null, held = null, back = null, orbit = null, motionAim = null, charge = 0, flightCharge = 0;
  let raf = 0, last = performance.now(), acc = 0, t = 0, alive = true, facing = null;

  function burst(at, n, up = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.15 + Math.random() * 0.5;
      sparks.items.push({ p: at.clone(), v: new THREE.Vector3(Math.cos(a) * s, (0.5 + Math.random() * 1.2) * up, Math.sin(a) * s), life: 1 });
    }
  }
  function event(e) {
    if (e.type === 'clink') { clink(e.speed); haptic(6); }
    if (e.type === 'ground') clink(1.5);
    if (e.type === 'splash') {
      plop(e.speed); haptic([8, 20, 6]);
      ripple(e.x, e.z, 1); setTimeout(() => alive && ripple(e.x, e.z, 0.6), 180);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, s = 0.2 + Math.random() * 0.5;
        drops.items.push({ p: new THREE.Vector3(e.x, 0.01, e.z), v: new THREE.Vector3(Math.cos(a) * s, 0.9 + Math.random() * 1.2, Math.sin(a) * s) });
      }
      if (coin?.gold || flightCharge > 0.3) burst(new THREE.Vector3(e.x, 0.03, e.z), 10 + Math.round(flightCharge * 16), 0.5);
    }
    if (e.type === 'catch') {
      chime(); haptic([12, 50, 12, 50, 20]);
      pulse[e.k] = 1.6; lit[e.k] = true;
      const q = catchOf(ANIMALS.find(a => a.k === e.k));
      burst(new THREE.Vector3(q.c.x, q.c.y, q.c.z), 46, 1.2);
    }
  }

  function landed(c) {
    const r = { spot: c.spot, k: c.k || null, gold: !!c.gold, pray: +flightCharge.toFixed(2),
      x: +c.p.x.toFixed(3), z: +c.p.z.toFixed(3), yaw: +c.yaw.toFixed(2), tilt: +(c.tilt || 0).toFixed(2) };
    if (c.spot === 'pool') { bottom = [...bottom, r].slice(-MAXC); placeRest(bottom); flying.visible = false; }
    if (c.spot === 'animal') { (animalCoins[c.k] ||= []).push(!!c.gold); boxCoins(c.k); flying.visible = false; }
    if (c.spot === 'miss') setTimeout(() => { flying.visible = false; }, 600);
    setTimeout(() => { if (coin === c) coin = null; }, c.spot === 'miss' ? 600 : 0);
    onLand?.(r);
  }

  function launch(a, from, lateral = 0) {
    if (coin && coin.phase !== 'rest') return false;
    if (canThrow && !canThrow()) return false;
    const opt = onBeforeThrow ? onBeforeThrow(a) : {};
    if (opt === false) return false;
    const gold = !!opt?.gold;
    const st = standAt(angle);
    const tg = targetOf(a, st.from, st.fwd);
    tg.x += -st.fwd.z * lateral; tg.z += st.fwd.x * lateral;    // 放開的位置偏左偏右，落點跟著偏
    from = from || st.from;
    const v = launchFor(tg, from);
    flightCharge = charge; charge = 0; onCharge?.(null);
    flying.material = gold ? flyMats.gold : flyMats.silver;
    if (fastMode()) {
      const { coin: c, events } = simulate(v, { from });
      c.gold = gold; coin = c;
      events.forEach(e => (e.type === 'splash' || e.type === 'catch') && event(e));
      flying.visible = false; landed(c); return true;
    }
    coin = createCoin(v, {}, from); coin.gold = gold;
    acc = 0; trailPos.length = 0; flying.visible = true;
    return true;
  }

  /* ── 每一格 ── */
  const nrm = new THREE.Vector3();
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden) return;
    t += dt;
    angle += (angleGoal - angle) * (1 - Math.exp(-dt * 10));          // 繞池：平滑地轉過去
    placeCamera();
    let best = null, bd = 0.6;                                         // 眼前是哪一隻
    for (const a of ANIMALS) { const d = Math.abs(Math.atan2(Math.sin(angle - a.phi), Math.cos(angle - a.phi))); if (d < bd) { bd = d; best = a; } }
    if (best !== facing) { facing = best; onFacing?.(best); }
    if (held) {                                                        // 祈禱：按著越久越亮
      const c0 = charge;
      charge = Math.min(1, (now - held.t0) / PRAY_MS);
      if (Math.floor(c0 * 3) !== Math.floor(charge * 3)) haptic(8 + Math.floor(charge * 3) * 4);
      onCharge?.(charge);
    }
    if (coin && coin.phase !== 'rest') {                               // 物理（固定步長）
      acc += dt;
      while (acc >= 1 / 120 && coin.phase !== 'rest') {
        acc -= 1 / 120;
        stepCoin(coin, 1 / 120).forEach(event);
        if (coin.phase === 'rest') { landed(coin); break; }
      }
    }
    // 飛行中的硬幣：翻轉、流星尾巴、光暈（落水後慢慢退掉，回到普通的硬幣）
    if (coin && flying.visible) {
      flying.position.set(coin.p.x, coin.p.y, coin.p.z);
      const n = normalOf(coin); nrm.set(n.x, n.y, n.z).normalize();
      flying.quaternion.setFromUnitVectors(UP, nrm);
      const inAir = coin.phase === 'air';
      if (!inAir) flightCharge *= Math.exp(-dt * 2.2);
      const bright = inAir ? 0.35 + 0.65 * flightCharge : flightCharge;
      coinGlow.visible = bright > 0.02; coinGlow.position.copy(flying.position);
      coinGlow.scale.setScalar(0.18 + 0.4 * bright); coinGlow.material.opacity = Math.min(1, bright * 1.2);
      flying.material[1].emissive.setRGB(0.6 * bright, 0.45 * bright, 0.15 * bright);
      if (inAir) { trailPos.unshift(flying.position.clone()); if (trailPos.length > TRAIL) trailPos.pop(); }
      else trailPos.length = Math.max(0, trailPos.length - 2);
      trail.forEach((s, i) => {
        const p = trailPos[i];
        s.visible = !!p && bright > 0.02;
        if (!p) return;
        const k = 1 - i / TRAIL;
        s.position.copy(p); s.scale.setScalar((0.04 + 0.16 * bright) * k + 0.01);
        s.material.opacity = Math.min(1, (0.25 + 0.75 * bright) * k * k);
      });
    } else { coinGlow.visible = false; trail.forEach(s => { s.visible = false; }); }
    // 手上的硬幣：跟著手指，按越久越亮
    const ready = !coin || coin.phase === 'rest';
    hand.visible = ready;
    if (ready) {
      hand.material = isGold() ? handMats.gold : handMats.silver;
      const rs = restScreen();
      let p;
      if (held) p = held.p;
      else {
        const home = atScreen(rs.x, rs.y + Math.sin(t * 2.2) * 3);
        if (back) {
          const k = Math.min(1, (now - back.t0) / 260), e = 1 - Math.pow(1 - k, 3);
          p = back.from.clone().lerp(home, e); if (k >= 1) back = null;
        } else p = home;
      }
      hand.position.copy(p);
      const toCam = camera.position.clone().sub(p).normalize();
      hand.quaternion.setFromUnitVectors(UP, toCam.lerp(UP, 0.25).normalize());
      const c = held ? charge : 0;
      handGlow.position.copy(p);
      handGlow.scale.setScalar(0.16 + 0.45 * c + 0.02 * Math.sin(t * 3));
      handGlow.material.opacity = held ? 0.35 + 0.65 * c : 0.25 + 0.1 * Math.sin(t * 3);
      hand.material[1].emissive.setRGB(0.7 * c, 0.5 * c, 0.15 * c);
      const np = held && c > 0.05 ? Math.round(6 + 18 * c) : 0;
      flush(prayer, Array.from({ length: np }, (_, i) => i), (i) => {
        const a = t * (1.2 + (i % 3) * 0.5) + i * 0.8, r = 0.07 + 0.05 * c + 0.02 * Math.sin(t * 4 + i);
        return [p.x + r * Math.cos(a), p.y + 0.03 * Math.sin(t * 3 + i) + (i % 4) * 0.012, p.z + r * Math.sin(a)];
      });
      prayer.p.material.opacity = 0.4 + 0.6 * c;
    } else { handGlow.material.opacity = 0; flush(prayer, [], () => [0, 0, 0]); }
    // 粒子
    for (const d of drops.items) { d.v.y -= POOL.G * dt; d.p.addScaledVector(d.v, dt); }
    drops.items = drops.items.filter(d => d.p.y > 0);
    flush(drops, drops.items, d => [d.p.x, d.p.y, d.p.z]);
    for (const s of sparks.items) { s.v.y -= 1.4 * dt; s.p.addScaledVector(s.v, dt); s.life -= dt * 0.6; }
    sparks.items = sparks.items.filter(s => s.life > 0).slice(-sparks.n);
    for (const a of ANIMALS) if (lit[a.k] && Math.random() < dt * 2.2) {      // 被投中過的動物：身邊偶爾冒一顆小星光
      const q = catchOf(a);
      sparks.items.push({ p: new THREE.Vector3(q.c.x + (Math.random() - 0.5) * 0.25, q.c.y + Math.random() * 0.15, q.c.z + (Math.random() - 0.5) * 0.25), v: new THREE.Vector3(0, 0.12, 0), life: 0.6 });
    }
    flush(sparks, sparks.items, s => [s.p.x, s.p.y, s.p.z]);
    flush(flies, flyItems, f => { const a = f.a + t * 0.1; return [f.r * 1.4 * Math.cos(a), f.y + 0.08 * Math.sin(t * 1.3 + f.ph), f.r * 1.4 * Math.sin(a)]; });
    flies.p.material.opacity = 0.55 + 0.3 * Math.sin(t * 2);
    beasts.forEach((b, i) => {                                         // 動物的光：剛投中大亮、之後輕輕閃
      pulse[b.k] = Math.max(0, (pulse[b.k] || 0) - dt * 0.8);
      b.glow(pulse[b.k] * 0.6 + (lit[b.k] ? 0.06 + 0.06 * Math.sin(t * 2.4 + i) : 0));
    });
    for (const r of ripples) {
      r.t += dt; const s = 0.04 + r.t * 0.45;
      r.m.scale.set(s, s, 1); r.m.material.opacity = r.amp * 0.6 * Math.pow(Math.max(0, 1 - r.t / 2.4), 2);
      if (r.t > 2.4) { scene.remove(r.m); r.m.material.dispose(); }
    }
    ripples = ripples.filter(r => r.t <= 2.4);
    if (Math.random() < dt * 0.35) { const a = Math.random() * 6.28, rr = 0.45 + Math.random() * 0.6; ripple(rr * Math.cos(a), rr * Math.sin(a), 0.25); }
    wat.tick(t);
    reticle.visible = !!motionAim && ready && !held;                   // 手機瞄準的落點圈
    if (reticle.visible) {
      const st = standAt(angle), tg = targetOf(motionAim, st.from, st.fwd), z = zoneOf(tg);
      reticle.position.set(tg.x, z === 'isle' ? POOL.ISLE_H + 0.005 : 0.006, tg.z);
      reticle.material.color.set(z === 'out' ? 0xf07a6e : 0xffd27a);
      reticle.scale.setScalar(1 + 0.08 * Math.sin(t * 6));
    }
    renderer.render(scene, camera);
  }

  /* ── 手指 ──
     畫面下方（硬幣附近）按住：拿起硬幣、祈禱、往上甩投出。
     其他地方左右滑：繞著池子走。 */
  const busy = () => !!coin && coin.phase !== 'rest';
  const local = (e) => { const b = canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  canvas.addEventListener('pointerdown', (e) => {
    const q = local(e), rs = restScreen();
    const near = Math.hypot(q.x - rs.x, q.y - rs.y) < Math.max(80, w * 0.22) || q.y > h * 0.66;
    canvas.setPointerCapture?.(e.pointerId);
    if (near && !busy() && !(canThrow && !canThrow())) {
      const now = e.timeStamp || performance.now();     // 用事件自己的時間：畫面卡一下也量得準
      held = { p: atScreen(q.x, q.y), s: [{ ...q, t: now }], t0: now };
      back = null; haptic(5);
    } else orbit = { x0: q.x, a0: angleGoal };
  });
  canvas.addEventListener('pointermove', (e) => {
    const q = local(e), now = e.timeStamp || performance.now();
    if (held) {
      held.p = atScreen(q.x, q.y);
      held.s.push({ ...q, t: now });
      while (held.s.length > 2 && now - held.s[0].t > 140) held.s.shift();
    } else if (orbit) angleGoal = orbit.a0 - ((q.x - orbit.x0) / w) * Math.PI * 1.1;
  });
  const release = (e, cancel) => {
    if (orbit) { orbit = null; return; }
    if (!held) return;
    const q = local(e), now = e.timeStamp || performance.now(), from = held.p;
    const all = [...held.s, { ...q, t: now }];
    let s = all.filter(x => now - x.t <= 110);
    if (s.length < 2) s = all.slice(-2);              // 手機卡了一下、點太少：用最後兩個點
    held = null;
    let a = null;
    if (!cancel && s.length >= 2) {
      const dt = Math.max(16, s[s.length - 1].t - s[0].t) / 1000;
      a = flickAim((s[s.length - 1].x - s[0].x) / dt, (s[s.length - 1].y - s[0].y) / dt, h);
    }
    if (a && launch(a, from, clamp((q.x / w - 0.5) * 0.6, -0.3, 0.3))) return;
    charge = 0; onCharge?.(null);
    back = { from, t0: performance.now() };
  };
  canvas.addEventListener('pointerup', (e) => release(e, false));
  canvas.addEventListener('pointercancel', (e) => release(e, true));

  /* ── 手機：傾斜瞄準、往前一甩投出 ── */
  let stopMotion = () => {};
  function armMotion() {
    const pm = askMotion();                         // iOS：兩種權限都要在點擊當下「同步」要
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
        if (!held) onAim?.(motionAim);
      };
      const mot = (e) => {
        const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null;
        if (!a) return;
        const m = Math.hypot(a.x, a.y, a.z || 0), now = performance.now();
        if (now < cool) return;
        if (m > peak) peak = m;
        if (peak > 11 && m < peak * 0.4) {
          peak = 0; cool = now + 1500;
          const old = hist.filter(x => x.t < now - 200).pop() || hist[0];   // 用甩之前那一瞬間的瞄準
          if (old) launch(old.a, hand.position.clone());
        }
        if (m < 3) peak *= 0.9;
      };
      addEventListener('deviceorientation', ori);
      addEventListener('devicemotion', mot);
      stopMotion = () => { removeEventListener('deviceorientation', ori); removeEventListener('devicemotion', mot); motionAim = null; };
      return true;
    });
  }

  size(); placeCamera();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => size()) : null;
  ro?.observe(host);
  raf = requestAnimationFrame(frame);

  const api = {
    armMotion,
    busy,
    /** 測試與鍵盤用：照某個瞄準投出去 */
    throwAt: (a) => launch(a, null),
    /** 繞到某個角度（弧度） */
    walkTo: (a) => { angleGoal = a; },
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro?.disconnect(); stopMotion();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      pmrem.dispose(); env.dispose(); renderer.dispose();
      canvas.remove();
    },
  };
  Object.defineProperty(host, '__pool', { value: api, configurable: true });   // 給自動測試用
  return api;
}
