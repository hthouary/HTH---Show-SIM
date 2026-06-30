import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject } from '../../types/show';
import { lightForObject } from '../../utils/events';
import { useShowStateRef } from './ShowStateContext';

const UP_DOWN = new THREE.Vector3(0, -1, 0);
const tmpColor = new THREE.Color();

interface Props {
  object: SceneObject;
}

/**
 * A light fixture (moving head / beam / strobe / blinder): a small body plus a
 * real SpotLight and an additive "volumetric" cone so the beam is visible in
 * the air. The fixture reads the live show-state each frame to drive its color,
 * intensity, strobe gate and sweep — pivoting from the lens like a real head.
 */
export function LightFixture({ object }: Props) {
  const showRef = useShowStateRef();
  const swingRef = useRef<THREE.Group>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const coneMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const lensRef = useRef<THREE.MeshStandardMaterial>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Beam geometry — relative to the fixture, aimed at its target point.
  const { baseQuat, length, coneGeo, targetObj } = useMemo(() => {
    const rel = new THREE.Vector3(
      object.target[0] - object.position[0],
      object.target[1] - object.position[1],
      object.target[2] - object.position[2],
    );
    const len = Math.max(rel.length(), 3);
    const dir = rel.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP_DOWN, dir);
    const angle = THREE.MathUtils.degToRad(Math.min(Math.max(object.beamAngle, 1), 60));
    const radius = Math.tan(angle) * len;
    // Cone: apex at local origin (the lens), opening downward to -Y * length.
    const geo = new THREE.ConeGeometry(radius, len, 28, 1, true);
    geo.translate(0, -len / 2, 0);
    const target = new THREE.Object3D();
    target.position.set(0, -len, 0);
    return { baseQuat: q, length: len, coneGeo: geo, targetObj: target };
  }, [object.position, object.target, object.beamAngle]);

  // Attach the spotlight target once.
  const attachedTarget = useRef(false);
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
      if (!attachedTarget.current && swingRef.current) {
        swingRef.current.add(targetObj);
        spotRef.current.target = targetObj;
        attachedTarget.current = true;
      }
      spotRef.current.color.copy(tmpColor);
      spotRef.current.intensity = eff * 14;
    }

    // Visible beam volume.
    if (coneMatRef.current) {
      coneMatRef.current.color.copy(tmpColor);
      const flicker = 0.92 + Math.sin(t * 30 + object.position[0]) * 0.04;
      coneMatRef.current.opacity = Math.min(0.5, eff * 0.16) * flicker;
    }

    // Glowing lens.
    if (lensRef.current) {
      lensRef.current.color.copy(tmpColor);
      lensRef.current.emissive.copy(tmpColor);
      lensRef.current.emissiveIntensity = Math.min(4, eff * 2.4);
    }
    if (glowRef.current) {
      const s = 0.18 + Math.min(0.5, eff * 0.3);
      glowRef.current.scale.setScalar(s);
      (glowRef.current.material as THREE.MeshBasicMaterial).color.copy(tmpColor);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, eff * 0.7);
    }

    // Sweep / idle sway — pivots from the lens.
    if (swingRef.current) {
      const sway = Math.sin(t * 0.8 + object.position[0]) * 0.05;
      swingRef.current.rotation.z = light.sweep * 0.35 + sway;
      swingRef.current.rotation.x = Math.sin(t * 0.5) * 0.04;
    }
  });

  return (
    <group>
      {/* Yoke / body */}
      <mesh position={[0, 0.12, 0]} castShadow={false}>
        <boxGeometry args={[0.34, 0.16, 0.34]} />
        <meshStandardMaterial color="#1a1d26" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.22, 16]} />
        <meshStandardMaterial color="#0d0f15" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Beam group aims toward the target; swing pivots from the lens. */}
      <group quaternion={baseQuat}>
        <group ref={swingRef}>
          {/* Lens */}
          <mesh position={[0, -0.02, 0]}>
            <circleGeometry args={[0.14, 24]} />
            <meshStandardMaterial ref={lensRef} color="#ffffff" emissive="#ffffff" emissiveIntensity={1} side={THREE.DoubleSide} />
          </mesh>
          {/* Soft glow sprite-ish sphere */}
          <mesh ref={glowRef} position={[0, -0.02, 0]} scale={0.2}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>

          {/* Volumetric beam cone */}
          <mesh geometry={coneGeo}>
            <meshBasicMaterial
              ref={coneMatRef}
              color="#ffffff"
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          <spotLight
            ref={spotRef}
            position={[0, 0, 0]}
            angle={THREE.MathUtils.degToRad(Math.min(Math.max(object.beamAngle, 1), 60))}
            penumbra={0.4}
            distance={length * 1.4}
            decay={0}
            intensity={0}
            castShadow={false}
          />
        </group>
      </group>
    </group>
  );
}
