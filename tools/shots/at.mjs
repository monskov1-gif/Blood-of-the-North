// usage: node at.mjs <stage> <out> <x> <z> [evalJS]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PWPATH);
const [stage, out, x, z, extra = '', w = '1280', h = '760'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8765/?quality=low');
await p.waitForFunction(() => window.__game && window.__game.atlas, null, { timeout: 120000 });
await p.waitForTimeout(800); await p.mouse.click(5, 5); await p.waitForTimeout(600);
await p.evaluate((stage) => {
  localStorage.setItem('botn.save.1', JSON.stringify({ version: 1, time: Date.now(), state: { stage, flags: {}, sceneId: 'hospital', interacted: [], choices: [] }, story: {} }));
  window.__game.loadSlot('1');
}, stage);
for (let i = 0; i < 160; i++) {
  const ok = await p.evaluate(() => window.__game.player?.enabled && !window.__game.dialogue?.busy);
  if (ok) break;
  await p.keyboard.press('Enter'); await p.waitForTimeout(350);
}
await p.evaluate(([x, z, extra]) => {
  const g = window.__game; const J = g.story.julian;
  if (!g.player.enabled) console.error('NOT-READY'); g.cameraSys.setShot(null, 0); J.root.position.y = 0; J.placeAt(+x, +z, 1); g.cameraSys.snap();
  if (extra) (new Function('g', 'J', extra))(g, J);
}, [x, z, extra]);
await p.waitForTimeout(+(process.env.WAIT || 2500));
await p.screenshot({ path: out });
console.log(errs.slice(0, 8).join('\n'));
await b.close();
