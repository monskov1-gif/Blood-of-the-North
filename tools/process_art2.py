"""Processes the second batch of painted sheets (v0.06).

Usage: python3 tools/process_art2.py <images_dir> <repo_root>

  26  arresting officers: blond / red-haired / Quinn, idle + aiming
  27  bodies lying on the floor (Julian = bottom-left, Kayden = bottom-middle)
  28  nurse portraits (VN)
  29  hospital staff side views, idle + waving
  30  officer Wyatt Lewis: portraits (VN) + seated sprite
  31  Quinn Torres: portraits (VN) + driving sprite (optional — only if present)

Reuses the cut-out / pixelize helpers of process_art.py.
"""
import sys, os, types
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, ROOT = sys.argv[1], sys.argv[2]

# load the helpers from process_art.py without running its sheet processing
_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, 'process_art.py')).read().split('# ------------------------------------------------------------------ portraits')[0]
H = types.ModuleType('pa')
sys.argv = [sys.argv[0], SRC, ROOT]
exec(compile(_src, 'process_art.py', 'exec'), H.__dict__)
load, components, figure, save_portrait, pixelize, save_raw, cutout, crop = (
    H.load, H.components, H.figure, H.save_portrait, H.pixelize, H.save_raw, H.cutout, H.crop)
RAW = H.RAW


def by_x(comps):
    return sorted(comps, key=lambda c: c[1][1].start)


def raw(img, name):
    img.save(os.path.join(RAW, f'raw_{name}.png'))
    print('sprite', name, img.size)


# ------------------------------------------------------------------ 26: arresting officers
a = load('26.jpg')
lab, comps = components(a)
comps = by_x(comps)
S26 = 182 / 781.0  # the tallest officer is 781 px → 182 cm
c1 = comps[0][0]  # blond idle + blond aiming touch: split at the gap column
figs = [figure(a, lab, c1, (0, 229)), figure(a, lab, c1, (229, 600))] + [figure(a, lab, c) for c, _ in comps[1:]]
names = ['cop_blond_idle', 'cop_blond_aim', 'cop_red_idle', 'cop_red_aim', 'quinn_idle', 'quinn_aim']
for f, n in zip(figs, names):
    raw(pixelize(f, S26), n)

# ------------------------------------------------------------------ 27: bodies on the floor
a = load('27.jpg')
lab, comps = components(a)
rows = sorted(comps, key=lambda c: (c[1][0].start // 200, c[1][1].start))
S27 = 180 / 544.0  # Kayden (the most stretched-out figure) ≈ 180 cm
lie_names = ['lie_glasses', 'lie_green', 'lie_soldier', 'lie_burgundy', 'lie_vest', 'lie_maid',
             'lie_julian', 'lie_kayden', 'lie_waiter']
for (cid, s), n in zip(rows, lie_names):
    raw(pixelize(figure(a, lab, cid), S27), n)

# ------------------------------------------------------------------ 28: nurse portraits
a = load('28.jpg')
lab, comps = components(a)
for k, (cid, s) in enumerate(by_x(comps)):
    save_portrait(figure(a, lab, cid), f'nurse_{k}')

# ------------------------------------------------------------------ 29: hospital staff
a = load('29.jpg')
lab, comps = components(a)
comps = by_x(comps)
S29 = 182 / 687.0  # the male nurse is 687 px → 182 cm
out = []
for cid, s in comps:
    if s[1].start < 450 < s[1].stop:  # the two male frames touch: split at the gap
        out += [figure(a, lab, cid, (0, 437)), figure(a, lab, cid, (437, 700))]
    else:
        out.append(figure(a, lab, cid))
names = ['nurse_red', 'nurse_red_wave', 'medic_m', 'medic_m_wave', 'doctor_f', 'doctor_f_wave',
         'nurse_white', 'nurse_white_wave', 'nurse_blue', 'nurse_blue_wave']
for f, n in zip(out, names):
    raw(pixelize(f, S29), n)

# ------------------------------------------------------------------ 30: officer Wyatt Lewis
a = load('30.jpg')
lab, comps = components(a)
comps = by_x(comps)
for k, (cid, s) in enumerate(comps[:3]):
    save_portrait(figure(a, lab, cid), f'wyatt_{k}')
f = figure(a, lab, comps[3][0])
raw(pixelize(f, 132 / f.shape[0], flip=True), 'wyatt_seat')  # profiles face +x

# ------------------------------------------------------------------ 31: Quinn Torres (optional)
if os.path.exists(os.path.join(SRC, '31.jpg')):
    a = load('31.jpg')
    lab, comps = components(a)
    comps = by_x(comps)
    for k, (cid, s) in enumerate(comps[:3]):
        save_portrait(figure(a, lab, cid), f'quinn_{k}')
    f = figure(a, lab, comps[3][0])
    raw(pixelize(f, 132 / f.shape[0]), 'quinn_drive')
