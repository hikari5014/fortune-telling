/* 提示詞組裝與渲染 */
import { buildBlocks, todayInfo, BLOCK_META } from './context.js';

/** 把 {{var}} 取代掉；未知變數原樣保留 */
export function render(tpl, vars) {
  return String(tpl || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => {
    const v = vars[k];
    if (v === undefined || v === null || v === '') return vars.__strict ? '' : m;
    return String(v);
  });
}

/**
 * 產生最終提示詞
 * @param {object} o {template, all, settings, selected, options, extra}
 */
export function compose({ template, all, settings, selected = [], options = {}, extra = {} }) {
  const blocks = buildBlocks(all, settings);
  const chosen = selected.length ? selected : (template.blocks || []);
  const dataText = chosen
    .filter(k => blocks[k])
    .map(k => {
      const meta = BLOCK_META.find(b => b.key === k);
      return `【${meta ? meta.label : k}】\n${blocks[k]}`;
    })
    .join('\n\n');

  const t = todayInfo(settings);
  const p = all?.profile || {};
  // 語調：白話／文言。跟著設定頁的「語調」走，也可由 options 覆寫。
  const reg = options.register ?? settings.register ?? 'bai';
  const regName = reg === 'wen' ? '淺近文言' : '白話文';
  const vars = {
    ...blocks,
    data: dataText || '（未附帶命盤資料）',
    name: (p.surname || '') + (p.givenName || '') || '（未填）',
    surname: p.surname || '',
    surname_strokes: all?.naming?.surname?.map(c => c.strokes).join('+') || '',
    gender: p.gender || '未填',
    birth: all ? `${all.base.y}-${String(all.base.m).padStart(2, '0')}-${String(all.base.d).padStart(2, '0')} ${String(all.base.h).padStart(2, '0')}:${String(all.base.minute).padStart(2, '0')}` : '',
    lunar: all?.lunar ? `${all.lunar.year} 年 ${all.lunar.monthName}${all.lunar.dayName}` : '',
    location: p.city || settings.city,
    age: all ? (t.y - all.base.y + 1) : '',
    today: t.date,
    today_gz: t.gz ? `${t.gz.year.name}年 ${t.gz.month.name}月 ${t.gz.day.name}日` : '',
    lang: options.lang ?? settings.promptLang,
    register: regName,
    tone: options.tone ?? settings.promptTone,
    depth: options.depth ?? settings.promptDepth,
    format: options.format ?? settings.promptFormat,
    length: options.length ?? '中等（600–1200 字）',
    question: extra.question ? `\n我特別想知道：${extra.question}` : '',
    candidates: extra.candidates || '（未填）',
    goal: extra.goal || '整體運勢',
    chars: extra.chars || '',
    other: extra.other || '（未填寫第二個人的資料）',
    synastry: extra.synastry || '（未附帶本機合盤分析）',
    guainfo: extra.guainfo || '（未附帶方位資料，請先到「方位」頁）',
    dayinfo: extra.dayinfo || '（未附帶擇日資料，請先到「擇日」頁選一天）',
    divination: extra.divination || '（沒有卜卦或抽牌結果，請先到「卜卦」或「塔羅」頁面起卦）',
    stroke_combos: extra.strokeCombos || '（未指定）',
  };

  let body = render(template.body, vars);
  // 模板本身沒有 {{question}} 時，仍把使用者的問題接在後面，不讓它憑空消失
  const q = (extra.question || '').trim();
  if (q && !/\{\{\s*question\s*\}\}/.test(template.body)) {
    body += `\n\n我特別想知道：${q}`;
  }
  const regLine = reg === 'wen'
    ? '\n・請以**淺近文言**作答：典雅而不晦澀，句短意足；命理術語沿用本名，不必譯成白話。'
    : '\n・請以**白話文**作答：像對朋友說話，不要堆術語；非用不可的術語請先用一句話解釋。';
  body = body.trimEnd() + regLine;

  const pre = String(options.prefix ?? settings.promptPrefix ?? '').trim();
  const suf = String(options.suffix ?? settings.promptSuffix ?? '').trim();
  const disc = (options.disclaimer ?? settings.promptDisclaimer)
    ? '\n\n最後請加一行：「以上為命理觀點的參考，不構成醫療、法律或投資建議。」' : '';

  return [pre, body.trim(), suf].filter(Boolean).join('\n\n') + disc;
}

export const estTokens = (s) => Math.ceil([...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 1 : 0.3), 0));
export { BLOCK_META };
