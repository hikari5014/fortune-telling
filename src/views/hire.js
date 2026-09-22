/* 面談 · 相處風格
   ──────────────────────────────────────────────────────────
   先把界線畫清楚，這不是客套話：

   就業服務法第 5 條第 1 項明文禁止雇主以種族、階級、年齡、出生地、
   容貌、星座、血型等為由歧視求職人。八字與星盤正是從「出生年月日
   與出生地」推出來的東西 —— 拿它當錄用、敘薪或升遷的依據，
   踩的就是法條裡那幾個字。

   所以這一頁只做一件事：把兩張盤的結構差異翻成「相處與溝通風格」，
   給你當面談時的破冰與提問靈感。它不評估能力，不給錄用建議，
   產生出去的提示詞也會把這條界線寫給 LLM 看。 */
import { html, raw, $, $$, sheet, toast, haptic, confirmSheet } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { computeAll } from '../prompt/context.js';
import { synastry } from '../engines/synastry.js';
import { dial } from '../motion.js';
import { invalidate } from '../app.js';
import { resolve, navigate } from '../router.js';
import { quickForm, readQuick, bindQuick, SHICHEN } from '../quickadd.js';
import { CITIES, cityByName } from '../data/cities.js';
import { nameOf, isPrivate } from '../privacy.js';
import { DISCLAIMER, sectionHead, kv, pad } from './_shared.js';

const LAW = html`
  <div class="warn reveal">
    <div class="warn__head">${raw(icon('info'))} 先說清楚這一頁不做什麼</div>
    <p class="warn__p">
      <b>不能拿來決定錄不錄用。</b>就業服務法第 5 條明文禁止以年齡、出生地、容貌、
      星座、血型等為由歧視求職人；八字與星盤正是從出生年月日與出生地推出來的，
      拿來篩人踩的就是同一條線。<br>
      這裡算的是「兩邊的節奏差在哪、溝通容易卡在哪」，用途是面談時的破冰與提問靈感。
      能力、經歷、作品請照常用正規方式評估。
    </p>
  </div>`;

/* ── 公司／團隊檔案 ───────────────────────────────── */

function orgSheet(o = null, after) {
  const b = o?.birth || {};
  const city = o?.city || store.settings.city || '台北';
  sheet({
    title: o ? '編輯公司／團隊' : '新增公司／團隊',
    body: html`
      <div class="stack" data-noswipe>
        <div class="field"><label for="o-name">名稱</label>
          <input class="input" id="o-name" value="${o?.label || ''}" placeholder="玄鑑科技 / 後端組" maxlength="20"></div>
        <div class="field"><label for="o-date">成立日期（國曆）</label>
          <input class="input num" id="o-date" type="date" min="1900-01-01" max="2100-12-31"
            value="${b.y ? `${b.y}-${pad(b.m)}-${pad(b.d)}` : '2015-01-01'}"></div>
        <div class="field"><label for="o-sc">成立時辰</label>
          <select class="select" id="o-sc">
            <option value="" ${b.hourUnknown ? 'selected' : ''}>不知道時辰</option>
            ${raw(SHICHEN.map(([n, h, span]) => html`<option value="${h}" ${!b.hourUnknown && b.h === h ? 'selected' : ''}>${n}時　${span}</option>`).join(''))}
          </select></div>
        <div class="field"><label for="o-city">所在地</label>
          <select class="select" id="o-city">
            ${raw(CITIES.map(c => html`<option value="${c[0]}" ${c[0] === city ? 'selected' : ''}>${c[0]}</option>`).join(''))}
          </select></div>
        <p class="hint">用公司登記的核准設立日期就好。沒有時辰也算得出來，
          只是少掉時柱那一支。公司沒有性別，所以紫微那一套這裡用不上，
          只比八字與星盤。</p>
      </div>`,
    actions: html`<div class="row" style="gap:var(--sp-2)">
      ${o ? html`<button class="btn btn--ghost press" data-del>${raw(icon('trash'))} 刪除</button>` : ''}
      <button class="btn btn--primary press" data-save style="flex:1">${raw(icon('check'))} 儲存</button></div>`,
    onMount(root, close) {
      $('[data-save]', root).addEventListener('click', () => {
        const label = $('#o-name', root).value.trim();
        if (!label) { toast('先給它一個名字'); return; }
        const [y, m, d] = ($('#o-date', root).value || '2015-01-01').split('-').map(Number);
        const sc = $('#o-sc', root).value;
        const [, lat, lon, tz] = cityByName($('#o-city', root).value);
        const saved = store.saveOrg({
          id: o?.id || uid('org'), org: true, label, gender: '不設定',
          birth: { y, m, d, h: sc === '' ? 12 : Number(sc), minute: 0, ...(sc === '' ? { hourUnknown: true } : {}) },
          city: $('#o-city', root).value, lat, lon, tz,
          updatedAt: new Date().toISOString(),
        });
        close(); toast('已儲存'); after?.(saved);
      });
      $('[data-del]', root)?.addEventListener('click', async () => {
        close();
        if (await confirmSheet('刪除', `確定要刪除「${o.label}」嗎？`, '刪除')) {
          store.removeOrg(o.id); toast('已刪除'); after?.(null);
        }
      });
    },
  });
}

/** 公司沒有性別，紫微那一套用不上，算完就拿掉 */
function orgChart(org, settings) {
  const A = computeAll({ ...org, gender: '不設定', org: true }, settings);
  return { ...A, ziwei: null, limits: null, luck: null, naming: null };
}

/* ── 把結構差異翻成工作上的話 ─────────────────────── */

export function workNotes(r) {
  const out = [];
  const b = r.bazi, a = r.astro;
  const kinds = (k) => (b?.items || []).filter(x => x.kind === k);
  const dayHit = (k) => (b?.dayItems || []).some(x => x.kind === k);

  if (dayHit('地支六沖')) out.push(['節奏', '日柱相沖：兩邊做事的節奏差很多，交辦時把「什麼時候要、做到什麼程度」講死，比講方向重要。']);
  if (dayHit('地支六合') || dayHit('地支三合')) out.push(['節奏', '日柱相合：實際做事的默契高，適合長時間並肩的工作，不必每一步都盯。']);
  if (kinds('天干相沖').length >= 2) out.push(['溝通', '天干多處相沖：想法容易正面對撞。回饋盡量寫成文字，當面爭論容易失焦。']);
  if (kinds('天干五合').length >= 2) out.push(['溝通', '天干多處相合：講話容易同調，但也容易互相附和 —— 記得留一個人唱反調。']);
  if (kinds('地支相害').length) out.push(['磨合', '有相害：小事不講會積，建議固定一個一對一的時段清掉。']);
  if (kinds('地支相刑').length) out.push(['磨合', '有相刑：容易在同一件事上互相消耗，界線與分工要先寫下來。']);

  if (a && a.tense > a.harmonious) out.push(['情緒', '星盤緊張相位偏多：容易互相觸發情緒，衝突點通常不是事情本身。先講事實再講感受。']);
  if (a && a.harmonious > a.tense) out.push(['情緒', '星盤和諧相位偏多：相處省力，缺點是太舒服、少了推力，需要外部的期限。']);
  if (a?.elementPair) out.push(['元素', `太陽元素 ${a.elementPair}：這是兩邊看事情的預設角度，差異大不是壞事，是分工的依據。`]);
  if (b?.dayMasters) out.push(['日主', `${b.dayMasters}　日主代表本性，兩邊的五行關係決定誰比較容易讓步。`]);

  if (!out.length) out.push(['平穩', '沒有特別強的合或沖 —— 這通常代表相處平順但也不特別黏，靠制度與流程就能合作。']);
  return out;
}

/* 面談時可以直接拿去問的問題，從結構差異推出來，不是通用題庫 */
function openers(r) {
  const q = [];
  const dayHit = (k) => (r.bazi?.dayItems || []).some(x => x.kind === k);
  if (dayHit('地支六沖')) q.push('「你習慣一次把事情做完，還是分段推進？」');
  if (r.astro && r.astro.tense > r.astro.harmonious) q.push('「上一次和同事意見不合，最後是怎麼收的？」');
  if (r.astro && r.astro.harmonious > r.astro.tense) q.push('「什麼情況會讓你主動踩煞車、跟大家說這樣不行？」');
  q.push('「你覺得自己在團隊裡最常扮演什麼角色？」');
  q.push('「什麼樣的回饋方式對你最有用？當面講還是寫下來？」');
  return q.slice(0, 4);
}

export default {
  title: '面談', eyebrow: 'INTERVIEW',
  render({ settings, query }) {
    const orgs = store.orgs;
    const people = store.profiles;
    const org = orgs.find(o => o.id === query.org) || orgs[0] || null;
    const who = people.find(p => p.id === query.who) || null;

    const head = html`
      ${LAW}
      <section class="card reveal track">
        <div class="section__head" style="margin-top:0"><h2 style="font-size:var(--step-0)">公司／團隊</h2>
          <button class="chip press" id="org-add">${raw(icon('plus'))} 新增</button></div>
        ${orgs.length ? html`
          <div class="row" style="gap:var(--sp-2);align-items:flex-end;margin-top:var(--sp-3)">
            <div class="field" style="flex:1;min-width:0"><label for="sel-org">拿誰來比</label>
              <select class="select" id="sel-org">
                ${orgs.map(o => html`<option value="${o.id}" ${o.id === org?.id ? 'selected' : ''}>${o.label}</option>`)}
              </select></div>
            <button class="iconbtn press" id="org-edit" aria-label="編輯">${raw(icon('edit'))}</button>
          </div>
          <p class="hint" style="margin-top:var(--sp-2)">${org.label}　成立於 ${org.birth.y}-${pad(org.birth.m)}-${pad(org.birth.d)}${org.birth.hourUnknown ? '（時辰不詳）' : ''} · ${org.city}</p>`
        : html`<p class="hint" style="margin-top:var(--sp-3)">先建一份公司或團隊的檔案 ——
            用登記的成立日期就好，這樣才有東西可以比。</p>`}
      </section>`;

    if (!org) return html`${head}${DISCLAIMER}`;

    const entry = html`
      <section class="section">
        ${raw(sectionHead('面試者', `<button class="chip press" id="pick-exist">${icon('profile')} 從現有檔案挑</button>`))}
        <div class="card reveal track">
          ${who ? html`
            <div class="row row--between">
              <div>
                <p class="card__label">目前評估</p>
                <p style="font-family:var(--font-display);font-size:var(--step-1);margin-top:6px">${nameOf(who)}</p>
                <p class="hint" style="margin-top:4px">${isPrivate(who) ? '保密檔案' : `${who.birth.y}-${pad(who.birth.m)}-${pad(who.birth.d)}${who.birth.hourUnknown ? ' 時辰不詳' : ''}`}</p>
              </div>
              <button class="chip press" id="clear-who">換一個</button>
            </div>`
          : html`
            ${quickForm(settings, { idp: 'q', label: '應徵職位／備註' })}
            <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-3)">
              <button class="btn btn--primary press" id="go" style="flex:1">${raw(icon('spark'))} 算相處風格</button>
              <button class="btn btn--ghost press" id="go-private">${raw(icon('profile'))} 存成保密檔案再算</button>
            </div>
            <p class="hint" style="margin-top:var(--sp-2)">「保密檔案」是把手機遞給對方自己填的用法：
              按下去之後出生資料就不再顯示，只留名字，也不能分享出去。</p>`}
        </div>
      </section>`;

    if (!who) return html`${head}${entry}${DISCLAIMER}`;

    const P = computeAll(who, settings);
    const O = orgChart(org, settings);
    const r = synastry(P, O);
    const notes = workNotes(r);

    return html`
      ${head}${entry}

      <section class="card card--invert reveal track" style="margin-top:var(--sp-4)">
        <div class="row row--between row--nowrap" style="align-items:flex-start;gap:var(--sp-4)">
          <div style="min-width:0">
            <p class="card__label">相處順暢度</p>
            <h2 style="font-size:var(--step-3);margin-top:6px">${r.level}</h2>
            <p style="font-size:var(--step--1);opacity:.75;margin-top:4px">${nameOf(who)} × ${org.label}</p>
          </div>
          ${raw(dial(r.score, '順暢度', { scale: true }))}
        </div>
        <p style="font-size:var(--step--2);opacity:.7;margin-top:var(--sp-3);line-height:1.7">
          這個數字講的是「一起做事會不會卡」，不是「這個人好不好」。分數低只代表要多花力氣溝通。
        </p>
      </section>

      <section class="section">
        ${raw(sectionHead('相處風格'))}
        <div class="stack">
          ${raw(notes.map(([tag, text]) => html`
            <div class="card reveal track">
              <p class="card__label">${tag}</p>
              <p style="margin-top:var(--sp-2);color:var(--ink-2);font-size:var(--step--1);line-height:1.85">${text}</p>
            </div>`).join(''))}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('面談時可以問的'))}
        <div class="card reveal track">
          <ul style="margin:0;padding-left:1.2em;color:var(--ink-2);font-size:var(--step--1);line-height:2">
            ${raw(openers(r).map(q => html`<li>${q}</li>`).join(''))}
          </ul>
          <p class="hint" style="margin-top:var(--sp-3)">這幾題是從上面的結構差異推出來的，
            拿去問的是「怎麼合作」，不是驗證命盤準不準。</p>
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('八字互動明細'))}
        <div class="stack">
          ${raw((r.bazi?.items || []).slice(0, 8).map(i => kv(i.kind, `${i.pair}<br><span style="color:var(--ink-3)">${i.text}</span>`)).join('')
            || '<p class="hint">兩張盤之間沒有明顯的刑沖合害。</p>')}
        </div>
      </section>

      <section class="section">
        <a class="btn btn--primary btn--block press" href="#/prompt?t=hire&other=${org.id}">
          ${raw(icon('prompt'))} 產生面談提示詞
        </a>
        <p class="hint" style="margin-top:var(--sp-2)">提示詞裡會夾一段界線，
          明講「不要回答該不該錄用」，避免 LLM 自己往那邊跑。</p>
      </section>
      ${DISCLAIMER}`;
  },

  mount(root, { settings, query }) {
    const orgs = store.orgs;
    const org = orgs.find(o => o.id === query.org) || orgs[0] || null;
    const go = (o, w) => navigate(`/hire?org=${o || ''}${w ? `&who=${w}` : ''}`);

    $('#org-add', root)?.addEventListener('click', () => orgSheet(null, (saved) => { if (saved) go(saved.id, query.who); else resolve(); }));
    $('#org-edit', root)?.addEventListener('click', () => orgSheet(org, (saved) => go(saved?.id, query.who)));
    $('#sel-org', root)?.addEventListener('change', (e) => go(e.target.value, query.who));
    $('#clear-who', root)?.addEventListener('click', () => go(org?.id, null));

    bindQuick(root);
    const save = (priv) => {
      const data = readQuick(root, { idp: 'q', extra: priv ? { private: true, lockedAt: new Date().toISOString() } : {} });
      if (!data) { toast('至少填一個姓或名'); return; }
      store.saveProfile(data);
      invalidate(); haptic(12);
      toast(priv ? `已保密存檔：${nameOf(data)}` : `已建立：${nameOf(data)}`);
      go(org?.id, data.id);
    };
    $('#go', root)?.addEventListener('click', () => save(false));
    $('#go-private', root)?.addEventListener('click', async () => {
      if (await confirmSheet('存成保密檔案',
        '按下確定之後，這個人的出生資料就不會再顯示，也不能編輯或分享。相處風格照常算得出來。', '確定保密')) save(true);
    });

    $('#pick-exist', root)?.addEventListener('click', () => {
      const list = store.profiles;
      if (!list.length) { toast('還沒有任何檔案'); return; }
      sheet({
        title: '挑一個人',
        body: html`<div class="stack" data-noswipe>
          ${list.map(p => html`<button class="tmpl press" data-p="${p.id}">
            <b>${nameOf(p)}</b><small>${isPrivate(p) ? '保密檔案' : `${p.birth.y}-${pad(p.birth.m)}-${pad(p.birth.d)} · ${p.city || ''}`}</small>
          </button>`)}
        </div>`,
        onMount(sr, close) {
          $$('[data-p]', sr).forEach(b => b.addEventListener('click', () => { close(); go(org?.id, b.dataset.p); }));
        },
      });
    });
  },
};
