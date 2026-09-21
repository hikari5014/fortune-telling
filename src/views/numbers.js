import { html, raw, $, $$, sheet, toast, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { analyzeNumber, analyzePlate, matchNumbers, luckyPicks, lifePath, STARS } from '../engines/numbers.js';
import { dial, runCountUps, observeReveal } from '../motion.js';
import { DISCLAIMER, sectionHead, kv } from './_shared.js';

const kindCls = (k) => k === '吉' ? 'luck--good' : k === '凶' ? 'luck--bad' : 'luck--half';

function resultBlock(r) {
  return html`
    <div class="card track" style="margin-top:var(--sp-3)">
      <div class="row row--between row--nowrap" style="align-items:flex-start">
        <div style="min-width:0">
          <p class="card__label">分析結果</p>
          <p class="num" style="font-size:var(--step-2);margin-top:4px;word-break:break-all">${r.input || '—'}</p>
          <p class="hint">吉 ${r.good} · 凶 ${r.bad} · 連接 ${r.neutral} · 總和 <span class="num">${r.sum}</span>（${r.luck81.n} ${r.luck81.luck}）</p>
        </div>
        ${raw(dial(r.score, '號碼評分'))}
      </div>
      <div class="digits" style="margin-top:var(--sp-3)">
        ${raw([...r.digits].map(d => html`<span class="digit ${r.hot.includes(d) ? 'is-hot' : ''}">${d}</span>`).join(''))}
      </div>
      <div class="pairs" style="margin-top:var(--sp-4)">
        ${raw(r.items.map(i => html`
          <div class="pair press track" data-star="${i.name}">
            <span class="pair__n">${i.pair}</span>
            <span>
              <span class="hint">${i.text || '—'}</span>
              <span class="pair__bar" style="margin-top:6px"><i style="width:${Math.round((i.score + 4) / 8 * 100)}%"></i></span>
            </span>
            <span class="luck ${kindCls(i.kind)}">${i.name}</span>
          </div>`).join(''))}
      </div>
      <p style="margin-top:var(--sp-4);font-size:var(--step--1);color:var(--ink-2);line-height:1.8">${r.summary}</p>
    </div>`;
}

export default {
  title: '數字', eyebrow: 'NUMEROLOGY',
  render({ all, profile, settings }) {
    const lp = all?.life || (profile ? lifePath(profile.birth.y, profile.birth.m, profile.birth.d) : null);
    const drafts = store.drafts;

    return html`
      ${lp ? html`
      <section class="card reveal track">
        <div class="row row--between row--nowrap" style="align-items:flex-start">
          <div>
            <p class="card__label">生命靈數</p>
            <h2 style="font-family:var(--font-num);font-size:var(--step-5);line-height:1;margin-top:6px">${lp.main}</h2>
            <p class="hint">生日數 ${lp.birth} · 數字總和 ${lp.total}${lp.isMaster ? ' · 大師數' : ''}</p>
          </div>
          <div style="max-width:230px;font-size:var(--step--1);color:var(--ink-2);text-align:left;line-height:1.7">${lp.text}</div>
        </div>
      </section>` : ''}

      <section class="section">
        ${raw(sectionHead('號碼磁場'))}
        <div class="card reveal" data-noswipe>
          <div class="row" style="gap:var(--sp-2);margin-bottom:var(--sp-3)">
            <div class="seg" id="num-kind">
              <button class="press" data-k="phone" aria-pressed="true">手機</button>
              <button class="press" data-k="plate" aria-pressed="false">車牌</button>
              <button class="press" data-k="any" aria-pressed="false">任意</button>
            </div>
            <div class="seg" id="num-mode">
              <button class="press" data-m="slide" aria-pressed="true">連續</button>
              <button class="press" data-m="block" aria-pressed="false">兩兩</button>
            </div>
          </div>
          <div class="field">
            <label for="num-in">輸入號碼</label>
            <input class="input num" id="num-in" value="${drafts.numInput || profile?.phone || '0912345678'}"
              placeholder="0912345678 或 ABC-1368" autocomplete="off" inputmode="text">
          </div>
          <div class="row" style="margin-top:var(--sp-3);gap:var(--sp-2)">
            <button class="btn btn--primary press" id="num-go">${raw(icon('search'))} 分析</button>
            ${profile?.phone ? html`<button class="btn btn--ghost btn--sm press" data-fill="${profile.phone}">我的手機</button>` : ''}
            ${profile?.plate ? html`<button class="btn btn--ghost btn--sm press" data-fill="${profile.plate}">我的車牌</button>` : ''}
            <button class="btn btn--ghost btn--sm press" id="num-rand">${raw(icon('dice'))} 隨機</button>
          </div>
          <div id="num-out"></div>
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('雙號匹配'))}
        <div class="card reveal" data-noswipe>
          <div class="grid grid--2">
            <div class="field"><label for="m-a">A</label><input class="input num" id="m-a" value="${profile?.phone || '0912345678'}"></div>
            <div class="field"><label for="m-b">B</label><input class="input num" id="m-b" value="0987654321"></div>
          </div>
          <button class="btn btn--primary press" id="m-go" style="margin-top:var(--sp-3)">${raw(icon('link'))} 比對</button>
          <div id="m-out"></div>
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('幸運數字'))}
        <div class="card reveal" data-noswipe>
          <p class="hint">依生命靈數 ${lp ? lp.main : '—'} 與你想強化的磁場，推薦可放進號碼的兩位組合。</p>
          <div class="row" style="margin:var(--sp-3) 0;gap:5px" id="lk-focus">
            ${raw(['天醫', '生氣', '延年', '伏位'].map((k, i) => html`
              <button class="chip press" data-f="${k}" aria-pressed="${i === 0}">${k}</button>`).join(''))}
          </div>
          <div id="lk-out" class="digits"></div>
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('八星速查'))}
        <div class="grid grid--auto">
          ${raw(Object.entries(STARS).map(([k, v]) => html`
            <div class="card press track reveal" style="padding:var(--sp-3) var(--sp-4)">
              <div class="row row--between">
                <p class="card__label">${k}</p>
                <span class="luck ${kindCls(v.kind)}">${v.kind}</span>
              </div>
              <p class="num" style="margin-top:4px;color:var(--ink-2);font-size:var(--step--1)">${v.keys.join(' ')}</p>
              <p class="hint" style="margin-top:4px">${v.text}</p>
            </div>`).join(''))}
        </div>
      </section>

      <section class="section">
        <div class="row" style="gap:var(--sp-2)">
          <a class="btn btn--primary press" href="#/prompt?t=number-pick">${raw(icon('prompt'))} 號碼挑選顧問</a>
          <a class="btn btn--ghost press" href="#/prompt?t=freeform">${raw(icon('spark'))} 自由問答</a>
        </div>
      </section>
      ${DISCLAIMER}`;
  },

  mount(root, { profile }) {
    let kind = 'phone', mode = 'slide';
    const out = $('#num-out', root);

    const run = () => {
      const v = $('#num-in', root).value.trim();
      store.setDraft('numInput', v);
      const r = kind === 'plate' ? analyzePlate(v, { mode }) : analyzeNumber(v, { mode });
      out.innerHTML = resultBlock(r) + (r.letterHint ? html`<p class="hint" style="margin-top:var(--sp-2)">${r.letterHint}</p>` : '');
      runCountUps(out);
      requestAnimationFrame(() => $$('.pair__bar i', out).forEach(b => { const w = b.style.width; b.style.width = '0'; requestAnimationFrame(() => b.style.width = w); }));
      $$('[data-star]', out).forEach(el => el.addEventListener('click', () => {
        const s = STARS[el.dataset.star];
        if (!s) return;
        sheet({ title: el.dataset.star, body: html`<div class="stack">
          ${raw(kv('性質', s.kind))}${raw(kv('組合', `<span class="num">${s.keys.join('、')}</span>`))}
          <p style="color:var(--ink-2)">${s.text}</p></div>` });
      }));
      haptic(8);
    };
    $('#num-go', root).addEventListener('click', run);
    $('#num-in', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    $$('[data-fill]', root).forEach(b => b.addEventListener('click', () => { $('#num-in', root).value = b.dataset.fill; run(); }));
    $('#num-rand', root).addEventListener('click', () => {
      $('#num-in', root).value = kind === 'plate'
        ? 'ABC-' + String(Math.floor(Math.random() * 9000) + 1000)
        : '09' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
      run();
    });
    $$('#num-kind button', root).forEach(b => b.addEventListener('click', () => {
      $$('#num-kind button', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); kind = b.dataset.k; run();
    }));
    $$('#num-mode button', root).forEach(b => b.addEventListener('click', () => {
      $$('#num-mode button', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); mode = b.dataset.m; run();
    }));
    run();

    const mOut = $('#m-out', root);
    $('#m-go', root).addEventListener('click', () => {
      const r = matchNumbers($('#m-a', root).value, $('#m-b', root).value, { mode });
      mOut.innerHTML = html`
        <div class="card" style="margin-top:var(--sp-3)">
          <div class="row row--between row--nowrap" style="align-items:flex-start">
            <div><p class="card__label">匹配度</p>
              <p class="hint" style="margin-top:6px">A ${r.a.score} 分 · B ${r.b.score} 分${r.bridge ? ` · 銜接 ${r.bridge.pair}「${r.bridge.name}」` : ''}</p>
              <p style="margin-top:var(--sp-2);color:var(--ink-2);font-size:var(--step--1)">${r.text}</p></div>
            ${raw(dial(r.score, '匹配度'))}
          </div>
        </div>`;
      runCountUps(mOut);
      haptic(8);
    });

    const lkOut = $('#lk-out', root);
    const lp = profile ? lifePath(profile.birth.y, profile.birth.m, profile.birth.d) : { main: 1 };
    const drawLucky = (focus) => {
      lkOut.innerHTML = luckyPicks(lp.main, focus, 10)
        .map(x => html`<span class="digit is-hot" style="width:auto;padding:0 12px" title="${x.star}">${x.pair}</span>`).join('');
    };
    $$('#lk-focus .chip', root).forEach(b => b.addEventListener('click', () => {
      $$('#lk-focus .chip', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); drawLucky(b.dataset.f);
    }));
    drawLucky('天醫');
  },
};
