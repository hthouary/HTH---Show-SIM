import * as THREE from 'three';
import type { BurstState, ShowState } from '../../utils/events';

/**
 * Lightweight CPU-driven particle system. Positions and per-particle alpha are
 * written from JS each frame; a small ShaderMaterial draws soft round points
 * with per-particle color/size/alpha. Shared by smoke / flame / CO2 / confetti.
 */
export interface ParticleSystem {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  positions: Float32Array;
  alphas: Float32Array;
  colors: Float32Array;
  seeds: Float32Array;
  count: number;
}

const VERT = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d);
    if (r > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vColor, vAlpha * falloff);
  }
`;

export function makeParticles(count: number, additive = false): ParticleSystem {
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
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
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  // Generous bounding sphere so the GPU never frustum-culls an active burst.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 40);

  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 320 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  return { geometry, material, positions, alphas, colors, seeds, count };
}

/** Resolve the active burst for a given emitter id (falls back to "all"). */
export function burstFor(
  bucket: Record<string, BurstState>,
  id: string,
): BurstState | undefined {
  return bucket[id] ?? bucket['all'];
}

export function disposeParticles(p: ParticleSystem) {
  p.geometry.dispose();
  p.material.dispose();
}

export type { ShowState };
