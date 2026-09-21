import { html, raw } from '../ui.js';
import { icon } from '../icons.js';

export const DISCLAIMER = html`<p class="disclaimer">
  本頁數據由裝置本機推算（曆法與天文演算法），可能與不同流派或排盤軟體略有差異。
  命理結果僅供文化娛樂與自我探索參考，不構成醫療、法律、投資或任何專業建議。
</p>`;

export function needProfile(msg = '先建立一份出生資料，才能開始推算。') {
  return html`<div class="empty reveal">
    ${raw(icon('profile'))}
    <p>${msg}</p>
    <a class="btn btn--primary press" href="#/profile">${raw(icon('plus'))} 建立檔案</a>
  </div>`;
}

export function sectionHead(title, extra = '') {
  return html`<div class="section__head"><h2>${title}</h2>${raw(extra)}</div>`;
}

export function kv(k, v, cls = '') {
  return html`<div class="kv"><span class="kv__k">${k}</span><span class="kv__v ${cls}">${raw(v)}</span></div>`;
}

export function promptLink(templateId, label = '產生提示詞') {
  return html`<a class="btn btn--primary press" href="#/prompt?t=${templateId}">
    ${raw(icon('prompt'))} ${label}</a>`;
}

export const pad = (n) => String(n).padStart(2, '0');
