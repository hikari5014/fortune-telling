/* 鎏金主題與星空背景。
   這裡守的是「規矩有沒有被遵守」，不是好不好看 ——
   好不好看是人看的，但「深色不准有框」「淺色一定要有陰影」可以驗。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tokens = readFileSync('styles/tokens.css', 'utf8');
const comp = readFileSync('styles/components.css', 'utf8');
const views = readFileSync('styles/views.css', 'utf8');
const base = readFileSync('styles/base.css', 'utf8');
const html = readFileSync('index.html', 'utf8');

const block = (sel) => {
  const i = tokens.indexOf(sel);
  assert.ok(i >= 0, `找不到 ${sel}`);
  return tokens.slice(i, tokens.indexOf('}', i));
};
const dark = block(':root[data-theme="dark"]');
const light = block(':root[data-theme="light"]');

test('兩個主題的代幣是成套的，沒有一邊漏掉', () => {
  const keys = (b) => [...b.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]).sort();
  assert.deepEqual(keys(dark), keys(light));
});

test('區塊一律不畫框：--edge 兩邊都是透明的', () => {
  assert.match(dark, /--edge:\s*transparent/);
  assert.match(light, /--edge:\s*transparent/);
});

test('深色靠明度差、淺色靠陰影 —— 兩邊不能用同一種手段', () => {
  // 深色背景上的陰影看不見，所以一定是 none
  assert.match(dark, /--lift:\s*none/);
  assert.match(dark, /--lift-sm:\s*none/);
  // 淺色背景上的明度差太微弱，所以一定要有陰影
  assert.ok(/--lift:\s*0 /.test(light), '淺色主題沒有給 --lift 陰影');
  assert.ok(/--lift-sm:\s*0 /.test(light), '淺色主題沒有給 --lift-sm 陰影');
});

test('深色的三階底色是真的拉得開的', () => {
  const hex = (k) => {
    const m = dark.match(new RegExp(`${k}:\\s*(#[0-9a-f]{6})`, 'i'));
    assert.ok(m, `深色缺 ${k}`);
    const v = parseInt(m[1].slice(1), 16);
    return ((v >> 16 & 255) * 299 + (v >> 8 & 255) * 587 + (v & 255) * 114) / 1000;
  };
  const bg = hex('--bg'), sf = hex('--surface'), s2 = hex('--surface-2');
  assert.ok(sf > bg + 3, `區塊(${sf.toFixed(1)}) 要比底(${bg.toFixed(1)}) 亮得出來`);
  assert.ok(s2 > sf + 3, `次層(${s2.toFixed(1)}) 要比區塊(${sf.toFixed(1)}) 亮得出來`);
});

test('沒有殘留的黑白色票（改完外觀最容易忘的就是這個）', () => {
  for (const [name, b] of [['dark', dark], ['light', light]]) {
    assert.ok(!/#0a0a0a|#fafafa|#ffffff;/.test(b.replace('--surface: #ffffff;', '')),
      `${name} 還留著舊的純黑白色票`);
  }
});

test('金只有一個，深淺各一，而且金上面的字是對比色', () => {
  assert.match(dark, /--accent:\s*#e8d9a8/);
  assert.match(light, /--accent:\s*#8a6d2f/);
  // 主要按鈕、啟用晶片都吃 --invert-bg，所以它必須是金
  assert.match(dark, /--invert-bg:\s*var\(--accent\)/);
  assert.match(light, /--invert-bg:\s*var\(--accent\)/);
});

test('改成無邊框之後，沒有東西是「沒底色又沒框」的', () => {
  // 這兩個原本純靠框站出來，拿掉框就得補底色
  const chip = comp.slice(comp.indexOf('\n.chip {'), comp.indexOf('.chip svg'));
  assert.match(chip, /background:\s*var\(--surface-2\)/);
  const iconbtn = comp.slice(comp.indexOf('.iconbtn {'), comp.indexOf('.iconbtn:active'));
  assert.match(iconbtn, /background:\s*var\(--surface\)/);
  // 淺色的 --surface 就是白的，輸入框得換一階才看得見
  const input = comp.slice(comp.indexOf('.input, .select, .textarea {'), comp.indexOf('.input:focus'));
  assert.match(input, /background:\s*var\(--field\)/);
});

test('真正的「線」沒有被誤傷 —— 表格與圖框還是有邊的', () => {
  assert.match(views, /\.md th, \.md td \{ border: 1px solid var\(--line\)/);
  assert.match(views, /\.qrbox[^}]*border: 1px solid var\(--line-2\)/);
});

test('星空那一層接好了，而且關得掉', () => {
  assert.match(html, /<canvas class="sky" id="sky"/);
  assert.match(base, /\.sky \{/);
  assert.match(base, /:root\[data-sky="off"\] \.sky \{ display: none/);
  const sw = readFileSync('sw.js', 'utf8');
  assert.ok(sw.includes('./src/starfield.js'), '離線外殼裡沒有星空');
});

test('主題色的 meta 跟著換了，不然開 App 時上下會出現一條舊色', () => {
  assert.match(html, /content="#060810" media="\(prefers-color-scheme: dark\)"/);
  assert.match(html, /content="#fbfaf5" media="\(prefers-color-scheme: light\)"/);
  const store = readFileSync('src/store.js', 'utf8');
  assert.match(store, /'#060810' : '#fbfaf5'/);
});

/* ── 起卦：抽牌頁上的水晶球 ─────────────────────── */
const cast = readFileSync('src/orbcast.js', 'utf8');
const draw = readFileSync('src/tarotdraw.js', 'utf8');
const swjs = readFileSync('sw.js', 'utf8');

test('插圖沒放進去的時候，水晶球不畫，普通按鈕留著', () => {
  assert.match(cast, /NEEDED\.every\(k => ok\[k\]\)|rs\.every\(Boolean\)/);
  assert.match(cast, /\.catch\(\(\) => false\)/);   // 載圖失敗不能讓 Promise 炸掉
  // 兩條路共用同一個入口，所以插圖不齊也一定按得下去
  assert.match(cast, /btn\?\.addEventListener\('click', \(\) => onCast\(false\)\)/);
  assert.match(cast, /cast\.hidden = false;\s*\n\s*btn\.hidden = true;/);
});

test('插圖不進安裝外殼 —— 一個 404 會讓整個 Service Worker 裝不起來', () => {
  assert.ok(!swjs.slice(0, swjs.indexOf("self.addEventListener('install'")).includes('ceremony'),
    '起卦插圖被放進 SHELL 了');
  assert.match(swjs, /assets\/ceremony\//);
  assert.match(swjs, /caches\.open\('xj-art'\)/);
  assert.match(swjs, /k === 'xj-art'/);   // 改版時不要清掉，不然每次都重抓
});

test('滑鼠靠 hover 閃，觸控靠按住閃 —— 手指沒有 hover', () => {
  assert.match(views, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\n\s*\.cast__orb:hover \.cast__shine/);
  assert.match(views, /\.cast__orb\.is-press \.cast__shine/);
  assert.match(cast, /orb\.addEventListener\('pointerdown'/);
  // 放開、離開、被系統中斷都要收掉，不然手指滑走之後球會一直閃
  assert.match(cast, /pointerup', 'pointercancel', 'pointerleave'/);
});

test('觸控長按不會跳出選取與放大鏡', () => {
  // 桌機的右鍵選單擋在事件上
  assert.match(cast, /orb\.addEventListener\('contextmenu', \(e\) => e\.preventDefault\(\)\)/);
  assert.match(draw, /root\.addEventListener\('contextmenu', \(e\) => e\.preventDefault\(\)\)/);
  // iOS 的長按選取擋在 CSS 上，而且是整頁一起擋（見 base.css）
  assert.match(base, /body \{[\s\S]*?-webkit-touch-callout: none/);
  assert.match(views, /\.cast__ball \{[\s\S]*?-webkit-user-drag: none/);
});

test('白光是接力棒：儀式就位了才散，而且一定會散', () => {
  // 儀式貼進 DOM、下一幀畫得出來之後才通知
  assert.match(draw, /requestAnimationFrame\(\(\) => requestAnimationFrame\(onReady\)\)/);
  // 沒人叫它散也要自己散 —— 不能把人卡在一片白裡面
  assert.match(cast, /setTimeout\(fade, 2000\)/);
  // 中途離開儀式也要散
  const tarot = readFileSync('src/views/tarot.js', 'utf8');
  assert.match(tarot, /if \(!got\) \{ fade\?\.\(\); return; \}/);
});

test('兩隻手一起合圍，右手多一個搓的動作', () => {
  assert.match(cast, /NEEDED = \['orb', 'aura', 'handL'\]/);
  assert.match(views, /\.rite\.is-rub \.rite__hand--l \{/);
  // 搓只掛在右手上；左手負責捧著不動
  assert.match(views, /\.rite\.is-rub \.rite__hand--r \{[\s\S]*?animation: rite-rub/);
  assert.ok(!/\.rite\.is-rub \.rite__hand--l \{[^}]*animation/.test(views), '左手也在搓，兩隻一起動就看不懂了');
});

test('有真的右手素材就不要鏡射它', () => {
  // 素材本來就是一對：左手往右上傾、右手往左上傾，兩張直接用就對著球。
  // 不分青紅皂白鏡射右手，會把本來就對的方向翻成反的。
  assert.match(cast, /ok\.handR \? \{ handR: ART\.handR, flip: false \}/);
  assert.match(cast, /\{ handR: ART\.handL, flip: true \}/);
  assert.match(cast, /if \(art\?\.flip\) rightHand\.classList\.add\('is-flip'\)/);
  // 鏡射由 --flip 控制，預設 1（不翻）
  assert.match(views, /\.rite__hand--r \{ --flip: 1;/);
  assert.match(views, /\.rite__hand--r\.is-flip \{ --flip: -1; \}/);
  assert.ok(!/\.rite__hand--r[^}]*scaleX\(-1\)/.test(views), '右手還被寫死鏡射');
});

test('選走的牌停在牌位標籤下面，不會疊到標題', () => {
  // 牌位那一排在舞台上緣之外，放上面就會跑出舞台、疊到最上面的標題
  assert.match(draw, /y: sr\.bottom - st\.top \+ 10/);
  assert.ok(!/y: sr\.top - st\.top - CW/.test(draw), '還在往上放');
  // 兩個地方（選走時、重排時）要用同一份算式
  assert.match(draw, /const slotPos = \(sr, st\)/);
});

test('觸控：滑過去是「看」，停住才是「選」', () => {
  assert.match(draw, /const DWELL = 600;/);
  // 手指本來就會抖，抖動範圍內不算移動，不然永遠停不滿
  assert.match(draw, /const JITTER = 14;/);
  // 換了一張、或手指在游移，都要重新計時
  assert.match(draw, /if \(i !== hot\) \{[\s\S]*?arm\(\);/);
  // 沒停滿就放開＝沒選
  assert.match(draw, /if \(scrub\) \{ stopScrub\(false\); setHot\(-1\); return; \}/);
  // 只有觸控走這條；滑鼠照舊點一下就收下
  assert.match(draw, /if \(s >= 0 \|\| !touchMode\) startDrag\(/);
  assert.match(draw, /else startScrub\(i, e\);/);
});

test('充能有畫面回饋，不然牌被抽走像是無緣無故發生的', () => {
  assert.match(views, /\.tc\.is-hold \.tc__back \{ animation: tc-hold 600ms linear both; \}/);
  // 動畫關掉時不能只剩「什麼都沒有」，要留一個靜態的已選中樣子
  assert.match(views, /data-motion="off"\] \.tc\.is-hold \.tc__back/);
  // CSS 的 600ms 與 JS 的 DWELL 要一致，不然金邊長滿了牌還沒被抽走
  const ms = draw.match(/const DWELL = (\d+);/)[1];
  assert.ok(views.includes(`tc-hold ${ms}ms`), `CSS 的充能時間與 DWELL(${ms}) 對不上`);
});

test('提示要跟著輸入方式換', () => {
  // 對滑鼠講「停住一下」、對手指講「點一下」，兩邊都會覺得在講別人的事
  assert.match(draw, /touchMode\s*\n?\s*\?/);
  assert.match(draw, /滑過扇面看牌/);
  assert.match(draw, /點一下就收下/);
  assert.match(draw, /if \(e\.pointerType\) touchMode = e\.pointerType !== 'mouse';/);
});

test('起卦已經搬到抽牌頁，儀式裡不再有第二份', () => {
  assert.ok(!draw.includes('cer__rite'), '儀式裡還留著舊的起卦那一層');
  assert.ok(!views.includes('.cer__rite'), 'CSS 裡還留著舊的起卦樣式');
  assert.match(draw, /let phase = 'stack'/);   // 儀式從聚牌開始
});

test('拖曳選牌：往上丟收下、放回扇面當沒發生、已選的可以拖回去', () => {
  // 判斷要看相對位移，不是畫面上的某一條絕對高度 ——
  // 扇面本來就攤在中段，用絕對線的話隨便碰一下都算丟出去
  assert.match(draw, /const THROW_UP/);
  assert.match(draw, /const dy = y - y0;/);
  assert.match(draw, /if \(dy < -THROW_UP \|\| vy < -0\.55\) take\(i\)/);
  assert.match(draw, /if \(dy > DROP_DOWN \|\| vy > 0\.55\) untake\(i\)/);
  assert.match(draw, /function untake\(i\)/);
  // 沒真的拖動就當成點一下 —— 不該逼原本會用的人改學新手勢
  assert.match(draw, /if \(!moved\) \{ take\(i\); return; \}/);
  // 拔掉中間那一張之後，後面的牌位要往前遞補
  assert.match(draw, /function relayoutSlots\(\)/);
  // 已選的牌飛到舞台外緣的牌位排，事件只掛舞台的話就摸不到它
  assert.match(draw, /root\.addEventListener\('pointerdown'/);
  assert.match(draw, /if \(i < 0\) return;/);   // 沒抓到牌就別吃掉事件，不然關閉鍵會壞
});

/* ── 長按不要選字 ───────────────────────────────── */

test('整頁預設不給選，不是一個一個元件去關', () => {
  // 列舉式的寫法永遠會漏 —— 每加一個新畫面就要記得回來補，
  // 漏掉的地方就出包（抽牌儀式就是這樣漏掉的）
  assert.match(base, /body \{[\s\S]*?-webkit-touch-callout: none;[\s\S]*?user-select: none;[\s\S]*?\}/);
});

test('真的需要複製的地方要開回來', () => {
  const allow = base.slice(base.indexOf('input, textarea, select, .preview'));
  for (const sel of ['input', 'textarea', 'select', '.preview', '.md', '.rec__body']) {
    assert.ok(allow.slice(0, allow.indexOf('}')).includes(sel), `${sel} 應該可以選起來複製`);
  }
  assert.match(allow.slice(0, allow.indexOf('}')), /user-select: text/);
});

test('iOS 的長按選取只有 CSS 擋得住，preventDefault 沒用', () => {
  // -webkit-touch-callout 才是關鍵；contextmenu 是桌機右鍵的事件
  assert.match(base, /-webkit-touch-callout: none/);
  assert.match(base, /contextmenu.*沒有用|對它沒有用/);
});

test('圖片長按不要跳出「儲存影像」，也不要被拖走', () => {
  assert.match(base, /img \{ -webkit-user-drag: none/);
});

test('雙擊縮放還是要關掉 —— 那是另一件事', () => {
  // user-select 管選字，touch-action 管雙擊縮放的 300ms 延遲，兩者不能混為一談
  const block = base.slice(base.indexOf('/* 雙擊縮放'));
  assert.match(block.slice(0, block.indexOf('}')), /touch-action: manipulation/);
});

/* ── 筊杯 ───────────────────────────────────────── */
const relics = readFileSync('src/relics.js', 'utf8');
const qian = readFileSync('src/views/qian.js', 'utf8');

test('筊杯的兩面是同一塊木頭，輪廓一樣只有表面不同', () => {
  // 輪廓是同一條路徑，平面畫年輪切面、凸面畫脊線與它的影
  assert.match(relics, /const body = 'M14 60/);
  assert.match(relics, /rl-ridge/);
  assert.match(relics, /rl-shade/);
  assert.equal((relics.match(/\$\{body\}/g) || []).length, 2, '輪廓應該只定義一次、用兩次');
});

test('先擲出結果再放動畫 —— 動畫跑到一半才改面會整個重來', () => {
  const cast = qian.slice(qian.indexOf('async function doCast'));
  const decide = cast.indexOf('const r = castJiao()');
  const animate = cast.indexOf("classList.add('is-cast')");
  assert.ok(decide >= 0 && animate > decide, '結果要在加上 is-cast 之前就決定好');
});

test('動畫關掉時，看到哪一面也要是對的', () => {
  // 只靠 is-cast 的最後一格決定，動畫一關就會停在錯的面
  assert.match(views, /\.jiao:not\(\.jiao--flat\) \{ transform: rotateX\(180deg\); \}/);
  assert.match(views, /data-motion="off"\] \.jiao\.is-cast \{ animation: none/);
});
