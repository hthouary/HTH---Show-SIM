import { useMemo, useRef } from 'react';
import { useShowStore } from '../../store/useShowStore';
import { TRACKS } from '../../data/catalog';
import type { TrackId } from '../../types/show';
import { audioEngine, formatTime } from '../../utils/audio';
import { Icon } from '../ui/Icon';
import { AudioControls } from './AudioControls';
import { BpmControls } from './BpmControls';
import { EventBlock } from './EventBlock';
import { useT } from '../../i18n/useT';

const RULER_H = 22;
const WAVE_H = 40;
const TRACK_H = 30;

function NoAudioLabel() {
  const t = useT();
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-slate-600">
      {t('timeline.noAudio')}
    </span>
  );
}

/** Time ruler with second graduations. */
function Ruler() {
  const duration = useShowStore((s) => s.duration);
  const step = duration <= 30 ? 5 : duration <= 120 ? 10 : 20;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);
  return (
    <div className="relative border-b border-ink-700/70 bg-ink-850" style={{ height: RULER_H }}>
      {ticks.map((t) => (
        <div key={t} className="absolute top-0 h-full" style={{ left: `${(t / duration) * 100}%` }}>
          <div className="absolute top-0 h-2 w-px bg-ink-600" />
          <span className="absolute left-1 top-1 font-mono text-[9px] text-slate-500">{formatTime(t)}</span>
        </div>
      ))}
    </div>
  );
}

/** Static waveform of the loaded audio, or a faux pattern for the demo. */
function WaveformLane() {
  const hasAudio = useShowStore((s) => s.hasAudio);
  const faux = useMemo(
    () =>
      Array.from({ length: 180 }, (_, i) => {
        const env = Math.sin((i / 180) * Math.PI); // louder in the middle
        const beat = (i % 8 < 2 ? 1 : 0.5) * (0.4 + Math.abs(Math.sin(i * 1.7)) * 0.6);
        return Math.min(1, env * beat + 0.08);
      }),
    [],
  );
  const peaks = hasAudio && audioEngine.peaks.length ? audioEngine.peaks : faux;
  const n = peaks.length;

  return (
    <div className="relative border-b border-ink-700/70 bg-ink-900" style={{ height: WAVE_H }}>
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none">
        {peaks.map((p, i) => {
          const h = Math.max(2, p * 92);
          return (
            <rect
              key={i}
              x={i + 0.15}
              y={(100 - h) / 2}
              width={0.7}
              height={h}
              fill={hasAudio ? '#22d3ee' : '#2f5566'}
              opacity={hasAudio ? 0.7 : 0.5}
            />
          );
        })}
      </svg>
      {!hasAudio && <NoAudioLabel />}
    </div>
  );
}

/** Beat / bar grid drawn behind the track lanes. */
function BeatGrid({ top, height }: { top: number; height: number }) {
  const duration = useShowStore((s) => s.duration);
  const bpm = useShowStore((s) => s.project.settings.bpm ?? 120);
  const show = useShowStore((s) => s.showBeatGrid);
  const lines = useMemo(() => {
    if (bpm <= 0 || duration <= 0) return [];
    const beatDur = 60 / bpm;
    const totalBeats = Math.floor(duration / beatDur);
    const drawBeats = totalBeats <= 320;
    const out: { x: number; bar: boolean }[] = [];
    for (let b = 0; b <= totalBeats; b++) {
      const bar = b % 4 === 0;
      if (!bar && !drawBeats) continue;
      out.push({ x: (b * beatDur) / duration * 100, bar });
    }
    return out;
  }, [duration, bpm]);
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute left-0 right-0" style={{ top, height }}>
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x}
            y1="0"
            x2={l.x}
            y2="100"
            stroke={l.bar ? '#33465f' : '#1a2432'}
            strokeWidth={l.bar ? 0.16 : 0.08}
          />
        ))}
      </svg>
    </div>
  );
}

/** Vertical playhead line spanning ruler + all lanes. */
function Playhead() {
  const currentTime = useShowStore((s) => s.currentTime);
  const duration = useShowStore((s) => s.duration);
  const left = `${Math.min(100, (currentTime / duration) * 100)}%`;
  return (
    <div className="pointer-events-none absolute bottom-0 top-0 z-20" style={{ left }}>
      <div className="absolute inset-y-0 -left-px w-0.5 bg-accent-cyan shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
      <div className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-accent-cyan" />
    </div>
  );
}

export function TimelinePanel() {
  const events = useShowStore((s) => s.project.events);
  const duration = useShowStore((s) => s.duration);
  const seek = useShowStore((s) => s.seek);
  const addEvent = useShowStore((s) => s.addEvent);
  const t = useT();
  const lanesRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const seekFromClientX = (clientX: number) => {
    const el = lanesRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    seek(frac * duration);
  };

  const onScrubDown = (e: React.PointerEvent) => {
    // Ignore clicks that originate on an event block (they stop propagation).
    scrubbing.current = true;
    seekFromClientX(e.clientX);
    const move = (ev: PointerEvent) => scrubbing.current && seekFromClientX(ev.clientX);
    const up = () => {
      scrubbing.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <section className="flex h-[232px] shrink-0 flex-col border-t border-ink-700/70 bg-ink-900">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-ink-700/70 px-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Icon name="music" size={14} /> {t('timeline.title')}
        </div>
        <BpmControls />
        <div className="ml-auto flex items-center gap-2">
          <AudioControls />
        </div>
      </div>

      {/* Body: labels + lanes */}
      <div className="flex min-h-0 flex-1">
        {/* Left label column */}
        <div className="w-36 shrink-0 border-r border-ink-700/70 bg-ink-850">
          <div style={{ height: RULER_H }} />
          <div
            className="flex items-center gap-1.5 border-b border-ink-700/70 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
            style={{ height: WAVE_H }}
          >
            <Icon name="music" size={12} /> {t('timeline.audio')}
          </div>
          {TRACKS.map((track) => (
            <TrackLabel key={track.id} id={track.id} label={t(`track.${track.id}`)} color={track.color} onAdd={() => addEvent(track.id, defaultTypeFor(track.id))} style={{ height: TRACK_H }} />
          ))}
        </div>

        {/* Right lanes */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div ref={lanesRef} className="relative h-full cursor-text select-none" onPointerDown={onScrubDown}>
            <Ruler />
            <WaveformLane />
            <BeatGrid top={RULER_H + WAVE_H} height={TRACKS.length * TRACK_H} />
            {TRACKS.map((track) => (
              <div
                key={track.id}
                className="relative border-b border-ink-700/40"
                style={{ height: TRACK_H }}
              >
                {events
                  .filter((e) => e.track === track.id)
                  .map((e) => (
                    <EventBlock key={e.id} event={e} color={track.color} duration={duration} />
                  ))}
              </div>
            ))}
            <Playhead />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrackLabel({
  label,
  color,
  onAdd,
  style,
}: {
  id: TrackId;
  label: string;
  color: string;
  onAdd: () => void;
  style: React.CSSProperties;
}) {
  const t = useT();
  return (
    <div className="group flex items-center gap-2 border-b border-ink-700/70 px-3" style={style}>
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span className="flex-1 truncate text-xs font-medium text-slate-300">{label}</span>
      <button
        className="grid h-5 w-5 place-items-center rounded text-slate-500 opacity-0 transition-opacity hover:bg-ink-700 hover:text-accent-cyan group-hover:opacity-100"
        title={t('timeline.addEvent', { label })}
        onClick={onAdd}
      >
        <Icon name="plus" size={13} />
      </button>
    </div>
  );
}

function defaultTypeFor(track: TrackId): string {
  switch (track) {
    case 'lights':
      return 'light_color';
    case 'lasers':
      return 'laser_on';
    case 'fx':
      return 'smoke_burst';
    case 'led':
      return 'led_pulse';
  }
}
