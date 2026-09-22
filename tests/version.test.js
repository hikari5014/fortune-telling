/* 版號、更新紀錄與 Service Worker 外殼清單 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { APP_VERSION, APP_STAGE, CHANGELOG } from '../src/data/changelog.js';

const ROOT = new URL('../', import.meta.url).pathname;
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');

test('版號三處一致：APP_VERSION、更新紀錄第一筆、sw.js 快取版本', () => {
  assert.equal(CHANGELOG[0].v, APP_VERSION, '更新紀錄第一筆與 APP_VERSION 不符');
  const m = sw.match(/const VERSION = '([^']+)'/);
  assert.ok(m, 'sw.js 找不到 VERSION');
  assert.equal(m[1], `xj-${APP_VERSION}`, 'sw.js 的快取版本不符');
  assert.ok(APP_STAGE);
});

test('更新紀錄：版號遞減不重複，每一筆都有日期、標題與項目', () => {
  const seen = new Set();
  const cmp = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  for (let i = 0; i < CHANGELOG.length; i++) {
    const e = CHANGELOG[i];
    assert.match(e.v, /^\d+\.\d+\.\d+$/, `版號格式：${e.v}`);
    assert.ok(!seen.has(e.v), `版號重複：${e.v}`);
    seen.add(e.v);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, `${e.v} 日期格式`);
    assert.ok(e.title, `${e.v} 沒有標題`);
    assert.ok(e.items?.length, `${e.v} 沒有項目`);
    for (const it of e.items) {
      assert.ok(['add', 'fix', 'change', 'data'].includes(it.kind), `${e.v} 有未知的 kind：${it.kind}`);
      assert.ok(it.text?.length > 4, `${e.v} 項目文字過短`);
    }
    if (i > 0) assert.ok(cmp(CHANGELOG[i - 1].v, e.v) > 0, `${CHANGELOG[i - 1].v} 應該比 ${e.v} 新`);
  }
});

test('Service Worker 外殼清單涵蓋 src 底下每一個模組', () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.js') ? [p] : []);
  });
  const missing = walk(join(ROOT, 'src'))
    .map(f => './' + relative(ROOT, f))
    .filter(rel => !sw.includes(`'${rel}'`));
  assert.deepEqual(missing, [], '這些檔案沒被加進 sw.js 的快取清單，離線時會載不到');
});

test('Service Worker 外殼清單裡的檔案都真的存在', () => {
  const shell = [...sw.matchAll(/'(\.\/[^']+)'/g)].map(m => m[1])
    .filter(x => x.endsWith('.js') || x.endsWith('.css') || x.endsWith('.html') || x.endsWith('.webmanifest'));
  for (const f of shell) {
    assert.doesNotThrow(() => statSync(join(ROOT, f)), `sw.js 列了不存在的檔案：${f}`);
  }
});
