/* おみくじ：觀音百籤（淺草寺系） */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const o = await import('../src/engines/omikuji.js');
const { POEMS } = await import('../src/data/omikuji.js');

test('一百支，吉凶分布跟淺草寺一樣：大吉 17、吉 35、半吉 5、小吉 4、末小吉 3、末吉 6、凶 30', () => {
  assert.equal(POEMS.length, 100);
  assert.deepEqual(POEMS.map(p => p.n), Array.from({ length: 100 }, (_, i) => i + 1));
  assert.deepEqual(o.levelCounts(), { 大吉: 17, 吉: 35, 半吉: 5, 小吉: 4, 末小吉: 3, 末吉: 6, 凶: 30 });
});

test('每首都是五言絕句：四句、每句五個字', () => {
  for (const p of POEMS) {
    assert.equal(p.lines.length, 4, `第 ${p.n} 番不是四句`);
    for (const l of p.lines) assert.equal([...l].length, 5, `第 ${p.n} 番「${l}」不是五個字`);
  }
});

test('籤號寫成國字', () => {
  assert.deepEqual([1, 10, 11, 20, 32, 99, 100].map(o.banOf),
    ['第一番', '第十番', '第十一番', '第二十番', '第三十二番', '第九十九番', '第百番']);
});

test('抽籤落在 1–100，七個項目都有解說', () => {
  for (let i = 0; i < 200; i++) { const n = o.drawNumber(); assert.ok(n >= 1 && n <= 100); }
  assert.equal(o.drawNumber(() => 0), 1);
  assert.equal(o.drawNumber(() => 0.9999), 100);
  for (const L of o.LEVELS) for (const t of o.TOPICS) assert.ok(o.topicText(L.k, t.k), `${L.k} ${t.t} 沒有解說`);
});

test('文字版包含籤號、吉凶、詩與各項', () => {
  const s = o.slipOf(1);
  const t = o.omikujiText(s, '工作');
  assert.match(t, /所問：工作/); assert.match(t, /第一番/); assert.match(t, new RegExp(s.level));
  assert.match(t, /願望：/); assert.match(t, new RegExp(s.lines[0]));
});

test('接線：路由、導覽、離線清單、設定、應驗追蹤都有', () => {
  assert.match(readFileSync('src/app.js', 'utf8'), /'\/omikuji'/);
  assert.match(readFileSync('src/data/nav.js', 'utf8'), /'\/omikuji'/);
  const sw = readFileSync('sw.js', 'utf8');
  for (const f of ['engines/omikuji.js', 'data/omikuji.js', 'views/omikuji.js', 'shrine.js']) assert.match(sw, new RegExp(f.replace('.', '\\.')));
  assert.match(readFileSync('src/views/settings.js', 'utf8'), /set-omishake/);
  assert.match(readFileSync('src/verify.js', 'utf8'), /omikuji: '神籤'/);
});
