/* 一鍵提示詞：不進產生器，就地把提示詞組好。

   產生器（views/prompt.js）是給想調語氣、換模板、加自訂變數的人用的。
   可是大部分時候使用者要的只有一件事：把提示詞複製走，貼到 LLM。
   所以功能頁上的「請 LLM 解讀」預設走這裡 —— 用設定頁裡的預設值直接組好、
   複製、跳到貼回頁；要細調的人到設定把「進階提示詞」打開，就回到產生器。

   這支檔案同時是「第二方」（合盤、面談）那幾個函式的家，
   產生器也從這裡拿，兩邊才不會各算各的。 */
import { compose } from './builder.js';
import { buildBlocks, computeAll } from './context.js';
import { BUILTIN } from './templates.js';
import { store } from '../store.js';
import { synastry } from '../engines/synastry.js';

export const allTemplates = () => [...store.templates, ...BUILTIN];
export const templateById = (id) => allTemplates().find(t => t.id === id) || null;

/** 第二方：別人的出生資料，或公司／團隊的檔案 */
export const findParty = (id) => store.profiles.find(x => x.id === id) || store.orgs.find(x => x.id === id) || null;

/** 算第二方的盤。公司沒有性別，紫微那一套用不上，算完就拿掉。 */
export function partyChart(p, settings) {
  if (!p) return null;
  const isOrg = store.orgs.some(o => o.id === p.id);
  const A = computeAll({ gender: '不設定', ...p, ...(isOrg ? { org: true } : {}) }, settings);
  return isOrg ? { ...A, ziwei: null, limits: null, luck: null, naming: null } : A;
}

export function synastryText(A, B) {
  try {
    const r = synastry(A, B);
    const lines = [`綜合契合度：${r.score}/100（${r.level}）`];
    if (r.astro) {
      lines.push('', '【星盤相位】', ...r.astro.items.map(i => `${i.label}，差 ${i.orb.toFixed(1)}°（${i.text}）`));
      if (!r.astro.items.length) lines.push('日月升中天之間無主要相位。');
    }
    if (r.bazi) {
      lines.push('', `【八字互動】日主 ${r.bazi.dayMasters}`,
        ...r.bazi.items.map(i => `${i.kind}：${i.pair} — ${i.text}`));
      if (!r.bazi.items.length) lines.push('四柱之間無明顯刑沖合害。');
    }
    if (r.ziwei) {
      lines.push('', '【紫微對照】',
        `命宮關係：${r.ziwei.lifeRel.kind} — ${r.ziwei.lifeRel.text}`,
        `B 的命宮落在 A 盤的「${r.ziwei.bInA.name}」宮：${r.ziwei.bInA.main.join('、') || '空宮'}`,
        `A 的命宮落在 B 盤的「${r.ziwei.aInB.name}」宮：${r.ziwei.aInB.main.join('、') || '空宮'}`,
        `五行局：${r.ziwei.juPair}`);
    }
    if (r.tips.length) lines.push('', '【自動判讀】', ...r.tips.map(t => '・' + t));
    return lines.join('\n');
  } catch { return ''; }
}

/** 哪些模板要吃哪一份暫存資料。產生器裡是同一份對照表。 */
export function draftExtras(id, drafts = store.drafts) {
  return {
    dayinfo: id === 'day-pick' ? (drafts.dayPick || '') : '',
    guainfo: id === 'direction' ? (drafts.guaInfo || '') : '',
    divination: id === 'tarot' ? (drafts.tarotResult || '')
      : id === 'iching' ? (drafts.ichingResult || '')
        : id === 'qian' ? (drafts.qianResult || '') : '',
  };
}

/** 把 '/prompt?t=tarot&q=...' 的查詢字串拆成物件 */
export const parseQuery = (target) =>
  Object.fromEntries(new URLSearchParams(String(target).split('?')[1] || ''));

/**
 * 依功能頁帶過來的參數，直接組出最終提示詞。
 * 用的是設定頁的預設值 —— 跟產生器一開啟、什麼都還沒動時算出來的東西一模一樣。
 * @param {object} q     網址參數 {t, q, focus, other, chars, combos}
 * @param {object} o     {all 目前對象的盤, settings}
 * @returns {{template: object, text: string}|null} 找不到模板時回 null
 */
export function quickBuild(q, { all = null, settings = store.settings } = {}) {
  const tpl = templateById(q.t);
  if (!tpl) return null;

  const d = store.drafts;
  const otherAll = q.other ? partyChart(findParty(q.other), settings) : null;
  const focusItem = q.focus ? (d.focus || null) : null;

  const extra = {
    custom: d.customVars || {},
    focus: focusItem ? `【${focusItem.label}】\n${focusItem.text}` : '',
    question: String(q.q || '').trim(),
    chars: String(q.chars || '').trim(),
    strokeCombos: String(q.combos || '').trim(),
    other: otherAll ? Object.values(buildBlocks(otherAll, settings)).join('\n\n') : '',
    synastry: otherAll && all ? synastryText(all, otherAll) : '',
    ...draftExtras(tpl.id, d),
  };

  const out = compose({
    template: tpl, all, settings,
    selected: tpl.blocks || [], options: {}, extra,
  });
  // 設定頁的「額外指示」草稿：產生器會接在最後，這裡也一樣，兩邊結果才對得起來
  const note = String(d.promptExtra || '').trim();
  return { template: tpl, text: note ? `${out}\n\n${note}` : out };
}
