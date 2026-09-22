/* 每一頁的 render() 都要能跑完並吐出內容。
   用 DOM 墊片在 Node 裡跑，抓的是「繪製期就爆炸」這一類問題
   —— 版面與互動仍需在瀏覽器裡看，這裡只保證不會整頁空白。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { installDOM } from './_dom.js';

installDOM();

const { store } = await import('../src/store.js');
const { computeAll } = await import('../src/prompt/context.js');

const PROFILE = {
  id: 'p1', surname: '王', givenName: '小明', gender: '男',
  birth: { y: 1990, m: 5, d: 20, h: 9, minute: 30 },
  city: '台北', phone: '0912345678', plate: 'ABC-1234',
};
const OTHER = { ...PROFILE, id: 'p2', surname: '陳', givenName: '小美', gender: '女', birth: { y: 1992, m: 11, d: 3, h: 20, minute: 10 } };

store.profiles = [PROFILE, OTHER];
store.currentId = 'p1';
store.records = [{ id: 'r1', templateName: '命盤總覽', who: '王小明', model: 'Claude', tags: ['工作'], createdAt: new Date().toISOString(), content: '## 標題\n內容', prompt: '提示詞' }];

const VIEW_DIR = new URL('../src/views/', import.meta.url).pathname;
const files = readdirSync(VIEW_DIR).filter(f => f.endsWith('.js') && f !== '_shared.js').sort();

const makeCtx = (over = {}) => ({
  settings: store.settings,
  profile: store.current,
  all: computeAll(store.current, store.settings),
  query: {},
  navigate: () => {},
  ...over,
});

for (const f of files) {
  test(`render ${f}（有檔案時）`, async () => {
    const v = (await import(VIEW_DIR + f)).default;
    const out = String(v.render(makeCtx()));
    assert.ok(out.length > 40, `${f} 只吐出 ${out.length} 個字元`);
    assert.doesNotMatch(out, /undefined|\[object Object\]|NaN/, `${f} 的輸出裡有未處理的值`);
  });

  test(`render ${f}（沒有檔案時也不能爆）`, async () => {
    const v = (await import(VIEW_DIR + f)).default;
    const empty = { settings: store.settings, profile: null, all: null, query: {}, navigate: () => {} };
    assert.doesNotThrow(() => String(v.render(empty)), `${f} 在沒有出生資料時爆炸`);
  });
}

test('沒有檔案時，需要命盤的頁面會導去建立檔案', async () => {
  const empty = { settings: store.settings, profile: null, all: null, query: {}, navigate: () => {} };
  for (const f of ['astro.js', 'ziwei.js', 'bazi.js', 'fortune.js', 'direction.js']) {
    const v = (await import(VIEW_DIR + f)).default;
    assert.match(String(v.render(empty)), /建立檔案|建立第一份|再建一份/, `${f} 沒有引導建立檔案`);
  }
});
