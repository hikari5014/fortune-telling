import { html, raw, $, $$, sheet, copyText, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { ctx } from '../app.js';
import {
  TRIGRAMS, mingGua, eightDirections, zhaiGua, matchZhai, compassSVG, toText, STAR_ORDER,
} from '../engines/bagua.js';
import { observeReveal, initSeg } from '../motion.js';
import { focusBtn, goFocus, DISCLAIMER, needProfile, sectionHead, kv, shareBtn, doShare } from './_shared.js';

const SITS = TRIGRAMS.map(t => t.dir);

export default {
  title: '方位', eyebrow: 'EIGHT MANSIONS',
  render() {
    const { profile, all, settings } = ctx();
    if (!profile || !all?.bazi) return html`${needProfile('八宅要用出生年與性別推本命卦，先建立一份出生資料。')}${DISCLAIMER}`;

    const ming = mingGua(all.bazi.yearForGZ, profile.gender || '女');
    const dirs = eightDirections(ming.name, settings.register);
    const northUp = store.settings.compassNorthUp !== false;
    const sit = store.settings.zhaiSit || '';
    const zhai = sit ? zhaiGua(sit) : null;
    const match = zhai ? matchZhai(ming, zhai) : null;

    return html`
      <section class="card reveal">
        <div class="row row--between" style="align-items:flex-start;gap:var(--sp-4)">
          <div style="min-width:0">
            <p class="card__label">本命卦</p>
            <p class="guahead">${ming.gua.sym}<b>${ming.name}</b></p>
            <p class="hint">洛書 ${ming.luoshu}　${ming.gua.el}　坐${ming.gua.dir}</p>
          </div>
          <span class="badge badge--solid" style="flex:none">${ming.group}命</span>
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">
          命理年 ${ming.year}（以立春分年）→ 各位數相加得 ${ming.yearDigit} →
          ${profile.gender === '男' ? `男命 11 − ${ming.yearDigit}` : `女命 4 + ${ming.yearDigit}`} → 洛書 ${ming.luoshu}
        </p>
        ${ming.note ? html`<p class="hint">${ming.note}</p>` : ''}
        <p class="hint" style="margin-top:var(--sp-2)">
          ${ming.group}命的四個好方位是${dirs.filter(d => d.kind === '吉').map(d => d.dir).join('、')}，
          剛好就是${ming.group}的四個卦。這不是背出來的，是八個方位一爻一爻變出來的結果。
        </p>
      </section>

      <section class="section reveal" data-noswipe>
        <div class="row row--between">
          ${raw(sectionHead('方位盤'))}
          <div class="seg" id="cp-up">
            <button class="press" data-up="1" aria-pressed="${northUp}">上北</button>
            <button class="press" data-up="0" aria-pressed="${!northUp}">上南</button>
          </div>
        </div>
        <div class="card card--flat" id="cp-wrap" style="padding-top:var(--sp-4)">
          ${raw(compassSVG(dirs, { northUp }))}
          <p class="hint" style="text-align:center;margin-top:var(--sp-3)">
            實心是吉方、虛線是凶方。點任一格看細節。<br>
            上北是手機指南針的畫法；傳統風水圖是上南，可自行切換。
          </p>
        </div>
      </section>

      <section class="section reveal">
        ${raw(sectionHead('八方位', `<span class="hint">由好到壞</span>`))}
        <div class="daylist" id="dirlist">
          ${dirs.map(d => html`
            <button class="dayrow press" data-dir="${d.dir}">
              <span class="dayrow__d">
                <b>${d.dir}</b>
                <small>${d.sym} ${d.gua}卦</small>
              </span>
              <span class="dayrow__m">
                <b>${d.star}</b>
                <small>${d.use}</small>
              </span>
              <span class="luck ${d.kind === '吉' ? 'luck--good' : 'luck--bad'}">${d.kind}</span>
            </button>`)}
        </div>
      </section>

      <section class="section reveal" data-noswipe>
        ${raw(sectionHead('住宅', `<span class="hint">選填</span>`))}
        <div class="card">
          <div class="field"><label for="sit">房子坐哪一邊（背對的方向）</label>
            <select class="select" id="sit">
              <option value="">未設定</option>
              ${SITS.map(s => {
                const z = zhaiGua(s);
                return html`<option value="${s}" ${s === sit ? 'selected' : ''}>${z.label}　${z.gua}宅</option>`;
              })}
            </select></div>
          <p class="hint" style="margin-top:var(--sp-2)">站在屋內看向大門，背後那一面就是「坐」。</p>
          ${zhai ? html`
            <div style="margin-top:var(--sp-4)">
              ${raw(kv('宅卦', `${zhai.sym} ${zhai.gua}宅（${zhai.group}宅）`))}
              ${raw(kv('坐向', zhai.label))}
              <p class="hint" style="margin-top:var(--sp-3)">${match.text}</p>
            </div>` : ''}
        </div>
      </section>

      <div class="row" style="margin-top:var(--sp-5)">
        <button class="btn btn--primary press" id="g-prompt">${raw(icon('prompt'))} 產生方位提示詞</button>
        <button class="btn btn--ghost press" id="g-copy">${raw(icon('copy'))} 複製方位資料</button>
        ${shareBtn('g-share')}
      </div>
      ${DISCLAIMER}`;
  },

  mount(root) {
    const { profile, all, settings } = ctx();
    if (!profile || !all?.bazi) return;
    const ming = mingGua(all.bazi.yearForGZ, profile.gender || '女');
    const dirs = eightDirections(ming.name, settings.register);
    const sitOf = () => store.settings.zhaiSit || '';
    const zhai = () => (sitOf() ? zhaiGua(sitOf()) : null);

    const openDir = (dirName) => {
      const d = dirs.find(x => x.dir === dirName);
      if (!d) return;
      haptic(6);
      sheet({
        title: `${d.dir}　${d.star}`,
        body: `
          <div class="row row--between" style="margin-bottom:var(--sp-4)">
            <div><p class="guahead" style="font-size:var(--step-3)">${d.sym}<b>${d.gua}</b></p>
            <p class="hint">${d.el}　洛書 ${d.luoshu}　方位角 ${d.deg}°</p></div>
            <span class="luck ${d.kind === '吉' ? 'luck--good' : 'luck--bad'}">${d.kind}</span>
          </div>
          <p class="hint" style="font-size:var(--step-0);color:var(--ink-2);line-height:1.8">${d.placeText}</p>
          <p class="hint" style="margin-top:var(--sp-3)">這顆星本身：${d.text}</p>
          <div style="margin-top:var(--sp-4)">
            <p class="card__label">適合擺什麼</p>
            <p class="hint" style="font-size:var(--step-0);color:var(--ink-2)">${d.use}</p>
          </div>
          <div style="margin-top:var(--sp-4)">
            <p class="card__label">同一顆星的數字組合</p>
            <div class="tags" style="margin-top:6px">
              ${d.numbers.map(n => `<span class="tag ${d.kind === '吉' ? 'tag--on' : ''}">${n}</span>`).join('')}
            </div>
            <p class="hint" style="margin-top:6px">${d.star}在數字上是同一顆星，手機、車牌帶到這些組合，效果與這個方位同一個方向。</p>
          </div>
          <div class="row" style="margin-top:var(--sp-5)">
            ${focusBtn(`深問${d.dir}方`)}
            <a class="btn btn--ghost press" href="#/numbers" data-close>${icon('numbers')} 去數字頁</a>
          </div>`,
        onMount(sr) {
          $('[data-focus]', sr).addEventListener('click', () => goFocus({
            template: 'direction',
            label: `方位 ${d.dir}（${d.gua}卦・${d.star}）`,
            text: [
              `本命卦：${ming.name}（${ming.group}命）`,
              `方位：${d.dir}　卦：${d.gua}（${d.sym}，${d.el}，洛書 ${d.luoshu}，方位角 ${d.deg}°）`,
              `遊年星：${d.star}〔${d.kind}〕`,
              `在方位上的解法：${d.placeText}`,
              `適合擺放：${d.use}`,
              `這顆星本身：${d.text}`,
              `同星的數字組合：${d.numbers.join('、')}`,
            ].join('\n'),
          }));
        },
      });
    };

    $$('#dirlist .dayrow', root).forEach(b => b.addEventListener('click', () => openDir(b.dataset.dir)));
    bindCompass();

    function bindCompass() {
      $$('#cp-wrap .cp__sec', root).forEach(g => {
        g.addEventListener('click', () => openDir(g.dataset.dir));
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDir(g.dataset.dir); }
        });
      });
    }

    $$('#cp-up button', root).forEach(b => b.addEventListener('click', () => {
      $$('#cp-up button', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      const up = b.dataset.up === '1';
      store.setSettings({ compassNorthUp: up });
      const wrap = $('#cp-wrap', root);
      $('.compass', wrap).outerHTML = compassSVG(dirs, { northUp: up });
      bindCompass();
    }));

    $('#sit', root).addEventListener('change', (e) => {
      store.setSettings({ zhaiSit: e.target.value });
      import('../router.js').then(({ resolve }) => resolve());
    });

    const text = () => toText(ming, dirs, zhai(), zhai() ? matchZhai(ming, zhai()) : null);
    $('#g-copy', root).addEventListener('click', () => copyText(text()));
    $('#g-share', root).addEventListener('click', async () => {
      const { guaCard } = await import('../sharecards.js');
      const z = zhai();
      doShare(() => guaCard(ming, dirs, z, z ? matchZhai(ming, z) : null), '玄鑑-方位.png');
    });
    $('#g-prompt', root).addEventListener('click', () => {
      store.setDraft('guaInfo', text());
      location.hash = '#/prompt?t=direction';
    });

    observeReveal(root);
    initSeg(root);
  },
};
