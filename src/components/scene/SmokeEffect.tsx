import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor, disposeParticles, makeParticles } from './particles';
import { getSmokeTexture } from './textures';
import { ignoreRaycast } from './interaction';
import { SmokeMachineBody } from './props';

const COUNT = 120;
const TAU = Math.PI * 2;

/**
 * Realistic haze: many soft, wispy, semi-transparent grey puffs that billow,
 * churn (per-particle rotation) and drift up. Kept deliberately dim and
 * non-additive so it reads as smoke rather than glowing light, while picking up
 * a faint tint from the active beam color. Driven by `smoke_burst`.
 */
export function SmokeEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const tex = useMemo(() => getSmokeTexture(), []);
  const sys = useMemo(() => {
    const s = makeParticles(COUNT, { texture: tex });
    for (let i = 0; i < COUNT; i++) s.geometry.attributes.aSize.setX(i, 3 + s.seeds[i] * 5);
    s.geometry.attributes.aSize.needsUpdate = true;
    return s;
  }, [tex]);

  useEffect(() => () => disposeParticles(sys), [sys]);

  useFrame(({ clock }) => {
    const state = showRef.current;
    const burst = burstFor(state.bursts.smoke, object.id);
    const env = burst ? burst.env * Math.min(1.4, burst.intensity) : 0;
    sys.material.visible = env > 0.001;
    if (!sys.material.visible) return;

    const t = clock.elapsedTime;
    // Faint tint from the current beam color so haze feels lit by the rig.
    const lc = state.light.color;
    const li = Math.min(1.4, state.light.intensity);
    const r = Math.min(0.62, 0.34 + lc[0] * 0.18 * li);
    const g = Math.min(0.62, 0.35 + lc[1] * 0.18 * li);
    const b = Math.min(0.66, 0.38 + lc[2] * 0.18 * li);

    for (let i = 0; i < COUNT; i++) {
      const seed = sys.seeds[i];
      const life = (t * (0.06 + seed * 0.05) + seed) % 1;
      // Turbulent, billowing motion (layered sines).
      const swirl = 0.4 + life * (1.4 + seed);
      const tx = Math.sin(t * 0.4 + seed * 21) * swirl + Math.cos(seed * 13) * life * 1.1;
      const tz = Math.cos(t * 0.33 + seed * 17) * swirl + Math.sin(seed * 9) * life * 1.1;
      sys.positions[i * 3] = tx;
      sys.positions[i * 3 + 1] = 0.15 + life * 4.2;
      sys.positions[i * 3 + 2] = tz;
      sys.alphas[i] = Math.sin(life * Math.PI) * 0.18 * env;
      sys.angles[i] = seed * TAU + t * (0.15 + seed * 0.25) * (seed > 0.5 ? 1 : -1);
      sys.colors[i * 3] = r;
      sys.colors[i * 3 + 1] = g;
      sys.colors[i * 3 + 2] = b;
    }
    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.aAlpha.needsUpdate = true;
    sys.geometry.attributes.aAngle.needsUpdate = true;
    sys.geometry.attributes.aColor.needsUpdate = true;
  });

  return (
    <>
      <SmokeMachineBody color={object.color} />
      <points geometry={sys.geometry} material={sys.material} frustumCulled={false} raycast={ignoreRaycast} />
    </>
  );
}
