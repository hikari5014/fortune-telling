import { html, raw, $, $$, sheet, toast, copyText, confirmSheet, download, encodeCode, decodeCode } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { BUILTIN, VARS, CATEGORIES } from '../prompt/templates.js';
import { compose, estTokens, BLOCK_META } from '../prompt/builder.js';
import { buildBlocks } from '../prompt/context.js';
import { allTemplates, findParty, partyChart, synastryText, draftExtras } from '../prompt/quick.js';
import { observeReveal } from '../motion.js';
import { DISCLAIMER, sectionHead } from './_shared.js';

const TONES = ['溫和但直接', '犀利不客氣', '學術嚴謹', '像朋友聊天', '簡潔條列', '鼓勵取向'];
const DEPTHS = ['入門易懂', '中等', '深入專業', '極深（含推導過程）'];
const FORMATS = ['Markdown 小標＋條列', '純文字段落', '表格為主', 'JSON 結構化輸出', '先結論後理由'];
const LENGTHS = ['短（300 字內）', '中等（600–1200 字）', '長（2000 字以上）', '不限'];
const LANGS = ['繁體中文', '简体中文', 'English', '日本語'];

export default {
  title: '提示詞產生器', eyebrow: 'PROMPT STUDIO',
  render({ settings, profile, all, query }) {
    const tpls = allTemplates();
    const active = tpls.find(t => t.id === query.t) || tpls[0];
    const blocks = buildBlocks(all, settings);
    const selected = active.blocks || [];

    return html`
      <div class="pb">
        <div class="stack" data-noswipe>
          <section id="focus-sec" ${query.focus && store.drafts.focus ? '' : 'hidden'}>
            ${raw(sectionHead('聚焦項目', `<button class="chip press" id="focus-clear">${icon('close')} 取消聚焦</button>`))}
            <div class="card card--flat" style="padding:var(--sp-3) var(--sp-4)">
              <p class="card__label" id="focus-label">${store.drafts.focus?.label || ''}</p>
              <pre class="focus__text" id="focus-text">${store.drafts.focus?.text || ''}</pre>
            </div>
            <p class="hint" style="margin-top:var(--sp-2)">從功能頁帶過來的那一項。它會被插在提示詞的「輸出要求」之前，當成這次回答的主軸。</p>
          </section>

          <section>
            ${raw(sectionHead('模板', `<button class="chip press" id="new-tpl">${icon('plus')} 自訂</button><button class="chip press" id="tpl-io">${icon('share')} 匯出入</button>`))}
            <div class="row" style="gap:5px;margin-bottom:var(--sp-3)" id="cat-row">
              <button class="chip press" data-cat="" aria-pressed="true">全部</button>
              ${raw([...new Set(tpls.map(t => t.category))].map(c => html`<button class="chip press" data-cat="${c}" aria-pressed="false">${c}</button>`).join(''))}
            </div>
            <div class="stack" id="tpl-list" style="gap:6px">
              ${raw(tpls.map(t => html`
                <button class="tmpl press track" data-id="${t.id}" data-cat="${t.category}" aria-pressed="${t.id === active.id}">
                  <b>${t.name}${t.custom ? ' ·自訂' : ''}</b>
                  <small>${t.desc || ''}</small>
                </button>`).join(''))}
            </div>
          </section>

          <section>
            ${raw(sectionHead('附帶資料'))}
            ${profile ? html`
              <p class="hint" style="margin-bottom:var(--sp-2)">目前對象：<b>${(profile.surname || '') + (profile.givenName || '') || profile.label}</b>　<a href="#/profile" style="text-decoration:underline">切換</a></p>
              <div class="row" style="gap:5px" id="block-row">
                ${raw(BLOCK_META.map(b => html`
                  <button class="chip press" data-block="${b.key}" ${blocks[b.key] ? '' : 'disabled'}
                    aria-pressed="${selected.includes(b.key) && !!blocks[b.key]}" title="${b.hint}">${b.label}</button>`).join(''))}
              </div>`
              : html`<p class="hint">還沒有檔案，提示詞不會附帶命盤資料。<a href="#/profile" style="text-decoration:underline">去建立</a></p>`}
          </section>

          <section>
            ${raw(sectionHead('輸出控制'))}
            <div class="stack" style="gap:var(--sp-3)">
              ${raw(sel('opt-lang', '語言', LANGS, settings.promptLang))}
              ${raw(sel('opt-tone', '語氣', TONES, settings.promptTone))}
              ${raw(sel('opt-depth', '深度', DEPTHS, settings.promptDepth))}
              ${raw(sel('opt-length', '長度', LENGTHS, '中等（600–1200 字）'))}
              ${raw(sel('opt-format', '格式', FORMATS, settings.promptFormat))}
              <div class="switch" role="switch" tabindex="0" id="opt-disc" aria-checked="${settings.promptDisclaimer}">
                <span>附加免責聲明</span><span class="switch__box"></span>
              </div>
            </div>
          </section>

          <section>
            ${raw(sectionHead('補充欄位'))}
            <div class="stack" style="gap:var(--sp-3)">
              <div class="field"><label for="x-question">我想特別問的事</label>
                <textarea class="textarea" id="x-question" style="min-height:76px" placeholder="例如：今年適不適合轉職？">${query.q || ''}</textarea></div>
              <div class="field" data-for="number-pick"><label for="x-cand">候選號碼（每行一組）</label>
                <textarea class="textarea textarea--code" id="x-cand" style="min-height:76px" placeholder="0912-345-678&#10;0933-888-168"></textarea></div>
              <div class="field" data-for="number-pick"><label for="x-goal">想強化的面向</label>
                <input class="input" id="x-goal" placeholder="財運 / 人際 / 健康 / 事業"></div>
              <div class="field" data-for="strokes"><label for="x-chars">要查筆畫的字</label>
                <input class="input" id="x-chars" value="${query.chars || ''}" placeholder="龘 齉 鑫"></div>
              <div class="field" data-for="name-pick"><label for="x-combos">筆畫組合</label>
                <input class="input num" id="x-combos" value="${query.combos || ''}" placeholder="13+16、7+18"></div>
              <div class="field" data-for="compat hire"><label for="x-other">第二方（人或公司）</label>
                ${raw(otherSelect(profile))}</div>
              <div class="field"><label for="x-extra">額外指示（直接接在最後）</label>
                <textarea class="textarea" id="x-extra" style="min-height:72px"
                  placeholder="例如：請用三個小標；請避免宿命論的說法；請最後附一段可以直接傳給家人的白話摘要">${store.drafts.promptExtra || ''}</textarea></div>
            </div>
          </section>

          <section>
            ${raw(sectionHead('自訂變數', `<button class="chip press" id="cv-add">${icon('plus')} 新增</button>`))}
            <div class="stack" id="cv-list" style="gap:6px">${raw(cvRows(store.drafts.customVars || {}))}</div>
            <p class="hint" style="margin-top:var(--sp-2)">自己定義的變數可以在模板裡用 <code>{{名稱}}</code> 插入，跟內建變數一樣。</p>
          </section>

          <section>
            ${raw(sectionHead('模板內容', `<button class="chip press" id="edit-body">${icon('edit')} 編輯</button>`))}
            <textarea class="textarea textarea--code" id="tpl-body" style="min-height:190px" hidden>${active.body}</textarea>
            <div class="varpad" id="varpad" style="margin-top:var(--sp-2)" hidden>
              ${raw(VARS.map(v => html`<button type="button" data-v="${v.v}" title="${v.d}">{{${v.v}}}</button>`).join(''))}
            </div>
          </section>
        </div>

        <div class="pb__preview stack">
          <section>
            ${raw(sectionHead('預覽', `<span class="counter" id="count"></span>`))}
            <div class="preview" id="preview" data-noswipe contenteditable="true" spellcheck="false"
                 role="textbox" aria-multiline="true" aria-label="提示詞預覽，可直接編輯"></div>
            <p class="hint" style="margin-top:6px" id="edited-hint" hidden>
              你手動改過預覽內容了，複製的會是改過的版本。<button class="chip press" id="revert">還原</button>
            </p>
            <p class="hint" style="margin-top:var(--sp-3)">
              複製後貼到任何 LLM（ChatGPT、Claude、Gemini、本地模型皆可），把回覆貼回下方存檔。<br>
              「複製提示詞」那一列一直浮在畫面下方，捲到哪都按得到。
            </p>
          </section>

          <section>
            ${raw(sectionHead('把 LLM 的回覆貼回來'))}
            <textarea class="textarea" id="paste-back" data-noswipe placeholder="在這裡貼上外部 LLM 的回覆⋯⋯" style="min-height:150px"></textarea>
            <div class="field" style="margin-top:var(--sp-3)">
              <label for="rec-model">這是哪個模型回的（選填）</label>
              <input class="input" id="rec-model" list="model-list" placeholder="例如 Claude、ChatGPT、Gemini" maxlength="40"
                     value="${store.drafts.lastModel || ''}">
              <datalist id="model-list">${store.allModels.map(m => html`<option value="${m}"></option>`)}</datalist>
            </div>
            <p class="hint">填了之後，同一個提示詞問不同模型的回覆可以在紀錄頁並排比較。</p>
            <div class="row" style="margin-top:var(--sp-3);gap:var(--sp-2)">
              <button class="btn btn--primary press" id="save-rec">${raw(icon('down'))} 存成紀錄</button>
              <a class="btn btn--ghost press" href="#/records">${raw(icon('records'))} 查看紀錄</a>
            </div>
          </section>
        </div>
      </div>
      ${DISCLAIMER}

      <!-- 浮在畫面下方，捲到哪都按得到 -->
      <div class="fabbar" role="group" aria-label="提示詞操作">
        <button class="btn btn--primary press" id="copy">${raw(icon('copy'))} 複製提示詞</button>
        <button class="btn btn--ghost press" id="save-tpl" data-tip="存成自訂模板">${raw(icon('plus'))} <span>存模板</span></button>
        <button class="iconbtn press" id="share-btn" aria-label="分享提示詞" data-tip="分享">${raw(icon('share'))}</button>
      </div>`;
  },

  mount(root, ctx) {
    const { settings, profile, all, query } = ctx;
    let tpls = allTemplates();
    let active = tpls.find(t => t.id === query.t) || tpls[0];
    let selected = new Set((active.blocks || []).filter(k => buildBlocks(all, settings)[k]));
    let bodyOverride = null;
    let otherAll = null;

    const opts = () => ({
      lang: $('#opt-lang', root).value, tone: $('#opt-tone', root).value,
      depth: $('#opt-depth', root).value, length: $('#opt-length', root).value,
      format: $('#opt-format', root).value,
      disclaimer: $('#opt-disc', root).getAttribute('aria-checked') === 'true',
    });
    /* 聚焦項目：由功能頁寫進 drafts，網址帶 focus=1 才生效 */
    let focusItem = query.focus ? (store.drafts.focus || null) : null;

    /* 自訂變數：從畫面上讀回來，空名稱忽略 */
    const customVars = () => {
      const o = {};
      $$('.cvrow', root).forEach(r => {
        const k = r.querySelector('.cvrow__k').value.trim();
        if (k) o[k] = r.querySelector('.cvrow__v').value;
      });
      return o;
    };

    const extras = () => ({
      custom: customVars(),
      focus: focusItem ? `【${focusItem.label}】\n${focusItem.text}` : '',
      question: $('#x-question', root).value.trim(),
      candidates: $('#x-cand', root).value.trim(),
      goal: $('#x-goal', root).value.trim(),
      chars: $('#x-chars', root).value.trim(),
      strokeCombos: $('#x-combos', root).value.trim(),
      other: otherAll ? Object.entries(buildBlocks(otherAll, settings)).map(([k, v]) => v).join('\n\n') : '',
      synastry: otherAll && all ? synastryText(all, otherAll) : '',
      ...draftExtras(active.id),
    });

    const build = () => {
      const out = compose({
        template: { ...active, body: bodyOverride ?? active.body },
        all, settings, selected: [...selected], options: opts(), extra: extras(),
      });
      const note = $('#x-extra', root).value.trim();
      return note ? `${out}\n\n${note}` : out;
    };

    /* 預覽被手動改過之後，複製與分享都用改過的版本 */
    let edited = null;
    const finalText = () => edited ?? build();

    const refresh = () => {
      if (edited != null) { $('#count', root).textContent = `${edited.length} 字元 · 約 ${estTokens(edited)} tokens（已手改）`; return; }
      const text = build();
      $('#preview', root).textContent = text;
      $('#count', root).textContent = `${text.length} 字元 · 約 ${estTokens(text)} tokens`;
      // 只顯示與這個模板有關的補充欄位
      $$('[data-for]', root).forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(active.id); });
    };

    // 由網址帶入第二個人
    if (query.other) {
      const sel = $('#x-other', root);
      if (sel) { sel.value = query.other; otherAll = partyChart(findParty(query.other), settings); }
    }

    // 模板選擇
    const pick = (id) => {
      active = allTemplates().find(t => t.id === id) || active;
      bodyOverride = null;
      $('#tpl-body', root).value = active.body;
      selected = new Set((active.blocks || []).filter(k => buildBlocks(all, settings)[k]));
      $$('[data-block]', root).forEach(b => b.setAttribute('aria-pressed', String(selected.has(b.dataset.block))));
      $$('.tmpl', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === active.id)));
      edited = null;
      $('#edited-hint', root).hidden = true;
      history.replaceState(null, '', `#/prompt?t=${active.id}${focusItem ? '&focus=1' : ''}`);
      refresh();
    };
    $$('.tmpl', root).forEach(b => b.addEventListener('click', () => pick(b.dataset.id)));
    $$('#cat-row .chip', root).forEach(b => b.addEventListener('click', () => {
      $$('#cat-row .chip', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      const c = b.dataset.cat;
      $$('.tmpl', root).forEach(t => { t.hidden = !!c && t.dataset.cat !== c; });
    }));

    // 資料積木
    $$('[data-block]', root).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.block;
      if (selected.has(k)) selected.delete(k); else selected.add(k);
      b.setAttribute('aria-pressed', String(selected.has(k)));
      refresh();
    }));

    // 輸出控制
    ['opt-lang', 'opt-tone', 'opt-depth', 'opt-length', 'opt-format'].forEach(id => {
      const el = $(`#${id}`, root);
      el.addEventListener('input', refresh);
      el.addEventListener('change', refresh);
    });
    const sw = $('#opt-disc', root);
    const toggleSw = () => { sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true')); refresh(); };
    sw.addEventListener('click', toggleSw);
    sw.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSw(); } });

    // 補充欄位
    ['x-question', 'x-cand', 'x-goal', 'x-chars', 'x-combos'].forEach(id =>
      $(`#${id}`, root).addEventListener('input', refresh));
    $('#x-extra', root).addEventListener('input', (e) => {
      store.setDraft('promptExtra', e.target.value);
      refresh();
    });

    // 聚焦項目
    $('#focus-clear', root).addEventListener('click', () => {
      focusItem = null;
      $('#focus-sec', root).hidden = true;
      history.replaceState(null, '', `#/prompt?t=${active.id}`);
      refresh();
    });

    // 自訂變數
    const cvList = $('#cv-list', root);
    const saveCV = () => { store.setDraft('customVars', customVars()); refresh(); };
    const bindCV = () => {
      $$('.cvrow input', cvList).forEach(el => { el.oninput = saveCV; });
      $$('[data-cv-del]', cvList).forEach(b => { b.onclick = () => { b.closest('.cvrow').remove(); saveCV(); }; });
    };
    bindCV();
    $('#cv-add', root).addEventListener('click', () => {
      if (!$('.cvrow', cvList)) cvList.innerHTML = '';
      cvList.insertAdjacentHTML('beforeend', `<div class="cvrow">
        <input class="input cvrow__k" placeholder="名稱" aria-label="變數名稱">
        <input class="input cvrow__v" placeholder="內容" aria-label="變數內容">
        <button class="iconbtn press" data-cv-del aria-label="刪除">${icon('trash')}</button></div>`);
      bindCV();
      cvList.lastElementChild.querySelector('.cvrow__k').focus();
    });

    // 預覽可直接編輯
    const pv = $('#preview', root);
    const hint = $('#edited-hint', root);
    pv.addEventListener('input', () => {
      edited = pv.textContent;
      hint.hidden = false;
      $('#count', root).textContent = `${edited.length} 字元 · 約 ${estTokens(edited)} tokens（已手改）`;
    });
    $('#revert', root).addEventListener('click', (e) => {
      e.stopPropagation();
      edited = null; hint.hidden = true; refresh();
    });
    $('#x-other', root)?.addEventListener('change', (e) => {
      otherAll = partyChart(findParty(e.target.value), settings);
      refresh();
    });

    // 模板編輯
    const bodyEl = $('#tpl-body', root), pad = $('#varpad', root);
    $('#edit-body', root).addEventListener('click', () => {
      const on = bodyEl.hidden;
      bodyEl.hidden = !on; pad.hidden = !on;
      $('#edit-body', root).innerHTML = on ? icon('close') + ' 收起' : icon('edit') + ' 編輯';
      if (on) bodyEl.focus();
    });
    bodyEl.addEventListener('input', () => { bodyOverride = bodyEl.value; refresh(); });
    $$('#varpad button', root).forEach(b => b.addEventListener('click', () => {
      const ins = `{{${b.dataset.v}}}`;
      const s = bodyEl.selectionStart ?? bodyEl.value.length;
      bodyEl.value = bodyEl.value.slice(0, s) + ins + bodyEl.value.slice(bodyEl.selectionEnd ?? s);
      bodyEl.focus();
      bodyEl.selectionStart = bodyEl.selectionEnd = s + ins.length;
      bodyOverride = bodyEl.value; refresh();
    }));

    // 動作
    $('#copy', root).addEventListener('click', () => copyText(finalText(), '提示詞已複製，去貼給 LLM 吧'));
    $('#share-btn', root).addEventListener('click', async () => {
      const text = finalText();
      if (navigator.share) { try { await navigator.share({ title: active.name, text }); return; } catch {} }
      download(`prompt-${active.id}.txt`, text, 'text/plain');
    });
    $('#new-tpl', root).addEventListener('click', () => saveAs(''));
    $('#tpl-io', root).addEventListener('click', openIO);

    function openIO() {
      const mine = store.templates;
      sheet({
        title: '模板匯出／匯入',
        body: html`<div class="stack" data-noswipe>
          <p class="hint">自訂模板共 ${mine.length} 個。分享碼是一段純文字，可以貼到訊息裡傳給別人。</p>
          <div class="row" style="gap:var(--sp-2)">
            <button class="btn btn--ghost press" data-export ${mine.length ? '' : 'disabled'}>${raw(icon('down'))} 下載 JSON</button>
            <button class="btn btn--ghost press" data-code ${mine.length ? '' : 'disabled'}>${raw(icon('copy'))} 複製分享碼</button>
            <button class="btn btn--ghost press" data-file>${raw(icon('up'))} 從檔案匯入</button>
          </div>
          <div class="field"><label for="io-code">貼上分享碼</label>
            <textarea class="textarea textarea--code" id="io-code" style="min-height:110px" placeholder="XJTPL1:..."></textarea></div>
          <button class="btn btn--primary btn--block press" data-import>${raw(icon('check'))} 匯入分享碼</button>
          <p class="hint">匯入只會新增模板，不會覆蓋你現有的內容。</p>
        </div>`,
        onMount(sr, close) {
          const payload = () => JSON.stringify({ app: 'xuanjian', kind: 'templates', v: 1, items: store.templates });
          $('[data-export]', sr)?.addEventListener('click', () => {
            download(`玄鑑模板-${new Date().toISOString().slice(0, 10)}.json`, payload());
            toast('已下載');
          });
          $('[data-code]', sr)?.addEventListener('click', () => copyText('XJTPL1:' + encodeCode(payload()), '分享碼已複製'));
          $('[data-file]', sr).addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'application/json,.json';
            input.onchange = async () => {
              const f = input.files?.[0]; if (!f) return;
              try { importTemplates(await f.text()); close(); } catch (e) { toast('匯入失敗：' + e.message); }
            };
            input.click();
          });
          $('[data-import]', sr).addEventListener('click', () => {
            const t = $('#io-code', sr).value.trim();
            if (!t) { toast('先貼上分享碼'); return; }
            try {
              importTemplates(t.startsWith('XJTPL1:') ? decodeCode(t.slice(7)) : t);
              close();
            } catch (e) { toast('分享碼無法解析'); }
          });
        },
      });
    }

    function importTemplates(text) {
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(items) || !items.length) throw new Error('沒有可匯入的模板');
      let n = 0;
      for (const t of items) {
        if (!t || typeof t.body !== 'string') continue;
        store.saveTemplate({
          ...t, id: uid('tpl'), custom: true,
          category: t.category || '自訂',
          name: (t.name || '匯入的模板'),
          blocks: Array.isArray(t.blocks) ? t.blocks : [],
        });
        n++;
      }
      toast(`已匯入 ${n} 個模板`);
      setTimeout(() => location.reload(), 600);
    }
    $('#save-tpl', root).addEventListener('click', () => saveAs(bodyOverride ?? active.body));

    function saveAs(body) {
      sheet({
        title: '儲存自訂模板',
        body: html`<div class="stack" data-noswipe>
          <div class="field"><label for="t-name">名稱</label><input class="input" id="t-name" value="${active.name} 副本"></div>
          <div class="field"><label for="t-desc">說明</label><input class="input" id="t-desc" value="${active.desc || ''}"></div>
          <div class="field"><label for="t-body">內容</label><textarea class="textarea textarea--code" id="t-body" style="min-height:200px">${body || '{{data}}\n\n'}</textarea></div>
          <p class="hint">可用變數：${VARS.map(v => '{{' + v.v + '}}').join('、')}</p>
        </div>`,
        actions: html`<button class="btn btn--primary btn--block press" data-save>${raw(icon('check'))} 儲存</button>`,
        onMount(sr, close) {
          $('[data-save]', sr).addEventListener('click', () => {
            const t = {
              id: uid('tpl'), custom: true, category: '自訂',
              name: $('#t-name', sr).value.trim() || '未命名模板',
              desc: $('#t-desc', sr).value.trim(),
              body: $('#t-body', sr).value,
              blocks: [...selected],
              icon: 'edit',
            };
            store.saveTemplate(t);
            close(); toast('已儲存模板');
            location.hash = `/prompt?t=${t.id}`;
            location.reload();
          });
        },
      });
    }

    // 貼回存檔
    $('#save-rec', root).addEventListener('click', () => {
      const content = $('#paste-back', root).value.trim();
      if (!content) { toast('先貼上 LLM 的回覆'); return; }
      store.addRecord({
        id: uid('rec'), createdAt: new Date().toISOString(),
        templateId: active.id, templateName: active.name,
        who: profile ? ((profile.surname || '') + (profile.givenName || '') || profile.label) : '',
        profileId: profile?.id || null,
        prompt: build(), content,
        model: $('#rec-model', root).value.trim(),
        tags: [],
        snapshot: { blocks: [...selected], options: opts() },
      });
      store.setDraft('lastModel', $('#rec-model', root).value.trim());
      $('#paste-back', root).value = '';
      toast('已存成紀錄');
    });

    // 長按模板＝刪除自訂
    $$('.tmpl', root).forEach(b => {
      const t = allTemplates().find(x => x.id === b.dataset.id);
      if (!t?.custom) return;
      b.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        if (await confirmSheet('刪除模板', `確定刪除自訂模板「${t.name}」？`, '刪除')) {
          store.removeTemplate(t.id); toast('已刪除'); location.reload();
        }
      });
    });

    refresh();
  },
};

/* 輸出控制一律可以自己打字，預設值只是建議，不是選項的全部 */
function sel(id, label, list, value) {
  return html`<div class="field"><label for="${id}">${label}</label>
    <input class="input" id="${id}" list="${id}-list" value="${value || ''}" autocomplete="off">
    <datalist id="${id}-list">${raw(list.map(x => html`<option value="${x}"></option>`).join(''))}</datalist>
    </div>`;
}
/* 自訂變數的列 */
function cvRows(map) {
  const ent = Object.entries(map);
  if (!ent.length) return `<p class="hint">還沒有自訂變數。</p>`;
  return ent.map(([k, v]) => html`
    <div class="cvrow" data-k="${k}">
      <input class="input cvrow__k" value="${k}" aria-label="變數名稱">
      <input class="input cvrow__v" value="${v}" aria-label="變數內容">
      <button class="iconbtn press" data-cv-del aria-label="刪除">${raw(icon('trash'))}</button>
    </div>`).join('');
}

export { findParty };

function otherSelect(current) {
  const list = store.profiles.filter(p => p.id !== current?.id);
  const orgs = store.orgs;
  return html`<select class="select" id="x-other">
    <option value="">（不附帶）</option>
    ${raw(list.map(p => html`<option value="${p.id}">${(p.surname || '') + (p.givenName || '') || p.label}</option>`).join(''))}
    ${raw(orgs.length ? `<optgroup label="公司／團隊">${orgs.map(o => html`<option value="${o.id}">${o.label}</option>`).join('')}</optgroup>` : '')}
  </select>`;
}
