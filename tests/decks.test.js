/* 牌組：自己換一副塔羅牌。
   IndexedDB 那一半在瀏覽器煙霧測試裡驗；這裡驗的是純函式與接線 ——
   檔名怎麼對位、缺的牌怎麼退回內建、圖到底有沒有真的走牌組。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const { DECK } = await import('../src/engines/tarot.js');
const decks = await import('../src/decks.js');
const { DEFAULT_SETTINGS } = await import('../src/store.js');

test('預設是內建的偉特牌', () => {
  assert.equal(DEFAULT_SETTINGS.tarotDeck, 'waite');
  assert.equal(decks.BUILTIN, 'waite');
  assert.equal(decks.allDecks()[0].builtin, true);
});

test('檔名對位：同一張牌的各種寫法都要認得', () => {
  const g = (n) => decks.guessId(n, DECK);
  // 就是 id 本人
  assert.equal(g('major-00.png'), 'major-00');
  assert.equal(g('wands-3.jpg'), 'wands-03');       // 少一個零也認
  assert.equal(g('Cups_07.jpeg'), 'cups-07');       // 大寫與底線
  assert.equal(g('coins14.webp'), 'coins-14');      // 沒有分隔符號
  // 中文
  assert.equal(g('聖杯10.png'), 'cups-10');
  assert.equal(g('權杖 3.png'), 'wands-03');
  assert.equal(g('星幣5.png'), 'coins-05');          // 錢幣的別名
  assert.equal(g('愚者.png'), 'major-00');           // 直接寫牌名
  // 牌背
  for (const n of ['back.webp', 'card-back.png', '牌背.jpg', '背面.png']) assert.equal(g(n), 'back');
});

test('猜不到就回 null —— 猜錯比猜不到糟', () => {
  assert.equal(decks.guessId('IMG_2043.jpg', DECK), null);
  assert.equal(decks.guessId('未命名.png', DECK), null);
  // 猜不到還有退路：使用者可以點格子自己指定
  assert.match(readFileSync('src/views/tarot.js', 'utf8'), /點格子手動指定/);
});

test('macOS 的 NFD 檔名也要認得', () => {
  // 同一個字串，一個是組合形一個是分解形。不正規化的話從 Mac 拖進來會對不上。
  const nfd = '聖杯10.png'.normalize('NFD');
  assert.equal(decks.guessId(nfd, DECK), 'cups-10');
  assert.match(readFileSync('src/decks.js', 'utf8'), /normalize\('NFC'\)/);
});

test('缺的牌退回內建那一張', () => {
  // 記憶體裡沒有任何自訂圖的時候，srcOf 一律給內建路徑
  assert.equal(decks.srcOf('major-00'), 'assets/tarot/major-00.webp');
  assert.equal(decks.hasOwn('major-00'), false);
});

test('圖真的走牌組，不是寫死的路徑', () => {
  const view = readFileSync('src/views/tarot.js', 'utf8');
  const draw = readFileSync('src/tarotdraw.js', 'utf8');
  assert.match(view, /const imgSrc = \(c\) => decks\.srcOf\(c\.img\)/);
  assert.match(draw, /img\.src = srcOf\(cards\[i\]\.card\.img\)/);
  // 牌背是 background 不是 <img>，所以走 CSS 變數
  const css = readFileSync('styles/views.css', 'utf8');
  assert.match(css, /var\(--card-back, url\("\.\.\/assets\/tarot\/back\.webp"\)\)/);
  assert.match(readFileSync('src/decks.js', 'utf8'), /setProperty\('--card-back'/);
});

test('圖放 IndexedDB，不是 localStorage', () => {
  const src = readFileSync('src/decks.js', 'utf8');
  assert.match(src, /indexedDB\.open/);
  assert.ok(!src.includes('localStorage.setItem'), '圖被塞進 localStorage 了');
  // 名冊這種小東西才留在 localStorage
  assert.match(readFileSync('src/store.js', 'utf8'), /get decks\(\)/);
});

test('匯入時要縮圖，不要把幾 MB 的掃描檔原封不動存起來', () => {
  const src = readFileSync('src/decks.js', 'utf8');
  assert.match(src, /export async function shrink\(file, maxW = 600/);
  assert.match(src, /toBlob\(r, 'image\/webp'/);
  // 有些瀏覽器不支援 webp 輸出，toBlob 會回 null —— 那就原檔存，不能整個壞掉
  assert.match(src, /return blob \|\| file;/);
});

test('物件網址換牌組時要收掉，不然是記憶體洩漏', () => {
  const src = readFileSync('src/decks.js', 'utf8');
  assert.match(src, /revokeObjectURL/);
  // 改過內容的同一副要能強制重載，不然會被當成「已經載好」而跳過
  assert.match(src, /loadDeck\(deckId, force = false\)/);
  assert.match(src, /if \(live\.id === deckId && !force\)/);
});

test('刪掉正在用的那一副，要自動切回內建', () => {
  assert.match(readFileSync('src/store.js', 'utf8'),
    /if \(this\.settings\.tarotDeck === id\) this\.setSettings\(\{ tarotDeck: 'waite' \}\)/);
});
