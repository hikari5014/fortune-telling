/* 應驗追蹤：記下來、到期提醒、準確率 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const { store } = await import('../src/store.js');
const v = await import('../src/verify.js');
const DAY = 86400000;

beforeEach(() => { store.records = []; store.setSettings({ verifyDays: 7 }); });

test('從結果頁存一筆：模板是占卜種類、所問獨立存一份', () => {
  const r = v.saveReading({ kind: 'tarot', question: '換工作好嗎', text: '牌陣：三張\n第一張：愚者' });
  assert.equal(r.templateId, 'tarot');
  assert.equal(r.question, '換工作好嗎');
  assert.ok(v.trackable(r));
  assert.match(r.content, /\*\*所問\*\*：換工作好嗎/);
  assert.equal(v.askedOf(r), '換工作好嗎');
});

test('到期才提醒：7 天內不出現，過了才出現；答過就不再出現', () => {
  const now = Date.now();
  const r = v.saveReading({ kind: 'qian', question: 'A', text: 'x' });
  assert.equal(v.due(store.records, { now }).length, 0);
  assert.equal(v.due(store.records, { now: now + 8 * DAY })[0].id, r.id);
  v.setVerdict(r.id, 'hit');
  assert.equal(v.due(store.records, { now: now + 8 * DAY }).length, 0);
});

test('還沒發生：往後延，到新日期才再問', () => {
  const now = Date.now();
  const r = v.saveReading({ kind: 'iching', question: 'B', text: 'x' });
  v.snooze(r.id, 7, now + 8 * DAY);
  assert.equal(v.due(store.records, { now: now + 9 * DAY }).length, 0);
  assert.equal(v.due(store.records, { now: now + 16 * DAY }).length, 1);
});

test('設成不提醒就一筆都不問', () => {
  v.saveReading({ kind: 'iching', question: 'C', text: 'x' });
  assert.equal(v.due(store.records, { days: 0, now: Date.now() + 99 * DAY }).length, 0);
});

test('非占卜的紀錄不追蹤（例如命盤總覽）', () => {
  store.addRecord({ id: 'r1', createdAt: new Date(0).toISOString(), templateId: 'overview', templateName: '命盤總覽', content: '' });
  assert.equal(v.due().length, 0);
});

test('準確率：準 1、部分準 0.5，依種類分開', () => {
  const ids = ['hit', 'partial', 'miss', 'hit'].map((k, i) => {
    const r = v.saveReading({ kind: i < 3 ? 'tarot' : 'qian', question: String(i), text: 'x' });
    v.setVerdict(r.id, k); return r.id;
  });
  const s = v.stats();
  assert.equal(s.all.n, 4);
  assert.equal(s.by.tarot.rate, 0.5);
  assert.equal(s.by.qian.rate, 1);
  assert.equal(s.by.iching.rate, null);
  assert.equal(ids.length, 4);
});

test('三個結果頁都有「記下來」按鈕，而且模組進了離線清單', () => {
  for (const f of ['iching', 'tarot', 'qian']) {
    const src = readFileSync(`src/views/${f}.js`, 'utf8');
    assert.match(src, /\$\{trackBtn\(\)\}/, `${f} 少了按鈕`);
    assert.match(src, new RegExp(`bindTrack\\([^]*?kind: '${f}'`), `${f} 沒有綁`);
  }
  assert.match(readFileSync('sw.js', 'utf8'), /'\.\/src\/verify\.js'/);
});
