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
pixelize, RAW = H.pixelize, H.RAW

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
