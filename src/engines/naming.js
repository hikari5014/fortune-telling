/* 姓名學：五格、三才、81 靈動、取名筆畫推薦 */
import { strokeOf } from '../data/strokes.js';
import { LUCK81, LUCK_WEIGHT, luck81 } from '../data/lucky81.js';

export const EL5 = ['木','火','土','金','水'];
/** 數字 → 五行（尾數 1,2 木；3,4 火；5,6 土；7,8 金；9,0 水） */
export function numEl(n) {
  const d = Math.abs(Math.round(n)) % 10;
  return ['水','木','木','火','火','土','土','金','金','水'][d];
}
/** a 對 b 的關係 */
export function rel(a, b) {
  const i = EL5.indexOf(a), j = EL5.indexOf(b);
  if (i < 0 || j < 0) return '—';
  if (i === j) return '比和';
  if ((i + 1) % 5 === j) return '生';
  if ((j + 1) % 5 === i) return '被生';
  if ((i + 2) % 5 === j) return '剋';
  return '被剋';
}
const REL_SCORE = { 生: 2, 被生: 2, 比和: 1, 剋: -2, 被剋: -2, '—': 0 };

/** 拆字並取筆畫，overrides 可覆寫個別字 */
export function analyzeChars(text, overrides = {}) {
  return [...String(text || '').trim()].filter(c => /\S/.test(c)).map(ch => ({
    ch,
    strokes: overrides[ch] ?? strokeOf(ch),
    known: (overrides[ch] ?? strokeOf(ch)) != null,
  }));
}

/**
 * 五格計算
 * @param {number[]} sur 姓的筆畫陣列
 * @param {number[]} given 名的筆畫陣列
 * @param {string} waiRule 'classic' | 'simple'
 */
export function wuge(sur, given, waiRule = 'classic') {
  const S = sur.length, G = given.length;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const total = sum(sur) + sum(given);

  let tian, ren, di, wai;
  if (S === 1) tian = sur[0] + 1; else tian = sum(sur);
  ren = (S === 1 ? sur[0] : sur[S - 1]) + (G ? given[0] : 1);
  di = G === 0 ? 1 : (G === 1 ? given[0] + 1 : sum(given));

  if (waiRule === 'simple') {
    wai = total - ren + 1;
  } else if (S === 1 && G === 1) wai = 2;
  else if (S === 1 && G >= 2) wai = 1 + given[G - 1];
  else if (S >= 2 && G === 1) wai = sur[0] + 1;
  else wai = sur[0] + given[G - 1];

  const box = (n, key) => ({ key, n, el: numEl(n), ...luck81(n) });
  return {
    天格: box(tian, '天格'), 人格: box(ren, '人格'), 地格: box(di, '地格'),
    外格: box(wai, '外格'), 總格: box(total, '總格'),
  };
}

/** 三才配置（天‧人‧地） */
export function sancai(g) {
  const t = g.天格.el, r = g.人格.el, d = g.地格.el;
  const r1 = rel(t, r), r2 = rel(r, d), r3 = rel(t, d);
  const raw = REL_SCORE[r1] * 2 + REL_SCORE[r2] * 2 + REL_SCORE[r3];
  const luck = raw >= 4 ? '大吉' : raw >= 1 ? '吉' : raw >= -1 ? '半吉' : '凶';
  const map = { 生: '相生', 被生: '受生', 比和: '比和', 剋: '相剋', 被剋: '受剋' };
  return {
    config: `${t}${r}${d}`, luck, score: raw,
    detail: `天格${t} → 人格${r}：${map[r1]}；人格${r} → 地格${d}：${map[r2]}；天地${map[r3]}。`,
    text: luck === '大吉' ? '三才流通，基礎與成功運皆佳，做事阻力小。'
      : luck === '吉' ? '三才大致順暢，略有磨合但無大礙。'
      : luck === '半吉' ? '三才半通半塞，順逆交替，需靠個人調節。'
      : '三才相剋，基礎或成功運受壓，易感辛勞、內耗。',
  };
}

/** 完整分析 */
export function analyzeName(surname, given, { overrides = {}, waiRule = 'classic' } = {}) {
  const S = analyzeChars(surname, overrides);
  const G = analyzeChars(given, overrides);
  const unknown = [...S, ...G].filter(c => !c.known).map(c => c.ch);
  if (unknown.length) return { ok: false, unknown, chars: [...S, ...G] };
  const g = wuge(S.map(c => c.strokes), G.map(c => c.strokes), waiRule);
  const sc = sancai(g);
  const score = Math.max(0, Math.min(100, Math.round(
    50
    + LUCK_WEIGHT[g.人格.luck] * 7
    + LUCK_WEIGHT[g.地格.luck] * 5
    + LUCK_WEIGHT[g.總格.luck] * 6
    + LUCK_WEIGHT[g.外格.luck] * 3
    + LUCK_WEIGHT[g.天格.luck] * 2
    + sc.score * 2.2
  )));
  return {
    ok: true, surname: S, given: G, wuge: g, sancai: sc, score,
    fullName: S.map(c => c.ch).join('') + G.map(c => c.ch).join(''),
    totalStrokes: [...S, ...G].reduce((a, c) => a + c.strokes, 0),
  };
}

/**
 * 取名筆畫推薦：固定姓氏，窮舉名字筆畫組合
 * @param {number[]} surStrokes
 * @param {object} o {count:1|2, max:筆畫上限, top:回傳筆數, waiRule}
 */
export function recommend(surStrokes, { count = 2, max = 25, top = 12, waiRule = 'classic' } = {}) {
  const out = [];
  const score = (g, sc) =>
    LUCK_WEIGHT[g.人格.luck] * 7 + LUCK_WEIGHT[g.地格.luck] * 5 + LUCK_WEIGHT[g.總格.luck] * 6
    + LUCK_WEIGHT[g.外格.luck] * 3 + LUCK_WEIGHT[g.天格.luck] * 2 + sc.score * 2.2;
  const push = (arr) => {
    const g = wuge(surStrokes, arr, waiRule);
    const sc = sancai(g);
    out.push({ strokes: arr, wuge: g, sancai: sc, raw: score(g, sc) });
  };
  if (count === 1) { for (let a = 1; a <= max; a++) push([a]); }
  else { for (let a = 1; a <= max; a++) for (let b = 1; b <= max; b++) push([a, b]); }
  out.sort((x, y) => y.raw - x.raw);
  const best = out[0]?.raw ?? 1, worst = out[out.length - 1]?.raw ?? 0;
  return out.slice(0, top).map(r => ({
    ...r,
    score: Math.round(60 + 40 * (r.raw - worst) / Math.max(1, best - worst)),
  }));
}

export { LUCK81, luck81 };
