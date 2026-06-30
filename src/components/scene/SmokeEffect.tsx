import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor, disposeParticles, makeParticles } from './particles';

const COUNT = 70;

/** A soft haze cloud that billows up and fades, driven by `smoke_burst`. */
export function SmokeEffect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const sys = useMemo(() => {
    const s = makeParticles(COUNT, false);
    for (let i = 0; i < COUNT; i++) {
      s.colors[i * 3] = 0.78;
      s.colors[i * 3 + 1] = 0.82;
      s.colors[i * 3 + 2] = 0.9;
      s.geometry.attributes.aSize.setX(i, 120 + s.seeds[i] * 90);
    }
    s.geometry.attributes.aColor.needsUpdate = true;
    s.geometry.attributes.aSize.needsUpdate = true;
    return s;
  }, []);

  useEffect(() => () => disposeParticles(sys), [sys]);

  useFrame(({ clock }) => {
    const burst = burstFor(showRef.current.bursts.smoke, object.id);
    const env = burst ? burst.env * burst.intensity : 0;
    sys.material.visible = env > 0.001;
    if (!sys.material.visible) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const seed = sys.seeds[i];
      const life = (t * (0.12 + seed * 0.08) + seed) % 1;
      const spread = 0.4 + life * (1.6 + seed);
      const ang = seed * Math.PI * 2 + t * 0.1;
      sys.positions[i * 3] = Math.cos(ang) * spread * (0.6 + seed * 0.6);
      sys.positions[i * 3 + 1] = 0.2 + life * 4.5;
      sys.positions[i * 3 + 2] = Math.sin(ang) * spread * (0.6 + seed * 0.6);
      sys.alphas[i] = Math.sin(life * Math.PI) * 0.5 * env;
    }
    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.aAlpha.needsUpdate = true;
  });

  return <points geometry={sys.geometry} material={sys.material} frustumCulled={false} />;
}
