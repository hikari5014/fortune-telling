/* 行運：今天的天空疊到本命盤上 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { natalChart } = await import('../src/engines/astro.js');
const { transits, transitText, sky, noonJD } = await import('../src/engines/transit.js');

const natal = natalChart({ y: 1990, m: 5, d: 17, h: 14, minute: 30 });

test('生日當天的行運：每顆行星都跟自己合相（月亮除外，它半天就走了好幾度）', () => {
  const t = transits(natal, { y: 1990, m: 5, d: 17 });
  for (const k of ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) {
    const hit = t.list.find(x => x.mover === k && x.target === k);
    assert.ok(hit && hit.key === 'conj', `${k} 沒有跟自己合相`);
    assert.ok(hit.orb < 0.5, `${k} 合相差太多：${hit.orb}`);
  }
});

test('天空位置對得上已知的天象：2026 秋分當天太陽在天秤 0°', () => {
  const s = sky(noonJD(2026, 9, 23));
  const sun = s.find(b => b.key === 'sun');
  assert.equal(sun.signName, '天秤座');
  assert.ok(sun.deg < 1);
});

test('容許度比本命盤緊：外行星的相位不會超過 1.2°', () => {
  for (const [y, m, d] of [[2026, 1, 1], [2026, 6, 15], [2027, 3, 3]]) {
    for (const x of transits(natal, { y, m, d }).list) {
      if (['uranus', 'neptune', 'pluto'].includes(x.mover)) assert.ok(x.orb <= 1.2, `${x.label} ${x.orb}`);
      assert.ok(x.orb <= 3.7, `${x.label} 容許度 ${x.orb} 太寬`);
    }
  }
});

test('時辰不詳：不列上升、中天，也不算月亮落第幾宮', () => {
  const t = transits(natal, { y: 2026, m: 9, d: 23, hourKnown: false });
  assert.ok(!t.list.some(x => x.target === 'asc' || x.target === 'mc'));
  assert.equal(t.moon.house, null);
  assert.match(transitText(t), /時辰不詳/);
});

test('排序：分量重的慢星緊密相位排在月亮前面', () => {
  const t = transits(natal, { y: 2026, m: 9, d: 23 });
  const ranks = t.list.map(x => x.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => b - a));
  assert.ok(t.list.every(x => typeof x.applying === 'boolean'));
});
