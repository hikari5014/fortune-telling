/* 福幣錢包 —— 贊助者專用
   ──────────────────────────────────────────────────────────
   App 的所有功能都免費：拜拜、求籤、許願池投的是「一般硬幣」，不扣任何東西，也不用登入。
   福幣是贊助者的：贊助開發者之後，錢包裡有福幣，儀式裡可以改投金色的福幣
   （畫面有特效、紀錄跟著會員帳號走）。

   餘額的「正本」在雲端（Supabase，見 src/account.js），這裡的 store.wallet 只是快取，
   讓畫面不用每次都等網路。真正扣幣一律走伺服器端的函式 —— 手機裡的數字誰都改得動。
   目前儲值是示範（不扣款）；贊助費用 30 天內無條件退費，退費時那筆福幣一起收回。 */

import { store } from './store.js';

export const NAME = '福幣';
export const REFUND_DAYS = 30;
/** 贊助方案（示範）：price 是之後打算的新台幣價格，現在不扣款 */
export const PACKS = [
  { id: 'p30', coins: 30, price: 30, t: '一把福幣' },
  { id: 'p120', coins: 120, price: 100, t: '一袋福幣', bonus: '多送 20 枚' },
  { id: 'p400', coins: 400, price: 300, t: '一盒福幣', bonus: '多送 100 枚' },
];

/* 雲端同步的掛勾：登入後由 account.js 接上（沒登入時就只動本機快取） */
let remote = null;
export function setRemote(r) { remote = r; }

function save(w, entry) {
  const log = entry ? [{ at: new Date().toISOString(), ...entry }, ...w.log].slice(0, 60) : w.log;
  store.wallet = { ...w, log };
}

export const balance = () => store.wallet.coins;
/** 有福幣、或已經登入會員，就算贊助者 —— 畫面上才會出現錢包與「投福幣」的選項 */
export const isSponsor = () => balance() > 0 || !!store.wallet.member;

/** 雲端回來的正本覆蓋快取 */
export function syncFrom({ coins, member, log }) {
  const w = store.wallet;
  save({ ...w, coins, member: member ?? w.member, log: log ?? w.log });
}

/** 扣幣；不夠就不扣、回傳 false。登入時同時請伺服器扣（伺服器說不行就退回快取） */
export function spend(n, what) {
  const w = store.wallet;
  if (!(n > 0) || w.coins < n) return false;
  save({ ...w, coins: w.coins - n }, { d: -n, what });
  remote?.spend(n, what).then(r => {
    if (r && typeof r.coins === 'number') syncFrom({ coins: r.coins });
    else if (r && r.ok === false) remote?.resync();        // 伺服器說不夠：以雲端為準
  }).catch(() => {});
  return true;
}

/** 退回（例如福幣掉到池外） */
export function refund(n, what) {
  const w = store.wallet;
  save({ ...w, coins: w.coins + n }, { d: n, what });
  remote?.refund(n, what).then(r => { if (r && typeof r.coins === 'number') syncFrom({ coins: r.coins }); }).catch(() => {});
}

/** 贊助儲值（示範） */
export async function buy(packId) {
  const pack = PACKS.find(p => p.id === packId);
  if (!pack) return { ok: false, reason: 'no-pack' };
  if (remote) {
    const r = await remote.topUp(pack);
    if (r.ok) syncFrom({ coins: r.coins, member: true });
    return { ...r, coins: pack.coins };
  }
  return { ok: false, reason: 'login' };          // 福幣只存在會員帳戶裡，沒登入不能儲值
}

/** 0.41 版每天送的福幣是存在手機裡的；改成「福幣只給贊助者」之後，沒登入的本機餘額清掉 */
export function migrateLocal() {
  const w = store.wallet;
  if (!w.member && (w.coins || w.day)) store.wallet = { coins: 0, log: [] };
}
