/* 分享連結與系統分享
   ──────────────────────────────────────────────────────────
   「跟 App 連結」這件事要先講清楚：沒有伺服器就沒有帳號、沒有即時同步。
   這裡做的是「邀請連結」—— 對方點開連結，資料直接帶進他的 App。
   實質效果跟你想的一樣，但它不是連線，兩台裝置之間從頭到尾沒有通訊。

   QR 的內容刻意做成「網址」而不是純分享碼：
   iOS Safari 沒有 BarcodeDetector，自己寫掃描器在 iPhone 上跑不動；
   但 iPhone 內建相機本來就會讀 QR 並開啟網址 —— 對方連 App 都不用先裝。 */

/** App 自己的網址（去掉 hash 與 query） */
export function appUrl(loc = (typeof location !== 'undefined' ? location : null)) {
  if (!loc) return 'https://hikari5014.github.io/fortune-telling/';
  return loc.origin + loc.pathname;
}

/** 把分享碼包成一條可以點的連結 */
export function profileLink(code, loc) {
  return `${appUrl(loc)}#/profile?c=${encodeURIComponent(code)}`;
}

/** 從連結或一整段訊息裡把分享碼挖出來（挖不到回傳 null） */
export function linkCode(text) {
  const s = String(text || '');
  const m = s.match(/[#?&]c=([^&\s"'<>]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

/** 這台裝置有沒有系統分享（iOS / Android 幾乎都有，桌機看瀏覽器） */
export const canSystemShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * 叫出系統分享面板（LINE、訊息、Messenger…由系統列出）。
 * 沒有就回傳 false，讓呼叫端退回「複製連結」。
 * 使用者自己按取消不算失敗，一樣回傳 true。
 */
export async function systemShare({ title, text, url } = {}) {
  if (!canSystemShare()) return false;
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch (e) {
    // AbortError＝使用者自己關掉面板，不要再跳一次提示
    if (e && e.name === 'AbortError') return true;
    return false;
  }
}

/** 沒有系統分享時的備援：幾個聊天 App 自己的分享網址 */
export function chatLinks({ text = '', url = '' } = {}) {
  const u = encodeURIComponent(url), t = encodeURIComponent(text);
  const both = encodeURIComponent(`${text}\n${url}`);
  return [
    { name: 'LINE', href: `https://social-plugins.line.me/lineit/share?url=${u}&text=${t}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { name: 'WhatsApp', href: `https://wa.me/?text=${both}` },
    { name: '電子郵件', href: `mailto:?subject=${t}&body=${both}` },
  ];
}
