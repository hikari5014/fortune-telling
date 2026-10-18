/* 各功能的分享卡內容（給 sharecard.js 畫）。這裡只組資料，不碰畫面。
   原則：不放姓名、生日；「所問的事」放在 ask，要使用者勾選才會印上去。 */

import { appUrl } from './sharelink.js';
import { today } from './sharecard.js';

const base = () => appUrl();
const zh = (n) => {
  const d = '〇一二三四五六七八九';
  if (n <= 10) return n === 10 ? '十' : d[n];
  if (n < 20) return `十${d[n % 10]}`;
  if (n < 100) return `${d[Math.floor(n / 10)]}十${n % 10 ? d[n % 10] : ''}`;
  return n === 100 ? '一百' : String(n);
};
const askOf = (q, head = '所問') => (q ? `${head}：${q}` : '');

/** 求籤（廟裡請示過的，或直接求籤） */
export function qianSpec(poem, set, god, q) {
  return {
    kicker: god ? `${god.name}・靈籤` : set.name,
    label: god ? `於 ${god.name} 座前　求得` : `${set.name}　求得`,
    title: `第${zh(poem.n)}首`, big: String(poem.n), badge: poem.luck,
    hero: { type: 'poem', lines: poem.lines },
    gist: poem.gist, ask: askOf(q), date: today(),
    link: `${base()}#/temple${god ? `?god=${god.id}` : ''}`, cta: '掃描，免費求一支籤',
  };
}

/** 神社的御神籤 */
export function omikujiSpec(s, banLabel, question) {
  return {
    kicker: '星宮神社・御神籤', label: '星空下的神社　抽得',
    title: banLabel, big: String(s.n), badge: s.level,
    hero: { type: 'poem', lines: s.lines },
    gist: s.levelInfo?.say || '', ask: askOf(question), date: today(),
    link: `${base()}#/omikuji`, cta: '掃描，免費抽一支神籤',
  };
}

/** 塔羅：imgOf(card) 給圖片網址（內建牌或自訂牌組） */
export function tarotSpec(res, question, imgOf, { label } = {}) {
  const cards = res.cards;
  const one = cards.length === 1 ? cards[0] : null;
  return {
    kicker: 'TAROT・塔羅', label: label || res.spread.name,
    title: one ? `${one.name}${one.reversed ? '（逆位）' : ''}` : res.spread.name,
    big: one ? (one.num != null ? String(one.num) : '') : String(cards.length),
    hero: { type: 'cards', cards: cards.map(c => ({ img: imgOf(c), name: c.name, rev: !!c.reversed, pos: one ? '' : c.slot })) },
    gist: (res.note && res.note[0]) || (one && (one.reversed ? one.rev : one.up)) || '',
    ask: askOf(question), date: today(),
    link: `${base()}#/tarot`, cta: '掃描，免費抽一次塔羅',
  };
}

/** 易經：lines 下→上，moving 動爻 */
export function ichingSpec(r, lines, moving, question) {
  const toLines = r.zhi ? lines.map((v, i) => (moving.includes(i) ? 1 - v : v)) : null;
  return {
    kicker: '易經・卜卦', label: '起卦得',
    title: r.zhi ? `${r.ben.full} 之 ${r.zhi.full}` : r.ben.full, big: r.ben.name,
    hero: { type: 'hexagram', from: { name: r.ben.full, lines, moving }, to: r.zhi ? { name: r.zhi.full, lines: toLines } : null },
    gist: r.ben.gist || r.ben.judge || '', ask: askOf(question), date: today(),
    link: `${base()}#/iching`, cta: '掃描，免費卜一卦',
  };
}

const ANIMAL_NAME = { frog: '金蟾的嘴', turtle: '靈龜的碗', koi: '錦鯉的嘴', rabbit: '玉兔的臼' };
/** 許願池：願望本身是私事 —— 放在 ask，勾了才印 */
export function wishSpec(e, blessing) {
  const hit = e.spot === 'animal' ? (ANIMAL_NAME[e.k] || '') : e.spot === 'bowl' ? '月盞' : '';
  return {
    kicker: '星空許願池', label: '今晚，在星空許願池',
    title: hit ? `投進${hit}` : '投下一枚硬幣', big: '願', badge: hit ? '必成' : '',
    hero: { type: 'coin', gold: !!e.gold, text: hit ? '願望必定實現' : '' },
    gist: blessing || '願望沉進池底了。', ask: askOf(e.wish, '願望'), date: today(),
    link: `${base()}#/wish`, cta: '掃描，免費許一個願',
  };
}

/** 星盤的日月升（時辰不詳就不放上升） */
export function natalSpec(a, hourUnknown) {
  const items = [[a.sun.signName, '太陽'], [a.moon.signName, '月亮']];
  if (!hourUnknown) items.push([a.ascendant.signName, '上升']);
  return {
    kicker: 'NATAL CHART・星盤', label: '我的星盤',
    title: hourUnknown ? '太陽與月亮' : '日月升', big: '☉',
    hero: { type: 'signs', items },
    gist: '太陽是想成為的樣子，月亮是內心需要的安全感，上升是別人第一眼看到的你。', date: today(),
    link: `${base()}#/astro`, cta: '掃描，免費排你的星盤',
  };
}

/** 神社參拜：御朱印 */
export function goshuinSpec(dateText) {
  return {
    kicker: '星宮神社', label: '今日參拜',
    title: '御朱印', big: '拜',
    hero: { type: 'goshuin', date: dateText },
    gist: '淨手、搖鈴、二拜二拍手一拜。把心事說給星空聽。', date: today(),
    link: `${base()}#/omikuji`, cta: '掃描，一起去參拜',
  };
}

/** 廟：拜過哪位神明 */
export function templeSpec(g, e) {
  return {
    kicker: '玄鑑宮', label: `今日參拜　${g.name}`,
    title: g.name, big: g.short[0], badge: '',
    hero: { type: 'tablet', text: g.name },
    gist: [e?.poem ? `求得${e.poem}` : '', e?.offerings?.length ? `供品：${e.offerings.join('、')}` : '', g.say].filter(Boolean).join('。'),
    ask: askOf(e?.wish || e?.ask, '祈求'), date: today(),
    link: `${base()}#/temple?god=${g.id}`, cta: '掃描，免費到廟裡拜拜',
  };
}
