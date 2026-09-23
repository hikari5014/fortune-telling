/* App 標誌：SVG、PNG、與 App 內的線稿版要是同一個東西。
   這幾個檔案分散在四個地方（icon.svg、make_icons.py、icons.js、index.html），
   最容易發生的錯就是改了一個忘了另外三個，所以這裡把它們綁在一起驗。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const svg = readFileSync('assets/icons/icon.svg', 'utf8');
const py = readFileSync('tools/make_icons.py', 'utf8');
const html = readFileSync('index.html', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
const { icon, iconNames } = await import('../src/icons.js');

test('圖示不用 emoji —— 從一開始就講好的條件', () => {
  const icons = readFileSync('src/icons.js', 'utf8');
  // 代理對（U+1F300 以上）是 emoji 的範圍
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(icons + svg), '圖示裡混進了 emoji');
});

test('標誌的關鍵座標，SVG 與 PNG 產生器要對得起來', () => {
  // 三圈半徑 + 中央四芒星的臂長。改了一邊沒改另一邊，兩個版本就會長得不一樣。
  for (const r of ['160', '128', '88']) {
    assert.ok(svg.includes(`r="${r}"`), `icon.svg 少了半徑 ${r} 的圈`);
    assert.ok(py.includes(`W(${r})`), `make_icons.py 少了半徑 ${r} 的圈`);
  }
  assert.match(svg, /stroke-dasharray="4 8"/);          // 外圈星軌是虛線
  assert.match(py, /dash_on, period = W\(4\), W\(12\)/); // 4 實 8 虛 = 週期 12
  assert.match(py, /big = W\(96\)/);                    // 四芒星臂長 256→160
  assert.match(svg, /M 256 160 Q 256 256 352 256/);
});

test('App 內的線稿標誌是同一個圖案，只是簡化過', () => {
  assert.ok(iconNames.includes('mark'));
  const m = icon('mark');
  assert.match(m, /stroke="currentColor"/);   // 要能跟著主題變色
  assert.match(m, /stroke-dasharray/);        // 外圈星軌
  assert.match(m, /Q12 12 12 7.2Z/);          // 中央四芒星
});

test('側欄與開機畫面都用這個標誌', () => {
  const app = readFileSync('src/app.js', 'utf8');
  assert.match(app, /rail__logo[^`]*\$\{icon\('mark'\)\}/);
  assert.match(html, /class="boot__star"/);
  assert.match(html, /class="boot__orbit"/);
});

test('四個尺寸的 PNG 都在，而且不是空檔', () => {
  for (const f of ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png']) {
    assert.ok(statSync(`assets/icons/${f}`).size > 4000, `${f} 看起來是空的或沒重新產生`);
  }
});

test('PNG 真的是 PNG，而且尺寸對得上 manifest 宣告的', () => {
  const dim = (f) => {
    const b = readFileSync(`assets/icons/${f}`);
    assert.equal(b.subarray(1, 4).toString(), 'PNG');
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  for (const ic of manifest.icons.filter(i => i.type === 'image/png')) {
    const [w, h] = dim(ic.src.split('/').pop());
    assert.equal(`${w}x${h}`, ic.sizes, `${ic.src} 的實際尺寸與 manifest 不符`);
  }
});

test('maskable 的圖案要縮進安全區，而且底色鋪滿不留透明', () => {
  assert.match(py, /draw\(512, scale=0\.72, squircle=False\)/);
  const b = readFileSync('assets/icons/maskable-512.png');
  assert.equal(b.readUInt32BE(16), 512);
});

test('主題色三個地方是一致的，不然開 App 時上下會閃一條舊色', () => {
  assert.equal(manifest.theme_color, '#060810');
  assert.equal(manifest.background_color, '#060810');
  assert.match(html, /content="#060810" media="\(prefers-color-scheme: dark\)"/);
});

test('iOS 主畫面圖示整片不透明 —— 有透明角 iOS 會補白，變成一圈白邊', async () => {
  assert.match(py, /draw\(180, scale=[\d.]+, squircle=False[,)]/);
  const { inflateSync } = await import('node:zlib');
  const b = readFileSync('assets/icons/apple-touch-icon.png');
  assert.equal(b[25], 6, '預期 RGBA PNG');
  // 取出 IDAT、解壓，看四個角的 alpha（每列開頭有一個 filter byte；角落像素只看第一列與最後一列）
  let off = 8; const parts = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), tag = b.toString('latin1', off + 4, off + 8);
    if (tag === 'IDAT') parts.push(b.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20), stride = 1 + w * 4;
  for (const row of [0, h - 1]) {
    assert.equal(raw[row * stride], 0, '這支測試只看得懂 filter 0 的列');
    for (const x of [0, w - 1]) assert.equal(raw[row * stride + 1 + x * 4 + 3], 255, `角落 (${x},${row}) 是透明的`);
  }
});

test('圖示收邊：主畫面三個尺寸都用鎏金框，maskable 不加（會被裁成圓形，框對不齊）', () => {
  assert.match(py, /draw\(512, style='frame'\)/);
  assert.match(py, /draw\(192, style='frame'\)/);
  assert.match(py, /draw\(180, scale=[\d.]+, squircle=False, style='frame'\)/);
  assert.match(py, /draw\(512, scale=0\.72, squircle=False\)\.png/);
});
