import { html, raw, $, $$ } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { todayInfo } from '../prompt/context.js';
import { APP_VERSION } from '../data/changelog.js';
import { ziweiLimits, fortuneOfYear, baziLuck, shiShen } from '../engines/fortune.js';
import { dayInfo, rateDay, purposeName } from '../engines/daily.js';
import { DISCLAIMER, sectionHead, pad } from './_shared.js';

const TILES = [
  { p: '/astro',   t: '星盤',   icon: 'astro',   d: '太陽 · 月亮 · 上升 · 中天' },
  { p: '/ziwei',   t: '紫微',   icon: 'ziwei',   d: '十二宮 · 十四主星 · 四化' },
  { p: '/fortune', t: '運勢',   icon: 'clock',   d: '大限 · 流年 · 大運 · 流月' },
  { p: '/daily',   t: '擇日',   icon: 'calendar',d: '建除 · 宜忌 · 找好日子' },
  { p: '/direction',t:'方位',  icon: 'compass', d: '本命卦 · 四吉方 · 四凶方' },
  { p: '/iching',  t: '卜卦',   icon: 'dice',    d: '銅錢 · 時間 · 數字起卦' },
  { p: '/tarot',   t: '塔羅',   icon: 'star',    d: '五種牌陣 · 正逆位' },
  { p: '/qian',    t: '求籤',   icon: 'folder',  d: '搖籤筒 · 擲筊 · 六十籤' },
  { p: '/synastry',t: '合盤',   icon: 'link',    d: '相位 · 刑沖合害 · 宮位對照' },
  { p: '/naming',  t: '姓名',   icon: 'naming',  d: '五格三才 · 81 靈動 · 取名' },
  { p: '/numbers', t: '數字',   icon: 'numbers', d: '磁場 · 車牌 · 幸運數' },
  { p: '/prompt',  t: '提示詞', icon: 'prompt',  d: '產生 → 貼到 LLM → 貼回' },
  { p: '/records', t: '紀錄',   icon: 'records', d: '收藏所有解讀結果' },
];

function todayCard(all, settings, t) {
  let info, r;
  try {
    info = dayInfo(t.y, t.m, t.d, { tz: settings.tzOffset });
    r = rateDay(info, { purpose: settings.dayPurpose || 'open', bazi: all?.bazi || null });
  } catch { return ''; }
  const j = info.jianchu;
  return html`
    <section class="section">
      ${raw(sectionHead('今日宜忌', `<a class="chip" href="#/daily">擇日</a>`))}
      <a class="card press track reveal" href="#/daily" style="display:block">
        <div class="row row--between" style="align-items:flex-start;gap:var(--sp-4)">
          <div style="min-width:0">
            <p class="card__label">${info.date}　${info.gz.day.name}日</p>
            <p style="font-family:var(--font-display);font-size:var(--step-2);margin-top:4px;letter-spacing:.08em">
              ${j.name}日　${j.toneText}
            </p>
            <p class="hint" style="margin-top:4px">${info.chong.text}　煞${info.sha}${info.lunar ? `　農曆 ${info.lunar.monthName}${info.lunar.dayName}` : ''}</p>
          </div>
          <span class="luck ${r.cls}" style="flex:none">${purposeName(settings.dayPurpose || 'open')} ${r.score}</span>
        </div>
        <div class="tags" style="margin-top:var(--sp-3)">
          <span class="tags__k">宜</span>${j.good.length ? j.good.slice(0, 5).map(k => html`<span class="tag tag--on">${purposeName(k)}</span>`) : html`<span class="tag">—</span>`}
        </div>
        <div class="tags" style="margin-top:6px">
          <span class="tags__k">忌</span>${j.bad.length ? j.bad.slice(0, 5).map(k => html`<span class="tag">${purposeName(k)}</span>`) : html`<span class="tag">—</span>`}
        </div>
      </a>
    </section>`;
}

function luckCard(all, settings, t) {
  if (!all?.ziwei || !all?.bazi) return '';
  let f, bStep;
  try {
    const limits = ziweiLimits(all.ziwei);
    f = fortuneOfYear({ chart: all.ziwei, limits, year: t.y, birthYear: all.base.y });
    const luck = baziLuck({ ...all.base, gender: all.profile.gender, lateZiRule: settings.lateZiRule });
    bStep = luck.list.find(x => t.y >= x.fromYear && t.y <= x.toYear);
  } catch { return ''; }
  const dm = all.bazi.day.index % 10;
  return html`
    <section class="section">
      ${raw(sectionHead('今年運限', `<a class="chip" href="#/fortune">完整運勢</a>`))}
      <a class="card press track reveal" href="#/fortune" style="display:block">
        <div class="row row--between" style="align-items:flex-start;gap:var(--sp-4)">
          <div style="min-width:0">
            <p class="card__label">${t.y} · 虛歲 ${f.age}</p>
            <p style="font-family:var(--font-display);font-size:var(--step-2);margin-top:4px;letter-spacing:.08em">
              ${f.yearGZName}　流年命宮在${f.yearPalace.name}
            </p>
            <p class="hint" style="margin-top:4px">
              ${f.major ? `大限 ${f.major.fromAge}–${f.major.toAge} 歲 · ${f.major.palace.name}　` : ''}${bStep ? `大運 ${bStep.name}（${bStep.shiShen}）` : ''}
            </p>
          </div>
          <span class="badge badge--dash" style="flex:none">今日 ${t.gz ? shiShen(dm, t.gz.day.index % 10) : ''}</span>
        </div>
        <div class="row" style="gap:5px;margin-top:var(--sp-3)">
          ${f.yearSihua.map(s => html`<span class="badge badge--dash">${s.text}</span>`)}
        </div>
      </a>
    </section>`;
}

export default {
  title: '首頁', eyebrow: 'XUAN JIAN',
  render({ settings, profile, all }) {
    const t = todayInfo(settings);
    const gz = t.gz ? `${t.gz.day.name}` : '——';
    const chars = [...gz].map((c, i) => html`<span style="--i:${i}">${c}</span>`).join('');
    const recs = store.records.slice(0, 3);

    return html`
      <section class="hero reveal track">
        <p class="hero__date">${t.date} · ${t.lunar ? t.lunar.monthName + t.lunar.dayName : ''}</p>
        <h2 class="hero__gz">${raw(chars)}<span style="--i:2;font-size:.45em;letter-spacing:.2em;padding-left:.3em">日</span></h2>
        <p class="hero__sub">
          ${t.gz ? `${t.gz.year.name}年 ${t.gz.month.name}月 · 節氣 ${t.gz.jieqi} · ${t.gz.zodiac}年` : ''}
        </p>
        <div class="hero__who">
          <span class="badge badge--dash">目前對象</span>
          <a class="chip is-on" href="#/profile">
            ${raw(icon('profile'))} ${profile ? (profile.surname || '') + (profile.givenName || '') || profile.label || '未命名' : '尚未建立'}
          </a>
          ${all?.bazi ? html`<span class="chip">${all.bazi.zodiac}年 · ${all.bazi.dayMaster}日主</span>` : ''}
          ${all?.astro ? html`<span class="chip">${all.astro.sun.signName}</span>` : ''}
          ${all?.astro ? html`<span class="chip">上升 ${all.astro.ascendant.signName}</span>` : ''}
        </div>
      </section>

      ${raw(todayCard(all, settings, t))}
      ${raw(luckCard(all, settings, t))}

      <section class="section">
        ${raw(sectionHead('工具'))}
        <div class="grid grid--3">
          ${raw(TILES.map((x, i) => html`
            <a class="tile press track reveal" href="#${x.p}">
              <span class="tile__idx num">${pad(i + 1)}</span>
              ${raw(icon(x.icon))}
              <h3>${x.t}</h3>
              <p>${x.d}</p>
            </a>`).join(''))}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('最近解讀', `<a class="chip" href="#/records">全部 ${store.records.length}</a>`))}
        ${recs.length ? raw(`<div class="stack">${recs.map(r => html`
          <a class="rec press reveal" href="#/records?id=${r.id}">
            <div class="rec__meta"><span>${r.templateName}</span><span>·</span><span>${r.who || ''}</span><span>·</span><span>${r.createdAt.slice(0, 10)}</span></div>
            <div class="rec__body">${r.content.slice(0, 120)}</div>
          </a>`).join('')}</div>`) : html`
          <div class="empty reveal">${raw(icon('records'))}
            <p>還沒有任何解讀紀錄。<br>到「提示詞」產生問句，貼給你慣用的 LLM，再把回覆貼回來。</p>
            <a class="btn btn--ghost press" href="#/prompt">${raw(icon('prompt'))} 開始</a>
          </div>`}
      </section>

      <section class="section">
        ${raw(sectionHead('這個 App 怎麼運作'))}
        <div class="card reveal track">
          <p class="card__label">Local first</p>
          <p style="margin-top:var(--sp-3);color:var(--ink-2);font-size:var(--step--1);line-height:1.9">
            曆法、節氣、農曆、四柱、星盤、紫微、姓名五格、數字磁場 —— 全部在你的裝置上算，不連網、不上傳。<br>
            需要「解讀」時，App 幫你把資料組成一段提示詞，你複製到任何 LLM，再把回覆貼回來存檔。<br>
            所有資料都留在這台裝置，可在設定頁匯出備份。
          </p>
        </div>
      </section>

      <p style="margin-top:var(--sp-5);text-align:center">
        <a class="chip press" href="#/about">玄鑑 v${APP_VERSION}　更新紀錄</a>
      </p>
      ${DISCLAIMER}`;
  },
};
