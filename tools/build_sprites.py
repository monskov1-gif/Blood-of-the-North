"""Builds the runtime sprite atlas from the extracted reference frames.

Usage: python3 tools/build_sprites.py <raw_dir> <out_dir>

Besides the hero frames it derives extra characters by palette work
(Owen, bartender, patrons) and draws small pixel props (coupe glass).
"""
import sys, json, colorsys, os
import numpy as np
from PIL import Image

RAW, OUT = sys.argv[1], sys.argv[2]
ALIASES = {}


def load(name):
    return np.asarray(Image.open(f'{RAW}/raw_{name}.png')).astype(float).copy()


def hsv(a):
    rgb = a[..., :3] / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return s, v


def regrade(a, mask, tint, value_scale=1.0, keep_luma=0.85):
    """Recolor masked pixels: keep their shading but move them toward `tint`."""
    rgb = a[..., :3]
    luma = (rgb @ np.array([0.299, 0.587, 0.114]))[..., None] / 255.0
    t = np.array(tint, float)[None, None, :]
    shaded = t * (luma * 2.2) ** 0.9 * value_scale
    new = rgb * (1 - keep_luma) + shaded * keep_luma
    rgb[mask] = np.clip(new[mask], 0, 255)
    return a


def rows(a):
    return np.indices(a.shape[:2])[0]


def cols(a):
    return np.indices(a.shape[:2])[1]


def opaque(a):
    return a[..., 3] > 0


# ---------------------------------------------------------------- derivations

def make_owen(src, seated=False):
    a = load(src)
    s, v = hsv(a)
    y = rows(a); x = cols(a); op = opaque(a)
    warm = (a[..., 0] > a[..., 2] + 25)
    skin = op & warm & (v > 0.5) & (s > 0.3)
    face_zone = (y > 12) & (y < 32)
    # remove the moustache: dark pixels in the lower face that sit between skin pixels
    for yy in (range(14, 26) if seated else range(21, 29)):
        for xx in range(a.shape[1]):
            if not op[yy, xx] or skin[yy, xx]:
                continue
            up = skin[max(0, yy - 3):yy, xx].any()
            dn = skin[yy + 1:yy + 4, xx].any()
            right = skin[yy, xx + 1:xx + 3].any() if xx + 1 < a.shape[1] else False
            if up and (dn or right) and v[yy, xx] < 0.45:
                a[yy, xx, :3] = [150, 112, 98]
                skin[yy, xx] = True
    coat = op & ~skin & (v > 0.22) & (s > 0.18) & (y > (22 if seated else 26))
    a = regrade(a, coat, (70, 72, 84), value_scale=0.55)
    s2, v2 = hsv(a)
    a = regrade(a, skin, (226, 205, 198), value_scale=1.05, keep_luma=0.75)
    hair = op & ~skin & (y < 26)
    a = regrade(a, hair, (40, 38, 46), value_scale=0.7, keep_luma=0.6)
    # deep wine shirt hint, very subtle
    shirt = op & ~skin & (v < 0.2) & (y > 28) & (y < 70)
    a = regrade(a, shirt, (70, 30, 36), value_scale=0.8, keep_luma=0.35)
    return a


def make_patron_from_julian():
    a = load('julian_idle')
    s, v = hsv(a)
    y = rows(a); op = opaque(a)
    red = op & (a[..., 0] > a[..., 1] * 1.5) & (s > 0.4)
    a = regrade(a, red, (70, 92, 74), value_scale=0.9)
    coat = op & ~red & (v > 0.42) & (y > 34) & (a[..., 0] > a[..., 2] + 30)
    a = regrade(a, coat, (66, 70, 84), value_scale=0.7, keep_luma=0.9)
    hair = op & (y < 30) & (s > 0.33) & (v < 0.45)
    a = regrade(a, hair, (205, 180, 120), value_scale=1.2, keep_luma=0.7)
    return a


def make_patron_from_kayden(frame):
    a = load(frame)
    s, v = hsv(a)
    y = rows(a); op = opaque(a)
    warm = (a[..., 0] > a[..., 2] + 25)
    skin = op & warm & (v > 0.5) & (s > 0.3)
    coat = op & ~skin & (v > 0.22) & (s > 0.18) & (y > 26)
    a = regrade(a, coat, (88, 96, 70), value_scale=0.85)
    hair = op & ~skin & (y < 22)
    a = regrade(a, hair, (150, 148, 150), value_scale=1.0, keep_luma=0.75)
    return a


def make_bartender(frame):
    a = load(frame)
    s, v = hsv(a)
    y = rows(a); op = opaque(a)
    vest = op & (v < 0.25) & (y > 30) & (y < 88)
    a = regrade(a, vest, (120, 36, 40), value_scale=1.3, keep_luma=0.7)
    hair = op & (v < 0.3) & (y < 30)
    a = regrade(a, hair, (150, 80, 50), value_scale=1.1, keep_luma=0.6)
    return a


def make_woman():
    a = load('waiter_idle')
    s, v = hsv(a)
    y = rows(a); x = cols(a); op = opaque(a)
    white = op & (v > 0.45) & (y > 30)
    a = regrade(a, white, (40, 92, 80), value_scale=0.75)
    dark = op & (v <= 0.45) & (y > 30)
    a = regrade(a, dark, (30, 60, 54), value_scale=0.9, keep_luma=0.6)
    # long hair down the back of the neck
    hair_col = np.array([46, 34, 32, 255.0])
    ys, xs = np.where(op & (y < 26))
    back = xs.min()
    for yy in range(18, 46):
        width = 7 if yy < 38 else 5
        for xx in range(back, back + width):
            if xx < a.shape[1]:
                shade = 0.8 + 0.25 * ((xx + yy) % 3 == 0)
                a[yy, xx] = hair_col * [shade, shade, shade, 1]
    hair = op & (y < 30) & (v < 0.35)
    a = regrade(a, hair, (60, 40, 36), value_scale=1.0, keep_luma=0.5)
    return a


def make_waiter2():
    a = load('waiter_talk')
    y = rows(a); op = opaque(a)
    s, v = hsv(a)
    hair = op & (v < 0.32) & (y < 30)
    a = regrade(a, hair, (190, 160, 110), value_scale=1.25, keep_luma=0.8)
    return a


def coupe(full=True):
    """9x13 pixel coupe glass (dark red cocktail + cherry), drawn by hand."""
    W, H = 11, 14
    a = np.zeros((H, W, 4), float)
    glass = [228, 230, 236, 200]
    edge = [170, 176, 190, 230]
    for xx in range(W):
        a[2, xx] = edge
    for yy, (l, r) in zip(range(3, 6), [(0, 10), (1, 9), (2, 8)]):
        a[yy, l] = edge; a[yy, r] = edge
        if full:
            for xx in range(l + 1, r):
                a[yy, xx] = [120, 16, 26, 255] if yy > 3 else [196, 150, 130, 255]
    a[6, 4:7] = edge
    for yy in range(7, 12):
        a[yy, 5] = glass
    a[12, 3:8] = edge
    a[13, 2:9] = glass
    if full:
        a[1, 8] = [110, 10, 20, 255]; a[1, 9] = [140, 20, 30, 255]
        a[0, 9] = [90, 20, 20, 255]
        a[2, 7] = [150, 150, 160, 255]
    return a


# ---------------------------------------------------------------- atlas

frames = {}
for name in ['julian_idle', 'julian_talk', 'julian_think',
             'kayden_idle', 'kayden_talk', 'kayden_think',
             'waiter_idle', 'waiter_talk', 'waiter_hands']:
    frames[name] = load(name)

frames['owen_idle'] = make_owen('kayden_idle')
frames['owen_think'] = make_owen('kayden_think')
frames['owen_raise'] = make_owen('kayden_talk')
frames['patron_a'] = make_patron_from_julian()
frames['patron_b'] = make_patron_from_kayden('kayden_idle')
frames['patron_b_talk'] = make_patron_from_kayden('kayden_talk')
frames['bartender_idle'] = make_bartender('waiter_hands')
frames['bartender_talk'] = make_bartender('waiter_talk')
frames['woman'] = make_woman()
frames['waiter2'] = make_waiter2()
frames['prop_coupe'] = coupe(True)
frames['prop_coupe_empty'] = coupe(False)

# Owen raises a glass: put a coupe in the extended hand
raise_ = frames['owen_raise']
op = raise_[..., 3] > 0
ys, xs = np.where(op[60:110] & (np.indices(op[60:110].shape)[1] > raise_.shape[1] - 14))
if len(ys):
    hy = 60 + int(ys.min()); hx = int(xs.max()) - 8
    g = coupe(True)
    for yy in range(g.shape[0]):
        for xx in range(g.shape[1]):
            if g[yy, xx, 3] > 0:
                ty, tx = hy - 12 + yy, hx + xx
                if 0 <= ty < raise_.shape[0]:
                    if tx >= raise_.shape[1]:
                        pad = tx - raise_.shape[1] + 1
                        raise_ = np.pad(raise_, ((0, 0), (0, pad), (0, 0)))
                    raise_[ty, tx] = g[yy, xx]
    frames['owen_raise'] = raise_

# ---------------------------------------------------------------- seated poses
HIP, KNEE = 96, 134


def seated(a):
    """Re-poses a standing right-facing frame into a seated one: the torso is
    kept, thighs/shins are redrawn as pixel art in the character's trouser
    colours, the front shoe is copied from the original frame."""
    h, w = a.shape[:2]
    op = a[..., 3] > 0
    # leg columns near the floor
    low = op[150:172]
    cols = np.where(low.any(0))[0]
    lx0, lx1 = int(cols.min()), int(cols.max())
    legc = (lx0 + lx1) // 2
    trou = a[150:166, lx0:lx1 + 1][op[150:166, lx0:lx1 + 1]][:, :3]
    lum = trou.sum(1)
    mid = np.median(trou, 0)
    dark = trou[lum <= np.percentile(lum, 20)].mean(0)
    light = trou[lum >= np.percentile(lum, 85)].mean(0)
    outline = np.minimum(dark * 0.55, 40)

    out_h = HIP + 50
    out_w = max(w, legc + 52)
    out = np.zeros((out_h, out_w, 4), float)
    out[:HIP, :w] = a[:HIP]
    # coat tail draped behind (back side = left of the leg centre)
    for yy in range(HIP, min(h, HIP + 18)):
        for xx in range(0, max(0, legc - 3)):
            if op[yy, xx]:
                out[yy, xx] = a[yy, xx]

    def px(y, x, c):
        if 0 <= y < out_h and 0 <= x < out_w:
            out[y, x, :3] = c; out[y, x, 3] = 255

    # thigh: horizontal, from the hip forward
    tx0, tx1 = legc - 6, legc + 25
    ty0, ty1 = HIP - 4, HIP + 7
    for x in range(tx0, tx1):
        for y in range(ty0, ty1):
            edge = y in (ty0, ty1 - 1) or x == tx1 - 1
            c = outline if edge else (light if y < ty0 + 3 else (dark if y > ty1 - 4 else mid))
            px(y, x, c)
    # knee rounding
    px(ty0, tx1 - 1, [0, 0, 0]); out[ty0, tx1 - 1, 3] = 0
    # shin: from the knee down to the floor, slightly angled back
    sx = tx1 - 10
    for y in range(ty1 - 1, out_h - 6):
        off = (y - ty1) // 12
        for x in range(sx - off, sx - off + 9):
            edge = x in (sx - off, sx - off + 8)
            px(y, x, outline if edge else (light if x < sx - off + 3 else (dark if x > sx - off + 6 else mid)))
    # shoe copied from the original (front-most shoe)
    shoe_rows = range(h - 12, h)
    shoe_cols = range(max(lx1 - 18, lx0), lx1 + 1)
    sy0 = out_h - 12
    sx0 = sx - (out_h - 6 - ty1) // 12 - 5
    for i, yy in enumerate(shoe_rows):
        for j, xx in enumerate(shoe_cols):
            if op[yy, xx]:
                px(sy0 + i, sx0 + j, a[yy, xx, :3])
    return out


# legacy generated seated poses (kept for the remaining derived characters)
for name in ['patron_a', 'patron_b', 'patron_b_talk', 'woman']:
    frames[name + '_sit'] = seated(frames[name])

# painted seated poses supplied for the heroes (tools/process_art.py)
ALIASES = {}
for hero in ['julian', 'kayden', 'waiter']:
    frames[f'{hero}_seat'] = load(f'{hero}_seat')
for pose in ['idle', 'talk', 'think']:
    ALIASES[f'julian_{pose}_sit'] = 'julian_seat'
    ALIASES[f'kayden_{pose}_sit'] = 'kayden_seat'
# Owen: the seated gentleman from the crowd sheet, re-dressed in black and paled
def noir(a):
    a = a.copy()
    s_, v = hsv(a)
    op = opaque(a)
    rgb = a[..., :3]
    warm = rgb[..., 0] > rgb[..., 2] + 18
    skin = op & warm & (v > 0.52) & (s_ > 0.12) & (s_ < 0.55)
    cloth = op & ~skin & (v < 0.55)
    a = regrade(a, cloth, (52, 52, 64), value_scale=0.62, keep_luma=0.9)
    a = regrade(a, skin, (232, 214, 210), value_scale=1.0, keep_luma=0.55)
    return a


frames['owen_seat'] = noir(load('sit_suit'))
seat_raise = frames['owen_seat'].copy()
g = coupe(True)
hy, hx = 44, seat_raise.shape[1] - 30
for yy in range(g.shape[0]):
    for xx in range(g.shape[1]):
        if g[yy, xx, 3] > 0 and 0 <= hx + xx < seat_raise.shape[1]:
            seat_raise[hy + yy, hx + xx] = g[yy, xx]
frames['owen_raise_seat'] = seat_raise
frames['owen_stand'] = noir(load('npc_smoker_front'))
for pose in ['idle', 'think']:
    ALIASES[f'owen_{pose}_sit'] = 'owen_seat'
ALIASES['owen_raise_sit'] = 'owen_raise_seat'
ALIASES['owen_stand_sit'] = 'owen_seat'

# crowd (painted sheets → pixel art)
import glob as _glob
for f in sorted(_glob.glob(f'{RAW}/raw_npc_*.png')) + sorted(_glob.glob(f'{RAW}/raw_sit_*.png')):
    n = os.path.basename(f)[4:-4]
    frames[n] = load(n)

# ---------------------------------------------------------------- crowd variants
def variant(a, hue, sat=1.0, val=1.0, head=0.16):
    """Re-dyes clothing (non-skin pixels) by rotating hue; skin and near-greys kept."""
    a = a.copy()
    rgb = a[..., :3] / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-5
    r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    idx = m & (mx == r_); h[idx] = ((g_ - b_)[idx] / d[idx]) % 6
    idx = m & (mx == g_); h[idx] = (b_ - r_)[idx] / d[idx] + 2
    idx = m & (mx == b_); h[idx] = (r_ - g_)[idx] / d[idx] + 4
    h = h / 6
    sv = np.where(mx > 0, d / np.maximum(mx, 1e-5), 0)
    v = mx
    op = a[..., 3] > 0
    skin = op & (h < 0.11) & (sv > 0.18) & (sv < 0.6) & (v > 0.5)
    rows = np.indices(op.shape)[0]
    cloth = op & ~skin & (rows > head * op.shape[0])
    h2 = np.where(cloth, (h + hue) % 1.0, h)
    s2 = np.where(cloth, np.clip(sv * sat + (0.12 if sat > 1 else 0) * cloth, 0, 1), sv)
    v2 = np.where(cloth, np.clip(v * val, 0, 1), v)
    i = np.floor(h2 * 6).astype(int) % 6
    f = h2 * 6 - np.floor(h2 * 6)
    p_, q_, t_ = v2 * (1 - s2), v2 * (1 - f * s2), v2 * (1 - (1 - f) * s2)
    out = np.zeros_like(rgb)
    for k, (R, G, B) in enumerate([(v2, t_, p_), (q_, v2, p_), (p_, v2, t_), (p_, q_, v2), (t_, p_, v2), (v2, p_, q_)]):
        sel = i == k
        out[..., 0][sel] = R[sel]; out[..., 1][sel] = G[sel]; out[..., 2][sel] = B[sel]
    a[..., :3] = np.where(op[..., None], out * 255, a[..., :3])
    return a


VARIANTS = {
    'sit_glasses': (0.55, 1.1, 0.8), 'sit_green': (0.62, 1.0, 0.9), 'sit_soldier': (0.85, 0.6, 0.8),
    'sit_burgundy': (0.45, 0.8, 0.9), 'sit_smoker': (0.6, 0.6, 0.85), 'sit_maid': (0.0, 0.0, 1.0),
    'sit_hat': (0.95, 1.2, 0.8), 'sit_fur': (0.1, 1.0, 0.85),
    'npc_cap_back': (0.55, 0.5, 0.8), 'npc_cap_side': (0.55, 0.5, 0.8), 'npc_bluecoat_front': (0.5, 1.0, 0.8),
    'npc_glasses_front': (0.6, 0.8, 0.8), 'npc_glasses_back': (0.6, 0.8, 0.8), 'npc_green_side': (0.85, 1.0, 0.85),
    'npc_fedora_back': (0.6, 0.25, 0.6), 'npc_vest_side': (0.4, 0.8, 0.9), 'npc_vest_back': (0.4, 0.8, 0.9),
    'npc_fur_side': (0.9, 1.2, 0.9), 'npc_butler_side': (0.0, 1.0, 1.0),
}
for n, (hshift, sat, val) in VARIANTS.items():
    if n in frames:
        frames[n + '_v'] = variant(frames[n], hshift, sat, val, head=0.26 if n.startswith('sit_') else 0.16)

# ---------------------------------------------------------------- walk cycle
WALK_HIP = 112


def walk(a, amp, front_dark):
    """Two-layer leg scissor: back leg = darker copy sheared one way,
    front leg = copy sheared the other way. Rows above WALK_HIP are kept."""
    h, w = a.shape[:2]
    pad = abs(amp) + 2
    out = np.zeros((h, w + pad * 2, 4), float)
    out[:WALK_HIP, pad:pad + w] = a[:WALK_HIP]
    span = h - WALK_HIP
    layers = [(-amp, 0.62 if not front_dark else 1.0), (amp, 1.0 if not front_dark else 0.62)]
    if front_dark:
        layers = layers[::-1]
    for shear, shade in layers:
        for y in range(WALK_HIP, h):
            dx = int(round(shear * (y - WALK_HIP) / span))
            row = a[y]
            for x in range(w):
                if row[x, 3] > 0:
                    c = row[x].copy(); c[:3] *= shade
                    out[y, pad + x + dx] = c
    # bob: whole sprite 1px down on the spread frames is done at runtime
    return out


for name in ['julian_idle', 'kayden_idle', 'waiter_idle', 'waiter2', 'owen_idle', 'patron_a', 'patron_b', 'woman', 'bartender_idle',
             'npc_cap_side', 'npc_glasses_side', 'npc_vest_side', 'npc_fedora_side']:
    if name not in frames: continue
    frames[name + '_walk1'] = walk(frames[name], 7, False)
    frames[name + '_walk2'] = walk(frames[name], 7, True)

# simple shelf packing, 2px padding
PAD = 2
order = sorted(frames, key=lambda n: -frames[n].shape[0])
W = 2048
x = y = rowh = 0
meta = {}
for n in order:
    h, w = frames[n].shape[:2]
    if x + w + PAD > W:
        x = 0; y += rowh + PAD; rowh = 0
    fa = frames[n][..., 3] > 0
    band = fa[40:62] if h > 70 else fa
    cols_ = np.where(band)[1]
    ax = float(np.median(cols_)) if len(cols_) else w / 2
    meta[n] = dict(x=x, y=y, w=w, h=h, ax=round(ax, 1))
    x += w + PAD; rowh = max(rowh, h)
H = 1
while H < y + rowh:
    H *= 2
atlas = np.zeros((H, W, 4), np.uint8)
for n, m in meta.items():
    atlas[m['y']:m['y'] + m['h'], m['x']:m['x'] + m['w']] = frames[n].clip(0, 255).astype(np.uint8)
Image.fromarray(atlas, 'RGBA').save(f'{OUT}/characters.png', optimize=True)
for alias, target in ALIASES.items():
    meta[alias] = meta[target]
json.dump(dict(size=[W, H], frames=meta), open(f'{OUT}/characters.json', 'w'), indent=1)
print('atlas', W, H, len(meta))
