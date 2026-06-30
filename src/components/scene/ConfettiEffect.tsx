import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor, disposeParticles, makeParticles } from './particles';

const COUNT = 110;
const PALETTE = [
  [0.13, 0.83, 0.93],
  [0.55, 0.36, 0.96],
  [0.9, 0.29, 0.84],
  [1.0, 0.85, 0.3],
  [0.3, 0.9, 0.4],
  [1.0, 0.45, 0.45],
];

/** Colorful confetti launched up then falling under gravity, via `confetti_burst`. */
export function ConfettiEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const sys = useMemo(() => {
    const s = makeParticles(COUNT, false);
    for (let i = 0; i < COUNT; i++) {
      const c = PALETTE[i % PALETTE.length];
      s.colors[i * 3] = c[0];
      s.colors[i * 3 + 1] = c[1];
      s.colors[i * 3 + 2] = c[2];
      s.geometry.attributes.aSize.setX(i, 26 + s.seeds[i] * 22);
    }
    s.geometry.attributes.aColor.needsUpdate = true;
    s.geometry.attributes.aSize.needsUpdate = true;
    return s;
  }, []);

  useEffect(() => () => disposeParticles(sys), [sys]);

  useFrame(({ clock }) => {
    const burst = burstFor(showRef.current.bursts.confetti, object.id);
    const env = burst ? Math.min(1, burst.intensity) : 0;
    const active = !!burst && burst.progress < 1;
    sys.material.visible = env > 0.001 && active;
    if (!sys.material.visible) return;
    const t = clock.elapsedTime;
    // Whole-burst progress so confetti launches then rains down together.
    const p = burst ? burst.progress : 0;
    for (let i = 0; i < COUNT; i++) {
      const seed = sys.seeds[i];
      const ang = seed * Math.PI * 2;
      const spread = 0.5 + seed * 3.5;
      const launch = 6 + seed * 3;
      // Parabolic height: up fast, fall under "gravity".
      const y = launch * p - 9 * p * p + (((seed * 13.1) % 1) * 0.5);
      sys.positions[i * 3] = Math.cos(ang) * spread * p + Math.sin(t * 3 + seed * 10) * 0.3;
      sys.positions[i * 3 + 1] = Math.max(0.05, 0.4 + y);
      sys.positions[i * 3 + 2] = Math.sin(ang) * spread * p;
      sys.alphas[i] = (1 - p) * 0.95;
    }
    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.aAlpha.needsUpdate = true;
  });

  return <points geometry={sys.geometry} material={sys.material} frustumCulled={false} />;
}
