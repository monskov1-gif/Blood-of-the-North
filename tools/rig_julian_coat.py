"""Cut-out rig of Julian in the coat (from the owner's sheet, coat idle frame).

Usage: python3 tools/rig_julian_coat.py   →  tools/art/rig/julian_coat/
  <part>.png       hi-res part (cropped), hidden areas filled so parts can move
  px/<part>.png    the same part on the game grid (1 px ≈ 1 cm, Julian 185 px)
  rig.json         per part: offset in the frame, pivot (joint), parent, z-order
  overview.png     assembled + exploded view

Parts are assigned by priority (head, scarf by colour, near arm, legs, coat flaps,
torso = the rest). Each part's polygon also says where it continues under other
parts; those pixels are filled with the part's nearest own colour.
"""
import os, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, 'tools/art/julian_v010.png')
OUT = os.path.join(ROOT, 'tools/art/rig/julian_coat')
os.makedirs(os.path.join(OUT, 'px'), exist_ok=True)

X0, Y0 = 40, 15                      # crop of the coat idle figure on the sheet
src = np.asarray(Image.open(SHEET).convert('RGBA').crop((X0, Y0, 230, 650))).astype(np.float32)
H_, W_ = src.shape[:2]
alpha = src[..., 3] > 20
r, g, b = src[..., 0], src[..., 1], src[..., 2]


def poly(pts):
    im = Image.new('L', (W_, H_), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=1)
    return np.asarray(im).astype(bool)


# part: (polygon where it is OR continues under others, pivot, parent, z)
P = {
    'head':       ([(48, 12), (165, 12), (158, 60), (142, 88), (122, 96), (114, 118), (93, 118), (90, 96), (52, 86)], (104, 104), 'torso', 6),
    'arm_near':   ([(36, 116), (76, 108), (97, 124), (101, 180), (101, 245), (104, 275), (103, 306), (86, 314), (44, 302), (26, 282), (20, 250), (23, 170), (29, 134)], (60, 128), 'torso', 5),
    'leg_near':   ([(68, 296), (106, 296), (106, 480), (97, 588), (132, 598), (134, 628), (36, 628), (38, 588), (43, 498), (68, 494)], (88, 304), 'torso', 2),
    'leg_far':    ([(100, 296), (140, 296), (137, 480), (127, 578), (172, 592), (174, 614), (98, 614), (94, 588), (100, 480)], (120, 304), 'torso', 0),
    'coat_front': ([(126, 284), (162, 284), (167, 400), (171, 506), (158, 510), (143, 502), (138, 420), (133, 318)], (140, 292), 'torso', 3),
    'coat_back':  ([(10, 296), (70, 296), (74, 500), (14, 502)], (46, 300), 'torso', 3),
}
scarf = alpha & (r > g + 28) & (r > b + 18) & (np.arange(H_)[:, None] > 84) & (np.arange(H_)[:, None] < 360)
scarf = nd.binary_closing(scarf, iterations=2) & alpha
scarf = nd.binary_opening(scarf, iterations=1)

owner = np.full((H_, W_), '', object)
order = ['head', 'scarf', 'arm_near', 'leg_near', 'leg_far', 'coat_front', 'coat_back']
for name in order:
    m = scarf if name == 'scarf' else poly(P[name][0])
    owner[(owner == '') & m & alpha] = name
owner[(owner == '') & alpha] = 'torso'

# torso continues under the arm, scarf and head (the chest and shoulders behind them)
torso_ext = alpha & (np.arange(H_)[:, None] < 330) & (np.arange(H_)[:, None] > 92)
ext = {'torso': torso_ext, 'scarf': scarf}
for name, (pts, *_rest) in P.items():
    ext[name] = poly(pts) & alpha


Z = {**{k: v[3] for k, v in P.items()}, 'torso': 4, 'scarf': 7, 'arm_far': 1}
Z['coat_back'] = 3
zown = np.vectorize(lambda n: Z.get(n, -1) if n else -1)(owner)


def layer(name):
    own = owner == name
    want = ext[name] | own
    rgba = np.zeros_like(src)
    rgba[own] = src[own]
    hole = want & ~own & (zown > Z[name])   # only where something nearer hides the part
    if hole.any() and own.any():
        # a flat fill in the part's own base colour (outlines and deep shadows excluded):
        # no invented detail, nothing that reads as a seam when the part moves
        near = own & nd.binary_dilation(hole, iterations=14)
        px = src[near if near.sum() > 30 else own][:, :3]
        lum = px.mean(1)
        base = np.median(px[(lum > np.percentile(lum, 45)) & (lum < np.percentile(lum, 92))], axis=0)
        rgba[hole, :3] = base * 0.94
        rgba[hole, 3] = 255
    return rgba


parts = {}
for name in ['torso', 'head', 'scarf', 'arm_near', 'leg_near', 'leg_far', 'coat_front', 'coat_back']:
    parts[name] = layer(name)
# the far arm is hidden in this pose: a darker copy of the near arm, behind the torso
fa = parts['arm_near'].copy()
fa[..., :3] *= 0.72
parts['arm_far'] = np.roll(fa, 10, axis=1)

meta = {'source': 'tools/art/julian_v010.png', 'crop': [X0, Y0], 'frame': [W_, H_], 'scale_px': None, 'parts': {}}
PIV = {**{k: v[1] for k, v in P.items()}, 'torso': (88, 300), 'scarf': (88, 100), 'arm_far': (70, 128)}
PAR = {**{k: v[2] for k, v in P.items()}, 'torso': None, 'scarf': 'torso', 'arm_far': 'torso'}
SC = 185 / (np.ptp(np.where(alpha.any(1))[0]) + 1)
meta['scale_px'] = round(float(SC), 5)
for name, rgba in parts.items():
    m = rgba[..., 3] > 0
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = rgba[y0:y1, x0:x1]
    Image.fromarray(crop.clip(0, 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, f'{name}.png'))
    # game grid version (premultiplied box downscale, hard alpha)
    pm = crop.copy(); pm[..., :3] *= pm[..., 3:4] / 255
    tw, th = max(1, round((x1 - x0) * SC)), max(1, round((y1 - y0) * SC))
    d = np.asarray(Image.fromarray(pm.clip(0, 255).astype(np.uint8), 'RGBA').resize((tw, th), Image.BOX)).astype(np.float32)
    al = d[..., 3:4] / 255
    out = np.zeros((th, tw, 4), np.uint8)
    out[..., :3] = np.where(al > 0, d[..., :3] / np.maximum(al, 1e-3), 0).clip(0, 255)
    out[..., 3] = (d[..., 3] >= 115) * 255
    Image.fromarray(out, 'RGBA').save(os.path.join(OUT, 'px', f'{name}.png'))
    px, py = PIV[name]
    meta['parts'][name] = {'offset': [int(x0), int(y0)], 'size': [int(x1 - x0), int(y1 - y0)],
                           'pivot': [px, py], 'pivot_local': [px - int(x0), py - int(y0)],
                           'parent': PAR[name], 'z': Z[name]}
json.dump(meta, open(os.path.join(OUT, 'rig.json'), 'w'), indent=1, ensure_ascii=False)

# overview: assembled (z-order) | exploded with pivots
by_z = sorted(meta['parts'], key=lambda n: meta['parts'][n]['z'])
asm = Image.new('RGBA', (W_, H_), (34, 34, 40, 255))
for n in by_z:
    o = meta['parts'][n]['offset']
    asm.alpha_composite(Image.open(os.path.join(OUT, f'{n}.png')), tuple(o))
EX = {'head': (0, -40), 'scarf': (70, -10), 'arm_near': (-70, 10), 'arm_far': (-140, 10), 'leg_near': (-40, 70),
      'leg_far': (60, 70), 'coat_front': (110, 30), 'coat_back': (-110, 40), 'torso': (0, 0)}
ex = Image.new('RGBA', (W_ + 330, H_ + 140), (34, 34, 40, 255))
dr = ImageDraw.Draw(ex)
for n in by_z:
    o = meta['parts'][n]['offset']; dx, dy = EX[n]
    pos = (o[0] + dx + 160, o[1] + dy + 50)
    ex.alpha_composite(Image.open(os.path.join(OUT, f'{n}.png')), pos)
for n in by_z:
    p = meta['parts'][n]['pivot']; dx, dy = EX[n]
    cx, cy = p[0] + dx + 160, p[1] + dy + 50
    dr.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), outline=(255, 210, 60), width=2)
    dr.text((cx + 6, cy - 6), n, fill=(255, 230, 140))
ov = Image.new('RGBA', (W_ + ex.width + 20, ex.height), (34, 34, 40, 255))
ov.alpha_composite(asm, (0, 50)); ov.alpha_composite(ex, (W_ + 20, 0))
ov.save(os.path.join(OUT, 'overview.png'))
print('parts', list(meta['parts']), 'scale', meta['scale_px'])
