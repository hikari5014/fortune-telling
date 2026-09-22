/* 平台偵測與安裝指引 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, installGuide, ALL_GUIDES } from '../src/platform.js';

const UA = {
  'iPhone Safari': ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1', '', 0],
  'iPhone Chrome': ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 CriOS/122.0 Mobile/15E148 Safari/604.1', '', 0],
  'iPhone Firefox': ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 FxiOS/124.0 Mobile/15E148 Safari/605.1.15', '', 0],
  'iPad 謊報 Mac': ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15', 'MacIntel', 5],
  'Android Chrome': ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/122.0 Mobile Safari/537.36', '', 0],
  'Android Samsung': ['Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36', '', 0],
  'Android Firefox': ['Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0', '', 0],
  'Android Edge': ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/122.0 Mobile Safari/537.36 EdgA/122.0', '', 0],
  'Windows Edge': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36 Edg/122.0', '', 0],
  'Windows Chrome': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36', '', 0],
  'Windows Firefox': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0', '', 0],
  'macOS Safari': ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15', 'MacIntel', 0],
};
const d = (name) => { const [ua, platform, touch] = UA[name]; return detect({ ua, platform, touch }); };

test('作業系統判斷正確', () => {
  for (const n of ['iPhone Safari', 'iPhone Chrome', 'iPhone Firefox', 'iPad 謊報 Mac']) {
    assert.equal(d(n).iOS, true, n);
    assert.equal(d(n).os, 'iOS', n);
  }
  for (const n of ['Android Chrome', 'Android Samsung', 'Android Firefox', 'Android Edge']) {
    assert.equal(d(n).android, true, n);
  }
  for (const n of ['Windows Edge', 'Windows Chrome', 'Windows Firefox', 'macOS Safari']) {
    assert.equal(d(n).desktop, true, n);
  }
});

test('iPad 謊報成 Mac 時靠觸控點數補判', () => {
  const [ua, platform] = UA['iPad 謊報 Mac'];
  assert.equal(detect({ ua, platform, touch: 5 }).iOS, true, '有多點觸控應判為 iPad');
  assert.equal(detect({ ua, platform, touch: 0 }).iOS, false, '沒有觸控就是真的 Mac');
  assert.equal(detect({ ua, platform, touch: 0 }).os, 'macOS');
});

test('瀏覽器判斷正確 —— Edge 與 Samsung 的 UA 裡都有 Chrome，順序不能錯', () => {
  const want = {
    'iPhone Safari': 'Safari', 'iPhone Chrome': 'Chrome', 'iPhone Firefox': 'Firefox',
    'Android Chrome': 'Chrome', 'Android Samsung': 'Samsung Internet', 'Android Firefox': 'Firefox',
    'Windows Edge': 'Edge', 'Windows Chrome': 'Chrome', 'Windows Firefox': 'Firefox',
    'macOS Safari': 'Safari',
  };
  for (const [n, b] of Object.entries(want)) assert.equal(d(n).browser, b, n);
});

test('每一種裝置都給得出指引，而且步驟都不是空的', () => {
  for (const n of Object.keys(UA)) {
    const g = installGuide(d(n));
    assert.ok(g.title, `${n} 沒有標題`);
    assert.ok(g.steps?.length >= 1, `${n} 沒有步驟`);
    for (const s of g.steps) {
      assert.ok(s.text?.length > 4, `${n} 的步驟文字太短`);
      assert.ok(s.icon, `${n} 的步驟沒有圖示`);
    }
  }
});

test('指引內容對得上平台', () => {
  assert.match(installGuide(d('iPhone Safari')).steps.map(s => s.text).join(), /加入主畫面/);
  assert.match(installGuide(d('Android Chrome')).steps.map(s => s.text).join(), /安裝應用程式|主畫面/);
  assert.match(installGuide(d('macOS Safari')).steps.map(s => s.text).join(), /加入 Dock/);
  // Firefox 桌面版沒有安裝功能，要講實話而不是給錯的步驟
  assert.match(installGuide(d('Windows Firefox')).steps.map(s => s.text).join(), /沒有內建的安裝功能/);
});

test('所有指引用到的圖示都存在', async () => {
  const { iconNames } = await import('../src/icons.js');
  for (const g of ALL_GUIDES()) {
    for (const s of g.steps) assert.ok(iconNames.includes(s.icon), `${g.key} 用了不存在的圖示 ${s.icon}`);
  }
});

test('未知的 UA 也要有退路，不能爆', () => {
  for (const ua of ['', 'SomethingWeird/1.0', 'curl/8.0']) {
    const x = detect({ ua, platform: '', touch: 0 });
    assert.doesNotThrow(() => installGuide(x));
    assert.ok(installGuide(x).steps.length > 0);
  }
});
