import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor, disposeParticles, makeParticles } from './particles';
import { getGlowTexture } from './textures';

const COUNT = 70;
const TAU = Math.PI * 2;

/** A stylised fire jet — soft white-hot → orange → red embers, via `flame_burst`. */
export function FlameEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const tex = useMemo(() => getGlowTexture(), []);
  const sys = useMemo(() => {
    const s = makeParticles(COUNT, { additive: true, texture: tex });
    for (let i = 0; i < COUNT; i++) s.geometry.attributes.aSize.setX(i, 2 + s.seeds[i] * 3);
    s.geometry.attributes.aSize.needsUpdate = true;
    return s;
  }, [tex]);

  useEffect(() => () => disposeParticles(sys), [sys]);

  useFrame(({ clock }) => {
    const burst = burstFor(showRef.current.bursts.flame, object.id);
    const env = burst ? burst.env * burst.intensity : 0;
    sys.material.visible = env > 0.001;
    if (!sys.material.visible) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const seed = sys.seeds[i];
      const life = (t * (0.85 + seed * 0.6) + seed) % 1;
      const flick = Math.sin(t * 20 + seed * 30) * 0.14;
      // Narrows as it rises (flame tongue).
      const taper = 0.55 * (1 - life * 0.7);
      sys.positions[i * 3] = (seed - 0.5) * taper + flick;
      sys.positions[i * 3 + 1] = 0.08 + life * (3.0 + seed * 1.2);
      sys.positions[i * 3 + 2] = (((seed * 7.3) % 1) - 0.5) * taper;
      // White-hot at the base → orange → deep red at the tip.
      sys.colors[i * 3] = 1;
      sys.colors[i * 3 + 1] = Math.max(0.08, 0.95 - life * 0.85);
      sys.colors[i * 3 + 2] = Math.max(0.0, 0.55 - life * 1.2);
      sys.alphas[i] = Math.sin(life * Math.PI) * 0.7 * env;
      sys.angles[i] = seed * TAU + t * (seed > 0.5 ? 1.2 : -1.2);
    }
    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.aColor.needsUpdate = true;
    sys.geometry.attributes.aAlpha.needsUpdate = true;
    sys.geometry.attributes.aAngle.needsUpdate = true;
  });

  return <points geometry={sys.geometry} material={sys.material} frustumCulled={false} />;
}
