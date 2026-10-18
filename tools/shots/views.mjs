import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PWPATH);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8765/?quality=low');
await p.waitForFunction(() => window.__game && window.__game.atlas, null, { timeout: 120000 });
const out = await p.evaluate(async (list) => {
  const T = await import('/src/render/textures.js');
  const res = {};
  for (const [time, view] of list) {
    const t = T.streetTexture(time, view);
    res[`${view}-${time}`] = t.image.toDataURL('image/png');
  }
  return res;
}, JSON.parse(process.argv[3]));
for (const [k, v] of Object.entries(out)) fs.writeFileSync(`${process.argv[2]}/view-${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
console.log(Object.keys(out).join(' '), errs.join('\n'));
await b.close();
