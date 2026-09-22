/* v0.12 的三項修正：觸覺能力偵測、分享碼容錯、時辰不詳 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from './_dom.js';
installDOM();

const { profileCode, parseProfileCode, codeError, PROFILE_CODE_PREFIX } = await import('../src/views/profile.js');
const { encodeCode } = await import('../src/ui.js');
const { isHourUnknown, caveatText, HOUR_DEPENDENT, HOUR_SAFE, LEVEL_TEXT, affected } = await import('../src/engines/unknown.js');
const { natalChart } = await import('../src/engines/astro.js');
const { ziweiChart } = await import('../src/engines/ziwei.js');
const { fourPillars } = await import('../src/engines/calendar.js');

const P = { id: 'x', surname: '王', givenName: '小明', gender: '男', city: '台北',
            birth: { y: 1990, m: 5, d: 20, h: 9, minute: 30 }, phone: '0912345678', secret: '不該外流' };

/* ── 分享碼 ───────────────────────────────── */
test('分享碼夠短，才不容易在通訊軟體裡被折行', () => {
  const code = profileCode(P);
  assert.ok(code.length < 120, `碼長 ${code.length}，太容易被折行`);
  assert.ok(code.startsWith(PROFILE_CODE_PREFIX));
});

test('分享碼：被通訊軟體弄亂之後仍然讀得回來', () => {
  const code = profileCode(P);
  const mangled = {
    '原樣': code,
    '中間折行': code.slice(0, 40) + '\n' + code.slice(40),
    '每 20 字換行': code.match(/.{1,20}/g).join('\n'),
    '前後空白': `  ${code}  \n`,
    '全形冒號': code.replace(':', '：'),
    '夾在訊息裡': `這是我的資料 ${code} 你貼進去就好`,
    '零寬字元': code.slice(0, 20) + '​' + code.slice(20),
    '缺前綴': code.replace(PROFILE_CODE_PREFIX, ''),
    '中間有空格': code.slice(0, 30) + ' ' + code.slice(30),
  };
  for (const [name, v] of Object.entries(mangled)) {
    const r = parseProfileCode(v);
    assert.ok(r, `${name}：讀不出來`);
    assert.equal(r.surname, '王', name);
    assert.equal(r.birth.y, 1990, name);
    assert.equal(r.birth.h, 9, name);
    assert.equal(r.city, '台北', name);
  }
});

test('分享碼：只帶推算需要的欄位', () => {
  const r = parseProfileCode(profileCode(P));
  assert.equal(r.secret, undefined, '夾帶了不該分享的欄位');
  assert.equal(r.phone, undefined, '夾帶了電話');
  assert.equal(r.id, undefined, '不該帶原本的 id');
});

test('分享碼：舊版 XJPRO1 仍然讀得進來', () => {
  const legacy = 'XJPRO1:' + encodeCode(JSON.stringify({
    app: 'xuanjian', kind: 'profile', v: 1,
    item: { surname: '陳', givenName: '小美', gender: '女', birth: { y: 1992, m: 11, d: 3, h: 20, minute: 10 } },
  }));
  const r = parseProfileCode(legacy);
  assert.ok(r, '舊版碼讀不出來');
  assert.equal(r.surname, '陳');
  assert.equal(r.birth.y, 1992);
});

test('分享碼：時辰不詳的標記會一起傳過去', () => {
  const unknown = { ...P, birth: { ...P.birth, hourUnknown: true } };
  const r = parseProfileCode(profileCode(unknown));
  assert.equal(r.birth.hourUnknown, true, '時辰不詳的標記掉了');
  // 有時辰的則不應多出這個欄位
  assert.equal(parseProfileCode(profileCode(P)).birth.hourUnknown, undefined);
});

test('分享碼：壞輸入一律擋下，並給得出原因', () => {
  for (const bad of ['', '   ', 'hello world', 'XJP2:', 'XJP2:亂碼', null, undefined,
                     'XJP2:' + encodeCode('[]'),
                     'XJP2:' + encodeCode('["x","y","z",0,0,0]'),
                     'XJPRO1:' + encodeCode('{"app":"other"}')]) {
    assert.equal(parseProfileCode(bad), null, `沒擋下：${String(bad).slice(0, 30)}`);
    assert.ok(codeError(bad).length > 4, '錯誤訊息太短');
  }
  assert.match(codeError(''), /先貼上/);
  assert.match(codeError('這段話裡沒有碼'), /找不到/);
});

/* ── 時辰不詳 ─────────────────────────────── */
test('時辰不詳的清單：等級合法、領域齊全、說明夠長', () => {
  assert.ok(HOUR_DEPENDENT.length >= 5);
  const areas = new Set(HOUR_DEPENDENT.map(x => x.area));
  for (const a of ['星盤', '紫微', '八字']) assert.ok(areas.has(a), `缺少${a}`);
  for (const x of HOUR_DEPENDENT) {
    assert.ok(LEVEL_TEXT[x.level], `${x.key} 的等級 ${x.level} 未定義`);
    assert.ok(x.what && x.why.length > 15, `${x.key} 說明太短`);
  }
  assert.ok(HOUR_SAFE.length >= 5);
  assert.equal(affected(['紫微']).length, 1);
  assert.equal(affected().length, HOUR_DEPENDENT.length);
});

test('清單說的「無法確定」是真的：掃過 24 小時看有幾種結果', () => {
  const base = { y: 1990, m: 5, d: 20, tz: 8, lat: 25.033, lon: 121.565 };
  const asc = new Set(), life = new Set(), hour = new Set(), sun = new Set();
  for (let h = 0; h < 24; h++) {
    asc.add(natalChart({ ...base, h }).ascendant.signName);
    life.add(ziweiChart({ ...base, h, gender: '男' }).lifePalace.branchName);
    hour.add(fourPillars({ ...base, h }).hour.name);
    sun.add(natalChart({ ...base, h }).sun.signName);
  }
  assert.equal(asc.size, 12, '上升應該十二種都有可能');
  assert.equal(life.size, 12, '紫微命宮應該十二種都有可能');
  assert.ok(hour.size >= 12, '時柱應該至少十二種');
  assert.equal(sun.size, 1, '太陽星座不該受時辰影響 —— 它被列在安全清單裡');
});

test('時辰不詳：警告文字涵蓋每一項，且要求 LLM 分辨可信度', () => {
  assert.equal(caveatText({ birth: { y: 1990, m: 5, d: 20, h: 9 } }), '', '有時辰就不該有警告');
  assert.equal(caveatText(null), '');
  const t = caveatText({ birth: { y: 1990, m: 5, d: 20, h: 12, hourUnknown: true } });
  assert.ok(t.length > 100);
  for (const x of HOUR_DEPENDENT) assert.ok(t.includes(x.what), `警告沒提到 ${x.what}`);
  for (const s of HOUR_SAFE) assert.ok(t.includes(s), `安全清單沒提到 ${s}`);
  assert.match(t, /不要把上升星座或紫微命宮當成確定的事實/);
});

test('isHourUnknown 只看標記，不猜', () => {
  assert.equal(isHourUnknown({ birth: { hourUnknown: true } }), true);
  assert.equal(isHourUnknown({ birth: { h: 12, minute: 0 } }), false, '剛好中午出生不該被當成不詳');
  assert.equal(isHourUnknown({}), false);
  assert.equal(isHourUnknown(null), false);
});

test('提示詞：時辰不詳時自動插入警告，且在輸出要求之前', async () => {
  const { compose } = await import('../src/prompt/builder.js');
  const { BUILTIN } = await import('../src/prompt/templates.js');
  const S = { promptLang: '繁體中文', promptTone: '溫和', promptDepth: '中等', promptFormat: '條列',
              promptDisclaimer: false, register: 'bai', tzOffset: 8 };
  const t = BUILTIN.find(x => x.body.includes('輸出要求'));
  const mk = (hourUnknown) => compose({
    template: t, settings: S, options: {}, extra: {},
    all: { profile: { birth: { y: 1990, m: 5, d: 20, h: 12, minute: 0, ...(hourUnknown ? { hourUnknown } : {}) } },
           base: { y: 1990, m: 5, d: 20, h: 12, minute: 0, tz: 8 } },
  });
  const withU = mk(true), without = mk(false);
  const i = withU.indexOf('沒有確切的出生時辰');
  assert.ok(i > 0, '沒有插入警告');
  assert.ok(i < withU.indexOf('輸出要求'), '警告被埋在輸出要求後面');
  assert.doesNotMatch(without, /沒有確切的出生時辰/, '有時辰時不該出現警告');
});
