#!/usr/bin/env python3
"""把求籤與擲筊用的照片去背，做成 App 裡的法器圖。

來源（都在 Wikimedia Commons，授權見 assets/relics/CREDITS.md）：
  src/qiantong.jpg —— 籤筒＋一支散放的籤，藍綠色布景
  src/poe.jpg      —— 一對紅筊，左邊凸面朝上、右邊平面朝上，花崗岩檯面

做法都是「背景跟物件顏色差很多」：
  籤筒：布是藍綠的（藍、綠都比紅高），竹子與紅漆都是紅比藍高 → 直接用色差切。
  筊杯：花崗岩是灰的（三色差不多），筊是紅漆＋磨掉漆露出的木頭 → 用「紅比藍高多少」切。
切完取面積最大的幾塊、補洞、邊緣羽化一點點。

籤枝另外做兩件事：
  1. 轉正 —— 照片裡是斜躺的，用遮罩的主軸算出角度，轉成直立、紅頭朝上。
  2. 把原本寫在籤上的「第十二籤」抹掉 —— App 會自己把抽到的籤號疊上去，
     不抹的話每一支都寫著十二。抹法是把紅字的像素用周圍竹色一圈一圈往內填。

需要 numpy、scipy、Pillow。
用法：python3 tools/make_relics.py
"""
import pathlib
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'assets/relics/src', ROOT / 'assets/relics'


def feather(mask, r=1.1):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)))


def crop(rgba, pad=4):
    ys, xs = np.where(rgba[..., 3] > 8)
    return rgba[max(ys.min() - pad, 0):ys.max() + pad + 1, max(xs.min() - pad, 0):xs.max() + pad + 1]


def unfringe(rgb, mask, bg_test):
    """邊緣半透明的那一圈還帶著背景色（藍綠邊），把它換成往內兩像素的物件顏色"""
    inner = nd.binary_erosion(mask, iterations=2)
    _, idx = nd.distance_transform_edt(~inner, return_indices=True)
    near = rgb[idx[0], idx[1]]
    ring = mask & ~inner
    out = rgb.copy()
    out[ring] = near[ring]
    return out


def biggest(mask, k):
    lab, n = nd.label(mask)
    sizes = nd.sum(mask, lab, range(1, n + 1))
    return [lab == (i + 1) for i in np.argsort(sizes)[::-1][:k]]


def inpaint(rgb, hole, steps=60):
    """把 hole 裡的像素用周圍的顏色一圈一圈填進去（簡單的擴散）"""
    img = rgb.astype(float).copy()
    known = ~hole
    img[hole] = 0
    for _ in range(steps):
        if known.all():
            break
        acc = np.zeros_like(img); cnt = np.zeros(hole.shape)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == dx == 0:
                    continue
                k = np.roll(np.roll(known, dy, 0), dx, 1)
                acc += np.roll(np.roll(img, dy, 0), dx, 1) * k[..., None]
                cnt += k
        grow = ~known & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow][:, None]
        known = known | grow
    return img.clip(0, 255).astype(np.uint8)


def save(rgba, name, height=None, width=None):
    im = Image.fromarray(rgba, 'RGBA')
    if height:
        im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    if width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / name, 'WEBP', quality=86, method=6)
    print(f'{name}  {im.size}  {(OUT / name).stat().st_size // 1024} KB')


def qian():
    im = np.asarray(Image.open(SRC / 'qiantong.jpg').convert('RGB')).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    teal = (b > r + 18) & (g > r + 10)
    fg = nd.binary_fill_holes(nd.binary_closing(nd.binary_opening(~teal, iterations=2), iterations=3))
    tube, stick = biggest(fg, 2)
    rgb = im.astype(np.uint8)

    # 籤筒
    clean = unfringe(rgb, tube, teal)
    save(crop(np.dstack([clean, feather(tube)])), 'tube.webp', height=640)

    # 籤枝：先抹字，再轉正
    red = (r - g > 55) & (r > 150)
    lab, n = nd.label(red & stick)
    sizes = nd.sum(red & stick, lab, range(1, n + 1))
    tip = lab == (np.argmax(sizes) + 1)                      # 最大那一塊紅是籤頭，要留著
    glyph = nd.binary_dilation(red & stick & ~tip, iterations=2) & nd.binary_erosion(stick, iterations=1)
    body = inpaint(unfringe(rgb, stick, teal), glyph)
    rgba = np.dstack([body, feather(stick)])

    ys, xs = np.where(stick)
    cy, cx = ys.mean(), xs.mean()
    cov = np.cov(np.vstack([xs - cx, ys - cy]))
    vx, vy = np.linalg.eigh(cov)[1][:, -1]                   # 主軸方向
    ang = np.degrees(np.arctan2(vy, vx))
    img = Image.fromarray(rgba, 'RGBA').rotate(ang + 90, resample=Image.BICUBIC, expand=True)
    arr = crop(np.asarray(img))
    # 紅頭要在上面：上半截紅色比較多就對了，不然倒過來
    h = arr.shape[0]
    top_red = ((arr[:h // 2, :, 0].astype(int) - arr[:h // 2, :, 1]) > 55).sum()
    bot_red = ((arr[h // 2:, :, 0].astype(int) - arr[h // 2:, :, 1]) > 55).sum()
    if bot_red > top_red:
        arr = arr[::-1, ::-1]
    # 照片裡的籤很細（寬:長 ≈ 1:13），畫面上籤號要寫得下，所以橫向拉寬 1.8 倍。
    # 竹片是均勻的長條，橫向拉寬看不出變形。
    im2 = Image.fromarray(np.ascontiguousarray(arr), 'RGBA')
    im2 = im2.resize((round(im2.width * 1.8), im2.height), Image.LANCZOS)
    save(np.asarray(im2), 'stick.webp', height=560)


def jiao():
    im = np.asarray(Image.open(SRC / 'poe.jpg').convert('RGB')).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    red = (r > 120) & (r > g * 1.45) & (r > b * 1.45)
    wood = (r - b > 28) & (r > 120) & (r >= g)
    fg = nd.binary_fill_holes(nd.binary_closing(nd.binary_opening(red | wood, iterations=2), iterations=6))
    blocks = sorted(biggest(fg, 2), key=lambda m: np.where(m)[1].mean())
    rgb = im.astype(np.uint8)
    # 照片裡兩片是直立的；App 裡筊杯是橫躺的半月形、直邊朝下。
    # 左邊那片（凸面）直邊在右 → 順時針轉；右邊那片（平面）直邊在左 → 逆時針轉。
    for m, name, turn in zip(blocks, ['jiao-convex.webp', 'jiao-flat.webp'], [-90, 90]):
        arr = crop(np.dstack([unfringe(rgb, m, None), feather(m)]))
        arr = np.asarray(Image.fromarray(arr, 'RGBA').rotate(turn, expand=True))
        save(np.ascontiguousarray(arr), name, width=360)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    qian()
    jiao()
