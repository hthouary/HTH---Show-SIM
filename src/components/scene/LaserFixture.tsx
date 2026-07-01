import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';
import { laserColorForObject, laserMoveForObject, laserOnForObject } from '../../utils/events';
import { laserBeamDir, laserFanRot, movementSeed } from '../../utils/movement';
import { useShowStore } from '../../store/useShowStore';
import { useShowStateRef } from './ShowStateContext';
import { ignoreRaycast } from './interaction';

const UP_DOWN = new THREE.Vector3(0, -1, 0);
const tmpColor = new THREE.Color();
const tmpDir = new THREE.Vector3();
const BEAM_COUNT = 12;

/**
 * A laser projector: a head plus a long fan of thin beams that only appear
 * while a `laser_on` event is active. Each beam is a razor-thin bright core
 * wrapped in a soft additive glow.
 *
 * The movement preset shapes the *figure the beams draw* in the haze, by
 * orienting each beam individually every frame:
 *  - circular   → the beams form a cone / ring (a circle) that rotates around
 *                 its axis — stand in the middle and they turn around you;
 *  - wave       → a horizontal sheet of beams that ripples like a travelling
 *                 wave — stand underneath and it moves like a wave;
 *  - up / left  → a plain fan swung up-down / left-right as a whole;
 *  - fixed      → a static fan.
 */
export function LaserFixture({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const moveRef = useRef<THREE.Group>(null);
  const beamRefs = useRef<(THREE.Group | null)[]>([]);

  const { baseQuat, coreGeo, glowGeo, coreMat, glowMat, dotMat } = useMemo(() => {
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
      coreMat: mkMat(0),
      glowMat: mkMat(0),
      dotMat: mkMat(0.2),
    };
  }, [object.position, object.target]);

  useFrame(() => {
    const state = showRef.current;
    const rgb = laserColorForObject(state, object.id);
    const lm = laserMoveForObject(state, object.id);
    tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
    const on = laserOnForObject(state, object.id) && state.blackout < 0.6;
    const intensity = on ? state.laser.intensity : 0;
    const playing = useShowStore.getState().isPlaying;
    // Steady beams, only a very slow shimmer while playing (frozen when paused).
    const shimmer = playing ? 0.97 + Math.sin(state.time * 0.8) * 0.03 : 1;

    coreMat.color.copy(tmpColor);
    coreMat.opacity = on ? Math.min(1, 0.95 * intensity * shimmer) : 0;
    glowMat.color.copy(tmpColor);
    glowMat.opacity = on ? 0.32 * intensity * shimmer : 0;
    dotMat.color.copy(tmpColor);
    dotMat.opacity = on ? 1 : 0.12;

    // Shape the fan: orient each beam so the projected figure (circle / wave / …)
    // forms and animates. Phase uses the show time, so it stays in sync with
    // playback, scrubs correctly and freezes when paused.
    const seed = movementSeed(object.position);
    for (let i = 0; i < BEAM_COUNT; i++) {
      const g = beamRefs.current[i];
      if (!g) continue;
      const d = laserBeamDir(lm.pattern, lm.speed, state.time, i, BEAM_COUNT, seed);
      tmpDir.set(d[0], d[1], d[2]);
      g.quaternion.setFromUnitVectors(UP_DOWN, tmpDir);
    }

    // Whole-fan pan / tilt for the presets that swing the fan as one.
    if (moveRef.current) {
      moveRef.current.visible = on;
      const fan = laserFanRot(lm.pattern, lm.speed, state.time, seed);
      moveRef.current.rotation.x = fan.x;
      moveRef.current.rotation.z = fan.z;
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
          {Array.from({ length: BEAM_COUNT }).map((_, i) => (
            <group key={i} ref={(el) => (beamRefs.current[i] = el)}>
              <mesh geometry={glowGeo} material={glowMat} raycast={ignoreRaycast} />
              <mesh geometry={coreGeo} material={coreMat} raycast={ignoreRaycast} />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
