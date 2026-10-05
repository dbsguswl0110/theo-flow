#!/usr/bin/env python3
"""Cut TEO's animation frames out of public/assets/theo-character.png into one transparent sprite sheet.

The character sheet has a blurry cream/brown background but a crisp dark outline, so each frame is
isolated by flood-filling the background from the cell border without crossing the outline.

Usage: python3 tools/extract_teo_sprites.py [--debug DIR]
Writes public/assets/teo-sprites.webp and src/lib/teoSprites.generated.ts.
Requires: pillow, numpy, scipy.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "public/assets/theo-character.png"
OUT_IMG = ROOT / "public/assets/teo-sprites.webp"
OUT_TS = ROOT / "src/lib/teoSprites.generated.ts"

CELL = 128  # output cell size; sprites are scaled to fit and bottom-centre aligned

# Panels of the sheet (x0, y0, x1, y1) in source pixels.
# name: (box, frames per row, rows). The wake-up and walk cycles are left out: their frames overlap too much to split cleanly.
PANELS = {
    "idle": ((262, 40, 1006, 186), 7, 1),
    "look": ((1022, 40, 1254, 186), 2, 1),
    "scratch": ((1268, 40, 1514, 186), 2, 1),
    "happy": ((262, 224, 566, 378), 3, 1),
    "lick": ((582, 224, 844, 378), 3, 1),
    "yawn": ((858, 224, 1120, 378), 3, 1),
    "lie": ((1136, 224, 1514, 378), 4, 1),
    "sleep": ((262, 422, 974, 582), 7, 1),
    "drag": ((1102, 628, 1514, 878), 4, 1),
    "faces": ((36, 892, 1030, 990), 9, 1),
}


def runs(occupied):
    out, start = [], None
    for i, v in enumerate(occupied):
        if v and start is None:
            start = i
        if not v and start is not None:
            out.append([start, i])
            start = None
    if start is not None:
        out.append([start, len(occupied)])
    return out


def split_axis(occupied, expected):
    """Merge runs separated by small gaps; pick the largest gap that still yields `expected` pieces."""
    base = runs(occupied)
    for gap in range(60, 1, -1):
        merged = [list(base[0])]
        for a, b in base[1:]:
            if a - merged[-1][1] < gap:
                merged[-1][1] = b
            else:
                merged.append([a, b])
        if len(merged) == expected:
            return merged
    return None


def silhouette(sub_dark):
    """Fill each outlined object scanline by scanline, so gaps in the outline cannot hollow the sprite.

    Objects (the dog, a floating 'z', a hand) are separated first, so filling one never bridges to another.
    """
    h, w = sub_dark.shape
    mask = np.zeros((h, w), dtype=bool)
    labels, count = ndi.label(ndi.binary_dilation(sub_dark, iterations=2))
    for k in range(1, count + 1):
        part = sub_dark & (labels == k)
        for y in range(h):
            xs = np.flatnonzero(part[y])
            if xs.size:
                mask[y, xs[0]:xs[-1] + 1] = True
    # Smooth single-pixel notches left by the scan.
    return ndi.binary_closing(np.pad(mask, 2), structure=np.ones((3, 3)))[2:-2, 2:-2]


def cut_frames(img: np.ndarray, box, per_row, rows):
    x0, y0, x1, y1 = box
    cell = img[y0:y1, x0:x1].astype(np.int32)
    luma = (cell[..., 0] * 299 + cell[..., 1] * 587 + cell[..., 2] * 114) // 1000
    dark = luma < 85  # crisp outline
    row_bands = [(0, cell.shape[0])]
    if rows > 1:
        bands = split_axis(dark.sum(axis=1) >= 2, rows)
        row_bands = [tuple(b) for b in bands] if bands else [(0, cell.shape[0])]
    frames = []
    for ry0, ry1 in row_bands:
        band = dark[ry0:ry1]
        cols = split_axis(band.sum(axis=0) >= 2, per_row)
        if cols is None:
            print(f"  ! could not split {box} into {per_row} frames")
            cols = [(0, band.shape[1])]
        for cx0, cx1 in cols:
            piece = dark[ry0:ry1, cx0:cx1]
            ys, xs = np.where(piece)
            if len(xs) == 0:
                continue
            by0, by1 = ry0 + ys.min(), ry0 + ys.max() + 1
            bx0, bx1 = cx0 + xs.min(), cx0 + xs.max() + 1
            sub = cell[by0:by1, bx0:bx1]
            mask = silhouette(dark[by0:by1, bx0:bx1])
            rgba = np.dstack([sub.astype(np.uint8), (mask * 255).astype(np.uint8)])
            frames.append(rgba)
    return frames


def fit(rgba: np.ndarray, scale: float):
    im = Image.fromarray(rgba, "RGBA")
    w, h = im.size
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def main():
    debug = None
    if "--debug" in sys.argv:
        debug = Path(sys.argv[sys.argv.index("--debug") + 1])
        debug.mkdir(parents=True, exist_ok=True)
    sheet = np.array(Image.open(SHEET).convert("RGB"))
    groups = {name: cut_frames(sheet, box, per, rows) for name, (box, per, rows) in PANELS.items()}
    # One shared scale keeps TEO the same size in every animation (sitting dog ~ 100px tall).
    sitting = groups["idle"]
    scale = (CELL - 18) / max(f.shape[0] for f in sitting)
    cells, manifest = [], {}
    for name, frames in groups.items():
        manifest[name] = {"start": len(cells), "count": len(frames)}
        for rgba in frames:
            tile = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            im = fit(rgba, scale)
            if im.width > CELL or im.height > CELL:
                im.thumbnail((CELL, CELL), Image.LANCZOS)
            tile.paste(im, ((CELL - im.width) // 2, CELL - im.height - 4), im)
            cells.append(tile)
    cols = 12
    rows = (len(cells) + cols - 1) // cols
    sheet_out = Image.new("RGBA", (cols * CELL, rows * CELL), (0, 0, 0, 0))
    for i, tile in enumerate(cells):
        sheet_out.paste(tile, ((i % cols) * CELL, (i // cols) * CELL))
    sheet_out.save(OUT_IMG, quality=90, method=6)
    OUT_TS.write_text(
        "// Generated by tools/extract_teo_sprites.py. Do not edit by hand.\n"
        f"export const TEO_CELL = {CELL};\n"
        f"export const TEO_COLS = {cols};\n"
        f"export const TEO_ROWS = {rows};\n"
        "export const TEO_GROUPS = "
        + json.dumps(manifest, indent=2)
        + " as const;\n"
    )
    print({k: v["count"] for k, v in manifest.items()}, "->", OUT_IMG.name, sheet_out.size)
    if debug:
        # Contact sheet over a mid-tone checker so transparency problems are visible.
        bg = Image.new("RGBA", sheet_out.size, (120, 170, 200, 255))
        bg.alpha_composite(sheet_out)
        bg.save(debug / "contact.png")


if __name__ == "__main__":
    main()
