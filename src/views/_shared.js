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

/** 分享長圖按鈕（HTML） */
export function shareBtn(id = 'share-img', label = '存成長圖') {
  return html`<button class="btn btn--ghost press" id="${id}">${raw(icon('share'))} ${label}</button>`;
}

/**
 * 按下分享：畫圖 → 有 Web Share 就叫系統分享，否則下載
 * @param {function} build 回傳文件描述的函式（按下才算，避免每次 render 都畫）
 */
export async function doShare(build, filename) {
  const { toast } = await import('../ui.js');
  try {
    const { shareCard } = await import('../share.js');
    toast('產生圖片中…');
    const r = await shareCard(build(), filename);
    if (r === 'downloaded') toast('已存成 PNG');
    else if (r === 'shared') toast('已分享');
  } catch (e) {
    toast('產生圖片失敗：' + (e.message || e));
  }
}

/** 「深問這一項」按鈕（HTML 字串，可放進抽屜的 body） */
export function focusBtn(label = '深問這一項') {
  return `<button class="btn btn--primary press" data-focus>${icon('prompt')} ${label}</button>`;
}

/**
 * 帶著一個具體項目跳到提示詞頁
 * @param {object} o {label 顯示用標題, text 要餵給 LLM 的內容, template 模板 id, question 預填問題}
 */
export async function goFocus({ label, text, template = 'freeform', question = '' }) {
  const { store } = await import('../store.js');
  store.setDraft('focus', { label, text, at: Date.now() });
  const q = question ? `&q=${encodeURIComponent(question)}` : '';
  location.hash = `/prompt?t=${template}&focus=1${q}`;
}
