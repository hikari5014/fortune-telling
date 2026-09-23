/* 導覽：所有頁面，以及它們怎麼分類。
   路由表與分類放同一個檔案，免得改了一邊忘了另一邊。 */

export const NAV = [
  { p: '/',          t: '首頁', icon: 'home',     eyebrow: 'XUAN JIAN' },
  { p: '/astro',     t: '星盤', icon: 'astro',    eyebrow: 'NATAL CHART' },
  { p: '/ziwei',     t: '紫微', icon: 'ziwei',    eyebrow: 'ZI WEI DOU SHU' },
  { p: '/bazi',      t: '八字', icon: 'pillars',  eyebrow: 'FOUR PILLARS' },
  { p: '/fortune',   t: '運勢', icon: 'clock',    eyebrow: 'LUCK CYCLES' },
  { p: '/daily',     t: '擇日', icon: 'calendar', eyebrow: 'DAY PICKER' },
  { p: '/direction', t: '方位', icon: 'compass',  eyebrow: 'EIGHT MANSIONS' },
  { p: '/synastry',  t: '合盤', icon: 'link',     eyebrow: 'SYNASTRY' },
  { p: '/hire',      t: '面談', icon: 'edit',     eyebrow: 'INTERVIEW' },
  { p: '/iching',    t: '卜卦', icon: 'dice',     eyebrow: 'I CHING' },
  { p: '/tarot',     t: '塔羅', icon: 'star',     eyebrow: 'TAROT' },
  { p: '/qian',      t: '求籤', icon: 'folder',   eyebrow: 'ORACLE POEM' },
  { p: '/naming',    t: '姓名', icon: 'naming',   eyebrow: 'NAME STUDY' },
  { p: '/numbers',   t: '數字', icon: 'numbers',  eyebrow: 'NUMEROLOGY' },
  { p: '/prompt',    t: '提示', icon: 'prompt',   eyebrow: 'PROMPT STUDIO' },
  { p: '/records',   t: '紀錄', icon: 'records',  eyebrow: 'READINGS' },
  { p: '/profile',   t: '檔案', icon: 'profile',  eyebrow: 'PROFILES' },
  { p: '/settings',  t: '設定', icon: 'settings', eyebrow: 'SETTINGS' },
  { p: '/about',     t: '關於', icon: 'info',     eyebrow: 'ABOUT' },
];

/* 四個分類排成扇形，正中央下面放圓形的首頁鍵。
   工具放最左邊 —— 那是最少用、也最不想誤觸的一類。
   擇日與方位歸在占卜底下：嚴格說它們是擇吉不是占卜，
   但使用者要找的時候會往同一個方向想，分類要照人的直覺分，不是照學理。 */
export const CATS = [
  { key: 'tool',   name: '工具', icon: 'settings',
    paths: ['/prompt', '/records', '/profile', '/settings', '/about'] },
  { key: 'chart',  name: '命盤', icon: 'astro',
    paths: ['/astro', '/ziwei', '/bazi', '/fortune'] },
  { key: 'divine', name: '占卜', icon: 'dice',
    paths: ['/iching', '/tarot', '/qian', '/daily', '/direction'] },
  { key: 'bond',   name: '人際', icon: 'link',
    paths: ['/synastry', '/hire', '/naming', '/numbers'] },
];

export const HOME = NAV[0];

/** 畫面上的先後順序：首頁在最前，其餘照分類排。
    左右滑動切頁與方向鍵都照這個走，才跟側欄看到的一致。 */
export const FLOW = ['/', ...CATS.flatMap(c => c.paths)];

const byPath = new Map(NAV.map(n => [n.p, n]));
/** 某一類底下的頁面（照 CATS 裡寫的順序） */
export const itemsOf = (cat) => cat.paths.map(p => byPath.get(p)).filter(Boolean);
/** 這個路徑屬於哪一類（首頁不屬於任何一類，回傳 null） */
export const catOf = (path) => CATS.find(c => c.paths.includes(path)) || null;
