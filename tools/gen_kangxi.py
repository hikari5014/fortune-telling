#!/usr/bin/env python3
"""由 Unicode Unihan 的 kRSUnicode 產生康熙筆畫字典。
   康熙筆畫 = 部首本身的筆畫 + 該字扣掉部首後的剩餘筆畫。"""
import zipfile, sys, os

# 214 部首依筆畫分組（每組的部首序號範圍）
RADICAL_STROKES = {}
GROUPS = [(1, 1, 6), (2, 7, 29), (3, 30, 60), (4, 61, 94), (5, 95, 117), (6, 118, 146),
          (7, 147, 166), (8, 167, 175), (9, 176, 186), (10, 187, 194), (11, 195, 200),
          (12, 201, 204), (13, 205, 208), (14, 209, 210), (15, 211, 211),
          (16, 212, 213), (17, 214, 214)]
for strokes, lo, hi in GROUPS:
    for r in range(lo, hi + 1):
        RADICAL_STROKES[r] = strokes

START, END = 0x4E00, 0x9FFF          # CJK 基本區

def main(zip_path, out_path):
    z = zipfile.ZipFile(zip_path)
    data = z.read('Unihan_IRGSources.txt').decode('utf-8')
    strokes = {}
    for line in data.split('\n'):
        if 'kRSUnicode' not in line or line.startswith('#'):
            continue
        cp, field, value = line.split('\t')[:3]
        code = int(cp[2:], 16)
        if not (START <= code <= END):
            continue
        first = value.split()[0]                  # 可能有多個，取第一個
        rad, _, res = first.partition('.')
        rad = int(rad.rstrip("'"))                # 去掉簡化部首標記
        strokes[code] = RADICAL_STROKES[rad] + int(res)

    buf = []
    for code in range(START, END + 1):
        n = strokes.get(code, 0)
        buf.append(chr(48 + min(n, 70)))          # 0 代表未知
    packed = ''.join(buf)

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('/* 自動產生：勿手動編輯。來源 Unicode Unihan kRSUnicode。\n')
        f.write('   康熙筆畫 = 部首筆畫 + 餘筆。產生腳本：tools/gen_kangxi.py */\n')
        f.write(f'export const KX_START = 0x{START:04X};\n')
        f.write('export const KX_PACKED =\n')
        for i in range(0, len(packed), 100):
            chunk = packed[i:i + 100].replace('\\', '\\\\').replace('"', '\\"')
            f.write(f'  "{chunk}" +\n')
        f.write('  "";\n')
    known = sum(1 for c in packed if c != '0')
    print(f'{out_path}: {known} 字有筆畫資料 / {len(packed)} 碼位，{os.path.getsize(out_path)} bytes')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
