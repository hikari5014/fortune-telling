import { html, raw, $, $$, sheet, toast, copyText, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { store, uid } from '../store.js';
import { tossCoins, reading, timeHexagram, numberHexagram, hexText, yaoName, YAO_POS } from '../engines/iching.js';
import { observeReveal } from '../motion.js';
import { DISCLAIMER, sectionHead, kv, askPrompt } from './_shared.js';
import { coin } from '../relics.js';

const hexSVG = (h, moving = [], title = '') => html`
  <div>
    <div class="hex">
      ${[...h.lines].map((v, i) => i).reverse().map(i => html`
        <div class="hex__yao" data-line="${h.lines[i]}" data-moving="${moving.includes(i) ? 1 : 0}" style="--i:${i}">
          <i></i><i></i>
        </div>`)}
    </div>
    <div class="hex__label">
      <small>${title}</small>
      <b>${h.full}</b>
      <small>${h.n}. ${h.name}　${h.upTri.sym}${h.lowTri.sym}</small>
    </div>
  </div>`;

export default {
  title: '卜卦', eyebrow: 'I CHING',
  render({ settings }) {
    const d = store.drafts;
    return html`
      <section class="card reveal track" data-noswipe>
        <div class="field"><label for="q">要問的事</label>
          <input class="input" id="q" value="${d.ichingQ || ''}" placeholder="例如：這份工作該不該接？" maxlength="60"></div>
        <p class="hint" style="margin-top:var(--sp-2)">問題越具體越好。一事一卦，心定再擲。</p>
        <div class="seg" id="method" style="margin-top:var(--sp-3)">
          <button class="press" data-m="coin" aria-pressed="true">銅錢</button>
          <button class="press" data-m="time" aria-pressed="false">時間</button>
          <button class="press" data-m="num" aria-pressed="false">數字</button>
        </div>
        <div id="num-inputs" hidden style="margin-top:var(--sp-3)">
          <div class="grid grid--2">
            <div class="field"><label for="n1">第一個數</label><input class="input num" id="n1" type="number" value="37"></div>
            <div class="field"><label for="n2">第二個數</label><input class="input num" id="n2" type="number" value="128"></div>
          </div>
        </div>
        <button class="btn btn--primary btn--block press" id="go" style="margin-top:var(--sp-4)">
          ${raw(icon('dice'))} 起卦
        </button>
      </section>

      <section id="stage" class="section"></section>
      <section id="result" class="section"></section>
      ${DISCLAIMER}`;
  },

  mount(root, { all }) {
    let method = 'coin';
    const stage = $('#stage', root), result = $('#result', root);

    $$('#method button', root).forEach(b => b.addEventListener('click', () => {
      $$('#method button', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      method = b.dataset.m;
      $('#num-inputs', root).hidden = method !== 'num';
    }));
    $('#q', root).addEventListener('input', (e) => store.setDraft('ichingQ', e.target.value));

    const show = (lines, moving, extra = '', tossInfo = null) => {
      const r = reading(lines, moving);
      result.innerHTML = html`
        ${raw(sectionHead('卦象'))}
        <div class="hexwrap reveal">
          ${raw(hexSVG(r.ben, r.moving, '本卦'))}
          ${r.zhi ? raw(hexSVG(r.zhi, [], '之卦')) : ''}
        </div>

        <div class="card reveal track" style="margin-top:var(--sp-5)">
          ${raw(kv('本卦', `${r.ben.full}（第 ${r.ben.n} 卦 ${r.ben.name}）`))}
          ${raw(kv('卦辭', r.ben.judge))}
          ${raw(kv('要旨', r.ben.gist))}
          ${raw(kv('動爻', r.movingNames.join('、') || '無動爻，靜卦'))}
          ${r.zhi ? raw(kv('之卦', `${r.zhi.full}（${r.zhi.name}）—— ${r.zhi.gist}`)) : ''}
          ${raw(kv('互卦', `${r.hu.full}（事情的中段與內情）`))}
          ${raw(kv('錯卦', `${r.cuo.full}（相反的角度）`))}
          ${raw(kv('綜卦', `${r.zong.full}（對方的立場）`))}
          ${extra ? raw(`<p class="hint" style="margin-top:var(--sp-3)">${extra}</p>`) : ''}
        </div>

        <div class="card card--invert reveal" style="margin-top:var(--sp-4)">
          <p class="card__label">白話斷語</p>
          <p style="margin-top:var(--sp-2);line-height:1.9">${r.summary}</p>
        </div>

        <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-4)">
          <button class="btn btn--primary press" id="ask">${raw(icon('prompt'))} 請 LLM 解卦</button>
          <button class="btn btn--ghost press" id="copy-hex">${raw(icon('copy'))} 複製卦象</button>
          <button class="btn btn--ghost press" id="again">${raw(icon('refresh'))} 重新起卦</button>
        </div>`;
      observeReveal(result);

      const plain = [
        `問題：${$('#q', root).value.trim() || '（未填）'}`,
        `起卦方式：${{ coin: '三枚銅錢六擲', time: '梅花易數時間起卦', num: '數字起卦' }[method]}`,
        tossInfo ? `擲出：${tossInfo}` : '', extra,
        '', '卦象（由下而上）：', hexText(lines, moving), '',
        `本卦：${r.ben.full}（第 ${r.ben.n} 卦 ${r.ben.name}）　卦辭：${r.ben.judge}`,
        `動爻：${r.movingNames.join('、') || '無（靜卦）'}`,
        r.zhi ? `之卦：${r.zhi.full}（第 ${r.zhi.n} 卦 ${r.zhi.name}）` : '',
        `互卦：${r.hu.full}　錯卦：${r.cuo.full}　綜卦：${r.zong.full}`,
      ].filter(Boolean).join('\n');

      $('#copy-hex', result).addEventListener('click', () => copyText(plain, '卦象已複製'));
      $('#again', result).addEventListener('click', () => { result.innerHTML = ''; stage.innerHTML = ''; scrollTo({ top: 0, behavior: 'smooth' }); });
      $('#ask', result).addEventListener('click', () => {
        store.setDraft('ichingResult', plain);
        askPrompt(`/prompt?t=iching&q=${encodeURIComponent($('#q', root).value.trim())}`, all);
      });
    };

    const runCoins = async () => {
      const yao = tossCoins();
      stage.innerHTML = html`${raw(sectionHead('擲幣'))}<div class="stack" id="tosses"></div>`;
      const box = $('#tosses', stage);
      for (let i = 0; i < 6; i++) {
        const y = yao[i];
        const row = document.createElement('div');
        row.className = 'tossrow reveal is-in';
        // 每枚錢都是一張正面加一張背面疊起來的，翻到哪一面由 CSS 決定 ——
        // 換字比較省事，但那樣就沒有「翻過來」的厚度感了
        row.innerHTML = `<div class="coins">${y.coins.map(c => `
            <span class="coin is-spin ${c === 3 ? 'is-yang' : 'is-yin'}" title="${c === 3 ? '字' : '花'}">
              <span class="coin__f">${coin(true)}</span>
              <span class="coin__f coin__f--b">${coin(false)}</span>
            </span>`).join('')}</div>
          <small>第 ${i + 1} 爻　${y.sum} ${y.name}${y.moving ? '（動）' : ''}</small>`;
        box.appendChild(row);
        haptic(8);
        await new Promise(r => setTimeout(r, document.documentElement.dataset.motion === 'off' ? 30 : 480));
      }
      const lines = yao.map(y => y.line);
      const moving = yao.map((y, i) => (y.moving ? i : -1)).filter(i => i >= 0);
      show(lines, moving, '', yao.map(y => `${y.sum}${y.name}`).join('、'));
      setTimeout(() => $('#result', root).scrollIntoView({ behavior: 'smooth', block: 'start' }), 260);
    };

    $('#go', root).addEventListener('click', () => {
      stage.innerHTML = ''; result.innerHTML = '';
      if (method === 'coin') return runCoins();
      if (method === 'time') {
        const t = timeHexagram(new Date(), store.settings.tzOffset);
        show(t.lines, [t.movingIdx], `時間起卦：${t.detail}，取餘數定上下卦與動爻。`);
      } else {
        const a = parseInt($('#n1', root).value, 10) || 1;
        const b = parseInt($('#n2', root).value, 10) || 1;
        const n = numberHexagram(a, b);
        show(n.lines, [n.movingIdx], n.detail);
      }
      setTimeout(() => $('#result', root).scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    });
  },
};
