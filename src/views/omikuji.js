import { html, raw, $, $$, toast, haptic, copyText } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { observeReveal } from '../motion.js';
import { DISCLAIMER, sectionHead, goFocus } from './_shared.js';
import { drawNumber, slipOf, banOf, omikujiText, LEVELS } from '../engines/omikuji.js';
import { torii, bell, saisen, coin, kujibako, kujiStick, rack } from '../shrine.js';
import { saveReading } from '../verify.js';

/* おみくじ：星空下的神社
   ──────────────────────────────────────────────────────────
   流程：點賽錢箱投一枚百圓 → 鈴響、二拜二拍手一拜 → 出現御神籤箱
   → 搖（手機真的搖，或點箱子）三下 → 箱子倒過來、籤棒從孔裡滑出來 → 打開籤紙。
   抽到凶可以把籤綁在結籤處再走 —— 神社本來就是這樣做的。

   搖手機用 devicemotion。iOS 要先問權限，而且**只能在使用者點擊的當下問**，
   所以在投錢那一下順便問；拒絕了也沒關係，點箱子一樣能搖。 */

const NEED = 3;                                   // 搖幾下籤才會出來
const SENSE = { soft: 9, mid: 13, hard: 19 };     // 加速度的變化量門檻（m/s²）

const fast = () => document.documentElement.dataset.motion === 'off'
  || matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise(r => setTimeout(r, fast() ? 10 : ms));

/** 手機搖一下就呼叫 onShake。回傳取消監聽的函式 */
function listenShake(onShake, level) {
  const th = SENSE[level];
  if (!th || typeof DeviceMotionEvent === 'undefined') return () => {};
  let prev = null, last = 0;
  const h = (e) => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || a.x == null) return;
    const v = [a.x, a.y, a.z || 0];
    if (prev) {
      const d = Math.hypot(v[0] - prev[0], v[1] - prev[1], v[2] - prev[2]);
      const now = Date.now();
      if (d > th && now - last > 320) { last = now; onShake(); }
    }
    prev = v;
  };
  addEventListener('devicemotion', h);
  return () => removeEventListener('devicemotion', h);
}

/** iOS 13+ 的動作感測器權限：一定要在點擊事件裡同步呼叫 */
function askMotion() {
  const D = typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : null;
  if (!D || typeof D.requestPermission !== 'function') return Promise.resolve(!!D);
  return D.requestPermission().then(r => r === 'granted').catch(() => false);
}

function slipHTML(s, question) {
  const lv = s.levelInfo;
  return html`
    <div class="omi-slip reveal is-in" data-tone="${lv.tone}">
      <div class="omi-slip__head">
        <span class="omi-slip__tag">觀音百籤</span>
        <span class="omi-slip__ban">${banOf(s.n)}</span>
        <span class="omi-slip__lv">${s.level}</span>
      </div>
      ${s.lines.length ? html`<div class="omi-poem">${s.lines.map((l, i) => html`<p style="--i:${i}">${l}</p>`)}</div>` : ''}
      <p class="omi-say">${lv.say}</p>
      <dl class="omi-topics">
        ${s.topics.map(t => html`<div><dt>${t.t}<small>${t.jp}</small></dt><dd>${t.text}</dd></div>`)}
      </dl>
      ${question ? html`<p class="omi-q">所問：${question}</p>` : ''}
      <p class="omi-src">籤詩：觀音百籤（淺草寺系，古籤原文）　解說：本 App 自撰，僅供參考</p>
    </div>`;
}

export default {
  title: '神籤', eyebrow: 'OMIKUJI',
  render() {
    return html`
      <section class="jinja reveal" data-noswipe>
        <div class="jinja__sky" aria-hidden="true">
          <span class="jinja__moon"></span>
          ${raw(Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${(i * 23) % 60}%;--d:${(i % 5) * .7}s"></i>`).join(''))}
        </div>
        <div class="jinja__gate">
          ${raw(torii())}
          <div class="jinja__bell" id="jn-bell">${raw(bell())}</div>
          <button class="jinja__box press" id="jn-box" aria-label="投一枚百圓進賽錢箱">${raw(saisen())}</button>
          <span class="jinja__coin" id="jn-coin" aria-hidden="true" hidden>${raw(coin())}</span>
          <span class="jinja__glint" id="jn-glint" aria-hidden="true"></span>
        </div>
        <div class="jinja__ground" aria-hidden="true"></div>
        <p class="jinja__hint" id="jn-hint">點賽錢箱，投一枚百圓</p>
        <p class="jinja__bow" id="jn-bow" aria-live="polite" hidden></p>
      </section>

      <section class="section jn-scope" id="jn-kuji" hidden>
        ${raw(sectionHead('御神籤'))}
        <div class="field" style="margin-bottom:var(--sp-4)">
          <label for="jn-q">想問的事（可以不填）</label>
          <input class="input" id="jn-q" maxlength="40" placeholder="例如：今年的運氣如何" value="${store.drafts.omikujiQ || ''}">
        </div>
        <div class="jn-kujiwrap" id="jn-kujiwrap">
          <button class="jn-kujibox press" id="jn-kujibox" aria-label="搖御神籤箱">${raw(kujibako())}</button>
          <div class="jn-stickwrap" id="jn-stickwrap"></div>
        </div>
        <div class="jn-dots" id="jn-dots" aria-hidden="true">${raw('<i></i>'.repeat(NEED))}</div>
        <p class="jinja__hint" id="jn-khint"></p>
      </section>

      <section class="section jn-scope" id="jn-result"></section>
      ${DISCLAIMER}`;
  },

  mount(root, { all }) {
    const S = store.settings;
    const sense = S.omikujiShake || 'mid';
    let step = 'offer';
    let shakes = 0;
    let stopShake = () => {};
    let current = null;

    const box = $('#jn-box', root), coinEl = $('#jn-coin', root), bellEl = $('#jn-bell', root);
    const hint = $('#jn-hint', root), bow = $('#jn-bow', root);
    const kuji = $('#jn-kuji', root), kujibox = $('#jn-kujibox', root);
    const stickwrap = $('#jn-stickwrap', root), dots = $$('#jn-dots i', root), khint = $('#jn-khint', root);
    const result = $('#jn-result', root);
    const q = $('#jn-q', root);
    q.addEventListener('input', () => store.setDraft('omikujiQ', q.value));

    // 換頁時把搖晃監聽收掉
    const off = () => { stopShake(); removeEventListener('hashchange', off); };
    addEventListener('hashchange', off);

    /* ── 一、投錢 ─────────────────────────────── */
    box.addEventListener('click', async () => {
      if (step !== 'offer') return;
      step = 'praying';
      const motion = askMotion();          // 一定要在點擊當下同步發出去
      hint.textContent = '';
      haptic(10);
      await throwCoin();
      box.classList.add('is-hit');
      bellEl.classList.add('is-ring');
      haptic([12, 60, 12]);
      await sleep(500);
      await prayer();
      box.classList.remove('is-hit');
      bellEl.classList.remove('is-ring');
      const ok = await motion;
      openKuji(ok && sense !== 'off');
    });

    /** 硬幣從下面拋上去、落進擋板縫 */
    async function throwCoin() {
      const g = $('.jinja__gate', root).getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const x = b.left + b.width / 2 - g.left - 16;
      const top = b.top - g.top;
      coinEl.style.left = `${x}px`;
      coinEl.style.top = `${top - 16}px`;         // 以下的位移都從「箱口」起算
      coinEl.hidden = false;
      if (fast()) { coinEl.hidden = true; return; }
      const a = coinEl.animate([
        { transform: `translate(0, ${g.height - top + 40}px) rotateY(0) scale(1.15)`, opacity: 0 },
        { transform: `translate(0, ${g.height - top - 20}px) rotateY(180deg) scale(1.1)`, opacity: 1, offset: .12 },
        { transform: 'translate(0, -110px) rotateY(900deg) scale(.9)', opacity: 1, offset: .55, easing: 'cubic-bezier(.3,0,.7,1)' },
        { transform: 'translate(0, 8px) rotateY(1440deg) scale(.55)', opacity: 1, offset: .92 },
        { transform: 'translate(0, 16px) rotateY(1500deg) scale(.4)', opacity: 0 },
      ], { duration: 1300, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
      await a.finished.catch(() => {});
      coinEl.hidden = true;
      // 錢落下去的那一下：縫口閃一下
      const gl = $('#jn-glint', root);
      gl.style.left = `${x + 16}px`; gl.style.top = `${top + 6}px`;
      gl.classList.remove('is-on'); void gl.offsetWidth; gl.classList.add('is-on');
    }

    /** 二拜、二拍手、一拜 —— 字一個一個亮起來 */
    async function prayer() {
      bow.hidden = false;
      hint.style.visibility = 'hidden';
      const seq = ['二拜', '二拍手', '一拜'];
      for (const w of seq) {
        bow.textContent = w;
        bow.classList.remove('is-on'); void bow.offsetWidth; bow.classList.add('is-on');
        if (w === '二拍手') { haptic(14); await sleep(260); haptic(14); }
        await sleep(620);
      }
      bow.hidden = true;
      hint.style.visibility = '';
    }

    /* ── 二、搖籤 ─────────────────────────────── */
    function openKuji(useMotion) {
      step = 'shake';
      shakes = 0;
      dots.forEach(d => d.classList.remove('is-on'));
      stickwrap.innerHTML = '';
      kujibox.classList.remove('is-flip');
      kuji.hidden = false;
      khint.textContent = useMotion ? '搖一搖手機，或點籤箱搖三下' : '點籤箱搖三下';
      kuji.scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'center' });
      stopShake = useMotion ? listenShake(shakeOnce, sense) : () => {};
    }

    function shakeOnce() {
      if (step !== 'shake') return;
      shakes++;
      dots[shakes - 1]?.classList.add('is-on');
      kujibox.classList.remove('is-shake'); void kujibox.offsetWidth; kujibox.classList.add('is-shake');
      haptic(18);
      if (shakes >= NEED) { step = 'falling'; stopShake(); setTimeout(dropStick, fast() ? 10 : 520); }
    }
    kujibox.addEventListener('click', shakeOnce);

    /** 箱子倒過來，籤棒從孔裡滑出來 */
    async function dropStick() {
      const n = drawNumber();
      current = slipOf(n);
      khint.textContent = '';
      kujibox.classList.add('is-flip');
      await sleep(640);
      stickwrap.innerHTML = kujiStick(banOf(n));
      haptic(10);
      await sleep(1100);
      kujibox.classList.remove('is-flip');
      khint.textContent = `${banOf(n)}　—— 對應的籤紙打開了`;
      await sleep(500);
      showSlip();
    }

    /* ── 三、籤紙 ─────────────────────────────── */
    function showSlip() {
      step = 'done';
      const s = current;
      const question = q.value.trim();
      const bad = s.levelInfo.tone === 'bad';
      result.innerHTML = html`
        ${raw(sectionHead('籤紙'))}
        ${raw(slipHTML(s, question))}
        <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-4);justify-content:center">
          ${bad
            ? html`<button class="btn btn--primary press" id="jn-tie">${raw(icon('pin'))} 綁在結籤處再走</button>`
            : html`<button class="btn btn--primary press" id="jn-keep">${raw(icon('down'))} 帶回家（存到紀錄）</button>`}
          <button class="btn btn--ghost press" id="jn-ask">${raw(icon('prompt'))} 請 LLM 解籤</button>
          <button class="btn btn--ghost press" id="jn-copy">${raw(icon('copy'))} 複製</button>
          <button class="btn btn--ghost press" id="jn-again">${raw(icon('refresh'))} 再求一次</button>
        </div>
        <div id="jn-rack" hidden></div>`;
      observeReveal(result);
      haptic(bad ? 8 : [10, 50, 16]);
      setTimeout(() => result.scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'start' }), 120);

      const text = omikujiText(s, question);
      $('#jn-copy', result).addEventListener('click', () => copyText(text, '籤詩已複製'));
      $('#jn-ask', result).addEventListener('click', () => goFocus({ all, label: `神籤 ${banOf(s.n)} ${s.level}`, text,
        question: `我在神社抽到了觀音百籤的${banOf(s.n)}（${s.level}）。請用白話解釋這首籤詩在說什麼${question ? `，並針對「${question}」給我建議` : ''}。` }));
      $('#jn-again', result).addEventListener('click', again);
      $('#jn-keep', result)?.addEventListener('click', (e) => {
        saveReading({ kind: 'omikuji', question, text, profile: all?.profile || null });
        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = `${icon('check')} 已帶回家`;
        toast('存到紀錄了');
      });
      $('#jn-tie', result)?.addEventListener('click', tie);
    }

    /** 凶籤：摺成細條、飛到結籤處綁上去 */
    async function tie(e) {
      e.currentTarget.disabled = true;
      const holder = $('#jn-rack', result);
      holder.innerHTML = `<div class="jn-rackwrap">${rack()}<span class="jn-knot" id="jn-knot"></span></div><p class="jinja__hint">把不好的運留在這裡，輕輕鬆鬆回家。</p>`;
      holder.hidden = false;
      const slip = $('.omi-slip', result);
      slip.classList.add('is-fold');
      await sleep(700);
      holder.scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'center' });
      await sleep(400);
      $('#jn-knot', result).classList.add('is-on');
      haptic([8, 40, 8]);
      toast('綁好了。凶也會轉吉');
    }

    function again() {
      result.innerHTML = '';
      kuji.hidden = true;
      step = 'offer';
      hint.textContent = '再投一枚百圓，就能再求一次';
      $('.jinja', root).scrollIntoView({ behavior: fast() ? 'auto' : 'smooth', block: 'start' });
    }

    observeReveal(root);
  },
};

export { LEVELS };
