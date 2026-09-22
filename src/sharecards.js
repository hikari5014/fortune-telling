/* 把各引擎的結果組成「分享長圖」的文件描述。畫圖的部分在 share.js。 */
import { today } from './share.js';
import { PURPOSES, purposeName, hoursOf } from './engines/daily.js';

const who = (p) => (p?.surname || '') + (p?.givenName || '') || '未命名';
const pad = (n) => String(n).padStart(2, '0');

/* ── 命盤 ─────────────────────────────────────────── */
export function natalCard(all, profile) {
  const b = all.bazi, a = all.astro;
  const blocks = [
    { t: 'eyebrow', text: 'NATAL CHART' },
    { t: 'title', text: `${who(profile)} 的命盤` },
    { t: 'p', text: `${all.base.y}-${pad(all.base.m)}-${pad(all.base.d)} ${pad(all.base.h)}:${pad(all.base.minute)}　${profile.city || ''}`, dim: true },
  ];
  if (a) {
    blocks.push({ t: 'big', text: `${a.sun.signName}　${a.moon.signName}　${a.ascendant.signName}`, sub: '太陽　月亮　上升', size: 72 });
  }
  if (b) {
    blocks.push({ t: 'h', text: '四柱八字' });
    blocks.push({ t: 'big', text: `${b.year.name} ${b.month.name} ${b.day.name} ${b.hour.name}`, size: 68 });
    blocks.push({ t: 'kv', items: [
      ['生肖', b.zodiac], ['日主', `${b.dayMaster}（${b.dayMasterEl}）`],
      ['節氣月令', b.jieqi], ['時辰', b.hourName],
      ['日柱納音', b.day.nayin.name],
    ] });
  }
  if (all.lunar) blocks.push({ t: 'kv', items: [['農曆', `${all.lunar.year} 年 ${all.lunar.monthName}${all.lunar.dayName}`]] });
  if (all.ziwei) {
    blocks.push({ t: 'h', text: '紫微' });
    blocks.push({ t: 'kv', items: [
      ['命宮', `${all.ziwei.lifePalace.branchName}宮（${all.ziwei.lifePalace.gz}）`],
      ['身宮', `${all.ziwei.bodyPalace.branchName}宮`],
      ['五行局', all.ziwei.ju?.name || '—'],
      ['命宮主星', (all.ziwei.lifePalace.main || []).join('、') || '無主星'],
      ['四化', (all.ziwei.sihua || []).join('　')],
    ] });
  }
  return { blocks, date: today(), footer: '玄鑑 XUAN JIAN' };
}

/* ── 今日宜忌 ─────────────────────────────────────── */
export function dayCard(info, rating, purpose) {
  const hs = hoursOf(info);
  const best = [...hs].sort((a, b) => b.score - a.score).slice(0, 3);
  const j = info.jianchu;
  return {
    blocks: [
      { t: 'eyebrow', text: 'DAY PICKER' },
      { t: 'title', text: `${info.date}　星期${'日一二三四五六'[info.weekday]}` },
      { t: 'big', text: `${info.gz.day.name}日`, sub: `${info.gz.year.name}年 ${info.gz.month.name}月${info.lunar ? `　農曆 ${info.lunar.monthName}${info.lunar.dayName}` : ''}` },
      { t: 'h', text: `建除　${j.name}日` },
      { t: 'p', text: `${j.toneText}。${j.text}` },
      { t: 'tags', label: '宜', items: j.good.map(purposeName), solid: true },
      { t: 'tags', label: '忌', items: j.bad.length ? j.bad.map(purposeName) : ['—'] },
      { t: 'h', text: '好時辰' },
      { t: 'kv', items: best.map(h => [`${h.name}　${h.range}`, `${h.shen}　${h.score}`]) },
      { t: 'h', text: '其他' },
      { t: 'kv', items: [
        ['沖煞', `${info.chong.text}　煞${info.sha}`],
        [purposeName(purpose), `${rating.score} 分　${rating.level}`],
      ] },
      { t: 'p', text: `彭祖百忌：${info.pengzu.join('；')}`, dim: true },
      ...(info.special.length ? [{ t: 'p', text: info.special.map(s => `${s.name}：${s.text}`).join('\n'), dim: true }] : []),
    ],
    date: today(), footer: '玄鑑 · 擇日',
  };
}

/* ── 籤詩 ─────────────────────────────────────────── */
export function qianCard(poem, question, setName, source) {
  return {
    blocks: [
      { t: 'eyebrow', text: 'ORACLE POEM' },
      { t: 'title', text: `第 ${poem.n} 籤　${poem.gz}　${poem.luck}` },
      { t: 'poem', lines: poem.lines },
      { t: 'rule' },
      ...(poem.gist ? [{ t: 'p', text: poem.gist }] : []),
      ...(question ? [{ t: 'h', text: '所問' }, { t: 'p', text: question }] : []),
      { t: 'gap', h: 10 },
      { t: 'p', text: `籤詩集：${setName}\n來源：${source}`, dim: true },
    ],
    date: today(), footer: '玄鑑 · 求籤',
  };
}

/* ── 方位 ─────────────────────────────────────────── */
export function guaCard(ming, dirs, zhai, match) {
  const good = dirs.filter(d => d.kind === '吉');
  const bad = dirs.filter(d => d.kind === '凶');
  return {
    blocks: [
      { t: 'eyebrow', text: 'EIGHT MANSIONS' },
      { t: 'title', text: '本命卦與八方位' },
      { t: 'big', text: `${ming.gua.sym} ${ming.name}`, sub: `洛書 ${ming.luoshu}　${ming.group}命　${ming.gua.el}` },
      { t: 'h', text: '四吉方' },
      { t: 'kv', items: good.map(d => [`${d.dir}　${d.gua}卦`, `${d.star}`]) },
      { t: 'p', text: good.map(d => `${d.star}（${d.dir}）：${d.use}`).join('\n') },
      { t: 'h', text: '四凶方' },
      { t: 'kv', items: bad.map(d => [`${d.dir}　${d.gua}卦`, `${d.star}`]) },
      ...(zhai ? [
        { t: 'h', text: '住宅' },
        { t: 'kv', items: [['坐向', zhai.label], ['宅卦', `${zhai.gua}宅（${zhai.group}宅）`]] },
        { t: 'p', text: match.text },
      ] : []),
    ],
    date: today(), footer: '玄鑑 · 方位',
  };
}

/* ── 解讀紀錄 ─────────────────────────────────────── */
/** 把 Markdown 拆成長圖的區塊：標題變小標，其餘成段 */
function mdBlocks(text) {
  const out = [];
  let buf = [];
  const flush = () => { if (buf.length) { out.push({ t: 'p', text: buf.join('\n') }); buf = []; } };
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); out.push({ t: 'h', text: h[2].replace(/\*\*/g, '') }); continue; }
    if (!line.trim()) { flush(); continue; }
    buf.push(line
      .replace(/^\s*[-*]\s+/, '・')
      .replace(/^\s*(\d+)\.\s+/, '$1. ')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^>\s?/, '　'));
  }
  flush();
  return out;
}

export function recordCard(rec) {
  return {
    blocks: [
      { t: 'eyebrow', text: 'READING' },
      { t: 'title', text: rec.templateName || '解讀' },
      { t: 'p', text: `${rec.who || ''}${rec.who ? '　' : ''}${new Date(rec.createdAt).toLocaleDateString('zh-TW')}`, dim: true },
      { t: 'rule' },
      ...mdBlocks(rec.content),
    ],
    date: today(), footer: '玄鑑 · 解讀紀錄',
    note: '內容由外部 LLM 產生，僅供文化娛樂與自我探索參考',
  };
}
