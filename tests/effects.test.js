/* 分數色階與命盤特效 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from './_dom.js';
installDOM();

const { dial, scoreColor } = await import('../src/motion.js');
const { store } = await import('../src/store.js');
const { natalChart, wheelSVG } = await import('../src/engines/astro.js');

const chart = natalChart({ y: 1990, m: 5, d: 20, h: 9, minute: 30, tz: 8, lat: 25.033, lon: 121.565 });
const rgb = (s) => s.match(/\d+/g).map(Number);

test('色階：0 偏紅、100 偏綠，中間連續過渡', () => {
  const lo = rgb(scoreColor(0)), hi = rgb(scoreColor(100));
  assert.ok(lo[0] > lo[1], '0 分應該是紅的（R > G）');
  assert.ok(hi[1] > hi[0], '100 分應該是綠的（G > R）');
  // 綠色分量單調遞增、紅色分量單調遞減
  let prevG = -1, prevR = 999;
  for (let v = 0; v <= 100; v += 5) {
    const [r, g] = rgb(scoreColor(v));
    assert.ok(g >= prevG - 1, `${v} 分的綠色分量倒退了`);
    assert.ok(r <= prevR + 1, `${v} 分的紅色分量反增了`);
    prevG = g; prevR = r;
  }
});

test('色階：超出範圍會夾住，不會產生怪顏色', () => {
  assert.equal(scoreColor(-50), scoreColor(0));
  assert.equal(scoreColor(150), scoreColor(100));
});

test('顏色不是唯一的管道：弧長與數字同時表達分數', () => {
  // 紅綠色盲分不出色相，所以分數必須同時由圓環填滿的長度與中央數字表達
  const C = 2 * Math.PI * 54;
  for (const v of [0, 37, 100]) {
    const svg = dial(v, 'x', { scale: true });
    assert.match(svg, new RegExp(`data-countup="${v}"`), `${v} 分沒有顯示數字`);
    const off = Number(svg.match(/stroke-dashoffset="([\d.]+)"/)[1]);
    const shown = (1 - off / C) * 100;
    assert.ok(Math.abs(shown - v) < 0.5, `${v} 分的弧長對不上（畫出 ${shown.toFixed(1)}）`);
  }
});

test('分數環：色階開關有效，且中央數字一定在', () => {
  store.setSettings({ scoreColor: true });
  assert.doesNotMatch(dial(80, 'x'), /--dial-c/, '沒要求色階時不該輸出顏色變數');
  assert.match(dial(80, 'x', { scale: true }), /--dial-c/);
  store.setSettings({ scoreColor: false });
  assert.doesNotMatch(dial(80, 'x', { scale: true }), /--dial-c/, '設定關閉後仍然上色');
  store.setSettings({ scoreColor: true });
  // 顏色只是輔助，數字本身一定要在
  for (const o of [{}, { scale: true }]) assert.match(dial(73, 'x', o), /data-countup="73"/);
});

test('命盤特效：三種等級各有各的內容', () => {
  const off = wheelSVG(chart, { fx: 'off' });
  const subtle = wheelSVG(chart, { fx: 'subtle' });
  const full = wheelSVG(chart, { fx: 'full' });

  assert.doesNotMatch(off, /wheel--fx/, '關閉時不該加特效 class');
  assert.match(subtle, /wheel--fx/);
  assert.match(full, /wheel--fx/);

  for (const marker of ['w-asp ', 'w-glow', 'w-veil', 'data-spin']) {
    assert.ok(!off.includes(marker), `關閉時不該有 ${marker}`);
    assert.ok(!subtle.includes(marker), `輕量時不該有 ${marker}`);
    assert.ok(full.includes(marker), `完整時應該有 ${marker}`);
  }
  // 三種等級的星體數量一樣 —— 特效不能改變資訊
  const bodies = (s) => (s.match(/class="w-body"/g) || []).length;
  assert.equal(bodies(off), bodies(full));
  assert.equal(bodies(subtle), bodies(full));
});

test('相位連線：不畫上升與中天，且數量對得上', () => {
  const full = wheelSVG(chart, { fx: 'full' });
  const drawn = (full.match(/class="w-asp /g) || []).length;
  const expect = chart.aspects.filter(a =>
    !['asc', 'mc'].includes(a.aKey) && !['asc', 'mc'].includes(a.bKey)).length;
  assert.equal(drawn, expect, '相位線數量與相位表對不上');
  assert.ok(drawn > 0, '完整特效竟然一條相位線都沒有');
  // 和諧與緊張各有各的樣式
  assert.match(full, /w-asp is-easy/);
  assert.match(full, /w-asp is-hard/);
});

test('命盤特效不影響幾何：星體位置與關閉時完全一致', () => {
  const pos = (s) => [...s.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="12"/g)].map(m => `${m[1]},${m[2]}`);
  assert.deepEqual(pos(wheelSVG(chart, { fx: 'full' })), pos(wheelSVG(chart, { fx: 'off' })));
});

test('預設值：色階開啟、特效完整', async () => {
  const { DEFAULT_SETTINGS } = await import('../src/store.js');
  assert.equal(DEFAULT_SETTINGS.scoreColor, true);
  assert.equal(DEFAULT_SETTINGS.chartEffects, 'full');
});
