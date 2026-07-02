import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor } from './particles';
import { ignoreRaycast } from './interaction';
import { FlameJetBody } from './props';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NOISE = /* glsl */ `
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
`;

// Fire jet: thin at the nozzle, a slight bulge low, then a long thin taper. It
// ignites from the base upward; when extinguishing the base cuts off first and
// the licks rise and fade at the tip.
const FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uProgress;
  varying vec2 vUv;
  ${NOISE}
  void main(){
    vec2 uv = vUv;
    float y = uv.y;
    vec2 q = vec2(uv.x * 2.4, y * 2.8 - uTime * 2.1);
    float n = fbm(q + fbm(q * 1.7));
    float cx = abs(uv.x - 0.5) * 2.0;
    float widthEnv = (0.16 + 0.84 * smoothstep(0.0, 0.2, y)) * pow(max(0.0, 1.0 - y), 0.72);
    float body = smoothstep(1.0, 0.0, cx / max(0.05, widthEnv * 0.6));
    float flame = body * (0.5 + 0.7 * n);

    float ignite = smoothstep(0.0, 0.18, uProgress);
    float topReach = mix(0.2, 1.0, ignite);
    float baseCut = smoothstep(0.58, 1.0, uProgress) * 0.95;
    flame *= (1.0 - smoothstep(topReach - 0.22, topReach, y)) * smoothstep(baseCut, baseCut + 0.12, y);
    flame = clamp(flame * 1.85 - 0.12, 0.0, 1.0);

    float heat = flame * (1.0 - y * 0.35);
    vec3 col = mix(vec3(0.9, 0.06, 0.0), vec3(1.0, 0.5, 0.04), smoothstep(0.0, 0.45, heat));
    col = mix(col, vec3(1.0, 0.93, 0.7), smoothstep(0.6, 1.0, heat));

    float alpha = flame * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

// Dark smoke escaping from the top of the flame — widens as it rises, and gets
// much stronger as the flame extinguishes.
const SMOKE_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform float uProgress;
  varying vec2 vUv;
  ${NOISE}
  void main(){
    vec2 uv = vUv;
    float y = uv.y;
    vec2 q = vec2(uv.x * 2.0 + uTime * 0.05, y * 2.2 - uTime * 0.8);
    float n = fbm(q + 0.5 * fbm(q * 1.3));
    float cx = abs(uv.x - 0.5) * 2.0;
    float widthEnv = 0.32 + 0.68 * smoothstep(0.0, 0.85, y); // widen going up
    float body = smoothstep(1.0, 0.0, cx / max(0.1, widthEnv));
    float smoke = body * n * smoothstep(0.0, 0.28, y) * (1.0 - smoothstep(0.72, 1.0, y));
    // A little while burning, a lot while extinguishing, then fade out.
    float amount = (0.14 + 0.9 * smoothstep(0.45, 0.95, uProgress)) * (1.0 - smoothstep(0.96, 1.0, uProgress));
    float alpha = smoke * amount * 0.55;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vec3(0.22, 0.2, 0.19), alpha);
  }
`;

/** A realistic fire jet (thin/long shader flame + rising smoke + light), via `flame_burst`. */
export function FlameEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const worldPos = useRef(new THREE.Vector3());

  const flameMat = useMemo(
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
  const smokeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uProgress: { value: 0 } },
        vertexShader: VERT,
        fragmentShader: SMOKE_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  useFrame(({ clock, camera }) => {
    const burst = burstFor(showRef.current.bursts.flame, object.id);
    const env = burst ? burst.env * burst.intensity : 0;
    const t = clock.elapsedTime;
    const prog = burst ? burst.progress : 0;
    flameMat.uniforms.uTime.value = t;
    flameMat.uniforms.uOpacity.value = env;
    flameMat.uniforms.uProgress.value = prog;
    smokeMat.uniforms.uTime.value = t;
    smokeMat.uniforms.uProgress.value = prog;

    const on = env > 0.001;
    if (groupRef.current) {
      groupRef.current.visible = on;
      if (on) {
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
      <FlameJetBody color={object.color} />
      <group ref={groupRef} visible={false}>
        {/* Rising smoke above the flame */}
        <mesh position={[0, 5.0, 0]} material={smokeMat} raycast={ignoreRaycast}>
          <planeGeometry args={[2.4, 5.0]} />
        </mesh>
        {/* Flame */}
        <mesh position={[0, 2.3, 0]} material={flameMat} raycast={ignoreRaycast}>
          <planeGeometry args={[1.5, 4.6]} />
        </mesh>
        <pointLight ref={lightRef} position={[0, 1.2, 0]} color="#ff7a1e" distance={12} decay={1.3} intensity={0} />
      </group>
    </>
  );
}
