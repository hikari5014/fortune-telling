/* QR Code 產生器（位元組模式，UTF-8）
   ──────────────────────────────────────────────────────────
   自己寫的，零相依。只做「產生」，不做「掃描」：
   iOS Safari 沒有 BarcodeDetector，但 iPhone 內建相機本來就會讀 QR，
   所以我們把內容做成網址，讓系統相機直接開啟 App —— 比自己寫解碼器實在。

   測試會把產生出來的圖真的用 QR 解碼器解回來比對（見 tests/qrcode.test.js）。 */

/* ── GF(256) 伽羅瓦體，QR 用的本原多項式 0x11D ────── */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** 產生 n 個 EC 碼字所需的生成多項式 */
function genPoly(n) {
  let p = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) {
      next[j] ^= p[j];
      next[j + 1] ^= mul(p[j], EXP[i]);
    }
    p = next;
  }
  return p;
}

/** Reed-Solomon 錯誤更正碼字 */
function rsEncode(data, ecLen) {
  const gen = genPoly(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], factor);
  }
  return res.slice(data.length);
}

/* ── 版本資料表（1–15 版，四種錯誤更正等級） ────────
   每列：[每塊的 EC 碼字數, 第一群塊數, 第一群資料碼字, 第二群塊數, 第二群資料碼字] */
const TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655];
const BLOCKS = {
  L: [[7,1,19,0,0],[10,1,34,0,0],[15,1,55,0,0],[20,1,80,0,0],[26,1,108,0,0],[18,2,68,0,0],[20,2,78,0,0],
      [24,2,97,0,0],[30,2,116,0,0],[18,2,68,2,69],[20,4,81,0,0],[24,2,92,2,93],[26,4,107,0,0],
      [30,3,115,1,116],[22,5,87,1,88]],
  M: [[10,1,16,0,0],[16,1,28,0,0],[26,1,44,0,0],[18,2,32,0,0],[24,2,43,0,0],[16,4,27,0,0],[18,4,31,0,0],
      [22,2,38,2,39],[22,3,36,2,37],[26,4,43,1,44],[30,1,50,4,51],[22,6,36,2,37],[22,8,37,1,38],
      [24,4,40,5,41],[24,5,41,5,42]],
  Q: [[13,1,13,0,0],[22,1,22,0,0],[18,2,17,0,0],[26,2,24,0,0],[18,2,15,2,16],[24,4,19,0,0],[18,2,14,4,15],
      [22,4,18,2,19],[20,4,16,4,17],[24,6,19,2,20],[28,4,22,4,23],[26,4,20,6,21],[24,8,20,4,21],
      [20,11,16,5,17],[30,5,24,7,25]],
  H: [[17,1,9,0,0],[28,1,16,0,0],[22,2,13,0,0],[16,4,9,0,0],[22,2,11,2,12],[28,4,15,0,0],[26,4,13,1,14],
      [26,4,14,2,15],[24,4,12,4,13],[28,6,15,2,16],[24,3,12,8,13],[28,7,14,4,15],[22,12,11,4,12],
      [24,11,12,5,13],[24,11,12,7,13]],
};
const ALIGN = [[], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50],
               [6,30,54], [6,32,58], [6,34,62], [6,26,46,66], [6,26,48,70]];
const EC_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

const dataCapacity = (ver, ec) => {
  const [ecLen, b1, d1, b2, d2] = BLOCKS[ec][ver - 1];
  return b1 * d1 + b2 * d2;
};

/* ── 位元流 ───────────────────────────────────────── */
class Bits {
  constructor() { this.bits = []; }
  push(value, len) { for (let i = len - 1; i >= 0; i--) this.bits.push((value >> i) & 1); }
  get length() { return this.bits.length; }
  toBytes() {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((b, i) => { if (b) out[i >> 3] |= 0x80 >> (i & 7); });
    return out;
  }
}

/* ── 格式資訊與版本資訊的 BCH ──────────────────────── */
function formatBits(ec, mask) {
  const data = (EC_BITS[ec] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
function versionBits(ver) {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1F25);
  return (ver << 12) | rem;
}

/* ── 遮罩 ─────────────────────────────────────────── */
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** 四條懲罰規則，分數越低越好 */
function penalty(m) {
  const n = m.length;
  let score = 0;
  // 規則 1：同色連續 5 個以上
  for (const line of [m, m[0].map((_, c) => m.map(r => r[c]))]) {
    for (const row of line) {
      let run = 1;
      for (let i = 1; i < n; i++) {
        if (row[i] === row[i - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score += 1; }
        else run = 1;
      }
    }
  }
  // 規則 2：2×2 同色區塊
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
  }
  // 規則 3：1:1:3:1:1 的假定位圖樣
  const P1 = [1,0,1,1,1,0,1,0,0,0,0], P2 = [0,0,0,0,1,0,1,1,1,0,1];
  const match = (row, i, p) => p.every((v, k) => row[i + k] === (v === 1));
  for (const line of [m, m[0].map((_, c) => m.map(r => r[c]))]) {
    for (const row of line) {
      for (let i = 0; i + 11 <= n; i++) if (match(row, i, P1) || match(row, i, P2)) score += 40;
    }
  }
  // 規則 4：深色比例偏離五成
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  score += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
  return score;
}

/* ── 主流程 ───────────────────────────────────────── */
/**
 * 產生 QR 矩陣
 * @param {string} text 內容（會以 UTF-8 編碼）
 * @param {object} o {ec 錯誤更正等級 L/M/Q/H, minVersion, mask 指定遮罩（測試用，預設自動挑）}
 * @returns {{size:number, modules:boolean[][], version:number, ec:string, mask:number}}
 */
export function encode(text, { ec = 'M', minVersion = 1, mask = null } = {}) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  if (!BLOCKS[ec]) throw new Error(`不支援的錯誤更正等級：${ec}`);

  // 選最小的容得下的版本
  let ver = 0;
  for (let v = minVersion; v <= 15; v++) {
    const lenBits = v < 10 ? 8 : 16;
    if (4 + lenBits + bytes.length * 8 <= dataCapacity(v, ec) * 8) { ver = v; break; }
  }
  if (!ver) throw new Error(`內容太長（${bytes.length} 位元組），超出 15 版 ${ec} 級的容量`);

  const [ecLen, b1, d1, b2, d2] = BLOCKS[ec][ver - 1];
  const totalData = b1 * d1 + b2 * d2;

  // 位元流：模式指示碼 0100 + 長度 + 資料 + 結束符 + 補到整位元組 + 填充碼字
  const bits = new Bits();
  bits.push(0b0100, 4);
  bits.push(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) bits.push(b, 8);
  const cap = totalData * 8;
  bits.push(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0, 1);
  const data = Array.from(bits.toBytes());
  for (let i = 0; data.length < totalData; i++) data.push(i % 2 ? 0x11 : 0xEC);

  // 切塊、各自算 EC、再交錯
  const blocks = [];
  let at = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const len = i < b1 ? d1 : d2;
    const chunk = Uint8Array.from(data.slice(at, at + len));
    at += len;
    blocks.push({ data: chunk, ec: rsEncode(chunk, ecLen) });
  }
  const out = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.ec[i]);

  // 擺放
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) { m[r][c] = v; fixed[r][c] = true; } };

  // 定位圖樣與分隔帶
  for (const [br, bc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const on = inner && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(br + r, bc + c, on);
    }
  }
  // 校正圖樣
  const centers = ALIGN[ver - 1];
  for (const r of centers) for (const c of centers) {
    if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }
  // 時序圖樣
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  // 固定的深色模組
  set(size - 8, 8, true);
  // 保留格式資訊的位置
  for (let i = 0; i < 9; i++) { if (i === 6) continue; set(8, i, false); set(i, 8, false); }
  for (let i = 0; i < 8; i++) { set(8, size - 1 - i, false); set(size - 1 - i, 8, false); }
  // 版本資訊（7 版以上）
  if (ver >= 7) {
    const vb = versionBits(ver);
    for (let i = 0; i < 18; i++) {
      const on = ((vb >> i) & 1) === 1;
      set(Math.floor(i / 3), size - 11 + (i % 3), on);
      set(size - 11 + (i % 3), Math.floor(i / 3), on);
    }
  }

  // 資料以之字形由右下往上填
  let bitIdx = 0;
  const nextBit = () => {
    if (bitIdx >= out.length * 8) return false;
    const v = (out[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
    bitIdx++;
    return v === 1;
  };
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;                      // 跳過時序那一行
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (!fixed[row][c]) { m[row][c] = nextBit(); }
      }
    }
    upward = !upward;
  }

  // 挑遮罩：八種都試，選懲罰分數最低的
  let best = 0, bestScore = Infinity, bestM = null;
  for (let k = 0; k < 8; k++) {
    if (mask !== null && k !== mask) continue;
    const t = m.map((row, r) => row.map((v, c) => (fixed[r][c] ? v : v !== MASKS[k](r, c))));
    writeFormat(t, ec, k, size);
    const p = penalty(t);
    if (p < bestScore) { bestScore = p; best = k; bestM = t; }
  }
  return { size, modules: bestM, version: ver, ec, mask: best };
}

function writeFormat(t, ec, mask, size) {
  const f = formatBits(ec, mask);
  const bit = (i) => ((f >> i) & 1) === 1;   // i = 0 是最低位
  // 第一份：左上角（橫的由高位排到低位，直的由低位排到高位）
  for (let i = 0; i <= 5; i++) t[8][i] = bit(14 - i);
  t[8][7] = bit(8);
  t[8][8] = bit(7);
  t[7][8] = bit(6);
  for (let i = 0; i <= 5; i++) t[i][8] = bit(i);
  // 第二份：左下（高七位）與右上（低八位）
  for (let i = 0; i <= 6; i++) t[size - 1 - i][8] = bit(14 - i);
  for (let i = 0; i <= 7; i++) t[8][size - 8 + i] = bit(7 - i);
  t[size - 8][8] = true;                      // 固定的深色模組
}

/**
 * 畫成 SVG。顏色直接寫在屬性上而不是只靠 class：
 * 這張圖可能被存成圖片、貼到別的地方、或由 <img> 載入 ——
 * 那些情境都吃不到外部樣式表，只剩一片黑。class 仍然留著當掛勾。
 * 也刻意不跟著深色主題反轉：不是每台掃描器都讀得了反相的碼。
 */
export function toSVG(text, { ec = 'M', margin = 4, cls = 'qr', light = '#ffffff', dark = '#0a0a0a' } = {}) {
  const { modules, size } = encode(text, { ec });
  const dim = size + margin * 2;
  let path = '';
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!modules[r][c]) { c++; continue; }
      let run = 1;
      while (c + run < size && modules[r][c + run]) run++;
      path += `M${c + margin} ${r + margin}h${run}v1h-${run}z`;
      c += run;
    }
  }
  return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" role="img" aria-label="QR code" shape-rendering="crispEdges">
    <rect width="${dim}" height="${dim}" class="qr__bg" fill="${light}"/>
    <path d="${path}" class="qr__fg" fill="${dark}"/>
  </svg>`;
}
