/* 授與所：求籤
   ──────────────────────────────────────────────────────────
     一、納初穗料：把一枚百圓放進櫃台的小箱子
     二、搖籤箱：抓著六角籤箱左右甩（也可以搖手機、或點它）
     三、倒過來：把籤箱倒過來，一支籤棒從小孔滑出來，記下籤號
     四、找抽屜：到籤棚找那一格（一百個小抽屜），拉開拿出摺好的籤紙
     五、打開籤紙：往兩邊拉開
   凶 → 綁在結籤處再走；其他 → 帶回家。

   跟拜殿的參拜完全分開：沒參拜也能來抽，順序自己決定。 */

import { html, raw, $, $$, toast, haptic, copyText } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { navigate } from '../router.js';
import { goFocus } from '../views/_shared.js';
import { saveReading } from '../verify.js';
import { drawNumber, slipOf, banOf, omikujiText } from '../engines/omikuji.js';
import { kujibako, kujiStick, rack } from '../shrine.js';
import { juyosho, coinSVG } from './art.js';
import { sleep, fast, drag, mark, listenShake, askMotion, onLeave } from './kit.js';
import { rattle, coinDrop, knock, paper, suzu } from './sound.js';
import { shareCardBtn, openShare } from '../shareui.js';
import { omikujiSpec } from '../sharespecs.js';

const NEED = 5;                                   // 搖幾下

/** 籤號的國字（抽屜上的小字）：一、十二、九十九、百 */
const D = '〇一二三四五六七八九';
const num = (n) => (n === 100 ? '百' : `${n >= 10 ? (n >= 20 ? D[Math.floor(n / 10)] : '') + '十' : ''}${n % 10 ? D[n % 10] : ''}`);

export function slipHTML(s, question) {
  const lv = s.levelInfo;
  return html`
    <div class="omi-slip reveal is-in" data-tone="${lv.tone}">
      <div class="omi-slip__head">
        <span class="omi-slip__tag">觀音百籤</span>
        <span class="omi-slip__ban">${banOf(s.n)}</span>
        <span class="omi-slip__lv">${s.level}</span>
      </div>
      <!-- 直書：一句一欄、由右往左，一個字一格 -->
      <div class="omi-poem" lang="zh-Hant">${s.lines.map((l, i) => html`<p style="--i:${i}">${[...l].map(c => html`<i>${c}</i>`)}</p>`)}</div>
      <p class="omi-say">${lv.say}</p>
      <dl class="omi-topics">
        ${s.topics.map(t => html`<div><dt>${t.t}<small>${t.jp}</small></dt><dd>${t.text}</dd></div>`)}
      </dl>
      ${question ? html`<p class="omi-q">所問：${question}</p>` : ''}
      <p class="omi-src">籤詩：觀音百籤（淺草寺系，古籤原文）　解說：本 App 自撰，僅供參考</p>
    </div>`;
}

export function render() {
  return html`
    <section class="jinja jn-kj reveal" data-noswipe>
      <div class="jinja__sky" aria-hidden="true"><span class="jinja__moon"></span></div>
      <ol class="jn-steps" id="kj-steps">
        ${['初穗料', '搖籤箱', '倒過來', '找抽屜', '開籤紙'].map((t, i) => html`<li data-i="${i}">${t}</li>`)}
      </ol>
      ${raw(juyosho())}
      <div class="jn-kj__counter" id="kj-counter">
        <div class="jn-kj__offer">
          <button class="jn-kj__coin press" id="kj-coin" aria-label="把百圓放進初穗料箱">${raw(coinSVG(100))}</button>
          <span class="jn-kj__obox" id="kj-obox"><b>初穗料</b><small>百圓</small></span>
        </div>
        <div class="jn-kujiwrap" id="kj-wrap">
          <button class="jn-kujibox press" id="kj-box" aria-label="六角籤箱" disabled>${raw(kujibako())}</button>
          <div class="jn-stickwrap" id="kj-stick"></div>
        </div>
      </div>
      <div class="jn-dots" id="kj-dots" aria-hidden="true">${raw('<i></i>'.repeat(NEED))}</div>
      <p class="jn-say" id="kj-say" aria-live="polite"></p>
      <div class="jn-kj__ctrl" id="kj-ctrl"></div>
      <div class="jn-cab" id="kj-cab" hidden>
        <p class="jn-cab__title">籤　棚</p>
        <div class="jn-cab__grid" id="kj-grid">
          ${raw(Array.from({ length: 100 }, (_, i) => `<button class="jn-drawer" data-n="${i + 1}" aria-label="第${i + 1}番"><span>${num(i + 1)}</span></button>`).join(''))}
        </div>
      </div>
      <div class="jn-fold" id="kj-fold" hidden>
        <button class="jn-fold__paper press" id="kj-paper" aria-label="打開籤紙">
          <span class="jn-fold__l"></span><span class="jn-fold__m"><b id="kj-foldban"></b></span><span class="jn-fold__r"></span>
        </button>
        <p class="jinja__hint">往兩邊拉開（或點一下）</p>
      </div>
    </section>

    <section class="section jn-scope">
      <div class="field">
        <label for="kj-q">想問的事（可以不填）</label>
        <input class="input" id="kj-q" maxlength="40" placeholder="例如：今年的運氣如何" value="${store.drafts.omikujiQ || ''}">
      </div>
    </section>
    <section class="section jn-scope" id="kj-result"></section>`;
}

export function mount(root, { all }) {
  const say = $('#kj-say', root), ctrl = $('#kj-ctrl', root);
  const box = $('#kj-box', root), coin = $('#kj-coin', root), obox = $('#kj-obox', root);
  const dots = $$('#kj-dots i', root), stickEl = $('#kj-stick', root);
  const cab = $('#kj-cab', root), fold = $('#kj-fold', root), result = $('#kj-result', root);
  const q = $('#kj-q', root);
  q.addEventListener('input', () => store.setDraft('omikujiQ', q.value));
  let step = -1, shakes = 0, stop = () => {}, current = null;
  onLeave(() => stop());

  const setStep = (i) => {
    step = i;
    $$('#kj-steps li', root).forEach((li, j) => { li.classList.toggle('is-now', j === i); li.classList.toggle('is-done', j < i); });
  };
  const tell = (t) => { say.classList.remove('is-on'); void say.offsetWidth; say.textContent = t; say.classList.add('is-on'); };

  /* ── 一、初穗料 ─────────────────────────────── */
  function start() {
    setStep(0);
    shakes = 0; dots.forEach(d => d.classList.remove('is-on'));
    stickEl.innerHTML = ''; box.classList.remove('is-flip'); box.disabled = true;
    coin.hidden = false; coin.style.visibility = ''; coin.disabled = false;
    cab.hidden = true; fold.hidden = true; result.innerHTML = '';
    tell('求籤之前，先把百圓的初穗料放進小箱子。點一下硬幣。');
  }

  coin.addEventListener('click', async () => {
    if (step !== 0) return;
    coin.disabled = true;
    const motion = askMotion();               // iOS 的權限只能在點擊當下要
    const a = coin.getBoundingClientRect(), b = obox.getBoundingClientRect();
    await coin.animate([
      { transform: 'none' },
      { transform: `translate(${(b.left - a.left) / 2}px, -50px) rotateY(540deg)`, offset: .5 },
      { transform: `translate(${b.left - a.left + b.width / 2 - a.width / 2}px, ${b.top - a.top}px) rotateY(1080deg) scale(.4)`, opacity: 0 },
    ], { duration: fast() ? 1 : 800, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }).finished.catch(() => {});
    coin.style.visibility = 'hidden';
    coinDrop(100);
    obox.classList.add('is-paid'); haptic([8, 30, 8]);
    const ok = await motion;
    shakeStep(ok && (store.settings.omikujiShake || 'mid') !== 'off');
  });

  /* ── 二、搖籤箱 ─────────────────────────────── */
  function shakeStep(useMotion) {
    setStep(1);
    box.disabled = false;
    box.classList.add('is-live');
    tell(useMotion ? '抓住籤箱左右甩，或直接搖手機。籤棒會在裡面喀啦喀啦響。' : '抓住籤箱左右甩幾下（點它也可以）。');
    stop = useMotion ? listenShake(() => shakeOnce(1)) : () => {};
  }

  function shakeOnce(power = 1) {
    if (step !== 1) return;
    shakes++;
    dots[shakes - 1]?.classList.add('is-on');
    rattle(); haptic(12 + power * 8);
    box.classList.remove('is-shake'); void box.offsetWidth; box.classList.add('is-shake');
    if (shakes >= NEED) { stop(); box.classList.remove('is-live'); flipStep(); }
  }

  // 拖著甩：方向每換一次、而且幅度夠大，就算搖一下
  let lastDir = 0, lastX = 0, pushed = false;
  drag(box, {
    onStart: () => { lastDir = 0; lastX = 0; pushed = false; },
    onMove: (dx) => {
      if (step === 1) {
        box.style.transform = `translateX(${dx * .6}px) rotate(${dx * .15}deg)`;
        const dir = Math.sign(dx - lastX);
        if (dir && dir !== lastDir && Math.abs(dx - lastX) > 3) {
          if (lastDir && Math.abs(dx) > 18) { shakeOnce(Math.min(1, Math.abs(dx) / 80)); pushed = true; }
          lastDir = dir;
        }
        lastX = dx;
      }
    },
    onRelease: ({ dx, dy }) => {
      box.style.transform = '';
      if (step === 1 && !pushed && Math.abs(dx) < 8 && Math.abs(dy) < 8) shakeOnce(.6);   // 點一下＝搖一下
      if (step === 2 && (dy > 30 || (Math.abs(dx) < 8 && Math.abs(dy) < 8))) flip();
    },
  });
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (step === 1) shakeOnce(.6); else if (step === 2) flip();
  });

  /* ── 三、倒過來 ─────────────────────────────── */
  function flipStep() {
    setStep(2);
    tell('搖好了。把籤箱倒過來 —— 往下拉，或點一下。');
    box.classList.add('is-live');
  }
  async function flip() {
    if (step !== 2) return;
    step = 2.5;
    box.classList.remove('is-live');
    const n = drawNumber();
    current = slipOf(n);
    box.classList.add('is-flip');
    knock(300, .25);
    await sleep(650);
    stickEl.innerHTML = kujiStick(banOf(n));
    rattle(); haptic(10);
    await sleep(1000);
    box.classList.remove('is-flip');
    tell(`${banOf(n)}。記住這個號碼，到籤棚找那一格抽屜。`);
    await sleep(700);
    cabinetStep();
  }

  /* ── 四、籤棚 ───────────────────────────────── */
  function cabinetStep() {
    setStep(3);
    cab.hidden = false;
    const n = current.n;
    const row = Math.ceil(n / 10);
    const hintRow = () => $$('.jn-drawer', cab).slice((row - 1) * 10, row * 10).forEach(d => d.classList.add('is-row'));
    cab.scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'center' });
    let misses = 0;
    // 找不到的人：五秒後那一排會微微亮起來
    const tip = setTimeout(hintRow, fast() ? 0 : 5000);
    $$('.jn-drawer', cab).forEach(d => d.onclick = async () => {
      if (step !== 3) return;
      const k = Number(d.dataset.n);
      if (k !== n) {
        misses++;
        d.classList.remove('is-wrong'); void d.offsetWidth; d.classList.add('is-wrong');
        knock(500, .15); haptic(6);
        if (misses >= 2) hintRow();
        tell(misses >= 3 ? `不是這一格。${banOf(n)}在第 ${Math.ceil(n / 10)} 排，亮起來的那一排。` : '不是這一格，再找找。');
        return;
      }
      clearTimeout(tip);
      step = 3.5;
      $$('.jn-drawer.is-row', cab).forEach(x => x.classList.remove('is-row'));
      d.classList.add('is-open');
      knock(160, .5); haptic([10, 30, 10]);
      tell('找到了。抽屜裡有一張摺好的籤紙。');
      await sleep(900);
      openFold();
    });
  }

  /* ── 五、打開籤紙 ───────────────────────────── */
  function openFold() {
    setStep(4);
    cab.hidden = true;
    fold.hidden = false;
    $('#kj-foldban', root).innerHTML = [...banOf(current.n)].map(c => `<i>${c}</i>`).join('');
    paper();
    fold.scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'center' });
    const paperBtn = $('#kj-paper', root);
    let opened = false;
    const open = async () => {
      if (opened) return; opened = true;
      paperBtn.classList.add('is-open');
      paper(); haptic(10);
      await sleep(700);
      fold.hidden = true;
      showSlip();
    };
    drag(paperBtn, {
      onMove: (dx) => { if (!opened) paperBtn.style.setProperty('--pull', Math.min(1, Math.abs(dx) / 80)); },
      onRelease: ({ dx, dy }) => {
        if (Math.abs(dx) > 50 || (Math.abs(dx) < 8 && Math.abs(dy) < 8)) open();
        else paperBtn.style.setProperty('--pull', 0);
      },
    });
    paperBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(); });
  }

  /* ── 籤紙 ───────────────────────────────────── */
  function showSlip() {
    setStep(5);
    const s = current, question = q.value.trim();
    const bad = s.levelInfo.tone === 'bad';
    mark({ kuji: { n: s.n, ban: banOf(s.n), level: s.level } });
    tell(bad ? '凶也不必擔心 —— 把籤綁在結籤處，壞運就留在神社了。' : '收好這張籤，帶回家。');
    if (s.level === '大吉') suzu(.6);
    result.innerHTML = html`
      ${raw(slipHTML(s, question))}
      <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-4);justify-content:center">
        ${bad
          ? html`<button class="btn btn--primary press" id="kj-tie">${raw(icon('pin'))} 綁在結籤處</button>`
          : html`<button class="btn btn--primary press" id="kj-keep">${raw(icon('down'))} 帶回家（存到紀錄）</button>`}
        <button class="btn btn--ghost press" id="kj-ask">${raw(icon('prompt'))} 請 LLM 解籤</button>
        ${shareCardBtn('kj-card')}
        <button class="btn btn--ghost press" id="kj-copy">${raw(icon('copy'))} 複製</button>
        <button class="btn btn--ghost press" id="kj-again">${raw(icon('refresh'))} 再求一次</button>
      </div>
      <div id="kj-rack" hidden></div>
      <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-3);justify-content:center">
        <button class="chip press" data-at="haiden">去拜殿參拜</button>
        <button class="chip press" data-at="">回到境內</button>
      </div>`;
    haptic(bad ? 8 : [10, 50, 16]);
    setTimeout(() => result.scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'start' }), 120);
    $$('[data-at]', result).forEach(b => b.addEventListener('click', () => navigate(b.dataset.at ? `/omikuji?at=${b.dataset.at}` : '/omikuji')));

    const text = omikujiText(s, question);
    $('#kj-copy', result).addEventListener('click', () => copyText(text, '籤詩已複製'));
    $('#kj-card', result).addEventListener('click', () => openShare(omikujiSpec(s, banOf(s.n), question), `玄鑑-神籤${s.n}`));
    $('#kj-ask', result).addEventListener('click', () => goFocus({ all, label: `神籤 ${banOf(s.n)} ${s.level}`, text,
      question: `我在神社抽到了觀音百籤的${banOf(s.n)}（${s.level}）。請用白話解釋這首籤詩在說什麼${question ? `，並針對「${question}」給我建議` : ''}。` }));
    $('#kj-again', result).addEventListener('click', () => { start(); $('.jn-kj', root).scrollIntoView({ behavior: fast() ? 'auto' : 'smooth' }); });
    $('#kj-keep', result)?.addEventListener('click', (e) => {
      saveReading({ kind: 'omikuji', question, text, profile: all?.profile || null });
      e.currentTarget.disabled = true;
      e.currentTarget.innerHTML = `${icon('check')} 已帶回家`;
      toast('存到紀錄了');
    });
    $('#kj-tie', result)?.addEventListener('click', tie);
  }

  async function tie(e) {
    e.currentTarget.disabled = true;
    const holder = $('#kj-rack', result);
    holder.innerHTML = `<div class="jn-rackwrap">${rack()}<span class="jn-knot" id="kj-knot"></span></div>
      <p class="jinja__hint">把不好的運留在這裡，輕輕鬆鬆回家。</p>`;
    holder.hidden = false;
    $('.omi-slip', result).classList.add('is-fold');
    paper();
    await sleep(700);
    holder.scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'center' });
    await sleep(400);
    $('#kj-knot', result).classList.add('is-on');
    knock(260, .3); haptic([8, 40, 8]);
    toast('綁好了。凶也會轉吉');
  }

  start();
}
