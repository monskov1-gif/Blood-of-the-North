import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FinalShader, PaintShader } from './shaders.js';

/**
 * Owns the WebGL renderer, the post chain and the "look" parameters.
 * `look` holds base values; effect systems push offsets via `addLayer`,
 * so the hallucination never has to know the base grade and vice versa.
 */
export class Renderer {
  constructor(canvas, settings, bus) {
    this.canvas = canvas;
    this.settings = settings;
    this.bus = bus;
    this.quality = this.resolveQuality();
    const r = this.gl = new THREE.WebGLRenderer({
      canvas, antialias: this.quality === 'high', powerPreference: 'high-performance', stencil: false,
    });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = false;

    this.base = {
      grain: 0.055, vignette: 0.5, ca: 0.0, blur: 0, exposure: 1, distort: 0, saturation: 0.9,
      ghost: 0, wave: 0, fade: 0, scan: 0.25, redPulse: 0, bloom: 0.55,
    };
    this.layers = new Map();
    this.time = 0;
    bus.on('settings', ({ key }) => { if (key === 'quality') location.reload(); });
  }

  resolveQuality() {
    const forced = new URLSearchParams(location.search).get('quality');
    if (forced === 'low' || forced === 'high') return forced;
    const q = this.settings.get('quality');
    if (q !== 'auto') return q;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(screen.width, screen.height) < 820;
    return coarse || small ? 'low' : 'high';
  }

  get isLow() { return this.quality === 'low'; }

  setup(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const composer = this.composer = new EffectComposer(this.gl);
    composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.78);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    composer.addPass(this.final);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.isLow ? 1.25 : 1.75);
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    this.composer?.setPixelRatio(dpr);
    this.composer?.setSize(w, h);
    if (this.final) this.final.uniforms.uRes.value = [w * dpr, h * dpr];
    this.bus.emit('resize', { w, h });
  }

  /** layer: object with any subset of base keys as additive offsets. */
  setLayer(name, values) { this.layers.set(name, values); }
  clearLayer(name) { this.layers.delete(name); }

  compose() {
    const out = { ...this.base };
    for (const l of this.layers.values()) for (const k in l) out[k] = (out[k] ?? 0) + l[k];
    const fx = this.settings.get('effects');
    // accessibility: effects slider scales the disturbing parts only
    for (const k of ['ca', 'blur', 'distort', 'ghost', 'wave', 'redPulse']) out[k] *= fx;
    return out;
  }

  render(dt) {
    this.time += dt;
    const p = this.compose();
    const u = this.final.uniforms;
    u.uTime.value = this.time;
    u.uGrain.value = p.grain;
    u.uVignette.value = p.vignette;
    u.uCA.value = p.ca;
    u.uBlur.value = p.blur;
    u.uExposure.value = p.exposure;
    u.uDistort.value = p.distort;
    u.uSaturation.value = p.saturation;
    u.uGhost.value = p.ghost;
    u.uWave.value = p.wave;
    u.uFade.value = Math.min(1, Math.max(0, p.fade));
    u.uScan.value = p.scan;
    u.uRedPulse.value = p.redPulse;
    this.bloom.strength = p.bloom;
    this.composer.render(dt);
  }

  /**
   * Renders a camera shot of the scene through a Kuwahara "paint" filter and
   * returns a canvas — used as hand-painted-looking dialogue backgrounds.
   */
  paintShot(camera, width = 1600, height = 900, { radius = 5, hide = [] } = {}) {
    const gl = this.gl;
    const hidden = hide.filter((o) => o.visible);
    hidden.forEach((o) => { o.visible = false; });
    const prevTarget = gl.getRenderTarget();
    const comp = new EffectComposer(gl, new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType }));
    comp.setPixelRatio(1);
    comp.setSize(width, height);
    comp.renderToScreen = false;
    comp.addPass(new RenderPass(this.scene, camera));
    comp.addPass(new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.7, 0.6, 0.72));
    const paint = new ShaderPass(PaintShader);
    paint.uniforms.uRes.value = [width, height];
    paint.uniforms.uRadius.value = radius;
    comp.addPass(paint);
    comp.render(0);
    // tone map + sRGB into an 8-bit target we can read back
    const out = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType });
    const outputPass = new OutputPass();
    outputPass.renderToScreen = false;
    outputPass.render(gl, out, comp.readBuffer);
    const pixels = new Uint8Array(width * height * 4);
    gl.readRenderTargetPixels(out, 0, 0, width, height, pixels);
    gl.setRenderTarget(prevTarget);
    hidden.forEach((o) => { o.visible = true; });
    comp.dispose(); out.dispose(); outputPass.dispose();

    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(width, height);
    // flip Y
    for (let y = 0; y < height; y++) {
      const src = (height - 1 - y) * width * 4;
      img.data.set(pixels.subarray(src, src + width * 4), y * width * 4);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}
