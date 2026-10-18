/* 福幣與贊助的畫面
   ──────────────────────────────────────────────────────────
   ・一般人：儀式裡看不到錢包，投的就是一般硬幣（免費）
   ・贊助者：右上角有錢包；儀式裡多一個「一般硬幣／福幣」的切換，選福幣就投金色的
   ・錢包抽屜：會員登入（Google 或 Email 免密碼連結）、餘額、贊助方案、退費說明 */

import { html, raw, $, $$, sheet, toast, haptic } from './ui.js';
import { onStore, store } from './store.js';
import { balance, isSponsor, buy, PACKS, NAME, REFUND_DAYS } from './wallet.js';
import { account, signInGoogle, signInEmail, verifyEmailCode, signOut, configured } from './account.js';

/** 一枚福幣（金色、中央四芒星） */
export const coinIcon = (size = 18) => `<svg class="fu-coin" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10.5" fill="#c9962e"/><circle cx="12" cy="12" r="9.2" fill="#f1c968"/>
  <circle cx="12" cy="12" r="7" fill="none" stroke="#b9862a" stroke-width=".9"/>
  <path d="M12 6.6Q12.6 11.4 17.4 12Q12.6 12.6 12 17.4Q11.4 12.6 6.6 12Q11.4 11.4 12 6.6Z" fill="#b9862a"/></svg>`;

/** 錢包按鈕：只有贊助者看得到 */
export const walletChip = () => (isSponsor()
  ? html`<button class="fu-chip press" data-wallet aria-label="${NAME}錢包">${raw(coinIcon())}<b data-wallet-n>${balance()}</b></button>`
  : '');

/** 「投哪一種」的切換：只有錢包裡有福幣時才出現。預設一般硬幣 */
export const coinToggle = () => (balance() > 0 ? html`
  <div class="fu-mode" role="group" aria-label="投哪一種硬幣">
    <button class="fu-mode__b press" data-fumode="plain" aria-pressed="true">一般硬幣</button>
    <button class="fu-mode__b press" data-fumode="gold" aria-pressed="false">${raw(coinIcon(16))} ${NAME}・剩 <b data-wallet-n>${balance()}</b></button>
  </div>` : '');

/** 現在選的是不是福幣 */
export const goldMode = (root) => !!root.querySelector?.('[data-fumode="gold"][aria-pressed="true"]');

/** 贊助的入口（給一般人看的那一行小字連結） */
export const sponsorLink = (text = '喜歡這個 App？贊助開發者') => html`<button class="fu-link press" data-wallet>${raw(coinIcon(14))} ${text}</button>`;

/** 綁定錢包按鈕、福幣切換、餘額更新。回傳解除函式 */
export function bindWallet(root) {
  // 用委派：這些按鈕可能是之後才畫上去的（例如儀式進行到某一步才出現）
  root.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-wallet]')) { openWallet(); return; }
    const m = e.target.closest?.('[data-fumode]');
    if (m) {
      if (m.dataset.fumode === 'gold' && balance() < 1) { openWallet(`${NAME}用完了`); return; }
      $$('[data-fumode]', m.parentElement).forEach(b => b.setAttribute('aria-pressed', String(b === m)));
      haptic(6);
    }
  });
  const off = onStore((kind) => {
    if (kind !== 'wallet') return;
    $$('[data-wallet-n]', root).forEach(n => { n.textContent = balance(); });
    if (balance() < 1) $$('[data-fumode="plain"]', root).forEach(b => b.click());
    bump(root);
  });
  addEventListener('hashchange', function h() { off(); removeEventListener('hashchange', h); });
  return off;
}

function bump(root) {
  $$('[data-wallet]', root).forEach(b => { b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); });
}

/** 不夠就打開錢包、回傳 false */
export function ensure(n = 1) {
  if (balance() >= n) return true;
  openWallet(`${NAME}不夠了（需要 ${n} 枚）`);
  return false;
}

export function openWallet(note = '') {
  const w = store.wallet, a = account();
  const body = html`
    <div class="fu-sheet">
      ${note ? html`<p class="fu-note">${note}</p>` : ''}
      <p class="fu-lead">玄鑑的所有功能都<b>免費</b>。贊助是支持開發者繼續做下去；贊助者會拿到${NAME}，拜拜、許願時可以改投金色的${NAME}。</p>
      <div class="fu-acct" id="fu-acct">
        ${a.user ? html`
          <p>已登入：<b>${a.user.email || a.user.name || '會員'}</b></p>
          <button class="chip press" id="fu-out">登出</button>`
        : configured() ? html`
          <p>開通錢包要先登入會員（換手機、重裝 App 都不會不見）。</p>
          <div class="fu-login">
            <button class="btn btn--primary press" id="fu-google">用 Google 登入</button>
            <div class="row" style="gap:6px"><input class="input" id="fu-email" type="email" placeholder="或輸入 Email，免密碼登入" autocomplete="email">
            <button class="chip press" id="fu-mail">寄登入信</button></div>
            <div class="row" id="fu-codebox" style="gap:6px" hidden><input class="input" id="fu-code" inputmode="numeric" maxlength="6" placeholder="信裡的 6 位數驗證碼" autocomplete="one-time-code">
            <button class="chip press" id="fu-verify">登入</button></div>
          </div>`
        : html`<p class="hint">會員登入還沒開放；下面的示範儲值會先存在這台裝置上。</p>`}
      </div>
      <div class="fu-bal">${raw(coinIcon(40))}<b data-wallet-n>${w.coins}</b><small>枚${NAME}</small></div>
      <p class="fu-sec">贊助儲值</p>
      <div class="fu-packs">${PACKS.map(p => html`
        <button class="fu-pack press" data-pack="${p.id}">
          <span class="fu-pack__n">${raw(coinIcon(22))}${p.coins}</span>
          <b>${p.t}</b>${p.bonus ? html`<small>${p.bonus}</small>` : ''}
          <span class="fu-pack__p">NT$ ${p.price}</span>
        </button>`)}</div>
      <ul class="fu-terms">
        <li>目前是<b>示範</b>：按了就會加幣，不會扣款。</li>
        <li>開放後，所有贊助費用 <b>${REFUND_DAYS} 天內無條件退費</b>；退費時，那筆贊助換到的${NAME}會一起收回。</li>
        <li>錢是贊助開發者，不是給任何一間廟或神社。</li>
        <li>會員只存登入用的 Email 與${NAME}紀錄；生日、命盤、願望都只留在你的手機裡。</li>
      </ul>
      ${w.log.length ? html`<p class="fu-sec">最近</p><ul class="fu-log">${w.log.slice(0, 8).map(l => html`
        <li><span>${l.what}</span><b class="${l.d > 0 ? 'is-in' : ''}">${l.d > 0 ? '+' : ''}${l.d}</b></li>`)}</ul>` : ''}
    </div>`;
  sheet({
    title: '贊助與福幣', body,
    onMount(root, close) {
      $$('[data-pack]', root).forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        const r = await buy(b.dataset.pack);
        b.disabled = false;
        if (r.ok) {
          $$('[data-wallet-n]', root).forEach(n => { n.textContent = balance(); });
          haptic([8, 30, 8]);
          toast(`已加入 ${r.coins} 枚${NAME}（示範，未扣款）`);
        } else toast(r.reason === 'login' ? '請先登入會員' : '儲值還沒開放');
      }));
      $('#fu-google', root)?.addEventListener('click', async () => {
        const r = await signInGoogle();                 // 成功的話會直接跳到 Google，不會回到這裡
        if (!r.ok) toast(/not enabled|provider/i.test(r.error || '') ? 'Google 登入還在設定中，先用 Email 吧' : `登入失敗：${r.error}`);
      });
      $('#fu-mail', root)?.addEventListener('click', async () => {
        const email = $('#fu-email', root).value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Email 格式不對'); return; }
        const r = await signInEmail(email);
        if (r.ok) { $('#fu-codebox', root).hidden = false; toast('登入信已寄出：點信裡的連結，或輸入信裡的驗證碼'); }
        else toast(`寄不出去：${r.error || '請稍後再試'}`);
      });
      $('#fu-verify', root)?.addEventListener('click', async () => {
        const r = await verifyEmailCode($('#fu-email', root).value.trim(), $('#fu-code', root).value.trim());
        if (r.ok) { close(); toast('登入成功'); setTimeout(() => openWallet(), 400); } else toast(`驗證碼不對：${r.error || ''}`);
      });
      $('#fu-out', root)?.addEventListener('click', async () => { await signOut(); close(); toast('已登出'); });
    },
  });
}
