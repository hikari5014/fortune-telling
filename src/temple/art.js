/* 廟的插圖（自繪 SVG）：廟宇正面、神龕、供桌、香爐、供品。
   顏色吃 .miao / .mz-scope 上的代幣：
   --vermil（朱紅柱）、--tile（屋瓦）、--gold、--ink（墨）、--wood、--bronze。
   神明本身不畫成人像 —— 用神位（牌位）與光來表示「神明在這裡」，
   一方面是對神明的尊重，一方面自己畫的神像只會顯得廉價。 */

const gold = 'var(--gold)';

/** 廟宇正面：燕尾脊、剪黏雙龍搶珠、匾額、門釘大門、紅燈籠、天公爐 */
export const facade = () => `
<svg class="mz-facade" viewBox="0 0 360 300" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="mz-tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4643a"/><stop offset="1" stop-color="#8f3218"/></linearGradient>
    <linearGradient id="mz-col" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7e1c14"/><stop offset=".5" stop-color="#c3362a"/><stop offset="1" stop-color="#7e1c14"/></linearGradient>
    <radialGradient id="mz-lan" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ff9a6a"/><stop offset=".6" stop-color="#d6302a"/><stop offset="1" stop-color="#8a1a14"/></radialGradient>
    <linearGradient id="mz-bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b48a4a"/><stop offset="1" stop-color="#5e4220"/></linearGradient>
  </defs>
  <!-- 燕尾脊：屋脊兩端往上翹、尾巴分岔 -->
  <path d="M40 74Q180 60 320 74L332 52Q340 46 346 50L338 70 350 66 336 84Q180 70 24 84L10 66 22 70 14 50Q20 46 28 52Z" fill="#2f6b4f"/>
  <path d="M40 74Q180 60 320 74" fill="none" stroke="${gold}" stroke-width="1.6"/>
  <!-- 雙龍搶珠（剪黏，簡化成兩條金色的捲曲）-->
  <path d="M120 62q10-16 26-8t22-2" fill="none" stroke="${gold}" stroke-width="3" stroke-linecap="round"/>
  <path d="M240 62q-10-16-26-8t-22-2" fill="none" stroke="${gold}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="180" cy="46" r="7" fill="#ffd27a"/><path d="M180 30q4 8 0 9-4-1 0-9Z" fill="#ff8a3a"/>
  <!-- 主屋頂 -->
  <path d="M24 84Q180 70 336 84L300 128H60Z" fill="url(#mz-tile)"/>
  ${Array.from({ length: 13 }, (_, i) => `<path d="M${72 + i * 18} ${80 - Math.abs(6 - i) * .3}L${66 + i * 19.5} 128" stroke="#7a2a12" stroke-width="1.2" opacity=".6"/>`).join('')}
  <path d="M60 128h240" stroke="${gold}" stroke-width="2"/>
  <!-- 簷下：斗栱的金色橫帶 -->
  <rect x="64" y="128" width="232" height="12" fill="#1f3c5a"/>
  ${Array.from({ length: 14 }, (_, i) => `<rect x="${70 + i * 16.4}" y="130" width="8" height="8" rx="1" fill="${gold}" opacity=".8"/>`).join('')}
  <!-- 柱與牆 -->
  <rect x="70" y="140" width="14" height="118" fill="url(#mz-col)"/><rect x="276" y="140" width="14" height="118" fill="url(#mz-col)"/>
  <rect x="120" y="140" width="12" height="118" fill="url(#mz-col)"/><rect x="228" y="140" width="12" height="118" fill="url(#mz-col)"/>
  <rect x="84" y="140" width="36" height="118" fill="#3b2a24"/><rect x="240" y="140" width="36" height="118" fill="#3b2a24"/>
  <!-- 匾額 -->
  <rect x="146" y="144" width="68" height="24" rx="2" fill="#13233d" stroke="${gold}" stroke-width="1.6"/>
  <text x="180" y="161" class="mz-plaque">玄鑑宮</text>
  <!-- 大門：門釘 -->
  <rect x="132" y="172" width="96" height="86" fill="#b0281f"/>
  <path d="M180 172v86" stroke="#6e140e" stroke-width="2"/>
  ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 4 }, (_, c) =>
    `<circle cx="${140 + c * 11}" cy="${182 + r * 15}" r="2.4" fill="${gold}"/><circle cx="${188 + c * 11}" cy="${182 + r * 15}" r="2.4" fill="${gold}"/>`).join('')).join('')}
  <circle cx="172" cy="216" r="4" fill="none" stroke="${gold}" stroke-width="1.6"/><circle cx="188" cy="216" r="4" fill="none" stroke="${gold}" stroke-width="1.6"/>
  <!-- 紅燈籠 -->
  ${[100, 260].map(x => `<path d="M${x} 140v8" stroke="${gold}" stroke-width="1.4"/>
    <ellipse cx="${x}" cy="164" rx="13" ry="16" fill="url(#mz-lan)" class="mz-lantern"/>
    <rect x="${x - 6}" y="146" width="12" height="4" fill="${gold}"/><rect x="${x - 6}" y="178" width="12" height="4" fill="${gold}"/>
    <path d="M${x - 3} 182v8M${x} 182v10M${x + 3} 182v8" stroke="#e6b04a" stroke-width="1.2"/>`).join('')}
  <!-- 台階 -->
  <path d="M40 258h280v10H40ZM28 268h304v10H28ZM16 278h328v12H16Z" fill="#8b8e98"/>
  <path d="M40 268h280M28 278h304" stroke="#4c4f59" stroke-width="1.2"/>
</svg>`;

/** 天公爐：三腳兩耳的青銅爐（插香的地方）。煙是 HTML 疊上去的，比較好做動畫 */
export const censer = () => `
<svg class="mz-censer" viewBox="0 0 120 90" aria-hidden="true" focusable="false">
  <path d="M22 40h76l-6 26q-2 8-10 8H38q-8 0-10-8Z" fill="url(#mz-bronze2)"/>
  <defs><linearGradient id="mz-bronze2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c49a58"/><stop offset="1" stop-color="#5a3e1e"/></linearGradient></defs>
  <rect x="16" y="34" width="88" height="8" rx="3" fill="#a7814a"/>
  <path d="M16 38q-10 0-10-10h8q0 4 4 4M104 38q10 0 10-10h-8q0 4-4 4" fill="none" stroke="#a7814a" stroke-width="4"/>
  <path d="M38 74l-6 14M60 74v14M82 74l6 14" stroke="#5a3e1e" stroke-width="5" stroke-linecap="round"/>
  <path d="M40 54h40" stroke="#e1c27e" stroke-width="1.2" opacity=".6"/>
  <ellipse cx="60" cy="36" rx="40" ry="4" fill="#3a2a18"/>
</svg>`;

/** 神龕：拱形的龕，金色雕花框；神位與布幔用 HTML 疊（要能動） */
export const niche = () => `
<svg class="mz-niche" viewBox="0 0 300 260" aria-hidden="true" focusable="false">
  <defs><radialGradient id="mz-glow" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#ffd98a" stop-opacity=".5"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>
  <path d="M30 250V100Q30 20 150 20T270 100V250Z" fill="#2a120e"/>
  <path d="M30 250V100Q30 20 150 20T270 100V250" fill="none" stroke="${gold}" stroke-width="6"/>
  <path d="M44 250V104Q44 36 150 36T256 104V250" fill="none" stroke="${gold}" stroke-width="1.5" opacity=".7"/>
  ${Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (i + 1) / 10; return `<circle cx="${150 - 120 * Math.cos(a)}" cy="${100 - 80 * Math.sin(a)}" r="3" fill="${gold}"/>`; }).join('')}
  <ellipse class="mz-niche__glow" cx="150" cy="150" rx="120" ry="110" fill="url(#mz-glow)"/>
</svg>`;

/** 供桌：紅漆長桌，金邊，兩支紅燭（火焰用 HTML 疊） */
export const altarTable = () => `
<svg class="mz-table" viewBox="0 0 320 90" aria-hidden="true" focusable="false">
  <rect x="6" y="10" width="308" height="14" rx="2" fill="#8f1f16"/>
  <rect x="6" y="10" width="308" height="3" fill="${gold}" opacity=".8"/>
  <path d="M20 24h280v52H20Z" fill="#6e1610"/>
  <path d="M30 34h260v32H30Z" fill="none" stroke="${gold}" stroke-width="1.4" opacity=".7"/>
  <text x="82" y="57" class="mz-table__t">誠　心</text><text x="238" y="57" class="mz-table__t">敬　奉</text>
  ${[34, 286].map(x => `<rect x="${x - 4}" y="-26" width="8" height="34" rx="2" fill="#c3241c"/><rect x="${x - 6}" y="6" width="12" height="4" fill="${gold}"/>`).join('')}
</svg>`;

/* ── 供品：每樣一個 48×48 的小圖 ───────────────────────── */
const O = {
  scallion: '<path d="M18 44V14M24 44V8M30 44V14" stroke="#4f9a4a" stroke-width="4" stroke-linecap="round"/><path d="M16 44h16v4H16Z" fill="#f2efe2"/><path d="M17 36h14v8H17Z" fill="#f2efe2"/>',
  celery: '<path d="M16 46q2-18 4-30M24 46V12M32 46q-2-18-4-30" stroke="#8cc163" stroke-width="5" stroke-linecap="round"/><circle cx="20" cy="12" r="5" fill="#5f9c3e"/><circle cx="28" cy="9" r="5" fill="#5f9c3e"/><circle cx="24" cy="14" r="4" fill="#4f8a32"/>',
  garlic: '<path d="M24 10q-14 10-12 24 2 10 12 10t12-10q2-14-12-24Z" fill="#f4efe4" stroke="#cfc6b0" stroke-width="1.2"/><path d="M24 12v30M18 18q-2 12 2 24M30 18q2 12-2 24" stroke="#d8cfba" stroke-width="1.2" fill="none"/><path d="M24 4v8" stroke="#9aa86a" stroke-width="2"/>',
  radish: '<path d="M14 18q10-4 20 0-2 18-10 28-8-10-10-28Z" fill="#f6f2e8" stroke="#d9d2bf" stroke-width="1"/><path d="M18 18q-4-10 2-14 2 6 4 14M28 18q4-10-2-14-2 6-4 14" fill="#5f9c3e"/>',
  zongzi: '<path d="M8 38 24 8l16 30Z" fill="#6f9a3e" stroke="#4d7428" stroke-width="1.4"/><path d="M12 30h24M16 22h16" stroke="#e8d79a" stroke-width="2.4"/>',
  bun: '<path d="M8 34q0-18 16-18t16 18q0 6-16 6T8 34Z" fill="#fbf4e6" stroke="#ddd0b4" stroke-width="1.2"/><path d="M18 22q6 6 12 0M24 18v6" stroke="#d9c9a6" stroke-width="1.4" fill="none"/>',
  pineapple: '<path d="M16 22q8-6 16 0 4 12 0 20-8 6-16 0-4-8 0-20Z" fill="#e7b33f" stroke="#b37f1e" stroke-width="1.2"/><path d="M17 26l14 12M31 26 17 38M16 32h16" stroke="#b37f1e" stroke-width="1" opacity=".7"/><path d="M24 22q-8-10-6-18 4 6 6 10 2-4 6-10 2 8-6 18Z" fill="#4f9a4a"/>',
  orange: '<circle cx="24" cy="28" r="14" fill="#f59a2c" stroke="#c46f12" stroke-width="1.2"/><circle cx="19" cy="23" r="3" fill="#ffd08a" opacity=".7"/><path d="M24 14q4-6 10-6-2 6-10 6Z" fill="#4f9a4a"/>',
  apple: '<path d="M24 16q-14-6-16 10 0 16 16 18 16-2 16-18-2-16-16-10Z" fill="#d93a2e" stroke="#9e2219" stroke-width="1.2"/><path d="M24 16q0-6 4-10" stroke="#6b4a2a" stroke-width="2" fill="none"/><path d="M26 10q6-4 10 0-6 4-10 0Z" fill="#4f9a4a"/>',
  flowers: '<path d="M24 46V26M18 46l4-14M30 46l-4-14" stroke="#4f9a4a" stroke-width="2"/>' + [[24, 16, '#f08bb0'], [15, 22, '#f6d04d'], [33, 22, '#e85d4a']].map(([x, y, c]) => `<g transform="translate(${x} ${y})">${Array.from({ length: 5 }, (_, i) => `<ellipse cx="0" cy="-4" rx="3" ry="4.5" fill="${c}" transform="rotate(${i * 72})"/>`).join('')}<circle r="2.4" fill="#fff3c4"/></g>`).join(''),
  tea: '<path d="M10 22h24v10q0 10-12 10T10 32Z" fill="#f2efe2" stroke="#c8bfa6" stroke-width="1.2"/><path d="M34 26q8 0 6 6-2 4-6 3" fill="none" stroke="#c8bfa6" stroke-width="2"/><ellipse cx="22" cy="22" rx="12" ry="3" fill="#b88a3a"/><path d="M18 16q2-4 0-8M24 16q2-4 0-8" stroke="#d8d2c4" stroke-width="1.4" fill="none" opacity=".7"/>',
  cake: '<path d="M8 30q16-8 32 0v10q-16 6-32 0Z" fill="#f3d9a3" stroke="#c9a868" stroke-width="1.2"/><path d="M8 30q16 8 32 0" fill="#f7e6c0" stroke="#c9a868" stroke-width="1"/><circle cx="24" cy="30" r="3" fill="#d9382c"/>',
  fagao: '<path d="M10 40q-2-14 14-16 16 2 14 16Z" fill="#e8b3a0" stroke="#c07f6a" stroke-width="1.2"/><path d="M14 30q4-10 10-6 6-4 10 6" fill="#f3cbbd" stroke="#c07f6a" stroke-width="1"/><path d="M18 26l6 4 6-4" stroke="#c07f6a" fill="none"/>',
  candy: '<rect x="14" y="18" width="20" height="12" rx="6" fill="#e84a5f"/><path d="M14 24l-8-6v12ZM34 24l8-6v12Z" fill="#f6c94a"/><path d="M20 18v12M28 18v12" stroke="#fff" stroke-width="1.4" opacity=".6"/>',
  dates: '<ellipse cx="17" cy="28" rx="7" ry="10" fill="#a8251c" transform="rotate(-20 17 28)"/><ellipse cx="31" cy="28" rx="7" ry="10" fill="#c0352a" transform="rotate(20 31 28)"/><ellipse cx="24" cy="34" rx="7" ry="9" fill="#8e1d15"/>',
  longan: '<circle cx="17" cy="30" r="8" fill="#b9874a"/><circle cx="31" cy="30" r="8" fill="#a97a3e"/><circle cx="24" cy="20" r="8" fill="#c99556"/><path d="M24 12v-6" stroke="#6b4a2a" stroke-width="1.6"/>',
  peach: '<path d="M24 12q-16 6-14 20 2 12 14 12t14-12q2-14-14-20Z" fill="#fbe7df" stroke="#e0b9aa" stroke-width="1.2"/><path d="M24 12q8 8 6 30" fill="#f29a92" opacity=".6"/><path d="M16 42q8-8 16 0" fill="#4f9a4a"/>',
  meat: '<path d="M10 30q0-14 16-14 14 0 14 10 0 14-18 16-12 0-12-12Z" fill="#b8574a" stroke="#7e2f25" stroke-width="1.2"/><path d="M16 26q8-4 16 0M18 32q6-2 12 0" stroke="#e6a597" stroke-width="2" fill="none"/>',
  wine: '<path d="M18 10h12v6l4 6v20q0 4-4 4H18q-4 0-4-4V22l4-6Z" fill="#f2efe2" stroke="#c8bfa6" stroke-width="1.2"/><rect x="16" y="26" width="16" height="10" fill="#d93a2e"/><text x="24" y="34" font-size="7" fill="#fff" text-anchor="middle">酒</text>',
  thread: '<path d="M8 30q8-14 16 0t16 0" fill="none" stroke="#d6302a" stroke-width="2.6"/><path d="M8 34q8-14 16 0t16 0" fill="none" stroke="#e5534a" stroke-width="1.4" opacity=".7"/>',
  meatball: '<circle cx="16" cy="30" r="7" fill="#c9905c" stroke="#8e5a2e" stroke-width="1.2"/><circle cx="30" cy="30" r="7" fill="#b98050" stroke="#8e5a2e" stroke-width="1.2"/><circle cx="23" cy="20" r="7" fill="#d29b66" stroke="#8e5a2e" stroke-width="1.2"/><path d="M8 38h32" stroke="#c8bfa6" stroke-width="2"/>',
  duckegg: '<ellipse cx="24" cy="28" rx="11" ry="14" fill="#dfeee6" stroke="#9fb8aa" stroke-width="1.2"/><ellipse cx="20" cy="22" rx="3" ry="4" fill="#fff" opacity=".7"/>',
  redturtle: '<ellipse cx="24" cy="28" rx="15" ry="12" fill="#d6302a" stroke="#9e2219" stroke-width="1.2"/><path d="M24 18l6 5-2 8h-8l-2-8Z M16 28h4M28 28h4M24 31v6" stroke="#f4a49a" stroke-width="1.4" fill="none"/>',
  waxapple: '<path d="M16 14h16q4 2 4 10 0 16-12 18-12-2-12-18 0-8 4-10Z" fill="#e2434b" stroke="#a62a30" stroke-width="1.2"/><path d="M20 14q4 4 8 0" stroke="#8a2228" stroke-width="1.6" fill="none"/><ellipse cx="20" cy="24" rx="2.4" ry="5" fill="#ff9aa0" opacity=".6"/>',
  copy: '<rect x="10" y="8" width="28" height="34" rx="2" fill="#f7f4ea" stroke="#c8bfa6" stroke-width="1.2"/><path d="M15 16h18M15 22h18M15 28h12" stroke="#8a8270" stroke-width="1.6"/><rect x="28" y="30" width="6" height="7" fill="#d93a2e"/>',
};
export const offeringSVG = (k) => `<svg class="mz-off" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${O[k] || O.flowers}</svg>`;
export const OFFERING_KEYS = Object.keys(O);

/** 神位（牌位）：紅底金邊，直書神號 */
export const tablet = (name) => `<div class="mz-tablet"><span class="mz-tablet__in">${[...name].map(c => `<i>${c}</i>`).join('')}</span></div>`;
