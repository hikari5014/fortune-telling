/* 流日與擇日：建除十二神、彭祖百忌、沖煞、與本命的干支關係
   —— 採「建除十二神」這一派的簡化宜忌。傳統通書另外疊了數十種神煞，
   各家取用不同，本 App 只做能明確講清楚出處的部分，並把每一分的來源列出來。 */
import {
  STEMS, BRANCHES, ZODIAC, jdFromUTC, sunLongitude, fourPillars, toLunar,
  STEM_HE, STEM_CHONG, BR_LIUHE, BR_SANHE, BR_CHONG, BR_XING, BR_XING2, BR_SELF, BR_HAI,
  pairHas, inSanhe, TERMS,
} from './calendar.js';

/* ── 事項 ─────────────────────────────────────────── */
export const PURPOSES = [
  { key: 'wed',    name: '嫁娶', hint: '結婚、宴客' },
  { key: 'engage', name: '訂盟', hint: '訂婚、提親、口頭約定' },
  { key: 'open',   name: '開市', hint: '開業、開工、新店開張' },
  { key: 'sign',   name: '簽約', hint: '立券交易、下訂、買賣' },
  { key: 'move',   name: '搬家', hint: '入宅、移徙' },
  { key: 'trip',   name: '出行', hint: '遠行、出差、旅遊' },
  { key: 'build',  name: '動土', hint: '修造、裝潢、破土' },
  { key: 'bed',    name: '安床', hint: '新床定位、臥室調整' },
  { key: 'cure',   name: '就醫', hint: '求醫、手術、療病' },
  { key: 'study',  name: '入學', hint: '拜師、開課、考試' },
  { key: 'pray',   name: '祈福', hint: '祭祀、還願、開光' },
  { key: 'money',  name: '納財', hint: '收款、入庫、開戶' },
];
export const purposeName = (k) => PURPOSES.find(p => p.key === k)?.name || k;

/* ── 建除十二神 ───────────────────────────────────── */
/* 口訣：建滿平收黑，除危定執黃，成開皆可用，閉破不相當 */
export const JIANCHU = ['建', '除', '滿', '平', '定', '執', '破', '危', '成', '收', '開', '閉'];
const TONE = { 建: '黑', 滿: '黑', 平: '黑', 收: '黑', 除: '黃', 危: '黃', 定: '黃', 執: '黃', 成: '用', 開: '用', 閉: '凶', 破: '凶' };
export const TONE_TEXT = {
  黃: '黃道日，做事順手', 黑: '黑道日，宜守不宜攻',
  用: '成開之日，諸事可用', 凶: '閉破之日，能改期就改期',
};

export const JIANCHU_INFO = {
  建: { text: '一月之首，氣勢最旺也最剛。適合開頭、露臉、遞件，不適合破土翻動。', good: ['trip', 'pray', 'study'], bad: ['build', 'wed', 'move'] },
  除: { text: '除舊之日。清掃、療病、解約、把爛攤子結掉最合適，不適合開新局。', good: ['cure', 'pray'], bad: ['wed', 'open', 'sign', 'move'] },
  滿: { text: '圓滿豐盈。祭祀、婚嫁、開市、收錢都好，但滿則溢，吃藥動刀不宜。', good: ['pray', 'wed', 'open', 'money', 'engage'], bad: ['cure', 'build'] },
  平: { text: '平常平順之日。諸事平平，適合把事情擺平、修補、談和。', good: ['wed', 'sign'], bad: ['build'] },
  定: { text: '安定底定。訂盟、安床、入學、把事情定下來最好，不適合遠行與動刀。', good: ['engage', 'bed', 'study', 'sign', 'wed'], bad: ['trip', 'cure'] },
  執: { text: '執持守成。修造、收斂、守住手上的東西可以，開新張或搬動不宜。', good: ['build', 'money'], bad: ['open', 'move', 'trip'] },
  破: { text: '月破大耗，一年裡最破的日子。只宜拆除與治病，喜事一律改期。', good: ['cure'], bad: ['wed', 'engage', 'open', 'sign', 'move', 'trip', 'build', 'bed', 'study', 'money'] },
  危: { text: '危險臨高。祭祀、安床可以，登高、行船、冒險的事避開。', good: ['pray', 'bed'], bad: ['trip', 'build'] },
  成: { text: '成就之日。開市、入學、婚嫁、立約、搬家都成，只忌爭訟。', good: ['open', 'study', 'wed', 'sign', 'move', 'engage', 'build', 'money', 'pray'], bad: [] },
  收: { text: '收納入庫。收錢、進人、入學好，往外跑的事不宜。', good: ['money', 'study', 'sign'], bad: ['trip', 'cure'] },
  開: { text: '開通啟用。開市、入學、動土、祈福、搬家都好，只忌安葬。', good: ['open', 'study', 'build', 'pray', 'move', 'wed', 'engage'], bad: [] },
  閉: { text: '閉塞收口。填補、埋藏、把錢收起來可以，開張、出門、看病不宜。', good: ['money'], bad: ['open', 'trip', 'cure', 'wed', 'move', 'study'] },
};

/** 建除：日支與月建（月支）相同者為「建」，之後依序而下 */
export function jianchuOf(monthBranch, dayBranch) {
  const i = ((dayBranch - monthBranch) % 12 + 12) % 12;
  const name = JIANCHU[i];
  return { index: i, name, tone: TONE[name], toneText: TONE_TEXT[TONE[name]], ...JIANCHU_INFO[name] };
}

/* ── 彭祖百忌 ─────────────────────────────────────── */
export const PENGZU_STEM = [
  '甲不開倉，財物耗散', '乙不栽植，千株不長', '丙不修灶，必見災殃', '丁不剃頭，頭必生瘡',
  '戊不受田，田主不祥', '己不破券，二比並亡', '庚不經絡，織機虛張', '辛不合醬，主人不嘗',
  '壬不汲水，更難提防', '癸不詞訟，理弱敵強',
];
export const PENGZU_BRANCH = [
  '子不問卜，自惹禍殃', '丑不冠帶，主不還鄉', '寅不祭祀，神鬼不嘗', '卯不穿井，水泉不香',
  '辰不哭泣，必主重喪', '巳不遠行，財物伏藏', '午不苫蓋，屋主更張', '未不服藥，毒氣入腸',
  '申不安床，鬼祟入房', '酉不會客，醉坐顛狂', '戌不吃犬，作怪上床', '亥不嫁娶，不利新郎',
];
/* 百忌條文對應到本 App 的事項（沒對上的條文只顯示、不扣分） */
const PENGZU_HIT_STEM = { 0: ['open', 'money'], 2: ['build'], 4: ['build'], 5: ['sign'] };
const PENGZU_HIT_BRANCH = { 2: ['pray'], 3: ['build'], 5: ['trip'], 6: ['build'], 7: ['cure'], 8: ['bed'], 11: ['wed'] };

/* ── 沖煞 ─────────────────────────────────────────── */
/* 三合局的對面即是煞方：申子辰（水）煞南、寅午戌（火）煞北、巳酉丑（金）煞東、亥卯未（木）煞西 */
const SHA_DIR = { 0: '南', 4: '南', 8: '南', 2: '北', 6: '北', 10: '北', 1: '東', 5: '東', 9: '東', 3: '西', 7: '西', 11: '西' };

/* ── 節氣、四離四絕 ───────────────────────────────── */
const TERM_LONS = TERMS.map((_, i) => (270 + i * 15) % 360);
const SI_LI = ['春分', '夏至', '秋分', '冬至'];
const SI_JUE = ['立春', '立夏', '立秋', '立冬'];

/** 這一天（當地）有沒有交節氣？回傳節氣名或 null */
export function termOfDay(y, m, d, tz = 8) {
  const jd0 = jdFromUTC(y, m, d, 0) - tz / 24;
  const a = sunLongitude(jd0), b = sunLongitude(jd0 + 1);
  const span = ((b - a) % 360 + 360) % 360;
  for (let i = 0; i < TERM_LONS.length; i++) {
    const off = ((TERM_LONS[i] - a) % 360 + 360) % 360;
    if (off < span) return TERMS[i];
  }
  return null;
}

/* ── 單日資訊 ─────────────────────────────────────── */
/**
 * @param {number} y 國曆年 @param {number} m 月 @param {number} d 日
 * @param {object} o {tz}
 */
export function dayInfo(y, m, d, { tz = 8 } = {}) {
  const gz = fourPillars({ y, m, d, h: 12, tz });
  const dayBranch = gz.day.index % 12;
  const dayStem = gz.day.index % 10;
  const monthBranch = gz.month.index % 12;

  const term = termOfDay(y, m, d, tz);
  const nextTerm = termOfDay(...addDays(y, m, d, 1), tz);
  const special = [];
  if (term) special.push({ name: term + '（交節）', text: '節氣交接當天，氣還在換，重大的事多半留給隔天' });
  if (nextTerm && SI_JUE.includes(nextTerm)) special.push({ name: '四絕日', text: `明天${nextTerm}，前一日為四絕，忌嫁娶、開市、遠行` });
  if (nextTerm && SI_LI.includes(nextTerm)) special.push({ name: '四離日', text: `明天${nextTerm}，前一日為四離，忌嫁娶、赴任、遠行` });

  let lunar = null;
  try { lunar = toLunar(y, m, d, tz); } catch { /* 超出曆法範圍 */ }

  const chongBranch = (dayBranch + 6) % 12;
  return {
    y, m, d, tz,
    date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    weekday: new Date(y, m - 1, d).getDay(),
    gz, lunar, term, special,
    dayStem, dayBranch, monthBranch,
    jianchu: jianchuOf(monthBranch, dayBranch),
    chong: { branch: chongBranch, zodiac: ZODIAC[chongBranch], text: `沖${ZODIAC[chongBranch]}（${BRANCHES[chongBranch]}）` },
    sha: SHA_DIR[dayBranch],
    pengzu: [PENGZU_STEM[dayStem], PENGZU_BRANCH[dayBranch]],
  };
}

export function addDays(y, m, d, n) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
}

/* ── 與本命的關係 ─────────────────────────────────── */
/**
 * @param {object} info dayInfo 的結果
 * @param {object} bazi fourPillars 的結果（本命四柱），可為 null
 */
export function natalRelations(info, bazi) {
  if (!bazi) return [];
  const out = [];
  const db = info.dayBranch, ds = info.dayStem;
  const targets = [
    { k: '年支', b: bazi.year.index % 12, w: 1.0, zh: '生肖' },
    { k: '日支', b: bazi.day.index % 12, w: 0.8, zh: '日柱' },
  ];
  for (const t of targets) {
    const B = BRANCHES[t.b], D = BRANCHES[db];
    if (pairHas(BR_CHONG, db, t.b)) out.push({ kind: '沖', score: -18 * t.w, text: `今日${D}沖你的${t.zh}${B}，這天容易被打斷、臨時變卦` });
    else if (pairHas(BR_LIUHE, db, t.b)) out.push({ kind: '六合', score: 8 * t.w, text: `今日${D}與你的${t.zh}${B}六合，人和、談事情順` });
    else if (inSanhe(db, t.b)) out.push({ kind: '三合', score: 6 * t.w, text: `今日${D}與你的${t.zh}${B}三合，方向一致、有人幫` });
    if (pairHas(BR_HAI, db, t.b)) out.push({ kind: '害', score: -5 * t.w, text: `今日${D}害你的${t.zh}${B}，小事容易積成怨` });
    if (BR_XING.some(g => g.includes(db) && g.includes(t.b) && db !== t.b) || pairHas(BR_XING2, db, t.b))
      out.push({ kind: '刑', score: -5 * t.w, text: `今日${D}刑你的${t.zh}${B}，牽扯與消耗` });
    if (db === t.b && BR_SELF.includes(db)) out.push({ kind: '自刑', score: -3 * t.w, text: `今日${D}與你的${t.zh}自刑，容易鑽牛角尖` });
    if (db === t.b && !BR_SELF.includes(db)) out.push({ kind: '同支', score: 2 * t.w, text: `今日${D}與你的${t.zh}同支，感覺像自己的主場` });
  }
  const ns = bazi.day.index % 10;
  if (pairHas(STEM_HE, ds, ns)) out.push({ kind: '天干五合', score: 4, text: `日干${STEMS[ds]}與你的日主${STEMS[ns]}相合，容易被人接受` });
  if (pairHas(STEM_CHONG, ds, ns)) out.push({ kind: '天干相沖', score: -4, text: `日干${STEMS[ds]}沖你的日主${STEMS[ns]}，講話容易碰撞` });
  return out;
}

/* ── 評分 ─────────────────────────────────────────── */
export const LEVELS = [
  { min: 82, name: '大吉', cls: 'luck--good' },
  { min: 68, name: '吉', cls: 'luck--good' },
  { min: 55, name: '平', cls: 'luck--half' },
  { min: 42, name: '不宜', cls: 'luck--bad' },
  { min: -Infinity, name: '凶', cls: 'luck--bad' },
];
export const levelOf = (s) => LEVELS.find(l => s >= l.min);

/**
 * 替某一天、某件事打分。每一分都附上理由。
 * @param {object} info dayInfo 結果
 * @param {object} o {purpose, bazi, yearBranch}
 */
export function rateDay(info, { purpose = null, bazi = null, yearBranch = null } = {}) {
  /* 沒指定就用這一天自己的流年支（跨立春的掃描才不會用到別年的太歲） */
  const taisui = yearBranch ?? (info.gz.year.index % 12);
  const reasons = [];
  let score = 60;
  const add = (delta, text, tag) => { score += delta; reasons.push({ delta: Math.round(delta), text, tag }); };

  const j = info.jianchu;
  if (purpose && j.good.includes(purpose)) add(15, `${j.name}日宜${purposeName(purpose)}`, '建除');
  else if (purpose && j.bad.includes(purpose)) add(-17, `${j.name}日忌${purposeName(purpose)}`, '建除');
  else add(j.tone === '用' ? 5 : j.tone === '黃' ? 3 : j.tone === '凶' ? -8 : -3, `${j.name}日：${j.toneText}`, '建除');

  if (purpose) {
    if (PENGZU_HIT_STEM[info.dayStem]?.includes(purpose)) add(-6, PENGZU_STEM[info.dayStem], '彭祖百忌');
    if (PENGZU_HIT_BRANCH[info.dayBranch]?.includes(purpose)) add(-6, PENGZU_BRANCH[info.dayBranch], '彭祖百忌');
  }

  for (const r of natalRelations(info, bazi)) add(r.score, r.text, '本命');

  if (pairHas(BR_CHONG, info.dayBranch, taisui))
    add(-8, `日支沖流年太歲（${BRANCHES[taisui]}），俗稱歲破`, '流年');

  for (const s of info.special) add(s.name === '四絕日' || s.name === '四離日' ? -10 : -4, s.text, s.name);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = levelOf(score);
  reasons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { score, level: level.name, cls: level.cls, reasons };
}

/* ── 月曆 ─────────────────────────────────────────── */
export function monthGrid(y, m, opts = {}) {
  const days = new Date(y, m, 0).getDate();
  const list = [];
  for (let d = 1; d <= days; d++) {
    const info = dayInfo(y, m, d, opts);
    list.push({ ...info, rating: rateDay(info, opts) });
  }
  return { y, m, days, lead: new Date(y, m - 1, 1).getDay(), list };
}

/* ── 找好日子 ─────────────────────────────────────── */
/**
 * @param {object} o {from:[y,m,d], days, purpose, bazi, yearBranch, tz, top, weekdays}
 */
export function findDays({ from, days = 60, purpose = null, bazi = null, yearBranch = null, tz = 8, top = 10, weekdays = null }) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const [y, m, d] = addDays(from[0], from[1], from[2], i);
    const info = dayInfo(y, m, d, { tz });
    if (weekdays && weekdays.length && !weekdays.includes(info.weekday)) continue;
    out.push({ ...info, offset: i, rating: rateDay(info, { purpose, bazi, yearBranch }) });
  }
  const ranked = [...out].sort((a, b) => b.rating.score - a.rating.score || a.offset - b.offset);
  return { all: out, best: ranked.slice(0, top), worst: ranked.slice(-3).reverse() };
}

/* ── 文字輸出（給提示詞用） ───────────────────────── */
export function toText(info, rating, purpose) {
  const L = [
    `日期：${info.date}（星期${'日一二三四五六'[info.weekday]}）`,
    info.lunar ? `農曆：${info.lunar.year} 年 ${info.lunar.monthName}${info.lunar.dayName}` : '',
    `干支：${info.gz.year.name}年 ${info.gz.month.name}月 ${info.gz.day.name}日　節氣月令：${info.gz.jieqi}`,
    `建除十二神：${info.jianchu.name}日（${info.jianchu.toneText}）—— ${info.jianchu.text}`,
    `${info.chong.text}　煞${info.sha}`,
    `彭祖百忌：${info.pengzu.join('；')}`,
    info.term ? `今日交節：${info.term}` : '',
    info.special.length ? `特殊：${info.special.map(s => s.name).join('、')}` : '',
  ].filter(Boolean);
  if (rating) {
    L.push(`本 App 評分：${rating.score} 分（${rating.level}）${purpose ? `，事項「${purposeName(purpose)}」` : ''}`);
    L.push('評分理由：\n' + rating.reasons.map(r => `・[${r.tag}] ${r.text}（${r.delta >= 0 ? '+' : ''}${r.delta}）`).join('\n'));
  }
  return L.join('\n');
}
