import { html, raw, $, $$, sheet, toast, copyText } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { invalidate } from '../app.js';
import { resolve } from '../router.js';
import { analyzeName, recommend, analyzeChars } from '../engines/naming.js';
import { dial } from '../motion.js';
import { DISCLAIMER, needProfile, sectionHead, kv } from './_shared.js';

const luckCls = (l) => l === '大吉' || l === '吉' ? 'luck--good' : l === '半吉' ? 'luck--half' : 'luck--bad';

export default {
  title: '姓名學', eyebrow: 'NAME STUDY',
  render({ all, profile, settings }) {
    if (!profile) return needProfile();
    const n = all?.naming;

    if (!n) return html`
      <div class="empty reveal">${raw(icon('naming'))}
        <p>這份檔案還沒填姓名。<br>到「檔案」補上姓與名即可分析。</p>
        <a class="btn btn--primary press" href="#/profile">${raw(icon('edit'))} 去填寫</a>
      </div>`;

    if (!n.ok) return html`
      <section class="card reveal track">
        <p class="card__label">筆畫待補</p>
        <p style="margin-top:var(--sp-3);color:var(--ink-2)">
          字典沒有收錄：<b style="font-family:var(--font-display);font-size:var(--step-2)">${n.unknown.join(' ')}</b>
        </p>
        <p class="hint" style="margin-top:var(--sp-3)">姓名學用的是「康熙筆畫」，和現代字形不同。你可以手動輸入，或用提示詞去問外部 LLM 再填回來。</p>
        <div class="row" style="margin-top:var(--sp-4);gap:var(--sp-2)">
          <button class="btn btn--primary press" id="fix">${raw(icon('edit'))} 手動輸入筆畫</button>
          <a class="btn btn--ghost press" href="#/prompt?t=strokes&chars=${encodeURIComponent(n.unknown.join('、'))}">${raw(icon('prompt'))} 問 LLM</a>
        </div>
      </section>
      ${DISCLAIMER}`;

    const g = n.wuge;
    const chars = [...n.surname, ...n.given];

    return html`
      <section class="card reveal track">
        <div class="row row--between row--nowrap" style="align-items:flex-start">
          <div>
            <p class="card__label">綜合評分</p>
            <h2 style="font-size:var(--step-3);margin-top:6px">${n.fullName}</h2>
            <p class="hint">康熙總筆畫 <span class="num">${n.totalStrokes}</span> · 三才 ${n.sancai.config}
              <span class="luck ${luckCls(n.sancai.luck)}">${n.sancai.luck}</span></p>
          </div>
          ${raw(dial(n.score, '姓名評分'))}
        </div>
        <p style="margin-top:var(--sp-3);font-size:var(--step--1);color:var(--ink-2);line-height:1.8">${n.sancai.detail}<br>${n.sancai.text}</p>
      </section>

      <section class="section">
        ${raw(sectionHead('五格剖象', `<button class="chip press" id="edit-strokes">${icon('edit')} 修正筆畫</button>`))}
        <div class="wuge reveal">
          <div class="wuge__chars">
            ${raw(chars.map(c => html`<div class="wuge__char">${c.ch}<i>${c.strokes}</i></div>`).join(''))}
          </div>
          <div class="wuge__lines">
            ${raw(Object.values(g).map(x => html`
              <div class="gebox press track" data-ge="${x.key}">
                <small>${x.key} · ${x.el}</small>
                <b class="num">${x.n}</b>
                <span class="luck ${luckCls(x.luck)}">${x.luck}</span>
              </div>`).join(''))}
          </div>
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">外格採「${settings.wageWaiRule === 'classic' ? '熊崎式傳統規則' : '總格−人格+1'}」，可在設定頁切換。</p>
      </section>

      <section class="section">
        ${raw(sectionHead('81 靈動數'))}
        <div class="stack">
          ${raw(Object.values(g).map(x => html`
            <div class="card reveal" style="padding:var(--sp-3) var(--sp-4)">
              <div class="row row--between">
                <span class="card__label">${x.key}　<span class="num" style="font-size:var(--step-0);color:var(--ink)">${x.n}</span></span>
                <span class="luck ${luckCls(x.luck)}">${x.luck}</span>
              </div>
              <p style="margin-top:4px;font-size:var(--step--1);color:var(--ink-2)">${x.text}</p>
            </div>`).join(''))}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('取名筆畫推薦', `<button class="chip press" id="rec-run">${icon('dice')} 重新計算</button>`))}
        <p class="hint">固定姓氏筆畫，窮舉名字的筆畫組合，依五格與三才排序。挑好組合後可產生提示詞，請 LLM 推薦實際用字。</p>
        <div class="row" style="margin:var(--sp-3) 0;gap:var(--sp-2)">
          <div class="seg" id="rec-count">
            <button class="press" data-n="2" aria-pressed="true">雙名</button>
            <button class="press" data-n="1" aria-pressed="false">單名</button>
          </div>
          <label class="hint" style="display:flex;align-items:center;gap:6px">上限
            <input class="input num" id="rec-max" type="number" min="6" max="30" value="20" style="width:74px;min-height:34px;padding:4px 8px">畫</label>
        </div>
        <div class="stack" id="rec-out"></div>
        <div class="row" style="margin-top:var(--sp-4);gap:var(--sp-2)">
          <button class="btn btn--primary press" id="rec-prompt">${raw(icon('prompt'))} 用選取組合產生提示詞</button>
          <a class="btn btn--ghost press" href="#/prompt?t=name-check">${raw(icon('search'))} 診斷現在的名字</a>
        </div>
      </section>
      ${DISCLAIMER}`;
  },

  mount(root, { all, profile, settings }) {
    const n = all?.naming;

    const openStrokeEditor = () => {
      const src = (profile.surname || '') + (profile.givenName || '');
      const cs = analyzeChars(src, profile.strokeOverrides || {});
      sheet({
        title: '修正康熙筆畫',
        body: html`
          <div class="stack" data-noswipe>
            <p class="hint">姓名學使用康熙字典筆畫：氵算 4（水）、扌算 4（手）、艹算 6（艸）、月(肉) 算 6、阝左 8（阜）／右 7（邑）。留空表示使用內建字典。</p>
            ${raw(cs.map(c => html`
              <div class="row row--between">
                <span style="font-family:var(--font-display);font-size:var(--step-2)">${c.ch}</span>
                <input class="input num" data-ch="${c.ch}" type="number" min="1" max="40"
                  value="${profile.strokeOverrides?.[c.ch] ?? c.strokes ?? ''}" style="width:110px" placeholder="未知">
              </div>`).join(''))}
          </div>`,
        actions: html`<button class="btn btn--primary btn--block press" data-save>${raw(icon('check'))} 套用</button>`,
        onMount(sr, close) {
          $('[data-save]', sr).addEventListener('click', () => {
            const ov = { ...(profile.strokeOverrides || {}) };
            $$('[data-ch]', sr).forEach(i => {
              const v = parseInt(i.value, 10);
              if (Number.isFinite(v) && v > 0) ov[i.dataset.ch] = v; else delete ov[i.dataset.ch];
            });
            store.saveProfile({ ...profile, strokeOverrides: ov });
            invalidate(); close(); toast('已更新筆畫'); resolve();
          });
        },
      });
    };
    $('#fix', root)?.addEventListener('click', openStrokeEditor);
    $('#edit-strokes', root)?.addEventListener('click', openStrokeEditor);

    if (!n?.ok) return;

    $$('[data-ge]', root).forEach(el => el.addEventListener('click', () => {
      const x = n.wuge[el.dataset.ge];
      const MEAN = {
        天格: '祖先與家族帶來的先天條件，本身吉凶影響較小，主要看與人格的搭配。',
        人格: '整張名字的核心，主個性、才能與一生運勢的主軸。',
        地格: '前運（約 36 歲前）與基礎運，也看人際與部屬。',
        外格: '社交、外在環境、他人怎麼看你。',
        總格: '後運（約 36 歲後）與一生總結。',
      };
      sheet({
        title: `${x.key}　${x.n}（${x.el}）`,
        body: html`<div class="stack">
          ${raw(kv('吉凶', `<span class="luck ${luckCls(x.luck)}">${x.luck}</span>`))}
          ${raw(kv('靈動涵義', x.text))}
          ${raw(kv('五行', x.el))}
          <p class="hint">${MEAN[x.key]}</p>
        </div>`,
      });
    }));

    // 取名推薦
    let count = 2, selected = new Set();
    const surStrokes = n.surname.map(c => c.strokes);
    const run = () => {
      const max = Math.max(6, Math.min(30, parseInt($('#rec-max', root).value, 10) || 20));
      const list = recommend(surStrokes, { count, max, top: 14, waiRule: settings.wageWaiRule });
      $('#rec-out', root).innerHTML = list.map((r, i) => html`
        <button class="pair press track" data-combo="${r.strokes.join('+')}" aria-pressed="false" style="text-align:left">
          <span class="pair__n">${r.strokes.join('·')}</span>
          <span>
            <span class="hint">三才 ${r.sancai.config} <span class="luck ${luckCls(r.sancai.luck)}">${r.sancai.luck}</span>
              · 人格 ${r.wuge.人格.n}${r.wuge.人格.luck} · 總格 ${r.wuge.總格.n}${r.wuge.總格.luck}</span>
            <span class="pair__bar" style="margin-top:6px"><i style="width:${r.score}%"></i></span>
          </span>
          <span class="num">${r.score}</span>
        </button>`).join('');
      requestAnimationFrame(() => $$('#rec-out .pair__bar i', root).forEach(b => b.style.width = b.style.width));
      $$('#rec-out .pair', root).forEach(b => b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') === 'true';
        b.setAttribute('aria-pressed', String(!on));
        b.classList.toggle('is-hot', !on);
        b.style.borderColor = !on ? 'var(--ink)' : '';
        if (on) selected.delete(b.dataset.combo); else selected.add(b.dataset.combo);
      }));
    };
    $$('#rec-count button', root).forEach(b => b.addEventListener('click', () => {
      $$('#rec-count button', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      count = Number(b.dataset.n); selected.clear(); run();
    }));
    $('#rec-run', root)?.addEventListener('click', run);
    $('#rec-max', root)?.addEventListener('change', run);
    run();

    $('#rec-prompt', root)?.addEventListener('click', () => {
      const combos = [...selected];
      const q = combos.length ? `&combos=${encodeURIComponent(combos.join('、'))}` : '';
      if (!combos.length) toast('沒有選組合，會用預設的推薦前幾名');
      location.hash = `/prompt?t=name-pick${q}`;
    });
  },
};
