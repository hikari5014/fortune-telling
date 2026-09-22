import { html, raw, $, $$, toast, sheet, confirmSheet, haptic, copyText, encodeCode, decodeCode } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { invalidate } from '../app.js';
import { resolve, navigate, query } from '../router.js';
import { toSVG } from '../qrcode.js';
import { profileLink, linkCode, canSystemShare, systemShare, chatLinks } from '../sharelink.js';
import { isPrivate, nameOf, birthLine } from '../privacy.js';
import { CITIES } from '../data/cities.js';
import { DISCLAIMER, sectionHead, pad } from './_shared.js';

/* 分享碼只帶推算需要的欄位，不含紀錄、標籤或其他個人資料 */
const PROFILE_FIELDS = ['surname', 'givenName', 'label', 'gender', 'birth', 'city', 'lat', 'lon', 'tz'];
const slim = (p) => Object.fromEntries(PROFILE_FIELDS.filter(k => p[k] != null).map(k => [k, p[k]]));


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
      <label class="switch" style="margin-top:var(--sp-2)">
        <span>不知道出生時辰</span>
        <input type="checkbox" id="f-hu" ${b.hourUnknown ? 'checked' : ''}>
      </label>
      <div class="grid grid--2" id="f-hour-row">
        <div class="field"><label for="f-h">時（24 小時制）</label><input class="input num" id="f-h" type="number" inputmode="numeric" min="0" max="23" value="${b.h ?? 12}"></div>
        <div class="field"><label for="f-min">分</label><input class="input num" id="f-min" type="number" inputmode="numeric" min="0" max="59" value="${b.minute ?? 0}"></div>
      </div>
      <p class="hint" id="f-hour-note">照樣算得出來，只是會用中午 12:00 代入。
        App 會在受影響的地方標出來，提示詞也會提醒 LLM 哪些結論站不住腳。</p>
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
    birth: {
      y: num('f-y', 2000), m: num('f-m', 1), d: num('f-d', 1),
      // 時辰不詳時一律用中午代入，並把這件事記下來
      h: $('#f-hu', root)?.checked ? 12 : num('f-h', 12),
      minute: $('#f-hu', root)?.checked ? 0 : num('f-min', 0),
      ...($('#f-hu', root)?.checked ? { hourUnknown: true } : {}),
    },
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
  // 勾「不知道時辰」就把時分欄位收起來
  const hu = $('#f-hu', root);
  const syncHour = () => {
    const on = hu.checked;
    $('#f-hour-row', root).hidden = on;
    $('#f-hour-note', root).hidden = !on;
    haptic();
  };
  hu?.addEventListener('change', syncHour);
  if (hu) { $('#f-hour-note', root).hidden = !hu.checked; $('#f-hour-row', root).hidden = hu.checked; }
}

function editSheet(p) {
  // 保密檔案不給編輯 —— 一開編輯表單，出生資料就全看見了
  if (p && isPrivate(p)) return lockedSheet(p);
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

/* ── 分享碼 ───────────────────────────────────────
   實際用起來最常失敗的不是編解碼，是「貼到通訊軟體再貼回來」的路上：
   訊息 App 會換行、加空白、插入零寬字元，中文輸入法會把冒號打成全形。
   所以解析這一端盡量容錯，並且把碼本身壓短，減少被折行的機會。 */
export const PROFILE_CODE_PREFIX = 'XJP2:';

/** 解析失敗時，盡量講清楚是哪一種失敗 */
export function codeError(input) {
  const t = String(input || '').trim();
  if (!t) return '先貼上分享碼';
  if (!/XJP2|XJPRO1/i.test(t) && !/^[A-Za-z0-9_-]{16,}$/.test(t.replace(/\s+/g, ''))) {
    return '這段文字裡找不到分享碼，確認一下有沒有複製完整';
  }
  return '分享碼讀不出來，可能複製時被截斷了，請對方重新複製一次';
}

/* 緊湊格式：固定順序的陣列，比具名 JSON 短一半以上 */
const ORDER = ['surname', 'givenName', 'label', 'gender', 'city', 'lat', 'lon', 'tz'];

/** 保密檔案不給分享碼 —— 回傳 null，呼叫端自己處理 */
export function profileCode(p) {
  if (isPrivate(p)) return null;
  const b = p.birth || {};
  const arr = [
    b.y, b.m, b.d, b.h ?? 12, b.minute ?? 0, b.hourUnknown ? 1 : 0,
    ...ORDER.map(k => p[k] ?? ''),
  ];
  return PROFILE_CODE_PREFIX + encodeCode(JSON.stringify(arr));
}

/* 把使用者貼進來的東西洗乾淨：去掉所有空白與零寬字元，全形冒號換成半形 */
const scrub = (s) => String(s || '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/[：]/g, ':')
  .replace(/\s+/g, '');

/**
 * 解析分享碼。容許夾在一整段訊息裡、被折行、缺前綴。
 * 失敗回傳 null。
 */
export function parseProfileCode(input) {
  const text = scrub(input);
  if (!text) return null;

  // 新版緊湊格式 XJP2:
  const m2 = text.match(/XJP2:([A-Za-z0-9_-]+)/);
  if (m2) { const r = fromCompact(m2[1]); if (r) return r; }

  // 舊版 XJPRO1:（具名 JSON），仍然讀得進來
  const m1 = text.match(/XJPRO1:([A-Za-z0-9_-]+)/);
  if (m1) { const r = fromLegacy(m1[1]); if (r) return r; }

  // 完全沒有前綴時，把整串當成 base64 兩種格式都試一次
  const bare = text.replace(/^[A-Za-z0-9]*:/, '');
  if (/^[A-Za-z0-9_-]{16,}$/.test(bare)) {
    return fromCompact(bare) || fromLegacy(bare);
  }
  return null;
}

function fromCompact(b64) {
  try {
    const a = JSON.parse(decodeCode(b64));
    if (!Array.isArray(a) || a.length < 6) return null;
    const [y, m, d, h, minute, hourUnknown, ...rest] = a;
    if (![y, m, d].every(n => Number.isFinite(n))) return null;
    const out = { birth: { y, m, d, h: h ?? 12, minute: minute ?? 0 } };
    if (hourUnknown) out.birth.hourUnknown = true;
    ORDER.forEach((k, i) => { if (rest[i] !== '' && rest[i] != null) out[k] = rest[i]; });
    return out;
  } catch { return null; }
}

function fromLegacy(b64) {
  try {
    const data = JSON.parse(decodeCode(b64));
    if (data.app !== 'xuanjian' || data.kind !== 'profile' || !data.item?.birth) return null;
    const b = data.item.birth;
    if (![b.y, b.m, b.d].every(n => Number.isFinite(n))) return null;
    return data.item;
  } catch { return null; }
}

/** 保密檔案能做的事只剩兩件：換成目前對象，或刪掉 */
function lockedSheet(p) {
  sheet({
    title: nameOf(p),
    body: html`
      <div class="stack" data-noswipe>
        <div class="card">
          <p class="card__label">保密檔案</p>
          <p style="margin-top:var(--sp-3);color:var(--ink-2);font-size:var(--step--1);line-height:1.9">
            這份資料是由本人自己輸入並選擇保密的${p.lockedAt ? `（${p.lockedAt.slice(0, 10)}）` : ''}。<br>
            出生年月日時不再顯示，也不能編輯或分享。要改只能刪掉重填。
          </p>
        </div>
        <p class="hint">推算照常運作 —— 命盤、合盤、提示詞都算得出來。
          只是提示詞裡的「基本資料」會自動拿掉生日那幾行。</p>
      </div>`,
    actions: html`<button class="btn btn--ghost btn--block press" data-del>${raw(icon('trash'))} 刪除這份檔案</button>`,
    onMount(sr, close) {
      $('[data-del]', sr).addEventListener('click', async () => {
        close();
        if (await confirmSheet('刪除檔案', `確定要刪除「${nameOf(p)}」嗎？此動作無法復原。`, '刪除')) {
          store.removeProfile(p.id); invalidate(); toast('已刪除'); resolve();
        }
      });
    },
  });
}

/* ── 分享面板 ─────────────────────────────────────── */

function shareBody(list, current) {
  return html`
    <div class="stack" data-noswipe>
      <p class="hint">分享出去的只有推算要用的欄位：姓名、性別、出生時間、出生地。
        不含你的解讀紀錄、標籤或其他資料，也不經過任何伺服器 ——
        資料是夾在連結裡直接傳給對方的。</p>
      <div class="field"><label for="pc-who">要分享哪一份</label>
        <select class="select" id="pc-who">
          ${list.map(p => html`<option value="${p.id}" ${p.id === current?.id ? 'selected' : ''}>${nameOf(p)}</option>`)}
        </select></div>

      <div class="qrbox" id="pc-qr"></div>
      <p class="hint" id="pc-qr-note">請對方用手機相機對著這張圖 —— iPhone 與 Android 的內建相機
        都會直接跳出連結，點開就把資料帶進他的 App，不用先安裝什麼。</p>

      <div class="row" style="gap:var(--sp-2)">
        <button class="btn btn--primary press" id="pc-send" style="flex:1">${raw(icon('share'))} 傳給朋友</button>
        <button class="btn btn--ghost press" id="pc-link">${raw(icon('copy'))} 複製連結</button>
      </div>
      <div class="row" id="pc-chats" hidden style="gap:5px;flex-wrap:wrap"></div>
      <button class="btn btn--ghost btn--block press" id="pc-copy">${raw(icon('copy'))} 只複製分享碼（純文字）</button>
      <div class="preview" id="pc-out" style="max-height:96px"></div>

      <div class="field" style="margin-top:var(--sp-4)"><label for="pc-in">貼上別人給你的連結或分享碼</label>
        <textarea class="textarea textarea--code" id="pc-in" style="min-height:84px" placeholder="https://…#/profile?c=XJP2:…　或　XJP2:…"></textarea></div>
      <button class="btn btn--ghost btn--block press" id="pc-import">${raw(icon('check'))} 匯入成新檔案</button>
      <p class="hint">連同前後的訊息一起貼也沒關係，被換行、多了空白都讀得出來。</p>
    </div>`;
}

function openShare(current) {
  const list = store.profiles.filter(p => !isPrivate(p));
  if (!list.length) {
    const why = store.profiles.length ? '現有的檔案都設成保密了，保密檔案不能分享。' : '還沒有任何檔案。';
    toast(why);
    return;
  }
  const pick = list.some(p => p.id === current?.id) ? current : list[0];
  sheet({
    title: '分享出生資料',
    body: shareBody(list, pick),
    onMount(sr, close) {
      const out = $('#pc-out', sr);
      const box = $('#pc-qr', sr);
      const note = $('#pc-qr-note', sr);
      let link = '';

      const draw = () => {
        const p = store.profiles.find(x => x.id === $('#pc-who', sr).value);
        const code = p ? profileCode(p) : null;
        out.textContent = code || '';
        link = code ? profileLink(code) : '';
        box.classList.remove('is-fail');
        try {
          box.innerHTML = toSVG(link, { ec: 'M', margin: 2 }) + `<small>${nameOf(p)}</small>`;
          note.hidden = false;
        } catch (e) {
          // 只有內容長到爆表才會走到這裡，說明白比畫一張壞圖好
          box.classList.add('is-fail');
          box.innerHTML = '<small>資料太長，畫不成 QR。請改用下面的「複製連結」。</small>';
          note.hidden = true;
        }
      };
      draw();
      $('#pc-who', sr).addEventListener('change', draw);

      $('#pc-link', sr).addEventListener('click', () => copyText(link, '連結已複製'));
      $('#pc-copy', sr).addEventListener('click', () => copyText(out.textContent, '分享碼已複製'));

      const chats = $('#pc-chats', sr);
      if (!canSystemShare()) {
        $('#pc-send', sr).hidden = true;
        chats.hidden = false;
        chats.innerHTML = chatLinks({ text: '這是我的出生資料，用玄鑑打開就能合盤', url: link })
          .map(c => `<a class="chip press" data-chat target="_blank" rel="noopener">${c.name}</a>`).join('');
      }
      $('#pc-send', sr).addEventListener('click', async () => {
        const p = store.profiles.find(x => x.id === $('#pc-who', sr).value);
        const ok = await systemShare({
          title: '玄鑑 · 出生資料',
          text: `${nameOf(p)} 的出生資料，用玄鑑打開就能合盤`,
          url: link,
        });
        if (!ok) copyText(link, '這台裝置沒有系統分享，已改成複製連結');
      });
      // 聊天 App 的網址要跟著選單重算，所以在按下去的當下才組
      chats.addEventListener('click', (e) => {
        const a = e.target.closest('[data-chat]');
        if (!a) return;
        const hit = chatLinks({ text: '這是我的出生資料，用玄鑑打開就能合盤', url: link })
          .find(c => c.name === a.textContent.trim());
        if (hit) a.href = hit.href;
      });

      $('#pc-import', sr).addEventListener('click', () => {
        const text = $('#pc-in', sr).value;
        const item = parseProfileCode(linkCode(text) || text);
        if (!item) { toast(codeError(text)); return; }
        const p = store.saveProfile({ ...item, id: uid('pro') });
        close();
        toast(`已匯入：${nameOf(p)}`);
        resolve();
      });
    },
  });
}

/** 有人點了分享連結進來 —— 先給他看清楚是誰，再決定要不要收 */
function openIncoming(code) {
  const item = parseProfileCode(code);
  const clear = () => navigate('/profile');
  if (!item) { toast(codeError(code)); clear(); return; }
  const b = item.birth || {};
  sheet({
    title: '收到一份出生資料',
    body: html`
      <div class="stack" data-noswipe>
        <div class="card">
          <p class="card__label">FROM A LINK</p>
          <p style="margin-top:var(--sp-3);font-family:var(--font-display);font-size:var(--step-1)">${nameOf(item)}</p>
          <p class="hint" style="margin-top:6px">${b.y}-${pad(b.m)}-${pad(b.d)}
            ${b.hourUnknown ? '時辰不詳' : `${pad(b.h)}:${pad(b.minute)}`} · ${item.city || ''} · ${item.gender || ''}</p>
        </div>
        <p class="hint">要不要把它存成一份檔案？存了之後就能拿來合盤。
          不存的話什麼都不會留下。</p>
      </div>`,
    actions: html`<div class="row" style="gap:var(--sp-2)">
      <button class="btn btn--ghost press" data-no>不用了</button>
      <button class="btn btn--primary press" data-yes style="flex:1">${raw(icon('check'))} 存起來</button></div>`,
    onMount(sr, close) {
      $('[data-yes]', sr).addEventListener('click', () => {
        const p = store.saveProfile({ ...item, id: uid('pro') });
        close(); toast(`已存檔：${nameOf(p)}`); clear();
      });
      $('[data-no]', sr).addEventListener('click', () => { close(); clear(); });
    },
  });
}

/* ── 代填（保密檔案）─────────────────────────────── */

function openHandover() {
  sheet({
    title: '請對方自己輸入',
    body: html`
      <div class="stack" data-noswipe>
        <div class="card">
          <p class="card__label">保密檔案</p>
          <p style="margin-top:var(--sp-3);color:var(--ink-2);font-size:var(--step--1);line-height:1.9">
            把手機遞給對方，讓他自己填。按下「完成並保密」之後，
            這份資料的出生年月日時就不再顯示在畫面上，只留名字；
            分享碼與 QR 會停用，備份匯出也會整份跳過。
          </p>
        </div>
        <p class="hint">說在前面：這是「不顯示」，不是加密。資料仍然存在這台手機裡，
          懂得開開發者工具的人看得到。而且命盤本身（四柱、星位）足以回推生日，
          所以要保密就別當著別人的面展示命盤。保密之後不能再編輯，要改只能刪掉重填。</p>
        ${form({})}
      </div>`,
    actions: html`<button class="btn btn--primary btn--block press" data-lock>${raw(icon('check'))} 完成並保密</button>`,
    onMount(root, close) {
      bindForm(root);
      $('[data-lock]', root).addEventListener('click', async () => {
        const data = readForm(root, {});
        if (!data.surname && !data.givenName && !data.label) { toast('至少留一個名字，之後就只看得到這個'); return; }
        close();
        const ok = await confirmSheet('確定要保密嗎',
          `「${nameOf(data)}」的出生資料之後就不會再顯示，也不能編輯或分享。要改只能刪掉重填。`, '確定保密');
        if (!ok) return;
        store.saveProfile({ ...data, private: true, lockedAt: new Date().toISOString() });
        invalidate(); haptic(16); toast('已保密存檔'); resolve();
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
        ${raw(sectionHead('出生資料', `<button class="chip press" id="add">${icon('plus')} 新增</button><button class="chip press" id="pro-hand">${icon('profile')} 代填</button><button class="chip press" id="pro-io">${icon('share')} 分享</button>`))}
        ${list.length ? raw(`<div class="grid grid--auto">${list.map(p => html`
          <button class="profile press track reveal" data-id="${p.id}" aria-current="${p.id === profile?.id}">
            <b>${nameOf(p)}</b>
            <small>${birthLine(p)}</small>
            <div class="row" style="gap:5px;margin-top:6px">
              ${isPrivate(p) ? html`<span class="badge badge--solid">保密</span>` : html`<span class="badge badge--dash">${p.gender}</span>`}
              ${!isPrivate(p) && p.birth.hourUnknown ? html`<span class="badge badge--dash">時辰不詳</span>` : ''}
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
            出生地會影響「上升星座」與真太陽時，請盡量填準確。<br>
            「分享」會給你一張 QR 與一條連結，對方用相機掃或點開就收得到。<br>
            「代填」是把手機遞給別人讓他自己填，填完出生資料就不再顯示。
          </p>
        </div>
      </section>
      ${DISCLAIMER}`;
  },
  mount(root, { profile }) {
    // 有人點分享連結進來：#/profile?c=…
    const incoming = query().c;
    if (incoming) openIncoming(incoming);

    $('#pro-io', root)?.addEventListener('click', () => openShare(profile));
    $('#pro-hand', root)?.addEventListener('click', () => openHandover());
    $('#add', root)?.addEventListener('click', () => editSheet(null));
    $('#add2', root)?.addEventListener('click', () => editSheet(null));
    $$('.profile', root).forEach(btn => {
      const p = store.profiles.find(x => x.id === btn.dataset.id);
      let timer = null;
      const openEdit = () => editSheet(p);
      btn.addEventListener('click', () => {
        if (store.currentId === p.id) openEdit();
        else { store.currentId = p.id; invalidate(); haptic(); toast(`已切換：${nameOf(p)}`); resolve(); }
      });
      btn.addEventListener('contextmenu', (e) => { e.preventDefault(); openEdit(); });
      btn.addEventListener('touchstart', () => { timer = setTimeout(() => { haptic(16); openEdit(); }, 520); }, { passive: true });
      ['touchend', 'touchmove', 'touchcancel'].forEach(ev => btn.addEventListener(ev, () => clearTimeout(timer), { passive: true }));
    });
  },
};
