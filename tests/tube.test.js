/* 3D 籤筒的物理：洗牌、搖出來、用手抽 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const T = await import('../src/engines/tube.js');

test('每支籤對到不同的一首，而且每次重新洗牌', () => {
  const a = T.createTube(60), b = T.createTube(60);
  assert.deepEqual([...a.sticks.map(s => s.poem)].sort((x, y) => x - y), Array.from({ length: 60 }, (_, i) => i));
  assert.notDeepEqual(a.sticks.map(s => s.poem), b.sticks.map(s => s.poem));
});

test('一直搖，十幾下內一定會有一支被擠出來', () => {
  for (let k = 0; k < 50; k++) {
    const st = T.createTube(60); let n = 0;
    while (st.picked == null && n < 30) { T.shake(st, 1); n++; for (let t = 0; t < 20; t++) T.step(st, 1 / 60); }
    assert.ok(st.picked != null, '搖了 30 下還沒出來');
    assert.ok(n <= 16, `搖了 ${n} 下才出來，太久`);
    assert.equal(st.sticks.filter(s => s.out).length, 1, '只能出來一支');
  }
});

test('往前傾比較容易倒出來', () => {
  const avg = (tilt) => {
    let sum = 0;
    for (let k = 0; k < 80; k++) { const st = T.createTube(60); st.tilt.x = tilt; let n = 0;
      while (st.picked == null && n < 40) { T.shake(st, 1); n++; for (let t = 0; t < 20; t++) T.step(st, 1 / 60); } sum += n; }
    return sum / 80;
  };
  assert.ok(avg(0.35) < avg(0), '前傾沒有比較快');
});

test('用手抽：拉不夠高會滑回去，拉過筒口就是抽中', () => {
  const st = T.createTube(60);
  assert.equal(T.pull(st, 7, 1.0), null);
  T.release(st);
  for (let t = 0; t < 120; t++) T.step(st, 1 / 60);
  assert.ok(st.sticks[7].h < 0.05, '放手之後沒有滑回筒底');
  assert.equal(T.pull(st, 7, T.TUBE.OUT + 0.1), 7);
  assert.equal(st.picked, 7);
  assert.equal(T.pull(st, 8, 9), null, '已經抽過一支，不能再抽');
});

test('搖出來的籤對到每一首的機會差不多（3000 次）', () => {
  const cnt = new Array(60).fill(0);
  for (let k = 0; k < 3000; k++) { const st = T.createTube(60); const i = T.shakeUntilOut(st); cnt[st.sticks[i].poem]++; }
  assert.ok(Math.min(...cnt) > 20 && Math.max(...cnt) < 90, `${Math.min(...cnt)}–${Math.max(...cnt)}（期望約 50）`);
});

test('接線：求籤頁用 3D 籤筒、設定可換回、離線清單有檔案', () => {
  const q = readFileSync('src/views/qian.js', 'utf8');
  assert.match(q, /mountTube3D\(/);
  assert.match(q, /onPick: \(i\) => \{ poem = set\.poems\[i\]; toJiao\(\); \}/);
  assert.match(readFileSync('src/views/settings.js', 'utf8'), /set-tube/);
  const sw = readFileSync('sw.js', 'utf8');
  assert.match(sw, /src\/qian3d\.js/); assert.match(sw, /src\/engines\/tube\.js/);
});
