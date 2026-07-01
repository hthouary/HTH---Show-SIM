import { useState } from 'react';
import { TransformControls } from '@react-three/drei';
import { type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject as SceneObjectModel } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
import { CATALOG_BY_TYPE } from '../../data/catalog';
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

const round = (n: number) => Math.round(n * 10) / 10;

export function SceneObject({ object }: { object: SceneObjectModel }) {
  const selectObject = useShowStore((s) => s.selectObject);
  const moveObject = useShowStore((s) => s.moveObject);
  const addObjectAt = useShowStore((s) => s.addObjectAt);
  const placementType = useShowStore((s) => s.placementType);
  const selected = useShowStore((s) => s.selectedObjectId === object.id);

  const [node, setNode] = useState<THREE.Group | null>(null);

  // In placement mode a click drops the armed object at the clicked point.
  const placeAt = (point: THREE.Vector3) => {
    if (!placementType) return;
    const defY = (CATALOG_BY_TYPE[placementType].defaults.position?.[1] ?? 1) as number;
    addObjectAt(placementType, [round(point.x), defY, round(point.z)]);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (placementType) placeAt(e.point);
    else selectObject(object.id);
  };

  const showGizmo = selected && !placementType;

  return (
    <>
      <group
        ref={setNode}
        position={object.position}
        rotation={object.rotation}
        scale={object.scale}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!placementType) document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          if (!placementType) document.body.style.cursor = 'default';
        }}
      >
        {renderBody(object)}
      </group>

      {showGizmo && node && (
        <TransformControls
          object={node}
          mode="translate"
          size={0.85}
          onMouseUp={() => {
            const p = node.position;
            moveObject(object.id, [p.x, p.y, p.z]);
          }}
        />
      )}
    </>
  );
}
