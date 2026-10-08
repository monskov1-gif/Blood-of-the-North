"""v0.12 batch (owner's transparent PNG sheets in tools/art/v012/).

Usage: python3 tools/process_art5.py

  <id>_portraits.png      3 busts: neutral, speaking, looking down  → assets/portraits/<id>_0..2.webp
  lizzy_portraits_smile   first bust smiles                          → assets/portraits/lizzy_3.webp
  <id>_sprites.png        idle, talk, walk 1, walk 2 (Puriel faces left: mirrored)
                          → tools/raw/raw_<id>_idle|_talk|_idle_walk1|_idle_walk2.png
  wolves.png              four wolves as parts (head, body, tail, 4 legs, chest ruff) — assembled
                          here into baked frames: stand, walk 1, walk 2, eat
                          → tools/raw/raw_wolf_<colour>[_walk1|_walk2|_eat].png
"""
import os
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'tools/art/v012')
RAW = os.path.join(ROOT, 'tools/raw')
PORT = os.path.join(ROOT, 'assets/portraits')


def load(name):
    return np.asarray(Image.open(os.path.join(ART, name)).convert('RGBA')).astype(np.float32)


def figures(a, n_expected, min_w=60):
    """Split a sheet into figures by column gaps; figures that touch (hair, a raised hand) are cut
    at the thinnest column between them."""
    al = a[..., 3] > 20
    cols = al.sum(0)
    segs, start = [], None
    for x, c in enumerate(cols):
        if c > 2 and start is None: start = x
        if c <= 2 and start is not None:
            if x - start >= min_w: segs.append([start, x])
            start = None
    if start is not None and len(cols) - start >= min_w: segs.append([start, len(cols)])
    while len(segs) < n_expected:
        i = max(range(len(segs)), key=lambda k: segs[k][1] - segs[k][0])
        x0, x1 = segs[i]
        mid = x0 + (x1 - x0) // 4 + int(np.argmin(cols[x0 + (x1 - x0) // 4: x1 - (x1 - x0) // 4]))
        segs[i:i + 1] = [[x0, mid], [mid, x1]]
    out = []
    for x0, x1 in segs:
        f = a[:, x0:x1].copy()
        # keep the biggest blob (+ anything big): drops neighbours' stray hair tips
        lab, n = nd.label(nd.binary_closing(f[..., 3] > 20, iterations=2))
        if n > 1:
            sizes = nd.sum(np.ones_like(lab), lab, range(1, n + 1))
            keep = np.isin(lab, 1 + np.where(sizes >= max(sizes) * 0.04)[0])
            f[..., 3] *= keep
        ys, xs = np.where(f[..., 3] > 20)
        out.append(f[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1])
    return out


def pixelize(rgba, scale):
    """Premultiplied box downscale, hard alpha, isolated specks dropped (as process_art4)."""
    h, w = rgba.shape[:2]
    tw, th = max(1, round(w * scale)), max(1, round(h * scale))
    pm = rgba.copy(); pm[..., :3] *= pm[..., 3:4] / 255.0
    d = np.asarray(Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), 'RGBA').resize((tw, th), Image.BOX)).astype(np.float32)
    al = d[..., 3:4] / 255.0
    rgb = np.where(al > 0, d[..., :3] / np.maximum(al, 1e-3), 0)
    keep = d[..., 3] >= 115
    nb = nd.convolve(keep.astype(int), np.ones((3, 3), int), mode='constant') - keep
    keep &= nb >= 2
    out = np.zeros((th, tw, 4), np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8); out[..., 3] = keep * 255
    return Image.fromarray(out, 'RGBA')


def save_portrait(rgba, name, height=1100):
    img = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), 'RGBA')
    ys, xs = np.where(np.asarray(img)[..., 3] > 0)
    img = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    if img.height > height:
        img = img.resize((round(img.width * height / img.height), height), Image.LANCZOS)
    img.save(os.path.join(PORT, f'{name}.webp'), 'WEBP', quality=88, method=6)
    print('portrait', name, img.size)


# ---------------------------------------------------------------- portraits
for cid in ['lizzy', 'vikki', 'olivia', 'puriel']:
    figs = figures(load(f'{cid}_portraits.png'), 3)
    assert len(figs) == 3, (cid, len(figs))
    for i, f in enumerate(figs):
        save_portrait(f, f'{cid}_{i}')
save_portrait(figures(load('lizzy_portraits_smile.png'), 3)[0], 'lizzy_3')

# ---------------------------------------------------------------- walking sprites (1 px ≈ 1 cm)
HEIGHT = {'lizzy': 165, 'vikki': 172, 'olivia': 168, 'puriel': 160}
for cid, hcm in HEIGHT.items():
    figs = figures(load(f'{cid}_sprites.png'), 4)
    assert len(figs) == 4, (cid, len(figs))
    if cid == 'puriel':
        figs = [f[:, ::-1] for f in figs]
    S = hcm / figs[0].shape[0]
    for name, f in zip(['idle', 'talk', 'idle_walk1', 'idle_walk2'], figs):
        img = pixelize(f, S)
        img.save(os.path.join(RAW, f'raw_{cid}_{name}.png'))
        print('sprite', f'{cid}_{name}', img.size)

# ---------------------------------------------------------------- wolves (assembled from parts)
W = load('wolves.png')
H2, W2 = W.shape[0] // 2, W.shape[1] // 2
# part boxes inside one wolf's quadrant (source px of the grey wolf, the same layout for all four)
BOX = {'head': (10, 20, 222, 265), 'body': (218, 20, 580, 280), 'tail': (545, 35, 724, 312),
       'legA': (35, 268, 142, 530), 'legB': (142, 262, 254, 530), 'ruff': (254, 290, 432, 540),
       'legC': (428, 262, 558, 530), 'legD': (555, 262, 712, 530)}
ORDER = ['legB', 'legD', 'tail', 'body', 'ruff', 'legA', 'legC', 'head']


_PARTS = {}


def parts_of(q):
    """The eight parts of one wolf, found as blobs in its quadrant: the top row (head, body, tail)
    and the bottom row (front leg, front leg, chest ruff, hind leg, hind leg), each by x."""
    if q in _PARTS:
        return _PARTS[q]
    qx, qy = q
    a = W[qy: qy + H2, qx: qx + W2]
    lab, n = nd.label(nd.binary_closing(a[..., 3] > 20, iterations=2))
    blobs = []
    for i, sl in enumerate(nd.find_objects(lab)):
        m = lab[sl] == i + 1
        if m.sum() < 1500:
            continue
        f = a[sl].copy(); f[..., 3] *= m
        blobs.append(((sl[0].start + sl[0].stop) / 2, sl[1].start, f))
    blobs.sort(key=lambda b: -b[2][..., 3].astype(bool).sum())
    blobs = blobs[:8]
    top = sorted([b for b in blobs if b[0] < H2 * 0.48], key=lambda b: b[1])
    bot = sorted([b for b in blobs if b[0] >= H2 * 0.48], key=lambda b: b[1])
    assert len(top) == 3 and len(bot) == 5, (q, len(top), len(bot))
    keys = ['head', 'body', 'tail', 'legA', 'legB', 'ruff', 'legC', 'legD']
    _PARTS[q] = dict(zip(keys, [b[2] for b in top + bot]))
    return _PARTS[q]


def part(q, key):
    a = parts_of(q)[key]
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    if key in ('legB', 'legD'):
        im = ImageEnhance.Brightness(im).enhance(0.72)   # far legs a step darker
    return im


def compose(q, pose):
    canvas = Image.new('RGBA', (900, 620), (0, 0, 0, 0))
    P = parts_of(q)
    bh, bw = P['body'].shape[:2]
    bx, by = 240, 60
    # placement relative to the body (head over the chest front, ruff under the neck, legs under
    # the shoulder and the hip, tail at the rump); the same proportions for every wolf
    def at(key, fx, fy, ax=0.0, ay=0.0):
        h, w = P[key].shape[:2]
        return (int(bx + bw * fx - w * ax), int(by + bh * fy - h * ay))
    POS = {'body': (bx, by), 'head': at('head', 0.1, 0.62, 1.0, 0.75), 'tail': at('tail', 0.96, 0.12, 0.08, 0.06),
           'ruff': at('ruff', 0.06, 0.45, 0.25, 0.0), 'legA': at('legA', 0.2, 0.78, 0.5, 0.0),
           'legB': at('legB', 0.31, 0.76, 0.5, 0.0), 'legC': at('legC', 0.78, 0.72, 0.5, 0.0),
           'legD': at('legD', 0.89, 0.72, 0.5, 0.0)}
    swing = {'stand': {}, 'walk1': {'legA': -14, 'legB': 12, 'legC': 12, 'legD': -12},
             'walk2': {'legA': 12, 'legB': -12, 'legC': -12, 'legD': 12}, 'eat': {}}[pose]
    for key in ORDER:
        im = part(q, key)
        x, y = POS[key]
        if key.startswith('leg') and key in swing:
            a = swing[key]
            # rotate about the top centre of the leg (shoulder / hip)
            w, h = im.size
            big = Image.new('RGBA', (w * 3, h * 3)); big.alpha_composite(im, (w, h))
            big = big.rotate(a, resample=Image.BICUBIC, center=(w * 1.5, h))
            canvas.alpha_composite(big, (x - w, y - h - (4 if abs(a) > 0 and a * (1 if key in 'legAlegB' else -1) > 0 else 0)))
            continue
        if key == 'head' and pose == 'eat':
            w, h = im.size
            big = Image.new('RGBA', (w * 3, h * 3)); big.alpha_composite(im, (w, h))
            big = big.rotate(32, resample=Image.BICUBIC, center=(w * 1.95, h * 1.55))   # head down to the ground
            canvas.alpha_composite(big, (x - w + 18, y - h + 120))
            continue
        if key == 'tail' and pose != 'stand':
            w, h = im.size
            big = Image.new('RGBA', (w * 3, h * 3)); big.alpha_composite(im, (w, h))
            big = big.rotate({'walk1': -6, 'walk2': 5, 'eat': -10}[pose], resample=Image.BICUBIC, center=(w * 1.1, h * 1.08))
            canvas.alpha_composite(big, (x - w, y - h))
            continue
        canvas.alpha_composite(im, (x, y))
    a = np.asarray(canvas).astype(np.float32)
    ys, xs = np.where(a[..., 3] > 20)
    return a[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]


WOLVES = {'grey': (0, 0), 'white': (W2, 0), 'red': (0, H2), 'dark': (W2, H2)}
for colour, q in WOLVES.items():
    stand = compose(q, 'stand')
    S = 150 / stand.shape[0]            # a huge wolf: ~150 cm to the ear tips
    for pose in ['stand', 'walk1', 'walk2', 'eat']:
        f = stand if pose == 'stand' else compose(q, pose)
        f = f[:, ::-1]                  # face +x like every sprite
        img = pixelize(f, S)
        name = f'wolf_{colour}' + ('' if pose == 'stand' else f'_{pose}' if pose == 'eat' else f'_{pose}')
        img.save(os.path.join(RAW, f'raw_{name}.png'))
        print('sprite', name, img.size)
