/* 導覽：分類結構、扇形幾何、分類選單的擺放與命中 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const { NAV, CATS, HOME, FLOW, itemsOf, catOf, arcShape, ARC } = await import('../src/data/nav.js');
const { place } = await import('../src/navmenu.js');

test('每一頁都分得到類，沒有多也沒有少', () => {
  const covered = CATS.flatMap(c => c.paths);
  const all = NAV.map(n => n.p);
  assert.equal(new Set(covered).size, covered.length, '同一頁被分到兩類');
  assert.deepEqual(all.filter(p => p !== '/' && !covered.includes(p)), [], '有頁面沒分到類');
  assert.deepEqual(covered.filter(p => !all.includes(p)), [], '分類裡有不存在的頁面');
  assert.equal(covered.length + 1, all.length, '首頁之外的每一頁都該恰好屬於一類');
  assert.equal(HOME.p, '/');
  assert.equal(catOf('/'), null, '首頁不屬於任何一類');
  assert.equal(catOf('/tarot').key, 'divine');
  assert.equal(catOf('/沒這頁'), null);
});

test('分類本身是合理的', () => {
  assert.equal(CATS.length, 4);
  // 首頁鍵卡在正中間的缺口裡；分類是雙數，缺口才會落在中線上。
  // 改成單數的話缺口會歪掉，圓鍵就會壓到中間那顆的字。
  assert.equal(CATS.length % 2, 0, '分類要是雙數');
  assert.equal(CATS[0].key, 'tool', '工具要在最左邊');
  for (const c of CATS) {
    assert.equal(c.name.length, 2, `${c.name} 不是兩個字，扇形上排不整齊`);
    assert.ok(c.icon && c.key, c.name);
    const items = itemsOf(c);
    assert.equal(items.length, c.paths.length, `${c.name} 有路徑對不到頁面`);
    assert.ok(items.length >= 2, `${c.name} 只有一項，不值得單獨一類`);
    assert.ok(items.length <= 6, `${c.name} 有 ${items.length} 項，一次要挑太多`);
    items.forEach(n => assert.ok(n.t && n.icon && n.eyebrow, `${c.name} 底下有頁面缺欄位`));
  }
});

test('左右滑與方向鍵的順序，跟側欄看到的一致', () => {
  assert.deepEqual(FLOW, ['/', ...CATS.flatMap(c => c.paths)]);
  assert.equal(new Set(FLOW).size, FLOW.length, '順序裡有重複');
  assert.equal(FLOW.length, NAV.length, '有頁面走不到');
});

test('扇形：中間最高、左右對稱、兩端的落差等於設定值', () => {
  for (const n of [3, 4, 5, 6]) {
    const sh = [...Array(n).keys()].map(i => arcShape(i, n));
    for (let i = 0; i < n; i++) {
      const j = n - 1 - i;
      assert.ok(Math.abs(sh[i].dy - sh[j].dy) < 1e-9, `n=${n} 左右不對稱`);
      assert.ok(Math.abs(sh[i].rot + sh[j].rot) < 1e-9, `n=${n} 左右傾斜不對稱`);
      if (i + 1 < n / 2) assert.ok(sh[i].dy > sh[i + 1].dy, `n=${n} 越靠中間應該越高`);
    }
    assert.ok(Math.abs(Math.max(...sh.map(x => x.dy)) - ARC.rise) < 1e-9, `n=${n} 落差不等於設定值`);
    assert.ok(Math.min(...sh.map(x => x.dy)) <= ARC.rise * 0.2, `n=${n} 中間沒比兩端高多少`);
  }
  assert.deepEqual(arcShape(0, 1), { dy: 0, rot: 0 }, '只有一顆的時候不該歪掉');
});

/* ── 選單的擺放 ─────────────────────────────────────
   規矩只有一條：看得到哪一項，放開就要選到那一項。 */

const SCREENS = [[390, 844], [360, 780], [430, 932], [1280, 860]];
const COUNTS = [...new Set(CATS.map(c => c.paths.length))];

test('不管螢幕多大、幾項，整份選單都在畫面裡', () => {
  for (const [vw, vh] of SCREENS) {
    for (const x of [20, 60, vw / 2, vw - 60, vw - 20]) for (const n of COUNTS) {
      const p = place({ x, y: vh - 90 }, n, vw, vh);
      assert.ok(p.top >= 0, `${vw}×${vh} n=${n} 上緣超出畫面`);
      assert.ok(p.top + p.total <= vh, `${vw}×${vh} n=${n} 下緣超出畫面`);
      assert.ok(p.cx - 108 >= 0 && p.cx + 108 <= vw, `${vw}×${vh} n=${n} 左右超出畫面`);
    }
  }
});

test('指著哪一項就選到哪一項', () => {
  for (const [vw, vh] of SCREENS) {
    for (const x of [20, vw / 2, vw - 20]) for (const n of COUNTS) {
      const p = place({ x, y: vh - 90 }, n, vw, vh);
      p.pts.forEach((pt, i) =>
        assert.equal(p.hit(pt.x, pt.y), i, `${vw}×${vh} n=${n}：指第 ${i} 項選到第 ${p.hit(pt.x, pt.y)} 項`));
    }
  }
});

test('滑到選單外面就是取消', () => {
  const p = place({ x: 195, y: 754 }, 5, 390, 844);
  assert.equal(p.hit(195, p.top - 60), -1, '清單上方很遠');
  assert.equal(p.hit(195, p.top + p.total + 60), -1, '清單下方很遠');
  assert.equal(p.hit(-200, p.pts[0].y), -1, '左邊很遠');
  assert.equal(p.hit(900, p.pts[0].y), -1, '右邊很遠');
});

test('上面擺不下就翻到下面，不會被切掉', () => {
  const n = 5;
  const high = place({ x: 195, y: 40 }, n, 390, 844);   // 從畫面最上面叫出來
  assert.ok(high.top >= 0 && high.top + high.total <= 844);
  high.pts.forEach((pt, i) => assert.equal(high.hit(pt.x, pt.y), i));
});

test('項目之間不會疊在一起', () => {
  for (const n of COUNTS) {
    const { pts } = place({ x: 195, y: 754 }, n, 390, 844);
    for (let i = 1; i < n; i++) {
      assert.ok(pts[i].y - pts[i - 1].y >= 46, `第 ${i} 項跟上一項只差 ${pts[i].y - pts[i - 1].y}px`);
    }
  }
});

test('導覽列不會擠在一起：高度補得回來、缺口比圓鍵寬', () => {
  const css = readFileSync('styles/components.css', 'utf8');
  const app = readFileSync('src/app.js', 'utf8');
  // 兩端是用 transform 推下去的，transform 不佔版面高度 ——
  // 沒把落差補回去，那兩顆會掛在導覽列外面
  assert.match(css, /\.dock__arc \{[^}]*height: calc\(46px \+ var\(--arc-rise/,
    '扇形那一排沒有把兩端的落差算進高度');
  assert.match(app, /--arc-rise/, 'app.js 沒有把落差值傳進 CSS');
  // 缺口要比圓鍵寬，不然圓鍵會壓到隔壁的字
  const notch = Number(css.match(/\.dock__notch \{ width: (\d+)px/)[1]);
  const home = Number(css.match(/\.dock \.tab\.dock__home \{[^}]*width: (\d+)px/s)[1]);
  assert.ok(notch >= home + 12, `缺口 ${notch}px 只比圓鍵 ${home}px 寬 ${notch - home}px，太擠`);
  assert.match(css, /\.dock \.tab\.dock__home \{[^}]*position: absolute/s,
    '圓鍵要用絕對定位卡進缺口，不然會多佔一列');
  // 版面留白要蓋得過導覽列
  const base = readFileSync('styles/base.css', 'utf8');
  const pad = Number(base.match(/padding-bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom\)\)/)[1]);
  assert.ok(pad >= 104 && pad <= 130, `頁尾留白 ${pad}px 跟導覽列高度（88 + 8）對不上`);
});

test('樣式與程式對得上：沒有殘留的舊分頁列', () => {
  const css = readFileSync('styles/components.css', 'utf8');
  const app = readFileSync('src/app.js', 'utf8');
  assert.ok(!/\.tabbar/.test(css), 'CSS 還留著舊的 .tabbar');
  assert.ok(!/tab-more|openMore/.test(app), 'app.js 還留著「更多」按鈕');
  assert.match(css, /\.dock__cat/);
  assert.match(css, /\.dock__home/);
  // 層次要照這個順序，不然抽屜會被導覽列壓住
  const z = (sel) => Number(css.slice(css.indexOf(sel)).match(/z-index:\s*(\d+)/)[1]);
  assert.ok(z('.navmenu {') < z('.dock {'), '選單應該在導覽列底下');
  assert.ok(z('.dock {') < z('.sheet-scrim {'), '導覽列應該在抽屜底下');
  assert.ok(z('.sheet-scrim {') < z('.toast-root'), '抽屜應該在 Toast 底下');
});
