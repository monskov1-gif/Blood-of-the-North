// node tools/shots/anim.mjs <out.png> <mode idle|walk> <phases comma> [flags: skel,ref,px,light]
// renders the rig viewer at fixed walk phases side by side
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PWPATH);
const [out, mode, phases = '0', flags = ''] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const p = await b.newPage({ viewport: { width: +(process.env.VW || 420), height: +(process.env.VH || 640) } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:8765/tools/anim/index.html');
await p.waitForFunction(() => window.__rig, null, { timeout: 30000 });
await p.evaluate((f) => { for (const k of f.split(',').filter(Boolean)) window.__S[k] = true; }, flags);
const shots = [];
for (const ph of phases.split(',').map(Number)) {
  await p.evaluate(([mode, ph]) => {
    const r = window.__rig; r.mode = mode; r.blend = mode === 'walk' ? 1 : 0; r.phase = ph; window.__fixedDt = 0;
    // settle the springs at this phase: run the cycle up to it
    if (mode === 'walk') { window.__fixedDt = null; r.phase = (ph + 0.0) % 1; }
  }, [mode, ph]);
  if (mode === 'walk') {
    // advance through one full cycle ending at ph so secondary motion is warmed up
    await p.evaluate((ph) => { const r = window.__rig; r.phase = (ph - 0.999 + 1) % 1; for (let i = 0; i < 120; i++) { r.solve(1 / 120 * 1.12); } window.__fixedDt = 0; }, ph);
  } else {
    await p.evaluate(() => { window.__fixedDt = 0; });
  }
  await p.waitForTimeout(150);
  shots.push(await p.screenshot());
}
const { PNG } = await (async () => ({ PNG: null }))();
const fs = require('fs');
// write individual frames; caller stitches
shots.forEach((s, i) => fs.writeFileSync(out.replace(/\.png$/, `_${i}.png`), s));
console.log(errs.join('\n'));
await b.close();
