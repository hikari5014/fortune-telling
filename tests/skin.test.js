/* 鎏金主題與星空背景。
   這裡守的是「規矩有沒有被遵守」，不是好不好看 ——
   好不好看是人看的，但「深色不准有框」「淺色一定要有陰影」可以驗。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tokens = readFileSync('styles/tokens.css', 'utf8');
const comp = readFileSync('styles/components.css', 'utf8');
const views = readFileSync('styles/views.css', 'utf8');
const base = readFileSync('styles/base.css', 'utf8');
const html = readFileSync('index.html', 'utf8');

const block = (sel) => {
  const i = tokens.indexOf(sel);
  assert.ok(i >= 0, `找不到 ${sel}`);
  return tokens.slice(i, tokens.indexOf('}', i));
};
const dark = block(':root[data-theme="dark"]');
const light = block(':root[data-theme="light"]');

test('兩個主題的代幣是成套的，沒有一邊漏掉', () => {
  const keys = (b) => [...b.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]).sort();
  assert.deepEqual(keys(dark), keys(light));
});

test('區塊一律不畫框：--edge 兩邊都是透明的', () => {
  assert.match(dark, /--edge:\s*transparent/);
  assert.match(light, /--edge:\s*transparent/);
});

test('深色靠明度差、淺色靠陰影 —— 兩邊不能用同一種手段', () => {
  // 深色背景上的陰影看不見，所以一定是 none
  assert.match(dark, /--lift:\s*none/);
  assert.match(dark, /--lift-sm:\s*none/);
  // 淺色背景上的明度差太微弱，所以一定要有陰影
  assert.ok(/--lift:\s*0 /.test(light), '淺色主題沒有給 --lift 陰影');
  assert.ok(/--lift-sm:\s*0 /.test(light), '淺色主題沒有給 --lift-sm 陰影');
});

test('深色的三階底色是真的拉得開的', () => {
  const hex = (k) => {
    const m = dark.match(new RegExp(`${k}:\\s*(#[0-9a-f]{6})`, 'i'));
    assert.ok(m, `深色缺 ${k}`);
    const v = parseInt(m[1].slice(1), 16);
    return ((v >> 16 & 255) * 299 + (v >> 8 & 255) * 587 + (v & 255) * 114) / 1000;
  };
  const bg = hex('--bg'), sf = hex('--surface'), s2 = hex('--surface-2');
  assert.ok(sf > bg + 3, `區塊(${sf.toFixed(1)}) 要比底(${bg.toFixed(1)}) 亮得出來`);
  assert.ok(s2 > sf + 3, `次層(${s2.toFixed(1)}) 要比區塊(${sf.toFixed(1)}) 亮得出來`);
});

test('沒有殘留的黑白色票（改完外觀最容易忘的就是這個）', () => {
  for (const [name, b] of [['dark', dark], ['light', light]]) {
    assert.ok(!/#0a0a0a|#fafafa|#ffffff;/.test(b.replace('--surface: #ffffff;', '')),
      `${name} 還留著舊的純黑白色票`);
  }
});

test('金只有一個，深淺各一，而且金上面的字是對比色', () => {
  assert.match(dark, /--accent:\s*#e8d9a8/);
  assert.match(light, /--accent:\s*#8a6d2f/);
  // 主要按鈕、啟用晶片都吃 --invert-bg，所以它必須是金
  assert.match(dark, /--invert-bg:\s*var\(--accent\)/);
  assert.match(light, /--invert-bg:\s*var\(--accent\)/);
});

test('改成無邊框之後，沒有東西是「沒底色又沒框」的', () => {
  // 這兩個原本純靠框站出來，拿掉框就得補底色
  const chip = comp.slice(comp.indexOf('\n.chip {'), comp.indexOf('.chip svg'));
  assert.match(chip, /background:\s*var\(--surface-2\)/);
  const iconbtn = comp.slice(comp.indexOf('.iconbtn {'), comp.indexOf('.iconbtn:active'));
  assert.match(iconbtn, /background:\s*var\(--surface\)/);
  // 淺色的 --surface 就是白的，輸入框得換一階才看得見
  const input = comp.slice(comp.indexOf('.input, .select, .textarea {'), comp.indexOf('.input:focus'));
  assert.match(input, /background:\s*var\(--field\)/);
});

test('真正的「線」沒有被誤傷 —— 表格與圖框還是有邊的', () => {
  assert.match(views, /\.md th, \.md td \{ border: 1px solid var\(--line\)/);
  assert.match(views, /\.qrbox[^}]*border: 1px solid var\(--line-2\)/);
});

test('星空那一層接好了，而且關得掉', () => {
  assert.match(html, /<canvas class="sky" id="sky"/);
  assert.match(base, /\.sky \{/);
  assert.match(base, /:root\[data-sky="off"\] \.sky \{ display: none/);
  const sw = readFileSync('sw.js', 'utf8');
  assert.ok(sw.includes('./src/starfield.js'), '離線外殼裡沒有星空');
});

test('主題色的 meta 跟著換了，不然開 App 時上下會出現一條舊色', () => {
  assert.match(html, /content="#060810" media="\(prefers-color-scheme: dark\)"/);
  assert.match(html, /content="#fbfaf5" media="\(prefers-color-scheme: light\)"/);
  const store = readFileSync('src/store.js', 'utf8');
  assert.match(store, /'#060810' : '#fbfaf5'/);
});

/* ── 起卦：抽牌頁上的水晶球 ─────────────────────── */
const cast = readFileSync('src/orbcast.js', 'utf8');
const draw = readFileSync('src/tarotdraw.js', 'utf8');
const swjs = readFileSync('sw.js', 'utf8');

test('插圖沒放進去的時候，水晶球不畫，普通按鈕留著', () => {
  assert.match(cast, /NEEDED\.every\(k => ok\[k\]\)|rs\.every\(Boolean\)/);
  assert.match(cast, /\.catch\(\(\) => false\)/);   // 載圖失敗不能讓 Promise 炸掉
  // 兩條路共用同一個入口，所以插圖不齊也一定按得下去
  assert.match(cast, /btn\?\.addEventListener\('click', \(\) => onCast\(false\)\)/);
  assert.match(cast, /cast\.hidden = false;\s*\n\s*btn\.hidden = true;/);
});

test('插圖不進安裝外殼 —— 一個 404 會讓整個 Service Worker 裝不起來', () => {
  assert.ok(!swjs.slice(0, swjs.indexOf("self.addEventListener('install'")).includes('ceremony'),
    '起卦插圖被放進 SHELL 了');
  assert.match(swjs, /assets\/ceremony\//);
  assert.match(swjs, /caches\.open\('xj-art'\)/);
  assert.match(swjs, /k === 'xj-art'/);   // 改版時不要清掉，不然每次都重抓
});

test('滑鼠靠 hover 閃，觸控靠按住閃 —— 手指沒有 hover', () => {
  assert.match(views, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\n\s*\.cast__orb:hover \.cast__shine/);
  assert.match(views, /\.cast__orb\.is-press \.cast__shine/);
  assert.match(cast, /orb\.addEventListener\('pointerdown'/);
  // 放開、離開、被系統中斷都要收掉，不然手指滑走之後球會一直閃
  assert.match(cast, /pointerup', 'pointercancel', 'pointerleave'/);
});

test('觸控長按不會跳出選取與放大鏡', () => {
  assert.match(cast, /orb\.addEventListener\('contextmenu', \(e\) => e\.preventDefault\(\)\)/);
  assert.match(draw, /root\.addEventListener\('contextmenu', \(e\) => e\.preventDefault\(\)\)/);
  assert.match(views, /\.cast__orb \{[\s\S]*?-webkit-touch-callout: none/);
  assert.match(views, /\.cast__ball \{[\s\S]*?-webkit-user-drag: none/);
});

test('白光是接力棒：儀式就位了才散，而且一定會散', () => {
  // 儀式貼進 DOM、下一幀畫得出來之後才通知
  assert.match(draw, /requestAnimationFrame\(\(\) => requestAnimationFrame\(onReady\)\)/);
  // 沒人叫它散也要自己散 —— 不能把人卡在一片白裡面
  assert.match(cast, /setTimeout\(fade, 3000\)/);
  // 中途離開儀式也要散
  const tarot = readFileSync('src/views/tarot.js', 'utf8');
  assert.match(tarot, /if \(!got\) \{ fade\?\.\(\); return; \}/);
});

test('起卦已經搬到抽牌頁，儀式裡不再有第二份', () => {
  assert.ok(!draw.includes('cer__rite'), '儀式裡還留著舊的起卦那一層');
  assert.ok(!views.includes('.cer__rite'), 'CSS 裡還留著舊的起卦樣式');
  assert.match(draw, /let phase = 'stack'/);   // 儀式從聚牌開始
});

test('拖曳選牌：往上丟收下、放回扇面當沒發生、已選的可以拖回去', () => {
  // 判斷要看相對位移，不是畫面上的某一條絕對高度 ——
  // 扇面本來就攤在中段，用絕對線的話隨便碰一下都算丟出去
  assert.match(draw, /const THROW_UP/);
  assert.match(draw, /const dy = y - y0;/);
  assert.match(draw, /if \(dy < -THROW_UP \|\| vy < -0\.55\) take\(i\)/);
  assert.match(draw, /if \(dy > DROP_DOWN \|\| vy > 0\.55\) untake\(i\)/);
  assert.match(draw, /function untake\(i\)/);
  // 沒真的拖動就當成點一下 —— 不該逼原本會用的人改學新手勢
  assert.match(draw, /if \(!moved\) \{ take\(i\); return; \}/);
  // 拔掉中間那一張之後，後面的牌位要往前遞補
  assert.match(draw, /function relayoutSlots\(\)/);
  // 已選的牌飛到舞台外緣的牌位排，事件只掛舞台的話就摸不到它
  assert.match(draw, /root\.addEventListener\('pointerdown'/);
  assert.match(draw, /if \(i < 0\) return;/);   // 沒抓到牌就別吃掉事件，不然關閉鍵會壞
});
