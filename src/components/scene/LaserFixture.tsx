import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';
import { laserColorForObject, laserMoveForObject, laserOnForObject } from '../../utils/events';
import { laserBeamDir, laserChainPhase, laserChainPoint, laserFanRot, movementSeed } from '../../utils/movement';
import { useShowStore } from '../../store/useShowStore';
import { useShowStateRef } from './ShowStateContext';
import { ignoreRaycast } from './interaction';

const UP_DOWN = new THREE.Vector3(0, -1, 0);
const tmpColor = new THREE.Color();
const tmpDir = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
const dummy = new THREE.Object3D();
const BEAM_COUNT = 12;
const MAX_CHAIN = 500; // custom laser chain cap

/**
 * A laser projector. Preset movements shape a fan of thin beams. The 'custom'
 * movement instead sends a *chain* of beams (1..500) one after another along a
 * hand-drawn path — controlled by count, spacing and speed — rendered with an
 * instanced mesh so hundreds of beams stay cheap.
 */
export function LaserFixture({ object }: { object: SceneObject }) {
  const showRef = useShowStateRef();
  const moveRef = useRef<THREE.Group>(null);
  const beamRefs = useRef<(THREE.Group | null)[]>([]);
  const coreInst = useRef<THREE.InstancedMesh>(null);
  const glowInst = useRef<THREE.InstancedMesh>(null);

  const { baseQuat, coreGeo, glowGeo, coreUnit, glowUnit, coreMat, glowMat, dotMat } = useMemo(() => {
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

    // Unit-length beams (0 → -1 along Y) for the custom chain, scaled per beam
    // so each tip lands exactly on the drawn point (variable throw).
    const coreU = new THREE.CylinderGeometry(0.02, 0.02, 1, 6, 1, true);
    coreU.translate(0, -0.5, 0);
    const glowU = new THREE.CylinderGeometry(0.08, 0.08, 1, 8, 1, true);
    glowU.translate(0, -0.5, 0);

    const mkMat = (opacity: number) =>
      new THREE.MeshBasicMaterial({
        color: '#39ff14',
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    return { baseQuat: q, coreGeo: core, glowGeo: glow, coreUnit: coreU, glowUnit: glowU, coreMat: mkMat(0), glowMat: mkMat(0), dotMat: mkMat(0.2) };
  }, [object.position, object.target]);

  useFrame(() => {
    const state = showRef.current;
    const rgb = laserColorForObject(state, object.id);
    const lm = laserMoveForObject(state, object.id);
    tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
    const on = laserOnForObject(state, object.id) && state.blackout < 0.6;
    const intensity = on ? state.laser.intensity : 0;
    const playing = useShowStore.getState().isPlaying;
    const shimmer = playing ? 0.97 + Math.sin(state.time * 0.8) * 0.03 : 1;
    const isCustom = lm.pattern === 'custom';

    coreMat.color.copy(tmpColor);
    coreMat.opacity = on ? Math.min(1, 0.95 * intensity * shimmer) : 0;
    glowMat.color.copy(tmpColor);
    glowMat.opacity = on ? 0.32 * intensity * shimmer : 0;
    dotMat.color.copy(tmpColor);
    dotMat.opacity = on ? 1 : 0.12;

    // --- Fan presets (fixed / circular / wave / …) --------------------------
    const seed = movementSeed(object.position);
    for (let i = 0; i < BEAM_COUNT; i++) {
      const g = beamRefs.current[i];
      if (!g) continue;
      const d = laserBeamDir(lm.pattern, lm.speed, state.time, i, BEAM_COUNT, seed);
      tmpDir.set(d[0], d[1], d[2]);
      g.quaternion.setFromUnitVectors(UP_DOWN, tmpDir);
    }
    if (moveRef.current) {
      moveRef.current.visible = on && !isCustom;
      const fan = laserFanRot(lm.pattern, lm.speed, state.time, seed);
      moveRef.current.rotation.x = fan.x;
      moveRef.current.rotation.z = fan.z;
    }

    // --- Custom chain: N beams following the drawn path one after another ---
    const showChain = on && isCustom;
    if (coreInst.current) coreInst.current.visible = showChain;
    if (glowInst.current) glowInst.current.visible = showChain;
    if (showChain && coreInst.current && glowInst.current) {
      const count = Math.max(1, Math.min(MAX_CHAIN, Math.round(lm.count ?? 40)));
      const local = Math.max(0, state.time - (lm.since ?? 0));
      const dir = lm.tilt ?? 90;
      dummy.rotation.set(0, 0, 0);
      for (let i = 0; i < count; i++) {
        const p = laserChainPhase(local, lm.speed, lm.spacing ?? 3, i);
        // Point the beam from the head to the drawn point; its tip lands there,
        // so the chain of tips traces the drawing like a pencil.
        const pt = laserChainPoint(lm.path, dir, p);
        tmpVec.set(pt[0], pt[1], pt[2]);
        const len = Math.max(0.001, tmpVec.length());
        tmpDir.copy(tmpVec).multiplyScalar(1 / len);
        dummy.position.set(0, 0, 0);
        dummy.quaternion.setFromUnitVectors(UP_DOWN, tmpDir);
        dummy.scale.set(1, len, 1);
        dummy.updateMatrix();
        coreInst.current.setMatrixAt(i, dummy.matrix);
        glowInst.current.setMatrixAt(i, dummy.matrix);
      }
      dummy.scale.set(1, 1, 1);
      coreInst.current.count = count;
      glowInst.current.count = count;
      coreInst.current.instanceMatrix.needsUpdate = true;
      glowInst.current.instanceMatrix.needsUpdate = true;
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

      {/* Preset fan — aimed at the target (not selectable). */}
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

      {/* Custom chain — beams point from the head to points on the drawn shape,
          in the laser's own local frame (independent of the target aim). */}
      <instancedMesh ref={glowInst} args={[glowUnit, glowMat, MAX_CHAIN]} visible={false} frustumCulled={false} raycast={ignoreRaycast} />
      <instancedMesh ref={coreInst} args={[coreUnit, coreMat, MAX_CHAIN]} visible={false} frustumCulled={false} raycast={ignoreRaycast} />
    </group>
  );
}
