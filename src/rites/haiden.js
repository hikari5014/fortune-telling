/* 拜殿：參拜
   ──────────────────────────────────────────────────────────
   照真的參拜順序走，每一步都要自己動手：
     一、香油錢：從錢包挑一枚，往上甩進賽錢箱（點兩下也行）
     二、搖鈴：把鈴緒往下拉、放手，鈴就響
     三、二拜：按住鞠躬，兩次
     四、二拍手：在畫面上拍兩下
     五、祈願：在心裡說出願望（也可以寫下來），願望會變成一顆星升上去
     六、一拜：按住，最後一次鞠躬
   做完蓋一個御朱印，存進御朱印帳。 */

import { html, raw, $, $$, toast, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { navigate } from '../router.js';
import { haiden as hall, COINS, coinSVG, goshuin, hand } from './art.js';
import { bell, saisen } from '../shrine.js';
import { sleep, fast, hold, drag, mark, dayKey, wareki } from './kit.js';
import { suzu, clap, coinDrop, knock, paper } from './sound.js';
import { spend, NAME } from '../wallet.js';
import { walletChip, bindWallet, ensure } from '../walletui.js';

const STEPS = [
  { k: 'coin', t: '香油錢' }, { k: 'bell', t: '搖鈴' }, { k: 'bow2', t: '二拜' },
  { k: 'clap', t: '二拍手' }, { k: 'wish', t: '祈願' }, { k: 'bow1', t: '一拜' },
];

export function render() {
  return html`
    <section class="jinja jn-hd reveal" data-noswipe>
      <div class="jinja__sky" aria-hidden="true"><span class="jinja__moon"></span></div>
      <ol class="jn-steps" id="hd-steps">${STEPS.map((s, i) => html`<li data-i="${i}">${s.t}</li>`)}</ol>
      <div class="jn-hd__stage" id="hd-stage">
        ${raw(hall())}
        <div class="jn-hd__bell" id="hd-bell">${raw(bell())}</div>
        <div class="jn-hd__box" id="hd-box">${raw(saisen())}</div>
        <div class="jn-hd__hands" id="hd-hands" hidden>
          <span class="jn-hd__hand jn-hd__hand--l">${raw(hand('L'))}</span><span class="jn-hd__hand jn-hd__hand--r">${raw(hand('R'))}</span>
        </div>
      </div>
      <p class="jn-say" id="hd-say" aria-live="polite"></p>
      <div class="jn-hd__ctrl" id="hd-ctrl"></div>
    </section>
    <section class="section jn-scope" id="hd-done"></section>`;
}

export function mount(root, { all }) {
  const stage = $('#hd-stage', root), say = $('#hd-say', root), ctrl = $('#hd-ctrl', root);
  const bellEl = $('#hd-bell', root), boxEl = $('#hd-box', root), scene = $('.jn-hd', root);
  let coinKind = null, wish = '';
  bindWallet(root);

  const setStep = (i) => {
    $$('#hd-steps li', root).forEach((li, j) => {
      li.classList.toggle('is-now', j === i);
      li.classList.toggle('is-done', j < i);
    });
  };
  const tell = (t) => { say.classList.remove('is-on'); void say.offsetWidth; say.textContent = t; say.classList.add('is-on'); };

  /* ── 一、香油錢 ─────────────────────────────── */
  function stepCoin() {
    setStep(0);
    tell('從錢包挑一枚硬幣，往上甩進賽錢箱。');
    ctrl.innerHTML = html`
      <div class="jn-purse" id="hd-purse">
        ${COINS.map(c => html`<button class="jn-purse__coin press" data-k="${c.k}" aria-label="${c.name}">${raw(coinSVG(c.k))}<small>${c.name}</small></button>`)}
      </div>
      <p class="hint jn-ctrl__hint" id="hd-coinhint">挑好之後，按住硬幣往上甩；或再點一次直接投。</p>
      <div class="jn-wallet"><small>不論挑哪一枚，都用 1 枚${NAME}</small>${walletChip()}</div>`;
    const pick = (b) => {
      $$('.jn-purse__coin', ctrl).forEach(x => x.classList.remove('is-picked'));
      b.classList.add('is-picked');
      coinKind = Number(b.dataset.k);
      const c = COINS.find(x => x.k === coinKind);
      $('#hd-coinhint', ctrl).textContent = `${c.name}：${c.say}。往上甩，或再點一次。`;
      haptic(6);
    };
    $$('.jn-purse__coin', ctrl).forEach(b => {
      let wasPicked = false, viaPointer = false;
      // 鍵盤（Enter／空白鍵）：第一次挑、第二次投
      b.addEventListener('click', () => {
        if (viaPointer) { viaPointer = false; return; }
        if (b.classList.contains('is-picked')) throwCoin(b); else pick(b);
      });
      // 手指／滑鼠：按下就挑起來；往上甩夠快、夠高就飛出去，不夠就掉回錢包；
      // 沒有拖動、而且本來就挑好了 → 等於「再點一次」，直接投
      drag(b, {
        onStart: () => { viaPointer = true; wasPicked = b.classList.contains('is-picked'); if (!wasPicked) pick(b); b.classList.add('is-drag'); },
        onMove: (dx, dy) => { b.style.transform = `translate(${dx}px, ${Math.min(dy, 20)}px) scale(1.15)`; },
        onRelease: ({ vy, dx, dy }) => {
          b.classList.remove('is-drag');
          const still = Math.abs(dx) < 8 && Math.abs(dy) < 8;
          if (vy < -0.45 || dy < -90) { throwCoin(b); return; }
          if (still) { b.style.transform = ''; if (wasPicked) throwCoin(b); return; }
          b.animate([{ transform: b.style.transform }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.3,1.6,.5,1)' });
          b.style.transform = '';
          if (dy < -10) tell('力氣小了一點 —— 再甩用力一點。');
        },
      });
    });
  }

  async function throwCoin(btn) {
    if (ctrl.dataset.busy) return;
    if (!ensure(1)) return;
    spend(1, '神社・賽錢');
    ctrl.dataset.busy = '1';
    const k = Number(btn.dataset.k); coinKind = k;
    const from = btn.getBoundingClientRect(), to = boxEl.getBoundingClientRect(), base = stage.getBoundingClientRect();
    const fly = document.createElement('span');
    fly.className = 'jn-fly'; fly.innerHTML = coinSVG(k);
    stage.appendChild(fly);
    const x0 = from.left + from.width / 2 - base.left - 18, y0 = from.top - base.top;
    const x1 = to.left + to.width / 2 - base.left - 18, y1 = to.top - base.top - 4;
    btn.style.visibility = 'hidden';
    haptic(8);
    const peak = Math.min(y0, y1) - 120;
    await fly.animate([
      { transform: `translate(${x0}px, ${y0}px) rotateY(0) scale(1)` },
      { transform: `translate(${(x0 + x1) / 2}px, ${peak}px) rotateY(900deg) scale(.9)`, offset: .5, easing: 'cubic-bezier(.3,0,.7,1)' },
      { transform: `translate(${x1}px, ${y1}px) rotateY(1620deg) scale(.55)`, offset: .92 },
      { transform: `translate(${x1}px, ${y1 + 14}px) rotateY(1700deg) scale(.4)`, opacity: 0 },
    ], { duration: fast() ? 1 : 1100, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).finished.catch(() => {});
    fly.remove();
    coinDrop(k);
    boxEl.classList.remove('is-hit'); void boxEl.offsetWidth; boxEl.classList.add('is-hit');
    glint(x1 + 18, y1 + 6);
    haptic([10, 40, 10]);
    await sleep(700);
    delete ctrl.dataset.busy;
    stepBell();
  }

  function glint(x, y) {
    const g = document.createElement('span');
    g.className = 'jinja__glint is-on'; g.style.left = `${x}px`; g.style.top = `${y}px`;
    stage.appendChild(g); setTimeout(() => g.remove(), 900);
  }

  /* ── 二、搖鈴 ───────────────────────────────── */
  function stepBell() {
    setStep(1);
    tell('抓住鈴緒往下拉，再放手 —— 讓鈴聲告訴神明你來了。');
    ctrl.innerHTML = html`<p class="hint jn-ctrl__hint">拉一拉畫面上的紅白繩子（也可以直接點）。</p>`;
    let rung = 0, moved = false;
    bellEl.classList.add('is-live');
    const ring = (power) => {
      rung++;
      bellEl.style.setProperty('--swing', `${6 + power * 12}deg`);
      bellEl.classList.remove('is-ring'); void bellEl.offsetWidth; bellEl.classList.add('is-ring');
      suzu(.5 + power * .5);
      haptic([14, 30, 10, 30, 8]);
      if (rung === 1) setTimeout(() => { bellEl.classList.remove('is-live'); stepBow(2, 2); }, fast() ? 10 : 1500);
    };
    drag(bellEl, {
      onStart: () => { moved = false; },
      onMove: (dx, dy) => { if (dy > 4) moved = true; bellEl.style.transform = `translateY(${Math.max(0, Math.min(dy, 50)) * .5}px) rotate(${dx * .08}deg)`; },
      onRelease: ({ dy }) => {
        bellEl.style.transform = '';
        if (rung) return;
        if (!moved || dy > 30) ring(Math.min(1, Math.max(.3, dy / 60)));
        else tell('再拉下來一點。');
      },
    });
  }

  /* ── 三、六：鞠躬（長按）─────────────────────── */
  function stepBow(idx, times) {
    setStep(idx);
    let left = times;
    const word = times === 2 ? '二拜' : '一拜';
    tell(times === 2 ? '深深地鞠躬兩次。按住按鈕，彎下腰。' : '最後再深深一拜。');
    ctrl.innerHTML = html`<button class="jn-holdbtn press" id="hd-bowbtn"><span>按住　鞠躬</span></button>
      <p class="hint jn-ctrl__hint" id="hd-bowleft">${word}　還有 ${left} 次</p>`;
    const btn = $('#hd-bowbtn', ctrl);
    const h = hold(btn, 1100, async () => {
      left--;
      haptic(12);
      scene.classList.remove('is-bowing'); scene.classList.add('is-rise');
      setTimeout(() => scene.classList.remove('is-rise'), 500);
      if (left > 0) {
        $('#hd-bowleft', ctrl).textContent = `${word}　還有 ${left} 次`;
        await sleep(450); h.reset();
      } else if (times === 2) { await sleep(400); stepClap(); }
      else { await sleep(500); finish(); }
    }, { onStart: () => scene.classList.add('is-bowing'), onCancel: () => scene.classList.remove('is-bowing') });
  }

  /* ── 四、二拍手 ─────────────────────────────── */
  function stepClap() {
    setStep(3);
    tell('雙手在胸前，拍兩下。點畫面或下面的按鈕都可以。');
    const hands = $('#hd-hands', root);
    hands.hidden = false;
    ctrl.innerHTML = html`<button class="btn btn--primary press" id="hd-clapbtn">${raw(icon('spark'))} 拍手</button>
      <p class="hint jn-ctrl__hint" id="hd-claps">○ ○</p>`;
    let n = 0;
    const doClap = () => {
      if (n >= 2) return;
      n++;
      clap(); haptic(16);
      hands.classList.remove('is-clap'); void hands.offsetWidth; hands.classList.add('is-clap');
      const r = document.createElement('span'); r.className = 'jn-ripple'; hands.appendChild(r); setTimeout(() => r.remove(), 800);
      $('#hd-claps', ctrl).textContent = n === 1 ? '● ○' : '● ●';
      if (n === 2) setTimeout(() => { hands.hidden = true; stepWish(); }, fast() ? 10 : 900);
    };
    $('#hd-clapbtn', ctrl).addEventListener('click', doClap);
    stage.addEventListener('click', function once(e) { if (n >= 2) { stage.removeEventListener('click', once); return; } doClap(); });
  }

  /* ── 五、祈願 ───────────────────────────────── */
  function stepWish() {
    setStep(4);
    tell('雙手合十。先在心裡報上自己的名字和住的地方，再說出願望。');
    ctrl.innerHTML = html`
      <div class="jn-breath" id="hd-breath" aria-hidden="true"><i></i></div>
      <div class="field" style="width:min(100%,320px);margin-inline:auto">
        <label for="hd-wish" style="color:rgba(239,230,207,.7)">願望（可以不寫，只在心裡說也行）</label>
        <input class="input" id="hd-wish" maxlength="40" placeholder="例如：家人平安健康">
      </div>
      <button class="btn btn--primary press" id="hd-pray" style="margin-top:var(--sp-3)">${raw(icon('star'))} 許願</button>`;
    $('#hd-pray', ctrl).addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      wish = $('#hd-wish', ctrl).value.trim();
      const br = $('#hd-breath', ctrl); br.classList.add('is-on');
      tell('吸氣……吐氣……');
      await sleep(2600);
      // 願望化成一顆星，從胸前升到夜空
      const star = document.createElement('span');
      star.className = 'jn-wishstar'; star.textContent = wish || '';
      scene.appendChild(star);
      paper();
      await star.animate([
        { transform: 'translate(-50%, 0) scale(1)', opacity: 0 },
        { transform: 'translate(-50%, -40px) scale(1)', opacity: 1, offset: .2 },
        { transform: 'translate(-50%, -260px) scale(.25)', opacity: 1, offset: .85 },
        { transform: 'translate(-50%, -280px) scale(.15)', opacity: 0 },
      ], { duration: fast() ? 1 : 2200, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished.catch(() => {});
      star.remove();
      const sky = $('.jinja__sky', scene);
      const s = document.createElement('i'); s.className = 'jn-newstar';
      s.style.cssText = `--x:${30 + Math.random() * 40}%;--y:${6 + Math.random() * 14}%;--d:0s`;
      sky.appendChild(s);
      suzu(.25);
      stepBow(5, 1);
    });
  }

  /* ── 完成：御朱印 ───────────────────────────── */
  async function finish() {
    setStep(6);
    tell('參拜完成。');
    ctrl.innerHTML = '';
    const entry = store.addShrine({ id: uid('sh'), date: dayKey(), coin: coinKind, wish });
    mark({ haiden: true });
    const done = $('#hd-done', root);
    done.innerHTML = html`
      <div class="jn-stamp reveal is-in">
        <p class="card__label" style="text-align:center">御朱印</p>
        <div class="jn-stamp__page">${raw(goshuin(wareki()))}</div>
        <p class="hint" style="text-align:center;margin-top:var(--sp-3)">已收進御朱印帳。${entry.coin ? `香油錢 ${entry.coin} 圓。` : ''}</p>
        <div class="row" style="gap:var(--sp-2);justify-content:center;margin-top:var(--sp-3)">
          <button class="btn btn--primary press" data-at="kuji">${raw(icon('torii'))} 去求籤</button>
          <button class="btn btn--ghost press" data-at="book">御朱印帳</button>
          <button class="btn btn--ghost press" data-at="">回到境內</button>
        </div>
      </div>`;
    $$('[data-at]', done).forEach(b => b.addEventListener('click', () => navigate(b.dataset.at ? `/omikuji?at=${b.dataset.at}` : '/omikuji')));
    done.scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'start' });
    // 墨字一欄一欄寫上去，最後兩顆章「蓋」下來
    const page = $('.jn-stamp__page', done);
    page.classList.add('is-writing');
    await sleep(1500); knock(180, .5); haptic(18);
    await sleep(380); knock(200, .45); haptic(14);
    toast('御朱印蓋好了');
  }

  stepCoin();
}
