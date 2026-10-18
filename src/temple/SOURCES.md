# 廟：資料來源

`gods.js` 裡的神明、供品、禁忌、生日依下列來源整理。台灣各廟作法差很多，
App 取最常見的說法，畫面上一律寫成「習俗上」，不是教義。標「民俗」的是新聞或
民俗文章的說法，可信度較低。

## 拜拜流程

- 艋舺龍山寺官方參拜指引（稟報姓名、生日、住址；擲筊問可否求籤；笑筊再稟報、陰筊不允）
  https://www.lungshan.org.tw/Tour_Guide/how_to_prays
- 行天宮 求籤／擲筊 FAQ https://www.ht.org.tw/faq276.htm 、https://www.ht.org.tw/faq277.htm
- 北港朝天宮 解籤說明 https://www.matsu.org.tw/?act=menuinfo&ml_id=20240116003

## 各神明

| 神明 | 重點 | 來源 |
|---|---|---|
| 文昌帝君 | 蔥＝聰明、蒜＝會算、芹菜＝勤、包子粽子＝包中；忌丸子、鴨蛋、紅龜粿（民俗）；二月初三 | https://www.nownews.com/news/6773967 、https://www.nownews.com/news/5627493 |
| 關聖帝君 | 工作事業可求；多數人不供牛肉（民俗）；六月二十四，也有五月十三 | 龍山寺指引、https://health.tvbs.com.tw/life/355954 |
| 五路財神 | 趙公明率四部將；供單數水果、發糕、紅龜粿；忌蘋果、蓮霧（民俗）；三月十五 | https://health.tvbs.com.tw/life/354098 、https://smiletaiwan.cw.com.tw/article/5173 |
| 月下老人 | 紅線、喜糖；八月十五 | https://tcmb.culture.tw/zh-tw/detail?indexCode=Culture_Place&id=247148 、https://news.pts.org.tw/article/715207 |
| 天上聖母 | 三月二十三 | https://www.matsu.org.tw/?act=menuinfo&ml_id=20240108003 |
| 觀世音菩薩 | 全素、不供酒、不含動物油的糕餅；二月十九 | https://health.tvbs.com.tw/life/353516 |

## 籤詩

- 觀音一百籤：古籤原文（與淺草寺同一套，見 `src/data/omikuji.js` 的來源說明）；白話為本 App 自撰。
- 其他五位用本 App 自撰的六十籤。真實廟宇裡，媽祖廟、土地公廟多用六十甲子籤，
  行天宮等關帝廟用關聖帝君一百籤；各廟的「解曰」與白話註解有著作權，App 不照抄。

## 香油錢

畫面上的香油錢、功德箱都是象徵性的，不會扣款，也不代收任何廟宇的捐款（見 `src/payments.js`）。
