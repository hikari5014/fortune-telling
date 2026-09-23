/* 六種視覺方案的試玩程式。
   內容是假的，但結構跟 App 本體一樣；星空直接用 App 的 src/starfield.js，
   所以這裡看到的閃爍就是之後真的會跑的那一份。 */
import { icon } from '../src/icons.js';
import { starfield } from '../src/starfield.js';

const $ = (s, r = document) => r.querySelector(s);

const SKINS = [
  { key: 'night', name: '夜空', tag: 'NIGHT',
    star: { density: 0.9, tint: [236, 240, 248] },
    note: `<b>純黑白，最安全的一版。</b>深色是三層越來越亮的黑（底 #07080b → 區塊 #101218 → 次層 #191c24），
      淺色是白紙加一層很淺的投影。<i>完全沒有框線</i>，區塊靠明度差站出來。<br>
      <i>代價：</i>最不搶眼。它不會錯，但也不會讓人「哇」。` },
  { key: 'chart', name: '星圖', tag: 'CHART',
    star: { density: 1.1, tint: [244, 239, 228] },
    note: `<b>老星圖的味道。</b>字是象牙白不是純白，背景鋪一層很淡的經緯格線（越往下越淡），
      標題用細體、數字用等寬字放大，字距拉開。<br>
      <i>代價：</i>格線是額外的一層，深色下要壓得很淡才不會吵；淺色是米白紙，跟純白的介面元件要一起調。` },
  { key: 'gild', name: '鎏金', tag: 'GILD',
    star: { density: 1.0, tint: [232, 217, 168] },
    note: `<b>接塔羅牌背那一套。</b>靛藍近黑的底，關鍵數字、啟用狀態、圖示上金；星星也是金的。
      儀式感最強，跟抽牌儀式是同一個世界。<br>
      <i>代價：</i><b>不再是純黑白</b>——你原本的設定條件之一會被打破。要留就得承認它是「黑白＋一個金」。` },
  { key: 'frost', name: '霧面', tag: 'FROST',
    star: { density: 1.4, tint: [255, 255, 255] },
    note: `<b>區塊是一片片磨砂玻璃，星空從底下透出來。</b>空間感最強，星辰主題也最明顯 ——
      因為星星真的在內容底下流動。<br>
      <i>代價：</i>模糊很吃效能，一頁疊十幾層會掉幀；而且內容底下有東西在動，長文閱讀會分心。` },
  { key: 'quiet', name: '留白', tag: 'QUIET',
    star: { density: 0.55, tint: [240, 241, 243] },
    note: `<b>幾乎沒有區塊。</b>靠留白與字級分層，只在標題下留一條細線，卡片直接拿掉底色。
      最像一本書，最不像 App。<br>
      <i>代價：</i>資訊密度一高就會散 —— 你的擇日、紫微那幾頁欄位很多，可能撐不住。` },
  { key: 'glow', name: '光暈', tag: 'GLOW',
    star: { density: 1.2, tint: [200, 215, 255] },
    note: `<b>區塊不是一塊底色，是背後透出來的一團光。</b>大字與圖示會發光，最有星辰感。<br>
      <i>代價：</i>光暈疊多了整頁會糊，得很克制；而且淺色模式下光暈幾乎看不見，
      兩個主題的個性會不一樣。` },
];

const TILES = [
  ['astro', '星盤', '太陽 · 月亮 · 上升 · 中天'],
  ['ziwei', '紫微', '十二宮 · 十四主星 · 四化'],
  ['pillars', '八字', '五行力量 · 旺衰 · 喜用神'],
  ['clock', '運勢', '大限 · 流年 · 大運 · 流月'],
  ['calendar', '擇日', '建除 · 宜忌 · 找好日子'],
  ['compass', '方位', '本命卦 · 四吉方 · 四凶方'],
];
const DOCK = [['settings', '工具'], ['astro', '命盤'], ['home', '首頁'], ['dice', '占卜'], ['link', '人際']];

const root = document.documentElement;
let sky = null;

function paintSkin(key) {
  const s = SKINS.find(x => x.key === key) || SKINS[0];
  root.dataset.skin = s.key;
  try { localStorage.setItem('xj.lab.skin', s.key); } catch {}
  $('#note').innerHTML = `<p>${s.note}</p>`;
  [...$('#skins').children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === s.key)));
  // 星空跟著換色與密度 —— 每一版的星星不一樣多、不一樣亮
  sky?.stop();
  sky = starfield($('#sky'), { density: s.star.density, tint: s.star.tint });
}

function build() {
  $('#skins').innerHTML = SKINS.map(s =>
    `<button class="lab__skin" data-k="${s.key}" aria-pressed="false"><b>${s.name}</b><small>${s.tag}</small></button>`).join('');
  $('#skins').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) paintSkin(b.dataset.k);
  });

  $('#tiles').innerHTML = TILES.map(([ic, t, d], i) =>
    `<button class="tile"><i>${String(i + 1).padStart(2, '0')}</i>${icon(ic)}<b>${t}</b><small>${d}</small></button>`).join('');

  $('#dock').innerHTML = DOCK.map(([ic, t], i) =>
    `<button ${i === 1 ? 'aria-current="page"' : ''}>${icon(ic)}<span>${t}</span></button>`).join('');

  const themeBtn = $('#theme');
  const paintTheme = () => { themeBtn.innerHTML = icon(root.dataset.theme === 'light' ? 'moon' : 'sun'); };
  themeBtn.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('xj.lab.skinTheme', root.dataset.theme); } catch {}
    paintTheme();
  });
  paintTheme();
}

try {
  const t = localStorage.getItem('xj.lab.skinTheme');
  if (t) root.dataset.theme = t;
  else if (matchMedia('(prefers-color-scheme: light)').matches) root.dataset.theme = 'light';
} catch {}

build();
let saved = null;
try { saved = localStorage.getItem('xj.lab.skin'); } catch {}
paintSkin(saved || 'night');
