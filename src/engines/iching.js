/* 易經六爻：銅錢起卦、時間起卦（梅花易數）、數字起卦，並求之卦／互卦／錯卦／綜卦 */
import { TRIGRAMS, HEX_BY_KEY, HEX_BY_N, YAO_POS } from '../data/hexagrams.js';
import { fourPillars, BRANCHES } from './calendar.js';

const bitsKey = (bits) => bits.join('');
const TRI_BY_BITS = {};
TRIGRAMS.forEach(t => { TRI_BY_BITS[bitsKey(t.bits)] = t; });
export const triOf = (bits) => TRI_BY_BITS[bitsKey(bits)];

/** 六爻（由下而上）→ 卦 */
export function hexOf(lines) {
  const low = triOf(lines.slice(0, 3));
  const up = triOf(lines.slice(3, 6));
  return { ...HEX_BY_KEY[`${up.name}|${low.name}`], lines: [...lines], upTri: up, lowTri: low };
}

/* ── 起卦法 ───────────────────────────────────────── */
/** 三枚銅錢，六次。回傳每爻的 {sum, line, moving, coins} */
export function tossCoins(rand = Math.random) {
  const yao = [];
  for (let i = 0; i < 6; i++) {
    const coins = [0, 0, 0].map(() => (rand() < 0.5 ? 2 : 3));   // 背面2（陰）、正面3（陽）
    const sum = coins.reduce((a, b) => a + b, 0);
    yao.push({
      sum, coins,
      line: sum === 6 || sum === 8 ? 0 : 1,
      moving: sum === 6 || sum === 9,
      name: { 6: '老陰', 7: '少陽', 8: '少陰', 9: '老陽' }[sum],
    });
  }
  return yao;
}

const TRI_BY_N = {};
TRIGRAMS.forEach(t => { TRI_BY_N[t.n] = t; });
const pick8 = (n) => TRI_BY_N[((n - 1) % 8 + 8) % 8 + 1];

/** 梅花易數時間起卦 */
export function timeHexagram(date = new Date(), tz = 8) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const p = fourPillars({ y, m, d, h: date.getHours(), minute: date.getMinutes(), tz });
  const yearBranch = p.year.index % 12 + 1;          // 子=1
  const hourBranch = p.hourIndex + 1;
  const upN = (yearBranch + m + d) % 8 || 8;
  const lowN = (yearBranch + m + d + hourBranch) % 8 || 8;
  const movingIdx = ((yearBranch + m + d + hourBranch) % 6 || 6) - 1;
  const lines = [...pick8(lowN).bits, ...pick8(upN).bits];
  return { lines, movingIdx, detail: `年支${BRANCHES[p.year.index % 12]}(${yearBranch}) + 月${m} + 日${d}${'，＋時支' + BRANCHES[p.hourIndex] + `(${hourBranch})`}`, pillars: p };
}

/** 數字起卦 */
export function numberHexagram(a, b) {
  const upN = (a % 8) || 8;
  const lowN = (b % 8) || 8;
  const movingIdx = ((a + b) % 6 || 6) - 1;
  return { lines: [...pick8(lowN).bits, ...pick8(upN).bits], movingIdx,
    detail: `上卦 ${a} ÷ 8 餘 ${upN}，下卦 ${b} ÷ 8 餘 ${lowN}，動爻 (${a}+${b}) ÷ 6 餘 ${movingIdx + 1}` };
}

/* ── 衍生卦 ───────────────────────────────────────── */
export const flip = (lines, i) => lines.map((v, k) => (k === i ? 1 - v : v));
export const inverse = (lines) => lines.map(v => 1 - v);            // 錯卦
export const reverse = (lines) => [...lines].reverse();             // 綜卦
export const mutual = (lines) => [lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]]; // 互卦

/**
 * 完整卦象
 * @param {number[]} lines 六爻（下→上）
 * @param {number[]} movingIdx 動爻索引陣列
 */
export function reading(lines, movingIdx = []) {
  const ben = hexOf(lines);
  const moving = [...movingIdx].sort((a, b) => a - b);
  let zhiLines = [...lines];
  moving.forEach(i => { zhiLines = flip(zhiLines, i); });
  const zhi = moving.length ? hexOf(zhiLines) : null;

  return {
    ben, zhi, moving,
    movingNames: moving.map(i => yaoName(i, lines[i])),
    hu: hexOf(mutual(lines)),
    cuo: hexOf(inverse(lines)),
    zong: hexOf(reverse(lines)),
    summary: summarize(ben, zhi, moving),
  };
}

/** 爻名：初九、九二…上六 */
export function yaoName(i, line) {
  const num = line ? '九' : '六';
  if (i === 0) return '初' + num;
  if (i === 5) return '上' + num;
  return num + ['','二','三','四','五'][i];
}

function summarize(ben, zhi, moving) {
  if (!moving.length) return `${ben.full}（${ben.name}卦）無動爻，以卦辭斷：${ben.gist}`;
  if (moving.length >= 4) return `${ben.full}動 ${moving.length} 爻，變化劇烈，以之卦「${zhi.full}」為主：${zhi.gist}`;
  return `本卦${ben.full}（${ben.gist}）動${moving.map(i => YAO_POS[i]).join('、')}爻，變為${zhi.full}（${zhi.gist}）。`;
}

/** 卦象 ASCII／文字表示（下→上顛倒顯示） */
export function hexText(lines, moving = []) {
  return [...lines].map((v, i) => `${YAO_POS[i]}　${v ? '▅▅▅▅▅' : '▅▅　▅▅'}${moving.includes(i) ? '　○動' : ''}`)
    .reverse().join('\n');
}

export { YAO_POS, HEX_BY_N, TRIGRAMS };
