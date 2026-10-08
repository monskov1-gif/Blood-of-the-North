"""Builds the runtime sprite atlas from the extracted reference frames.

Usage: python3 tools/build_sprites.py <raw_dir> <out_dir>

Besides the hero frames it derives extra characters by palette work
(Owen, bartender, patrons) and draws small pixel props (coupe glass).
"""
import sys, json, colorsys, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

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

frames['patron_a'] = make_patron_from_julian()
frames['patron_b'] = make_patron_from_kayden('kayden_idle')
frames['patron_b_talk'] = make_patron_from_kayden('kayden_talk')
frames['bartender_idle'] = make_bartender('waiter_hands')
frames['bartender_talk'] = make_bartender('waiter_talk')
frames['woman'] = make_woman()
frames['waiter2'] = make_waiter2()
frames['prop_coupe'] = coupe(True)
frames['prop_coupe_empty'] = coupe(False)

# police officers for the morning: Kayden's uniform sprite, re-dressed, no moustache, other hair
def make_officer(src, hair, coat=(38, 48, 78)):
    a = load(src)
    s_, v = hsv(a)
    y = rows(a); op = opaque(a)
    warm = (a[..., 0] > a[..., 2] + 25)
    skin = op & warm & (v > 0.5) & (s_ > 0.3)
    for yy in range(21, 29):
        for xx in range(a.shape[1]):
            if not op[yy, xx] or skin[yy, xx]:
                continue
            up = skin[max(0, yy - 3):yy, xx].any()
            dn = skin[yy + 1:yy + 4, xx].any()
            right = skin[yy, xx + 1:xx + 3].any() if xx + 1 < a.shape[1] else False
            if up and (dn or right) and v[yy, xx] < 0.45:
                a[yy, xx, :3] = [150, 112, 98]
                skin[yy, xx] = True
    jacket = op & ~skin & (v > 0.22) & (s_ > 0.18) & (y > 26)
    a = regrade(a, jacket, coat, value_scale=0.8)
    hairm = op & ~skin & (y < 22)
    a = regrade(a, hairm, hair, value_scale=1.0, keep_luma=0.75)
    return a


def add_gun(a):
    a = a.copy()
    op = a[..., 3] > 0
    # the extended hand: right-most opaque pixels between rows 70 and 100
    band = op[70:100]
    ys, xs = np.where(band)
    if not len(xs):
        return a
    hx = int(xs.max()); hy = 70 + int(ys[xs.argmax()])
    pad = 12
    a = np.pad(a, ((0, 0), (0, pad), (0, 0)))
    gun = [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4), (0, 5), (0, 6), (0, 7), (-1, 1), (-1, 2), (-1, 3), (-1, 4), (-1, 5), (-1, 6), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2)]
    for dy, dx in gun:
        yy, xx = hy + dy - 1, hx + dx + 1
        if 0 <= yy < a.shape[0] and xx < a.shape[1]:
            a[yy, xx] = [24, 24, 28, 255]
    a[hy - 2, hx + 2] = [90, 90, 100, 255]
    return a


frames['officer_a'] = make_officer('kayden_idle', (60, 44, 34))
frames['officer_a_aim'] = add_gun(make_officer('kayden_talk', (60, 44, 34)))
frames['officer_b'] = make_officer('kayden_idle', (176, 140, 90), coat=(30, 34, 44))
frames['officer_b_aim'] = add_gun(make_officer('kayden_talk', (176, 140, 90), coat=(30, 34, 44)))

# readable 2D cocktail for the table (drawn large, then reduced to pixel art)
def big_coupe(full=True, W=26, H=34, S=8):
    from PIL import ImageDraw
    img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = W * S // 2
    rim_y, bowl_h, rx = 7 * S, 9 * S, 11 * S
    glass = (215, 225, 235, 150)
    edge = (235, 240, 248, 235)
    # bowl
    d.chord([cx - rx, rim_y - bowl_h, cx + rx, rim_y + bowl_h], 0, 180, fill=glass, outline=edge, width=S)
    if full:
        d.chord([cx - rx + S, rim_y - bowl_h + S, cx + rx - S, rim_y + bowl_h - S], 0, 180, fill=(112, 10, 24, 255))
        d.rectangle([cx - rx + S, rim_y, cx + rx - S, rim_y + S], fill=(214, 168, 150, 255))  # foam line
        d.ellipse([cx - 4 * S, rim_y + 2 * S, cx + 2 * S, rim_y + 5 * S], fill=(170, 30, 44, 255))  # glow
    d.line([cx - rx, rim_y, cx + rx, rim_y], fill=edge, width=S)
    # stem and foot
    d.rectangle([cx - S // 2, rim_y + bowl_h - S, cx + S // 2, (H - 3) * S], fill=edge)
    d.ellipse([cx - 7 * S, (H - 4) * S, cx + 7 * S, (H - 1) * S], fill=glass, outline=edge, width=S)
    # highlight
    d.line([cx - rx + 2 * S, rim_y + S, cx - rx + 4 * S, rim_y + 5 * S], fill=(255, 255, 255, 220), width=S)
    if full:
        # pick + cherry
        d.line([cx - 2 * S, rim_y - 2 * S, cx + rx + 2 * S, rim_y - S], fill=(170, 170, 185, 255), width=S)
        d.ellipse([cx + 4 * S, rim_y - 6 * S, cx + 10 * S, rim_y], fill=(110, 6, 22, 255), outline=(60, 0, 10, 255), width=S // 2)
        d.ellipse([cx + 5 * S, rim_y - 5 * S, cx + 7 * S, rim_y - 3 * S], fill=(240, 140, 150, 255))
        d.line([cx + 8 * S, rim_y - 6 * S, cx + 11 * S, rim_y - 12 * S], fill=(90, 10, 16, 255), width=S)
    small = img.resize((W, H), Image.BOX)
    a = np.asarray(small).astype(float)
    a[..., 3] = np.where(a[..., 3] > 70, np.clip(a[..., 3] * 1.3, 0, 255), 0)
    return a


frames['prop_coupe_big'] = big_coupe(True)
frames['prop_coupe_big_empty'] = big_coupe(False)

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


# Owen: painted seated views supplied for him (profile / front / back)
frames['owen_profile'] = load('owen_seat')
frames['owen_front'] = load('owen_seat_front')
frames['owen_back'] = load('owen_seat_back')
raise_ = frames['owen_front'].copy()
g = coupe(True)
hy, hx = 50, raise_.shape[1] // 2 + 6
for yy in range(g.shape[0]):
    for xx in range(g.shape[1]):
        if g[yy, xx, 3] > 0 and 0 <= hx + xx < raise_.shape[1]:
            raise_[hy + yy, hx + xx] = g[yy, xx]
frames['owen_front_raise'] = raise_

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

# ---------------------------------------------------------------- custody / hospital cast
def grey_hair(a, frac=0.24):
    a = a.copy()
    rgb = a[..., :3]
    op = a[..., 3] > 0
    rows_ = np.indices(op.shape)[0]
    warm = (rgb[..., 0] > rgb[..., 2] + 18) & (rgb.max(-1) > 120)
    hair = op & (rows_ < frac * op.shape[0]) & ~warm
    lum = (rgb @ np.array([0.3, 0.59, 0.11]))[..., None]
    rgb[hair] = np.clip(np.repeat(lum, 3, -1)[hair] * 1.25 + 60, 0, 235)
    return a


CAST = {
    'doctor': variant(frames['npc_glasses_front'], 0.0, 0.06, 2.6),
    'doctor_side': variant(frames['npc_glasses_side'], 0.0, 0.06, 2.6),
    'nurse': variant(frames['npc_green_front'], 0.12, 0.7, 1.7),
    'nurse_side': variant(frames['npc_green_side'], 0.12, 0.7, 1.7),
    'chef': variant(frames['npc_butler_front'], 0.0, 0.05, 2.8),
    'dishwasher': variant(frames['npc_vest_front'], 0.5, 0.3, 1.1),
    'officer_seat': variant(frames['sit_suit'], 0.52, 1.0, 0.7, head=0.26),
    'patient_old': grey_hair(frames['npc_green_front'], 0.2),
}
frames.update(CAST)

# ---------------------------------------------------------------- v0.06 painted batch (tools/process_art2.py)
V06 = ['cop_blond_idle', 'cop_blond_aim', 'cop_red_idle', 'cop_red_aim', 'quinn_idle', 'quinn_aim',
       'nurse_red', 'nurse_red_wave', 'medic_m', 'medic_m_wave', 'doctor_f', 'doctor_f_wave',
       'nurse_white', 'nurse_white_wave', 'nurse_blue', 'nurse_blue_wave', 'wyatt_seat',
       'lie_glasses', 'lie_green', 'lie_soldier', 'lie_burgundy', 'lie_vest', 'lie_maid',
       'lie_julian', 'lie_kayden', 'lie_waiter']
for n in V06:
    frames[n] = load(n)
# v0.07: Julian repainted — coat and hospital gown, painted walk frames, lying in the gown
for n in ['jul_idle', 'jul_talk', 'jul_idle_walk1', 'jul_idle_walk2',
          'julg_idle', 'julg_talk', 'julg_idle_walk1', 'julg_idle_walk2', 'lie_julian_gown']:
    frames[n] = load(n)


# v0.08: one head for Julian. The painted frames each had their own head (the walk
# frames bowed, in shadow, ~4% shorter): the walk frames are scaled to the idle
# height, then every frame gets the head + upper neck of the first painted frame
# (jul_idle) — in the coat with the top of the scarf; in the gown it sits on the
# frame's own painted neck.
def bbox(a):
    ys, xs = np.where(a[..., 3] > 0)
    return ys.min(), ys.max(), xs.min(), xs.max()


def match_scale(a, ref):
    """Rescale a painted walk frame so the figure is as tall as the idle frame."""
    y0, y1, _, _ = bbox(a); r0, r1, _, _ = bbox(ref)
    k = (r1 - r0 + 1) / (y1 - y0 + 1)
    if abs(k - 1) < 0.01:
        return a
    h, w = a.shape[:2]
    pm = a.copy(); pm[..., :3] *= pm[..., 3:4] / 255.0
    img = Image.fromarray(pm.clip(0, 255).astype(np.uint8), 'RGBA').resize((round(w * k), round(h * k)), Image.BICUBIC)
    d = np.asarray(img).astype(float)
    al = d[..., 3:4] / 255.0
    rgb = np.where(al > 0.01, d[..., :3] / np.maximum(al, 1e-3), 0)
    alpha = d[..., 3] > 128
    pal = np.unique(a[a[..., 3] > 0][:, :3], axis=0)
    flat = rgb[alpha]
    idx = np.argmin(((flat[:, None, :] - pal[None]) ** 2).sum(-1), 1)
    out = np.zeros(d.shape, float)
    out[alpha, :3] = pal[idx]; out[alpha, 3] = 255
    return out

def is_red(a):
    return (a[..., 3] > 0) & (a[..., 0] > a[..., 1] * 1.6) & (a[..., 0] > 70)

def is_skin(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (a[..., 3] > 0) & (r > 150) & (r > g + 12) & (g > b) & ~is_red(a)

def is_gown(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (a[..., 3] > 0) & (b >= r - 6) & (b > 95)

HEAD_ROWS = 24  # head + upper neck of the reference frame, rows from the top of the figure


SCARF_ROWS = 7  # coat: the top of the scarf comes along with the head


def head_of(ref, with_scarf=False):
    """The reference head with the upper neck; in the coat also the scarf wrapped
    under the jaw, otherwise the scarf (and its dark shadow tones) is left out."""
    t = bbox(ref)[0]
    m = np.zeros(ref.shape[:2], bool); m[t:t + HEAD_ROWS] = True
    op = ref[..., 3] > 0
    # the scarf's own shadow tones: reddish pixels right next to the scarf (not the brown hair)
    scarfish = is_red(ref) | (nd.binary_dilation(is_red(ref), iterations=2) & op & (ref[..., 0] > ref[..., 1] * 1.35))
    if with_scarf:
        m &= op
        low = np.zeros_like(m); low[t + HEAD_ROWS:t + HEAD_ROWS + SCARF_ROWS] = True
        m |= low & (scarfish | is_skin(ref))
    else:
        m &= op & ~scarfish
    lab, n = nd.label(m)
    if n > 1:
        sizes = nd.sum(m, lab, range(1, n + 1))
        m &= np.isin(lab, 1 + np.where(sizes >= 6)[0])
    return m, t


def neck_span(m, y):
    xs = np.where(m[y])[0]
    return (xs.min(), xs.max()) if len(xs) else None


def graft_head(a, ref, neck_top=None):
    """Replaces the head of a frame with the reference head.
    Coat: head + upper neck + the top of the scarf, aligned on the scarf.
    Gown: the frame keeps its own painted neck from `neck_top` (rows from the
    top of the figure, the first clean neck row under the old chin) down; the
    reference head (+ its upper neck) is set on top of it, aligned on the neck."""
    a = a.copy()
    t = bbox(a)[0]
    H, W = a.shape[:2]
    coat = is_red(a)[t:t + 40].sum() > 20
    hm, rt = head_of(ref, with_scarf=coat)
    cloth = is_red(a) if coat else is_gown(a)
    # only the garment itself: background specks of the same colour do not count
    lab, n = nd.label(cloth)
    if n > 1:
        sizes = nd.sum(cloth, lab, range(1, n + 1))
        cloth = cloth & np.isin(lab, 1 + np.where(sizes >= 0.2 * sizes.max())[0])
    if coat:
        lo = t + 18
        first = np.full(W, -1)
        for x in range(W):
            ys = np.where(cloth[lo:t + 52, x])[0]
            if len(ys): first[x] = lo + ys[0]
        rs = np.median(np.where(is_red(ref)[rt + HEAD_ROWS - 2:rt + HEAD_ROWS + 8])[1])
        ts = np.median(np.where(is_red(a)[t + HEAD_ROWS - 2:t + HEAD_ROWS + 8])[1])
        dx, dy = int(round(ts - rs)), t - rt
        for x in range(W):
            stop = first[x] if first[x] >= 0 else t + HEAD_ROWS + 6
            col = slice(t, stop)
            a[col, x][~cloth[col, x]] = 0
    else:
        top = t + neck_top
        xs = np.where(is_skin(a)[top])[0]
        runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
        run = max(runs, key=len)
        last = rt + HEAD_ROWS - 1
        sl, sr = neck_span(hm & is_skin(ref), last)
        dx = int(round((run.min() + run.max()) / 2 - (sl + sr) / 2))
        dy = (top - 1) - last
        # the old head and chin go; the gown and the neck below `top` stay
        band = np.zeros((H, W), bool); band[t:top] = True
        a[band & ~cloth] = 0
    ys, xs = np.where(hm)
    ty, tx = ys + dy, xs + dx
    ok = (tx >= 0) & (tx < W) & (ty >= 0) & (ty < H)
    a[ty[ok], tx[ok]] = ref[ys[ok], xs[ok]]
    return a


def gown_mask(a):
    c = is_gown(a)
    lab, n = nd.label(c)
    if n > 1:
        sizes = nd.sum(c, lab, range(1, n + 1))
        c = c & np.isin(lab, 1 + np.where(sizes >= 0.2 * sizes.max())[0])
    return c

def neck_centre(a, y):
    xs = np.where(is_skin(a)[y])[0]
    if not len(xs): return None
    runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
    run = max(runs, key=len)
    return (run.min() + run.max()) / 2

def copy_head_to_shoulders(a, src, src_collar, collar, dx_adj=0):
    """Paste src's head + neck (rows above its collar, gown left out) onto a,
    with the neck's base dropped into a's collar."""
    a = a.copy(); H, W = a.shape[:2]
    ts, t = bbox(src)[0], bbox(a)[0]
    sg, tg = gown_mask(src), gown_mask(a)
    sy, ty = ts + src_collar, t + collar
    sc = neck_centre(src, sy - 1)
    tc = neck_centre(a, ty - 1)
    dx = int(round(tc - sc)) + dx_adj
    dy = ty - sy
    # clear a's own head and neck above its collar (keep the gown)
    band = np.zeros((H, W), bool); band[:ty] = True
    a[band & ~tg] = 0
    m = np.zeros(src.shape[:2], bool); m[:sy] = True
    m &= (src[..., 3] > 0) & ~sg
    ys, xs = np.where(m)
    yy, xx = ys + dy, xs + dx
    ok = (xx >= 0) & (xx < W) & (yy >= 0) & (yy < H)
    a[yy[ok], xx[ok]] = src[ys[ok], xs[ok]]
    return a, dx


def chest_front(a, y0, y1):
    """Front-most gown column over a band of rows (the chest line in profile)."""
    g = gown_mask(a)
    xs = [np.where(g[y])[0].max() for y in range(y0, y1) if g[y].any()]
    return float(np.median(xs))


def copy_neck_exact(a, src, src_collar, collar, below=6):
    """Pixel-for-pixel head + whole neck of src onto a. The neck keeps its place
    relative to the chest (aligned on the front line of the gown, not centred),
    and the part of the neck that goes down into the collar comes along too."""
    a = a.copy(); H, W = a.shape[:2]
    ts, t = bbox(src)[0], bbox(a)[0]
    sg, tg = gown_mask(src), gown_mask(a)
    sy, ty = ts + src_collar, t + collar
    dx = int(round(chest_front(a, ty + 4, ty + 12) - chest_front(src, sy + 4, sy + 12)))
    dy = ty - sy
    sk_t = is_skin(a)
    # clear a's head + neck: everything above the collar except the gown, and its
    # own neck skin in the collar opening
    band = np.zeros((H, W), bool); band[:ty] = True
    a[band & ~tg] = 0
    low = np.zeros((H, W), bool); low[ty:ty + below] = True
    a[low & sk_t & ~tg] = 0
    m = np.zeros(src.shape[:2], bool); m[:sy] = True
    m &= (src[..., 3] > 0) & ~sg
    lows = np.zeros(src.shape[:2], bool); lows[sy:sy + below] = True
    m |= lows & is_skin(src) & ~sg
    ys, xs = np.where(m)
    yy, xx = ys + dy, xs + dx
    ok = (xx >= 0) & (xx < W) & (yy >= 0) & (yy < H)
    a[yy[ok], xx[ok]] = src[ys[ok], xs[ok]]
    return a, dx


def copy_neck_collar(a, src, src_collar, collar, below=7, back=9):
    """copy_neck_exact + the gown collar around the neck: every opaque source pixel
    in the strip from behind the nape to the chest front, down to `below` rows
    under the collar, is copied as is (the neckline is the reference's)."""
    t = bbox(a)[0]  # the frame's own top, before its head is replaced
    a, dx = copy_neck_exact(a, src, src_collar, collar, below)
    H, W = a.shape[:2]
    ts = bbox(src)[0]
    sy, ty = ts + src_collar, t + collar
    dy = ty - sy
    sk = is_skin(src)
    nl = np.where(sk[sy - 1])[0].min()
    front = int(chest_front(src, sy + 4, sy + 12))
    for y in range(sy - 6, sy + below):
        for x in range(nl - back, front + 1):
            if src[y, x, 3] > 0:
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W:
                    a[yy, xx] = src[y, x]
    return a, dx


def drop_specks(a, max_px=3):
    """Removes loose pixel specks (tiny islands not attached to the figure)."""
    a = a.copy()
    lab, n = nd.label(a[..., 3] > 0)
    if n > 1:
        sizes = nd.sum(np.ones_like(lab), lab, range(1, n + 1))
        for k, sz in enumerate(sizes, 1):
            if sz <= max_px: a[lab == k] = 0
    return a


# frames drawn with bigger pixels than 1 px = 1 cm (atlas meta `s`: cm per pixel)
FRAME_SCALE = {}


def coarser(a, k=2, keep_size=True):
    """Same sprite on a k× coarser pixel grid (premultiplied box filter, own palette).
    keep_size=False returns the small image (drawn k× larger at runtime, `s` = k)."""
    h, w = a.shape[:2]
    pm = a.copy(); pm[..., :3] *= pm[..., 3:4] / 255.0
    d = np.asarray(Image.fromarray(pm.clip(0, 255).astype(np.uint8), 'RGBA').resize(
        (max(1, round(w / k)), max(1, round(h / k))), Image.BOX)).astype(float)
    al = d[..., 3:4] / 255.0
    rgb = np.where(al > 0.01, d[..., :3] / np.maximum(al, 1e-3), 0)
    alpha = d[..., 3] > 120
    pal = np.unique(a[a[..., 3] > 0][:, :3], axis=0)
    flat = rgb[alpha]
    idx = np.argmin(((flat[:, None, :] - pal[None]) ** 2).sum(-1), 1)
    small = np.zeros(d.shape, float)
    small[alpha, :3] = pal[idx]; small[alpha, 3] = 255
    if not keep_size:
        return small
    return np.asarray(Image.fromarray(small.astype(np.uint8), 'RGBA').resize((w, h), Image.NEAREST)).astype(float)


# v0.12: the owner's walk frames keep their painted size (a stride is naturally a little lower);
# stretching them to the idle height with nearest-neighbour doubled single rows — one of them
# landed on the neck and read as the head being torn off the scarf
JUL_HEAD = frames['jul_idle'].copy()
# the old 'think' frame is ~10 cm shorter than the repainted coat frames: same height now
frames['julian_think'] = match_scale(frames['julian_think'], frames['jul_idle'])
# v0.10: the owner repainted every coat and gown frame with one consistent head
# (tools/process_art4.py) — those frames stay exactly as painted. Only the older
# frames without a repaint (think, seated) get the head of the new jul_idle.
for n in ['julian_think', 'julian_seat']:
    frames[n] = graft_head(frames[n], JUL_HEAD)
for n in ['jul_idle', 'jul_talk', 'julg_idle', 'julg_talk']:
    ALIASES[f'{n}_sit'] = 'julian_seat'
# v0.08: Wyatt and Quinn standing in profile (walk source), the old woman of 107 lying
for n in ['wyatt_side', 'quinn_side', 'lie_granny']:
    frames[n] = load(n)
# v0.12: Lizzy, Vikki, Olivia, Puriel (idle, talk, two painted walk frames) and four huge wolves
# assembled from parts (tools/process_art5.py)
for c in ['lizzy', 'vikki', 'olivia', 'puriel']:
    for n in ['idle', 'talk', 'idle_walk1', 'idle_walk2']:
        frames[f'{c}_{n}'] = load(f'{c}_{n}')
for c in ['grey', 'white', 'red', 'dark']:
    for n in ['', '_walk1', '_walk2', '_eat']:
        frames[f'wolf_{c}{n}'] = load(f'wolf_{c}{n}')
# the hospital beds are seen close up: the lying patients go on a 1.5× coarser grid
# (1 px = 1.5 cm, stored small and drawn 1.5× larger — even pixels, no doubling)
for n in ['lie_julian_gown', 'lie_granny']:
    frames[n] = coarser(frames[n], 1.5, keep_size=False)
    FRAME_SCALE[n] = 1.5
if os.path.exists(f'{RAW}/raw_quinn_drive.png'):
    frames['quinn_drive'] = load('quinn_drive')
else:
    # until her driving sheet is processed: her upper body over the seated legs of
    # Wyatt's sprite (same uniform trousers and boots), scaled to her height
    def quinn_seated():
        up = frames['quinn_idle'][:96]
        legs = frames['wyatt_seat'][66:]
        lh, lw = legs.shape[:2]
        k = 0.8
        legs = np.asarray(Image.fromarray(legs.clip(0, 255).astype(np.uint8), 'RGBA').resize(
            (round(lw * k), round(lh * k)), Image.NEAREST)).astype(float)
        lh, lw = legs.shape[:2]
        ox = 7  # her back over the back of the seat
        W_ = max(up.shape[1], ox + lw)
        out = np.zeros((96 + lh, W_, 4), float)
        out[96:96 + lh, ox:ox + lw] = legs
        top = up
        m = top[..., 3] > 0
        out[:96, :top.shape[1]][m] = top[m]
        return out
    frames['quinn_drive'] = quinn_seated()



def quantize(a, n=24):
    """Flatten soft painted shading into a small palette (the chunky pixel
    register of Julian's sprites); alpha is kept as it is."""
    rgb = Image.fromarray(a[..., :3].clip(0, 255).astype(np.uint8), 'RGB')
    q = np.asarray(rgb.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')).astype(float)
    out = a.copy()
    m = a[..., 3] > 0
    out[..., :3][m] = q[m]
    return out


# the driver was painted smooth: same flat-shaded register as the back seat
frames['quinn_drive'] = quantize(frames['quinn_drive'], 22)

# ---------------------------------------------------------------- walk cycle
WALK_HIP = 112


def walk(a, amp, front_dark, hip=WALK_HIP):
    """Two-layer leg scissor: back leg = darker copy sheared one way,
    front leg = copy sheared the other way. Rows above the hip are kept."""
    WALK_HIP = hip
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


for name in ['julian_idle', 'kayden_idle', 'waiter_idle', 'waiter2', 'patron_a', 'patron_b', 'woman', 'bartender_idle',
             'npc_cap_side', 'npc_glasses_side', 'npc_vest_side', 'npc_fedora_side', 'officer_a', 'officer_b', 'doctor_side', 'nurse_side',
             'cop_blond_idle', 'cop_red_idle', 'quinn_idle', 'nurse_red', 'medic_m', 'doctor_f', 'nurse_white', 'nurse_blue']:
    if name not in frames: continue
    frames[name + '_walk1'] = walk(frames[name], 7, False)
    frames[name + '_walk2'] = walk(frames[name], 7, True)
# the painted standing profiles: hip at ~61% of the height
for name in ['wyatt_side', 'quinn_side']:
    hip = round(frames[name].shape[0] * 0.61)
    frames[name + '_walk1'] = walk(frames[name], 7, False, hip)
    frames[name + '_walk2'] = walk(frames[name], 7, True, hip)

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
    if n in FRAME_SCALE: meta[n]['s'] = FRAME_SCALE[n]
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
