/* 分享連結、QR 內容與保密檔案 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from './_dom.js';
installDOM();
import { appUrl, profileLink, linkCode, chatLinks, canSystemShare, systemShare } from '../src/sharelink.js';
import { isPrivate, nameOf, birthLine, dateLine, exportable } from '../src/privacy.js';
import { encode } from '../src/qrcode.js';

const LOC = { origin: 'https://hikari5014.github.io', pathname: '/fortune-telling/' };
const P = {
  id: 'p1', surname: '陳', givenName: '怡君', gender: '女', city: '台北',
  lat: 25.033, lon: 121.5654, tz: 8, birth: { y: 1990, m: 3, d: 17, h: 9, minute: 30 },
};

test('連結長成該長的樣子，而且 hash 在 query 前面', () => {
  const url = profileLink('XJP2:abcDEF-_123', LOC);
  assert.equal(url, 'https://hikari5014.github.io/fortune-telling/#/profile?c=XJP2%3AabcDEF-_123');
  assert.ok(url.indexOf('#') < url.indexOf('?'), 'query 要在 hash 之後，路由才讀得到');
  assert.equal(appUrl(LOC), 'https://hikari5014.github.io/fortune-telling/');
});

test('從一整段訊息裡挖得出分享碼', () => {
  const url = profileLink('XJP2:abcDEF-_123', LOC);
  assert.equal(linkCode(url), 'XJP2:abcDEF-_123');
  assert.equal(linkCode(`我的資料在這 ${url} 你點點看`), 'XJP2:abcDEF-_123');
  assert.equal(linkCode(`<a href="${url}">連結</a>`), 'XJP2:abcDEF-_123');
  assert.equal(linkCode('完全沒有連結的一句話'), null);
  assert.equal(linkCode(''), null);
});

test('聊天 App 連結都帶上網址，而且都編碼過', () => {
  const url = profileLink('XJP2:a+b/c', LOC);
  const list = chatLinks({ text: '出生資料', url });
  assert.ok(list.length >= 4);
  for (const c of list) {
    assert.ok(c.name && c.href, JSON.stringify(c));
    assert.ok(!/ /.test(c.href), `${c.name} 的網址不該有空白`);
    assert.ok(c.href.startsWith('https://') || c.href.startsWith('mailto:'), c.name);
  }
  assert.ok(list.some(c => c.name === 'LINE'));
});

test('沒有 navigator.share 就老實說沒有', async () => {
  assert.equal(canSystemShare(), typeof navigator.share === 'function');
  if (!canSystemShare()) assert.equal(await systemShare({ url: 'x' }), false);
});

test('連結的 QR 畫得出來，而且掃出來就是那條連結', async () => {
  const { profileCode } = await import('../src/views/profile.js');
  const url = profileLink(profileCode(P), LOC);
  const r = encode(url, { ec: 'M' });
  assert.ok(r.version <= 15, `版本 ${r.version} 太大`);
  assert.ok(new TextEncoder().encode(url).length < 200, '連結不該長到掃不動');
});

/* ── 保密檔案 ─────────────────────────────────────── */

const LOCKED = { ...P, id: 'p2', private: true, lockedAt: '2026-09-22T00:00:00.000Z' };

test('保密檔案顯示得出名字，顯示不出生日', () => {
  assert.equal(isPrivate(LOCKED), true);
  assert.equal(isPrivate(P), false);
  assert.equal(nameOf(LOCKED), '陳怡君');
  for (const line of [birthLine(LOCKED), dateLine(LOCKED)]) {
    assert.ok(!/1990|03|17|09:30/.test(line), `不該洩漏生日：${line}`);
  }
  assert.match(birthLine(P), /1990-03-17 09:30/);
  assert.equal(dateLine(P), '1990-03-17');
});

test('保密檔案沒有分享碼', async () => {
  const { profileCode } = await import('../src/views/profile.js');
  assert.equal(profileCode(LOCKED), null);
  assert.ok(profileCode(P).startsWith('XJP2:'));
});

test('保密檔案不進備份', () => {
  const list = exportable([P, LOCKED]);
  assert.deepEqual(list.map(x => x.id), ['p1']);
});

test('提示詞的基本資料不寫保密檔案的生日', async () => {
  const { computeAll, buildBlocks } = await import('../src/prompt/context.js');
  const settings = { tzOffset: 8, lat: 25.033, lon: 121.5654, city: '台北', register: 'bai' };
  const open = buildBlocks(computeAll(P, settings), settings);
  const shut = buildBlocks(computeAll(LOCKED, settings), settings);
  assert.match(open.basic, /1990-03-17/);
  assert.ok(!/1990-03-17/.test(shut.basic), shut.basic);
  assert.match(shut.basic, /不揭露/);
  assert.match(shut.basic, /陳怡君/);
  // 其餘區塊照算 —— 保密不等於不能用
  assert.ok(shut.bazi && shut.bazi.length > 10);
});
