/* 分享長圖：把一張「文件描述」畫成黑白長圖，可存可傳。
   用 canvas 自己排版，沒有任何套件。兩次走訪：第一次量高度，第二次才真的畫。
   中日韓字沒有空格可以斷行，所以逐字量寬、遇到行末標點再往回收一格。 */

const W = 1080;
const PAD = 84;
const DISPLAY = '"Noto Serif TC","Songti TC",serif';
const BODY = '"Noto Sans TC",system-ui,sans-serif';
const NUM = '"Space Grotesk","Noto Sans TC",monospace';

/* 不能出現在行首的標點 */
const NO_LINE_START = '，。、；：？！）》」』】〉…·”’%';
/* 不能出現在行末的標點 */
const NO_LINE_END = '（《「『【〈“‘';

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const ch of para) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > maxW) {
        // 行首禁則：把這個字留在上一行；行末禁則：把上一個字推到下一行
        if (NO_LINE_START.includes(ch)) { out.push(next); line = ''; continue; }
        if (NO_LINE_END.includes(line.slice(-1))) { out.push(line.slice(0, -1)); line = line.slice(-1) + ch; continue; }
        out.push(line); line = ch;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

const C = {
  light: { bg: '#ffffff', ink: '#111111', ink2: '#555555', ink3: '#8a8a8a', line: '#e2e2e2', inv: '#111111', invInk: '#ffffff' },
  dark:  { bg: '#0b0b0b', ink: '#f5f5f5', ink2: '#b4b4b4', ink3: '#7d7d7d', line: '#2a2a2a', inv: '#f5f5f5', invInk: '#0b0b0b' },
};

/** 走訪一次：draw=false 只算高度 */
function run(ctx, doc, c, draw) {
  const maxW = W - PAD * 2;
  let y = PAD + 20;
  const text = (s, { font, size, color, lh = 1.6, align = 'left', x = PAD, width = maxW }) => {
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    const lines = wrap(ctx, s, width);
    for (const ln of lines) {
      y += size;
      if (draw) ctx.fillText(ln, align === 'center' ? W / 2 : align === 'right' ? x + width : x, y);
      y += size * (lh - 1);
    }
  };
  const rule = (inset = 0) => {
    y += 4;
    if (draw) {
      ctx.strokeStyle = c.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(PAD + inset, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    }
    y += 4;
  };

  for (const b of doc.blocks) {
    switch (b.t) {
      case 'eyebrow':
        ctx.letterSpacing = '6px';
        text(b.text, { font: BODY, size: 24, color: c.ink3 });
        ctx.letterSpacing = '0px';
        y += 14;
        break;
      case 'title':
        text(b.text, { font: DISPLAY, size: 56, color: c.ink, lh: 1.3 });
        y += 20;
        break;
      case 'big':
        y += 10;
        text(b.text, { font: DISPLAY, size: b.size || 116, color: c.ink, lh: 1.15, align: 'center' });
        if (b.sub) { y += 10; text(b.sub, { font: BODY, size: 26, color: c.ink3, align: 'center' }); }
        y += 28;
        break;
      case 'h':
        y += 26;
        text(b.text, { font: DISPLAY, size: 34, color: c.ink });
        y += 6; rule(); y += 12;
        break;
      case 'p':
        text(b.text, { font: BODY, size: 28, color: b.dim ? c.ink3 : c.ink2, lh: 1.85 });
        y += 16;
        break;
      case 'poem':
        y += 12;
        for (const ln of b.lines) { text(ln, { font: DISPLAY, size: 46, color: c.ink, lh: 1.7, align: 'center' }); }
        y += 20;
        break;
      case 'kv':
        for (const [k, v] of b.items) {
          const top = y;
          ctx.font = `26px ${BODY}`; ctx.fillStyle = c.ink3; ctx.textAlign = 'left';
          if (draw) ctx.fillText(k, PAD, top + 30);
          ctx.font = `30px ${NUM}`; ctx.fillStyle = c.ink; ctx.textAlign = 'right';
          const lines = wrap(ctx, String(v), maxW - 220);
          let yy = top;
          for (const ln of lines) { yy += 30; if (draw) ctx.fillText(ln, W - PAD, yy); yy += 12; }
          y = Math.max(top + 46, yy + 4);
          if (draw) {
            ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
            ctx.setLineDash([]);
          }
          y += 20;
        }
        break;
      case 'tags': {
        const h = 52, gap = 12;
        ctx.font = `26px ${BODY}`; ctx.textAlign = 'left';
        let x = PAD;
        if (b.label) {
          ctx.fillStyle = c.ink3;
          if (draw) ctx.fillText(b.label, x, y + 36);
          x += ctx.measureText(b.label).width + 18;
        }
        for (const t of b.items) {
          const w = ctx.measureText(t).width + 40;
          if (x + w > W - PAD) { x = PAD; y += h + gap; }
          if (draw) {
            ctx.beginPath();
            // roundRect 在較舊的 Safari 沒有，退回直角
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2);
            else ctx.rect(x, y, w, h);
            if (b.solid) { ctx.fillStyle = c.inv; ctx.fill(); ctx.fillStyle = c.invInk; }
            else { ctx.strokeStyle = c.line; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = c.ink2; }
            ctx.font = `26px ${BODY}`;
            ctx.fillText(t, x + 20, y + 35);
          }
          x += w + gap;
        }
        y += h + 20;
        break;
      }
      case 'rule': y += 12; rule(); y += 12; break;
      case 'gap': y += b.h || 24; break;
    }
  }

  // 頁尾
  y += 28; rule(); y += 14;
  ctx.textAlign = 'left';
  ctx.font = `24px ${BODY}`; ctx.fillStyle = c.ink3;
  if (draw) ctx.fillText(doc.footer || '玄鑑 XUAN JIAN', PAD, y + 24);
  ctx.textAlign = 'right';
  if (draw) ctx.fillText(doc.date || '', W - PAD, y + 24);
  y += 34;
  ctx.textAlign = 'left';
  ctx.font = `22px ${BODY}`; ctx.fillStyle = c.ink3;
  if (draw) ctx.fillText(doc.note || '本機推算，僅供文化娛樂與自我探索參考', PAD, y + 24);
  y += PAD + 10;
  return y;
}

/** 畫出長圖，回傳 canvas */
export async function renderCard(doc, { theme } = {}) {
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* 字型沒載到就用系統字 */ } }
  const dark = theme ? theme === 'dark' : document.documentElement.dataset.theme === 'dark';
  const c = dark ? C.dark : C.light;
  const dpr = 2;

  const probe = document.createElement('canvas').getContext('2d');
  probe.canvas.width = W;
  const h = Math.ceil(run(probe, doc, c, false));

  const cv = document.createElement('canvas');
  cv.width = W * dpr;
  cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, h);
  ctx.textBaseline = 'alphabetic';
  run(ctx, doc, c, true);

  // 外框
  ctx.strokeStyle = c.line; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, h - 2);
  return cv;
}

const toBlob = (cv) => new Promise(r => cv.toBlob(r, 'image/png'));

/** 畫圖 → 有 Web Share 就分享，否則直接下載 */
export async function shareCard(doc, filename = '玄鑑.png', { theme } = {}) {
  const cv = await renderCard(doc, { theme });
  const blob = await toBlob(cv);
  if (!blob) throw new Error('無法產生圖片');
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: doc.blocks.find(b => b.t === 'title')?.text || '玄鑑' }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export const today = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
