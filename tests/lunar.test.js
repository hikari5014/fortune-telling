/* 國曆 ⇄ 農曆。
   兩邊走同一套定朔定氣（不是查表），所以最該守的就是「來回換算一定對得起來」。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toLunar, fromLunar, lunarMonthsOf } from '../src/engines/calendar.js';

test('來回換算：國曆 → 農曆 → 國曆，橫跨兩百年都不能跑掉', () => {
  let n = 0;
  for (let y = 1905; y <= 2095; y += 3) {
    for (const [m, d] of [[1, 1], [2, 28], [5, 23], [8, 15], [12, 31]]) {
      const lu = toLunar(y, m, d);
      const back = fromLunar(lu.year, lu.month, lu.day, lu.leap);
      assert.ok(back, `${y}-${m}-${d} 轉回來是 null`);
      assert.deepEqual(back, { y, m, d }, `${y}-${m}-${d} 來回之後變成 ${JSON.stringify(back)}`);
      n++;
    }
  }
  assert.ok(n > 300);
});

test('閏月：有的年有、有的年沒有，而且要排在本月後面', () => {
  const ms = lunarMonthsOf(2020);
  assert.deepEqual(ms.map(x => x.name),
    ['正月', '二月', '三月', '四月', '閏四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '臘月']);
  // 2020 有閏四月
  assert.deepEqual(fromLunar(2020, 4, 1, true), { y: 2020, m: 5, d: 23 });
  // 同一個月號，閏與不閏是不同的月
  assert.deepEqual(fromLunar(2020, 4, 1, false), { y: 2020, m: 4, d: 23 });
  // 2021 沒有閏四月
  assert.equal(fromLunar(2021, 4, 1, true), null);
});

test('大小月：29 或 30 天，超過就是不存在的日子', () => {
  const ms = lunarMonthsOf(2020);
  for (const m of ms) assert.ok(m.days === 29 || m.days === 30, `${m.name} 有 ${m.days} 天`);
  const runSi = ms.find(x => x.num === 4 && x.leap);
  assert.equal(runSi.days, 29);
  assert.equal(fromLunar(2020, 4, 30, true), null, '閏四月只有 29 天');
  assert.ok(fromLunar(2020, 2, 30, false), '二月有 30 天');
});

test('一個農曆年要翻兩本「歲」才湊得齊', () => {
  // 正月到十月在前一歲，冬月臘月在後一歲 —— 只翻一本就會少兩個月
  const ms = lunarMonthsOf(1988);
  assert.equal(ms.filter(x => !x.leap).length, 12);
  assert.ok(ms.some(x => x.num === 1) && ms.some(x => x.num === 12));
});

test('不存在的日期一律回 null，不要硬給一個最接近的', () => {
  assert.equal(fromLunar(2020, 13, 1, false), null);
  assert.equal(fromLunar(2020, 1, 31, false), null);
  assert.equal(fromLunar(2020, 1, 0, false), null);
});

test('表單存的永遠是國曆，農曆只是輸入方式', () => {
  const view = readFileSync('src/views/profile.js', 'utf8');
  // cal 只記「當初用哪種曆法輸入」，日期欄位照樣是 y/m/d 國曆
  assert.match(view, /calMode\(root\) === 'lunar' \? \{ cal: 'lunar' \} : \{\}/);
  assert.match(view, /y: num\('f-y', 2000\), m: num\('f-m', 1\), d: num\('f-d', 1\)/);
  // 農曆那一邊改動時要把國曆欄位同步寫回去
  assert.match(view, /setSel\(g\.y, got\.y,/);
  assert.match(view, /g\.m\.value = String\(got\.m\)/);
  assert.match(view, /rebuildSolarDays\(got\.d\)/);
});

test('生日與時辰用選的：沒有要打字的數字欄位', () => {
  const view = readFileSync('src/views/profile.js', 'utf8');
  for (const id of ['f-y', 'f-m', 'f-d', 'f-ly', 'f-h', 'f-min']) {
    assert.ok(!new RegExp(`<input[^>]*id="${id}"`).test(view), `${id} 還是輸入框`);
    assert.match(view, new RegExp(`pick\\('${id}'`), `${id} 不是選單`);
  }
});

test('干支年用農曆年算，不是拿西元年硬湊', () => {
  const view = readFileSync('src/views/profile.js', 'utf8');
  assert.match(view, /gzName\(\(\(lu\.year - 4\) % 60 \+ 60\) % 60\)/);
  assert.ok(!/gzName\(\(y - 4/.test(view), '還在用西元年推干支');
});
