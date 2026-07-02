import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useShowStore } from '../../store/useShowStore';
import { CATALOG_BY_TYPE } from '../../data/catalog';
import { evaluateEvents } from '../../utils/events';
import { getConcreteTexture } from './textures';
import { ShowStateContext, type ShowStateRef } from './ShowStateContext';
import { SkyEnvironment } from './SkyEnvironment';
import { SceneObject } from './SceneObject';

const round = (n: number) => Math.round(n * 10) / 10;

export function StageScene() {
  const objects = useShowStore((s) => s.project.objects);
  const events = useShowStore((s) => s.project.events);
  const placementType = useShowStore((s) => s.placementType);
  const addObjectAt = useShowStore((s) => s.addObjectAt);
  const high = useShowStore((s) => s.quality === 'high');
  const workLight = useShowStore((s) => s.workLight);
  const showGrid = useShowStore((s) => s.showGrid);
  const gridSize = useShowStore((s) => s.gridSize);

  const concrete = useMemo(() => getConcreteTexture(), []);

  // A left-click on the floor only places (in placement mode) — it never
  // deselects, so orbiting the camera keeps the current selection.
  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    if (!placementType) return;
    e.stopPropagation();
    const defY = (CATALOG_BY_TYPE[placementType].defaults.position?.[1] ?? 1) as number;
    addObjectAt(placementType, [round(e.point.x), defY, round(e.point.z)]);
  };

  const showRef = useRef(evaluateEvents(events, 0)) as ShowStateRef;
  const flashRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const t = useShowStore.getState().currentTime;
    const state = evaluateEvents(events, t);
    showRef.current = state;

    const black = 1 - state.blackout;
    // A strobe gate punches a bright global flash over the natural lighting.
    if (flashRef.current) {
      const strobing = state.light.strobing ? state.light.strobe : 0;
      flashRef.current.intensity = strobing * 2.4 * black;
      flashRef.current.color.setRGB(state.light.color[0], state.light.color[1], state.light.color[2]);
    }
  });

  return (
    <ShowStateContext.Provider value={showRef}>
      {/* Natural sky + daylight (time-of-day driven). */}
      <SkyEnvironment />

      {/* Global strobe flash (show cue). */}
      <pointLight ref={flashRef} position={[0, 7, 2]} intensity={0} distance={60} decay={0.6} />

      {/* Work Light ("god mode"): flat, neutral, bright lighting so the whole
          scene is easy to see while building — independent of the sky / show. */}
      {workLight && (
        <group>
          <ambientLight intensity={1.5} color="#eef3ff" />
          <hemisphereLight args={['#eef3ff', '#565b66', 1.0]} />
          <directionalLight position={[10, 16, 8]} intensity={2.1} color="#ffffff" />
          <directionalLight position={[-9, 11, -6]} intensity={1.0} color="#cfe0ff" />
        </group>
      )}

      {/* Concrete ground — the surface you build on (also the placement target). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} onClick={onFloorClick} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={concrete} color="#ffffff" roughness={0.96} metalness={0.02} />
      </mesh>

      {/* Soft contact shadows ground the objects (High quality only). */}
      {high && !workLight && (
        <ContactShadows position={[0, 0.02, 0]} scale={44} far={16} blur={2.6} resolution={256} color="#000000" opacity={0.45} />
      )}

      {/* Optional build grid — a subtle guide, not decoration. */}
      {showGrid && (
        <Grid
          position={[0, 0.015, 0]}
          args={[80, 80]}
          cellSize={gridSize}
          cellThickness={0.5}
          cellColor="#464c55"
          sectionSize={gridSize * 5}
          sectionThickness={0.9}
          sectionColor="#5b636e"
          fadeDistance={70}
          fadeStrength={1.5}
          infiniteGrid
          followCamera={false}
        />
      )}

      {objects.map((o) => (
        <SceneObject key={o.id} object={o} />
      ))}
    </ShowStateContext.Provider>
  );
}
