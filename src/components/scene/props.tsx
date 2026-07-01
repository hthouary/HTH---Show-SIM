import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';

/**
 * Small physical body for an FX machine (smoke / flame / CO2 / confetti). The
 * particle effects themselves aren't selectable, so this box is what you click
 * to select and move the machine — and it makes the rig visible on the floor.
 */
export function EmitterBody({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.55, 0.34, 0.65]} />
        <meshStandardMaterial color="#15181f" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.32, 0.05, 0.42]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

/** Raised stage deck. */
export function StagePlatform({ object }: { object: SceneObject }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[14, 0.5, 8]} />
        <meshStandardMaterial color={object.color} metalness={0.2} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[14, 0.04, 8]} />
        <meshStandardMaterial color="#0c0e14" metalness={0.1} roughness={0.95} />
      </mesh>
      {/* Glowing edge strip */}
      <mesh position={[0, 0.1, 4.02]}>
        <boxGeometry args={[14, 0.08, 0.06]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Overhead truss beam (lattice). */
export function Truss({ object }: { object: SceneObject }) {
  const braces = useMemo(() => {
    const arr: number[] = [];
    for (let x = -7; x <= 7; x += 1) arr.push(x);
    return arr;
  }, []);
  const mat = <meshStandardMaterial color={object.color} metalness={0.85} roughness={0.35} />;
  return (
    <group>
      {/* Chords */}
      {[
        [0, 0.25, 0.25],
        [0, 0.25, -0.25],
        [0, -0.25, 0.25],
        [0, -0.25, -0.25],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={[15, 0.08, 0.08]} />
          {mat}
        </mesh>
      ))}
      {/* Cross braces */}
      {braces.map((x) => (
        <group key={x}>
          <mesh position={[x, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.05, 0.7, 0.05]} />
            {mat}
          </mesh>
          <mesh position={[x, 0, 0.25]}>
            <boxGeometry args={[0.05, 0.5, 0.05]} />
            {mat}
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** PA speaker line-array stack. */
export function Speaker({ object }: { object: SceneObject }) {
  return (
    <group>
      <mesh position={[0, -1.2, 0]}>
        <boxGeometry args={[1.1, 0.3, 1]} />
        <meshStandardMaterial color="#0a0c12" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, i * 0.8 - 0.6, 0]}>
          <mesh>
            <boxGeometry args={[1.3, 0.7, 1.1]} />
            <meshStandardMaterial color={object.color} metalness={0.3} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.56]}>
            <circleGeometry args={[0.26, 20]} />
            <meshStandardMaterial color="#05060a" metalness={0.2} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** DJ booth with a faintly glowing front face. */
export function DjBooth({ object }: { object: SceneObject }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[3.2, 1.4, 1.4]} />
        <meshStandardMaterial color={object.color} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.1, 0.71]}>
        <planeGeometry args={[3, 1]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.18} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[3.4, 0.1, 1.6]} />
        <meshStandardMaterial color="#05060a" metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Audience — an instanced field of dark figures that gently bob. */
export function CrowdBlock({ object }: { object: SceneObject }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COLS = 26;
  const ROWS = 10;
  const total = COLS * ROWS;

  const data = useMemo(() => {
    const arr: { x: number; z: number; h: number; phase: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        arr.push({
          x: (c - COLS / 2) * 0.7 + (Math.random() - 0.5) * 0.3,
          z: r * 0.8 + (Math.random() - 0.5) * 0.3,
          h: 1.5 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    return arr;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < total; i++) {
      const d = data[i];
      const bob = Math.sin(t * 2 + d.phase) * 0.08;
      dummy.position.set(d.x, d.h / 2 + bob, d.z);
      dummy.scale.set(0.32, d.h, 0.32);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, total]} frustumCulled={false}>
      <capsuleGeometry args={[0.5, 1, 4, 8]} />
      <meshStandardMaterial color={object.color} roughness={0.9} metalness={0} />
    </instancedMesh>
  );
}
