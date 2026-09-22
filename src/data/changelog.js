/* 版本與更新紀錄 —— 全 App 的單一來源。
   改版時：更新 APP_VERSION、在 CHANGELOG 最前面加一筆，並把 sw.js 的 VERSION 改成同一組版號
   （tools/check_version.py 會檢查兩邊是否一致）。 */

export const APP_VERSION = '0.3.0';
export const APP_STAGE = 'demo';

/** kind: add 新增 / fix 修正 / change 調整 / data 資料 */
export const CHANGELOG = [
  {
    v: '0.3.0', date: '2026-09-22', title: '版本資訊',
    items: [
      { kind: 'add', text: '新增「關於」頁：版本號、完整更新紀錄、本機資料統計、離線狀態' },
      { kind: 'add', text: '偵測到新版本時提示，並可手動檢查更新' },
      { kind: 'add', text: '更新完成後自動重新載入，不會卡在舊版的畫面' },
      { kind: 'change', text: '版本號改為單一來源，App 與離線快取版本同步' },
    ],
  },
  {
    v: '0.2.1', date: '2026-09-21', title: 'iOS 拖曳體驗',
    items: [
      { kind: 'fix', text: '改用 svh 取代 dvh：Safari 網址列收合不再讓版面每幀改變尺寸' },
      { kind: 'fix', text: '顆粒層移除混色模式，捲動時不再強制整頁重新混色' },
      { kind: 'fix', text: '觸控裝置停用毛玻璃與指標光暈，改用獨立合成層' },
      { kind: 'fix', text: '滑動切頁改為方向鎖定 + rAF 節流 + 慣性捲動保護 + 螢幕邊緣讓位' },
      { kind: 'fix', text: '抽屜下拉改為可攔截手勢，開啟時鎖住背景捲動' },
      { kind: 'fix', text: '可編輯欄位字級不低於 16px，聚焦時不再自動放大整頁' },
      { kind: 'fix', text: '以 visualViewport 追蹤鍵盤高度，抽屜不被鍵盤蓋住' },
    ],
  },
  {
    v: '0.2.0', date: '2026-09-21', title: '大運流年 · 合盤 · 卜卦 · 塔羅',
    items: [
      { kind: 'add', text: '運勢頁：紫微大限、小限、流年四化、八字大運、流月、今日十神' },
      { kind: 'add', text: '合盤頁：西洋相位、八字刑沖合害、紫微宮位對照、綜合契合度' },
      { kind: 'add', text: '卜卦頁：六十四卦，三枚銅錢／梅花易數時間／數字三種起卦法' },
      { kind: 'add', text: '塔羅頁：78 張牌正逆位，五種牌陣含凱爾特十字' },
      { kind: 'data', text: '康熙筆畫改由 Unicode Unihan 推算，涵蓋 20,992 字，罕用字也查得到' },
      { kind: 'add', text: '姓名候選名收藏比較、數目字筆畫規則可切換' },
      { kind: 'add', text: '提示詞模板可下載 JSON、複製分享碼、從檔案或分享碼匯入' },
      { kind: 'add', text: '新增解卦、解牌兩個提示詞模板，共 15 個內建模板' },
      { kind: 'change', text: '導覽改為 5 個主要分頁 + 「更多」抽屜，桌面側欄列出全部' },
    ],
  },
  {
    v: '0.1.1', date: '2026-09-21', title: '上線',
    items: [
      { kind: 'add', text: '加入 GitHub Pages 自動部署，推送 main 即更新線上版' },
      { kind: 'fix', text: 'manifest 改用相對路徑，可部署在子路徑底下' },
    ],
  },
  {
    v: '0.1.0', date: '2026-09-21', title: '初版',
    items: [
      { kind: 'add', text: '曆法引擎：太陽月亮黃經、二十四節氣、定朔定氣農曆、四柱干支、納音' },
      { kind: 'add', text: '星盤：太陽月亮星座、上升與中天、等宮制十二宮、月相' },
      { kind: 'add', text: '紫微：命身宮、五行局、十四主星、六吉六煞、年干四化' },
      { kind: 'add', text: '姓名：五格三才、81 靈動數、取名筆畫推薦' },
      { kind: 'add', text: '數字：八星磁場、手機車牌評分、生命靈數、雙號匹配' },
      { kind: 'add', text: '提示詞產生器：資料積木、變數面板、輸出控制、貼回存檔' },
      { kind: 'add', text: '設定頁統整外觀、動態、命理參數、提示詞預設、資料匯出入' },
      { kind: 'add', text: 'PWA 離線可用、黑白雙主題、自繪圖示、動態互動與過場' },
    ],
  },
];

export const KIND_LABEL = { add: '新增', fix: '修正', change: '調整', data: '資料' };
