/* 數字命理：磁場分析、號碼評分、生命靈數、匹配、幸運數推薦 */
import { pairStar, STARS } from '../data/magnetic.js';
import { luck81 } from '../data/lucky81.js';
import { MAGNETIC_WEN, LIFE_PATH_WEN, pick } from '../data/wenyan.js';

export const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

/**
 * 號碼磁場分析
 * @param {string} input 任意字串（手機、車牌、門牌…）
 * @param {object} o {mode:'slide'|'block'}
 */
export function analyzeNumber(input, { mode = 'slide', reg = 'bai' } = {}) {
  const digits = onlyDigits(input);
  const pairs = [];
  if (mode === 'block') {
    for (let i = 0; i + 1 < digits.length; i += 2) pairs.push(digits.slice(i, i + 2));
  } else {
    for (let i = 0; i + 1 < digits.length; i++) pairs.push(digits.slice(i, i + 2));
  }
  const items = pairs.map(p => {
    const st = pairStar(p);
    return { pair: p, ...st, text: pick(MAGNETIC_WEN, st.name, st.text, reg) };
  });
  const valid = items.filter(i => i.kind !== '中');
  const rawAvg = valid.length ? valid.reduce((a, b) => a + b.score, 0) / valid.length : 0;
  const good = valid.filter(i => i.kind === '吉').length;
  const bad = valid.filter(i => i.kind === '凶').length;

  const sum = [...digits].reduce((a, c) => a + Number(c), 0);
  const l81 = luck81(sum);
  const luckBonus = { 大吉: 8, 吉: 4, 半吉: 0, 凶: -8 }[l81.luck] ?? 0;

  const score = Math.max(0, Math.min(100, Math.round(
    52 + rawAvg * 8 + (good - bad) * 3 + luckBonus
  )));

  const counts = {};
  for (const i of valid) counts[i.name] = (counts[i.name] || 0) + 1;
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    input: String(input || ''), digits, mode, items, score,
    good, bad, neutral: items.length - valid.length,
    sum, luck81: l81, dominant,
    counts,
    hot: hotDigits(items),
    summary: summarize(score, dominant, l81),
  };
}

function hotDigits(items) {
  const w = {};
  items.forEach(i => {
    if (i.kind === '吉') [...i.pair].forEach(d => w[d] = (w[d] || 0) + 1);
  });
  return Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
}

function summarize(score, dominant, l81) {
  const level = score >= 82 ? '非常好' : score >= 68 ? '不錯' : score >= 52 ? '普通偏好' : score >= 38 ? '普通偏弱' : '偏弱';
  const d = dominant ? `主導磁場是「${dominant}」，${STARS[dominant]?.text || ''}` : '磁場組合分散，沒有明顯主調。';
  return `整體 ${level}（${score} 分）。${d}數字總和 ${l81.n} 屬「${l81.luck}」：${l81.text}`;
}

/** 生命靈數 */
export function lifePath(y, m, d, reg = 'bai') {
  const digits = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  const reduce = (n) => { while (n > 9 && n !== 11 && n !== 22 && n !== 33) n = String(n).split('').reduce((a, c) => a + +c, 0); return n; };
  const total = [...digits].reduce((a, c) => a + +c, 0);
  const main = reduce(total);
  const birth = reduce(d);
  return {
    total, main, birth,
    isMaster: [11, 22, 33].includes(main),
    text: pick(LIFE_PATH_WEN, main, LIFE_PATH[main], reg)
       || pick(LIFE_PATH_WEN, reduce(String(main).split('').reduce((a, c) => a + +c, 0)),
               LIFE_PATH[reduce(String(main).split('').reduce((a, c) => a + +c, 0))], reg),
  };
}
export const LIFE_PATH = {
  1: '獨立、開創、我行我素。適合帶頭，不擅長被管。',
  2: '協調、敏感、重關係。擅長輔佐與感受氣氛。',
  3: '表達、創意、社交。靠說與寫吃飯的體質。',
  4: '務實、秩序、耐磨。慢但穩，討厭混亂。',
  5: '自由、變動、好奇。受不了一成不變。',
  6: '責任、照顧、審美。容易把別人的事扛在身上。',
  7: '思辨、內省、專精。需要獨處才能充電。',
  8: '權力、資源、務實企圖。對金錢與結果敏感。',
  9: '理想、包容、大格局。容易付出到忘了自己。',
  11: '直覺型領導，靈感強但情緒起伏大。',
  22: '大格局實踐者，能把理想落地，壓力也大。',
  33: '奉獻與療癒，重情義，需注意界線。',
};

/** 兩組號碼／兩人匹配 */
export function matchNumbers(a, b, opts = {}) {
  const A = analyzeNumber(a, opts), B = analyzeNumber(b, opts);
  const joint = onlyDigits(a).slice(-1) + onlyDigits(b).slice(0, 1);
  const bridge = joint.length === 2 ? { pair: joint, ...pairStar(joint) } : null;
  const diff = Math.abs(A.score - B.score);
  const base = (A.score + B.score) / 2;
  const score = Math.max(0, Math.min(100, Math.round(base - diff * 0.25 + (bridge?.score || 0) * 3)));
  return { a: A, b: B, bridge, score,
    text: score >= 80 ? '兩組號碼氣場相合，節奏容易同步。'
        : score >= 60 ? '整體還算協調，偶有拉扯但不嚴重。'
        : score >= 40 ? '有明顯落差，需要刻意溝通與讓步。'
        : '磁場衝突較大，建議各自留空間。' };
}

/** 幸運數字推薦：依生命靈數與想強化的面向排序兩位數組合 */
export function luckyPicks(main, focus = '天醫', top = 8) {
  const want = STARS[focus]?.keys || [];
  const affinity = { 1: ['天醫','延年'], 2: ['生氣','延年'], 3: ['天醫','生氣'], 4: ['延年','伏位'],
    5: ['生氣','天醫'], 6: ['延年','天醫'], 7: ['天醫','伏位'], 8: ['延年','生氣'], 9: ['生氣','天醫'],
    11: ['天醫','生氣'], 22: ['延年','伏位'], 33: ['生氣','天醫'] };
  const prefer = affinity[main] || ['天醫','生氣'];
  const pool = [...new Set([...want, ...prefer.flatMap(k => STARS[k].keys)])];
  const rank = (p) => (want.includes(p) ? 3 : 0) + (prefer.some(k => STARS[k].keys.includes(p)) ? 2 : 0)
    + (STARS[Object.keys(STARS).find(k => STARS[k].keys.includes(p))]?.score || 0) * 0.5;
  return pool.map(p => ({ pair: p, star: Object.keys(STARS).find(k => STARS[k].keys.includes(p)), rank: rank(p) }))
    .sort((a, b) => b.rank - a.rank).slice(0, top);
}

/** 車牌評分（含英文字母提示） */
export function analyzePlate(plate, opts = {}) {
  const r = analyzeNumber(plate, opts);
  const letters = String(plate || '').toUpperCase().replace(/[^A-Z]/g, '');
  const letterNums = [...letters].map(c => ((c.charCodeAt(0) - 65) % 9) + 1);
  return { ...r, letters, letterNums,
    letterHint: letters ? `英文字母依序對應數字 ${letterNums.join('、')}（A=1…I=9 循環），可併入整體觀察。` : '' };
}

export { STARS };
