import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PWPATH);
const [stage, out, times, w = '1280', h = '760'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
await p.goto('http://localhost:8765/?quality=low');
await p.waitForFunction(() => window.__game && window.__game.atlas, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.waitForTimeout(800); await p.mouse.click(5, 5); await p.waitForTimeout(600);
await p.evaluate((stage) => {
  localStorage.setItem('botn.save.1', JSON.stringify({ version: 1, time: Date.now(), state: { stage, flags: {}, sceneId: 'hospital', interacted: [], choices: [] }, story: {} }));
  window.__game.loadSlot('1');
}, stage);
let t0 = 0;
for (const t of times.split(',').map(Number)) {
  await p.waitForTimeout((t - t0) * 1000); t0 = t;
  await p.screenshot({ path: `${out}_${t}.png` });
}
console.log(logs.slice(0, 15).join('\n'));
await b.close();
