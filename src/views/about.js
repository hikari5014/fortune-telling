import { html, raw, $, $$, toast, copyText } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { APP_VERSION, APP_STAGE, CHANGELOG, KIND_LABEL } from '../data/changelog.js';
import { dictSize } from '../data/strokes.js';
import { DECK } from '../data/tarot.js';
import { HEX_BY_N } from '../data/hexagrams.js';
import { BUILTIN } from '../prompt/templates.js';
import { PENGZU_STEM, PENGZU_BRANCH } from '../engines/daily.js';
import { DISCLAIMER, sectionHead, kv } from './_shared.js';

const REPO = 'https://github.com/hikari5014/fortune-telling';
const SITE = 'https://hikari5014.github.io/fortune-telling/';

export default {
  title: '關於', eyebrow: 'ABOUT',
  render() {
    const latest = CHANGELOG[0];
    return html`
      <section class="card reveal track">
        <div class="verhero">
          <p class="card__label">目前版本</p>
          <p class="verhero__num">${APP_VERSION}<small>${APP_STAGE}</small></p>
          <p class="hint">${latest.date} 發布 · ${latest.title}</p>
        </div>
        <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-4)">
          <button class="btn btn--primary press" id="check">${raw(icon('refresh'))} 檢查更新</button>
          <span class="chip" id="net"></span>
        </div>
        <p class="hint" id="check-msg" style="margin-top:var(--sp-3)"></p>
      </section>

      <section class="section">
        ${raw(sectionHead('更新紀錄', `<span class="hint">${CHANGELOG.length} 個版本</span>`))}
        <div class="rel">
          ${CHANGELOG.map((r, i) => html`
            <article class="relitem reveal ${i === 0 ? 'relitem--now' : ''}">
              <div class="relitem__head">
                <span class="relitem__v">${r.v}</span>
                <span class="relitem__d">${r.date}</span>
              </div>
              <p class="relitem__t">${r.title}</p>
              <ul>
                ${r.items.map(it => html`
                  <li data-kind="${it.kind}">
                    <span class="relitem__tag">${KIND_LABEL[it.kind]}</span>
                    <p class="relitem__txt">${it.text}</p>
                  </li>`)}
              </ul>
            </article>`)}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('內建資料'))}
        <div class="card reveal track">
          ${raw(kv('康熙筆畫字典', `<span class="num">${dictSize.toLocaleString()}</span> 字（Unicode Unihan 推算）`))}
          ${raw(kv('周易卦數', `<span class="num">${Object.keys(HEX_BY_N).length}</span> 卦`))}
          ${raw(kv('塔羅牌數', `<span class="num">${DECK.length}</span> 張`))}
          ${raw(kv('彭祖百忌條文', `<span class="num">${PENGZU_STEM.length + PENGZU_BRANCH.length}</span> 條`))}
          ${raw(kv('內建提示詞模板', `<span class="num">${BUILTIN.length}</span> 個`))}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('這台裝置上的資料'))}
        <div class="card reveal track">
          ${raw(kv('出生檔案', `<span class="num">${store.profiles.length}</span> 份`))}
          ${raw(kv('自訂模板', `<span class="num">${store.templates.length}</span> 個`))}
          ${raw(kv('解讀紀錄', `<span class="num">${store.records.length}</span> 筆`))}
          ${raw(kv('候選名', `<span class="num">${store.candidates.length}</span> 個`))}
          <p class="hint" style="margin-top:var(--sp-3)">
            全部存在這台裝置的瀏覽器裡，不會上傳。到<a href="#/settings" style="text-decoration:underline">設定</a>可以匯出備份。
          </p>
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('關於這個 App'))}
        <div class="card reveal track">
          <p style="font-size:var(--step--1);color:var(--ink-2);line-height:1.9">
            曆法、節氣、農曆、四柱、星盤、紫微、姓名五格、數字磁場、卜卦、塔羅
            —— 全部在你的裝置上算，不連網、不上傳。<br><br>
            需要「解讀」的部分不內建模型，而是幫你把資料組成一段提示詞，
            你複製到任何 LLM，再把回覆貼回來存檔。
          </p>
          <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-4)">
            <a class="btn btn--ghost btn--sm press" href="${REPO}" target="_blank" rel="noopener">${raw(icon('link'))} 原始碼</a>
            <button class="btn btn--ghost btn--sm press" id="copy-site">${raw(icon('share'))} 複製網址</button>
          </div>
        </div>
      </section>
      ${DISCLAIMER}`;
  },

  mount(root) {
    // 看過就清掉新版提示
    store.setSettings({ seenVersion: APP_VERSION });
    document.documentElement.removeAttribute('data-updated');

    const net = $('#net', root);
    const syncNet = () => {
      const on = navigator.onLine;
      net.textContent = on ? '已連線' : '離線中（App 照常運作）';
      net.classList.toggle('is-on', !on);
    };
    syncNet();
    addEventListener('online', syncNet);
    addEventListener('offline', syncNet);

    $('#copy-site', root).addEventListener('click', () => copyText(SITE, '網址已複製'));

    $('#check', root).addEventListener('click', async () => {
      const msg = $('#check-msg', root);
      const btn = $('#check', root);
      if (!('serviceWorker' in navigator)) { msg.textContent = '這個瀏覽器不支援離線快取，重新整理即為最新版。'; return; }
      btn.disabled = true;
      msg.textContent = '正在向伺服器確認⋯⋯';
      try {
        const reg = window.__swReg || await navigator.serviceWorker.getRegistration();
        if (!reg) { msg.textContent = '尚未註冊離線快取，重新整理即為最新版。'; btn.disabled = false; return; }
        await reg.update();
        if (reg.installing || reg.waiting) {
          msg.textContent = '找到新版本，正在套用，畫面會自動重新載入⋯⋯';
          reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        } else {
          msg.textContent = `已經是最新版本（${APP_VERSION}）。`;
          toast('已是最新版本');
        }
      } catch (e) {
        msg.textContent = '檢查失敗，可能目前離線。稍後再試即可。';
      }
      btn.disabled = false;
    });
  },
};
