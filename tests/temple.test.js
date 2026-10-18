/* 廟：六位主神的資料齊全、各頁畫得出來、香油錢永遠是象徵性的 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const { DOMAINS, GODS, godOf, domainOf } = await import('../src/temple/gods.js');
const { OFFERING_KEYS, offeringSVG, tablet } = await import('../src/temple/art.js');
const { GUANYIN_SET } = await import('../src/engines/qian.js');
const pay = await import('../src/payments.js');
const { store } = await import('../src/store.js');
const view = (await import('../src/views/temple.js')).default;

test('六大範圍各有一位主神，id 不重複', () => {
  assert.equal(DOMAINS.length, 6);
  for (const d of DOMAINS) assert.equal(GODS.filter(g => g.domain === d.k).length, 1, d.k);
  assert.equal(new Set(GODS.map(g => g.id)).size, GODS.length);
  assert.equal(godOf('nope'), null);
  assert.equal(domainOf('study').t, '學業考試');
});

test('每位神明的資料都齊：說明、祈求項目、供品有圖、生日、籤詩集', () => {
  for (const g of GODS) {
    assert.ok(g.name && g.short && g.say && g.birthday, g.id);
    assert.ok(g.asks.length >= 3, `${g.id} 祈求項目太少`);
    assert.ok(g.offerings.good.length >= 3, `${g.id} 供品至少三樣才擺得滿供桌`);
    for (const o of [...g.offerings.good, ...g.offerings.avoid]) {
      assert.ok(OFFERING_KEYS.includes(o.k), `${g.id} 的 ${o.t} 沒有圖（${o.k}）`);
      assert.ok(o.why, `${g.id} 的 ${o.t} 要寫寓意或原因`);
    }
    const good = new Set(g.offerings.good.map(o => o.k));
    for (const o of g.offerings.avoid) assert.ok(!good.has(o.k), `${g.id}：${o.t} 同時是建議又是禁忌`);
    assert.ok(['builtin', 'guanyin'].includes(g.set), g.id);
  }
});

test('觀音的供品全素、不供酒', () => {
  const g = godOf('guanyin');
  const avoid = g.offerings.avoid.map(o => o.k);
  assert.ok(avoid.includes('meat') && avoid.includes('wine'));
  assert.ok(!g.offerings.good.some(o => ['meat', 'wine'].includes(o.k)));
});

test('觀音一百籤：一百首、號碼連續、每首四句', () => {
  assert.equal(GUANYIN_SET.poems.length, 100);
  GUANYIN_SET.poems.forEach((p, i) => {
    assert.equal(p.n, i + 1);
    assert.equal(p.lines.length, 4);
    assert.ok(p.luck && p.gist);
  });
});

test('供品圖與神主牌：一字一格（直書不會在 Chrome 裡擠成一團）', () => {
  for (const k of OFFERING_KEYS) assert.match(offeringSVG(k), /^<svg[\s\S]*<\/svg>$/, k);
  assert.equal((tablet('觀世音菩薩').match(/<i>/g) || []).length, 5);
});

test('香油錢只會是象徵性的；打賞開發者還沒開放時不會假裝成功', async () => {
  assert.equal(pay.MODE, 'symbolic');
  const r = await pay.offer({ amount: 600, purpose: '香油錢', to: '媽祖' });
  assert.equal(r.ok, true); assert.equal(r.symbolic, true);
  const t = await pay.tip({ amount: 100 });
  assert.equal(t.ok, false);
  // 儀式裡的錢絕不能接到真的付款
  const src = readFileSync(new URL('../src/payments.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), /fetch\(|XMLHttpRequest|stripe|paypal/i);
});

test('功德簿：新增、更新、上限', () => {
  store.meritLog = [];
  store.addMerit({ id: 'a', god: 'mazu', oil: 0 });
  store.updateMerit('a', { oil: 200, poem: '第一首' });
  assert.equal(store.meritLog[0].oil, 200);
  assert.equal(store.meritLog[0].poem, '第一首');
  for (let i = 0; i < 520; i++) store.addMerit({ id: 'x' + i, god: 'mazu' });
  assert.ok(store.meritLog.length <= 500);
  store.meritLog = [];
});

test('廟埕、祭拜、謝神、功德簿都畫得出來，標題跟著變', () => {
  const ctx = (query) => ({ settings: {}, profile: null, all: null, query });
  const hub = String(view.render(ctx({})));
  for (const g of GODS) assert.ok(hub.includes(`data-god="${g.id}"`), g.id);
  assert.equal(view.title(ctx({})), '廟');
  for (const g of GODS) {
    const html = String(view.render(ctx({ god: g.id })));
    assert.ok(html.includes('mz-stage') && html.includes('恭請'), g.id);
    assert.equal(view.title(ctx({ god: g.id })), g.name);
    const th = String(view.render(ctx({ god: g.id, at: "thanks" })));
    assert.ok(th.includes('功德箱') && th.includes('打賞開發者'), g.id);
  }
  assert.equal(view.title(ctx({ at: 'book' })), '功德簿');
  assert.ok(String(view.render(ctx({ at: "book" }))).includes('功德簿還是空的'));
});

test('來源有記錄', () => {
  const md = readFileSync(new URL('../src/temple/SOURCES.md', import.meta.url), 'utf8');
  assert.match(md, /lungshan\.org\.tw/);
  for (const g of GODS) assert.ok(md.includes(g.name), `${g.name} 沒列在 SOURCES.md`);
});
