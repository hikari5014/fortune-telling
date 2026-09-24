/* おみくじ（神社・寺院的籤）
   ──────────────────────────────────────────────────────────
   參照淺草寺的「觀音百籤」（元三大師御籤）：一百首五言絕句，每首有固定的吉凶。
   吉凶分七級：大吉、吉、半吉、小吉、末小吉、末吉、凶 —— 淺草寺是「凶」比較多的出名，
   一百支裡有三十支是凶。這是照原本的籤，不是故意嚇人。

   **詩是古籤原文**（見 src/data/omikuji.js 與它的來源說明）。
   **各項運勢的解說是本 App 自己寫的**：淺草寺籤紙上的現代日文解說有著作權，不能照抄；
   這裡依吉凶等級寫一組白話，給一個方向就好，詩本身的意思交給 LLM 或自己讀。

   跟「求籤」頁（六十甲子籤＋擲筊）是兩回事：這支是輕鬆版，
   投個香油錢、搖一搖就有，不用擲筊確認，也不用先想好一件事。 */

import { POEMS } from '../data/omikuji.js';

/** 七個等級，照吉到凶排。tone 決定畫面上的顏色深淺 */
export const LEVELS = [
  { k: '大吉',   tone: 'good', say: '運勢正旺。好事會來，但越順越要記得收斂。' },
  { k: '吉',     tone: 'good', say: '穩穩的好。照著本分做，事情會往好的方向走。' },
  { k: '半吉',   tone: 'half', say: '好壞參半。先把手上的事做完，別急著求更多。' },
  { k: '小吉',   tone: 'half', say: '小小的好運。小事會順，大事要耐心。' },
  { k: '末小吉', tone: 'half', say: '眼前普通，往後才慢慢轉好。' },
  { k: '末吉',   tone: 'half', say: '先苦後甘。現在不順，但路會越走越寬。' },
  { k: '凶',     tone: 'bad',  say: '要小心的時候。放慢腳步、謹言慎行，凶也會轉吉。' },
];
export const levelOf = (k) => LEVELS.find(l => l.k === k) || LEVELS[1];

/** 籤紙上的七個項目（淺草寺的欄位），解說依等級給 */
export const TOPICS = [
  { k: 'wish',   t: '願望', jp: 'ねがいごと' },
  { k: 'health', t: '病氣', jp: 'やまい' },
  { k: 'lost',   t: '失物', jp: 'うせもの' },
  { k: 'wait',   t: '待人', jp: 'まちびと' },
  { k: 'home',   t: '新居・搬家', jp: 'やうつり' },
  { k: 'travel', t: '旅行', jp: 'たびだち' },
  { k: 'love',   t: '結婚・交往', jp: 'えんだん' },
];

const T = {
  大吉:   { wish: '會實現。越順越要守分寸，別因得意而鬆手。', health: '會好轉，照醫囑慢慢調養。', lost: '找得到，多半在熟悉的地方。',
            wait: '會來，還帶著好消息。', home: '好。新環境會帶來新機會。', travel: '好。一路平順。', love: '好。是有緣的人，好好珍惜。' },
  吉:     { wish: '大致會實現，按部就班就好。', health: '會好，別熬夜。', lost: '會出現，稍微等一下。',
            wait: '晚一點會來。', home: '可以，挑個好日子。', travel: '可以，行程別排太滿。', love: '可以，多聽身邊的人怎麼說。' },
  半吉:   { wish: '一半一半，先別急著要結果。', health: '會拖一陣子，但會好。', lost: '不容易找，問問身邊的人。',
            wait: '慢，但會有消息。', home: '等時機成熟再動。', travel: '近的地方可以，遠行再想想。', love: '再多相處一段時間看看。' },
  小吉:   { wish: '小願可成，大願要耐心。', health: '注意休息，小病別拖。', lost: '可能找回一部分。',
            wait: '會來，但比預期晚。', home: '不急，多比較幾個地方。', travel: '小心隨身物品。', love: '慢慢來，別一次要太多。' },
  末小吉: { wish: '現在難，之後才有轉機。', health: '需要時間，耐心治療。', lost: '難找，先別抱太大希望。',
            wait: '暫時不會來，別空等。', home: '暫緩比較好。', travel: '延後比較好。', love: '時機還沒到。' },
  末吉:   { wish: '起頭不順，後來會漸漸好轉。', health: '慢慢會好。', lost: '晚一點才會出現。',
            wait: '晚來。', home: '晚一點再搬比較好。', travel: '準備周全再出發。', love: '先苦後甘，別因一時不順就放棄。' },
  凶:     { wish: '難以實現，先顧好眼前的事。', health: '要認真治療，不可輕忽。', lost: '難找。', wait: '不會來。',
            home: '不宜，先等等。', travel: '暫緩。', love: '不宜著急，先看清楚再說。' },
};
export const topicText = (level, topic) => (T[level] || T.吉)[topic] || '';

/** 抽一支：1–100。用 crypto 的亂數，沒有的話退回 Math.random */
export function drawNumber(rand = null) {
  let x;
  if (rand) x = rand();
  else if (globalThis.crypto?.getRandomValues) x = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  else x = Math.random();
  return 1 + Math.floor(x * POEMS.length);
}

/** 第 n 番的完整內容 */
export function slipOf(n) {
  const p = POEMS.find(x => x.n === n) || POEMS[0];
  return { ...p, levelInfo: levelOf(p.level), topics: TOPICS.map(t => ({ ...t, text: topicText(p.level, t.k) })) };
}

/** 籤號寫成國字＋「番」：第三十二番 */
export function banOf(n) {
  const D = '〇一二三四五六七八九';
  if (n === 100) return '第百番';
  const t = Math.floor(n / 10), u = n % 10;
  return `第${t ? (t > 1 ? D[t] : '') + '十' : ''}${u ? D[u] : ''}番`;
}

/** 給 LLM 與紀錄用的文字版 */
export function omikujiText(s, question = '') {
  return [
    question ? `所問：${question}` : '',
    `籤號：${banOf(s.n)}（觀音百籤・淺草寺系）`,
    `吉凶：${s.level}`,
    `籤詩：${s.lines.join('　')}`,
    '',
    ...s.topics.map(t => `${t.t}：${t.text}`),
  ].filter(x => x !== '').join('\n');
}

/** 各等級的支數（檢查資料用） */
export const levelCounts = () => POEMS.reduce((m, p) => ({ ...m, [p.level]: (m[p.level] || 0) + 1 }), {});
