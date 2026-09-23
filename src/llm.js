/* 外部 LLM 的跳轉
   ──────────────────────────────────────────────────────────
   使用者問的是：能不能「複製完自動打開 Gemini／ChatGPT，並且直接貼進對話框」。
   查過之後的實際狀況（2026-09）是一半一半，這裡把界線寫清楚，
   免得以後有人以為是程式沒寫好：

   ・**網址帶得了提示詞的**：ChatGPT（`?q=`）、Claude（`?q=`）、Perplexity（`?q=`）。
     在**瀏覽器**裡開會直接落進輸入框。
   ・**帶不了的**：Gemini。`?q=` / `?prompt=` 都不是官方支援的參數，
     網路上能做到的都是瀏覽器擴充套件在前端硬塞 —— 網頁本身做不到。
   ・**手機 App 一律帶不了**：點 https 連結雖然會被 ChatGPT／Gemini 的
     App 接走（Universal Links / App Links），但那個 `?q=` 不會被 App 讀進輸入框。
     OpenAI 到現在也沒開放可以帶提示詞的 URL scheme。

   所以能做到的是：**提示詞一定先複製好**，然後照設定直接把對方開起來。
   網址帶得動的情況下順便帶過去（省一次貼上），帶不動就靠剪貼簿 ——
   反正不管哪一條路，使用者手上都已經有那段文字了。

   網址長度是真正的限制，而且中文特別吃虧：
   `encodeURIComponent` 把一個中文字變成 `%E5%AD%97` 九個字元，
   所以六百字的提示詞一進網址就變五千多。
   瀏覽器本身撐得住，卡關的是伺服器 —— 常見的請求行上限是 8KB。
   取 6000 留點餘裕：短的提示詞（大約六百中文字以內）帶得過去，
   長的就不帶、只開首頁。寧可少一個便利，
   也不要讓人拿到一段被切一半的提示詞去問。 */

/** 整條網址的上限。超過就不帶提示詞，改用剪貼簿。
    6000 是抓在常見的 8KB 請求行上限底下，還留了餘裕。 */
export const MAX_URL = 6000;

export const SERVICES = [
  { id: 'chatgpt', name: 'ChatGPT', home: 'https://chatgpt.com/',
    q: (t) => `https://chatgpt.com/?q=${encodeURIComponent(t)}` },
  { id: 'gemini', name: 'Gemini', home: 'https://gemini.google.com/app', q: null,
    note: 'Gemini 沒有可以帶提示詞的官方網址參數，只能開起來再自己貼上' },
  { id: 'claude', name: 'Claude', home: 'https://claude.ai/new',
    q: (t) => `https://claude.ai/new?q=${encodeURIComponent(t)}` },
  { id: 'perplexity', name: 'Perplexity', home: 'https://www.perplexity.ai/',
    q: (t) => `https://www.perplexity.ai/search?q=${encodeURIComponent(t)}` },
];

export const serviceOf = (id) => SERVICES.find(s => s.id === id) || SERVICES[0];

/**
 * 這一次跳轉到底會怎麼跳。
 * @returns {{url: string, carried: boolean, why: string}}
 *   carried 為真表示提示詞跟著網址一起過去了。
 */
export function plan(text, id) {
  const s = serviceOf(id);
  if (!s.q) return { url: s.home, carried: false, why: `${s.name} 不支援用網址帶提示詞` };
  const url = s.q(text);
  if (url.length > MAX_URL) {
    return { url: s.home, carried: false, why: '提示詞太長，塞不進網址（已複製，貼上就好）' };
  }
  return { url, carried: true, why: '' };
}

/**
 * 開起來。一定要在使用者的點擊事件裡同步呼叫，不然會被擋成彈出視窗。
 * @returns {{carried: boolean, why: string, name: string}}
 */
export function openLLM(text, id) {
  const s = serviceOf(id);
  const p = plan(text, id);
  try { window.open(p.url, '_blank', 'noopener,noreferrer'); } catch { location.href = p.url; }
  return { ...p, name: s.name };
}
