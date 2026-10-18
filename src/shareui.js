/* 分享卡的抽屜：預覽、換風格、要不要印上「所問的事」、分享或存圖 */

import { html, raw, $, $$, sheet, toast, haptic } from './ui.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { renderShare, STYLES } from './sharecard.js';

const toBlob = (cv) => new Promise(r => cv.toBlob(r, 'image/png'));

/** 分享卡按鈕（放進結果頁的按鈕列） */
export const shareCardBtn = (id = 'sc-share', label = '分享卡') => html`<button class="btn btn--ghost btn--share press" id="${id}">${raw(icon('share'))} ${label}</button>`;

/**
 * 打開分享抽屜。spec 見 sharecard.js；name 是存檔的檔名（不含副檔名）
 * spec.ask 有值時，抽屜裡多一個「印上我問的事」的開關（預設不印 —— 那常常是私事）
 */
export function openShare(spec, name = '玄鑑') {
  let style = store.settings.shareStyle || 'star', withAsk = false, cv = null, busy = false;
  const body = html`
    <div class="sc-sheet">
      <div class="sc-preview" id="sc-pv"><span class="sc-loading">畫圖中⋯⋯</span></div>
      <div class="seg sc-styles" role="group" aria-label="風格">${STYLES.map(s => html`<button class="seg__b press" data-style="${s.k}" aria-pressed="${s.k === style}">${s.t}</button>`)}</div>
      ${spec.ask ? html`<label class="sc-ask"><input type="checkbox" id="sc-ask"> 印上「${spec.ask.replace(/^[^：]+：/, '')}」</label>` : ''}
      <p class="hint">卡片上不會有你的姓名和生日。底下的 QR 掃了會直接打開玄鑑的這個功能。</p>
      <div class="row" style="gap:8px;justify-content:center">
        <button class="btn btn--primary press" id="sc-go">${raw(icon('share'))} 分享</button>
        <button class="btn btn--ghost press" id="sc-save">存成圖片</button>
      </div>
    </div>`;
  sheet({
    title: '分享卡', body,
    async onMount(root) {
      const pv = $('#sc-pv', root);
      const draw = async () => {
        busy = true; pv.classList.add('is-busy');
        cv = await renderShare({ ...spec, ask: withAsk ? spec.ask : '' }, style);
        const url = cv.toDataURL('image/jpeg', 0.82);
        pv.innerHTML = `<img src="${url}" alt="分享卡預覽">`;
        pv.classList.remove('is-busy'); busy = false;
      };
      $$('[data-style]', root).forEach(b => b.addEventListener('click', () => {
        if (busy) return;
        style = b.dataset.style; store.setSettings({ shareStyle: style });
        $$('[data-style]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        haptic(6); draw();
      }));
      $('#sc-ask', root)?.addEventListener('change', (e) => { withAsk = e.target.checked; draw(); });
      const file = async () => { const blob = await toBlob(cv); return blob && new File([blob], `${name}.png`, { type: 'image/png' }); };
      $('#sc-go', root).addEventListener('click', async () => {
        if (!cv) return;
        const f = await file();
        if (f && navigator.canShare?.({ files: [f] })) {
          try { await navigator.share({ files: [f], title: spec.title || '玄鑑', text: `${spec.title || ''}｜玄鑑 ${spec.link || ''}`.trim() }); return; }
          catch (e) { if (e.name === 'AbortError') return; }
        }
        save(f); toast('這台裝置不能直接分享，已存成圖片');
      });
      $('#sc-save', root).addEventListener('click', async () => { if (cv) { save(await file()); toast('已存成圖片'); } });
      draw();
    },
  });
}

function save(f) {
  if (!f) return;
  const url = URL.createObjectURL(f);
  const a = document.createElement('a'); a.href = url; a.download = f.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
