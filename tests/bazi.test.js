/* 八字旺衰、藏干、五行力量 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HIDDEN, tenGodGroup, seasonState, strength, elementPower, useGods, analyze } from '../src/engines/bazi.js';
import { fourPillars, STEMS, BRANCHES, STEM_EL, BRANCH_EL, EL_ORDER } from '../src/engines/calendar.js';

test('地支藏干：十二支齊全，本氣五行與該支五行一致', () => {
  assert.equal(HIDDEN.length, 12);
  for (let b = 0; b < 12; b++) {
    const h = HIDDEN[b];
    assert.ok(h.length >= 1 && h.length <= 3, `${BRANCHES[b]} 藏了 ${h.length} 個`);
    for (const ch of h) assert.ok(STEMS.includes(ch), `${BRANCHES[b]} 藏了不存在的干 ${ch}`);
    // 本氣的五行要等於地支本身的五行
    assert.equal(STEM_EL[STEMS.indexOf(h[0])], BRANCH_EL[b],
      `${BRANCHES[b]} 本氣 ${h[0]} 的五行與地支不符`);
  }
});

test('地支藏干：四正只藏一個、四生四墓藏三個（午未除外）', () => {
  for (const b of [0, 3, 9]) assert.equal(HIDDEN[b].length, 1, `${BRANCHES[b]} 應只藏本氣`);
  for (const b of [1, 2, 4, 5, 8, 10]) assert.equal(HIDDEN[b].length, 3, `${BRANCHES[b]} 應藏三個`);
});

test('十神分組：五種且互斥，同五行必為比劫', () => {
  const GROUPS = ['比劫', '印', '食傷', '財', '官殺'];
  for (let a = 0; a < 10; a++) {
    const seen = {};
    for (let b = 0; b < 10; b++) {
      const g = tenGodGroup(a, b);
      assert.ok(GROUPS.includes(g), `${STEMS[a]}→${STEMS[b]} 分到未知的 ${g}`);
      if (STEM_EL[a] === STEM_EL[b]) assert.equal(g, '比劫');
      seen[g] = (seen[g] || 0) + 1;
    }
    // 十個天干剛好五組各兩個
    for (const g of GROUPS) assert.equal(seen[g], 2, `${STEMS[a]} 的${g}不是兩個`);
  }
});

test('旺相休囚死：同五行為旺，五種狀態各出現一次', () => {
  for (const de of EL_ORDER) {
    const got = EL_ORDER.map(me => seasonState(de, me)).sort();
    assert.deepEqual(got, ['休', '囚', '旺', '死', '相'].sort(), `${de} 日主的狀態分布不對`);
    assert.equal(seasonState(de, de), '旺');
  }
});

test('五行力量：加總為 100%，且每一項非負', () => {
  for (let i = 0; i < 40; i++) {
    const p = fourPillars({ y: 1950 + i * 2, m: (i % 12) + 1, d: 15, h: i % 24, tz: 8 });
    const e = elementPower(p);
    const sum = Object.values(e.pct).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 100) < 0.5, `${p.day.name} 五行加總 ${sum}%`);
    for (const v of Object.values(e.pct)) assert.ok(v >= 0);
  }
});

test('旺衰評分：指標落在 0–100，明細筆數固定', () => {
  for (let i = 0; i < 40; i++) {
    const p = fourPillars({ y: 1950 + i * 2, m: (i % 12) + 1, d: 15, h: i % 24, tz: 8 });
    const s = strength(p);
    assert.ok(s.index >= 0 && s.index <= 100, `指標 ${s.index}`);
    // 1 得令 + 四支藏干 + 三個天干
    const hidden = [p.year, p.month, p.day, p.hour].reduce((n, x) => n + HIDDEN[x.index % 12].length, 0);
    assert.equal(s.items.length, 1 + hidden + 3, `${p.day.name} 明細筆數不對`);
    assert.equal(s.dayStemName, STEMS[p.day.index % 10]);
  }
});

test('旺衰：全局同類必定身強，全局剋洩必定身弱', () => {
  // 甲木生於卯月、四柱皆木 → 必強；乙木生於申月、滿局金 → 必弱
  const strong = fourPillars({ y: 1995, m: 3, d: 20, h: 6, tz: 8 });
  const weak = fourPillars({ y: 1990, m: 5, d: 20, h: 9, tz: 8 });   // 乙酉日，滿局金火
  assert.ok(strength(weak).score < 0, '乙木困於金火竟算身強');
  assert.ok(analyze(weak).use.balance === '身弱');
  assert.ok(strength(strong).score > strength(weak).score);
});

test('喜用忌神：身強與身弱互為相反，中和則兩邊皆空', () => {
  const mk = (score) => useGods({ score, band: '', dayEl: '木' }, { key: '平', text: '', need: null });
  const s = mk(5), w = mk(-5), m = mk(0);
  assert.deepEqual(s.like.map(x => x.group).sort(), ['官殺', '財', '食傷'].sort());
  assert.deepEqual(w.like.map(x => x.group).sort(), ['印', '比劫'].sort());
  assert.deepEqual(s.like.map(x => x.group).sort(), w.avoid.map(x => x.group).sort());
  assert.deepEqual(s.avoid.map(x => x.group).sort(), w.like.map(x => x.group).sort());
  assert.equal(m.like.length, 0);
  assert.equal(m.avoid.length, 0);
  // 喜用與忌神不會重疊
  for (const x of s.like) assert.ok(!s.avoid.some(y => y.group === x.group));
});

test('調候：冬月判寒、夏月判熱', () => {
  const COLD = [11, 0, 1], HOT = [5, 6, 7];
  for (let m = 1; m <= 12; m++) {
    const p = fourPillars({ y: 2000, m, d: 15, h: 12, tz: 8 });
    const cl = analyze(p).use.climate;
    const mb = p.month.index % 12;
    if (COLD.includes(mb)) assert.equal(cl.key, '寒', `${BRANCHES[mb]}月`);
    if (HOT.includes(mb)) assert.equal(cl.key, '熱', `${BRANCHES[mb]}月`);
  }
});

test('analyze 對任意日期都不丟例外', () => {
  for (let i = 0; i < 200; i++) {
    const p = fourPillars({ y: 1900 + i, m: (i % 12) + 1, d: (i % 28) + 1, h: i % 24, tz: 8 });
    assert.doesNotThrow(() => analyze(p), `${1900 + i} 年爆炸`);
  }
});
