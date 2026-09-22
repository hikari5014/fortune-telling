/* 每一個模組都要真的 import 得起來。
   `node --check` 只驗語法，攔不住重複匯出這類錯誤 —— 實際踩過：
   synastry.js 同時 `export function aspectBetween` 與 `export { aspectBetween }`，
   語法檢查通過，瀏覽器卻整頁掛掉，連帶提示詞頁打不開。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installDOM } from './_dom.js';

installDOM();

const ROOT = new URL('../src/', import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.js') ? [p] : []);
});
const files = walk(ROOT).sort();

test('src 底下有預期數量的模組', () => {
  assert.ok(files.length >= 50, `只找到 ${files.length} 個模組`);
});

for (const f of files) {
  const name = relative(ROOT, f);
  test(`載入 ${name}`, async () => {
    const mod = await import(pathToFileURL(f).href);
    assert.ok(mod, `${name} 沒有回傳模組物件`);
  });
}

test('每個 view 都有 render，且 title 與 eyebrow 齊全', async () => {
  for (const f of files.filter(x => x.includes('/views/') && !x.endsWith('_shared.js'))) {
    const mod = await import(pathToFileURL(f).href);
    const v = mod.default;
    const name = relative(ROOT, f);
    assert.ok(v, `${name} 沒有 default export`);
    assert.equal(typeof v.render, 'function', `${name} 沒有 render()`);
    assert.ok(v.title, `${name} 沒有 title`);
    assert.ok(v.eyebrow, `${name} 沒有 eyebrow`);
  }
});
