/* 新手教學：第一次打開時跑一次，可以跳過，之後能在設定頁重看。
   用獨立的全螢幕疊層而不是底部抽屜 —— 抽屜可以往下拖關掉，
   第一次使用的人很容易誤觸就再也找不到。這裡只留明確的「跳過」。 */
import { html, raw, $, $$, haptic } from './ui.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { detect, installGuide } from './platform.js';

const bold = (t) => String(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

function steps() {
  const g = installGuide();
  return [
    {
      icon: 'astro', eyebrow: 'XUAN JIAN', title: '玄鑑',
      body: `曆法、節氣、四柱、星盤、紫微、八宅、姓名、數字 ——
        **全部在你的裝置上算**，不連網、不上傳、沒有帳號。`,
      extra: `需要「解讀」的時候，App 不會假裝自己懂，
        而是幫你把資料整理成一段提示詞，你複製到任何 LLM，再把回覆貼回來存檔。`,
    },
    {
      icon: 'profile', eyebrow: 'STEP 1', title: '先建立一份出生資料',
      body: `幾乎所有推算都從這裡開始：**國曆出生年月日、時辰、出生地**。`,
      extra: `出生地會影響上升星座，請盡量填準。
        **不知道時辰也可以算** —— 勾「不知道出生時辰」，App 會在受影響的地方標出來，
        提示詞也會提醒 LLM 哪些結論站不住腳。`,
      action: { text: '去建立', href: '#/profile', icon: 'plus' },
    },
    {
      icon: 'ziwei', eyebrow: 'STEP 2', title: '看你的盤',
      body: `建好之後，**星盤、紫微、八字、運勢、方位**就都算得出來了。`,
      extra: `每一頁的數字都點得下去：點紫微的宮位看主星與三方四正、
        點星盤的行星看相位、點八字的柱看藏干。
        分數怎麼來的也都列出來，不做看不懂的黑箱。`,
    },
    {
      icon: 'prompt', eyebrow: 'STEP 3', title: '提示詞器怎麼用',
      body: `這是這個 App 跟一般命理程式最大的差別。三步驟：`,
      list: [
        { icon: 'records', text: '**選一個模板**（命盤總覽、流年、感情、事業⋯⋯共 20 個）' },
        { icon: 'copy', text: '**複製提示詞**，貼到 ChatGPT、Claude、Gemini 或任何你慣用的 LLM' },
        { icon: 'down', text: '**把回覆貼回來**存成紀錄，之後可以搜尋、加標籤、比較不同模型的答案' },
      ],
      extra: `在任何一頁點「**深問這一項**」，會把你正在看的那一項帶進提示詞當成主軸。`,
      action: { text: '看提示詞器', href: '#/prompt', icon: 'prompt' },
    },
    {
      icon: 'install', eyebrow: 'STEP 4', title: '裝到主畫面',
      body: `裝起來之後是全螢幕、沒有網址列，而且**完全離線可用**。`,
      badge: g.title,
      list: g.steps.map(s => ({ icon: s.icon, text: s.text })),
      extra: g.note || '之後從主畫面的圖示打開就好。',
    },
  ];
}

export function startTour() {
  if (typeof document === 'undefined') return;
  const list = steps();
  let i = 0;

  const root = document.createElement('div');
  root.className = 'tour';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '新手教學');
  document.body.appendChild(root);
  document.documentElement.classList.add('is-touring');

  const done = () => {
    store.setSettings({ onboarded: true });
    root.classList.add('is-out');
    document.documentElement.classList.remove('is-touring');
    setTimeout(() => root.remove(), 300);
    removeEventListener('keydown', onKey);
  };
  const go = (n) => {
    if (n < 0 || n >= list.length) return;
    i = n;
    draw();
    haptic(6);
  };
  function onKey(e) {
    if (e.key === 'Escape') done();
    else if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
  }
  addEventListener('keydown', onKey);

  function draw() {
    const s = list[i];
    const last = i === list.length - 1;
    root.innerHTML = html`
      <div class="tour__panel" key="${i}">
        <button class="tour__skip press" data-skip>跳過</button>
        <div class="tour__art">${raw(icon(s.icon))}</div>
        <p class="tour__eyebrow">${s.eyebrow}</p>
        <h2 class="tour__title">${s.title}</h2>
        <p class="tour__body">${raw(bold(s.body))}</p>
        ${s.badge ? html`<p class="tour__badge"><span class="badge badge--dash">偵測到：${s.badge}</span></p>` : ''}
        ${s.list ? html`<ol class="steps tour__steps">
          ${s.list.map((x, k) => html`<li class="step">
            <span class="step__n num">${k + 1}</span>
            <span class="step__i">${raw(icon(x.icon))}</span>
            <span class="step__t">${raw(bold(x.text))}</span>
          </li>`)}
        </ol>` : ''}
        ${s.extra ? html`<p class="tour__extra">${raw(bold(s.extra))}</p>` : ''}
        ${s.action ? html`<a class="btn btn--ghost press tour__action" href="${s.action.href}" data-go>
          ${raw(icon(s.action.icon))} ${s.action.text}</a>` : ''}
        <div class="tour__foot">
          <div class="tour__dots">
            ${list.map((_, k) => html`<button class="tour__dot ${k === i ? 'is-on' : ''}" data-i="${k}"
              aria-label="第 ${k + 1} 步" aria-current="${k === i}"></button>`)}
          </div>
          <div class="row" style="gap:var(--sp-2)">
            ${i > 0 ? html`<button class="btn btn--ghost btn--sm press" data-prev>上一步</button>` : ''}
            <button class="btn btn--primary press" data-next>${last ? '開始使用' : '下一步'}</button>
          </div>
        </div>
      </div>`;

    $('[data-skip]', root).addEventListener('click', done);
    $('[data-next]', root).addEventListener('click', () => (last ? done() : go(i + 1)));
    $('[data-prev]', root)?.addEventListener('click', () => go(i - 1));
    $$('[data-i]', root).forEach(b => b.addEventListener('click', () => go(Number(b.dataset.i))));
    $('[data-go]', root)?.addEventListener('click', done);
  }

  draw();
  requestAnimationFrame(() => root.classList.add('is-in'));
}

/** 第一次打開時跑一次。已經有出生資料的人視同老手，不打擾。 */
export function maybeStartTour() {
  if (store.settings.onboarded) return;
  if (store.profiles.length) { store.setSettings({ onboarded: true }); return; }
  setTimeout(startTour, 700);
}
