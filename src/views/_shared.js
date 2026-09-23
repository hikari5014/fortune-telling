import { html, raw, copyText } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { quickBuild, parseQuery } from '../prompt/quick.js';
import { isHourUnknown, affected, LEVEL_TEXT } from '../engines/unknown.js';

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

/**
 * 功能頁上所有「請 LLM 解讀」的唯一入口。
 *
 * 預設（設定裡的「進階提示詞」關著）：就地把提示詞組好、複製到剪貼簿，
 * 直接跳到貼回頁 —— 按一下就能去外部 LLM 貼上，中間不多一頁。
 * 打開「進階提示詞」之後：照舊先進產生器，讓人自己調完再按複製。
 *
 * 組不出來（模板不存在、算盤失敗）時一律退回產生器，
 * 寧可多按一下，也不要讓使用者卡在一個什麼都沒有的畫面。
 *
 * @param {string} target 例如 '/prompt?t=tarot&q=...'（前面有沒有 # 都可以）
 * @param {object} all    目前對象的推算結果；沒給就不附帶命盤資料
 * @returns {boolean} true 表示走了一鍵複製，false 表示進了產生器
 */
export function askPrompt(target, all = null) {
  const to = String(target).replace(/^#/, '');
  const go = () => { location.hash = to; };
  const q = parseQuery(to);
  // 沒指定模板，或明講要進產生器（例如快速搜尋裡的模板清單），就不要攔
  if (store.settings.advancedPrompt || !q.t || q.studio) { go(); return false; }

  let built = null;
  try { built = quickBuild(q, { all, settings: store.settings }); } catch { built = null; }
  if (!built) { go(); return false; }

  copyText(built.text, '提示詞已複製，貼到 LLM 問問看');
  store.setDraft('pending', {
    t: built.template.id, name: built.template.name,
    text: built.text, q: q.q || '', at: Date.now(),
  });
  location.hash = '/paste';
  return true;
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
export function goFocus({ label, text, template = 'freeform', question = '', all = null }) {
  store.setDraft('focus', { label, text, at: Date.now() });
  const q = question ? `&q=${encodeURIComponent(question)}` : '';
  askPrompt(`/prompt?t=${template}&focus=1${q}`, all);
}

/**
 * 時辰不詳的提醒卡。areas 指定這一頁要列哪些領域（不給就列全部）。
 * 回傳空字串表示這份檔案有確切時辰，不需要提醒。
 */
export function hourWarning(profile, areas = null) {
  if (!isHourUnknown(profile)) return '';
  const list = affected(areas);
  if (!list.length) return '';
  return html`
    <div class="warn reveal" role="note">
      <div class="warn__head">${raw(icon('info'))}<b>這份資料沒有確切時辰</b></div>
      <p class="warn__p">以下用中午 12:00 代入，所以：</p>
      <div class="warn__list">
        ${list.map(x => html`
          <div class="warn__row">
            <span class="warn__lv warn__lv--${x.level}">${LEVEL_TEXT[x.level]}</span>
            <span class="warn__txt"><b>${x.what}</b><small>${x.why}</small></span>
          </div>`)}
      </div>
      <p class="warn__p">知道時辰之後回「檔案」頁補上，這些就會恢復可信。</p>
    </div>`;
}
