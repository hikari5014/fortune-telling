#!/usr/bin/env python3
"""把起卦那一段的四張原圖轉成 App 用的 WebP。

用法：
    python3 tools/make_ceremony.py 原圖資料夾

原圖檔名認這幾個（副檔名不限，png/jpg/webp 都可以）：
    orb / aura / hand-l / hand-r      hand-r 沒有的話用 hand-l 鏡射

做兩件事：
1. **光暈去背** —— 原圖是「白底＋彩色光束」。白底不能靠 CSS 混色拿掉
   （screen 讓黑變透明，白的永遠是白的；multiply 讓白變透明，但整張會變暗）。
   所以在這裡一次做掉：把「離白有多遠」當成 alpha，顏色除以 alpha 還原回去，
   等於把 multiply 合成反推回來。之後 CSS 用 screen 疊加就會發光。
2. 其餘三張只做等比縮圖與 WebP 壓縮，原本的透明背景照留。

需要 Pillow。輸出到 assets/ceremony/。
"""
import sys, os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'ceremony')
NAMES = ['orb', 'aura', 'hand-l', 'hand-r']
MAXW = {'orb': 620, 'aura': 1100, 'hand-l': 560, 'hand-r': 560}


def find(src_dir, name):
    for f in sorted(os.listdir(src_dir)):
        stem, ext = os.path.splitext(f)
        if stem.lower() == name and ext.lower() in ('.png', '.jpg', '.jpeg', '.webp'):
            return os.path.join(src_dir, f)
    return None


def unmultiply_white(im):
    """白底 → 透明。alpha = 1 - min(r,g,b)/255，顏色再除回去。

    純白 → alpha 0（完全透明）；越飽和、越暗的地方 alpha 越高。
    顏色除以 alpha 是在還原「這個顏色如果沒有跟白紙混過，本來長什麼樣」。
    """
    im = im.convert('RGB')
    px = im.load()
    out = Image.new('RGBA', im.size)
    op = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            a = 255 - min(r, g, b)
            if a <= 2:
                op[x, y] = (0, 0, 0, 0)
                continue
            k = a / 255
            op[x, y] = (
                min(255, round((r - 255 * (1 - k)) / k)),
                min(255, round((g - 255 * (1 - k)) / k)),
                min(255, round((b - 255 * (1 - k)) / k)),
                a,
            )
    return out


def main(src_dir):
    os.makedirs(OUT, exist_ok=True)
    done = []
    for name in NAMES:
        p = find(src_dir, name)
        if not p:
            if name == 'hand-r' and find(src_dir, 'hand-l'):
                print(f'· {name}：沒有原圖，CSS 會直接鏡射 hand-l')
                continue
            print(f'✗ {name}：找不到原圖')
            continue
        im = Image.open(p)
        im = unmultiply_white(im) if name == 'aura' else im.convert('RGBA')
        w = MAXW[name]
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        dst = os.path.join(OUT, f'{name}.webp')
        im.save(dst, 'WEBP', quality=88, method=6)
        print(f'✓ {name}.webp  {im.width}×{im.height}  {os.path.getsize(dst) // 1024} KB')
        done.append(name)
    if 'orb' in done and 'aura' in done and 'hand-l' in done:
        print('\n四張齊了，抽牌時就會播起卦那一段。')
    else:
        print('\n還沒齊 —— 少任何一張，抽牌會直接從聚牌開始。')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
