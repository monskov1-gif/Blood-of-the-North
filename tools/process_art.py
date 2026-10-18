"""Processes the painted character sheets supplied for the demo.

Usage: python3 tools/process_art.py <images_dir> <repo_root>

* Portraits (VN dialogue screen): background removed (with white-fringe
  decontamination), cropped, saved as WebP in assets/portraits/.
* In-scene sprites (heroes seated, crowd NPCs standing/seated): background
  removed, then converted to pixel art at 1 px = 1 cm so they match the
  existing pixel sprites; written to tools/raw/ for build_sprites.py.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, ROOT = sys.argv[1], sys.argv[2]
RAW = os.path.join(ROOT, 'tools', 'raw')
PORT = os.path.join(ROOT, 'assets', 'portraits')
os.makedirs(PORT, exist_ok=True)


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB')).astype(np.float32)


def fg_mask(a):
    m = (a.min(2) < 236) | ((a.max(2) - a.min(2)) > 16)
    m = nd.binary_opening(m, iterations=1)
    return nd.binary_closing(m, iterations=2)


def components(a):
    lab, n = nd.label(fg_mask(a))
    out = []
    for i, s in enumerate(nd.find_objects(lab)):
        if (lab[s] == i + 1).sum() > 3000:
            out.append((i + 1, s))
    return lab, out


def cutout(a, mask):
    """RGBA cut-out of the figure given a rough mask: exterior white removed,
    big enclosed white holes removed, soft decontaminated edge."""
    h, w = mask.shape
    filled = nd.binary_fill_holes(mask)
    holes, hn = nd.label(filled & ~mask)
    for k in range(1, hn + 1):
        hm = holes == k
        if hm.sum() > 250 and a[hm].min(1).mean() > 243:
            filled[hm] = False
    fg = nd.binary_dilation(filled, iterations=1)
    # alpha: solid inside, whiteness-based on the edge band
    inner = nd.binary_erosion(filled, iterations=2)
    white = np.clip((a.min(2) - 205) / 50.0, 0, 1)
    alpha = np.where(inner, 1.0, np.where(fg, 1 - white, 0.0))
    alpha = np.clip(alpha, 0, 1)
    rgb = a.copy()
    k = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((rgb - 255 * (1 - k)) / k, 0, 255)
    rgb[alpha < 0.02] = 0
    return np.dstack([rgb, alpha * 255])


def crop(rgba, pad=4):
    ys, xs = np.where(rgba[..., 3] > 8)
    y0, y1 = max(0, ys.min() - pad), min(rgba.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + pad + 1)
    return rgba[y0:y1, x0:x1]


def figure(a, lab, cid, xr=None):
    m = lab == cid
    if xr:
        cols = np.arange(m.shape[1])[None, :]
        m = m & (cols >= xr[0]) & (cols < xr[1])
    return crop(cutout(a, m))


def save_portrait(rgba, name, height=1100):
    img = Image.fromarray(rgba.astype(np.uint8), 'RGBA')
    if img.height > height:
        img = img.resize((round(img.width * height / img.height), height), Image.LANCZOS)
    img.save(os.path.join(PORT, f'{name}.webp'), 'WEBP', quality=88, method=6)
    print('portrait', name, img.size)


def face_dir(img):
    """+1 if the figure looks right, -1 if left (skin centroid vs head centroid)."""
    a = np.asarray(img).astype(float)
    h = a.shape[0]
    band = a[: int(h * 0.22)]
    op = band[..., 3] > 0
    r, g, b = band[..., 0], band[..., 1], band[..., 2]
    skin = op & (r > g + 8) & (g > b) & (r > 120)
    if skin.sum() < 6 or op.sum() < 20:
        return 0
    xs = np.indices(op.shape)[1]
    return 1 if xs[skin].mean() > xs[op].mean() else -1


def pixelize(rgba, scale, flip=False, colors=40):
    """Downscale (premultiplied box filter) → hard alpha → limited palette."""
    rgba = rgba.copy()
    k = max(1, round(0.55 / scale))
    solid = nd.binary_erosion(rgba[..., 3] > 200, iterations=k)
    rgba[..., 3] = np.where(solid, rgba[..., 3], 0)
    h, w = rgba.shape[:2]
    tw, th = max(1, round(w * scale)), max(1, round(h * scale))
    pm = rgba.copy()
    pm[..., :3] *= pm[..., 3:4] / 255.0
    img = Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), 'RGBA').resize((tw, th), Image.BOX)
    d = np.asarray(img).astype(np.float32)
    al = d[..., 3:4] / 255.0
    rgb = np.where(al > 0.01, d[..., :3] / np.maximum(al, 1e-3), 0)
    alpha = d[..., 3] > 130
    # isolated pixels
    nb = nd.convolve(alpha.astype(int), np.ones((3, 3), int), mode='constant') - alpha
    alpha &= ~(alpha & (nb <= 1))
    # light specks on the silhouette edge (white fringe left by the JPEG background)
    for _ in range(2):
        nb = nd.convolve(alpha.astype(int), np.ones((3, 3), int), mode='constant') - alpha
        alpha &= ~(alpha & (nb <= 5) & (rgb.sum(2) > 560))
    # boundary pixels much lighter than the figure next to them are fringe, not figure
    lum = rgb.sum(2)
    for _ in range(2):
        nb = nd.convolve(alpha.astype(int), np.ones((3, 3), int), mode='constant') - alpha
        edge = alpha & (nb <= 6)
        inner_mean = nd.uniform_filter(np.where(alpha, lum, 0), 5) / np.maximum(nd.uniform_filter(alpha.astype(float), 5), 1e-3)
        alpha &= ~(edge & (lum > inner_mean + 90))
    q = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB').quantize(
        colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = np.dstack([np.asarray(q), alpha.astype(np.uint8) * 255])
    out[~alpha] = 0
    res = Image.fromarray(out, 'RGBA')
    if flip:
        res = res.transpose(Image.FLIP_LEFT_RIGHT)
    return res


def save_raw(img, name):
    # convention: every profile / seated frame looks to the right (+x)
    if any(t in name for t in ('_side', 'sit_', '_seat')) and 'back' not in name:
        if face_dir(img) < 0:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
    img.save(os.path.join(RAW, f'raw_{name}.png'))
    print('sprite', name, img.size)


# ------------------------------------------------------------------ portraits
for sheet, who, order in [('16.jpg', 'julian', None), ('17.jpg', 'waiter', None), ('18.jpg', 'kayden', None)]:
    a = load(sheet)
    lab, comps = components(a)
    comps.sort(key=lambda c: c[1][1].start)
    for k, (cid, s) in enumerate(comps):
        save_portrait(figure(a, lab, cid), f'{who}_{k}')

# ------------------------------------------------------------------ heroes seated (19)
a = load('19.jpg')
lab, comps = components(a)
comps.sort(key=lambda c: c[1][1].start)
for (cid, s), name in zip(comps, ['julian_seat', 'kayden_seat', 'waiter_seat']):
    f = figure(a, lab, cid)
    save_raw(pixelize(f, 130 / f.shape[0], flip=True), name)

# ------------------------------------------------------------------ crowd standing (20)
a = load('20.jpg')
lab, comps = components(a)
STAND_SCALE = 182 / 395.0
by_x = lambda y0, y1: sorted([c for c in comps if y0 <= c[1][0].start < y1], key=lambda c: c[1][1].start)
row1, row2, row3 = by_x(0, 420), by_x(420, 835), by_x(835, 1200)
named = {}
# row 1: A (3 views merged), B (3 comps), C (front only — views overlap)
compA = [c for c in row1 if c[1][1].start < 20][0][0]
named['npc_cap_front'] = figure(a, lab, compA, (0, 151))
named['npc_cap_side'] = figure(a, lab, compA, (151, 252))
named['npc_cap_back'] = figure(a, lab, compA, (252, 400))
rest = [c for c in row1 if 380 < c[1][1].start < 720]
for (cid, s), n in zip(rest, ['npc_bluecoat_front', 'npc_bluecoat_side', 'npc_bluecoat_back']):
    named[n] = figure(a, lab, cid)
compC = [c for c in row1 if c[1][1].start > 720][0][0]
named['npc_smoker_front'] = figure(a, lab, compC, (700, 879))
for (cid, s), n in zip(row2, ['npc_butler_front', 'npc_butler_side', 'npc_butler_back',
                              'npc_glasses_front', 'npc_glasses_side', 'npc_glasses_back',
                              'npc_green_front', 'npc_green_side', 'npc_green_back']):
    named[n] = figure(a, lab, cid)
for (cid, s), n in zip(row3, ['npc_fedora_front', 'npc_fedora_side', 'npc_fedora_back',
                              'npc_fur_front', 'npc_fur_side', 'npc_fur_back',
                              'npc_vest_front', 'npc_vest_side', 'npc_vest_back']):
    named[n] = figure(a, lab, cid)
for n, f in named.items():
    save_raw(pixelize(f, STAND_SCALE), n)

# ------------------------------------------------------------------ crowd seated (21, 22)
a = load('21.jpg')
lab, comps = components(a)
comps.sort(key=lambda c: c[1][1].start)
SEAT21 = 128 / 550.0
for (cid, s), n in zip(comps, ['sit_glasses', 'sit_green', 'sit_soldier', 'sit_burgundy', 'sit_smoker', 'sit_maid']):
    save_raw(pixelize(figure(a, lab, cid), SEAT21, flip=True), n)
a = load('22.jpg')
lab, comps = components(a)
comps.sort(key=lambda c: c[1][1].start)
SEAT22 = 132 / 660.0
for (cid, s), n in zip(comps, ['sit_hat', 'sit_suit', 'sit_fur']):
    save_raw(pixelize(figure(a, lab, cid), SEAT22, flip=True), n)

# ------------------------------------------------------------------ Owen (23: seated views, 24: portraits)
a = load('24.jpg')
lab, comps = components(a)
comps.sort(key=lambda c: c[1][1].start)
for k, (cid, s_) in enumerate(comps):
    save_portrait(figure(a, lab, cid), f'owen_{k}')
a = load('23.jpg')
lab, comps = components(a)
comps.sort(key=lambda c: c[1][1].start)
views = ['owen_seat', 'owen_seat_front', 'owen_seat_back']
for (cid, s_), n in zip(comps, views):
    f = figure(a, lab, cid)
    img = pixelize(f, 132 / f.shape[0], flip=(n != 'owen_seat_front'))
    if n == 'owen_seat_back':
        img.save(os.path.join(RAW, f'raw_{n}.png')); print('sprite', n, img.size)
    else:
        save_raw(img, n)
