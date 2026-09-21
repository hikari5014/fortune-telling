#!/usr/bin/env python3
"""Rasterise the monochrome app icon to PNG without any image library."""
import math, struct, zlib, sys, os

def shape(x, y, s):
    """x,y in [-0.5,0.5]. Returns True if the pixel is 'ink'. s = content scale."""
    x, y = x / s, y / s
    r = math.hypot(x, y)
    a = math.atan2(y, x)
    # outer ring
    if 0.360 <= r <= 0.400:
        return True
    # 12 ticks around the ring
    if 0.418 <= r <= 0.474:
        k = (a % (math.pi / 6))
        k = min(k, math.pi / 6 - k)
        if k * r <= 0.0135:
            return True
    # four-point star (astroid) in the centre
    t = 2.0 / 3.0
    if r < 0.30 and (abs(x) ** t + abs(y) ** t) <= (0.235 ** t):
        return True
    # horizon line through the ring
    if abs(y) <= 0.0115 and 0.075 <= abs(x) <= 0.345:
        return True
    return False

def render(size, scale=1.0, invert=False, ss=3):
    fg = 255 if not invert else 10
    bg = 10 if not invert else 255
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            hit = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) / size - 0.5
                    y = (py + (sy + 0.5) / ss) / size - 0.5
                    if shape(x, y, scale):
                        hit += 1
            v = bg + (fg - bg) * hit / (ss * ss)
            v = int(round(v))
            row += bytes((v, v, v, 255))
        rows.append(bytes(row))
    return rows

def write_png(path, size, rows):
    raw = b"".join(b"\x00" + r for r in rows)
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)
    print(path, os.path.getsize(path), "bytes")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")
    write_png(os.path.join(out, "icon-192.png"), 192, render(192, 1.0))
    write_png(os.path.join(out, "icon-512.png"), 512, render(512, 1.0))
    write_png(os.path.join(out, "maskable-512.png"), 512, render(512, 0.70))
    write_png(os.path.join(out, "apple-touch-icon.png"), 180, render(180, 0.82))
