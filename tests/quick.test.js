/* 一鍵提示詞：功能頁按一下就把提示詞組好、複製走。
   這裡要守住兩件事：
   1. 一鍵組出來的東西，跟產生器一開啟、什麼都還沒調時完全一樣 ——
      不然兩條路會給出不同的提示詞，使用者無從判斷哪個才算數。
   2. 每一個功能頁帶過來的暫存資料（卦象、牌面、籤詩、擇日、方位）
      都真的被塞進提示詞，而不是留下「請先到某某頁」的預設句。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const { store, DEFAULT_SETTINGS } = await import('../src/store.js');
const { computeAll } = await import('../src/prompt/context.js');
const { compose } = await import('../src/prompt/builder.js');
const { quickBuild, draftExtras, parseQuery, templateById } = await import('../src/prompt/quick.js');

const profile = { id: 'p1', surname: '王', givenName: '大明', gender: '男', city: '台北',
  lat: 25.033, lon: 121.5654, tz: 8, birth: { y: 1990, m: 5, d: 20, h: 9, minute: 30 } };
const settings = store.settings;
const all = computeAll(profile, settings);

test('預設關閉 —— 要細調的人才去設定裡打開', () => {
  assert.equal(DEFAULT_SETTINGS.advancedPrompt, false);
});

test('網址參數拆得出來，前面有沒有 # 都一樣', () => {
  assert.deepEqual(parseQuery('/prompt?t=tarot&q=abc'), { t: 'tarot', q: 'abc' });
  assert.deepEqual(parseQuery('#/prompt?t=iching'), { t: 'iching' });
  assert.deepEqual(parseQuery('/prompt'), {});
});

test('模板不存在就回 null，讓呼叫端退回產生器', () => {
  assert.equal(quickBuild({ t: 'no-such-template' }, { all, settings }), null);
  assert.equal(quickBuild({}, { all, settings }), null);
});

test('一鍵組出來的，跟產生器的預設值一字不差', () => {
  const tpl = templateById('overview');
  const mine = quickBuild({ t: 'overview' }, { all, settings }).text;
  // 產生器一開啟時的狀態：選模板自己的積木、輸出控制全走設定值、補充欄位都空的
  const theirs = compose({
    template: tpl, all, settings, selected: tpl.blocks || [], options: {},
    extra: {
      custom: {}, focus: '', question: '', chars: '', strokeCombos: '',
      other: '', synastry: '', dayinfo: '', guainfo: '', divination: '',
    },
  });
  assert.equal(mine, theirs);
});

test('使用者問的問題會被帶進去', () => {
  const t = quickBuild({ t: 'iching', q: '今年適不適合轉職？' }, { all, settings }).text;
  assert.ok(t.includes('今年適不適合轉職？'), '問題不見了');
});

test('每個占卜頁的暫存資料都對到正確的模板', () => {
  const d = { dayPick: 'DAY', guaInfo: 'GUA', tarotResult: 'TAROT', ichingResult: 'ICHING', qianResult: 'QIAN' };
  assert.equal(draftExtras('day-pick', d).dayinfo, 'DAY');
  assert.equal(draftExtras('direction', d).guainfo, 'GUA');
  assert.equal(draftExtras('tarot', d).divination, 'TAROT');
  assert.equal(draftExtras('iching', d).divination, 'ICHING');
  assert.equal(draftExtras('qian', d).divination, 'QIAN');
  // 對錯模板就不該拿到別人的資料
  assert.equal(draftExtras('tarot', d).dayinfo, '');
  assert.equal(draftExtras('overview', d).divination, '');
});

test('起完卦、抽完牌之後，結果真的進了提示詞', () => {
  const cases = [
    ['iching', 'ichingResult', '本卦：雷水解'],
    ['tarot', 'tarotResult', '第一張：愚者（正位）'],
    ['qian', 'qianResult', '第三十八籤 中吉'],
    ['day-pick', 'dayPick', '2026-09-23 宜嫁娶'],
    ['direction', 'guaInfo', '本命卦：坎（東四命）'],
  ];
  for (const [id, key, text] of cases) {
    store.setDraft(key, text);
    const out = quickBuild({ t: id }, { all, settings }).text;
    assert.ok(out.includes(text), `${id} 沒帶到 ${key}`);
    assert.ok(!/請先到「?(卜卦|塔羅|方位|擇日)/.test(out), `${id} 還留著「請先到某某頁」的預設句`);
    store.setDraft(key, '');
  }
});

test('產生器與一鍵共用同一份暫存資料對照表', () => {
  // 兩邊各寫一份的話，加新占卜時一定會漏掉一邊
  const view = readFileSync('src/views/prompt.js', 'utf8');
  assert.match(view, /draftExtras\(active\.id\)/);
  assert.ok(!view.includes("store.drafts.tarotResult"), '產生器裡還留著自己的一份對照表');
});

test('功能頁不再自己跳網址，一律走 askPrompt', () => {
  for (const f of ['tarot', 'iching', 'qian', 'daily', 'direction']) {
    const src = readFileSync(`src/views/${f}.js`, 'utf8');
    assert.match(src, /askPrompt\(/, `${f}.js 沒有走 askPrompt`);
    assert.ok(!/location\.hash\s*=\s*['"`]#?\/prompt/.test(src),
      `${f}.js 還在自己跳提示詞頁，會繞過「進階提示詞」的設定`);
  }
});
