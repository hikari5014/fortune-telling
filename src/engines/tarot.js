/* 塔羅：洗牌、抽牌、牌陣，以及跟命盤之間的橋 */
import { DECK, SPREADS, MAJOR_ASTRO } from '../data/tarot.js';
import { SIGNS } from './astro.js';

export function shuffle(deck = DECK, rand = Math.random) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 抽牌
 * @param {object} o {spread:key, allowReversed, rand, spreads 可傳入含自訂牌陣的清單}
 */
export function draw({ spread = 'three', allowReversed = true, rand = Math.random, spreads = SPREADS } = {}) {
  const sp = spreads.find(s => s.key === spread) || SPREADS.find(s => s.key === spread) || SPREADS[1];
  const cards = shuffle(DECK, rand).slice(0, sp.n).map((c, i) => {
    const reversed = allowReversed && rand() < 0.42;
    return { ...c, reversed, slot: sp.slots[i], meaning: reversed ? c.rev : c.up };
  });
  const majors = cards.filter(c => c.arcana === '大').length;
  const revs = cards.filter(c => c.reversed).length;
  return {
    spread: sp, cards, majors, revs,
    note: [
      majors / sp.n >= 0.5 ? '大牌偏多：這件事牽涉的是人生階段與內在課題，不只是眼前的小決定。' : '',
      revs / sp.n >= 0.6 ? '逆位偏多：能量卡住或方向相反，先處理內部阻礙再談行動。' : '',
      revs === 0 && sp.n > 1 ? '全為正位：能量流動順暢，可以直接往前推。' : '',
      suitNote(cards),
    ].filter(Boolean),
  };
}

function suitNote(cards) {
  const c = {};
  cards.filter(x => x.arcana === '小').forEach(x => { c[x.suit] = (c[x.suit] || 0) + 1; });
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2) return '';
  const theme = { 權杖: '行動與熱情', 聖杯: '情感與關係', 寶劍: '思考與溝通', 錢幣: '現實與資源' }[top[0]];
  return `${top[0]}牌集中（${top[1]} 張）：重點落在「${theme}」這一層。`;
}

/**
 * 轉成純文字，供提示詞使用。
 * 帶了 astro 就把「這張牌對應的天區，你盤上有什麼」一起寫進去 ——
 * 那是這個 App 算得出來、而 LLM 自己算不出來的東西。
 */
export function toText(result, question = '', { astro = null, profile = null } = {}) {
  const lines = [
    question ? `問題：${question}` : '',
    `牌陣：${result.spread.name}（${result.spread.desc}）`,
    '',
  ];
  result.cards.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.slot}：${c.full}${c.reversed ? '（逆位）' : '（正位）'} — ${c.meaning}`);
    if (c.arcana === '大') {
      lines.push(`   核心課題：${c.lesson}`);
      lines.push(`   ${c.reversed ? '逆位要當心' : '正位該做的'}：${c.reversed ? c.shadow : c.advice}`);
    } else {
      lines.push(`   位階：${c.stage}`);
      lines.push(`   ${c.el}元素${c.reversed ? '（逆）' : ''}：${c.reversed ? c.face.minus : c.face.plus}`);
    }
    const link = chartLink(c, astro);
    if (link) lines.push(`   對照本命盤：${link.label}；${link.hit}`);
  });
  lines.push('', `大牌 ${result.majors} 張 / 共 ${result.cards.length} 張，逆位 ${result.revs} 張`);
  lines.push(...result.note.map(n => '・' + n));
  if (profile?.birth) {
    const b = birthCard(profile.birth), y = yearCard(profile.birth);
    lines.push('', `【這個人的本命牌】${[b.card, ...b.chain].map(c => c.full).join(' → ')}`
      + `　${y.year} 年度牌：${y.card.full}`);
    lines.push('（本命牌＝月＋日＋西元年後收斂到 1–22。這是二十世紀才成形的算法，沒有古籍出處。）');
  }
  if (astro) {
    lines.push('', '（占星對應用的是黃金黎明系統：大牌對一顆行星或一個星座，'
      + '小牌二到十對黃道三十六旬。上面「對照本命盤」那幾行是本機用實際星曆算出來的，不是通用解讀。）');
  }
  return lines.filter(x => x !== '').join('\n');
}

export { SPREADS, DECK };

/* ── 三十六旬：小牌 2–10 的占星對應 ────────────────────
   這一張表常常被當成 36 條要背的資料，其實它是「推」出來的：

   從春分（牡羊 0°）起算，黃道每 10 度一旬，共 36 旬。
   花色跟著星座的元素走 —— 牡羊(火)→權杖、金牛(土)→錢幣、
   雙子(風)→寶劍、巨蟹(水)→聖杯，然後一直循環；
   數字則是 2,3,4 / 5,6,7 / 8,9,10 一組一組往下走。
   每一旬的行星用迦勒底順序（火日金水月土木）接著排。

   所以這裡不放查表，直接算 —— 算得出來的東西就不該用背的。 */

const DECAN_SUITS = ['wands', 'coins', 'swords', 'cups'];   // 火土風水，跟著星座順序
const CHALDEAN = ['火星', '太陽', '金星', '水星', '月亮', '土星', '木星'];

/** 第 i 旬（0–35，從牡羊 0° 起）對應哪張牌、哪個星座、哪顆行星 */
export function decan(i) {
  const idx = ((i % 36) + 36) % 36;
  return {
    index: idx,
    sign: Math.floor(idx / 3),
    signName: SIGNS[Math.floor(idx / 3)].zh,
    from: idx * 10,
    to: idx * 10 + 10,
    // 花色跟著星座序號模 4（火土風水），數字跟著星座序號模 3（2/5/8 起跳）
    // 4 與 3 互質，所以十二個星座剛好把 36 張牌不重不漏地排完
    suitKey: DECAN_SUITS[Math.floor(idx / 3) % 4],
    num: 2 + 3 * (Math.floor(idx / 3) % 3) + (idx % 3),
    ruler: CHALDEAN[idx % 7],
  };
}

/** 反查：這張小牌（2–10）落在黃道的哪一旬 */
export function decanOfCard(card) {
  if (card.arcana !== '小' || card.num < 2 || card.num > 10) return null;
  for (let i = 0; i < 36; i++) {
    const d = decan(i);
    if (d.suitKey === card.suitKey && d.num === card.num) return d;
  }
  return null;
}

/** 黃經落在第幾旬 */
export const decanOfLon = (lon) => decan(Math.floor((((lon % 360) + 360) % 360) / 10));

/* ── 本命牌與年度牌 ───────────────────────────────────
   把生日的數字一路加起來，收斂到 1–22，對到大牌。
   這是流傳很廣的算法（常被稱為 Birth Card），沒有古籍出處，
   就是一套二十世紀的做法 —— 好用，但它的地位跟八字不一樣，
   介面上會標明。 */

const digitsOf = (n) => String(n).split('').reduce((a, c) => a + Number(c), 0);

/** 一直把位數加起來，直到落進 1–22。22 視同愚者（0）。 */
function reduceToMajor(n) {
  let v = n;
  while (v > 22) v = digitsOf(v);
  return v === 22 ? 0 : v;
}

/**
 * 本命牌：月 + 日 + 西元年，再一路收斂到 1–22。
 * 主牌如果是兩位數，繼續加到個位數，中間經過的每一張都留著 ——
 * 常見的寫法像「19/10/1」指的就是這條鏈。
 * @returns {{total:number, card:object, chain:object[]}} chain 不含主牌
 */
export function birthCard({ y, m, d }) {
  const total = m + d + y;
  const main = reduceToMajor(total);
  const chain = [];
  let v = main;
  while (v > 9) { v = digitsOf(v); chain.push(DECK[v]); }
  return { total, card: DECK[main], chain };
}

/** 年度牌：生日的月日加上當年年份 */
export function yearCard({ m, d }, year = new Date().getFullYear()) {
  const total = m + d + year;
  return { total, year, card: DECK[reduceToMajor(total)] };
}

/* ── 跟本命盤對照 ─────────────────────────────────────
   一張牌不是憑空的：大牌對應一顆行星或一個星座，
   小牌 2–10 對應黃道上的一旬。那就去本命盤上看那個位置有什麼。
   這是這個 App 少數能真的「算」出來的塔羅內容，不是通用解讀。 */

/**
 * @param {object} card 一張牌
 * @param {object} astro computeAll(...).astro
 * @returns {null|{kind, label, hit, text}}
 */
export function chartLink(card, astro) {
  if (!card || !astro) return null;

  if (card.arcana === '大') {
    const a = MAJOR_ASTRO[card.num];
    if (!a) return null;
    if (a.kind === 'planet') {
      const b = astro.bodies.find(x => x.key === a.key);
      if (!b) return null;
      return {
        kind: 'planet', label: `${card.name} 對應 ${a.zh}`,
        hit: `${a.zh} 在你本命盤：${b.signName} ${Math.floor(b.lon % 30)}°，第 ${b.house} 宮`,
        text: `抽到這張牌，等於指向你本命的${a.zh} —— 看第 ${b.house} 宮的事情。`,
      };
    }
    const sign = SIGNS[a.sign];
    const inSign = astro.bodies.filter(b => b.sign === a.sign);
    return {
      kind: 'sign', label: `${card.name} 對應 ${sign.zh}`,
      hit: inSign.length
        ? `你本命盤落在${sign.zh}的有：${inSign.map(b => b.zh).join('、')}`
        : `你本命盤沒有星體落在${sign.zh}`,
      text: inSign.length
        ? `這張牌的主題，會透過這幾顆星在你身上發作。`
        : `${sign.zh}是你盤上較空的區域 —— 這張牌講的往往是你比較陌生、需要學的那一面。`,
    };
  }

  const d = decanOfCard(card);
  if (!d) return null;                                   // 首牌與宮廷牌不對旬
  const inDecan = astro.bodies.filter(b => decanOfLon(b.lon).index === d.index);
  return {
    kind: 'decan',
    label: `${card.full} 對應 ${d.signName} ${d.from % 30}°–${d.to % 30 || 30}°（${d.ruler}旬）`,
    hit: inDecan.length
      ? `你本命盤正好落在這一旬的有：${inDecan.map(b => `${b.zh} ${(b.lon % 30).toFixed(1)}°`).join('、')}`
      : '你本命盤沒有星體落在這一旬',
    text: inDecan.length
      ? '牌面指的那一段天區，你盤上有東西在那裡 —— 這張牌對你的指向特別具體。'
      : '這一旬在你盤上是空的，牌講的比較是外來的情境，不是你本來的性格。',
  };
}

/* ── 今日一張 ─────────────────────────────────────────
   同一個人、同一天，抽到的必須是同一張 —— 不然重新整理就能一直重抽，
   那就不叫「今日一張」了。所以用日期加上這個人的識別碼當種子。 */

/** 32 位元字串雜湊（xmur3），拿來餵亂數產生器 */
function seedFrom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** mulberry32：小而夠用的固定種子亂數 */
export function seededRandom(str) {
  let a = seedFrom(str)();
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 今天的日期字串（依裝置時區） */
export const todayKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/**
 * 今日一張。同一天同一人結果固定。
 * @param {string} who 這個人的識別碼（沒有檔案就用空字串）
 */
export function dailyCard(who = '', day = todayKey()) {
  const rand = seededRandom(`xuanjian-daily:${day}:${who}`);
  const r = draw({ spread: 'one', allowReversed: true, rand });
  return { day, who, ...r.cards[0] };
}
