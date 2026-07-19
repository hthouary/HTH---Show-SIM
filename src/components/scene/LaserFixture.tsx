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
 * A laser beam cylinder (0 at the source → -length far away) carrying a per-vertex
 * `aT` (0..1 along its length) so a shader can fade it into the distance — real
 * beams stay razor-thin and travel very far, dimming with atmospheric scatter.
 */
function beamCyl(rTop: number, rBot: number, length: number, seg: number): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, length, seg, 1, true);
  g.translate(0, -length / 2, 0);
  const pos = g.attributes.position;
  const aT = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) aT[i] = Math.min(1, Math.max(0, -pos.getY(i) / length));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  return g;
}

const BEAM_VERT = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    vec4 mv = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      mv = instanceMatrix * mv;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * mv;
  }
`;

const BEAM_FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFadePow;
  varying float vT;
  void main() {
    // Bright at the aperture, fading into the distance (never a hard end).
    float fade = pow(1.0 - vT, uFadePow);
    gl_FragColor = vec4(uColor, uOpacity * fade);
  }
`;

/** Additive laser-beam material with a length fade (shared by fan + chain). */
function makeBeamMat(fadePow: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#39ff14') },
      uOpacity: { value: 0 },
      uFadePow: { value: fadePow },
    },
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * A laser projector. Preset movements shape a fan of thin beams. The 'custom'
 * movement instead sends a *chain* of beams (1..500) one after another along a
 * hand-drawn path — controlled by count, spacing and speed — rendered with an
 * instanced mesh so hundreds of beams stay cheap. Beams throw a long way and
 * fade into the atmosphere, like real lasers cutting through haze.
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
    // Very long throw — beams read as near-infinite, razor-thin rays that only
    // dissolve into the atmosphere at the far end (shader length-fade).
    const len = THREE.MathUtils.clamp(dist * 12, 500, 1000);
    const dir = rel.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP_DOWN, dir);

    // Thin core + tight halo, held to a near-constant width down the whole run
    // so the ray stays crisp far away instead of fanning out into a cone.
    const core = beamCyl(0.007, 0.011, len, 6);
    const glow = beamCyl(0.022, 0.04, len, 8);

    // Unit-length beams (0 → -1 along Y) for the custom chain, scaled per beam
    // so each tip lands exactly on the drawn point (variable throw).
    const coreU = beamCyl(0.01, 0.01, 1, 6);
    const glowU = beamCyl(0.04, 0.04, 1, 8);

    const dot = new THREE.MeshBasicMaterial({
      color: '#39ff14',
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return {
      baseQuat: q,
      coreGeo: core,
      glowGeo: glow,
      coreUnit: coreU,
      glowUnit: glowU,
      coreMat: makeBeamMat(0.5), // razor core barely fades → carries very far
      glowMat: makeBeamMat(1.1), // halo scatters closer, fades a touch faster
      dotMat: dot,
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
    const shimmer = playing ? 0.97 + Math.sin(state.time * 0.8) * 0.03 : 1;
    const isCustom = lm.pattern === 'custom';

    coreMat.uniforms.uColor.value.copy(tmpColor);
    coreMat.uniforms.uOpacity.value = on ? Math.min(1, 0.95 * intensity * shimmer) : 0;
    glowMat.uniforms.uColor.value.copy(tmpColor);
    glowMat.uniforms.uOpacity.value = on ? 0.32 * intensity * shimmer : 0;
    dotMat.color.copy(tmpColor);
    dotMat.opacity = on ? 1 : 0.12;

    // --- Fan presets (fixed / circular / wave / …) --------------------------
    // A transition eases each beam direction (and the whole-fan swing) from this
    // movement toward the next cue's, so the fan morphs smoothly between shapes.
    const seed = movementSeed(object.position);
    const bt = lm.blendTo;
    const bf = bt && lm.blendFactor ? lm.blendFactor : 0;
    for (let i = 0; i < BEAM_COUNT; i++) {
      const g = beamRefs.current[i];
      if (!g) continue;
      const d = laserBeamDir(lm.pattern, lm.speed, state.time, i, BEAM_COUNT, seed);
      let dx = d[0];
      let dy = d[1];
      let dz = d[2];
      if (bf > 0 && bt && bt.pattern !== 'custom') {
        const d2 = laserBeamDir(bt.pattern, bt.speed, state.time, i, BEAM_COUNT, seed);
        dx += (d2[0] - dx) * bf;
        dy += (d2[1] - dy) * bf;
        dz += (d2[2] - dz) * bf;
      }
      tmpDir.set(dx, dy, dz);
      g.quaternion.setFromUnitVectors(UP_DOWN, tmpDir);
    }
    if (moveRef.current) {
      moveRef.current.visible = on && !isCustom;
      const fan = laserFanRot(lm.pattern, lm.speed, state.time, seed);
      let fx = fan.x;
      let fz = fan.z;
      if (bf > 0 && bt && bt.pattern !== 'custom') {
        const fan2 = laserFanRot(bt.pattern, bt.speed, state.time, seed);
        fx += (fan2.x - fx) * bf;
        fz += (fan2.z - fz) * bf;
      }
      moveRef.current.rotation.x = fx;
      moveRef.current.rotation.z = fz;
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
      {/* Projector housing */}
      <mesh>
        <boxGeometry args={[0.36, 0.26, 0.46]} />
        <meshStandardMaterial color="#0c0e14" metalness={0.72} roughness={0.32} />
      </mesh>
      {/* Heat-sink fins on top */}
      {[-0.12, -0.04, 0.04, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]}>
          <boxGeometry args={[0.03, 0.06, 0.4]} />
          <meshStandardMaterial color="#15181f" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* Mounting bracket + clamp */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.3, 0.04, 0.3]} />
        <meshStandardMaterial color="#1a1d26" metalness={0.6} roughness={0.45} />
      </mesh>
      {/* Front aperture plate + emissive aperture window */}
      <mesh position={[0, 0, 0.235]}>
        <boxGeometry args={[0.38, 0.28, 0.03]} />
        <meshStandardMaterial color="#05060a" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.255]} material={dotMat} raycast={ignoreRaycast}>
        <circleGeometry args={[0.055, 18]} />
      </mesh>

      {/* Preset fan — aimed at the target (not selectable). Long beams are kept
          from being frustum-culled by their own (rotating) bounds. */}
      <group quaternion={baseQuat}>
        <group ref={moveRef}>
          {Array.from({ length: BEAM_COUNT }).map((_, i) => (
            <group key={i} ref={(el) => (beamRefs.current[i] = el)}>
              <mesh geometry={glowGeo} material={glowMat} raycast={ignoreRaycast} frustumCulled={false} />
              <mesh geometry={coreGeo} material={coreMat} raycast={ignoreRaycast} frustumCulled={false} />
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
