import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject as SceneObjectModel } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
import { LightFixture } from './LightFixture';
import { LaserFixture } from './LaserFixture';
import { LedScreen } from './LedScreen';
import { SmokeEffect } from './SmokeEffect';
import { FlameEffect } from './FlameEffect';
import { CO2Effect } from './CO2Effect';
import { ConfettiEffect } from './ConfettiEffect';
import { CrowdBlock, DjBooth, Speaker, StagePlatform, Truss } from './props';

function renderBody(object: SceneObjectModel) {
  switch (object.type) {
    case 'stage_platform':
      return <StagePlatform object={object} />;
    case 'truss':
      return <Truss object={object} />;
    case 'speaker':
      return <Speaker object={object} />;
    case 'dj_booth':
      return <DjBooth object={object} />;
    case 'crowd_block':
      return <CrowdBlock object={object} />;
    case 'led_screen':
      return <LedScreen />;
    case 'moving_head_spot':
    case 'moving_head_wash':
    case 'beam_light':
    case 'strobe':
    case 'blinder':
      return <LightFixture object={object} />;
    case 'laser':
      return <LaserFixture object={object} />;
    case 'smoke_machine':
      return <SmokeEffect object={object} />;
    case 'flame_jet':
      return <FlameEffect object={object} />;
    case 'co2_jet':
      return <CO2Effect object={object} />;
    case 'confetti_cannon':
      return <ConfettiEffect object={object} />;
    default:
      return null;
  }
}

/** A pulsing ground ring drawn under the selected object as a gizmo footprint. */
function SelectionRing({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.06;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <group ref={ref} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 48]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.05, 48]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.07} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function SceneObject({ object }: { object: SceneObjectModel }) {
  const selectObject = useShowStore((s) => s.selectObject);
  const selected = useShowStore((s) => s.selectedObjectId === object.id);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectObject(object.id);
  };

  return (
    <>
      <group
        position={object.position}
        rotation={object.rotation}
        scale={object.scale}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        {renderBody(object)}
      </group>
      {selected && <SelectionRing position={[object.position[0], 0.04, object.position[2]]} />}
    </>
  );
}
