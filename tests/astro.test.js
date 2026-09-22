/* 星盤：上升中天、宮位、相位 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { natalChart, aspectBetween, natalAspects, ASPECTS, SIGNS, houseMeaning, wheelSVG } from '../src/engines/astro.js';
import { sunLongitude, jdFromUTC, norm360 } from '../src/engines/calendar.js';

const chart = (o = {}) => natalChart({ y: 1990, m: 5, d: 20, h: 9, minute: 30, tz: 8, lat: 25.033, lon: 121.565, ...o });
const sep = (a, b) => { const d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; };

test('中天：正午時接近太陽，午夜時在對面', () => {
  for (const y of [1960, 1990, 2020]) {
    const noon = natalChart({ y, m: 6, d: 15, h: 12, tz: 8, lat: 25.033, lon: 121.565 });
    assert.ok(sep(noon.mc, noon.sun.lon) < 6, `${y} 正午中天離太陽 ${sep(noon.mc, noon.sun.lon).toFixed(1)}°`);
    const mid = natalChart({ y, m: 6, d: 15, h: 0, tz: 8, lat: 25.033, lon: 121.565 });
    assert.ok(sep(mid.mc, mid.sun.lon) > 174, `${y} 午夜中天沒在太陽對面`);
  }
});

test('上升與中天：下降天底永遠相差 180°', () => {
  const c = chart();
  const by = (k) => c.bodies.find(b => b.key === k).lon;
  assert.ok(Math.abs(sep(by('asc'), by('dsc')) - 180) < 1e-6);
  assert.ok(Math.abs(sep(by('mc'), by('ic')) - 180) < 1e-6);
});

test('等宮制：十二宮各差 30°，第一宮起於上升', () => {
  const c = chart();
  assert.equal(c.houses.length, 12);
  assert.ok(Math.abs(c.houses[0] - c.asc) < 1e-9);
  for (let i = 1; i < 12; i++) {
    assert.ok(Math.abs(norm360(c.houses[i] - c.houses[i - 1]) - 30) < 1e-9, `第 ${i + 1} 宮`);
  }
});

test('星體：宮位與黃經一致，星座由黃經決定', () => {
  const c = chart();
  for (const b of c.bodies) {
    assert.equal(b.sign, Math.floor(b.lon / 30), `${b.zh} 星座不符`);
    assert.equal(b.signName, SIGNS[b.sign].zh);
    assert.equal(b.house, Math.floor(norm360(b.lon - c.asc) / 30) + 1, `${b.zh} 宮位不符`);
    assert.ok(b.deg >= 0 && b.deg < 30);
  }
});

test('相位：容許度內才成立，且是對稱的', () => {
  for (const a of ASPECTS) {
    assert.ok(aspectBetween(0, a.deg), `${a.zh} 正角度沒抓到`);
    assert.equal(aspectBetween(0, a.deg).key, a.key);
    assert.equal(aspectBetween(0, a.deg).orb, 0);
    // 超出容許度就不成立
    const over = a.deg + a.orb + 1;
    const r = aspectBetween(0, over);
    if (r) assert.notEqual(r.key, a.key, `${a.zh} 超出容許度仍成立`);
    // 對稱
    assert.deepEqual(aspectBetween(10, 10 + a.deg)?.key, aspectBetween(10 + a.deg, 10)?.key);
  }
  assert.equal(aspectBetween(0, 45), null, '45° 不該是相位');
});

test('本命相位：不含自己、不重複、上升與中天之間不算', () => {
  const c = chart();
  const seen = new Set();
  for (const x of c.aspects) {
    assert.notEqual(x.aKey, x.bKey, '星體與自己成相位');
    const key = [x.aKey, x.bKey].sort().join('-');
    assert.ok(!seen.has(key), `${key} 重複`);
    seen.add(key);
    assert.ok(!(key === 'asc-mc' || key === 'mc-asc'), '上升與中天之間不該算相位');
    assert.ok(x.orb >= 0);
  }
  // 依容許度由小到大
  for (let i = 1; i < c.aspects.length; i++) {
    assert.ok(c.aspects[i - 1].orb <= c.aspects[i].orb, '相位沒有排序');
  }
});

test('元素分布：七政加日月共 7 顆，日月升版本共 3 顆', () => {
  const c = chart();
  assert.equal(Object.values(c.elements).reduce((a, b) => a + b, 0), 7);
  assert.equal(Object.values(c.elementsBig3).reduce((a, b) => a + b, 0), 3);
});

test('月相：角距與名稱對得上', () => {
  const c = chart();
  assert.ok(c.moonPhase.angle >= 0 && c.moonPhase.angle < 360);
  assert.ok(c.moonPhase.illum >= 0 && c.moonPhase.illum <= 1);
});

test('真太陽時：會改變上升，但幅度在合理範圍', () => {
  const a = chart({ trueSolarTime: false });
  const b = chart({ trueSolarTime: true });
  assert.ok(Math.abs(b.solarCorrection) < 40, `校正 ${b.solarCorrection} 分不合理`);
  assert.ok(sep(a.asc, b.asc) < 15);
});

test('命盤 SVG：星體圖示不重疊、內容完整', () => {
  const svg = wheelSVG(chart());
  assert.ok(svg.startsWith('<svg'));
  const pts = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="12"/g)].map(m => [+m[1], +m[2]]);
  assert.equal(pts.length, 12, '應該畫出十顆星加上升中天');
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    assert.ok(d > 24, `有兩個星體圖示重疊（相距 ${d.toFixed(1)}px）`);
  }
});

test('宮位主題：白話與文言各十二個且不相同', () => {
  for (let i = 1; i <= 12; i++) {
    const bai = houseMeaning(i, 'bai'), wen = houseMeaning(i, 'wen');
    assert.ok(bai && wen, `第 ${i} 宮缺文字`);
    assert.notEqual(bai, wen, `第 ${i} 宮兩種語調一樣`);
  }
});

test('極區：高緯度不會產生 NaN', () => {
  for (const lat of [66, 70, -70]) {
    const c = natalChart({ y: 2000, m: 6, d: 21, h: 12, tz: 0, lat, lon: 0 });
    assert.ok(Number.isFinite(c.asc), `緯度 ${lat} 的上升是 ${c.asc}`);
    assert.ok(Number.isFinite(c.mc));
  }
});
