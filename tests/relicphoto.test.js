/* 求籤的法器照片：檔案在、授權有寫、設定可以換回線稿 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const r = await import('../src/relics.js');

test('四張照片都在，而且授權與作者寫在 CREDITS 與關於頁', () => {
  for (const f of ['tube', 'stick', 'jiao-flat', 'jiao-convex']) assert.ok(existsSync(`assets/relics/${f}.webp`), f);
  const credits = readFileSync('assets/relics/CREDITS.md', 'utf8');
  const about = readFileSync('src/views/about.js', 'utf8');
  for (const who of ['Fengshuimestari', 'Yoshi Canopus']) {
    assert.match(credits, new RegExp(who)); assert.match(about, new RegExp(who));
  }
  assert.match(about, /CC BY-SA/);
});

test('籤號寫成國字', () => {
  assert.deepEqual([1, 10, 11, 20, 23, 60, 100, 105].map(r.zhNum),
    ['一', '十', '十一', '二十', '二十三', '六十', '一百', '一百〇五']);
  assert.match(r.stickPhoto(23), /<i>第<\/i><i>二<\/i><i>十<\/i><i>三<\/i><i>籤<\/i>/);
});

test('預設用照片，設成線稿就回到自己畫的', () => {
  assert.equal(r.usePhoto({}), true);
  assert.equal(r.usePhoto({ relicStyle: 'line' }), false);
  assert.match(r.jiaoPhoto(true), /jiao-flat\.webp/);
  assert.match(r.jiaoPhoto(false), /jiao-convex\.webp/);
});

test('筊杯的落影在「面」上，不在會翻轉的那一層（filter 會壓平 3D，翻面就失效）', () => {
  const css = readFileSync('styles/views.css', 'utf8');
  const jiao = css.match(/\.jiao \{[^}]*\}/)[0];
  assert.ok(!/filter/.test(jiao), '.jiao 上不能有 filter');
  assert.match(css, /\.jiao__f \{[^}]*filter: drop-shadow/);
});
