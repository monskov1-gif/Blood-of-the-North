import { Game } from './core/Game.js';

/**
 * iPhone / iPad: Safari ignores `user-scalable=no`, so a quick double tap zoomed the page and
 * there was no way back. Double taps and pinch gestures are swallowed here, and if the page
 * still ends up zoomed (e.g. after rotating) the viewport is reset to 1×.
 */
function lockZoom() {
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    if (now - lastTouch < 350 && !e.target.closest?.('input, textarea, select')) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  const meta = document.querySelector('meta[name=viewport]');
  const reset = () => {
    if (!window.visualViewport || window.visualViewport.scale <= 1.01) return;
    const c = meta.content;
    meta.content = c.replace('maximum-scale=1', 'maximum-scale=1.0001');
    requestAnimationFrame(() => { meta.content = c; });
  };
  window.visualViewport?.addEventListener('resize', reset);
  window.addEventListener('orientationchange', () => setTimeout(reset, 300));
}
lockZoom();

function fail(msg) {
  const boot = document.getElementById('boot');
  if (boot) boot.querySelector('.boot-note').textContent = msg;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

if (!webglAvailable()) {
  fail('Браузер не поддерживает WebGL — игра не может запуститься.');
} else {
  const game = new Game();
  window.__game = game; // handy for debugging from the console
  game.boot().catch((e) => {
    console.error(e);
    fail('Ошибка загрузки: ' + e.message);
  });
}
