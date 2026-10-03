/* 神社各處的插圖（自繪 SVG）。顏色吃 .jinja / .jn-scope 上的那組代幣：
   朱 --shu、墨 --sumi、金 --gold、木 --wood-*、石 --stone-*、和紙 --washi。
   畫的順序就是遠近：後畫的蓋住先畫的。 */

const shu = 'var(--shu)', sumi = 'var(--sumi)', gold = 'var(--gold)';

/** 紙垂（之字形的白紙），掛在注連繩上 */
const shide = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})"
  d="M0 0h6v8h6v8h-6v8h6v8H0v-8h-6v-8h6V8h-6V0Z" fill="#f6f1e4" stroke="#d8cfb6" stroke-width=".6"/>`;

/** 注連繩：粗麻繩，兩端細、中間粗，上面斜斜的紋 */
const shimenawa = (x1, x2, y) => {
  const mid = (x1 + x2) / 2;
  return `<path d="M${x1} ${y}Q${mid} ${y + 26} ${x2} ${y}Q${mid} ${y + 6} ${x1} ${y}Z" fill="#d9c08a"/>
  <path d="M${x1} ${y}Q${mid} ${y + 26} ${x2} ${y}" fill="none" stroke="#a88c55" stroke-width="2"/>
  ${Array.from({ length: 12 }, (_, i) => { const x = x1 + (x2 - x1) * (i + .5) / 12; const yy = y + 4 + 18 * Math.sin(Math.PI * (i + .5) / 12);
    return `<path d="M${x - 5} ${yy - 7}l10 10" stroke="#a88c55" stroke-width="1.6"/>`; }).join('')}`;
};

/** 拜殿正面：入母屋的屋頂、注連繩與紙垂、鈴、賽錢箱、台階 */
export const haiden = () => `
<svg class="jn-haiden" viewBox="0 0 360 300" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="hd-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f4f"/><stop offset="1" stop-color="#1c1f29"/></linearGradient>
    <linearGradient id="hd-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--wood-hi)"/><stop offset="1" stop-color="var(--wood-lo)"/></linearGradient>
  </defs>
  <!-- 屋頂：兩端翹起的曲線，屋脊上有千木與鰹木 -->
  <path d="M8 96Q60 88 110 50H250Q300 88 352 96L340 108Q180 92 20 108Z" fill="url(#hd-roof)"/>
  <path d="M108 50h144l-6-10H114Z" fill="#2a2e3a"/>
  <path d="M120 40 106 18M240 40l14-22" stroke="${gold}" stroke-width="4" stroke-linecap="round"/>
  ${[150, 170, 190, 210].map(x => `<rect x="${x - 6}" y="32" width="12" height="7" rx="3" fill="${gold}"/>`).join('')}
  <path d="M20 108Q180 92 340 108" fill="none" stroke="${gold}" stroke-width="1.6" opacity=".6"/>
  <!-- 柱與牆 -->
  <rect x="44" y="104" width="12" height="150" fill="${shu}"/><rect x="304" y="104" width="12" height="150" fill="${shu}"/>
  <rect x="124" y="104" width="10" height="150" fill="${shu}"/><rect x="226" y="104" width="10" height="150" fill="${shu}"/>
  <rect x="56" y="112" width="68" height="142" fill="#2a1d18"/><rect x="236" y="112" width="68" height="142" fill="#2a1d18"/>
  <rect x="134" y="112" width="92" height="142" fill="#140f0e"/>
  <!-- 格子門 -->
  ${Array.from({ length: 7 }, (_, i) => `<path d="M${60 + i * 10} 116v134M${240 + i * 10} 116v134" stroke="#5a3f2c" stroke-width="1.2"/>`).join('')}
  ${Array.from({ length: 9 }, (_, i) => `<path d="M58 ${124 + i * 15}h64M238 ${124 + i * 15}h64" stroke="#5a3f2c" stroke-width="1.2"/>`).join('')}
  <!-- 內陣的燈光 -->
  <ellipse cx="180" cy="200" rx="40" ry="50" fill="var(--gold)" opacity=".12"/>
  <!-- 注連繩＋紙垂 -->
  ${shimenawa(110, 250, 112)}
  ${shide(140, 128, .8)}${shide(178, 132, .8)}${shide(216, 128, .8)}
  <!-- 台階 -->
  <path d="M30 254h300v10H30ZM20 264h320v10H20ZM10 274h340v12H10Z" fill="var(--stone-hi)"/>
  <path d="M30 264h300M20 274h320" stroke="var(--stone-lo)" stroke-width="1.4"/>
</svg>`;

/** 手水舍：屋頂、石造的水盤、竹子做的出水口、橫放的柄杓 */
export const temizuya = () => `
<svg class="jn-temizuya" viewBox="0 0 360 250" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="tz-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--stone-hi)"/><stop offset="1" stop-color="var(--stone-lo)"/></linearGradient>
    <linearGradient id="tz-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e8fb8"/><stop offset="1" stop-color="#1d3550"/></linearGradient>
  </defs>
  <path d="M10 60Q90 50 130 20H230Q270 50 350 60L340 72Q180 56 20 72Z" fill="#2c303c"/>
  <rect x="40" y="70" width="10" height="160" fill="var(--wood-lo)"/><rect x="310" y="70" width="10" height="160" fill="var(--wood-lo)"/>
  <!-- 竹的出水口 -->
  <path d="M250 104h70v14h-70Z" fill="#7d9b5a"/><path d="M262 104v14M300 104v14" stroke="#5c7a40" stroke-width="2"/>
  <path d="M250 104q-10 0-12 8l12 6Z" fill="#9db877"/>
  <!-- 水盤 -->
  <path d="M60 150h240l-10 70H70Z" fill="url(#tz-stone)"/>
  <rect x="54" y="140" width="252" height="16" rx="3" fill="var(--stone-hi)"/>
  <rect x="66" y="145" width="228" height="8" rx="2" fill="url(#tz-water)"/>
  <text x="180" y="206" class="jn-tz__label">洗 心</text>
  <!-- 柄杓架 -->
  <rect x="80" y="128" width="200" height="4" rx="2" fill="#7d9b5a"/>
</svg>`;

/** 柄杓（可以拿起來的那一支） */
export const ladle = () => `
<svg class="jn-ladle" viewBox="0 0 160 50" aria-hidden="true" focusable="false">
  <rect x="34" y="20" width="124" height="6" rx="3" fill="#e5d3a6" stroke="#b49a63" stroke-width=".8"/>
  <path d="M4 10h34v26q0 8-8 8H12q-8 0-8-8Z" fill="#e9d9b0" stroke="#b49a63" stroke-width="1"/>
  <path d="M4 16h34" stroke="#b49a63" stroke-width="1"/>
  <path class="jn-ladle__water" d="M6 18h30v16q0 7-7 7H13q-7 0-7-7Z" fill="#6aa2cf" opacity="0"/>
</svg>`;

/** 手（左或右）：手掌朝上 */
export const hand = (side = 'L') => `
<svg class="jn-hand jn-hand--${side}" viewBox="0 0 80 90" aria-hidden="true" focusable="false"
  style="${side === 'R' ? 'transform:scaleX(-1)' : ''}">
  <path d="M20 86V52q-14-6-14-20 0-6 6-6 5 0 8 8l2 6V14q0-6 6-6t6 6v24h2V8q0-6 6-6t6 6v30h2V12q0-6 6-6t6 6v28h2V20q0-6 6-6t6 6v32q0 20-16 30v4Z"
    fill="#f1d9bd" stroke="#c9a684" stroke-width="1.4"/>
</svg>`;

/** 嘴（漱口的目標） */
export const mouth = () => `
<svg class="jn-mouth" viewBox="0 0 80 50" aria-hidden="true" focusable="false">
  <path d="M8 22Q40 4 72 22Q40 46 8 22Z" fill="#d98b84" stroke="#a65c55" stroke-width="1.4"/>
  <path d="M10 22Q40 28 70 22" stroke="#a65c55" stroke-width="1.2" fill="none"/>
</svg>`;

/** 石燈籠，裡面點著火 */
export const lantern = () => `
<svg class="jn-lantern" viewBox="0 0 40 90" aria-hidden="true" focusable="false">
  <path d="M6 18 20 6l14 12Z" fill="var(--stone-hi)"/>
  <rect x="10" y="18" width="20" height="20" fill="var(--stone-lo)"/>
  <rect x="14" y="22" width="12" height="12" fill="#ffd27a" class="jn-lantern__fire"/>
  <rect x="8" y="38" width="24" height="5" fill="var(--stone-hi)"/>
  <rect x="16" y="43" width="8" height="34" fill="var(--stone-lo)"/>
  <rect x="8" y="77" width="24" height="8" rx="1" fill="var(--stone-hi)"/>
</svg>`;

/** 境內遠景：參道、兩排燈籠、盡頭的拜殿剪影 */
export const grounds = () => `
<svg class="jn-grounds" viewBox="0 0 360 230" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="gr-path" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3f4c"/><stop offset="1" stop-color="#6b6f7a"/></linearGradient>
    <radialGradient id="gr-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
  </defs>
  <!-- 森林的剪影 -->
  <path d="M0 120Q30 70 60 110Q80 60 110 100Q140 50 170 96Q200 46 230 96Q260 56 290 104Q320 64 360 116V160H0Z" fill="#0d1424"/>
  <!-- 拜殿剪影 -->
  <path d="M120 112Q150 106 165 86H195Q210 106 240 112L236 118H124Z" fill="#20242f"/>
  <rect x="136" y="116" width="88" height="34" fill="#1a1612"/>
  <rect x="160" y="122" width="40" height="28" fill="#ffd27a" opacity=".22"/>
  <!-- 參道：往遠處收窄的石板路 -->
  <path d="M160 150h40l70 80H90Z" fill="url(#gr-path)"/>
  ${Array.from({ length: 6 }, (_, i) => { const y = 156 + i * 13 + i * i * .9; const w = 22 + i * 14; return `<path d="M${180 - w} ${y}h${w * 2}" stroke="#2b2e38" stroke-width="1.2"/>`; }).join('')}
  <!-- 兩排燈籠的光暈（燈籠本體用 HTML 疊上去，比較好控制大小） -->
  ${[[130, 160, 18], [230, 160, 18], [108, 190, 26], [252, 190, 26]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#gr-glow)"/>`).join('')}
</svg>`;

/** 授與所的櫃台＋籤棚的外框（抽屜是 HTML 疊上去的，才點得到） */
export const juyosho = () => `
<svg class="jn-juyosho" viewBox="0 0 360 120" aria-hidden="true" focusable="false">
  <path d="M0 40Q90 30 130 4H230Q270 30 360 40L352 50Q180 36 8 50Z" fill="#2c303c"/>
  <rect x="0" y="48" width="360" height="8" fill="${shu}"/>
  <path d="M30 56h300" stroke="${gold}" stroke-width="1" opacity=".5"/>
  <text x="180" y="96" class="jn-juyo__t">授 與 所</text>
</svg>`;

/** 硬幣。kind = 5 / 10 / 50 / 100 / 500（自己畫的示意，不是照真幣描） */
export const COINS = [
  { k: 5,   name: '五圓',   say: '「ご縁」—— 求一個好緣分', fill: ['#f6dc8a', '#c79a35', '#8e6a1f'], hole: true },
  { k: 10,  name: '十圓',   say: '最常見的一枚',               fill: ['#f0b38a', '#b56a3a', '#7a3f1d'] },
  { k: 50,  name: '五十圓', say: '中間有孔，「見通しがよい」', fill: ['#ffffff', '#cfd3da', '#8b9099'], hole: true },
  { k: 100, name: '百圓',   say: '這一枚最剛好',               fill: ['#ffffff', '#cfd3da', '#8b9099'] },
  { k: 500, name: '五百圓', say: '「これ以上の硬貨（効果）はない」', fill: ['#fff1c2', '#d6b45c', '#8a6d2a'] },
];
export function coinSVG(k = 100) {
  const c = COINS.find(x => x.k === k) || COINS[3];
  const id = `cg${k}`;
  return `<svg class="jn-coin" viewBox="0 0 60 60" aria-hidden="true" focusable="false">
    <defs><radialGradient id="${id}" cx=".35" cy=".3" r=".85">
      <stop offset="0" stop-color="${c.fill[0]}"/><stop offset=".5" stop-color="${c.fill[1]}"/><stop offset="1" stop-color="${c.fill[2]}"/>
    </radialGradient></defs>
    <circle cx="30" cy="30" r="28" fill="url(#${id})" stroke="${c.fill[2]}" stroke-width="1.2"/>
    <circle cx="30" cy="30" r="23" fill="none" stroke="${c.fill[2]}" stroke-opacity=".5" stroke-width=".8" stroke-dasharray="1 1.6"/>
    ${c.hole ? `<circle cx="30" cy="30" r="6" fill="var(--hole, #0b1030)" stroke="${c.fill[2]}" stroke-width="1"/>
      <text x="30" y="49" class="jn-coin__v" fill="${c.fill[2]}">${k}</text>`
      : `<text x="30" y="35" class="jn-coin__v jn-coin__v--big" fill="${c.fill[2]}">${k}</text>`}
  </svg>`;
}

/** 御朱印：墨書（奉拜、星宮神社、日期）＋兩顆朱印 */
const col = (t) => [...t].map(c => `<i>${c}</i>`).join('');   // 直書一字一格（不用 writing-mode）
export function goshuin(date) {
  return `<div class="jn-goshuin">
    <span class="jn-gs__col jn-gs__col--r">${col('奉拜')}</span>
    <span class="jn-gs__seal jn-gs__seal--sq" aria-hidden="true">
      <svg viewBox="0 0 80 80"><rect x="4" y="4" width="72" height="72" rx="4" fill="none" stroke="${shu}" stroke-width="4"/>
      <text x="40" y="36" class="jn-gs__st">星宮</text><text x="40" y="64" class="jn-gs__st">之印</text></svg>
    </span>
    <span class="jn-gs__col jn-gs__col--m">${col('星宮神社')}</span>
    <span class="jn-gs__seal jn-gs__seal--rd" aria-hidden="true">
      <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="none" stroke="${shu}" stroke-width="3"/>
      <path d="M30 14Q30 30 46 30Q30 30 30 46Q30 30 14 30Q30 30 30 14Z" fill="${shu}"/></svg>
    </span>
    <span class="jn-gs__col jn-gs__col--l">${col(date)}</span>
  </div>`;
}
