# 法器照片的來源與授權

| 檔案 | 原圖 | 作者 | 授權 |
|---|---|---|---|
| `tube.webp`、`stick.webp` | [File:Qiantong.jpg](https://commons.wikimedia.org/wiki/File:Qiantong.jpg) | Fengshuimestari | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `jiao-flat.webp`、`jiao-convex.webp` | [File:Poe (Jiaobei) at Yokohama Mazimiao.jpg](https://commons.wikimedia.org/wiki/File:Poe_(Jiaobei)_at_Yokohama_Mazimiao.jpg) | Yoshi Canopus | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

`src/` 裡是從 Wikimedia Commons 下載的縮圖（1280px、1920px 寬）。

## 修改內容（見 `tools/make_relics.py`）

- 依顏色去背（籤筒：藍綠布景；筊杯：花崗岩檯面），邊緣羽化
- 籤枝：轉成直立、橫向拉寬 1.8 倍、抹除原本寫在籤上的「第十二籤」
- 筊杯：轉成橫躺、分成平面與凸面兩張
- 縮小並轉成 WebP

依 CC BY-SA 的相同方式分享條款，修改後的這四張圖以
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 釋出。
App 內「關於」頁列有作者與授權。
