import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { StageScene } from './StageScene';
import { useShowStore } from '../../store/useShowStore';
import { Icon, type IconName } from '../ui/Icon';
import { HypeMeter } from '../ui/HypeUI';
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
      <span className="hidden sm:inline">
        {label}: {active ? t('state.on') : t('state.off')}
      </span>
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
        <Icon name="sun" size={13} />
        <span className="hidden sm:inline">{t('sky.title')}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-ink-700 bg-ink-900/95 p-3 shadow-2xl backdrop-blur">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Icon name="sun" size={13} className="text-accent-cyan" /> {t('sky.title')}
            </div>
            {/* Quick day / night presets */}
            <div className="mb-3 flex gap-2">
              <button
                className="btn flex-1 justify-center"
                onClick={() => setSettings({ timeOfDay: 13 })}
              >
                <Icon name="sun" size={13} /> {t('sky.presetDay')}
              </button>
              <button
                className="btn flex-1 justify-center"
                onClick={() => setSettings({ timeOfDay: 22 })}
              >
                <Icon name="moon" size={13} /> {t('sky.presetNight')}
              </button>
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

const LIVE_PADS: { type: import('../../types/show').ShowEventType; icon: IconName; hotkey: string; color: string }[] = [
  { type: 'flame_burst', icon: 'flame', hotkey: '1', color: '#ff7b1c' },
  { type: 'co2_burst', icon: 'snow', hotkey: '2', color: '#bfe3ff' },
  { type: 'confetti_burst', icon: 'party', hotkey: '3', color: '#e64bd6' },
  { type: 'smoke_burst', icon: 'cloud', hotkey: '4', color: '#9fb0c8' },
  { type: 'light_strobe', icon: 'sparkles', hotkey: '5', color: '#ffffff' },
  { type: 'laser_on', icon: 'laser', hotkey: '6', color: '#39ff14' },
  { type: 'blackout', icon: 'stop', hotkey: '7', color: '#f43f5e' },
];

/**
 * Live pads (VJ mode): tap / press 1–7 to fire FX at the playhead in real time.
 * REC also stamps every trigger into the timeline on "Live" lanes, so a live
 * performance becomes a recorded show.
 */
function LivePads() {
  const appMode = useShowStore((s) => s.appMode);
  const playMode = useShowStore((s) => s.playMode);
  const trigger = useShowStore((s) => s.triggerLive);
  const rec = useShowStore((s) => s.liveRecord);
  const toggleRec = useShowStore((s) => s.toggleLiveRecord);
  const t = useT();
  if (appMode !== 'show' || playMode !== 'game') return null;
  return (
    <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-ink-700/70 bg-ink-900/85 p-1.5 backdrop-blur sm:gap-1.5">
      <span className="hidden px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 md:inline">
        {t('live.title')}
      </span>
      {LIVE_PADS.map((p) => (
        <button
          key={p.type}
          onPointerDown={() => trigger(p.type)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-lg border border-ink-700 bg-ink-850 transition-transform hover:border-ink-500 active:scale-90 sm:h-11 sm:w-11"
          style={{ color: p.color }}
          title={`${t(`evt.${p.type}`)} (${p.hotkey})`}
        >
          <Icon name={p.icon} size={16} />
          <span className="hidden font-mono text-[8px] text-slate-600 sm:block">{p.hotkey}</span>
        </button>
      ))}
      <button
        onClick={toggleRec}
        className={`ml-1 flex h-10 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold sm:h-11 ${
          rec ? 'border-rose-500/60 bg-rose-500/15 text-rose-300' : 'border-ink-700 bg-ink-850 text-slate-500 hover:text-slate-300'
        }`}
        title={t('live.rec.title')}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${rec ? 'animate-pulse bg-rose-500' : 'bg-slate-600'}`} />
        REC
      </button>
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
  const sound = useShowStore((s) => s.sound);
  const toggleSound = useShowStore((s) => s.toggleSound);
  const quality = useShowStore((s) => s.quality);
  const toggleQuality = useShowStore((s) => s.toggleQuality);
  const placementType = useShowStore((s) => s.placementType);
  const cancelPlacement = useShowStore((s) => s.cancelPlacement);
  const selectedId = useShowStore((s) => s.selectedObjectId);
  const selectedCount = useShowStore((s) => s.selectedObjectIds.length);
  const gizmoMode = useShowStore((s) => s.gizmoMode);
  const setGizmoMode = useShowStore((s) => s.setGizmoMode);
  const duplicateSelection = useShowStore((s) => s.duplicateSelection);
  const deleteObject = useShowStore((s) => s.deleteObject);
  const selectObject = useShowStore((s) => s.selectObject);
  const buildMode = useShowStore((s) => s.appMode === 'build');
  const t = useT();

  return (
    <>
      {/* Top-left hint chip (hidden on phones to keep the small viewport clear) */}
      <div className="pointer-events-none absolute left-3 top-3 hidden items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-900/70 px-2.5 py-1.5 text-[11px] text-slate-400 backdrop-blur md:flex">
        <Icon name="eye" size={13} className="text-accent-cyan" />
        <span>{t('viewport.hint')}</span>
      </div>

      {/* Top-right view toggles (wrap on narrow screens so they stay on-screen) */}
      <div className="absolute right-3 top-3 flex max-w-[70vw] flex-wrap items-center justify-end gap-2 md:max-w-none md:flex-nowrap">
        <SkyControls />
        <ToggleButton
          active={sound}
          onClick={toggleSound}
          icon="speaker"
          label={t('toggle.sound')}
          title={t('toggle.sound.title')}
        />
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
          <span className="hidden sm:inline">
            {t('toggle.quality')}: {quality === 'high' ? t('quality.high') : t('quality.low')}
          </span>
        </button>
      </div>

      {/* Top-centre guidance — one of: placing / selection actions / build tip. */}
      <div className="absolute left-1/2 top-3 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 justify-center">
        {placementType ? (
          <div className="flex items-center gap-2 rounded-lg border border-accent-cyan/50 bg-ink-900/90 px-3 py-1.5 text-[11px] text-accent-cyan shadow-glow backdrop-blur">
            <Icon name="hand" size={14} />
            <span>{t('viewport.placing', { label: t(`obj.${placementType}.label`) })}</span>
            <button className="ml-1 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white" onClick={cancelPlacement}>
              Esc
            </button>
          </div>
        ) : selectedId ? (
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-ink-700/70 bg-ink-900/90 p-1 shadow-lg backdrop-blur">
            <span className="hidden px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:inline">
              {selectedCount > 1 ? t('sel.count', { n: selectedCount }) : t('sel.selected')}
            </span>
            <ActionBtn active={gizmoMode === 'translate'} icon="hand" label={t('viewport.move')} onClick={() => setGizmoMode('translate')} />
            <ActionBtn active={gizmoMode === 'rotate'} icon="rotate" label={t('viewport.rotate')} onClick={() => setGizmoMode('rotate')} />
            <span className="mx-0.5 h-6 w-px bg-ink-700" />
            <ActionBtn icon="copy" label={t('action.duplicate')} onClick={duplicateSelection} />
            <ActionBtn icon="trash" label={t('action.delete')} danger onClick={() => selectedId && deleteObject(selectedId)} />
            <ActionBtn icon="close" label={t('inspector.deselect')} onClick={() => selectObject(null)} />
          </div>
        ) : buildMode ? (
          <div className="pointer-events-none flex items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-900/80 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-accent-cyan/20 text-[9px] font-bold text-accent-cyan">1</span>
            <span>{t('guide.build')}</span>
          </div>
        ) : null}
      </div>

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

/** Compact labelled button used in the selection action bar. */
function ActionBtn({
  icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-accent-cyan/20 text-accent-cyan'
          : danger
            ? 'text-slate-300 hover:bg-rose-500/15 hover:text-rose-300'
            : 'text-slate-300 hover:bg-ink-700 hover:text-white'
      }`}
    >
      <Icon name={icon} size={14} />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export function SceneViewport() {
  const selectObject = useShowStore((s) => s.selectObject);
  const placementType = useShowStore((s) => s.placementType);
  const cancelPlacement = useShowStore((s) => s.cancelPlacement);
  const appMode = useShowStore((s) => s.appMode);
  const playModeIsGame = useShowStore((s) => s.playMode === 'game');
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
        shadows
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
      {appMode === 'show' && playModeIsGame && <HypeMeter />}
      <LivePads />
    </div>
  );
}
