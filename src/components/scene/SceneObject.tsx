import { useLayoutEffect, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import { type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject as SceneObjectModel } from '../../types/show';
import { useShowStore, isHighlighted } from '../../store/useShowStore';
import { CATALOG_BY_TYPE } from '../../data/catalog';
import { LightFixture } from './LightFixture';
import { LaserFixture } from './LaserFixture';
import { LedScreen } from './LedScreen';
import { SmokeEffect } from './SmokeEffect';
import { FlameEffect } from './FlameEffect';
import { CO2Effect } from './CO2Effect';
import { ConfettiEffect } from './ConfettiEffect';
import { CrowdBlock, DjBooth, Speaker, StagePlatform, Truss } from './props';
import { ignoreRaycast } from './interaction';

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

/** Configure the white selection outline so it reads clearly (shows through). */
function tuneHelper(h: THREE.Box3Helper | null) {
  if (!h) return;
  const m = h.material as THREE.LineBasicMaterial;
  m.toneMapped = false;
  m.transparent = true;
  m.opacity = 0.85;
  m.depthTest = false;
  h.renderOrder = 999;
}

export function SceneObject({ object }: { object: SceneObjectModel }) {
  const selectObject = useShowStore((s) => s.selectObject);
  const moveObject = useShowStore((s) => s.moveObject);
  const updateObject = useShowStore((s) => s.updateObject);
  const addObjectAt = useShowStore((s) => s.addObjectAt);
  const placementType = useShowStore((s) => s.placementType);
  const gizmoMode = useShowStore((s) => s.gizmoMode);
  const selected = useShowStore((s) => s.selectedObjectId === object.id);
  const highlighted = useShowStore((s) => isHighlighted(s, object.id));

  const [node, setNode] = useState<THREE.Group | null>(null);
  const [box, setBox] = useState<THREE.Box3 | null>(null);

  // A white outline box around the object's *body* (excluding the long beams /
  // laser fans / particle fields), recomputed when it becomes highlighted or moves.
  useLayoutEffect(() => {
    if (!highlighted || !node || object.hidden) {
      setBox(null);
      return;
    }
    node.updateWorldMatrix(true, true);
    const acc = new THREE.Box3();
    const tmp = new THREE.Box3();
    const size = new THREE.Vector3();
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      // Beams / laser fans / particles / flares are marked non-raycastable — they
      // are light, not body, so exclude them from the selection outline.
      if (m.raycast === ignoreRaycast) return;
      tmp.setFromObject(m);
      if (tmp.isEmpty()) return;
      tmp.getSize(size);
      if (Math.max(size.x, size.y, size.z) <= 40) acc.union(tmp);
    });
    if (acc.isEmpty()) {
      setBox(null);
      return;
    }
    acc.expandByScalar(0.12);
    setBox(acc);
  }, [highlighted, node, object.hidden, object.type, object.position, object.rotation, object.scale]);

  if (object.hidden) return null;

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

      {highlighted && box && <box3Helper args={[box, 0xffffff]} ref={tuneHelper} />}

      {showGizmo && node && (
        <TransformControls
          object={node}
          mode={gizmoMode}
          size={0.85}
          // Rotation is restricted to the X and Y axes (no Z ring).
          showZ={gizmoMode !== 'rotate'}
          onMouseUp={() => {
            if (gizmoMode === 'rotate') {
              const r = node.rotation;
              const r3 = (n: number) => Math.round(n * 1000) / 1000;
              updateObject(object.id, { rotation: [r3(r.x), r3(r.y), r3(r.z)] });
            } else {
              const p = node.position;
              moveObject(object.id, [p.x, p.y, p.z]);
            }
          }}
        />
      )}
    </>
  );
}
