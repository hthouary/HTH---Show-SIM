import * as THREE from 'three';

/**
 * Procedurally generated sprite textures (built once on a canvas and cached).
 * Used to give the particle effects soft, wispy edges instead of hard circles.
 */

let smokeTex: THREE.Texture | null = null;
let glowTex: THREE.Texture | null = null;
let concreteTex: THREE.Texture | null = null;
let deckTex: THREE.Texture | null = null;
let grillTex: THREE.Texture | null = null;

/** Simple seeded value-noise → fractal brownian motion for wispy smoke. */
function buildValueNoise(grid: number) {
  const rnd: number[] = [];
  for (let i = 0; i < (grid + 1) * (grid + 1); i++) rnd.push(Math.random());
  const at = (x: number, y: number) => rnd[(y % (grid + 1)) * (grid + 1) + (x % (grid + 1))];
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };
  return (x: number, y: number) => {
    let sum = 0;
    let amp = 0.6;
    let freq = 1;
    for (let o = 0; o < 4; o++) {
      sum += amp * noise(x * freq, y * freq);
      freq *= 2;
      amp *= 0.5;
    }
    return sum;
  };
}

/** Soft, irregular smoke puff (white, alpha-only). */
export function getSmokeTexture(): THREE.Texture {
  if (smokeTex) return smokeTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const fbm = buildValueNoise(8);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2; // 0 center → 1 edge
      let radial = 1 - r;
      radial = Math.max(0, radial);
      radial = radial * radial; // softer falloff
      const n = fbm(nx * 5, ny * 5); // ~0..1.1
      let a = radial * (0.35 + 0.75 * n);
      a = Math.max(0, Math.min(1, a));
      const idx = (y * size + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 255;
      img.data[idx + 2] = 255;
      img.data[idx + 3] = Math.floor(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  smokeTex = tex;
  return tex;
}

/** Mottled grey concrete for the ground (tiling canvas texture, cached). */
export function getConcreteTexture(): THREE.Texture {
  if (concreteTex) return concreteTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const fbm = buildValueNoise(8);
  const fine = buildValueNoise(16);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      // Broad tonal variation + fine speckle → weathered concrete.
      const broad = fbm(nx * 4, ny * 4);
      const speck = fine(nx * 24, ny * 24);
      let v = 0.54 + (broad - 0.5) * 0.16 + (speck - 0.5) * 0.09;
      v = Math.max(0.36, Math.min(0.74, v));
      const idx = (y * size + x) * 4;
      // Slightly cool grey (a touch of blue).
      img.data[idx] = Math.floor(v * 246);
      img.data[idx + 1] = Math.floor(v * 250);
      img.data[idx + 2] = Math.floor(v * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(48, 48);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  concreteTex = tex;
  return tex;
}

/** Dark anti-slip stage decking: plywood grain + panel seams (tiling). */
export function getDeckTexture(): THREE.Texture {
  if (deckTex) return deckTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const fbm = buildValueNoise(10);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      // Streaky grain along X (like phenolic plywood) + soft blotches.
      const grain = fbm(nx * 22, ny * 3.5);
      const blotch = fbm(nx * 4 + 7, ny * 4 + 7);
      let v = 0.16 + (grain - 0.5) * 0.05 + (blotch - 0.5) * 0.045;
      // Panel seams every half tile.
      if (x % 128 < 2 || y % 128 < 2) v -= 0.05;
      v = Math.max(0.08, Math.min(0.26, v));
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.floor(v * 255);
      img.data[idx + 1] = Math.floor(v * 248);
      img.data[idx + 2] = Math.floor(v * 238);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  deckTex = tex;
  return tex;
}

/** Perforated speaker-grill cloth: dark base with a dot lattice (tiling). */
export function getGrillTexture(): THREE.Texture {
  if (grillTex) return grillTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#141619';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#04050a';
  const step = 8;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const ox = (Math.floor(y / step) % 2) * (step / 2); // staggered rows
      ctx.beginPath();
      ctx.arc(x + ox + step / 2, y + step / 2, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  grillTex = tex;
  return tex;
}

/** Smooth round glow (white core → transparent) for flame / CO2 / cryo. */
export function getGlowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowTex = tex;
  return tex;
}
