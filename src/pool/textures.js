/* 許願池用到的貼圖 —— 全部在手機上用 canvas 畫出來，不下載任何圖檔
   石頭、池底磁磚、廣場石板、星空（含月亮，水面倒影也靠它）、水波法線、硬幣浮雕。 */

import * as THREE from '../../vendor/three.module.min.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, { repeat = 1, srgb = true } = {}) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

/** 花崗石：底色＋大小斑點＋細紋 */
export function stone(seed = 1, base = [118, 122, 140]) {
  const [c, g] = cv(512), R = rng(seed);
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = (R() - 0.5) * 60, s = R() < 0.05 ? 3 : 1.2;
    g.fillStyle = `rgba(${base.map(x => Math.max(0, Math.min(255, x + v))).join(',')},.55)`;
    g.fillRect(R() * 512, R() * 512, s, s);
  }
  for (let i = 0; i < 30; i++) {
    g.strokeStyle = `rgba(40,42,60,${0.08 + R() * 0.12})`; g.lineWidth = 0.6 + R();
    g.beginPath(); let x = R() * 512, y = R() * 512; g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 80; y += (R() - 0.5) * 80; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c);
}

/** 池底：深藍馬賽克磁磚，中間一圈金色星紋 */
export function tiles() {
  const [c, g] = cv(1024), R = rng(5), n = 48, s = 1024 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = R() * 24;
    g.fillStyle = `rgb(${18 + v},${40 + v},${88 + v * 1.5})`;
    g.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
  }
  g.strokeStyle = 'rgba(227,180,90,.55)'; g.lineWidth = 6;
  for (const r of [300, 330]) { g.beginPath(); g.arc(512, 512, r, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgba(227,180,90,.5)';
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, x = 512 + 315 * Math.cos(a), y = 512 + 315 * Math.sin(a);
    g.beginPath();
    for (let i = 0; i < 8; i++) { const b = i * Math.PI / 4, rr = i % 2 ? 6 : 18; g.lineTo(x + rr * Math.cos(b), y + rr * Math.sin(b)); }
    g.fill();
  }
  return tex(c);
}

/** 廣場：一圈圈石板（給 CircleGeometry 用，UV 是正方形對應圓盤） */
export function plaza() {
  const [c, g] = cv(1024), R = rng(9);
  g.fillStyle = '#2a2f48'; g.fillRect(0, 0, 1024, 1024);
  for (let ring = 0; ring < 14; ring++) {
    const r0 = 60 + ring * 34, r1 = r0 + 34, n = 12 + ring * 5;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + ring * 0.37, a1 = ((i + 1) / n) * Math.PI * 2 + ring * 0.37, v = R() * 26;
      g.fillStyle = `rgb(${46 + v},${50 + v},${74 + v})`;
      g.beginPath(); g.arc(512, 512, r1 - 2, a0 + 0.004, a1 - 0.004); g.arc(512, 512, r0 + 2, a1 - 0.004, a0 + 0.004, true); g.closePath(); g.fill();
    }
  }
  const fade = g.createRadialGradient(512, 512, 200, 512, 512, 512);
  fade.addColorStop(0, 'rgba(10,12,30,0)'); fade.addColorStop(1, 'rgba(10,12,30,.85)');
  g.fillStyle = fade; g.fillRect(0, 0, 1024, 1024);
  return tex(c);
}

/** 月亮的方向（世界座標）：星空貼圖、月光、水面倒影都用同一個 */
export const MOON_DIR = new THREE.Vector3(0.42, 0.4, -1).normalize();

/** 星空（equirect，2:1）：漸層、銀河、星星、月亮。當背景，也當反射環境 */
export function sky() {
  const W = 2048, H = 1024, [c, g] = cv(W, H), R = rng(3);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#04061a'); gr.addColorStop(0.42, '#0f1640'); gr.addColorStop(0.5, '#242c62'); gr.addColorStop(0.52, '#141a36'); gr.addColorStop(1, '#05070f');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // 銀河：斜斜的一條淡光
  for (let i = 0; i < 2600; i++) {
    const t = R(), x = t * W, y = H * (0.18 + 0.22 * Math.sin(t * Math.PI * 2 + 1)) + (R() - 0.5) * 90;
    g.fillStyle = `rgba(200,205,255,${R() * 0.07})`; g.beginPath(); g.arc(x, y, 6 + R() * 22, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 2200; i++) {
    const y = R() * H * 0.5, s = R() < 0.06 ? 2.2 : R() < 0.3 ? 1.3 : 0.8;
    g.fillStyle = `rgba(255,${235 + R() * 20},${200 + R() * 55},${0.35 + R() * 0.65})`;
    g.beginPath(); g.arc(R() * W, y, s, 0, Math.PI * 2); g.fill();
  }
  // 月亮：three.js 的 equirect 對應 —— u = atan2(z, x)/2π + 0.5、v = asin(y)/π + 0.5（canvas 由上往下）
  const d = MOON_DIR, u = Math.atan2(d.z, d.x) / (Math.PI * 2) + 0.5, v = Math.asin(d.y) / Math.PI + 0.5;
  const mx = u * W, my = (1 - v) * H, mr = 26;
  const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 7);
  halo.addColorStop(0, 'rgba(255,236,190,.45)'); halo.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(mx, my, mr * 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fbf1d6'; g.beginPath(); g.ellipse(mx, my, mr / Math.max(0.35, Math.cos(Math.asin(d.y))), mr, 0, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 遠方的樹林剪影（圍成一圈的圓柱用）：上半透明 */
export function treeline() {
  const [c, g] = cv(2048, 256), R = rng(11);
  g.clearRect(0, 0, 2048, 256);
  g.fillStyle = '#070a1c';
  g.beginPath(); g.moveTo(0, 256);
  for (let x = 0; x <= 2048; x += 8) g.lineTo(x, 150 - 26 * Math.sin(x * 0.006 + 1) - 14 * Math.sin(x * 0.021));
  g.lineTo(2048, 256); g.fill();
  for (let i = 0; i < 160; i++) {
    const x = R() * 2048, h = 50 + R() * 90, w = 14 + R() * 18;
    g.beginPath(); g.moveTo(x - w, 200); g.quadraticCurveTo(x - w * 0.3, 200 - h * 0.6, x, 200 - h); g.quadraticCurveTo(x + w * 0.3, 200 - h * 0.6, x + w, 200); g.fill();
  }
  g.fillRect(0, 196, 2048, 60);
  const t = tex(c); t.repeat.set(2, 1); t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** 水波的法線貼圖：幾組正弦波疊起來（無縫） */
export function waterNormal() {
  const N = 256, [c, g] = cv(N), img = g.createImageData(N, N), R = rng(21);
  const waves = Array.from({ length: 7 }, () => ({ kx: Math.round(1 + R() * 5), ky: Math.round(1 + R() * 5) * (R() < 0.5 ? -1 : 1), a: 0.4 + R(), p: R() * 6.28 }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) {
      const ph = 2 * Math.PI * (w.kx * x + w.ky * y) / N + w.p, cs = Math.cos(ph) * w.a;
      dx += cs * w.kx; dy += cs * w.ky;
    }
    const n = new THREE.Vector3(-dx * 0.06, -dy * 0.06, 1).normalize(), i = (y * N + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false, repeat: 4 });
}

/** 硬幣面：外圈、內圈、四芒星（當 bumpMap 也當顏色調） */
export function coinFace() {
  const [c, g] = cv(256);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#777'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(128, 128, 88, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#666'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? 16 : 62; g.lineTo(128 + r * Math.cos(a), 128 + r * Math.sin(a)); }
  g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 柔光點（光暈、星火、流星尾巴、螢火蟲共用） */
export function glow() {
  const [c, g] = cv(128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,240,200,.85)'); gr.addColorStop(0.5, 'rgba(255,214,120,.25)'); gr.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 錦鯉的花紋：白底、大塊的紅斑 */
export function koiSkin() {
  const [c, g] = cv(512), R = rng(31);
  g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = `rgba(${200 + R() * 30},${40 + R() * 30},${30 + R() * 20},.95)`;
    g.beginPath(); g.ellipse(R() * 512, R() * 512, 40 + R() * 90, 30 + R() * 70, R() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let y = 0; y < 512; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < 512; x += 10) {   // 鱗片
    g.strokeStyle = 'rgba(120,80,60,.12)'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI); g.stroke();
  }
  return tex(c);
}

/** 龜殼：六角紋 */
export function shell() {
  const [c, g] = cv(512);
  g.fillStyle = '#2f6b4f'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(12,40,26,.75)'; g.lineWidth = 6;
  const r = 46;
  for (let row = -1; row < 8; row++) for (let col = -1; col < 8; col++) {
    const x = col * r * 1.75 + (row % 2 ? r * 0.87 : 0), y = row * r * 1.5;
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
    g.closePath(); g.stroke();
    g.fillStyle = 'rgba(160,220,180,.12)'; g.fill();
  }
  return tex(c);
}
