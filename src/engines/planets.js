/* 行星位置：水金火木土（可選天海冥）
   ──────────────────────────────────────────────────────────
   用 JPL「Approximate Positions of the Planets」的克卜勒軌道根數 + 百年變率
   （Standish，適用 1800–2050，誤差約數十角秒），解克卜勒方程得日心座標，
   減去地球日心座標成為地心座標，再加上歲差化到「當日的黃道」＝占星用的回歸黃道。

   自我驗證：用同一條鏈路把「地球日心位置 + 180°」算成太陽的地心黃經，
   必須與 calendar.js 那套完全獨立的太陽視黃經公式吻合（見 tools 的測試）。 */
import { norm360 } from './calendar.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/* a(au), e, I(°), L(°), ϖ(°), Ω(°) 與每儒略世紀的變率 */
const ELEMENTS = {
  earth:   [1.00000261,  0.01671123, -0.00001531, 100.46457166, 102.93768193,   0.0,
            0.00000562, -0.00004392, -0.01294668,  35999.37244981,   0.32327364,   0.0],
  mercury: [0.38709927,  0.20563593,  7.00497902, 252.25032350,  77.45779628,  48.33076593,
            0.00000037,  0.00001906, -0.00594749, 149472.67411175,   0.16047689,  -0.12534081],
  venus:   [0.72333566,  0.00677672,  3.39467605, 181.97909950, 131.60246718,  76.67984255,
            0.00000390, -0.00004107, -0.00078890,  58517.81538729,   0.00268329,  -0.27769418],
  mars:    [1.52371034,  0.09339410,  1.84969142,  -4.55343205, -23.94362959,  49.55953891,
            0.00001847,  0.00007882, -0.00813131,  19140.30268499,   0.44441088,  -0.29257343],
  jupiter: [5.20288700,  0.04838624,  1.30439695,  34.39644051,  14.72847983, 100.47390909,
           -0.00011607, -0.00013253, -0.00183714,   3034.74612775,   0.21252668,   0.20469106],
  saturn:  [9.53667594,  0.05386179,  2.48599187,  49.95424423,  92.59887831, 113.66242448,
           -0.00125060, -0.00050991,  0.00193609,   1222.49362201,  -0.41897216,  -0.28867794],
  uranus:  [19.18916464, 0.04725744,  0.77263783, 313.23810451, 170.95427630,  74.01692503,
           -0.00196176, -0.00004397, -0.00242939,    428.48202785,   0.40805281,   0.04240589],
  neptune: [30.06992276, 0.00859048,  1.77004347, -55.12002969,  44.96476227, 131.78422574,
            0.00026291,  0.00005105,  0.00035372,    218.45945325,   0.32241464,  -0.00508664],
  pluto:   [39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684,
           -0.00031596,  0.00005170,  0.00004818,    145.20780515,  -0.04062942,  -0.01183482],
};

export const PLANETS = [
  { key: 'mercury', zh: '水星', en: 'Mercury', sym: '☿', outer: false, text: '思考、表達、學習與交易的方式' },
  { key: 'venus',   zh: '金星', en: 'Venus',   sym: '♀', outer: false, text: '喜歡什麼、怎麼愛人、對美與錢的態度' },
  { key: 'mars',    zh: '火星', en: 'Mars',    sym: '♂', outer: false, text: '行動力、慾望、生氣與拼搏的樣子' },
  { key: 'jupiter', zh: '木星', en: 'Jupiter', sym: '♃', outer: false, text: '擴張、信念、機會來的方向' },
  { key: 'saturn',  zh: '土星', en: 'Saturn',  sym: '♄', outer: false, text: '責任、限制、最需要熬過去的功課' },
  { key: 'uranus',  zh: '天王星', en: 'Uranus',  sym: '♅', outer: true, text: '打破常規與突變（世代星，看宮位比看星座重要）' },
  { key: 'neptune', zh: '海王星', en: 'Neptune', sym: '♆', outer: true, text: '想像、消融與理想化（世代星）' },
  { key: 'pluto',   zh: '冥王星', en: 'Pluto',   sym: '♇', outer: true, text: '徹底的破壞與重生（世代星）' },
];
export const planetOf = (key) => PLANETS.find(p => p.key === key);

/** 解克卜勒方程，回傳偏近點角 E（度） */
function kepler(M, e) {
  const eDeg = R2D * e;
  let E = M + eDeg * Math.sin(M * D2R);
  for (let i = 0; i < 12; i++) {
    const dM = M - (E - eDeg * Math.sin(E * D2R));
    const dE = dM / (1 - e * Math.cos(E * D2R));
    E += dE;
    if (Math.abs(dE) < 1e-9) break;
  }
  return E;
}

/** 某顆星在 J2000 黃道座標系的日心直角座標（au） */
function heliocentric(key, T) {
  const c = ELEMENTS[key];
  const a = c[0] + c[6] * T, e = c[1] + c[7] * T, I = c[2] + c[8] * T;
  const L = c[3] + c[9] * T, peri = c[4] + c[10] * T, node = c[5] + c[11] * T;

  const w = peri - node;                       // 近日點幅角
  let M = L - peri;
  M = ((M % 360) + 540) % 360 - 180;           // 化到 −180…180
  const E = kepler(M, e);

  const xp = a * (Math.cos(E * D2R) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E * D2R);

  const cw = Math.cos(w * D2R), sw = Math.sin(w * D2R);
  const cn = Math.cos(node * D2R), sn = Math.sin(node * D2R);
  const ci = Math.cos(I * D2R), si = Math.sin(I * D2R);

  return {
    x: (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    y: (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    z: (sw * si) * xp + (cw * si) * yp,
  };
}

/** J2000 起算的累積黃道歲差（度）—— 把 J2000 黃經化到「當日的黃道」 */
export function precession(T) {
  return (5029.0966 * T + 1.11113 * T * T - 0.000006 * T * T * T) / 3600;
}

/**
 * 行星的地心黃經（當日黃道，即占星用的回歸黃道）
 * @param {string} key @param {number} jde 力學時儒略日
 * @returns {{lon:number, lat:number, dist:number}}
 */
export function planetPos(key, jde) {
  const T = (jde - 2451545.0) / 36525;
  const p = heliocentric(key, T);
  const E = heliocentric('earth', T);
  const x = p.x - E.x, y = p.y - E.y, z = p.z - E.z;
  const lon = norm360(Math.atan2(y, x) * R2D + precession(T));
  const lat = Math.atan2(z, Math.hypot(x, y)) * R2D;
  return { lon, lat, dist: Math.hypot(x, y, z) };
}

/** 由這套演算法反推的太陽地心黃經 —— 只用來跟 calendar.js 交叉驗證 */
export function sunLonFromEarth(jde) {
  const T = (jde - 2451545.0) / 36525;
  const E = heliocentric('earth', T);
  return norm360(Math.atan2(-E.y, -E.x) * R2D + precession(T));
}

/**
 * 一次算出所有行星，含每日移動速度與順逆
 * @param {number} jde 力學時儒略日
 * @param {object} o {outer 是否含天海冥}
 */
export function allPlanets(jde, { outer = true } = {}) {
  return PLANETS.filter(p => outer || !p.outer).map(p => {
    const now = planetPos(p.key, jde);
    const next = planetPos(p.key, jde + 1);
    let speed = next.lon - now.lon;
    if (speed > 180) speed -= 360;
    if (speed < -180) speed += 360;
    return { ...p, lon: now.lon, lat: now.lat, dist: now.dist, speed, retro: speed < 0 };
  });
}
