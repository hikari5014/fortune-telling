/* 塔羅：洗牌、抽牌、牌陣組合 */
import { DECK, SPREADS } from '../data/tarot.js';

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
 * @param {object} o {spread:key, allowReversed, rand}
 */
export function draw({ spread = 'three', allowReversed = true, rand = Math.random } = {}) {
  const sp = SPREADS.find(s => s.key === spread) || SPREADS[1];
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

/** 轉成純文字，供提示詞使用 */
export function toText(result, question = '') {
  return [
    question ? `問題：${question}` : '',
    `牌陣：${result.spread.name}（${result.spread.desc}）`,
    '',
    ...result.cards.map((c, i) =>
      `${i + 1}. ${c.slot}：${c.full}${c.reversed ? '（逆位）' : '（正位）'} — ${c.meaning}`),
    '',
    `大牌 ${result.majors} 張 / 共 ${result.cards.length} 張，逆位 ${result.revs} 張`,
    ...result.note.map(n => '・' + n),
  ].filter(x => x !== '').join('\n');
}

export { SPREADS, DECK };
