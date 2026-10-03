/* 神社：參拜與求籤分開；各處都畫得出來、工具函式正確 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const kit = await import('../src/rites/kit.js');
const view = (await import('../src/views/omikuji.js')).default;
const art = await import('../src/rites/art.js');

test('和曆：令和元年是 2019；日期寫成國字', () => {
  assert.equal(kit.wareki(new Date(2019, 4, 1)), '令和元年五月一日');
  assert.equal(kit.wareki(new Date(2026, 9, 3)), '令和八年十月三日');
  assert.equal(kit.wareki(new Date(2026, 11, 31)), '令和八年十二月三十一日');
  assert.deepEqual([1, 10, 11, 20, 31].map(kit.kanjiNum), ['一', '十', '十一', '二十', '三十一']);
});

test('今天做過什麼：隔天自動歸零', () => {
  localStorage.removeItem('xj.shrineday');
  assert.equal(kit.today().haiden, false);
  kit.mark({ haiden: true });
  assert.equal(kit.today().haiden, true);
  localStorage.setItem('xj.shrineday', JSON.stringify({ day: '2000-01-01', haiden: true }));
  assert.equal(kit.today().haiden, false, '昨天的不能算今天');
});

test('境內、手水舍、拜殿、授與所、御朱印帳都畫得出來，標題跟著變', () => {
  const base = { settings: {}, all: null };
  const cases = { '': '神社', temizu: '手水舍', haiden: '拜殿', kuji: '授與所', book: '御朱印帳' };
  for (const [at, title] of Object.entries(cases)) {
    const ctx = { ...base, query: at ? { at } : {} };
    const out = String(view.render(ctx));
    assert.ok(out.length > 200, `${at || '境內'} 是空的`);
    assert.equal(view.title(ctx), title);
  }
  assert.match(String(view.render({ query: {} })), /data-at="haiden"/);
  assert.match(String(view.render({ query: {} })), /data-at="kuji"/);
});

test('參拜與求籤是分開的兩個地方，各自有完整的步驟', () => {
  const hd = readFileSync('src/rites/haiden.js', 'utf8');
  for (const k of ['香油錢', '搖鈴', '二拜', '二拍手', '祈願', '一拜']) assert.match(hd, new RegExp(k));
  const kj = readFileSync('src/rites/kuji.js', 'utf8');
  for (const k of ['初穗料', '搖籤箱', '倒過來', '找抽屜', '開籤紙']) assert.match(kj, new RegExp(k));
  assert.ok(!/drawNumber/.test(hd), '拜殿不應該抽籤');
});

test('硬幣五種、御朱印有日期與兩顆章', () => {
  assert.deepEqual(art.COINS.map(c => c.k), [5, 10, 50, 100, 500]);
  const g = art.goshuin('令和八年十月三日');
  assert.match(g, /<i>星<\/i><i>宮<\/i><i>神<\/i><i>社<\/i>/);
  assert.equal((g.match(/jn-gs__seal--(sq|rd)/g) || []).length, 2);
});

test('新的模組都進了離線清單；設定有音效開關；御朱印帳會備份', () => {
  const sw = readFileSync('sw.js', 'utf8');
  for (const f of ['kit', 'sound', 'art', 'temizu', 'haiden', 'kuji']) assert.match(sw, new RegExp(`src/rites/${f}\\.js`));
  assert.match(readFileSync('src/views/settings.js', 'utf8'), /set-shrinesnd\|shrineSound/);
  assert.match(readFileSync('src/store.js', 'utf8'), /key: 'shrineLog'/);
});
