/* 設定頁的二級選單：第一層只有分類，點進去只看那一類 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/views/settings.js', 'utf8');

test('每個設定分類都有對應的選單項目，而且區塊照分類藏起來', () => {
  const keys = [...view.matchAll(/data-g="(\w+)" \$\{raw\(g === '(\w+)'/g)];
  assert.equal(keys.length, 7, '應該有七個分類區塊');
  for (const [, a, b] of keys) {
    assert.equal(a, b, `區塊 ${a} 的 hidden 判斷寫成了 ${b}`);
    assert.match(view, new RegExp(`k: '${a}'`), `選單少了 ${a}`);
  }
});

test('點分類是換網址（?g=），返回鍵才回得到分類清單', () => {
  assert.match(view, /navigate\(`\/settings\?g=\$\{b\.dataset\.g\}`\)/);
  assert.match(view, /query\(\)\.g/);
});
