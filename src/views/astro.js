import { html, raw, $, $$, sheet } from '../ui.js';
import { icon } from '../icons.js';
import { wheelSVG, SIGNS, HOUSE_MEANING } from '../engines/astro.js';
import { DISCLAIMER, needProfile, sectionHead, kv, promptLink, pad } from './_shared.js';

const ELEMENT_TEXT = { 火: '行動、直覺、熱度', 土: '務實、穩定、累積', 風: '思考、交流、彈性', 水: '情感、直覺、連結' };

export default {
  title: '星盤', eyebrow: 'NATAL CHART',
  render({ all, settings, profile }) {
    if (!all?.astro) return needProfile();
    const c = all.astro, b = all.bazi;
    const big3 = c.bodies.slice(0, 4);

    return html`
      <section class="card reveal track" style="padding:var(--sp-4)">
        ${raw(wheelSVG(c))}
        <p class="hint" style="text-align:center;margin-top:var(--sp-3)">
          等宮制 · 上升置於左側 · ${profile.city || settings.city}
          ${settings.trueSolarTime ? html` · 真太陽時校正 ${c.solarCorrection.toFixed(1)} 分` : ''}
        </p>
      </section>

      <section class="section">
        ${raw(sectionHead('核心配置'))}
        <div class="grid grid--auto">
          ${raw(big3.map(x => html`
            <div class="signcard press track reveal" data-body="${x.key}">
              <small>${x.zh}　${SIGNS[x.sign].en}</small>
              <b>${x.signName}</b>
              <span class="deg">${x.text.split(' ')[1]} · 第 ${x.house} 宮 · ${SIGNS[x.sign].el}象${SIGNS[x.sign].mode}</span>
            </div>`).join(''))}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('概況'))}
        <div class="card reveal track">
          ${raw(kv('月相', `${c.moonPhase.name}（照亮 ${(c.moonPhase.illum * 100).toFixed(0)}%）`))}
          ${raw(kv('日月角距', `<span class="num">${c.moonPhase.angle.toFixed(1)}°</span>`))}
          ${raw(kv('元素分布（日月升）', Object.entries(c.elements).filter(([, v]) => v).map(([k, v]) => `${k}×${v}`).join('　') || '—'))}
          ${b ? raw(kv('生肖 / 日主', `${b.zodiac}　${b.dayMaster}（${b.dayMasterEl}）`)) : ''}
          ${b ? raw(kv('節氣月令', b.jieqi)) : ''}
          ${raw(kv('本地恆星時', `<span class="num">${(c.lst / 15).toFixed(2)} h</span>`))}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('四柱八字'))}
        ${b ? html`
        <div class="pillars reveal">
          ${raw([['年', b.year], ['月', b.month], ['日', b.day], ['時', b.hour]].map(([k, v]) => html`
            <div class="pillar press track">
              <small>${k}柱</small>
              <b>${v.stem}</b><b>${v.branch}</b>
              <em>${v.stemEl}${v.branchEl}</em>
              <em style="font-size:9px;color:var(--ink-4)">${v.nayin.name}</em>
            </div>`).join(''))}
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">
          年柱以立春為界、月柱以節氣交節為界、時柱採${settings.lateZiRule === 'next' ? '晚子時換日' : '子時不換日'}。可在設定頁調整。
        </p>` : ''}
      </section>

      <section class="section">
        ${raw(sectionHead('十二宮', `<button class="chip press" id="toggle-houses">展開</button>`))}
        <div class="stack" id="houses" hidden>
          ${raw(c.houses.map((h, i) => html`
            <div class="kv"><span class="kv__k">第 ${i + 1} 宮 · ${HOUSE_MEANING[i]}</span>
            <span class="kv__v">${SIGNS[Math.floor(h / 30)].zh} <span class="num" style="color:var(--ink-3)">${(h % 30).toFixed(1)}°</span></span></div>`).join(''))}
        </div>
      </section>

      <section class="section">
        <div class="row" style="gap:var(--sp-2)">
          ${raw(promptLink('astro-big3', '解讀日月升'))}
          <a class="btn btn--ghost press" href="#/prompt?t=bazi-deep">${raw(icon('prompt'))} 八字格局</a>
          <a class="btn btn--ghost press" href="#/prompt?t=overview">${raw(icon('spark'))} 命盤總覽</a>
        </div>
      </section>
      ${DISCLAIMER}`;
  },
  mount(root, { all }) {
    const btn = $('#toggle-houses', root);
    btn?.addEventListener('click', () => {
      const box = $('#houses', root);
      box.hidden = !box.hidden;
      btn.textContent = box.hidden ? '展開' : '收合';
      if (!box.hidden) box.animate?.([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
    $$('.signcard', root).forEach(el => el.addEventListener('click', () => {
      const b = all.astro.bodies.find(x => x.key === el.dataset.body);
      const s = SIGNS[b.sign];
      sheet({
        title: `${b.zh}在${b.signName}`,
        body: html`
          <div class="stack">
            ${raw(kv('精確度數', b.text))}
            ${raw(kv('元素 / 模式', `${s.el}象 · ${s.mode}宮`))}
            ${raw(kv('守護星', s.ruler))}
            ${raw(kv('落入宮位', `第 ${b.house} 宮 — ${HOUSE_MEANING[b.house - 1]}`))}
            ${raw(kv('元素特質', ELEMENT_TEXT[s.el]))}
            <p class="hint">想要完整解讀？到「提示詞」選「星盤日月升」，複製提示詞貼給你慣用的 LLM。</p>
            <a class="btn btn--primary press" href="#/prompt?t=astro-big3">${raw(icon('prompt'))} 產生提示詞</a>
          </div>`,
      });
    }));
  },
};
