/* 神社的聲音 —— 全部用 Web Audio 當場合成，不放任何音檔。
   ──────────────────────────────────────────────────────────
   為什麼合成而不錄音：App 要離線、要輕，而且這幾種聲音的「質地」其實很單純：
   ・鈴（本坪鈴）：好幾個不成整數倍的高頻泛音，快速起音、長長地衰減，外加一點顫動
   ・拍手：一小段白噪音，過帶通濾波，幾十毫秒內衰減完
   ・投錢：金屬碰撞 = 兩三個很高的正弦波＋極短的噪音，再一聲落進木箱的悶響
   ・水：濾過的噪音，音量慢慢起伏
   ・籤棒在木箱裡：一串很短的低頻喀喀聲

   瀏覽器規定聲音要在使用者點過之後才能出，所以 AudioContext 等第一次呼叫才建。
   設定關掉、或瀏覽器不支援，一律安靜略過。 */

import { store } from '../store.js';

let ctx = null;
const on = () => store.settings.shrineSound !== false;

function ac() {
  if (!on()) return null;
  try {
    if (!ctx) {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

/** 一段白噪音 buffer（重複使用） */
let noiseBuf = null;
function noise(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function tone(c, { f, t = 0, dur = 1, gain = .2, type = 'sine', attack = .004, out }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = f;
  const t0 = c.currentTime + t;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out || c.destination);
  o.start(t0); o.stop(t0 + dur + .05);
}

function burst(c, { t = 0, dur = .08, gain = .5, f = 1200, q = 1, type = 'bandpass', out }) {
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(c);
  fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const t0 = c.currentTime + t;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl).connect(g).connect(out || c.destination);
  s.start(t0, Math.random()); s.stop(t0 + dur + .02);
}

/** 本坪鈴：一團搖響的金屬鈴，strength 0–1 */
export function suzu(strength = 1) {
  const c = ac(); if (!c) return;
  const master = c.createGain(); master.gain.value = .5 * strength; master.connect(c.destination);
  // 一個本坪鈴裡有好幾顆小鈴，每一下都差一點點
  for (let k = 0; k < 7; k++) {
    const t = k * (.045 + Math.random() * .03);
    const base = 1850 + Math.random() * 260;
    [1, 2.32, 3.86, 5.41].forEach((m, i) =>
      tone(c, { f: base * m, t, dur: 1.6 - i * .3, gain: (.16 / (i + 1)) * (1 - k * .08), out: master }));
  }
}

/** 拍手一聲 */
export function clap() {
  const c = ac(); if (!c) return;
  burst(c, { dur: .09, gain: .9, f: 1400, q: .7 });
  burst(c, { t: .008, dur: .14, gain: .35, f: 650, q: .5 });
}

/** 硬幣落進賽錢箱：先在擋板上叮一下，再咚一聲落到木頭 */
export function coinDrop(kind = 100) {
  const c = ac(); if (!c) return;
  const hi = kind >= 100 ? 4200 : kind >= 50 ? 3900 : 3300;     // 白銅比較亮、黃銅與銅比較悶
  tone(c, { f: hi, dur: .35, gain: .12 });
  tone(c, { f: hi * 1.47, dur: .25, gain: .06 });
  burst(c, { dur: .03, gain: .3, f: 6000, q: 2 });
  tone(c, { f: hi * .93, t: .14, dur: .2, gain: .07 });
  burst(c, { t: .3, dur: .12, gain: .5, f: 260, q: 1.2 });       // 落到箱底
  tone(c, { f: 140, t: .3, dur: .18, gain: .18 });
}

/** 一勺水倒下去（約 0.9 秒） */
export function water(dur = .9) {
  const c = ac(); if (!c) return;
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  s.buffer = noise(c); s.loop = true;
  fl.type = 'bandpass'; fl.frequency.value = 900; fl.Q.value = .8;
  lfo.frequency.value = 9; lg.gain.value = 400; lfo.connect(lg).connect(fl.frequency);
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(.35, t0 + .08);
  g.gain.setValueAtTime(.35, t0 + dur * .7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl).connect(g).connect(c.destination);
  s.start(t0); lfo.start(t0); s.stop(t0 + dur + .05); lfo.stop(t0 + dur + .05);
}

/** 籤棒在六角箱裡撞來撞去 */
export function rattle() {
  const c = ac(); if (!c) return;
  for (let i = 0; i < 6; i++) burst(c, { t: i * .035 + Math.random() * .02, dur: .03, gain: .4, f: 700 + Math.random() * 500, q: 3 });
}

/** 抽屜滑開、紙張、蓋章這類短短的一聲 */
export function knock(f = 220, gain = .4) {
  const c = ac(); if (!c) return;
  burst(c, { dur: .1, gain, f, q: 1.5 });
  tone(c, { f: f * .6, dur: .12, gain: gain * .4 });
}

export function paper() {
  const c = ac(); if (!c) return;
  for (let i = 0; i < 4; i++) burst(c, { t: i * .05, dur: .07, gain: .12, f: 3500 + Math.random() * 2000, q: .6, type: 'highpass' });
}

/* ── 許願池 ─────────────────────────────── */
/** 硬幣碰到石頭或月盞的邊：清脆的一聲「叮」，speed 越快越響 */
export function clink(speed = 3) {
  const c = ac(); if (!c) return;
  const g = Math.min(.16, .04 + speed * .02), f = 3600 + Math.random() * 900;
  tone(c, { f, dur: .3, gain: g });
  tone(c, { f: f * 1.51, dur: .18, gain: g * .5 });
  burst(c, { dur: .02, gain: .25, f: 7000, q: 2 });
}

/** 硬幣落水：先是很短的「噗」（往下滑的低音），再一點水花 */
export function plop(speed = 4) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(900, t0);
  o.frequency.exponentialRampToValueAtTime(260, t0 + .09);
  const a = Math.min(.35, .12 + speed * .03);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + .005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + .16);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + .2);
  burst(c, { t: .01, dur: .22, gain: .22, f: 1800, q: .7 });
  burst(c, { t: .06, dur: .3, gain: .1, f: 3200, q: 1.2 });
}

/** 投進月盞：一串往上走的鈴音，像星星亮起來 */
export function chime() {
  const c = ac(); if (!c) return;
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
    tone(c, { f, t: i * .09, dur: 1.6, gain: .09 });
    tone(c, { f: f * 2.01, t: i * .09, dur: .7, gain: .025 });
  });
}
