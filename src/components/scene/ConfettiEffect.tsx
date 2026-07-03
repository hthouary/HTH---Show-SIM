import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
import { sfx } from '../../utils/sfx';
import { useShowStateRef } from './ShowStateContext';
import { burstFor } from './particles';
import { ignoreRaycast } from './interaction';
import { ConfettiCannonBody } from './props';

const COUNT = 140;
const TAU = Math.PI * 2;
const PALETTE = [
  [0.13, 0.83, 0.93],
  [0.55, 0.36, 0.96],
  [0.9, 0.29, 0.84],
  [1.0, 0.85, 0.3],
  [0.3, 0.9, 0.4],
  [1.0, 0.45, 0.45],
];

/**
 * Realistic confetti: instanced paper rectangles that are launched up, tumble
 * on all axes and fall under gravity, catching the stage light (double-sided,
 * slightly glossy). Driven by `confetti_burst`.
 */
export function ConfettiEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const fired = useRef(false);

  const data = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        ang: Math.random() * TAU,
        spread: 0.5 + Math.random() * 3.8,
        launch: 6 + Math.random() * 3.5,
        spin: [
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
        ] as [number, number, number],
        phase: Math.random() * TAU,
        size: 0.7 + Math.random() * 0.7,
        drop: (Math.random() * 13.1) % 1,
        color: PALETTE[i % PALETTE.length],
      })),
    [],
  );

  // Per-instance colors (set once).
  useEffect(() => {
    if (!ref.current) return;
    const c = new THREE.Color();
    data.forEach((d, i) => {
      c.setRGB(d.color[0], d.color[1], d.color[2]);
      ref.current!.setColorAt(i, c);
    });
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame(({ clock }) => {
    const burst = burstFor(showRef.current.bursts.confetti, object.id);
    const env = burst ? burst.env * (burst.intensity ?? 1) : 0;
    if (env > 0.05 && !fired.current && useShowStore.getState().isPlaying) {
      sfx.confetti();
      fired.current = true;
    } else if (env < 0.02) fired.current = false;
    const active = !!burst && burst.progress < 1 && (burst.intensity ?? 0) > 0.001;
    if (!ref.current) return;
    ref.current.visible = active;
    if (!active || !burst) return;
    const t = clock.elapsedTime;
    const p = burst.progress;
    for (let i = 0; i < COUNT; i++) {
      const d = data[i];
      const y = d.launch * p - 9 * p * p + d.drop * 0.5;
      dummy.position.set(
        Math.cos(d.ang) * d.spread * p + Math.sin(t * 3 + d.phase) * 0.35,
        Math.max(0.05, 0.4 + y),
        Math.sin(d.ang) * d.spread * p,
      );
      dummy.rotation.set(t * d.spin[0] * 0.3 + d.phase, t * d.spin[1] * 0.3, t * d.spin[2] * 0.3);
      dummy.scale.setScalar(d.size);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <ConfettiCannonBody color={object.color} />
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, COUNT]}
        frustumCulled={false}
        raycast={ignoreRaycast}
        visible={false}
      >
        <boxGeometry args={[0.13, 0.006, 0.085]} />
        <meshStandardMaterial side={THREE.DoubleSide} roughness={0.35} metalness={0.15} emissiveIntensity={0} />
      </instancedMesh>
    </>
  );
}
