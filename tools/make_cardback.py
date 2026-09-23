#!/usr/bin/env python3
"""把使用者給的牌背圖處理成 App 要的尺寸與比例。

牌背原圖是 733×1320（比例 0.555），牌面是 280×470（比例 0.596）——
不一樣。翻牌動畫是同一張卡片轉 180°，兩面尺寸一變就會「抽動」，
所以先把牌背補到跟牌面一樣的比例。

補的方式是左右加邊，不是裁切：裁下去會切到外框的金線。
補的顏色取自四個角落的實際像素，接起來看不出接縫。

有些圖本身就是圓角卡片、角落外面是一塊純白（例如鎏金太陽那張）。
那塊白跟卡片底色差一點點，補完邊會在四個角留下白色小三角 ——
所以先從四個角把「跟卡片底色不一樣的那塊」填成底色。

用法：python3 tools/make_cardback.py <來源圖> [輸出路徑]
      不給輸出路徑就是覆蓋內建的 assets/tarot/back.webp
"""
import pathlib, sys
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEST = ROOT / 'assets/tarot/back.webp'
FACE = ROOT / 'assets/tarot/major-00.webp'      # 以牌面的比例為準
WIDTH, QUALITY = 320, 82


def corner_color(im, k=14):
    """取四個角各 k×k 的平均色，當成補邊的底色"""
    boxes = [(0, 0, k, k), (im.width - k, 0, im.width, k),
             (0, im.height - k, k, im.height), (im.width - k, im.height - k, im.width, im.height)]
    px = [im.crop(b).resize((1, 1), Image.LANCZOS).getpixel((0, 0)) for b in boxes]
    return tuple(sum(c[i] for c in px) // len(px) for i in range(3))


def unround(im, k=10):
    """圓角外面那一塊填成卡片底色。底色取左右兩邊中段（那裡一定是卡片本身）。"""
    y = im.height // 2
    boxes = [(k, y - k, 2 * k, y + k), (im.width - 2 * k, y - k, im.width - k, y + k)]
    px = [im.crop(b).resize((1, 1), Image.LANCZOS).getpixel((0, 0)) for b in boxes]
    bg = tuple(sum(c[i] for c in px) // len(px) for i in range(3))
    for xy in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]:
        if max(abs(a - b) for a, b in zip(im.getpixel(xy), bg)) > 6:
            ImageDraw.floodfill(im, xy, bg, thresh=10)
    return im


def main():
    src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not src or not src.exists():
        sys.exit(f'找不到來源圖：{src}')
    dest = pathlib.Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else DEST
    im = unround(Image.open(src).convert('RGB'))

    face = Image.open(FACE)
    ratio = face.width / face.height
    want_w = round(im.height * ratio)
    if want_w > im.width:                        # 比較窄 → 左右補邊
        pad = Image.new('RGB', (want_w, im.height), corner_color(im))
        pad.paste(im, ((want_w - im.width) // 2, 0))
        im = pad
    elif want_w < im.width:                      # 比較寬 → 上下補邊
        want_h = round(im.width / ratio)
        pad = Image.new('RGB', (im.width, want_h), corner_color(im))
        pad.paste(im, (0, (want_h - im.height) // 2))
        im = pad

    im = im.resize((WIDTH, round(WIDTH / ratio)), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, 'WEBP', quality=QUALITY, method=6)
    print(f'{dest.relative_to(ROOT)}  {im.size}  {dest.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
