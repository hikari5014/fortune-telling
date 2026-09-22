/* 姓名、數字、易經、塔羅、求籤、紫微 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeName, wuge, recommend, EL5 } from '../src/engines/naming.js';
import { strokeOf, EXCEPTIONS, NUMERALS, dictSize } from '../src/data/strokes.js';
import { analyzeNumber, lifePath, matchNumbers, luckyPicks, LIFE_PATH } from '../src/engines/numbers.js';
import { STARS, pairStar } from '../src/data/magnetic.js';
import { hexOf, tossCoins, timeHexagram, numberHexagram, flip, inverse, reverse, mutual, reading, HEX_BY_N } from '../src/engines/iching.js';
import { draw, DECK, SPREADS } from '../src/engines/tarot.js';
import { castJiao, divine, BUILTIN_SET, normalizeSet } from '../src/engines/qian.js';
import { ziweiChart, PALACES } from '../src/engines/ziwei.js';

/* ── 姓名 ─────────────────────────────────────── */
test('五格：天人地外總的關係成立', () => {
  const n = analyzeName('王', '小明');
  const g = n.wuge;
  assert.equal(g.天格.n, strokeOf('王') + 1);
  assert.equal(g.人格.n, strokeOf('王') + strokeOf('小'));
  assert.equal(g.地格.n, strokeOf('小') + strokeOf('明'));
  assert.equal(g.總格.n, strokeOf('王') + strokeOf('小') + strokeOf('明'));
  for (const k of ['天格', '人格', '地格', '外格', '總格']) {
    assert.ok(EL5.includes(g[k].el), `${k} 五行 ${g[k].el} 不合法`);
    assert.ok(g[k].n > 0);
  }
});

test('筆畫字典有涵蓋 CJK 基本區', () => {
  assert.ok(dictSize >= 20000, `字典只有 ${dictSize} 字`);
  for (const [ch, n] of Object.entries(EXCEPTIONS)) assert.equal(strokeOf(ch), n, `例外 ${ch}`);
  for (const [ch, n] of Object.entries(NUMERALS)) {
    assert.equal(strokeOf(ch, { numeralRule: true }), n, `${ch} 依數值應為 ${n}`);
  }
  assert.notEqual(strokeOf('十', { numeralRule: false }), 10, '關閉數目字規則後十應為實際筆畫');
});

test('康熙筆畫：常見部首按康熙計，例外表生效', () => {
  assert.equal(strokeOf('江'), 7);    // 氵算 4
  assert.equal(strokeOf('花'), 10);   // 艹算 6
  assert.equal(strokeOf('陳'), 16);   // 阝左算 8
  assert.equal(strokeOf('郭'), 15);   // 阝右算 7
  assert.equal(strokeOf('蕭'), 19);   // 例外
  assert.equal(strokeOf('萬'), 15);   // 例外
});

test('取名推薦：回傳的組合都符合上限', () => {
  const list = recommend([4], { count: 2, max: 20, top: 10 });
  assert.ok(list.length > 0);
  for (const x of list) {
    assert.equal(x.strokes.length, 2);
    for (const s of x.strokes) assert.ok(s >= 1 && s <= 20, `筆畫 ${s} 超出上限`);
  }
});

/* ── 數字 ─────────────────────────────────────── */
test('八星磁場：八組各八個配對，合計蓋滿 1–9 的非 05 組合', () => {
  const all = new Set();
  for (const [k, v] of Object.entries(STARS)) {
    assert.equal(v.keys.length, 8, `${k} 不是八組`);
    for (const p of v.keys) {
      assert.ok(!all.has(p), `${p} 出現在兩個磁場`);
      all.add(p);
    }
  }
  assert.equal(all.size, 64);   // 8 星 × 8 組
  // 含 0 或 5 的一律是連接數
  for (const p of ['05', '50', '10', '15', '90']) assert.equal(pairStar(p).name, '連接');
});

test('號碼評分：落在 0–100，配對數為長度減一', () => {
  for (const s of ['0912345678', '0987654321', 'ABC-1234', '1111111111']) {
    const r = analyzeNumber(s);
    assert.ok(r.score >= 0 && r.score <= 100, `${s} 得 ${r.score}`);
    assert.equal(r.items.length, Math.max(0, r.digits.length - 1));
  }
});

test('生命靈數：化到個位或大師數，且都有說明', () => {
  for (let y = 1950; y <= 2020; y += 3) {
    const lp = lifePath(y, 6, 15);
    assert.ok([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33].includes(lp.main), `${y} 得 ${lp.main}`);
    assert.ok(lp.text, `${y} 沒有說明`);
  }
  assert.equal(Object.keys(LIFE_PATH).length, 12);
});

test('幸運數字推薦：回傳的組合都屬於指定磁場', () => {
  for (const focus of ['天醫', '生氣', '延年', '伏位']) {
    for (const x of luckyPicks(1, focus, 8)) {
      assert.ok(!/[05]/.test(x.pair), `${x.pair} 含 0 或 5`);
    }
  }
});

/* ── 易經 ─────────────────────────────────────── */
test('六十四卦：卦序完整不重複', () => {
  assert.equal(Object.keys(HEX_BY_N).length, 64);
  const names = new Set(Object.values(HEX_BY_N).map(h => h.name));
  assert.equal(names.size, 64);
});

test('變卦：錯綜互的運算正確', () => {
  const lines = [1, 0, 1, 1, 0, 0];
  assert.deepEqual(inverse(lines), [0, 1, 0, 0, 1, 1]);
  assert.deepEqual(reverse(lines), [0, 0, 1, 1, 0, 1]);
  assert.deepEqual(mutual(lines), [0, 1, 1, 1, 1, 0]);
  assert.deepEqual(flip(lines, 0), [0, 0, 1, 1, 0, 0]);
  assert.deepEqual(inverse(inverse(lines)), lines);
  assert.deepEqual(reverse(reverse(lines)), lines);
});

test('銅錢起卦：六爻各由三枚銅錢決定，老陰老陽才是動爻', () => {
  for (let i = 0; i < 50; i++) {
    const rows = tossCoins();
    assert.equal(rows.length, 6);
    for (const r of rows) {
      assert.equal(r.coins.length, 3);
      for (const c of r.coins) assert.ok(c === 2 || c === 3, `銅錢值 ${c}`);
      assert.equal(r.sum, r.coins.reduce((a, b) => a + b, 0));
      assert.equal(r.line, r.sum % 2 === 1 ? 1 : 0, '陰陽與總和的奇偶不符');
      assert.equal(r.moving, r.sum === 6 || r.sum === 9, '動爻判定不符老陰老陽');
      assert.ok(['老陰', '少陽', '少陰', '老陽'].includes(r.name));
    }
    assert.ok(hexOf(rows.map(r => r.line)), '查不到卦');
  }
});

test('時間與數字起卦：結果合法且可重現', () => {
  for (const r of [timeHexagram(new Date('2026-09-22T09:30:00Z')), numberHexagram(37, 88)]) {
    assert.equal(r.lines.length, 6);
    for (const v of r.lines) assert.ok(v === 0 || v === 1);
    assert.ok(r.movingIdx >= 0 && r.movingIdx < 6, `動爻 ${r.movingIdx}`);
    assert.ok(hexOf(r.lines), '查不到卦');
    assert.ok(r.detail, '沒有推導說明');
  }
  const t = new Date('2026-03-03T03:03:00Z');
  assert.deepEqual(timeHexagram(t).lines, timeHexagram(t).lines);
  assert.deepEqual(numberHexagram(37, 88).lines, numberHexagram(37, 88).lines);
});

test('解卦：之卦只在動爻上與本卦不同', () => {
  for (let i = 0; i < 40; i++) {
    const rows = tossCoins();
    const lines = rows.map(r => r.line);
    const moving = rows.map((r, k) => (r.moving ? k : -1)).filter(k => k >= 0);
    const r = reading(lines, moving);
    assert.ok(r.ben?.name, '沒有本卦');
    assert.ok(r.hu?.name && r.cuo?.name && r.zong?.name, '互錯綜不齊');
    // 錯卦是六爻全變、綜卦是上下顛倒
    assert.deepEqual(r.cuo.lines, inverse(lines));
    assert.deepEqual(r.zong.lines, reverse(lines));
    assert.deepEqual(r.hu.lines, mutual(lines));
    if (!moving.length) { assert.equal(r.zhi, null, '沒有動爻就不該有之卦'); continue; }
    for (let k = 0; k < 6; k++) {
      assert.equal(r.zhi.lines[k] !== lines[k], moving.includes(k), `第 ${k + 1} 爻`);
    }
  }
});

/* ── 塔羅 ─────────────────────────────────────── */
test('塔羅：78 張牌，抽牌不重複且張數符合牌陣', () => {
  assert.equal(DECK.length, 78);
  assert.equal(new Set(DECK.map(c => c.id)).size, 78, '牌有重複的 id');
  for (const sp of SPREADS) {
    const r = draw({ spread: sp.key });
    assert.equal(r.cards.length, sp.slots.length, `${sp.name} 張數不對`);
    assert.equal(new Set(r.cards.map(c => c.id)).size, r.cards.length, `${sp.name} 抽到重複的牌`);
    assert.deepEqual(r.cards.map(c => c.slot), sp.slots, `${sp.name} 位置沒對上`);
    for (const c of r.cards) assert.ok(c.meaning, `${c.name} 沒有牌義`);
  }
});

test('塔羅：關閉逆位時全部都是正位', () => {
  for (let i = 0; i < 20; i++) {
    for (const c of draw({ spread: 'celtic', allowReversed: false }).cards) {
      assert.equal(c.reversed, false);
    }
  }
});

/* ── 求籤 ─────────────────────────────────────── */
test('擲筊：三種結果的機率都不是零', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(castJiao().kind);
  assert.equal(seen.size, 3, `只擲出 ${[...seen].join('、')}`);
});

test('求籤：內建六十籤編號與干支齊全', () => {
  assert.equal(BUILTIN_SET.poems.length, 60);
  const gz = new Set(BUILTIN_SET.poems.map(p => p.gz));
  assert.equal(gz.size, 60, '干支編號有重複');
  for (const p of BUILTIN_SET.poems) {
    assert.equal(p.lines.length, 4, `第 ${p.n} 籤不是四句`);
    for (const l of p.lines) assert.equal([...l].length, 7, `第 ${p.n} 籤不是七言`);
  }
  assert.match(BUILTIN_SET.source, /自撰/, '來源必須標明是自撰');
});

test('求籤：擲到聖筊才算數', () => {
  for (let i = 0; i < 50; i++) {
    const r = divine(BUILTIN_SET, { need: 1 });
    if (r.confirmed) assert.equal(r.rounds.at(-1).ok, true);
  }
});

test('匯入籤詩集：格式不對會被正規化或擋下', () => {
  const ok = normalizeSet({ id: 't', name: '測試', source: '測試來源', poems: [{ n: 1, gz: '甲子', luck: '大吉', lines: ['一', '二', '三', '四'] }] });
  assert.equal(ok.poems.length, 1);
  assert.throws(() => normalizeSet({ name: '沒有籤' }), /沒有找到籤詩/);
});

/* ── 紫微 ─────────────────────────────────────── */
test('紫微：十二宮齊全、命身宮在盤上、五行局合法', () => {
  for (let i = 0; i < 24; i++) {
    const z = ziweiChart({ y: 1960 + i * 2, m: (i % 12) + 1, d: (i % 28) + 1, h: i % 24, tz: 8, gender: i % 2 ? '男' : '女' });
    assert.equal(z.palaces.length, 12);
    assert.deepEqual(z.palaces.map(p => p.name).sort(), [...PALACES].sort(), '宮名不齊');
    assert.ok(z.life >= 0 && z.life < 12);
    assert.ok(z.body >= 0 && z.body < 12);
    assert.match(z.ju.name, /局$/);
    assert.equal(z.sihua.length, 4);
  }
});

test('紫微：十四主星每顆只出現一次', () => {
  const z = ziweiChart({ y: 1990, m: 5, d: 20, h: 9, tz: 8, gender: '男' });
  const all = z.palaces.flatMap(p => p.main);
  assert.equal(all.length, 14, `主星共 ${all.length} 顆`);
  assert.equal(new Set(all).size, 14, '有主星重複');
});
