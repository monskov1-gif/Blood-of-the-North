import * as THREE from 'three';

/**
 * Procedural textures painted on canvases. No external image files are
 * needed for the environment; each generator is deterministic (seeded).
 */

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

export function canvasTexture(key, w, h, draw, { repeat = [1, 1], color = true, aniso = 4, nearest = false } = {}) {
  const ck = `${key}:${repeat}`;
  if (cache.has(ck)) return cache.get(ck);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = aniso;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  cache.set(ck, t);
  return t;
}

function grain(ctx, w, h, amount, r, alpha = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
    d[i + 3] *= alpha;
  }
  ctx.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ wood

function woodGrain(ctx, x, y, w, h, base, r, vertical = true) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  const lines = Math.floor((vertical ? w : h) / 2.2);
  for (let i = 0; i < lines; i++) {
    const p = (vertical ? x : y) + r() * (vertical ? w : h);
    ctx.strokeStyle = `rgba(${r() < 0.5 ? '20,8,4' : '120,60,30'},${0.05 + r() * 0.12})`;
    ctx.lineWidth = 0.5 + r() * 2;
    ctx.beginPath();
    const amp = 2 + r() * 6, freq = 0.005 + r() * 0.02, ph = r() * 6;
    if (vertical) {
      for (let t = y; t <= y + h; t += 8) {
        const xx = p + Math.sin(t * freq + ph) * amp;
        t === y ? ctx.moveTo(xx, t) : ctx.lineTo(xx, t);
      }
    } else {
      for (let t = x; t <= x + w; t += 8) {
        const yy = p + Math.sin(t * freq + ph) * amp;
        t === x ? ctx.moveTo(t, yy) : ctx.lineTo(t, yy);
      }
    }
    ctx.stroke();
  }
}

/** Raised wainscot panels in dark mahogany. */
export function panelTexture() {
  return canvasTexture('panel', 512, 512, (ctx, w, h) => {
    const r = rng(11);
    woodGrain(ctx, 0, 0, w, h, '#3a170d', r);
    const inset = (x, y, ww, hh) => {
      const g = ctx.createLinearGradient(x, y, x + ww, y + hh);
      g.addColorStop(0, 'rgba(255,190,140,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.strokeStyle = g; ctx.lineWidth = 10; ctx.strokeRect(x, y, ww, hh);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3; ctx.strokeRect(x + 8, y + 8, ww - 16, hh - 16);
      ctx.strokeStyle = 'rgba(255,180,120,0.12)'; ctx.lineWidth = 2; ctx.strokeRect(x + 12, y + 12, ww - 24, hh - 24);
      woodGrain(ctx, x + 14, y + 14, ww - 28, hh - 28, 'rgba(70,28,14,0.35)', r);
    };
    inset(24, 24, w - 48, h - 48);
    grain(ctx, w, h, 10, r);
  });
}

export function plankTexture() {
  return canvasTexture('planks', 1024, 1024, (ctx, w, h) => {
    const r = rng(5);
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      const y = (i * h) / rows;
      let x = -r() * 300;
      while (x < w) {
        const len = 260 + r() * 300;
        const tone = 30 + r() * 18;
        woodGrain(ctx, x, y, len, h / rows, `rgb(${tone + 16},${tone * 0.55},${tone * 0.32})`, r, false);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y, 2, h / rows);
        x += len;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, y, w, 2);
    }
    grain(ctx, w, h, 8, r);
  }, { repeat: [6, 2] });
}

// ------------------------------------------------------------------ wallpapers

function damaskMotif(ctx, cx, cy, s, color) {
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(cx, cy);
  for (const side of [1, -1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.5, -s * 0.8, s * 0.2, -s * 0.35, s * 0.55, -s * 0.2);
    ctx.bezierCurveTo(s * 0.9, -s * 0.05, s * 0.6, s * 0.35, s * 0.3, s * 0.25);
    ctx.bezierCurveTo(s * 0.45, s * 0.55, s * 0.15, s * 0.8, 0, s);
    ctx.lineTo(0, -s);
    ctx.fill();
    // curl
    ctx.beginPath();
    ctx.arc(s * 0.62, -s * 0.55, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function damaskTexture() {
  return canvasTexture('damask', 512, 512, (ctx, w, h) => {
    const r = rng(3);
    ctx.fillStyle = '#4a0d12';
    ctx.fillRect(0, 0, w, h);
    const col = 'rgba(120,28,34,0.55)';
    damaskMotif(ctx, w * 0.25, h * 0.25, 95, col);
    damaskMotif(ctx, w * 0.75, h * 0.75, 95, col);
    damaskMotif(ctx, w * 0.75, h * 0.25 - h, 95, col);
    damaskMotif(ctx, w * 0.25 + w, h * 0.75 - h, 95, col);
    damaskMotif(ctx, w * 0.25 - w, h * 0.75, 95, col);
    damaskMotif(ctx, w * 0.75 - w, h * 0.25, 95, col);
    damaskMotif(ctx, w * 0.25, h * 0.25 + h, 95, col);
    damaskMotif(ctx, w * 0.75, h * 0.75 - h, 95, col);
    ctx.globalCompositeOperation = 'multiply';
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d8b0a8'); g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    grain(ctx, w, h, 14, r);
  }, { repeat: [1, 1] });
}

export function leopardTexture() {
  return canvasTexture('leopard', 512, 512, (ctx, w, h) => {
    const r = rng(9);
    ctx.fillStyle = '#6b5528';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, s = 5 + r() * 9;
      ctx.fillStyle = `rgba(150,118,58,0.6)`;
      ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.8, r() * 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(34,24,10,0.85)';
      ctx.lineWidth = 2 + r() * 2;
      for (let k = 0; k < 3; k++) {
        const a0 = r() * Math.PI * 2;
        ctx.beginPath(); ctx.arc(x, y, s, a0, a0 + 0.8 + r()); ctx.stroke();
      }
    }
    grain(ctx, w, h, 16, r);
  });
}

// ------------------------------------------------------------------ rug

export function rugTexture() {
  return canvasTexture('rug', 1024, 512, (ctx, w, h) => {
    const r = rng(21);
    ctx.fillStyle = '#5a1015'; ctx.fillRect(0, 0, w, h);
    const border = (inset, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2); };
    border(14, '#1f1a2e', 26);
    border(40, '#b07b3c', 6);
    border(58, '#2a1d30', 16);
    // border motifs
    ctx.fillStyle = '#c69250';
    for (let x = 30; x < w - 20; x += 34) { ctx.beginPath(); ctx.arc(x, 20, 5, 0, 7); ctx.arc(x, h - 20, 5, 0, 7); ctx.fill(); }
    // central medallion
    ctx.save(); ctx.translate(w / 2, h / 2);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ['#23182c', '#8c5b2e', '#6e141a', '#c9a061'][i];
      const s = 170 - i * 38;
      ctx.beginPath();
      for (let a = 0; a <= 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const rr = s * (a % 2 ? 0.72 : 1);
        ctx.lineTo(Math.cos(ang) * rr * 1.6, Math.sin(ang) * rr * 0.9);
      }
      ctx.fill();
    }
    ctx.restore();
    // field ornaments
    ctx.fillStyle = 'rgba(200,150,80,0.35)';
    for (let i = 0; i < 40; i++) {
      const x = 90 + r() * (w - 180), y = 90 + r() * (h - 180);
      if (Math.abs(x - w / 2) < 300 && Math.abs(y - h / 2) < 150) continue;
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 6, y); ctx.fill();
    }
    grain(ctx, w, h, 30, r);
  });
}

export function ceilingTexture() {
  return canvasTexture('ceiling', 512, 512, (ctx, w, h) => {
    const r = rng(4);
    ctx.fillStyle = '#2a0a0c'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 18; ctx.strokeRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(170,110,60,0.25)'; ctx.lineWidth = 3; ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.fillStyle = 'rgba(120,70,40,0.18)';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 60, 0, 7); ctx.fill();
    grain(ctx, w, h, 10, r);
  }, { repeat: [14, 2] });
}

// ------------------------------------------------------------------ art

export function paintingTexture(kind, seed = 1) {
  return canvasTexture(`painting-${kind}-${seed}`, 512, 640, (ctx, w, h) => {
    const r = rng(seed * 31 + kind.length);
    if (kind === 'landscape') {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1d2430'); g.addColorStop(0.55, '#5b4a3a'); g.addColorStop(1, '#1b140f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let m = 0; m < 3; m++) {
        ctx.fillStyle = ['#2b2f38', '#3b3530', '#1c1813'][m];
        ctx.beginPath(); ctx.moveTo(0, h * (0.5 + m * 0.1));
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * (0.38 + m * 0.12) + Math.sin(x * 0.02 + m) * 40 + r() * 30);
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      }
      // snow caps
      ctx.fillStyle = 'rgba(220,220,210,0.25)';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(r() * w, h * 0.4 + r() * 30, 20, 0, 7); ctx.fill(); }
      // spruce silhouettes
      ctx.fillStyle = '#0d0b08';
      for (let i = 0; i < 26; i++) {
        const x = r() * w, y = h * 0.8 + r() * h * 0.15, s = 18 + r() * 30;
        ctx.beginPath(); ctx.moveTo(x, y - s * 2.4); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x - s * 0.5, y); ctx.fill();
      }
    } else if (kind === 'portrait') {
      ctx.fillStyle = '#16100c'; ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 10, w * 0.5, h * 0.4, w * 0.7);
      g.addColorStop(0, 'rgba(120,80,50,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c7a283';
      ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.33, 70, 92, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a1c14';
      ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.25, 80, 60, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#1b1514';
      ctx.beginPath(); ctx.moveTo(w * 0.12, h); ctx.quadraticCurveTo(w * 0.2, h * 0.5, w * 0.5, h * 0.48);
      ctx.quadraticCurveTo(w * 0.8, h * 0.5, w * 0.88, h); ctx.fill();
      ctx.fillStyle = '#e8dcc8';
      ctx.beginPath(); ctx.moveTo(w * 0.44, h * 0.47); ctx.lineTo(w * 0.5, h * 0.6); ctx.lineTo(w * 0.56, h * 0.47); ctx.fill();
      ctx.fillStyle = 'rgba(40,20,10,0.6)';
      ctx.fillRect(w * 0.44, h * 0.31, 22, 6); ctx.fillRect(w * 0.53, h * 0.31, 22, 6);
    } else if (kind === 'photo') {
      // sepia: frontier bar, 1898
      ctx.fillStyle = '#b39a76'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#6f5a40'; ctx.fillRect(30, 110, w - 60, 300);
      ctx.fillStyle = '#4b3b29'; ctx.fillRect(30, 380, w - 60, 40);
      ctx.fillStyle = '#d8c4a0'; ctx.fillRect(70, 140, 120, 160); ctx.fillRect(w - 190, 140, 120, 160);
      ctx.fillStyle = '#3a2d20';
      ctx.font = 'bold 34px serif'; ctx.textAlign = 'center';
      ctx.fillText('NORTHERN ROSE', w / 2, 80);
      for (let i = 0; i < 9; i++) {
        const x = 60 + i * 48 + r() * 10, y = 470;
        ctx.fillStyle = '#2d2318';
        ctx.beginPath(); ctx.arc(x, y - 60, 12, 0, 7); ctx.fill();
        ctx.fillRect(x - 15, y - 48, 30, 90);
        ctx.fillRect(x - 18, y - 76, 36, 8);
      }
      ctx.fillStyle = '#3a2d20'; ctx.font = 'italic 22px serif';
      ctx.fillText('Whitehorse, Y.T. — 1898', w / 2, h - 60);
      const vg = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, 420);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,25,10,0.7)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 40, r);
      return;
    } else if (kind === 'panther') {
      ctx.fillStyle = '#ddd0b6'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1512';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.55, 160, 60, -0.05, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.2, h * 0.45, 45, 38, 0, 0, 7); ctx.fill();
      ctx.fillRect(w * 0.28, h * 0.58, 22, 120); ctx.fillRect(w * 0.42, h * 0.6, 22, 110);
      ctx.fillRect(w * 0.62, h * 0.6, 22, 110); ctx.fillRect(w * 0.76, h * 0.58, 22, 120);
      ctx.lineWidth = 14; ctx.strokeStyle = '#1a1512';
      ctx.beginPath(); ctx.moveTo(w * 0.82, h * 0.5); ctx.quadraticCurveTo(w * 0.98, h * 0.4, w * 0.9, h * 0.25); ctx.stroke();
    } else if (kind === 'river') {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2a2420'); g.addColorStop(1, '#0f0c0a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4c5560';
      ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.45); ctx.quadraticCurveTo(w * 0.7, h * 0.7, w * 0.3, h);
      ctx.lineTo(w * 0.8, h); ctx.quadraticCurveTo(w, h * 0.7, w * 0.5, h * 0.45); ctx.fill();
      ctx.fillStyle = '#100d0b';
      for (let i = 0; i < 40; i++) {
        const x = r() * w, y = h * 0.42 + r() * 40, s = 10 + r() * 20;
        ctx.beginPath(); ctx.moveTo(x, y - s * 2.5); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x - s * 0.5, y); ctx.fill();
      }
      ctx.fillStyle = 'rgba(150,160,150,0.12)';
      ctx.fillRect(0, 0, w, h * 0.3);
    }
    grain(ctx, w, h, 18, r);
    // varnish + craquelure
    ctx.fillStyle = 'rgba(120,70,10,0.18)'; ctx.fillRect(0, 0, w, h);
  });
}

// ------------------------------------------------------------------ window view

export function streetTexture(time = 'night') {
  const night = time === 'night';
  return canvasTexture(`street-${time}`, 1600, 1100, (ctx, w, h) => {
    const r = rng(8);
    const ground = h * 0.74;
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, ground);
    if (night) { g.addColorStop(0, '#03060d'); g.addColorStop(0.7, '#0d1828'); g.addColorStop(1, '#22324a'); }
    else { g.addColorStop(0, '#7d8b9c'); g.addColorStop(0.7, '#aab6c3'); g.addColorStop(1, '#c9d2dc'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // distant hills
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = night ? ['#0b1220', '#101a2b'][k] : ['#8d9aa8', '#9eaab7'][k];
      ctx.beginPath(); ctx.moveTo(0, ground - 260 + k * 60);
      for (let x = 0; x <= w; x += 40) ctx.lineTo(x, ground - 300 + k * 70 + Math.sin(x * 0.004 + k * 2) * 60 + Math.sin(x * 0.013) * 18);
      ctx.lineTo(w, ground); ctx.lineTo(0, ground); ctx.fill();
    }
    // spruce line
    ctx.fillStyle = night ? '#060a10' : '#5d6873';
    for (let i = 0; i < 90; i++) {
      const x = r() * w, y = ground - 140 + r() * 30, s = 10 + r() * 22;
      ctx.beginPath(); ctx.moveTo(x, y - s * 3); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x - s * 0.6, y); ctx.fill();
    }
    // telephone poles + sagging wires
    const poles = [140, 760, 1380];
    ctx.strokeStyle = night ? '#05070b' : '#3a3f46'; ctx.lineWidth = 2;
    for (let i = 0; i < poles.length - 1; i++) for (const off of [0, 14, 28]) {
      ctx.beginPath(); ctx.moveTo(poles[i], 230 + off); ctx.quadraticCurveTo((poles[i] + poles[i + 1]) / 2, 300 + off, poles[i + 1], 230 + off); ctx.stroke();
    }
    for (const x of poles) {
      ctx.fillStyle = night ? '#07090d' : '#3e3a36'; ctx.fillRect(x - 6, 200, 12, ground - 200);
      ctx.fillRect(x - 40, 225, 80, 8);
    }
    // houses
    const house = (x, width, height, opts) => {
      const y = ground - height;
      const wall = night ? opts.wallN : opts.wallD;
      ctx.fillStyle = wall; ctx.fillRect(x, y, width, height);
      // clapboard siding
      ctx.strokeStyle = night ? 'rgba(0,0,0,0.35)' : 'rgba(40,40,50,0.18)'; ctx.lineWidth = 1;
      for (let yy = y + 6; yy < ground; yy += 9) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + width, yy); ctx.stroke(); }
      // corner boards
      ctx.fillStyle = night ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.35)';
      ctx.fillRect(x, y, 8, height); ctx.fillRect(x + width - 8, y, 8, height);
      // roof + thick snow
      const peak = y - height * 0.42;
      ctx.fillStyle = night ? '#0a0d14' : '#40434b';
      ctx.beginPath(); ctx.moveTo(x - 22, y + 6); ctx.lineTo(x + width / 2, peak); ctx.lineTo(x + width + 22, y + 6); ctx.fill();
      ctx.fillStyle = night ? '#c6d2e4' : '#f2f5f8';
      ctx.beginPath(); ctx.moveTo(x - 26, y + 4);
      ctx.lineTo(x + width / 2, peak - 10); ctx.lineTo(x + width + 26, y + 4);
      for (let xx = x + width + 26; xx >= x - 26; xx -= 14) ctx.lineTo(xx, y + 4 + Math.sin(xx * 0.3) * 4 + 7);
      ctx.fill();
      // icicles
      ctx.fillStyle = night ? 'rgba(200,215,235,0.8)' : 'rgba(235,245,255,0.95)';
      for (let xx = x - 18; xx < x + width + 18; xx += 9 + r() * 10) {
        const L = 6 + r() * 22;
        ctx.beginPath(); ctx.moveTo(xx, y + 10); ctx.lineTo(xx + 4, y + 10); ctx.lineTo(xx + 2, y + 10 + L); ctx.fill();
      }
      // chimney + smoke
      if (opts.chimney) {
        const cx = x + width * 0.72;
        ctx.fillStyle = night ? '#120c0a' : '#5a3a30';
        ctx.fillRect(cx, peak + 20, 26, 70);
        ctx.fillStyle = night ? '#c6d2e4' : '#f2f5f8'; ctx.fillRect(cx - 3, peak + 16, 32, 8);
        for (let k = 0; k < 7; k++) {
          ctx.fillStyle = night ? `rgba(150,160,180,${0.12 - k * 0.012})` : `rgba(230,232,236,${0.4 - k * 0.04})`;
          ctx.beginPath(); ctx.arc(cx + 13 + k * 10 + Math.sin(k) * 8, peak + 6 - k * 26, 14 + k * 6, 0, Math.PI * 2); ctx.fill();
        }
      }
      // windows
      const rows = height > 240 ? 2 : 1;
      for (let rr = 0; rr < rows; rr++) for (let c = 0; c < opts.cols; c++) {
        const ww = 46, wh = 58;
        const wx = x + 34 + c * ((width - 68 - ww) / Math.max(1, opts.cols - 1));
        const wy = y + 40 + rr * 120;
        if (opts.door && rr === rows - 1 && c === opts.door) {
          ctx.fillStyle = night ? '#1a0f0a' : '#4a2e22'; ctx.fillRect(wx, ground - 96, 44, 96);
          ctx.fillStyle = night ? '#d8a050' : '#b8c4d0'; ctx.fillRect(wx + 12, ground - 86, 20, 22);
          continue;
        }
        const lit = night && r() < 0.62;
        ctx.fillStyle = night ? '#0a0f18' : '#e8edf2'; ctx.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
        const wg = ctx.createLinearGradient(0, wy, 0, wy + wh);
        if (lit) { wg.addColorStop(0, '#ffcf80'); wg.addColorStop(1, '#c9802e'); }
        else if (night) { wg.addColorStop(0, '#16202e'); wg.addColorStop(1, '#0c121c'); }
        else { wg.addColorStop(0, '#6c7a8a'); wg.addColorStop(1, '#4a5563'); }
        ctx.fillStyle = wg; ctx.fillRect(wx, wy, ww, wh);
        if (lit) {
          ctx.fillStyle = 'rgba(120,40,20,0.55)'; // curtains
          ctx.fillRect(wx, wy, 10, wh); ctx.fillRect(wx + ww - 10, wy, 10, wh);
          if (r() < 0.3) { ctx.fillStyle = 'rgba(40,20,10,0.7)'; ctx.beginPath(); ctx.ellipse(wx + ww / 2, wy + wh - 14, 9, 18, 0, 0, Math.PI * 2); ctx.fill(); }
          const glow = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 4, wx + ww / 2, wy + wh / 2, 90);
          glow.addColorStop(0, 'rgba(255,190,110,0.28)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
          ctx.fillStyle = glow; ctx.fillRect(wx - 90, wy - 90, ww + 180, wh + 180);
        }
        ctx.strokeStyle = night ? '#0a0f18' : '#f0f3f6'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
        ctx.fillStyle = night ? '#bcc8da' : '#f4f7fa'; ctx.fillRect(wx - 7, wy + wh + 4, ww + 14, 6); // snowy sill
      }
      // porch
      if (opts.porch) {
        ctx.fillStyle = night ? '#0c0f16' : '#5a5048';
        ctx.fillRect(x + 10, ground - 112, width * 0.55, 10);
        for (let k = 0; k < 4; k++) ctx.fillRect(x + 14 + k * (width * 0.55 - 12) / 3, ground - 104, 6, 104);
        ctx.fillStyle = night ? '#c6d2e4' : '#f2f5f8'; ctx.fillRect(x + 6, ground - 118, width * 0.55 + 8, 8);
      }
      if (opts.sign) {
        ctx.fillStyle = night ? '#1b120c' : '#3c2a1e'; ctx.fillRect(x + width / 2 - 110, y - 8, 220, 38);
        ctx.strokeStyle = night ? '#a07a3a' : '#c8b080'; ctx.lineWidth = 2; ctx.strokeRect(x + width / 2 - 106, y - 4, 212, 30);
        ctx.fillStyle = night ? '#e8c070' : '#e8dcc0'; ctx.font = 'bold 22px serif'; ctx.textAlign = 'center';
        ctx.fillText(opts.sign, x + width / 2, y + 19);
      }
    };
    house(-30, 300, 300, { wallN: '#141a26', wallD: '#7c6a5c', cols: 3, chimney: true, porch: true, door: 1 });
    house(330, 260, 230, { wallN: '#1a1418', wallD: '#8a4a3e', cols: 2, sign: 'TRADING POST', door: 1 });
    house(640, 340, 320, { wallN: '#121822', wallD: '#5e6f7c', cols: 3, chimney: true, porch: true, door: 2 });
    house(1030, 250, 250, { wallN: '#18151c', wallD: '#9a8a70', cols: 2, chimney: true });
    house(1330, 320, 290, { wallN: '#121822', wallD: '#6e5a50', cols: 3, porch: true, door: 0 });
    // fence
    ctx.fillStyle = night ? '#0a0c10' : '#5a5048';
    for (let x = 0; x < w; x += 22) ctx.fillRect(x, ground - 42, 8, 42);
    ctx.fillRect(0, ground - 34, w, 5); ctx.fillRect(0, ground - 16, w, 5);
    // snowbanks, road, ruts, footprints
    ctx.fillStyle = night ? '#93a4bd' : '#e9eef3'; ctx.fillRect(0, ground - 6, w, h - ground + 6);
    ctx.fillStyle = night ? '#a8b8cf' : '#f6f8fa';
    for (let x = -40; x < w; x += 120) { ctx.beginPath(); ctx.ellipse(x + r() * 40, ground, 90, 22, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = night ? '#6a7a92' : '#c4ccd6'; ctx.fillRect(0, h * 0.86, w, h * 0.07);
    ctx.fillStyle = night ? 'rgba(40,50,70,0.5)' : 'rgba(120,130,145,0.5)';
    ctx.fillRect(0, h * 0.875, w, 6); ctx.fillRect(0, h * 0.905, w, 6);
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.ellipse(200 + i * 30 + Math.sin(i) * 10, h * 0.8 + (i % 2) * 10, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    // snowed-in pickup truck
    const tx = 980, ty = h * 0.84;
    ctx.fillStyle = night ? '#1a1414' : '#5a2a24';
    ctx.fillRect(tx, ty - 60, 230, 50); ctx.fillRect(tx + 40, ty - 105, 100, 50);
    ctx.fillStyle = night ? '#28384e' : '#8aa0b4'; ctx.fillRect(tx + 52, ty - 98, 76, 34);
    ctx.fillStyle = night ? '#c6d2e4' : '#f4f7fa';
    ctx.beginPath(); ctx.ellipse(tx + 90, ty - 106, 58, 10, 0, 0, Math.PI * 2); ctx.ellipse(tx + 190, ty - 62, 46, 9, 0, 0, Math.PI * 2); ctx.ellipse(tx + 20, ty - 62, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#050505';
    ctx.beginPath(); ctx.arc(tx + 45, ty - 8, 20, 0, Math.PI * 2); ctx.arc(tx + 185, ty - 8, 20, 0, Math.PI * 2); ctx.fill();
    // street lamp
    const lx = w * 0.56;
    ctx.fillStyle = night ? '#05070a' : '#2a2c30'; ctx.fillRect(lx, h * 0.26, 9, ground - h * 0.26 + 10);
    ctx.fillRect(lx - 30, h * 0.26, 60, 7);
    if (night) {
      const lg = ctx.createRadialGradient(lx + 4, h * 0.27, 4, lx + 4, h * 0.27, 260);
      lg.addColorStop(0, 'rgba(255,220,170,0.95)'); lg.addColorStop(0.08, 'rgba(255,190,120,0.5)'); lg.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
      const pool = ctx.createRadialGradient(lx, h * 0.86, 10, lx, h * 0.86, 260);
      pool.addColorStop(0, 'rgba(255,200,140,0.35)'); pool.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = pool; ctx.fillRect(0, h * 0.6, w, h * 0.4);
    } else {
      // morning frost haze
      const fog = ctx.createLinearGradient(0, h * 0.3, 0, h);
      fog.addColorStop(0, 'rgba(220,228,236,0)'); fog.addColorStop(1, 'rgba(220,228,236,0.35)');
      ctx.fillStyle = fog; ctx.fillRect(0, 0, w, h);
    }
    // static falling snow layer
    ctx.fillStyle = night ? 'rgba(230,240,255,0.55)' : 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 700; i++) { const sz = r() < 0.15 ? 3 : 1.6; ctx.fillRect(r() * w, r() * h, sz, sz + r() * 2); }
  });
}

// ------------------------------------------------------------------ misc

export function glowTexture() {
  return canvasTexture('glow', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { color: false });
}

export function beamTexture() {
  return canvasTexture('beam', 64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.0)');
    g.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const s = ctx.createLinearGradient(0, 0, w, 0);
    s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.5, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
  }, { color: false });
}

export function labelTexture() {
  return canvasTexture('labels', 256, 256, (ctx, w, h) => {
    const r = rng(77);
    const cols = ['#d8c8a0', '#1b1b1b', '#7a1a1a', '#e0d8c8', '#c49a4a', '#203040', '#f0e6d0', '#3a2a1a'];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      ctx.fillRect(x * 64, y * 64, 64, 64);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x * 64 + 8, y * 64 + 24, 48, 4);
      ctx.fillRect(x * 64 + 14, y * 64 + 34, 36, 3);
    }
  });
}

export function newspaperTexture() {
  return canvasTexture('newspaper', 512, 384, (ctx, w, h) => {
    const r = rng(12);
    ctx.fillStyle = '#d9d0bc'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d1a16';
    ctx.font = 'bold 40px serif'; ctx.textAlign = 'center';
    ctx.fillText('THE YUKON LEDGER', w / 2, 52);
    ctx.fillRect(20, 64, w - 40, 3);
    ctx.font = 'bold 30px serif';
    ctx.fillText('WOLVES BLAMED FOR', w / 2, 110);
    ctx.fillText('VALLEY CARCASSES', w / 2, 144);
    for (let c = 0; c < 3; c++) for (let l = 0; l < 14; l++) {
      ctx.fillStyle = 'rgba(30,26,22,0.55)';
      ctx.fillRect(24 + c * 160, 170 + l * 14, 140 - r() * 30, 5);
    }
    grain(ctx, w, h, 18, r);
  });
}
