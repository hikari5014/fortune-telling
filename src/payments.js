/* 付款的接口 —— 目前一律是「象徵性」的，不會扣任何錢
   ──────────────────────────────────────────────────────────
   香油錢、捐獻、神社的賽錢，在 App 裡都是儀式的一部分，金額只記在這台裝置上。

   之後要收真錢時，**名義是「打賞開發者」**（支持這個 App），不是「給神明」或「給廟」：
   ・錢會進開發者的帳戶，不會進任何一間廟 —— 寫成「香油錢」會誤導人，嚴重的話構成詐欺
   ・台灣對公眾募款要申請許可（公益勸募條例）；打賞是買賣／贈與，不是募款
   ・收真錢一定要有伺服器（金流商的回呼要驗證），會打破「全部在手機上」的設計，
     所以只在「打賞」那一個按鈕走網路，其他照舊離線

   接真錢的時候只要改 tip()：把 MODE 換成 'live'，接上金流（例如綠界、Stripe 的付款連結），
   其餘呼叫端不用動。offer() 永遠是象徵性的，不會變成真的扣款。 */

export const MODE = 'symbolic';            // 'symbolic' | 'live'（接上金流之後）

/** 儀式裡的奉獻（香油錢、賽錢、初穗料）：只記錄，永遠不扣款 */
export function offer({ amount, purpose, to }) {
  return Promise.resolve({ ok: true, symbolic: true, amount, purpose, to, at: new Date().toISOString() });
}

/** 打賞開發者：之後才會接真的金流。現在回傳 { ok:false, reason:'soon' } */
export function tip({ amount } = {}) {
  if (MODE !== 'live') return Promise.resolve({ ok: false, reason: 'soon', amount });
  // TODO（接金流時）：開啟金流商的付款頁，等回呼確認 —— 不要在前端自己宣告成功
  return Promise.resolve({ ok: false, reason: 'not-configured' });
}

export const isLive = () => MODE === 'live';
