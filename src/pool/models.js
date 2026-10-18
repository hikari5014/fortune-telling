/* 許願池的 3D 模型 —— 全部用基本形狀組出來（球、圓柱、旋轉體），不載入模型檔
   座標跟 src/engines/pool.js 完全一樣：每隻動物都在「往外 +z、往上 +y」的區域座標裡蓋，
   位置直接用物理裡的數字（out → z、h → y），再整組轉到牠面朝的方向 —— 看到的嘴、碗，
   就是物理判斷「投進去」的那個位置。 */

import * as THREE from '../../vendor/three.module.min.js';
import { POOL, ANIMALS } from '../engines/pool.js';
import * as TX from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sphere = (mat, s, p, seg = 32) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)), mat); m.scale.set(...s); m.position.set(...p); m.castShadow = true; return m; };
const lathe = (pts, mat, seg = 48) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat); m.castShadow = true; m.receiveShadow = true; return m; };

/* ── 材質 ─────────────────────────────────────────── */
export function materials() {
  const stoneTex = TX.stone(1);
  return {
    stone: new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xd6d9e4, roughness: 0.78, metalness: 0.02, bumpMap: stoneTex, bumpScale: 0.004 }),
    rock: new THREE.MeshStandardMaterial({ map: TX.stone(7, [70, 80, 78]), color: 0x8a958c, roughness: 0.9 }),
    tiles: new THREE.MeshStandardMaterial({ map: TX.tiles(), roughness: 0.55 }),
    plaza: new THREE.MeshStandardMaterial({ map: TX.plaza(), roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9ad55, metalness: 0.95, roughness: 0.26 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0xa8763a, metalness: 0.9, roughness: 0.35 }),
    jade: new THREE.MeshPhysicalMaterial({ map: TX.shell(), color: 0x9fe0bd, roughness: 0.25, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    jadeSkin: new THREE.MeshPhysicalMaterial({ color: 0x3f8a64, roughness: 0.3, clearcoat: 0.5 }),
    whiteJade: new THREE.MeshPhysicalMaterial({ color: 0xf1ede2, roughness: 0.32, clearcoat: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xfff3e0) }),
    porcelain: new THREE.MeshPhysicalMaterial({ map: TX.koiSkin(), roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x3a0e0a, roughness: 0.9, side: THREE.DoubleSide }),
    eye: new THREE.MeshStandardMaterial({ color: 0x0b0b0f, roughness: 0.15, metalness: 0.3 }),
    redEye: new THREE.MeshStandardMaterial({ color: 0xc0222a, roughness: 0.2, emissive: 0x400008 }),
    lip: new THREE.MeshPhysicalMaterial({ color: 0xe8908a, roughness: 0.3, clearcoat: 0.6 }),
    fin: new THREE.MeshPhysicalMaterial({ color: 0xf3d9cc, roughness: 0.3, transmission: 0.3, thickness: 0.01, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
    lampLight: new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffb455, emissiveIntensity: 2.2 }),
  };
}

/* ── 石池、池底、水、石島、廣場、樹林 ─────────────────── */
export function pool(M) {
  const g = new THREE.Group(), { R, RIM_W, RIM_H, GROUND, DEPTH } = POOL;
  // 石緣：一條剖面繞一圈（內壁 → 圓角 → 頂面 → 圓角 → 外牆）
  const prof = [[R, -DEPTH], [R, RIM_H - 0.025], [R + 0.008, RIM_H - 0.006], [R + 0.025, RIM_H], [R + RIM_W - 0.025, RIM_H],
    [R + RIM_W - 0.006, RIM_H - 0.008], [R + RIM_W, RIM_H - 0.03], [R + RIM_W + 0.01, GROUND + 0.04], [R + RIM_W + 0.04, GROUND]];
  const rimMat = M.stone.clone(); rimMat.map = M.stone.map.clone(); rimMat.map.repeat.set(10, 1); rimMat.map.needsUpdate = true;
  const rim = lathe(prof.reverse(), rimMat, 160);     // 由外往內排，面才朝外（不然整圈是黑的）
  g.add(rim);
  // 頂面一圈金色嵌線
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(R + RIM_W / 2, 0.004, 6, 160), M.gold);
  inlay.rotation.x = Math.PI / 2; inlay.position.y = RIM_H + 0.001; g.add(inlay);
  // 池底
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 96), M.tiles);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -DEPTH; floor.receiveShadow = true; g.add(floor);
  return g;
}

export function water(envMap) {
  const nm = TX.waterNormal();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x16346e, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.74,
    normalMap: nm, normalScale: new THREE.Vector2(0.22, 0.22), envMap, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(POOL.R, 128), mat);
  m.rotation.x = -Math.PI / 2; m.renderOrder = 2;
  return { mesh: m, tick: (t) => { nm.offset.set(t * 0.012, t * 0.008); } };
}

export function island(M) {
  const { ISLE_R, ISLE_H, DEPTH } = POOL, h = ISLE_H + DEPTH;
  const geo = new THREE.CylinderGeometry(ISLE_R * 0.92, ISLE_R * 1.12, h, 64, 6);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {          // 凹凸：岩石不會是正圓柱
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x), n = 1 + 0.06 * Math.sin(a * 5 + v.y * 9) + 0.04 * Math.sin(a * 11 - v.y * 17);
    v.x *= n; v.z *= n;
    if (v.y > h / 2 - 0.001) v.y += 0.012 * Math.cos(Math.hypot(v.x, v.z) * 9);   // 頂面微微隆起
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M.rock);
  m.position.y = ISLE_H - h / 2; m.castShadow = m.receiveShadow = true;
  return m;
}

export function ground(M) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CircleGeometry(14, 120), M.plaza);
  p.rotation.x = -Math.PI / 2; p.position.y = POOL.GROUND; p.receiveShadow = true; g.add(p);
  const trees = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 4, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: TX.treeline(), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  trees.position.y = POOL.GROUND + 1.6; g.add(trees);
  return g;
}

/** 石燈籠：台座、竿、中台、火袋（亮）、笠、寶珠 */
export function lantern(M) {
  const g = new THREE.Group();
  const add = (geo, mat, y, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.y = ry; m.castShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.16, 0.19, 0.08, 6), M.stone, 0.04);
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 16), M.stone, 0.28);
  add(new THREE.CylinderGeometry(0.15, 0.12, 0.06, 6), M.stone, 0.5);
  add(new THREE.BoxGeometry(0.17, 0.15, 0.17), M.lampLight, 0.6);
  for (const [x, z] of [[-0.075, -0.075], [0.075, -0.075], [-0.075, 0.075], [0.075, 0.075]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), M.stone); post.position.set(x, 0.6, z); g.add(post);
  }
  add(new THREE.ConeGeometry(0.26, 0.14, 4), M.stone, 0.75, Math.PI / 4);
  add(new THREE.SphereGeometry(0.035, 12, 8), M.stone, 0.84);
  return g;
}

/* ── 四隻動物 ─────────────────────────────────────── */
const deg = Math.PI / 180;

/** 金蟾：張著大嘴、口朝外上方 —— 嘴的位置＝物理的接住區 */
function frog(M, a) {
  const g = new THREE.Group(), c = a.catch, tilt = c.tilt * deg;
  const mat = M.gold;
  g.add(sphere(mat, [0.13, 0.095, 0.14], [0, 0.1, 0.36]));
  for (const s of [-1, 1]) {
    g.add(sphere(mat, [0.06, 0.05, 0.085], [s * 0.1, 0.055, 0.3]));
    g.add(sphere(mat, [0.03, 0.065, 0.03], [s * 0.085, 0.06, 0.45]));
    g.add(sphere(mat, [0.045, 0.018, 0.04], [s * 0.095, 0.012, 0.47]));
  }
  // 上顎往後仰、下顎往前：中間張開的就是嘴
  const up = sphere(mat, [0.105, 0.05, 0.1], [0, 0.215, 0.425]); up.rotation.x = -tilt - 0.35; g.add(up);
  const low = sphere(mat, [0.1, 0.035, 0.09], [0, 0.135, 0.46]); low.rotation.x = -tilt + 0.25; g.add(low);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(c.r * 0.85, 32), M.mouth);
  mouth.position.set(0, c.h, c.out); mouth.lookAt(0, c.h + Math.cos(tilt), c.out + Math.sin(tilt)); g.add(mouth);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(c.r * 0.88, 0.011, 10, 40), mat);
  lip.position.copy(mouth.position); lip.quaternion.copy(mouth.quaternion); g.add(lip);
  for (const s of [-1, 1]) {
    g.add(sphere(mat, [0.032, 0.032, 0.032], [s * 0.055, 0.265, 0.39], 20));
    g.add(sphere(M.redEye, [0.016, 0.016, 0.016], [s * 0.058, 0.275, 0.415], 12));
  }
  return g;
}

/** 靈龜：翠玉的殼，背上一只金碗（碗口＝接住區） */
function turtle(M, a) {
  const g = new THREE.Group(), c = a.catch;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.jade);
  shell.scale.set(0.17, 0.13, 0.2); shell.position.set(0, 0.06, c.out); shell.castShadow = true; g.add(shell);
  const rimS = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), M.jadeSkin);
  rimS.scale.set(0.17, 0.2, 0.17); rimS.rotation.x = Math.PI / 2; rimS.position.set(0, 0.06, c.out); g.add(rimS);
  g.add(sphere(M.jadeSkin, [0.05, 0.045, 0.07], [0, 0.11, c.out + 0.2]));
  for (const s of [-1, 1]) {
    g.add(sphere(M.eye, [0.01, 0.01, 0.01], [s * 0.03, 0.13, c.out + 0.25], 10));
    for (const dz of [-0.11, 0.11]) { const leg = sphere(M.jadeSkin, [0.05, 0.03, 0.065], [s * 0.15, 0.04, c.out + dz]); leg.rotation.y = s * dz * 4; g.add(leg); }
  }
  g.add(sphere(M.jadeSkin, [0.02, 0.02, 0.05], [0, 0.05, c.out - 0.21]));
  // 碗：外壁、碗口、內壁（旋轉體），口在物理的接住高度
  const top = c.h, rr = c.r + 0.006;
  const bowl = lathe([[0, top - 0.08], [0.045, top - 0.08], [0.05, top - 0.072], [rr * 0.82, top - 0.04], [rr, top - 0.006], [rr, top],
    [rr - 0.012, top], [rr * 0.8, top - 0.03], [0.04, top - 0.062], [0, top - 0.062]], M.gold, 48);
  bowl.position.z = c.out; g.add(bowl);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.03, 24), M.gold); stand.position.set(0, top - 0.095, c.out); g.add(stand);
  return g;
}

/** 錦鯉：從水裡躍起、嘴朝天張開（嘴＝接住區） */
function koi(M, a) {
  const g = new THREE.Group(), c = a.catch, top = c.h;
  const body = lathe([[0.012, 0.02], [0.03, 0.06], [0.06, 0.13], [0.082, 0.21], [0.088, 0.28], [0.078, 0.35], [0.064, top - 0.03], [c.r * 0.7, top]], M.porcelain, 48);
  body.scale.z = 0.8; body.position.z = c.out; g.add(body);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(c.r * 0.72, 0.012, 10, 36), M.lip);
  lip.rotation.x = Math.PI / 2; lip.position.set(0, top, c.out); lip.scale.y = 0.8; g.add(lip);
  const inside = new THREE.Mesh(new THREE.CircleGeometry(c.r * 0.68, 28), M.mouth);
  inside.rotation.x = -Math.PI / 2; inside.position.set(0, top - 0.015, c.out); g.add(inside);
  for (const s of [-1, 1]) {
    g.add(sphere(M.eye, [0.014, 0.014, 0.014], [s * 0.05, top - 0.07, c.out + 0.045], 12));
    const fin = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16, 0, Math.PI), M.fin);
    fin.position.set(s * 0.08, 0.27, c.out); fin.rotation.set(0, s * 1.2, s * 0.6); g.add(fin);
  }
  // 尾鰭：在水面上張開
  const tail = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24, -0.6, 1.2 + Math.PI / 2), M.fin);
  tail.position.set(0, 0.02, c.out); tail.rotation.set(-Math.PI / 2 + 0.3, 0, Math.PI / 2 + 0.2); g.add(tail);
  // 水花：一圈白
  const splash = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 40), new THREE.MeshStandardMaterial({ color: 0xe8f2ff, roughness: 0.2, transparent: true, opacity: 0.75 }));
  splash.rotation.x = Math.PI / 2; splash.position.set(0, 0.005, c.out); g.add(splash);
  return g;
}

/** 玉兔：白玉的月兔，面前一只搗藥的石臼（臼口＝接住區） */
function rabbit(M, a) {
  const g = new THREE.Group(), c = a.catch, mat = M.whiteJade;
  g.add(sphere(mat, [0.11, 0.13, 0.105], [0, 0.15, 0.31]));
  g.add(sphere(mat, [0.075, 0.07, 0.075], [0, 0.3, 0.33]));
  for (const s of [-1, 1]) {
    const ear = sphere(mat, [0.022, 0.09, 0.035], [s * 0.035, 0.41, 0.31], 20); ear.rotation.z = -s * 0.25; g.add(ear);
    g.add(sphere(M.redEye, [0.012, 0.012, 0.012], [s * 0.035, 0.315, 0.395], 10));
    g.add(sphere(mat, [0.04, 0.025, 0.06], [s * 0.06, 0.03, 0.37]));
    g.add(sphere(mat, [0.03, 0.03, 0.03], [s * 0.06, 0.17, 0.41], 16));     // 前爪
  }
  g.add(sphere(mat, [0.022, 0.016, 0.016], [0, 0.29, 0.405], 10));          // 鼻子
  // 杵：斜斜地舉在手上
  const pestle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.24, 12), M.bronze);
  pestle.position.set(-0.09, 0.26, 0.4); pestle.rotation.set(0.3, 0, 0.5); pestle.castShadow = true; g.add(pestle);
  // 臼：立在水中的石座上
  const top = c.h, rr = c.r + 0.004;
  const mortar = lathe([[0, -POOL.DEPTH], [0.06, -POOL.DEPTH], [0.06, 0.0], [0.075, 0.02], [rr * 0.95, top - 0.05], [rr, top],
    [rr - 0.016, top], [rr * 0.72, top - 0.05], [0, top - 0.06]], M.stone, 40);
  mortar.position.z = c.out; g.add(mortar);
  return g;
}

const BUILD = { frog, turtle, koi, rabbit };

/** 四隻動物：回傳 { k, group, glow(強度) } 的陣列 */
export function animals(M) {
  return ANIMALS.map(a => {
    const group = BUILD[a.k](M, a);
    group.rotation.y = a.phi;
    // 閃光：把這隻的材質複製一份，才能單獨調亮
    const mats = new Map();
    group.traverse(o => { if (o.isMesh) { if (!mats.has(o.material)) mats.set(o.material, o.material.clone()); o.material = mats.get(o.material); } });
    const list = [...mats.values()].filter(m => 'emissive' in m && m !== M.mouth);
    const base = list.map(m => m.emissive.clone());
    return {
      k: a.k, group,
      glow(v) {
        list.forEach((m, i) => { m.emissive.copy(base[i]).lerp(new THREE.Color(0xffc861), Math.min(0.55, v * 0.5)); m.emissiveIntensity = 1; });
      },
    };
  });
}

/* ── 硬幣 ─────────────────────────────────────────── */
export const COIN_R = 0.05;
export function coinKit() {
  const face = TX.coinFace();
  const geo = new THREE.CylinderGeometry(COIN_R, COIN_R, 0.009, 40);
  const make = (color) => {
    const side = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.32 });
    const cap = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.22, bumpMap: face, bumpScale: 0.6, emissive: 0x000000 });
    return [side, cap, cap];
  };
  return { geo, gold: make(0xf0c35a), silver: make(0xdfe4ee) };
}
