/* 運勢引擎：八字大運流年流月、紫微大限小限流年 */
import {
  STEMS, BRANCHES, ZODIAC, jdFromUTC, dateFromJD, nextJieJD, prevJieJD, jieNameOf,
  sunLongitude, solarTermJD, gzName, gzIndexOf, nayin, fourPillars, dayNumOf,
  STEM_EL, BRANCH_EL, hourBranchIndex,
} from './calendar.js';
import { PALACES, PALACE_DESC } from './ziwei.js';

/* ── 十神 ─────────────────────────────────────────── */
const EL = ['木','火','土','金','水'];
const SHI_SHEN = {
  比和同: '比肩', 比和異: '劫財',
  生同: '食神', 生異: '傷官',
  剋同: '偏財', 剋異: '正財',
  被剋同: '七殺', 被剋異: '正官',
  被生同: '偏印', 被生異: '正印',
};
/** 以日主為基準，求另一天干的十神 */
export function shiShen(dayStem, otherStem) {
  const a = EL.indexOf(STEM_EL[dayStem]), b = EL.indexOf(STEM_EL[otherStem]);
  const sameYin = (dayStem % 2) === (otherStem % 2);
  let rel;
  if (a === b) rel = '比和';
  else if ((a + 1) % 5 === b) rel = '生';        // 日主生它 → 食傷
  else if ((a + 2) % 5 === b) rel = '剋';        // 日主剋它 → 財
  else if ((b + 2) % 5 === a) rel = '被剋';      // 它剋日主 → 官殺
  else rel = '被生';                              // 它生日主 → 印
  return SHI_SHEN[rel + (sameYin ? '同' : '異')];
}

/* ── 八字大運 ─────────────────────────────────────── */
/**
 * @param {object} o {y,m,d,h,minute,tz,gender,lateZiRule}
 */
export function baziLuck({ y, m, d, h = 12, minute = 0, tz = 8, gender = '女', lateZiRule = 'next', steps = 9 }) {
  const pillars = fourPillars({ y, m, d, h, minute, tz, lateZiRule });
  const jdBirth = jdFromUTC(y, m, d, h + minute / 60) - tz / 24;

  const yangYear = pillars.year.index % 2 === 0;        // 甲丙戊庚壬 為陽
  const male = gender === '男';
  const forward = (yangYear && male) || (!yangYear && !male);   // 陽男陰女順排

  const boundary = forward ? nextJieJD(jdBirth) : prevJieJD(jdBirth);
  const days = Math.abs(boundary - jdBirth);
  const startYears = days / 3;                          // 三日折一年
  const startWhole = Math.floor(startYears);
  const startMonths = Math.round((startYears - startWhole) * 12);
  const startJD = jdBirth + startYears * 365.2422;
  const startDate = dateFromJD(startJD);

  const list = [];
  for (let i = 0; i < steps; i++) {
    const gz = ((pillars.month.index + (forward ? i + 1 : -(i + 1))) % 60 + 60) % 60;
    const fromYear = startDate.y + i * 10;
    list.push({
      step: i + 1,
      gz, name: gzName(gz),
      stem: STEMS[gz % 10], branch: BRANCHES[gz % 12],
      nayin: nayin(gz),
      shiShen: shiShen(pillars.day.index % 10, gz % 10),
      fromAge: startWhole + i * 10, toAge: startWhole + i * 10 + 9,
      fromYear, toYear: fromYear + 9,
    });
  }
  return {
    pillars, forward,
    direction: forward ? '順排' : '逆排',
    startAge: { years: startWhole, months: startMonths },
    startYear: startDate.y,
    boundaryTerm: jieNameOf(sunLongitude(boundary)),
    boundaryDate: dateFromJD(boundary),
    daysToTerm: days,
    list,
  };
}

/** 某年的流年干支（以立春為界） */
export function yearPillarOf(year, tz = 8) {
  return ((year - 4) % 60 + 60) % 60;
}
/** 某年某月的流月干支（以節為界，month 為節氣月序：1=寅月） */
export function monthPillarOf(yearGZ, branchIndex) {
  const startStem = (yearGZ % 10 % 5) * 2 + 2;
  const stem = (startStem + ((branchIndex - 2) % 12 + 12) % 12) % 10;
  return gzIndexOf(stem, branchIndex);
}

/** 指定年份的十二個節氣月（流月） */
export function monthsOfYear(year, tz = 8) {
  const yGZ = yearPillarOf(year);
  const out = [];
  for (let i = 0; i < 12; i++) {
    const branch = (2 + i) % 12;                          // 寅月起
    const lon = (315 + i * 30) % 360;
    const guess = jdFromUTC(year, 2, 4) + i * 30.44;
    const jd = solarTermJD(lon, guess);
    const gz = monthPillarOf(yGZ, branch);
    out.push({
      index: i + 1, branch, branchName: BRANCHES[branch],
      term: jieNameOf(lon), startJD: jd, start: dateFromJD(jd),
      gz, name: gzName(gz),
    });
  }
  return out;
}

/* ── 紫微大限 / 小限 / 流年 ────────────────────────── */
const SIHUA = {
  甲: ['廉貞','破軍','武曲','太陽'], 乙: ['天機','天梁','紫微','太陰'],
  丙: ['天同','天機','文昌','廉貞'], 丁: ['太陰','天同','天機','巨門'],
  戊: ['貪狼','太陰','右弼','天機'], 己: ['武曲','貪狼','天梁','文曲'],
  庚: ['太陽','武曲','太陰','天同'], 辛: ['巨門','太陽','文曲','文昌'],
  壬: ['天梁','紫微','左輔','武曲'], 癸: ['破軍','巨門','太陰','貪狼'],
};
const HUA_LABEL = ['祿', '權', '科', '忌'];
export function sihuaOf(stemName) {
  return (SIHUA[stemName] || []).map((s, i) => ({ star: s, hua: HUA_LABEL[i], text: `${s}化${HUA_LABEL[i]}` }));
}

/** 小限起始宮：寅午戌起辰、申子辰起戌、巳酉丑起未、亥卯未起丑 */
const MINOR_START = { 寅午戌: 4, 申子辰: 10, 巳酉丑: 7, 亥卯未: 1 };
function minorStartBranch(yearBranch) {
  const b = BRANCHES[yearBranch];
  for (const k of Object.keys(MINOR_START)) if (k.includes(b)) return MINOR_START[k];
  return 4;
}

/**
 * 紫微運限
 * @param {object} chart ziweiChart() 的結果
 */
export function ziweiLimits(chart) {
  const yangYear = chart.yearGZ % 2 === 0;
  const male = chart.gender === '男';
  const forward = (yangYear && male) || (!yangYear && !male);   // 陽男陰女順行
  const ju = chart.ju.num;

  const major = [];
  for (let i = 0; i < 12; i++) {
    const branch = ((chart.life + (forward ? i : -i)) % 12 + 12) % 12;
    const p = chart.palaces[branch];
    major.push({
      step: i + 1, branch, palace: p,
      fromAge: ju + i * 10, toAge: ju + i * 10 + 9,
      sihua: sihuaOf(p.stemName),
    });
  }
  return {
    forward, direction: forward ? '順行' : '逆行',
    startAge: ju, major,
    minorStart: minorStartBranch(chart.yearGZ % 12),
    minorForward: male,
  };
}

/** 指定虛歲的小限宮位 */
export function minorLimit(limits, age) {
  const step = age - 1;
  const b = ((limits.minorStart + (limits.minorForward ? step : -step)) % 12 + 12) % 12;
  return b;
}
/** 指定虛歲落在哪一步大限 */
export function majorLimitAt(limits, age) {
  return limits.major.find(x => age >= x.fromAge && age <= x.toAge) || null;
}

/**
 * 某一年的完整運限快照
 * @param {object} o {chart, limits, year, birthYear}
 */
export function fortuneOfYear({ chart, limits, year, birthYear }) {
  const age = year - birthYear + 1;                 // 虛歲
  const yGZ = yearPillarOf(year);
  const yearBranch = yGZ % 12;
  const major = majorLimitAt(limits, age);
  const minorBranch = minorLimit(limits, age);

  return {
    year, age,
    yearGZ: yGZ, yearGZName: gzName(yGZ), zodiac: ZODIAC[yearBranch],
    yearPalace: chart.palaces[yearBranch],          // 流年命宮
    yearSihua: sihuaOf(STEMS[yGZ % 10]),
    major, majorSihua: major?.sihua || [],
    minorBranch, minorPalace: chart.palaces[minorBranch],
  };
}

/** 三方四正（本宮、對宮、兩個三合宮） */
export function triads(chart, branch) {
  return [
    { label: '本宮', p: chart.palaces[branch] },
    { label: '對宮', p: chart.palaces[(branch + 6) % 12] },
    { label: '三合', p: chart.palaces[(branch + 4) % 12] },
    { label: '三合', p: chart.palaces[(branch + 8) % 12] },
  ];
}

export { PALACES, PALACE_DESC };
