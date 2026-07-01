import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor } from './particles';
import { ignoreRaycast } from './interaction';
import { EmitterBody } from './props';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Procedural fire jet: thin at the nozzle, a slight bulge low, then a long thin
// taper to the tip. It ignites from the base upward and, when extinguishing,
// the base cuts off first while the remaining licks rise and fade at the tip.
const FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uProgress; // 0..1 over the burst
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ s += a * noise(p); p *= 2.0; a *= 0.5; }
    return s;
  }

  void main(){
    vec2 uv = vUv;
    float y = uv.y;
    float t = uTime;
    // Noise scrolls upward → flame visually travels from base to tip.
    vec2 q = vec2(uv.x * 2.4, y * 2.8 - t * 2.1);
    float n = fbm(q + fbm(q * 1.7));

    // Width profile: thin at the nozzle, bulge low, long thin taper to the top.
    float cx = abs(uv.x - 0.5) * 2.0;
    float widthEnv = (0.16 + 0.84 * smoothstep(0.0, 0.2, y)) * pow(max(0.0, 1.0 - y), 0.72);
    float body = smoothstep(1.0, 0.0, cx / max(0.05, widthEnv * 0.6));
    float flame = body * (0.5 + 0.7 * n);

    // Directional ignite (grows bottom→top) and extinguish (base cuts, rises).
    float ignite = smoothstep(0.0, 0.18, uProgress);
    float topReach = mix(0.2, 1.0, ignite);
    float baseCut = smoothstep(0.58, 1.0, uProgress) * 0.95;
    float topMask = 1.0 - smoothstep(topReach - 0.22, topReach, y);
    float baseMask = smoothstep(baseCut, baseCut + 0.12, y);
    flame *= topMask * baseMask;

    flame = clamp(flame * 1.85 - 0.12, 0.0, 1.0);

    // Heat: white-hot low → orange → red tip.
    float heat = flame * (1.0 - y * 0.35);
    vec3 col = mix(vec3(0.9, 0.06, 0.0), vec3(1.0, 0.5, 0.04), smoothstep(0.0, 0.45, heat));
    col = mix(col, vec3(1.0, 0.93, 0.7), smoothstep(0.6, 1.0, heat));

    float alpha = flame * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

/** A realistic fire jet (thin/long shader flame + a flickering light), via `flame_burst`. */
export function FlameEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const worldPos = useRef(new THREE.Vector3());

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uProgress: { value: 0 } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame(({ clock, camera }) => {
    const burst = burstFor(showRef.current.bursts.flame, object.id);
    const env = burst ? burst.env * burst.intensity : 0;
    const t = clock.elapsedTime;
    material.uniforms.uTime.value = t;
    material.uniforms.uOpacity.value = env;
    material.uniforms.uProgress.value = burst ? burst.progress : 0;
    const on = env > 0.001;
    if (groupRef.current) {
      groupRef.current.visible = on;
      if (on) {
        // Billboard around Y so the flame always faces the camera.
        groupRef.current.getWorldPosition(worldPos.current);
        groupRef.current.rotation.y = Math.atan2(
          camera.position.x - worldPos.current.x,
          camera.position.z - worldPos.current.z,
        );
      }
    }
    if (lightRef.current) {
      const flicker = 0.8 + Math.sin(t * 11 + object.position[0]) * 0.2;
      lightRef.current.intensity = on ? env * 6 * flicker : 0;
    }
  });

  return (
    <>
      <EmitterBody color={object.color} />
      <group ref={groupRef} visible={false}>
        <mesh position={[0, 2.3, 0]} material={material} raycast={ignoreRaycast}>
          <planeGeometry args={[1.5, 4.6]} />
        </mesh>
        <pointLight ref={lightRef} position={[0, 1.2, 0]} color="#ff7a1e" distance={12} decay={1.3} intensity={0} />
      </group>
    </>
  );
}
