import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SceneObject } from '../../types/show';
import { useShowStateRef } from './ShowStateContext';
import { burstFor, disposeParticles, makeParticles } from './particles';
import { getSmokeTexture } from './textures';
import { ignoreRaycast } from './interaction';
import { EmitterBody } from './props';

const COUNT = 80;
const TAU = Math.PI * 2;

/** A tall, fast white cryo jet that mushrooms as it rises, via `co2_burst`. */
export function CO2Effect({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const tex = useMemo(() => getSmokeTexture(), []);
  const sys = useMemo(() => {
    const s = makeParticles(COUNT, { texture: tex });
    for (let i = 0; i < COUNT; i++) {
      s.colors[i * 3] = 0.95;
      s.colors[i * 3 + 1] = 0.97;
      s.colors[i * 3 + 2] = 1;
      s.geometry.attributes.aSize.setX(i, 3 + s.seeds[i] * 3.5);
    }
    s.geometry.attributes.aColor.needsUpdate = true;
    s.geometry.attributes.aSize.needsUpdate = true;
    return s;
  }, [tex]);

  useEffect(() => () => disposeParticles(sys), [sys]);

  useFrame(({ clock }) => {
    const burst = burstFor(showRef.current.bursts.co2, object.id);
    const env = burst ? burst.env * burst.intensity : 0;
    sys.material.visible = env > 0.001;
    if (!sys.material.visible) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const seed = sys.seeds[i];
      const life = (t * (0.95 + seed * 0.5) + seed) % 1;
      // Thin column near the nozzle, mushrooming wider toward the top.
      const widen = 0.12 + life * life * 1.3;
      const ang = seed * TAU;
      sys.positions[i * 3] = Math.cos(ang) * widen * (0.5 + seed);
      sys.positions[i * 3 + 1] = 0.1 + life * (6.8 + seed * 1.8);
      sys.positions[i * 3 + 2] = Math.sin(ang) * widen * (0.5 + seed);
      sys.alphas[i] = Math.sin(life * Math.PI) * 0.75 * env;
      sys.angles[i] = seed * TAU + t * (seed > 0.5 ? 0.8 : -0.8);
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
