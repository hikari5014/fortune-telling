/* 平台偵測與安裝指引
   ──────────────────────────────────────────────────────────
   PWA 的安裝方式每個平台都不一樣，而且瀏覽器不會告訴你該怎麼做。
   只能靠 User-Agent 判斷 —— 它不可靠，所以：
   1. 任何時候都提供「其他平台的做法」讓人自己找
   2. 能用 beforeinstallprompt 就優先用真的安裝提示，不靠猜 */

/**
 * 判斷平台與瀏覽器。參數可覆寫，純粹是為了讓它測得起來。
 * @param {object} o {ua, platform, touch}
 */
export function detect({ ua, platform, touch } = {}) {
  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const u = ua ?? nav.userAgent ?? '';
  const plat = platform ?? nav.platform ?? '';
  const pts = touch ?? nav.maxTouchPoints ?? 0;
  // iPadOS 會謊報成 Mac，用觸控點數補判
  const iOS = /iPad|iPhone|iPod/.test(u) || (pts > 1 && /Mac/.test(plat));
  const android = /Android/.test(u);

  // 順序有講究：Edge 與 Samsung 的 UA 裡都有 Chrome
  let browser = '其他瀏覽器';
  if (iOS) {
    if (/CriOS/.test(u)) browser = 'Chrome';
    else if (/FxiOS/.test(u)) browser = 'Firefox';
    else if (/EdgiOS/.test(u)) browser = 'Edge';
    else browser = 'Safari';
  } else if (/Edg\//.test(u)) browser = 'Edge';
  else if (/SamsungBrowser/.test(u)) browser = 'Samsung Internet';
  else if (/OPR\//.test(u)) browser = 'Opera';
  else if (/Firefox\//.test(u)) browser = 'Firefox';
  else if (/Chrome\//.test(u)) browser = 'Chrome';
  else if (/Safari\//.test(u)) browser = 'Safari';

  const os = iOS ? 'iOS' : android ? 'Android' : /Mac/.test(u) ? 'macOS' : /Windows/.test(u) ? 'Windows' : '桌面';
  return { os, browser, iOS, android, desktop: !iOS && !android, installed: isInstalled() };
}

/** 已經從主畫面開啟了嗎 */
export function isInstalled() {
  try {
    return matchMedia('(display-mode: standalone)').matches
      || matchMedia('(display-mode: window-controls-overlay)').matches
      || navigator.standalone === true;
  } catch { return false; }
}

/* 各平台的安裝步驟。step 的 icon 對應 icons.js 裡的名字。 */
const GUIDES = {
  'iOS/Safari': {
    title: 'iPhone / iPad · Safari',
    steps: [
      { icon: 'share', text: '點畫面**下方中間**的分享按鈕（方框往上的箭頭）' },
      { icon: 'plus', text: '往下捲，選「**加入主畫面**」' },
      { icon: 'check', text: '右上角按「新增」' },
    ],
    note: '之後從主畫面的圖示打開，就會是全螢幕、沒有網址列，而且完全離線可用。',
  },
  'iOS/other': {
    title: 'iPhone / iPad',
    steps: [
      { icon: 'share', text: '點瀏覽器工具列的**分享**按鈕' },
      { icon: 'plus', text: '往下捲，選「**加入主畫面**」' },
      { icon: 'check', text: '右上角按「新增」' },
    ],
    note: 'iOS 上的每個瀏覽器都是用 Safari 的引擎，做法都一樣。若找不到這個選項，改用 Safari 打開這一頁。',
  },
  'Android/Chrome': {
    title: 'Android · Chrome',
    steps: [
      { icon: 'settings', text: '點右上角的**三點**選單' },
      { icon: 'install', text: '選「**安裝應用程式**」或「加到主畫面」' },
      { icon: 'check', text: '跳出的對話框按「安裝」' },
    ],
    note: 'Chrome 有時會自己在畫面下方跳出安裝橫幅，直接點它更快。',
  },
  'Android/Samsung Internet': {
    title: 'Android · Samsung Internet',
    steps: [
      { icon: 'settings', text: '點畫面下方的**三橫線**選單' },
      { icon: 'plus', text: '選「加入頁面至」→「**主螢幕**」' },
      { icon: 'check', text: '按「新增」確認' },
    ],
    note: '三星裝置上這個選單在畫面下方，不是右上角。',
  },
  'Android/Firefox': {
    title: 'Android · Firefox',
    steps: [
      { icon: 'settings', text: '點右上角的**三點**選單' },
      { icon: 'install', text: '選「**安裝**」或「加到主畫面」' },
      { icon: 'check', text: '按「新增」確認' },
    ],
    note: 'Firefox 的版本較舊時可能只有「加到主畫面」，效果一樣。',
  },
  'Android/other': {
    title: 'Android',
    steps: [
      { icon: 'settings', text: '打開瀏覽器選單' },
      { icon: 'plus', text: '找「安裝應用程式」或「加到主畫面」' },
    ],
    note: '若找不到，用 Chrome 打開這一頁最穩。',
  },
  'desktop/Chrome': {
    title: '電腦 · Chrome',
    steps: [
      { icon: 'install', text: '點**網址列右側**的安裝圖示（螢幕加下箭頭）' },
      { icon: 'check', text: '跳出的視窗按「安裝」' },
    ],
    note: '沒看到圖示的話，從右上三點選單 →「投放、儲存及分享」→「安裝頁面為應用程式」。',
  },
  'desktop/Edge': {
    title: '電腦 · Edge',
    steps: [
      { icon: 'install', text: '點**網址列右側**的安裝圖示' },
      { icon: 'check', text: '跳出的視窗按「安裝」' },
    ],
    note: '或從右上三點選單 →「應用程式」→「將此網站安裝為應用程式」。',
  },
  'macOS/Safari': {
    title: 'Mac · Safari',
    steps: [
      { icon: 'share', text: '選單列的「**檔案**」' },
      { icon: 'plus', text: '選「**加入 Dock**」' },
    ],
    note: '需要 macOS Sonoma（14）以上。',
  },
  'desktop/Firefox': {
    title: '電腦 · Firefox',
    steps: [{ icon: 'info', text: 'Firefox 桌面版目前沒有內建的安裝功能' }],
    note: '可以把這一頁加入書籤照樣使用 —— 離線快取仍然有效，只是不會有獨立視窗。想要獨立視窗請改用 Chrome 或 Edge。',
  },
};

/** 給這台裝置的安裝指引 */
export function installGuide(d = detect()) {
  const key = d.iOS
    ? (d.browser === 'Safari' ? 'iOS/Safari' : 'iOS/other')
    : d.android
      ? (GUIDES[`Android/${d.browser}`] ? `Android/${d.browser}` : 'Android/other')
      : (d.os === 'macOS' && d.browser === 'Safari') ? 'macOS/Safari'
        : GUIDES[`desktop/${d.browser}`] ? `desktop/${d.browser}` : 'desktop/Chrome';
  return { key, ...GUIDES[key] };
}

/** 其他平台的做法，讓判斷錯的人自己找 */
export const ALL_GUIDES = () => Object.entries(GUIDES).map(([key, g]) => ({ key, ...g }));
