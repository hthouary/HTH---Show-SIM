import * as THREE from 'three';
import type { BurstState, ShowState } from '../../utils/events';

/**
 * Lightweight CPU-driven particle system. Positions, per-particle alpha, color
 * and rotation are written from JS each frame; a small ShaderMaterial draws the
 * points as soft, optionally-textured, rotatable sprites. Shared by the FX.
 */
export interface ParticleSystem {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  positions: Float32Array;
  alphas: Float32Array;
  colors: Float32Array;
  angles: Float32Array;
  seeds: Float32Array;
  count: number;
}

export interface ParticleOptions {
  additive?: boolean;
  /** Sprite texture (alpha used as mask). When absent, a procedural shape is drawn. */
  texture?: THREE.Texture | null;
  /** Procedural shape when no texture: 'circle' (default) or 'square' (confetti). */
  shape?: 'circle' | 'square';
}

const VERT = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  attribute float aAngle;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying float vAngle;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vAngle = aAngle;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform sampler2D uTex;
  uniform int uMode; // 0 circle, 1 square, 2 texture
  varying float vAlpha;
  varying float vAngle;
  varying vec3 vColor;
  void main() {
    // Rotate the point coordinate around its centre.
    vec2 p = gl_PointCoord - vec2(0.5);
    float s = sin(vAngle);
    float c = cos(vAngle);
    vec2 uv = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float mask;
    if (uMode == 2) {
      mask = texture2D(uTex, uv + vec2(0.5)).a;
    } else if (uMode == 1) {
      vec2 a = abs(uv);
      mask = step(max(a.x, a.y), 0.42);
    } else {
      mask = smoothstep(0.5, 0.0, length(uv));
    }
    float alpha = vAlpha * mask;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export function makeParticles(count: number, opts: ParticleOptions = {}): ParticleSystem {
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const angles = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    seeds[i] = Math.random();
    sizes[i] = 60;
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 1;
    colors[i * 3 + 2] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 40);

  const mode = opts.texture ? 2 : opts.shape === 'square' ? 1 : 0;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 320 },
      uTex: { value: opts.texture ?? null },
      uMode: { value: mode },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  return { geometry, material, positions, alphas, colors, angles, seeds, count };
}

/** Resolve the active burst for a given emitter id (falls back to "all"). */
export function burstFor(bucket: Record<string, BurstState>, id: string): BurstState | undefined {
  return bucket[id] ?? bucket['all'];
}

export function disposeParticles(p: ParticleSystem) {
  p.geometry.dispose();
  p.material.dispose();
}

export type { ShowState };
