/* 八宅：遊年卦變的結構性質。不查表，所以可以用性質互相驗證。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRIGRAMS, guaOf, younian, eightDirections, mingGua, zhaiGua, matchZhai } from '../src/engines/bagua.js';

const STARS = ['伏位', '生氣', '天醫', '延年', '絕命', '五鬼', '六煞', '禍害'];

test('遊年星是相互的：乾命的兌方是生氣 ⇔ 兌命的乾方是生氣', () => {
  for (const a of TRIGRAMS) for (const b of TRIGRAMS) {
    assert.equal(younian(a, b), younian(b, a), `${a.n}↔${b.n} 不對稱`);
  }
});

test('每個命卦的八個方位剛好蓋到八顆星各一次', () => {
  for (const t of TRIGRAMS) {
    const got = eightDirections(t.n).map(d => d.star).sort();
    assert.deepEqual(got, [...STARS].sort(), `${t.n}命的八星分布不對`);
  }
});

test('東四命／西四命：四吉方必定落在同組的四個卦上', () => {
  // 這是東四／西四命的定義，而它是從爻變規則自然長出來的，不是寫死的
  for (const t of TRIGRAMS) {
    for (const d of eightDirections(t.n)) {
      assert.equal(d.kind === '吉', guaOf(d.gua).group === t.group,
        `${t.n}命的${d.dir}方（${d.gua}）是${d.star}〔${d.kind}〕，但分組是 ${guaOf(d.gua).group}`);
    }
  }
});

test('對照手算驗過的坎命與乾命標準表', () => {
  const REF = {
    坎: { 東南: '生氣', 東: '天醫', 南: '延年', 北: '伏位', 西南: '絕命', 東北: '五鬼', 西北: '六煞', 西: '禍害' },
    乾: { 西: '生氣', 東北: '天醫', 西南: '延年', 西北: '伏位', 南: '絕命', 東: '五鬼', 北: '六煞', 東南: '禍害' },
  };
  for (const [g, table] of Object.entries(REF)) {
    for (const d of eightDirections(g)) assert.equal(d.star, table[d.dir], `${g}命的${d.dir}方`);
  }
});

test('八卦：爻象、洛書數、方位角都不重複且自洽', () => {
  assert.equal(TRIGRAMS.length, 8);
  const lines = new Set(), luo = new Set(), dirs = new Set();
  for (const t of TRIGRAMS) {
    assert.equal(t.lines.length, 3);
    lines.add(t.lines.join('')); luo.add(t.luoshu); dirs.add(t.dir);
    // 羅盤上每個方位都有正對的一個
    const opp = TRIGRAMS.find(x => x.deg === (t.deg + 180) % 360);
    assert.ok(opp, `${t.n} 找不到羅盤對宮`);
    // 延年對應的是「錯卦」（三爻全變），不是羅盤對宮 —— 後天八卦裡只有坎離兩者重合
    const fan = TRIGRAMS.find(x => x.lines.every((v, i) => v !== t.lines[i]));
    assert.ok(fan, `${t.n} 找不到錯卦`);
    assert.equal(younian(t, fan), '延年', `${t.n} 與錯卦 ${fan.n} 應為延年`);
  }
  assert.equal(lines.size, 8);
  assert.equal(luo.size, 8);
  assert.equal(dirs.size, 8);
});

test('本命卦：九年一循環，且永遠落在八卦之一', () => {
  for (let y = 1900; y <= 2050; y++) for (const g of ['男', '女']) {
    const a = mingGua(y, g), b = mingGua(y + 9, g);
    assert.equal(a.luoshu, b.luoshu, `${y} 與 ${y + 9} 年的${g}命卦不同`);
    assert.notEqual(a.luoshu, 5, '洛書五應已寄宮');
    assert.ok(guaOf(a.name), `${y} ${g} 推出不存在的卦`);
  }
});

test('本命卦：跨世紀不必換公式', () => {
  // 坊間「100 減年份後兩位」只適用 1900 年代；這裡用四位數相加，2000 年後仍正確
  const REF = [[1984, '男', '兌'], [1984, '女', '艮'], [1980, '男', '坤'],
               [1990, '男', '坎'], [2000, '男', '離'], [2000, '女', '乾'], [2010, '男', '艮']];
  for (const [y, g, want] of REF) assert.equal(mingGua(y, g).name, want, `${y} ${g}`);
});

test('宅卦：坐北朝南為坎宅，坐向永遠相對', () => {
  const z = zhaiGua('北');
  assert.equal(z.gua, '坎');
  assert.equal(z.face, '南');
  for (const t of TRIGRAMS) {
    const zz = zhaiGua(t.dir);
    assert.equal(zz.gua, t.n);
    assert.notEqual(zz.sit, zz.face);
  }
  assert.equal(zhaiGua('不存在的方位'), null);
});

test('命宅相配：同組為相配，且與遊年星一致', () => {
  const ming = mingGua(1990, '男');            // 坎命，東四
  const same = matchZhai(ming, zhaiGua('北'));  // 坎宅，東四
  assert.equal(same.same, true);
  assert.equal(same.star, '伏位');
  const diff = matchZhai(ming, zhaiGua('西北')); // 乾宅，西四
  assert.equal(diff.same, false);
  assert.equal(diff.kind, '凶');
  assert.equal(matchZhai(ming, null), null);
});
