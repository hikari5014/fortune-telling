/* 語調：白話與文言兩套措辭的完整性 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGISTERS, JIANCHU_WEN, TONE_WEN, SHEN12_WEN, BAGUA_STAR_WEN, MAGNETIC_WEN, LIFE_PATH_WEN, HOUSE_WEN, pick,
} from '../src/data/wenyan.js';
import { JIANCHU, SHEN12, TONE_TEXT, JIANCHU_INFO, dayInfo, hoursOf } from '../src/engines/daily.js';
import { STAR_USE, eightDirections } from '../src/engines/bagua.js';
import { STARS } from '../src/data/magnetic.js';
import { LIFE_PATH, lifePath } from '../src/engines/numbers.js';
import { HOUSE_MEANING, houseMeaning } from '../src/engines/astro.js';

test('文言表涵蓋對應的白話表，一條不漏', () => {
  assert.deepEqual(Object.keys(JIANCHU_WEN).sort(), [...JIANCHU].sort(), '建除十二神');
  assert.deepEqual(Object.keys(TONE_WEN).sort(), Object.keys(TONE_TEXT).sort(), '黃黑道基調');
  assert.deepEqual(Object.keys(SHEN12_WEN).sort(), SHEN12.map(s => s.n).sort(), '十二神');
  assert.deepEqual(Object.keys(BAGUA_STAR_WEN).sort(), Object.keys(STAR_USE).sort(), '八宅八星');
  assert.deepEqual(Object.keys(LIFE_PATH_WEN).sort(), Object.keys(LIFE_PATH).sort(), '生命靈數');
  assert.equal(HOUSE_WEN.length, HOUSE_MEANING.length, '西洋十二宮');
  for (const k of Object.keys(STARS)) assert.ok(MAGNETIC_WEN[k], `數字磁場缺 ${k}`);
});

test('文言與白話確實不同，且都不是空的', () => {
  for (const [name, wen, bai] of [
    ['建除', JIANCHU_WEN, Object.fromEntries(Object.entries(JIANCHU_INFO).map(([k, v]) => [k, v.text]))],
    ['十二神', SHEN12_WEN, Object.fromEntries(SHEN12.map(s => [s.n, s.text]))],
    ['磁場', MAGNETIC_WEN, Object.fromEntries(Object.entries(STARS).map(([k, v]) => [k, v.text]))],
    ['靈數', LIFE_PATH_WEN, LIFE_PATH],
  ]) {
    for (const k of Object.keys(bai)) {
      assert.ok(wen[k]?.length > 4, `${name} ${k} 的文言太短`);
      assert.notEqual(wen[k], bai[k], `${name} ${k} 兩種語調一樣`);
    }
  }
  for (let i = 0; i < 12; i++) assert.notEqual(HOUSE_WEN[i], HOUSE_MEANING[i], `第 ${i + 1} 宮`);
});

test('pick：只有 reg 是 wen 且表裡有這一條才換字', () => {
  const t = { a: '文言版' };
  assert.equal(pick(t, 'a', '白話版', 'wen'), '文言版');
  assert.equal(pick(t, 'a', '白話版', 'bai'), '白話版');
  assert.equal(pick(t, 'b', '白話版', 'wen'), '白話版', '表裡沒有就該退回白話');
  assert.equal(pick(undefined, 'a', '白話版', 'wen'), '白話版');
});

test('引擎確實吃 reg 參數：同一天兩種語調給出不同文字', () => {
  const bai = dayInfo(2026, 9, 22, { reg: 'bai' });
  const wen = dayInfo(2026, 9, 22, { reg: 'wen' });
  assert.equal(bai.jianchu.name, wen.jianchu.name, '建除本身不該因語調改變');
  assert.notEqual(bai.jianchu.text, wen.jianchu.text);
  assert.notEqual(bai.jianchu.toneText, wen.jianchu.toneText);
  assert.notEqual(hoursOf(bai)[0].shenText, hoursOf(wen)[0].shenText);
  assert.notEqual(eightDirections('坎', 'bai')[0].placeText, eightDirections('坎', 'wen')[0].placeText);
  assert.notEqual(lifePath(1990, 5, 20, 'bai').text, lifePath(1990, 5, 20, 'wen').text);
  assert.notEqual(houseMeaning(7, 'bai'), houseMeaning(7, 'wen'));
});

test('預設是白話，沒給 reg 不會變成文言', () => {
  assert.equal(dayInfo(2026, 9, 22).jianchu.text, dayInfo(2026, 9, 22, { reg: 'bai' }).jianchu.text);
  assert.equal(eightDirections('坎')[0].placeText, eightDirections('坎', 'bai')[0].placeText);
});

test('語調選項只有兩種，且都有名稱與說明', () => {
  assert.equal(REGISTERS.length, 2);
  assert.deepEqual(REGISTERS.map(r => r.key), ['bai', 'wen']);
  for (const r of REGISTERS) assert.ok(r.name && r.hint);
});
