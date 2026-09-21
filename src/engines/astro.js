/* 西洋占星：太陽 / 月亮星座、上升、中天、宮位起點 */
import { jdFromUTC, sunLongitude, moonLongitude, obliquity, norm360, trueSolarOffsetMinutes } from './calendar.js';

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
export function natalChart({ y, m, d, h = 12, minute = 0, tz = 8, lat = 25.033, lon = 121.565, trueSolarTime = false }) {
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

  const bodies = [
    { key: 'sun',  zh: '太陽', lon: sunLon },
    { key: 'moon', zh: '月亮', lon: moonLon },
    { key: 'asc',  zh: '上升', lon: asc },
    { key: 'mc',   zh: '中天', lon: mc },
    { key: 'dsc',  zh: '下降', lon: norm360(asc + 180) },
    { key: 'ic',   zh: '天底', lon: norm360(mc + 180) },
  ].map(b => ({
    ...b,
    sign: signOf(b.lon), signName: SIGNS[signOf(b.lon)].zh,
    deg: degInSign(b.lon), text: fmtLon(b.lon),
    house: (Math.floor(norm360(b.lon - asc) / 30) + 1),
  }));

  // 日月相位角
  const phase = norm360(moonLon - sunLon);
  const phaseName = ['新月', '眉月', '上弦月', '盈凸月', '滿月', '虧凸月', '下弦月', '殘月'][Math.floor(norm360(phase + 22.5) / 45)];

  const elCount = { 火: 0, 土: 0, 風: 0, 水: 0 };
  bodies.slice(0, 3).forEach(b => elCount[SIGNS[b.sign].el]++);

  return {
    jd, solarCorrection, lst, eps, asc, mc, houses, bodies,
    sun: bodies[0], moon: bodies[1], ascendant: bodies[2], midheaven: bodies[3],
    moonPhase: { angle: phase, name: phaseName, illum: (1 - cos(phase)) / 2 },
    elements: elCount,
  };
}

/** 生成命盤 SVG（黑白線稿） */
export function wheelSVG(chart) {
  const R = 190, cx = 200, cy = 200;
  const pt = (lonDeg, r) => {
    const a = (180 + (lonDeg - chart.asc)) * D2R;      // 上升置於左側（0°）
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  let s = `<svg class="wheel" viewBox="0 0 400 400" role="img" aria-label="本命盤">`;
  s += `<circle class="w-ring w-ring--bold" cx="${cx}" cy="${cy}" r="${R}"/>`;
  s += `<circle class="w-ring" cx="${cx}" cy="${cy}" r="${R - 26}"/>`;
  s += `<circle class="w-ring" cx="${cx}" cy="${cy}" r="${R - 78}"/>`;
  for (let i = 0; i < 360; i += 5) {
    const [x1, y1] = pt(i, R), [x2, y2] = pt(i, i % 30 === 0 ? R - 26 : R - (i % 15 === 0 ? 12 : 7));
    s += `<line class="w-tick" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="${i % 30 === 0 ? 1.2 : .6}"/>`;
  }
  SIGNS.forEach((sg, i) => {
    const [x, y] = pt(i * 30 + 15, R - 13);
    s += `<text class="w-sign" x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle">${sg.zh[0]}${sg.zh[1]}</text>`;
  });
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = pt(chart.houses[i], R - 78), [x2, y2] = pt(chart.houses[i], R - 26);
    s += `<line class="w-tick" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-dasharray="3 3"/>`;
    const [hx, hy] = pt(chart.houses[i] + 15, R - 70);
    s += `<text class="w-sign" x="${hx.toFixed(1)}" y="${(hy + 3).toFixed(1)}" text-anchor="middle">${i + 1}</text>`;
  }
  // 上升–下降、天頂–天底 軸線
  const axes = [[chart.asc, chart.asc + 180], [chart.mc, chart.mc + 180]];
  axes.forEach(([a, b]) => {
    const [x1, y1] = pt(a, R - 26), [x2, y2] = pt(b, R - 26);
    s += `<line class="w-axis w-anim" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-dasharray="600" />`;
  });
  const marks = { sun: '☉', moon: '☾', asc: 'AC', mc: 'MC' };
  chart.bodies.filter(b => marks[b.key]).forEach((b, i) => {
    const [x, y] = pt(b.lon, R - 52 - (i % 2) * 16);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="none" class="w-ring"/>`;
    s += `<text class="w-body" x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}" text-anchor="middle">${marks[b.key]}</text>`;
  });
  s += `</svg>`;
  return s;
}
