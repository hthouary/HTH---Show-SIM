import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject, SceneObjectType } from '../../types/show';
import { lightForObject } from '../../utils/events';
import { customMovement, movementRotation, movementSeed } from '../../utils/movement';
import { useShowStore } from '../../store/useShowStore';
import { useShowStateRef } from './ShowStateContext';
import { makeBeamMaterial } from './beam';
import { getGlowTexture } from './textures';
import { ignoreRaycast } from './interaction';

const UP_DOWN = new THREE.Vector3(0, -1, 0);
const tmpColor = new THREE.Color();

type FixtureKind = 'head' | 'strobe' | 'blinder';

function kindOf(type: SceneObjectType): FixtureKind {
  if (type === 'strobe') return 'strobe';
  if (type === 'blinder') return 'blinder';
  return 'head';
}

interface Props {
  object: SceneObject;
}

/**
 * A light fixture rendered as recognisable touring gear:
 *  - moving heads / beams: a base, a U-yoke and a tilting head with a lit lens;
 *  - strobes: a rectangular LED panel behind a wire guard;
 *  - blinders: a square frame holding a 2×2 array of lamps.
 * All share a real SpotLight plus a volumetric shader cone so the beam is
 * visible in the haze, and read the live show-state each frame for colour,
 * intensity, strobe and sweep.
 */
export function LightFixture({ object }: Props) {
  const showRef = useShowStateRef();
  const swingRef = useRef<THREE.Group>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const flareRef = useRef<THREE.Sprite>(null);

  const glowTex = useMemo(() => getGlowTexture(), []);
  const kind = kindOf(object.type);
  const isWash = object.type === 'moving_head_wash';
  const barrelR = isWash ? 0.2 : 0.14;

  // A single emissive material shared by every glowing face (lens / panel /
  // lamps), driven live in useFrame so the fixture visibly reacts.
  const emissiveMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 1,
        roughness: 0.4,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(() => () => emissiveMat.dispose(), [emissiveMat]);

  // Beam geometry + material — relative to the fixture, aimed at its target.
  const { baseQuat, throwLen, coneGeo, beamMat, targetObj, angleRad } = useMemo(() => {
    const rel = new THREE.Vector3(
      object.target[0] - object.position[0],
      object.target[1] - object.position[1],
      object.target[2] - object.position[2],
    );
    const dist = Math.max(rel.length(), 4);
    const dir = rel.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP_DOWN, dir);
    const ang = THREE.MathUtils.degToRad(Math.min(Math.max(object.beamAngle, 1), 60));
    const len = THREE.MathUtils.clamp(dist * 2.2, 14, 34);
    const radius = Math.tan(ang) * len;
    const geo = new THREE.ConeGeometry(radius, len, 30, 1, true);
    geo.translate(0, -len / 2, 0);
    const mat = makeBeamMaterial(len);
    const target = new THREE.Object3D();
    target.position.set(0, -dist, 0);
    return { baseQuat: q, throwLen: len, coneGeo: geo, beamMat: mat, targetObj: target, angleRad: ang };
  }, [object.position, object.target, object.beamAngle]);

  useEffect(() => () => {
    coneGeo.dispose();
    beamMat.dispose();
  }, [coneGeo, beamMat]);

  const attached = useRef(false);
  useFrame(({ clock }) => {
    const state = showRef.current;
    const light = lightForObject(state, object.id);
    const t = clock.elapsedTime;

    const blackout = 1 - state.blackout;
    const strobeGate = light.strobing ? light.strobe : 1;
    const eff = object.intensity * light.intensity * strobeGate * blackout;
    tmpColor.setRGB(light.color[0], light.color[1], light.color[2]);

    // Real light hitting the stage.
    if (spotRef.current) {
      if (!attached.current && swingRef.current) {
        swingRef.current.add(targetObj);
        spotRef.current.target = targetObj;
        attached.current = true;
      }
      spotRef.current.color.copy(tmpColor);
      spotRef.current.intensity = eff * 16;
    }

    const playing = useShowStore.getState().isPlaying;

    // Volumetric beam — steady; a barely-perceptible slow breath while playing.
    const breathe = playing ? 0.98 + Math.sin(t * 0.5 + object.position[0]) * 0.02 : 1;
    beamMat.uniforms.uColor.value.copy(tmpColor);
    // Panels (strobe/blinder) throw a softer wash than a focused head beam.
    const beamStrength = kind === 'head' ? 0.62 : 0.34;
    beamMat.uniforms.uOpacity.value = Math.min(0.95, eff * beamStrength) * breathe;

    // Glowing lens / panel / lamps.
    emissiveMat.color.copy(tmpColor);
    emissiveMat.emissive.copy(tmpColor);
    emissiveMat.emissiveIntensity = Math.min(6, eff * (kind === 'blinder' ? 4 : 3));

    // Camera-facing flare (head fixtures only).
    if (flareRef.current) {
      const mat = flareRef.current.material as THREE.SpriteMaterial;
      mat.color.copy(tmpColor);
      mat.opacity = Math.min(1, eff);
      const s = 0.6 + Math.min(1.7, eff * 1.3);
      flareRef.current.scale.setScalar(s);
    }

    // Beam movement — driven by timeline "Movement" events (pattern + speed).
    if (swingRef.current) {
      const m = light.move;
      const mv =
        m.pattern === 'custom'
          ? customMovement(m.path, m.tilt ?? 90, m.cycle ?? 2, m.speed, m.amp ?? 50, m.repeat ?? 'loop', state.time, m.since ?? 0)
          : movementRotation(m.pattern, m.speed, state.time, movementSeed(object.position));
      swingRef.current.rotation.z = mv.z;
      swingRef.current.rotation.x = mv.x;
    }
  });

  return (
    <group>
      {/* Static mount: clamp hooking over the truss + housing base (fixtures hang). */}
      <mesh position={[0, 0.36, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.16]} />
        <meshStandardMaterial color="#0b0d13" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.36, 0.16, 0.36]} />
        <meshStandardMaterial color="#1a1d26" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Aim group points the head at the target; swing adds live movement. */}
      <group quaternion={baseQuat}>
        {/* U-yoke arms for the moving-head kinds (aim, but don't jitter). */}
        {kind === 'head' && (
          <group>
            <mesh position={[barrelR + 0.06, -0.02, 0]}>
              <boxGeometry args={[0.05, 0.5, 0.18]} />
              <meshStandardMaterial color="#15181f" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[-(barrelR + 0.06), -0.02, 0]}>
              <boxGeometry args={[0.05, 0.5, 0.18]} />
              <meshStandardMaterial color="#15181f" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <boxGeometry args={[2 * (barrelR + 0.06) + 0.05, 0.06, 0.18]} />
              <meshStandardMaterial color="#15181f" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        )}

        <group ref={swingRef}>
          {kind === 'head' && (
            <>
              {/* Head barrel + rear cap */}
              <mesh position={[0, -0.08, 0]}>
                <cylinderGeometry args={[barrelR, barrelR + 0.02, 0.3, 26]} />
                <meshStandardMaterial color="#0d0f15" metalness={0.7} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.09, 0]}>
                <cylinderGeometry args={[barrelR - 0.03, barrelR, 0.1, 26]} />
                <meshStandardMaterial color="#1a1d26" metalness={0.6} roughness={0.4} />
              </mesh>
              {/* Bezel ring + lit lens */}
              <mesh position={[0, -0.235, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[barrelR, 0.02, 10, 26]} />
                <meshStandardMaterial color="#05060a" metalness={0.7} roughness={0.4} />
              </mesh>
              <mesh position={[0, -0.24, 0]} material={emissiveMat}>
                <circleGeometry args={[barrelR - 0.02, 26]} />
              </mesh>
            </>
          )}

          {kind === 'strobe' && (
            <>
              {/* Rectangular housing */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.82, 0.14, 0.5]} />
                <meshStandardMaterial color="#15181f" metalness={0.6} roughness={0.45} />
              </mesh>
              {/* Flash surface (faces the target, -Y) */}
              <mesh position={[0, -0.075, 0]} material={emissiveMat}>
                <boxGeometry args={[0.72, 0.02, 0.42]} />
              </mesh>
              {/* Wire guard bars */}
              {[-0.24, 0, 0.24].map((x) => (
                <mesh key={x} position={[x, -0.1, 0]}>
                  <boxGeometry args={[0.015, 0.015, 0.44]} />
                  <meshStandardMaterial color="#05060a" metalness={0.6} roughness={0.5} />
                </mesh>
              ))}
            </>
          )}

          {kind === 'blinder' && (
            <>
              {/* Square frame */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.78, 0.12, 0.78]} />
                <meshStandardMaterial color="#15181f" metalness={0.6} roughness={0.45} />
              </mesh>
              {/* 2×2 lamp array on the front face */}
              {[-0.18, 0.18].map((x) =>
                [-0.18, 0.18].map((z) => (
                  <group key={`${x}_${z}`} position={[x, -0.065, z]}>
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[0.16, 0.17, 0.05, 20]} />
                      <meshStandardMaterial color="#0a0c12" metalness={0.6} roughness={0.4} />
                    </mesh>
                    <mesh position={[0, -0.03, 0]} material={emissiveMat}>
                      <circleGeometry args={[0.14, 20]} />
                    </mesh>
                  </group>
                )),
              )}
            </>
          )}

          {/* Camera-facing lens flare — head fixtures only (not selectable). */}
          {kind === 'head' && (
            <sprite ref={flareRef} position={[0, -0.24, 0]} scale={0.6} raycast={ignoreRaycast}>
              <spriteMaterial
                map={glowTex}
                color="#ffffff"
                transparent
                opacity={0.6}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                depthTest={false}
              />
            </sprite>
          )}

          {/* Volumetric beam cone (not selectable — clicks pass through). */}
          <mesh geometry={coneGeo} material={beamMat} renderOrder={2} raycast={ignoreRaycast} />

          <spotLight
            ref={spotRef}
            position={[0, 0, 0]}
            angle={angleRad}
            penumbra={0.45}
            distance={throwLen * 1.6}
            decay={0}
            intensity={0}
            castShadow={false}
          />
        </group>
      </group>
    </group>
  );
}
