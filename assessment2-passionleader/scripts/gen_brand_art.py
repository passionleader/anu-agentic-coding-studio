"""One-off generator for the course's flat two-ink artwork. Not part of the
build; run manually to (re)produce src/assets/images/card.png and hero-home.png."""

import math
from PIL import Image, ImageDraw, ImageFont

# Matches src/styles/brand.css's bright red palette: a warm near-white
# background (in the same direction as the theme's derived --at-bg for a red
# primary) with the brand red as the accent, ink for the sneeze-burst mark.
CREAM = (251, 243, 242)
ACCENT = (192, 24, 47)
INK = (26, 26, 26)

SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"


def prohibited(draw, cx, cy, r, width, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=width)
    ang = math.radians(45)
    dx, dy = r * math.cos(ang), r * math.sin(ang)
    draw.line([cx - dx, cy + dy, cx + dx, cy - dy], fill=color, width=width)


def sneeze_burst(draw, cx, cy, color, scale=1.0):
    # a sad little teardrop with a flat, dejected face — the mark also used
    # for the site's favicon/logo (see src/assets/images/brand), so this
    # function's look and the standalone brand assets must be kept in sync.
    r = 46 * scale
    draw.ellipse([cx - r, cy - r * 0.35, cx + r, cy + r * 1.35], fill=color)
    draw.polygon(
        [(cx - r * 0.62, cy), (cx + r * 0.62, cy), (cx, cy - r * 1.3)], fill=color
    )
    er = r * 0.18
    ex, ey = r * 0.35, r * 0.1
    draw.ellipse([cx - ex - er, cy + ey - er, cx - ex + er, cy + ey + er], fill=CREAM)
    draw.ellipse([cx + ex - er, cy + ey - er, cx + ex + er, cy + ey + er], fill=CREAM)
    mw = r * 0.42
    draw.arc(
        [cx - mw, cy + ey + r * 0.28, cx + mw, cy + ey + r * 0.28 + mw],
        start=200,
        end=340,
        fill=CREAM,
        width=max(3, int(r * 0.09)),
    )


def make_card():
    w, h = 1200, 630
    im = Image.new("RGB", (w, h), CREAM)
    d = ImageDraw.Draw(im)

    d.rectangle([0, 0, w - 1, h - 1], outline=INK, width=10)

    sneeze_burst(d, 250, 300, INK, scale=1.5)
    prohibited(d, 250, 300, 165, 16, ACCENT)

    title_font = ImageFont.truetype(SERIF_BOLD, 74)
    sub_font = ImageFont.truetype(SANS, 32)
    code_font = ImageFont.truetype(SANS, 30)

    d.text((470, 190), "Weaponised", font=title_font, fill=INK)
    d.text((470, 270), "Etiquette", font=title_font, fill=INK)
    d.text((470, 360), "a field course in public nuisance", font=sub_font, fill=ACCENT)
    d.text((470, 410), "SLOP2950 · Slop University", font=code_font, fill=INK)

    im.save("src/assets/images/card.png")


def make_hero():
    w, h = 1600, 900
    im = Image.new("RGB", (w, h), CREAM)
    d = ImageDraw.Draw(im)

    # lecture-theatre seating, raked toward a vanishing point above the frame,
    # each row wider and lower than the one behind it
    rows = 9
    vx, vy = w / 2, -260
    offender_row, offender_col = 6, 6
    ox = oy = None
    for row in range(rows):
        t = row / (rows - 1)
        y = vy + (h - 40 - vy) * (t**1.15)
        seats = 6 + row
        span = 160 + 1500 * (t**1.05)
        x0 = w / 2 - span / 2
        r = 10 + 24 * t
        for i in range(seats):
            x = x0 + span * (i + 0.5) / seats
            if row == offender_row and i == offender_col:
                ox, oy = x, y
                continue
            d.ellipse([x - r, y - r, x + r, y + r], fill=ACCENT)

    # the offending attendee, mid-sneeze, breaking the pattern in ink
    sneeze_burst(d, ox, oy, INK, scale=0.95)

    # a prohibited ring drawn tight around that one seat
    prohibited(d, ox, oy, 105, 14, INK)

    im.save("src/assets/images/hero-home.png")


if __name__ == "__main__":
    make_card()
    make_hero()
    print("wrote card.png and hero-home.png")
