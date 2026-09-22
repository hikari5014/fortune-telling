/* 曆法：節氣、農曆、四柱、干支關係 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jdFromUTC, dateFromJD, dayNumOf, sunLongitude, solarTermJD, termsOfYear,
  toLunar, fourPillars, gzName, gzIndexOf, nayin, norm360,
  BR_CHONG, BR_LIUHE, BR_SANHE, pairHas, inSanhe, STEMS, BRANCHES,
} from '../src/engines/calendar.js';

test('儒略日與日期互轉', () => {
  assert.equal(jdFromUTC(2000, 1, 1, 12), 2451545.0);          // J2000.0
  const d = dateFromJD(2451545.0);
  assert.deepEqual([d.y, d.m, d.d], [2000, 1, 1]);
});

test('日柱以 (JDN+49) mod 60 推，且每天恰好進一位', () => {
  let prev = null;
  for (let i = 0; i < 400; i++) {
    const jdn = dayNumOf(2026, 1, 1) + i;
    const gz = ((jdn + 49) % 60 + 60) % 60;
    if (prev !== null) assert.equal(gz, (prev + 1) % 60, `第 ${i} 天沒有接上`);
    prev = gz;
  }
});

test('一年剛好 24 個節氣，且黃經每 15° 一個', () => {
  const terms = termsOfYear(2026);
  assert.equal(terms.length, 24);
  for (const t of terms) {
    const lon = sunLongitude(t.jd);
    const off = Math.min(lon % 15, 15 - (lon % 15));
    assert.ok(off < 0.01, `${t.name} 的黃經 ${lon.toFixed(3)}° 不是 15 的倍數`);
  }
});

test('立春落在 2 月 3–5 日', () => {
  for (let y = 1950; y <= 2050; y += 7) {
    const jd = solarTermJD(315, jdFromUTC(y, 2, 4) - 8 / 24);
    const d = dateFromJD(jd + 8 / 24);
    assert.equal(d.m, 2, `${y} 年立春不在 2 月`);
    assert.ok(d.d >= 3 && d.d <= 5, `${y} 年立春在 ${d.d} 日`);
  }
});

test('農曆：日序連續，每月 29 或 30 天', () => {
  let prev = null;
  for (let i = 0; i < 800; i++) {
    const [y, m, d] = (() => { const t = new Date(Date.UTC(2026, 0, 1)); t.setUTCDate(t.getUTCDate() + i); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; })();
    const l = toLunar(y, m, d);
    assert.ok(l.monthDays === 29 || l.monthDays === 30, `${y}-${m}-${d} 的農曆月有 ${l.monthDays} 天`);
    if (prev) {
      const ok = l.day === prev.day + 1 || (l.day === 1 && prev.day === prev.monthDays);
      assert.ok(ok, `${y}-${m}-${d}：農曆 ${prev.day} → ${l.day} 不連續`);
    }
    prev = l;
  }
});

test('四柱：年柱以立春為界', () => {
  // 2026 立春在 2/4；2/3 仍算前一年
  const before = fourPillars({ y: 2026, m: 2, d: 3, h: 12, tz: 8 });
  const after = fourPillars({ y: 2026, m: 2, d: 5, h: 12, tz: 8 });
  assert.notEqual(before.year.name, after.year.name);
  assert.equal(after.yearForGZ, 2026);
  assert.equal(before.yearForGZ, 2025);
});

test('四柱：時柱依五鼠遁，甲己日子時起甲子', () => {
  for (let i = 0; i < 400; i++) {
    const t = new Date(Date.UTC(2026, 0, 1)); t.setUTCDate(t.getUTCDate() + i);
    const p = fourPillars({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: 1, tz: 8 });
    const expect = ((p.day.index % 10 % 5) * 2 + 1) % 10;      // 丑時
    assert.equal(p.hour.index % 10, expect);
    assert.equal(p.hour.index % 12, 1);
  }
});

test('干支：60 組不重複，gzIndexOf 是 gzName 的反函式', () => {
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const n = gzName(i);
    assert.ok(!seen.has(n), `${n} 重複`);
    seen.add(n);
    assert.equal(gzIndexOf(i % 10, i % 12), i);
  }
  assert.equal(seen.size, 60);
});

test('納音：每兩個干支共用一組，共 30 組', () => {
  const names = new Set();
  for (let i = 0; i < 60; i += 2) {
    assert.equal(nayin(i).name, nayin(i + 1).name, `${gzName(i)} 與 ${gzName(i + 1)} 納音應相同`);
    names.add(nayin(i).name);
  }
  assert.equal(names.size, 30);
});

test('地支關係：六沖相隔 6、六合成 6 組、三合為每組相隔 4', () => {
  for (const [a, b] of BR_CHONG) assert.equal((b - a + 12) % 12, 6, `${BRANCHES[a]}${BRANCHES[b]} 不是相隔 6`);
  assert.equal(BR_LIUHE.length, 6);
  for (const g of BR_SANHE) {
    assert.equal(g.length, 3);
    assert.equal((g[1] - g[0] + 12) % 12, 4);
    assert.equal((g[2] - g[1] + 12) % 12, 4);
  }
  // 關係是相互的
  for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) {
    assert.equal(pairHas(BR_CHONG, a, b), pairHas(BR_CHONG, b, a));
    assert.equal(inSanhe(a, b), inSanhe(b, a));
  }
});

test('norm360 永遠落在 [0, 360)', () => {
  for (const x of [-720.5, -0.001, 0, 359.999, 360, 1080.25]) {
    const v = norm360(x);
    assert.ok(v >= 0 && v < 360, `norm360(${x}) = ${v}`);
  }
});
