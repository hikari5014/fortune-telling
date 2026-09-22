import { html, raw, $, $$, sheet, toast, copyText, confirmSheet, md, fmtDate, download } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { resolve } from '../router.js';
import { DISCLAIMER, sectionHead, doShare } from './_shared.js';

export default {
  title: '解讀紀錄', eyebrow: 'READINGS',
  render({ query }) {
    const recs = store.records;
    const whos = [...new Set(recs.map(r => r.who).filter(Boolean))];
    if (!recs.length) return html`
      <div class="empty reveal">${raw(icon('records'))}
        <p>還沒有任何解讀。<br>到「提示詞」產生問句，貼給 LLM，再把回覆貼回來。</p>
        <a class="btn btn--primary press" href="#/prompt">${raw(icon('prompt'))} 去產生提示詞</a>
      </div>${DISCLAIMER}`;

    return html`
      <section class="section" style="margin-top:0">
        ${raw(sectionHead(`共 ${recs.length} 筆`, `<button class="chip press" id="export">${icon('down')} 匯出</button>`))}
        <div class="row" style="gap:5px;margin-bottom:var(--sp-3)" id="filter">
          <button class="chip press" data-who="" aria-pressed="true">全部</button>
          ${raw(whos.map(w => html`<button class="chip press" data-who="${w}" aria-pressed="false">${w}</button>`).join(''))}
        </div>
        <div class="stack" id="list">
          ${raw(recs.map(r => html`
            <button class="rec press track reveal" data-id="${r.id}" data-who="${r.who || ''}">
              <div class="rec__meta">
                <span>${r.templateName}</span><span>·</span><span>${r.who || '—'}</span><span>·</span><span>${fmtDate(r.createdAt)}</span>
              </div>
              <div class="rec__body">${r.content.slice(0, 160)}</div>
            </button>`).join(''))}
        </div>
      </section>
      ${DISCLAIMER}`;
  },
  mount(root, { query }) {
    const open = (id) => {
      const r = store.records.find(x => x.id === id);
      if (!r) return;
      sheet({
        title: r.templateName,
        body: html`
          <div class="rec__meta" style="margin-bottom:var(--sp-3)">
            <span>${r.who || '—'}</span><span>·</span><span>${fmtDate(r.createdAt)}</span>
          </div>
          <div class="md">${raw(md(r.content))}</div>`,
        actions: html`<div class="row" style="gap:var(--sp-2)">
          <button class="btn btn--ghost press" data-copy style="flex:1">${raw(icon('copy'))} 複製內容</button>
          <button class="btn btn--ghost press" data-share>${raw(icon('share'))} 長圖</button>
          <button class="btn btn--ghost press" data-prompt>${raw(icon('prompt'))} 原提示詞</button>
          <button class="btn btn--ghost press" data-del>${raw(icon('trash'))}</button>
        </div>`,
        onMount(sr, close) {
          $('[data-copy]', sr).addEventListener('click', () => copyText(r.content));
          $('[data-share]', sr).addEventListener('click', async () => {
            const { recordCard } = await import('../sharecards.js');
            doShare(() => recordCard(r), `玄鑑-${r.templateName || '解讀'}.png`);
          });
          $('[data-prompt]', sr).addEventListener('click', () => {
            close();
            setTimeout(() => sheet({
              title: '當時使用的提示詞',
              body: html`<div class="preview">${r.prompt}</div>`,
              actions: html`<button class="btn btn--primary btn--block press" data-c>${raw(icon('copy'))} 複製</button>`,
              onMount(s2) { $('[data-c]', s2).addEventListener('click', () => copyText(r.prompt)); },
            }), 300);
          });
          $('[data-del]', sr).addEventListener('click', async () => {
            close();
            if (await confirmSheet('刪除紀錄', '這筆解讀會永久刪除。', '刪除')) {
              store.removeRecord(r.id); toast('已刪除'); resolve();
            }
          });
        },
      });
    };
    $$('.rec', root).forEach(b => b.addEventListener('click', () => open(b.dataset.id)));
    $$('#filter .chip', root).forEach(b => b.addEventListener('click', () => {
      $$('#filter .chip', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      const w = b.dataset.who;
      $$('.rec', root).forEach(r => { r.hidden = !!w && r.dataset.who !== w; });
    }));
    $('#export', root)?.addEventListener('click', () => {
      const text = store.records.map(r => `# ${r.templateName} — ${r.who || ''}（${fmtDate(r.createdAt)}）\n\n${r.content}\n`).join('\n---\n\n');
      download(`玄鑑解讀紀錄-${new Date().toISOString().slice(0, 10)}.md`, text, 'text/markdown');
      toast('已匯出 Markdown');
    });
    if (query.id) setTimeout(() => open(query.id), 300);
  },
};
