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

// How far (px) the pointer may travel between press and release and still count
// as a "click" (select) rather than a drag (orbit / move).
const CLICK_SLOP = 5;

// Shared scratch objects for the drag math (single-threaded, so safe to share).
const UP = new THREE.Vector3(0, 1, 0);
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _planePt = new THREE.Vector3();

interface GroundDrag {
  /** Fixed height while sliding on the ground. */
  y: number;
  /** Cursor→centre offset so the object keeps its grab point under the pointer. */
  offX: number;
  offZ: number;
  /** Where the drag began (for the committed delta / vertical plane). */
  startX: number;
  startY: number;
  startZ: number;
  /** Shift-drag raises / lowers instead of sliding on the floor. */
  vertical: boolean;
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
  const placeObject = useShowStore((s) => s.placeObject);
  const nudgeSelection = useShowStore((s) => s.nudgeSelection);
  const updateObject = useShowStore((s) => s.updateObject);
  const addObjectAt = useShowStore((s) => s.addObjectAt);
  const placementType = useShowStore((s) => s.placementType);
  const gizmoMode = useShowStore((s) => s.gizmoMode);
  const gizmoActive = useShowStore((s) => s.gizmoActive);
  const selected = useShowStore((s) => s.selectedObjectId === object.id);
  const highlighted = useShowStore((s) => isHighlighted(s, object.id));

  // Movement is opt-in: only the *selected* object, only once you've pressed
  // Move (translate tool). Everything else is a plain click-to-select body, so
  // nothing slides by accident and other objects never react to this one's move.
  const canMove = selected && gizmoActive && gizmoMode === 'translate' && !placementType;
  const showRotate = selected && gizmoActive && gizmoMode === 'rotate' && !placementType;

  const [node, setNode] = useState<THREE.Group | null>(null);
  const [box, setBox] = useState<THREE.Box3 | null>(null);
  const dragStart = useRef<THREE.Vector3 | null>(null);

  // Camera / renderer for projecting the pointer onto the ground while dragging.
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const ground = useRef<GroundDrag | null>(null);
  // Screen position of the press, to tell a click (select) from a drag (orbit).
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

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

  // World height under the pointer on a vertical plane through the object,
  // facing the camera — used for Shift-drag (raise / lower).
  const heightAt = useCallback(
    (clientX: number, clientY: number, at: GroundDrag): number | null => {
      const rect = gl.domElement.getBoundingClientRect();
      _ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(_ndc, camera);
      camera.getWorldDirection(_camDir);
      _camDir.y = 0;
      if (_camDir.lengthSq() < 1e-4) return null;
      _camDir.normalize();
      _planePt.set(at.startX, at.startY, at.startZ);
      _plane.setFromNormalAndCoplanarPoint(_camDir, _planePt);
      return raycaster.ray.intersectPlane(_plane, _hit) ? _hit.y : null;
    },
    [camera, gl, raycaster],
  );

  const onDragMove = useCallback(
    (e: PointerEvent) => {
      const d = ground.current;
      if (!d || !node) return;
      const st = useShowStore.getState();
      const settings = { collisions: st.collisions, gridSnap: st.gridSnap, gridSize: st.gridSize, magnet: st.magnet };
      let desired: Vec3;
      if (d.vertical) {
        const h = heightAt(e.clientX, e.clientY, d);
        if (h == null) return;
        desired = [d.startX, Math.max(0, Math.min(40, h)), d.startZ];
      } else {
        const g = groundAt(e.clientX, e.clientY, d.y);
        if (!g) return;
        desired = [g.x + d.offX, d.y, g.z + d.offZ];
      }
      const pos = resolvePlacement(st.project.objects, object.id, object.type, object.scale, desired, settings);
      node.position.set(pos[0], pos[1], pos[2]);
      d.moved = true;
    },
    [node, groundAt, heightAt, object.id, object.type, object.scale],
  );

  const onDragUp = useCallback(() => {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    if (controls) controls.enabled = true;
    document.body.style.cursor = 'default';
    pointerDown.current = null;
    const d = ground.current;
    ground.current = null;
    if (!d || !node || !d.moved) return;
    // Commit the *exact* previewed position (no second resolve pass), so the
    // object stays precisely where it was dropped.
    const p = node.position;
    if (d.multi) nudgeSelection([p.x - d.startX, p.y - d.startY, p.z - d.startZ]);
    else placeObject(object.id, [p.x, p.y, p.z]);
  }, [onDragMove, controls, node, placeObject, nudgeSelection, object.id]);

  // In placement mode a click drops the armed object at the clicked point.
  // Dropping a light / laser straight onto a structure clips (rigs) it there.
  const placeAt = useCallback(
    (point: THREE.Vector3) => {
      if (!placementType) return;
      if (isStructure(object.type) && isRiggable(placementType)) {
        addObjectAt(placementType, [round(point.x), round(point.y), round(point.z)], object.id);
      } else {
        const defY = (CATALOG_BY_TYPE[placementType].defaults.position?.[1] ?? 1) as number;
        addObjectAt(placementType, [round(point.x), defY, round(point.z)]);
      }
    },
    [placementType, object.type, object.id, addObjectAt],
  );

  // Press on the body: remember where, and — only when this object is armed for
  // moving — begin a grab-and-slide drag. Otherwise it's a candidate click that
  // resolves on release (so orbiting the camera never selects or moves anything).
  const onBodyPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0 || !node) return;
      e.stopPropagation();
      pointerDown.current = { x: e.clientX, y: e.clientY };
      if (!canMove) return;
      const vertical = e.nativeEvent.shiftKey;
      const y = object.position[1];
      const g = groundAt(e.clientX, e.clientY, y);
      const sel = useShowStore.getState().selectedObjectIds;
      ground.current = {
        y,
        offX: object.position[0] - (g?.x ?? object.position[0]),
        offZ: object.position[2] - (g?.z ?? object.position[2]),
        startX: object.position[0],
        startY: object.position[1],
        startZ: object.position[2],
        vertical,
        moved: false,
        multi: sel.length > 1 && sel.includes(object.id),
      };
      if (controls) controls.enabled = false; // freeze the camera while sliding
      document.body.style.cursor = vertical ? 'ns-resize' : 'grabbing';
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragUp);
    },
    [canMove, node, object.id, object.position, groundAt, controls, onDragMove, onDragUp],
  );

  // Release on the body: a clean click (barely moved) selects / places. A press
  // that travelled was an orbit or a slide — it must NOT change the selection.
  const onBodyPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const dn = pointerDown.current;
      pointerDown.current = null;
      if (!dn || e.button !== 0) return;
      if (Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > CLICK_SLOP) return;
      e.stopPropagation();
      if (placementType) {
        placeAt(e.point);
      } else if (e.nativeEvent.shiftKey) {
        toggleSelectObject(object.id);
      } else {
        selectObject(object.id);
      }
    },
    [placementType, placeAt, object.id, toggleSelectObject, selectObject],
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

  // Cursor feedback: an armed object invites a grab; anything else is clickable.
  const cursorFor = canMove ? 'grab' : placementType ? 'crosshair' : 'pointer';

  return (
    <>
      <group
        ref={setNode}
        position={object.position}
        rotation={object.rotation}
        scale={object.scale}
        onPointerDown={onBodyPointerDown}
        onPointerUp={onBodyPointerUp}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!ground.current) document.body.style.cursor = cursorFor;
        }}
        onPointerOut={() => {
          if (!ground.current) document.body.style.cursor = 'default';
        }}
      >
        {renderBody(object)}
      </group>

      {highlighted && box && <box3Helper args={[box, 0xffffff]} ref={tuneHelper} />}

      {/* Move mode: a soft ground ring under the object signals "grab to slide". */}
      {canMove && (
        <mesh position={[object.position[0], 0.03, object.position[2]]} rotation={[-Math.PI / 2, 0, 0]} raycast={ignoreRaycast}>
          <ringGeometry args={[0.9, 1.15, 40]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
        </mesh>
      )}

      {/* Rotate tool: the drei ring gizmo (X/Y only). Move uses grab-and-slide. */}
      {showRotate && node && (
        <TransformControls
          object={node}
          mode="rotate"
          size={0.85}
          showZ={false}
          onMouseDown={() => {
            dragStart.current = node.position.clone();
          }}
          onMouseUp={() => {
            const r = node.rotation;
            const r3 = (n: number) => Math.round(n * 1000) / 1000;
            updateObject(object.id, { rotation: [r3(r.x), r3(r.y), r3(r.z)] });
            dragStart.current = null;
          }}
        />
      )}
    </>
  );
}
