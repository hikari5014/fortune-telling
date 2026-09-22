import { html, raw, $, $$, sheet, copyText, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { ctx } from '../app.js';
import {
  PURPOSES, purposeName, dayInfo, rateDay, monthGrid, findDays, toText,
  hoursOf, currentHourIndex,
} from '../engines/daily.js';
import { observeReveal, initSeg, dial, runCountUps } from '../motion.js';
import { DISCLAIMER, sectionHead, kv, pad, shareBtn, doShare } from './_shared.js';

const WD = ['日', '一', '二', '三', '四', '五', '六'];
const today = () => { const n = new Date(); return [n.getFullYear(), n.getMonth() + 1, n.getDate()]; };

export default {
  title: '擇日', eyebrow: 'DAY PICKER',
  render() {
    const purpose = store.settings.dayPurpose || 'open';
    const tab = store.drafts.dayTab || 'today';
    return html`
      <section class="card reveal track" data-noswipe>
        <div class="field"><label for="dpurp">要辦的事</label>
          <select class="select" id="dpurp">
            ${PURPOSES.map(p => html`<option value="${p.key}" ${p.key === purpose ? 'selected' : ''}>${p.name}　${p.hint}</option>`)}
          </select></div>
        <p class="hint" style="margin-top:var(--sp-2)">選了事項之後，今日宜忌、月曆分數、找日子都會依這件事重新計算。</p>
      </section>

      <div class="row" style="margin-top:var(--sp-5);justify-content:center">
        <div class="seg" id="dtab">
          <button class="press" data-t="today" aria-pressed="${tab === 'today'}">今日</button>
          <button class="press" data-t="month" aria-pressed="${tab === 'month'}">月曆</button>
          <button class="press" data-t="find"  aria-pressed="${tab === 'find'}">找日子</button>
        </div>
      </div>

      <section id="dstage" class="section"></section>
      ${DISCLAIMER}`;
  },

  mount(root) {
    const stage = $('#dstage', root);
    const { settings, all } = ctx();
    const tz = settings.tzOffset;
    const bazi = all?.bazi || null;
    let purpose = store.settings.dayPurpose || 'open';
    let tab = store.drafts.dayTab || 'today';
    let [cy, cm] = today();
    const opts = () => ({ purpose, bazi, tz });

    $('#dpurp', root).addEventListener('change', (e) => {
      purpose = e.target.value;
      store.setSettings({ dayPurpose: purpose });
      draw();
    });
    $$('#dtab button', root).forEach(b => b.addEventListener('click', () => {
      $$('#dtab button', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      tab = b.dataset.t;
      store.setDraft('dayTab', tab);
      haptic(6);
      draw();
    }));

    /* ── 今日 ─────────────────────────────────────── */
    function paneToday() {
      const [y, m, d] = today();
      const info = dayInfo(y, m, d, { tz });
      const r = rateDay(info, opts());
      return html`
        <div class="card reveal">
          <div class="row row--between" style="align-items:flex-start">
            <div>
              <p class="card__label">${info.date} 星期${WD[info.weekday]}</p>
              <p class="dayhead">${info.gz.day.name}<small>日</small></p>
              <p class="hint">${info.gz.year.name}年 ${info.gz.month.name}月　${info.lunar ? `農曆 ${info.lunar.monthName}${info.lunar.dayName}` : ''}</p>
            </div>
            <div class="dayscore">
              ${raw(dial(r.score, `${r.level}・${purposeName(purpose)}`))}
              <span class="luck ${r.cls}">${purposeName(purpose)}　${r.level}</span>
            </div>
          </div>
        </div>
        ${jianchuCard(info)}
        ${hoursCard(info)}
        ${reasonCard(r)}
        ${infoCard(info)}
        <div class="row" style="margin-top:var(--sp-5)">
          <button class="btn btn--primary press" id="d-prompt">${raw(icon('prompt'))} 產生擇日提示詞</button>
          <button class="btn btn--ghost press" id="d-copy">${raw(icon('copy'))} 複製今日資料</button>
          ${shareBtn('d-share')}
        </div>`;
    }

    const jianchuCard = (info) => html`
      <div class="card reveal" style="margin-top:var(--sp-4)">
        ${raw(sectionHead('建除十二神', `<span class="badge badge--solid">${info.jianchu.name}日</span>`))}
        <p class="hint" style="margin-top:var(--sp-2)">${info.jianchu.toneText}。${info.jianchu.text}</p>
        <div class="tags" style="margin-top:var(--sp-3)">
          ${info.jianchu.good.length ? html`<span class="tags__k">宜</span>${info.jianchu.good.map(k => html`<span class="tag tag--on">${purposeName(k)}</span>`)}` : ''}
        </div>
        <div class="tags" style="margin-top:var(--sp-2)">
          ${info.jianchu.bad.length ? html`<span class="tags__k">忌</span>${info.jianchu.bad.map(k => html`<span class="tag">${purposeName(k)}</span>`)}` : ''}
        </div>
      </div>`;

    const hoursCard = (info) => {
      const hs = hoursOf(info);
      const now = currentHourIndex(info);
      const best = Math.max(...hs.map(h => h.score));
      return html`
      <div class="card reveal" style="margin-top:var(--sp-4)">
        ${raw(sectionHead('十二時辰', `<span class="hint">黃道六神為吉</span>`))}
        <div class="hours">
          ${hs.map(h => html`
            <button class="hour press ${h.idx === now ? 'is-now' : ''} ${h.tone === '黃' ? 'is-good' : 'is-bad'}"
                    data-h="${h.idx}" data-date="${info.y},${info.m},${info.d}"
                    aria-label="${h.name} ${h.range} ${h.shen} ${h.score} 分">
              <span class="hour__b">${h.branch}</span>
              <span class="hour__r num">${h.range}</span>
              <span class="hour__s">${h.shen}</span>
              <span class="hour__n num ${h.score === best ? 'is-top' : ''}">${h.score}</span>
            </button>`)}
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">
          ${now != null ? `現在是${hs[now].name}（${hs[now].shen}）。` : ''}
          黃黑道十二神以日支起青龍，再加上日祿、天乙貴人與時支對日支的沖合。點任一格看理由。
        </p>
      </div>`;
    };

    function openHour(y, m, d, idx) {
      const info = dayInfo(y, m, d, { tz });
      const h = hoursOf(info)[idx];
      haptic(6);
      sheet({
        title: `${h.name}　${h.range}`,
        body: `
          <div class="row row--between" style="margin-bottom:var(--sp-4)">
            <div><p class="dayhead" style="font-size:var(--step-3)">${h.gz}<small>時</small></p>
            <p class="hint">${info.date}　${info.gz.day.name}日</p></div>
            <span class="luck ${h.cls}">${h.score}　${h.level}</span>
          </div>
          <div class="reasons">
            ${h.reasons.map(x => `
              <div class="reason">
                <span class="reason__tag">${x.tag}</span>
                <span class="reason__txt">${x.text}</span>
                <span class="reason__n num ${x.delta >= 0 ? 'is-up' : 'is-down'}">${x.delta >= 0 ? '+' : ''}${x.delta}</span>
              </div>`).join('')}
          </div>
          <p class="hint" style="margin-top:var(--sp-3)">基準 60 分起算。</p>`,
      });
    }

    const reasonCard = (r) => html`
      <div class="card reveal" style="margin-top:var(--sp-4)">
        ${raw(sectionHead('這個分數怎麼來的'))}
        <div class="reasons">
          ${r.reasons.map(x => html`
            <div class="reason">
              <span class="reason__tag">${x.tag}</span>
              <span class="reason__txt">${x.text}</span>
              <span class="reason__n num ${x.delta >= 0 ? 'is-up' : 'is-down'}">${x.delta >= 0 ? '+' : ''}${x.delta}</span>
            </div>`)}
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">基準 60 分起算。加減的每一項都列在上面，不藏分數。</p>
      </div>`;

    const infoCard = (info) => html`
      <div class="card reveal" style="margin-top:var(--sp-4)">
        ${raw(kv('沖煞', `${info.chong.text}　煞${info.sha}`))}
        ${raw(kv('節氣月令', info.gz.jieqi + (info.term ? `（今日交${info.term}）` : '')))}
        ${raw(kv('納音', info.gz.day.nayin.name))}
        <div style="margin-top:var(--sp-3)">
          <p class="card__label">彭祖百忌</p>
          ${info.pengzu.map(t => html`<p class="hint">${t}</p>`)}
        </div>
        ${info.special.length ? html`<div style="margin-top:var(--sp-3)">
          <p class="card__label">特殊日</p>
          ${info.special.map(s => html`<p class="hint">${s.name}：${s.text}</p>`)}
        </div>` : ''}
      </div>`;

    /* ── 月曆 ─────────────────────────────────────── */
    function paneMonth() {
      const g = monthGrid(cy, cm, opts());
      const cells = [];
      for (let i = 0; i < g.lead; i++) cells.push(html`<div class="cal__cell cal__cell--pad"></div>`);
      const [ty, tm, td] = today();
      for (const x of g.list) {
        const isToday = x.y === ty && x.m === tm && x.d === td;
        cells.push(html`
          <button class="cal__cell press ${isToday ? 'is-today' : ''}" data-d="${x.d}" data-score="${x.rating.score}">
            <span class="cal__n num">${x.d}</span>
            <span class="cal__l">${x.lunar ? (x.lunar.day === 1 ? x.lunar.monthName : x.lunar.dayName) : ''}</span>
            <span class="cal__j">${x.jianchu.name}</span>
            <span class="cal__bar"><i style="height:${Math.max(4, x.rating.score)}%"></i></span>
          </button>`);
      }
      return html`
        <div class="card reveal" data-noswipe>
          <div class="row row--between">
            <button class="iconbtn press" id="d-prev" aria-label="上個月">${raw(icon('back'))}</button>
            <b class="calhead num">${cy} 年 ${pad(cm)} 月</b>
            <button class="iconbtn press" id="d-next" aria-label="下個月">${raw(icon('chev'))}</button>
          </div>
          <div class="cal__wd">${WD.map(w => html`<span>${w}</span>`)}</div>
          <div class="cal" id="d-cal">${cells}</div>
          <p class="hint" style="margin-top:var(--sp-3)">格子下方的長條是「${purposeName(purpose)}」的分數，越高越適合。點一天看細節。</p>
        </div>`;
    }

    /* ── 找日子 ───────────────────────────────────── */
    function paneFind() {
      const days = Number(store.drafts.dayRange || 60);
      const wk = store.drafts.dayWeekend === true;
      const f = findDays({
        from: today(), days, top: 12, ...opts(),
        weekdays: wk ? [0, 6] : null,
      });
      return html`
        <div class="card reveal" data-noswipe>
          <div class="row row--between">
            <span class="hint">往後找</span>
            <div class="seg" id="d-range">
              ${[30, 60, 90, 180].map(n => html`<button class="press" data-n="${n}" aria-pressed="${n === days}">${n} 天</button>`)}
            </div>
          </div>
          <label class="switch" style="margin-top:var(--sp-3)">
            <span>只看六日</span>
            <input type="checkbox" id="d-wk" ${wk ? 'checked' : ''}>
          </label>
        </div>
        <div class="card reveal" style="margin-top:var(--sp-4)">
          ${raw(sectionHead(`${purposeName(purpose)}｜最好的日子`))}
          <div class="daylist">
            ${f.best.length ? f.best.map(x => dayRow(x)) : html`<p class="hint">這段期間沒有適合的日子，換個範圍或事項試試。</p>`}
          </div>
        </div>
        <div class="card reveal" style="margin-top:var(--sp-4)">
          ${raw(sectionHead('要避開的日子'))}
          <div class="daylist">${f.worst.map(x => dayRow(x))}</div>
        </div>`;
    }

    const dayRow = (x) => html`
      <button class="dayrow press" data-date="${x.y},${x.m},${x.d}">
        <span class="dayrow__d">
          <b class="num">${pad(x.m)}/${pad(x.d)}</b>
          <small>週${WD[x.weekday]}${x.offset === 0 ? '・今天' : ''}</small>
        </span>
        <span class="dayrow__m">
          <b>${x.gz.day.name}　${x.jianchu.name}日</b>
          <small>${x.lunar ? `農曆${x.lunar.monthName}${x.lunar.dayName}　` : ''}${x.chong.text}</small>
        </span>
        <span class="luck ${x.rating.cls}">${x.rating.score}</span>
      </button>`;

    /* ── 單日細節抽屜 ─────────────────────────────── */
    function openDay(y, m, d) {
      const info = dayInfo(y, m, d, { tz });
      const r = rateDay(info, opts());
      sheet({
        title: `${info.date}　${info.gz.day.name}日`,
        body: `
          <div class="row row--between" style="margin-bottom:var(--sp-3)">
            <div><p class="hint">星期${WD[info.weekday]}　${info.lunar ? `農曆 ${info.lunar.monthName}${info.lunar.dayName}` : ''}</p>
            <p class="hint">${info.gz.year.name}年 ${info.gz.month.name}月　${info.gz.jieqi}</p></div>
            <span class="luck ${r.cls}">${r.score}　${r.level}</span>
          </div>
          <div class="sheetcards">
            ${jianchuCard(info)}
            ${hoursCard(info)}
            ${reasonCard(r)}
            ${infoCard(info)}
          </div>
          <div class="row" style="margin-top:var(--sp-4)">
            <button class="btn btn--primary press" data-day-prompt="${info.date}">${icon('prompt')} 產生擇日提示詞</button>
            <button class="btn btn--ghost press" data-day-share>${icon('share')} 長圖</button>
          </div>`,
        onMount(el) {
          observeReveal(el);
          runCountUps(el);
          $$('.hour', el).forEach(b => b.addEventListener('click', () => {
            const [yy, mm, dd] = b.dataset.date.split(',').map(Number);
            openHour(yy, mm, dd, Number(b.dataset.h));
          }));
          $$('[data-day-prompt]', el).forEach(b => b.addEventListener('click', () => toPrompt(info, r)));
          $$('[data-day-share]', el).forEach(b => b.addEventListener('click', async () => {
            const { dayCard } = await import('../sharecards.js');
            doShare(() => dayCard(info, r, purpose), `玄鑑-擇日-${info.date}.png`);
          }));
        },
      });
    }

    function toPrompt(info, r) {
      store.setDraft('dayPick', toText(info, r, purpose));
      store.setDraft('dayPickDate', info.date);
      location.hash = '#/prompt?t=day-pick';
    }

    /* ── 繪製 ─────────────────────────────────────── */
    function draw() {
      stage.innerHTML = tab === 'today' ? paneToday() : tab === 'month' ? paneMonth() : paneFind();
      observeReveal(stage);
      initSeg(stage);
      runCountUps(stage);

      $$('.hour', stage).forEach(b => b.addEventListener('click', () => {
        const [y, m, d] = b.dataset.date.split(',').map(Number);
        openHour(y, m, d, Number(b.dataset.h));
      }));
      if (tab === 'today') {
        const [y, m, d] = today();
        const info = dayInfo(y, m, d, { tz });
        const r = rateDay(info, opts());
        $('#d-prompt', stage)?.addEventListener('click', () => toPrompt(info, r));
        $('#d-copy', stage)?.addEventListener('click', () => copyText(toText(info, r, purpose)));
        $('#d-share', stage)?.addEventListener('click', async () => {
          const { dayCard } = await import('../sharecards.js');
          doShare(() => dayCard(info, r, purpose), `玄鑑-擇日-${info.date}.png`);
        });
      }
      if (tab === 'month') {
        $('#d-prev', stage).addEventListener('click', () => { cm--; if (cm < 1) { cm = 12; cy--; } draw(); });
        $('#d-next', stage).addEventListener('click', () => { cm++; if (cm > 12) { cm = 1; cy++; } draw(); });
        $$('#d-cal .cal__cell[data-d]', stage).forEach(b =>
          b.addEventListener('click', () => openDay(cy, cm, Number(b.dataset.d))));
      }
      if (tab === 'find') {
        $$('#d-range button', stage).forEach(b => b.addEventListener('click', () => {
          store.setDraft('dayRange', Number(b.dataset.n));
          draw();
        }));
        $('#d-wk', stage).addEventListener('change', (e) => {
          store.setDraft('dayWeekend', e.target.checked);
          draw();
        });
        $$('.dayrow', stage).forEach(b => b.addEventListener('click', () => {
          const [y, m, d] = b.dataset.date.split(',').map(Number);
          openDay(y, m, d);
        }));
      }
    }

    draw();
  },
};
