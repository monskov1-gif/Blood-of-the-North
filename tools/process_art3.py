"""Processes the third batch of painted sheets (v0.08).

Usage: python3 tools/process_art3.py <images_dir> <repo_root>

  34  officer Wyatt Lewis + Quinn Torres, standing profiles (walk source)
  35  the old woman of ward 107, lying in her gown

Reuses the cut-out / pixelize helpers of process_art.py.
"""
import sys, os, types
import numpy as np

SRC, ROOT = sys.argv[1], sys.argv[2]
_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, 'process_art.py')).read().split('# ------------------------------------------------------------------ portraits')[0]
H = types.ModuleType('pa')
sys.argv = [sys.argv[0], SRC, ROOT]
exec(compile(_src, 'process_art.py', 'exec'), H.__dict__)
load, components, figure, pixelize = H.load, H.components, H.figure, H.pixelize
RAW = H.RAW


def raw(img, name):
    img.save(os.path.join(RAW, f'raw_{name}.png'))
    print('sprite', name, img.size)


def by_x(comps):
    return sorted(comps, key=lambda c: c[1][1].start)


# ------------------------------------------------------------------ 34: Wyatt + Quinn standing (profile, facing +x)
a = load('34.jpg')
lab, comps = components(a)
comps = by_x(comps)
wy, qu = figure(a, lab, comps[0][0]), figure(a, lab, comps[1][0])
S34 = 184 / wy.shape[0]  # Wyatt ≈ 184 cm; Quinn keeps her height relative to him
raw(pixelize(wy, S34), 'wyatt_side')
raw(pixelize(qu, S34), 'quinn_side')

# ------------------------------------------------------------------ 35: the old woman lying (head on the left)
a = load('35.jpg')
lab, comps = components(a)
f = figure(a, lab, max(comps, key=lambda c: (lab[c[1]] == c[0]).sum())[0])
raw(pixelize(f, 158 / f.shape[1]), 'lie_granny')
