/* 行運：某一天天上的行星，疊到本命盤上看碰到了什麼
   ──────────────────────────────────────────────────────────
   本命盤是出生那一刻的「照片」；行運是把今天的天空疊上去，
   看今天的行星跟照片裡的哪幾顆形成相位 —— 像每天的天氣預報。

   幾個決定：

   1. **容許度比本命盤緊很多。** 本命相位合相可以放到 8°，行運放那麼寬的話
      外行星一個相位會連續好幾個月都「成立」，什麼都是今天的事就等於什麼都不是。
      這裡快星 2° 上下、慢星 1° 左右 —— 列出來的是真的「這幾天」在發生的。

   2. **月亮照列，但分量最輕。** 月亮一天走 13°，它的相位只維持幾個小時，
      正好是「今天的心情」；木土天海冥的相位維持數週到數月，是「這陣子的主題」。
      排序同時看分量與精準度，慢星的緊密相位會排在前面。

   3. **漸近 / 漸離。** 明天的相位比今天更精準就是漸近（還在變強），
      反過來就是漸離（高峰已過）。這個比度數本身更貼近「現在感覺到什麼」。

   4. **時辰不詳就不看上升、中天與宮位。** 那三樣全靠出生時刻，
      用中午代入算出來的是猜的，列出來只會誤導。

   5. **固定取當地正午。** 用「現在」的話，一天之內打開兩次月亮就換了位置、
      清單跟著變。每日的東西應該一整天都一樣。 */

import { jdFromUTC, sunLongitude, moonLongitude, norm360, ttFromUT } from './calendar.js';
import { allPlanets } from './planets.js';
import { aspectBetween, SIGNS, signOf, degInSign, houseMeaning } from './astro.js';

/** 行運星（天上的） */
const MOVERS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
/** 本命點（照片裡的）；上升、中天要有時辰才列 */
const TARGETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc'];

/** 容許度倍率：乘在 ASPECTS 的本命容許度上（合相 8° × 0.25 = 2°） */
const ORB = { moon: 0.45, sun: 0.28, mercury: 0.25, venus: 0.25, mars: 0.25,
              jupiter: 0.18, saturn: 0.18, uranus: 0.14, neptune: 0.14, pluto: 0.14 };
/** 分量：這顆行運星的相位「算不算大事」 */
const WEIGHT = { moon: 1, sun: 1.5, mercury: 1.4, venus: 1.5, mars: 2,
                 jupiter: 2.6, saturn: 2.8, uranus: 3, neptune: 3, pluto: 3 };
const TARGET_WEIGHT = { sun: 1.3, moon: 1.3, asc: 1.25, mc: 1.25 };

/** 行運星今天帶來的是什麼 */
export const MOVER_TEXT = {
  sun: '今天的注意力', moon: '今天的心情', mercury: '訊息與溝通', venus: '人緣與喜好',
  mars: '衝勁與火氣', jupiter: '機會與好運', saturn: '壓力與責任',
  uranus: '意外與變動', neptune: '靈感與迷惘', pluto: '深層的轉變',
};
/** 它碰到的是你的哪一塊 */
export const TARGET_TEXT = {
  sun: '自我與方向', moon: '情緒與安全感', mercury: '想法與表達', venus: '感情與品味',
  mars: '行動力', jupiter: '信念與眼界', saturn: '紀律與底線', uranus: '想改變的那一面',
  neptune: '理想與想像', pluto: '執著與掌控', asc: '外在形象與身體', mc: '事業與名聲',
};
/** 相位的白話動詞 */
const VERB = { conj: '直接碰上', sext: '順手幫到', squa: '正在考驗', trin: '順勢帶動', oppo: '正在拉扯' };

const ZH = { sun: '太陽', moon: '月亮', asc: '上升', mc: '中天' };

/** 某一天當地正午的 UT 儒略日 */
export const noonJD = (y, m, d, tz = 8) => jdFromUTC(y, m, d, 12) - tz / 24;

/** 天上這一刻各星的位置（含速度） */
export function sky(jdUT) {
  const sun = sunLongitude(jdUT), moon = moonLongitude(jdUT);
  const planets = allPlanets(ttFromUT(jdUT));
  return [
    { key: 'sun', zh: '太陽', sym: '☉', lon: sun, speed: norm360(sunLongitude(jdUT + 1) - sun) },
    { key: 'moon', zh: '月亮', sym: '☾', lon: moon, speed: norm360(moonLongitude(jdUT + 1) - moon) },
    ...planets.map(p => ({ key: p.key, zh: p.zh, sym: p.sym, lon: p.lon, speed: p.speed, retro: p.retro })),
  ].map(b => ({ ...b, sign: signOf(b.lon), signName: SIGNS[signOf(b.lon)].zh, deg: degInSign(b.lon) }));
}

/**
 * 某一天的行運
 * @param {object} natal natalChart() 的結果
 * @param {object} o {y,m,d 要看的那一天；tz；hourKnown 出生時辰是否確定；reg 語調}
 */
export function transits(natal, { y, m, d, tz = 8, hourKnown = true, reg = 'bai' } = {}) {
  const jd = noonJD(y, m, d, tz);
  const now = sky(jd);
  const targets = natal.bodies.filter(b => TARGETS.includes(b.key) && (hourKnown || (b.key !== 'asc' && b.key !== 'mc')));

  const list = [];
  for (const t of now) {
    if (!MOVERS.includes(t.key)) continue;
    for (const n of targets) {
      const asp = aspectBetween(t.lon, n.lon, ORB[t.key]);
      if (!asp) continue;
      // 明天同一個相位是更準還是更鬆
      const next = aspectBetween(norm360(t.lon + (t.speed > 180 ? t.speed - 360 : t.speed)), n.lon, 3);
      const applying = !!next && next.key === asp.key && next.orb < asp.orb;
      const weight = WEIGHT[t.key] * (TARGET_WEIGHT[n.key] || 1);
      list.push({
        mover: t.key, target: n.key,
        moverZh: t.zh, targetZh: n.zh || ZH[n.key], moverSym: t.sym, targetSym: n.sym,
        ...asp, applying, retro: !!t.retro,
        weight, rank: weight * (0.4 + asp.strength),
        label: `行運${t.zh} ${asp.zh} 本命${n.zh || ZH[n.key]}`,
        say: `${MOVER_TEXT[t.key]}${VERB[asp.key]}你的${TARGET_TEXT[n.key]}`,
        slow: WEIGHT[t.key] >= 2.6,
      });
    }
  }
  list.sort((a, b) => b.rank - a.rank);

  // 月亮走到本命的第幾宮 —— 最常用來看「今天心思放在哪」
  const moon = now.find(b => b.key === 'moon');
  const moonHouse = hourKnown ? Math.floor(norm360(moon.lon - natal.asc) / 30) + 1 : null;

  // 整體基調：用分量加權的相位分數
  const tally = list.reduce((s, x) => s + x.score * x.weight * x.strength, 0);
  const tone = tally > 2.5 ? { key: 'good', text: '順' } : tally < -2.5 ? { key: 'bad', text: '有摩擦' } : { key: 'mid', text: '平' };

  return {
    date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    sky: now, list, tone, tally,
    moon: { signName: moon.signName, house: moonHouse, houseText: moonHouse ? houseMeaning(moonHouse, reg) : '' },
    retro: now.filter(b => b.retro).map(b => b.zh),
    hourKnown,
  };
}

/** 給 LLM 的文字版 */
export function transitText(t, top = 8) {
  return [
    `日期：${t.date}（當地正午的天空）`,
    `月亮在${t.moon.signName}${t.moon.house ? `，落本命第 ${t.moon.house} 宮（${t.moon.houseText}）` : ''}`,
    t.retro.length ? `逆行中：${t.retro.join('、')}` : '今天沒有行星逆行',
    `整體基調：${t.tone.text}`,
    '主要行運相位（依重要性）：',
    ...t.list.slice(0, top).map(x =>
      `・${x.label}（差 ${x.orb.toFixed(1)}°，${x.applying ? '漸近、還在變強' : '漸離、高峰已過'}）—— ${x.say}`),
    t.hourKnown ? '' : '（出生時辰不詳：未列上升、中天與宮位）',
  ].filter(Boolean).join('\n');
}
