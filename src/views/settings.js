import { html, raw, $, $$, toast, confirmSheet, download, sheet, haptic, hapticSupport } from '../ui.js';
import { icon } from '../icons.js';
import { store, applyChrome, DEFAULT_SETTINGS } from '../store.js';
import { invalidate } from '../app.js';
import { resolve } from '../router.js';
import { dictSize } from '../data/strokes.js';
import { APP_VERSION, APP_STAGE, CHANGELOG } from '../data/changelog.js';
import { DISCLAIMER } from './_shared.js';
import { detect } from '../platform.js';


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

/* 誠實說明這台裝置到底支不支援，而不是給一個按了沒反應的開關 */
function hapticNote() {
  const kind = hapticSupport();
  if (kind === 'vibrate') return '這台裝置支援震動 API，開啟後按鈕與手勢會有輕微回饋。';
  if (kind === 'ios') return 'iOS Safari 沒有震動 API。這裡改用 iOS 17.4 之後的切換開關會帶觸覺的行為，'
    + '不是正式 API —— 系統設定關掉觸覺、或版本較舊時仍然不會有反應。';
  return '這台裝置沒有可用的觸覺回饋介面，開了也不會有作用。';
}

const seg = (id, items, value) => html`<div class="seg" id="${id}">
  ${raw(items.map(([v, label]) => html`<button class="press" data-v="${v}" aria-pressed="${v === String(value)}">${label}</button>`).join(''))}
</div>`;
const sw = (id, on) => html`<div class="switch" role="switch" tabindex="0" id="${id}" aria-checked="${!!on}"><span class="switch__box"></span></div>`;
const select = (id, list, value) => html`<select class="select" id="${id}" style="max-width:220px">
  ${raw(list.map(x => html`<option ${x === value ? 'selected' : ''}>${x}</option>`).join(''))}</select>`;

export default {
  title: '設定', eyebrow: 'SETTINGS',
  render({ settings: s }) {
    const plat = detect();
    return html`
      <div class="stack">
        <section class="setgroup reveal">
          <div class="setgroup__head">外觀</div>
          ${raw(row('主題', '黑白雙色系統，無彩度干擾。', seg('set-theme', [['system', '跟隨系統'], ['light', '白'], ['dark', '黑']], s.theme)))}
          ${raw(rowStack('字級', `目前 ${Math.round(s.fontScale * 100)}%`,
            `<input type="range" id="set-font" min="0.85" max="1.3" step="0.05" value="${s.fontScale}" style="width:100%">`))}
          ${raw(row('介面密度', '影響區塊之間的留白。', seg('set-density', [['compact', '緊湊'], ['normal', '標準'], ['roomy', '寬鬆']], s.density)))}
          ${raw(row('語調',
            'App 自己寫的解釋文字要用哪一種口吻，提示詞也會跟著要求 LLM 用同一種。'
            + '文言版涵蓋建除十二神、黃黑道十二神、八宅八星、數字磁場、生命靈數與西洋十二宮；'
            + '塔羅牌義與易經卦爻不改寫（前者本來就是關鍵字，後者應引用原文）。',
            seg('set-register', [['bai', '白話文'], ['wen', '文言文']], s.register)))}
        </section>

        <section class="setgroup reveal">
          <div class="setgroup__head">動態</div>
          ${raw(row('動畫強度', '關閉後仍保留必要的狀態提示。', seg('set-motion', [['off', '關閉'], ['light', '輕量'], ['full', '完整']], s.motion)))}
          ${raw(row('左右滑動切頁', '在觸控裝置上左右滑動切換分頁。方向鎖定後才會跟手，螢幕邊緣讓給系統返回手勢。', sw('set-swipe', s.swipeNav)))}
          ${raw(row('觸覺回饋', hapticNote(), sw('set-haptics', s.haptics)))}
          ${raw(row('指標光暈', '游標附近的漸層光暈。觸控裝置一律關閉，避免拖曳時畫面抖動。', sw('set-glow', s.pointerGlow)))}
          ${raw(row('命盤特效',
            '完整：星盤畫出相位連線、星體有光暈、刻度環極慢自轉；紫微的宮格依序浮現、三方四正描邊。'
            + '輕量：只保留進場動畫。動畫強度設為「關閉」或系統要求減少動態時，這裡一律失效。',
            seg('set-fx', [['off', '關閉'], ['subtle', '輕量'], ['full', '完整']], s.chartEffects)))}
          ${raw(row('分數用色階',
            '契合度、擇日、姓名、號碼的分數環用 0 紅 → 100 綠的色階。'
            + '關閉則維持純黑白。色階只是輔助，圈中央的數字本來就在，紅綠色盲也讀得到。',
            sw('set-scorecolor', s.scoreColor !== false)))}
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
          ${raw(row('數目字筆畫', '一～十依數值計（四＝4、五＝5…），關閉則用康熙實際筆畫（四＝5、五＝4…）。', sw('set-numeral', s.numeralRule !== false)))}
          ${raw(row('筆畫字典', `涵蓋 ${dictSize.toLocaleString()} 個漢字，由 Unicode Unihan 部首餘筆推算；個別字可在姓名頁手動修正。`, `<span class="badge badge--dash">康熙</span>`))}
        </section>

        <section class="setgroup reveal">
          <div class="setgroup__head">塔羅</div>
          ${raw(row('牌面圖像',
            '偉特牌（1909）的公有領域掃描，已轉成灰階配合黑白調性，深色主題下會反相。'
            + '78 張約 2.3 MB，第一次看到哪張才下載哪張，之後離線也看得到，換版本不會重抓。'
            + '關掉就用線稿卡，一點流量都不花。',
            sw('set-tarotimg', s.tarotImages !== false)))}
          ${raw(row('抽牌儀式',
            '按下抽牌後會進到一支全螢幕的過場：聚牌、洗牌、攤成扇形，'
            + '由你自己在扇面上滑動挑牌，選滿之後自動翻開，再進解說。'
            + '牌在洗好的那一刻就定了，你挑的是位置 —— 跟實體牌一樣。'
            + '關掉就直接出結果。動畫強度設為「關閉」或系統要求減少動態時一律跳過。',
            sw('set-tarotcer', s.tarotCeremony !== false)))}
          ${raw(row('牌面對照本命盤',
            '大牌對應一顆行星或一個星座，小牌二到十對應黃道三十六旬（黃金黎明系統）。'
            + '開啟後會去你的本命盤上看那個位置有什麼 —— 這是塔羅頁少數真的在「算」的東西。'
            + '需要先有一份出生資料。',
            sw('set-tarotlink', s.tarotChartLink !== false)))}
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
            `${store.profiles.length} 份檔案 · ${store.templates.length} 個自訂模板 · ${store.records.length} 筆紀錄`
            + (store.profiles.some(p => p.private) ? `（其中 ${store.profiles.filter(p => p.private).length} 份保密，不會進備份檔）` : ''),
            `<button class="btn btn--ghost btn--sm press" id="btn-export">${icon('down')} 匯出</button>`))}
          ${raw(row('匯入備份', '會覆蓋同 ID 的資料。', `<button class="btn btn--ghost btn--sm press" id="btn-import">${icon('up')} 匯入</button>`))}
          ${raw(row('安裝為 App', `偵測到：${plat.os} · ${plat.browser}${plat.installed ? '（已從主畫面開啟）' : ''}。加到主畫面後是全螢幕、可離線。`,
            `<button class="btn btn--ghost btn--sm press" id="btn-install">${icon('install')} ${plat.installed ? '已安裝' : '安裝'}</button>`))}
          ${raw(row('安裝步驟說明', '看這台裝置該怎麼裝，也可以展開其他平台的做法。',
            `<button class="btn btn--ghost btn--sm press" id="btn-guide">${icon('info')} 看說明</button>`))}
          ${raw(row('新手教學', '從頭走一次：建立出生資料、看命盤、用提示詞器。',
            `<button class="btn btn--ghost btn--sm press" id="btn-tour">${icon('spark')} 重看</button>`))}
          ${raw(row('重設所有設定', '不會刪除檔案與紀錄。', `<button class="btn btn--ghost btn--sm press" id="btn-reset">${icon('refresh')} 重設</button>`))}
          ${raw(row('清除全部資料', '檔案、模板、紀錄、設定都會刪除。', `<button class="btn btn--ghost btn--sm press" id="btn-clear">${icon('trash')} 清除</button>`))}
        </section>

        <section class="setgroup reveal">
          <div class="setgroup__head">關於</div>
          ${raw(row('版本', `v${APP_VERSION} · ${APP_STAGE}　${CHANGELOG[0].date} 發布`,
            `<a class="btn btn--ghost btn--sm press" href="#/about">${icon('info')} 更新紀錄</a>`))}
          ${raw(row('運作方式', '所有推算都在本機完成，不連網、不上傳。解讀交給你選的外部 LLM。',
            `<a class="btn btn--ghost btn--sm press" href="#/about" aria-label="前往關於頁">${icon('chev')}</a>`))}
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
      const t = () => {
        const v = el.getAttribute('aria-checked') !== 'true';
        el.setAttribute('aria-checked', String(v));
        save({ [key]: v });
        // 打開觸覺回饋時立刻震一下，讓人當場知道這台裝置到底有沒有用
        if (key === 'haptics' && v) {
          haptic(18);
          toast(hapticSupport() ? '剛才有感覺到嗎？沒有的話這台裝置就是不支援。' : '這台裝置沒有可用的觸覺介面。');
        }
      };
      el.addEventListener('click', t);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } });
    };
    const bindVal = (id, key, cast = (x) => x) =>
      $(`#${id}`, root)?.addEventListener('change', (e) => save({ [key]: cast(e.target.value) }));

    bindSeg('set-theme', 'theme');
    bindSeg('set-density', 'density');
    bindSeg('set-register', 'register');
    bindSeg('set-fx', 'chartEffects');
    bindSeg('set-motion', 'motion');
    bindSeg('set-zi', 'lateZiRule');
    bindSeg('set-wai', 'wageWaiRule');
    ['set-swipe|swipeNav', 'set-haptics|haptics', 'set-glow|pointerGlow', 'set-scorecolor|scoreColor', 'set-tst|trueSolarTime', 'set-pdisc|promptDisclaimer', 'set-numeral|numeralRule', 'set-tarotimg|tarotImages', 'set-tarotlink|tarotChartLink', 'set-tarotcer|tarotCeremony']
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
    $('#btn-install', root).addEventListener('click', () => import('../install.js').then(m => m.openInstall()));
    $('#btn-guide', root).addEventListener('click', () => import('../install.js').then(m => m.showGuide()));
    $('#btn-tour', root).addEventListener('click', () => import('../onboarding.js').then(m => m.startTour()));
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
