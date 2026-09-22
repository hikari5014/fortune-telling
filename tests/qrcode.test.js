/* QR 產生器
   ──────────────────────────────────────────────────────────
   開發時，這個編碼器的輸出已經跟成熟的參考實作（npm 的 qrcode）
   逐格比對過：1–15 版 × L/M/Q/H × 八種遮罩，共 160 組矩陣完全一致，
   也用 jsQR 把產生出來的圖真的解回原文。那兩個套件只在開發機上跑過，
   不會進這個專案（App 與測試都維持零相依），所以這裡留下三層守門：
     1. 結構不變量 —— 定位、分隔、時序、校正、深色模組、容量表自洽
     2. 格式資訊黃金值 —— 來自 ISO/IEC 18004 附錄 C，共 32 組
     3. 自己寫一個獨立的解碼器把矩陣讀回來，比對原文 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, toSVG } from '../src/qrcode.js';

/* ── 1. 結構不變量 ─────────────────────────────────── */

test('尺寸與版本相符', () => {
  for (let v = 1; v <= 15; v++) {
    const r = encode('x'.repeat(4), { ec: 'L', minVersion: v });
    assert.equal(r.version, v);
    assert.equal(r.size, v * 4 + 17);
    assert.equal(r.modules.length, r.size);
    r.modules.forEach(row => assert.equal(row.length, r.size));
  }
});

test('三個定位圖樣與分隔帶正確', () => {
  for (const v of [1, 5, 10, 15]) {
    const { modules: m, size } = encode('測試', { minVersion: v });
    for (const [br, bc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const want = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        assert.equal(m[br + r][bc + c], want, `v${v} 定位 (${br + r},${bc + c})`);
      }
      // 分隔帶：定位圖樣外圈一定是白的
      for (let i = -1; i <= 7; i++) {
        for (const [r, c] of [[br - 1, bc + i], [br + 7, bc + i], [br + i, bc - 1], [br + i, bc + 7]]) {
          if (r < 0 || c < 0 || r >= size || c >= size) continue;
          assert.equal(m[r][c], false, `v${v} 分隔帶 (${r},${c})`);
        }
      }
    }
  }
});

test('時序圖樣在第 6 列與第 6 行交錯', () => {
  for (const v of [1, 7, 15]) {
    const { modules: m, size } = encode('測試', { minVersion: v });
    for (let i = 8; i < size - 8; i++) {
      assert.equal(m[6][i], i % 2 === 0, `v${v} 橫向時序 ${i}`);
      assert.equal(m[i][6], i % 2 === 0, `v${v} 縱向時序 ${i}`);
    }
  }
});

test('固定深色模組在 (4×版本+9, 8)', () => {
  for (let v = 1; v <= 15; v++) {
    const { modules: m } = encode('x', { minVersion: v });
    assert.equal(m[4 * v + 9][8], true, `v${v}`);
  }
});

test('校正圖樣數量與外觀符合版本', () => {
  // 第 1 版沒有校正圖樣；第 2–6 版一個；之後是「中心點個數平方」再扣掉跟定位重疊的三個
  const expect = { 1: 0, 2: 1, 5: 1, 7: 6, 13: 6, 14: 13, 15: 13 };
  for (const [v, want] of Object.entries(expect)) {
    const { modules: m, size } = encode('x', { minVersion: +v });
    let found = 0;
    for (let r = 2; r < size - 2; r++) for (let c = 2; c < size - 2; c++) {
      // 5×5 的回字：外圈黑、中圈白、正中黑
      let ok = true;
      for (let dr = -2; dr <= 2 && ok; dr++) for (let dc = -2; dc <= 2 && ok; dc++) {
        if (m[r + dr][c + dc] !== (Math.max(Math.abs(dr), Math.abs(dc)) !== 1)) ok = false;
      }
      if (ok) found++;
    }
    assert.equal(found, want, `v${v} 校正圖樣`);
  }
});

/* ── 2. 格式資訊：ISO/IEC 18004 附錄 C 的三十二組黃金值 ── */

const FORMAT = {
  L: ['111011111000100', '111001011110011', '111110110101010', '111100010011101',
      '110011000101111', '110001100011000', '110110001000001', '110100101110110'],
  M: ['101010000010010', '101000100100101', '101111001111100', '101101101001011',
      '100010111111001', '100000011001110', '100111110010111', '100101010100000'],
  Q: ['011010101011111', '011000001101000', '011111100110001', '011101000000110',
      '010010010110100', '010000110000011', '010111011011010', '010101111101101'],
  H: ['001011010001001', '001001110111110', '001110011100111', '001100111010000',
      '000011101100010', '000001001010101', '000110100001100', '000100000111011'],
};

/** 從矩陣讀回十五位元的格式資訊（兩份都讀，必須一樣） */
function readFormat(m, size) {
  const b = (r, c) => (m[r][c] ? '1' : '0');
  let a = '';
  for (let i = 0; i <= 5; i++) a += b(8, i);
  a += b(8, 7) + b(8, 8) + b(7, 8);
  for (let i = 5; i >= 0; i--) a += b(i, 8);
  let z = '';
  for (let i = 0; i <= 6; i++) z += b(size - 1 - i, 8);
  for (let i = 0; i <= 7; i++) z += b(8, size - 8 + i);
  return [a, z];
}

test('格式資訊符合標準的三十二組值，且兩份一致', () => {
  for (const ec of ['L', 'M', 'Q', 'H']) for (let k = 0; k < 8; k++) {
    const r = encode('a', { ec, mask: k });
    const [a, z] = readFormat(r.modules, r.size);
    assert.equal(a, FORMAT[ec][k], `${ec} 遮罩 ${k}`);
    assert.equal(z, FORMAT[ec][k], `${ec} 遮罩 ${k}（第二份）`);
  }
});

/* ── 3. 獨立解碼器：把矩陣讀回原文 ──────────────────── */

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
const TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655];

/** 標出所有功能區（不放資料的格子），跟編碼器分開寫 */
function functionMask(ver, size) {
  const f = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (r, c) => { if (r >= 0 && r < size && c >= 0 && c < size) f[r][c] = true; };
  for (const [br, bc] of [[0, 0], [0, size - 8], [size - 8, 0]])
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) mark(br + r, bc + c);
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(8, size - 1 - i); mark(size - 1 - i, 8); }
  const ALIGN = [[], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50],
                 [6,30,54], [6,32,58], [6,34,62], [6,26,46,66], [6,26,48,70]][ver - 1];
  for (const r of ALIGN) for (const c of ALIGN) {
    if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(r + dr, c + dc);
  }
  if (ver >= 7) for (let i = 0; i < 18; i++) {
    mark(Math.floor(i / 3), size - 11 + (i % 3));
    mark(size - 11 + (i % 3), Math.floor(i / 3));
  }
  return f;
}

/** 把矩陣解回字串（不做錯誤更正，只當作沒有汙損的理想影像） */
function decode({ modules, size, version, ec, mask }) {
  const fn = functionMask(version, size);
  const bits = [];
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1])
        if (!fn[row][c]) bits.push(modules[row][c] !== MASKS[mask](row, c));
    }
    upward = !upward;
  }
  // 位元 → 碼字 → 去交錯
  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | (bits[i + k] ? 1 : 0);
    words.push(v);
  }
  const [ecLen, b1, d1, b2, d2] = BLOCKS[ec][version - 1];
  assert.equal(b1 * d1 + b2 * d2 + (b1 + b2) * ecLen, TOTAL[version - 1], '容量表自洽');
  const lens = [...Array(b1).fill(d1), ...Array(b2).fill(d2)];
  const blocks = lens.map(n => new Array(n));
  let at = 0;
  for (let i = 0; i < Math.max(d1, d2); i++)
    for (let b = 0; b < blocks.length; b++) if (i < lens[b]) blocks[b][i] = words[at++];
  const data = blocks.flat();
  // 讀模式指示碼與長度
  let p = 0;
  const take = (n) => { let v = 0; for (let k = 0; k < n; k++) { v = (v << 1) | ((data[p >> 3] >> (7 - (p & 7))) & 1); p++; } return v; };
  assert.equal(take(4), 0b0100, '位元組模式');
  const len = take(version < 10 ? 8 : 16);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = take(8);
  return new TextDecoder().decode(out);
}

test('矩陣可以被獨立寫的解碼器讀回原文', () => {
  const samples = [
    'a',
    'HELLO WORLD',
    'https://hikari5014.github.io/fortune-telling/#/share?c=XJP2:aGVsbG8td29ybGQ',
    '玄鑑 · 命盤分享碼',
    '中文與 ASCII 混排 abc 123 —— 全形符號也要能過',
    'x'.repeat(200),
  ];
  for (const ec of ['L', 'M', 'Q', 'H']) for (const s of samples) {
    const r = encode(s, { ec });
    assert.equal(decode(r), s, `${ec} / ${s.slice(0, 20)}`);
  }
});

test('每一版、每一種更正等級都能來回一趟', () => {
  const alnum = 'abcdefghijklmnopqrstuvwxyz0123456789-_:/.';
  const CAP = { L: [17,32,53,78,106,134,154,192,230,271,321,367,425,458,520],
                M: [14,26,42,62,84,106,122,152,180,213,251,287,331,362,412],
                Q: [11,20,32,46,60,74,86,108,130,151,177,203,241,258,292],
                H: [7,14,24,34,44,58,64,84,98,119,137,155,177,194,220] };
  for (const ec of ['L', 'M', 'Q', 'H']) for (let v = 1; v <= 15; v++) {
    const n = CAP[ec][v - 1];
    let s = ''; while (s.length < n) s += alnum;
    s = s.slice(0, n);
    const r = encode(s, { ec, minVersion: v });
    assert.equal(r.version, v, `${ec}${v} 剛好塞滿就該用這一版`);
    assert.equal(decode(r), s, `${ec}${v}`);
  }
});

test('八種遮罩都能解回原文，而且自動挑的那個分數最低', () => {
  const s = '玄鑑 XUAN JIAN 命盤分享';
  const auto = encode(s, { ec: 'M' });
  for (let k = 0; k < 8; k++) {
    const r = encode(s, { ec: 'M', mask: k });
    assert.equal(r.mask, k);
    assert.equal(decode(r), s, `遮罩 ${k}`);
  }
  assert.ok(auto.mask >= 0 && auto.mask < 8);
});

/* ── 4. 容量與輸出 ─────────────────────────────────── */

test('多一個位元組就升一版，超過上限就明講', () => {
  const r1 = encode('x'.repeat(17), { ec: 'L' });
  const r2 = encode('x'.repeat(18), { ec: 'L' });
  assert.equal(r1.version, 1);
  assert.equal(r2.version, 2);
  assert.throws(() => encode('x'.repeat(521), { ec: 'L' }), /太長/);
  assert.throws(() => encode('x', { ec: 'Z' }), /錯誤更正等級/);
});

test('中文一個字算三個位元組', () => {
  // L1 容得下 17 位元組 = 五個中文字（15）加兩個 ASCII
  assert.equal(encode('中文測試字ab', { ec: 'L' }).version, 1);
  assert.equal(encode('中文測試字abc', { ec: 'L' }).version, 2);
});

test('toSVG 畫出四格留白與正確的方格數', () => {
  const s = '玄鑑';
  const { size, modules } = encode(s, { ec: 'M' });
  const svg = toSVG(s, { ec: 'M', margin: 4 });
  assert.match(svg, new RegExp(`viewBox="0 0 ${size + 8} ${size + 8}"`));
  assert.match(svg, /class="qr__bg"/);
  assert.match(svg, /class="qr__fg"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  // 路徑裡所有橫條的長度加起來，要等於黑格總數
  const runs = [...svg.matchAll(/h(\d+)/g)].reduce((a, m) => a + +m[1], 0);
  const dark = modules.flat().filter(Boolean).length;
  assert.equal(runs, dark);
});
