/* 福幣錢包的畫面：右上角的小錢包、點開的抽屜、每日福幣的提示 */

import { html, raw, $, $$, sheet, toast, haptic } from './ui.js';
import { onStore } from './store.js';
import { balance, claimDaily, buy, PACKS, DAILY, NAME } from './wallet.js';
import { store } from './store.js';

/** 一枚福幣（金色、中央四芒星） */
export const coinIcon = (size = 18) => `<svg class="fu-coin" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10.5" fill="#c9962e"/><circle cx="12" cy="12" r="9.2" fill="#f1c968"/>
  <circle cx="12" cy="12" r="7" fill="none" stroke="#b9862a" stroke-width=".9"/>
  <path d="M12 6.6Q12.6 11.4 17.4 12Q12.6 12.6 12 17.4Q11.4 12.6 6.6 12Q11.4 11.4 12 6.6Z" fill="#b9862a"/></svg>`;

/** 放在頁面上的錢包按鈕 */
export const walletChip = () => html`<button class="fu-chip press" data-wallet aria-label="${NAME}錢包">${raw(coinIcon())}<b data-wallet-n>${balance()}</b></button>`;

/** 綁定頁面上所有錢包按鈕，並發今天的福幣。回傳解除函式 */
export function bindWallet(root) {
  // 用委派：錢包按鈕可能是之後才畫上去的（例如儀式進行到某一步才出現）
  root.addEventListener('click', (e) => { if (e.target.closest?.('[data-wallet]')) openWallet(); });
  const off = onStore((kind) => {
    if (kind !== 'wallet') return;
    $$('[data-wallet-n]', root).forEach(n => { n.textContent = balance(); });
    bump(root);
  });
  const got = claimDaily();
  if (got) setTimeout(() => toast(`今天的 ${got} 枚${NAME}到了`), 600);
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
  const w = store.wallet;
  const body = html`
    <div class="fu-sheet">
      ${note ? html`<p class="fu-note">${note}</p>` : ''}
      <div class="fu-bal">${raw(coinIcon(40))}<b data-wallet-n>${w.coins}</b><small>枚${NAME}</small></div>
      <p class="hint" style="text-align:center">許願池投一枚、廟裡添香油錢、神社的賽錢都用${NAME}。每天打開會送 ${DAILY} 枚。</p>
      <p class="fu-sec">贊助儲值</p>
      <div class="fu-packs">${PACKS.map(p => html`
        <button class="fu-pack press" data-pack="${p.id}">
          <span class="fu-pack__n">${raw(coinIcon(22))}${p.coins}</span>
          <b>${p.t}</b>${p.bonus ? html`<small>${p.bonus}</small>` : ''}
          <span class="fu-pack__p">NT$ ${p.price}</span>
        </button>`)}</div>
      <p class="hint">目前是<b>示範</b>：按了就會加幣，不會扣款。之後開放時，這裡的錢是贊助開發者，不是給任何一間廟或神社。</p>
      ${w.log.length ? html`<p class="fu-sec">最近</p><ul class="fu-log">${w.log.slice(0, 8).map(l => html`
        <li><span>${l.what}</span><b class="${l.d > 0 ? 'is-in' : ''}">${l.d > 0 ? '+' : ''}${l.d}</b></li>`)}</ul>` : ''}
    </div>`;
  sheet({
    title: `${NAME}錢包`, body,
    onMount(root) {
      $$('[data-pack]', root).forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        const r = await buy(b.dataset.pack);
        b.disabled = false;
        if (r.ok) {
          $$('[data-wallet-n]', root).forEach(n => { n.textContent = balance(); });
          haptic([8, 30, 8]);
          toast(`已加入 ${r.coins} 枚${NAME}（示範，未扣款）`);
        } else toast('儲值還沒開放');
      }));
    },
  });
}
