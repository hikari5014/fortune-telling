/* 塔羅
   ──────────────────────────────────────────────────────────
   牌義的部分先說清楚：塔羅沒有單一權威版本。偉特自己寫的
   《The Pictorial Key to the Tarot》（1911）很簡略，之後一百年各家各講。
   App 裡的關鍵字、階段與建議是我自己整理的，都標示出來，不冒充古本。

   唯一有系統來源、而且推得出來的是占星對應（黃金黎明那一套）：
   大牌對一顆行星或一個星座，小牌 2–10 對黃道三十六旬。
   有了這個，就能把牌面接到你自己的本命盤上 ——
   這是這頁少數真的在「算」的東西，不是通用解讀。 */
import { html, raw, $, $$, sheet, copyText, haptic, toast, confirmSheet } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { navigate } from '../router.js';
import { draw, toText, SPREADS, DECK, birthCard, yearCard, chartLink, dailyCard, todayKey } from '../engines/tarot.js';
import { observeReveal } from '../motion.js';
import { nameOf } from '../privacy.js';
import { DISCLAIMER, sectionHead, needProfile } from './_shared.js';

/* ── 牌面 ─────────────────────────────────────────── */

const imgOn = () => store.settings.tarotImages !== false;
const imgSrc = (c) => `assets/tarot/${c.img}.webp`;

/** 一張牌的圖（關掉圖像、或圖抓不到時，退回線稿卡） */
export function cardPic(c, cls = 'tpic') {
  if (!imgOn()) return '';
  return html`<img class="${cls}" src="${imgSrc(c)}" alt="${c.full}" loading="lazy" decoding="async"
    onerror="this.closest('.tcard')?.classList.remove('tcard--img');this.remove()">`;
}

/** 牌桌上的一格 */
function cardCell(c, i) {
  const pic = cardPic(c);
  return html`<div class="tcard ${pic ? 'tcard--img' : ''} ${c.reversed ? 'is-rev' : ''} is-flip" data-i="${i}">
    ${raw(pic || html`<div class="tcard__inner"><span class="tcard__sym">${c.sym}</span><b>${c.name}</b>
      <small>${c.reversed ? '逆位' : '正位'}</small></div>`)}
    <span class="tcard__slot">${c.slot || c.name}${c.reversed ? ' ⤵' : ''}</span>
  </div>`;
}

const note = (k, v) => html`<div class="cardnote"><span class="cardnote__k">${k}</span><span class="cardnote__v">${v}</span></div>`;

/** 一張牌的完整解說（含命盤對照） */
export function cardDetail(c, astro, { slot = '' } = {}) {
  const link = store.settings.tarotChartLink !== false ? chartLink(c, astro) : null;
  const pic = cardPic(c);
  return html`
    <div class="card track reveal">
      <div class="row row--between">
        <span class="card__label">${slot || (c.arcana === '大' ? '大阿爾克那' : `${c.suit}・${c.el}元素`)}</span>
        <span class="badge ${c.reversed ? 'badge--dash' : 'badge--solid'}">${c.reversed ? '逆位' : '正位'}</span>
      </div>
      <div class="cardrow ${pic ? '' : 'cardrow--noimg'}" style="margin-top:var(--sp-3)">
        ${raw(pic)}
        <div>
          <p style="font-family:var(--font-display);font-size:var(--step-1)">${c.full}</p>
          ${c.kw ? html`<div class="row" style="gap:5px;margin-top:6px">
            ${c.kw.map(k => html`<span class="badge badge--dash">${k}</span>`)}</div>` : ''}
          <p style="margin-top:var(--sp-3);color:var(--ink-2);font-size:var(--step--1);line-height:1.85">
            ${c.reversed ? c.rev : c.up}</p>
        </div>
      </div>

      ${c.arcana === '大' ? html`
        <div style="margin-top:var(--sp-3)">
          ${raw(note('核心課題', c.lesson))}
          ${raw(note(c.reversed ? '逆位要當心' : '正位該做的', c.reversed ? c.shadow : c.advice))}
        </div>`
      : html`
        <div style="margin-top:var(--sp-3)">
          ${raw(note('位階', c.stage))}
          ${raw(note(`${c.el}元素${c.reversed ? '（逆）' : ''}`, c.reversed ? c.face.minus : c.face.plus))}
        </div>`}

      ${link ? html`
        <div class="card card--invert" style="margin-top:var(--sp-3);padding:var(--sp-3) var(--sp-4)">
          <p class="card__label">對照你的本命盤</p>
          <p style="margin-top:6px;font-size:var(--step--1);line-height:1.8">${link.label}<br>${link.hit}</p>
          <p style="margin-top:6px;font-size:var(--step--2);opacity:.75;line-height:1.7">${link.text}</p>
        </div>` : ''}
    </div>`;
}

/* ── 牌陣：內建 + 自訂 ────────────────────────────── */

const allSpreads = () => [...SPREADS, ...store.spreads];

function spreadSheet(sp = null) {
  const slots = sp ? [...sp.slots] : ['現況', '該做的', '結果'];
  const rows = (list) => list.map((s, i) => html`
    <div class="row" style="gap:6px;margin-top:6px">
      <span class="counter" style="width:2em;text-align:right">${i + 1}</span>
      <input class="input slotin" value="${s}" placeholder="這個位置代表什麼" maxlength="10">
      <button class="iconbtn press" data-rm="${i}" aria-label="刪掉這個位置">${raw(icon('trash'))}</button>
    </div>`).join('');
  sheet({
    title: sp ? '編輯牌陣' : '自訂牌陣',
    body: html`
      <div class="stack" data-noswipe>
        <div class="field"><label for="sp-name">牌陣名稱</label>
          <input class="input" id="sp-name" value="${sp?.name || ''}" placeholder="例：三個月的走向" maxlength="14"></div>
        <div class="field"><label for="sp-desc">什麼時候用（選填）</label>
          <input class="input" id="sp-desc" value="${sp?.desc || ''}" placeholder="例：想看一段時間內的變化" maxlength="30"></div>
        <div>
          <p class="card__label">每個位置代表什麼</p>
          <div id="slots">${raw(rows(slots))}</div>
          <button class="chip press" id="add-slot" style="margin-top:var(--sp-3)">${raw(icon('plus'))} 加一個位置</button>
        </div>
        <p class="hint">最少 1 個、最多 12 個位置。位置的名字就是解牌時的問題 ——
          寫「阻礙」比寫「第二張」有用得多。</p>
      </div>`,
    actions: html`<div class="row" style="gap:var(--sp-2)">
      ${sp ? html`<button class="btn btn--ghost press" data-del>${raw(icon('trash'))} 刪除</button>` : ''}
      <button class="btn btn--primary press" data-save style="flex:1">${raw(icon('check'))} 儲存</button></div>`,
    onMount(root, close) {
      const box = $('#slots', root);
      const read = () => $$('.slotin', box).map(i => i.value.trim()).filter(Boolean);
      const redraw = (list) => { box.innerHTML = rows(list.length ? list : ['']); };
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-rm]');
        if (!b) return;
        const list = read();
        list.splice(Number(b.dataset.rm), 1);
        redraw(list);
      });
      $('#add-slot', root).addEventListener('click', () => {
        const list = read();
        if (list.length >= 12) { toast('最多 12 個位置'); return; }
        redraw([...list, '']);
      });
      $('[data-save]', root).addEventListener('click', () => {
        const name = $('#sp-name', root).value.trim();
        const list = read();
        if (!name) { toast('先給牌陣一個名字'); return; }
        if (!list.length) { toast('至少留一個位置'); return; }
        store.saveSpread({
          id: sp?.id || uid('sp'), key: sp?.key || uid('sp'), custom: true,
          name, desc: $('#sp-desc', root).value.trim() || `自訂牌陣，${list.length} 張`,
          n: list.length, slots: list,
        });
        close(); toast('已儲存'); navigate('/tarot?tab=spread');
      });
      $('[data-del]', root)?.addEventListener('click', async () => {
        close();
        if (await confirmSheet('刪除牌陣', `確定要刪除「${sp.name}」嗎？`, '刪除')) {
          store.removeSpread(sp.id); toast('已刪除'); navigate('/tarot?tab=spread');
        }
      });
    },
  });
}

/* ── 分頁 ─────────────────────────────────────────── */

function drawTab(d) {
  const list = allSpreads();
  const cur = list.find(s => s.key === (d.tarotSpread || 'three')) || list[1] || list[0];
  return html`
    <section class="card reveal track" data-noswipe>
      <div class="field"><label for="tq">要問的事</label>
        <input class="input" id="tq" value="${d.tarotQ || ''}" placeholder="例如：這段關係接下來會怎麼走？" maxlength="60"></div>
      <div class="field" style="margin-top:var(--sp-3)"><label for="spread">牌陣</label>
        <select class="select" id="spread">
          ${list.map(s => html`<option value="${s.key}" ${s.key === cur.key ? 'selected' : ''}>${s.name}（${s.n} 張）${s.custom ? ' ·自訂' : ''}</option>`)}
        </select></div>
      <p class="hint" id="sp-desc" style="margin-top:var(--sp-2)"></p>
      <div class="switch" id="allow-rev" role="switch" tabindex="0" aria-checked="${d.tarotRev !== false}" style="margin-top:var(--sp-2)">
        <span>允許逆位</span><span class="switch__box"></span>
      </div>
      <button class="btn btn--primary btn--block press" id="shuffle" style="margin-top:var(--sp-4)">
        ${raw(icon('dice'))} 洗牌並抽牌
      </button>
    </section>
    <section id="table" class="section"></section>`;
}

function dailyTab(profile, astro) {
  const who = profile?.id || '';
  const day = todayKey();
  const c = dailyCard(who, day);
  const log = store.dailyLog.filter(x => x.who === who && x.day !== day).slice(0, 14);
  const pic = cardPic(c);
  return html`
    <section class="card reveal track">
      <p class="card__label">${day}　${profile ? nameOf(profile) : '未指定對象'}</p>
      <p class="hint" style="margin-top:6px">同一個人、同一天，抽到的一定是同一張 ——
        重新整理不會換牌，明天才會換。</p>
      <div class="bigcards" style="margin-top:var(--sp-4)">
        <div class="bigcard">
          ${raw(pic || html`<div class="tcard ${c.reversed ? 'is-rev' : ''}" style="width:150px">
            <div class="tcard__inner"><span class="tcard__sym">${c.sym}</span><b>${c.name}</b></div></div>`)}
          <b style="font-family:var(--font-display)">${c.full}</b>
          <span class="badge ${c.reversed ? 'badge--dash' : 'badge--solid'}">${c.reversed ? '逆位' : '正位'}</span>
        </div>
      </div>
    </section>
    <section class="section">${raw(cardDetail(c, astro, { slot: '今日指引' }))}</section>
    <section class="section">
      ${raw(sectionHead('寫下今天'))}
      <div class="card reveal track">
        <textarea class="textarea" id="daily-note" style="min-height:84px"
          placeholder="今天發生了什麼、這張牌說中了沒有。寫下來，過幾週回頭看才有意思。">${
            store.dailyLog.find(x => x.day === day && x.who === who)?.note || ''}</textarea>
        <button class="btn btn--ghost btn--block press" id="save-note" style="margin-top:var(--sp-3)">
          ${raw(icon('check'))} 存起來</button>
      </div>
    </section>
    ${log.length ? html`<section class="section">
      ${raw(sectionHead('前幾天'))}
      <div class="stack">
        ${raw(log.map(x => {
          const card = DECK.find(k => k.id === x.id);
          return html`<div class="rec reveal">
            <div class="rec__meta"><span>${x.day}</span><span>·</span><span>${card?.full || x.id}</span>
              <span>·</span><span>${x.reversed ? '逆位' : '正位'}</span></div>
            ${x.note ? html`<div class="rec__body">${x.note}</div>` : ''}
          </div>`;
        }).join(''))}
      </div>
    </section>` : ''}`;
}

function natalTab(profile, astro) {
  if (!profile) return needProfile('本命牌要用到出生年月日，先建一份檔案。');
  const b = birthCard(profile.birth);
  const y = yearCard(profile.birth);
  const big = (title, card, sub) => html`
    <div class="bigcard">
      ${raw(cardPic(card) || html`<div class="tcard" style="width:150px">
        <div class="tcard__inner"><span class="tcard__sym">${card.sym}</span><b>${card.name}</b></div></div>`)}
      <span class="card__label">${title}</span>
      <b style="font-family:var(--font-display)">${card.full}</b>
      <small style="color:var(--ink-3)">${sub}</small>
    </div>`;
  return html`
    <section class="card reveal track">
      <p class="card__label">${nameOf(profile)}</p>
      <div class="bigcards" style="margin-top:var(--sp-4)">
        ${raw(big('本命牌', b.card, `月 + 日 + 年 = ${b.total}`))}
        ${raw(b.chain.map((c, i) => big(i === b.chain.length - 1 ? '個位數牌' : '中間牌', c, '本命牌再收斂一次')).join(''))}
        ${raw(big(`${y.year} 年度牌`, y.card, `月 + 日 + ${y.year} = ${y.total}`))}
      </div>
      <p class="hint" style="margin-top:var(--sp-4)">
        算法：把出生的月、日與西元年相加，一直把位數加起來，直到落在 1–22，對到那張大牌。
        年度牌把年份換成今年。<br>
        這是二十世紀才成形的做法，沒有古籍出處 —— 它跟八字、紫微的地位不一樣，當成另一個角度看就好。
      </p>
    </section>
    <section class="section">
      ${raw(sectionHead('本命牌'))}
      ${raw(cardDetail(b.card, astro, { slot: '一生的主題' }))}
    </section>
    ${raw(b.chain.map(c => html`<section class="section">
      ${raw(sectionHead(c.num > 9 ? '中間牌' : '個位數牌'))}
      ${raw(cardDetail(c, astro, { slot: '本命牌的底層' }))}
    </section>`).join(''))}
    <section class="section">
      ${raw(sectionHead(`${y.year} 年度牌`))}
      ${raw(cardDetail(y.card, astro, { slot: '今年的主題' }))}
    </section>`;
}

function spreadTab() {
  const mine = store.spreads;
  return html`
    <section class="section" style="margin-top:0">
      ${raw(sectionHead('我的牌陣', `<button class="chip press" id="sp-add">${icon('plus')} 新增</button>`))}
      ${mine.length ? html`<div class="stack">
        ${mine.map(s => html`<button class="tmpl press" data-sp="${s.id}">
          <b>${s.name}　<span class="counter">${s.n} 張</span></b>
          <small>${s.slots.join('｜')}</small>
        </button>`)}
      </div>` : html`<div class="empty reveal">${raw(icon('dice'))}
        <p>還沒有自訂牌陣。<br>把你慣用的問法固定下來，之後抽牌就選得到。</p>
        <button class="btn btn--primary press" id="sp-add2">${raw(icon('plus'))} 建第一個</button>
      </div>`}
    </section>
    <section class="section">
      ${raw(sectionHead('內建牌陣'))}
      <div class="stack">
        ${SPREADS.map(s => html`<div class="tmpl">
          <b>${s.name}　<span class="counter">${s.n} 張</span></b>
          <small>${s.slots.join('｜')}<br>${s.desc}</small>
        </div>`)}
      </div>
    </section>`;
}

/* ── 頁面 ─────────────────────────────────────────── */

const TABS = [['draw', '抽牌'], ['daily', '今日一張'], ['natal', '本命牌'], ['spread', '牌陣']];

export default {
  title: '塔羅', eyebrow: 'TAROT',
  render({ profile, all, query }) {
    const tab = TABS.some(t => t[0] === query.tab) ? query.tab : 'draw';
    const d = store.drafts;
    return html`
      <div class="row" style="justify-content:center">
        <div class="seg" id="ttab">
          ${TABS.map(([k, n]) => html`<button class="press" data-t="${k}" aria-pressed="${tab === k}">${n}</button>`)}
        </div>
      </div>
      <div id="tstage" style="margin-top:var(--sp-4)">
        ${tab === 'draw' ? drawTab(d)
        : tab === 'daily' ? dailyTab(profile, all?.astro)
        : tab === 'natal' ? natalTab(profile, all?.astro)
        : spreadTab()}
      </div>
      ${DISCLAIMER}`;
  },

  mount(root, { profile, all, query }) {
    const tab = TABS.some(t => t[0] === query.tab) ? query.tab : 'draw';
    $$('#ttab button', root).forEach(b => b.addEventListener('click', () => {
      haptic(6);
      navigate(`/tarot?tab=${b.dataset.t}`);
    }));

    if (tab === 'spread') {
      $('#sp-add', root)?.addEventListener('click', () => spreadSheet(null));
      $('#sp-add2', root)?.addEventListener('click', () => spreadSheet(null));
      $$('[data-sp]', root).forEach(b => b.addEventListener('click',
        () => spreadSheet(store.spreads.find(s => s.id === b.dataset.sp))));
      return;
    }

    if (tab === 'daily') {
      const who = profile?.id || '';
      const day = todayKey();
      const c = dailyCard(who, day);
      // 看過就留一筆，之後才有「前幾天」可以回顧
      if (!store.dailyLog.some(x => x.day === day && x.who === who)) {
        store.logDaily({ day, who, id: c.id, reversed: c.reversed, note: '' });
      }
      $('#save-note', root)?.addEventListener('click', () => {
        store.dailyNote(day, who, $('#daily-note', root).value.trim());
        haptic(10); toast('已存下今天');
      });
      return;
    }

    if (tab === 'natal') return;

    /* ── 抽牌 ── */
    const list = allSpreads();
    const desc = $('#sp-desc', root);
    const sel = $('#spread', root);
    const syncDesc = () => { desc.textContent = (list.find(s => s.key === sel.value) || {}).desc || ''; };
    sel.addEventListener('change', () => { syncDesc(); store.setDraft('tarotSpread', sel.value); });
    syncDesc();
    $('#tq', root).addEventListener('input', (e) => store.setDraft('tarotQ', e.target.value));

    const sw = $('#allow-rev', root);
    const toggle = () => {
      const v = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(v));
      store.setDraft('tarotRev', v);
    };
    sw.addEventListener('click', toggle);
    sw.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

    const table = $('#table', root);
    $('#shuffle', root).addEventListener('click', async () => {
      const allowReversed = sw.getAttribute('aria-checked') === 'true';
      const res = draw({ spread: sel.value, allowReversed, spreads: list });
      const fast = document.documentElement.dataset.motion === 'off';

      table.innerHTML = html`
        ${raw(sectionHead(res.spread.name))}
        <div class="deck" id="deck">
          ${res.cards.map(() => html`<div class="tcard is-back"><div class="tcard__inner"></div></div>`)}
        </div>
        <div id="detail"></div>`;

      const cells = $$('#deck .tcard', table);
      for (let i = 0; i < res.cards.length; i++) {
        await new Promise(r => setTimeout(r, fast ? 10 : 210));
        cells[i].outerHTML = cardCell(res.cards[i], i);
        haptic(8);
      }

      const plain = toText(res, $('#tq', root).value.trim(), { astro: all?.astro, profile });
      $('#detail', table).innerHTML = html`
        <div class="stack" style="margin-top:var(--sp-5)">
          ${raw(res.cards.map(c => cardDetail(c, all?.astro, { slot: c.slot })).join(''))}
        </div>
        ${res.note.length ? html`
          <div class="card card--invert" style="margin-top:var(--sp-4)">
            <p class="card__label">牌面整體</p>
            <div style="margin-top:var(--sp-2);line-height:1.9">
              ${res.note.map(n => html`<p>・${n}</p>`)}
            </div>
          </div>` : ''}
        <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-4)">
          <button class="btn btn--primary press" id="ask">${raw(icon('prompt'))} 請 LLM 解牌</button>
          <button class="btn btn--ghost press" id="copy-cards">${raw(icon('copy'))} 複製牌面</button>
          <button class="btn btn--ghost press" id="redraw">${raw(icon('refresh'))} 重抽</button>
        </div>`;
      observeReveal(table);

      $('#copy-cards', table).addEventListener('click', () => copyText(plain, '牌面已複製'));
      $('#redraw', table).addEventListener('click', () => { table.innerHTML = ''; scrollTo({ top: 0, behavior: 'smooth' }); });
      $('#ask', table).addEventListener('click', () => {
        store.setDraft('tarotResult', plain);
        navigate(`/prompt?t=tarot&q=${encodeURIComponent($('#tq', root).value.trim())}`);
      });
      setTimeout(() => $('#detail', table).scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    });
  },
};
