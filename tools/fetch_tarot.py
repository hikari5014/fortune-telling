#!/usr/bin/env python3
"""把偉特牌（Rider–Waite–Smith，1909）的公有領域掃描檔抓下來，
轉成適合這個 App 的樣子：灰階、去底色、280px 寬的 WebP。

灰階不只是為了瘦身 —— 這個 App 本來就是黑白調性，
原圖的彩度放進來會很突兀。

來源：Wikimedia Commons 的 Special:FilePath（會做伺服器端縮圖）。
授權：繪者 Pamela Colman Smith 於 1951 年過世，1909 年出版；
     在美國（1929 年前出版）與所有「死後 70 年」的地區（2022 年起）
     以及台灣（死後 50 年，2002 年起）都已進入公有領域。
     註：U.S. Games Systems 對「Rider-Waite」這個名稱與他們自家的
     重新上色版本另有權利 —— 這裡用的是 1909 年原版掃描，不是那些版本。

用法：python3 tools/fetch_tarot.py [--force]
"""
import io, json, pathlib, sys, time, urllib.error, urllib.request
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/tarot'
WIDTH = 280          # 顯示時最大約 200px，留一點給高 DPI
QUALITY = 66

MAJOR = ['00_Fool', '01_Magician', '02_High_Priestess', '03_Empress', '04_Emperor',
         '05_Hierophant', '06_Lovers', '07_Chariot', '08_Strength', '09_Hermit',
         '10_Wheel_of_Fortune', '11_Justice', '12_Hanged_Man', '13_Death', '14_Temperance',
         '15_Devil', '16_Tower', '17_Star', '18_Moon', '19_Sun', '20_Judgement', '21_World']
SUITS = [('wands', 'Wands'), ('cups', 'Cups'), ('swords', 'Swords'), ('coins', 'Pents')]


def plan():
    """[(存檔用的 id, Commons 上的檔名)]，id 要跟 src/data/tarot.js 的 key 一致"""
    items = [(f'major-{i:02d}', f'RWS_Tarot_{m}.jpg') for i, m in enumerate(MAJOR)]
    for key, prefix in SUITS:
        items += [(f'{key}-{n:02d}', f'{prefix}{n:02d}.jpg') for n in range(1, 15)]
    return items


def fetch(commons_name, tries=5):
    """Commons 會限流，碰到 429 就退讓重試，別把人家的伺服器當自己的"""
    url = f'https://commons.wikimedia.org/wiki/Special:FilePath/{commons_name}?width=640'
    req = urllib.request.Request(url, headers={'User-Agent': 'xuanjian-build/1.0 (tarot assets)'})
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return Image.open(io.BytesIO(r.read()))
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1:
                raise
            time.sleep(4 * (i + 1))
    raise RuntimeError('unreachable')


def levels(im, lo=8, hi=226):
    """把紙的顏色推到純白、墨推到純黑。百年掃描件偏灰，不修的話
    擺在 App 的白底卡片上會像一塊髒掉的補丁。"""
    lut = [0 if v <= lo else (255 if v >= hi else round((v - lo) * 255 / (hi - lo)))
           for v in range(256)]
    return im.point(lut)


def process(im):
    im = im.convert('L')
    im = ImageOps.autocontrast(im, cutoff=1)          # 掃描件泛黃，先把黑白點拉回來
    im = im.filter(ImageFilter.GaussianBlur(0.4))     # 先柔化網點，縮圖才不會起摩爾紋
    h = round(im.height * WIDTH / im.width)
    im = im.resize((WIDTH, h), Image.LANCZOS)
    im = ImageEnhance.Sharpness(im).enhance(1.25)
    return levels(im)


def main():
    force = '--force' in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    manifest, total = {}, 0
    for card_id, name in plan():
        dest = OUT / f'{card_id}.webp'
        if dest.exists() and not force:
            manifest[card_id] = dest.name
            total += dest.stat().st_size
            continue
        try:
            process(fetch(name)).save(dest, 'WEBP', quality=QUALITY, method=6)
        except Exception as e:                        # 抓不到就跳過，App 會自動退回線稿卡
            print(f'  ✗ {card_id} ({name}): {e}', file=sys.stderr)
            continue
        manifest[card_id] = dest.name
        total += dest.stat().st_size
        print(f'  ✓ {card_id}  {dest.stat().st_size // 1024} KB')
        time.sleep(1.2)                               # 抓 78 張，客氣一點
    (OUT / 'manifest.json').write_text(json.dumps(sorted(manifest), ensure_ascii=False), encoding='utf-8')
    print(f'\n共 {len(manifest)} 張，{total / 1024 / 1024:.2f} MB')
    if len(manifest) != 78:
        print(f'注意：少了 {78 - len(manifest)} 張', file=sys.stderr)


if __name__ == '__main__':
    main()
