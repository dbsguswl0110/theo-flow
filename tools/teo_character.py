#!/usr/bin/env python3
"""Vector model sheet for TEO, drawn from the reference photos of the real dog.

Run `python3 tools/teo_character.py OUT.html` to write a preview page; the same functions feed the
design board. Traits taken from the photos: pale apricot-cream curly fur, round teddy-cut head, drooping
curly ears, small dark eyes, dark brown nose, pink tongue that is often out, a pom tail curled over the back,
cream front paws, a light-blue harness with green piping, and a lime tennis ball.
"""
import math
import random
import sys

OUTLINE = "#6B4A38"
FUR = "#E8C292"
FUR_LIGHT = "#F5DEB8"
FUR_SHADE = "#D2A06C"
EAR = "#DDAE7C"
CREAM = "#FBEFDA"
NOSE = "#6E4F47"
TONGUE = "#F08FA6"
TONGUE_DEEP = "#D9708C"
EYE = "#3A2B28"
BLUSH = "#F4A6A0"
HARNESS = "#A9D6E6"
HARNESS_DOT = "#7DB6CC"
PIPING = "#5FA34A"
BALL = "#CCDF8A"
BALL_SHADE = "#A9C25E"

_uid = 0


def uid(prefix="c"):
    global _uid
    _uid += 1
    return f"{prefix}{_uid}"


def circle(x, y, r):
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"/>'


def ellipse(x, y, rx, ry, rot=0):
    t = f' transform="rotate({rot} {x:.1f} {y:.1f})"' if rot else ""
    return f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx:.1f}" ry="{ry:.1f}"{t}/>'


def ring(cx, cy, rx, ry, n, r, start=0.0, jitter=0.12, seed=3):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        a = start + 2 * math.pi * i / n
        out.append(circle(cx + rx * math.cos(a), cy + ry * math.sin(a), r * (1 + rnd.uniform(-jitter, jitter))))
    return out


def blob(shapes, fill, sw=3.2, light=True, shade=True, bounds=None):
    """Filled shape with a clean outer outline, soft light and shade."""
    inner = "".join(shapes)
    cid = uid("k")
    parts = [
        f'<g stroke="{OUTLINE}" stroke-width="{sw * 2}" stroke-linejoin="round" fill="{fill}">{inner}</g>',
        f'<g fill="{fill}">{inner}</g>',
    ]
    if bounds and (light or shade):
        x0, y0, x1, y1 = bounds
        w, h = x1 - x0, y1 - y0
        parts.append(f'<clipPath id="{cid}">{inner}</clipPath><g clip-path="url(#{cid})">')
        if light:
            parts.append(f'<ellipse cx="{x0 + w * 0.34:.1f}" cy="{y0 + h * 0.28:.1f}" rx="{w * 0.34:.1f}" ry="{h * 0.26:.1f}" fill="#fff" opacity="0.32"/>')
        if shade:
            parts.append(f'<ellipse cx="{x0 + w * 0.62:.1f}" cy="{y0 + h * 1.02:.1f}" rx="{w * 0.62:.1f}" ry="{h * 0.34:.1f}" fill="{FUR_SHADE}" opacity="0.5"/>')
        parts.append("</g>")
    return "".join(parts)


def curls(cx, cy, n, spread, size=4.2, seed=5, color="#C0925F"):
    """Little curl marks that read as curly fur."""
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        x = cx + rnd.uniform(-spread, spread)
        y = cy + rnd.uniform(-spread, spread)
        out.append(
            f'<path d="M {x:.1f} {y:.1f} q {size:.1f} {-size:.1f} {size * 1.7:.1f} 0 q {-size * 0.2:.1f} {size * 1.2:.1f} {-size:.1f} {size * 0.9:.1f}" '
            f'fill="none" stroke="{color}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>'
        )
    return "".join(out)


def eye(x, y, kind, side=1, s=1.0):
    if kind == "open":
        return (
            f'<ellipse cx="{x}" cy="{y}" rx="{7.2 * s}" ry="{8.6 * s}" fill="{EYE}"/>'
            f'<circle cx="{x + 2.2 * s * side}" cy="{y - 3 * s}" r="{2.7 * s}" fill="#fff"/>'
            f'<circle cx="{x - 2.2 * s * side}" cy="{y + 3 * s}" r="{1.2 * s}" fill="#fff" opacity="0.8"/>'
        )
    if kind == "happy":  # ^ shaped
        return f'<path d="M {x - 8 * s} {y + 3 * s} Q {x} {y - 9 * s} {x + 8 * s} {y + 3 * s}" fill="none" stroke="{EYE}" stroke-width="3.6" stroke-linecap="round"/>'
    if kind == "sleep":
        return f'<path d="M {x - 8 * s} {y - 1 * s} Q {x} {y + 7 * s} {x + 8 * s} {y - 1 * s}" fill="none" stroke="{EYE}" stroke-width="3.4" stroke-linecap="round"/>'
    if kind == "wide":
        return (
            f'<ellipse cx="{x}" cy="{y}" rx="{8.4 * s}" ry="{10 * s}" fill="{EYE}"/>'
            f'<circle cx="{x + 2.6 * s * side}" cy="{y - 3.4 * s}" r="{3.2 * s}" fill="#fff"/>'
        )
    if kind == "heart":
        return (
            f'<path d="M {x} {y + 9 * s} C {x - 14 * s} {y - 1 * s} {x - 7 * s} {y - 12 * s} {x} {y - 5 * s} '
            f'C {x + 7 * s} {y - 12 * s} {x + 14 * s} {y - 1 * s} {x} {y + 9 * s} Z" fill="#E8607C" stroke="{OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>'
        )
    return ""


def face(expr="smile", s=1.0, eye_s=1.0):
    """Eyes, nose, mouth and tongue around the origin (head centre)."""
    eyes = {
        "smile": ("open", "open"),
        "calm": ("open", "open"),
        "happy": ("open", "open"),
        "joy": ("happy", "happy"),
        "wink": ("open", "happy"),
        "surprise": ("wide", "wide"),
        "sleepy": ("sleep", "sleep"),
        "love": ("heart", "heart"),
    }[expr]
    parts = [
        f'<circle cx="{-42 * s}" cy="{14 * s}" r="{9 * s}" fill="{BLUSH}" opacity="0.5"/>',
        f'<circle cx="{42 * s}" cy="{14 * s}" r="{9 * s}" fill="{BLUSH}" opacity="0.5"/>',
        eye(-25 * s, -2 * s, eyes[0], -1, s * eye_s),
        eye(25 * s, -2 * s, eyes[1], 1, s * eye_s),
    ]
    # muzzle: a lighter teddy muzzle
    muzzle = "".join(ring(0, 18 * s, 25 * s, 16 * s, 10, 9 * s, jitter=0.08, seed=11)) + ellipse(0, 18 * s, 27 * s, 18 * s)
    parts.insert(0, f'<g fill="{FUR_LIGHT}" stroke="none" opacity="0.95">{muzzle}</g>')
    nose = (
        f'<path d="M {-10 * s} {10 * s} Q 0 {3 * s} {10 * s} {10 * s} Q {8 * s} {22 * s} 0 {24 * s} Q {-8 * s} {22 * s} {-10 * s} {10 * s} Z" fill="{NOSE}" stroke="{OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>'
        f'<ellipse cx="{-3.2 * s}" cy="{11.5 * s}" rx="{3.4 * s}" ry="{1.7 * s}" fill="#fff" opacity="0.45"/>'
    )
    parts.append(nose)
    mouth_y = 24 * s
    if expr in ("smile", "wink", "love", "calm"):
        parts.append(
            f'<path d="M 0 {mouth_y} L 0 {mouth_y + 5 * s} M 0 {mouth_y + 5 * s} Q {-8 * s} {mouth_y + 14 * s} {-16 * s} {mouth_y + 7 * s} M 0 {mouth_y + 5 * s} Q {8 * s} {mouth_y + 14 * s} {16 * s} {mouth_y + 7 * s}" '
            f'fill="none" stroke="{OUTLINE}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
        )
        if expr != "calm":
            parts.append(
                f'<path d="M {3 * s} {mouth_y + 8 * s} Q {26 * s} {mouth_y + 6 * s} {23 * s} {mouth_y + 24 * s} Q {21 * s} {mouth_y + 36 * s} {12 * s} {mouth_y + 33 * s} Q {3 * s} {mouth_y + 30 * s} {3 * s} {mouth_y + 8 * s} Z" '
                f'fill="{TONGUE}" stroke="{OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>'
                f'<path d="M {12 * s} {mouth_y + 14 * s} L {12 * s} {mouth_y + 26 * s}" stroke="{TONGUE_DEEP}" stroke-width="1.8" stroke-linecap="round"/>'
            )
    elif expr in ("happy", "joy"):
        parts.append(
            f'<path d="M {-18 * s} {mouth_y + 6 * s} Q 0 {mouth_y + 44 * s} {18 * s} {mouth_y + 6 * s} Q 0 {mouth_y + 12 * s} {-18 * s} {mouth_y + 6 * s} Z" '
            f'fill="#7A3B3B" stroke="{OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>'
            f'<path d="M {-9 * s} {mouth_y + 26 * s} Q 0 {mouth_y + 18 * s} {9 * s} {mouth_y + 26 * s} Q 0 {mouth_y + 38 * s} {-9 * s} {mouth_y + 26 * s} Z" fill="{TONGUE}"/>'
        )
    elif expr == "surprise":
        parts.append(f'<ellipse cx="0" cy="{mouth_y + 12 * s}" rx="{6 * s}" ry="{8 * s}" fill="#7A3B3B" stroke="{OUTLINE}" stroke-width="2"/>')
    elif expr == "sleepy":
        parts.append(
            f'<path d="M 0 {mouth_y} L 0 {mouth_y + 4 * s} M 0 {mouth_y + 4 * s} Q {-6 * s} {mouth_y + 9 * s} {-12 * s} {mouth_y + 5 * s} M 0 {mouth_y + 4 * s} Q {6 * s} {mouth_y + 9 * s} {12 * s} {mouth_y + 5 * s}" '
            f'fill="none" stroke="{OUTLINE}" stroke-width="2.2" stroke-linecap="round"/>'
        )
    return "".join(parts)


def head(cx, cy, scale=1.0, tilt=0, expr="smile", ears="down", seed=2, eye_s=1.0):
    """The round teddy-cut head with curly drooping ears, centred on (cx, cy)."""
    ear_rot = {"down": 8, "up": -16, "back": 24}[ears]
    ears_svg = ""
    for side in (-1, 1):
        ex, ey = side * 58, 26 if ears == "down" else 8
        shapes = [ellipse(ex, ey, 22, 40, rot=side * ear_rot)] + ring(ex, ey, 18, 36, 12, 10, jitter=0.1, seed=seed + (3 if side > 0 else 0))
        ears_svg += blob(shapes, EAR, bounds=(ex - 30, ey - 46, ex + 30, ey + 46))
        ears_svg += f'<g transform="rotate({side * ear_rot} {ex} {ey})">{curls(ex, ey + 4, 5, 18, 4, seed + side + 9)}</g>'
    shapes = [circle(0, 0, 53)] + ring(0, 0, 49, 47, 17, 14.5, jitter=0.1, seed=seed)
    head_svg = blob(shapes, FUR, bounds=(-64, -64, 64, 64))
    head_svg += curls(0, -34, 9, 30, 4.4, seed + 21)
    return (
        f'<g transform="translate({cx} {cy}) rotate({tilt}) scale({scale})">'
        f"{ears_svg}{head_svg}{face(expr, 1.0, eye_s)}</g>"
    )


def harness_front(cx, cy):
    """Chest harness seen from the front: light-blue yoke, green piping, round tag."""
    path = f"M {cx - 40} {cy - 10} Q {cx} {cy + 8} {cx + 40} {cy - 10} L {cx + 32} {cy + 30} Q {cx} {cy + 62} {cx - 32} {cy + 30} Z"
    dots = "".join(
        f'<circle cx="{cx + dx}" cy="{cy + dy}" r="2.4" fill="{HARNESS_DOT}"/>'
        for dx, dy in [(-22, 4), (22, 4), (-14, 20), (14, 20), (0, 36), (-27, 18), (27, 18)]
    )
    return (
        f'<path d="{path}" fill="{HARNESS}" stroke="{OUTLINE}" stroke-width="7" stroke-linejoin="round"/>'
        f'<path d="{path}" fill="none" stroke="{PIPING}" stroke-width="4.2" stroke-linejoin="round"/>'
        f"{dots}"
        f'<circle cx="{cx}" cy="{cy + 22}" r="11" fill="{CREAM}" stroke="{OUTLINE}" stroke-width="2.6"/>'
        f'<g transform="translate({cx} {cy + 22}) scale(0.34)" fill="{OUTLINE}"><ellipse cx="0" cy="5" rx="7" ry="6"/>'
        f'<circle cx="-9" cy="-4" r="2.6"/><circle cx="-3" cy="-9" r="2.6"/><circle cx="3.4" cy="-9" r="2.6"/><circle cx="9" cy="-4" r="2.6"/></g>'
    )


def paw(cx, cy, w=14, h=9):
    return (
        f'<ellipse cx="{cx}" cy="{cy}" rx="{w}" ry="{h}" fill="{CREAM}" stroke="{OUTLINE}" stroke-width="2.6"/>'
        f'<path d="M {cx - w * 0.3} {cy + 1} v {h * 0.55} M {cx + w * 0.3} {cy + 1} v {h * 0.55}" stroke="{OUTLINE}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>'
    )


def ball(cx, cy, r=18):
    cid = uid("b")
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{BALL}" stroke="{OUTLINE}" stroke-width="2.8"/>'
        f'<clipPath id="{cid}"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>'
        f'<g clip-path="url(#{cid})"><path d="M {cx - r * 0.9} {cy - r * 0.2} Q {cx} {cy + r * 0.55} {cx + r * 0.9} {cy - r * 0.2}" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.7"/>'
        f'<ellipse cx="{cx + r * 0.2}" cy="{cy + r * 0.95}" rx="{r}" ry="{r * 0.4}" fill="{BALL_SHADE}" opacity="0.6"/></g>'
        f'<ellipse cx="{cx - r * 0.38}" cy="{cy - r * 0.42}" rx="{r * 0.2}" ry="{r * 0.12}" fill="#fff" opacity="0.7" transform="rotate(-30 {cx - r * 0.38} {cy - r * 0.42})"/>'
    )


def tail(cx, cy, r=15, seed=8):
    """A pom-pom tail curled over the back."""
    shapes = [circle(cx, cy, r * 0.8)] + ring(cx, cy, r * 0.62, r * 0.62, 9, r * 0.42, jitter=0.12, seed=seed)
    return blob(shapes, FUR, bounds=(cx - r, cy - r, cx + r, cy + r)) + curls(cx, cy, 2, r * 0.4, 3.2, seed + 3)


def fluff(shapes, bounds, fill=FUR, **kw):
    return blob(shapes, fill, bounds=bounds, **kw)


def limb(x0, y0, x1, y1, w=26, paw_w=15, paw_h=10, seed=1, paw_dy=0):
    """A fluffy cylinder leg (teddy-cut) ending in a cream paw."""
    n = max(3, int(math.hypot(x1 - x0, y1 - y0) / (w * 0.32)))
    rnd = random.Random(seed)
    shapes = []
    for i in range(n + 1):
        t = i / n
        shapes.append(circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2 * (1 + rnd.uniform(-0.06, 0.06))))
    xs = [x0, x1]
    ys = [y0, y1]
    bounds = (min(xs) - w / 2, min(ys) - w / 2, max(xs) + w / 2, max(ys) + w / 2)
    return fluff(shapes, bounds, light=False) + paw(x1, y1 + paw_dy, paw_w, paw_h)


def band(path, width):
    """Light-blue webbing with green piping on both edges."""
    return (
        f'<path d="{path}" fill="none" stroke="{OUTLINE}" stroke-width="{width + 6}" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<path d="{path}" fill="none" stroke="{PIPING}" stroke-width="{width + 2.4}" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<path d="{path}" fill="none" stroke="{HARNESS}" stroke-width="{width - 2.4}" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def tag(cx, cy, r=11):
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{CREAM}" stroke="{OUTLINE}" stroke-width="2.6"/>'
        f'<g transform="translate({cx} {cy}) scale({r / 32})" fill="{OUTLINE}"><ellipse cx="0" cy="5" rx="7" ry="6"/>'
        f'<circle cx="-9" cy="-4" r="2.6"/><circle cx="-3" cy="-9" r="2.6"/><circle cx="3.4" cy="-9" r="2.6"/><circle cx="9" cy="-4" r="2.6"/></g>'
    )


def zzz(x, y, s=1.0):
    out = ""
    for i, k in enumerate((1.0, 0.78, 0.6)):
        px, py = x + i * 20 * s, y - i * 22 * s
        w = 12 * k * s
        out += (
            f'<path d="M {px} {py} h {w} l {-w} {w} h {w}" fill="none" stroke="#9AB6C8" stroke-width="{3.2 * k * s + 0.6}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
        )
    return out


def puff(x, y, r=7):
    return f'<g fill="#fff" stroke="#E4D3C2" stroke-width="1.6" opacity="0.95">{circle(x, y, r)}{circle(x + r * 1.1, y + r * 0.2, r * 0.7)}{circle(x - r * 1.0, y + r * 0.3, r * 0.6)}</g>'


def svg(width, height, body, label=""):
    aria = f' role="img" aria-label="{label}"' if label else ' aria-hidden="true"'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}"{aria}>{body}</svg>'


def shadow(cx, cy, rx, ry=7):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#6B4A38" opacity="0.14"/>'


# ───────────── poses ─────────────

def pose_sit(expr="smile"):
    """Front sitting: big teddy head, small pear-shaped body, harness, curled tail."""
    body_shapes = [ellipse(120, 214, 50, 54)] + ring(120, 216, 47, 51, 12, 11, jitter=0.1, seed=4)
    body = fluff(body_shapes, (70, 160, 170, 270))
    chest = f'<ellipse cx="120" cy="196" rx="24" ry="30" fill="{CREAM}" opacity="0.9"/>'
    hind = fluff([ellipse(78, 258, 26, 15)], (52, 243, 104, 273), light=False) + fluff([ellipse(162, 258, 26, 15)], (136, 243, 188, 273), light=False)
    legs = limb(104, 196, 104, 252, 26, 15, 10, seed=1) + limb(136, 196, 136, 252, 26, 15, 10, seed=2)
    harness = (
        band("M 80 150 Q 120 176 160 150", 14)
        + band("M 120 166 L 120 198", 13)
        + tag(120, 206, 11)
    )
    return svg(
        240,
        290,
        shadow(120, 272, 78)
        + tail(176, 214, 17)
        + body + hind + chest + legs + harness + head(120, 88, 1.08, tilt=-6, expr=expr),
        "앉아 있는 TEO",
    )


def pose_run():
    """Side-on gallop to the right, ball in mouth, pom tail up, dust puffs behind."""
    parts = [shadow(150, 222, 96, 7), puff(34, 196, 8), puff(58, 214, 6)]
    parts.append(tail(70, 88, 17, seed=3))
    # hind legs stretched back, front legs reaching forward
    parts.append(limb(104, 142, 62, 190, 24, 13, 9, seed=3))
    parts.append(limb(124, 148, 100, 202, 24, 13, 9, seed=4))
    body = fluff([ellipse(146, 118, 60, 36)] + ring(146, 118, 56, 32, 14, 11, jitter=0.1, seed=6), (84, 80, 208, 158))
    parts.append(body)
    parts.append(f'<ellipse cx="170" cy="134" rx="22" ry="16" fill="{CREAM}" opacity="0.8"/>')
    parts.append(limb(176, 140, 224, 182, 24, 13, 9, seed=5))
    parts.append(limb(158, 146, 196, 204, 24, 13, 9, seed=6))
    # harness: back strap, chest strap, tag
    parts.append(band("M 112 90 Q 146 84 178 92", 11))
    parts.append(band("M 182 92 Q 196 122 184 154", 12))
    parts.append(tag(190, 150, 9))
    parts.append(head(236, 92, 0.72, tilt=10, expr="smile", ears="back"))
    parts.append(ball(266, 122, 14))
    return svg(310, 240, "".join(parts), "공을 물고 달리는 TEO")


def pose_lie():
    """Belly down, front paws forward with the tennis ball between them."""
    parts = [shadow(120, 266, 92)]
    parts.append(tail(196, 226, 19, seed=5))
    parts.append(fluff([ellipse(120, 226, 74, 40)] + ring(120, 226, 70, 36, 16, 12, jitter=0.1, seed=7), (46, 186, 194, 266)))
    parts.append(fluff([ellipse(58, 248, 26, 16)], (32, 232, 84, 264), light=False))
    parts.append(fluff([ellipse(182, 248, 26, 16)], (156, 232, 208, 264), light=False))
    parts.append(f'<ellipse cx="120" cy="218" rx="30" ry="20" fill="{CREAM}" opacity="0.9"/>')
    parts.append(band("M 78 158 Q 120 184 162 158", 14))
    parts.append(tag(120, 190, 10))
    parts.append(limb(94, 226, 92, 262, 26, 16, 10, seed=7))
    parts.append(limb(146, 226, 148, 262, 26, 16, 10, seed=8))
    parts.append(ball(120, 262, 17))
    parts.append(head(120, 104, 1.08, tilt=4, expr="happy"))
    return svg(240, 290, "".join(parts), "공과 엎드린 TEO")


def pose_sleep():
    """Curled up asleep: head on paws, tail wrapped, snore Zs."""
    parts = [shadow(130, 182, 98)]
    parts.append(fluff([ellipse(126, 138, 78, 46)] + ring(126, 138, 74, 42, 16, 13, jitter=0.1, seed=9), (48, 92, 204, 184)))
    parts.append(tail(62, 148, 24, seed=6))
    parts.append(f'<ellipse cx="108" cy="118" rx="26" ry="9" fill="#fff" opacity="0.22"/>')
    parts.append(band("M 150 108 Q 160 126 152 150", 12))
    parts.append(paw(178, 160, 18, 11) + paw(150, 168, 16, 10))
    parts.append(head(172, 126, 0.74, tilt=12, expr="sleepy"))
    parts.append(zzz(212, 66, 1.0))
    return svg(270, 210, "".join(parts), "자고 있는 TEO")


def pose_peek():
    """Peeking over a cushion with both paws on the edge."""
    parts = [head(120, 98, 1.0, tilt=-3, expr="smile", ears="up")]
    cushion = (
        f'<path d="M 26 138 Q 120 120 214 138 Q 226 170 214 208 Q 120 222 26 208 Q 14 170 26 138 Z" fill="#CFE3C9" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round"/>'
        f'<path d="M 38 150 Q 120 136 202 150" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.5"/>'
        f'<circle cx="120" cy="178" r="4" fill="{OUTLINE}" opacity="0.35"/>'
    )
    parts.append(cushion)
    parts.append(paw(86, 136, 18, 12) + paw(154, 136, 18, 12))
    return svg(240, 230, "".join(parts), "쿠션 너머로 보는 TEO")


def pose_stand():
    """Side view standing proud with the ball, for the intro walk-in."""
    parts = [shadow(120, 212, 80)]
    parts.append(tail(52, 110, 17, seed=4))
    parts.append(limb(80, 140, 78, 200, 24, 13, 9, seed=11))
    parts.append(limb(104, 146, 106, 204, 24, 13, 9, seed=12))
    parts.append(fluff([ellipse(112, 130, 54, 34)] + ring(112, 130, 50, 30, 13, 11, jitter=0.1, seed=3), (58, 94, 166, 166)))
    parts.append(f'<ellipse cx="138" cy="146" rx="20" ry="14" fill="{CREAM}" opacity="0.8"/>')
    parts.append(limb(138, 148, 140, 204, 24, 13, 9, seed=13))
    parts.append(limb(158, 144, 164, 202, 24, 13, 9, seed=14))
    parts.append(band("M 84 104 Q 112 98 140 106", 11))
    parts.append(band("M 146 106 Q 158 128 146 156", 12))
    parts.append(tag(152, 152, 9))
    parts.append(head(180, 96, 0.8, tilt=6, expr="smile", ears="down"))
    return svg(260, 230, "".join(parts), "서 있는 TEO")


POSES = [
    ("sit", "앉아서 기다리기", pose_sit),
    ("run", "공 물고 달리기", pose_run),
    ("lie", "공이랑 엎드리기", pose_lie),
    ("sleep", "돌돌 말아 자기", pose_sleep),
    ("peek", "쿠션 너머로 빼꼼", pose_peek),
    ("stand", "옆모습으로 서기", pose_stand),
]
EXPRESSIONS = ("smile", "happy", "joy", "wink", "surprise", "sleepy", "love")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "teo.html"
    cells = [fn() for _, _, fn in POSES] + [svg(200, 190, head(100, 96, 1.0, expr=e), e) for e in EXPRESSIONS]
    html = (
        '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#FAF7F3;display:flex;flex-wrap:wrap;gap:24px;padding:24px">'
        + "".join(f'<div style="background:#fff;border-radius:20px;padding:8px">{c}</div>' for c in cells)
        + "</body>"
    )
    open(out, "w", encoding="utf-8").write(html)
    print("wrote", out)
