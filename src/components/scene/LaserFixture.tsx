import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';
import { laserColorForObject } from '../../utils/events';
import { useShowStateRef } from './ShowStateContext';

const UP_DOWN = new THREE.Vector3(0, -1, 0);
const tmpColor = new THREE.Color();

const BEAM_COUNT = 9;

/**
 * A laser projector: a small head plus a fan of thin additive beams that only
 * appear while a `laser_on` event is active. The fan slowly sweeps for life.
 */
export function LaserFixture({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const fanRef = useRef<THREE.Group>(null);

  const { baseQuat, geo, spreads, beamMat, dotMat } = useMemo(() => {
    const rel = new THREE.Vector3(
      object.target[0] - object.position[0],
      object.target[1] - object.position[1],
      object.target[2] - object.position[2],
    );
    const len = Math.max(rel.length(), 8);
    const dir = rel.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP_DOWN, dir);
    const g = new THREE.CylinderGeometry(0.015, 0.04, len, 6, 1, true);
    g.translate(0, -len / 2, 0);
    const sp = Array.from({ length: BEAM_COUNT }, (_, i) => (i / (BEAM_COUNT - 1) - 0.5) * 0.7);
    const mat = new THREE.MeshBasicMaterial({
      color: '#39ff14',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const dot = new THREE.MeshBasicMaterial({
      color: '#39ff14',
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
    });
    return { baseQuat: q, geo: g, spreads: sp, beamMat: mat, dotMat: dot };
  }, [object.position, object.target]);

  useFrame(({ clock }) => {
    const state = showRef.current;
    const rgb = laserColorForObject(state, object.id);
    tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
    const on = state.laser.active && state.blackout < 0.6;
    const intensity = on ? state.laser.intensity : 0;

    beamMat.color.copy(tmpColor);
    beamMat.opacity = on ? 0.55 * intensity * (0.85 + Math.sin(clock.elapsedTime * 24) * 0.15) : 0;
    dotMat.color.copy(tmpColor);
    dotMat.opacity = on ? 0.9 : 0.15;

    if (fanRef.current) {
      fanRef.current.visible = on;
      fanRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.5;
      fanRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.9) * 0.12;
    }
  });

  return (
    <group>
      {/* Projector head */}
      <mesh>
        <boxGeometry args={[0.3, 0.2, 0.4]} />
        <meshStandardMaterial color="#0c0e14" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.22]} material={dotMat}>
        <circleGeometry args={[0.06, 16]} />
      </mesh>

      <group quaternion={baseQuat}>
        <group ref={fanRef}>
          {spreads.map((s, i) => (
            <mesh key={i} geometry={geo} material={beamMat} rotation={[0, 0, s]} />
          ))}
        </group>
      </group>
    </group>
  );
}
