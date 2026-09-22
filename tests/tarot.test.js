/* 塔羅：牌組完整性、三十六旬、本命牌、今日一張、命盤對照 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const { DECK, SPREADS, MAJOR_ASTRO, PIP_STAGE, COURT_ROLE, ELEMENT_FACE } = await import('../src/data/tarot.js');
const T = await import('../src/engines/tarot.js');
const { computeAll } = await import('../src/prompt/context.js');
const { SIGNS } = await import('../src/engines/astro.js');

const S = { tzOffset: 8, lat: 25.033, lon: 121.5654, city: '台北', register: 'bai' };
const P = { id: 'p1', surname: '王', givenName: '大明', gender: '男', city: '台北',
  lat: 25.033, lon: 121.5654, tz: 8, birth: { y: 1992, m: 11, d: 20, h: 8, minute: 0 } };
const A = computeAll(P, S);

/* ── 牌組 ─────────────────────────────────────────── */

test('七十八張、編號與花色都不重複', () => {
  assert.equal(DECK.length, 78);
  assert.equal(DECK.filter(c => c.arcana === '大').length, 22);
  assert.equal(DECK.filter(c => c.arcana === '小').length, 56);
  assert.equal(new Set(DECK.map(c => c.id)).size, 78);
  assert.equal(new Set(DECK.map(c => c.img)).size, 78);
  for (const suit of ['wands', 'cups', 'swords', 'coins']) {
    const list = DECK.filter(c => c.suitKey === suit);
    assert.equal(list.length, 14, suit);
    assert.deepEqual(list.map(c => c.num), [...Array(14)].map((_, i) => i + 1), suit);
  }
});

test('每一張都有正逆位與關鍵字，沒有空欄位', () => {
  for (const c of DECK) {
    for (const k of ['up', 'rev', 'full', 'sym', 'img']) {
      assert.ok(c[k] && String(c[k]).trim(), `${c.full} 缺 ${k}`);
    }
    assert.ok(Array.isArray(c.kw) && c.kw.length >= 2, `${c.full} 關鍵字不足`);
    if (c.arcana === '大') {
      for (const k of ['lesson', 'advice', 'shadow', 'astro']) assert.ok(c[k], `${c.full} 缺 ${k}`);
      assert.ok(c.lesson.length > 8, c.full);
    } else {
      assert.ok(c.stage && c.face, c.full);
      assert.ok(ELEMENT_FACE[c.el], c.full);
    }
  }
  assert.equal(PIP_STAGE.length, 10);
  assert.equal(COURT_ROLE.length, 4);
});

test('圖檔跟牌一一對應，檔案真的在（外加一張牌背）', () => {
  const files = new Set(readdirSync('assets/tarot').filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)));
  assert.ok(files.has('back'), '少了牌背 back.webp');
  files.delete('back');
  assert.equal(files.size, 78, '牌面圖檔數不對');
  for (const c of DECK) assert.ok(files.has(c.img), `${c.full} 少了圖 ${c.img}.webp`);
});

/* ── 三十六旬 ─────────────────────────────────────── */

test('三十六旬剛好把小牌二到十不重不漏地排完', () => {
  const seen = new Set();
  for (let i = 0; i < 36; i++) {
    const d = T.decan(i);
    assert.ok(d.num >= 2 && d.num <= 10, `第 ${i} 旬數字 ${d.num}`);
    assert.equal(d.from, i * 10);
    assert.equal(d.signName, SIGNS[Math.floor(i / 3)].zh);
    seen.add(`${d.suitKey}${d.num}`);
  }
  assert.equal(seen.size, 36);
  // 花色要跟星座元素一致
  const EL = { wands: '火', coins: '土', swords: '風', cups: '水' };
  for (let i = 0; i < 36; i++) {
    const d = T.decan(i);
    assert.equal(EL[d.suitKey], SIGNS[d.sign].el, `第 ${i} 旬花色與星座元素不合`);
  }
});

test('對得上幾個廣為人知的旬位', () => {
  // 黃金黎明的經典對照，拿來驗算式有沒有寫歪
  const want = {
    0: ['wands', 2, '火星'],    // 牡羊一旬：權杖二＝火星在牡羊
    3: ['coins', 5, '水星'],    // 金牛一旬：錢幣五＝水星在金牛
    9: ['cups', 2, '金星'],     // 巨蟹一旬：聖杯二＝金星在巨蟹
    12: ['wands', 5, '土星'],   // 獅子一旬：權杖五＝土星在獅子
    35: ['cups', 10, '火星'],   // 雙魚三旬：聖杯十＝火星在雙魚
  };
  for (const [i, [suit, num, ruler]] of Object.entries(want)) {
    const d = T.decan(+i);
    assert.equal(d.suitKey, suit, `第 ${i} 旬花色`);
    assert.equal(d.num, num, `第 ${i} 旬數字`);
    assert.equal(d.ruler, ruler, `第 ${i} 旬行星`);
  }
});

test('首牌與宮廷牌不對旬，二到十才對', () => {
  for (const c of DECK.filter(x => x.arcana === '小')) {
    const d = T.decanOfCard(c);
    if (c.num >= 2 && c.num <= 10) assert.ok(d, `${c.full} 應該有旬`);
    else assert.equal(d, null, `${c.full} 不該有旬`);
  }
  assert.equal(T.decanOfLon(0).index, 0);
  assert.equal(T.decanOfLon(359.9).index, 35);
  assert.equal(T.decanOfLon(-10).index, 35, '負的黃經也要能算');
});

/* ── 大牌的占星對應 ───────────────────────────────── */

test('大牌對應表二十二筆，十二星座剛好各一次', () => {
  assert.equal(MAJOR_ASTRO.length, 22);
  const signs = MAJOR_ASTRO.filter(a => a.kind === 'sign').map(a => a.sign);
  assert.equal(signs.length, 12);
  assert.equal(new Set(signs).size, 12, '十二星座應各出現一次');
  const planets = MAJOR_ASTRO.filter(a => a.kind === 'planet').map(a => a.key);
  assert.equal(planets.length, 10);
  assert.equal(new Set(planets).size, 10, '行星不該重複');
  // 對應的行星都要真的在星盤上找得到
  for (const k of planets) {
    assert.ok(A.astro.bodies.some(b => b.key === k), `星盤上沒有 ${k}`);
  }
});

/* ── 命盤對照 ─────────────────────────────────────── */

test('每一張大牌都對得上本命盤，訊息不是空話', () => {
  for (const c of DECK.filter(x => x.arcana === '大')) {
    const l = T.chartLink(c, A.astro);
    assert.ok(l, `${c.full} 對不上`);
    assert.ok(l.label.includes(c.name), l.label);
    assert.ok(l.hit.length > 6 && l.text.length > 10, `${c.full}：${l.hit}`);
  }
});

test('沒有星盤就老實回傳 null，不編故事', () => {
  assert.equal(T.chartLink(DECK[0], null), null);
  assert.equal(T.chartLink(null, A.astro), null);
  assert.equal(T.chartLink(DECK.find(c => c.num === 11 && c.arcana === '小'), A.astro), null);
});

test('小牌的旬對照確實去查了盤上的度數', () => {
  // 找一張天區裡真的有星體的牌，確認它講得出是哪一顆
  const hits = DECK.filter(c => c.arcana === '小' && c.num >= 2 && c.num <= 10)
    .map(c => [c, T.chartLink(c, A.astro)])
    .filter(([, l]) => l && !l.hit.includes('沒有'));
  assert.ok(hits.length >= 1, '這張盤上至少該有一旬落著星體');
  for (const [c, l] of hits) {
    const d = T.decanOfCard(c);
    const inside = A.astro.bodies.filter(b => {
      const lon = ((b.lon % 360) + 360) % 360;
      return lon >= d.from && lon < d.to;
    });
    assert.ok(inside.length > 0, `${c.full} 說有星體，實際卻沒有`);
    for (const b of inside) assert.ok(l.hit.includes(b.zh), `${c.full} 漏掉 ${b.zh}`);
  }
});

/* ── 本命牌與年度牌 ───────────────────────────────── */

test('本命牌一定落在大牌，而且算式對得上', () => {
  const cases = [
    [{ y: 1992, m: 11, d: 20 }, 2023, 7],    // 11+20+1992=2023 → 2+0+2+3=7
    [{ y: 2000, m: 1, d: 1 }, 2002, 4],      // 1+1+2000=2002 → 4
    [{ y: 1985, m: 12, d: 31 }, 2028, 12],   // 12+31+1985=2028 → 12
  ];
  for (const [birth, total, num] of cases) {
    const b = T.birthCard(birth);
    assert.equal(b.total, total, JSON.stringify(birth));
    assert.equal(b.card.num, num, JSON.stringify(birth));
    assert.equal(b.card.arcana, '大');
  }
  // 掃一遍：任何生日都不能爆出範圍
  for (let y = 1900; y <= 2100; y += 7) for (const m of [1, 6, 12]) for (const d of [1, 15, 28]) {
    const b = T.birthCard({ y, m, d });
    assert.ok(b.card && b.card.arcana === '大' && b.card.num >= 0 && b.card.num <= 21,
      `${y}-${m}-${d} 算出 ${b.card?.full}`);
    for (const c of b.chain) assert.ok(c.arcana === '大', '收斂鏈也要是大牌');
    if (b.chain.length) assert.ok(b.chain.at(-1).num <= 9, '鏈的最後一張應該是個位數');
    assert.ok(b.chain.length <= 2, `${y}-${m}-${d} 收斂鏈太長`);
  }
});

test('年度牌會跟著年份換', () => {
  const a = T.yearCard({ m: 11, d: 20 }, 2026);
  const b = T.yearCard({ m: 11, d: 20 }, 2027);
  assert.equal(a.year, 2026);
  assert.equal(a.total, 11 + 20 + 2026);
  assert.ok(a.card.arcana === '大' && b.card.arcana === '大');
  assert.notEqual(a.card.id, b.card.id);
});

/* ── 今日一張 ─────────────────────────────────────── */

test('同一人同一天固定同一張，換人或換天就不同', () => {
  const a1 = T.dailyCard('p1', '2026-09-22');
  const a2 = T.dailyCard('p1', '2026-09-22');
  assert.equal(a1.id, a2.id);
  assert.equal(a1.reversed, a2.reversed);
  // 連抽 60 天，不該一直是同一張
  const ids = new Set();
  for (let d = 1; d <= 60; d++) ids.add(T.dailyCard('p1', `2026-01-${String(d % 28 + 1).padStart(2, '0')}`).id);
  assert.ok(ids.size > 10, `六十天只抽到 ${ids.size} 種牌，種子沒散開`);
  const diff = ['p1', 'p2', 'p3', 'p4'].map(w => T.dailyCard(w, '2026-09-22').id);
  assert.ok(new Set(diff).size >= 3, '不同人不該幾乎都一樣');
});

test('固定種子的亂數落在 0 到 1 之間且分布不偏', () => {
  const r = T.seededRandom('x');
  const xs = [...Array(4000)].map(() => r());
  assert.ok(xs.every(v => v >= 0 && v < 1));
  const mean = xs.reduce((a, b) => a + b) / xs.length;
  assert.ok(Math.abs(mean - 0.5) < 0.03, `平均 ${mean}`);
  const buckets = new Array(10).fill(0);
  xs.forEach(v => buckets[Math.floor(v * 10)]++);
  assert.ok(buckets.every(b => b > 250), `分布不均：${buckets}`);
});

test('todayKey 用的是裝置當地日期', () => {
  assert.equal(T.todayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(T.todayKey(new Date(2026, 11, 31)), '2026-12-31');
});

/* ── 抽牌與輸出 ───────────────────────────────────── */

test('抽牌不重複，而且吃得下自訂牌陣', () => {
  for (const sp of SPREADS) {
    const r = T.draw({ spread: sp.key, rand: T.seededRandom(sp.key) });
    assert.equal(r.cards.length, sp.n, sp.name);
    assert.equal(new Set(r.cards.map(c => c.id)).size, sp.n, `${sp.name} 抽到重複的牌`);
    r.cards.forEach((c, i) => assert.equal(c.slot, sp.slots[i]));
  }
  const mine = { key: 'mine', name: '我的', n: 2, slots: ['起', '落'], desc: '' };
  const r = T.draw({ spread: 'mine', spreads: [...SPREADS, mine], rand: T.seededRandom('m') });
  assert.equal(r.cards.length, 2);
  assert.deepEqual(r.cards.map(c => c.slot), ['起', '落']);
});

test('不允許逆位時全部都是正位', () => {
  const r = T.draw({ spread: 'celtic', allowReversed: false, rand: T.seededRandom('c') });
  assert.equal(r.revs, 0);
  assert.ok(r.cards.every(c => c.meaning === c.up));
});

test('輸出的文字帶得上加厚的牌義與命盤對照', () => {
  const r = T.draw({ spread: 'three', rand: T.seededRandom('t') });
  const txt = T.toText(r, '該不該換工作', { astro: A.astro, profile: P });
  assert.match(txt, /問題：該不該換工作/);
  assert.match(txt, /對照本命盤/);
  assert.match(txt, /本命牌/);
  assert.match(txt, /黃金黎明/);
  for (const c of r.cards) assert.ok(txt.includes(c.full), `少了 ${c.full}`);
  // 沒有盤就不該冒出對照那幾行
  const bare = T.toText(r, '');
  assert.ok(!/對照本命盤/.test(bare));
  assert.ok(!/本命牌/.test(bare));
});

/* ── 抽牌儀式 ─────────────────────────────────────── */

/** 讀 WebP（lossy VP8）的寬高 —— 只為了確認牌背與牌面比例一致 */
function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('latin1', 0, 4), 'RIFF', file);
  assert.equal(b.toString('latin1', 8, 12), 'WEBP', file);
  assert.equal(b.toString('latin1', 12, 16), 'VP8 ', `${file} 不是 lossy VP8，這個讀法看不懂`);
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
}

test('牌背跟牌面同一個比例 —— 翻牌時尺寸不能變', () => {
  const back = webpSize('assets/tarot/back.webp');
  const face = webpSize('assets/tarot/major-00.webp');
  const rb = back.w / back.h, rf = face.w / face.h;
  assert.ok(Math.abs(rb - rf) < 0.005,
    `牌背 ${back.w}×${back.h}（${rb.toFixed(4)}）跟牌面 ${face.w}×${face.h}（${rf.toFixed(4)}）比例不同，翻牌會抽動`);
  assert.ok(back.w >= 280, '牌背解析度太低，放大會糊');
});

test('儀式要不要播，該聽的設定都聽', async () => {
  const { ceremonyOn } = await import('../src/tarotdraw.js');
  assert.equal(ceremonyOn({}), true, '預設要播');
  assert.equal(ceremonyOn({ tarotCeremony: true }), true);
  assert.equal(ceremonyOn({ tarotCeremony: false }), false, '設定關掉就不播');
  assert.equal(ceremonyOn({ motion: 'off' }), false, '動畫關閉就不播');
  assert.equal(ceremonyOn({ motion: 'light' }), true);
});

test('挑位置抽牌：挑到第幾個位置就拿到洗好的第幾張', () => {
  const order = T.shuffle(DECK, T.seededRandom('fixed'));
  const picks = [5, 40, 77];
  const r = T.fromPicks({ spread: 'advice', order, picks, reversed: [false, true, false] });
  assert.equal(r.cards.length, 3);
  r.cards.forEach((c, i) => {
    assert.equal(c.id, order[picks[i]].id, `第 ${i} 張應該是洗好的第 ${picks[i]} 張`);
    assert.equal(c.slot, ['現況', '阻礙', '建議'][i]);
  });
  assert.equal(r.cards[1].reversed, true);
  assert.equal(r.cards[1].meaning, order[40].rev, '逆位要用逆位的解釋');
  assert.equal(r.cards[0].meaning, order[5].up);
  // 同一副牌、同樣的位置，結果必須一樣 —— 不能每次算出不同的牌
  const again = T.fromPicks({ spread: 'advice', order, picks, reversed: [false, true, false] });
  assert.deepEqual(again.cards.map(c => c.id), r.cards.map(c => c.id));
});

test('挑位置抽牌的整體判讀跟直接抽牌是同一套', () => {
  const order = T.shuffle(DECK, T.seededRandom('n'));
  // 湊一手全是大牌的，看「大牌偏多」有沒有跳出來
  const majors = order.map((c, i) => [c, i]).filter(([c]) => c.arcana === '大').slice(0, 3).map(([, i]) => i);
  const r = T.fromPicks({ spread: 'advice', order, picks: majors, reversed: [false, false, false] });
  assert.equal(r.majors, 3);
  assert.equal(r.revs, 0);
  assert.ok(r.note.some(x => x.includes('大牌偏多')), r.note);
  assert.ok(r.note.some(x => x.includes('全為正位')), r.note);
});

test('自訂牌陣也挑得了位置，位置名稱對得上', () => {
  const order = T.shuffle(DECK, T.seededRandom('c'));
  const mine = { key: 'mine', name: '我的', n: 2, slots: ['起', '落'], desc: '' };
  const r = T.fromPicks({ spread: 'mine', order, picks: [1, 2], spreads: [...SPREADS, mine] });
  assert.equal(r.spread.name, '我的');
  assert.deepEqual(r.cards.map(c => c.slot), ['起', '落']);
  assert.ok(r.cards.every(c => c.reversed === false), '沒給正逆位就一律正位');
});
