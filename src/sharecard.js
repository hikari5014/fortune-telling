/* 社群分享卡：把一次占卜／參拜的結果畫成一張 1080×1920 的直式圖（IG／脆／LINE 限時動態的尺寸）
   ──────────────────────────────────────────────────────────
   三種風格，同一份內容：
     star  星夜金箔 —— 深藍夜空、金框、月亮（跟 App 一樣）
     paper 宣紙朱印 —— 米色宣紙、直書、紅色印章
     mag   現代雜誌 —— 粉彩漸層、大數字、白色卡片

   內容（spec）跟功能無關，各頁只要組出這份描述：
     { kicker, label, title, big, badge, gist, ask, date, link, cta,
       hero: { type: 'poem', lines } | { type: 'cards', cards:[{img,name,rev,pos}] }
           | { type: 'hexagram', from:{name,lines,moving}, to:{name,lines} }
           | { type: 'signs', items:[[大字, 小字], …] } | { type: 'coin', text } }
   隱私：卡上不印姓名與生日；「所問的事」要使用者自己勾才會印。
   底部一定有 QR：掃了直接回到 App 的同一個功能 —— 這張圖本身就是邀請。 */

import { encode } from './qrcode.js';
import { wrap } from './share.js';

export const W = 1080, H = 1920;
export const STYLES = [
  { k: 'star', t: '星夜金箔' },
  { k: 'paper', t: '宣紙朱印' },
  { k: 'mag', t: '現代雜誌' },
];
export const MOTTO = '讓有煩惱的人，有近距離的依靠與解答';

const SERIF = '"Noto Serif TC","Songti TC","Noto Serif CJK TC",serif';
const SANS = '"Noto Sans TC",system-ui,sans-serif';
const LATIN = '"Space Grotesk","Noto Sans TC",sans-serif';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** 字型有載到才畫得漂亮：Google Fonts 是依字切片的，要先告訴瀏覽器會用到哪些字 */
async function fontsFor(spec) {
  if (!document.fonts?.load) return;
  const text = [spec.kicker, spec.label, spec.title, spec.big, spec.badge, spec.gist, spec.ask, spec.date, spec.cta, MOTTO,
    ...(spec.hero?.lines || []), ...(spec.hero?.items || []).flat(), ...(spec.hero?.cards || []).map(c => `${c.name}${c.pos || ''}逆位`),
    spec.hero?.from?.name, spec.hero?.to?.name, spec.hero?.text, '玄鑑掃描免費第首'].filter(Boolean).join('');
  const want = [`400 40px ${SERIF}`, `600 40px ${SERIF}`, `900 40px ${SERIF}`, `300 40px ${SANS}`, `500 40px ${SANS}`, `700 40px ${SANS}`, `700 40px ${LATIN}`];
  try { await Promise.all(want.map(f => document.fonts.load(f, text))); } catch { /* 載不到就用系統字 */ }
}

const font = (w, size, fam) => `${w} ${Math.round(size)}px ${fam}`;

/** 文字縮到放得下 */
function fitFont(ctx, text, maxW, w, size, fam, min = 18) {
  let s = size;
  ctx.font = font(w, s, fam);
  while (s > min && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = font(w, s, fam); }
  return s;
}

/** 置中多行文字，回傳畫完之後的 y */
function para(ctx, text, { x, y, maxW, size, lh = 1.75, w = 400, fam = SANS, color, align = 'center', maxLines = 4 }) {
  if (!text) return y;
  ctx.font = font(w, size, fam); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  let lines = wrap(ctx, text, maxW);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, '…'); }
  for (const l of lines) { y += size * lh; ctx.fillText(l, x, y); }
  return y;
}

/** 直書：每一行是一欄，從右往左排；回傳實際用掉的框 */
function vertical(ctx, lines, { cx, top, maxH, maxW, size, w = 600, fam = SERIF, color, gap = 1.5, shadow }) {
  const longest = Math.max(...lines.map(l => [...l].length));
  size = Math.min(size, maxH / (longest * 1.18), maxW / (lines.length * gap));
  const colW = size * gap, total = colW * (lines.length - 1);
  ctx.font = font(w, size, fam); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = size * 0.5; }
  lines.forEach((l, i) => {
    const x = cx + total / 2 - i * colW;
    [...l].forEach((ch, j) => ctx.fillText(ch, x, top + j * size * 1.18));
  });
  ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
  return { size, h: longest * size * 1.18 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** QR：永遠是淺底深碼（反相的碼不是每台手機都掃得出來） */
function qr(ctx, url, x, y, size, { dark = '#14152a', light = '#fbf6e8', radius = 18 } = {}) {
  const { modules, size: n } = encode(url, { ec: 'M' });
  const pad = size * 0.08, cell = (size - pad * 2) / n;
  ctx.fillStyle = light; roundRect(ctx, x, y, size, size, radius); ctx.fill();
  ctx.fillStyle = dark;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (modules[r][c]) ctx.fillRect(x + pad + c * cell, y + pad + r * cell, cell + 0.4, cell + 0.4);
}

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

/* ── 主角區：籤詩、牌、卦、星座、硬幣 ─────────────────── */
async function hero(ctx, h, box, th) {
  if (!h) return;
  const { x, y, w, h: bh } = box, cx = x + w / 2;
  if (h.type === 'poem') {
    // 先算字級，好讓整首詩在框裡上下置中
    const gap = th.poemGap || 1.55, longest = Math.max(...h.lines.map(l => [...l].length));
    const size = Math.min(th.poemSize || 92, bh / (longest * 1.18), w / (h.lines.length * gap));
    vertical(ctx, h.lines, { cx, top: y + (bh - longest * size * 1.18) / 2, maxH: bh, maxW: w, size, color: th.ink, w: 600, shadow: th.glow, gap });
    return;
  }
  if (h.type === 'cards') {
    const cards = h.cards.slice(0, 10);
    const per = cards.length <= 3 ? cards.length : cards.length <= 6 ? 3 : 5;
    const rows = Math.ceil(cards.length / per);
    const gapX = 26, labelH = cards.length <= 3 ? 96 : 64;
    const cw = Math.min((w - gapX * (per - 1)) / per, ((bh - labelH * rows - 20 * (rows - 1)) / rows) / 1.72);
    const chh = cw * 1.72;
    const imgs = await Promise.all(cards.map(c => (c.img ? loadImg(c.img) : null)));
    cards.forEach((c, i) => {
      const row = Math.floor(i / per), col = i % per, inRow = Math.min(per, cards.length - row * per);
      const rx = cx - (inRow * cw + (inRow - 1) * gapX) / 2 + col * (cw + gapX);
      const ry = y + (bh - rows * (chh + labelH) - (rows - 1) * 20) / 2 + row * (chh + labelH + 20);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
      roundRect(ctx, rx, ry, cw, chh, cw * 0.06); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.clip();
      if (imgs[i]) {
        ctx.translate(rx + cw / 2, ry + chh / 2); if (c.rev) ctx.rotate(Math.PI);
        ctx.drawImage(imgs[i], -cw / 2, -chh / 2, cw, chh);
      } else { ctx.fillStyle = th.accent; ctx.fillRect(rx, ry, cw, chh); }
      ctx.restore();
      ctx.strokeStyle = th.cardLine || 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; roundRect(ctx, rx, ry, cw, chh, cw * 0.06); ctx.stroke();
      const s = cards.length <= 3 ? 30 : 22;
      ctx.textAlign = 'center'; ctx.fillStyle = th.ink;
      fitFont(ctx, c.name, cw + gapX - 6, 600, s, SERIF, 14);
      ctx.fillText(c.name, rx + cw / 2, ry + chh + s * 1.4);
      ctx.font = font(400, s * 0.72, SANS); ctx.fillStyle = th.ink2;
      ctx.fillText([c.pos, c.rev ? '逆位' : '正位'].filter(Boolean).join('・'), rx + cw / 2, ry + chh + s * 2.55);
    });
    return;
  }
  if (h.type === 'hexagram') {
    const one = (hx, lines, moving = [], name, scale) => {
      const bw = 300 * scale, barH = 34 * scale, gap = 30 * scale, total = 6 * barH + 5 * gap;
      const top = y + (bh - total - 90 * scale) / 2;
      for (let i = 0; i < 6; i++) {                       // lines[0] 是最下面的初爻
        const yy = top + (5 - i) * (barH + gap);
        ctx.fillStyle = moving.includes(i) ? th.accent : th.ink;
        if (lines[i]) ctx.fillRect(hx - bw / 2, yy, bw, barH);
        else { ctx.fillRect(hx - bw / 2, yy, bw * 0.42, barH); ctx.fillRect(hx + bw * 0.08, yy, bw * 0.42, barH); }
        if (moving.includes(i)) { ctx.beginPath(); ctx.arc(hx + bw / 2 + 30 * scale, yy + barH / 2, 9 * scale, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.textAlign = 'center'; ctx.fillStyle = th.ink;
      fitFont(ctx, name, bw + 80, 600, 52 * scale, SERIF, 20);
      ctx.fillText(name, hx, top + total + 80 * scale);
    };
    if (h.to) {
      one(cx - w * 0.25, h.from.lines, h.from.moving, h.from.name, 0.8);
      ctx.fillStyle = th.ink2; ctx.font = font(400, 54, SANS); ctx.textAlign = 'center';
      ctx.fillText('→', cx, y + bh / 2 - 20);
      one(cx + w * 0.25, h.to.lines, [], h.to.name, 0.8);
    } else one(cx, h.from.lines, h.from.moving, h.from.name, 1);
    return;
  }
  if (h.type === 'signs') {
    const n = h.items.length, cw = w / n;
    h.items.forEach(([big, small], i) => {
      const xx = x + cw * (i + 0.5);
      ctx.textAlign = 'center'; ctx.fillStyle = th.ink;
      fitFont(ctx, big, cw - 20, 900, 96, SERIF, 30);
      ctx.fillText(big, xx, y + bh / 2);
      ctx.font = font(400, 30, SANS); ctx.fillStyle = th.ink2;
      ctx.fillText(small, xx, y + bh / 2 + 64);
    });
    return;
  }
  if (h.type === 'image') {                          // 例如御朱印（SVG 字串轉成圖）
    const img = await loadImg(h.src);
    if (!img) return;
    const ratio = h.ratio || (img.naturalHeight / img.naturalWidth) || 1.4;
    const ih = Math.min(bh, w * 0.7 * ratio), iw = ih / ratio;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    ctx.drawImage(img, cx - iw / 2, y + (bh - ih) / 2, iw, ih); ctx.restore();
    return;
  }
  if (h.type === 'goshuin') {                        // 御朱印：白紙、墨書三行、兩顆朱印
    const gh = Math.min(bh, w * 0.95), gw = gh * 0.66, gx = cx - gw / 2, gy = y + (bh - gh) / 2;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#fbf7ee'; ctx.fillRect(gx, gy, gw, gh); ctx.restore();
    const shu = '#c0392b';
    ctx.strokeStyle = shu; ctx.lineWidth = 6; ctx.strokeRect(cx - gw * 0.2, gy + gh * 0.3, gw * 0.4, gw * 0.4);
    ctx.fillStyle = shu; ctx.font = font(900, gw * 0.13, SERIF); ctx.textAlign = 'center';
    ctx.fillText('星宮', cx, gy + gh * 0.3 + gw * 0.17); ctx.fillText('之印', cx, gy + gh * 0.3 + gw * 0.34);
    ctx.beginPath(); ctx.arc(cx, gy + gh * 0.78, gw * 0.13, 0, Math.PI * 2); ctx.lineWidth = 5; ctx.stroke();
    vertical(ctx, ['奉拜'], { cx: gx + gw * 0.82, top: gy + gh * 0.08, maxH: gh * 0.3, maxW: gw * 0.2, size: gw * 0.11, w: 600, color: '#1a1410' });
    vertical(ctx, ['星宮神社'], { cx, top: gy + gh * 0.08, maxH: gh * 0.8, maxW: gw * 0.3, size: gw * 0.2, w: 900, color: '#1a1410' });
    vertical(ctx, [h.date], { cx: gx + gw * 0.18, top: gy + gh * 0.3, maxH: gh * 0.65, maxW: gw * 0.2, size: gw * 0.075, w: 600, color: '#1a1410' });
    return;
  }
  if (h.type === 'tablet') {                         // 神主牌：紅底金框、直書神明名
    const chars = [...h.text], tw = Math.min(200, w * 0.3), th2 = Math.min(bh * 0.92, chars.length * tw * 0.62 + tw * 0.9);
    const tx = cx - tw / 2, ty = y + (bh - th2) / 2;
    const glow = ctx.createRadialGradient(cx, y + bh / 2, 0, cx, y + bh / 2, bh * 0.6);
    glow.addColorStop(0, 'rgba(255,214,140,.35)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = glow; ctx.fillRect(x, y, w, bh);
    const rg = ctx.createLinearGradient(tx, 0, tx + tw, 0); rg.addColorStop(0, '#7e1610'); rg.addColorStop(.5, '#b8281e'); rg.addColorStop(1, '#7e1610');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(tx, ty + tw / 2); ctx.arc(cx, ty + tw / 2, tw / 2, Math.PI, 0); ctx.lineTo(tx + tw, ty + th2); ctx.lineTo(tx, ty + th2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e3b45a'; ctx.lineWidth = 6; ctx.stroke();
    vertical(ctx, [h.text], { cx, top: ty + tw * 0.45, maxH: th2 - tw * 0.6, maxW: tw, size: tw * 0.52, w: 900, color: '#f6d98c' });
    return;
  }
  if (h.type === 'coin') {
    const r = Math.min(w, bh) * 0.3, cy = y + bh * 0.42;
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4);
    g.addColorStop(0, 'rgba(255,214,120,.45)'); g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2); ctx.fill();
    const cg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    cg.addColorStop(0, '#fff0c0'); cg.addColorStop(.5, h.gold === false ? '#cfd5e2' : '#f1c968'); cg.addColorStop(1, h.gold === false ? '#8a90a2' : '#b9862a');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,20,.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(150,100,24,.65)';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * 0.16 : r * 0.5; ctx[i ? 'lineTo' : 'moveTo'](cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
    ctx.closePath(); ctx.fill();
    if (h.text) { ctx.textAlign = 'center'; ctx.fillStyle = th.ink; fitFont(ctx, h.text, w, 900, 72, SERIF, 30); ctx.fillText(h.text, cx, cy + r + 130); }
  }
}

/* ── 三種風格 ─────────────────────────────────────── */
async function drawStar(ctx, s) {
  const bg = ctx.createRadialGradient(W / 2, 0, 100, W / 2, 200, H * 1.1);
  bg.addColorStop(0, '#2a3270'); bg.addColorStop(.45, '#0f1433'); bg.addColorStop(1, '#06081a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const R = rng(7);
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,243,207,${0.2 + R() * 0.6})`; ctx.beginPath(); ctx.arc(R() * W, R() * H * 0.75, R() < 0.1 ? 3 : 1.6, 0, Math.PI * 2); ctx.fill(); }
  const mg = ctx.createRadialGradient(880, 250, 40, 880, 250, 260);
  mg.addColorStop(0, 'rgba(255,230,170,.35)'); mg.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.fillStyle = mg; ctx.fillRect(600, 0, 480, 520);
  ctx.fillStyle = '#f6ecd0'; ctx.beginPath(); ctx.arc(880, 250, 62, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(227,180,90,.75)'; ctx.lineWidth = 3; roundRect(ctx, 52, 52, W - 104, H - 104, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(227,180,90,.35)'; ctx.lineWidth = 2; roundRect(ctx, 70, 70, W - 140, H - 140, 6); ctx.stroke();
  ctx.font = font(500, 28, SANS); ctx.fillStyle = '#e3b45a'; ctx.textAlign = 'left';
  ctx.fillText('XUAN JIAN · 玄鑑', 120, 160);
  const th = { ink: '#fbefcf', ink2: '#d9ccaa', accent: '#e3b45a', glow: 'rgba(255,214,120,.45)', cardLine: 'rgba(227,180,90,.6)' };
  ctx.textAlign = 'center';
  let y = 380;
  if (s.label) { ctx.fillStyle = '#d6c69c'; fitFont(ctx, s.label, 800, 400, 38, SERIF); ctx.fillText(s.label, W / 2, y); }
  y += 140;
  if (s.title) {
    const tg = ctx.createLinearGradient(0, y - 110, 0, y);
    tg.addColorStop(0, '#fff2c8'); tg.addColorStop(1, '#d9a441');
    ctx.fillStyle = tg; fitFont(ctx, s.title, 820, 900, 112, SERIF); ctx.fillText(s.title, W / 2, y);
  }
  let heroTop = y + 70;
  if (s.badge) {
    const by = y + 120;
    ctx.save(); ctx.shadowColor = 'rgba(227,180,90,.6)'; ctx.shadowBlur = 40;
    ctx.strokeStyle = '#e3b45a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(W / 2, by, 74, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#f1d58f'; fitFont(ctx, s.badge, 120, 900, 72, SERIF, 30); ctx.textBaseline = 'middle'; ctx.fillText(s.badge, W / 2, by + 4); ctx.textBaseline = 'alphabetic';
    heroTop = by + 130;
  }
  await hero(ctx, s.hero, { x: 130, y: heroTop, w: W - 260, h: 1430 - heroTop }, th);
  let gy = para(ctx, s.gist, { x: W / 2, y: 1440, maxW: 820, size: 36, color: '#e4d8b6', w: 300, maxLines: 3 });
  para(ctx, [s.ask, s.date].filter(Boolean).join('　·　'), { x: W / 2, y: gy + 6, maxW: 820, size: 28, color: '#b7aa86', maxLines: 2 });
  ctx.strokeStyle = 'rgba(227,180,90,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(120, 1660); ctx.lineTo(W - 120, 1660); ctx.stroke();
  qr(ctx, s.link, 120, 1690, 150, { dark: '#0f1433', light: '#f6ecd0' });
  ctx.textAlign = 'left'; ctx.fillStyle = '#f1d58f'; ctx.font = font(700, 36, SANS); ctx.fillText(s.cta || '掃描，免費試試看', 300, 1752);
  ctx.fillStyle = '#cdbb92'; ctx.font = font(400, 26, SANS); ctx.fillText(`玄鑑 —— ${MOTTO}`, 300, 1802);
}

async function drawPaper(ctx, s) {
  ctx.fillStyle = '#efe4cc'; ctx.fillRect(0, 0, W, H);
  const R = rng(3);
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(120,90,50,${R() * 0.05})`; ctx.fillRect(R() * W, R() * H, 1 + R() * 3, 1); }
  for (let i = 0; i < 40; i++) { ctx.strokeStyle = `rgba(150,115,70,${0.03 + R() * 0.05})`; ctx.lineWidth = 1; ctx.beginPath(); const x = R() * W, y = R() * H; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + R() * 80, y + R() * 40, x + R() * 160, y + R() * 20); ctx.stroke(); }
  const hl = ctx.createRadialGradient(200, 200, 0, 200, 200, 900); hl.addColorStop(0, 'rgba(255,255,255,.5)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(0, 0, W, H);
  const ink = ctx.createRadialGradient(260, H + 40, 0, 260, H + 40, 700); ink.addColorStop(0, 'rgba(40,30,20,.22)'); ink.addColorStop(1, 'rgba(40,30,20,0)');
  ctx.fillStyle = ink; ctx.fillRect(0, H - 700, W, 700);
  ctx.textAlign = 'left'; ctx.fillStyle = '#6b5236'; ctx.font = font(400, 30, SERIF);
  ctx.fillText(`玄鑑　${s.kicker || ''}`, 110, 150);
  // 印章：玄鑑
  ctx.save(); ctx.translate(900, 150); ctx.rotate(-0.07);
  ctx.fillStyle = '#b8322a'; roundRect(ctx, -70, -70, 140, 140, 8); ctx.fill();
  ctx.strokeStyle = '#f1d9c8'; ctx.lineWidth = 4; roundRect(ctx, -58, -58, 116, 116, 4); ctx.stroke();
  ctx.fillStyle = '#f7e6d6'; ctx.font = font(900, 50, SERIF); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('玄', -24, 0); ctx.fillText('鑑', 26, 0); ctx.restore(); ctx.textBaseline = 'alphabetic';
  const th = { ink: '#22180f', ink2: '#5a4630', accent: '#b8322a', cardLine: 'rgba(60,40,20,.35)', poemSize: 104, poemGap: 1.7 };
  if (s.hero?.type === 'poem' && s.title) {
    vertical(ctx, [s.title], { cx: 900, top: 300, maxH: 900, maxW: 140, size: 88, w: 900, color: '#22180f' });
    await hero(ctx, s.hero, { x: 120, y: 320, w: 660, h: 880 }, th);
  } else {
    ctx.textAlign = 'center'; ctx.fillStyle = '#22180f';
    if (s.label) { fitFont(ctx, s.label, 760, 400, 36, SERIF); ctx.fillStyle = '#6b5236'; ctx.fillText(s.label, W / 2, 330); }
    if (s.title) { ctx.fillStyle = '#22180f'; fitFont(ctx, s.title, 820, 900, 96, SERIF); ctx.fillText(s.title, W / 2, 450); }
    await hero(ctx, s.hero, { x: 120, y: 510, w: W - 240, h: 740 }, th);
  }
  if (s.badge) {
    ctx.save(); ctx.translate(250, 1380); ctx.rotate(-0.17); ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#b8322a'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, 118, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#b8322a'; fitFont(ctx, s.badge, 190, 900, 120, SERIF, 40); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.badge, 0, 6);
    ctx.restore(); ctx.textBaseline = 'alphabetic';
  }
  const gx = s.badge ? 420 : 120, gw = W - gx - 110;
  let gy = para(ctx, [s.hero?.type === 'poem' ? s.label : '', s.gist].filter(Boolean).join('。'), { x: gx, y: 1280, maxW: gw, size: 34, color: '#3d2e1f', align: 'left', maxLines: 5 });
  para(ctx, [s.ask, s.date].filter(Boolean).join('　·　'), { x: gx, y: gy + 6, maxW: gw, size: 28, color: '#6b5236', align: 'left', maxLines: 2 });
  qr(ctx, s.link, 110, 1660, 150, { dark: '#2a1f14', light: 'rgba(255,250,238,.85)', radius: 10 });
  ctx.textAlign = 'left'; ctx.fillStyle = '#22180f'; ctx.font = font(700, 36, SANS); ctx.fillText(s.cta || '掃描，免費試試看', 290, 1722);
  ctx.fillStyle = '#6b5236'; ctx.font = font(400, 26, SANS); ctx.fillText(MOTTO, 290, 1772);
}

async function drawMag(ctx, s) {
  const bg = ctx.createLinearGradient(0, 0, W * 0.6, H);
  bg.addColorStop(0, '#e9e3ff'); bg.addColorStop(.55, '#ffe6d6'); bg.addColorStop(1, '#ffd9e4');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const blob = ctx.createRadialGradient(900, 300, 0, 900, 300, 500); blob.addColorStop(0, 'rgba(255,255,255,.55)'); blob.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = blob; ctx.fillRect(400, 0, 680, 800);
  ctx.fillStyle = '#1b1b2f'; ctx.textAlign = 'left'; ctx.font = font(700, 28, LATIN); ctx.fillText('XUAN JIAN', 100, 130);
  ctx.textAlign = 'right'; ctx.globalAlpha = 0.6; ctx.font = font(500, 26, LATIN); ctx.fillText(s.date || '', W - 100, 130); ctx.globalAlpha = 1;
  const big = s.big || s.badge || (s.title || '')[0] || '';
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(27,27,47,.92)';
  const latin = /^[0-9A-Za-z]+$/.test(big);
  fitFont(ctx, big, 600, latin ? 700 : 900, latin ? 440 : 320, latin ? LATIN : SERIF, 120);
  ctx.fillText(big, 80, 600);
  ctx.textAlign = 'right';
  ctx.globalAlpha = 0.6; ctx.font = font(500, 26, SANS); ctx.fillText(s.kicker || '', W - 100, 290); ctx.globalAlpha = 1;
  ctx.fillStyle = '#1b1b2f'; fitFont(ctx, s.title || '', 420, 700, 58, SANS, 28); ctx.fillText(s.title || '', W - 100, 370);
  if (s.badge && s.badge !== big) {
    ctx.font = font(700, 40, SANS); const bw = ctx.measureText(s.badge).width + 72;
    ctx.fillStyle = '#1b1b2f'; roundRect(ctx, W - 100 - bw, 410, bw, 76, 38); ctx.fill();
    ctx.fillStyle = '#ffe6d6'; ctx.textAlign = 'center'; ctx.fillText(s.badge, W - 100 - bw / 2, 462);
  }
  // 白色卡片
  ctx.save(); ctx.shadowColor = 'rgba(80,60,120,.18)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
  ctx.fillStyle = 'rgba(255,255,255,.78)'; roundRect(ctx, 72, 700, W - 144, 900, 56); ctx.fill(); ctx.restore();
  const th = { ink: '#1b1b2f', ink2: '#5b5b75', accent: '#e0607e', cardLine: 'rgba(27,27,47,.15)', poemSize: 80 };
  if (s.label && s.hero?.type !== 'poem') { ctx.textAlign = 'center'; ctx.fillStyle = '#5b5b75'; fitFont(ctx, s.label, 820, 500, 32, SANS); ctx.fillText(s.label, W / 2, 790); }
  await hero(ctx, s.hero, { x: 130, y: s.hero?.type === 'poem' ? 770 : 830, w: W - 260, h: 560 }, th);
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(27,27,47,.5)'; ctx.font = font(700, 22, SANS); ctx.fillText('白 話', 130, 1430);
  let gy = para(ctx, s.gist, { x: 130, y: 1430, maxW: W - 260, size: 34, color: '#2d2d45', align: 'left', maxLines: 3 });
  if (s.ask) para(ctx, s.ask, { x: 130, y: gy, maxW: W - 260, size: 28, color: '#5b5b75', align: 'left', maxLines: 1 });
  qr(ctx, s.link, 100, 1660, 150, { dark: '#1b1b2f', light: '#ffffff', radius: 24 });
  ctx.textAlign = 'left'; ctx.fillStyle = '#1b1b2f'; ctx.font = font(700, 36, SANS); ctx.fillText(s.cta || '掃描，免費試試看', 280, 1722);
  ctx.fillStyle = '#3b3b55'; ctx.font = font(400, 26, SANS); ctx.fillText(`玄鑑 —— ${MOTTO}`, 280, 1772);
}

const DRAW = { star: drawStar, paper: drawPaper, mag: drawMag };

/** 畫好一張分享卡，回傳 canvas（實際像素 1080×1920） */
export async function renderShare(spec, style = 'star') {
  await fontsFor(spec);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  await (DRAW[style] || drawStar)(ctx, { link: 'https://hikari5014.github.io/fortune-telling/', ...spec });
  return cv;
}

export const today = () => { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
