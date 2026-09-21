import { html, raw, $, $$, sheet, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { baziLuck, ziweiLimits, fortuneOfYear, monthsOfYear, shiShen, triads, sihuaOf } from '../engines/fortune.js';
import { ziweiChart } from '../engines/ziwei.js';
import { fourPillars, STEMS, BRANCHES, gzName } from '../engines/calendar.js';
import { DISCLAIMER, needProfile, sectionHead, kv, pad } from './_shared.js';

const now = new Date();
const THIS_YEAR = now.getFullYear();

export default {
  title: '運勢', eyebrow: 'LUCK CYCLES',
  render({ all, profile, settings, query }) {
    if (!all?.ziwei || !all?.bazi) return needProfile();
    const birthYear = all.base.y;
    const year = Number(query.y) || THIS_YEAR;

    const chart = all.ziwei;
    const limits = ziweiLimits(chart);
    const luck = baziLuck({ ...all.base, gender: profile.gender, lateZiRule: settings.lateZiRule });
    const f = fortuneOfYear({ chart, limits, year, birthYear });
    const months = monthsOfYear(year);
    const dayMaster = all.bazi.day.index % 10;

    const bStep = luck.list.find(x => year >= x.fromYear && year <= x.toYear) || null;
    const years = Array.from({ length: 121 }, (_, i) => birthYear + i);
    const curMonth = months.reduce((acc, m) => (m.startJD <= toJD(now) ? m : acc), months[0]);

    return html`
      <section class="reveal">
        <div class="yearstrip" id="ystrip" data-noswipe>
          ${years.map(y => html`
            <button class="yearstrip__y press" data-y="${y}" aria-current="${y === year}">
              <b>${y}</b><small>虛歲 ${y - birthYear + 1}</small>
            </button>`)}
        </div>
        <div class="row" style="justify-content:center;gap:var(--sp-2);margin-top:var(--sp-3)">
          <button class="chip press" data-jump="-1">往前一年</button>
          <button class="chip press" data-jump="0">今年</button>
          <button class="chip press" data-jump="1">往後一年</button>
        </div>
      </section>

      <section class="card card--invert reveal track" style="margin-top:var(--sp-5)">
        <p class="card__label">${year} 年 · 虛歲 ${f.age}</p>
        <h2 style="font-size:var(--step-4);margin-top:var(--sp-2);letter-spacing:.1em">${f.yearGZName} <span style="font-size:.5em">${f.zodiac}年</span></h2>
        <div class="row" style="gap:6px;margin-top:var(--sp-3)">
          ${f.yearSihua.map(s => html`<span class="badge" style="border-color:currentColor">${s.text}</span>`)}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('本年宮位'))}
        <div class="card reveal track">
          ${raw(kv('流年命宮', `${f.yearPalace.branchName}宮 · 本命${f.yearPalace.name}　${f.yearPalace.main.join('、') || '空宮'}`))}
          ${raw(kv('小限', `${f.minorPalace.branchName}宮 · 本命${f.minorPalace.name}　${f.minorPalace.main.join('、') || '空宮'}`))}
          ${f.major ? raw(kv('大限', `${f.major.fromAge}–${f.major.toAge} 歲　${f.major.palace.branchName}宮 · ${f.major.palace.name}`)) : ''}
          ${f.major ? raw(kv('大限四化', f.major.sihua.map(s => s.text).join('、'))) : ''}
          ${bStep ? raw(kv('八字大運', `${bStep.name}（${bStep.shiShen}）${bStep.fromAge}–${bStep.toAge} 歲`)) : ''}
        </div>
        <button class="btn btn--ghost btn--block press" id="show-triad" style="margin-top:var(--sp-3)">
          ${raw(icon('astro'))} 看流年三方四正
        </button>
      </section>

      <section class="section">
        ${raw(sectionHead('紫微大限', `<span class="hint">${limits.direction} · ${limits.startAge} 歲起運</span>`))}
        <div class="track-row" id="major-row" data-noswipe>
          ${limits.major.map(x => html`
            <button class="luckstep press ${f.major && x.step === f.major.step ? 'is-now' : ''} ${x.toAge < f.age ? 'is-past' : ''}" data-age="${x.fromAge}">
              <small>${x.fromAge}–${x.toAge} 歲</small>
              <b>${x.palace.main.join('') || '空宮'}</b>
              <small>${x.palace.branchName}宮 · ${x.palace.name}</small>
              <small>${x.sihua.map(s => s.star + s.hua).join(' ')}</small>
            </button>`)}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('八字大運', `<span class="hint">${luck.direction} · ${luck.startAge.years} 歲${luck.startAge.months ? luck.startAge.months + ' 個月' : ''}起運</span>`))}
        <div class="track-row" data-noswipe>
          ${luck.list.map(x => html`
            <button class="luckstep press ${bStep && x.step === bStep.step ? 'is-now' : ''} ${x.toYear < year ? 'is-past' : ''}" data-year="${x.fromYear}">
              <small>${x.fromAge}–${x.toAge} 歲</small>
              <b>${x.name}</b>
              <small>${x.shiShen} · ${x.nayin.element}</small>
              <small>${x.fromYear}–${x.toYear}</small>
            </button>`)}
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">
          ${luck.direction}：出生後${luck.forward ? '順數至下一個' : '逆數至上一個'}節「${luck.boundaryTerm}」，
          相距 ${luck.daysToTerm.toFixed(1)} 天，三日折一年。
        </p>
      </section>

      <section class="section">
        ${raw(sectionHead(`${year} 年流月`))}
        <div class="months reveal">
          ${months.map(m => html`
            <div class="month ${year === THIS_YEAR && m.term === curMonth.term ? 'is-now' : ''}">
              <b>${m.name}</b>
              <small>${m.term} ${m.start.m}/${m.start.d}</small>
              <small>${shiShen(dayMaster, m.gz % 10)}</small>
            </div>`)}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('今日'))}
        ${raw(todayCard(all, settings))}
      </section>

      <section class="section">
        <div class="row" style="gap:var(--sp-2)">
          <a class="btn btn--primary press" href="#/prompt?t=year">${raw(icon('prompt'))} 解讀 ${year} 年運勢</a>
          <a class="btn btn--ghost press" href="#/prompt?t=bazi-deep">${raw(icon('clock'))} 八字格局</a>
        </div>
      </section>
      ${DISCLAIMER}`;
  },

  mount(root, { all, profile, settings }) {
    // 年份尺：捲到目前年份並支援點選 / snap
    const strip = $('#ystrip', root);
    const cur = $('.yearstrip__y[aria-current="true"]', strip);
    if (cur) strip.scrollLeft = cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2;

    const goto = (y) => {
      const min = all.base.y, max = all.base.y + 120;
      const yy = Math.max(min, Math.min(max, y));
      haptic(6);
      location.hash = `/fortune?y=${yy}`;
    };
    $$('.yearstrip__y', strip).forEach(b => b.addEventListener('click', () => goto(Number(b.dataset.y))));
    $$('[data-jump]', root).forEach(b => b.addEventListener('click', () => {
      const d = Number(b.dataset.jump);
      const y = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('y')) || THIS_YEAR;
      goto(d === 0 ? THIS_YEAR : y + d);
    }));
    $$('[data-year]', root).forEach(b => b.addEventListener('click', () => goto(Number(b.dataset.year))));
    $$('[data-age]', root).forEach(b => b.addEventListener('click', () => goto(all.base.y + Number(b.dataset.age) - 1)));

    $('#show-triad', root)?.addEventListener('click', () => {
      const year = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('y')) || THIS_YEAR;
      const chart = all.ziwei;
      const limits = ziweiLimits(chart);
      const f = fortuneOfYear({ chart, limits, year, birthYear: all.base.y });
      const t = triads(chart, f.yearPalace.branch);
      sheet({
        title: `${year} 年流年三方四正`,
        body: html`<div class="stack">
          <p class="hint">流年命宮落在本命「${f.yearPalace.name}」，三方四正是這一年最直接受力的四個宮。</p>
          ${t.map(x => raw(kv(`${x.label}　${x.p.name}`,
            `${x.p.branchName}　${x.p.main.join('、') || '空宮'}${x.p.sha.length ? '　煞：' + x.p.sha.join('') : ''}`)))}
          ${raw(kv('流年四化', f.yearSihua.map(s => s.text).join('、')))}
          ${f.major ? raw(kv('大限四化', f.major.sihua.map(s => s.text).join('、'))) : ''}
          <a class="btn btn--primary press" href="#/prompt?t=year">${raw(icon('prompt'))} 產生流年提示詞</a>
        </div>`,
      });
    });
  },
};

function toJD(date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  let yy = y, mm = m;
  if (mm <= 2) { yy -= 1; mm += 12; }
  const A = Math.floor(yy / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + B - 1524.5;
}

function todayCard(all, settings) {
  const d = new Date();
  const p = fourPillars({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(),
    minute: d.getMinutes(), tz: settings.tzOffset, lateZiRule: settings.lateZiRule });
  const dm = all.bazi.day.index % 10;
  return html`
    <div class="card reveal track">
      ${raw(kv('今日干支', `${p.year.name}年 ${p.month.name}月 ${p.day.name}日 ${p.hour.name}時`))}
      ${raw(kv('日干十神', `${p.day.stem} → ${shiShen(dm, p.day.index % 10)}`))}
      ${raw(kv('時干十神', `${p.hour.stem} → ${shiShen(dm, p.hour.index % 10)}`))}
      ${raw(kv('節氣', p.jieqi))}
      ${raw(kv('日主對照', `本命日主 ${STEMS[dm]}（${all.bazi.dayMasterEl}）`))}
    </div>`;
}
