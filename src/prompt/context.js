/* 把各引擎的結果組裝成「資料積木」與變數，供提示詞注入 */
import { fourPillars, toLunar, HOUR_NAMES, lunarMonthName } from '../engines/calendar.js';
import { natalChart, SIGNS, houseMeaning } from '../engines/astro.js';
import { ziweiChart } from '../engines/ziwei.js';
import { analyzeName } from '../engines/naming.js';
import { baziLuck, ziweiLimits, fortuneOfYear, monthsOfYear, shiShen } from '../engines/fortune.js';
import { analyzeNumber, lifePath, analyzePlate } from '../engines/numbers.js';
import { analyze as baziAnalyze, toText as baziText } from '../engines/bazi.js';

export function computeAll(profile, settings) {
  if (!profile) return null;
  const { y, m, d, h = 12, minute = 0 } = profile.birth || {};
  const base = {
    y, m, d, h, minute,
    tz: profile.tz ?? settings.tzOffset,
    lat: profile.lat ?? settings.lat,
    lon: profile.lon ?? settings.lon,
  };
  const out = { profile, base };
  try { out.lunar = toLunar(y, m, d, base.tz); } catch (e) { out.lunar = null; }
  try { out.bazi = fourPillars({ ...base, lateZiRule: settings.lateZiRule }); } catch (e) { out.bazi = null; }
  try { out.astro = natalChart({ ...base, trueSolarTime: settings.trueSolarTime }); } catch (e) { out.astro = null; }
  try { out.ziwei = ziweiChart({ ...base, gender: profile.gender }); } catch (e) { out.ziwei = null; }
  try { out.life = lifePath(y, m, d, settings.register); } catch (e) { out.life = null; }
  try {
    out.luck = baziLuck({ ...base, gender: profile.gender, lateZiRule: settings.lateZiRule });
    out.limits = out.ziwei ? ziweiLimits(out.ziwei) : null;
  } catch (e) { out.luck = null; out.limits = null; }
  if (profile.surname || profile.givenName) {
    out.naming = analyzeName(profile.surname || '', profile.givenName || '',
      { overrides: profile.strokeOverrides || {}, waiRule: settings.wageWaiRule, numeralRule: settings.numeralRule !== false });
  }
  if (profile.phone) out.phone = analyzeNumber(profile.phone, { reg: settings.register });
  if (profile.plate) out.plate = analyzePlate(profile.plate, { reg: settings.register });
  return out;
}

const pad = (n) => String(n).padStart(2, '0');

/** 以純文字描述每一個資料區塊（給 LLM 讀） */
export function buildBlocks(A, settings) {
  const B = {};
  if (!A) return B;
  const p = A.profile;
  // 保密檔案：基本資料這一段不寫生日與農曆，其餘照常
  B.basic = (p.private ? [
    `姓名：${(p.surname || '') + (p.givenName || '') || '（未填）'}`,
    `性別：${p.gender || '未填'}`,
    '國曆生日：**當事人選擇不揭露**（推算已經用實際生日算完，只是不寫在這裡）',
    p.birth?.hourUnknown ? '出生時辰不詳（一律用中午 12:00 代入）' : '',
    `出生地：${p.city || settings.city}`,
  ] : [
    `姓名：${(p.surname || '') + (p.givenName || '') || '（未填）'}`,
    `性別：${p.gender || '未填'}`,
    p.birth?.hourUnknown
      ? `國曆生日：${A.base.y}-${pad(A.base.m)}-${pad(A.base.d)}　**出生時辰不詳**（以下一律用中午 12:00 代入）`
      : `國曆生日：${A.base.y}-${pad(A.base.m)}-${pad(A.base.d)} ${pad(A.base.h)}:${pad(A.base.minute)}`,
    A.lunar ? `農曆：${A.lunar.year} 年 ${A.lunar.monthName}${A.lunar.dayName}` : '',
    `出生地：${p.city || settings.city}（東經 ${A.base.lon}、北緯 ${A.base.lat}，時區 UTC${A.base.tz >= 0 ? '+' : ''}${A.base.tz}）`,
  ]).filter(Boolean).join('\n');

  if (A.bazi) {
    const z = A.bazi;
    B.bazi = [
      `四柱八字：${z.year.name} ${z.month.name} ${z.day.name} ${z.hour.name}`,
      `生肖：${z.zodiac}　節氣月令：${z.jieqi}　時辰：${z.hourName}`,
      `日主：${z.dayMaster}（${z.dayMasterEl}）`,
      `納音：年${z.year.nayin.name}、月${z.month.nayin.name}、日${z.day.nayin.name}、時${z.hour.nayin.name}`,
    ].join('\n');
    try { B.bazi_strength = baziText(baziAnalyze(z), z); } catch { /* 資料不全就略過 */ }
    B.bazi_table = ['柱\t天干\t地支\t干支五行\t納音',
      ...[['年', z.year], ['月', z.month], ['日', z.day], ['時', z.hour]]
        .map(([k, v]) => `${k}\t${v.stem}\t${v.branch}\t${v.stemEl}/${v.branchEl}\t${v.nayin.name}`)].join('\n');
  }

  if (A.astro) {
    const c = A.astro;
    B.astro = [
      `太陽：${c.sun.text}（第 ${c.sun.house} 宮）`,
      `月亮：${c.moon.text}（第 ${c.moon.house} 宮）`,
      `上升：${c.ascendant.text}`,
      `中天：${c.midheaven.text}`,
      `月相：${c.moonPhase.name}（日月相位 ${c.moonPhase.angle.toFixed(1)}°）`,
      `元素分布（日月與七政）：${Object.entries(c.elements).filter(([, v]) => v).map(([k, v]) => k + v).join('、')}`,
      '行星：',
      ...c.planets.map(p2 => `・${p2.zh}　${p2.signName} ${p2.deg.toFixed(1)}°　第 ${p2.house} 宮${p2.retro ? '　逆行' : ''}`),
    ].join('\n');
    B.astro_aspects = ['相位（依容許度由小到大，容許度越小越明顯）',
      ...c.aspects.map(x => `・${x.label}　差 ${x.orb.toFixed(2)}°${x.tight ? '（緊密）' : ''}`)].join('\n');
    B.astro_table = ['宮位\t起始星座\t宮位主題',
      ...c.houses.map((h, i) => `第${i + 1}宮\t${SIGNS[Math.floor(h / 30)].zh}\t${houseMeaning(i + 1, settings.register)}`)].join('\n');
  }

  if (A.ziwei) {
    const z = A.ziwei;
    B.ziwei = [
      `紫微斗數 — 農曆 ${z.lunar.year} 年 ${z.lunar.monthName}${z.lunar.dayName} ${z.hourName}，${z.yearGZName}年（${z.zodiac}）`,
      `五行局：${z.ju.name}（命宮納音 ${z.ju.nayin}）`,
      `命宮在${z.lifePalace.branchName}（${z.lifePalace.gz}）：${z.lifePalace.main.join('、') || '空宮'}`,
      `身宮在${z.bodyPalace.branchName}，落於${z.bodyPalace.name}`,
      `年干四化：${z.sihua.join('、')}`,
    ].join('\n');
    B.ziwei_table = ['宮位\t地支\t宮干支\t主星\t吉星\t煞星\t四化',
      ...z.palaces.map(p => `${p.name}\t${p.branchName}\t${p.gz}\t${p.main.join('') || '—'}\t${p.lucky.join('') || '—'}\t${p.sha.join('') || '—'}\t${p.hua.join('') || '—'}`)].join('\n');
  }

  if (A.naming?.ok) {
    const n = A.naming;
    B.naming = [
      `姓名：${n.fullName}（總筆畫 ${n.totalStrokes}，康熙筆畫）`,
      `單字筆畫：${[...n.surname, ...n.given].map(c => `${c.ch}=${c.strokes}`).join('、')}`,
      ...Object.values(n.wuge).map(g => `${g.key}：${g.n}（${g.el}）${g.luck} — ${g.text}`),
      `三才配置：${n.sancai.config}（${n.sancai.luck}）${n.sancai.detail}`,
      `綜合評分：${n.score}/100`,
    ].join('\n');
  } else if (A.naming && !A.naming.ok) {
    B.naming = `姓名筆畫尚未完整（未收錄：${A.naming.unknown.join('、')}），請先補上康熙筆畫。`;
  }

  if (A.luck && A.limits && A.ziwei) {
    const year = new Date().getFullYear();
    const f = fortuneOfYear({ chart: A.ziwei, limits: A.limits, year, birthYear: A.base.y });
    const bStep = A.luck.list.find(x => year >= x.fromYear && year <= x.toYear);
    const dm = A.bazi ? A.bazi.day.index % 10 : 0;
    B.luck = [
      `【當前運限】${year} 年，虛歲 ${f.age}`,
      `流年干支：${f.yearGZName}（${f.zodiac}年）　流年四化：${f.yearSihua.map(s => s.text).join('、')}`,
      `流年命宮落在本命「${f.yearPalace.name}」（${f.yearPalace.branchName}宮）：${f.yearPalace.main.join('、') || '空宮'}`,
      `小限在${f.minorPalace.branchName}宮，本命「${f.minorPalace.name}」`,
      f.major ? `紫微大限：${f.major.fromAge}–${f.major.toAge} 歲，${f.major.palace.branchName}宮「${f.major.palace.name}」，大限四化 ${f.major.sihua.map(s => s.text).join('、')}` : '',
      bStep ? `八字大運：${bStep.name}（${bStep.shiShen}），${bStep.fromAge}–${bStep.toAge} 歲（${bStep.fromYear}–${bStep.toYear}）` : '',
      `大運排法：${A.luck.direction}，${A.luck.startAge.years} 歲${A.luck.startAge.months ? A.luck.startAge.months + ' 個月' : ''}起運（交${A.luck.boundaryTerm}，相距 ${A.luck.daysToTerm.toFixed(1)} 天）`,
      '',
      '【八字大運全排】',
      ...A.luck.list.map(x => `${x.fromAge}–${x.toAge} 歲（${x.fromYear}–${x.toYear}）：${x.name}　${x.shiShen}　納音${x.nayin.name}`),
      '',
      '【紫微大限全排】',
      ...A.limits.major.map(x => `${x.fromAge}–${x.toAge} 歲：${x.palace.branchName}宮「${x.palace.name}」${x.palace.main.join('、') || '空宮'}　四化 ${x.sihua.map(s => s.text).join('、')}`),
      '',
      `【${year} 年流月】`,
      ...monthsOfYear(year).map(mo => `${mo.term}（${mo.start.m}/${mo.start.d}）起　${mo.name}　${shiShen(dm, mo.gz % 10)}`),
    ].filter(x => x !== undefined).join('\n');
  }

  if (A.life) B.lifepath = `生命靈數：主命數 ${A.life.main}（生日數 ${A.life.birth}，數字總和 ${A.life.total}）— ${A.life.text}`;

  const numParts = [];
  if (A.phone) numParts.push(`手機 ${A.phone.input}：${A.phone.score} 分，主導磁場「${A.phone.dominant || '無'}」，組合 ${A.phone.items.map(i => i.pair + i.name).join('、')}`);
  if (A.plate) numParts.push(`車牌 ${A.plate.input}：${A.plate.score} 分，主導磁場「${A.plate.dominant || '無'}」${A.plate.letterHint ? '，' + A.plate.letterHint : ''}`);
  if (numParts.length) B.numbers = numParts.join('\n');

  return B;
}

export const BLOCK_META = [
  { key: 'basic', label: '基本資料', hint: '姓名、性別、出生時間地點' },
  { key: 'bazi', label: '四柱八字', hint: '年月日時干支、納音、日主' },
  { key: 'bazi_strength', label: '八字旺衰', hint: '五行力量、日主強弱、喜用忌神' },
  { key: 'bazi_table', label: '八字表格', hint: '四柱明細表' },
  { key: 'astro', label: '西洋星盤', hint: '日月升 MC、月相、元素' },
  { key: 'astro_aspects', label: '星盤相位', hint: '所有相位與容許度' },
  { key: 'astro_table', label: '十二宮表', hint: '各宮起始星座與主題' },
  { key: 'ziwei', label: '紫微摘要', hint: '命身宮、五行局、四化' },
  { key: 'ziwei_table', label: '紫微全盤', hint: '十二宮完整星曜表' },
  { key: 'naming', label: '姓名五格', hint: '五格三才與 81 靈動' },
  { key: 'luck', label: '大運流年', hint: '大限、小限、流年、流月、八字大運' },
  { key: 'lifepath', label: '生命靈數', hint: '主命數與特質' },
  { key: 'numbers', label: '號碼磁場', hint: '手機、車牌磁場分析' },
];

export function todayInfo(settings) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  let gz = null, lunar = null;
  try { gz = fourPillars({ y, m, d, h: now.getHours(), tz: settings.tzOffset }); } catch {}
  try { lunar = toLunar(y, m, d, settings.tzOffset); } catch {}
  return { date: `${y}-${pad(m)}-${pad(d)}`, y, m, d, gz, lunar };
}
