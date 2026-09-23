/* 今日推薦：推什麼、一天一次 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();
const r = await import('../src/recommend.js');

beforeEach(() => { localStorage.removeItem('xj.seen'); localStorage.removeItem('xj.reco'); });

test('沒有檔案 → 推建立檔案；有了檔案 → 第一個推塔羅', () => {
  assert.equal(r.choose({ hasProfile: false }).p, '/profile');
  assert.equal(r.choose({ hasProfile: true }).p, '/tarot');
});

test('用過塔羅之後推還沒用過的，不推昨天推過的', () => {
  const seen = { '/tarot': 1 };
  assert.equal(r.choose({ hasProfile: true, seen }).p, '/astro');
  assert.equal(r.choose({ hasProfile: true, seen, last: '/astro' }).p, '/qian');
});

test('全部都用過 → 推最久沒用的', () => {
  const seen = Object.fromEntries(r.ITEMS.map((x, i) => [x.p, 1000 + i]));
  seen['/bazi'] = 1;
  assert.equal(r.choose({ hasProfile: true, seen }).p, '/bazi');
});

test('一天只跳一次', () => {
  const now = new Date(2026, 8, 23, 9);
  assert.ok(r.todayPick({ hasProfile: true, now }));
  assert.equal(r.todayPick({ hasProfile: true, now }), null);
  assert.ok(r.todayPick({ hasProfile: true, now: new Date(2026, 8, 24, 9) }), '隔天要再跳');
});

test('早上推了建檔案、之後建好了 → 同一天改推塔羅', () => {
  const now = new Date(2026, 8, 23, 9);
  assert.equal(r.todayPick({ hasProfile: false, now }).p, '/profile');
  assert.equal(r.todayPick({ hasProfile: false, now }), null, '還沒建好就不再跳');
  assert.equal(r.todayPick({ hasProfile: true, now }).p, '/tarot');
  assert.equal(r.todayPick({ hasProfile: true, now }), null);
});

test('設定關掉就不跳；進過的頁面會被記下來', () => {
  assert.equal(r.todayPick({ enabled: false, hasProfile: true }), null);
  r.markSeen('/tarot'); r.markSeen('/');
  const seen = JSON.parse(localStorage.getItem('xj.seen'));
  assert.ok(seen['/tarot'] && !seen['/']);
});

test('接線：首頁會叫、換頁會記、設定頁有開關、離線清單有檔案', () => {
  assert.match(readFileSync('src/views/home.js', 'utf8'), /todayPick\(\{ enabled: settings\.dailyReco !== false/);
  assert.match(readFileSync('src/app.js', 'utf8'), /markSeen\(p\)/);
  assert.match(readFileSync('src/views/settings.js', 'utf8'), /'set-reco\|dailyReco'/);
  assert.match(readFileSync('sw.js', 'utf8'), /'\.\/src\/recommend\.js'/);
});
