import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { StageScene } from './StageScene';
import { useShowStore } from '../../store/useShowStore';
import { Icon, type IconName } from '../ui/Icon';
import { useT } from '../../i18n/useT';

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: IconName;
  label: string;
  title: string;
}) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] backdrop-blur transition-colors ${
        active
          ? 'border-accent-cyan/40 bg-ink-900/70 text-accent-cyan'
          : 'border-ink-700/70 bg-ink-900/70 text-slate-400 hover:text-slate-200'
      }`}
      title={title}
    >
      <Icon name={icon} size={13} />
      {label}: {active ? t('state.on') : t('state.off')}
    </button>
  );
}

/** One labelled slider row inside the sky panel. */
function SkySlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-2 block">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="font-mono text-[10px] text-slate-300">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="sf-range mt-1 w-full"
      />
    </label>
  );
}

/** Sky / daylight controls: time of day and day/night natural brightness. */
function SkyControls() {
  const settings = useShowStore((s) => s.project.settings);
  const setSettings = useShowStore((s) => s.setSettings);
  const [open, setOpen] = useState(false);
  const t = useT();
  const hour = settings.timeOfDay ?? 13;
  const dayB = settings.dayBrightness ?? 1;
  const nightB = settings.nightBrightness ?? 0.12;
  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  const clock = `${hh}:${String(mm).padStart(2, '0')}`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] backdrop-blur transition-colors ${
          open ? 'border-accent-cyan/40 bg-ink-900/70 text-accent-cyan' : 'border-ink-700/70 bg-ink-900/70 text-slate-400 hover:text-slate-200'
        }`}
        title={t('sky.title')}
      >
        <Icon name="sun" size={13} /> {t('sky.title')}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-ink-700 bg-ink-900/95 p-3 shadow-2xl backdrop-blur">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Icon name="sun" size={13} className="text-accent-cyan" /> {t('sky.title')}
            </div>
            <SkySlider label={t('sky.time')} value={hour} min={0} max={24} step={0.25} display={clock} onChange={(v) => setSettings({ timeOfDay: v })} />
            <SkySlider label={t('sky.day')} value={dayB} min={0} max={2} step={0.05} display={dayB.toFixed(2)} onChange={(v) => setSettings({ dayBrightness: v })} />
            <SkySlider label={t('sky.night')} value={nightB} min={0} max={0.5} step={0.01} display={nightB.toFixed(2)} onChange={(v) => setSettings({ nightBrightness: v })} />
            <button
              onClick={() => setSettings({ fog: !settings.fog })}
              className={`mt-1 flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] ${
                settings.fog ? 'border-accent-cyan/40 text-accent-cyan' : 'border-ink-700 text-slate-400'
              }`}
            >
              <span>{t('sky.fog')}</span>
              <span>{settings.fog ? t('state.on') : t('state.off')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ViewportOverlay({
  bloom,
  onToggleBloom,
}: {
  bloom: boolean;
  onToggleBloom: () => void;
}) {
  const objectCount = useShowStore((s) => s.project.objects.length);
  const workLight = useShowStore((s) => s.workLight);
  const toggleWorkLight = useShowStore((s) => s.toggleWorkLight);
  const quality = useShowStore((s) => s.quality);
  const toggleQuality = useShowStore((s) => s.toggleQuality);
  const placementType = useShowStore((s) => s.placementType);
  const cancelPlacement = useShowStore((s) => s.cancelPlacement);
  const selectedId = useShowStore((s) => s.selectedObjectId);
  const gizmoMode = useShowStore((s) => s.gizmoMode);
  const setGizmoMode = useShowStore((s) => s.setGizmoMode);
  const t = useT();

  return (
    <>
      {/* Top-left hint chip (hidden on phones to keep the small viewport clear) */}
      <div className="pointer-events-none absolute left-3 top-3 hidden items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-900/70 px-2.5 py-1.5 text-[11px] text-slate-400 backdrop-blur md:flex">
        <Icon name="eye" size={13} className="text-accent-cyan" />
        <span>{t('viewport.hint')}</span>
      </div>

      {/* Gizmo mode toolbar (only when an object is selected) */}
      {selectedId && !placementType && (
        <div className="absolute left-3 top-14 flex items-center gap-1 rounded-lg border border-ink-700/70 bg-ink-900/80 p-1 backdrop-blur">
          {(['translate', 'rotate'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setGizmoMode(m)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                gizmoMode === m ? 'bg-accent-cyan/20 text-accent-cyan' : 'text-slate-400 hover:text-slate-200'
              }`}
              title={m === 'translate' ? t('viewport.move.title') : t('viewport.rotate.title')}
            >
              {m === 'translate' ? t('viewport.move') : t('viewport.rotate')}
              <span className="ml-1 text-slate-600">{m === 'translate' ? 'W' : 'E'}</span>
            </button>
          ))}
        </div>
      )}

      {/* Top-right view toggles (wrap on narrow screens so they stay on-screen) */}
      <div className="absolute right-3 top-3 flex max-w-[70vw] flex-wrap items-center justify-end gap-2 md:max-w-none md:flex-nowrap">
        <SkyControls />
        <ToggleButton
          active={workLight}
          onClick={toggleWorkLight}
          icon="lightbulb"
          label={t('toggle.workLight')}
          title={t('toggle.workLight.title')}
        />
        <ToggleButton
          active={bloom}
          onClick={onToggleBloom}
          icon="sparkles"
          label={t('toggle.glow')}
          title={t('toggle.glow.title')}
        />
        <button
          onClick={toggleQuality}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] backdrop-blur transition-colors ${
            quality === 'high'
              ? 'border-accent-cyan/40 bg-ink-900/70 text-accent-cyan'
              : 'border-ink-700/70 bg-ink-900/70 text-slate-400 hover:text-slate-200'
          }`}
          title={t('toggle.quality.title')}
        >
          <Icon name="box" size={13} />
          {t('toggle.quality')}: {quality === 'high' ? t('quality.high') : t('quality.low')}
        </button>
      </div>

      {/* Placement banner */}
      {placementType && (
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-accent-cyan/50 bg-ink-900/85 px-3 py-1.5 text-[11px] text-accent-cyan shadow-glow backdrop-blur">
          <Icon name="plus" size={13} />
          <span>{t('viewport.placing', { label: t(`obj.${placementType}.label`) })}</span>
          <button className="ml-1 rounded px-1.5 text-slate-400 hover:text-white" onClick={cancelPlacement}>
            Esc
          </button>
        </div>
      )}

      {objectCount === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-ink-700 bg-ink-900/80 px-6 py-4 text-center text-sm text-slate-400 backdrop-blur">
            <Icon name="box" size={26} className="mx-auto mb-2 text-slate-600" />
            {t('viewport.empty')}
          </div>
        </div>
      )}
    </>
  );
}

export function SceneViewport() {
  const selectObject = useShowStore((s) => s.selectObject);
  const placementType = useShowStore((s) => s.placementType);
  const cancelPlacement = useShowStore((s) => s.cancelPlacement);
  // Bloom defaults OFF: it flickers on some Windows/Chrome GPU+driver combos.
  // The scene glows via additive materials on its own; users can enable it.
  const [bloom, setBloom] = useState(false);

  // Crosshair cursor while a library item is armed for placement.
  useEffect(() => {
    document.body.style.cursor = placementType ? 'crosshair' : 'default';
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [placementType]);

  // Esc cancels placement.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && placementType) cancelPlacement();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placementType, cancelPlacement]);

  return (
    <div
      className="relative h-full w-full bg-gradient-to-b from-[#070912] to-[#03040a]"
      style={placementType ? { cursor: 'crosshair' } : undefined}
      // Right-click anywhere in the viewport clears the selection (a left-click
      // on empty space keeps it, so orbiting the camera never deselects).
      onContextMenu={(e) => {
        e.preventDefault();
        selectObject(null);
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ position: [12, 8, 15], fov: 42, near: 0.1, far: 1200 }}
      >
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
        {bloom && (
          <EffectComposer multisampling={0}>
            {/* Gentle, temporally-stable bloom. No mipmapBlur: its per-frame mip
                selection shimmers on moving bright features (beams/lasers/LED),
                which is the main cause of flicker during playback. A plain
                large-kernel blur with a high threshold + smoothing is steadier.
                multisampling={0} avoids MSAA-resolve flicker on some drivers. */}
            <Bloom
              intensity={0.5}
              luminanceThreshold={0.72}
              luminanceSmoothing={0.6}
              kernelSize={KernelSize.LARGE}
            />
            <Vignette eskil={false} offset={0.28} darkness={0.7} />
          </EffectComposer>
        )}
      </Canvas>
      <ViewportOverlay bloom={bloom} onToggleBloom={() => setBloom((b) => !b)} />
    </div>
  );
}
