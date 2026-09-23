/* 起卦：抽牌頁上的那顆水晶球
   ──────────────────────────────────────────────────────────
   原本「洗牌並抽牌」是一顆按鈕。現在那個位置放的是水晶球本人：

   ・還沒按之前，球上有一層閃光在遊走 —— 滑鼠是移上去就閃，
     觸控是「按著的時候」才閃。兩種裝置對「我正在碰它」的定義不一樣：
     滑鼠有 hover，手指沒有，手指的 hover 就是按住。
   ・按下去之後：右手伸進來搓揉水晶球 → 球亮起來、光暈在背後綻開 →
     整片白光蓋滿螢幕 → 洗牌的畫面在白光底下就位 → 白光散掉。

   白光是接力棒：它蓋住的那幾百毫秒，正好讓抽牌儀式無聲無息地長出來，
   所以中間不會看到「一個畫面消失、另一個畫面出現」的接縫。

   插圖不齊就整段跳過（連球都不畫，回到一顆普通按鈕）——
   少一段特效沒關係，按不下去不行。 */

import { icon } from './icons.js';
import { haptic } from './ui.js';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

export const ART = {
  orb: 'assets/ceremony/orb.webp',
  aura: 'assets/ceremony/aura.webp',
  handL: 'assets/ceremony/hand-l.webp',
  handR: 'assets/ceremony/hand-r.webp',
};
/* 兩隻手一起從下面伸上來合圍水晶球，右手再多一個搓的動作。
   左手負責「捧著」，右手負責「在摸」—— 兩件事分給兩隻手，看得比較懂。

   hand-r 是選配：素材本來就是一對（左手往右上傾、右手往左上傾），
   有的話直接用、**不要鏡射**；沒有的話才拿左手鏡射過去充數。
   一開始不分青紅皂白鏡射右手，結果把本來就對的方向翻成反的。 */
const NEEDED = ['orb', 'aura', 'handL'];

const loadOne = (src) => new Promise((res) => {
  const im = new Image();
  im.onload = () => res(true);
  im.onerror = () => res(false);
  im.src = src;
});

let artReady = null;
/**
 * 預載插圖。
 * @returns {Promise<false|{handR: string, flip: boolean}>}
 *   false 表示必要的插圖不齊，整段跳過、按鈕原樣放回去。
 *   flip 為真表示右手是拿左手充數的，要鏡射；有真的右手素材就不要動它 ——
 *   素材本來就是一對（左手往右上傾、右手往左上傾），再鏡射一次方向就反了。
 */
export function loadArt() {
  if (artReady) return artReady;
  if (typeof Image !== 'function') return (artReady = Promise.resolve(false));
  const keys = Object.keys(ART);
  artReady = Promise.all(keys.map(k => loadOne(ART[k])))
    .then((rs) => {
      const ok = Object.fromEntries(keys.map((k, i) => [k, rs[i]]));
      if (!NEEDED.every(k => ok[k])) return false;
      return ok.handR ? { handR: ART.handR, flip: false } : { handR: ART.handL, flip: true };
    })
    .catch(() => false);
  return artReady;
}

/** 這台裝置／這個設定要不要演 */
export function castOn(settings) {
  if (settings?.tarotCeremony === false) return false;
  if (settings?.motion === 'off') return false;
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch {}
  return true;
}

/** 抽牌頁上那一塊的 HTML。id 固定為 shuffle，讓沒有插圖時的退路共用同一個按鈕。 */
export function castHTML() {
  return `
    <div class="cast" id="cast" hidden>
      <button class="cast__orb" id="shuffle-orb" type="button" aria-label="點擊水晶球開始占卜">
        <img class="cast__ball" src="${ART.orb}" alt="" draggable="false">
        <span class="cast__shine" aria-hidden="true"></span>
        <span class="cast__sparks" aria-hidden="true"></span>
      </button>
      <p class="cast__tip">點擊水晶球開始占卜</p>
    </div>
    <button class="btn btn--primary btn--block press" id="shuffle" style="margin-top:var(--sp-4)">
      ${icon('dice')} 洗牌並抽牌
    </button>`;
}

/**
 * 把那一塊接起來。插圖齊了就顯示水晶球、藏掉按鈕。
 * @param {HTMLElement} root 找得到 #cast / #shuffle 的容器
 * @param {function} onCast 按下去要做的事（兩條路都會呼叫它）
 * @param {object} settings
 */
export async function mountCast(root, onCast, settings) {
  const btn = root.querySelector('#shuffle');
  const cast = root.querySelector('#cast');
  const orb = root.querySelector('#shuffle-orb');
  btn?.addEventListener('click', () => onCast(false));
  if (!cast || !orb || !castOn(settings) || !(await loadArt())) return;

  cast.hidden = false;
  btn.hidden = true;

  // 閃光的位置每次載入都重擲，才不會每次看到一樣的星點
  const sparks = orb.querySelector('.cast__sparks');
  sparks.innerHTML = Array.from({ length: 7 }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 30;                      // 落在球面上，不要跑到底座
    const x = 50 + Math.cos(a) * r;
    const y = 36 + Math.sin(a) * r * 0.82;
    return `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;
      animation-delay:${(Math.random() * 2.2).toFixed(2)}s;
      --sz:${(4 + Math.random() * 5).toFixed(1)}px"></i>`;
  }).join('');

  /* 觸控沒有 hover：按著的時候才閃。放開、離開、被系統中斷都要收掉，
     不然手指滑走之後球會一直閃。 */
  const press = (on) => orb.classList.toggle('is-press', on);
  orb.addEventListener('pointerdown', (e) => { press(true); if (e.pointerType !== 'mouse') haptic(6); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) orb.addEventListener(t, () => press(false));
  // 觸控長按預設會跳出選取／放大鏡，圖片也會被拖走
  orb.addEventListener('contextmenu', (e) => e.preventDefault());

  orb.addEventListener('click', () => { press(false); onCast(true); });
}

/**
 * 演一次起卦，最後整片白光蓋滿螢幕。
 *
 * 回傳一個 fade()：抽牌儀式在白光底下就位之後再呼叫，白光才散。
 * 沒呼叫的話白光會自己在三秒後散掉 —— 保險，不能讓使用者卡在一片白裡面。
 *
 * @param {HTMLElement} orb 頁面上那顆球（用它的位置當起點）
 * @returns {Promise<function>} fade
 */
export async function castRite(orb) {
  const art = await loadArt();
  const r = orb.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'rite';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <div class="rite__stage">
      <img class="rite__aura" src="${ART.aura}" alt="" draggable="false">
      <img class="rite__orb" src="${ART.orb}" alt="" draggable="false">
      <img class="rite__hand rite__hand--l" src="${ART.handL}" alt="" draggable="false">
      <img class="rite__hand rite__hand--r" alt="" draggable="false">
    </div>
    <div class="rite__flash"></div>`;
  document.body.append(layer);
  document.body.classList.add('cer-open');

  const stage = layer.querySelector('.rite__stage');
  const rightHand = layer.querySelector('.rite__hand--r');
  rightHand.src = art ? art.handR : ART.handR;
  // 只有「拿左手充數」的時候才鏡射
  if (art?.flip) rightHand.classList.add('is-flip');
  // 從頁面上那顆球的位置長出來，畫面才不會跳一下
  stage.style.setProperty('--from-x', `${r.left + r.width / 2 - innerWidth / 2}px`);
  stage.style.setProperty('--from-y', `${r.top + r.height / 2 - innerHeight / 2}px`);
  stage.style.setProperty('--from-s', String(r.width / Math.min(innerWidth * 0.46, 210)));

  orb.classList.add('is-gone');          // 頁面上那顆讓位給浮起來的這顆

  await wait(20);
  layer.classList.add('is-rise');        // 球浮到畫面中央、放大
  await wait(520);

  layer.classList.add('is-rub');         // 右手伸進來搓
  haptic(8);
  await wait(1500);

  layer.classList.add('is-charge');      // 球亮起來、光暈綻開
  haptic(14);
  await wait(760);

  layer.classList.add('is-burst');       // 手收回、白光從球心炸開
  haptic(26);
  await wait(300);                       // 白光只是接力棒，不是一段戲 —— 蓋住就好

  let gone = false;
  const fade = () => {
    if (gone) return;
    gone = true;
    layer.classList.add('is-fade');
    setTimeout(() => {
      layer.remove();
      document.body.classList.remove('cer-open');
      orb.classList.remove('is-gone');
    }, 360);
  };
  setTimeout(fade, 2000);                // 保險：不能讓人卡在一片白裡面
  return fade;
}
