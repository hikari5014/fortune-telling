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

test('福幣：只給贊助者 —— 沒登入不能儲值，扣不夠就不扣，退回會加回來', async () => {
  assert.equal(W.balance(), 0);
  assert.equal(W.isSponsor(), false, '一般人不是贊助者');
  assert.equal((await W.buy('p30')).reason, 'login', '福幣只存在會員帳戶裡');
  W.syncFrom({ coins: 5, member: true });
  assert.equal(W.isSponsor(), true);
  assert.equal(W.spend(6, 'x'), false);
  assert.equal(W.balance(), 5, '不夠的時候一枚都不扣');
  assert.equal(W.spend(2, '許願池'), true);
  W.refund(1, '退回');
  assert.equal(W.balance(), 4);
  assert.equal(store.wallet.log[0].what, '退回');
});

test('0.41 版本機送的福幣：沒登入就清掉；會員的不動', () => {
  store.wallet = { coins: 12, day: '2026-10-18', log: [] };
  W.migrateLocal();
  assert.equal(W.balance(), 0);
  store.wallet = { coins: 30, member: true, log: [] };
  W.migrateLocal();
  assert.equal(W.balance(), 30);
});

test('付款仍是象徵性的；錢包不進備份', async () => {
  assert.equal(pay.MODE, 'symbolic');
  const { EXPORT_PARTS } = await import('../src/store.js');
  assert.ok(!EXPORT_PARTS.some(p => /wallet/i.test(p.key)), '餘額不能跟著備份檔被複製');
});

test('許願池與許願簿畫得出來', () => {
  const ctx = (query) => ({ settings: {}, profile: null, all: null, query });
  const hub = String(view.render(ctx({})));
  assert.ok(hub.includes('id="pool"') && hub.includes('wishfs') && hub.includes('用手機投'));
  assert.equal(view.title(ctx({})), '許願池');
  assert.equal(view.title(ctx({ at: 'log' })), '許願簿');
  localStorage.removeItem('xj.wishes');
  assert.ok(String(view.render(ctx({ at: 'log' }))).includes('許願簿還是空的'));
  store.addWish({ id: 'w1', date: '2026-10-18', wish: '考上', spot: 'bowl', x: 0, z: 0 });
  const log = String(view.render(ctx({ at: 'log' })));
  assert.ok(log.includes('考上') && log.includes('正中月盞'));
  localStorage.removeItem('xj.wishes');
});

test('儀式全免費：只有選了福幣才扣，初穗料不扣', () => {
  const kuji = readFileSync(new URL('../src/rites/kuji.js', import.meta.url), 'utf8');
  assert.doesNotMatch(kuji, /spend\(/);
  for (const f of ['../src/views/temple.js', '../src/rites/haiden.js', '../src/views/wish.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /ensure\(/, `${f} 不能因為沒有福幣就擋人`);
    assert.match(src, /spend\(1/, f);
  }
});

test('寶可夢 GO 式的甩：太慢不投；甩越快越遠；往右甩往右偏；同樣的甩法同樣的結果', () => {
  const h = 800;
  assert.equal(P.flickAim(0, -300, h), null, '太慢 → 回到手上');
  assert.equal(P.flickAim(0, 900, h), null, '往下拉 → 回到手上');
  const slow = P.flickAim(0, -1200, h), fast = P.flickAim(0, -2800, h);
  assert.ok(fast.power > slow.power);
  assert.equal(P.flickAim(0, -9000, h).power, 1);
  assert.ok(P.flickAim(400, -2000, h).yaw > 0 && P.flickAim(-400, -2000, h).yaw < 0);
  assert.deepEqual(P.flickAim(300, -2000, h), P.flickAim(300, -2000, h));
});

test('從手指放開的位置出手：預覽落點仍然準', () => {
  const from = { x: 0.4, y: 0.6, z: P.START.z };
  const t = P.targetOf({ yaw: -0.3, power: 0.4 }, from);
  const { land } = P.predict(P.launchFor(t, from), 1 / 120, from);
  assert.ok(Math.hypot(land.x - t.x, land.z - t.z) < 0.03);
  const { coin } = P.simulate(P.launchFor(t, from), { from });
  assert.equal(coin.spot, 'pool');
});
