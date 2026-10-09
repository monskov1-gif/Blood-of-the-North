/** Final grading + all screen-space effects (normal look and hallucinations). */
export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: [1, 1] },
    uGrain: { value: 0.06 },
    uVignette: { value: 0.45 },
    uCA: { value: 0.0 },
    uBlur: { value: 0.0 },
    uExposure: { value: 1.0 },
    uDistort: { value: 0.0 },
    uSaturation: { value: 0.92 },
    uTint: { value: [1.04, 0.98, 0.92] },
    uLift: { value: [0.012, 0.006, 0.008] },
    uGhost: { value: 0.0 },
    uWave: { value: 0.0 },
    uFade: { value: 0.0 },
    uScan: { value: 0.0 },
    uRedPulse: { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uCA, uBlur, uExposure, uDistort, uSaturation;
    uniform float uGhost, uWave, uFade, uScan, uRedPulse;
    uniform vec2 uRes;
    uniform vec3 uTint, uLift;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    vec3 sampleCA(vec2 uv, float ca) {
      vec2 dir = (uv - 0.5);
      float r = texture2D(tDiffuse, uv + dir * ca).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * ca).b;
      return vec3(r, g, b);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      // lens distortion (barrel, breathing)
      float r2 = dot(c, c);
      uv = 0.5 + c * (1.0 + uDistort * r2 * (1.0 + 0.3 * sin(uTime * 0.7)));
      // slow liquid wave
      uv.x += uWave * 0.006 * sin(uv.y * 18.0 + uTime * 1.3);
      uv.y += uWave * 0.004 * sin(uv.x * 14.0 - uTime * 1.1);

      float ca = uCA * (0.004 + 0.006 * r2 * 4.0);
      vec3 col = sampleCA(uv, ca);

      // cheap radial blur, stronger at the edges
      if (uBlur > 0.001) {
        vec3 acc = col;
        float amt = uBlur * (0.004 + r2 * 0.03);
        for (int i = 1; i <= 6; i++) {
          float fi = float(i);
          vec2 o = c * amt * fi;
          acc += sampleCA(uv - o, ca);
          acc += texture2D(tDiffuse, uv + vec2(o.y, -o.x) * 0.5).rgb;
        }
        col = acc / 13.0;
      }

      // double vision
      if (uGhost > 0.001) {
        vec2 go = vec2(0.012 * sin(uTime * 0.9), 0.004 * cos(uTime * 0.6)) * uGhost;
        col = mix(col, sampleCA(uv + go, ca), 0.4 * uGhost);
      }

      // grade
      col *= uExposure;
      col = col * uTint + uLift;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSaturation);
      col = mix(col, col * vec3(1.35, 0.55, 0.55) + vec3(0.04, 0.0, 0.0), uRedPulse);

      // vignette
      float v = smoothstep(0.85, 0.2, length(c * vec2(1.0, 0.85)) * (1.0 + uVignette * 0.6));
      col *= mix(1.0, v, uVignette);

      // scanlines (subtle CRT/film), grain
      col *= 1.0 - uScan * 0.08 * (0.5 + 0.5 * sin(vUv.y * uRes.y * 1.6));
      float n = hash(vUv * uRes + fract(uTime) * 100.0) - 0.5;
      col += n * uGrain;

      col *= 1.0 - uFade;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

/** Generalized Kuwahara filter → painted look for the dialogue backgrounds. */
export const PaintShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: [1, 1] },
    uRadius: { value: 5 },
  },
  vertexShader: FinalShader.vertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uRadius;
    varying vec2 vUv;
    void main() {
      vec2 px = 1.0 / uRes;
      vec3 m[4]; vec3 s[4];
      for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
      const int R = 5;
      for (int j = -R; j <= R; j++) {
        for (int i = -R; i <= R; i++) {
          vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * px * (uRadius / 5.0)).rgb;
          vec3 c2 = c * c;
          if (i <= 0 && j <= 0) { m[0] += c; s[0] += c2; }
          if (i >= 0 && j <= 0) { m[1] += c; s[1] += c2; }
          if (i <= 0 && j >= 0) { m[2] += c; s[2] += c2; }
          if (i >= 0 && j >= 0) { m[3] += c; s[3] += c2; }
        }
      }
      float n = float((R + 1) * (R + 1));
      float minSigma = 1e9; vec3 outc = vec3(0.0);
      for (int k = 0; k < 4; k++) {
        vec3 mean = m[k] / n;
        vec3 v = abs(s[k] / n - mean * mean);
        float sigma = v.r + v.g + v.b;
        if (sigma < minSigma) { minSigma = sigma; outc = mean; }
      }
      gl_FragColor = vec4(outc, 1.0);
    }
  `,
};
