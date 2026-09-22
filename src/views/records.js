import { html, raw, $, $$, sheet, toast, copyText, confirmSheet, md, fmtDate, download, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { resolve } from '../router.js';
import { observeReveal } from '../motion.js';
import { DISCLAIMER, sectionHead, doShare } from './_shared.js';

const norm = (s) => String(s || '').toLowerCase();
const excerpt = (s, n = 150) => String(s || '').replace(/[#*`>]/g, '').replace(/\s+/g, ' ').slice(0, n);

export default {
  title: '解讀紀錄', eyebrow: 'READINGS',
  render({ query }) {
    const recs = store.records;
    if (!recs.length) return html`
      <div class="empty reveal">${raw(icon('records'))}
        <p>還沒有任何解讀。<br>到「提示詞」產生問句，貼給 LLM，再把回覆貼回來。</p>
        <a class="btn btn--primary press" href="#/prompt">${raw(icon('prompt'))} 去產生提示詞</a>
      </div>${DISCLAIMER}`;

    const whos = [...new Set(recs.map(r => r.who).filter(Boolean))];
    const tags = store.allTags;
    const models = store.allModels;

    return html`
      <section class="section" style="margin-top:0" data-noswipe>
        <div class="field">
          <input class="input" id="q" type="search" placeholder="搜尋內容、模板、對象、標籤⋯⋯"
                 value="${query.q || ''}" autocomplete="off">
        </div>
        <div class="filters" id="filter">
          <button class="chip press" data-k="all" data-v="" aria-pressed="true">全部</button>
          ${whos.map(w => html`<button class="chip press" data-k="who" data-v="${w}" aria-pressed="false">${w}</button>`)}
          ${models.map(m => html`<button class="chip press" data-k="model" data-v="${m}" aria-pressed="false">${raw(icon('prompt'))}${m}</button>`)}
          ${tags.map(t => html`<button class="chip press" data-k="tag" data-v="${t}" aria-pressed="false">#${t}</button>`)}
        </div>
        <div class="row row--between" style="margin-top:var(--sp-3)">
          <span class="hint" id="count">共 ${recs.length} 筆</span>
          <div class="row" style="gap:6px">
            <button class="chip press" id="cmp-mode">${raw(icon('swap'))} 比較</button>
            <button class="chip press" id="export">${raw(icon('down'))} 匯出</button>
          </div>
        </div>
      </section>

      <div class="stack" id="list" style="margin-top:var(--sp-4)">
        ${recs.map(r => html`
          <button class="rec press track reveal" data-id="${r.id}"
                  data-who="${r.who || ''}" data-model="${r.model || ''}" data-tags="${(r.tags || []).join(',')}"
                  data-hay="${norm([r.templateName, r.who, r.model, (r.tags || []).join(' '), r.content].join(' '))}">
            <div class="rec__meta">
              <span>${r.templateName}</span><span>·</span><span>${r.who || '—'}</span>
              ${r.model ? html`<span>·</span><span class="rec__model">${r.model}</span>` : ''}
              <span>·</span><span>${fmtDate(r.createdAt)}</span>
            </div>
            ${(r.tags || []).length ? html`<div class="rec__tags">${r.tags.map(t => html`<span class="tag">#${t}</span>`)}</div>` : ''}
            <div class="rec__body">${excerpt(r.content)}</div>
            <span class="rec__pick" aria-hidden="true">${raw(icon('check'))}</span>
          </button>`)}
      </div>
      <div class="empty reveal" id="noresult" hidden>
        ${raw(icon('search'))}<p>沒有符合的紀錄。</p>
      </div>

      <div class="cmpbar" id="cmpbar" hidden>
        <span id="cmpcount">已選 0 筆</span>
        <button class="btn btn--primary btn--sm press" id="cmp-go">並排比較</button>
        <button class="btn btn--ghost btn--sm press" id="cmp-exit">取消</button>
      </div>
      ${DISCLAIMER}`;
  },

  mount(root, { query }) {
    if (!store.records.length) return;
    const list = $('#list', root);
    let filter = { k: 'all', v: '' };
    let compare = false;
    const picked = new Set();

    /* ── 篩選 + 搜尋 ───────────────────────────── */
    function apply() {
      const q = norm($('#q', root).value.trim());
      let n = 0;
      $$('.rec', list).forEach(el => {
        const okFilter = filter.k === 'all'
          || (filter.k === 'who' && el.dataset.who === filter.v)
          || (filter.k === 'model' && el.dataset.model === filter.v)
          || (filter.k === 'tag' && el.dataset.tags.split(',').includes(filter.v));
        const okQ = !q || el.dataset.hay.includes(q);
        const show = okFilter && okQ;
        el.hidden = !show;
        if (show) n++;
      });
      $('#count', root).textContent = q || filter.k !== 'all' ? `符合 ${n} 筆` : `共 ${store.records.length} 筆`;
      $('#noresult', root).hidden = n > 0;
    }
    $('#q', root).addEventListener('input', apply);
    $$('#filter .chip', root).forEach(b => b.addEventListener('click', () => {
      $$('#filter .chip', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      filter = { k: b.dataset.k, v: b.dataset.v };
      apply();
    }));

    /* ── 比較模式 ─────────────────────────────── */
    const bar = $('#cmpbar', root);
    function setCompare(on) {
      compare = on;
      picked.clear();
      list.classList.toggle('is-picking', on);
      $$('.rec', list).forEach(el => el.classList.remove('is-picked'));
      bar.hidden = !on;
      $('#cmp-mode', root).setAttribute('aria-pressed', String(on));
      syncBar();
    }
    const syncBar = () => {
      $('#cmpcount', root).textContent = `已選 ${picked.size} 筆`;
      $('#cmp-go', root).disabled = picked.size < 2;
    };
    $('#cmp-mode', root).addEventListener('click', () => setCompare(!compare));
    $('#cmp-exit', root).addEventListener('click', () => setCompare(false));
    $('#cmp-go', root).addEventListener('click', () => openCompare([...picked]));

    /* ── 點一筆 ───────────────────────────────── */
    $$('.rec', list).forEach(b => b.addEventListener('click', () => {
      if (compare) {
        const id = b.dataset.id;
        if (picked.has(id)) { picked.delete(id); b.classList.remove('is-picked'); }
        else if (picked.size >= 4) { toast('一次最多比較 4 筆'); return; }
        else { picked.add(id); b.classList.add('is-picked'); }
        haptic(6);
        syncBar();
        return;
      }
      open(b.dataset.id);
    }));

    /* ── 單筆檢視 ─────────────────────────────── */
    function open(id) {
      const r = store.records.find(x => x.id === id);
      if (!r) return;
      sheet({
        title: r.templateName,
        body: html`
          <div class="rec__meta" style="margin-bottom:var(--sp-2)">
            <span>${r.who || '—'}</span>${r.model ? html`<span>·</span><span class="rec__model">${r.model}</span>` : ''}
            <span>·</span><span>${fmtDate(r.createdAt)}</span>
          </div>
          <div class="row" style="gap:6px;margin-bottom:var(--sp-4)" id="tagrow">
            ${(r.tags || []).map(t => html`<button class="tag tag--on press" data-rm="${t}">#${t} ✕</button>`)}
            <button class="tag press" id="addtag">＋ 標籤</button>
          </div>
          <div class="md">${raw(md(r.content))}</div>`,
        actions: html`<div class="row" style="gap:var(--sp-2)">
          <button class="btn btn--ghost press" data-copy style="flex:1">${raw(icon('copy'))} 複製</button>
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
          // 標籤
          const retag = (next) => { store.updateRecord(r.id, { tags: next }); close(); resolve(); };
          $$('[data-rm]', sr).forEach(b => b.addEventListener('click', () =>
            retag((r.tags || []).filter(t => t !== b.dataset.rm))));
          $('#addtag', sr).addEventListener('click', () => {
            close();
            setTimeout(() => sheet({
              title: '加標籤',
              body: html`
                <div class="field"><label for="nt">標籤名稱</label>
                  <input class="input" id="nt" maxlength="16" placeholder="例如：工作、感情、2026"></div>
                ${store.allTags.length ? html`
                  <p class="hint" style="margin-top:var(--sp-3)">用過的標籤</p>
                  <div class="row" style="gap:6px;margin-top:6px">
                    ${store.allTags.map(t => html`<button class="tag press" data-use="${t}">#${t}</button>`)}
                  </div>` : ''}`,
              actions: html`<button class="btn btn--primary btn--block press" data-ok>${raw(icon('check'))} 加上</button>`,
              onMount(s2, c2) {
                const add = (t) => {
                  const v = String(t || '').trim().replace(/^#/, '');
                  if (!v) { c2(); return; }
                  store.updateRecord(r.id, { tags: [...new Set([...(r.tags || []), v])] });
                  c2(); toast(`已加上 #${v}`); resolve();
                };
                $('[data-ok]', s2).addEventListener('click', () => add($('#nt', s2).value));
                $$('[data-use]', s2).forEach(b => b.addEventListener('click', () => add(b.dataset.use)));
              },
            }), 300);
          });
        },
      });
    }

    /* ── 並排比較 ─────────────────────────────── */
    function openCompare(ids) {
      const rs = ids.map(id => store.records.find(x => x.id === id)).filter(Boolean);
      const samePrompt = rs.every(r => r.prompt === rs[0].prompt);
      sheet({
        title: `並排比較（${rs.length} 筆）`,
        body: html`
          <p class="hint">${samePrompt
            ? '這幾筆用的是同一份提示詞，差別只在回答的模型。'
            : '注意：這幾筆的提示詞並不相同，差異可能來自提示詞本身而不是模型。'}</p>
          <div class="cmp" data-noswipe>
            ${rs.map(r => html`
              <div class="cmp__col">
                <div class="cmp__head">
                  <b>${r.model || '未標示模型'}</b>
                  <small>${r.templateName}　${fmtDate(r.createdAt)}</small>
                </div>
                <div class="md cmp__body">${raw(md(r.content))}</div>
              </div>`)}
          </div>
          <p class="hint" style="margin-top:var(--sp-3)">左右滑動看下一欄。</p>`,
      });
    }

    $('#export', root).addEventListener('click', () => {
      const shown = $$('.rec', list).filter(el => !el.hidden).map(el => el.dataset.id);
      const rs = store.records.filter(r => shown.includes(r.id));
      const text = rs.map(r => [
        `# ${r.templateName} — ${r.who || ''}（${fmtDate(r.createdAt)}）`,
        r.model ? `模型：${r.model}` : '',
        (r.tags || []).length ? `標籤：${r.tags.map(t => '#' + t).join(' ')}` : '',
        '', r.content, '',
      ].filter(Boolean).join('\n')).join('\n---\n\n');
      download(`玄鑑解讀紀錄-${new Date().toISOString().slice(0, 10)}.md`, text, 'text/markdown');
      toast(`已匯出 ${rs.length} 筆`);
    });

    observeReveal(root);
    if (query.q) apply();
    if (query.id) setTimeout(() => open(query.id), 300);
  },
};
