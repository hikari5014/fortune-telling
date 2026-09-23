#!/usr/bin/env python3
"""把 App 圖示畫成 PNG —— 不用任何影像函式庫。

容器裡沒有 Pillow、也沒有 rsvg，所以這支自己做：
自己算覆蓋率做反鋸齒（每個形狀用有號距離場，邊緣一像素內漸變）、
自己做 alpha 合成、自己寫 PNG（zlib + CRC）。

畫法是「一個形狀畫一次」，不是「每個像素問過所有形狀」——
每個形狀只走自己的外框範圍，512×512 跑起來才是一秒的事。

圖案與 assets/icons/icon.svg 是同一個設計（靛黑底、鎏金線）：
外圈虛線的星軌、兩圈實線、八方位刻度、中央四芒星、九個金點。
SVG 改了這裡也要跟著改 —— 兩邊沒有共用的程式，只有共用的座標。
"""
import math, struct, zlib, os

SIZE_REF = 512.0          # 所有座標都以 512 見方為準，輸出時等比縮放

# ── 色票（跟 styles/tokens.css 的鎏金同一套）──────────────
BG_STOPS   = [(0.0, (0x14, 0x18, 0x36)), (0.5, (0x0E, 0x12, 0x2B)), (1.0, (0x08, 0x0A, 0x18))]
GOLD_STOPS = [(0.0, (0xFF, 0xE0, 0x82)), (0.4, (0xDF, 0xB1, 0x5B)),
              (0.7, (0xF5, 0xCF, 0x78)), (1.0, (0xBF, 0x90, 0x35))]
GLOW = (0xDF, 0xB1, 0x5B)


def ramp(stops, t):
    t = min(1.0, max(0.0, t))
    for i in range(len(stops) - 1):
        a, ca = stops[i]
        b, cb = stops[i + 1]
        if t <= b:
            k = 0.0 if b == a else (t - a) / (b - a)
            return tuple(ca[j] + (cb[j] - ca[j]) * k for j in range(3))
    return stops[-1][1]


def diagonal(stops):
    """SVG 的 x1/y1 0%→x2/y2 100% 線性漸層：沿著左上到右下的對角線。"""
    return lambda x, y: ramp(stops, (x + y) / (2 * SIZE_REF))


# ── 畫布 ─────────────────────────────────────────────────
class Canvas:
    """直通（非預乘）alpha 的 RGBA 畫布，座標是 512 見方的使用者單位。"""

    def __init__(self, size):
        self.n = size
        self.k = size / SIZE_REF          # 使用者單位 → 像素
        self.buf = [[0.0, 0.0, 0.0, 0.0] for _ in range(size * size)]

    def blend(self, px, py, rgb, a):
        if a <= 0:
            return
        i = py * self.n + px
        d = self.buf[i]
        na = a + d[3] * (1 - a)
        if na <= 0:
            return
        for j in range(3):
            d[j] = (rgb[j] * a + d[j] * d[3] * (1 - a)) / na
        d[3] = na

    def paint(self, bbox, sdf, paint, alpha=1.0, ss=3):
        """在 bbox（使用者單位 x0,y0,x1,y1）內畫一個形狀。

        sdf(x, y) 回傳有號距離（使用者單位，負的在裡面）。
        邊緣一個像素內用覆蓋率做反鋸齒；ss 是每軸的超取樣數。
        """
        x0 = max(0, int(bbox[0] * self.k) - 2)
        y0 = max(0, int(bbox[1] * self.k) - 2)
        x1 = min(self.n, int(bbox[2] * self.k) + 3)
        y1 = min(self.n, int(bbox[3] * self.k) + 3)
        half = 0.5 / self.k               # 半個像素，換算回使用者單位
        inv = 1.0 / (ss * ss)
        for py in range(y0, y1):
            for px in range(x0, x1):
                cov = 0.0
                for sy in range(ss):
                    for sx in range(ss):
                        ux = (px + (sx + 0.5) / ss) / self.k
                        uy = (py + (sy + 0.5) / ss) / self.k
                        d = sdf(ux, uy)
                        if d <= -half:
                            cov += 1.0
                        elif d < half:
                            cov += (half - d) / (2 * half)
                cov *= inv
                if cov <= 0:
                    continue
                ux = (px + 0.5) / self.k
                uy = (py + 0.5) / self.k
                rgb = paint(ux, uy) if callable(paint) else paint
                self.blend(px, py, rgb, cov * alpha)

    def png(self, path):
        rows = []
        for y in range(self.n):
            row = bytearray()
            for x in range(self.n):
                r, g, b, a = self.buf[y * self.n + x]
                row += bytes((int(round(max(0, min(255, r)))),
                              int(round(max(0, min(255, g)))),
                              int(round(max(0, min(255, b)))),
                              int(round(max(0, min(255, a * 255))))))
            rows.append(bytes(row))
        raw = b"".join(b"\x00" + r for r in rows)

        def chunk(tag, data):
            c = struct.pack(">I", len(data)) + tag + data
            return c + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.n, self.n, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(raw, 9))
        png += chunk(b"IEND", b"")
        open(path, "wb").write(png)
        print(f"{os.path.basename(path)}  {self.n}×{self.n}  {os.path.getsize(path) // 1024} KB")


# ── 有號距離場 ───────────────────────────────────────────
def sd_rrect(cx, cy, hw, hh, r):
    def f(x, y):
        qx = abs(x - cx) - (hw - r)
        qy = abs(y - cy) - (hh - r)
        return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r
    return f


def sd_circle(cx, cy, r):
    return lambda x, y: math.hypot(x - cx, y - cy) - r


def sd_ring(cx, cy, r, w):
    h = w / 2
    return lambda x, y: abs(math.hypot(x - cx, y - cy) - r) - h


def sd_capsule(ax, ay, bx, by, w):
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy

    def f(x, y):
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
        return math.hypot(x - ax - dx * t, y - ay - dy * t) - w / 2
    return f


def star_points(cx, cy, r, n=240):
    """四芒星的輪廓點。用星形線（astroid）—— 四個尖、腰身內凹，
       跟 SVG 裡那四段二次貝茲畫出來的形狀幾乎重合，但只要一條參數式。"""
    pts = []
    for i in range(n + 1):
        a = 2 * math.pi * i / n
        pts.append((cx + r * math.cos(a) ** 3, cy + r * math.sin(a) ** 3))
    return pts


def sd_polyline(pts, w):
    segs = [(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) for i in range(len(pts) - 1)]

    def f(x, y):
        best = 1e9
        for ax, ay, bx, by in segs:
            dx, dy = bx - ax, by - ay
            L2 = dx * dx + dy * dy
            t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
            d = math.hypot(x - ax - dx * t, y - ay - dy * t)
            if d < best:
                best = d
        return best - w / 2
    return f


def sd_star_fill(cx, cy, r):
    """星形線內部：|u|^(2/3) + |v|^(2/3) <= r^(2/3)。
       乘上 r 只是把隱函數換算成「差不多是距離」的尺度，夠用來做反鋸齒。"""
    t = 2.0 / 3.0
    lim = r ** t

    def f(x, y):
        u, v = abs(x - cx), abs(y - cy)
        return (u ** t + v ** t - lim) * (r / 2)
    return f


# ── 畫 ───────────────────────────────────────────────────
C = 256.0          # 中心


def draw(size, scale=1.0, squircle=True):
    """scale < 1 會把整個圖案往中間縮（maskable 的安全區要留邊）。"""
    cv = Canvas(size)
    gold = diagonal(GOLD_STOPS)

    def S(v):
        """把以中心為原點的座標依 scale 縮放。"""
        return C + (v - C) * scale

    def W(v):
        return v * scale

    # 底：圓角方塊。maskable 要整片鋪滿，不留圓角也不留透明。
    if squircle:
        cv.paint((0, 0, 512, 512), sd_rrect(C, C, 240, 240, 108), diagonal(BG_STOPS))
        cv.paint((0, 0, 512, 512),
                 lambda x, y, f=sd_rrect(C, C, 240, 240, 108): abs(f(x, y)) - 1.0, gold, 0.30)
    else:
        cv.paint((0, 0, 512, 512), lambda x, y: -1.0, diagonal(BG_STOPS))

    # 中央的環境光暈
    for i in range(22):
        r0 = W(180) * (1 - i / 22)
        cv.paint((S(C - 190), S(C - 190), S(C + 190), S(C + 190)),
                 sd_circle(C, C, r0), GLOW, 0.012, ss=2)

    # 外圈星軌：虛線（4 實 8 虛），跟 SVG 的 stroke-dasharray 同一組數字
    r_orbit = W(160)
    dash_on, period = W(4), W(12)

    def orbit(x, y):
        d = abs(math.hypot(x - C, y - C) - r_orbit) - W(3) / 2
        if d > 0:
            return d
        s = (math.atan2(y - C, x - C) % (2 * math.pi)) * r_orbit
        gap = s % period
        return d if gap < dash_on else max(d, min(gap - dash_on, period - gap) )
    cv.paint((S(C - 168), S(C - 168), S(C + 168), S(C + 168)), orbit, gold, 0.40)

    # 兩圈實線
    cv.paint((S(C - 136), S(C - 136), S(C + 136), S(C + 136)),
             sd_ring(C, C, W(128), W(3.5)), gold, 0.85)
    cv.paint((S(C - 96), S(C - 96), S(C + 96), S(C + 96)),
             sd_ring(C, C, W(88), W(2)), gold, 0.50)

    # 四正刻度
    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        ax, ay = C + dx * W(172), C + dy * W(172)
        bx, by = C + dx * W(142), C + dy * W(142)
        cv.paint((min(ax, bx) - 6, min(ay, by) - 6, max(ax, bx) + 6, max(ay, by) + 6),
                 sd_capsule(ax, ay, bx, by, W(4)), gold)

    # 四隅刻度
    q = 1 / math.sqrt(2)
    for dx, dy in ((-q, -q), (q, -q), (-q, q), (q, q)):
        ax, ay = C + dx * W(172), C + dy * W(172)
        bx, by = C + dx * W(144), C + dy * W(144)
        cv.paint((min(ax, bx) - 6, min(ay, by) - 6, max(ax, bx) + 6, max(ay, by) + 6),
                 sd_capsule(ax, ay, bx, by, W(3)), gold, 0.75)

    # 中央四芒星：填一層很淡的金，再描邊
    big = W(96)
    cv.paint((S(C - 100), S(C - 100), S(C + 100), S(C + 100)), sd_star_fill(C, C, big), GLOW, 0.12)
    cv.paint((S(C - 102), S(C - 102), S(C + 102), S(C + 102)),
             sd_polyline(star_points(C, C, big), W(5)), gold)

    # 內層小四芒星，只描邊
    small = W(60)
    cv.paint((S(C - 66), S(C - 66), S(C + 66), S(C + 66)),
             sd_polyline(star_points(C, C, small), W(2.5)), gold, 0.90)

    # 星點：四正、四隅，以及正中央的「天心」
    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        cx, cy = C + dx * W(182), C + dy * W(182)
        cv.paint((cx - 8, cy - 8, cx + 8, cy + 8), sd_circle(cx, cy, W(5)), gold)
    for dx, dy in ((-q, -q), (q, -q), (-q, q), (q, q)):
        cx, cy = C + dx * W(187), C + dy * W(187)
        cv.paint((cx - 7, cy - 7, cx + 7, cy + 7), sd_circle(cx, cy, W(3.5)), gold)
    cv.paint((C - 9, C - 9, C + 9, C + 9), sd_circle(C, C, W(6)), gold)

    return cv


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")
    os.makedirs(out, exist_ok=True)
    draw(512).png(os.path.join(out, "icon-512.png"))
    draw(192).png(os.path.join(out, "icon-192.png"))
    draw(180, scale=0.94).png(os.path.join(out, "apple-touch-icon.png"))
    # maskable：系統會裁成圓形或圓角，所以底要鋪滿、圖案縮進安全區
    draw(512, scale=0.72, squircle=False).png(os.path.join(out, "maskable-512.png"))
