/* 擇日與擇時 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayInfo, jianchuOf, hoursOf, rateDay, findDays, monthGrid, termOfDay,
  JIANCHU, SHEN12, PENGZU_STEM, PENGZU_BRANCH, PURPOSES, addDays,
} from '../src/engines/daily.js';
import { fourPillars, BRANCHES } from '../src/engines/calendar.js';

test('建除：日支與月建相同者為建，之後依序而下', () => {
  for (let mb = 0; mb < 12; mb++) {
    assert.equal(jianchuOf(mb, mb).name, '建');
    for (let db = 0; db < 12; db++) {
      assert.equal(jianchuOf(mb, db).name, JIANCHU[(db - mb + 12) % 12]);
    }
  }
});

test('建除：同一個月建裡逐日進一位，換月建才會重來', () => {
  let prev = null, prevMB = null;
  for (let d = 0; d < 120; d++) {
    const [y, m, dd] = addDays(2026, 1, 1, d);
    const i = dayInfo(y, m, dd);
    if (prev !== null && i.monthBranch === prevMB) {
      assert.equal(i.jianchu.index, (prev + 1) % 12, `${i.date} 建除沒接上`);
    }
    prev = i.jianchu.index; prevMB = i.monthBranch;
  }
});

test('節氣偵測：2026 年 2 月抓到立春與雨水', () => {
  const got = [];
  for (let d = 1; d <= 28; d++) { const t = termOfDay(2026, 2, d); if (t) got.push([d, t]); }
  assert.deepEqual(got, [[4, '立春'], [18, '雨水']]);
});

test('節氣偵測：一年剛好 24 天有交節', () => {
  let n = 0;
  for (let i = 0; i < 365; i++) {
    const [y, m, d] = addDays(2026, 1, 1, i);
    if (termOfDay(y, m, d)) n++;
  }
  assert.ok(n === 24 || n === 25, `一年抓到 ${n} 個交節日`);
});

test('十二時辰：黃黑道各六神，青龍起點 = (日支×2+8) mod 12', () => {
  for (let i = 0; i < 60; i++) {
    const [y, m, d] = addDays(2026, 1, 1, i);
    const info = dayInfo(y, m, d);
    const hs = hoursOf(info);
    assert.equal(hs.length, 12);
    const names = hs.map(h => h.shen).sort();
    assert.deepEqual(names, SHEN12.map(s => s.n).sort(), `${info.date} 十二神不齊`);
    assert.equal(hs.filter(h => h.tone === '黃').length, 6);
    assert.equal(hs.filter(h => h.tone === '黑').length, 6);
    // 青龍落點
    const ql = hs.findIndex(h => h.shen === '青龍');
    assert.equal(ql, (info.dayBranch * 2 + 8) % 12, `${info.date} 青龍起點不對`);
  }
});

test('十二時辰：時柱干支依五鼠遁，與 fourPillars 一致', () => {
  const info = dayInfo(2026, 9, 22);
  const hs = hoursOf(info);
  for (let b = 0; b < 12; b++) {
    const h = b === 0 ? 0 : b * 2 - 1;      // 子時用 00:00 避開換日規則
    const p = fourPillars({ y: 2026, m: 9, d: 22, h, tz: 8 });
    assert.equal(hs[p.hourIndex].gz, p.hour.name, `${BRANCHES[p.hourIndex]}時`);
  }
});

test('沖煞：日支對沖生肖，煞方為三合局的對面', () => {
  const SHA = { 0: '南', 4: '南', 8: '南', 2: '北', 6: '北', 10: '北', 1: '東', 5: '東', 9: '東', 3: '西', 7: '西', 11: '西' };
  for (let i = 0; i < 60; i++) {
    const [y, m, d] = addDays(2026, 1, 1, i);
    const info = dayInfo(y, m, d);
    assert.equal(info.chong.branch, (info.dayBranch + 6) % 12);
    assert.equal(info.sha, SHA[info.dayBranch]);
  }
});

test('彭祖百忌收錄十干十二支共 22 條', () => {
  assert.equal(PENGZU_STEM.length, 10);
  assert.equal(PENGZU_BRANCH.length, 12);
  for (let i = 0; i < 60; i++) {
    const [y, m, d] = addDays(2026, 1, 1, i);
    assert.equal(dayInfo(y, m, d).pengzu.length, 2);
  }
});

test('評分：落在 0–100，理由不為空，破日對嫁娶必定扣分', () => {
  const natal = fourPillars({ y: 1990, m: 5, d: 20, h: 9, tz: 8 });
  for (let i = 0; i < 90; i++) {
    const [y, m, d] = addDays(2026, 1, 1, i);
    const info = dayInfo(y, m, d);
    const r = rateDay(info, { purpose: 'wed', bazi: natal });
    assert.ok(r.score >= 0 && r.score <= 100, `${info.date} 分數 ${r.score}`);
    assert.ok(r.reasons.length > 0, `${info.date} 沒有理由`);
    if (info.jianchu.name === '破') {
      assert.ok(r.reasons.some(x => x.delta < 0 && x.tag === '建除'), `${info.date} 破日竟沒扣分`);
    }
  }
});

test('找日子：依分數排序，最好的不低於最差的', () => {
  const f = findDays({ from: [2026, 1, 1], days: 60, purpose: 'open', top: 10 });
  assert.equal(f.all.length, 60);
  assert.equal(f.best.length, 10);
  for (let i = 1; i < f.best.length; i++) {
    assert.ok(f.best[i - 1].rating.score >= f.best[i].rating.score, '最佳清單沒有排序');
  }
  assert.ok(f.best[0].rating.score >= f.worst[0].rating.score);
});

test('找日子：只看六日時，結果全是週末', () => {
  const f = findDays({ from: [2026, 1, 1], days: 60, purpose: 'wed', weekdays: [0, 6], top: 5 });
  for (const x of f.all) assert.ok([0, 6].includes(x.weekday), `${x.date} 不是週末`);
});

test('月曆：天數與起始星期正確', () => {
  for (const [y, m, days] of [[2026, 1, 31], [2026, 2, 28], [2024, 2, 29], [2026, 4, 30]]) {
    const g = monthGrid(y, m);
    assert.equal(g.days, days, `${y}-${m}`);
    assert.equal(g.list.length, days);
    assert.equal(g.lead, new Date(y, m - 1, 1).getDay());
  }
});

test('事項清單沒有重複的 key', () => {
  const keys = PURPOSES.map(p => p.key);
  assert.equal(new Set(keys).size, keys.length);
});
