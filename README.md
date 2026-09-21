# 玄鑑 XUAN JIAN

一個**離線可用的命理 PWA**。所有推算（曆法、節氣、農曆、四柱、星盤、紫微、姓名五格、數字磁場）
都在你的裝置上完成，不連網、不上傳。需要「解讀」時，App 會幫你組出一段提示詞，
你複製到任何 LLM，再把回覆貼回來存檔。

> 零建置、零相依套件。原生 ES Modules + CSS，開一個靜態伺服器就能跑。

## 快速開始

```bash
python3 -m http.server 8080
# 開 http://localhost:8080
```

或直接把整個資料夾丟到任何靜態主機（GitHub Pages / Netlify / Vercel）。
需要 HTTPS 才能安裝成 App 與啟用 Service Worker。

## 功能

| 模組 | 內容 |
|---|---|
| **星盤** | 太陽 / 月亮 / 上升 / 中天 / 下降 / 天底、等宮制十二宮、月相、元素分布 |
| **八字** | 年月日時四柱（立春分年、節氣分月、五鼠遁時）、納音、日主、生肖 |
| **紫微** | 定朔定氣農曆 → 命宮／身宮、五行局、十四主星、六吉六煞、年干四化、十二宮盤 |
| **姓名** | 康熙筆畫五格三才、81 靈動數、取名筆畫推薦、單字筆畫手動修正 |
| **數字** | 八星磁場（天醫／生氣／延年／伏位／絕命／五鬼／六煞／禍害）、手機車牌評分、生命靈數、雙號匹配、幸運數字 |
| **提示詞** | 13 個內建模板 + 完全自由的自訂模板、資料積木勾選、變數面板、輸出控制、一鍵複製 |
| **紀錄** | 貼回的 LLM 解讀，依對象歸檔，可匯出 Markdown |
| **設定** | 外觀、動態、命理參數、提示詞預設、資料匯出入 |

## 技術重點

- **天文演算**：太陽視黃經（誤差 < 0.01°）、月亮主要項（< 0.3°）、Meeus 朔望公式、ΔT 修正
- **農曆**：定朔定氣法 —— 朔日為初一、無中氣置閏，不依賴任何查表資料
- **上升**：`Asc = atan2(cos RAMC, −(sin RAMC · cos ε + tan φ · sin ε))`，需出生地經緯度
- **日柱**：`(JDN + 49) mod 60`
- **PWA**：Service Worker 快取應用程式外殼與 Google Fonts，完全離線可用
- **黑白主題**：純單色設計代幣系統，層次靠灰階、細線與留白
- **動態 UI**：View Transitions 過場、IntersectionObserver 逐項進場、滑動切頁、長按選單、
  漣漪與指標光暈、數值計數、下拉關閉抽屜；可在設定切「關閉／輕量／完整」，並尊重
  `prefers-reduced-motion`

## 目錄

```
index.html            外殼
manifest.webmanifest  PWA 資訊清單
sw.js                 Service Worker
styles/               tokens / base / motion / components / views
src/
  app.js router.js store.js ui.js motion.js icons.js
  engines/  calendar astro ziwei naming numbers
  data/     strokes lucky81 magnetic
  prompt/   context templates builder
  views/    home profile astro ziwei naming numbers prompt records settings
assets/icons/         App 圖示（自繪幾何星盤，非 emoji）
tools/make_icons.py   圖示 PNG 產生器
docs/DESIGN.md        完整設計規劃書
```

## 筆畫字典

內建約 2,400 字的康熙筆畫。姓名學的筆畫與現代字形不同（氵算 4、艹算 6、阝左 8 右 7…），
字典沒收錄的字可以：

1. 在姓名頁「修正筆畫」手動輸入，或
2. 用內建的「查康熙筆畫」模板去問外部 LLM，再填回來

## 免責

本 App 為文化娛樂與自我探索工具。計算結果與 LLM 解讀皆不構成醫療、法律、投資或任何專業建議。

## 部署到 GitHub Pages

專案已附上 `.github/workflows/deploy.yml`，推送後自動部署，**不需要任何建置步驟**。

第一次設定（只要做一次）：

1. 到 repo 的 **Settings → Pages**
2. **Build and deployment → Source** 選 **GitHub Actions**
3. 回到 **Actions** 分頁，等 `Deploy to GitHub Pages` 跑完

網址：`https://<使用者名稱>.github.io/fortune-telling/`

注意事項：

- 站台部署在子路徑底下，所以所有路徑都必須是**相對路徑**（本專案已全部使用相對路徑）
- `.nojekyll` 一定要保留，否則 GitHub Pages 的 Jekyll 會忽略 `src/views/_shared.js`（底線開頭的檔案）
- GitHub Pages 是 HTTPS，Service Worker 與「安裝成 App」都能正常運作
