import test from 'node:test';
import assert from 'node:assert/strict';

/* 等待畫面：0.5 秒內做完就不出現；超過才出現；做完會收起來 */
const cls = new Set();
const node = () => ({
  className: '', hidden: false, style: {}, firstElementChild: { style: {} }, textContent: '',
  setAttribute() {}, appendChild() {},
  classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
  querySelector: () => node(),
  set innerHTML(v) {},
});
globalThis.document = { createElement: node, body: { appendChild() {} } };
const L = await import('../src/loading.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

test('快的事不顯示等待畫面', async () => {
  const done = L.begin('x', { delay: 60 });
  await wait(20); done();
  await wait(80);
  assert.equal(L.isShowing(), false);
});

test('慢的事超過門檻才顯示，做完收起', async () => {
  const done = L.begin('x', { delay: 40 });
  assert.equal(L.isShowing(), false);
  await wait(70);
  assert.equal(L.isShowing(), true);
  done();
  await wait(400);
  assert.equal(L.isShowing(), false);
});

test('delay 0 馬上顯示；withLoading 回傳結果、出錯也會收', async () => {
  const done = L.begin('x', { delay: 0, progress: 0.2 });
  assert.equal(L.isShowing(), true);
  L.progress(0.6, 'y'); done(); done();
  assert.equal(await L.withLoading(async () => 7, 'z'), 7);
  await assert.rejects(L.withLoading(async () => { throw new Error('e'); }));
  await wait(400);
  assert.equal(L.isShowing(), false);
});
