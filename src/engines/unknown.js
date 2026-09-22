/* 出生時辰不詳時，哪些結果還能看、哪些不能
   ──────────────────────────────────────────────────────────
   很多人只知道出生日期，不知道確切時辰。這種情況照樣可以算，
   但必須講清楚哪些數字是站不住腳的 —— 假裝算得出來比算不出來更糟。

   下面的判斷是實測出來的：同一天把時辰從 0 點掃到 23 點，
   上升出現 12 種星座、紫微命宮 12 種、時柱 13 種（含晚子時換日）、
   月亮 2 種、太陽 1 種。 */

/** level: unusable 完全不可用 / partial 會偏 / maybe 可能有誤 / minor 影響很小 */
export const HOUR_DEPENDENT = [
  {
    key: 'asc', area: '星盤', what: '上升、下降與十二宮位', level: 'unusable',
    why: '上升每四分鐘移動一度，一天正好轉完一圈。不知道時辰，就等於不知道上升 —— 十二個星座都有可能。',
  },
  {
    key: 'mc', area: '星盤', what: '中天與天底', level: 'unusable',
    why: '由出生當下的恆星時決定，跟上升一樣一天轉一圈。',
  },
  {
    key: 'moon', area: '星盤', what: '月亮星座', level: 'maybe',
    why: '月亮一天走約 13 度。用中午推算通常對，但出生那天月亮剛好在星座交界時就會落到隔壁去。',
  },
  {
    key: 'ziwei', area: '紫微', what: '整張命盤：命宮、身宮、十二宮與大限', level: 'unusable',
    why: '命宮由出生時辰的地支起算，時辰換一個，整張盤跟著移位。這張盤只能當成「其中一種可能」。',
  },
  {
    key: 'hourPillar', area: '八字', what: '時柱與時柱的十神', level: 'unusable',
    why: '時柱直接由時辰決定，沒有時辰就沒有時柱。',
  },
  {
    key: 'strength', area: '八字', what: '五行力量與日主旺衰', level: 'partial',
    why: '八個字少了兩個，五行比例會偏。身強身弱的判定與喜用神方向可能跟著改變。',
  },
  {
    key: 'luck', area: '運勢', what: '大運起運的歲數', level: 'minor',
    why: '起運看的是出生到交節的天數，差幾個小時只會讓起運月份略有出入，方向不變。',
  },
];

/** 不受時辰影響、照樣可以看的部分 */
export const HOUR_SAFE = [
  '太陽星座', '年柱、月柱、日柱與生肖', '納音', '姓名五格與三才',
  '數字磁場與生命靈數', '方位（八宅本命卦看年份與性別）',
  '卜卦、塔羅、求籤', '擇日與擇時（看的是今天，不是你的出生時辰）',
];

export const LEVEL_TEXT = {
  unusable: '無法確定',
  partial: '會偏移',
  maybe: '可能有誤',
  minor: '影響很小',
};

/** 這份檔案有沒有標記時辰不詳 */
export const isHourUnknown = (profile) => !!profile?.birth?.hourUnknown;

/** 某個頁面受影響的項目；不給 areas 就回傳全部 */
export const affected = (areas = null) =>
  (areas ? HOUR_DEPENDENT.filter(x => areas.includes(x.area)) : HOUR_DEPENDENT);

/** 給提示詞用的警告文字 */
export function caveatText(profile) {
  if (!isHourUnknown(profile)) return '';
  return [
    '※ 重要：這份資料**沒有確切的出生時辰**，以下計算用中午 12:00 代入，因此：',
    ...HOUR_DEPENDENT.map(x => `・【${LEVEL_TEXT[x.level]}】${x.area}的${x.what} —— ${x.why}`),
    '',
    `不受影響、可以放心解讀的有：${HOUR_SAFE.join('、')}。`,
    '',
    '請在回答時明確區分哪些結論站得住腳、哪些只是其中一種可能；',
    '不要把上升星座或紫微命宮當成確定的事實來推論。',
    '若有辦法，請反過來提示我可以用什麼方式回推時辰（例如從重大事件的時間、或從外貌與性格特徵倒推上升）。',
  ].join('\n');
}
