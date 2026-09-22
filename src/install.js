/* 安裝指引：先試真的安裝提示，不行才給對應平台的步驟 */
import { html, raw, $, $$, sheet, toast } from './ui.js';
import { icon } from './icons.js';
import { detect, installGuide, ALL_GUIDES, isInstalled } from './platform.js';

/* 步驟文字裡的 **粗體** 轉成 <b> */
const bold = (t) => String(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

const stepList = (g) => `
  <ol class="steps">
    ${g.steps.map((s, i) => `
      <li class="step">
        <span class="step__n num">${i + 1}</span>
        <span class="step__i">${icon(s.icon)}</span>
        <span class="step__t">${bold(s.text)}</span>
      </li>`).join('')}
  </ol>
  ${g.note ? `<p class="hint" style="margin-top:var(--sp-3)">${bold(g.note)}</p>` : ''}`;

/** 開啟安裝說明。能叫出瀏覽器原生的安裝提示就先叫。 */
export async function openInstall() {
  if (isInstalled()) {
    toast('已經是從主畫面開啟的了');
    return;
  }
  const prompt = window.__installPrompt;
  if (prompt) {
    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      window.__installPrompt = null;
      toast(outcome === 'accepted' ? '安裝中⋯⋯' : '已取消安裝');
      return;
    } catch { /* 提示已失效就退回手動說明 */ }
  }
  showGuide();
}

/** 只顯示步驟說明（新手教學也會用到） */
export function showGuide() {
  const d = detect();
  const g = installGuide(d);
  sheet({
    title: '安裝到主畫面',
    body: html`
      <div class="stack" data-noswipe>
        <p class="hint">裝起來之後是全螢幕、沒有網址列，而且**完全離線可用** ——
          曆法與命盤都在你的裝置上算，本來就不需要連網。</p>
        <div class="card" style="padding:var(--sp-4)">
          <div class="row row--between" style="margin-bottom:var(--sp-3)">
            <b>${g.title}</b>
            <span class="badge badge--dash">偵測到你的裝置</span>
          </div>
          ${raw(stepList(g))}
        </div>
        <details class="foldout">
          <summary>不是這個平台？看其他做法</summary>
          <div class="stack" style="margin-top:var(--sp-3)">
            ${ALL_GUIDES().filter(x => x.key !== g.key).map(x => html`
              <div class="card card--flat" style="border:1px dashed var(--line);padding:var(--sp-3) var(--sp-4)">
                <p class="card__label">${x.title}</p>
                ${raw(stepList(x))}
              </div>`)}
          </div>
        </details>
        <p class="hint">判斷是靠 User-Agent，不一定準。跟你看到的畫面對不上就展開上面那一欄自己找。</p>
      </div>`,
    onMount(root) {
      // 說明裡的 ** ** 要轉粗體
      $$('.hint', root).forEach(el => { el.innerHTML = bold(el.innerHTML); });
    },
  });
}
