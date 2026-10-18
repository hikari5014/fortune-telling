/* 廟裡的六位主神：各管什麼、供什麼、忌什麼、用哪一套籤
   ──────────────────────────────────────────────────────────
   內容依台灣民間信仰的一般作法整理（來源見 src/temple/SOURCES.md）。
   各廟作法不盡相同，這裡取最常見的說法；寫在畫面上的也都是「習俗上」的意思，
   不是教義。

   offerings.good：建議的供品，why 是寓意或諧音
   offerings.avoid：不建議的供品（選了會溫和地提醒，不會擋）
   set：這位神明用的籤詩
     'builtin'   —— 本 App 自撰的六十籤（跟多數媽祖廟、土地公廟一樣是六十首的格式）
     'guanyin'   —— 觀音一百籤（古籤原文，與淺草寺同一套） */

export const DOMAINS = [
  { k: 'study',  t: '學業考試', d: '考試、升學、證照、讀書專心' },
  { k: 'career', t: '事業工作', d: '求職、升遷、創業、貴人' },
  { k: 'wealth', t: '財運生意', d: '生意興隆、正財偏財、守住錢' },
  { k: 'love',   t: '姻緣感情', d: '求良緣、感情順利、婚姻和合' },
  { k: 'safe',   t: '平安健康', d: '出入平安、身體健康、家人順遂' },
  { k: 'ward',   t: '消災解厄', d: '化解厄運、度過難關、心安' },
];

export const GODS = [
  {
    id: 'wenchang', name: '文昌帝君', short: '文昌', domain: 'study', tone: '#3a6fb0',
    say: '掌管文運與功名。考試、升學、證照，都可以來拜。',
    asks: ['考試順利', '升學金榜題名', '證照考取', '讀書專心、記性好'],
    offerings: {
      good: [
        { k: 'scallion', t: '蔥', why: '「聰」明' },
        { k: 'celery', t: '芹菜', why: '「勤」學' },
        { k: 'garlic', t: '蒜', why: '會「算」' },
        { k: 'radish', t: '菜頭', why: '好彩頭' },
        { k: 'zongzi', t: '粽子', why: '「包中」' },
        { k: 'bun', t: '包子', why: '「包」中' },
        { k: 'cake', t: '糕', why: '步步「高」升' },
        { k: 'copy', t: '准考證影本', why: '讓帝君知道是哪一場考試' },
      ],
      avoid: [
        { k: 'meatball', t: '丸子', why: '諧音「完」了' },
        { k: 'duckegg', t: '鴨蛋', why: '像考零分' },
        { k: 'redturtle', t: '紅龜粿', why: '諧音「槓龜」' },
      ],
    },
    birthday: '農曆二月初三',
    set: 'builtin',
  },
  {
    id: 'guangong', name: '關聖帝君', short: '關公', domain: 'career', tone: '#2f7a4a',
    say: '忠義的武聖，也是商人供奉的武財神。求事業、求貴人、求正道。',
    asks: ['工作順利', '升遷加薪', '創業有成', '遇到貴人、遠離小人'],
    offerings: {
      good: [
        { k: 'flowers', t: '鮮花', why: '敬意' },
        { k: 'apple', t: '蘋果', why: '平安' },
        { k: 'cake', t: '糕餅', why: '步步高升' },
        { k: 'tea', t: '清茶', why: '清心' },
        { k: 'wine', t: '酒', why: '敬武聖（部分廟宇不收）' },
      ],
      avoid: [{ k: 'meat', t: '牛肉', why: '民間習俗上供奉關公忌牛肉' }],
    },
    birthday: '農曆六月二十四日（也有廟在五月十三慶祝）',
    set: 'builtin',
  },
  {
    id: 'caishen', name: '五路財神', short: '財神', domain: 'wealth', tone: '#b8862b',
    say: '武財神趙公明與四方招財的神明。求生意興隆、財源廣進。',
    asks: ['生意興隆', '正財穩定', '偏財運', '守財、不破財'],
    offerings: {
      good: [
        { k: 'pineapple', t: '鳳梨', why: '「旺來」' },
        { k: 'orange', t: '柑橘', why: '「大吉」' },
        { k: 'fagao', t: '發粿', why: '「發」' },
        { k: 'redturtle', t: '紅龜粿', why: '圓滿、添壽' },
        { k: 'flowers', t: '鮮花', why: '敬意' },
      ],
      avoid: [
        { k: 'apple', t: '蘋果', why: '民間說法：求財時諧音不吉，換成鳳梨或柑橘更好' },
        { k: 'waxapple', t: '蓮霧', why: '民間說法：諧音「連無」' },
      ],
    },
    birthday: '農曆三月十五日（趙公明）',
    set: 'builtin',
  },
  {
    id: 'yuelao', name: '月下老人', short: '月老', domain: 'love', tone: '#c4425a',
    say: '用紅線牽起姻緣的神明。求良緣，也求感情和合。',
    asks: ['遇到對的人', '感情順利', '婚姻和合', '斬斷爛桃花'],
    offerings: {
      good: [
        { k: 'candy', t: '喜糖', why: '甜甜蜜蜜' },
        { k: 'dates', t: '紅棗', why: '「早」日良緣' },
        { k: 'longan', t: '桂圓', why: '圓滿' },
        { k: 'flowers', t: '鮮花', why: '花開有緣' },
        { k: 'thread', t: '紅線', why: '請月老繫上姻緣線' },
      ],
      avoid: [],
    },
    birthday: '農曆八月十五日',
    set: 'builtin',
  },
  {
    id: 'mazu', name: '天上聖母', short: '媽祖', domain: 'safe', tone: '#2f5f8a',
    say: '海上守護神，也是台灣人最親近的媽祖婆。求平安、求順遂。',
    asks: ['出入平安', '家人健康', '旅途順利', '心事有依靠'],
    offerings: {
      good: [
        { k: 'flowers', t: '鮮花', why: '敬意' },
        { k: 'apple', t: '蘋果', why: '平安' },
        { k: 'peach', t: '壽桃', why: '長壽' },
        { k: 'cake', t: '糕餅', why: '甜甜順順' },
        { k: 'orange', t: '柑橘', why: '大吉' },
      ],
      avoid: [],
    },
    birthday: '農曆三月二十三日',
    set: 'builtin',
  },
  {
    id: 'guanyin', name: '觀世音菩薩', short: '觀音', domain: 'ward', tone: '#7a6aa8',
    say: '大慈大悲、聞聲救苦。遇到難關、心裡不安，都可以向觀音傾訴。',
    asks: ['化解厄運', '度過難關', '身心安定', '為家人祈福'],
    offerings: {
      good: [
        { k: 'flowers', t: '鮮花', why: '莊嚴' },
        { k: 'tea', t: '清茶', why: '清淨' },
        { k: 'orange', t: '素果', why: '單數水果，佛前供素' },
        { k: 'cake', t: '素糕餅', why: '不含動物油的才合適' },
      ],
      avoid: [
        { k: 'meat', t: '葷食', why: '觀音是菩薩，供品一律素食' },
        { k: 'wine', t: '酒', why: '佛前不供酒' },
      ],
    },
    birthday: '農曆二月十九日',
    set: 'guanyin',
  },
];

export const godOf = (id) => GODS.find(g => g.id === id) || null;
export const godsFor = (domain) => GODS.filter(g => g.domain === domain);
export const domainOf = (k) => DOMAINS.find(d => d.k === k) || null;
