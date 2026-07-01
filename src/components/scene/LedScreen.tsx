import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useShowStateRef } from './ShowStateContext';
import { useShowStore } from '../../store/useShowStore';
import { audioEngine } from '../../utils/audio';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Abstract animated wall: moving bars + radial pulse + scanlines, tinted by uColor.
const FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uPulse;
  uniform float uLevel;
  uniform vec3 uColor;

  float bars(vec2 uv, float t) {
    float b = sin(uv.x * 18.0 + t * 1.5) * 0.5 + 0.5;
    b *= sin(uv.y * 6.0 - t) * 0.5 + 0.5;
    return b;
  }

  void main() {
    vec2 uv = vUv;
    vec2 c = uv - 0.5;
    float t = uTime;

    float wave = sin(length(c) * 14.0 - t * 3.0) * 0.5 + 0.5;
    float b = bars(uv, t);
    float grid = step(0.92, fract(uv.x * 40.0)) + step(0.92, fract(uv.y * 22.0));

    float energy = mix(0.25, 1.0, uLevel);
    float pat = mix(wave, b, 0.5) * energy;
    pat += uPulse * 0.8;
    pat = clamp(pat, 0.0, 1.4);

    vec3 col = uColor * (0.4 + pat);
    col += uColor * grid * 0.25;
    // subtle scanline
    col *= 0.85 + 0.15 * sin(uv.y * 220.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function LedScreen() {
  const showRef = useShowStateRef();
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uLevel: { value: 0 },
      uColor: { value: new THREE.Color('#22d3ee') },
    }),
    [],
  );

  useEffect(() => {
    return () => {
      matRef.current?.dispose();
    };
  }, []);

  useFrame((_, delta) => {
    const led = showRef.current.led;
    const black = 1 - showRef.current.blackout;
    // Freeze the wall animation when paused so the scene is fully static.
    if (useShowStore.getState().isPlaying) uniforms.uTime.value += delta;
    uniforms.uColor.value.setRGB(led.color[0] * black, led.color[1] * black, led.color[2] * black);
    uniforms.uPulse.value = led.pulse * black;
    // Smoothly follow the music level.
    uniforms.uLevel.value += (audioEngine.level - uniforms.uLevel.value) * 0.2;
  });

  const W = 9;
  const H = 5;

  return (
    <group>
      {/* Bezel */}
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[W + 0.5, H + 0.5, 0.25]} />
        <meshStandardMaterial color="#05060a" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* Emissive video surface */}
      <mesh>
        <planeGeometry args={[W, H]} />
        <shaderMaterial ref={matRef} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} />
      </mesh>
    </group>
  );
}
