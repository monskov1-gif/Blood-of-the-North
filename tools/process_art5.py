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
    # light matting fringe: an edge pixel much lighter than the figure just inside it goes
    lum = rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11
    for _ in range(2):
        inner = nd.binary_erosion(keep)
        edge = keep & ~inner
        k3 = np.ones((3, 3))
        s_in = nd.convolve(np.where(inner, lum, 0), k3, mode='constant')
        n_in = nd.convolve(inner.astype(float), k3, mode='constant')
        mean_in = np.where(n_in > 0, s_in / np.maximum(n_in, 1), lum)
        keep &= ~(edge & (lum > mean_in + 38))
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
# Layering by the owner's reference assembly (top → bottom): head, chest ruff, front-left leg,
# hind-left leg, torso, tail, front-right leg, hind-right leg (= a copy of the hind-left one).
# Drawn bottom-up:
ORDER = ['hindR', 'frontR', 'tail', 'body', 'hindL', 'frontL', 'ruff', 'head']
SRC = {'frontL': 'legA', 'frontR': 'legB', 'hindL': 'legC', 'hindR': 'legC'}
# Measured on the owner's assembled grey wolf (template matching, /tmp/s/wolf/scripts): every part
# relative to the torso box — centre x (cx) and centre y (cy) or the paw line (bot) in torso
# widths / heights, and the part height in torso heights (the legs were enlarged ×1.2–1.36).
LAYOUT = {
    'head':   dict(cx=-0.080, cy=0.013, h=0.821),
    'ruff':   dict(cx=0.123, cy=0.347, h=1.041),
    'frontL': dict(cx=0.223, bot=1.608, h=1.468),
    'hindL':  dict(cx=0.854, bot=1.576, h=1.403),
    'tail':   dict(cx=1.126, cy=0.704, h=1.010),
    'frontR': dict(cx=0.155, bot=1.571, h=1.474),
    'hindR':  dict(cx=0.689, bot=1.524, h=1.295),
}


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
    a = parts_of(q)[SRC.get(key, key)]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def placed(q):
    """Every layer scaled and positioned on the torso, as in the owner's reference."""
    P = parts_of(q)
    bh, bw = P['body'].shape[:2]
    bx, by = 300, 200
    out = {'body': (part(q, 'body'), bx, by)}
    for key, L in LAYOUT.items():
        im = part(q, key)
        k = L['h'] * bh / im.size[1]
        im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
        w, h = im.size
        x = bx + L['cx'] * bw - w / 2
        y = by + (L['cy'] * bh - h / 2 if 'cy' in L else L['bot'] * bh - h)
        out[key] = (im, round(x), round(y))
    return out


def rot(canvas, im, x, y, angle, cx, cy):
    """Paste `im` at (x, y) rotated by `angle` about its own point (cx, cy)."""
    w, h = im.size
    big = Image.new('RGBA', (w * 3, h * 3)); big.alpha_composite(im, (w, h))
    big = big.rotate(angle, resample=Image.BICUBIC, center=(w + cx, h + cy))
    canvas.alpha_composite(big, (x - w, y - h))


def compose(q, pose):
    canvas = Image.new('RGBA', (1400, 1100), (0, 0, 0, 0))
    lay = placed(q)
    # legs swing about the shoulder / hip (top centre); near and far legs in opposite phase
    swing = {'stand': {}, 'walk1': {'frontL': -13, 'hindL': 11, 'frontR': 11, 'hindR': -10},
             'walk2': {'frontL': 11, 'hindL': -11, 'frontR': -11, 'hindR': 10}, 'eat': {}}[pose]
    for key in ORDER:
        im, x, y = lay[key]
        w, h = im.size
        if key in swing:
            rot(canvas, im, x, y, swing[key], w / 2, h * 0.08)
        elif key == 'head' and pose == 'eat':
            # head down to the ground, pivoting at the neck (back of the head)
            rot(canvas, im, x + round(w * 0.06), y + round(h * 0.42), 34, w * 0.92, h * 0.72)
        elif key in ('ruff', 'body') and pose == 'eat':
            # with the head lowered, the chest's top lobe and the shoulder fur (normally under the head)
            # would read as a second head: cut away what the standing head covered, except the neck base
            hm, hx, hy = lay['head']
            cut = Image.new('L', im.size, 0)
            cut.paste(hm.getchannel('A'), (hx - x, hy - y))
            keep = np.zeros(im.size[::-1], bool); keep[int(hy - y + hm.size[1] * 0.72):, :] = True
            a = np.asarray(im).copy()
            a[..., 3] = np.where((np.asarray(cut) > 20) & ~keep, 0, a[..., 3])
            canvas.alpha_composite(Image.fromarray(a, 'RGBA'), (x, y))
        elif key == 'tail' and pose != 'stand':
            rot(canvas, im, x, y, {'walk1': -6, 'walk2': 5, 'eat': -10}[pose], w * 0.12, h * 0.1)
        else:
            canvas.alpha_composite(im, (x, y))
    a = np.asarray(canvas).astype(np.float32)
    ys, xs = np.where(a[..., 3] > 20)
    return a[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]


WOLVES = {'grey': (0, 0), 'white': (W2, 0), 'red': (0, H2), 'dark': (W2, H2)}
for colour, q in WOLVES.items():
    stand = compose(q, 'stand')
    if os.environ.get('WOLF_PREVIEW'):     # full-resolution check against the owner's reference
        for pose in ['stand', 'walk1', 'eat']:
            Image.fromarray(np.clip(compose(q, pose), 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(os.environ['WOLF_PREVIEW'], f'{colour}_{pose}.png'))
    S = 150 / stand.shape[0]            # a huge wolf: ~150 cm to the ear tips
    for pose in ['stand', 'walk1', 'walk2', 'eat']:
        f = stand if pose == 'stand' else compose(q, pose)
        f = f[:, ::-1]                  # face +x like every sprite
        img = pixelize(f, S)
        name = f'wolf_{colour}' + ('' if pose == 'stand' else f'_{pose}' if pose == 'eat' else f'_{pose}')
        img.save(os.path.join(RAW, f'raw_{name}.png'))
        print('sprite', name, img.size)
