/* 貼回頁：按下「請 LLM 解讀」之後落地的地方。

   提示詞在上一頁就已經複製好了，這裡只負責三件事：
   告訴你複製好了、讓你一步去外部 LLM、把回覆收回來存成紀錄。
   要調語氣換模板的人不會來這頁 —— 他們在設定裡開「進階提示詞」，走產生器。 */
import { html, raw, $, toast, copyText } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { DISCLAIMER, sectionHead } from './_shared.js';

/* 常見的外部 LLM。只是開新分頁，App 不會替你送出任何東西。 */
const SITES = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Claude', url: 'https://claude.ai/new' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
];

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
            開新分頁，在輸入框貼上（長按貼上／Ctrl+V），送出，再把回覆整段複製回來。
            App 不會替你連線，也不會把任何東西送出去。
          </p>
          <div class="row" style="gap:var(--sp-2)">
            ${raw(SITES.map(s => html`
              <a class="btn btn--ghost press" href="${s.url}" target="_blank" rel="noopener noreferrer">
                ${raw(icon('share'))} ${s.name}</a>`).join(''))}
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
