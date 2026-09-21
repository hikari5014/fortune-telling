/* 曆法引擎：儒略日、太陽/月亮黃經、二十四節氣、定朔定氣農曆、四柱干支、納音 */

export const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
export const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
export const ZODIAC = ['鼠','牛','虎','兔','龍','蛇','馬','羊','猴','雞','狗','豬'];
export const STEM_EL = ['木','木','火','火','土','土','金','金','水','水'];
export const STEM_YIN = [0,1,0,1,0,1,0,1,0,1];           // 0 陽 1 陰
export const BRANCH_EL = ['水','土','木','木','土','火','火','土','金','金','土','水'];
export const HOUR_NAMES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
export const HOUR_RANGE = ['23–01','01–03','03–05','05–07','07–09','09–11','11–13','13–15','15–17','17–19','19–21','21–23'];

export const TERMS = ['冬至','小寒','大寒','立春','雨水','驚蟄','春分','清明','穀雨','立夏','小滿','芒種',
                      '夏至','小暑','大暑','立秋','處暑','白露','秋分','寒露','霜降','立冬','小雪','大雪'];
/* 十二「節」（月柱換月點）對應太陽黃經與月支 */
const JIE = [
  { lon: 315, name: '立春', branch: 2 }, { lon: 345, name: '驚蟄', branch: 3 },
  { lon: 15,  name: '清明', branch: 4 }, { lon: 45,  name: '立夏', branch: 5 },
  { lon: 75,  name: '芒種', branch: 6 }, { lon: 105, name: '小暑', branch: 7 },
  { lon: 135, name: '立秋', branch: 8 }, { lon: 165, name: '白露', branch: 9 },
  { lon: 195, name: '寒露', branch: 10 },{ lon: 225, name: '立冬', branch: 11 },
  { lon: 255, name: '大雪', branch: 0 }, { lon: 285, name: '小寒', branch: 1 },
];

/* 六十甲子納音（每兩組一個） */
const NAYIN_PAIRS = [
  ['海中金','金'],['爐中火','火'],['大林木','木'],['路旁土','土'],['劍鋒金','金'],
  ['山頭火','火'],['澗下水','水'],['城頭土','土'],['白臘金','金'],['楊柳木','木'],
  ['泉中水','水'],['屋上土','土'],['霹靂火','火'],['松柏木','木'],['長流水','水'],
  ['沙中金','金'],['山下火','火'],['平地木','木'],['壁上土','土'],['金箔金','金'],
  ['覆燈火','火'],['天河水','水'],['大驛土','土'],['釵釧金','金'],['桑柘木','木'],
  ['大溪水','水'],['沙中土','土'],['天上火','火'],['石榴木','木'],['大海水','水'],
];

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sin = (d) => Math.sin(d * D2R), cos = (d) => Math.cos(d * D2R), tan = (d) => Math.tan(d * D2R);
export const norm360 = (x) => ((x % 360) + 360) % 360;

/* ── 儒略日 ─────────────────────────────────────────── */
export function jdFromUTC(y, m, d, hours = 0) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + hours / 24;
}
export function dateFromJD(jd) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) { const al = Math.floor((z - 1867216.25) / 36524.25); a = z + 1 + al - Math.floor(al / 4); }
  const b = a + 1524, c = Math.floor((b - 122.1) / 365.25),
        dd = Math.floor(365.25 * c), e = Math.floor((b - dd) / 30.6001);
  const day = b - dd - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const di = Math.floor(day);
  const hrs = (day - di) * 24;
  return { y: year, m: month, d: di, h: Math.floor(hrs), min: Math.round((hrs % 1) * 60) };
}
/** 某個 JD(UT) 落在哪一個「當地曆日」（回傳整數日序，可直接相減） */
export const localDay = (jd, tz) => Math.floor(jd + 0.5 + tz / 24);
/** 當地曆日（y,m,d）的日序 */
export const dayNumOf = (y, m, d) => Math.floor(jdFromUTC(y, m, d, 0) + 0.5);

/** ΔT 近似（秒）：TT − UT */
export function deltaT(year) {
  if (year >= 2005 && year < 2050) { const t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (year >= 1986 && year < 2005) { const t = year - 2000; return 63.86 + 0.3345*t - 0.060374*t*t + 0.0017275*t**3 + 0.000651814*t**4 + 0.00002373599*t**5; }
  if (year >= 1961 && year < 1986) { const t = (year - 1975) / 1; return 45.45 + 1.067*t - t*t/260 - t**3/718; }
  if (year >= 1941 && year < 1961) { const t = year - 1950; return 29.07 + 0.407*t - t*t/233 + t**3/2547; }
  if (year >= 1920 && year < 1941) { const t = year - 1920; return 21.20 + 0.84493*t - 0.076100*t*t + 0.0020936*t**3; }
  if (year >= 1900 && year < 1920) { const t = year - 1900; return -2.79 + 1.494119*t - 0.0598939*t*t + 0.0061966*t**3 - 0.000197*t**4; }
  if (year >= 2050) { const t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  return 0;
}
const ttFromUT = (jd) => jd + deltaT(dateFromJD(jd).y) / 86400;
const utFromTT = (jd) => jd - deltaT(dateFromJD(jd).y) / 86400;

/* ── 太陽 ───────────────────────────────────────────── */
/** 視黃經（度），輸入 JD(TT) */
export function sunLongitudeTT(jde) {
  const T = (jde - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M)
          + (0.019993 - 0.000101 * T) * sin(2 * M)
          + 0.000289 * sin(3 * M);
  const Om = 125.04 - 1934.136 * T;
  return norm360(L0 + C - 0.00569 - 0.00478 * sin(Om));
}
export const sunLongitude = (jdUT) => sunLongitudeTT(ttFromUT(jdUT));

/** 黃赤交角（度） */
export function obliquity(jde) {
  const T = (jde - 2451545) / 36525;
  const e0 = 23 + 26 / 60 + 21.448 / 3600 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T ** 3) / 3600;
  const Om = 125.04 - 1934.136 * T;
  return e0 + 0.00256 * cos(Om);
}

/** 太陽到達指定黃經的時刻，回傳 JD(UT) */
export function solarTermJD(targetLon, nearJD) {
  let jd = ttFromUT(nearJD);
  for (let i = 0; i < 12; i++) {
    const lon = sunLongitudeTT(jd);
    let diff = norm360(targetLon - lon + 180) - 180;
    jd += diff * (365.2422 / 360);
    if (Math.abs(diff) < 1e-8) break;
  }
  return utFromTT(jd);
}
/** 指定年份的 24 節氣（回傳 JD(UT) 陣列，自該年小寒起） */
export function termsOfYear(year) {
  const out = [];
  for (let i = 0; i < 24; i++) {
    const lon = norm360(285 + i * 15);
    const guess = jdFromUTC(year, 1, 5) + i * 15.22;
    out.push({ name: TERMS[(i + 1) % 24], lon, jd: solarTermJD(lon, guess) });
  }
  return out;
}

/* ── 月亮 ───────────────────────────────────────────── */
/** 月亮視黃經（度），主要項，誤差約 0.3°。輸入 JD(TT) */
export function moonLongitudeTT(jde) {
  const T = (jde - 2451545) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T ** 3 / 538841;
  const D  = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868;
  const M  = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699;
  const F  = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T;
  let l = 0;
  const t = [
    [6288774, 0, 1, 0, 0], [1274027, 2, -1, 0, 0], [658314, 2, 0, 0, 0], [213618, 0, 2, 0, 0],
    [-185116, 0, 0, 1, 0], [-114332, 0, 0, 0, 2], [58793, 2, -2, 0, 0], [57066, 2, -1, -1, 0],
    [53322, 2, 1, 0, 0], [45758, 2, -1, 1, 0], [-40923, 0, 1, -1, 0], [-34720, 1, 0, 0, 0],
    [-30383, 0, 1, 1, 0], [15327, 2, 0, 0, -2], [-12528, 0, 0, 1, 2], [10980, 0, 0, 1, -2],
    [10675, 4, -1, 0, 0], [10034, 0, 3, 0, 0], [8548, 4, -2, 0, 0], [-7888, 2, 1, -1, 0],
    [-6766, 2, 1, 0, 0], [-5163, 1, -1, 0, 0], [4987, 1, 1, 0, 0], [4036, 2, -1, 1, 0],
    [3994, 2, 2, 0, 0], [3861, 4, 0, 0, 0], [3665, 2, -3, 0, 0], [-2689, 0, 1, -2, 0],
    [-2602, 2, -1, 0, 2], [2390, 2, -2, -1, 0], [-2348, 1, 1, 0, 0], [2236, 2, -2, 0, 0],
    [-2120, 0, 1, 2, 0], [-2069, 0, 2, 0, 0], [2048, 2, -2, -1, 0], [-1773, 2, 1, 0, -2],
  ];
  for (const [c, d, mp, m, f] of t) l += c * Math.sin((D * d + Mp * mp + M * m + F * f) * D2R);
  return norm360(Lp + l / 1e6);
}
export const moonLongitude = (jdUT) => moonLongitudeTT(ttFromUT(jdUT));

/** 第 k 次朔的時刻，回傳 JD(UT)。k = 0 為 2000-01-06 */
export function newMoonJD(k) {
  const T = k / 1236.85;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.000000150 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M  = 2.5534 + 29.10535670 * k - 0.0000014 * T * T - 0.00000011 * T ** 3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
  const F  = 160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3;
  jde += -0.40720 * sin(Mp) + 0.17241 * E * sin(M) + 0.01608 * sin(2 * Mp) + 0.01039 * sin(2 * F)
       + 0.00739 * E * sin(Mp - M) - 0.00514 * E * sin(Mp + M) + 0.00208 * E * E * sin(2 * M)
       - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M)
       - 0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F)
       - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(Om) - 0.00007 * sin(Mp + 2 * M)
       + 0.00004 * sin(2 * Mp - 2 * F) + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F)
       + 0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F) + 0.00003 * sin(Mp - M + 2 * F)
       - 0.00002 * sin(Mp - M - 2 * F) - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
  return utFromTT(jde);
}

/* ── 定朔定氣農曆 ───────────────────────────────────── */
function winterSolsticeJD(year) { return solarTermJD(270, jdFromUTC(year, 12, 21)); }

/** 找出包含指定 JD 的朔日索引 k（使 newMoon(k) <= jd < newMoon(k+1)，以當地日比較） */
function newMoonIndexBefore(jd, tz) {
  let k = Math.floor((jd - 2451550.09766) / 29.530588861);
  for (let i = 0; i < 4; i++) {
    if (localDay(newMoonJD(k), tz) > localDay(jd, tz)) k--;
    else if (localDay(newMoonJD(k + 1), tz) <= localDay(jd, tz)) k++;
    else break;
  }
  return k;
}

/** 建構一個「歲」：從包含 year 年冬至的那個朔（＝十一月）到下一個十一月 */
function buildSui(year, tz) {
  const ws0 = winterSolsticeJD(year);
  const ws1 = winterSolsticeJD(year + 1);
  const k0 = newMoonIndexBefore(ws0, tz);
  const k1 = newMoonIndexBefore(ws1, tz);
  const count = k1 - k0;                       // 12 或 13
  const starts = [];
  for (let i = 0; i <= count; i++) starts.push(localDay(newMoonJD(k0 + i), tz));

  let leapIndex = -1;
  if (count === 13) {
    for (let i = 1; i < count; i++) {
      if (!hasZhongqi(starts[i], starts[i + 1], tz)) { leapIndex = i; break; }
    }
    if (leapIndex < 0) leapIndex = 13;          // 理論上不會發生
  }
  const months = [];
  let num = 11, lyear = year, leapUsed = false;
  for (let i = 0; i < count; i++) {
    const isLeap = (i === leapIndex);
    if (isLeap) {
      months.push({ startDay: starts[i], endDay: starts[i + 1] - 1, num: months[i - 1].num, leap: true, lunarYear: months[i - 1].lunarYear });
      leapUsed = true;
    } else {
      months.push({ startDay: starts[i], endDay: starts[i + 1] - 1, num, leap: false, lunarYear: lyear });
      num = num % 12 + 1;
      if (num === 1) { /* 下一個月才會變正月 */ }
      if (months[months.length - 1].num === 12) lyear = lyear + 1;
    }
  }
  return { months, endDay: starts[count], leapIndex };
}

/** 區間 [d0, d1) 內是否有中氣（太陽黃經 30 的倍數） */
function hasZhongqi(d0, d1, tz) {
  const jd0 = d0 - 0.5 - tz / 24;              // 當地 00:00 的 JD(UT)
  const lon = sunLongitude(jd0 + 0.01);
  const target = norm360((Math.floor(lon / 30) + 1) * 30);
  const t = solarTermJD(target, jd0 + 15);
  return localDay(t, tz) < d1;
}

const CN_NUM = ['','一','二','三','四','五','六','七','八','九','十'];
export function lunarDayName(d) {
  if (d <= 10) return '初' + CN_NUM[d];
  if (d < 20) return '十' + CN_NUM[d - 10];
  if (d === 20) return '二十';
  if (d < 30) return '廿' + CN_NUM[d - 20];
  return '三十';
}
export function lunarMonthName(m, leap) {
  const names = ['','正','二','三','四','五','六','七','八','九','十','冬','臘'];
  return (leap ? '閏' : '') + names[m] + '月';
}

/** 國曆 → 農曆 */
export function toLunar(y, m, d, tz = 8) {
  const target = dayNumOf(y, m, d);
  let sui = buildSui(y - 1, tz);
  if (target >= sui.endDay) sui = buildSui(y, tz);
  else if (target < sui.months[0].startDay) sui = buildSui(y - 2, tz);
  const mo = sui.months.find(x => target >= x.startDay && target <= x.endDay) || sui.months[0];
  return {
    year: mo.lunarYear, month: mo.num, leap: mo.leap,
    day: target - mo.startDay + 1,
    monthName: lunarMonthName(mo.num, mo.leap),
    dayName: lunarDayName(target - mo.startDay + 1),
    monthDays: mo.endDay - mo.startDay + 1,
  };
}

/* ── 干支 ───────────────────────────────────────────── */
export const gzName = (i) => STEMS[((i % 60) + 60) % 60 % 10] + BRANCHES[((i % 60) + 60) % 60 % 12];
export const gzStem = (i) => ((i % 60) + 60) % 60 % 10;
export const gzBranch = (i) => ((i % 60) + 60) % 60 % 12;
export function nayin(gzIndex) {
  const p = NAYIN_PAIRS[Math.floor((((gzIndex % 60) + 60) % 60) / 2)];
  return { name: p[0], element: p[1] };
}
/** 由干、支求 60 甲子序號 */
export function gzIndexOf(stem, branch) {
  for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i;
  return 0;
}

export function hourBranchIndex(hour) { return Math.floor(((hour + 1) % 24) / 2); }

/**
 * 四柱八字
 * @param {object} o {y,m,d,h,minute,tz,lateZiRule}
 */
export function fourPillars({ y, m, d, h = 12, minute = 0, tz = 8, lateZiRule = 'next' }) {
  const jdLocal = jdFromUTC(y, m, d, h + minute / 60) - tz / 24;   // 轉成 UT

  // 年柱：以立春為界
  const liChunThis = solarTermJD(315, jdFromUTC(y, 2, 4) - tz / 24);
  const yearForGZ = (jdLocal < liChunThis) ? y - 1 : y;
  const yearGZ = ((yearForGZ - 4) % 60 + 60) % 60;

  // 月柱：以「節」為界
  const lon = sunLongitude(jdLocal);
  let jie = JIE[0];
  for (const j of JIE) {
    const lo = j.lon, hi = (j.lon + 30) % 360;
    const inRange = lo < hi ? (lon >= lo && lon < hi) : (lon >= lo || lon < hi);
    if (inRange) { jie = j; break; }
  }
  const monthBranch = jie.branch;
  // 五虎遁：年干 → 正月(寅)天干
  const monthStemStart = (yearGZ % 10 % 5) * 2 + 2;          // 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲
  const monthStem = (monthStemStart + ((monthBranch - 2) + 12) % 12) % 10;
  const monthGZ = gzIndexOf(monthStem, monthBranch);

  // 日柱
  let dayNum = dayNumOf(y, m, d);
  const hourIdx = hourBranchIndex(h);
  if (hourIdx === 0 && h >= 23 && lateZiRule === 'next') dayNum += 1;
  const dayGZ = ((dayNum + 49) % 60 + 60) % 60;

  // 時柱：五鼠遁
  const hourStem = ((dayGZ % 10 % 5) * 2 + hourIdx) % 10;
  const hourGZ = gzIndexOf(hourStem, hourIdx);

  const mk = (i) => ({
    index: i, name: gzName(i), stem: STEMS[i % 10], branch: BRANCHES[i % 12],
    stemEl: STEM_EL[i % 10], branchEl: BRANCH_EL[i % 12], nayin: nayin(i),
  });
  return {
    year: mk(yearGZ), month: mk(monthGZ), day: mk(dayGZ), hour: mk(hourGZ),
    zodiac: ZODIAC[yearGZ % 12],
    jieqi: jie.name,
    hourName: HOUR_NAMES[hourIdx] + '時',
    hourIndex: hourIdx,
    dayMaster: STEMS[dayGZ % 10],
    dayMasterEl: STEM_EL[dayGZ % 10],
  };
}

/** 真太陽時校正（分鐘）：經度時差 + 均時差 */
export function trueSolarOffsetMinutes(jdUT, lon, tz) {
  const jde = ttFromUT(jdUT);
  const T = (jde - 2451545) / 36525;
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const lam = sunLongitudeTT(jde);
  const eps = obliquity(jde);
  const alpha = norm360(Math.atan2(cos(eps) * sin(lam), cos(lam)) * R2D);
  let E = L0 - 0.0057183 - alpha;
  E = ((E + 180) % 360 + 360) % 360 - 180;
  return E * 4 + (lon - tz * 15) * 4;
}

/** 五行相生相剋 */
export const EL_ORDER = ['木','火','土','金','水'];
export function elRelation(a, b) {
  const i = EL_ORDER.indexOf(a), j = EL_ORDER.indexOf(b);
  if (i < 0 || j < 0) return '—';
  if (i === j) return '比和';
  if ((i + 1) % 5 === j) return '生';
  if ((j + 1) % 5 === i) return '被生';
  if ((i + 2) % 5 === j) return '剋';
  return '被剋';
}
