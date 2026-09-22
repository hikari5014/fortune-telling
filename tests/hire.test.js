/* 快速新增、公司檔案與面談相處風格 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from './_dom.js';
installDOM();
const { SHICHEN } = await import('../src/quickadd.js');
const { CITIES, cityByName } = await import('../src/data/cities.js');
const { workNotes } = await import('../src/views/hire.js');
const { BUILTIN } = await import('../src/prompt/templates.js');
const { computeAll, buildBlocks } = await import('../src/prompt/context.js');
const { synastry } = await import('../src/engines/synastry.js');

const S = { tzOffset: 8, lat: 25.033, lon: 121.5654, city: '台北', register: 'bai' };
const PERSON = { id: 'p', surname: '王', givenName: '大明', gender: '男', city: '台北',
  lat: 25.033, lon: 121.5654, tz: 8, birth: { y: 1992, m: 11, d: 20, h: 8, minute: 0 } };
const ORG = { id: 'o', org: true, label: '玄鑑科技', gender: '不設定', city: '台北',
  lat: 25.033, lon: 121.5654, tz: 8, birth: { y: 2015, m: 3, d: 2, h: 12, minute: 0 } };

test('十二時辰的代表時刻兩兩相差兩小時', () => {
  assert.equal(SHICHEN.length, 12);
  const hours = SHICHEN.map(x => x[1]);
  assert.deepEqual(hours, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
  assert.equal(new Set(SHICHEN.map(x => x[0])).size, 12);
});

test('城市表每一筆都有合理的經緯度與時區', () => {
  for (const [name, lat, lon, tz] of CITIES) {
    assert.ok(name.length >= 2, name);
    assert.ok(lat >= -90 && lat <= 90, name);
    assert.ok(lon >= -180 && lon <= 180, name);
    assert.ok(tz >= -12 && tz <= 14, name);
    // 時區大致要對得上經度（每 15 度一小時，容許兩小時的行政誤差）
    assert.ok(Math.abs(tz - lon / 15) <= 2.2, `${name} 時區 ${tz} 與經度 ${lon} 差太多`);
  }
  assert.equal(cityByName('台北')[0], '台北');
  assert.equal(cityByName('火星')[0], '台北', '查不到就退回第一筆');
});

test('公司檔案的基本資料寫「名稱／成立日期」而不是「姓名／生日」', () => {
  const B = buildBlocks(computeAll(ORG, S), S);
  assert.match(B.basic, /名稱：玄鑑科技/);
  assert.match(B.basic, /成立日期：2015-03-02/);
  assert.ok(!/^姓名：/m.test(B.basic), B.basic);
  assert.ok(!/^性別：/m.test(B.basic), B.basic);
  assert.match(B.basic, /不是人/);
  // 八字照算
  assert.match(B.bazi, /四柱八字/);
});

test('人跟公司合得出分數，而且不會用到紫微', () => {
  const P = computeAll(PERSON, S);
  const O = { ...computeAll(ORG, S), ziwei: null };
  const r = synastry(P, O);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.equal(r.ziwei, null, '公司沒有性別，紫微那一套不該套上去');
  assert.ok(r.bazi && r.astro, '八字與星盤都要算得出來');
});

test('相處風格至少給得出一條，而且講的是工作不是感情', () => {
  const P = computeAll(PERSON, S);
  const O = { ...computeAll(ORG, S), ziwei: null };
  const notes = workNotes(synastry(P, O));
  assert.ok(notes.length >= 1);
  for (const [tag, text] of notes) {
    assert.ok(tag && tag.length <= 4, tag);
    assert.ok(text.length > 12, text);
    assert.ok(!/夫妻|同住|感情|婚/.test(text), `工作情境不該冒出感情用語：${text}`);
  }
});

test('面談模板把界線寫進提示詞裡', () => {
  const t = BUILTIN.find(x => x.id === 'hire');
  assert.ok(t, '找不到 hire 模板');
  for (const must of ['不要回答該不該錄用', '就業服務法', '相處', '{{other}}', '{{synastry}}', '{{data}}']) {
    assert.ok(t.body.includes(must), `模板少了「${must}」`);
  }
  // 不該引導 LLM 去評能力
  assert.ok(!/適任|錄取建議|推薦錄用/.test(t.body.replace(/不要回答[^。]*。/g, '')), t.body);
});

test('面談頁不會在沒有公司檔案時就炸掉', async () => {
  const view = (await import('../src/views/hire.js')).default;
  const out = String(view.render({ settings: S, query: {}, profile: null, all: null }));
  assert.match(out, /就業服務法/);
  assert.match(out, /公司／團隊/);
});
