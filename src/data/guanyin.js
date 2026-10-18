/* 觀音一百籤：跟神社的おみくじ同一套古籤（淺草寺系），做成「求籤」頁吃的格式。
   資料本身在 src/data/omikuji.js（來源與比對方式寫在那裡），這裡只轉格式：
   gz 留空（觀音籤沒有干支），luck 用原本的吉凶，gist 用 App 自撰的那一句總評。 */
import { POEMS } from './omikuji.js';
import { levelOf } from '../engines/omikuji.js';

export const GUANYIN_SET = {
  id: 'guanyin100',
  name: '觀音一百籤',
  source: '觀音百籤（元三大師御籤）古籤原文；白話為本 App 自撰',
  builtin: true,
  poems: POEMS.map(p => ({ n: p.n, gz: '', luck: p.level, lines: p.lines, gist: levelOf(p.level).say })),
};
