/* 應驗追蹤：卜卦、塔羅、求籤問過之後，過一陣子回頭看「後來怎麼樣」
   ──────────────────────────────────────────────────────────
   占卜的價值有一半在事後：回頭對照，才知道自己哪一種占卜最有感、
   哪一類問題問了也是白問。這支負責三件事：

   1. **記下來**：卜卦、塔羅、求籤的結果頁都能直接存一筆（不用先去問 LLM）。
      從 LLM 貼回來、模板是解卦/解牌/解籤的紀錄也自動算在內。
   2. **到期提醒**：存下來 N 天後（設定頁可調，預設 7 天）還沒回答的，
      首頁會跳一張「還記得嗎？」卡。答「還沒發生」就再往後延。
   3. **統計**：準、部分準、不準各幾次，依占卜種類分開算。

   答案就存在那筆紀錄上（verdict），跟著備份走，不另開一個資料表。 */

import { store, uid } from './store.js';
import { html, raw, toast, haptic } from './ui.js';
import { icon } from './icons.js';

const DAY = 86400000;

export const VERDICTS = [
  { k: 'hit',     t: '準',     w: 1 },
  { k: 'partial', t: '部分準', w: 0.5 },
  { k: 'miss',    t: '不準',   w: 0 },
];
export const verdictName = (k) => (VERDICTS.find(v => v.k === k) || {}).t || '';

/** 可以追蹤的占卜種類（對應模板 id） */
export const KINDS = { iching: '卜卦', tarot: '塔羅', qian: '求籤' };
export const kindOf = (r) => (KINDS[r?.templateId] ? r.templateId : null);
export const trackable = (r) => !!kindOf(r);

/** 預設幾天後回頭看；0 表示不提醒（照樣可以自己去紀錄頁標） */
export const daysSetting = (settings = store.settings) => {
  const v = Number(settings.verifyDays);
  return Number.isFinite(v) && v >= 0 ? v : 7;
};

/** 這筆什麼時候該回頭看 */
export const followAt = (r, days = daysSetting()) =>
  r.followAt ? Date.parse(r.followAt) : Date.parse(r.createdAt) + days * DAY;

/** 到期、還沒回答的，最早到期的排前面 */
export function due(records = store.records, { days = daysSetting(), now = Date.now() } = {}) {
  if (!days) return [];
  return records
    .filter(r => trackable(r) && !r.verdict && followAt(r, days) <= now)
    .sort((a, b) => followAt(a, days) - followAt(b, days));
}

/** 回答準不準 */
export function setVerdict(id, verdict) {
  return store.updateRecord(id, verdict
    ? { verdict, verdictAt: new Date().toISOString() }
    : { verdict: null, verdictAt: null });
}

/** 還沒發生：往後延 */
export function snooze(id, days = daysSetting() || 7, now = Date.now()) {
  return store.updateRecord(id, { followAt: new Date(now + days * DAY).toISOString() });
}

/** 準確率：準算 1、部分準算 0.5 */
export function stats(records = store.records) {
  const blank = () => ({ n: 0, hit: 0, partial: 0, miss: 0, rate: null });
  const by = Object.fromEntries(Object.keys(KINDS).map(k => [k, blank()]));
  const all = blank();
  for (const r of records) {
    const k = kindOf(r);
    if (!k || !r.verdict || !VERDICTS.some(v => v.k === r.verdict)) continue;
    for (const s of [by[k], all]) { s.n++; s[r.verdict]++; }
  }
  for (const s of [...Object.values(by), all]) {
    s.rate = s.n ? (s.hit + s.partial * 0.5) / s.n : null;
  }
  return { by, all };
}

/** 從結果頁直接存一筆（不經 LLM） */
export function saveReading({ kind, question = '', text, profile = null }) {
  const q = question.trim();
  return store.addRecord({
    id: uid('rec'), createdAt: new Date().toISOString(),
    templateId: kind, templateName: `${KINDS[kind]}紀錄`,
    who: profile ? ((profile.surname || '') + (profile.givenName || '') || profile.label || '') : '',
    profileId: profile?.id || null,
    question: q,
    prompt: '', model: '', tags: [],
    // 原本的純文字一行一段；Markdown 需要行尾兩個空白才會換行
    content: [q ? `**所問**：${q}` : '', '', ...String(text).split('\n').map(l => `${l}  `)].join('\n').trim(),
    snapshot: null,
  });
}

/** 首頁卡片用：這筆問的是什麼 */
export function askedOf(r) {
  if (r.question) return r.question;
  const m = String(r.content || '').match(/(?:所問|問題)[:：]\s*\**\s*([^\n*]+)/);
  if (m && m[1].trim() && !/未填/.test(m[1])) return m[1].trim();
  return '';
}

/** 幾天前 */
export const daysAgo = (r, now = Date.now()) => Math.max(0, Math.round((now - Date.parse(r.createdAt)) / DAY));

/* ── 結果頁的「記下來」按鈕 ─────────────────────── */

export const trackBtn = () => html`<button class="btn btn--ghost press" data-track>${raw(icon('pin'))} 記下來，之後看準不準</button>`;

/** get() 回傳 { kind, question, text, profile } —— 按下去那一刻才讀，問題欄位可能後來才填 */
export function bindTrack(scope, get) {
  const b = scope.querySelector('[data-track]');
  if (!b) return;
  b.addEventListener('click', () => {
    const r = saveReading(get());
    const days = daysSetting();
    b.disabled = true;
    b.innerHTML = `${icon('check')} 已記下`;
    haptic(12);
    toast(days ? `已存到紀錄，${days} 天後首頁會問你後來怎麼樣` : '已存到紀錄，隨時可以到紀錄頁標準不準');
    return r;
  });
}
