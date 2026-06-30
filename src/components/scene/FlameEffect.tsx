import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor, disposeParticles, makeParticles } from './particles';

const COUNT = 55;

/** A stylised fire jet — orange→yellow particles shooting up, via `flame_burst`. */
export function FlameEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const sys = useMemo(() => {
    const s = makeParticles(COUNT, true);
    for (let i = 0; i < COUNT; i++) s.geometry.attributes.aSize.setX(i, 70 + s.seeds[i] * 60);
    s.geometry.attributes.aSize.needsUpdate = true;
    return s;
  }, []);

  useEffect(() => () => disposeParticles(sys), [sys]);

  useFrame(({ clock }) => {
    const burst = burstFor(showRef.current.bursts.flame, object.id);
    const env = burst ? burst.env * burst.intensity : 0;
    sys.material.visible = env > 0.001;
    if (!sys.material.visible) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const seed = sys.seeds[i];
      const life = (t * (0.7 + seed * 0.5) + seed) % 1;
      const flick = Math.sin(t * 18 + seed * 30) * 0.12;
      sys.positions[i * 3] = (seed - 0.5) * (0.6 - life * 0.4) + flick;
      sys.positions[i * 3 + 1] = 0.1 + life * (2.8 + seed);
      sys.positions[i * 3 + 2] = (((seed * 7.3) % 1) - 0.5) * (0.6 - life * 0.4);
      // Color shifts white-hot → orange → red as it rises.
      sys.colors[i * 3] = 1;
      sys.colors[i * 3 + 1] = Math.max(0.1, 0.9 - life * 0.8);
      sys.colors[i * 3 + 2] = Math.max(0.0, 0.5 - life * 0.9);
      sys.alphas[i] = Math.sin(life * Math.PI) * env;
    }
    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.aColor.needsUpdate = true;
    sys.geometry.attributes.aAlpha.needsUpdate = true;
  });

  return <points geometry={sys.geometry} material={sys.material} frustumCulled={false} />;
}
