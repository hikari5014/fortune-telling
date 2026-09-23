/* 星空
   ──────────────────────────────────────────────────────────
   一層 canvas，畫三件事：靜靜閃的星點、偶爾劃過的流星、
   還有「點到牌」的時候從那一點炸開的星屑。

   天空本身也在動，兩種疊在一起：
   ・**自轉** —— 整片星空朝同一個方向極慢地飄。不是每顆星各飄各的
     （那看起來像雜訊），是整片一起走，像真的天球在轉。
   ・**視差** —— 跟著頁面捲動走。亮的大星離得近、走得多，
     暗的小星離得遠、幾乎不動，所以捲動時會有前後層次。

   規矩：
   ・畫面看不到就停 —— 手機在背景還跑 rAF 只是在燒電池
   ・系統說要減少動態就不閃、不飛、不飄，只留一張靜止的星圖
   ・尺寸跟著容器走，轉螢幕不會變形 */

const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * @param {HTMLCanvasElement} cv
 * @param {object} o {density 星點密度倍率, reduced 減少動態, tint 星色,
 *                    dust 星塵與流星的顏色（大星用 tint，其餘用這個）,
 *                    drift 自轉速度（px/秒，正的往右下）, parallax 捲動視差倍率,
 *                    scroll 取得捲動位置的函式（預設用整頁的 scrollY）}
 * @returns {{burst:(x,y,n?)=>void, shoot:()=>void, stop:()=>void}}
 */
export function starfield(cv, {
  density = 1, reduced = false, tint = [232, 217, 168], dust = [255, 255, 255],
  drift = 2.2, parallax = 0.28, scroll = null,
} = {}) {
  const ctx = cv.getContext('2d', { alpha: true });
  let w = 0, h = 0, dpr = 1, raf = 0, alive = true;
  let last = 0, spin = 0;          // spin：累積的自轉距離（px）
  let stars = [], shots = [], bits = [];
  const [tr, tg, tb] = tint;
  const [dr, dg, db] = dust;
  const scrollAt = scroll || (() => window.scrollY || 0);

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    cv.width = w * dpr;
    cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    const n = Math.round((w * h) / 5200 * density);
    stars = Array.from({ length: n }, () => {
      const r = rnd(0.4, 1.7);
      return {
        x: rnd(0, w), y: rnd(0, h),
        r,
        // 一小部分是「大星」，給金色與十字光芒，其餘是白色星塵
        big: Math.random() < 0.07,
        a: rnd(0.25, 0.9),
        sp: rnd(0.6, 2.4),            // 閃爍速度
        ph: rnd(0, Math.PI * 2),
        // 深度：大顆的當近景，走得多；小顆的當遠景，幾乎不動。
        // 自轉與捲動視差都乘這個值，層次才會出來。
        z: 0.18 + 0.82 * ((r - 0.4) / 1.3) ** 1.4,
      };
    });
  }

  /* 把座標捲回畫面內。上下各留 6px，免得星星在邊緣一閃一閃地出現。 */
  const wrap = (v, span) => ((v % span) + span) % span;

  /** 從 (x, y) 炸開一把星屑 */
  function burst(x, y, n = 18) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(0.7, 3.4);
      bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, r: rnd(0.8, 2.2) });
    }
  }

  /** 放一顆流星 */
  function shoot() {
    if (reduced) return;
    const fromLeft = Math.random() < 0.5;
    shots.push({
      x: fromLeft ? rnd(-40, w * 0.4) : rnd(w * 0.6, w + 40),
      y: rnd(-20, h * 0.5),
      vx: (fromLeft ? 1 : -1) * rnd(3.4, 6.2),
      vy: rnd(1.6, 3.2),
      life: 1, len: rnd(50, 130),
    });
  }

  function frame(t) {
    if (!alive) return;
    ctx.clearRect(0, 0, w, h);

    /* 自轉用「累積距離」而不是「絕對時間」：切到別的分頁再回來時，
       中間那段不該一次補上，不然星空會突然跳一大格。
       單幀最多前進 50ms，等於掉幀時自轉會慢下來，但絕不會跳。 */
    const dt = last ? Math.min(t - last, 50) : 0;
    last = t;
    if (!reduced) spin += dt / 1000 * drift;

    // 整片星空共用的位移：自轉 + 捲動視差。
    // 每顆星再乘上自己的深度 z，遠的慢、近的快。
    const offX = spin * 0.45;
    const offY = spin * 0.22 - (reduced ? 0 : scrollAt() * parallax);
    const spanX = w + 12, spanY = h + 12;

    for (const s of stars) {
      const tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(t / 1000 * s.sp + s.ph);
      const a = s.a * tw;
      const x = wrap(s.x + offX * s.z + 6, spanX) - 6;
      const y = wrap(s.y + offY * s.z + 6, spanY) - 6;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.big ? `rgba(${tr},${tg},${tb},${a})` : `rgba(${dr},${dg},${db},${a * 0.85})`;
      ctx.fill();
      if (s.big) {                                   // 大星加一個十字光芒
        const g = s.r * 5 * tw;
        ctx.strokeStyle = `rgba(${tr},${tg},${tb},${a * 0.5})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x - g, y); ctx.lineTo(x + g, y);
        ctx.moveTo(x, y - g); ctx.lineTo(x, y + g);
        ctx.stroke();
      }
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.vx; s.y += s.vy; s.life -= 0.016;
      if (s.life <= 0) { shots.splice(i, 1); continue; }
      const k = Math.hypot(s.vx, s.vy);
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx / k * s.len, s.y - s.vy / k * s.len);
      g.addColorStop(0, `rgba(${dr},${dg},${db},${s.life})`);
      g.addColorStop(1, `rgba(${dr},${dg},${db},0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx / k * s.len, s.y - s.vy / k * s.len);
      ctx.stroke();
    }

    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.x += b.vx; b.y += b.vy;
      b.vx *= 0.955; b.vy *= 0.955;
      b.life -= 0.022;
      if (b.life <= 0) { bits.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * b.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${tr},${tg},${tb},${b.life})`;
      ctx.fill();
    }

    if (!reduced && Math.random() < 0.0035) shoot();
    raf = requestAnimationFrame(frame);
  }

  const onVis = () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (alive && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  };

  resize();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  ro?.observe(cv);
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  return {
    burst, shoot,
    stop() {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
