/* 西洋占星：太陽 / 月亮星座、上升、中天、宮位起點 */
import { jdFromUTC, sunLongitude, moonLongitude, obliquity, norm360, trueSolarOffsetMinutes, ttFromUT } from './calendar.js';
import { HOUSE_WEN } from '../data/wenyan.js';
import { allPlanets, PLANETS } from './planets.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sin = (d) => Math.sin(d * D2R), cos = (d) => Math.cos(d * D2R), tan = (d) => Math.tan(d * D2R);

export const SIGNS = [
  { zh: '牡羊座', en: 'Aries',  el: '火', mode: '本位', ruler: '火星' },
  { zh: '金牛座', en: 'Taurus', el: '土', mode: '固定', ruler: '金星' },
  { zh: '雙子座', en: 'Gemini', el: '風', mode: '變動', ruler: '水星' },
  { zh: '巨蟹座', en: 'Cancer', el: '水', mode: '本位', ruler: '月亮' },
  { zh: '獅子座', en: 'Leo',    el: '火', mode: '固定', ruler: '太陽' },
  { zh: '處女座', en: 'Virgo',  el: '土', mode: '變動', ruler: '水星' },
  { zh: '天秤座', en: 'Libra',  el: '風', mode: '本位', ruler: '金星' },
  { zh: '天蠍座', en: 'Scorpio',el: '水', mode: '固定', ruler: '冥王星' },
  { zh: '射手座', en: 'Sagittarius', el: '火', mode: '變動', ruler: '木星' },
  { zh: '摩羯座', en: 'Capricorn',   el: '土', mode: '本位', ruler: '土星' },
  { zh: '水瓶座', en: 'Aquarius',    el: '風', mode: '固定', ruler: '天王星' },
  { zh: '雙魚座', en: 'Pisces',      el: '水', mode: '變動', ruler: '海王星' },
];
/** 第 i 宮（1–12）的主題 */
export const houseMeaning = (i, reg = 'bai') =>
  (reg === 'wen' ? HOUSE_WEN[i - 1] : HOUSE_MEANING[i - 1]) || '';

export const HOUSE_MEANING = [
  '自我與外顯', '金錢與資源', '溝通與學習', '家庭與根源', '創造與戀愛', '工作與健康',
  '伴侶與合作', '共有與轉化', '信念與遠方', '事業與名聲', '社群與理想', '潛意識與休息',
];

export const signOf = (lon) => Math.floor(norm360(lon) / 30);
export const degInSign = (lon) => norm360(lon) % 30;
export const fmtLon = (lon) => {
  const d = degInSign(lon);
  const deg = Math.floor(d), min = Math.round((d - deg) * 60);
  return `${SIGNS[signOf(lon)].zh} ${deg}°${String(min).padStart(2, '0')}′`;
};

/** 格林威治恆星時（度） */
function gmstDeg(jdUT) {
  const T = (jdUT - 2451545) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jdUT - 2451545)
    + 0.000387933 * T * T - T ** 3 / 38710000);
}

/**
 * 計算本命星盤基本要素
 * @param {object} o {y,m,d,h,minute,tz,lat,lon,trueSolarTime}
 */
export function natalChart({ y, m, d, h = 12, minute = 0, tz = 8, lat = 25.033, lon = 121.565, trueSolarTime = false, outer = true }) {
  let jd = jdFromUTC(y, m, d, h + minute / 60) - tz / 24;      // UT
  let solarCorrection = 0;
  if (trueSolarTime) {
    solarCorrection = trueSolarOffsetMinutes(jd, lon, tz);
    jd += solarCorrection / 1440;
  }
  const sunLon = sunLongitude(jd);
  const moonLon = moonLongitude(jd);
  const eps = obliquity(jd);
  const lst = norm360(gmstDeg(jd) + lon);                       // 本地恆星時（度）= RAMC

  // 上升
  let asc = Math.atan2(cos(lst), -(sin(lst) * cos(eps) + tan(lat) * sin(eps))) * R2D;
  asc = norm360(asc);
  // 中天
  let mc = Math.atan2(sin(lst), cos(lst) * cos(eps)) * R2D;
  mc = norm360(mc);
  if (norm360(asc - mc) > 180) mc = norm360(mc + 180);

  const houses = Array.from({ length: 12 }, (_, i) => norm360(asc + i * 30));   // 等宮制

  // 行星：地心黃經（當日黃道），含每日速度與順逆
  const jde = ttFromUT(jd);
  const planets = allPlanets(jde, { outer });

  const bodies = [
    { key: 'sun',  zh: '太陽', sym: '☉', lon: sunLon, speed: sunLongitude(jd + 1) - sunLon },
    { key: 'moon', zh: '月亮', sym: '☾', lon: moonLon },
    { key: 'asc',  zh: '上升', sym: 'AC', lon: asc },
    { key: 'mc',   zh: '中天', sym: 'MC', lon: mc },
    { key: 'dsc',  zh: '下降', sym: 'DC', lon: norm360(asc + 180) },
    { key: 'ic',   zh: '天底', sym: 'IC', lon: norm360(mc + 180) },
    ...planets.map(p => ({ key: p.key, zh: p.zh, sym: p.sym, lon: p.lon, lat: p.lat,
                           speed: p.speed, retro: p.retro, outer: p.outer, about: p.text })),
  ].map(b => ({
    ...b,
    sign: signOf(b.lon), signName: SIGNS[signOf(b.lon)].zh,
    deg: degInSign(b.lon), text: fmtLon(b.lon),
    house: (Math.floor(norm360(b.lon - asc) / 30) + 1),
  }));

  // 日月相位角
  const phase = norm360(moonLon - sunLon);
  const phaseName = ['新月', '眉月', '上弦月', '盈凸月', '滿月', '虧凸月', '下弦月', '殘月'][Math.floor(norm360(phase + 22.5) / 45)];

  // 元素分布：日月 + 水金火木土（占星的標準算數），另外保留日月升三顆的版本
  const CORE = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const elCount = { 火: 0, 土: 0, 風: 0, 水: 0 };
  bodies.filter(b => CORE.includes(b.key)).forEach(b => elCount[SIGNS[b.sign].el]++);
  const elBig3 = { 火: 0, 土: 0, 風: 0, 水: 0 };
  bodies.slice(0, 3).forEach(b => elBig3[SIGNS[b.sign].el]++);

  return {
    jd, solarCorrection, lst, eps, asc, mc, houses, bodies,
    sun: bodies[0], moon: bodies[1], ascendant: bodies[2], midheaven: bodies[3],
    moonPhase: { angle: phase, name: phaseName, illum: (1 - cos(phase)) / 2 },
    elements: elCount, elementsBig3: elBig3,
    planets: bodies.filter(b => PLANETS.some(p => p.key === b.key)),
    aspects: natalAspects(bodies),
  };
}

/* ── 相位 ─────────────────────────────────────────── */
/* 定義放在這裡（合盤也用同一份），避免 astro ↔ synastry 互相 import */
export const ASPECTS = [
  { key: 'conj', zh: '合相', sym: '☌', deg: 0,   orb: 8, score: 3,  text: '能量疊加，最直接的牽引' },
  { key: 'sext', zh: '六分', sym: '⚹', deg: 60,  orb: 5, score: 2,  text: '順手的協助，需要主動使用' },
  { key: 'squa', zh: '四分', sym: '□', deg: 90,  orb: 6, score: -2, text: '摩擦與推力，會逼你改變' },
  { key: 'trin', zh: '三分', sym: '△', deg: 120, orb: 7, score: 3,  text: '自然流暢，用起來省力' },
  { key: 'oppo', zh: '對分', sym: '☍', deg: 180, orb: 8, score: -1, text: '互補也互相拉扯，容易投射' },
];

/** 兩個黃經之間的相位；沒有就回傳 null */
export function aspectBetween(lonA, lonB, tighten = 1) {
  let d = Math.abs(norm360(lonA - lonB));
  if (d > 180) d = 360 - d;
  for (const a of ASPECTS) {
    const off = Math.abs(d - a.deg);
    const orb = a.orb * tighten;
    if (off <= orb) return { ...a, exact: d, orb: off, strength: 1 - off / orb };
  }
  return null;
}

/* 容許度依星體調整：日月放寬，外行星收緊 */
const ORB_W = { sun: 1.15, moon: 1.15, asc: 1, mc: 1, uranus: .75, neptune: .75, pluto: .75 };
const ASPECT_KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc'];

/** 同一張盤內的相位 */
export function natalAspects(bodies) {
  const list = bodies.filter(b => ASPECT_KEYS.includes(b.key));
  const out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    // 上升與中天本來就差 90° 上下，兩者之間的相位沒有意義
    if ((a.key === 'asc' && b.key === 'mc') || (a.key === 'mc' && b.key === 'asc')) continue;
    if ((a.key === 'sun' && b.key === 'mercury') || (a.key === 'mercury' && b.key === 'sun')) {
      // 水星永遠不離太陽 28°，合相是常態，仍列出但標明
    }
    const asp = aspectBetween(a.lon, b.lon, Math.min(ORB_W[a.key] ?? 1, ORB_W[b.key] ?? 1));
    if (!asp) continue;
    out.push({
      a: a.zh, b: b.zh, aKey: a.key, bKey: b.key,
      aSym: a.sym, bSym: b.sym,
      ...asp,
      label: `${a.zh} ${asp.zh} ${b.zh}`,
      tight: asp.orb < 2,
    });
  }
  return out.sort((x, y) => x.orb - y.orb);
}

/** 生成命盤 SVG（黑白線稿）
 * @param {object} chart natalChart 的結果
 * @param {object} o {fx 特效等級 'off'|'subtle'|'full'}
 */
export function wheelSVG(chart, { fx = 'full' } = {}) {
  const R = 190, cx = 200, cy = 200;
  const anim = fx !== 'off';
  const rich = fx === 'full';
  const pt = (lonDeg, r) => {
    const a = (180 + (lonDeg - chart.asc)) * D2R;      // 上升置於左側（0°）
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const f = (n) => n.toFixed(1);
  let s = `<svg class="wheel${anim ? ' wheel--fx' : ''}" viewBox="0 0 400 400" role="img" aria-label="本命盤">`;

  // 底層的細微星塵，只在完整特效下出現
  if (rich) {
    s += `<defs><radialGradient id="w-veil" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="currentColor" stop-opacity="0"/>
      <stop offset="100%" stop-color="currentColor" stop-opacity=".07"/></radialGradient></defs>`;
    s += `<circle class="w-veil" cx="${cx}" cy="${cy}" r="${R}" fill="url(#w-veil)"/>`;
  }

  s += `<circle class="w-ring w-ring--bold" cx="${cx}" cy="${cy}" r="${R}"/>`;
  s += `<circle class="w-ring" cx="${cx}" cy="${cy}" r="${R - 26}"/>`;
  s += `<circle class="w-ring" cx="${cx}" cy="${cy}" r="${R - 78}"/>`;

  // 極慢自轉的刻度環：一圈兩分鐘，慢到不會讓人分心，但盤是「活的」
  s += `<g class="w-ticks"${rich ? ' data-spin="1"' : ''} style="transform-origin:${cx}px ${cy}px">`;
  for (let i = 0; i < 360; i += 5) {
    const [x1, y1] = pt(i, R), [x2, y2] = pt(i, i % 30 === 0 ? R - 26 : R - (i % 15 === 0 ? 12 : 7));
    s += `<line class="w-tick" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-width="${i % 30 === 0 ? 1.2 : .6}"/>`;
  }
  s += `</g>`;

  SIGNS.forEach((sg, i) => {
    const [x, y] = pt(i * 30 + 15, R - 13);
    s += `<text class="w-sign" x="${f(x)}" y="${f(y + 3)}" text-anchor="middle" style="--i:${i}">${sg.zh[0]}${sg.zh[1]}</text>`;
  });
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = pt(chart.houses[i], R - 78), [x2, y2] = pt(chart.houses[i], R - 26);
    s += `<line class="w-tick" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-dasharray="3 3"/>`;
    const [hx, hy] = pt(chart.houses[i] + 15, R - 70);
    s += `<text class="w-sign" x="${f(hx)}" y="${f(hy + 3)}" text-anchor="middle">${i + 1}</text>`;
  }

  // 相位連線：在內圈把有相位的星體連起來。和諧相位實線、緊張相位虛線，
  // 容許度越小畫得越實 —— 好看，而且是真的資訊
  if (rich && chart.aspects?.length) {
    s += `<g class="w-aspects">`;
    const byKey = Object.fromEntries(chart.bodies.map(b => [b.key, b]));
    chart.aspects.filter(a => a.aKey !== 'asc' && a.bKey !== 'asc' && a.aKey !== 'mc' && a.bKey !== 'mc')
      .forEach((a, i) => {
        const A = byKey[a.aKey], B = byKey[a.bKey];
        if (!A || !B) return;
        const [x1, y1] = pt(A.lon, R - 80), [x2, y2] = pt(B.lon, R - 80);
        const strength = (0.18 + 0.52 * a.strength).toFixed(2);
        s += `<line class="w-asp ${a.score > 0 ? 'is-easy' : 'is-hard'}" style="--i:${i};--o:${strength}"
          x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
      });
    s += `</g>`;
  }

  // 上升–下降、天頂–天底 軸線
  [[chart.asc, chart.asc + 180], [chart.mc, chart.mc + 180]].forEach(([a, b]) => {
    const [x1, y1] = pt(a, R - 26), [x2, y2] = pt(b, R - 26);
    s += `<line class="w-axis${anim ? ' w-anim' : ''}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-dasharray="600"/>`;
  });

  // 星體：角距太近的往內縮一圈，避免疊在一起看不清
  const SHOW = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc'];
  const drawn = [];
  chart.bodies.filter(b => SHOW.includes(b.key))
    .slice().sort((a, b) => a.lon - b.lon)
    .forEach((b, idx) => {
      const gap = (d) => Math.abs(((d.lon - b.lon + 540) % 360) - 180);
      let ring = 0;
      while (ring < 2 && drawn.some(d => d.ring === ring && gap(d) < 10)) ring++;
      drawn.push({ lon: b.lon, ring });
      const [x, y] = pt(b.lon, R - 50 - ring * 24);
      s += `<g class="w-planet" style="--i:${idx}">`;
      // 光暈用一圈低透明度的描邊做，不用 SVG filter —— 濾鏡在手機上很貴
      if (rich) s += `<circle class="w-glow" cx="${f(x)}" cy="${f(y)}" r="17"/>`;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="12" fill="none" class="w-ring"/>`;
      s += `<text class="w-body" x="${f(x)}" y="${f(y + 4.5)}" text-anchor="middle">${b.sym || b.zh[0]}</text>`;
      if (b.retro) s += `<text class="w-retro" x="${f(x + 11)}" y="${f(y - 7)}" text-anchor="middle">R</text>`;
      s += `</g>`;
    });
  s += `</svg>`;
  return s;
}
