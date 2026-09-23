/* 牌組：自己換一副塔羅牌
   ──────────────────────────────────────────────────────────
   內建的是偉特牌（1909，公有領域）。這支讓使用者放自己的牌 ——
   背面、正面，一張一張都可以換。

   幾個決定：

   1. **圖放 IndexedDB，不放 localStorage。** 一副 78 張就算壓過也有好幾 MB，
      localStorage 只有 5–10 MB 而且只能存字串，塞進去會把整個 App 的設定一起搞壞。
      牌組的「名字、有哪幾張」這種小東西才留在 localStorage。

   2. **缺的牌補內建的。** 只換背面、或只換大牌，都成立 ——
      沒換到的那些自動用偉特牌。要求一次湊滿 79 張才能用，等於沒人會用。

   3. **匯入時就把圖壓小。** 原圖常常是幾 MB 的掃描檔，
      在裝置上縮到寬 600px、轉成 WebP 再存。牌面在畫面上最多也才兩百多像素寬，
      存原圖只是浪費使用者的儲存空間。

   4. **物件網址用完要收。** createObjectURL 不收就是記憶體洩漏，
      換牌組的時候會把上一副的全部 revoke 掉。 */

import { store } from './store.js';

const DB = 'xj-decks';
const STORE = 'imgs';
export const BUILTIN = 'waite';
/** 背面在資料裡跟其他牌一樣是一個 id，只是它不是一張牌 */
export const BACK = 'back';

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('這個瀏覽器沒有 IndexedDB')); return; }
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE);
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return dbp;
}

const key = (deckId, imgId) => `${deckId}/${imgId}`;

async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    let out;
    try { out = fn(s); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
}

/** 存一張圖 */
export const putImage = (deckId, imgId, blob) =>
  tx('readwrite', (s) => s.put(blob, key(deckId, imgId)));

/** 刪一張圖 */
export const delImage = (deckId, imgId) =>
  tx('readwrite', (s) => s.delete(key(deckId, imgId)));

/** 這一副有哪些 id（照存進去的順序） */
export async function idsOf(deckId) {
  const all = await tx('readonly', (s) => s.getAllKeys());
  const p = `${deckId}/`;
  return all.filter(k => typeof k === 'string' && k.startsWith(p)).map(k => k.slice(p.length));
}

/** 整副刪掉 */
export async function dropDeck(deckId) {
  const ids = await idsOf(deckId);
  await tx('readwrite', (s) => { ids.forEach(i => s.delete(key(deckId, i))); });
}

/** 整副的位元組數 —— 給使用者看「這副佔多少空間」 */
export async function sizeOf(deckId) {
  const ids = await idsOf(deckId);
  const blobs = await tx('readonly', (s) => {
    const out = [];
    ids.forEach(i => { const r = s.get(key(deckId, i)); r.onsuccess = () => out.push(r.result); });
    return out;
  });
  return blobs.reduce((a, b) => a + (b?.size || 0), 0);
}

/* ── 目前這一副 ────────────────────────────────────── */

let live = { id: null, urls: new Map() };

/**
 * 把一副載進記憶體，之後 srcOf() 才是同步的（畫面不能等 IndexedDB）。
 * @param {boolean} force 內容改過了要重載 —— 不然「同一副」會被當成已經載好而跳過
 */
export async function loadDeck(deckId, force = false) {
  if (live.id === deckId && !force) return live.urls;
  for (const u of live.urls.values()) URL.revokeObjectURL(u);   // 上一副收乾淨
  live = { id: deckId, urls: new Map() };
  if (!deckId || deckId === BUILTIN) return live.urls;
  try {
    const ids = await idsOf(deckId);
    const got = new Map();
    for (const i of ids) {
      const b = await tx('readonly', (s) => new Promise((r) => {
        const rq = s.get(key(deckId, i));
        rq.onsuccess = () => r(rq.result);
      }));
      if (b) got.set(i, URL.createObjectURL(b));
    }
    if (live.id !== deckId) { for (const u of got.values()) URL.revokeObjectURL(u); return live.urls; }
    live.urls = got;
  } catch { /* 讀不到就整副當作沒有，退回內建 */ }
  return live.urls;
}

/** 這個 id 該用哪張圖。自訂牌組沒有的就退回內建那一張。 */
export const srcOf = (imgId) => live.urls.get(imgId) || `assets/tarot/${imgId}.webp`;
/** 目前載進來的那一副有沒有這一張 */
export const hasOwn = (imgId) => live.urls.has(imgId);
export const liveId = () => live.id;

/** 把背面寫進 CSS 變數 —— 牌背是 background，不是 <img> */
export function applyBack() {
  const el = document.documentElement;
  const u = live.urls.get(BACK);
  if (u) el.style.setProperty('--card-back', `url("${u}")`);
  else el.style.removeProperty('--card-back');
}

/** App 啟動與換牌組時都叫這一支。改過內容之後要帶 force。 */
export async function useDeck(deckId, force = false) {
  await loadDeck(deckId, force);
  applyBack();
  return live.urls;
}

/* ── 匯入 ─────────────────────────────────────────── */

/**
 * 把使用者選的圖壓小、轉成 WebP。
 * 原圖常常是幾 MB 的掃描檔，可是牌面在畫面上最多兩百多像素寬。
 * @returns {Promise<Blob>}
 */
export async function shrink(file, maxW = 600, quality = 0.86) {
  const bmp = await createImageBitmap(file);
  const w = Math.min(bmp.width, maxW);
  const h = Math.round(bmp.height * (w / bmp.width));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise(r => cv.toBlob(r, 'image/webp', quality));
  // 極少數瀏覽器不支援 webp 輸出，toBlob 會回 null；那就原檔存
  return blob || file;
}

/**
 * 由檔名猜這是哪一張牌。
 * 收得寬一點：大小寫、底線、空白、多餘的零、中文牌名都認。
 * 猜不到就回 null —— 猜錯比猜不到糟，猜不到使用者還能自己指定。
 */
export function guessId(filename, cards) {
  /* 先正規化：macOS 的檔名是 NFD（分解形），同一個中文字會跟 NFC 對不起來。
     不轉的話「聖杯10」從 Mac 拖進來會比對失敗。 */
  const stem = String(filename).normalize('NFC').replace(/\.[^.]+$/, '').trim().toLowerCase();
  const flat = stem.replace(/[\s_]+/g, '-');
  if (/^(back|card-?back|背面|牌背)$/.test(flat)) return BACK;

  // 直接就是 id：major-00 / wands-1 / coins-14
  const m = flat.match(/(major|wands|cups|swords|coins)-?(\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}`;

  // 中文花色：權杖三、聖杯 10、大牌 0
  const ZH = { 權杖: 'wands', 聖杯: 'cups', 寶劍: 'swords', 錢幣: 'coins', 金幣: 'coins', 星幣: 'coins' };
  const z = stem.match(/(權杖|聖杯|寶劍|錢幣|金幣|星幣)[\s-]*(\d{1,2})/);
  if (z) return `${ZH[z[1]]}-${String(Number(z[2])).padStart(2, '0')}`;

  // 中文牌名：愚者、聖杯騎士⋯⋯（比對 DECK 裡的名字）
  if (cards) {
    const hit = cards.find(c => stem.includes(c.name.toLowerCase()) || stem.includes(c.full.toLowerCase()));
    if (hit) return hit.img;
  }
  return null;
}

/* ── 牌組名冊（小東西，留在 localStorage）─────────────── */

/** 內建那一副永遠排在最前面，而且刪不掉 */
export const allDecks = () => [
  { id: BUILTIN, name: '偉特牌（內建）', builtin: true },
  ...store.decks,
];
export const deckName = (id) => (allDecks().find(d => d.id === id) || {}).name || '偉特牌（內建）';
