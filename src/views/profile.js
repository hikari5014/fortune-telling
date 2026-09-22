import { html, raw, $, $$, toast, sheet, confirmSheet, haptic, copyText, encodeCode, decodeCode } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { invalidate } from '../app.js';
import { resolve } from '../router.js';
import { DISCLAIMER, sectionHead, pad } from './_shared.js';

/* 分享碼只帶推算需要的欄位，不含紀錄、標籤或其他個人資料 */
const PROFILE_FIELDS = ['surname', 'givenName', 'label', 'gender', 'birth', 'city', 'lat', 'lon', 'tz'];
const slim = (p) => Object.fromEntries(PROFILE_FIELDS.filter(k => p[k] != null).map(k => [k, p[k]]));

const CITIES = [
  ['台北', 25.0330, 121.5654, 8], ['新北', 25.0169, 121.4627, 8], ['桃園', 24.9937, 121.3010, 8],
  ['台中', 24.1477, 120.6736, 8], ['台南', 22.9999, 120.2269, 8], ['高雄', 22.6273, 120.3014, 8],
  ['花蓮', 23.9871, 121.6015, 8], ['宜蘭', 24.7021, 121.7378, 8], ['新竹', 24.8138, 120.9675, 8],
  ['嘉義', 23.4801, 120.4491, 8], ['香港', 22.3193, 114.1694, 8], ['澳門', 22.1987, 113.5439, 8],
  ['北京', 39.9042, 116.4074, 8], ['上海', 31.2304, 121.4737, 8], ['新加坡', 1.3521, 103.8198, 8],
  ['吉隆坡', 3.1390, 101.6869, 8], ['東京', 35.6762, 139.6503, 9], ['首爾', 37.5665, 126.9780, 9],
  ['洛杉磯', 34.0522, -118.2437, -8], ['紐約', 40.7128, -74.0060, -5], ['倫敦', 51.5074, -0.1278, 0],
  ['雪梨', -33.8688, 151.2093, 10], ['溫哥華', 49.2827, -123.1207, -8],
];

function form(p = {}) {
  const b = p.birth || {};
  const now = new Date();
  return html`
    <div class="stack" data-noswipe>
      <div class="grid grid--2">
        <div class="field"><label for="f-sur">姓</label><input class="input" id="f-sur" value="${p.surname || ''}" placeholder="陳" maxlength="4"></div>
        <div class="field"><label for="f-giv">名</label><input class="input" id="f-giv" value="${p.givenName || ''}" placeholder="怡君" maxlength="6"></div>
      </div>
      <div class="field"><label for="f-label">備註標籤</label><input class="input" id="f-label" value="${p.label || ''}" placeholder="自己 / 媽媽 / 客戶 A"></div>
      <div class="field"><label>性別</label>
        <div class="row" id="f-gender">
          ${raw(['女', '男', '不設定'].map(g => html`<button class="chip press" data-g="${g}" aria-pressed="${(p.gender || '女') === g}">${g}</button>`).join(''))}
        </div>
      </div>
      <div class="grid grid--3">
        <div class="field"><label for="f-y">西元年</label><input class="input num" id="f-y" type="number" inputmode="numeric" min="1900" max="2100" value="${b.y ?? now.getFullYear() - 30}"></div>
        <div class="field"><label for="f-m">月</label><input class="input num" id="f-m" type="number" inputmode="numeric" min="1" max="12" value="${b.m ?? 1}"></div>
        <div class="field"><label for="f-d">日</label><input class="input num" id="f-d" type="number" inputmode="numeric" min="1" max="31" value="${b.d ?? 1}"></div>
      </div>
      <div class="grid grid--2">
        <div class="field"><label for="f-h">時（24 小時制）</label><input class="input num" id="f-h" type="number" inputmode="numeric" min="0" max="23" value="${b.h ?? 12}"></div>
        <div class="field"><label for="f-min">分</label><input class="input num" id="f-min" type="number" inputmode="numeric" min="0" max="59" value="${b.minute ?? 0}"></div>
      </div>
      <p class="hint">不確定時辰？填 12:00，並記得紫微與上升會失準；之後可回來修正。</p>
      <div class="field"><label for="f-city">出生地</label>
        <select class="select" id="f-city">
          ${raw(CITIES.map(c => html`<option value="${c[0]}" ${p.city === c[0] ? 'selected' : ''}>${c[0]}</option>`).join(''))}
          <option value="__custom" ${p.city && !CITIES.some(c => c[0] === p.city) ? 'selected' : ''}>自訂座標…</option>
        </select>
      </div>
      <div class="grid grid--3" id="f-coord">
        <div class="field"><label for="f-lat">緯度</label><input class="input num" id="f-lat" type="number" step="0.0001" value="${p.lat ?? 25.033}"></div>
        <div class="field"><label for="f-lon">經度</label><input class="input num" id="f-lon" type="number" step="0.0001" value="${p.lon ?? 121.5654}"></div>
        <div class="field"><label for="f-tz">時區</label><input class="input num" id="f-tz" type="number" step="0.5" value="${p.tz ?? 8}"></div>
      </div>
      <div class="grid grid--2">
        <div class="field"><label for="f-phone">手機號碼（選填）</label><input class="input num" id="f-phone" value="${p.phone || ''}" placeholder="0912345678" inputmode="tel"></div>
        <div class="field"><label for="f-plate">車牌（選填）</label><input class="input num" id="f-plate" value="${p.plate || ''}" placeholder="ABC-1368"></div>
      </div>
    </div>`;
}

function readForm(root, base = {}) {
  const val = (id) => $(`#${id}`, root)?.value.trim() ?? '';
  const num = (id, def = 0) => { const v = parseFloat(val(id)); return Number.isFinite(v) ? v : def; };
  const gender = $('#f-gender [aria-pressed="true"]', root)?.dataset.g || '女';
  const city = val('f-city');
  return {
    ...base,
    id: base.id || uid('p'),
    surname: val('f-sur'), givenName: val('f-giv'), label: val('f-label'),
    gender,
    birth: { y: num('f-y', 2000), m: num('f-m', 1), d: num('f-d', 1), h: num('f-h', 12), minute: num('f-min', 0) },
    city: city === '__custom' ? '自訂' : city,
    lat: num('f-lat', 25.033), lon: num('f-lon', 121.5654), tz: num('f-tz', 8),
    phone: val('f-phone'), plate: val('f-plate'),
    strokeOverrides: base.strokeOverrides || {},
    updatedAt: new Date().toISOString(),
  };
}

function bindForm(root) {
  $$('#f-gender .chip', root).forEach(b => b.addEventListener('click', () => {
    $$('#f-gender .chip', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true'); haptic();
  }));
  $('#f-city', root)?.addEventListener('change', (e) => {
    const c = CITIES.find(x => x[0] === e.target.value);
    if (c) { $('#f-lat', root).value = c[1]; $('#f-lon', root).value = c[2]; $('#f-tz', root).value = c[3]; }
  });
}

function editSheet(p) {
  sheet({
    title: p ? '編輯檔案' : '新增檔案',
    body: form(p || {}),
    actions: html`<div class="row" style="gap:var(--sp-2)">
      ${p ? html`<button class="btn btn--ghost press" data-del>${raw(icon('trash'))} 刪除</button>` : ''}
      <button class="btn btn--primary press" data-save style="flex:1">${raw(icon('check'))} 儲存</button></div>`,
    onMount(root, close) {
      bindForm(root);
      $('[data-save]', root).addEventListener('click', () => {
        const data = readForm(root, p || {});
        if (!data.surname && !data.givenName && !data.label) { toast('至少填一個姓名或標籤'); return; }
        store.saveProfile(data);
        store.currentId = data.id;
        invalidate(); close(); toast('已儲存'); resolve();
      });
      $('[data-del]', root)?.addEventListener('click', async () => {
        close();
        if (await confirmSheet('刪除檔案', `確定要刪除「${(p.surname || '') + (p.givenName || '') || p.label}」嗎？此動作無法復原。`, '刪除')) {
          store.removeProfile(p.id); invalidate(); toast('已刪除'); resolve();
        }
      });
    },
  });
}

/* ── 分享碼 ───────────────────────────────────────── */
export const PROFILE_CODE_PREFIX = 'XJPRO1:';

export function profileCode(p) {
  return PROFILE_CODE_PREFIX + encodeCode(JSON.stringify({ app: 'xuanjian', kind: 'profile', v: 1, item: slim(p) }));
}

/** 解析分享碼；失敗回傳 null */
export function parseProfileCode(code) {
  try {
    const raw = String(code || '').trim().replace(/^XJPRO1:/, '');
    const data = JSON.parse(decodeCode(raw));
    if (data.app !== 'xuanjian' || data.kind !== 'profile' || !data.item?.birth) return null;
    const b = data.item.birth;
    if (![b.y, b.m, b.d].every(n => Number.isFinite(n))) return null;
    return data.item;
  } catch { return null; }
}

function openShare(current) {
  const list = store.profiles;
  sheet({
    title: '出生資料分享碼',
    body: html`
      <div class="stack" data-noswipe>
        <p class="hint">分享碼是一段純文字，可以直接貼到訊息裡傳給朋友。
          對方貼回自己的 App 就能合盤，不需要帳號、不經過任何伺服器。</p>
        <div class="field"><label for="pc-who">要分享哪一份</label>
          <select class="select" id="pc-who">
            ${list.map(p => html`<option value="${p.id}" ${p.id === current?.id ? 'selected' : ''}>${(p.surname || '') + (p.givenName || '') || p.label || '未命名'}</option>`)}
          </select></div>
        <div class="preview" id="pc-out" style="max-height:120px"></div>
        <button class="btn btn--primary btn--block press" id="pc-copy">${raw(icon('copy'))} 複製分享碼</button>
        <p class="hint">只含姓名、性別、出生時間與出生地 —— 推算需要的欄位。
          不含你的解讀紀錄、標籤或任何其他資料。</p>
        <div class="field" style="margin-top:var(--sp-3)"><label for="pc-in">貼上別人的分享碼</label>
          <textarea class="textarea textarea--code" id="pc-in" style="min-height:90px" placeholder="XJPRO1:..."></textarea></div>
        <button class="btn btn--ghost btn--block press" id="pc-import">${raw(icon('check'))} 匯入成新檔案</button>
      </div>`,
    onMount(sr, close) {
      const out = $('#pc-out', sr);
      const draw = () => {
        const p = store.profiles.find(x => x.id === $('#pc-who', sr).value);
        out.textContent = p ? profileCode(p) : '';
      };
      draw();
      $('#pc-who', sr).addEventListener('change', draw);
      $('#pc-copy', sr).addEventListener('click', () => copyText(out.textContent, '分享碼已複製'));
      $('#pc-import', sr).addEventListener('click', () => {
        const item = parseProfileCode($('#pc-in', sr).value);
        if (!item) { toast('分享碼無法解析'); return; }
        const p = store.saveProfile({ ...item, id: uid('pro') });
        close();
        toast(`已匯入：${(p.surname || '') + (p.givenName || '') || p.label || '未命名'}`);
        resolve();
      });
    },
  });
}

export default {
  title: '檔案', eyebrow: 'PROFILES',
  render({ profile }) {
    const list = store.profiles;
    return html`
      <section class="section" style="margin-top:0">
        ${raw(sectionHead('出生資料', `<button class="chip press" id="add">${icon('plus')} 新增</button><button class="chip press" id="pro-io">${icon('share')} 分享碼</button>`))}
        ${list.length ? raw(`<div class="grid grid--auto">${list.map(p => html`
          <button class="profile press track reveal" data-id="${p.id}" aria-current="${p.id === profile?.id}">
            <b>${(p.surname || '') + (p.givenName || '') || p.label || '未命名'}</b>
            <small>${p.birth.y}-${pad(p.birth.m)}-${pad(p.birth.d)} ${pad(p.birth.h)}:${pad(p.birth.minute)} · ${p.city || ''}</small>
            <div class="row" style="gap:5px;margin-top:6px">
              <span class="badge badge--dash">${p.gender}</span>
              ${p.label ? html`<span class="badge badge--dash">${p.label}</span>` : ''}
              ${p.id === profile?.id ? html`<span class="badge badge--solid">使用中</span>` : ''}
            </div>
          </button>`).join('')}</div>`) : html`
          <div class="empty reveal">${raw(icon('profile'))}
            <p>還沒有任何檔案。<br>建立一份出生資料就能開始推算。</p>
            <button class="btn btn--primary press" id="add2">${raw(icon('plus'))} 建立第一份</button>
          </div>`}
      </section>

      <section class="section">
        ${raw(sectionHead('操作說明'))}
        <div class="card reveal track">
          <p class="card__label">TIP</p>
          <p style="margin-top:var(--sp-3);color:var(--ink-2);font-size:var(--step--1);line-height:1.9">
            點一下卡片＝切換為目前對象；長按（或再點一次使用中的卡片）＝編輯。<br>
            可以建立多份檔案：自己、家人、朋友，隨時切換比對。<br>
            出生地會影響「上升星座」與真太陽時，請盡量填準確。
          </p>
        </div>
      </section>
      ${DISCLAIMER}`;
  },
  mount(root, { profile }) {
    $('#pro-io', root)?.addEventListener('click', () => openShare(profile));
    $('#add', root)?.addEventListener('click', () => editSheet(null));
    $('#add2', root)?.addEventListener('click', () => editSheet(null));
    $$('.profile', root).forEach(btn => {
      const p = store.profiles.find(x => x.id === btn.dataset.id);
      let timer = null;
      const openEdit = () => editSheet(p);
      btn.addEventListener('click', () => {
        if (store.currentId === p.id) openEdit();
        else { store.currentId = p.id; invalidate(); haptic(); toast(`已切換：${(p.surname || '') + (p.givenName || '') || p.label}`); resolve(); }
      });
      btn.addEventListener('contextmenu', (e) => { e.preventDefault(); openEdit(); });
      btn.addEventListener('touchstart', () => { timer = setTimeout(() => { haptic(16); openEdit(); }, 520); }, { passive: true });
      ['touchend', 'touchmove', 'touchcancel'].forEach(ev => btn.addEventListener(ev, () => clearTimeout(timer), { passive: true }));
    });
  },
};
