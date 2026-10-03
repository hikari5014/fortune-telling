/* 手水舍：參拜前淨手
   ──────────────────────────────────────────────────────────
   照神社的正式作法，一勺水做完全部：
     一、右手拿柄杓，舀一勺水（把柄杓拖進水盤，或點一下）
     二、洗左手　　（按住左手倒水）
     三、換手，洗右手
     四、左手接水漱口（不要讓柄杓碰到嘴）
     五、再洗一次左手
     六、立起柄杓，讓剩下的水流過握柄，放回去
   每倒一次，柄杓裡的水就少一點 —— 一勺要用到最後。 */

import { html, raw, $, $$, haptic, toast } from '../ui.js';
import { navigate } from '../router.js';
import { temizuya, ladle, hand, mouth } from './art.js';
import { sleep, fast, hold, drag, mark } from './kit.js';
import { water } from './sound.js';

const STEPS = [
  { k: 'scoop', t: '舀水',   say: '右手拿起柄杓，舀一勺水。把柄杓拖進水盤裡（或直接點它）。' },
  { k: 'L',     t: '洗左手', say: '先洗左手。按住左手，把水倒上去。' },
  { k: 'R',     t: '洗右手', say: '柄杓換到左手，洗右手。' },
  { k: 'M',     t: '漱口',   say: '柄杓換回右手，倒一點水在左手掌心，用手掌的水漱口 —— 柄杓不要碰到嘴。' },
  { k: 'L2',    t: '再洗左手', say: '漱完口，再洗一次左手。' },
  { k: 'H',     t: '洗握柄', say: '把柄杓立起來，讓剩下的水順著握柄流下去，再放回原位。按住柄杓。' },
];

export function render() {
  return html`
    <section class="jinja jn-tz reveal" data-noswipe>
      <div class="jinja__sky" aria-hidden="true"><span class="jinja__moon"></span></div>
      <ol class="jn-steps" id="tz-steps">${STEPS.map((s, i) => html`<li data-i="${i}">${s.t}</li>`)}</ol>
      <div class="jn-tz__stage" id="tz-stage">
        ${raw(temizuya())}
        <span class="jn-tz__drip" aria-hidden="true"></span>
        <button class="jn-tz__ladle press" id="tz-ladle" aria-label="柄杓">${raw(ladle())}</button>
        <div class="jn-tz__targets" id="tz-targets">
          <button class="jn-tz__t jn-tz__t--L press" data-t="L" aria-label="左手" hidden>${raw(hand('L'))}<small>左手</small></button>
          <button class="jn-tz__t jn-tz__t--M press" data-t="M" aria-label="漱口" hidden>${raw(mouth())}<small>漱口</small></button>
          <button class="jn-tz__t jn-tz__t--R press" data-t="R" aria-label="右手" hidden>${raw(hand('R'))}<small>右手</small></button>
        </div>
        <span class="jn-tz__stream" id="tz-stream" aria-hidden="true"></span>
      </div>
      <p class="jn-say" id="tz-say" aria-live="polite"></p>
      <div class="jn-dots jn-dots--water" id="tz-water" aria-label="柄杓裡剩下的水">${raw('<i class="is-on"></i>'.repeat(5))}</div>
    </section>
    <section class="section" id="tz-done"></section>`;
}

export function mount(root) {
  const stage = $('#tz-stage', root), say = $('#tz-say', root);
  const ladleBtn = $('#tz-ladle', root), stream = $('#tz-stream', root);
  const drops = $$('#tz-water i', root);
  let step = 0, left = 0;

  const setStep = (i) => {
    step = i;
    $$('#tz-steps li', root).forEach((li, j) => { li.classList.toggle('is-now', j === i); li.classList.toggle('is-done', j < i); });
    if (STEPS[i]) { say.classList.remove('is-on'); void say.offsetWidth; say.textContent = STEPS[i].say; say.classList.add('is-on'); }
    $$('.jn-tz__t', root).forEach(t => { t.hidden = true; t.classList.remove('is-live'); });
    const k = STEPS[i]?.k;
    const show = k === 'L' || k === 'L2' ? 'L' : k;
    const tgt = $(`.jn-tz__t[data-t="${show}"]`, root);
    if (tgt) { tgt.hidden = false; tgt.classList.add('is-live'); }
    ladleBtn.classList.toggle('is-live', k === 'scoop' || k === 'H');
  };

  const useWater = () => { left = Math.max(0, left - 1); drops.forEach((d, i) => d.classList.toggle('is-on', i < left)); };

  /* 一、舀水：拖進水盤，或點一下 */
  const scoop = async () => {
    if (step !== 0) return;
    ladleBtn.classList.add('is-scoop');
    water(.6); haptic(10);
    await sleep(700);
    ladleBtn.classList.remove('is-scoop');
    ladleBtn.classList.add('is-full');
    left = 5; drops.forEach(d => d.classList.add('is-on'));
    setStep(1);
  };
  let dragged = false;
  drag(ladleBtn, {
    onStart: () => { dragged = false; },
    onMove: (dx, dy) => {
      if (step !== 0) return;
      if (Math.hypot(dx, dy) > 6) dragged = true;
      ladleBtn.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-30, Math.min(30, dy * .3))}deg)`;
    },
    onRelease: ({ dy }) => {
      if (step !== 0) return;
      ladleBtn.style.transform = '';
      if (!dragged || dy > 24) scoop();
    },
  });
  ladleBtn.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && step === 0) scoop(); });

  /* 二～五：按住目標倒水 */
  const pourTo = (tgt) => {
    // 柄杓移到目標上方、傾斜，水柱從杓口落到目標
    const s = stage.getBoundingClientRect(), r = tgt.getBoundingClientRect(), l = ladleBtn.getBoundingClientRect();
    const x = r.left + r.width / 2 - s.left, y = r.top - s.top;
    ladleBtn.style.left = `${x - l.width * .12}px`;
    ladleBtn.style.top = `${Math.max(0, y - l.height - 30)}px`;
    ladleBtn.classList.add('is-pour');
    stream.style.left = `${x - 5}px`; stream.style.top = `${Math.max(0, y - 34)}px`; stream.style.height = `${Math.max(34, r.height * .55)}px`;
    stream.classList.add('is-on');
  };
  const stopPour = () => { ladleBtn.classList.remove('is-pour'); ladleBtn.style.left = ''; ladleBtn.style.top = ''; stream.classList.remove('is-on'); };

  /* 每個目標都可以按住倒水；左手會用到兩次，所以 hold 完成後要重新武裝 */
  function arm(tgt) {
    const h = hold(tgt, 1000, async () => {
      stopPour(); useWater();
      tgt.classList.add('is-clean'); haptic(10);
      await sleep(450);
      tgt.classList.remove('is-clean');
      h.reset();
      setStep(step + 1);
    }, {
      when: () => !tgt.hidden,
      onStart: () => { pourTo(tgt); water(1.1); },
      onCancel: stopPour,
    });
  }
  $$('.jn-tz__t', root).forEach(arm);

  /* 六：立起柄杓洗握柄（按住柄杓） */
  hold(ladleBtn, 1200, async () => {
    useWater();
    ladleBtn.classList.remove('is-upright');
    ladleBtn.classList.add('is-rest');
    stopPour();
    finish();
  }, {
    when: () => step === 5,
    onStart: () => { ladleBtn.classList.add('is-upright'); water(1.3); },
    onCancel: () => ladleBtn.classList.remove('is-upright'),
  });

  async function finish() {
    setStep(6);
    say.textContent = '身心都清淨了。';
    mark({ temizu: true });
    haptic([8, 40, 8]);
    toast('手水完成');
    await sleep(500);
    const done = $('#tz-done', root);
    done.innerHTML = html`<div class="row reveal is-in" style="gap:var(--sp-2);justify-content:center">
      <button class="btn btn--primary press" data-at="haiden">去拜殿參拜</button>
      <button class="btn btn--ghost press" data-at="kuji">去求籤</button>
      <button class="btn btn--ghost press" data-at="">回到境內</button>
    </div>`;
    $$('[data-at]', done).forEach(b => b.addEventListener('click', () => navigate(b.dataset.at ? `/omikuji?at=${b.dataset.at}` : '/omikuji')));
  }

  setStep(0);
  if (fast()) ladleBtn.classList.add('no-motion');
}
