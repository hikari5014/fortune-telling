# 塔羅牌圖的來源與授權

這個資料夾裡的 78 張圖，是 **Rider–Waite–Smith 塔羅牌（1909）** 的掃描件，
由 [Wikimedia Commons](https://commons.wikimedia.org/) 取得，
再用 `tools/fetch_tarot.py` 轉成灰階、280px 寬的 WebP。

## 著作權狀態

- 繪者：**Pamela Colman Smith**（1878–1951）
- 出版：1909 年，William Rider & Son（London）

這套圖已進入公有領域：

| 地區 | 依據 | 何時起 |
|---|---|---|
| 美國 | 1929 年以前出版 | 早已進入 |
| 英國・歐盟等「死後 70 年」地區 | Smith 卒於 1951 年 | 2022 年起 |
| 台灣 | 著作權法：死後 50 年 | 2002 年起 |

## 一個要分清楚的地方

U.S. Games Systems 對 **「Rider-Waite」這個名稱**（商標）與
**他們自家重新上色的版本**（新的衍生著作）另外享有權利。

這裡用的是 **1909 年原版的黑白掃描**，不是那些重製版本，
App 內也不用該商標當產品名稱 —— 只在說明來源時提到原始的出版資訊。

## 修改內容

為了配合 App 的黑白調性與離線體積，原圖做了這些處理（見 `tools/fetch_tarot.py`）：

1. 轉灰階
2. 自動對比 + 色階調整（把泛黃的紙推回白、墨推回黑）
3. 縮到 280px 寬
4. 存成 WebP（品質 66）

重新產生：`python3 tools/fetch_tarot.py --force`
