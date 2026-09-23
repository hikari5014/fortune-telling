/* 法器：銅錢、籤筒、木籤、籤詩紙
   ──────────────────────────────────────────────────────────
   求籤與卜卦原本是幾個 div：一個圓圈當銅錢、一個圓角方框當籤筒。
   能用，但跟塔羅那一頭的精緻度差太多。

   為什麼是自己畫，不是去網路上找圖：
   ・**找不到能用的。** 維基共享資源上清代銅錢的公有領域照片很多，
     但都是博物館式的紀錄照 —— 打光、角度、背景各不相同，也沒有去背。
     籤筒與木籤那一類更只有廟裡的實景快照；籤詩紙幾乎沒有。
   ・**風格對不上。** 這個 App 是靛黑配鎏金的線稿世界。
     把真實器物的照片放進來，看起來會像型錄掉進插畫裡。
     塔羅牌之所以成立，是因為它本來就是一整副風格一致的畫。
   ・自己畫還順便解決了三件事：沒有授權問題、檔案小到可以內嵌、
     顏色吃 currentColor 會跟著主題走。

   畫法跟 icons.js 同一套：純 SVG、線稿、吃 currentColor。
   差別只在這些是「器物」不是「圖示」—— 尺寸大、細節多，
   所以獨立成一支，不去擠那個 24 格的圖示集。 */

/**
 * 一枚方孔銅錢。
 * 正面（字）鑄四個字，反面（花）只有滿文式的兩道記號 ——
 * 真的清錢背面鑄的是鑄局名，不是空白。
 * @param {boolean} yang true 畫正面（字）
 */
export function coin(yang = true) {
  const face = yang
    // 四個字照「上下右左」讀：乾隆通寶
    ? `<g class="rl-glyph">
         <text x="32" y="17">乾</text><text x="32" y="53">通</text>
         <text x="14" y="36">隆</text><text x="50" y="36">寶</text>
       </g>`
    // 背面：鑄局的滿文，畫成兩道對稱的豎紋即可 —— 這個尺寸寫不出字
    : `<g class="rl-mark">
         <path d="M15 27v18M15 30h4M15 38h4"/>
         <path d="M49 27v18M49 30h-4M49 38h-4"/>
       </g>`;
  return `<svg class="rl rl--coin" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <circle class="rl-body" cx="32" cy="32" r="29"/>
    <circle class="rl-rim" cx="32" cy="32" r="29"/>
    <circle class="rl-rim rl-rim--in" cx="32" cy="32" r="24"/>
    <rect class="rl-hole" x="23" y="23" width="18" height="18" rx="1.5"/>
    <rect class="rl-rim" x="23" y="23" width="18" height="18" rx="1.5"/>
    ${face}
  </svg>`;
}

/**
 * 籤筒：竹筒、三道箍、一把露出頭的木籤。
 * @param {number} n 露幾支籤
 */
export function tube(n = 9) {
  /* 畫的順序就是遠近：先畫筒口的暗面 → 再畫籤（從暗面裡冒出來）→
     最後畫筒身蓋住籤的下半。順序錯了就會變成「籤浮在筒前面」。 */
  const sticks = Array.from({ length: n }, (_, i) => {
    const x = 34 + i * 10.6;
    const up = [30, 15, 38, 8, 44, 12, 34, 19, 26][i % 9];   // 露出的長度不一樣才像一把
    const lean = ((i % 3) - 1) * 2.2;
    return `<g class="rl-stick" style="--i:${i}">
      <rect x="${x}" y="${56 - up}" width="7" height="${up + 26}" rx="3.5"
            transform="rotate(${lean} ${x + 3.5} 82)"/>
    </g>`;
  }).join('');
  return `<svg class="rl rl--tube" viewBox="0 0 160 190" aria-hidden="true" focusable="false">
    <ellipse class="rl-mouth" cx="80" cy="62" rx="48" ry="11"/>
    <g class="rl-sticks">${sticks}</g>
    <!-- 筒身：上寬下窄一點點，才不會像一根水管 -->
    <path class="rl-body" d="M32 62h96l-7 112a9 9 0 0 1-9 8H48a9 9 0 0 1-9-8Z"/>
    <path class="rl-rim" d="M32 62h96l-7 112a9 9 0 0 1-9 8H48a9 9 0 0 1-9-8Z"/>
    <ellipse class="rl-rim" cx="80" cy="62" rx="48" ry="11"/>
    <!-- 兩道箍 -->
    <path class="rl-band" d="M36.4 112h87.2M38.4 152h83.2"/>
    <!-- 竹節的直紋 -->
    <path class="rl-grain" d="M58 74v104M80 74v106M102 74v104"/>
  </svg>`;
}

/** 單支木籤（抽出來那一支）。number 會刻在籤身上。 */
export function stick(label = '') {
  return `<svg class="rl rl--stick" viewBox="0 0 44 300" aria-hidden="true" focusable="false">
    <rect class="rl-body" x="10" y="6" width="24" height="288" rx="12"/>
    <rect class="rl-rim" x="10" y="6" width="24" height="288" rx="12"/>
    <path class="rl-band" d="M12 40h20M12 50h20"/>
    ${label ? `<text class="rl-num" x="22" y="150">${label}</text>` : ''}
  </svg>`;
}

/**
 * 筊杯。兩塊一對，從上面看是半月形：一面平、一面凸。
 * 傳統上平面為陽、凸面為陰；一平一凸是聖筊，兩平是笑筊，兩凸是陰筊。
 *
 * 兩面畫的是「同一塊木頭的兩種樣子」，不是兩個形狀 ——
 * 輪廓完全一樣，差別只在表面：平面看得到年輪的切面，
 * 凸面看得到隆起的脊線與它落下的陰影。
 * @param {boolean} flat true 畫平面（陽）
 */
export function jiao(flat = true) {
  const face = flat
    // 平面：木頭的切面，年輪是幾道同心弧
    ? `<g class="rl-grain">
         <path d="M22 60q4-30 38-36 34 6 38 36"/>
         <path d="M34 61q3-21 26-26 23 5 26 26"/>
         <path d="M46 62q2-12 14-15 12 3 14 15"/>
       </g>`
    // 凸面：一道脊線，加上它在左下投的影
    : `<g>
         <path class="rl-ridge" d="M60 16v46"/>
         <path class="rl-shade" d="M60 16q-30 6-38 44 24 10 38 10Z"/>
         <path class="rl-grain" d="M40 24q-14 14-16 36M80 24q14 14 16 36"/>
       </g>`;
  const body = 'M14 60q-2-34 46-44 48 10 46 44-24 12-46 12T14 60Z';
  return `<svg class="rl rl--jiao" viewBox="0 0 120 84" aria-hidden="true" focusable="false">
    <path class="rl-body" d="${body}"/>
    ${face}
    <path class="rl-rim" d="${body}"/>
  </svg>`;
}

/**
 * 籤詩紙：一張長形的紙，上下有摺痕、邊緣不齊。
 * 只畫紙本身，字由 HTML 疊上去 —— SVG 裡排中文直書會是另一場災難。
 */
export function slip() {
  return `<svg class="rl rl--slip" viewBox="0 0 240 340" preserveAspectRatio="none"
    aria-hidden="true" focusable="false">
    <!-- 毛邊：左右各切幾個很淺的缺口，看起來像撕開的紙 -->
    <path class="rl-paper" d="M8 6q6 3 0 6t0 6q6 3 0 6V318q6 3 0 6t0 6q6 3 0 4h224q-6-1 0-4t0-6q-6-3 0-6V24q-6-3 0-6t0-6q-6-3 0-6Z"/>
    <path class="rl-fold" d="M8 74h224M8 266h224"/>
  </svg>`;
}
