# 測試

零相依：用 Node 內建的 `node:test`，不需要 npm install、不需要建置。

```bash
node --test tests/*.test.js                       # 全部
node --test --test-reporter=spec tests/*.test.js  # 看得清楚一點
node --test tests/planets.test.js                 # 只跑一個
```

CI 在每次推送與 PR 時跑一次；部署前會再跑一次，沒過就不上線。

## 各檔案在守什麼

| 檔案 | 內容 |
|---|---|
| `modules.test.js` | 每個模組都要真的 import 得起來，每個 view 都要有 render／title／eyebrow |
| `render.test.js` | 每一頁的 `render()` 都跑得完並吐出內容；沒有出生資料時也不能爆 |
| `calendar.test.js` | 儒略日、日柱遞進、24 節氣、立春日期、農曆連續性、干支與納音、地支關係 |
| `planets.test.js` | 行星與獨立演算法交叉驗證、內行星距角、逆行次數與天數、歲差 |
| `astro.test.js` | 上升中天、等宮制、相位對稱性與排序、命盤 SVG 不重疊、極區不產生 NaN |
| `bagua.test.js` | 遊年對稱性、八星不重不漏、東西四命分組、本命卦九年循環 |
| `bazi.test.js` | 地支藏干、十神分組、旺相休囚死、五行力量加總、喜用忌神互斥 |
| `daily.test.js` | 建除遞進、節氣偵測、十二時辰與青龍起點、沖煞、評分範圍、找日子排序 |
| `misc.test.js` | 姓名五格與康熙筆畫、八星磁場、生命靈數、易經變卦、塔羅牌陣、求籤、紫微 |
| `prompt.test.js` | 變數渲染、模板完整性、聚焦插入位置、語調、分享碼往返與壞碼 |
| `wenyan.test.js` | 文言表涵蓋白話表且確實不同、引擎確實吃 reg 參數 |
| `version.test.js` | 版號三處一致、更新紀錄格式、SW 快取清單涵蓋每個模組 |

## 為什麼要有 `modules.test.js`

`node --check` 只驗語法，**攔不住重複匯出**。實際踩過：`synastry.js` 同時有
`export function aspectBetween` 與 `export { aspectBetween }`，語法檢查通過，
瀏覽器卻整頁掛掉，連帶提示詞頁打不開。只有真的 `import()` 才會發現。

## `_dom.js` 是什麼

最小的 DOM 墊片，只為了讓模組能在 Node 裡載入與繪製。
它**不模擬版面或事件** —— `querySelector` 一律回傳存根而不是 null，
因為這裡的目的是攔住「載入或繪製就炸掉」，不是驗 DOM 邏輯。
版面與互動仍要在真的瀏覽器裡看。
