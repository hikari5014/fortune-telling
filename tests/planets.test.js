/* 行星：與獨立演算法交叉驗證，加上四項結構性質 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planetPos, sunLonFromEarth, allPlanets, PLANETS, precession } from '../src/engines/planets.js';
import { sunLongitude, jdFromUTC, norm360, ttFromUT } from '../src/engines/calendar.js';

const sep = (a, b) => { const d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; };

test('太陽黃經：克卜勒鏈路與 Meeus 視黃經公式吻合到角分以內', () => {
  // 兩套完全獨立的演算法。殘差應該是光行差(20.5")加章動(≤17")的量級，約 0.6 角分。
  let worst = 0, at = '';
  for (let y = 1900; y <= 2050; y++) {
    for (const [m, d] of [[1, 15], [4, 15], [7, 15], [10, 15]]) {
      const jd = jdFromUTC(y, m, d, 12);
      const diff = sep(sunLongitude(jd), sunLonFromEarth(ttFromUT(jd))) * 60;
      if (diff > worst) { worst = diff; at = `${y}-${m}-${d}`; }
    }
  }
  assert.ok(worst < 1.2, `最大差 ${worst.toFixed(2)} 角分（${at}），超出光行差加章動的量級`);
});

test('內行星的最大距角不超過物理上限', () => {
  const jd0 = jdFromUTC(2020, 1, 1, 0);
  for (const [key, limit] of [['mercury', 28.5], ['venus', 47.5]]) {
    let max = 0;
    for (let i = 0; i < 3650; i += 2) {
      const jd = jd0 + i;
      max = Math.max(max, sep(planetPos(key, jd).lon, sunLonFromEarth(jd)));
    }
    assert.ok(max <= limit, `${key} 距角 ${max.toFixed(1)}° 超過 ${limit}°`);
    assert.ok(max > limit - 5, `${key} 距角 ${max.toFixed(1)}° 太小，可能沒算到`);
  }
});

test('逆行的次數與長度符合公認值', () => {
  const jd0 = jdFromUTC(2020, 1, 1, 0);
  const REF = {   // [十年次數下限, 上限, 平均天數下限, 上限]
    mercury: [28, 36, 18, 26],
    venus: [5, 8, 35, 48],
    mars: [3, 6, 55, 85],
    jupiter: [8, 11, 110, 130],
    saturn: [9, 12, 130, 150],
  };
  for (const [key, [n0, n1, d0, d1]] of Object.entries(REF)) {
    let spells = 0, wasRetro = false, cur = 0; const lens = [];
    for (let i = 0; i < 3653; i++) {
      const jd = jd0 + i;
      let s = planetPos(key, jd + 1).lon - planetPos(key, jd).lon;
      if (s > 180) s -= 360; if (s < -180) s += 360;
      const retro = s < 0;
      if (retro) { cur++; if (!wasRetro) spells++; }
      else if (wasRetro) { lens.push(cur); cur = 0; }
      wasRetro = retro;
    }
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    assert.ok(spells >= n0 && spells <= n1, `${key} 十年逆行 ${spells} 次，超出 ${n0}–${n1}`);
    assert.ok(avg >= d0 && avg <= d1, `${key} 平均逆行 ${avg.toFixed(0)} 天，超出 ${d0}–${d1}`);
  }
});

test('外行星走得夠慢：天海冥一年移動不到 10°', () => {
  const jd = jdFromUTC(2026, 1, 1, 0);
  for (const key of ['uranus', 'neptune', 'pluto']) {
    const move = sep(planetPos(key, jd).lon, planetPos(key, jd + 365).lon);
    assert.ok(move < 10, `${key} 一年移動 ${move.toFixed(1)}°，太快`);
  }
});

test('歲差：每世紀約 1.396°（5029 角秒）', () => {
  assert.ok(Math.abs(precession(1) - 1.3969) < 0.001);
  assert.equal(precession(0), 0);
});

test('allPlanets 回傳完整且速度與順逆一致', () => {
  const list = allPlanets(jdFromUTC(2026, 9, 22, 12));
  assert.equal(list.length, PLANETS.length);
  for (const p of list) {
    assert.ok(p.lon >= 0 && p.lon < 360, `${p.zh} 黃經 ${p.lon} 超出範圍`);
    assert.equal(p.retro, p.speed < 0, `${p.zh} 的 retro 與 speed 不一致`);
    assert.ok(Math.abs(p.speed) < 3, `${p.zh} 每日移動 ${p.speed}° 不合理`);
  }
  // 不含外行星時剛好少三顆
  assert.equal(allPlanets(jdFromUTC(2026, 9, 22, 12), { outer: false }).length, PLANETS.length - 3);
});
