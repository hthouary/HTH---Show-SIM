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

// Procedural fire: domain-warped fbm noise scrolling up, shaped into a flame
// tongue with a white-hot base → orange → red tip. Additive.
const FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform float uOpacity;
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
    float t = uTime;
    vec2 q = vec2(uv.x * 2.2, uv.y * 2.6 - t * 1.7);
    float n = fbm(q + fbm(q * 1.6));
    float cx = abs(uv.x - 0.5) * 2.0;
    float taper = 1.0 - uv.y;
    float body = smoothstep(1.0, 0.0, cx / max(0.14, taper));
    float flame = body * (0.5 + 0.65 * n) * taper;
    flame = clamp(flame * 1.7 - 0.16, 0.0, 1.0);
    vec3 col = mix(vec3(1.0, 0.12, 0.0), vec3(1.0, 0.58, 0.05), smoothstep(0.0, 0.5, flame));
    col = mix(col, vec3(1.0, 0.95, 0.72), smoothstep(0.55, 1.0, flame));
    float alpha = flame * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

/** A stylised fire jet (shader flame + a flickering light), via `flame_burst`. */
export function FlameEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const worldPos = useRef(new THREE.Vector3());

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
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
        <mesh position={[0, 1.35, 0]} material={material} raycast={ignoreRaycast}>
          <planeGeometry args={[1.3, 2.7]} />
        </mesh>
        <pointLight ref={lightRef} position={[0, 0.8, 0]} color="#ff7a1e" distance={9} decay={1.4} intensity={0} />
      </group>
    </>
  );
}
