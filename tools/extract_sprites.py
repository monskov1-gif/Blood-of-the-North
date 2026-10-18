"""Converts the character sprite reference sheet into clean pixel-art frames.

Usage: python3 tools/extract_sprites.py <reference_sheet.jpg> <out_dir>
Produces raw_<name>.png frames (transparent, palette-quantized) that
build_sprites.py then turns into the final atlas.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, OUT = sys.argv[1], sys.argv[2]
SCALE = 4  # source pixels per art pixel after cleanup

a = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
fg = (a.min(2) < 215) | ((a.max(2) - a.min(2)) > 25)
fg = nd.binary_closing(fg, iterations=2)
lab, n = nd.label(fg)

# component ids (from inspection) -> frame names; comp 2 holds two touching frames
FRAMES = {
    3: 'julian_idle', 4: 'julian_talk', 5: 'julian_think',
    1: 'kayden_idle', 6: 'waiter_idle', 7: 'waiter_talk', 8: 'waiter_hands',
}
masks = {}
for cid, name in FRAMES.items():
    masks[name] = lab == cid
m2 = lab == 2
# the pointing hand of the "talk" frame touches the coat of the "think" frame,
# so split per row: at the first background gap, or past the hand for the top rows
left = np.zeros_like(m2); right = np.zeros_like(m2)
for y in range(m2.shape[0]):
    row = m2[y]
    if not row.any():
        continue
    sx = 915 if y < 410 else None
    if sx is None:
        seg = row[840:960]
        gap = np.where(~seg)[0]
        sx = 840 + (int(gap[len(gap) // 2]) if len(gap) else 60)
    left[y, :sx] = row[:sx]
    right[y, sx:] = row[sx:]
masks['kayden_talk'] = left
masks['kayden_think'] = right

BASE = 860  # common feet line in source
for name, m in masks.items():
    filled = nd.binary_fill_holes(m)
    holes, hn = nd.label(filled & ~m)
    for h in range(1, hn + 1):
        hm = holes == h
        px = a[hm]
        # bright, sizeable holes are background showing through (between arm and body)
        if hm.sum() > 40 and px.min(1).mean() > 232:
            filled[hm] = False
    m = nd.binary_dilation(filled, iterations=1) & (filled | (a.min(2) < 240))
    ys, xs = np.where(m)
    x0 = xs.min() - (xs.min() % SCALE)
    x1 = xs.max() + 1
    y0 = 140
    y1 = BASE
    w = (x1 - x0 + SCALE - 1) // SCALE
    h = (y1 - y0) // SCALE
    out = np.zeros((h, w, 4), np.uint8)
    for j in range(h):
        for i in range(w):
            sy, sx = y0 + j * SCALE, x0 + i * SCALE
            mm = m[sy:sy + SCALE, sx:sx + SCALE]
            if mm.size == 0 or mm.mean() < 0.45:
                continue
            block = a[sy:sy + SCALE, sx:sx + SCALE][mm]
            # pick a value biased to the darker pixels so outlines survive
            lum = block.sum(1)
            order = np.argsort(lum)
            pick = block[order[: max(1, len(order) // 2)]].mean(0) * 0.5 + block.mean(0) * 0.5
            out[j, i, :3] = pick.clip(0, 255)
            out[j, i, 3] = 255
    img = Image.fromarray(out, 'RGBA')
    # palette quantization on opaque pixels
    rgb = img.convert('RGB').quantize(colors=28, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q = np.asarray(rgb).copy()
    alpha = out[:, :, 3] > 0
    # drop light halo specks on the silhouette edge and isolated pixels
    for _ in range(2):
        nb = nd.convolve(alpha.astype(int), np.ones((3, 3), int), mode='constant') - alpha
        lum = q.astype(int).sum(2)
        halo = alpha & (nb <= 5) & (lum > 540)
        alpha &= ~halo
        alpha &= ~(alpha & (nb <= 1))
    out[:, :, 3] = alpha * 255
    res = np.dstack([q, out[:, :, 3]])
    res[out[:, :, 3] == 0] = 0
    Image.fromarray(res.astype(np.uint8), 'RGBA').save(f'{OUT}/raw_{name}.png')
    print(name, w, h)
