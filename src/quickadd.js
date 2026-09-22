/* 快速新增出生資料
   ──────────────────────────────────────────────────────────
   完整的檔案表單有十幾個欄位，臨時要多建一個人太慢。
   這裡只留非填不可的四件事，其餘沿用設定裡的預設值：

     名字 · 性別 · 生日 · 時辰

   生日用 <input type="date">（手機一點就跳日曆），
   時辰用十二時辰下拉（比打「幾點幾分」快，而且命理本來就只看時辰）。
   要精確到分鐘、要改出生地，到「檔案」頁編輯就好。 */
import { html, raw, $, $$, sheet, toast, haptic } from './ui.js';
import { icon } from './icons.js';
import { store, uid } from './store.js';
import { nameOf } from './privacy.js';
import { invalidate } from './app.js';
import { CITIES, cityByName } from './data/cities.js';

/** 十二時辰：名稱、代表小時（取中點，子時用 0 點） */
export const SHICHEN = [
  ['子', 0, '23:00–01:00'], ['丑', 2, '01:00–03:00'], ['寅', 4, '03:00–05:00'],
  ['卯', 6, '05:00–07:00'], ['辰', 8, '07:00–09:00'], ['巳', 10, '09:00–11:00'],
  ['午', 12, '11:00–13:00'], ['未', 14, '13:00–15:00'], ['申', 16, '15:00–17:00'],
  ['酉', 18, '17:00–19:00'], ['戌', 20, '19:00–21:00'], ['亥', 22, '21:00–23:00'],
];


/* 預設帶三十年前的元旦：比帶今天合理（沒人幫新生兒排八字排這麼急），
   而且提醒使用者這一格一定要改 */
const defaultDate = () => `${new Date().getFullYear() - 30}-01-01`;

/** 快速表單的 HTML（也給面談頁直接嵌進去用） */
export function quickForm(settings, { idp = 'q', label = '' } = {}) {
  const city = settings.city || '台北';
  return html`
    <div class="stack" data-noswipe>
      <div class="grid grid--2">
        <div class="field"><label for="${idp}-sur">姓</label>
          <input class="input" id="${idp}-sur" placeholder="陳" maxlength="4" autocomplete="off"></div>
        <div class="field"><label for="${idp}-giv">名</label>
          <input class="input" id="${idp}-giv" placeholder="怡君" maxlength="6" autocomplete="off"></div>
      </div>
      ${label ? html`<div class="field"><label for="${idp}-label">${label}</label>
        <input class="input" id="${idp}-label" placeholder="例：後端工程師 / 二面" autocomplete="off"></div>` : ''}
      <div class="field"><label>性別</label>
        <div class="row" id="${idp}-gender">
          ${raw(['女', '男', '不設定'].map(g => html`<button class="chip press" type="button" data-g="${g}" aria-pressed="${g === '女'}">${g}</button>`).join(''))}
        </div>
      </div>
      <div class="field"><label for="${idp}-date">出生日期（國曆）</label>
        <input class="input num" id="${idp}-date" type="date" value="${defaultDate()}" min="1900-01-01" max="2100-12-31"></div>
      <div class="field"><label for="${idp}-sc">出生時辰</label>
        <select class="select" id="${idp}-sc">
          <option value="">不知道時辰</option>
          ${raw(SHICHEN.map(([n, h, span]) => html`<option value="${h}" ${h === 12 ? 'selected' : ''}>${n}時　${span}</option>`).join(''))}
        </select></div>
      <div class="field"><label for="${idp}-city">出生地</label>
        <select class="select" id="${idp}-city">
          ${raw(CITIES.map(c => html`<option value="${c[0]}" ${c[0] === city ? 'selected' : ''}>${c[0]}</option>`).join(''))}
        </select></div>
      <p class="hint">只要這幾項就算得出來。要精確到分鐘、或改成自訂座標，
        存完之後到「檔案」頁編輯。</p>
    </div>`;
}

/** 把快速表單讀成一份檔案物件；名字全空回傳 null */
export function readQuick(root, { idp = 'q', extra = {} } = {}) {
  const val = (id) => $(`#${idp}-${id}`, root)?.value.trim() ?? '';
  const surname = val('sur'), givenName = val('giv');
  const label = val('label');
  if (!surname && !givenName && !label) return null;
  const [y, m, d] = (val('date') || '2000-01-01').split('-').map(Number);
  const sc = val('sc');
  const hourUnknown = sc === '';
  const [, lat, lon, tz] = cityByName(val('city'));
  return {
    id: uid('p'),
    surname, givenName, label,
    gender: $(`#${idp}-gender [aria-pressed="true"]`, root)?.dataset.g || '女',
    birth: {
      y: y || 2000, m: m || 1, d: d || 1,
      h: hourUnknown ? 12 : Number(sc),
      minute: 0,
      ...(hourUnknown ? { hourUnknown: true } : {}),
    },
    city: val('city'), lat, lon, tz,
    strokeOverrides: {},
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

/** 性別選擇那排 chip 的點擊 */
export function bindQuick(root, { idp = 'q' } = {}) {
  $$(`#${idp}-gender .chip`, root).forEach(b => b.addEventListener('click', () => {
    $$(`#${idp}-gender .chip`, root).forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    haptic();
  }));
}

/**
 * 叫出快速新增面板。
 * @param {object} o.settings 目前設定（拿預設出生地）
 * @param {boolean} o.makeCurrent 存完要不要切成目前對象（預設要）
 * @param {Function} o.onSaved 存完的回呼，收到那份檔案
 */
export function quickAdd({ settings, makeCurrent = true, onSaved } = {}) {
  sheet({
    title: '快速新增',
    body: quickForm(settings || store.settings),
    actions: html`<button class="btn btn--primary btn--block press" data-save>${raw(icon('check'))} 建立</button>`,
    onMount(root, close) {
      bindQuick(root);
      $('[data-save]', root).addEventListener('click', () => {
        const data = readQuick(root);
        if (!data) { toast('至少填一個姓或名'); return; }
        store.saveProfile(data);
        if (makeCurrent) store.currentId = data.id;
        invalidate();
        close();
        haptic(12);
        toast(`已建立：${nameOf(data)}`);
        onSaved?.(data);
      });
    },
  });
}
