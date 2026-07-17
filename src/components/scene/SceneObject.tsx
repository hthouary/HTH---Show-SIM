import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject as SceneObjectModel, Vec3 } from '../../types/show';
import { useShowStore, isHighlighted } from '../../store/useShowStore';
import { CATALOG_BY_TYPE, isRiggable, isStructure } from '../../data/catalog';
import { resolvePlacement } from '../../utils/collision';
import { LightFixture } from './LightFixture';
import { LaserFixture } from './LaserFixture';
import { LedScreen } from './LedScreen';
import { SmokeEffect } from './SmokeEffect';
import { FlameEffect } from './FlameEffect';
import { CO2Effect } from './CO2Effect';
import { ConfettiEffect } from './ConfettiEffect';
import {
  Barrier,
  BarStand,
  Bush,
  CrowdBlock,
  DjBooth,
  FencePanel,
  FlagPole,
  FohTower,
  FoodStand,
  Portaloo,
  Speaker,
  StagePlatform,
  Tent,
  Tree,
  Truss,
  TrussArch,
  TrussTower,
} from './props';
import { ignoreRaycast } from './interaction';

function renderBody(object: SceneObjectModel) {
  switch (object.type) {
    case 'stage_platform':
      return <StagePlatform object={object} />;
    case 'truss':
      return <Truss object={object} />;
    case 'truss_tower':
      return <TrussTower object={object} />;
    case 'truss_arch':
      return <TrussArch object={object} />;
    case 'speaker':
      return <Speaker object={object} />;
    case 'dj_booth':
      return <DjBooth object={object} />;
    case 'crowd_block':
      return <CrowdBlock object={object} />;
    case 'barrier':
      return <Barrier object={object} />;
    case 'foh_tower':
      return <FohTower object={object} />;
    case 'tree':
      return <Tree object={object} />;
    case 'bush':
      return <Bush object={object} />;
    case 'bar_stand':
      return <BarStand object={object} />;
    case 'food_stand':
      return <FoodStand object={object} />;
    case 'tent':
      return <Tent object={object} />;
    case 'portaloo':
      return <Portaloo object={object} />;
    case 'flag_pole':
      return <FlagPole object={object} />;
    case 'fence_panel':
      return <FencePanel object={object} />;
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

// Shared scratch objects for the ground-drag math (single-threaded, so safe).
const UP = new THREE.Vector3(0, 1, 0);
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();

interface GroundDrag {
  y: number;
  offX: number;
  offZ: number;
  startX: number;
  startZ: number;
  moved: boolean;
  multi: boolean;
}

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
  const toggleSelectObject = useShowStore((s) => s.toggleSelectObject);
  const moveObject = useShowStore((s) => s.moveObject);
  const nudgeSelection = useShowStore((s) => s.nudgeSelection);
  const updateObject = useShowStore((s) => s.updateObject);
  const addObjectAt = useShowStore((s) => s.addObjectAt);
  const placementType = useShowStore((s) => s.placementType);
  const gizmoMode = useShowStore((s) => s.gizmoMode);
  const selected = useShowStore((s) => s.selectedObjectId === object.id);
  const multi = useShowStore((s) => s.selectedObjectIds.length > 1);
  const highlighted = useShowStore((s) => isHighlighted(s, object.id));

  const [node, setNode] = useState<THREE.Group | null>(null);
  const [box, setBox] = useState<THREE.Box3 | null>(null);
  const dragStart = useRef<THREE.Vector3 | null>(null);

  // Camera / renderer for projecting the pointer onto the ground while dragging.
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const ground = useRef<GroundDrag | null>(null);
  const justDragged = useRef(false);

  // Project a screen point onto the horizontal plane at height `y`.
  const groundAt = useCallback(
    (clientX: number, clientY: number, y: number): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      _ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(_ndc, camera);
      _plane.set(UP, -y);
      return raycaster.ray.intersectPlane(_plane, _hit) ? _hit : null;
    },
    [camera, gl, raycaster],
  );

  const onDragMove = useCallback(
    (e: PointerEvent) => {
      const d = ground.current;
      if (!d || !node) return;
      const g = groundAt(e.clientX, e.clientY, d.y);
      if (!g) return;
      const st = useShowStore.getState();
      const desired: Vec3 = [g.x + d.offX, d.y, g.z + d.offZ];
      const pos = resolvePlacement(st.project.objects, object.id, object.type, object.scale, desired, {
        collisions: st.collisions,
        gridSnap: st.gridSnap,
        gridSize: st.gridSize,
        magnet: st.magnet,
      });
      node.position.set(pos[0], pos[1], pos[2]);
      d.moved = true;
    },
    [node, groundAt, object.id, object.type, object.scale],
  );

  const onDragUp = useCallback(() => {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    if (controls) controls.enabled = true;
    document.body.style.cursor = 'default';
    const d = ground.current;
    ground.current = null;
    if (!d || !node || !d.moved) return;
    justDragged.current = true; // suppress the click-select that follows
    const p = node.position;
    if (d.multi) nudgeSelection([p.x - d.startX, 0, p.z - d.startZ]);
    else moveObject(object.id, [p.x, p.y, p.z]);
  }, [onDragMove, controls, node, moveObject, nudgeSelection, object.id]);

  // Grab the object body and drag it across the floor (fast, direct move).
  // Selection stays on click (handleClick) so Shift-click isn't toggled twice;
  // a drag moves this object by id regardless, and a group move applies when it
  // is part of an existing multi-selection.
  const onBodyPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (placementType || e.button !== 0 || !node) return;
      e.stopPropagation();
      const y = object.position[1];
      const g = groundAt(e.clientX, e.clientY, y);
      if (!g) return;
      const sel = useShowStore.getState().selectedObjectIds;
      ground.current = {
        y,
        offX: object.position[0] - g.x,
        offZ: object.position[2] - g.z,
        startX: object.position[0],
        startZ: object.position[2],
        moved: false,
        multi: sel.length > 1 && sel.includes(object.id),
      };
      if (controls) controls.enabled = false; // don't orbit while dragging an object
      document.body.style.cursor = 'grabbing';
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragUp);
    },
    [placementType, node, object.id, object.position, groundAt, controls, onDragMove, onDragUp],
  );

  // Solid bodies cast / receive the sun's shadows. Beams, flares and particles
  // are marked non-raycastable or use non-standard materials — skipped, so the
  // light a fixture throws never casts a shadow itself.
  useLayoutEffect(() => {
    if (!node) return;
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.raycast === ignoreRaycast) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && mat.isMeshStandardMaterial) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [node, object.type]);

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
  // Dropping a light / laser straight onto a structure clips (rigs) it there.
  const placeAt = (point: THREE.Vector3) => {
    if (!placementType) return;
    if (isStructure(object.type) && isRiggable(placementType)) {
      addObjectAt(placementType, [round(point.x), round(point.y), round(point.z)], object.id);
    } else {
      const defY = (CATALOG_BY_TYPE[placementType].defaults.position?.[1] ?? 1) as number;
      addObjectAt(placementType, [round(point.x), defY, round(point.z)]);
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // A drag just moved the object — don't also treat the release as a click.
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    if (placementType) placeAt(e.point);
    else if (e.nativeEvent.shiftKey) toggleSelectObject(object.id);
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
        onPointerDown={onBodyPointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!placementType && !ground.current) document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          if (!placementType && !ground.current) document.body.style.cursor = 'default';
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
          onMouseDown={() => {
            dragStart.current = node.position.clone();
          }}
          onMouseUp={() => {
            if (gizmoMode === 'rotate') {
              const r = node.rotation;
              const r3 = (n: number) => Math.round(n * 1000) / 1000;
              updateObject(object.id, { rotation: [r3(r.x), r3(r.y), r3(r.z)] });
            } else if (multi && dragStart.current) {
              // Group move: shift the whole selection by the anchor's delta.
              const p = node.position;
              const d: Vec3 = [p.x - dragStart.current.x, p.y - dragStart.current.y, p.z - dragStart.current.z];
              nudgeSelection(d);
            } else {
              const p = node.position;
              moveObject(object.id, [p.x, p.y, p.z]);
            }
            dragStart.current = null;
          }}
        />
      )}
    </>
  );
}
