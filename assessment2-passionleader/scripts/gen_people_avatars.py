"""Superseded one-off generator for fictional people-page avatars.

This flat-vector silhouette approach (two-ink house style shared with
gen_brand_art.py, each portrait with a small topical badge tied to that
person's research blurb) was the original stance: avoid sourcing or
generating a real-or-real-seeming human face for a fictional persona,
in favour of an obviously-illustrated stand-in.

That policy was revisited: the 8 people photos now ship as photoreal
AI-generated headshots (flux-schnell via the course image proxy, see
scripts/gen_people_prompts.txt) instead. They replace the earlier
real-photographer stock photos (Pexels/Unsplash) that were credited in
each person's markdown body, which had the same real-individual-as-
fictional-persona problem this script was written to avoid, just via a
different source. A generated photoreal face that doesn't correspond to
an actual person avoids that specific problem; it doesn't need to be
non-photoreal to do so.

Kept for reference / as a fallback style, not currently applied. Not
part of the build; run manually to (re)produce
src/assets/images/people/<slug>.png if reverting to this look.
"""

import math

from PIL import Image, ImageDraw

from gen_brand_art import ACCENT, CREAM, INK

# Wide landscape canvas: both the People grid card (16/9, object-fit: cover)
# and the People detail hero (much wider, shorter) center-crop this image
# with no per-image override available (astro-theme-university is a fixed
# platform). A 3:1 canvas is wide enough that both containers crop left/right
# rather than top/bottom, so keeping the face and badge within a vertically-
# centered band — not the top/bottom edges or the far corners — lets them
# survive either crop.
W, H = 1440, 480
CX, CY = W / 2, H / 2 - 10


def base(d, bg):
    d.rectangle([0, 0, W, H], fill=bg)
    # head + shoulders silhouette, shared by every person
    d.ellipse([CX - 200, CY - 40, CX + 200, CY + 300], fill=INK)  # shoulders
    d.ellipse([CX - 95, CY - 190, CX + 95, CY], fill=INK)  # head


def hair_bald(d):
    pass


def hair_short(d):
    d.pieslice([CX - 95, CY - 190, CX + 95, CY + 10], 180, 360, fill=(60, 60, 60))


def hair_bun(d):
    d.pieslice([CX - 95, CY - 195, CX + 95, CY - 20], 180, 360, fill=(60, 60, 60))
    d.ellipse([CX - 30, CY - 250, CX + 30, CY - 190], fill=(60, 60, 60))


def hair_afro(d):
    d.ellipse([CX - 130, CY - 230, CX + 130, CY - 20], fill=(60, 60, 60))
    d.ellipse([CX - 95, CY - 190, CX + 95, CY], fill=INK)  # re-cut the face oval


def hair_long(d):
    d.pieslice([CX - 100, CY - 195, CX + 100, CY + 60], 180, 360, fill=(60, 60, 60))
    d.rectangle([CX - 105, CY - 60, CX - 75, CY + 90], fill=(60, 60, 60))
    d.rectangle([CX + 75, CY - 60, CX + 105, CY + 90], fill=(60, 60, 60))
    d.ellipse([CX - 95, CY - 190, CX + 95, CY], fill=INK)


def hair_bob(d):
    d.pieslice([CX - 100, CY - 195, CX + 100, CY - 10], 180, 360, fill=(60, 60, 60))
    d.rectangle([CX - 100, CY - 90, CX - 78, CY - 10], fill=(60, 60, 60))
    d.rectangle([CX + 78, CY - 90, CX + 100, CY - 10], fill=(60, 60, 60))
    d.ellipse([CX - 95, CY - 190, CX + 95, CY], fill=INK)


def hair_curly(d):
    for ang in range(0, 360, 30):
        rad = math.radians(ang)
        x = CX + 95 * math.cos(rad)
        y = (CY - 95) + 95 * math.sin(rad) * 0.9
        if y < CY - 20:
            d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=(60, 60, 60))
    d.ellipse([CX - 95, CY - 190, CX + 95, CY], fill=INK)


def hair_swoop(d):
    d.pieslice([CX - 95, CY - 195, CX + 95, CY - 30], 180, 340, fill=(60, 60, 60))
    d.ellipse([CX - 95, CY - 190, CX + 95, CY], fill=INK)


HAIR = {
    "bald": hair_bald,
    "short": hair_short,
    "bun": hair_bun,
    "afro": hair_afro,
    "long": hair_long,
    "bob": hair_bob,
    "curly": hair_curly,
    "swoop": hair_swoop,
}


def badge(d, kind):
    """Small topical motif, on its own accent disc, tucked beside the face
    within the vertically-centered safe band rather than the image corner."""
    bx, by, br = CX + 140, CY + 90, 58
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=ACCENT)
    d.ellipse([bx - br, by - br, bx + br, by + br], outline=CREAM, width=6)

    if kind == "litter":
        # a dropped wrapper (small rect) inside a prohibited ring
        d.rectangle([bx - 14, by - 8, bx + 14, by + 12], fill=CREAM)
        d.ellipse([bx - 34, by - 34, bx + 34, by + 34], outline=CREAM, width=7)
        d.line([bx - 24, by + 24, bx + 24, by - 24], fill=CREAM, width=7)
    elif kind == "clipboard":
        d.rectangle([bx - 22, by - 28, bx + 22, by + 30], outline=CREAM, width=6)
        d.rectangle([bx - 10, by - 34, bx + 10, by - 24], fill=CREAM)
        for i in range(3):
            yy = by - 8 + i * 14
            d.line([bx - 12, yy, bx + 12, yy], fill=CREAM, width=4)
    elif kind == "sound":
        for i, r in enumerate((14, 26, 38)):
            d.arc([bx - r, by - r, bx + r, by + r], -50, 50, fill=CREAM, width=5)
    elif kind == "queue":
        for i in range(3):
            xx = bx - 24 + i * 20
            d.ellipse([xx - 7, by - 7, xx + 7, by + 7], fill=CREAM)
        d.line([bx + 24, by, bx + 40, by], fill=CREAM, width=5)
    elif kind == "transit":
        d.rectangle([bx - 28, by - 18, bx + 28, by + 18], outline=CREAM, width=6)
        d.ellipse([bx - 20, by + 12, bx - 8, by + 24], fill=CREAM)
        d.ellipse([bx + 8, by + 12, bx + 20, by + 24], fill=CREAM)
    elif kind == "convenor":
        # a small star: founding/chair role
        pts = []
        for i in range(10):
            ang = math.radians(-90 + i * 36)
            r = 28 if i % 2 == 0 else 12
            pts.append((bx + r * math.cos(ang), by + r * math.sin(ang)))
        d.polygon(pts, fill=CREAM)
    elif kind == "property":
        d.ellipse([bx - 20, by - 4, bx + 20, by + 26], outline=CREAM, width=6)
        d.arc([bx + 16, by - 2, bx + 34, by + 16], -90, 90, fill=CREAM, width=6)
        d.ellipse([bx - 34, by - 34, bx + 34, by + 34], outline=CREAM, width=7)
        d.line([bx - 24, by + 24, bx + 24, by - 24], fill=CREAM, width=7)
    elif kind == "cough":
        d.ellipse([bx - 16, by - 16, bx + 16, by + 16], fill=CREAM)
        for ang in range(-30, 45, 30):
            rad = math.radians(ang)
            x0, y0 = bx + 16 * math.cos(rad), by + 16 * math.sin(rad)
            x1, y1 = bx + 34 * math.cos(rad), by + 34 * math.sin(rad)
            d.line([x0, y0, x1, y1], fill=CREAM, width=5)


PEOPLE = [
    ("amara-chukwu", "afro", "litter", (232, 244, 253)),
    ("emeka-osei", "short", "clipboard", (236, 246, 255)),
    ("haruto-tanaka", "swoop", "sound", (230, 242, 252)),
    ("ingrid-halvorsen", "bob", "queue", (234, 245, 254)),
    ("lachlan-reeve", "curly", "transit", (238, 247, 255)),
    ("perpetua-vance", "bun", "convenor", (229, 241, 252)),
    ("rosa-mercado", "long", "property", (235, 246, 255)),
    ("wei-lin-chow", "bald", "cough", (231, 243, 253)),
]


def make(slug, hair, badge_kind, bg):
    im = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(im)
    base(d, bg)
    HAIR[hair](d)
    badge(d, badge_kind)
    im.save(f"src/assets/images/people/{slug}.png")


if __name__ == "__main__":
    import os

    os.makedirs("src/assets/images/people", exist_ok=True)
    for slug, hair, badge_kind, bg in PEOPLE:
        make(slug, hair, badge_kind, bg)
    print(f"wrote {len(PEOPLE)} avatars to src/assets/images/people/")
