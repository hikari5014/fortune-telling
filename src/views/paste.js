/* 貼回頁：按下「請 LLM 解讀」之後落地的地方。

   提示詞在上一頁就已經複製好了，這裡只負責三件事：
   告訴你複製好了、讓你一步去外部 LLM、把回覆收回來存成紀錄。
   要調語氣換模板的人不會來這頁 —— 他們在設定裡開「進階提示詞」，走產生器。 */
import { html, raw, $, $$, toast, copyText } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { DISCLAIMER, sectionHead } from './_shared.js';
import { SERVICES, plan, openLLM } from '../llm.js';

export default {
  title: '貼回結果', eyebrow: 'PASTE BACK',
  render() {
    const p = store.drafts.pending;
    if (!p?.text) {
      return html`<div class="empty reveal">
        ${raw(icon('prompt'))}
        <p>還沒有複製過提示詞。到任何一個占卜或命盤頁按「請 LLM 解讀」，提示詞就會複製好並回到這裡。</p>
        <a class="btn btn--primary press" href="#/prompt">${raw(icon('prompt'))} 打開提示詞產生器</a>
      </div>`;
    }

    return html`
      <div class="stack">
        <section class="reveal">
          <div class="card card--invert">
            <p class="card__label">提示詞已複製</p>
            <p style="margin-top:var(--sp-2);font-size:var(--fs-4)"><b>${p.name}</b></p>
            <p class="hint" style="margin-top:var(--sp-2)">
              ${p.text.length} 字元${p.q ? `　·　問題：${p.q}` : ''}
            </p>
            <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-3)">
              <button class="btn btn--ghost btn--sm press" id="recopy">${raw(icon('copy'))} 再複製一次</button>
              <a class="btn btn--ghost btn--sm press" href="#/prompt?t=${p.t}&studio=1">${raw(icon('edit'))} 改一下再問</a>
            </div>
          </div>
          <details class="foldout" style="margin-top:var(--sp-3)">
            <summary>看看複製了什麼</summary>
            <pre class="focus__text" id="pending-text">${p.text}</pre>
          </details>
        </section>

        <section class="reveal">
          ${raw(sectionHead('去貼給 LLM'))}
          <p class="hint" style="margin-bottom:var(--sp-3)">
            提示詞已經在剪貼簿裡了。標著「直接帶過去」的那幾個，
            在<b>瀏覽器</b>裡開會連提示詞一起帶進輸入框；其餘的開起來自己貼上。
            手機 App 一律帶不動 —— 那是對方 App 的限制，不是這裡沒做。
          </p>
          <div class="grid grid--2" style="gap:var(--sp-2)">
            ${raw(SERVICES.map((s) => {
              const p2 = plan(p.text, s.id);
              return html`<button class="btn btn--ghost press llmbtn" data-llm="${s.id}">
                ${raw(icon('share'))}
                <span>${s.name}<small>${p2.carried ? '直接帶過去' : '開起來自己貼'}</small></span>
              </button>`;
            }).join(''))}
          </div>
        </section>

        <section class="reveal">
          ${raw(sectionHead('把回覆貼回來'))}
          <textarea class="textarea" id="paste-back" data-noswipe
            placeholder="在這裡貼上外部 LLM 的回覆⋯⋯" style="min-height:190px"></textarea>
          <div class="field" style="margin-top:var(--sp-3)">
            <label for="rec-model">這是哪個模型回的（選填）</label>
            <input class="input" id="rec-model" list="model-list" placeholder="例如 Claude、ChatGPT、Gemini"
                   maxlength="40" value="${store.drafts.lastModel || ''}">
            <datalist id="model-list">${store.allModels.map(m => html`<option value="${m}"></option>`)}</datalist>
          </div>
          <p class="hint">填了之後，同一個提示詞問不同模型的回覆可以在紀錄頁並排比較。</p>
          <div class="row" style="margin-top:var(--sp-3);gap:var(--sp-2)">
            <button class="btn btn--primary press" id="save-rec">${raw(icon('down'))} 存成紀錄</button>
            <a class="btn btn--ghost press" href="#/records">${raw(icon('records'))} 查看紀錄</a>
          </div>
        </section>
      </div>
      ${DISCLAIMER}`;
  },

  mount(root, { profile }) {
    const p = store.drafts.pending;
    if (!p?.text) return;

    $('#recopy', root).addEventListener('click', () => copyText(p.text, '又複製了一次'));

    // 開新視窗要在點擊事件裡同步做，不然會被當成彈出視窗擋掉
    $$('[data-llm]', root).forEach(b => b.addEventListener('click', () => {
      const r = openLLM(p.text, b.dataset.llm);
      toast(r.carried ? `已開啟 ${r.name}，提示詞帶過去了` : `已開啟 ${r.name} —— ${r.why}`);
    }));

    $('#save-rec', root).addEventListener('click', () => {
      const content = $('#paste-back', root).value.trim();
      if (!content) { toast('先貼上 LLM 的回覆'); return; }
      const model = $('#rec-model', root).value.trim();
      store.addRecord({
        id: uid('rec'), createdAt: new Date().toISOString(),
        templateId: p.t, templateName: p.name,
        who: profile ? ((profile.surname || '') + (profile.givenName || '') || profile.label) : '',
        profileId: profile?.id || null,
        prompt: p.text, content, model, tags: [],
        snapshot: null,
      });
      store.setDraft('lastModel', model);
      $('#paste-back', root).value = '';
      toast('已存成紀錄');
      setTimeout(() => { location.hash = '/records'; }, 500);
    });
  },
};
