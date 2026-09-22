import { html, raw, $, $$, sheet, copyText } from '../ui.js';
import { icon } from '../icons.js';
import { analyze, toText, HIDDEN } from '../engines/bazi.js';
import { BRANCHES, STEMS, STEM_EL, BRANCH_EL, EL_ORDER } from '../engines/calendar.js';
import { shiShen } from '../engines/fortune.js';
import { observeReveal, runCountUps, dial } from '../motion.js';
import { focusBtn, goFocus, DISCLAIMER, needProfile, sectionHead, kv, shareBtn, doShare } from './_shared.js';

const POS = ['年', '月', '日', '時'];

export default {
  title: '八字', eyebrow: 'FOUR PILLARS',
  render({ all }) {
    if (!all?.bazi) return html`${needProfile('八字要用出生年月日時，先建立一份出生資料。')}${DISCLAIMER}`;
    const b = all.bazi;
    const a = analyze(b);
    const P = [b.year, b.month, b.day, b.hour];
    const dayStem = b.day.index % 10;
    const maxPct = Math.max(...Object.values(a.power.pct));

    return html`
      <section class="card reveal">
        <div class="pillars">
          ${P.map((p, i) => html`
            <div class="pillar press track" data-p="${i}">
              <small>${POS[i]}柱</small>
              <b>${p.stem}</b><b>${p.branch}</b>
              <em>${p.stemEl}${p.branchEl}</em>
              <em style="font-size:9px;color:var(--ink-4)">${i === 2 ? '日主' : shiShen(dayStem, p.index % 10)}</em>
            </div>`)}
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">
          日主 <b>${b.dayMaster}（${b.dayMasterEl}）</b>　生肖 ${b.zodiac}　節氣月令 ${b.jieqi}　${b.hourName}
        </p>
        <p class="hint">點任一柱看藏干與十神。</p>
      </section>

      <section class="section reveal">
        ${raw(sectionHead('五行力量'))}
        <div class="card">
          <div class="elbars">
            ${EL_ORDER.map(k => html`
              <div class="elbar">
                <span class="elbar__k">${k}</span>
                <span class="elbar__t"><i style="width:${(a.power.pct[k] / maxPct * 100).toFixed(1)}%"></i></span>
                <span class="elbar__v num">${a.power.pct[k]}%</span>
              </div>`)}
          </div>
          <p class="hint" style="margin-top:var(--sp-3)">天干各算 1，地支藏干依本氣、中氣、餘氣加權，月支再乘 1.5。</p>
        </div>
      </section>

      <section class="section reveal">
        ${raw(sectionHead('日主旺衰'))}
        <div class="card">
          <div class="row row--between" style="align-items:flex-start;gap:var(--sp-4)">
            <div style="min-width:0">
              <p class="card__label">評分 ${a.strength.score >= 0 ? '+' : ''}${a.strength.score}</p>
              <p class="dayhead">${a.use.balance}<small>${a.strength.band}</small></p>
              <p class="hint">月令${BRANCHES[b.month.index % 12]}，日主居「${a.strength.seasonState}」</p>
            </div>
            <div class="dayscore">
              ${raw(dial(a.strength.index, a.use.balance))}
              <span class="luck ${a.use.balance === '中和' ? 'luck--half' : 'luck--good'}">${a.use.balance}</span>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:var(--sp-4)">
          ${raw(sectionHead('評分怎麼來的'))}
          <div class="reasons">
            ${a.strength.items.map(x => html`
              <div class="reason">
                <span class="reason__tag">${x.tag}</span>
                <span class="reason__txt">${x.text}</span>
                <span class="reason__n num ${x.delta >= 0 ? 'is-up' : 'is-down'}">${x.delta >= 0 ? '+' : ''}${x.delta}</span>
              </div>`)}
          </div>
          <p class="hint" style="margin-top:var(--sp-3)">得令、得地、得助算加分，洩剋算扣分。每一項都列出來，不藏分數。</p>
        </div>
      </section>

      <section class="section reveal">
        ${raw(sectionHead('喜用與忌神'))}
        <div class="card">
          <p class="hint" style="font-size:var(--step-0);color:var(--ink-2);line-height:1.9">${a.use.reason}</p>
          ${a.use.like.length ? html`
            <div style="margin-top:var(--sp-4)">
              <p class="card__label">喜用</p>
              <div class="daylist" style="margin-top:6px">
                ${a.use.like.map(x => html`
                  <div class="dayrow" style="cursor:default">
                    <span class="dayrow__d"><b>${x.group}</b><small>${x.el}</small></span>
                    <span class="dayrow__m"><b>${x.text}</b></span>
                    <span class="luck luck--good">喜</span>
                  </div>`)}
              </div>
            </div>
            <div style="margin-top:var(--sp-4)">
              <p class="card__label">忌神</p>
              <div class="daylist" style="margin-top:6px">
                ${a.use.avoid.map(x => html`
                  <div class="dayrow" style="cursor:default">
                    <span class="dayrow__d"><b>${x.group}</b><small>${x.el}</small></span>
                    <span class="dayrow__m"><b>${x.text}</b></span>
                    <span class="luck luck--bad">忌</span>
                  </div>`)}
              </div>
            </div>` : ''}
          <div style="margin-top:var(--sp-4)">
            ${raw(kv('調候', a.use.climate.key))}
            <p class="hint" style="margin-top:6px">${a.use.climateNote}</p>
          </div>
        </div>
      </section>

      <section class="section reveal">
        <div class="card card--flat" style="border:1px dashed var(--line);padding:var(--sp-4)">
          <p class="card__label">流派說明</p>
          <p class="hint" style="margin-top:6px">本頁採用${a.use.school}。</p>
          <p class="hint" style="margin-top:6px">${a.use.caveat}</p>
        </div>
      </section>

      <div class="row" style="margin-top:var(--sp-5)">
        ${raw(focusBtn('深問旺衰喜用'))}
        <button class="btn btn--ghost press" id="b-copy">${raw(icon('copy'))} 複製</button>
        ${shareBtn('b-share')}
      </div>
      ${DISCLAIMER}`;
  },

  mount(root, { all, profile }) {
    if (!all?.bazi) return;
    const b = all.bazi;
    const a = analyze(b);
    const P = [b.year, b.month, b.day, b.hour];
    const dayStem = b.day.index % 10;

    $$('[data-p]', root).forEach(el => el.addEventListener('click', () => {
      const i = Number(el.dataset.p);
      const p = P[i];
      const br = p.index % 12;
      sheet({
        title: `${POS[i]}柱　${p.name}`,
        body: html`<div class="stack">
          ${raw(kv('天干', `${p.stem}（${p.stemEl}）　${i === 2 ? '日主本身' : shiShen(dayStem, p.index % 10)}`))}
          ${raw(kv('地支', `${p.branch}（${p.branchEl}）`))}
          ${raw(kv('納音', p.nayin.name))}
          <div>
            <p class="card__label">地支藏干</p>
            <div class="daylist" style="margin-top:6px">
              ${HIDDEN[br].map((ch, k) => html`
                <div class="dayrow" style="cursor:default">
                  <span class="dayrow__d"><b>${ch}</b><small>${['本氣', '中氣', '餘氣'][k]}</small></span>
                  <span class="dayrow__m"><b>${STEM_EL[STEMS.indexOf(ch)]}</b><small>對日主為 ${shiShen(dayStem, STEMS.indexOf(ch))}</small></span>
                </div>`)}
            </div>
          </div>
          <p class="hint">${POS[i]}柱看的是${['家世與長輩', '成長環境與事業', '自身與配偶', '子女與晚年'][i]}。</p>
        </div>`,
      });
    }));

    const text = () => toText(a, b);
    $('#b-copy', root).addEventListener('click', () => copyText(text()));
    $('[data-focus]', root).addEventListener('click', () => goFocus({
      template: 'bazi-deep',
      label: `八字旺衰　${a.use.balance}（${a.strength.band}）`,
      text: text(),
    }));
    $('#b-share', root).addEventListener('click', async () => {
      const { baziCard } = await import('../sharecards.js');
      doShare(() => baziCard(b, a, profile), '玄鑑-八字.png');
    });

    observeReveal(root);
    runCountUps(root);
    requestAnimationFrame(() => $$('.elbar__t i', root).forEach(el => {
      const w = el.style.width; el.style.width = '0';
      requestAnimationFrame(() => { el.style.width = w; });
    }));
  },
};
