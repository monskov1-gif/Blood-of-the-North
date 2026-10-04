import { Game } from './core/Game.js';

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
