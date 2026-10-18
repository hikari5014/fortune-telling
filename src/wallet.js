/* 福幣錢包 —— 全 App 共用
   ──────────────────────────────────────────────────────────
   許願池投一枚、廟裡添香油錢、神社的賽錢與初穗料，都從這裡扣。
   每天第一次用到時送 DAILY 枚；用完可以「贊助儲值」。

   現在全部是假的：儲值按了就加，不會扣款（見 src/payments.js 的 topUp）。
   之後若要收真錢，名義一樣是贊助開發者，餘額也得搬到伺服器上 ——
   放在手機裡的數字誰都改得動，收了錢就不能這樣。 */

import { store } from './store.js';
import { topUp } from './payments.js';

export const DAILY = 6;
export const NAME = '福幣';
/** 贊助方案（示範）：price 是之後打算的新台幣價格，現在不扣款 */
export const PACKS = [
  { id: 'p30', coins: 30, price: 30, t: '一把福幣' },
  { id: 'p120', coins: 120, price: 100, t: '一袋福幣', bonus: '多送 20 枚' },
  { id: 'p400', coins: 400, price: 300, t: '一盒福幣', bonus: '多送 100 枚' },
];

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function save(w, entry) {
  const log = entry ? [{ at: new Date().toISOString(), ...entry }, ...w.log].slice(0, 60) : w.log;
  store.wallet = { ...w, log };
}

export const balance = () => store.wallet.coins;

/** 今天的免費福幣：一天一次，回傳這次給了幾枚（已經領過就是 0） */
export function claimDaily(day = dayKey()) {
  const w = store.wallet;
  if (w.day === day) return 0;
  save({ ...w, coins: w.coins + DAILY, day }, { d: DAILY, what: '每日福幣' });
  return DAILY;
}

/** 扣幣；不夠就不扣、回傳 false */
export function spend(n, what) {
  const w = store.wallet;
  if (!(n > 0) || w.coins < n) return false;
  save({ ...w, coins: w.coins - n }, { d: -n, what });
  return true;
}

/** 退回（例如硬幣掉到池外） */
export function refund(n, what) {
  const w = store.wallet;
  save({ ...w, coins: w.coins + n }, { d: n, what });
}

/** 贊助儲值（示範） */
export async function buy(packId) {
  const pack = PACKS.find(p => p.id === packId);
  if (!pack) return { ok: false, reason: 'no-pack' };
  const r = await topUp({ pack });
  if (r.ok) { const w = store.wallet; save({ ...w, coins: w.coins + pack.coins }, { d: pack.coins, what: `贊助儲值・${pack.t}（示範）` }); }
  return r;
}
