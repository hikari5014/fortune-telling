/* 合盤：西洋相位、八字刑沖合害、紫微宮位對照 */
import {
  STEMS, BRANCHES, norm360, STEM_EL, BRANCH_EL,
  STEM_HE, STEM_CHONG, BR_LIUHE, BR_CHONG, BR_SANHE, BR_XING, BR_XING2, BR_SELF, BR_HAI,
  pairHas, inSanhe,
} from './calendar.js';
import { SIGNS, ASPECTS, aspectBetween } from './astro.js';
import { PALACES } from './ziwei.js';

/* ── 西洋相位（定義在 astro.js，兩邊共用同一份） ──── */
export { ASPECTS, aspectBetween };

const KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'asc', 'mc'];

export function astroSynastry(chartA, chartB) {
  const bodyOf = (c, k) => c.bodies.find(b => b.key === k);
  const items = [];
  for (const ka of KEYS) for (const kb of KEYS) {
    const a = bodyOf(chartA, ka), b = bodyOf(chartB, kb);
    if (!a || !b) continue;
    const asp = aspectBetween(a.lon, b.lon);
    if (!asp) continue;
    items.push({
      a: a.zh, b: b.zh, aKey: ka, bKey: kb,
      aSign: a.signName, bSign: b.signName,
      ...asp,
      weight: asp.score * asp.strength * (ka === 'sun' || ka === 'moon' ? 1.2 : 1) ,
      label: `A ${a.zh}（${a.signName}） ${asp.zh} B ${b.zh}（${b.signName}）`,
    });
  }
  items.sort((x, y) => Math.abs(y.weight) - Math.abs(x.weight));
  const raw = items.reduce((s, i) => s + i.weight, 0);
  const elA = SIGNS[bodyOf(chartA, 'sun').sign].el, elB = SIGNS[bodyOf(chartB, 'sun').sign].el;
  return { items, raw, elementPair: `${elA} × ${elB}`, harmonious: items.filter(i => i.score > 0).length, tense: items.filter(i => i.score < 0).length };
}

/* ── 八字刑沖合害 ─────────────────────────────────── */
const has = pairHas;

const PILLARS = ['年', '月', '日', '時'];
const PILLAR_MEAN = { 年: '家世與長輩', 月: '成長環境與事業', 日: '自身與配偶', 時: '子女與晚年' };

export function baziSynastry(baziA, baziB) {
  const A = [baziA.year, baziA.month, baziA.day, baziA.hour];
  const B = [baziB.year, baziB.month, baziB.day, baziB.hour];
  const items = [];
  const push = (i, j, kind, score, text) => items.push({
    pair: `A${PILLARS[i]}柱 ${A[i].name} ↔ B${PILLARS[j]}柱 ${B[j].name}`,
    where: PILLAR_MEAN[PILLARS[i]], kind, score, text,
  });

  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const sa = A[i].index % 10, sb = B[j].index % 10;
    const ba = A[i].index % 12, bb = B[j].index % 12;
    if (has(STEM_HE, sa, sb)) push(i, j, '天干五合', 2, `${STEMS[sa]}${STEMS[sb]}合，意見容易同調`);
    if (has(STEM_CHONG, sa, sb)) push(i, j, '天干相沖', -2, `${STEMS[sa]}${STEMS[sb]}沖，想法容易對立`);
    if (has(BR_LIUHE, ba, bb)) push(i, j, '地支六合', 3, `${BRANCHES[ba]}${BRANCHES[bb]}合，實際互動順`);
    if (inSanhe(ba, bb)) push(i, j, '地支三合', 2, `${BRANCHES[ba]}${BRANCHES[bb]}半合，目標一致`);
    if (has(BR_CHONG, ba, bb)) push(i, j, '地支六沖', -3, `${BRANCHES[ba]}${BRANCHES[bb]}沖，節奏互相打斷`);
    if (has(BR_HAI, ba, bb)) push(i, j, '地支相害', -2, `${BRANCHES[ba]}${BRANCHES[bb]}害，小事容易積怨`);
    if (BR_XING.some(g => g.includes(ba) && g.includes(bb) && ba !== bb) || has(BR_XING2, ba, bb))
      push(i, j, '地支相刑', -2, `${BRANCHES[ba]}${BRANCHES[bb]}刑，牽扯與消耗`);
    if (ba === bb && BR_SELF.includes(ba)) push(i, j, '自刑', -1, `${BRANCHES[ba]}自刑，容易同時鑽牛角尖`);
  }

  // 日柱互動最重要
  const dayItems = items.filter(x => x.pair.includes('A日柱') && x.pair.includes('B日柱'));
  const raw = items.reduce((s, x) => s + x.score * (x.pair.includes('日柱') ? 1.6 : 1), 0);
  return {
    items, raw, dayItems,
    dayMasters: `${baziA.dayMaster}（${baziA.dayMasterEl}）× ${baziB.dayMaster}（${baziB.dayMasterEl}）`,
    good: items.filter(x => x.score > 0).length,
    bad: items.filter(x => x.score < 0).length,
  };
}

/* ── 紫微宮位對照 ─────────────────────────────────── */
export function ziweiSynastry(zA, zB) {
  const rel = (a, b) => {
    const d = ((b - a) % 12 + 12) % 12;
    if (d === 0) return { kind: '同宮', score: 3, text: '立足點一致，容易一見如故' };
    if (d === 6) return { kind: '對宮', score: 2, text: '互補且互相映照，吸引力強但也容易照見彼此的缺' };
    if (d === 4 || d === 8) return { kind: '三合', score: 3, text: '目標與節奏相近，合作順' };
    if (d === 1 || d === 11) return { kind: '鄰宮', score: 0, text: '各走各的，需要刻意靠近' };
    if (d === 3 || d === 9) return { kind: '四正相刑', score: -2, text: '容易互相要求，摩擦點多' };
    if (d === 2 || d === 10) return { kind: '隔角', score: 0, text: '看事情的角度差一格，需要多講清楚' };
    return { kind: '不在三方四正', score: 0, text: '命宮之間沒有直接牽引，緣分要看落宮' };
  };
  const lifeRel = rel(zA.life, zB.life);
  // B 的命宮落在 A 盤的哪一宮
  const bInA = zA.palaces[zB.life];
  const aInB = zB.palaces[zA.life];
  // 夫妻宮互看
  const spouseA = zA.palaces.find(p => p.name === '夫妻');
  const spouseB = zB.palaces.find(p => p.name === '夫妻');
  const spouseHit = spouseA.branch === zB.life || spouseB.branch === zA.life;

  const raw = lifeRel.score + (spouseHit ? 3 : 0)
    + (zA.lifePalace.main.some(s => zB.lifePalace.main.includes(s)) ? 1 : 0);

  return {
    lifeRel, bInA, aInB, spouseHit, raw,
    sharedStars: zA.lifePalace.main.filter(s => zB.lifePalace.main.includes(s)),
    juPair: `${zA.ju.name} × ${zB.ju.name}`,
  };
}

/* ── 綜合 ─────────────────────────────────────────── */
export function synastry(A, B) {
  const astro = (A.astro && B.astro) ? astroSynastry(A.astro, B.astro) : null;
  const bazi = (A.bazi && B.bazi) ? baziSynastry(A.bazi, B.bazi) : null;
  const ziwei = (A.ziwei && B.ziwei) ? ziweiSynastry(A.ziwei, B.ziwei) : null;

  const norm = (v, span) => Math.max(-1, Math.min(1, v / span));
  const score = Math.round(Math.max(0, Math.min(100,
    52
    + (astro ? norm(astro.raw, 12) * 18 : 0)
    + (bazi ? norm(bazi.raw, 14) * 18 : 0)
    + (ziwei ? norm(ziwei.raw, 6) * 14 : 0)
  )));

  const level = score >= 82 ? '非常契合' : score >= 68 ? '相處順' : score >= 52 ? '有來有往' : score >= 38 ? '需要磨合' : '張力較大';
  const tips = [];
  if (astro?.tense > astro?.harmonious) tips.push('星盤上緊張相位偏多：情緒容易互相觸發，吵架的點通常不是事情本身。');
  if (astro?.harmonious > astro?.tense) tips.push('星盤上和諧相位偏多：相處省力，但也容易因為太舒服而缺少推進。');
  if (bazi?.items.some(x => x.kind === '地支六沖' && x.pair.includes('日柱'))) tips.push('日柱相沖：生活節奏與習慣差距大，同住要特別分工。');
  if (bazi?.items.some(x => x.kind === '地支六合' && x.pair.includes('日柱'))) tips.push('日柱相合：實際生活的默契高，是這段關係最穩的底。');
  if (ziwei?.spouseHit) tips.push('一方的命宮正落在另一方的夫妻宮：緣分感強，關係定位清楚。');
  if (ziwei?.lifeRel.kind === '對宮') tips.push('命宮對宮：互補型，但容易把自己的期待投射到對方身上。');

  return { astro, bazi, ziwei, score, level, tips };
}
