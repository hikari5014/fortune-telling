import { html, raw, $, $$, sheet, haptic, toast } from '../ui.js';
import { dateLine } from '../privacy.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { computeAll } from '../prompt/context.js';
import { resolve } from '../router.js';
import { synastry, ASPECTS } from '../engines/synastry.js';
import { matchNumbers } from '../engines/numbers.js';
import { dial, runCountUps } from '../motion.js';
import { DISCLAIMER, sectionHead, kv, pad } from './_shared.js';

const label = (p) => (p.surname || '') + (p.givenName || '') || p.label || '未命名';
const kindCls = (s) => s > 0 ? 'luck--good' : s < 0 ? 'luck--bad' : 'luck--half';

export default {
  title: '合盤', eyebrow: 'SYNASTRY',
  render({ settings, profile, query }) {
    const list = store.profiles;
    if (list.length < 2) return html`
      <div class="empty reveal">${raw(icon('link'))}
        <p>合盤需要兩份檔案。<br>目前只有 ${list.length} 份。</p>
        <div class="row" style="gap:var(--sp-2);justify-content:center">
          <a class="btn btn--primary press" href="#/profile">${raw(icon('plus'))} 再建一份</a>
          <button class="btn btn--ghost press" id="paste-code">${raw(icon('share'))} 貼上對方的分享碼</button>
        </div>
      </div>${DISCLAIMER}`;

    const aId = query.a || profile?.id || list[0].id;
    const bId = query.b || list.find(p => p.id !== aId)?.id;
    const pa = list.find(p => p.id === aId) || list[0];
    const pb = list.find(p => p.id === bId) || list[1];
    const A = computeAll(pa, settings), B = computeAll(pb, settings);
    const r = synastry(A, B);
    const nums = (pa.phone && pb.phone) ? matchNumbers(pa.phone, pb.phone) : null;

    return html`
      <section class="card reveal track">
        <div class="row" style="gap:var(--sp-2);align-items:flex-end">
          ${raw(who('a', pa, list, 'A'))}
          <button class="iconbtn press" id="swap" aria-label="對調">${raw(icon('swap'))}</button>
          ${raw(who('b', pb, list, 'B'))}
        </div>
        <div class="row" style="margin-top:var(--sp-3)">
          <button class="chip press" id="paste-code">${raw(icon('share'))} 貼上對方的分享碼</button>
        </div>
      </section>

      <section class="card card--invert reveal track" style="margin-top:var(--sp-4)">
        <div class="row row--between row--nowrap" style="align-items:flex-start;gap:var(--sp-4)">
          <div style="min-width:0">
            <p class="card__label">綜合契合度</p>
            <h2 style="font-size:var(--step-3);margin-top:6px">${r.level}</h2>
            <p style="font-size:var(--step--1);opacity:.75;margin-top:4px">
              ${label(pa)} × ${label(pb)}　${r.bazi ? r.bazi.dayMasters : ''}
            </p>
          </div>
          ${raw(dial(r.score, '契合度', { scale: true }))}
        </div>
      </section>

      ${r.tips.length ? html`
      <section class="section">
        ${raw(sectionHead('關鍵提醒'))}
        <div class="stack">
          ${r.tips.map(t => html`<div class="card reveal" style="padding:var(--sp-3) var(--sp-4);font-size:var(--step--1);color:var(--ink-2)">${t}</div>`)}
        </div>
      </section>` : ''}

      ${r.astro ? html`
      <section class="section">
        ${raw(sectionHead('星盤相位', `<span class="hint">和諧 ${r.astro.harmonious} · 緊張 ${r.astro.tense}</span>`))}
        <p class="hint" style="margin-bottom:var(--sp-3)">太陽 × 太陽為元素組合 ${r.astro.elementPair}。相位按影響力排序。</p>
        <div class="pairs">
          ${r.astro.items.length ? r.astro.items.map(i => html`
            <div class="pair press track" data-asp="${i.key}">
              <span class="pair__n" style="font-size:var(--step--1);font-family:var(--font-display)">${i.zh}</span>
              <span>
                <span class="hint">${i.label}</span>
                <span class="pair__bar" style="margin-top:6px"><i style="width:${Math.round(i.strength * 100)}%"></i></span>
              </span>
              <span class="luck ${kindCls(i.score)}"><span class="num">${i.orb.toFixed(1)}°</span></span>
            </div>`) : html`<p class="hint">兩張盤的日月升中天之間沒有形成主要相位。</p>`}
        </div>
      </section>` : ''}

      ${r.bazi ? html`
      <section class="section">
        ${raw(sectionHead('八字互動', `<span class="hint">合 ${r.bazi.good} · 沖刑害 ${r.bazi.bad}</span>`))}
        ${r.bazi.items.length ? html`<div class="pairs">
          ${r.bazi.items.map(i => html`
            <div class="pair track" style="grid-template-columns:70px 1fr auto">
              <span class="hint" style="font-family:var(--font-display);font-size:var(--step--1)">${i.kind}</span>
              <span><span class="hint">${i.pair}</span><br><span class="hint" style="color:var(--ink-4)">${i.text}</span></span>
              <span class="luck ${kindCls(i.score)}">${i.score > 0 ? '合' : '剋'}</span>
            </div>`)}
        </div>` : html`<p class="hint">四柱之間沒有明顯的刑沖合害。</p>`}
      </section>` : ''}

      ${r.ziwei ? html`
      <section class="section">
        ${raw(sectionHead('紫微對照'))}
        <div class="card reveal track">
          ${raw(kv('命宮關係', `${r.ziwei.lifeRel.kind}　<span class="luck ${kindCls(r.ziwei.lifeRel.score)}">${r.ziwei.lifeRel.score > 0 ? '吉' : r.ziwei.lifeRel.score < 0 ? '有摩擦' : '中性'}</span>`))}
          ${raw(kv('B 落在 A 的', `${r.ziwei.bInA.name}宮　${r.ziwei.bInA.main.join('、') || '空宮'}`))}
          ${raw(kv('A 落在 B 的', `${r.ziwei.aInB.name}宮　${r.ziwei.aInB.main.join('、') || '空宮'}`))}
          ${raw(kv('五行局', r.ziwei.juPair))}
          ${r.ziwei.sharedStars.length ? raw(kv('命宮共同主星', r.ziwei.sharedStars.join('、'))) : ''}
          <p style="margin-top:var(--sp-3);font-size:var(--step--1);color:var(--ink-2);line-height:1.8">${r.ziwei.lifeRel.text}</p>
        </div>
      </section>` : ''}

      ${nums ? html`
      <section class="section">
        ${raw(sectionHead('號碼磁場'))}
        <div class="card reveal track">
          ${raw(kv('雙方手機匹配', `<span class="num">${nums.score}</span> 分${nums.bridge ? `　銜接 ${nums.bridge.pair}「${nums.bridge.name}」` : ''}`))}
          <p style="margin-top:var(--sp-2);font-size:var(--step--1);color:var(--ink-2)">${nums.text}</p>
        </div>
      </section>` : ''}

      <section class="section">
        <a class="btn btn--primary btn--block press" href="#/prompt?t=compat&other=${pb.id}">
          ${raw(icon('prompt'))} 產生合盤提示詞
        </a>
      </section>
      ${DISCLAIMER}`;
  },

  mount(root, { settings }) {
    const q = () => new URLSearchParams(location.hash.split('?')[1] || '');
    const go = (a, b) => { haptic(6); location.hash = `/synastry?a=${a}&b=${b}`; };
    const cur = () => {
      const s = q();
      return [s.get('a') || $('#sel-a', root).value, s.get('b') || $('#sel-b', root).value];
    };
    $('#sel-a', root)?.addEventListener('change', () => go($('#sel-a', root).value, $('#sel-b', root).value));
    $('#sel-b', root)?.addEventListener('change', () => go($('#sel-a', root).value, $('#sel-b', root).value));
    $('#swap', root)?.addEventListener('click', () => {
      const [a, b] = [$('#sel-a', root).value, $('#sel-b', root).value];
      go(b, a);
    });
    runCountUps(root);
    requestAnimationFrame(() => $$('.pair__bar i', root).forEach(el => {
      const w = el.style.width; el.style.width = '0';
      requestAnimationFrame(() => el.style.width = w);
    }));
    $$('[data-asp]', root).forEach(el => el.addEventListener('click', () => {
      const a = ASPECTS.find(x => x.key === el.dataset.asp);
      sheet({ title: `${a.zh}（${a.deg}°）`, body: html`<div class="stack">
        ${raw(kv('容許度', `±${a.orb}°`))}
        ${raw(kv('性質', a.score > 0 ? '和諧' : '緊張'))}
        <p style="color:var(--ink-2)">${a.text}</p>
      </div>` });
    }));
  },
};

/* 直接貼別人的分享碼當第二人，不必先存成檔案 */
async function pasteCode() {
  const { parseProfileCode, codeError } = await import('./profile.js');
  sheet({
    title: '貼上對方的分享碼',
    body: html`<div class="stack" data-noswipe>
      <p class="hint">對方在「檔案 → 分享碼」複製給你的那一段。連同前後的訊息一起貼也沒關係。<br>
        匯入後會變成一份新檔案，可以隨時刪。</p>
      <div class="field"><label for="sy-code">分享碼</label>
        <textarea class="textarea textarea--code" id="sy-code" style="min-height:100px" placeholder="XJPRO1:..."></textarea></div>
    </div>`,
    actions: html`<button class="btn btn--primary btn--block press" data-ok>${raw(icon('check'))} 匯入並合盤</button>`,
    onMount(sr, close) {
      $('[data-ok]', sr).addEventListener('click', () => {
        const raw = $('#sy-code', sr).value;
        const item = parseProfileCode(raw);
        if (!item) { toast(codeError(raw)); return; }
        const p = store.saveProfile({ ...item, id: uid('pro') });
        close();
        toast(`已匯入：${label(p)}`);
        location.hash = `/synastry?b=${p.id}`;
        resolve();
      });
    },
  });
}

function who(key, p, list, tag) {
  return html`
    <div class="field" style="flex:1;min-width:0">
      <label for="sel-${key}">${tag}　${dateLine(p)}</label>
      <select class="select" id="sel-${key}">
        ${list.map(x => html`<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${label(x)}</option>`)}
      </select>
    </div>`;
}
