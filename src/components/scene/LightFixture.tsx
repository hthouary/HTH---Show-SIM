import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';
import { lightForObject } from '../../utils/events';
import { useShowStore } from '../../store/useShowStore';
import { useShowStateRef } from './ShowStateContext';
import { makeBeamMaterial } from './beam';
import { getGlowTexture } from './textures';
import { ignoreRaycast } from './interaction';

const UP_DOWN = new THREE.Vector3(0, -1, 0);
const tmpColor = new THREE.Color();

interface Props {
  object: SceneObject;
}

/**
 * A light fixture (moving head / beam / strobe / blinder): a small body plus a
 * real SpotLight and a volumetric shader cone so the beam is visible in the air.
 * The cone diverges with distance and fades into the atmosphere; the fixture
 * reads the live show-state each frame for color, intensity, strobe and sweep.
 */
export function LightFixture({ object }: Props) {
  const showRef = useShowStateRef();
  const swingRef = useRef<THREE.Group>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const lensRef = useRef<THREE.MeshStandardMaterial>(null);
  const flareRef = useRef<THREE.Sprite>(null);

  const glowTex = useMemo(() => getGlowTexture(), []);

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
    // Beams throw well past the target and dissolve into the air; the floor
    // naturally occludes the part that dips below ground.
    const len = THREE.MathUtils.clamp(dist * 2.2, 14, 34);
    const radius = Math.tan(ang) * len; // divergence: wider the further it goes
    const geo = new THREE.ConeGeometry(radius, len, 30, 1, true);
    geo.translate(0, -len / 2, 0);
    const mat = makeBeamMaterial(len);
    const target = new THREE.Object3D();
    target.position.set(0, -dist, 0);
    return { baseQuat: q, throwLen: len, coneGeo: geo, beamMat: mat, targetObj: target, angleRad: ang };
  }, [object.position, object.target, object.beamAngle]);

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

    // When paused, everything is perfectly frozen (no per-frame motion at all).
    const playing = useShowStore.getState().isPlaying;

    // Volumetric beam — steady; only a barely-perceptible slow breath while playing.
    // Opacity is a bit stronger so beams glow well even without bloom.
    const breathe = playing ? 0.98 + Math.sin(t * 0.5 + object.position[0]) * 0.02 : 1;
    beamMat.uniforms.uColor.value.copy(tmpColor);
    beamMat.uniforms.uOpacity.value = Math.min(0.95, eff * 0.62) * breathe;

    // Glowing lens + camera-facing flare.
    if (lensRef.current) {
      lensRef.current.color.copy(tmpColor);
      lensRef.current.emissive.copy(tmpColor);
      lensRef.current.emissiveIntensity = Math.min(5, eff * 3);
    }
    if (flareRef.current) {
      const mat = flareRef.current.material as THREE.SpriteMaterial;
      mat.color.copy(tmpColor);
      mat.opacity = Math.min(1, eff * 1.0);
      // Larger, brighter camera-facing flare compensates for the lack of bloom.
      const s = 0.75 + Math.min(1.9, eff * 1.4);
      flareRef.current.scale.setScalar(s);
    }

    // Sweep / idle sway — pivots from the lens like a real moving head.
    // The idle sway only runs while playing so a paused scene is dead still.
    if (swingRef.current) {
      const sway = playing ? Math.sin(t * 0.8 + object.position[0]) * 0.045 : 0;
      swingRef.current.rotation.z = light.sweep * 0.4 + sway;
      swingRef.current.rotation.x = playing ? Math.sin(t * 0.5 + object.position[2]) * 0.045 : 0;
    }
  });

  return (
    <group>
      {/* Yoke / body */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.34, 0.16, 0.34]} />
        <meshStandardMaterial color="#1a1d26" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.22, 16]} />
        <meshStandardMaterial color="#0d0f15" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Beam group aims at the target; swing pivots from the lens. */}
      <group quaternion={baseQuat}>
        <group ref={swingRef}>
          {/* Lens */}
          <mesh position={[0, -0.02, 0]}>
            <circleGeometry args={[0.13, 24]} />
            <meshStandardMaterial ref={lensRef} color="#ffffff" emissive="#ffffff" emissiveIntensity={1} side={THREE.DoubleSide} />
          </mesh>
          {/* Camera-facing lens flare (not selectable — click through it) */}
          <sprite ref={flareRef} position={[0, -0.03, 0]} scale={0.6} raycast={ignoreRaycast}>
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

          {/* Volumetric beam cone (not selectable — clicks pass through to
              whatever object is lit underneath it). */}
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
