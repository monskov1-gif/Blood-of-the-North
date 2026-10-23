---
name: furniture-kit
description: Build three.js interiors from furniture and props (sofas, beds, tables, shelves, lamps, books, plants, candles, windows, doors) with batched, bevelled, pixel-textured geometry and a day/evening/night lamp-state system, then verify every visual change with a 0–10 screenshot critic loop. Use when asked to furnish or dress a 3D room/location, add furniture or props, set up lamps and day/night lighting, or judge how a scene looks.
---

# Furniture kit — interiors from furniture, checked by critics

Files in this folder:

| file | what |
|---|---|
| `furniture-kit.js` | the kit: a standalone ES module, depends only on `three` (r150+) |
| `example-room.js` | demo: living corner + sleeping nook built with the kit (read it first — it is the style guide in code) |
| `preview.html` | preview and screenshot bench (URL params: state, cam, look, low, pixel) |
| `shoot.mjs` | Playwright screenshots for the critic loop |
| `critics.md` | the critic loop: prompt template, scoring, how to shoot, lessons learned |

The kit builds **objects, not rooms**. Walls, floors and ceilings belong to the host project. A
floor plane and one backdrop plane in the example exist only so screenshots have a stage.

## Install into a project

1. Copy `furniture-kit.js` into the project (e.g. `src/world/furniture-kit.js`). If the project
   resolves three another way, change only the first `import`.
2. In a scene/location build:

```js
import { FurnitureKit, TEX } from './furniture-kit.js';
const kit = new FurnitureKit(group, { low: isWeakGPU });   // group = scene root for this location
kit.setupLights();                    // skip it if the project has its own ambient; lamps still work
kit.sofa(-2, BACK, 0);                // builders take (x, z, ry, options)
kit.withT(1, BACK, 0, () => { /* free-form pieces in a local frame */ });
kit.flushBatches();                   // ALWAYS last: merges everything per material + fixes normals
kit.setState('evening');              // 'evening' | 'night' | 'day' (add your own in `ambient`)
// in the render loop: kit.update(dt);   scene.background = new THREE.Color(kit.background)
```

## Coordinates and camera

- Metres, y up, floor at y = 0.
- A piece's local frame (inside `withT(x, z, ry, fn)`) has its **back at z = 0** (against the wall)
  and its **front toward +z**. `ry` turns the whole piece. Frames nest. `kit.P(x, y, z)` converts a
  local point to world (lights and sprites need world positions; the kit's `pointLight`/`halo`/
  `statePool` already call it).
- The kit was made for a side-on "dollhouse" camera: x along the set, camera on +z, the near wall
  cut away. It works with any camera, but anything seen only from the front can stay cheap at the back.

## API (the parts you will use)

**Primitives** (batched; signature `(…size, mat, x, y, z, o)`; `o` = `{ sx, sy, sz, rx, ry, rz, order, uv: [su, sv] }`):
`rb(w,h,d,r)` rounded box — the default for anything boxy · `bx(w,h,d)` auto-bevelled box ·
`cush(w,h,d,r, …, {puff, seed, lump})` cushion/mattress/pillow · `drape(L,W,drop, …, {sides:[-x,+x,-z,+z], seed, wrinkle, r, uv})` fabric over a box top (duvets, throws, tablecloths, a jacket on a chair) ·
`lathe([[r,y]…])` pots, lamps, vases, legs · `cy(rt,rb,h)` · `sph(r)` · `torus(R,r)` ·
`rod(a,b,r)` between two points · `tube(pts,r)` cables · `pl(w,h)` flat pictures/screens/paper only.

**Materials** (cached by key; reuse keys, don't create one material per object):
`M(key, color, o)` · `texM(key, texture, o)` · `glowM(key, color, emissive)` (lamp shades — the lamp
drives its emissive) · `glass()` · `brass()` · `white()`. `low: true` → Lambert everywhere.

**Textures** `TEX.*` (canvas, nearest, 1 texel ≈ 1 cm): planks, paint(key,[r,g,b]), terracotta,
redTile, oak(0|1|2), darkWood, stained, blinds, stripes, ticking, shag, carpet, jute, plaid(0|1),
quilt, coir, paper(0|1|2), leaf('palm'|'pothos'), mirror, roman(color), art(k). New ones: write a
`TX(key, w, h, (ctx, w, h) => …)` with a seeded `rng(seed)`, sized at 1 px per cm of the surface.

**Lamps and states**: `lamp(id, { light, glows, mats: [[mat, k]], on: { evening, night, day } })`,
`setLamp(id, level | null)` for story overrides, `statePool(color, x,y,z, w,d, opacity, states)` for
fake bounce light, `candle(id, …)`, `fairyLights(id, pts, n)`, `torchiere(id, …)`, `tableLamp(id, …)`.

**Props**: `book`, `bookRow(x0,y,z,n,seed,maxW,d)`, `bookStack(x,y,z,n,seed)` (returns top y), `mug`,
`plant(x,y,z,scale,'palm'|'pothos',potColor)`, `framed(texture,w,h,x,y,z,frameColor,matWidth)`,
`turnedLeg`, `windowUnit(w,y0,y1,{kind,blind:{kind:'slats'|'roman'|'cell',cover}})`,
`panelDoor(w,h,color,{glassTop})` — the last two sit in a wall at local z = 0; the hole is yours.

**Builders** — recipes, `(x, z, ry, options)`; several return the top surface y so props can sit on
it: `rug`, `sofa`, `coffeeTable`, `bookcase`, `nightstand`, `bed`, `dresser`, `desk`, `chair`,
`tvUnit`. To make a new piece, copy the closest builder and edit it; don't grow options forever.

## Rules (each one was learned from a failed critic round)

1. **No raw primitives.** Nothing with razor edges: `rb`/`bx`/`cush` for boxes, ≥ 16×12 segments for
   spheres, ≥ 16 for cylinders. A box sofa or a cylinder log always reads as "a pipe / a block".
2. **Soft things are soft**: cushions puff, fabric drapes with folds, pillows tilt (`rx`, `rz`), a
   throw spills over an edge. Vary `seed` so repeated cushions differ.
3. **Never mutate cached geometry.** `cached()`/`bevelBox()` return clones; if you add your own
   caches, clone too — batching translates geometry in place.
4. **No coplanar surfaces.** A picture, screen, label or paper sits ≥ 1–2 mm in front of the surface
   it lies on (more for large planes / far cameras). z-fighting is the first thing critics see.
5. **Planes only for genuinely flat things** and never edge-on to the camera — an edge-on plane reads
   as a strip. Give shelves, boards and doors thickness.
6. **Pixel register**: canvas textures at 1 texel ≈ 1 cm with nearest filtering; no smooth "photoshop"
   gradients except light (glows, mirrors). The same texture on every surface of a room looks fake:
   vary tone/seed per room (`oak(0|1|2)`, `planks(tone)`).
7. **Normals**: zero/NaN normals become black blocks under bloom. `flushBatches()` runs
   `sanitizeNormals`; keep lathe profiles off the axis (the kit clamps r ≥ 0.8 mm) and run
   `sanitizeNormals(root)` yourself over meshes you add outside the kit.
8. **Batch static, separate dynamic.** Everything static goes through the kit and becomes one mesh
   per material. Things that animate, move or toggle (doors that open, flames) are their own meshes.
9. **Light never clips to white.** Halos 0.1–0.4 opacity, lamp shade emissive ≈ 0.4–1.4, window views
   ≤ #E4DCCC. Night is dark and quiet but readable: one or two warm lamps, cold fill, warm pools.
10. **Dress for a story.** A room is believable when it shows a life: a mug left on the desk, a
    jacket on the chair, a stack of books by the bed, a candle, a plant. Cluster props on surfaces
    (use the returned top y), leave walking space clear.
11. **Every visual change goes through the critic loop** in `critics.md` — screenshot, score 0–10,
    redo while any score is below 6 (target 7). Report scores "before → after".

## Performance

One draw call per material after `flushBatches()`; reuse material keys. Use `{ low: true }` for
software GL (CI screenshots via swiftshader) and weak mobile GPUs. Instanced meshes for repeated
small lights (`fairyLights`). Keep canvas textures small (32–128 px).
