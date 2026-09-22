/* 保密檔案
   ──────────────────────────────────────────────────────────
   用途：把手機遞給別人，讓對方自己輸入生辰，按下確認之後
   這份資料就不再顯示在畫面上，只留人名。

   這是「不顯示」，不是「加密」。說清楚它擋得住什麼、擋不住什麼：

   擋得住 —— 你拿著手機隨手翻的時候看不到；分享碼與 QR 一律停用，
             所以不會被轉傳出去；備份匯出預設整份跳過。
   擋不住 —— 資料本來就存在這台裝置的 localStorage 裡，
             懂得開開發者工具的人看得到；而且命盤本身
             （四柱、紫微、星盤度數）足以回推出生日期，
             所以真正要保密就不要當著對方的面展示命盤。

   這兩句話在介面上也照實寫出來，不含糊帶過。 */

export const isPrivate = (p) => !!(p && p.private);

/** 顯示用的名字（保密與否都一樣，名字本來就是要顯示的） */
export const nameOf = (p) => {
  if (!p) return '未命名';
  return (p.surname || '') + (p.givenName || '') || p.label || '未命名';
};

/** 列表上那一行小字：保密檔案只講「已保密」與出生地以外的東西都不講 */
export function birthLine(p) {
  if (!p) return '';
  if (isPrivate(p)) return '出生資料已保密';
  const pad = (n) => String(n).padStart(2, '0');
  const b = p.birth || {};
  const t = b.hourUnknown ? '時辰不詳' : `${pad(b.h)}:${pad(b.minute)}`;
  return `${b.y}-${pad(b.m)}-${pad(b.d)} ${t} · ${p.city || ''}`;
}

/** 只給日期（給合盤挑人那類地方用） */
export function dateLine(p) {
  if (!p) return '';
  if (isPrivate(p)) return '保密';
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.birth.y}-${pad(p.birth.m)}-${pad(p.birth.d)}`;
}

/** 保密檔案不進備份檔 */
export const exportable = (list) => list.filter(p => !isPrivate(p));

/** 命盤頁面上那句提醒 */
export const CHART_WARNING = '這是保密檔案。命盤上的四柱與星位可以回推出生日期，'
  + '要當著本人以外的人看之前先想一下。';
