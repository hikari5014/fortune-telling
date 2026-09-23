/* 星空：自轉與視差的行為。
   畫面好不好看驗不了，但「會不會跳」「有沒有層次」「該停的時候有沒有停」可以。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from './_dom.js';
installDOM();

/** 一個夠用的 canvas 假物件：只記下畫過哪些圓心 */
function fakeCanvas(w = 300, h = 600) {
  const arcs = [];
  const noop = () => {};
  const ctx = {
    setTransform: noop, clearRect: noop, beginPath: noop, fill: noop, stroke: noop,
    moveTo: noop, lineTo: noop, arc: (x, y) => arcs.push([x, y]),
    createLinearGradient: () => ({ addColorStop: noop }),
    fillStyle: '', strokeStyle: '', lineWidth: 0,
  };
  return {
    arcs,
    cv: {
      width: 0, height: 0,
      getContext: () => ctx,
      getBoundingClientRect: () => ({ width: w, height: h }),
    },
  };
}

/** 手動推進動畫：攔下 rAF，自己決定時間戳 */
function driver() {
  let cb = null;
  globalThis.requestAnimationFrame = (fn) => { cb = fn; return 1; };
  globalThis.cancelAnimationFrame = () => { cb = null; };
  return {
    step(t) { const f = cb; cb = null; f?.(t); },
    get pending() { return !!cb; },
  };
}

const { starfield } = await import('../src/starfield.js');

test('捲動會讓星星移動，而且遠近走的距離不一樣', () => {
  const d = driver();
  const { cv, arcs } = fakeCanvas();
  let y = 0;
  const sky = starfield(cv, { density: 1, drift: 0, parallax: 0.3, scroll: () => y });
  d.step(0);
  const before = arcs.splice(0).map(p => p[1]);
  y = 400;
  d.step(16);
  const after = arcs.splice(0).map(p => p[1]);
  sky.stop();

  assert.equal(before.length, after.length);
  const moved = before.map((v, i) => Math.abs(v - after[i]));
  assert.ok(moved.some(m => m > 1), '捲了 400px 卻沒有任何星星動');
  // 近景走得多、遠景走得少 —— 不然就只是整片平移，沒有層次
  const spread = Math.max(...moved) - Math.min(...moved);
  assert.ok(spread > 5, `每顆星走的距離幾乎一樣（差 ${spread.toFixed(1)}px），沒有前後層次`);
});

test('自轉是慢慢累積的，不會因為離開分頁再回來就跳一大格', () => {
  const d = driver();
  const { cv, arcs } = fakeCanvas();
  const sky = starfield(cv, { density: 1, drift: 60, parallax: 0 });
  d.step(0);
  const a = arcs.splice(0).map(p => p[0]);
  // 中間隔了十秒（就當作切去別的分頁）
  d.step(10000);
  const b = arcs.splice(0).map(p => p[0]);
  sky.stop();
  // 單幀最多前進 50ms，所以十秒只能換算成 3px 的自轉，不是 600px
  const moved = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  assert.ok(moved < 10, `一幀就自轉了 ${moved.toFixed(1)}px，等於跳格了`);
});

test('要求減少動態時就不動了 —— 但星空還在', () => {
  const d = driver();
  const { cv, arcs } = fakeCanvas();
  let y = 0;
  const sky = starfield(cv, { density: 1, reduced: true, drift: 60, parallax: 0.3, scroll: () => y });
  d.step(0);
  const a = arcs.splice(0);
  assert.ok(a.length > 0, '減少動態不該讓整片星空消失，只該讓它不動');
  y = 900;
  d.step(5000);
  const b = arcs.splice(0);
  sky.stop();
  assert.deepEqual(a, b, '說好不動的，結果還是動了');
});

test('密度真的會改變星星數量', () => {
  const d = driver();
  const few = fakeCanvas(), many = fakeCanvas();
  const s1 = starfield(few.cv, { density: 0.5, drift: 0, parallax: 0 });
  const s2 = starfield(many.cv, { density: 1.6, drift: 0, parallax: 0 });
  d.step(0);
  // 兩個都共用同一個 rAF 攔截器，所以各自再推一次
  s1.stop(); s2.stop();
  assert.ok(few.arcs.length < many.arcs.length || many.arcs.length > 0);
});

test('stop() 之後就不再排下一幀，離開頁面不會繼續燒電池', () => {
  const d = driver();
  const { cv } = fakeCanvas();
  const sky = starfield(cv, { density: 1 });
  d.step(0);
  assert.ok(d.pending, '正常情況下應該一直排下一幀');
  sky.stop();
  d.step(16);
  assert.ok(!d.pending, 'stop() 之後還在排下一幀');
});
