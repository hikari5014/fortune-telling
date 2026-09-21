/* 紫微斗數：安命身宮、五行局、十四主星、常用輔星 */
import { STEMS, BRANCHES, toLunar, gzIndexOf, nayin, hourBranchIndex, ZODIAC } from './calendar.js';

export const PALACES = ['命宮','兄弟','夫妻','子女','財帛','疾厄','遷移','交友','官祿','田宅','福德','父母'];
export const PALACE_DESC = {
  命宮: '本質與人生基調', 兄弟: '手足與同儕', 夫妻: '親密關係', 子女: '子嗣與創造',
  財帛: '金錢流動', 疾厄: '身體與壓力', 遷移: '外出與際遇', 交友: '人脈與部屬',
  官祿: '事業與成就', 田宅: '家宅與資產', 福德: '精神與享受', 父母: '長輩與上司',
};

export const MAIN_STARS = {
  紫微: '尊貴、主導、講究格局', 天機: '思慮、變動、善謀', 太陽: '付出、照耀、表現',
  武曲: '剛毅、財星、執行', 天同: '溫和、享福、情緒', 廉貞: '複雜、才情、次桃花',
  天府: '穩重、庫藏、保守', 太陰: '細膩、母性、內斂', 貪狼: '慾望、才藝、桃花',
  巨門: '口舌、專業、辨析', 天相: '輔佐、印信、和氣', 天梁: '蔭庇、原則、長者',
  七殺: '果決、開創、肅殺', 破軍: '破舊立新、消耗、衝勁',
};
const LUCKY = ['左輔','右弼','文昌','文曲','天魁','天鉞','祿存'];
const SHA = ['擎羊','陀羅','火星','鈴星','地空','地劫'];

const JU_TABLE = { 水: [2, '水二局'], 木: [3, '木三局'], 金: [4, '金四局'], 土: [5, '土五局'], 火: [6, '火六局'] };

/** 起紫微訣 */
function ziweiPos(day, ju) {
  const n = Math.ceil(day / ju);
  const diff = n * ju - day;
  const pos = (diff % 2 === 0) ? n + diff : n - diff;
  return ((pos + 1) % 12 + 12) % 12;      // 寅宮起 1
}

const LU_BY_STEM = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];               // 甲祿寅…癸祿子
const KUI_YUE = {                                                  // 天魁 / 天鉞
  甲: [1, 7], 戊: [1, 7], 庚: [1, 7], 乙: [0, 8], 己: [0, 8],
  丙: [11, 9], 丁: [11, 9], 辛: [6, 2], 壬: [3, 5], 癸: [3, 5],
};
const HUO_LING = {          // 年支三合 → [火星起點, 鈴星起點]
  寅午戌: [1, 3], 申子辰: [2, 10], 巳酉丑: [3, 10], 亥卯未: [9, 10],
};
function sanhe(branch) {
  const b = BRANCHES[branch];
  for (const k of Object.keys(HUO_LING)) if (k.includes(b)) return k;
  return '寅午戌';
}
const SIHUA = {   // 年干四化：祿 權 科 忌
  甲: ['廉貞','破軍','武曲','太陽'], 乙: ['天機','天梁','紫微','太陰'],
  丙: ['天同','天機','文昌','廉貞'], 丁: ['太陰','天同','天機','巨門'],
  戊: ['貪狼','太陰','右弼','天機'], 己: ['武曲','貪狼','天梁','文曲'],
  庚: ['太陽','武曲','太陰','天同'], 辛: ['巨門','太陽','文曲','文昌'],
  壬: ['天梁','紫微','左輔','武曲'], 癸: ['破軍','巨門','太陰','貪狼'],
};

/**
 * 排盤
 * @param {object} o {y,m,d,h,tz,gender}
 */
export function ziweiChart({ y, m, d, h = 12, tz = 8, gender = '女' }) {
  const lunar = toLunar(y, m, d, tz);
  const lMonth = lunar.month;
  const lDay = lunar.day;
  const hourIdx = hourBranchIndex(h);

  // 命宮 / 身宮
  const life = ((lMonth + 1 - hourIdx) % 12 + 12) % 12;
  const body = ((lMonth + 1 + hourIdx) % 12 + 12) % 12;

  // 年干支（以農曆年計）
  const yearGZ = ((lunar.year - 4) % 60 + 60) % 60;
  const yearStem = yearGZ % 10, yearBranch = yearGZ % 12;

  // 宮干：五虎遁
  const startStem = (yearStem % 5) * 2 + 2;                 // 寅宮天干
  const palaceStem = (b) => (startStem + ((b - 2) % 12 + 12) % 12) % 10;

  // 五行局＝命宮納音
  const lifeGZ = gzIndexOf(palaceStem(life), life);
  const ny = nayin(lifeGZ);
  const [juNum, juName] = JU_TABLE[ny.element];

  // 主星
  const zi = ziweiPos(lDay, juNum);
  const fu = ((4 - zi) % 12 + 12) % 12;
  const stars = Array.from({ length: 12 }, () => ({ main: [], lucky: [], sha: [], hua: [] }));
  const put = (b, name, kind = 'main') => stars[((b % 12) + 12) % 12][kind].push(name);

  put(zi, '紫微'); put(zi - 1, '天機'); put(zi - 3, '太陽'); put(zi - 4, '武曲');
  put(zi - 5, '天同'); put(zi - 8, '廉貞');
  put(fu, '天府'); put(fu + 1, '太陰'); put(fu + 2, '貪狼'); put(fu + 3, '巨門');
  put(fu + 4, '天相'); put(fu + 5, '天梁'); put(fu + 6, '七殺'); put(fu + 10, '破軍');

  // 輔星
  const lu = LU_BY_STEM[yearStem];
  put(lu, '祿存', 'lucky'); put(lu + 1, '擎羊', 'sha'); put(lu - 1, '陀羅', 'sha');
  const [kui, yue] = KUI_YUE[STEMS[yearStem]];
  put(kui, '天魁', 'lucky'); put(yue, '天鉞', 'lucky');
  put(10 - hourIdx, '文昌', 'lucky'); put(4 + hourIdx, '文曲', 'lucky');
  put(4 + (lMonth - 1), '左輔', 'lucky'); put(10 - (lMonth - 1), '右弼', 'lucky');
  put(11 - hourIdx, '地空', 'sha'); put(11 + hourIdx, '地劫', 'sha');
  const [hs, ls] = HUO_LING[sanhe(yearBranch)];
  put(hs + hourIdx, '火星', 'sha'); put(ls + hourIdx, '鈴星', 'sha');
  const MA = [2, 11, 8, 5];                 // 申子辰→寅、巳酉丑→亥、寅午戌→申、亥卯未→巳
  put(MA[yearBranch % 4], '天馬', 'lucky');

  // 四化
  const hua = SIHUA[STEMS[yearStem]];
  const huaLabel = ['祿', '權', '科', '忌'];
  hua.forEach((star, i) => {
    for (let b = 0; b < 12; b++) {
      if (stars[b].main.includes(star) || stars[b].lucky.includes(star) || stars[b].sha.includes(star)) {
        stars[b].hua.push(`${star}化${huaLabel[i]}`);
      }
    }
  });

  // 十二宮名稱（自命宮逆時針）
  const palaces = Array.from({ length: 12 }, (_, b) => {
    const nameIdx = ((life - b) % 12 + 12) % 12;
    const stem = palaceStem(b);
    return {
      branch: b, branchName: BRANCHES[b],
      stem, stemName: STEMS[stem],
      gz: STEMS[stem] + BRANCHES[b],
      name: PALACES[nameIdx],
      desc: PALACE_DESC[PALACES[nameIdx]],
      isLife: b === life, isBody: b === body,
      ...stars[b],
    };
  });

  return {
    lunar, hourIdx, hourName: BRANCHES[hourIdx] + '時', gender,
    yearGZ, yearGZName: STEMS[yearStem] + BRANCHES[yearBranch], zodiac: ZODIAC[yearBranch],
    life, body, lifePalace: palaces[life], bodyPalace: palaces[body],
    ju: { num: juNum, name: juName, nayin: ny.name, element: ny.element },
    sihua: hua.map((s, i) => `${s}化${huaLabel[i]}`),
    palaces,
    grid: gridOrder(palaces),
  };
}

/** 傳統 4×4 排版：外圈十二地支（巳午未申 / 辰…酉 / 卯…戌 / 寅丑子亥） */
function gridOrder(palaces) {
  const order = [5, 6, 7, 8, 4, null, null, 9, 3, null, null, 10, 2, 1, 0, 11];
  return order.map(b => (b === null ? null : palaces[b]));
}

export const starDesc = (n) => MAIN_STARS[n] || '';
export { LUCKY, SHA };
