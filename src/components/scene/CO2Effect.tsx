import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor, disposeParticles, makeParticles } from './particles';

const COUNT = 60;

/** A tall white cryo jet shooting straight up, driven by `co2_burst`. */
export function CO2Effect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const sys = useMemo(() => {
    const s = makeParticles(COUNT, false);
    for (let i = 0; i < COUNT; i++) {
      s.colors[i * 3] = 0.92;
      s.colors[i * 3 + 1] = 0.95;
      s.colors[i * 3 + 2] = 1;
      s.geometry.attributes.aSize.setX(i, 80 + s.seeds[i] * 70);
    }
    s.geometry.attributes.aColor.needsUpdate = true;
    s.geometry.attributes.aSize.needsUpdate = true;
    return s;
  }, []);

  useEffect(() => () => disposeParticles(sys), [sys]);

  useFrame(({ clock }) => {
    const burst = burstFor(showRef.current.bursts.co2, object.id);
    const env = burst ? burst.env * burst.intensity : 0;
    sys.material.visible = env > 0.001;
    if (!sys.material.visible) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const seed = sys.seeds[i];
      const life = (t * (0.9 + seed * 0.4) + seed) % 1;
      const widen = 0.15 + life * 0.7;
      const ang = seed * Math.PI * 2;
      sys.positions[i * 3] = Math.cos(ang) * widen * seed;
      sys.positions[i * 3 + 1] = 0.1 + life * (6.5 + seed * 1.5);
      sys.positions[i * 3 + 2] = Math.sin(ang) * widen * seed;
      sys.alphas[i] = Math.sin(life * Math.PI) * 0.7 * env;
    }
    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.aAlpha.needsUpdate = true;
  });

  return <points geometry={sys.geometry} material={sys.material} frustumCulled={false} />;
}
