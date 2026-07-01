import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor, disposeParticles, makeParticles } from './particles';
import { ignoreRaycast } from './interaction';
import { EmitterBody } from './props';

const COUNT = 120;
const TAU = Math.PI * 2;
const PALETTE = [
  [0.13, 0.83, 0.93],
  [0.55, 0.36, 0.96],
  [0.9, 0.29, 0.84],
  [1.0, 0.85, 0.3],
  [0.3, 0.9, 0.4],
  [1.0, 0.45, 0.45],
];

/** Colorful confetti — spinning paper squares launched up then falling, via `confetti_burst`. */
export function ConfettiEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const sys = useMemo(() => {
    const s = makeParticles(COUNT, { shape: 'square' });
    for (let i = 0; i < COUNT; i++) {
      const c = PALETTE[i % PALETTE.length];
      s.colors[i * 3] = c[0];
      s.colors[i * 3 + 1] = c[1];
      s.colors[i * 3 + 2] = c[2];
      s.geometry.attributes.aSize.setX(i, 0.7 + s.seeds[i] * 0.9);
    }
    s.geometry.attributes.aColor.needsUpdate = true;
    s.geometry.attributes.aSize.needsUpdate = true;
    return s;
  }, []);

  useEffect(() => () => disposeParticles(sys), [sys]);

  useFrame(({ clock }) => {
    const burst = burstFor(showRef.current.bursts.confetti, object.id);
    const active = !!burst && burst.progress < 1;
    sys.material.visible = active && (burst?.intensity ?? 0) > 0.001;
    if (!sys.material.visible || !burst) return;
    const t = clock.elapsedTime;
    const p = burst.progress;
    for (let i = 0; i < COUNT; i++) {
      const seed = sys.seeds[i];
      const ang = seed * TAU;
      const spread = 0.5 + seed * 3.8;
      const launch = 6 + seed * 3.5;
      // Parabolic height: up fast, fall under "gravity"; flutter sideways.
      const y = launch * p - 9 * p * p + ((seed * 13.1) % 1) * 0.5;
      sys.positions[i * 3] = Math.cos(ang) * spread * p + Math.sin(t * 3 + seed * 10) * 0.35;
      sys.positions[i * 3 + 1] = Math.max(0.05, 0.4 + y);
      sys.positions[i * 3 + 2] = Math.sin(ang) * spread * p;
      sys.alphas[i] = (1 - p) * 0.98;
      // Tumbling paper.
      sys.angles[i] = seed * TAU + t * (4 + seed * 6) * (seed > 0.5 ? 1 : -1);
    }
    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.aAlpha.needsUpdate = true;
    sys.geometry.attributes.aAngle.needsUpdate = true;
  });

  return (
    <>
      <EmitterBody color={object.color} />
      <points geometry={sys.geometry} material={sys.material} frustumCulled={false} raycast={ignoreRaycast} />
    </>
  );
}
