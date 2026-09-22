/* 提示詞組裝、語調、分享碼 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from './_dom.js';
installDOM();

const { render, compose, estTokens } = await import('../src/prompt/builder.js');
const { BUILTIN, VARS } = await import('../src/prompt/templates.js');
const { BLOCK_META } = await import('../src/prompt/context.js');
const { encodeCode, decodeCode } = await import('../src/ui.js');
const { parseProfileCode, profileCode } = await import('../src/views/profile.js');

const SETTINGS = {
  promptLang: '繁體中文', promptTone: '溫和但直接', promptDepth: '中等',
  promptFormat: '條列', promptDisclaimer: false, register: 'bai',
  promptPrefix: '', promptSuffix: '', tzOffset: 8,
};
const build = (o = {}) => compose({ template: BUILTIN[0], all: null, settings: SETTINGS, options: {}, extra: {}, ...o });

test('變數渲染：已知的代入，未知的原樣保留', () => {
  assert.equal(render('你好 {{name}}', { name: '小明' }), '你好 小明');
  assert.equal(render('{{nope}}', {}), '{{nope}}');
  assert.equal(render('{{ name }}', { name: 'A' }), 'A', '應容許空白');
  assert.equal(render('{{a}}{{b}}', { a: '1', b: '2' }), '12');
});

test('內建模板：id 不重複，都有名稱與內容，用到的變數都在清單裡', () => {
  const ids = BUILTIN.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'id 有重複');
  const known = new Set(VARS.map(v => v.v));
  for (const t of BUILTIN) {
    assert.ok(t.name && t.body && t.category, `${t.id} 欄位不全`);
    for (const k of [...t.body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(m => m[1])) {
      assert.ok(known.has(k), `${t.id} 用了未定義的變數 {{${k}}}`);
    }
    for (const b of (t.blocks || [])) {
      assert.ok(BLOCK_META.some(x => x.key === b), `${t.id} 指定了不存在的資料積木 ${b}`);
    }
  }
});

test('問題不會憑空消失：模板沒有 {{question}} 也會接在後面', () => {
  const noQ = { ...BUILTIN[0], body: '沒有佔位符' };
  const out = compose({ template: noQ, all: null, settings: SETTINGS, options: {}, extra: { question: '今年適合轉職嗎' } });
  assert.match(out, /今年適合轉職嗎/);
  // 有佔位符時不會重複
  const withQ = { ...BUILTIN[0], body: '{{question}}' };
  const out2 = compose({ template: withQ, all: null, settings: SETTINGS, options: {}, extra: { question: '重複測試' } });
  assert.equal((out2.match(/重複測試/g) || []).length, 1, '問題被放了兩次');
});

test('聚焦項目插在「輸出要求」之前，不是附在最後', () => {
  const t = BUILTIN.find(x => x.body.includes('輸出要求'));
  const out = compose({ template: t, all: null, settings: SETTINGS, options: {}, extra: { focus: '夫妻宮：天同、太陰' } });
  const iFocus = out.indexOf('夫妻宮：天同、太陰');
  const iOut = out.indexOf('輸出要求');
  assert.ok(iFocus > 0, '聚焦內容不見了');
  assert.ok(iFocus < iOut, '聚焦內容被埋在輸出要求後面');
});

test('語調：白話與文言各自附上明確的輸出要求', () => {
  assert.match(build({ settings: { ...SETTINGS, register: 'bai' } }), /白話文/);
  assert.match(build({ settings: { ...SETTINGS, register: 'wen' } }), /淺近文言/);
  // options 可以覆寫設定
  assert.match(build({ settings: { ...SETTINGS, register: 'bai' }, options: { register: 'wen' } }), /淺近文言/);
});

test('自訂變數可用，但同名時內建的優先', () => {
  const t = { ...BUILTIN[0], body: '{{myjob}} / {{lang}}' };
  const out = compose({ template: t, all: null, settings: SETTINGS, options: {}, extra: { custom: { myjob: '工程師', lang: '被蓋掉' } } });
  assert.match(out, /工程師/);
  assert.match(out, /繁體中文/);
  assert.doesNotMatch(out, /被蓋掉/, '自訂變數不該覆蓋內建的');
});

test('前綴、後綴與免責聲明', () => {
  const out = compose({ template: BUILTIN[0], all: null, options: {}, extra: {},
    settings: { ...SETTINGS, promptPrefix: '【前綴】', promptSuffix: '【後綴】', promptDisclaimer: true } });
  assert.ok(out.startsWith('【前綴】'), '前綴不在最前面');
  assert.match(out, /【後綴】/);
  assert.match(out, /不構成醫療、法律或投資建議/);
});

test('token 估計是正數且隨長度遞增', () => {
  assert.ok(estTokens('短') > 0);
  assert.ok(estTokens('a'.repeat(1000)) > estTokens('a'.repeat(100)));
});

test('分享碼：往返一致，含中文與特殊字元', () => {
  for (const s of ['王小明', '{"a":1,"b":"中文 test ✓"}', '', 'a'.repeat(5000)]) {
    assert.equal(decodeCode(encodeCode(s)), s, `往返失敗：${s.slice(0, 20)}`);
  }
  // URL 安全：不含 + / =
  assert.doesNotMatch(encodeCode('~~~???>>>'), /[+/=]/);
});

test('出生資料分享碼：只帶推算需要的欄位', () => {
  const p = {
    id: 'p1', surname: '王', givenName: '小明', gender: '男',
    birth: { y: 1990, m: 5, d: 20, h: 9, minute: 30 }, city: '台北',
    phone: '0912345678', strokeOverrides: { 王: 5 }, secret: '不該被帶走',
  };
  const item = parseProfileCode(profileCode(p));
  assert.ok(item, '自己編的碼竟然解不開');
  assert.equal(item.surname, '王');
  assert.equal(item.birth.y, 1990);
  assert.equal(item.city, '台北');
  assert.equal(item.secret, undefined, '夾帶了不該分享的欄位');
  assert.equal(item.phone, undefined, '夾帶了電話');
  assert.equal(item.id, undefined, '不該帶原本的 id');
});

test('出生資料分享碼：壞碼一律擋下', () => {
  for (const bad of ['', 'XJPRO1:', 'XJPRO1:亂碼', 'hello world', null, undefined,
                     'XJPRO1:' + encodeCode('{"app":"other"}'),
                     'XJPRO1:' + encodeCode('{"app":"xuanjian","kind":"profile","item":{}}'),
                     'XJPRO1:' + encodeCode('{"app":"xuanjian","kind":"profile","item":{"birth":{"y":"x"}}}')]) {
    assert.equal(parseProfileCode(bad), null, `沒擋下：${String(bad).slice(0, 30)}`);
  }
});

test('變數面板：不重複，且涵蓋所有模板用到的變數與資料積木', () => {
  const keys = VARS.map(v => v.v);
  assert.equal(new Set(keys).size, keys.length,
    '變數面板有重複：' + keys.filter((k, i) => keys.indexOf(k) !== i).join('、'));
  for (const v of VARS) assert.ok(v.d, `${v.v} 沒有說明`);
  const listed = new Set(keys);
  for (const b of BLOCK_META) assert.ok(listed.has(b.key), `資料積木 ${b.key} 沒列在變數面板，使用者插不進去`);
});

test('資料積木：key 不重複，都有標籤與說明', () => {
  const keys = BLOCK_META.map(b => b.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const b of BLOCK_META) assert.ok(b.label && b.hint, `${b.key} 欄位不全`);
});
