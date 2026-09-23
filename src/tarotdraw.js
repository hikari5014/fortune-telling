/* 抽牌儀式
   ──────────────────────────────────────────────────────────
   一支全螢幕的過場：疊牌 → 洗牌 → 扇形展開 → 你自己挑 → 翻開 → 進解說。

   幾個設計上的決定，寫在這裡免得以後自己忘記：

   1. 牌在「洗牌」那一刻就已經定了。你在扇面上挑的是位置，
      位置對應到洗好的那一副牌的第幾張 —— 跟實體牌一模一樣。
      不是等你點完才決定要給你哪張。

   2. 扇面攤開的是完整的七十八張，不是挑幾張給你選。
      代價是每張只露出五、六個像素，所以改成「手指滑過去，
      底下那張會跳起來」，放開才算數 —— 看得到才選得到。

   3. 這一頁永遠是暗的，不跟隨淺色主題。牌背是深藍配金，
      放在白底上會很怪；而且抽牌本來就該像在夜裡進行。

   4. 動畫強度設成關閉、或系統要求減少動態時，整段直接跳過，
      不是播快一點 —— 會暈的人要的是不要動，不是動得比較快。

   5. 起卦（水晶球）不在這裡 —— 那一段在抽牌頁上，見 orbcast.js。
      這支只負責「白光散掉之後」的事：聚牌、洗牌、攤扇、挑牌、翻牌。 */

import { icon } from './icons.js';
import { starfield } from './starfield.js';
import { haptic } from './ui.js';
import { srcOf } from './decks.js';


const wait = (ms) => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RAD = Math.PI / 180;

/** 這台裝置／這個設定要不要播儀式 */
export function ceremonyOn(settings) {
  if (settings?.tarotCeremony === false) return false;
  if (settings?.motion === 'off') return false;
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch {}
  return true;
}

/**
 * 跑一次抽牌儀式。
 * @param {object} o
 * @param {object} o.spread  牌陣 {name, n, slots, desc}
 * @param {object[]} o.order  已經洗好的整副牌 —— 牌在進來之前就定了
 * @param {string} o.question 問題（顯示用，可空）
 * @param {boolean} o.allowReversed
 * @param {function} o.rand
 * @param {function} [o.onReady] 畫面就位之後叫一次 —— 起卦的白光等這一聲才散
 * @returns {Promise<null|{picks:number[], reversed:boolean[]}>} 中途離開回傳 null
 */
export function ceremony({ spread, order, question = '', allowReversed = true, rand = Math.random, onReady = null }) {
  return new Promise((resolve) => {
    const need = spread.n;
    const picks = [];
    let phase = 'stack';
    let done = false;

    /* ── 版面 ── */
    const root = document.createElement('div');
    root.className = 'cer';
    root.dataset.phase = phase;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '抽牌');
    root.innerHTML = `
      <canvas class="cer__sky" aria-hidden="true"></canvas>
      <div class="cer__top">
        <button class="cer__x" aria-label="離開抽牌">${icon('close')}</button>
        <div class="cer__meta">
          <p class="cer__step" aria-live="polite">聚牌</p>
          ${question ? `<p class="cer__q">${question}</p>` : ''}
          <p class="cer__sp">${spread.name} · ${need} 張</p>
        </div>
      </div>
      <div class="cer__slots" aria-hidden="true"></div>
      <div class="cer__stage"></div>
      <p class="cer__tip"></p>
      <button class="cer__go" hidden>${icon('check')} 看解說</button>`;
    document.body.append(root);
    document.body.classList.add('cer-open');
    /* 起卦的白光還蓋在上面。等這一層真的貼進 DOM、下一幀畫得出來之後才讓它散，
       白光底下換掉的就是完成品，不會看到半成品。 */
    if (onReady) requestAnimationFrame(() => requestAnimationFrame(onReady));

    const stage = root.querySelector('.cer__stage');
    const slotRow = root.querySelector('.cer__slots');
    const stepEl = root.querySelector('.cer__step');
    const tipEl = root.querySelector('.cer__tip');
    const goBtn = root.querySelector('.cer__go');
    const sky = starfield(root.querySelector('.cer__sky'), { density: 1.15, parallax: 0 });

    for (let i = 0; i < need; i++) {
      const s = document.createElement('span');
      s.className = 'cer__slot';
      s.textContent = spread.slots[i] || `第 ${i + 1} 張`;
      slotRow.append(s);
    }

    /* ── 牌 ── */
    const cards = order.map((c, i) => {
      const el = document.createElement('div');
      el.className = 'tc';
      // 正面先不放圖：七十八張一次載下來是兩百萬位元組，而且九成七不會被翻開。
      // 等這張真的被挑走才補上（見 take()）。
      el.innerHTML = '<div class="tc__in"><div class="tc__back"></div><div class="tc__face"></div></div>';
      el.style.zIndex = String(i);
      stage.append(el);
      return { el, card: c, i };
    });

    const put = (c, { x, y, deg = 0, s = 1, z, ms, delay = 0, o = 1 }) => {
      if (ms != null) c.el.style.transitionDuration = `${ms}ms`;
      c.el.style.transitionDelay = `${delay}ms`;
      c.el.style.opacity = String(o);
      if (z != null) c.el.style.zIndex = String(z);
      c.el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${deg}deg) scale(${s})`;
    };

    /* ── 幾何 ── */
    let W = 0, H = 0, CW = 58, fan = null;
    function measure() {
      const r = stage.getBoundingClientRect();
      W = r.width; H = r.height;
      CW = clamp(Math.round(W / 7), 44, 74);
      root.style.setProperty('--cw', `${CW}px`);
      const CH = CW / 0.5957;
      // 兩端的牌被轉了 span/2 度，算寬度要連轉過之後的外接框一起算，
      // 不然角會超出畫面 —— 超出去的那幾張就點不到了
      const spanDeg = 146, half = spanDeg / 2 * RAD;
      // 讓最外側那兩張的角剛好碰到邊 —— 中心點一定在畫面內，所以點得到
      const ext = (CW * Math.cos(half) + CH * Math.sin(half)) / 2 * 0.74;
      const R = clamp((W / 2 - 8 - ext) / Math.sin(half), 92, 320);
      // 扇心在畫面之外的下方，牌從那裡往上撐開
      fan = {
        cx: W / 2, cy: H * 0.40 + R, R, spanDeg, CH,
        step: order.length > 1 ? spanDeg / (order.length - 1) : 0,
        start: -90 - spanDeg / 2,
      };
    }
    const fanPos = (i) => {
      const deg = fan.start + i * fan.step;
      return { x: fan.cx + Math.cos(deg * RAD) * fan.R - CW / 2,
        y: fan.cy + Math.sin(deg * RAD) * fan.R - CW / 0.5957 / 2, deg: deg + 90 };
    };
    const stackPos = (i) => ({
      x: W / 2 - CW / 2 + Math.sin(i * 1.7) * 1.6,
      y: H * 0.42 + Math.cos(i * 2.3) * 1.6,
      deg: Math.sin(i * 0.9) * 1.4,
    });

    /* ── 收尾 ── */
    function teardown(result) {
      if (done) return;
      done = true;
      sky.stop();
      root.classList.add('is-out');
      document.body.classList.remove('cer-open');
      removeEventListener('keydown', onKey);
      setTimeout(() => root.remove(), 320);
      resolve(result);
    }
    const onKey = (e) => { if (e.key === 'Escape') teardown(null); };
    addEventListener('keydown', onKey);
    root.querySelector('.cer__x').addEventListener('click', () => teardown(null));

    /* ── 流程 ── */
    const setPhase = (p, step, tip = '') => {
      phase = p;
      root.dataset.phase = p;
      stepEl.textContent = step;
      tipEl.textContent = tip;
    };

    async function run() {
      measure();
      // 先把整副牌藏到畫面下面 —— 起卦那一段不該看到牌
      cards.forEach((c, i) => {
        const p = stackPos(i);
        put(c, { x: p.x, y: H + 80, deg: p.deg, s: .9, ms: 0, o: 0 });
      });
      await wait(30);

      // 1. 聚牌：從下面浮上來疊成一疊
      setPhase('stack', '聚牌');
      cards.forEach((c, i) => {
        const p = stackPos(i);
        put(c, { ...p, s: 1, ms: 520, delay: Math.min(i * 5, 260), o: 1 });
      });
      await wait(900);
      if (done) return;

      // 2. 洗牌：切成兩半甩開再交錯疊回來，做兩次
      setPhase('shuffle', '洗牌');
      for (let pass = 0; pass < 2; pass++) {
        const side = pass % 2 ? -1 : 1;
        cards.forEach((c, i) => {
          const p = stackPos(i);
          const half = i % 2 ? 1 : -1;
          put(c, { x: p.x + half * side * (W * 0.19), y: p.y - Math.abs(i % 2 ? 1 : -1) * 6,
            deg: half * side * 9, ms: 260, delay: Math.min(i * 2, 90) });
        });
        haptic(6);
        await wait(380);
        if (done) return;
        cards.forEach((c, i) => {
          const p = stackPos(i);
          put(c, { ...p, ms: 300, delay: (i % 2 ? 0 : 40) + Math.min(i * 3, 150) });
        });
        await wait(520);
        if (done) return;
      }

      // 3. 展開：從中間往兩邊依序攤成扇形
      setPhase('fan', '攤開', '');
      const mid = (order.length - 1) / 2;
      cards.forEach((c, i) => {
        const p = fanPos(i);
        put(c, { ...p, ms: 760, delay: Math.round(Math.abs(i - mid) * 7), z: i });
      });
      haptic(12);
      await wait(1000);
      if (done) return;
      setPhase('pick', '請選牌', pickTip(need));
    }

    /* ── 選牌 ── */
    let hot = -1;
    const taken = new Set();

    function hitAt(px, py) {
      const r = stage.getBoundingClientRect();
      const x = px - r.left - fan.cx, y = py - r.top - fan.cy;
      // 手指要落在「牌身那一圈」上：太靠內是扇子中間的空洞，太靠外是空白
      const d = Math.hypot(x, y);
      if (d < fan.R - fan.CH * 0.58 || d > fan.R + fan.CH * 0.46) return -1;
      const deg = Math.atan2(y, x) / RAD;
      const off = (deg - fan.start) / fan.step;
      if (off < -0.5 || off > order.length - 0.5) return -1;   // 扇面之外
      const i = Math.round(off);
      if (i < 0 || i >= order.length || taken.has(i)) return -1;
      return i;
    }

    function setHot(i) {
      if (hot === i) return;
      if (hot >= 0 && !taken.has(hot)) put(cards[hot], { ...fanPos(hot), ms: 220, z: hot });
      hot = i;
      if (i >= 0) {
        const p = fanPos(i);
        const pull = 30;
        put(cards[i], {
          x: p.x + Math.cos((p.deg - 90) * RAD) * pull,
          y: p.y + Math.sin((p.deg - 90) * RAD) * pull,
          deg: p.deg, s: 1.22, ms: 220, z: 400,
        });
        haptic(5);
      }
    }

    function take(i) {
      if (i < 0 || taken.has(i) || picks.length >= need) return;
      taken.add(i);
      picks.push(i);
      hot = -1;
      cards[i].el.classList.remove('is-drag');
      // 這時候才去載正面那張圖，翻牌前還有好幾百毫秒，來得及
      const face = cards[i].el.querySelector('.tc__face');
      if (!face.firstChild) {
        const img = new Image();
        img.alt = '';
        img.decoding = 'async';
        img.src = srcOf(cards[i].card.img);
        face.append(img);
      }
      const slot = slotRow.children[picks.length - 1];
      const sr = slot.getBoundingClientRect();
      const st = stage.getBoundingClientRect();
      slot.classList.add('is-on');
      cards[i].el.classList.add('is-taken');
      put(cards[i], {
        x: sr.left - st.left + sr.width / 2 - CW / 2,
        y: sr.top - st.top - CW / 0.5957 - 8,
        deg: 0, s: .72, ms: 520, z: 500 + picks.length,
      });
      haptic(14);
      sky.burst(sr.left - st.left + sr.width / 2, sr.top - st.top, 26);
      const left = need - picks.length;
      tipEl.textContent = left ? pickTip(left) : '';
      if (!left) reveal();
    }

    /** 把一張已經選走的牌放回扇面 */
    function untake(i) {
      const at = picks.indexOf(i);
      if (at < 0) return;
      picks.splice(at, 1);
      taken.delete(i);
      cards[i].el.classList.remove('is-taken', 'is-drag');
      put(cards[i], { ...fanPos(i), ms: 420, z: i });
      // 牌位標籤要重排：拔掉中間那一張，後面的都要往前遞補
      [...slotRow.children].forEach((sl, k) => sl.classList.toggle('is-on', k < picks.length));
      relayoutSlots();
      haptic(10);
      tipEl.textContent = pickTip(need - picks.length);
    }

    /** 把還在手上的牌，重新對到它現在的牌位 */
    function relayoutSlots() {
      const st = stage.getBoundingClientRect();
      picks.forEach((idx, k) => {
        const sr = slotRow.children[k].getBoundingClientRect();
        put(cards[idx], {
          x: sr.left - st.left + sr.width / 2 - CW / 2,
          y: sr.top - st.top - CW / 0.5957 - 8,
          deg: 0, s: .72, ms: 360, z: 500 + k + 1,
        });
      });
    }

    /* ── 拖曳 ────────────────────────────────────────
       按住一張牌之後它就跟著手指走。放開時看兩件事：
       ・往上甩出去（越過投線，或放手時還在往上衝）→ 收下這張
       ・放回扇面附近 → 它自己滑回原位，什麼都沒發生
       已經選走的牌也可以往下拖回扇面，等於反悔。

       「往上丟」比「點一下」多一個好處：手指在畫面下半部，
       扇面也在下半部，點的時候手會擋住自己要看的東西；
       拖出來就看得見了。 */
    /* 判斷「有沒有丟出去」要看**相對位移**，不是畫面上的某一條絕對高度：
       扇面本來就攤在畫面中段，很多牌一開始就已經在上半部，
       用絕對線的話等於隨便碰一下都算丟出去。 */
    const THROW_UP = 86;                  // 往上拉超過這麼多就算丟出去
    const DROP_DOWN = 110;                // 已選的牌往下拉超過這麼多就算放回去
    let drag = null;

    const pickTip = (left) => left
      ? `按住一張牌往上丟就收下，放回扇面就當沒發生　（還要 ${left} 張）`
      : '';

    /** 這個座標上有沒有一張「已經選走」的牌 */
    function slotAt(px, py) {
      for (let k = picks.length - 1; k >= 0; k--) {
        const r = cards[picks[k]].el.getBoundingClientRect();
        if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) return picks[k];
      }
      return -1;
    }

    function startDrag(i, e, from) {
      const st = stage.getBoundingClientRect();
      const x0 = e.clientX - st.left, y0 = e.clientY - st.top;
      drag = {
        i, from, x0, y0, x: x0, y: y0,
        lastY: e.clientY, vy: 0, t: performance.now(), moved: false,
      };
      cards[i].el.classList.add('is-drag');
      haptic(8);
    }

    function moveDrag(e) {
      const st = stage.getBoundingClientRect();
      const now = performance.now();
      const dt = Math.max(1, now - drag.t);
      drag.vy = (e.clientY - drag.lastY) / dt;
      drag.lastY = e.clientY; drag.t = now;
      const nx = e.clientX - st.left, ny = e.clientY - st.top;
      if (Math.abs(nx - drag.x) > 4 || Math.abs(ny - drag.y) > 4) drag.moved = true;
      drag.x = nx; drag.y = ny;
      // 牌心跟著指標，稍微往上提一點，手指才不會整個蓋住牌面
      put(cards[drag.i], {
        x: nx - CW / 2, y: ny - CW / 0.5957 * 0.62,
        deg: Math.max(-14, Math.min(14, drag.vy * -22)), s: 1.3, ms: 0, z: 900,
      });
    }

    function endDrag() {
      if (!drag) return;
      const { i, from, y, y0, vy, moved } = drag;
      const dy = y - y0;
      drag = null;
      cards[i].el.classList.remove('is-drag');

      if (from === 'fan') {
        // 沒真的拖動就當成點一下 —— 點著選牌的人不該被迫學新手勢
        if (!moved) { take(i); return; }
        // 拉得夠高，或放手時還在往上衝（快速一甩）
        if (dy < -THROW_UP || vy < -0.55) take(i);
        else { setHot(-1); put(cards[i], { ...fanPos(i), ms: 300, z: i }); }
      } else {
        // 從牌位拖下來的：拉得夠低就放回牌組，否則回牌位
        if (dy > DROP_DOWN || vy > 0.55) untake(i);
        else relayoutSlots();
      }
    }

    /* 事件掛在整個儀式層上，不是只掛在舞台上：
       已經選走的牌會飛到牌位那一排，那排在舞台上緣的外面 ——
       只聽舞台的話，那幾張牌根本摸不到，也就拖不回來。
       代價是要自己判斷「有沒有抓到東西」，沒抓到就什麼都不做，
       不然關閉鍵會被 preventDefault 吃掉。 */
    root.addEventListener('pointerdown', (e) => {
      if (phase !== 'pick') return;
      const s = slotAt(e.clientX, e.clientY);
      const i = s >= 0 ? s : hitAt(e.clientX, e.clientY);
      if (s < 0) setHot(i);
      if (i < 0) return;                  // 沒抓到牌：讓事件照常傳下去
      e.preventDefault();
      root.setPointerCapture(e.pointerId);
      startDrag(i, e, s >= 0 ? 'slot' : 'fan');
    });
    root.addEventListener('pointermove', (e) => {
      if (phase !== 'pick') return;
      if (drag) { moveDrag(e); return; }
      // 沒按著的時候（滑鼠移過去）照舊：底下那張跳起來當預覽
      if (e.buttons === 0) setHot(hitAt(e.clientX, e.clientY));
    });
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', () => {
      if (drag) { const { i, from } = drag; drag = null;
        cards[i].el.classList.remove('is-drag');
        if (from === 'fan') put(cards[i], { ...fanPos(i), ms: 300, z: i }); else relayoutSlots();
      }
      setHot(-1);
    });
    // 觸控長按預設會跳出選取與放大鏡，整個儀式都不要
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ── 翻牌 ── */
    async function reveal() {
      setPhase('reveal', '翻牌', '');
      // 沒被選到的牌沉下去
      cards.forEach((c, i) => {
        if (taken.has(i)) return;
        const p = fanPos(i);
        put(c, { x: p.x, y: p.y + 140, deg: p.deg, s: .9, ms: 520, delay: Math.min(i * 3, 200), o: 0 });
      });
      slotRow.classList.add('is-dim');
      await wait(360);
      if (done) return;

      // 排到中間，一張一張翻開
      const n = picks.length;
      const cols = n <= 3 ? n : n <= 6 ? 3 : n <= 8 ? 4 : 5;
      const rows = Math.ceil(n / cols);
      const gap = 10;
      // 多排的時候每一排下面要留位置給位置名稱，不然上排的字會被下排的牌壓住
      const gapY = rows > 1 ? 30 : 10;
      const cw = clamp(Math.floor((W - gap * (cols + 1)) / cols), 52, 128);
      const ch = cw / 0.5957;
      const totalH = rows * ch + (rows - 1) * gapY;
      const top = Math.max(16, (H - totalH) / 2 - 10);
      root.style.setProperty('--rw', `${cw}px`);

      picks.forEach((idx, k) => {
        const r = Math.floor(k / cols), col = k % cols;
        const inRow = Math.min(cols, n - r * cols);
        const rowW = inRow * cw + (inRow - 1) * gap;
        cards[idx].el.classList.add('is-out');
        // scale 是繞著中心放大的，所以目標要換算成「中心對中心」，
        // 直接拿左上角當座標會整排偏掉
        put(cards[idx], {
          x: (W - rowW) / 2 + col * (cw + gap) + cw / 2 - CW / 2,
          y: top + r * (ch + gapY) + ch / 2 - CW / 0.5957 / 2,
          deg: 0, s: cw / CW, ms: 560, delay: k * 70, z: 600 + k,
        });
      });
      await wait(560 + n * 70);
      if (done) return;

      for (let k = 0; k < n; k++) {
        const idx = picks[k];
        const c = cards[idx];
        const rev = allowReversed && rand() < 0.42;
        c.reversed = rev;
        c.el.classList.toggle('is-rev', rev);
        c.el.classList.add('is-face');
        const b = c.el.getBoundingClientRect();
        const st = stage.getBoundingClientRect();
        sky.burst(b.left - st.left + b.width / 2, b.top - st.top + b.height / 2, 22);
        haptic(10);
        // 位置標籤跟著亮起來
        const tag = document.createElement('span');
        tag.className = 'cer__tag';
        tag.textContent = spread.slots[k] || '';
        tag.style.left = `${b.left - st.left + b.width / 2}px`;
        tag.style.top = `${b.top - st.top + b.height + 6}px`;
        stage.append(tag);
        requestAnimationFrame(() => tag.classList.add('is-in'));
        await wait(320);
        if (done) return;
      }

      setPhase('done', '抽牌完成', '');
      goBtn.hidden = false;
      requestAnimationFrame(() => goBtn.classList.add('is-in'));
      goBtn.addEventListener('click', () => teardown({ picks, reversed: picks.map(i => !!cards[i].reversed) }), { once: true });
    }

    addEventListener('resize', () => { if (phase === 'fan' || phase === 'pick') { measure(); cards.forEach((c, i) => { if (!taken.has(i)) put(c, { ...fanPos(i), ms: 200, z: i }); }); } });
    run();
  });
}
