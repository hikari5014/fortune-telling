/* 康熙筆畫查詢
   基底：Unicode Unihan 的 kRSUnicode（部首序號 + 餘筆）→ 部首本身筆畫 + 餘筆，
   這正是康熙字典的計筆方式，也是姓名學所用的「康熙筆畫」。涵蓋 CJK 基本區 20,992 字。
   例外表：少數字的姓名學慣用值與 Unihan 推算不同，以慣用值為準。 */
import { KX_START, KX_PACKED } from './kangxi.js';

/** 姓名學慣用值優先於推算值 */
export const EXCEPTIONS = {
  蕭: 19,   // 艸6 + 肅13
  萬: 15,   // 康熙列艸部九畫
  郎: 14,   // 良7 + 邑7
  泰: 10,   // 氺作五畫計
  求: 7,    // 同上
  才: 3,    // 字形三畫，非手部四畫
  妍: 7,    // 通行字形女3 + 开4
};

/** 數目字依其數值計算（熊崎式常用規則，可於設定關閉） */
export const NUMERALS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/** 純推算值（不套用任何規則） */
export function rawStrokeOf(ch) {
  const i = (ch.codePointAt(0) || 0) - KX_START;
  if (i < 0 || i >= KX_PACKED.length) return null;
  const v = KX_PACKED.charCodeAt(i) - 48;
  return v || null;
}

/**
 * 查字的康熙筆畫
 * @param {string} ch 單一漢字
 * @param {object} o {numeralRule} 數目字是否依數值計
 */
export function strokeOf(ch, { numeralRule = true } = {}) {
  if (!ch) return null;
  if (numeralRule && ch in NUMERALS) return NUMERALS[ch];
  if (ch in EXCEPTIONS) return EXCEPTIONS[ch];
  return rawStrokeOf(ch);
}

export const dictSize = KX_PACKED.length;
export const STROKES = new Proxy({}, {
  get: (_, k) => (typeof k === 'string' ? strokeOf(k) : undefined),
  has: (_, k) => typeof k === 'string' && strokeOf(k) != null,
});
