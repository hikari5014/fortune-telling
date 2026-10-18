import { html, raw, $, $$, toast } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { navigate } from '../router.js';
import { DISCLAIMER } from './_shared.js';
import { mountPool } from '../pool3d.js';
import { targetOf, START } from '../engines/pool.js';
import { dayKey, fast } from '../rites/kit.js';
import { spend, refund, NAME } from '../wallet.js';
import { walletChip, bindWallet, coinIcon, coinToggle, goldMode } from '../walletui.js';
import { shareCardBtn, openShare } from '../shareui.js';
import { wishSpec } from '../sharespecs.js';

/* 星空許願池
   ──────────────────────────────────────────────────────────
   寫下（或默念）一個願望，用手指或手機把一枚硬幣投進池裡 —— 免費，投多少都可以。
   整支手機都是池子（全螢幕）；手指投法像寶可夢 GO 丟球：按住硬幣、往上一甩。
   贊助者可以改投金色的福幣（扣一枚，畫面多一點光）。
   落進水裡：硬幣沉到池底，一直留在那裡 —— 投越多，池底越亮。
   投進中央的月盞：算你厲害，多一句祝福。
   掉到池外：撿起來再投一次（福幣會退回）。

   網址：/wish（許願池）、?at=log（許願簿） */

const BLESS = [
  '願望沉進池底了。它會在那裡，陪你走到實現的那天。',
  '水面記住了你的願望。剩下的，交給明天的你。',
  '星星都看見了。去做你能做的那一步吧。',
  '硬幣落下的聲音很輕，願望卻很重。好好珍惜它。',
  '願你心想的事，一件一件，慢慢成真。',
  '池水收下了。願你今天比昨天更靠近它一點。',
  '願望說出口，就已經開始實現了。',
  '漣漪會散開，心意會留下。',
];
const BOWL = [
  '正中月盞！今晚的月亮站在你這邊。',
  '正中月盞！準頭這麼好，願望也一定瞄得準。',
  '正中月盞！好運加倍，記得把握它。',
  '正中月盞！連星星都替你鼓掌。',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function aimText(a) {
  if (!a) return '';
  const t = targetOf(a);
  const deg = Math.round(Math.atan2(t.x, START.z - t.z) * 180 / Math.PI);
  const dir = deg === 0 ? '正前方' : `偏${deg < 0 ? '左' : '右'} ${Math.abs(deg)}°`;
  return `${dir}　·　${t.d.toFixed(2)} 公尺`;
}

function hub() {
  // 全螢幕：整支手機都是許願池，按鈕浮在夜空上
  return html`
    <section class="wishfs" data-noswipe>
      <div class="pool3d pool3d--fs" id="pool"><div class="wish__float" id="wfloat" aria-hidden="true"></div></div>
      <header class="wishfs__top">
        <button class="wishfs__btn press" id="wback" aria-label="返回">${raw(icon('back'))}</button>
        <p class="wishfs__title">${raw(icon('pool'))} 星空許願池</p>
        <span class="wishfs__right">${walletChip()}<button class="wishfs__btn press" data-go="/wish?at=log" aria-label="許願簿">${raw(icon('records'))}</button></span>
      </header>
      <div class="wishfs__wish">
        <input class="wishfs__input" id="wwish" maxlength="40" placeholder="寫下願望（可以不寫，默念也行）" value="${store.drafts.wish || ''}" aria-label="你的願望">
        ${coinToggle()}
      </div>
      <p class="wish__say" id="wsay" aria-live="polite"></p>
      <p class="wish__aim" id="waim"></p>
      <p class="wishfs__hint" id="whint">按住硬幣，往上一甩</p>
      <div class="wishfs__bottom">
        <button class="wishfs__chip press" id="wmotion">${raw(icon('spark'))} 用手機投</button>
        <span id="wcardrow" hidden>${shareCardBtn('wcard', '分享')}</span>
      </div>
    </section>`;
}

function mountHub(page) {
  // 全螢幕那一層搬到 <body> 底下：頁面容器有轉場動畫（transform），
  // 留在裡面的話 position: fixed 會被困在容器裡，蓋不過 App 的頂欄與底欄
  const root = $('.wishfs', page);
  document.body.appendChild(root);
  bindWallet(root);
  // 全螢幕期間：頁面不捲動、不被下拉重新整理
  document.documentElement.classList.add('is-wishfs');
  $('#wback', root).addEventListener('click', () => (history.length > 1 ? history.back() : navigate('/')));
  const say = $('#wsay', root), aimEl = $('#waim', root), input = $('#wwish', root), float = $('#wfloat', root);
  const tell = (t) => { say.classList.remove('is-on'); void say.offsetWidth; say.textContent = t; say.classList.add('is-on'); };
  input.addEventListener('input', () => store.setDraft('wish', input.value));
  let wish = '', last = null, lastSay = '';
  const log = store.wishLog;
  $('#wcard', root).addEventListener('click', () => last && openShare(wishSpec(last, lastSay), '玄鑑-許願池'));
  const pool = mountPool($('#pool', root), {
    coins: log.filter(e => e.spot === 'pool').reverse(),
    bowlCoins: log.filter(e => e.spot === 'bowl').reverse().map(e => !!e.gold),
    isGold: () => goldMode(root),
    onAim: (a) => { aimEl.textContent = aimText(a); },
    onBeforeThrow: () => {
      // 一般硬幣免費；選了福幣才扣（扣不到就改投一般硬幣）
      const gold = goldMode(root) && spend(1, '許願池');
      wish = input.value.trim();
      tell('……');
      $('#whint', root).classList.add('is-gone');
      return { gold };
    },
    onLand: (r) => {
      if (r.spot === 'miss') {
        if (r.gold) refund(1, '許願池・掉到池外退回');
        tell(r.gold ? `${NAME}掉到池外了，已經退回錢包。再瞄準一次吧。` : '硬幣掉到池外了，撿起來再瞄準一次吧。');
        return;
      }
      last = store.addWish({ id: uid('wi'), date: dayKey(), at: new Date().toISOString(), wish, ...r });
      lastSay = r.spot === 'bowl' ? pick(BOWL) : pick(BLESS);
      tell(lastSay);
      $('#wcardrow', root).hidden = false;
      if (wish) {
        // 願望化成一行光，從水面升起、散進星空
        const el = document.createElement('span');
        el.className = 'wish__line'; el.textContent = wish;
        float.appendChild(el);
        setTimeout(() => el.remove(), fast() ? 10 : 4200);
        input.value = ''; store.setDraft('wish', '');
      }
    },
  });
  $('#wmotion', root).addEventListener('click', async (e) => {
    const b = e.currentTarget;
    const ok = await pool.armMotion();             // 權限請求在 armMotion 裡同步發出
    if (ok) {
      b.disabled = true; b.textContent = '手機已就緒';
      tell('左右傾斜手機瞄方向、前後傾斜調遠近，看好落點圈，往前輕輕一甩就投出。');
      $('#whint', root).classList.add('is-gone');
    } else toast('沒辦法讀取手機的動作感測，用手指拉也可以');
  });
  addEventListener('hashchange', function off() {
    pool.destroy(); root.remove(); document.documentElement.classList.remove('is-wishfs');
    removeEventListener('hashchange', off);
  });
}

function book() {
  const log = store.wishLog;
  if (!log.length) return html`<div class="empty reveal">${raw(icon('pool'))}
    <p>許願簿還是空的。<br>到許願池投下第一枚硬幣吧。</p>
    <button class="btn btn--primary press" data-go="/wish">去許願池</button></div>${DISCLAIMER}`;
  const bowl = log.filter(e => e.spot === 'bowl').length;
  return html`
    <section class="section" style="margin-top:0">
      <div class="wish__stats">
        <div><b>${log.length}</b><small>投下的硬幣</small></div>
        <div><b>${bowl}</b><small>正中月盞</small></div>
        <div><b>${log.filter(e => e.wish).length}</b><small>寫下的願望</small></div>
      </div>
      <div class="stack" style="gap:8px;margin-top:var(--sp-4)">
        ${log.slice(0, 120).map(e => html`<div class="card wish__entry ${e.spot === 'bowl' ? 'is-bowl' : ''}">
          <span class="wish__entry-coin ${e.gold ? '' : 'is-plain'}">${raw(coinIcon(22))}</span>
          <div><p class="card__label">${e.date}${e.spot === 'bowl' ? '　正中月盞' : ''}</p>
          <p style="margin-top:2px">${e.wish || '（默念的願望）'}</p></div>
        </div>`)}
      </div>
      <button class="tmpl press" data-go="/wish" style="margin-top:var(--sp-4)"><b>回到許願池</b><small>再投一枚</small></button>
    </section>${DISCLAIMER}`;
}

export default {
  title: (c) => (c?.query?.at === 'log' ? '許願簿' : '許願池'),
  eyebrow: 'WISHING POOL',
  render(ctx) {
    return ctx.query?.at === 'log' ? book() : hub();
  },
  mount(root, ctx) {
    $$('[data-go]', root).forEach(b => b.addEventListener('click', () => navigate(b.dataset.go)));
    if (ctx.query?.at === 'log') return;
    mountHub(root);
  },
};
