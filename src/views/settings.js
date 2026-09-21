import { html, raw, $, $$, toast, confirmSheet, download, sheet } from '../ui.js';
import { icon } from '../icons.js';
import { store, applyChrome, DEFAULT_SETTINGS } from '../store.js';
import { invalidate } from '../app.js';
import { resolve } from '../router.js';
import { dictSize } from '../data/strokes.js';
import { DISCLAIMER } from './_shared.js';

const APP_VERSION = '0.1.0 · demo';

const row = (title, desc, control) => html`
  <div class="setrow">
    <div class="row row--between">
      <div style="min-width:0"><div class="setrow__t">${title}</div>${desc ? html`<div class="setrow__d">${desc}</div>` : ''}</div>
      ${raw(control)}
    </div>
  </div>`;
const rowStack = (title, desc, control) => html`
  <div class="setrow">
    <div class="setrow__t">${title}</div>${desc ? html`<div class="setrow__d">${desc}</div>` : ''}
    <div style="margin-top:var(--sp-2)">${raw(control)}</div>
  </div>`;

const seg = (id, items, value) => html`<div class="seg" id="${id}">
  ${raw(items.map(([v, label]) => html`<button class="press" data-v="${v}" aria-pressed="${v === String(value)}">${label}</button>`).join(''))}
</div>`;
const sw = (id, on) => html`<div class="switch" role="switch" tabindex="0" id="${id}" aria-checked="${!!on}"><span class="switch__box"></span></div>`;
const select = (id, list, value) => html`<select class="select" id="${id}" style="max-width:220px">
  ${raw(list.map(x => html`<option ${x === value ? 'selected' : ''}>${x}</option>`).join(''))}</select>`;

export default {
  title: '設定', eyebrow: 'SETTINGS',
  render({ settings: s }) {
    return html`
      <div class="stack">
        <section class="setgroup reveal">
          <div class="setgroup__head">外觀</div>
          ${raw(row('主題', '黑白雙色系統，無彩度干擾。', seg('set-theme', [['system', '跟隨系統'], ['light', '白'], ['dark', '黑']], s.theme)))}
          ${raw(rowStack('字級', `目前 ${Math.round(s.fontScale * 100)}%`,
            `<input type="range" id="set-font" min="0.85" max="1.3" step="0.05" value="${s.fontScale}" style="width:100%">`))}
          ${raw(row('介面密度', '影響區塊之間的留白。', seg('set-density', [['compact', '緊湊'], ['normal', '標準'], ['roomy', '寬鬆']], s.density)))}
        </section>

        <section class="setgroup reveal">
          <div class="setgroup__head">動態</div>
          ${raw(row('動畫強度', '關閉後仍保留必要的狀態提示。', seg('set-motion', [['off', '關閉'], ['light', '輕量'], ['full', '完整']], s.motion)))}
          ${raw(row('左右滑動切頁', '在觸控裝置上滑動切換主分頁。', sw('set-swipe', s.swipeNav)))}
          ${raw(row('觸覺回饋', '支援震動的裝置才有作用。', sw('set-haptics', s.haptics)))}
          ${raw(row('指標光暈', '游標／觸點附近的漸層光暈。', sw('set-glow', s.pointerGlow)))}
        </section>

        <section class="setgroup reveal">
          <div class="setgroup__head">命理參數</div>
          ${raw(row('預設時區', '新建檔案時的預設值（UTC 偏移）。',
            `<input class="input num" id="set-tz" type="number" step="0.5" value="${s.tzOffset}" style="max-width:110px">`))}
          ${raw(row('預設城市', '', `<input class="input" id="set-city" value="${s.city}" style="max-width:150px">`))}
          ${raw(rowStack('預設座標', '影響上升星座與真太陽時。',
            `<div class="grid grid--2">
              <div class="field"><label for="set-lat">緯度</label><input class="input num" id="set-lat" type="number" step="0.0001" value="${s.lat}"></div>
              <div class="field"><label for="set-lon">經度</label><input class="input num" id="set-lon" type="number" step="0.0001" value="${s.lon}"></div>
            </div>`))}
          ${raw(row('真太陽時校正', '以經度時差與均時差修正出生時間（影響上升與時柱）。', sw('set-tst', s.trueSolarTime)))}
          ${raw(row('子時換日', '23:00 之後算隔天（晚子時）還是當天。', seg('set-zi', [['next', '晚子換日'], ['same', '不換日']], s.lateZiRule)))}
          ${raw(row('外格算法', `熊崎式傳統規則，或一律「總格−人格+1」。`, seg('set-wai', [['classic', '傳統'], ['simple', '簡式']], s.wageWaiRule)))}
          ${raw(row('筆畫字典', `內建 ${dictSize} 字的康熙筆畫；未收錄的字可在姓名頁手動修正。`, `<span class="badge badge--dash">康熙</span>`))}
        </section>

        <section class="setgroup reveal">
          <div class="setgroup__head">提示詞預設</div>
          ${raw(row('語言', '', select('set-plang', ['繁體中文', '简体中文', 'English', '日本語'], s.promptLang)))}
          ${raw(row('語氣', '', select('set-ptone', ['溫和但直接', '犀利不客氣', '學術嚴謹', '像朋友聊天', '簡潔條列', '鼓勵取向'], s.promptTone)))}
          ${raw(row('深度', '', select('set-pdepth', ['入門易懂', '中等', '深入專業', '極深（含推導過程）'], s.promptDepth)))}
          ${raw(row('輸出格式', '', select('set-pformat', ['Markdown 小標＋條列', '純文字段落', '表格為主', 'JSON 結構化輸出', '先結論後理由'], s.promptFormat)))}
          ${raw(row('附加免責聲明', '在提示詞結尾要求 LLM 加上免責提醒。', sw('set-pdisc', s.promptDisclaimer)))}
          ${raw(rowStack('全域前綴', '每則提示詞最前面都會加上這段（例如你固定的角色設定）。',
            `<textarea class="textarea" id="set-prefix" style="min-height:74px" placeholder="例：你是一位執業二十年的命理師⋯⋯">${s.promptPrefix}</textarea>`))}
          ${raw(rowStack('全域後綴', '每則提示詞結尾都會加上這段。',
            `<textarea class="textarea" id="set-suffix" style="min-height:74px" placeholder="例：請用台灣用語，不要用簡體字。">${s.promptSuffix}</textarea>`))}
        </section>

        <section class="setgroup reveal">
          <div class="setgroup__head">資料</div>
          ${raw(row('檔案 / 模板 / 紀錄',
            `${store.profiles.length} 份檔案 · ${store.templates.length} 個自訂模板 · ${store.records.length} 筆紀錄`,
            `<button class="btn btn--ghost btn--sm press" id="btn-export">${icon('down')} 匯出</button>`))}
          ${raw(row('匯入備份', '會覆蓋同 ID 的資料。', `<button class="btn btn--ghost btn--sm press" id="btn-import">${icon('up')} 匯入</button>`))}
          ${raw(row('安裝為 App', '加到主畫面後可離線使用。', `<button class="btn btn--ghost btn--sm press" id="btn-install">${icon('install')} 安裝</button>`))}
          ${raw(row('重設所有設定', '不會刪除檔案與紀錄。', `<button class="btn btn--ghost btn--sm press" id="btn-reset">${icon('refresh')} 重設</button>`))}
          ${raw(row('清除全部資料', '檔案、模板、紀錄、設定都會刪除。', `<button class="btn btn--ghost btn--sm press" id="btn-clear">${icon('trash')} 清除</button>`))}
        </section>

        <section class="setgroup reveal">
          <div class="setgroup__head">關於</div>
          ${raw(row('版本', APP_VERSION, `<span class="badge badge--dash">PWA</span>`))}
          ${raw(row('運作方式', '所有推算都在本機完成，不連網、不上傳。解讀交給你選的外部 LLM。', ''))}
        </section>
      </div>
      ${DISCLAIMER}`;
  },

  mount(root) {
    const save = (patch) => { store.setSettings(patch); invalidate(); };

    const bindSeg = (id, key, after) => $$(`#${id} button`, root).forEach(b => b.addEventListener('click', () => {
      $$(`#${id} button`, root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      save({ [key]: b.dataset.v });
      after?.(b.dataset.v);
    }));
    const bindSw = (id, key) => {
      const el = $(`#${id}`, root);
      const t = () => { const v = el.getAttribute('aria-checked') !== 'true'; el.setAttribute('aria-checked', String(v)); save({ [key]: v }); };
      el.addEventListener('click', t);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } });
    };
    const bindVal = (id, key, cast = (x) => x) =>
      $(`#${id}`, root)?.addEventListener('change', (e) => save({ [key]: cast(e.target.value) }));

    bindSeg('set-theme', 'theme');
    bindSeg('set-density', 'density');
    bindSeg('set-motion', 'motion');
    bindSeg('set-zi', 'lateZiRule');
    bindSeg('set-wai', 'wageWaiRule');
    ['set-swipe|swipeNav', 'set-haptics|haptics', 'set-glow|pointerGlow', 'set-tst|trueSolarTime', 'set-pdisc|promptDisclaimer']
      .forEach(x => { const [id, key] = x.split('|'); bindSw(id, key); });
    bindVal('set-tz', 'tzOffset', Number);
    bindVal('set-city', 'city');
    bindVal('set-lat', 'lat', Number);
    bindVal('set-lon', 'lon', Number);
    bindVal('set-plang', 'promptLang');
    bindVal('set-ptone', 'promptTone');
    bindVal('set-pdepth', 'promptDepth');
    bindVal('set-pformat', 'promptFormat');
    bindVal('set-prefix', 'promptPrefix');
    bindVal('set-suffix', 'promptSuffix');

    const fontEl = $('#set-font', root);
    fontEl.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--font-scale', e.target.value);
      e.target.closest('.setrow').querySelector('.setrow__d').textContent = `目前 ${Math.round(e.target.value * 100)}%`;
    });
    fontEl.addEventListener('change', (e) => save({ fontScale: Number(e.target.value) }));

    $('#btn-export', root).addEventListener('click', () => {
      download(`玄鑑備份-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll(), null, 2));
      toast('已匯出備份');
    });
    $('#btn-import', root).addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'application/json,.json';
      input.onchange = async () => {
        const f = input.files?.[0]; if (!f) return;
        try {
          store.importAll(JSON.parse(await f.text()), { merge: true });
          invalidate(); toast('已匯入'); resolve();
        } catch (e) { toast('匯入失敗：' + e.message); }
      };
      input.click();
    });
    $('#btn-install', root).addEventListener('click', async () => {
      const p = window.__installPrompt;
      if (!p) {
        sheet({ title: '安裝說明', body: html`<div class="stack">
          <p style="color:var(--ink-2);line-height:1.9">
            <b>iOS Safari</b>：分享 → 加入主畫面<br>
            <b>Android Chrome</b>：右上選單 → 安裝應用程式<br>
            <b>桌面 Chrome / Edge</b>：網址列右側的安裝圖示
          </p>
          <p class="hint">若瀏覽器沒有提供安裝選項，通常是因為網站需要以 HTTPS 提供。</p></div>` });
        return;
      }
      p.prompt(); const { outcome } = await p.userChoice;
      toast(outcome === 'accepted' ? '安裝中…' : '已取消');
      window.__installPrompt = null;
    });
    $('#btn-reset', root).addEventListener('click', async () => {
      if (await confirmSheet('重設設定', '所有偏好會回到預設值，檔案與紀錄保留。', '重設')) {
        store.resetSettings(); invalidate(); toast('已重設'); resolve();
      }
    });
    $('#btn-clear', root).addEventListener('click', async () => {
      if (await confirmSheet('清除全部資料', '檔案、自訂模板、解讀紀錄與設定都會被刪除，無法復原。建議先匯出備份。', '全部清除')) {
        store.clearAll(); invalidate(); toast('已清除'); location.hash = '/'; location.reload();
      }
    });
  },
};
