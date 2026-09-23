import { html, raw, $, $$, sheet } from '../ui.js';
import { icon } from '../icons.js';
import { wheelSVG, SIGNS, houseMeaning } from '../engines/astro.js';
import { focusBtn, goFocus, hourWarning, DISCLAIMER, needProfile, sectionHead, kv, promptLink, pad, shareBtn, doShare } from './_shared.js';
import { transits, transitText } from '../engines/transit.js';
import { isHourUnknown } from '../engines/unknown.js';

const ELEMENT_TEXT = { 火: '行動、直覺、熱度', 土: '務實、穩定、累積', 風: '思考、交流、彈性', 水: '情感、直覺、連結' };

/* ── 行運 ─────────────────────────────────────────
   今天的天空疊到本命盤上。預設看今天，可以換日期看其他天。 */
const today = () => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; };
const ymd = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;

function calcTransit(all, settings, profile, day) {
  try {
    return transits(all.astro, { ...day, tz: settings.tzOffset ?? 8,
      hourKnown: !isHourUnknown(profile), reg: settings.register });
  } catch { return null; }
}

function transitBody(t) {
  if (!t) return html`<p class="hint">這一天算不出來。</p>`;
  const top = t.list.slice(0, 8);
  return html`
    <div class="card reveal" style="margin-bottom:var(--sp-3)">
      <div class="row row--between" style="align-items:flex-start;gap:var(--sp-3)">
        <div style="min-width:0">
          <p class="card__label">月亮在${t.moon.signName}${t.moon.house ? `　走到你的第 ${t.moon.house} 宮` : ''}</p>
          <p style="font-family:var(--font-display);font-size:var(--step-1);margin-top:4px;letter-spacing:.06em">
            ${t.moon.house ? `今天心思容易放在「${t.moon.houseText}」` : '今天的天空'}
          </p>
          <p class="hint" style="margin-top:4px">${t.retro.length ? `逆行中：${t.retro.join('、')}` : '今天沒有行星逆行'}</p>
        </div>
        <span class="luck luck--${t.tone.key === 'good' ? 'good' : t.tone.key === 'bad' ? 'bad' : 'half'}" style="flex:none">整體 ${t.tone.text}</span>
      </div>
    </div>
    ${top.length ? html`<div class="daylist">
      ${raw(top.map(x => html`
        <div class="dayrow" style="cursor:default">
          <span class="dayrow__d">
            <b>${x.moverSym} ${x.sym} ${x.targetSym}</b>
            <small>${x.slow ? '這陣子' : '這兩天'}</small>
          </span>
          <span class="dayrow__m">
            <b>${x.label}</b>
            <small>${x.say}　·　${x.applying ? '還在變強' : '高峰已過'}</small>
          </span>
          <span class="luck ${x.score > 0 ? 'luck--good' : 'luck--bad'}"><span class="num">${x.orb.toFixed(1)}°</span></span>
        </div>`).join(''))}
    </div>` : html`<p class="hint">今天沒有碰到本命盤的緊密相位 —— 算是平靜的一天。</p>`}
    <p class="hint" style="margin-top:var(--sp-2)">
      「這陣子」是木星以外的慢星，相位會維持幾週到幾個月；「這兩天」是快星，過幾天就換了。
      ${t.hourKnown ? '' : '出生時辰不詳，所以沒列上升、中天與宮位。'}
    </p>`;
}

export default {
  title: '星盤', eyebrow: 'NATAL CHART',
  render({ all, settings, profile }) {
    if (!all?.astro) return needProfile();
    const c = all.astro, b = all.bazi;
    const big3 = c.bodies.slice(0, 4);

    return html`
      ${raw(hourWarning(profile, ['星盤']))}
      <section class="card reveal track" style="padding:var(--sp-4)">
        ${raw(wheelSVG(c, { fx: settings.chartEffects ?? 'full' }))}
        <p class="hint" style="text-align:center;margin-top:var(--sp-3)">
          等宮制 · 上升置於左側 · ${profile.city || settings.city}
          ${(settings.chartEffects ?? 'full') === 'full' ? html` · 內圈細線為相位（實線和諧、虛線緊張）` : ''}
          ${settings.trueSolarTime ? html` · 真太陽時校正 ${c.solarCorrection.toFixed(1)} 分` : ''}
        </p>
      </section>

      <section class="section" id="transit">
        ${raw(sectionHead('行運', `<input class="input num" type="date" id="tr-date" value="${ymd(today())}" style="height:36px;width:auto;padding:0 10px" aria-label="看哪一天">`))}
        <p class="hint" style="margin-bottom:var(--sp-3)">把那一天的天空疊到你的本命盤上，看碰到了哪幾顆星。</p>
        <div id="tr-body">${raw(transitBody(calcTransit(all, settings, profile, today())))}</div>
        <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-3)">
          <button class="btn btn--ghost press" id="tr-ask">${raw(icon('prompt'))} 請 LLM 解讀行運</button>
        </div>
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
        ${raw(sectionHead('七政與外行星', `<span class="hint">R＝逆行</span>`))}
        <div class="planets">
          ${raw(c.planets.map(x => html`
            <button class="planet press track reveal" data-body="${x.key}">
              <span class="planet__sym">${x.sym}</span>
              <span class="planet__n">
                <b>${x.zh}${x.retro ? html`<i>R</i>` : ''}</b>
                <small>${x.outer ? '世代星' : SIGNS[x.sign].el + '象' + SIGNS[x.sign].mode}</small>
              </span>
              <span class="planet__s">
                <b>${x.signName}</b>
                <small class="num">${x.deg.toFixed(1)}° · 第 ${x.house} 宮</small>
              </span>
            </button>`).join(''))}
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">
          天王星、海王星、冥王星走得慢，同世代的人星座幾乎一樣，要看的是落在第幾宮。
        </p>
      </section>

      <section class="section">
        ${raw(sectionHead('相位', `<span class="hint">共 ${c.aspects.length} 個</span>`))}
        <div class="daylist">
          ${raw(c.aspects.slice(0, 12).map(x => html`
            <div class="dayrow" style="cursor:default">
              <span class="dayrow__d">
                <b>${x.aSym} ${x.sym} ${x.bSym}</b>
                <small>${x.tight ? '緊密' : ''}</small>
              </span>
              <span class="dayrow__m">
                <b>${x.label}</b>
                <small>${x.text}</small>
              </span>
              <span class="luck ${x.score > 0 ? 'luck--good' : 'luck--bad'}"><span class="num">${x.orb.toFixed(1)}°</span></span>
            </div>`).join(''))}
        </div>
        ${c.aspects.length > 12 ? html`<p class="hint" style="margin-top:var(--sp-2)">只列出容許度最小的 12 個。</p>` : ''}
        <p class="hint" style="margin-top:var(--sp-2)">
          右邊是容許度（差幾度才精準），越小影響越明顯。日月放寬、外行星收緊。
        </p>
      </section>

      <section class="section">
        ${raw(sectionHead('概況'))}
        <div class="card reveal track">
          ${raw(kv('月相', `${c.moonPhase.name}（照亮 ${(c.moonPhase.illum * 100).toFixed(0)}%）`))}
          ${raw(kv('日月角距', `<span class="num">${c.moonPhase.angle.toFixed(1)}°</span>`))}
          ${raw(kv('元素分布（日月與七政）', Object.entries(c.elements).filter(([, v]) => v).map(([k, v]) => `${k}×${v}`).join('　') || '—'))}
          ${b ? raw(kv('生肖 / 日主', `${b.zodiac}　${b.dayMaster}（${b.dayMasterEl}）`)) : ''}
          ${b ? raw(kv('節氣月令', b.jieqi)) : ''}
          ${raw(kv('元素分布（日月升）', Object.entries(c.elementsBig3).filter(([, v]) => v).map(([k, v]) => `${k}×${v}`).join('　') || '—'))}
          ${raw(kv('本地恆星時', `<span class="num">${(c.lst / 15).toFixed(2)} h</span>`))}
        </div>
      </section>

      <section class="section">
        ${raw(sectionHead('四柱八字', `<a class="chip press" href="#/bazi">${icon('pillars')} 旺衰喜用</a>`))}
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
            <div class="kv"><span class="kv__k">第 ${i + 1} 宮 · ${houseMeaning(i + 1, settings.register)}</span>
            <span class="kv__v">${SIGNS[Math.floor(h / 30)].zh} <span class="num" style="color:var(--ink-3)">${(h % 30).toFixed(1)}°</span></span></div>`).join(''))}
        </div>
      </section>

      <section class="section">
        <div class="row" style="gap:var(--sp-2)">
          ${raw(promptLink('astro-big3', '解讀日月升'))}
          <a class="btn btn--ghost press" href="#/prompt?t=bazi-deep">${raw(icon('prompt'))} 八字格局</a>
          <a class="btn btn--ghost press" href="#/prompt?t=overview">${raw(icon('spark'))} 命盤總覽</a>
          ${shareBtn('a-share', '存成長圖')}
        </div>
      </section>
      ${DISCLAIMER}`;
  },
  mount(root, { all, profile, settings }) {
    // 行運：換日期就重算這一塊，不重畫整頁
    let day = today();
    const dateEl = $('#tr-date', root);
    dateEl?.addEventListener('change', () => {
      const [y, m, d] = dateEl.value.split('-').map(Number);
      if (!y || !m || !d) return;
      day = { y, m, d };
      $('#tr-body', root).innerHTML = String(transitBody(calcTransit(all, settings, profile, day)));
    });
    $('#tr-ask', root)?.addEventListener('click', () => {
      const t = calcTransit(all, settings, profile, day);
      if (!t) return;
      goFocus({ all, label: `行運 ${t.date}`, text: transitText(t),
        question: `請解讀 ${t.date} 的行運對我的影響：哪些是這陣子的主題、哪些只是這兩天的起伏，以及可以怎麼應對。` });
    });
    $('#a-share', root)?.addEventListener('click', async () => {
      const { natalCard } = await import('../sharecards.js');
      doShare(() => natalCard(all, profile), '玄鑑-命盤.png');
    });
    const btn = $('#toggle-houses', root);
    btn?.addEventListener('click', () => {
      const box = $('#houses', root);
      box.hidden = !box.hidden;
      btn.textContent = box.hidden ? '展開' : '收合';
      if (!box.hidden) box.animate?.([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
    $$('.signcard, .planet', root).forEach(el => el.addEventListener('click', () => {
      const b = all.astro.bodies.find(x => x.key === el.dataset.body);
      const s = SIGNS[b.sign];
      sheet({
        title: `${b.zh}在${b.signName}`,
        body: html`
          <div class="stack">
            ${raw(kv('精確度數', b.text))}
            ${raw(kv('元素 / 模式', `${s.el}象 · ${s.mode}宮`))}
            ${raw(kv('守護星', s.ruler))}
            ${raw(kv('落入宮位', `第 ${b.house} 宮 — ${houseMeaning(b.house, settings.register)}`))}
            ${raw(kv('元素特質', ELEMENT_TEXT[s.el]))}
            ${b.speed != null ? raw(kv('每日移動', `<span class="num">${b.speed >= 0 ? '+' : ''}${b.speed.toFixed(3)}°</span>${b.retro ? '　逆行中' : ''}`)) : ''}
            ${b.about ? html`<p class="hint">${b.about}</p>` : ''}
            ${b.retro ? html`<p class="hint">逆行不是壞事，通常表示這一塊的能量比較向內、需要繞一圈才用得出來。</p>` : ''}
            <div class="row" style="gap:var(--sp-2)">
              ${raw(focusBtn(`深問${b.zh}`))}
              <a class="btn btn--ghost press" href="#/prompt?t=astro-big3">${raw(icon('prompt'))} 日月升總覽</a>
            </div>
          </div>`,
        onMount(sr) {
          $('[data-focus]', sr).addEventListener('click', () => goFocus({ all,
            template: 'astro-big3',
            label: `星盤 ${b.zh}在${b.signName}`,
            text: [
              `星體：${b.zh}　星座：${b.signName}　精確位置：${b.text}`,
              `元素：${s.el}象　模式：${s.mode}宮　守護星：${s.ruler}`,
              `落入第 ${b.house} 宮 —— ${houseMeaning(b.house, settings.register)}`,
              b.speed != null ? `每日移動 ${b.speed >= 0 ? '+' : ''}${b.speed.toFixed(3)}°${b.retro ? '（逆行）' : ''}` : '',
              `與這顆星有相位的：${all.astro.aspects.filter(x => x.aKey === b.key || x.bKey === b.key).map(x => `${x.label}（差 ${x.orb.toFixed(1)}°）`).join('；') || '無'}`,
            ].filter(Boolean).join('\n'),
          }));
        },
      });
    }));
  },
};
