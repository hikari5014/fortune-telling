/* 導覽原型（lab/nav.html）的幾何：
   看得到什麼，放開就要選到什麼 —— 這是這類「拖曳選取」唯一不能錯的事。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

globalThis.__LAB_NO_BOOT = true;            // 只要幾何，不要整個畫面跑起來
Object.defineProperty(globalThis, 'innerWidth', { value: 390, writable: true, configurable: true });
Object.defineProperty(globalThis, 'innerHeight', { value: 844, writable: true, configurable: true });

const { LAYOUTS, CATS, opts } = await import('../lab/nav.js');

/* 分類列在畫面下方，所以按下的位置大致在下緣；左右從最邊邊掃到最邊邊 */
const ANCHORS = [];
for (const x of [24, 60, 120, 195, 270, 330, 366]) for (const y of [700, 760, 800]) ANCHORS.push({ x, y });

const COUNTS = [...new Set(CATS.map(c => c.items.length))].sort();

test('原型的檔案都在，而且 HTML 指到對的地方', () => {
  for (const f of ['lab/nav.html', 'lab/nav.css', 'lab/nav.js']) assert.ok(existsSync(f), `少了 ${f}`);
  const html = readFileSync('lab/nav.html', 'utf8');
  assert.match(html, /\.\.\/styles\/tokens\.css/, '應該沿用 App 的設計代幣');
  assert.match(html, /\.\/nav\.css/);
  assert.match(html, /type="module" src="\.\/nav\.js"/);
});

test('四種版面都在，而且各自寫了好處與代價', () => {
  assert.deepEqual(Object.keys(LAYOUTS), ['radial', 'arc', 'list', 'nested']);
  for (const [k, L] of Object.entries(LAYOUTS)) {
    assert.ok(L.name && L.tag && L.desc, k);
    assert.ok(L.pros?.length >= 2, `${k} 至少要講兩個好處`);
    assert.ok(L.cons?.length >= 2, `${k} 至少要講兩個代價 —— 只講好話的比較沒有用`);
  }
});

test('不管從哪裡按、幾項，每一項都畫在畫面裡', () => {
  for (const key of ['radial', 'arc', 'list']) {
    for (const a of ANCHORS) for (const n of COUNTS) {
      const plan = LAYOUTS[key].place(a, n);
      assert.equal(plan.pts.length, n);
      for (const p of plan.pts) {
        assert.ok(p.x >= 0 && p.x <= innerWidth, `${key} n=${n} @${a.x},${a.y} → x=${Math.round(p.x)} 跑出畫面`);
        assert.ok(p.y >= 0 && p.y <= innerHeight, `${key} n=${n} @${a.x},${a.y} → y=${Math.round(p.y)} 跑出畫面`);
      }
    }
  }
});

test('指著哪一項就選到哪一項（看得到什麼＝選到什麼）', () => {
  for (const key of ['radial', 'arc', 'list']) {
    for (const a of ANCHORS) for (const n of COUNTS) {
      const plan = LAYOUTS[key].place(a, n);
      plan.pts.forEach((p, i) => {
        assert.equal(plan.hit(p.x, p.y), i,
          `${key} n=${n} @${a.x},${a.y}：指著第 ${i} 項，卻選到第 ${plan.hit(p.x, p.y)} 項`);
      });
    }
  }
});

test('手指停在原地就是取消，不會誤選', () => {
  for (const key of ['radial', 'arc']) {
    for (const a of ANCHORS) for (const n of COUNTS) {
      const plan = LAYOUTS[key].place(a, n);
      assert.equal(plan.cx, a.x, `${key} 的圓心必須咬著手指`);
      assert.equal(plan.cy, a.y, `${key} 的圓心必須咬著手指`);
      assert.equal(plan.hit(a.x, a.y), -1, `${key} n=${n} @${a.x},${a.y}：沒動卻選到東西`);
      // 稍微抖一下也還是取消
      assert.equal(plan.hit(a.x + 9, a.y - 7), -1, `${key}：手抖 11px 就被判定成選取`);
    }
  }
});

test('放開在選單外面＝取消（圓環例外，它只看方向）', () => {
  const a = { x: 195, y: 760 };
  // 扇形開口朝上，所以「往正下方滑」是明確的扇形之外
  const arc = LAYOUTS.arc.place(a, 4);
  assert.equal(arc.hit(a.x, a.y + 300), -1, '扇形：往正下方滑應該取消');
  assert.equal(arc.hit(a.x, a.y + 40), -1, '扇形：往下一點點也是扇形之外');
  const list = LAYOUTS.list.place(a, 4);
  assert.equal(list.hit(a.x + 300, a.y), -1, '清單：滑到旁邊很遠應該取消');
  assert.equal(list.hit(a.x, a.y + 400), -1, '清單：滑到清單下方很遠應該取消');
  // 輪盤是「看方向」的，滑多遠都算數 —— 這是它的設計，不是漏洞。
  // 但它退化成扇形的時候，扇形之外就該取消。
  const ring = LAYOUTS.radial.place({ x: 195, y: 500 }, 4);
  if (ring.full) {
    assert.ok(ring.hit(-400, -400) >= 0, '整圈時，往左上滑多遠都該選到左上那一項');
  }
});

test('項目之間不會疊在一起', () => {
  // 圓形版是 74px 寬的方卡，中心距要有 56 才不黏；
  // 清單版是上下疊的橫條（高 46、間隔 4），50 就夠了
  const MINS = { radial: 56, arc: 56, list: 48 };
  for (const key of ['radial', 'arc', 'list']) {
    const MIN = MINS[key];
    for (const a of ANCHORS) for (const n of COUNTS) {
      const { pts } = LAYOUTS[key].place(a, n);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        assert.ok(d >= MIN, `${key} n=${n} @${a.x},${a.y}：第 ${i} 與第 ${j} 項只差 ${Math.round(d)}px`);
      }
    }
  }
});

test('半徑調大調小都還站得住', () => {
  const keep = opts.radius;
  for (const r of [80, 118, 170]) {
    opts.radius = r;
    for (const a of ANCHORS) {
      const plan = LAYOUTS.radial.place(a, 8);
      plan.pts.forEach((p, i) => {
        assert.ok(p.x >= 0 && p.x <= innerWidth && p.y >= 0 && p.y <= innerHeight, `半徑 ${r} 跑出畫面`);
        assert.equal(plan.hit(p.x, p.y), i, `半徑 ${r}：指第 ${i} 項選到第 ${plan.hit(p.x, p.y)} 項`);
      });
    }
  }
  opts.radius = keep;
});

test('換成桌機那種寬螢幕也一樣', () => {
  innerWidth = 1280; innerHeight = 860;
  try {
    for (const key of ['radial', 'arc', 'list']) {
      for (const a of [{ x: 40, y: 800 }, { x: 640, y: 700 }, { x: 1240, y: 820 }]) {
        const plan = LAYOUTS[key].place(a, 5);
        plan.pts.forEach((p, i) => {
          assert.ok(p.x >= 0 && p.x <= 1280 && p.y >= 0 && p.y <= 860, `${key} 跑出畫面`);
          assert.equal(plan.hit(p.x, p.y), i, `${key} 指第 ${i} 項選到第 ${plan.hit(p.x, p.y)} 項`);
        });
      }
    }
  } finally { innerWidth = 390; innerHeight = 844; }
});
