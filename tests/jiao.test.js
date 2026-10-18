/* 擲筊的 3D 物理：形狀、法線、會停、結果的機率合理 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const J = await import('../src/engines/jiao.js');
const { jiaoOf } = await import('../src/engines/qian.js');

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

test('網格的法線朝外：頂面（隆起）朝上、底面（平）朝下 —— 反了畫面就會看到背面', () => {
  const m = J.buildMesh();
  const ny = (list) => list.reduce((s, [i, j, k]) => s + cross(sub(m.verts[j], m.verts[i]), sub(m.verts[k], m.verts[i])).y, 0);
  assert.ok(ny(m.top) > 0, '頂面法線朝下');
  assert.ok(ny(m.bottom) < 0, '底面法線朝上');
});

test('平放、隆起朝上就是「凸」；翻過來就是「平」', () => {
  const m = J.buildMesh();
  const up = J.makeBody(m), down = J.makeBody(m, { q: J.qFromAxis({ x: 1, y: 0, z: 0 }, Math.PI) });
  assert.equal(J.faceOf(up), '凸');
  assert.equal(J.faceOf(down), '平');
  assert.equal(J.faceOf(J.makeBody(m, { q: J.qFromAxis({ x: 1, y: 0, z: 0 }, Math.PI / 2) })), null, '立起來的要回 null');
});

test('丟出去一定會停，而且停在地上', () => {
  for (let i = 0; i < 40; i++) {
    const { faces, scene } = J.simulate({ power: 0.5 + (i % 10) / 10 });
    assert.ok(scene.t <= 7.1, `跑了 ${scene.t} 秒還沒停`);
    for (const b of scene.bodies) assert.ok(b.p.y > 0 && b.p.y < 1, `停在半空中：y=${b.p.y}`);
    assert.ok(faces.every(f => f === '平' || f === '凸'));
  }
});

test('機率合理：聖筊大約一半，三種都會出現（跑 600 次）', () => {
  const n = { 聖筊: 0, 笑筊: 0, 陰筊: 0 };
  for (let i = 0; i < 600; i++) n[jiaoOf(J.simulate({ power: 0.5 + Math.random() * 0.9 }).faces).kind]++;
  const p = n.聖筊 / 600;
  assert.ok(p > 0.40 && p < 0.60, `聖筊 ${p}`);
  assert.ok(n.笑筊 > 60 && n.陰筊 > 40, JSON.stringify(n));
});

test('接線：求籤頁用 3D 擲筊、設定可以換回翻轉、離線清單有檔案', () => {
  const q = readFileSync('src/views/qian.js', 'utf8');
  assert.match(q, /mountJiao3D\(/);
  assert.match(q, /onResult: \(faces\) => settle\(jiaoOf\(faces\)\)/);
  assert.match(readFileSync('src/views/settings.js', 'utf8'), /set-jiao/);
  const sw = readFileSync('sw.js', 'utf8');
  assert.match(sw, /src\/jiao3d\.js/); assert.match(sw, /src\/engines\/jiao\.js/);
});
