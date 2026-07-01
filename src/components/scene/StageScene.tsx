import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useShowStore } from '../../store/useShowStore';
import { CATALOG_BY_TYPE } from '../../data/catalog';
import { evaluateEvents } from '../../utils/events';
import { ShowStateContext, type ShowStateRef } from './ShowStateContext';
import { SceneObject } from './SceneObject';

const round = (n: number) => Math.round(n * 10) / 10;

export function StageScene({ workLight = false }: { workLight?: boolean }) {
  const objects = useShowStore((s) => s.project.objects);
  const events = useShowStore((s) => s.project.events);
  const fog = useShowStore((s) => s.project.settings.fog);
  const placementType = useShowStore((s) => s.placementType);
  const addObjectAt = useShowStore((s) => s.addObjectAt);
  const selectObject = useShowStore((s) => s.selectObject);

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (placementType) {
      const defY = (CATALOG_BY_TYPE[placementType].defaults.position?.[1] ?? 1) as number;
      addObjectAt(placementType, [round(e.point.x), defY, round(e.point.z)]);
    } else {
      selectObject(null);
    }
  };

  const showRef = useRef(evaluateEvents(events, 0)) as ShowStateRef;
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const flashRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const t = useShowStore.getState().currentTime;
    const state = evaluateEvents(events, t);
    showRef.current = state;

    const black = 1 - state.blackout;
    // Base fill dims under blackout; a strobe gate punches a bright global flash.
    if (ambientRef.current) ambientRef.current.intensity = 0.12 * black;
    if (flashRef.current) {
      const strobing = state.light.strobing ? state.light.strobe : 0;
      flashRef.current.intensity = strobing * 2.4 * black;
      flashRef.current.color.setRGB(state.light.color[0], state.light.color[1], state.light.color[2]);
    }
  });

  return (
    <ShowStateContext.Provider value={showRef}>
      {/* Fog is disabled in Work Light mode so distant objects stay clearly visible. */}
      {fog && !workLight && <fogExp2 attach="fog" args={['#05060a', 0.018]} />}

      {/* Ambient / fill */}
      <ambientLight ref={ambientRef} intensity={0.12} />
      <hemisphereLight args={['#223', '#000', 0.18]} />
      <pointLight ref={flashRef} position={[0, 7, 2]} intensity={0} distance={60} decay={0.6} />

      {/* Work Light ("god mode"): flat, neutral, bright lighting so the whole
          scene is easy to see while building — independent of the show state. */}
      {workLight && (
        <group>
          <ambientLight intensity={1.8} color="#eef3ff" />
          <hemisphereLight args={['#eef3ff', '#4a5060', 1.1]} />
          <directionalLight position={[10, 16, 8]} intensity={2.4} color="#ffffff" />
          <directionalLight position={[-9, 11, -6]} intensity={1.1} color="#cfe0ff" />
          <directionalLight position={[0, 6, 14]} intensity={0.8} color="#ffffff" />
        </group>
      )}

      {/* Floor + grid (also the placement / deselect click target) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow onClick={onFloorClick}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#04050a" metalness={0.4} roughness={0.85} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[80, 80]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#16202e"
        sectionSize={5}
        sectionThickness={1.1}
        sectionColor="#1f6f86"
        fadeDistance={55}
        fadeStrength={1.4}
        infiniteGrid
        followCamera={false}
      />

      {/* Backdrop wall behind the stage */}
      <mesh position={[0, 8, -9]}>
        <planeGeometry args={[60, 24]} />
        <meshStandardMaterial color="#06070d" roughness={1} metalness={0} />
      </mesh>

      {objects.map((o) => (
        <SceneObject key={o.id} object={o} />
      ))}
    </ShowStateContext.Provider>
  );
}
