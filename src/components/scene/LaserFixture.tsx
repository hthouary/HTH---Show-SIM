import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';
import { laserColorForObject, laserMoveForObject } from '../../utils/events';
import { laserMovement, movementSeed } from '../../utils/movement';
import { useShowStore } from '../../store/useShowStore';
import { useShowStateRef } from './ShowStateContext';
import { ignoreRaycast } from './interaction';

const UP_DOWN = new THREE.Vector3(0, -1, 0);
const tmpColor = new THREE.Color();
const BEAM_COUNT = 11;

/**
 * A laser projector: a head plus a long fan of thin beams that only appear
 * while a `laser_on` event is active. Each beam is a razor-thin bright core
 * wrapped in a soft additive glow; the fan sweeps slowly for life.
 */
export function LaserFixture({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const fanRef = useRef<THREE.Group>(null);
  const moveRef = useRef<THREE.Group>(null);

  const { baseQuat, coreGeo, glowGeo, spreads, coreMat, glowMat, dotMat } = useMemo(() => {
    const rel = new THREE.Vector3(
      object.target[0] - object.position[0],
      object.target[1] - object.position[1],
      object.target[2] - object.position[2],
    );
    const dist = Math.max(rel.length(), 10);
    const len = THREE.MathUtils.clamp(dist * 1.8, 24, 50); // long throw
    const dir = rel.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP_DOWN, dir);

    const core = new THREE.CylinderGeometry(0.012, 0.022, len, 6, 1, true);
    core.translate(0, -len / 2, 0);
    const glow = new THREE.CylinderGeometry(0.06, 0.11, len, 8, 1, true);
    glow.translate(0, -len / 2, 0);

    const sp = Array.from({ length: BEAM_COUNT }, (_, i) => (i / (BEAM_COUNT - 1) - 0.5) * 0.8);
    const mkMat = (opacity: number) =>
      new THREE.MeshBasicMaterial({
        color: '#39ff14',
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    return {
      baseQuat: q,
      coreGeo: core,
      glowGeo: glow,
      spreads: sp,
      coreMat: mkMat(0),
      glowMat: mkMat(0),
      dotMat: mkMat(0.2),
    };
  }, [object.position, object.target]);

  useFrame(({ clock }) => {
    const state = showRef.current;
    const rgb = laserColorForObject(state, object.id);
    const lm = laserMoveForObject(state, object.id);
    tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
    const on = state.laser.active && state.blackout < 0.6;
    const intensity = on ? state.laser.intensity : 0;
    const playing = useShowStore.getState().isPlaying;
    const t = clock.elapsedTime;
    // Steady beams, only a very slow shimmer while playing (frozen when paused).
    const shimmer = playing ? 0.97 + Math.sin(t * 0.8) * 0.03 : 1;

    coreMat.color.copy(tmpColor);
    coreMat.opacity = on ? Math.min(1, 0.95 * intensity * shimmer) : 0;
    glowMat.color.copy(tmpColor);
    glowMat.opacity = on ? 0.32 * intensity * shimmer : 0;
    dotMat.color.copy(tmpColor);
    dotMat.opacity = on ? 1 : 0.12;

    // Movement — driven by the timeline laser events (pattern + speed), resolved
    // per fixture. Phase uses the show time so it stays in sync with playback,
    // scrubs correctly and freezes when paused. 'circular' rolls the whole fan
    // around its projection axis, sweeping a rotating cone (a circle in the haze);
    // the other presets pan / tilt the fan. moveRef aims it, fanRef rolls it.
    const mv = laserMovement(lm.pattern, lm.speed, state.time, movementSeed(object.position));
    if (moveRef.current) {
      moveRef.current.rotation.x = mv.x;
      moveRef.current.rotation.z = mv.z;
    }
    if (fanRef.current) {
      fanRef.current.visible = on;
      fanRef.current.rotation.y = mv.spin;
      fanRef.current.rotation.x = 0;
    }
  });

  return (
    <group>
      {/* Projector head */}
      <mesh>
        <boxGeometry args={[0.3, 0.2, 0.4]} />
        <meshStandardMaterial color="#0c0e14" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.22]} material={dotMat} raycast={ignoreRaycast}>
        <circleGeometry args={[0.05, 16]} />
      </mesh>

      {/* Laser beams are not selectable — clicks pass through to objects behind. */}
      <group quaternion={baseQuat}>
        <group ref={moveRef}>
          <group ref={fanRef}>
            {spreads.map((s, i) => (
              <group key={i} rotation={[0, 0, s]}>
                <mesh geometry={glowGeo} material={glowMat} raycast={ignoreRaycast} />
                <mesh geometry={coreGeo} material={coreMat} raycast={ignoreRaycast} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}
