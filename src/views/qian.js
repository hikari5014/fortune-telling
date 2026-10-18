import { html, raw, $, $$, sheet, toast, copyText, confirmSheet, haptic, download } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { resolve } from '../router.js';
import { shakeQian, castJiao, jiaoOf, toText, BUILTIN_SET, normalizeSet, SET_SCHEMA, luckScore } from '../engines/qian.js';
import { observeReveal } from '../motion.js';
import { DISCLAIMER, sectionHead, kv, shareBtn, doShare, askPrompt } from './_shared.js';
import { trackBtn, bindTrack } from '../verify.js';
import { mountJiao3D } from '../jiao3d.js';
import { mountTube3D } from '../qian3d.js';
import { zhNum } from '../relics.js';
import { tube as tubeLine, stick as stickLine, slip as slipArt, jiao as jiaoLine, tubePhoto, stickPhoto, jiaoPhoto, usePhoto } from '../relics.js';

/* 法器：照片或線稿，看設定 */
const tubeArt = (n) => (usePhoto(store.settings) ? tubePhoto() : tubeLine(n));
const stickArt = (label) => (usePhoto(store.settings) ? stickPhoto(label) : stickLine(label));
const jiaoArt = (flat) => (usePhoto(store.settings) ? jiaoPhoto(flat) : jiaoLine(flat));

const luckCls = (l) => ['大吉', '上吉', '吉'].includes(l) ? 'luck--good' : l === '中吉' || l === '中平' ? 'luck--half' : 'luck--bad';
const allSets = () => [BUILTIN_SET, ...store.qianSets];
const currentSet = () => allSets().find(s => s.id === store.settings.qianSetId) || BUILTIN_SET;

export default {
  title: '求籤', eyebrow: 'ORACLE POEM',
  render() {
    const set = currentSet();
    const sets = allSets();
    return html`
      <section class="card reveal track" data-noswipe>
        <div class="field"><label for="qq">要問的事</label>
          <input class="input" id="qq" value="${store.drafts.qianQ || ''}" placeholder="例如：這份工作該不該接？" maxlength="60"></div>
        <p class="hint" style="margin-top:var(--sp-2)">一事一籤。心裡把事情想清楚，再開始。</p>
        <div class="row row--between" style="margin-top:var(--sp-3);gap:var(--sp-2)">
          <div class="field" style="flex:1;min-width:0"><label for="qset">籤詩集</label>
            <select class="select" id="qset">
              ${sets.map(s => html`<option value="${s.id}" ${s.id === set.id ? 'selected' : ''}>${s.name}（${s.poems.length} 首）</option>`)}
            </select></div>
          <button class="chip press" id="qset-io" style="align-self:flex-end;height:44px">${raw(icon('folder'))} 管理</button>
        </div>
        <div class="row row--between" style="margin-top:var(--sp-3)">
          <span class="hint">擲筊確認</span>
          <div class="seg" id="qneed">
            <button class="press" data-n="1" aria-pressed="${(store.settings.qianNeed ?? 1) === 1}">一聖筊</button>
            <button class="press" data-n="3" aria-pressed="${(store.settings.qianNeed ?? 1) === 3}">連三聖筊</button>
          </div>
        </div>
        <p class="hint" style="margin-top:var(--sp-2)">來源：${set.source}</p>
      </section>

      <section id="qstage" class="section"></section>
      ${DISCLAIMER}`;
  },

  mount(root, { all }) {
    const stage = $('#qstage', root);
    let set = currentSet();
    let poem = null;
    let log = [];          // 擲筊紀錄
    let streak = 0;
    let need = store.settings.qianNeed ?? 1;

    $('#qq', root).addEventListener('input', (e) => store.setDraft('qianQ', e.target.value));
    $('#qset', root).addEventListener('change', (e) => {
      store.setSettings({ qianSetId: e.target.value });
      set = currentSet();
      reset();
      toast(`已切換為 ${set.name}`);
      resolve();
    });
    $('#qset-io', root).addEventListener('click', openSets);
    $$('#qneed button', root).forEach(b => b.addEventListener('click', () => {
      $$('#qneed button', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      need = Number(b.dataset.n);
      store.setSettings({ qianNeed: need });
      reset();
    }));

    const fast = () => document.documentElement.dataset.motion === 'off';
    // 擲筊：3D 物理（預設）或原本的翻轉動畫
    const use3d = () => (store.settings.jiaoStyle || '3d') === '3d' && typeof document.createElement('canvas').getContext === 'function';
    let j3d = null, t3d = null;
    // 籤筒：3D（預設）或原本的平面圖
    const useTube3d = () => (store.settings.tubeStyle || '3d') === '3d' && typeof document.createElement('canvas').getContext === 'function';
    addEventListener('hashchange', function off() { j3d?.destroy(); t3d?.destroy(); removeEventListener('hashchange', off); });
    const sleep = (ms) => new Promise(r => setTimeout(r, fast() ? 10 : ms));

    /* ── 第一步：搖籤筒 ─────────────────────────── */
    function reset() {
      poem = null; log = []; streak = 0;
      if (useTube3d()) return reset3d();
      stage.innerHTML = html`
        ${raw(sectionHead('搖籤'))}
        <div class="qstep reveal is-in">
          <p class="qstep__hint">默念姓名、出生年月日與要問的事，然後搖籤筒。</p>
          <div class="qtubewrap" id="tubewrap">
            <div class="qtube" id="tube">${raw(tubeArt(9))}</div>
          </div>
          <button class="btn btn--primary press" id="shake" style="margin-top:var(--sp-5)">
            ${raw(icon('dice'))} 搖出一支籤
          </button>
        </div>`;
      $('#shake', stage).addEventListener('click', doShake);
    }

    /* 3D 籤筒：手機傾斜／搖晃、拖著甩、或直接用手抽一支 */
    function reset3d() {
      stage.innerHTML = html`
        ${raw(sectionHead('搖籤'))}
        <div class="qstep reveal is-in">
          <p class="qstep__hint">默念姓名、出生年月日與要問的事，然後搖籤筒 ——
            搖到有一支自己跳出來；或是憑感覺，直接按住一支往上抽。</p>
          <div class="tube3d" id="tube3d" data-noswipe></div>
          <p class="qstep__hint" id="t3tip">拖著籤筒左右甩就是搖；往自己這邊拉，筒會往前傾、比較容易倒出來。</p>
          <div class="row" style="gap:var(--sp-2);justify-content:center">
            <button class="btn btn--primary press" id="shake">${raw(icon('dice'))} 搖出一支籤</button>
            <button class="btn btn--ghost press" id="t3motion">${raw(icon('spark'))} 用手機搖</button>
          </div>
        </div>`;
      t3d?.destroy();
      t3d = mountTube3D($('#tube3d', stage), {
        count: set.poems.length,
        labelOf: (i) => `第${zhNum(set.poems[i].n)}首`,
        onPick: (i) => { poem = set.poems[i]; toJiao(); },
      });
      $('#shake', stage).addEventListener('click', (e) => { e.currentTarget.disabled = true; t3d.autoShake(); });
      $('#t3motion', stage).addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const ok = await t3d.armMotion();
        if (ok) {
          btn.disabled = true; btn.textContent = '手機已就緒';
          $('#t3tip', stage).textContent = '拿著手機傾斜，籤筒就跟著歪；搖一搖，籤會在筒裡跳，搖久了會有一支被擠出來。';
        } else toast('沒辦法讀取手機的動作感測，用拖曳或按鈕也可以');
      });
    }

    async function doShake() {
      const btn = $('#shake', stage);
      btn.disabled = true;
      const tube = $('#tube', stage);
      tube.classList.add('is-shaking');
      haptic(14);
      await sleep(1120);
      tube.classList.remove('is-shaking');
      poem = shakeQian(set);
      // 搖完才知道是哪一支 —— 籤號刻在升起來的那支上面，
      // 不然使用者看到的只是「一根棍子」，跟接下來的籤詩接不起來
      $('#tubewrap', stage).insertAdjacentHTML('beforeend',
        `<div class="qdrawn is-rising" id="drawn">${stickArt(poem.n)}</div>`);
      haptic(10);
      await sleep(1180);
      toJiao();
    }

    /* ── 第二步：擲筊請示 ───────────────────────── */
    function toJiao() {
      t3d?.destroy(); t3d = null;
      stage.innerHTML = html`
        ${raw(sectionHead('擲筊請示'))}
        <div class="qstep reveal is-in">
          <p class="qstep__hint">
            搖出<b>第 ${poem.n} 首・${poem.gz}籤</b>。請擲筊確認是不是這一支 ——
            ${need > 1 ? `連得 ${need} 個聖筊才算準` : '擲出聖筊就算確認'}；擲出笑筊或陰筊就重新搖過。
          </p>
          ${use3d() ? html`
          <div class="jiao3d" id="jiao3d" data-noswipe></div>
          <p class="qstep__hint jiao3d__tip" id="j3tip">按「擲筊」，或在上面往上一甩。</p>
          <button class="chip press" id="j3motion" style="margin:0 auto var(--sp-2)">${raw(icon('spark'))} 用手機擲筊</button>`
          : html`<div class="jiaos" id="jiaos">
            ${raw(Array.from({ length: 2 }, () => html`
              <span class="jiao">
                <span class="jiao__f">${raw(jiaoArt(true))}</span>
                <span class="jiao__f jiao__f--b">${raw(jiaoArt(false))}</span>
              </span>`).join(''))}
          </div>`}
          <div class="jiao-log" id="jlog"></div>
          <p class="qstep__hint" id="jmsg" style="min-height:3.4em"></p>
          <div class="row" style="gap:var(--sp-2);justify-content:center">
            <button class="btn btn--primary press" id="cast">${raw(icon('dice'))} 擲筊${need > 1 ? `（${streak}/${need}）` : ''}</button>
            <button class="btn btn--ghost press" id="restart">${raw(icon('refresh'))} 重新搖籤</button>
          </div>
        </div>`;
      drawLog();
      $('#cast', stage).addEventListener('click', doCast);
      $('#restart', stage).addEventListener('click', reset);
      if (use3d()) {
        j3d?.destroy();
        j3d = mountJiao3D($('#jiao3d', stage), {
          canThrow: () => !!$('#cast', stage) && !$('#cast', stage).dataset.wait,
          onThrow: () => { const b = $('#cast', stage); if (b) b.disabled = true; },
          onResult: (faces) => settle(jiaoOf(faces)),
        });
        // 手機：權限一定要在點擊當下要，所以做成一顆按鈕
        $('#j3motion', stage).addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          const ok = await j3d.armMotion();
          if (ok) {
            btn.disabled = true; btn.textContent = '手機已就緒';
            $('#j3tip', stage).textContent = '雙手捧著手機，輕輕往上一拋就擲出 —— 手機千萬不要離手。';
          } else toast('沒辦法讀取手機的動作感測，用按鈕或往上甩也可以');
        });
      }
    }

    function drawLog() {
      const el = $('#jlog', stage);
      if (el) el.innerHTML = log.map(r => html`<span class="${r.ok ? 'is-ok' : ''}">${r.kind}</span>`).join('');
    }

    async function doCast() {
      const btn = $('#cast', stage);
      btn.disabled = true;
      if (use3d()) { j3d.toss(1); return; }          // 3D：丟出去，落地後由 settle() 接手
      const [a, b] = $$('.jiao', stage);
      /* 先擲出結果再放動畫：翻幾圈由「最後要落哪一面」決定，
         動畫跑到一半才改面，animation-name 一換就會整個重來。 */
      const r = castJiao();
      [a, b].forEach(el => el.classList.remove('is-cast'));
      a.classList.toggle('jiao--flat', r.faces[0] === '平');
      b.classList.toggle('jiao--flat', r.faces[1] === '平');
      void a.offsetWidth;
      [a, b].forEach(el => el.classList.add('is-cast'));
      a.title = r.faces[0]; b.title = r.faces[1];
      haptic(12);
      await sleep(820);
      settle(r);
    }

    /** 擲出結果之後：記錄、判斷聖筊與否（翻轉動畫與 3D 物理共用） */
    async function settle(r) {
      const btn = $('#cast', stage);
      if (!btn) return;
      log.push(r);
      drawLog();
      $('#jmsg', stage).textContent = r.text;

      if (r.ok) {
        streak++;
        if (streak >= need) { await sleep(560); return showResult(); }
        btn.innerHTML = icon('dice') + ` 擲筊（${streak}/${need}）`;
        btn.disabled = false;
      } else {
        streak = 0;
        btn.dataset.wait = '1';                     // 等著重新搖籤的這一秒，不能再丟
        $('#jmsg', stage).textContent = r.text + '　→　重新搖一支籤。';
        await sleep(1100);
        reset();
      }
    }

    /* ── 第三步：得籤 ───────────────────────────── */
    function showResult() {
      const q = $('#qq', root).value.trim();
      const plain = toText({ poem, rounds: log, confirmed: true, set }, q);
      stage.innerHTML = html`
        ${raw(sectionHead('籤詩'))}
        <!-- 籤詩紙：紙是畫的（毛邊與摺痕），字疊在上面 ——
             中文直書要交給 CSS 的 writing-mode，塞進 SVG 只會更難排 -->
        <div class="qslip reveal">
          ${raw(slipArt())}
          <div class="qslip__in">
            <div class="qcard__head">
              <span class="qcard__no">第 ${poem.n} 首</span>
              <span class="badge badge--dash">${poem.gz}籤</span>
              <span class="luck ${luckCls(poem.luck)}">${poem.luck}</span>
            </div>
            <div class="qpoem ${store.settings.qianVertical ? 'qpoem--v' : ''}" id="qpoem">
              ${poem.lines.map((l, i) => html`<p style="--i:${i}">${l}</p>`)}
            </div>
            <div class="row" style="justify-content:center;margin-top:var(--sp-3)">
              <button class="chip press" id="qdir" aria-pressed="${!!store.settings.qianVertical}">直書</button>
            </div>
          </div>
        </div>

        <div class="card card--invert reveal" style="margin-top:var(--sp-4)">
          <p class="card__label">白話要旨</p>
          <p style="margin-top:var(--sp-2);line-height:1.9">${poem.gist || '（這個籤詩集沒有附白話，交給 LLM 解讀）'}</p>
        </div>

        <div class="card reveal track" style="margin-top:var(--sp-4)">
          ${raw(kv('籤詩集', `${set.name}`))}
          ${raw(kv('來源', set.source))}
          ${raw(kv('擲筊', log.map(r => r.kind).join('、')))}
          ${q ? raw(kv('所問', q)) : ''}
        </div>

        <div class="row" style="gap:var(--sp-2);margin-top:var(--sp-4)">
          <button class="btn btn--primary press" id="ask">${raw(icon('prompt'))} 請 LLM 解籤</button>
          <button class="btn btn--ghost press" id="copy-q">${raw(icon('copy'))} 複製籤詩</button>
          ${shareBtn('q-share', '長圖')}
          <button class="btn btn--ghost press" id="again">${raw(icon('refresh'))} 重新求籤</button>
          ${trackBtn()}
        </div>`;
      observeReveal(stage);
      haptic(18);

      $('#qdir', stage).addEventListener('click', (e) => {
        const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
        e.currentTarget.setAttribute('aria-pressed', String(on));
        $('#qpoem', stage).classList.toggle('qpoem--v', on);
        store.setSettings({ qianVertical: on });
      });
      $('#copy-q', stage).addEventListener('click', () => copyText(plain, '籤詩已複製'));
      bindTrack(stage, () => ({ kind: 'qian', question: q, text: plain, profile: all?.profile || null }));
      $('#again', stage).addEventListener('click', reset);
      $('#q-share', stage).addEventListener('click', async () => {
        const { qianCard } = await import('../sharecards.js');
        doShare(() => qianCard(poem, q, set.name, set.source), `玄鑑-第${poem.n}籤.png`);
      });
      $('#ask', stage).addEventListener('click', () => {
        store.setDraft('qianResult', plain);
        askPrompt(`/prompt?t=qian&q=${encodeURIComponent(q)}`, all);
      });
      setTimeout(() => stage.scrollIntoView({ behavior: 'smooth', block: 'start' }), 220);
    }

    /* ── 籤詩集管理 ─────────────────────────────── */
    function openSets() {
      const mine = store.qianSets;
      sheet({
        title: '籤詩集',
        body: html`<div class="stack" data-noswipe>
          <p class="hint">
            內建的「玄鑑六十籤」是本 App 自撰的七言四句，<b>不是宮廟籤詩原文</b>。
            想用自己常去的宮廟籤詩，可以匯入 JSON，或用「查籤詩原文」提示詞請 LLM 提供再貼回來。
          </p>
          ${mine.length ? html`<div class="stack" style="gap:6px">
            ${mine.map(s => html`
              <div class="pair" style="grid-template-columns:1fr auto">
                <span><b style="font-family:var(--font-display)">${s.name}</b>
                  <span class="hint" style="display:block">${s.poems.length} 首 · ${s.source}</span></span>
                <button class="iconbtn press" data-del="${s.id}" aria-label="刪除 ${s.name}">${raw(icon('trash'))}</button>
              </div>`)}
          </div>` : html`<p class="hint">目前沒有匯入的籤詩集。</p>`}
          <div class="field"><label for="qjson">貼上籤詩集 JSON</label>
            <textarea class="textarea textarea--code" id="qjson" style="min-height:130px" placeholder='${SET_SCHEMA.replace(/'/g, '&#39;')}'></textarea></div>
          <div class="row" style="gap:var(--sp-2)">
            <button class="btn btn--primary press" data-import style="flex:1">${raw(icon('check'))} 匯入</button>
            <button class="btn btn--ghost press" data-file>${raw(icon('up'))} 從檔案</button>
            <button class="btn btn--ghost press" data-schema>${raw(icon('copy'))} 複製格式</button>
          </div>
          <a class="btn btn--ghost btn--block press" href="#/prompt?t=qian-src">${raw(icon('search'))} 用提示詞請 LLM 提供某支籤的原文</a>
        </div>`,
        onMount(sr, close) {
          $$('[data-del]', sr).forEach(b => b.addEventListener('click', async () => {
            close();
            if (await confirmSheet('刪除籤詩集', '確定要移除這個匯入的籤詩集嗎？', '刪除')) {
              store.removeQianSet(b.dataset.del);
              if (store.settings.qianSetId === b.dataset.del) store.setSettings({ qianSetId: 'xuanjian60' });
              toast('已移除'); resolve();
            }
          }));
          $('[data-schema]', sr).addEventListener('click', () => copyText(SET_SCHEMA, '格式已複製'));
          const doImport = (text) => {
            try {
              const s2 = normalizeSet(JSON.parse(text));
              store.addQianSet(s2);
              store.setSettings({ qianSetId: s2.id });
              close(); toast(`已匯入 ${s2.name}（${s2.poems.length} 首）`);
              resolve();
            } catch (e) { toast('匯入失敗：' + e.message); }
          };
          $('[data-import]', sr).addEventListener('click', () => {
            const t = $('#qjson', sr).value.trim();
            if (!t) { toast('先貼上 JSON'); return; }
            doImport(t);
          });
          $('[data-file]', sr).addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'application/json,.json';
            input.onchange = async () => { const f = input.files?.[0]; if (f) doImport(await f.text()); };
            input.click();
          });
        },
      });
    }

    reset();
  },
};
