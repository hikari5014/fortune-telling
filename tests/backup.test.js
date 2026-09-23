/* 備份：一律 JSON，而且可以選要帶哪幾項出去。
   這裡守的是「勾了什麼就帶什麼」與「沒勾的絕對不會漏出去」——
   後者比前者重要：多帶了個資是收不回來的。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const { store, EXPORT_PARTS } = await import('../src/store.js');

const P = (id, extra = {}) => ({ id, label: id, surname: '王', givenName: id,
  gender: '男', birth: { y: 1990, m: 5, d: 20, h: 9, minute: 0 }, tz: 8, lat: 25, lon: 121, ...extra });

function seed() {
  store.profiles = [P('p1'), P('p2', { private: true })];
  store.records = [{ id: 'r1', createdAt: '2026-01-01', content: 'x', prompt: 'y', tags: [] }];
  store.templates = [{ id: 't1', custom: true, name: '我的', body: '{{data}}', blocks: [] }];
}

test('內容清單的每一項都自己說得出怎麼讀、怎麼寫', () => {
  for (const p of EXPORT_PARTS) {
    assert.ok(p.key && p.label && p.desc, `${p.key} 缺欄位`);
    assert.equal(typeof p.get, 'function');
    assert.equal(typeof p.set, 'function');
  }
  // 含個資的那幾項要標出來 —— 傳給別人之前會想取消勾的就是這些
  const personal = EXPORT_PARTS.filter(p => p.personal).map(p => p.key);
  assert.deepEqual(personal.sort(), ['candidates', 'orgs', 'profiles', 'records']);
});

test('沒勾的項目絕對不會出現在檔案裡', () => {
  seed();
  const out = store.exportAll({ parts: ['settings', 'templates'] });
  assert.deepEqual(out.parts, ['settings', 'templates']);
  for (const k of ['profiles', 'records', 'orgs', 'candidates']) {
    assert.ok(!(k in out), `沒勾的 ${k} 還是跑進檔案裡了`);
  }
  // 目前選的是誰，只有在檔案跟著出去時才有意義
  assert.ok(!('currentId' in out));
});

test('保密檔案預設不帶走 —— 那是當初答應過的事', () => {
  seed();
  const plain = store.exportAll();
  assert.deepEqual(plain.profiles.map(p => p.id), ['p1']);
  const all = store.exportAll({ includePrivate: true });
  assert.deepEqual(all.profiles.map(p => p.id), ['p1', 'p2']);
});

test('匯出的就是純 JSON，沒有自訂格式', () => {
  seed();
  const out = store.exportAll();
  const round = JSON.parse(JSON.stringify(out));
  assert.deepEqual(round, out);
  assert.equal(round.app, 'xuanjian');
});

test('匯入前看得到檔案裡有什麼、各幾筆', () => {
  seed();
  const file = store.exportAll({ includePrivate: true });
  const found = store.inspect(file);
  const byKey = Object.fromEntries(found.map(p => [p.key, p.n]));
  assert.equal(byKey.profiles, 2);
  assert.equal(byKey.records, 1);
  assert.equal(byKey.settings, 1);
  assert.throws(() => store.inspect({ app: '別的東西' }), /格式不符/);
});

test('匯入也可以只挑幾項', () => {
  seed();
  const file = store.exportAll({ includePrivate: true });
  store.profiles = [];
  store.records = [];
  store.importAll(file, { merge: false, parts: ['profiles'] });
  assert.equal(store.profiles.length, 2);
  assert.equal(store.records.length, 0, '沒勾的 records 不該被寫回去');
});

test('合併只會新增，不會刪掉現有的', () => {
  seed();
  const file = store.exportAll({ includePrivate: true });
  store.profiles = [P('p9')];
  store.importAll(file, { merge: true, parts: ['profiles'] });
  assert.deepEqual(store.profiles.map(p => p.id).sort(), ['p1', 'p2', 'p9']);
});

test('取代會整個換掉 —— 所以畫面上得先問一次', () => {
  seed();
  const file = store.exportAll({ parts: ['profiles'] });   // 只有 p1
  store.profiles = [P('p9')];
  store.importAll(file, { merge: false, parts: ['profiles'] });
  assert.deepEqual(store.profiles.map(p => p.id), ['p1']);
  const view = readFileSync('src/views/settings.js', 'utf8');
  assert.match(view, /confirmSheet\('確定要取代？'/);
  assert.match(view, /取代是不可逆的/);
});

test('加了新的資料種類，匯出與匯入會一起跟上', () => {
  // 因為兩邊吃同一份清單。分開寫的話一定會有人只補一邊。
  const src = readFileSync('src/store.js', 'utf8');
  assert.match(src, /for \(const p of EXPORT_PARTS\)[\s\S]{0,200}p\.get\(/);
  assert.match(src, /for \(const p of EXPORT_PARTS\)[\s\S]{0,200}p\.set\(/);
});

test('下載用的 <a> 要先接上 DOM，不然檔名會變成 download', () => {
  assert.match(readFileSync('src/ui.js', 'utf8'), /document\.body\.append\(a\);\s*\n\s*a\.click\(\);/);
});
