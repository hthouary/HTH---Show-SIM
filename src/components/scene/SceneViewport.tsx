import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { StageScene } from './StageScene';
import { useShowStore } from '../../store/useShowStore';
import { Icon } from '../ui/Icon';

function ViewportOverlay() {
  const objectCount = useShowStore((s) => s.project.objects.length);
  return (
    <>
      {/* Top-left hint chip */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-900/70 px-2.5 py-1.5 text-[11px] text-slate-400 backdrop-blur">
        <Icon name="eye" size={13} className="text-accent-cyan" />
        <span>Drag to orbit · Scroll to zoom · Click to select</span>
      </div>
      {objectCount === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-ink-700 bg-ink-900/80 px-6 py-4 text-center text-sm text-slate-400 backdrop-blur">
            <Icon name="box" size={26} className="mx-auto mb-2 text-slate-600" />
            The stage is empty — add objects from the Library on the left.
          </div>
        </div>
      )}
    </>
  );
}

export function SceneViewport() {
  const selectObject = useShowStore((s) => s.selectObject);

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-[#070912] to-[#03040a]">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        camera={{ position: [12, 8, 15], fov: 42, near: 0.1, far: 300 }}
        onPointerMissed={() => selectObject(null)}
      >
        <color attach="background" args={['#04050a']} />
        <Suspense fallback={null}>
          <StageScene />
        </Suspense>
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={[0, 3, 0]}
          minDistance={5}
          maxDistance={60}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.25} luminanceSmoothing={0.3} radius={0.7} />
          <Vignette eskil={false} offset={0.25} darkness={0.8} />
        </EffectComposer>
      </Canvas>
      <ViewportOverlay />
    </div>
  );
}
