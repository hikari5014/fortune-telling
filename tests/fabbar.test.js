/* 浮動操作列：提示詞頁的「複製 / 存模板 / 分享」要一直浮在畫面上 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const { store } = await import('../src/store.js');
const { computeAll } = await import('../src/prompt/context.js');
const view = (await import('../src/views/prompt.js')).default;

const settings = store.settings;
const profile = { id: 'p1', surname: '王', givenName: '小明', gender: '男', city: '台北',
  lat: 25.033, lon: 121.5654, tz: 8, birth: { y: 1990, m: 5, d: 20, h: 9, minute: 30 } };
const out = String(view.render({ settings, profile, all: computeAll(profile, settings), query: {} }));
const css = readFileSync('styles/components.css', 'utf8');

test('三顆按鈕都在浮動列裡，而且只有一份', () => {
  assert.match(out, /class="fabbar"/);
  const bar = out.slice(out.indexOf('class="fabbar"'));
  for (const id of ['id="copy"', 'id="save-tpl"', 'id="share-btn"']) {
    assert.ok(bar.includes(id), `浮動列少了 ${id}`);
    // id 重複的話 querySelector 只會抓到第一個，綁事件就會綁錯
    assert.equal(out.split(id).length - 1, 1, `${id} 出現了不只一次`);
  }
});

test('浮動列是固定定位，而且讓開分頁列', () => {
  const rule = css.slice(css.indexOf('.fabbar {'), css.indexOf('@supports (backdrop-filter'));
  assert.match(rule, /position: fixed/);
  assert.match(rule, /env\(safe-area-inset-bottom\)/, '要避開 iPhone 的底部安全區');
  // 分頁列在 safe + 10，高約 60 —— 浮動列必須比它高
  const bottom = Number(rule.match(/bottom: calc\(env\(safe-area-inset-bottom\) \+ (\d+)px\)/)[1]);
  assert.ok(bottom >= 72, `浮動列只離底部 ${bottom}px，會壓到分頁列`);
  assert.match(css, /@media \(min-width: 900px\) \{ \.fabbar/, '桌機沒有分頁列，要另外定位');
});

test('有浮動列時，頁尾留白與 Toast 都要讓位', () => {
  assert.match(css, /body:has\(\.fabbar\) \{ padding-bottom/, '頁面底部要多留白，不然最後一段被蓋住');
  assert.match(css, /body:has\(\.fabbar\) \.toast-root \{ bottom/, 'Toast 要浮在操作列上面');
  // Toast 必須比操作列高，不然按了複製就看不到提示
  const bar = Number(css.match(/\.fabbar \{[^}]*bottom: calc\(env\(safe-area-inset-bottom\) \+ (\d+)px\)/s)[1]);
  const toast = Number(css.match(/body:has\(\.fabbar\) \.toast-root \{ bottom: calc\(env\(safe-area-inset-bottom\) \+ (\d+)px\)/)[1]);
  assert.ok(toast > bar, `Toast 在 ${toast}px、操作列在 ${bar}px，會疊在一起`);
});

test('圖示按鈕留了無障礙標籤', () => {
  const bar = out.slice(out.indexOf('class="fabbar"'));
  assert.match(bar, /role="group"/);
  assert.match(bar, /aria-label="提示詞操作"/);
  assert.match(bar, /id="share-btn"[^>]*aria-label="分享提示詞"/);
});

test('原本那排按鈕已經移走，只留說明', () => {
  const preview = out.slice(out.indexOf('id="preview"'), out.indexOf('把 LLM 的回覆貼回來'));
  assert.ok(!preview.includes('id="copy"'), '預覽區底下不該還留一份複製按鈕');
  assert.match(preview, /捲到哪都按得到/, '要跟使用者說那排按鈕跑去哪了');
});
