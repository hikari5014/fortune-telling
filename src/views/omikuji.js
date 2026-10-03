import { html, raw, $, $$ } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { navigate } from '../router.js';
import { DISCLAIMER } from './_shared.js';
import { torii } from '../shrine.js';
import { grounds, lantern, goshuin } from '../rites/art.js';
import { today, mark, hold, sleep, fast, wareki } from '../rites/kit.js';
import * as temizu from '../rites/temizu.js';
import * as haiden from '../rites/haiden.js';
import * as kuji from '../rites/kuji.js';
import { suzu } from '../rites/sound.js';

/* 神社：參拜與求籤分開，跟真的去神社一樣
   ──────────────────────────────────────────────────────────
   入口是鳥居：在鳥居前一禮再走進去（一天一次）。進去之後是境內，
   三個地方自己選順序 ——
     手水舍（淨手）→ 拜殿（參拜）→ 授與所（求籤）
   一般的順序是這樣，但沒有硬性規定；想先抽籤也行，跟真的神社一樣。

   每個地方是同一頁的不同網址（?at=temizu / haiden / kuji / book），
   按返回鍵就回到境內。各處的內容在 src/rites/ 底下。 */

const PLACES = {
  temizu: { t: '手水舍', jp: 'てみずや', d: '參拜前先淨手、漱口，把身心洗乾淨', mod: temizu },
  haiden: { t: '拜殿',   jp: 'はいでん', d: '投香油錢、搖鈴、二拜二拍手一拜，許一個願', mod: haiden },
  kuji:   { t: '授與所', jp: 'じゅよしょ', d: '納初穗料、搖籤箱，從籤棚裡找到你的那一張', mod: kuji },
};

const sky = (n = 16) => `<div class="jinja__sky" aria-hidden="true"><span class="jinja__moon"></span>${
  Array.from({ length: n }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${(i * 23) % 55}%;--d:${(i % 5) * .7}s"></i>`).join('')}</div>`;

/* ── 境內 ───────────────────────────────────────── */
function hub() {
  const t = today();
  const status = {
    temizu: t.temizu ? '今天淨過手了' : '',
    haiden: t.haiden ? '今天參拜過了' : '',
    kuji: t.kuji ? `今天抽到${t.kuji.ban}・${t.kuji.level}` : '',
  };
  const n = store.shrineLog.length;
  return html`
    <section class="jinja jn-hub reveal" data-noswipe>
      ${raw(sky())}
      <div class="jn-map ${t.torii ? 'is-in' : ''}" id="jn-map">
        ${raw(grounds())}
        ${raw([[28, 62, .62], [64, 62, .62], [16, 76, .9], [76, 76, .9]].map(([x, y, s]) =>
          `<span class="jn-map__lantern" style="--x:${x}%;--y:${y}%;--s:${s}">${lantern()}</span>`).join(''))}
        ${raw(Object.entries(PLACES).map(([k, p]) => html`
          <button class="jn-place jn-place--${k} press ${status[k] ? 'is-done' : ''}" data-at="${k}">
            <b>${p.t}</b><small>${p.jp}</small>${status[k] ? raw(`<i>${icon('check')}</i>`) : ''}
          </button>`).join(''))}
      </div>
      ${t.torii ? '' : html`
        <div class="jn-gate" id="jn-gate">
          <div class="jn-gate__torii">${raw(torii())}</div>
          <p class="jn-gate__say">鳥居是神域的入口。<br>站在鳥居前，輕輕一禮再走進去。</p>
          <button class="jn-holdbtn press" id="jn-bow"><span>按住　一禮</span></button>
        </div>`}
    </section>

    <section class="section">
      <div class="stack" style="gap:8px">
        ${Object.entries(PLACES).map(([k, p]) => html`
          <button class="tmpl press jn-placecard" data-at="${k}">
            <b>${p.t}<small style="margin-left:8px;color:var(--ink-3);font-weight:400">${p.jp}</small></b>
            <small>${status[k] || p.d}</small>
          </button>`)}
        <button class="tmpl press jn-placecard" data-at="book">
          <b>御朱印帳</b><small>${n ? `已經參拜 ${n} 次` : '參拜完成後會蓋一個御朱印'}</small>
        </button>
      </div>
      <p class="hint" style="margin-top:var(--sp-3)">
        一般的順序是 手水 → 參拜 → 求籤，但沒有硬性規定 —— 想先抽籤也可以，跟真的神社一樣。
      </p>
    </section>
    ${DISCLAIMER}`;
}

function mountHub(root) {
  $$('[data-at]', root).forEach(b => b.addEventListener('click', () => navigate(`/omikuji?at=${b.dataset.at}`)));
  const btn = $('#jn-bow', root);
  if (!btn) return;
  hold(btn, 900, async () => {
    btn.disabled = true;
    const gate = $('#jn-gate', root);
    gate.classList.add('is-bowed');
    suzu(.35);
    await sleep(700);
    gate.classList.add('is-through');          // 鳥居放大、淡出 —— 等於走過去
    $('#jn-map', root).classList.add('is-in');
    mark({ torii: true });
    await sleep(1000);
    gate.remove();
  }, { onStart: () => $('#jn-gate', root)?.classList.add('is-bowing'), onCancel: () => $('#jn-gate', root)?.classList.remove('is-bowing') });
}

/* ── 御朱印帳 ───────────────────────────────────── */
function book() {
  const log = store.shrineLog;
  if (!log.length) return html`
    <div class="empty reveal">${raw(icon('torii'))}
      <p>御朱印帳還是空的。<br>到拜殿參拜一次，就會蓋上第一個御朱印。</p>
      <button class="btn btn--primary press" data-at="haiden">去拜殿</button>
    </div>${DISCLAIMER}`;
  return html`
    <section class="section" style="margin-top:0">
      <p class="hint">共參拜 ${log.length} 次。點一頁可以放大看。</p>
      <div class="jn-book">
        ${log.map(e => html`<button class="jn-book__page press" data-id="${e.id}">
          ${raw(goshuin(wareki(new Date(e.date + 'T12:00:00'))))}
          <small>${e.date}${e.coin ? `　${e.coin} 圓` : ''}</small>
        </button>`)}
      </div>
    </section>${DISCLAIMER}`;
}

function mountBook(root) {
  $$('[data-at]', root).forEach(b => b.addEventListener('click', () => navigate(`/omikuji?at=${b.dataset.at}`)));
  $$('.jn-book__page', root).forEach(b => b.addEventListener('click', () => {
    const e = store.shrineLog.find(x => x.id === b.dataset.id);
    import('../ui.js').then(({ sheet }) => sheet({
      title: `${e.date} 的參拜`,
      body: html`<div class="jn-scope jn-book__big">${raw(goshuin(wareki(new Date(e.date + 'T12:00:00'))))}</div>
        ${e.coin ? html`<p class="hint" style="margin-top:var(--sp-3)">香油錢 ${e.coin} 圓</p>` : ''}
        ${e.wish ? html`<p style="margin-top:var(--sp-2);line-height:1.8">當時許的願：${e.wish}</p>` : ''}`,
    }));
  }));
}

const at = (query) => (PLACES[query?.at] || query?.at === 'book' ? query.at : null);

export default {
  title: (c) => { const a = at(c?.query); return a === 'book' ? '御朱印帳' : a ? PLACES[a].t : '神社'; },
  eyebrow: 'SHRINE',
  render(ctx) {
    const a = at(ctx.query);
    if (a === 'book') return book();
    if (a) return PLACES[a].mod.render(ctx);
    return hub();
  },
  mount(root, ctx) {
    const a = at(ctx.query);
    if (a === 'book') return mountBook(root);
    if (a) return PLACES[a].mod.mount(root, ctx);
    return mountHub(root);
  },
};

export { fast };
