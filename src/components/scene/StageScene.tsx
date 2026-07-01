import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Lightformer, MeshReflectorMaterial } from '@react-three/drei';
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
  const high = useShowStore((s) => s.quality === 'high');

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

      {/* Environment reflections (procedural — no external assets), for metal.
          Subtle colored studio lights give the truss / speakers realistic specular. */}
      {high && (
        <Environment resolution={128} frames={1}>
          <Lightformer intensity={0.5} color="#3a5bd0" position={[0, 6, -10]} scale={[16, 8, 1]} />
          <Lightformer intensity={0.35} color="#e64bd6" position={[-9, 4, 4]} rotation-y={Math.PI / 3} scale={[6, 9, 1]} />
          <Lightformer intensity={0.35} color="#22d3ee" position={[9, 4, 4]} rotation-y={-Math.PI / 3} scale={[6, 9, 1]} />
          <Lightformer intensity={0.12} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        </Environment>
      )}

      {/* Floor (also the placement / deselect click target). High quality uses a
          semi-reflective floor so the beams and LED wall reflect on the deck. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} onClick={onFloorClick}>
        <planeGeometry args={[120, 120]} />
        {high ? (
          <MeshReflectorMaterial
            resolution={256}
            blur={[300, 100]}
            mixBlur={1}
            mixStrength={1.4}
            roughness={0.85}
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.2}
            color="#05060a"
            metalness={0.5}
            mirror={0.35}
          />
        ) : (
          <meshStandardMaterial color="#04050a" metalness={0.4} roughness={0.85} />
        )}
      </mesh>

      {/* Soft contact shadows ground the objects (High quality only). */}
      {high && !workLight && (
        <ContactShadows
          position={[0, 0.015, 0]}
          scale={44}
          far={16}
          blur={2.6}
          resolution={256}
          color="#000000"
          opacity={0.5}
        />
      )}
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
