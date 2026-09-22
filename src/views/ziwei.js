import { html, raw, $, $$, sheet } from '../ui.js';
import { icon } from '../icons.js';
import { starDesc } from '../engines/ziwei.js';
import { focusBtn, goFocus, DISCLAIMER, needProfile, sectionHead, kv, promptLink } from './_shared.js';

export default {
  title: '紫微斗數', eyebrow: 'ZI WEI DOU SHU',
  render({ all }) {
    if (!all?.ziwei) return needProfile();
    const z = all.ziwei;

    const cell = (p) => p === null ? '' : html`
      <div class="zw__cell press ${p.isLife ? 'is-life' : ''}" data-b="${p.branch}" tabindex="0" role="button" aria-label="${p.name}">
        <div class="zw__stars">
          ${raw(p.main.map(s => `<span class="s-main">${s}</span>`).join(''))}
          ${raw(p.lucky.map(s => `<span class="s-sub">${s}</span>`).join(''))}
          ${raw(p.sha.map(s => `<span class="s-sub">${s}</span>`).join(''))}
          ${raw(p.hua.map(s => `<span class="s-sub">${s.slice(-2)}</span>`).join(''))}
        </div>
        <div class="zw__foot">
          <span class="zw__name">${p.name}${p.isBody ? '·身' : ''}</span>
          <span class="zw__gz">${p.gz}</span>
        </div>
      </div>`;

    return html`
      <section class="reveal">
        <div class="zw">
          ${raw(z.grid.slice(0, 4).map(cell).join(''))}
          ${raw(cell(z.grid[4]))}
          <div class="zw__center">
            <small>${z.lunar.year} 年 ${z.lunar.monthName}${z.lunar.dayName} ${z.hourName}</small>
            <b>${z.yearGZName} · ${z.zodiac}</b>
            <small>${z.ju.name}（${z.ju.nayin}）</small>
            <small>命宮 ${z.lifePalace.branchName} · 身宮 ${z.bodyPalace.name}</small>
            <small style="color:var(--ink-4)">${z.gender}命</small>
          </div>
          ${raw(cell(z.grid[7]))}
          ${raw(cell(z.grid[8]))}
          ${raw(cell(z.grid[11]))}
          ${raw(z.grid.slice(12).map(cell).join(''))}
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">點任一宮位看詳細。粗框為命宮，宮名後「·身」為身宮。</p>
      </section>

      <section class="section">
        ${raw(sectionHead('命盤摘要'))}
        <div class="card reveal track">
          ${raw(kv('命宮', `${z.lifePalace.branchName}宮（${z.lifePalace.gz}）　${z.lifePalace.main.join('、') || '空宮借對宮'}`))}
          ${raw(kv('身宮', `${z.bodyPalace.branchName}宮　落於${z.bodyPalace.name}`))}
          ${raw(kv('五行局', `${z.ju.name}　納音${z.ju.nayin}`))}
          ${raw(kv('年干四化', z.sihua.join('、')))}
          ${raw(kv('生年干支', `${z.yearGZName}（${z.zodiac}年）`))}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('十二宮落點'))}
        <div class="grid grid--auto">
          ${raw(z.palaces.map(p => html`
            <button class="card press track reveal" data-b="${p.branch}" style="padding:var(--sp-3);text-align:left">
              <p class="card__label">${p.name}${p.isLife ? ' · 命' : ''}${p.isBody ? ' · 身' : ''}</p>
              <p style="font-family:var(--font-display);font-size:var(--step-0);margin-top:4px">${p.main.join('、') || '空宮'}</p>
              <p class="hint" style="margin-top:2px">${p.branchName}宮 ${p.gz} · ${p.desc}</p>
            </button>`).join(''))}
        </div>
      </section>

      <section class="section">
        <div class="row" style="gap:var(--sp-2)">
          ${raw(promptLink('ziwei-deep', '逐宮解讀'))}
          <a class="btn btn--ghost press" href="#/prompt?t=year">${raw(icon('clock'))} 流年運勢</a>
          <a class="btn btn--ghost press" href="#/prompt?t=career">${raw(icon('records'))} 事業財務</a>
        </div>
      </section>
      ${DISCLAIMER}`;
  },
  mount(root, { all }) {
    const z = all.ziwei;
    const open = (branch) => {
      const p = z.palaces[branch];
      const tri = [branch, (branch + 4) % 12, (branch + 8) % 12, (branch + 6) % 12]
        .map(b => z.palaces[b]);
      sheet({
        title: `${p.name}　${p.branchName}宮（${p.gz}）`,
        body: html`
          <div class="stack">
            <p class="hint">${p.desc}</p>
            ${raw(kv('主星', p.main.length ? p.main.join('、') : '空宮（借對宮 ' + z.palaces[(branch + 6) % 12].main.join('、') + '）'))}
            ${raw(kv('吉星', p.lucky.join('、') || '—'))}
            ${raw(kv('煞星', p.sha.join('、') || '—'))}
            ${raw(kv('四化', p.hua.join('、') || '—'))}
            ${p.main.length ? raw(`<div class="stack" style="margin-top:var(--sp-2)">${p.main.map(s => html`
              <div class="card" style="padding:var(--sp-3)">
                <p class="card__label">${s}</p>
                <p style="margin-top:4px;font-size:var(--step--1);color:var(--ink-2)">${starDesc(s)}</p>
              </div>`).join('')}</div>`) : ''}
            <div class="section__head" style="margin-top:var(--sp-3)"><h2 style="font-size:var(--step-0)">三方四正</h2></div>
            ${raw(tri.map((t, i) => kv(['本宮', '三合', '三合', '對宮'][i] + '　' + t.name, `${t.branchName} ${t.main.join('、') || '空宮'}`)).join(''))}
            <div class="row" style="gap:var(--sp-2)">
              ${raw(focusBtn(`深問${p.name}`))}
              <a class="btn btn--ghost press" href="#/prompt?t=ziwei-deep">${raw(icon('prompt'))} 全盤逐宮</a>
            </div>
          </div>`,
        onMount(sr) {
          $('[data-focus]', sr).addEventListener('click', () => goFocus({
            template: 'ziwei-deep',
            label: `紫微 ${p.name}（${p.branchName}宮・${p.gz}）`,
            text: [
              `宮位：${p.name}　地支：${p.branchName}　宮干支：${p.gz}`,
              `宮職：${p.desc}`,
              `主星：${p.main.length ? p.main.join('、') : `空宮，借對宮 ${z.palaces[(branch + 6) % 12].main.join('、') || '亦空'}`}`,
              `吉星：${p.lucky.join('、') || '無'}　煞星：${p.sha.join('、') || '無'}　四化：${p.hua.join('、') || '無'}`,
              '三方四正：',
              ...tri.map((t, i) => `・${['本宮', '三合', '三合', '對宮'][i]}　${t.name}（${t.branchName}）：${t.main.join('、') || '空宮'}`),
            ].join('\n'),
          }));
        },
      });
    };
    $$('[data-b]', root).forEach(el => {
      el.addEventListener('click', () => open(Number(el.dataset.b)));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(Number(el.dataset.b)); } });
    });
  },
};
