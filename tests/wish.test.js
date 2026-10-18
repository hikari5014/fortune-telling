/* 許願池與福幣錢包：落點跟瞄準一致、月盞投得進但不容易、錢包的帳算得對 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const P = await import('../src/engines/pool.js');
const W = await import('../src/wallet.js');
const pay = await import('../src/payments.js');
const { store } = await import('../src/store.js');
const view = (await import('../src/views/wish.js')).default;

test('瞄準預覽的落點，就是解出來的目標（空中沒有亂數）', () => {
  for (const yaw of [-1, -0.4, 0, 0.3, 1]) for (const power of [0, 0.25, 0.5, 0.8, 1]) {
    const t = P.targetOf({ yaw, power });
    const { land } = P.predict(P.launchFor(t));
    assert.ok(Math.hypot(land.x - t.x, land.z - t.z) < 0.03, `yaw ${yaw} power ${power}`);
  }
});

test('同樣的瞄準，兩次投出去的結果一模一樣', () => {
  const v = P.launchFor(P.targetOf({ yaw: 0.2, power: 0.3 }));
  const a = P.simulate(v).coin, b = P.simulate(v).coin;
  assert.deepEqual([a.spot, a.p.x, a.p.z], [b.spot, b.p.x, b.p.z]);
});

test('落進水裡的硬幣會沉到池底、停在池子裡面', () => {
  for (const [yaw, power] of [[0, 0.2], [0.3, 0.35], [-0.5, 0.5], [0.1, 0.7]]) {
    const { coin, events } = P.simulate(P.launchFor(P.targetOf({ yaw, power })));
    assert.equal(coin.spot, 'pool', `${yaw},${power}`);
    assert.ok(events.some(e => e.type === 'splash'));
    assert.ok(Math.abs(coin.p.y + P.POOL.DEPTH) < 0.01, '平躺在池底');
    assert.ok(Math.hypot(coin.p.x, coin.p.z) < P.POOL.R, '在池子裡');
  }
});

test('太近、太遠都會掉到池外', () => {
  assert.equal(P.simulate(P.launchFor(P.targetOf({ yaw: 0, power: 0 }))).coin.spot, 'miss');
  assert.equal(P.simulate(P.launchFor(P.targetOf({ yaw: 0, power: 1 }))).coin.spot, 'miss');
});

test('月盞投得進，但要瞄得準：能投進的範圍只占一小塊', () => {
  let hit = 0, total = 0;
  for (let yaw = -1; yaw <= 1; yaw += 0.02) for (let power = 0; power <= 1; power += 0.02) {
    total++;
    if (P.simulate(P.launchFor(P.targetOf({ yaw, power })), { dt: 1 / 120 }).coin.spot === 'bowl') hit++;
  }
  assert.ok(hit > 0, '一定要投得進');
  assert.ok(hit / total < 0.03, `太好中了：${hit}/${total}`);
});

test('落點分區：水、石緣、池外', () => {
  assert.equal(P.zoneOf({ x: 0, z: 0.5 }), 'water');
  assert.equal(P.zoneOf({ x: 0, z: 1.1 }), 'rim');
  assert.equal(P.zoneOf({ x: 0, z: 1.6 }), 'out');
});

beforeEach(() => { localStorage.removeItem('xj.wallet'); });

test('福幣：每天送一次，扣不夠就不扣，退回會加回來', () => {
  assert.equal(W.balance(), 0);
  assert.equal(W.claimDaily('2026-10-18'), W.DAILY);
  assert.equal(W.claimDaily('2026-10-18'), 0, '同一天不能領兩次');
  assert.equal(W.balance(), W.DAILY);
  assert.equal(W.spend(W.DAILY + 1, 'x'), false);
  assert.equal(W.balance(), W.DAILY, '不夠的時候一枚都不扣');
  assert.equal(W.spend(2, '許願池'), true);
  W.refund(1, '退回');
  assert.equal(W.balance(), W.DAILY - 1);
  assert.equal(W.claimDaily('2026-10-19'), W.DAILY, '隔天又可以領');
  assert.equal(store.wallet.log[0].what, '每日福幣');
});

test('贊助儲值現在是示範：加幣、標明未扣款；錢包不進備份', async () => {
  const r = await W.buy('p120');
  assert.equal(r.ok, true); assert.equal(r.symbolic, true);
  assert.equal(W.balance(), 120);
  assert.match(store.wallet.log[0].what, /示範/);
  assert.equal((await W.buy('nope')).ok, false);
  assert.equal(pay.MODE, 'symbolic');
  const { EXPORT_PARTS } = await import('../src/store.js');
  assert.ok(!EXPORT_PARTS.some(p => /wallet/i.test(p.key)), '餘額不能跟著備份檔被複製');
});

test('許願池與許願簿畫得出來', () => {
  const ctx = (query) => ({ settings: {}, profile: null, all: null, query });
  const hub = String(view.render(ctx({})));
  assert.ok(hub.includes('id="pool"') && hub.includes('data-wallet') && hub.includes('用手機投'));
  assert.equal(view.title(ctx({})), '許願池');
  assert.equal(view.title(ctx({ at: 'log' })), '許願簿');
  localStorage.removeItem('xj.wishes');
  assert.ok(String(view.render(ctx({ at: 'log' }))).includes('許願簿還是空的'));
  store.addWish({ id: 'w1', date: '2026-10-18', wish: '考上', spot: 'bowl', x: 0, z: 0 });
  const log = String(view.render(ctx({ at: 'log' })));
  assert.ok(log.includes('考上') && log.includes('正中月盞'));
  localStorage.removeItem('xj.wishes');
});

test('廟與神社的投錢都改從福幣扣', () => {
  for (const f of ['../src/views/temple.js', '../src/rites/haiden.js', '../src/rites/kuji.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(src, /ensure\(/, f); assert.match(src, /spend\(/, f);
  }
});
