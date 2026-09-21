import { html, raw, $, $$, sheet, copyText, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { draw, toText, SPREADS } from '../engines/tarot.js';
import { observeReveal } from '../motion.js';
import { DISCLAIMER, sectionHead, kv } from './_shared.js';

export default {
  title: '塔羅', eyebrow: 'TAROT',
  render() {
    const d = store.drafts;
    return html`
      <section class="card reveal track" data-noswipe>
        <div class="field"><label for="tq">要問的事</label>
          <input class="input" id="tq" value="${d.tarotQ || ''}" placeholder="例如：這段關係接下來會怎麼走？" maxlength="60"></div>
        <div class="field" style="margin-top:var(--sp-3)"><label for="spread">牌陣</label>
          <select class="select" id="spread">
            ${SPREADS.map(s => html`<option value="${s.key}" ${s.key === (d.tarotSpread || 'three') ? 'selected' : ''}>${s.name}（${s.n} 張）</option>`)}
          </select></div>
        <p class="hint" id="sp-desc" style="margin-top:var(--sp-2)"></p>
        <div class="switch" id="allow-rev" role="switch" tabindex="0" aria-checked="${d.tarotRev !== false}" style="margin-top:var(--sp-2)">
          <span>允許逆位</span><span class="switch__box"></span>
        </div>
        <button class="btn btn--primary btn--block press" id="shuffle" style="margin-top:var(--sp-4)">
          ${raw(icon('dice'))} 洗牌並抽牌
        </button>
      </section>

      <section id="table" class="section"></section>
      ${DISCLAIMER}`;
  },

  mount(root) {
    const desc = $('#sp-desc', root);
    const sel = $('#spread', root);
    const syncDesc = () => { desc.textContent = SPREADS.find(s => s.key === sel.value).desc; };
    sel.addEventListener('change', () => { syncDesc(); store.setDraft('tarotSpread', sel.value); });
    syncDesc();
    $('#tq', root).addEventListener('input', (e) => store.setDraft('tarotQ', e.target.value));

    const sw = $('#allow-rev', root);
    const toggle = () => {
      const v = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(v));
      store.setDraft('tarotRev', v);
    };
    sw.addEventListener('click', toggle);
    sw.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

    const table = $('#table', root);

    $('#shuffle', root).addEventListener('click', async () => {
      const allowReversed = sw.getAttribute('aria-checked') === 'true';
      const res = draw({ spread: sel.value, allowReversed });
      const fast = document.documentElement.dataset.motion === 'off';

      table.innerHTML = html`
        ${raw(sectionHead(res.spread.name))}
        <div class="deck" id="deck">
          ${res.cards.map((c, i) => html`
            <div class="tcard is-back" data-i="${i}">
              <div class="tcard__inner"></div>
            </div>`)}
        </div>
        <div id="detail"></div>`;

      const cells = $$('#deck .tcard', table);
      for (let i = 0; i < res.cards.length; i++) {
        await new Promise(r => setTimeout(r, fast ? 10 : 230));
        const c = res.cards[i], el = cells[i];
        el.classList.remove('is-back');
        el.classList.add('is-flip');
        if (c.reversed) el.classList.add('is-rev');
        el.innerHTML = html`
          <span class="tcard__slot">${c.slot}</span>
          <div class="tcard__inner">
            <span class="tcard__sym">${c.sym}</span>
            <b>${c.name}</b>
            <small>${c.reversed ? '逆位' : '正位'}</small>
          </div>
          <small style="font-size:9px;line-height:1.35">${c.meaning}</small>`;
        haptic(8);
      }

      const plain = toText(res, $('#tq', root).value.trim());
      $('#detail', table).innerHTML = html`
        <div class="stack" style="margin-top:var(--sp-5)">
          ${res.cards.map(c => html`
            <div class="card track" style="padding:var(--sp-3) var(--sp-4)">
              <div class="row row--between">
                <span class="card__label">${c.slot}</span>
                <span class="badge ${c.reversed ? 'badge--dash' : 'badge--solid'}">${c.reversed ? '逆位' : '正位'}</span>
              </div>
              <p style="font-family:var(--font-display);font-size:var(--step-1);margin-top:4px">${c.full}</p>
              <p class="hint" style="margin-top:2px">${c.meaning}${c.arcana === '小' ? `　·　${c.el}元素．${c.theme}` : '　·　大阿爾克那'}</p>
            </div>`)}
        </div>
        ${res.note.length ? html`
          <div class="card card--invert" style="margin-top:var(--sp-4)">
            <p class="card__label">牌面整體</p>
            <div style="margin-top:var(--sp-2);line-height:1.9">
              ${res.note.map(n => html`<p>・${n}</p>`)}
            </div>
          </div>` : ''}
        <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-4)">
          <button class="btn btn--primary press" id="ask">${raw(icon('prompt'))} 請 LLM 解牌</button>
          <button class="btn btn--ghost press" id="copy-cards">${raw(icon('copy'))} 複製牌面</button>
          <button class="btn btn--ghost press" id="redraw">${raw(icon('refresh'))} 重抽</button>
        </div>`;
      observeReveal(table);

      $('#copy-cards', table).addEventListener('click', () => copyText(plain, '牌面已複製'));
      $('#redraw', table).addEventListener('click', () => { table.innerHTML = ''; scrollTo({ top: 0, behavior: 'smooth' }); });
      $('#ask', table).addEventListener('click', () => {
        store.setDraft('tarotResult', plain);
        location.hash = `/prompt?t=tarot&q=${encodeURIComponent($('#tq', root).value.trim())}`;
      });
      setTimeout(() => $('#detail', table).scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    });
  },
};
