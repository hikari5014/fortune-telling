/* 許願池的水 —— 自己寫的著色器（shader），不是一塊貼了圖的板子
   ──────────────────────────────────────────────────────────
   真的水有三件事：
   ・會動：幾組很淺的長波（幾公釐高）一直在推，再疊兩層細碎的小波紋；硬幣落水會盪出一圈圈漣漪
   ・透明：從正上方往下看幾乎是透的，看得到池底的磁磚和硬幣；越斜著看越像鏡子
     （這叫菲涅耳效應 —— 站在泳池邊往遠處看只看得到反光，往腳下看卻看得到底）
   ・倒影：反射的是天上的星空與月亮；月亮在水面上會有一道碎碎的亮光
   池底另外鋪一層「水光紋」：水面把光聚成會晃動的網狀亮紋，池底才有在水下的感覺。 */

import * as THREE from '../../vendor/three.module.min.js';
import { POOL } from '../engines/pool.js';
import { MOON_DIR, waterNormal } from './textures.js';

const MAXR = 10;                                   // 同時最多幾圈漣漪

const VERT = /* glsl */`
  uniform float uTime;
  uniform vec4 uRip[${MAXR}];                       // x, z, 開始時間, 強度
  varying vec3 vW; varying vec3 vN; varying vec2 vP;
  void main() {
    vec3 p = position;
    float h = 0.0; vec2 g = vec2(0.0);
    // 平靜的水面也一直在動：四組方向、長短不同的淺波
    vec2 d0 = vec2(0.96, 0.28), d1 = vec2(-0.42, 0.91), d2 = vec2(0.71, -0.70), d3 = vec2(-0.88, -0.47);
    vec4 k = vec4(13.0, 19.0, 27.0, 41.0), w = vec4(1.1, 1.5, 1.9, 2.6), a = vec4(0.0016, 0.0011, 0.0007, 0.0004);
    float s0 = dot(d0, p.xz) * k.x + uTime * w.x, s1 = dot(d1, p.xz) * k.y + uTime * w.y;
    float s2 = dot(d2, p.xz) * k.z + uTime * w.z, s3 = dot(d3, p.xz) * k.w + uTime * w.w;
    h += a.x * sin(s0) + a.y * sin(s1) + a.z * sin(s2) + a.w * sin(s3);
    g += a.x * k.x * cos(s0) * d0 + a.y * k.y * cos(s1) * d1 + a.z * k.z * cos(s2) * d2 + a.w * k.w * cos(s3) * d3;
    // 漣漪：一圈往外推的波，越推越淡
    for (int i = 0; i < ${MAXR}; i++) {
      vec4 r = uRip[i];
      float age = uTime - r.z;
      if (age > 0.0 && age < 3.2) {
        vec2 dv = p.xz - r.xy; float d = length(dv) + 1e-4;
        float front = age * 0.42;
        float env = exp(-pow((d - front) * 8.0, 2.0)) * r.w * exp(-age * 1.05) * (1.0 - age / 3.2);
        float ph = d * 52.0 - age * 13.0;
        h += 0.0055 * env * sin(ph);
        g += 0.0055 * env * 52.0 * cos(ph) * (dv / d);
      }
    }
    // 靠近池壁的地方波浪收小，不會穿到石頭裡
    float edge = 1.0 - smoothstep(${(POOL.R - 0.06).toFixed(3)}, ${POOL.R.toFixed(3)}, length(p.xz));
    p.y += h * edge; g *= edge;
    vN = normalize(vec3(-g.x, 1.0, -g.y));
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vW = wp.xyz; vP = p.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const FRAG = /* glsl */`
  uniform float uTime;
  uniform sampler2D uSky; uniform sampler2D uNormal;
  uniform vec3 uMoon; uniform vec3 uTint;
  varying vec3 vW; varying vec3 vN; varying vec2 vP;
  vec3 sky(vec3 d) {                                 // equirect 星空（canvas 是 sRGB，自己轉成線性）
    float u = atan(d.z, d.x) * 0.15915494 + 0.5;
    float v = asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5;
    return pow(texture2D(uSky, vec2(u, v)).rgb, vec3(2.2));
  }
  void main() {
    vec3 n1 = texture2D(uNormal, vP * 1.7 + vec2(uTime * 0.021, uTime * 0.013)).xyz * 2.0 - 1.0;
    vec3 n2 = texture2D(uNormal, vP * 2.9 - vec2(uTime * 0.016, -uTime * 0.024)).xyz * 2.0 - 1.0;
    vec3 n = normalize(vN + vec3(n1.x + n2.x, 0.0, n1.y + n2.y) * 0.07);
    vec3 V = normalize(cameraPosition - vW);
    float ndv = clamp(dot(n, V), 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    vec3 R = reflect(-V, n); R.y = abs(R.y);
    vec3 refl = sky(R) * 1.4;
    vec3 m = normalize(uMoon);
    float glint = pow(max(dot(R, m), 0.0), 600.0) * 6.0 + pow(max(dot(R, m), 0.0), 60.0) * 0.35;
    vec3 col = mix(uTint, refl, fres) + glint * vec3(1.0, 0.94, 0.82);
    float alpha = clamp(0.16 + fres * 0.8 + glint * 0.6, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/* 池底的水光紋：幾組會飄的正弦網，交會的地方特別亮 */
const CAUS_FRAG = /* glsl */`
  uniform float uTime; varying vec2 vP;
  float c(vec2 p, float t) {
    float v = sin(p.x * 7.0 + t * 0.9 + sin(p.y * 5.0 + t * 0.7))
            + sin(p.y * 8.0 - t * 0.8 + sin(p.x * 6.0 - t * 0.5))
            + sin((p.x + p.y) * 6.0 + t * 0.6 + sin(p.x * 3.0 - t * 0.4));
    return pow(1.0 - abs(v) / 3.0, 7.0);
  }
  void main() {
    float r = length(vP);
    float mask = (1.0 - smoothstep(${(POOL.R - 0.08).toFixed(3)}, ${POOL.R.toFixed(3)}, r)) * smoothstep(${POOL.ISLE_R.toFixed(3)}, ${(POOL.ISLE_R + 0.06).toFixed(3)}, r);
    float v = c(vP * 1.6, uTime) * 0.7 + c(vP * 2.3 + 3.1, uTime * 1.3) * 0.5;
    gl_FragColor = vec4(vec3(0.45, 0.72, 0.95) * v * 0.55 * mask, 1.0);
  }`;
const CAUS_VERT = /* glsl */`
  varying vec2 vP;
  void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function makeWater(skyTex) {
  const normal = waterNormal();
  const rips = Array.from({ length: MAXR }, () => new THREE.Vector4(0, 0, -99, 0));
  const uniforms = {
    uTime: { value: 0 }, uSky: { value: skyTex }, uNormal: { value: normal },
    uMoon: { value: MOON_DIR.clone() }, uTint: { value: new THREE.Color(0x0c2a4a) }, uRip: { value: rips },
  };
  // 細切的圓環：中間讓給石島，外圈到池壁；切得夠細，波浪才彎得起來
  const geo = new THREE.RingGeometry(POOL.ISLE_R * 0.85, POOL.R, 180, 56);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 2;

  const cgeo = new THREE.CircleGeometry(POOL.R, 96); cgeo.rotateX(-Math.PI / 2);
  const cmat = new THREE.ShaderMaterial({ uniforms: { uTime: uniforms.uTime }, vertexShader: CAUS_VERT, fragmentShader: CAUS_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const caustics = new THREE.Mesh(cgeo, cmat); caustics.position.y = -POOL.DEPTH + 0.003; caustics.renderOrder = 1;

  let next = 0;
  return {
    mesh, caustics,
    tick(t) { uniforms.uTime.value = t; },
    /** 盪一圈漣漪（x, z 世界座標；amp 0～1） */
    ripple(x, z, amp = 1) { rips[next].set(x, z, uniforms.uTime.value, amp); next = (next + 1) % MAXR; },
  };
}
