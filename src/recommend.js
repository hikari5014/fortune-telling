/* 今日推薦：首頁一天跳一次，推一個「今天可以玩玩看」的功能
   ──────────────────────────────────────────────────────────
   規則：
   1. 還沒有任何檔案 → 推「建立檔案」。星盤、紫微、八字、行運全都要生日，先有檔案才有東西看。
   2. 有檔案之後第一個推塔羅 —— 不用任何準備、當下就有結果，最適合當第一個玩的。
   3. 之後照清單順序，推「還沒用過」的；都用過了就推「最久沒用」的，
      而且不跟昨天推一樣的。

   「一天一次」：今天推過就記下來（日期＋推了什麼），今天不再跳。
   例外是早上推了「建立檔案」、之後真的建好了 —— 那一則已經過時，
   同一天可以再推一次塔羅，這正是「建好第一個檔案就推塔羅」要的效果。

   「用過」是看有沒有進過那一頁（app.js 換頁時呼叫 markSeen），不是看有沒有按到結果。
   只存在這台裝置，不進備份。 */

import { html, raw } from './ui.js';
import { icon } from './icons.js';

const SEEN = 'xj.seen';
const PICK = 'xj.reco';

/** 可以推的功能，照推薦順序排 */
export const ITEMS = [
  { p: '/profile',   icon: 'profile',  t: '先建立你的檔案', d: '填一次生日，星盤、紫微、八字、今天的行運就全部算得出來。', go: '去建立' },
  { p: '/tarot',     icon: 'star',     t: '抽一次塔羅',     d: '心裡想著一個問題，點水晶球開始洗牌。現在就能有答案。', go: '去抽牌' },
  { p: '/astro',     icon: 'astro',    t: '看看今天的行運', d: '今天天上的行星碰到你本命盤的哪幾顆星？哪些是這陣子的主題？', go: '去看看' },
  { p: '/qian',      icon: 'folder',   t: '求一支籤',       d: '搖籤筒、擲筊確認，拿一首籤詩回來。', go: '去求籤' },
  { p: '/iching',    icon: 'dice',     t: '起一卦',         d: '三枚銅錢擲六次，看看易經怎麼說。', go: '去卜卦' },
  { p: '/fortune',   icon: 'clock',    t: '看今年的運勢',   d: '大限、流年、大運一次看完，知道自己走到哪一段。', go: '去看看' },
  { p: '/ziwei',     icon: 'ziwei',    t: '排一張紫微命盤', d: '十二宮、十四主星、四化 —— 最完整的一張命盤。', go: '去排盤' },
  { p: '/bazi',      icon: 'pillars',  t: '看八字五行',     d: '五行哪個多、哪個缺，喜用神是什麼。', go: '去看看' },
  { p: '/daily',     icon: 'calendar', t: '挑個好日子',     d: '要搬家、簽約、開幕？讓黃曆幫你排出前幾名。', go: '去擇日' },
  { p: '/direction', icon: 'compass',  t: '找你的吉方位',   d: '書桌、床頭朝哪裡比較好？本命卦告訴你四吉四凶。', go: '去看看' },
  { p: '/numbers',   icon: 'numbers',  t: '算算數字磁場',   d: '手機號碼、車牌好不好？輸入就知道。', go: '去算算' },
  { p: '/naming',    icon: 'naming',   t: '看看名字的筆畫', d: '五格三才、81 靈動，名字的數理一次看完。', go: '去看看' },
  { p: '/synastry',  icon: 'link',     t: '跟另一個人合盤', d: '兩個人的星盤疊起來，看哪裡互補、哪裡容易摩擦。', go: '去合盤' },
];
export const itemOf = (p) => ITEMS.find(x => x.p === p);

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 私密模式寫不進去就算了 */ } };

const dayKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** 換頁時記一筆「進過這一頁」 */
export function markSeen(path, now = Date.now()) {
  if (!itemOf(path)) return;
  const s = read(SEEN, {});
  s[path] = now;
  write(SEEN, s);
}

/**
 * 純函式：今天該推哪一個
 * @param {object} o {hasProfile, seen: {path: 時間}, last: 昨天（上一次）推的 path}
 */
export function choose({ hasProfile, seen = {}, last = null }) {
  if (!hasProfile) return itemOf('/profile');
  const pool = ITEMS.filter(x => x.p !== '/profile');
  // 塔羅永遠是有檔案之後的第一個
  if (!seen['/tarot'] && last !== '/tarot') return itemOf('/tarot');
  const fresh = pool.find(x => !seen[x.p] && x.p !== last);
  if (fresh) return fresh;
  return [...pool].filter(x => x.p !== last).sort((a, b) => (seen[a.p] || 0) - (seen[b.p] || 0))[0] || pool[0];
}

/**
 * 今天要不要跳、跳哪一個。會把「今天推過了」記下來，所以同一天第二次呼叫回 null。
 * @returns {object|null}
 */
export function todayPick({ enabled = true, hasProfile, now = new Date() } = {}) {
  if (!enabled) return null;
  const today = dayKey(now);
  const prev = read(PICK, null);
  const stale = prev?.date === today && prev.p === '/profile' && hasProfile;
  if (prev?.date === today && !stale) return null;
  const item = choose({ hasProfile, seen: read(SEEN, {}), last: prev?.p || null });
  write(PICK, { date: today, p: item.p });
  return item;
}

/* ── 畫面：一顆流星劃下來，在畫面中間展開成一張卡 ─────────── */

export function recoHTML(item) {
  return html`
    <div class="reco" role="dialog" aria-modal="true" aria-labelledby="reco-t" data-noswipe>
      <div class="reco__veil" data-close></div>
      <span class="reco__meteor" aria-hidden="true"></span>
      <div class="reco__card" tabindex="-1">
        <span class="reco__burst" aria-hidden="true">${raw(Array.from({ length: 8 }, (_, i) => `<i style="--a:${i * 45}deg"></i>`).join(''))}</span>
        <p class="reco__eyebrow">今日推薦</p>
        <span class="reco__ic">${raw(icon(item.icon))}</span>
        <h3 class="reco__t" id="reco-t">${item.t}</h3>
        <p class="reco__d">${item.d}</p>
        <div class="reco__btns">
          <button class="btn btn--primary press" data-go>${item.go}</button>
          <button class="btn btn--ghost press" data-close>今天先不要</button>
        </div>
        <button class="reco__off" data-off>不要再推薦</button>
      </div>
    </div>`;
}

/**
 * 掛上去並處理按鈕。掛在 body 上而不是頁面裡 —— 換頁過場會對頁面容器做 transform，
 * position:fixed 在 transform 底下會跟著跑掉。所以改成換頁時自己收掉。
 * @param {object} item 推薦項目
 * @param {object} h {go(path), off()}
 */
export function mountReco(item, h) {
  const wrap = document.createElement('div');
  wrap.innerHTML = String(recoHTML(item));
  const el = wrap.firstElementChild;
  document.body.appendChild(el);
  const gone = () => { el.remove(); removeEventListener('hashchange', gone); };
  addEventListener('hashchange', gone);
  requestAnimationFrame(() => el.classList.add('is-in'));
  const close = (then) => {
    el.classList.add('is-out');
    setTimeout(() => { gone(); then?.(); }, 320);
  };
  el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close()));
  el.querySelector('[data-go]').addEventListener('click', () => close(() => h.go(item.p)));
  el.querySelector('[data-off]').addEventListener('click', () => close(() => h.off()));
  const esc = (e) => { if (e.key === 'Escape') { close(); removeEventListener('keydown', esc); } };
  addEventListener('keydown', esc);
  // 焦點給卡片本身（讀螢幕軟體會唸標題），不給按鈕 —— 否則一打開按鈕就帶著焦點框
  setTimeout(() => el.querySelector('.reco__card')?.focus({ preventScroll: true }), 900);
  return el;
}
