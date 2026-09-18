#!/usr/bin/env python3
"""Generate the extension icons.

Written against the standard library only (zlib + struct) so the icons can be
regenerated on any machine with Python, without pulling in an image library
or committing a binary design file. Run from the repository root:

    python3 scripts/make-icons.py
"""

import struct
import zlib
from pathlib import Path

SIZES = (16, 48, 128)
SUPERSAMPLE = 4

YOUTUBE_RED = (255, 0, 0, 255)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

CORNER_RADIUS = 0.22
TRIANGLE = ((0.34, 0.26), (0.34, 0.74), (0.71, 0.50))
DOT_CENTRE = (0.78, 0.22)
DOT_RADIUS = 0.15


def in_rounded_square(x, y, radius=CORNER_RADIUS):
    """Unit-square rounded-rectangle test."""
    cx = min(max(x, radius), 1.0 - radius)
    cy = min(max(y, radius), 1.0 - radius)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= radius * radius


def in_triangle(x, y, triangle=TRIANGLE):
    (ax, ay), (bx, by), (cx, cy) = triangle

    def side(px, py, qx, qy):
        return (qx - px) * (y - py) - (qy - py) * (x - px)

    d1 = side(ax, ay, bx, by)
    d2 = side(bx, by, cx, cy)
    d3 = side(cx, cy, ax, ay)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def in_dot(x, y):
    dx = x - DOT_CENTRE[0]
    dy = y - DOT_CENTRE[1]
    return dx * dx + dy * dy <= DOT_RADIUS * DOT_RADIUS


def shade(x, y):
    """Colour of the unit-square point (x, y): a play button, unread dot."""
    if in_dot(x, y):
        return WHITE
    if not in_rounded_square(x, y):
        return TRANSPARENT
    if in_triangle(x, y):
        return WHITE
    return YOUTUBE_RED


def render(size):
    """Supersampled RGBA rows, premultiplied while averaging for clean edges."""
    rows = []
    samples = SUPERSAMPLE * SUPERSAMPLE

    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    x = (px + (sx + 0.5) / SUPERSAMPLE) / size
                    y = (py + (sy + 0.5) / SUPERSAMPLE) / size
                    sr, sg, sb, sa = shade(x, y)
                    alpha = sa / 255.0
                    r += sr * alpha
                    g += sg * alpha
                    b += sb * alpha
                    a += alpha

            if a == 0:
                row += bytes((0, 0, 0, 0))
                continue

            row += bytes(
                (
                    round(r / a),
                    round(g / a),
                    round(b / a),
                    round(255 * a / samples),
                )
            )
        rows.append(bytes(row))

    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def main():
    out = Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(exist_ok=True)

    for size in SIZES:
        target = out / f"icon{size}.png"
        write_png(target, size, render(size))
        print(f"wrote {target.relative_to(target.parent.parent)} ({size}x{size})")


if __name__ == "__main__":
    main()
