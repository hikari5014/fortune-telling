import { html, raw, $, $$, toast, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { navigate } from '../router.js';
import { DISCLAIMER, sectionHead } from './_shared.js';
import { nameOf, isPrivate } from '../privacy.js';
import { DOMAINS, GODS, godOf, domainOf } from '../temple/gods.js';
import { facade, censer, niche, altarTable, offeringSVG, tablet } from '../temple/art.js';
import { hold, sleep, fast, dayKey } from '../rites/kit.js';
import { suzu, knock, paper, coinDrop } from '../rites/sound.js';
import { mountJiao3D } from '../jiao3d.js';
import { jiaoOf } from '../engines/qian.js';
import { offer, tip } from '../payments.js';
import { spend, NAME } from '../wallet.js';
import { walletChip, bindWallet, ensure, coinIcon } from '../walletui.js';

/* 廟：選一位神明，照台灣廟裡的方式拜拜，再求一支籤
   ──────────────────────────────────────────────────────────
   廟埕（首頁）先問「想求什麼」，對到六位主神之一。進到神明座前：
     恭請移駕 → 備供品 → 點香 → 稟告 → 三拜 → 插香 → 擲筊請示
   聖筊才能求籤；求籤沿用「求籤」頁（3D 籤筒＋擲筊確認），帶著這位神明的籤詩集。
   求完回來謝神、添香油錢（用福幣，象徵性的，不扣真錢 —— 見 src/wallet.js、src/payments.js），記進功德簿。

   網址：/temple（廟埕）、?god=wenchang（祭拜）、?god=…&at=thanks（謝神）、?at=book（功德簿） */

const STEPS = ['恭請', '供品', '點香', '稟告', '三拜', '插香', '請示'];
const OIL = [1, 3, 6, 12];                  // 香油錢：幾枚福幣（象徵性，不扣真錢）
const smoke = (n = 3) => `<span class="mz-smoke" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`;

/* ── 廟埕 ───────────────────────────────────────── */
function hub() {
  const n = store.meritLog.length;
  return html`
    <section class="miao mz-hub reveal" data-noswipe>
      <div class="mz-sky" aria-hidden="true">${raw(Array.from({ length: 12 }, (_, i) => `<i style="--x:${(i * 41) % 100}%;--y:${(i * 17) % 40}%;--d:${(i % 4) * .8}s"></i>`).join(''))}</div>
      <div class="mz-front">
        ${raw(facade())}
        <div class="mz-front__censer">${raw(censer())}${raw(smoke(4))}</div>
      </div>
      <p class="mz-say is-on">今天想向神明祈求什麼？</p>
      <div class="mz-domains">
        ${DOMAINS.map(d => { const g = GODS.find(x => x.domain === d.k); return html`
          <button class="mz-domain press" data-god="${g.id}" style="--tone:${g.tone}">
            <b>${d.t}</b><small>${d.d}</small><span>${g.name}</span>
          </button>`; })}
      </div>
    </section>

    <section class="section">
      <div class="stack" style="gap:8px">
        <button class="tmpl press" data-go="/qian"><b>直接求籤</b><small>不拜拜，直接搖籤筒（六十籤或觀音一百籤）</small></button>
        <button class="tmpl press" data-go="/temple?at=book"><b>功德簿</b><small>${n ? `拜過 ${n} 次` : '拜完、添過香油錢就會記在這裡'}</small></button>
        <button class="tmpl press" data-go="/wish"><b>許願池</b><small>出了廟，到星空下的水池投一枚${NAME}</small></button>
      </div>
      <p class="hint" style="margin-top:var(--sp-3)">
        拜拜的方式依台灣廟宇最常見的作法；各廟不盡相同。香油錢用的是 App 裡的${NAME}，不會扣真錢。
      </p>
    </section>
    ${DISCLAIMER}`;
}

/* ── 神明座前：祭拜 ─────────────────────────────── */
function rite(g) {
  return html`
    <section class="miao mz-rite reveal" data-noswipe style="--tone:${g.tone}">
      <ol class="jn-steps" id="mz-steps">${STEPS.map((t, i) => html`<li data-i="${i}">${t}</li>`)}</ol>
      <div class="mz-stage" id="mz-stage">
        <div class="mz-shrine">
          ${raw(niche())}
          <div class="mz-beam" aria-hidden="true"></div>
          <div class="mz-presence">${raw(tablet(g.name))}</div>
          <div class="mz-curtain mz-curtain--l"></div><div class="mz-curtain mz-curtain--r"></div>
        </div>
        <div class="mz-altar">
          ${raw(altarTable())}
          <span class="mz-flame mz-flame--l" aria-hidden="true"></span><span class="mz-flame mz-flame--r" aria-hidden="true"></span>
          <div class="mz-plates" id="mz-plates">${raw('<span class="mz-plate"></span>'.repeat(3))}</div>
          <div class="mz-burner" id="mz-burner">${raw(censer())}<span class="mz-sticks" id="mz-sticks"></span>${raw(smoke(3))}</div>
        </div>
      </div>
      <p class="mz-say" id="mz-say" aria-live="polite"></p>
      <div class="mz-ctrl" id="mz-ctrl"></div>
    </section>
    ${DISCLAIMER}`;
}

function mountRite(root, g, { profile }) {
  const say = $('#mz-say', root), ctrl = $('#mz-ctrl', root), scene = $('.mz-rite', root);
  const domain = domainOf(g.domain);
  let ask = g.asks[0], wish = '', placed = [], j3d = null;
  const entry = { id: uid('mr'), date: dayKey(), god: g.id, godName: g.name, domain: g.domain, ask: '', wish: '', offerings: [], oil: 0 };
  addEventListener('hashchange', function off() { j3d?.destroy(); removeEventListener('hashchange', off); });

  const setStep = (i) => $$('#mz-steps li', root).forEach((li, j) => { li.classList.toggle('is-now', j === i); li.classList.toggle('is-done', j < i); });
  const tell = (t) => { say.classList.remove('is-on'); void say.offsetWidth; say.textContent = t; say.classList.add('is-on'); };

  /* 一、恭請移駕 */
  function invite() {
    setStep(0);
    tell(`恭請${g.name}移駕。按住按鈕，誠心恭請。`);
    ctrl.innerHTML = html`<button class="jn-holdbtn press" id="mz-invite"><span>按住　恭請</span></button>`;
    hold($('#mz-invite', ctrl), 1400, async () => {
      scene.classList.add('is-arrived');
      suzu(.6); haptic([10, 60, 14]);
      tell(`${g.name}已移駕座前。${g.say}`);
      ctrl.innerHTML = '';
      await sleep(2200);
      offerings();
    }, { onStart: () => scene.classList.add('is-calling'), onCancel: () => scene.classList.remove('is-calling') });
  }

  /* 二、備供品：挑三樣放上供桌 */
  function offerings() {
    setStep(1);
    tell(`為${g.short}準備三樣供品。點一下就擺上供桌 —— 每一樣都有它的意思。`);
    const pool = [...g.offerings.good, ...g.offerings.avoid.map(a => ({ ...a, bad: true }))];
    // 再放兩樣「一般」的供品，讓選擇不只是照抄答案
    for (const k of ['flowers', 'apple', 'cake', 'tea']) if (!pool.some(p => p.k === k) && pool.length < 9) pool.push({ k, t: { flowers: '鮮花', apple: '水果', cake: '糕餅', tea: '清茶' }[k], why: '一般供品' });
    ctrl.innerHTML = html`<div class="mz-tray">${pool.map(p => html`
      <button class="mz-item press" data-k="${p.k}" data-bad="${p.bad ? 1 : ''}">${raw(offeringSVG(p.k))}<b>${p.t}</b><small>${p.why}</small></button>`)}</div>`;
    $$('.mz-item', ctrl).forEach(b => b.addEventListener('click', () => {
      if (placed.length >= 3 || b.disabled) return;
      const p = pool.find(x => x.k === b.dataset.k && (x.bad ? '1' : '') === b.dataset.bad);
      if (p.bad) {
        b.classList.remove('is-no'); void b.offsetWidth; b.classList.add('is-no');
        tell(`${p.t}：${p.why}。換一樣吧。`); haptic(6); return;
      }
      b.disabled = true; b.classList.add('is-used');
      const slot = $$('.mz-plate', root)[placed.length];
      slot.innerHTML = offeringSVG(p.k);
      slot.classList.add('is-on');
      placed.push(p);
      knock(380, .2); haptic(8);
      tell(`${p.t}（${p.why}）擺上了。${placed.length < 3 ? `再選 ${3 - placed.length} 樣。` : ''}`);
      if (placed.length === 3) { entry.offerings = placed.map(x => x.t); setTimeout(light, fast() ? 10 : 900); }
    }));
  }

  /* 三、點香：把香湊到燭火上，按住 */
  function light() {
    setStep(2);
    tell('取三炷香，湊到燭火上點燃。按住，等香頭紅起來。');
    ctrl.innerHTML = html`<button class="mz-incense press" id="mz-light" aria-label="按住點香">
      <span class="mz-incense__sticks">${raw('<i></i>'.repeat(3))}</span><small>按住點香</small></button>`;
    const b = $('#mz-light', ctrl);
    hold(b, 1300, async () => {
      b.classList.add('is-lit'); haptic(10);
      b.insertAdjacentHTML('beforeend', smoke(3));
      tell('香點好了。輕輕搖熄火焰，不要用嘴吹。');
      await sleep(1500);
      report();
    }, { onStart: () => b.classList.add('is-lighting'), onCancel: () => b.classList.remove('is-lighting') });
  }

  /* 四、稟告：報上姓名、生辰、住址，說出祈求的事 */
  function report() {
    setStep(3);
    const who = profile && !isPrivate(profile) ? nameOf(profile) : '（你的名字）';
    const b = profile?.birth;
    const born = b ? `${b.y} 年 ${b.m} 月 ${b.d} 日生` : '（出生年月日）';
    const city = profile?.city || '（住的地方）';
    tell('雙手持香，在心裡向神明稟告。');
    ctrl.innerHTML = html`
      <div class="mz-report">
        <p>弟子 <b>${who}</b>，${born}，住在 <b>${city}</b>。<br>今日來到玄鑑宮，向${g.name}稟告 ——</p>
        <div class="mz-asks">${g.asks.map((a, i) => html`<button class="chip press" data-a="${a}" aria-pressed="${i === 0}">${a}</button>`)}</div>
        <div class="field" style="margin-top:var(--sp-3)">
          <label for="mz-wish">想說得更具體（可以不填）</label>
          <input class="input" id="mz-wish" maxlength="50" placeholder="${domain?.t === '學業考試' ? '例如：下個月的會考' : '例如：家人平安'}">
        </div>
        <button class="btn btn--primary press" id="mz-done" style="margin-top:var(--sp-3)">稟告完畢</button>
      </div>`;
    $$('.mz-asks .chip', ctrl).forEach(c => c.addEventListener('click', () => {
      $$('.mz-asks .chip', ctrl).forEach(x => x.setAttribute('aria-pressed', 'false'));
      c.setAttribute('aria-pressed', 'true'); ask = c.dataset.a;
    }));
    $('#mz-done', ctrl).addEventListener('click', () => {
      wish = $('#mz-wish', ctrl).value.trim();
      entry.ask = ask; entry.wish = wish;
      bow();
    });
  }

  /* 五、三拜 */
  function bow() {
    setStep(4);
    let left = 3;
    tell('持香三拜。按住按鈕，彎腰。');
    ctrl.innerHTML = html`<button class="jn-holdbtn press" id="mz-bow"><span>按住　拜</span></button><p class="hint mz-ctrl__hint" id="mz-left">還有 3 拜</p>`;
    const h = hold($('#mz-bow', ctrl), 1000, async () => {
      left--; haptic(12);
      scene.classList.remove('is-bowing');
      $('#mz-left', ctrl).textContent = left ? `還有 ${left} 拜` : '拜好了';
      if (left) { await sleep(400); h.reset(); } else { await sleep(500); plant(); }
    }, { onStart: () => scene.classList.add('is-bowing'), onCancel: () => scene.classList.remove('is-bowing') });
  }

  /* 六、插香：把香插進香爐 */
  function plant() {
    setStep(5);
    tell('把香插進香爐。點香爐，或把下面的香拖上去。');
    ctrl.innerHTML = html`<button class="mz-incense is-lit press" id="mz-plant"><span class="mz-incense__sticks">${raw('<i></i>'.repeat(3))}</span>${raw(smoke(2))}<small>點這裡插香</small></button>`;
    const burner = $('#mz-burner', root);
    const doPlant = async () => {
      if (burner.classList.contains('is-planted')) return;
      burner.classList.add('is-planted');
      $('#mz-sticks', root).innerHTML = '<i></i><i></i><i></i>';
      ctrl.innerHTML = '';
      knock(240, .25); haptic(10);
      tell('香插好了，煙裊裊往上。');
      await sleep(1400);
      seek();
    };
    burner.addEventListener('click', doPlant, { once: true });
    $('#mz-plant', ctrl).addEventListener('click', doPlant);
  }

  /* 七、擲筊請示：可以求籤嗎？ */
  function seek() {
    setStep(6);
    tell(`請示${g.short}：可以為「${wish || ask}」求一支籤嗎？擲筊看看。`);
    ctrl.innerHTML = html`
      <div class="jiao3d" id="mz-jiao" data-noswipe></div>
      <div class="row" style="gap:var(--sp-2);justify-content:center">
        <button class="btn btn--primary press" id="mz-cast">${raw(icon('dice'))} 擲筊</button>
        <button class="chip press" id="mz-motion">${raw(icon('spark'))} 用手機擲筊</button>
      </div>`;
    j3d?.destroy();
    j3d = mountJiao3D($('#mz-jiao', ctrl), {
      onThrow: () => { $('#mz-cast', ctrl).disabled = true; },
      onResult: (faces) => answered(jiaoOf(faces)),
    });
    $('#mz-cast', ctrl).addEventListener('click', () => j3d.toss(1));
    $('#mz-jiao', ctrl).scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'center' });
    $('#mz-motion', ctrl).addEventListener('click', async (e) => {
      const ok = await j3d.armMotion();
      if (ok) { e.currentTarget.disabled = true; e.currentTarget.textContent = '手機已就緒'; }
      else toast('沒辦法讀取手機的動作感測，用按鈕或往上甩也可以');
    });
  }

  function answered(r) {
    const btn = $('#mz-cast', ctrl);
    if (r.kind === '聖筊') {
      tell(`聖筊 —— ${g.short}允准了。到籤筒前求一支籤吧。`);
      suzu(.4); haptic([10, 40, 16]);
      store.addMerit({ ...entry });
      // 求籤頁：帶著這位神明，問題預先填好
      store.setDraft('qianQ', wish || ask);
      // 擲筊按鈕那一排換成「去求籤」，放在筊的上方，一眼就看得到
      btn.closest('.row').remove();
      $('#mz-jiao', ctrl).insertAdjacentHTML('beforebegin', html`<div class="mz-go reveal is-in">
        <button class="btn btn--primary press" id="mz-go">${raw(icon('dice'))} 到籤筒前求籤</button></div>`);
      $('#mz-go', root).addEventListener('click', () => navigate(`/qian?god=${g.id}&m=${entry.id}`));
      say.scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    tell(r.kind === '笑筊'
      ? '笑筊 —— 神明笑而不答，可能問題還不夠清楚。想一想，再請示一次。'
      : '陰筊 —— 今天時機未到。可以換個方式問，或改日再來；想再請示也可以。');
    btn.disabled = false;
  }

  invite();
}

/* ── 謝神、添香油錢 ─────────────────────────────── */
function thanks(g, q) {
  const e = store.meritLog.find(x => x.id === q.m);
  return html`
    <section class="miao mz-rite mz-thanks reveal is-arrived" data-noswipe style="--tone:${g.tone}">
      <div class="mz-stage">
        <div class="mz-shrine">${raw(niche())}<div class="mz-beam" aria-hidden="true"></div><div class="mz-presence">${raw(tablet(g.name))}</div></div>
      </div>
      <p class="mz-say is-on">${e?.poem ? `求得${e.poem}，感謝${g.name}指點。` : `感謝${g.name}。`}</p>
      <div class="mz-ctrl">
        <div style="display:flex;justify-content:center;margin-bottom:var(--sp-2)">${walletChip()}</div>
        <p class="hint" style="color:rgba(243,233,207,.75)">添香油錢，隨喜就好（用${NAME}，不會扣真錢）</p>
        <div class="mz-oil" id="mz-oil">${OIL.map((n, i) => html`<button class="chip press" data-n="${n}" aria-pressed="${i === 0}">${raw(coinIcon(16))} ${n} 枚</button>`)}</div>
        <div class="mz-box" id="mz-box"><b>功德箱</b><span class="mz-hongbao" id="mz-hb" hidden></span></div>
        <button class="btn btn--primary press" id="mz-give">${raw(icon('heart'))} 投入功德箱</button>
      </div>
    </section>
    <section class="section">
      <div class="stack" style="gap:8px">
        <button class="tmpl press" id="mz-tip"><b>打賞開發者</b><small>喜歡這個 App 的話，可以支持一下開發者（即將開放）</small></button>
        <button class="tmpl press" data-go="/temple?at=book"><b>功德簿</b><small>看看拜過的紀錄</small></button>
        <button class="tmpl press" data-go="/temple"><b>回到廟埕</b><small>再拜別的神明</small></button>
      </div>
      <p class="hint" style="margin-top:var(--sp-3)">香油錢只是儀式的一部分，用的是 App 裡的${NAME}。「打賞開發者」與${NAME}儲值之後才會是真的付款，錢是給做這個 App 的人，不是給任何一間廟。</p>
    </section>
    ${DISCLAIMER}`;
}

function mountThanks(root, g, q) {
  bindWallet(root);
  let amount = OIL[0];
  $$('#mz-oil .chip', root).forEach(c => c.addEventListener('click', () => {
    $$('#mz-oil .chip', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
    c.setAttribute('aria-pressed', 'true'); amount = Number(c.dataset.n);
  }));
  $('#mz-give', root).addEventListener('click', async (e) => {
    if (!ensure(amount)) return;
    spend(amount, `香油錢・${g.short}`);
    e.currentTarget.disabled = true;
    const hb = $('#mz-hb', root); hb.hidden = false; hb.textContent = amount;
    hb.classList.add('is-in');
    paper();
    await sleep(900);
    coinDrop(500); haptic([10, 40, 10]);
    await offer({ amount, purpose: '香油錢', to: g.name });
    if (q.m && store.meritLog.some(x => x.id === q.m)) store.updateMerit(q.m, { coins: (store.meritLog.find(x => x.id === q.m)?.coins || 0) + amount });
    else store.addMerit({ id: uid('mr'), date: dayKey(), god: g.id, godName: g.name, domain: g.domain, coins: amount, offerings: [] });
    toast(`添了 ${amount} 枚${NAME}的香油錢，記進功德簿了`);
  });
  $('#mz-tip', root).addEventListener('click', async () => {
    const r = await tip({});
    if (!r.ok) toast('打賞功能還在準備中，謝謝你的心意');
  });
}

/* ── 功德簿 ─────────────────────────────────────── */
function book() {
  const log = store.meritLog;
  if (!log.length) return html`<div class="empty reveal">${raw(icon('records'))}
    <p>功德簿還是空的。<br>到廟埕選一位神明，拜完就會記在這裡。</p>
    <button class="btn btn--primary press" data-go="/temple">去廟埕</button></div>${DISCLAIMER}`;
  const total = log.reduce((s, e) => s + (e.coins || 0), 0);
  const oldYuan = log.reduce((s, e) => s + (e.oil || 0), 0);      // 0.40 版記的是「元」
  return html`
    <section class="section" style="margin-top:0">
      <p class="hint">共 ${log.length} 筆，香油錢合計 ${total} 枚${NAME}${oldYuan ? `（另有舊紀錄 ${oldYuan} 元）` : ''}。</p>
      <div class="stack" style="gap:8px;margin-top:var(--sp-3)">
        ${log.map(e => html`<div class="card mz-merit">
          <p class="card__label">${e.date}　${e.godName}</p>
          <p style="margin-top:4px">${e.ask || '謝神'}${e.wish ? `：${e.wish}` : ''}</p>
          <p class="hint" style="margin-top:4px">${e.offerings?.length ? `供品：${e.offerings.join('、')}　` : ''}${e.poem ? `求得${e.poem}　` : ''}${e.coins ? `香油錢 ${e.coins} 枚${NAME}` : e.oil ? `香油錢 ${e.oil} 元` : ''}</p>
        </div>`)}
      </div>
      <button class="tmpl press" data-go="/temple" style="margin-top:var(--sp-4)"><b>回到廟埕</b><small>再拜別的神明</small></button>
    </section>${DISCLAIMER}`;
}

export default {
  title: (c) => { const q = c?.query || {}; const g = godOf(q.god); return q.at === 'book' ? '功德簿' : g ? g.name : '廟'; },
  eyebrow: 'TEMPLE',
  render(ctx) {
    const q = ctx.query || {};
    const g = godOf(q.god);
    if (q.at === 'book') return book();
    if (g && q.at === 'thanks') return thanks(g, q);
    if (g) return rite(g);
    return hub();
  },
  mount(root, ctx) {
    const q = ctx.query || {};
    const g = godOf(q.god);
    $$('[data-go]', root).forEach(b => b.addEventListener('click', () => navigate(b.dataset.go)));
    $$('[data-god]', root).forEach(b => b.addEventListener('click', () => navigate(`/temple?god=${b.dataset.god}`)));
    if (q.at === 'book') return;
    if (g && q.at === 'thanks') return mountThanks(root, g, q);
    if (g) return mountRite(root, g, ctx);
  },
};
