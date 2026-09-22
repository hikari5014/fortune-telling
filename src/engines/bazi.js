/* 八字旺衰與喜用神
   ──────────────────────────────────────────────────────────
   流派說明（介面與提示詞都會寫明）：
   本模組採用**扶抑為主**這一派 —— 先判日主強弱，強則喜洩耗、弱則喜生扶。
   從格、化格、專旺格，以及《窮通寶鑑》的調候用神，各家取用差異極大，
   **不內建**，改由提示詞請外部 LLM 引用原典並標明流派。
   這與籤詩、爻辭的處理是同一條線：能推導的自己算，版本眾多的不假裝有。 */
import { STEMS, BRANCHES, STEM_EL, BRANCH_EL, EL_ORDER } from './calendar.js';

/* 地支藏干：本氣、中氣、餘氣（依序） */
export const HIDDEN = [
  ['癸'],            // 子
  ['己', '癸', '辛'], // 丑
  ['甲', '丙', '戊'], // 寅
  ['乙'],            // 卯
  ['戊', '乙', '癸'], // 辰
  ['丙', '庚', '戊'], // 巳
  ['丁', '己'],       // 午
  ['己', '丁', '乙'], // 未
  ['庚', '壬', '戊'], // 申
  ['辛'],            // 酉
  ['戊', '辛', '丁'], // 戌
  ['壬', '甲'],       // 亥
];
/* 本氣、中氣、餘氣的權重 */
const HW = [1, 0.5, 0.3];

/** 某天干對日主而言屬於哪一類（比劫／印／食傷／財／官殺） */
export function tenGodGroup(dayStem, other) {
  const a = EL_ORDER.indexOf(STEM_EL[dayStem]);
  const b = EL_ORDER.indexOf(STEM_EL[other]);
  if (a === b) return '比劫';
  if ((b + 1) % 5 === a) return '印';      // 它生我
  if ((a + 1) % 5 === b) return '食傷';    // 我生它
  if ((a + 2) % 5 === b) return '財';      // 我剋它
  return '官殺';                            // 它剋我
}
export const HELPS = ['比劫', '印'];         // 幫身
export const DRAINS = ['食傷', '財', '官殺']; // 洩耗剋

/* 旺相休囚死：以月令五行為當令者 */
const SEASON = { 旺: 3, 相: 2, 休: -1, 囚: -2, 死: -2 };
export function seasonState(dayEl, monthEl) {
  const a = EL_ORDER.indexOf(dayEl), m = EL_ORDER.indexOf(monthEl);
  if (a === m) return '旺';
  if ((m + 1) % 5 === a) return '相';       // 月令生日主
  if ((a + 1) % 5 === m) return '休';       // 日主生月令
  if ((a + 2) % 5 === m) return '囚';       // 日主剋月令
  return '死';                              // 月令剋日主
}

/* 寒暖燥濕：由月支定調。地支索引 子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戌10 亥11 */
const COLD_MONTHS = [11, 0, 1];   // 亥子丑
const HOT_MONTHS = [5, 6, 7];     // 巳午未
function climateOf(monthBranch, elCount) {
  const cold = COLD_MONTHS.includes(monthBranch);
  const hot = HOT_MONTHS.includes(monthBranch);
  const fire = elCount.火, water = elCount.水;
  if (cold) return { key: '寒', text: '生於冬月，局氣偏寒，見火暖局最能解', need: '火' };
  if (hot) return { key: '熱', text: '生於夏月，局氣偏燥，見水潤局最能解', need: '水' };
  if (fire > water * 2 + 1) return { key: '燥', text: '火多水少，局氣偏燥，宜見水', need: '水' };
  if (water > fire * 2 + 1) return { key: '濕', text: '水多火少，局氣偏濕寒，宜見火', need: '火' };
  return { key: '平', text: '寒暖大致持平，調候不是這張盤的主要問題', need: null };
}

/**
 * 日主旺衰
 * @param {object} pillars fourPillars 的結果
 */
export function strength(pillars) {
  const dayStem = pillars.day.index % 10;
  const dayEl = STEM_EL[dayStem];
  const monthBranch = pillars.month.index % 12;
  const items = [];
  let score = 0;
  const add = (delta, text, tag) => { score += delta; items.push({ delta: Math.round(delta * 10) / 10, text, tag }); };

  /* 1. 得令 —— 月支本氣與日主的旺相休囚死 */
  const state = seasonState(dayEl, BRANCH_EL[monthBranch]);
  add(SEASON[state], `月令${BRANCHES[monthBranch]}（${BRANCH_EL[monthBranch]}），日主${STEMS[dayStem]}（${dayEl}）居「${state}」`, '得令');

  /* 2. 得地 —— 四個地支的藏干通根 */
  const pos = ['年', '月', '日', '時'];
  [pillars.year, pillars.month, pillars.day, pillars.hour].forEach((p, i) => {
    const br = p.index % 12;
    const weight = (i === 1) ? 1.5 : 1;              // 月支最重
    HIDDEN[br].forEach((ch, k) => {
      const st = STEMS.indexOf(ch);
      const g = tenGodGroup(dayStem, st);
      const base = HW[k] * weight;
      const v = g === '比劫' ? base * 2 : g === '印' ? base * 1.5
              : g === '官殺' ? -base * 1.2 : -base;
      const level = ['本氣', '中氣', '餘氣'][k];
      add(v, `${pos[i]}支${BRANCHES[br]}藏${ch}（${level}），對日主為${g}`, '得地');
    });
  });

  /* 3. 得生與得助 —— 其餘三個天干 */
  [[pillars.year, '年'], [pillars.month, '月'], [pillars.hour, '時']].forEach(([p, name]) => {
    const st = p.index % 10;
    const g = tenGodGroup(dayStem, st);
    const w = name === '月' ? 1.3 : 1;
    const v = HELPS.includes(g) ? 1.5 * w : -1.2 * w;
    add(v, `${name}干${STEMS[st]}，對日主為${g}`, HELPS.includes(g) ? '得助' : '洩剋');
  });

  const band = score >= 6 ? '很強' : score >= 2 ? '偏強' : score <= -6 ? '很弱' : score <= -2 ? '偏弱' : '中和';
  items.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    dayStem, dayStemName: STEMS[dayStem], dayEl,
    score: Math.round(score * 10) / 10, band, seasonState: state,
    index: Math.max(0, Math.min(100, Math.round(50 + score * 4))),   // 0–100 的強弱指標
    items,
  };
}

/** 五行力量分布（天干各 1，地支藏干依本中餘氣加權，月支再乘 1.5） */
export function elementPower(pillars) {
  const out = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const P = [pillars.year, pillars.month, pillars.day, pillars.hour];
  P.forEach((p, i) => {
    const w = (i === 1) ? 1.5 : 1;
    out[STEM_EL[p.index % 10]] += 1 * w;
    HIDDEN[p.index % 12].forEach((ch, k) => { out[STEM_EL[STEMS.indexOf(ch)]] += HW[k] * w; });
  });
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  const pct = {};
  for (const k of EL_ORDER) pct[k] = Math.round(out[k] / total * 1000) / 10;
  return { raw: out, pct, total: Math.round(total * 10) / 10 };
}

/* 喜用忌神的說明 */
const GROUP_TEXT = {
  比劫: '同我者 —— 兄弟朋友、競爭者，也是自己的底氣',
  印: '生我者 —— 長輩、學問、靠山、休息',
  食傷: '我生者 —— 表達、作品、才華，也是消耗',
  財: '我剋者 —— 金錢、實務、慾望的對象',
  官殺: '剋我者 —— 規範、壓力、責任、職位',
};
const GROUP_EL = (dayEl, group) => {
  const a = EL_ORDER.indexOf(dayEl);
  return { 比劫: EL_ORDER[a], 印: EL_ORDER[(a + 4) % 5], 食傷: EL_ORDER[(a + 1) % 5],
           財: EL_ORDER[(a + 2) % 5], 官殺: EL_ORDER[(a + 3) % 5] }[group];
};

/**
 * 喜用忌神（扶抑派）
 * @param {object} st strength 的結果 @param {object} cl climate 的結果
 */
export function useGods(st, cl) {
  const strong = st.score >= 2;
  const weak = st.score <= -2;
  let like, avoid, reason;
  if (strong) {
    like = ['食傷', '財', '官殺'];
    avoid = ['印', '比劫'];
    reason = `日主${st.band}，已經夠有力，再加生扶反而滿則溢。喜歡能把力量用出去或壓一壓的：食傷洩秀、財為我所用、官殺立規矩。`;
  } else if (weak) {
    like = ['印', '比劫'];
    avoid = ['食傷', '財', '官殺'];
    reason = `日主${st.band}，力量不足以承擔。喜歡能撐住自己的：印生我、比劫幫我。財官食傷雖然是好東西，身弱時扛不動反成負擔。`;
  } else {
    like = [];
    avoid = [];
    reason = '日主中和，沒有明顯的偏枯，扶抑不是重點。這種盤多半要看格局成敗與行運的配合，不是靠單一喜用神。';
  }
  const map = (g) => ({ group: g, el: GROUP_EL(st.dayEl, g), text: GROUP_TEXT[g] });
  return {
    balance: strong ? '身強' : weak ? '身弱' : '中和',
    like: like.map(map), avoid: avoid.map(map), reason,
    climate: cl,
    climateNote: cl.need
      ? `另外調候上偏${cl.key}，${cl.text}。若${cl.need}同時也是喜神，那它就是這張盤最要緊的一個字。`
      : cl.text,
    school: '扶抑為主（先判日主強弱，強則洩耗、弱則生扶）',
    caveat: '從格、化格、專旁格與《窮通寶鑑》的調候用神各家差異很大，本 App 不內建，可用提示詞請外部 LLM 補齊並標明流派。',
  };
}

/** 一次算完 */
export function analyze(pillars) {
  const power = elementPower(pillars);
  const st = strength(pillars);
  const cl = climateOf(pillars.month.index % 12, power.raw);
  return { power, strength: st, use: useGods(st, cl) };
}

/** 給提示詞用的純文字 */
export function toText(a, pillars) {
  const L = [
    `四柱：${pillars.year.name} ${pillars.month.name} ${pillars.day.name} ${pillars.hour.name}`,
    `日主：${a.strength.dayStemName}（${a.strength.dayEl}）　月令：${BRANCHES[pillars.month.index % 12]}，日主居「${a.strength.seasonState}」`,
    `五行力量：${Object.entries(a.power.pct).map(([k, v]) => `${k} ${v}%`).join('　')}`,
    `日主旺衰：${a.strength.band}（評分 ${a.strength.score}，指標 ${a.strength.index}/100）`,
    '評分明細：',
    ...a.strength.items.map(x => `・[${x.tag}] ${x.text}（${x.delta >= 0 ? '+' : ''}${x.delta}）`),
    `判定：${a.use.balance}`,
    a.use.like.length ? `喜用：${a.use.like.map(x => `${x.group}（${x.el}）`).join('、')}` : '喜用：中和之局，無明顯扶抑喜用',
    a.use.avoid.length ? `忌神：${a.use.avoid.map(x => `${x.group}（${x.el}）`).join('、')}` : '',
    `理由：${a.use.reason}`,
    `調候：${a.use.climateNote}`,
    `本 App 採用的流派：${a.use.school}`,
    `未內建的部分：${a.use.caveat}`,
  ].filter(Boolean);
  return L.join('\n');
}
