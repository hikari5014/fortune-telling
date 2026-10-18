/* 分享卡：每種功能都組得出內容、有 QR 連結回 App、不會偷偷印出私事 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const S = await import('../src/sharespecs.js');
const { STYLES, MOTTO } = await import('../src/sharecard.js');
const { GUANYIN_SET } = await import('../src/data/guanyin.js');
const { godOf } = await import('../src/temple/gods.js');
const O = await import('../src/engines/omikuji.js');
const T = await import('../src/engines/tarot.js');
const I = await import('../src/engines/iching.js');

const specs = () => ({
  qian: S.qianSpec(GUANYIN_SET.poems[72], GUANYIN_SET, godOf('guanyin'), '要不要換工作'),
  omikuji: S.omikujiSpec(O.slipOf(32), O.banOf(32), ''),
  tarot: S.tarotSpec({ cards: [T.dailyCard('x')], spread: { name: '今日一張' } }, '', c => `assets/tarot/${c.img}.webp`),
  iching: S.ichingSpec(I.reading([1, 0, 1, 1, 0, 0], [2]), [1, 0, 1, 1, 0, 0], [2], ''),
  wish: S.wishSpec({ spot: 'pool', gold: false, wish: '考上' }, '願望收到了'),
  natal: S.natalSpec({ sun: { signName: '雙子座' }, moon: { signName: '天蠍座' }, ascendant: { signName: '獅子座' } }, true),
  goshuin: S.goshuinSpec('令和八年十月十八日'),
  temple: S.templeSpec(godOf('mazu'), { poem: '第十二首（上吉）', offerings: ['鮮花'] }),
});

test('三種風格、一句宗旨', () => {
  assert.deepEqual(STYLES.map(s => s.k), ['star', 'paper', 'mag']);
  assert.match(MOTTO, /煩惱/);
});

test('每種功能的卡都有標題、主角、行動呼籲，QR 連回 App 的同一個功能', () => {
  const want = { qian: '#/temple?god=guanyin', omikuji: '#/omikuji', tarot: '#/tarot', iching: '#/iching', wish: '#/wish', natal: '#/astro', goshuin: '#/omikuji', temple: '#/temple?god=mazu' };
  for (const [k, s] of Object.entries(specs())) {
    assert.ok(s.title && s.hero?.type && s.cta, k);
    assert.ok(s.link.endsWith(want[k]), `${k}: ${s.link}`);
  }
});

test('私事只放在 ask（要使用者勾才印）：所問、願望', () => {
  const s = specs();
  assert.equal(s.qian.ask, '所問：要不要換工作');
  assert.equal(s.wish.ask, '願望：考上');
  for (const [k, sp] of Object.entries(s)) {
    const { ask, ...rest } = sp;
    assert.ok(!JSON.stringify(rest).includes('考上') && !JSON.stringify(rest).includes('換工作'), `${k} 在 ask 以外印了私事`);
  }
  const ui = readFileSync(new URL('../src/shareui.js', import.meta.url), 'utf8');
  assert.match(ui, /withAsk = false/, '預設不印');
});

test('時辰不詳就不放上升；易經有動爻才有之卦', () => {
  const s = specs();
  assert.equal(s.natal.hero.items.length, 2);
  assert.equal(s.iching.hero.to.lines.join(''), '100100');
  assert.equal(S.ichingSpec(I.reading([1, 1, 1, 1, 1, 1], []), [1, 1, 1, 1, 1, 1], [], '').hero.to, null);
});

test('各結果頁都接上了分享卡', () => {
  for (const f of ['views/qian.js', 'rites/kuji.js', 'views/tarot.js', 'views/iching.js', 'views/astro.js', 'rites/haiden.js', 'views/temple.js', 'views/wish.js', 'views/home.js']) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.match(src, /openShare\(/, f);
  }
});
