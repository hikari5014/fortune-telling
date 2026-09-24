/* 神社場景的插圖：鳥居、賽錢箱、鈴與鈴緒、百圓硬幣、御神籤箱、籤棒。
   全部自己畫的 SVG。顏色走頁面自己的一組代幣（styles/views.css 的 .jinja）：
   鳥居是朱、木頭是木色、金屬是金 —— 這一頁是整個 App 唯一允許出現朱色的地方，
   因為鳥居不是朱的就不是鳥居了。

   畫的順序就是遠近，後畫的蓋住先畫的。 */

/** 鳥居（明神鳥居：笠木兩端上翹、下有島木、中間貫與額束） */
export const torii = () => `
<svg class="jn-torii" viewBox="0 0 320 210" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="jn-shu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--shu-hi)"/><stop offset="1" stop-color="var(--shu)"/>
    </linearGradient>
    <linearGradient id="jn-pillar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="var(--shu-lo)"/><stop offset=".45" stop-color="var(--shu-hi)"/><stop offset="1" stop-color="var(--shu-lo)"/>
    </linearGradient>
  </defs>
  <!-- 柱：上窄下寬一點點，下面包一截黑的根卷 -->
  <path d="M72 58h16l3 142H69Z" fill="url(#jn-pillar)"/>
  <path d="M232 58h16l3 142h-22Z" fill="url(#jn-pillar)"/>
  <rect x="66" y="188" width="28" height="14" rx="2" fill="var(--sumi)"/>
  <rect x="226" y="188" width="28" height="14" rx="2" fill="var(--sumi)"/>
  <!-- 貫：穿過兩根柱子，兩端露出一截 -->
  <rect x="44" y="86" width="232" height="12" rx="1.5" fill="url(#jn-shu)"/>
  <!-- 額束與神額 -->
  <rect x="152" y="58" width="16" height="28" fill="url(#jn-shu)"/>
  <rect x="143" y="52" width="34" height="42" rx="2" fill="var(--sumi)" stroke="var(--gold)" stroke-width="1.4"/>
  <text x="160" y="69" class="jn-gaku">星</text><text x="160" y="87" class="jn-gaku">宮</text>
  <!-- 島木＋笠木：兩端上翹，最上面一道黑 -->
  <path d="M26 50Q160 36 294 50L290 60Q160 48 30 60Z" fill="url(#jn-shu)"/>
  <path d="M4 34Q34 42 160 30 286 42 316 34L310 48Q284 50 160 40 36 50 10 48Z" fill="url(#jn-shu)"/>
  <path d="M2 30Q34 38 160 26 286 38 318 30L316 36Q286 44 160 32 34 44 4 36Z" fill="var(--sumi)"/>
</svg>`;

/** 鈴與鈴緒：從上面垂下來，投完錢會晃 */
export const bell = () => `
<svg class="jn-bell" viewBox="0 0 60 170" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="jn-gold" cx=".35" cy=".3" r=".8">
      <stop offset="0" stop-color="#fff4c8"/><stop offset=".45" stop-color="var(--gold)"/><stop offset="1" stop-color="var(--gold-lo)"/>
    </radialGradient>
    <pattern id="jn-rope" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <rect width="10" height="10" fill="var(--shu)"/><rect width="5" height="10" fill="#f3ead8"/>
    </pattern>
  </defs>
  <circle cx="30" cy="26" r="20" fill="url(#jn-gold)"/>
  <path d="M14 30h32" stroke="var(--gold-lo)" stroke-width="2"/>
  <circle cx="30" cy="36" r="3" fill="var(--gold-lo)"/>
  <path d="M30 40v2" stroke="var(--gold-lo)" stroke-width="3"/>
  <!-- 鈴緒：紅白編繩，下面一串流蘇 -->
  <rect x="24" y="44" width="12" height="104" rx="6" fill="url(#jn-rope)"/>
  <path d="M22 148h16l4 20H18Z" fill="var(--shu)"/>
</svg>`;

/** 賽錢箱：上面一排斜的擋板，錢從縫裡掉進去；正面寫「奉納」 */
export const saisen = () => `
<svg class="jn-box" viewBox="0 0 220 130" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="jn-wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--wood-hi)"/><stop offset="1" stop-color="var(--wood-lo)"/>
    </linearGradient>
  </defs>
  <!-- 箱身 -->
  <path d="M18 40h184l-8 84H26Z" fill="url(#jn-wood)"/>
  <!-- 頂上的擋板（斜的一排）：縫隙是黑的，錢就是從這裡掉進去 -->
  <path d="M12 26h196l-6 16H18Z" fill="var(--wood-lo)"/>
  ${Array.from({ length: 11 }, (_, i) => `<path d="M${22 + i * 17} 27l10 13h6l-10-13Z" fill="var(--wood-hi)"/>`).join('')}
  <rect x="10" y="22" width="200" height="6" rx="2" fill="var(--wood-hi)"/>
  <!-- 金屬包角 -->
  <path d="M18 40h14v10H20Z M202 40h-14v10h12Z M26 124h14v-10H27Z M194 124h-14v-10h13Z" fill="var(--gold)"/>
  <!-- 奉納 -->
  <text x="110" y="92" class="jn-hono">奉 納</text>
  <path d="M40 104h140" stroke="var(--gold)" stroke-opacity=".5" stroke-width="1"/>
</svg>`;

/** 百圓硬幣（正面：櫻花三朵＋「100」）—— 自己畫的，不是照著真幣描 */
export const coin = () => `
<svg class="jn-coin" viewBox="0 0 60 60" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="jn-silver" cx=".35" cy=".3" r=".85">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cfd3da"/><stop offset="1" stop-color="#8b9099"/>
    </radialGradient>
  </defs>
  <circle cx="30" cy="30" r="28" fill="url(#jn-silver)" stroke="#7d828b" stroke-width="1.2"/>
  <circle cx="30" cy="30" r="23" fill="none" stroke="#9aa0a8" stroke-width=".8" stroke-dasharray="1 1.6"/>
  ${[[22, 22], [38, 22], [30, 36]].map(([x, y]) => `<g transform="translate(${x} ${y})" fill="#aab0b8">${
    Array.from({ length: 5 }, (_, i) => `<ellipse cx="0" cy="-3.2" rx="1.9" ry="3" transform="rotate(${i * 72})"/>`).join('')}</g>`).join('')}
  <text x="30" y="52" class="jn-coin__v">100</text>
</svg>`;

/** 御神籤箱：六角柱，頂上一個小孔。正面貼一張白紙「御神籤」 */
export const kujibako = () => `
<svg class="jn-kuji" viewBox="0 0 120 230" aria-hidden="true" focusable="false">
  <!-- 側面（暗）→ 正面（亮）→ 頂面 -->
  <path d="M14 30 34 20v196l-20-10Z" fill="var(--wood-lo)"/>
  <path d="M106 30 86 20v196l20-10Z" fill="var(--wood-lo)"/>
  <rect x="34" y="20" width="52" height="196" fill="var(--wood-hi)"/>
  <path d="M14 30 34 20h52l20 10-20 10H34Z" fill="var(--wood-top)"/>
  <ellipse cx="60" cy="30" rx="5" ry="2.6" fill="var(--sumi)"/>
  <!-- 兩道金箍 -->
  <path d="M14 58 34 50h52l20 8M14 186 34 180h52l20 6" fill="none" stroke="var(--gold)" stroke-width="2.4"/>
  <!-- 正面的紙籤條 -->
  <rect x="42" y="72" width="36" height="100" rx="1.5" fill="#f6efdd"/>
  <text x="60" y="96" class="jn-kuji__t">御</text><text x="60" y="124" class="jn-kuji__t">神</text><text x="60" y="152" class="jn-kuji__t">籤</text>
</svg>`;

/** 籤棒：細長木條，一頭寫籤號 */
export const kujiStick = (ban) => `
<span class="jn-stick"><span class="jn-stick__num">${[...ban].map(c => `<i>${c}</i>`).join('')}</span></span>`;

/** 結籤處（綁凶籤的地方）：兩根柱子拉三條繩，上面已經綁了幾張 */
export const rack = () => `
<svg class="jn-rack" viewBox="0 0 220 110" aria-hidden="true" focusable="false">
  <rect x="8" y="10" width="8" height="98" fill="var(--wood-lo)"/><rect x="204" y="10" width="8" height="98" fill="var(--wood-lo)"/>
  <path d="M16 30h188M16 56h188M16 82h188" stroke="var(--wood-hi)" stroke-width="2.4"/>
  ${[[40, 30], [71, 56], [118, 30], [150, 82], [178, 56], [96, 82]].map(([x, y]) =>
    `<path d="M${x - 4} ${y - 9}h8l-2 9 2 9h-8l2-9Z" fill="#f3ead8" opacity=".85"/>`).join('')}
</svg>`;
