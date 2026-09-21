import { html, raw, $, $$ } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { todayInfo } from '../prompt/context.js';
import { DISCLAIMER, sectionHead, pad } from './_shared.js';

const TILES = [
  { p: '/astro',   t: '星盤',   icon: 'astro',   d: '太陽 · 月亮 · 上升 · 中天' },
  { p: '/ziwei',   t: '紫微',   icon: 'ziwei',   d: '十二宮 · 十四主星 · 四化' },
  { p: '/naming',  t: '姓名',   icon: 'naming',  d: '五格三才 · 81 靈動 · 取名' },
  { p: '/numbers', t: '數字',   icon: 'numbers', d: '磁場 · 車牌 · 幸運數' },
  { p: '/prompt',  t: '提示詞', icon: 'prompt',  d: '產生 → 貼到 LLM → 貼回' },
  { p: '/records', t: '紀錄',   icon: 'records', d: '收藏所有解讀結果' },
];

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

      ${DISCLAIMER}`;
  },
};
