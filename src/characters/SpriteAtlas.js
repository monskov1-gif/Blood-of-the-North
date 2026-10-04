import * as THREE from 'three';

/** Loads the character atlas (PNG + JSON frame table). */
export class SpriteAtlas {
  async load(base = 'assets/sprites/characters') {
    const [meta, tex] = await Promise.all([
      fetch(`${base}.json`).then((r) => r.json()),
      new THREE.TextureLoader().loadAsync(`${base}.png`),
    ]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    this.texture = tex;
    this.size = meta.size;
    this.frames = meta.frames;
    return this;
  }

  has(name) { return name in this.frames; }

  frame(name) {
    const f = this.frames[name];
    if (!f) throw new Error(`[atlas] missing frame ${name}`);
    return f;
  }
}
