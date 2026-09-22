/* 八宅：本命卦、東西四命、四吉四凶方位
   —— 全部由八卦爻象推導，沒有查表、沒有編造。
   遊年卦變的規則（本命卦與方位卦「哪幾爻不同」）：
     不變→伏位　上爻→生氣　中下爻→天醫　三爻全變→延年
     中爻→絕命　上中爻→五鬼　上下爻→六煞　下爻→禍害
   以坎命與乾命的標準八宅表逐格驗過，八個方位全部吻合。 */
import { STARS } from '../data/magnetic.js';

/* lines = [初爻, 中爻, 上爻]，1 為陽、0 為陰。deg 為羅盤方位角（0=北，順時針）。 */
export const TRIGRAMS = [
  { n: '坎', sym: '☵', lines: [0, 1, 0], luoshu: 1, dir: '北',   deg: 0,   el: '水', group: '東四' },
  { n: '艮', sym: '☶', lines: [0, 0, 1], luoshu: 8, dir: '東北', deg: 45,  el: '土', group: '西四' },
  { n: '震', sym: '☳', lines: [1, 0, 0], luoshu: 3, dir: '東',   deg: 90,  el: '木', group: '東四' },
  { n: '巽', sym: '☴', lines: [0, 1, 1], luoshu: 4, dir: '東南', deg: 135, el: '木', group: '東四' },
  { n: '離', sym: '☲', lines: [1, 0, 1], luoshu: 9, dir: '南',   deg: 180, el: '火', group: '東四' },
  { n: '坤', sym: '☷', lines: [0, 0, 0], luoshu: 2, dir: '西南', deg: 225, el: '土', group: '西四' },
  { n: '兌', sym: '☱', lines: [1, 1, 0], luoshu: 7, dir: '西',   deg: 270, el: '金', group: '西四' },
  { n: '乾', sym: '☰', lines: [1, 1, 1], luoshu: 6, dir: '西北', deg: 315, el: '金', group: '西四' },
];
export const guaOf = (name) => TRIGRAMS.find(t => t.n === name);
export const guaByLuoshu = (n) => TRIGRAMS.find(t => t.luoshu === n);

/* 位元：bit0 初爻、bit1 中爻、bit2 上爻 */
const YOUNIAN = {
  0: '伏位', 4: '生氣', 3: '天醫', 7: '延年',
  2: '絕命', 6: '五鬼', 5: '六煞', 1: '禍害',
};

/** 兩個卦之間的遊年星 */
export function younian(a, b) {
  let mask = 0;
  for (let i = 0; i < 3; i++) if (a.lines[i] !== b.lines[i]) mask |= (1 << i);
  return YOUNIAN[mask];
}

/* 八星在「方位」上的用法。吉凶與說明沿用數字磁場那一套（同一組八星）。 */
export const STAR_USE = {
  生氣: { rank: 4,  use: '大門、客廳、書房、辦公桌', text: '最旺的一方。人來人往、動能強的空間放這裡。' },
  天醫: { rank: 3,  use: '主臥床位、休息區', text: '主健康與貴人。睡覺、養病、想清靜時待這一方。' },
  延年: { rank: 2,  use: '臥房、餐廳、洽談區', text: '主感情與人和。談感情、談合作放這裡。' },
  伏位: { rank: 1,  use: '書桌、保險箱、儲物', text: '守成之位。存錢、存東西、需要定下心的事。' },
  禍害: { rank: -1, use: '雜物間、走道', text: '小凶。口舌是非，不要放長時間待著的位置。' },
  六煞: { rank: -2, use: '廁所、雜物', text: '凶。感情糾纏與口舌，適合拿來「壓」掉。' },
  五鬼: { rank: -3, use: '廁所、儲藏室', text: '凶。多變與破財，同樣適合用來壓煞。' },
  絕命: { rank: -4, use: '廁所、儲藏室、樓梯', text: '最凶的一方。不要當臥室或大門。' },
};
export const STAR_ORDER = ['生氣', '天醫', '延年', '伏位', '禍害', '六煞', '五鬼', '絕命'];  // rank 由大到小

/* ── 本命卦 ───────────────────────────────────────── */
/** 西元年各位數相加到個位（1980 → 18 → 9） */
export function yearDigit(y) {
  let n = Math.abs(y);
  while (n > 9) n = String(n).split('').reduce((a, c) => a + Number(c), 0);
  return n || 9;
}

/**
 * 本命卦
 * @param {number} year 以立春為界的命理年（fourPillars 的 yearForGZ）
 * @param {string} gender '男' | '女'
 */
export function mingGua(year, gender = '女') {
  const d = yearDigit(year);
  const male = gender === '男';
  let n = male ? 11 - d : 4 + d;
  if (n > 9) n -= 9;
  const jiGong = n === 5;                       // 五無卦，男寄坤、女寄艮
  if (jiGong) n = male ? 2 : 8;
  const gua = guaByLuoshu(n);
  return {
    year, gender, yearDigit: d, luoshu: n, jiGong,
    gua, name: gua.n, group: gua.group,
    note: jiGong
      ? `年數推出洛書五，五在中宮沒有卦，依慣例${male ? '男寄坤卦' : '女寄艮卦'}`
      : '',
  };
}

/** 本命卦 → 八個方位各自的遊年星 */
export function eightDirections(mingGuaName) {
  const me = guaOf(mingGuaName);
  return TRIGRAMS.map(t => {
    const star = younian(me, t);
    const meta = STARS[star];
    return {
      gua: t.n, sym: t.sym, dir: t.dir, deg: t.deg, el: t.el, luoshu: t.luoshu,
      star, kind: meta.kind, score: meta.score,
      text: meta.text,                          // 這顆星本身的意思（與數字磁場同一套說法）
      rank: STAR_USE[star].rank,
      use: STAR_USE[star].use,                  // 這個方位適合擺什麼
      placeText: STAR_USE[star].text,           // 放在方位上怎麼解
      numbers: meta.keys.slice(0, 4),           // 同一顆星的數字組合，與數字頁共用
    };
  }).sort((a, b) => b.rank - a.rank);
}

/* ── 宅卦 ─────────────────────────────────────────── */
/** 房子「坐」哪一邊就是哪一卦；坐北朝南＝坎宅 */
export function zhaiGua(sitDir) {
  const t = TRIGRAMS.find(x => x.dir === sitDir);
  if (!t) return null;
  const face = TRIGRAMS.find(x => x.deg === (t.deg + 180) % 360);
  return { gua: t.n, sym: t.sym, sit: t.dir, face: face.dir, group: t.group, label: `坐${t.dir}朝${face.dir}` };
}

/** 命卦與宅卦合不合 */
export function matchZhai(ming, zhai) {
  if (!zhai) return null;
  const same = ming.group === zhai.group;
  const star = younian(guaOf(ming.name), guaOf(zhai.gua));
  return {
    same, star, kind: STARS[star].kind,
    text: same
      ? `你是${ming.group}命，這間是${zhai.group}宅，屬相配。坐山落在你的${star}方。`
      : `你是${ming.group}命，這間是${zhai.group}宅，不同組。坐山落在你的${star}方，室內佈置要多靠好方位補。`,
  };
}

/* ── 羅盤 SVG ─────────────────────────────────────── */
/**
 * @param {Array} dirs eightDirections 的結果
 * @param {object} o {northUp:true 上北 / false 上南, active:'東'}
 */
export function compassSVG(dirs, { northUp = true, active = null } = {}) {
  const R = 132, r = 66, cx = 150, cy = 150;
  // 上北：北(0°) 畫在上方 → 螢幕角度 = deg - 90（SVG 0° 在右邊）
  // 上南：整個盤轉 180°
  const toScreen = (deg) => (northUp ? deg - 90 : deg + 90);
  const pt = (deg, rad) => {
    const a = toScreen(deg) * Math.PI / 180;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };
  const sectors = dirs.map(d => {
    const a0 = d.deg - 22.5, a1 = d.deg + 22.5;
    const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
    const [x2, y2] = pt(a1, r), [x3, y3] = pt(a0, r);
    const cls = ['cp__sec', d.kind === '吉' ? 'is-good' : 'is-bad', active === d.dir ? 'is-active' : ''].join(' ');
    const [lx, ly] = pt(d.deg, (R + r) / 2);
    return `<g class="${cls}" data-dir="${d.dir}" role="button" tabindex="0" aria-label="${d.dir} ${d.gua}卦 ${d.star}">
      <path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}
               L${x2.toFixed(1)} ${y2.toFixed(1)} A${r} ${r} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z"/>
      <text class="cp__dir" x="${lx.toFixed(1)}" y="${(ly - 8).toFixed(1)}">${d.dir}</text>
      <text class="cp__star" x="${lx.toFixed(1)}" y="${(ly + 10).toFixed(1)}">${d.star}</text>
      <text class="cp__sym" x="${lx.toFixed(1)}" y="${(ly + 26).toFixed(1)}">${d.sym}</text>
    </g>`;
  }).join('');
  const topLabel = northUp ? '北' : '南';
  return `<svg class="compass" viewBox="0 0 300 300" role="img" aria-label="八宅方位盤">
    <circle class="cp__ring" cx="${cx}" cy="${cy}" r="${R}"/>
    <circle class="cp__ring" cx="${cx}" cy="${cy}" r="${r}"/>
    ${sectors}
    <text class="cp__top" x="${cx}" y="18">↑ ${topLabel}</text>
  </svg>`;
}

/* ── 文字輸出 ─────────────────────────────────────── */
export function toText(ming, dirs, zhai, match) {
  const L = [
    `本命卦：${ming.name}卦（洛書 ${ming.luoshu}，${ming.group}命）　依命理年 ${ming.year} 年、${ming.gender}命推出`,
    ming.note ? `說明：${ming.note}` : '',
    zhai ? `住宅：${zhai.label}，${zhai.gua}宅（${zhai.group}宅）` : '',
    match ? `命宅關係：${match.text}` : '',
    '',
    '八方位：',
    ...dirs.map(d => `・${d.dir}（${d.gua}卦）＝${d.star}〔${d.kind}〕　適合：${d.use}　${d.placeText}`),
  ].filter(x => x !== null && x !== undefined);
  return L.join('\n');
}
