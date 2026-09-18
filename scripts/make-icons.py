#!/usr/bin/env python3
"""Generate the extension icons.

The icon is a short list whose top row is marked with a bright dot and the
rest faded: the unwatched one standing out from the watched ones.

It deliberately avoids a red rounded square with a white play triangle.
That is YouTube's mark, and an extension that borrows it invites a
trademark rejection from the Chrome Web Store however innocent the intent.

Standard library only (zlib + struct), so the icons can be regenerated on
any machine with Python, without an image library or a binary design file:

    python3 scripts/make-icons.py
"""

import struct
import zlib
from pathlib import Path

SIZES = (16, 48, 128)
SUPERSAMPLE = 4

BACKGROUND = (79, 70, 229)      # indigo, nothing like YouTube red
UNWATCHED = (251, 191, 36)      # amber: the row that stands out
WATCHED = (255, 255, 255)       # white, faded down below

CORNER_RADIUS = 0.22
ROW_Y = (0.31, 0.50, 0.69)
ROW_ALPHA = (1.0, 0.45, 0.45)   # top row bright, the watched ones faded

DOT_X = 0.28
DOT_RADIUS = 0.072
BAR_X0, BAR_X1 = 0.42, 0.76
BAR_HALF_HEIGHT = 0.045


def in_rounded_rect(x, y, x0, y0, x1, y1, radius):
    cx = min(max(x, x0 + radius), x1 - radius)
    cy = min(max(y, y0 + radius), y1 - radius)
    if x0 <= x <= x1 and y0 <= y <= y1:
        if cx == x or cy == y:
            return True
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= radius * radius


def in_circle(x, y, cx, cy, radius):
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= radius * radius


def over(src, src_alpha, dst):
    """Composite src over dst, both opaque RGB triples."""
    return tuple(round(s * src_alpha + d * (1 - src_alpha)) for s, d in zip(src, dst))


def shade(x, y):
    """Colour of the unit-square point (x, y) as (r, g, b, a)."""
    if not in_rounded_rect(x, y, 0.0, 0.0, 1.0, 1.0, CORNER_RADIUS):
        return (0, 0, 0, 0)

    colour = BACKGROUND

    for index, row_y in enumerate(ROW_Y):
        alpha = ROW_ALPHA[index]
        ink = UNWATCHED if index == 0 else WATCHED

        if in_circle(x, y, DOT_X, row_y, DOT_RADIUS):
            colour = over(ink, alpha, colour)
        elif in_rounded_rect(
            x,
            y,
            BAR_X0,
            row_y - BAR_HALF_HEIGHT,
            BAR_X1,
            row_y + BAR_HALF_HEIGHT,
            BAR_HALF_HEIGHT,
        ):
            colour = over(ink, alpha, colour)

    return (*colour, 255)


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

            row += bytes((round(r / a), round(g / a), round(b / a), round(255 * a / samples)))
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
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def main():
    out = Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(exist_ok=True)

    for size in SIZES:
        write_png(out / f"icon{size}.png", size, render(size))
        print(f"wrote icons/icon{size}.png ({size}x{size})")


if __name__ == "__main__":
    main()
