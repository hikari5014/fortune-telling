/* 會員（只給贊助者）—— Supabase 登入與雲端錢包
   ──────────────────────────────────────────────────────────
   一般使用完全不碰這支：不登入就不載入任何雲端程式、不連網。
   只有按了「登入」、或之前登入過（本機留著登入狀態）時，才從 CDN 載入 supabase-js。

   雲端只存兩樣東西：登入用的 Email（Supabase 的會員表）與福幣流水帳。
   生日、命盤、願望、功德簿……一律留在手機裡。

   安全：資料表只開放「讀自己的」；加減福幣全部走資料庫裡的函式（wallet_spend 等），
   前端改不了餘額。下面這把 key 是公開用的（publishable / anon），本來就會出現在前端。

   登入方式：Google、Email 免密碼連結（也可以輸入信裡的 6 位數驗證碼 ——
   iPhone 從主畫面開的 App 跟 Safari 是分開的，點信裡的連結會開在 Safari，輸入驗證碼最穩）。
   用 PKCE 流程：回來的網址是 ?code=…，不會跟我們用 # 做的頁面路由打架。 */

import { store } from './store.js';
import { setRemote, syncFrom } from './wallet.js';

const URL_ = 'https://qagobzzvltufqyitlolv.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZ29ienp2bHR1ZnF5aXRsb2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMTU1NjcsImV4cCI6MjEwNzg5MTU2N30.O3ywk4w4HiAuh6ju-5HMYZGH12nu-eZCu5StJdxW6vA';
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const AUTH_KEY = 'xj.auth';
const RETURN_KEY = 'xj.authReturn';

let client = null;
const state = { user: null };

export const configured = () => true;
export const account = () => state;

/** 登入回來要回到哪一頁（網址只能帶 ?code=，不能帶 #/頁面） */
const home = () => location.origin + location.pathname;

async function sb() {
  if (client) return client;
  const { createClient } = await import(/* @vite-ignore */ CDN);
  client = createClient(URL_, KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_KEY },
  });
  client.auth.onAuthStateChange((_ev, session) => { setUser(session?.user || null); });
  return client;
}

function setUser(u) {
  const was = state.user?.id;
  state.user = u ? { id: u.id, email: u.email, name: u.user_metadata?.full_name || u.user_metadata?.name || '' } : null;
  if (state.user) {
    setRemote(remote);
    if (was !== state.user.id) refreshWallet();
  } else {
    setRemote(null);
    if (store.wallet.member) store.wallet = { coins: 0, log: [], member: false };
  }
}

async function rpc(fn, args = {}) {
  const c = await sb();
  const { data, error } = await c.rpc(fn, args);
  if (error) throw error;
  return data;
}

export async function refreshWallet() {
  try {
    const r = await rpc('wallet_get');
    syncFrom({ coins: r.coins, member: true, log: (r.log || []).map(l => ({ d: l.d, what: l.what, at: l.at })) });
  } catch { /* 沒網路就先用快取 */ }
}

const remote = {
  resync: () => refreshWallet(),
  spend: (n, what) => rpc('wallet_spend', { n, what }),
  refund: (_n, what) => rpc('wallet_return', { what }),
  topUp: async (pack) => {
    const r = await rpc('wallet_demo_topup', { pack: pack.id });
    return r.ok ? { ok: true, symbolic: true, coins: r.coins } : { ok: false, reason: r.reason };
  },
};

/** App 啟動時呼叫：之前登入過、或剛從登入頁回來，才載入雲端 */
export async function initAccount() {
  const back = /[?&]code=/.test(location.search) || /[?&]error_description=/.test(location.search);
  let had = false;
  try { had = !!localStorage.getItem(AUTH_KEY); } catch { /* 無痕模式 */ }
  if (!back && !had) return;
  try {
    const c = await sb();
    const { data } = await c.auth.getSession();
    setUser(data.session?.user || null);
  } catch { /* 離線：維持快取 */ }
  if (back) {
    let to = '#/';
    try { to = localStorage.getItem(RETURN_KEY) || '#/'; localStorage.removeItem(RETURN_KEY); } catch {}
    history.replaceState(null, '', home() + to);
    dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

const remember = () => { try { localStorage.setItem(RETURN_KEY, location.hash || '#/'); } catch {} };

export async function signInGoogle() {
  remember();
  const c = await sb();
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: home() } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signInEmail(email) {
  remember();
  try {
    const c = await sb();
    const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: home(), shouldCreateUser: true } });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

/** 信裡的 6 位數驗證碼 */
export async function verifyEmailCode(email, token) {
  try {
    const c = await sb();
    const { data, error } = await c.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return { ok: false, error: error.message };
    setUser(data.user);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function signOut() {
  try { const c = await sb(); await c.auth.signOut(); } catch { /* 離線也照樣清掉本機 */ }
  setUser(null);
}
