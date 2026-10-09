"""Processes the owner's Julian sheet (v0.10, transparent PNG uploaded to the repo).

Usage: python3 tools/process_art4.py tools/art/julian_v010.png <repo_root>

Top row, left → right (all facing +x): coat idle, coat talk, coat walk 1, coat walk 2,
gown idle, gown talk, gown walk 1, gown walk 2. Bottom: lying in the gown (head left).
Every frame keeps its own painted head — no head grafting for these frames.
"""
import sys, os, types
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SHEET, ROOT = sys.argv[1], sys.argv[2]
_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, 'process_art.py')).read().split('# ------------------------------------------------------------------ portraits')[0]
H = types.ModuleType('pa')
sys.argv = [sys.argv[0], os.path.dirname(SHEET), ROOT]
exec(compile(_src, 'process_art.py', 'exec'), H.__dict__)
RAW = H.RAW


def pixelize(rgba, scale):
    """The sheet already has a clean alpha: premultiplied box downscale, hard alpha at 45%,
    no edge erosion (it ate the white gown ties and the light neckline)."""
    h, w = rgba.shape[:2]
    tw, th = max(1, round(w * scale)), max(1, round(h * scale))
    pm = rgba.copy(); pm[..., :3] *= pm[..., 3:4] / 255.0
    d = np.asarray(Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), 'RGBA').resize((tw, th), Image.BOX)).astype(np.float32)
    al = d[..., 3:4] / 255.0
    rgb = np.where(al > 0, d[..., :3] / np.maximum(al, 1e-3), 0)
    keep = d[..., 3] >= 115
    # drop isolated specks (single pixels with no opaque neighbours)
    n = nd.convolve(keep.astype(int), np.ones((3, 3), int), mode='constant') - keep
    keep &= n >= 2
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

a = np.asarray(Image.open(SHEET).convert('RGBA')).astype(np.float32)
lab, n = nd.label(nd.binary_closing(a[..., 3] > 0, iterations=3))
objs = [(i + 1, s) for i, s in enumerate(nd.find_objects(lab)) if (lab[s] == i + 1).sum() > 5000]


def crop(i, s):
    f = a[s].copy()
    f[..., 3] *= (lab[s] == i)
    return f


stand = sorted([o for o in objs if (o[1][0].stop - o[1][0].start) > 400], key=lambda o: o[1][1].start)
lie = [o for o in objs if (o[1][0].stop - o[1][0].start) <= 400]
assert len(stand) == 8 and len(lie) == 1, (len(stand), len(lie))
names = ['jul_idle', 'jul_talk', 'jul_idle_walk1', 'jul_idle_walk2', 'julg_idle', 'julg_talk', 'julg_idle_walk1', 'julg_idle_walk2']
# one scale for the whole sheet: Julian is 185 cm in the coat idle frame
S = 185 / (stand[0][1][0].stop - stand[0][1][0].start)
for name, (i, s) in zip(names, stand):
    img = pixelize(crop(i, s), S)
    img.save(os.path.join(RAW, f'raw_{name}.png')); print('sprite', name, img.size)
i, s = lie[0]
f = crop(i, s)
img = pixelize(f, 180 / f.shape[1])   # lying length ≈ 180 cm (fits the hospital bed)
img.save(os.path.join(RAW, 'raw_lie_julian_gown.png')); print('sprite lie_julian_gown', img.size)
