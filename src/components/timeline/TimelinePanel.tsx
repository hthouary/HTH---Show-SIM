import { useMemo, useRef } from 'react';
import { useShowStore } from '../../store/useShowStore';
import type { Lane } from '../../types/show';
import { eventColor } from '../../data/catalog';
import { audioEngine, formatTime } from '../../utils/audio';
import { Icon } from '../ui/Icon';
import { AudioControls } from './AudioControls';
import { BpmControls } from './BpmControls';
import { EventBlock } from './EventBlock';
import { useT } from '../../i18n/useT';

const RULER_H = 22;
const WAVE_H = 40;
const LANE_H = 34;
const LABEL_W = 128; // px — must match the w-32 label cells

/** Time ruler with second graduations. */
function Ruler() {
  const duration = useShowStore((s) => s.duration);
  const step = duration <= 30 ? 5 : duration <= 120 ? 10 : 20;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);
  return (
    <div className="relative h-full">
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
  const t = useT();
  const faux = useMemo(
    () =>
      Array.from({ length: 180 }, (_, i) => {
        const env = Math.sin((i / 180) * Math.PI);
        const beat = (i % 8 < 2 ? 1 : 0.5) * (0.4 + Math.abs(Math.sin(i * 1.7)) * 0.6);
        return Math.min(1, env * beat + 0.08);
      }),
    [],
  );
  const peaks = hasAudio && audioEngine.peaks.length ? audioEngine.peaks : faux;
  const n = peaks.length;
  return (
    <div className="relative h-full bg-ink-900">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none">
        {peaks.map((p, i) => {
          const h = Math.max(2, p * 92);
          return <rect key={i} x={i + 0.15} y={(100 - h) / 2} width={0.7} height={h} fill={hasAudio ? '#22d3ee' : '#2f5566'} opacity={hasAudio ? 0.7 : 0.5} />;
        })}
      </svg>
      {!hasAudio && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-slate-600">
          {t('timeline.noAudio')}
        </span>
      )}
    </div>
  );
}

/** Beat / bar grid overlaid on the lane area. */
function BeatGrid() {
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
      out.push({ x: ((b * beatDur) / duration) * 100, bar });
    }
    return out;
  }, [duration, bpm]);
  if (!show) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {lines.map((l, i) => (
        <line key={i} x1={l.x} y1="0" x2={l.x} y2="100" stroke={l.bar ? '#33465f' : '#1a2432'} strokeWidth={l.bar ? 0.16 : 0.08} />
      ))}
    </svg>
  );
}

/** Vertical playhead line over the lane area. */
function Playhead() {
  const currentTime = useShowStore((s) => s.currentTime);
  const duration = useShowStore((s) => s.duration);
  const left = `${Math.min(100, (currentTime / duration) * 100)}%`;
  return (
    <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left }}>
      <div className="absolute inset-y-0 -left-px w-0.5 bg-accent-cyan shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
    </div>
  );
}

/** Left cell of a lane: rename it, add a block, or delete the whole lane. */
function LaneLabel({ lane }: { lane: Lane }) {
  const renameLane = useShowStore((s) => s.renameLane);
  const removeLane = useShowStore((s) => s.removeLane);
  const addBlock = useShowStore((s) => s.addBlock);
  const t = useT();
  return (
    <div className="group flex w-32 shrink-0 items-center gap-1 border-b border-r border-ink-700/70 bg-ink-850 px-2" style={{ height: LANE_H }}>
      <input
        className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-300 outline-none focus:text-white"
        value={lane.name}
        onChange={(e) => renameLane(lane.id, e.target.value)}
        title={t('timeline.renameLane')}
      />
      <button
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-500 hover:bg-ink-700 hover:text-accent-cyan"
        title={t('timeline.addBlock')}
        onClick={() => addBlock(lane.id)}
      >
        <Icon name="plus" size={13} />
      </button>
      <button
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-600 opacity-0 hover:text-rose-300 group-hover:opacity-100"
        title={t('timeline.deleteLane')}
        onClick={() => removeLane(lane.id)}
      >
        <Icon name="trash" size={12} />
      </button>
    </div>
  );
}

export function TimelinePanel() {
  const lanes = useShowStore((s) => s.project.lanes);
  const events = useShowStore((s) => s.project.events);
  const duration = useShowStore((s) => s.duration);
  const seek = useShowStore((s) => s.seek);
  const addLane = useShowStore((s) => s.addLane);
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);

  const seekFromEvent = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * duration);
  };

  // Map a screen Y to the lane id under it (for dragging blocks across lanes).
  const laneAtClientY = (clientY: number): string | null => {
    const root = scrollRef.current;
    if (!root) return null;
    const rows = root.querySelectorAll<HTMLElement>('[data-lane-id]');
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) return row.dataset.laneId ?? null;
    }
    return null;
  };

  return (
    <section className="flex h-[248px] shrink-0 flex-col border-t border-ink-700/70 bg-ink-900">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-3 overflow-x-auto border-b border-ink-700/70 px-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Icon name="music" size={14} /> {t('timeline.title')}
        </div>
        <BpmControls />
        <button className="btn h-7 shrink-0 whitespace-nowrap px-2" onClick={addLane} title={t('timeline.addLane')}>
          <Icon name="plus" size={13} /> {t('timeline.addLane')}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <AudioControls />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Ruler + waveform (fixed) */}
        <div className="flex shrink-0">
          <div className="w-32 shrink-0 border-r border-ink-700/70 bg-ink-850">
            <div style={{ height: RULER_H }} />
            <div className="flex items-center gap-1.5 border-b border-t border-ink-700/70 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500" style={{ height: WAVE_H }}>
              <Icon name="music" size={12} /> {t('timeline.audio')}
            </div>
          </div>
          <div className="relative flex-1 cursor-text select-none" onPointerDown={seekFromEvent}>
            <div className="border-b border-ink-700/70 bg-ink-850" style={{ height: RULER_H }}>
              <Ruler />
            </div>
            <div className="border-b border-ink-700/70" style={{ height: WAVE_H }}>
              <WaveformLane />
            </div>
          </div>
        </div>

        {/* Lanes (vertical scroll) */}
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
          {lanes.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-600">{t('timeline.emptyLanes')}</div>
          ) : (
            <div className="relative">
              {lanes.map((lane) => (
                <div key={lane.id} data-lane-id={lane.id} className="flex" style={{ height: LANE_H }}>
                  <LaneLabel lane={lane} />
                  <div data-lane-track className="relative flex-1 border-b border-ink-700/40" onPointerDown={seekFromEvent}>
                    {events
                      .filter((e) => e.lane === lane.id)
                      .map((e) => (
                        <EventBlock key={e.id} event={e} color={eventColor(e.type)} duration={duration} laneAtClientY={laneAtClientY} />
                      ))}
                  </div>
                </div>
              ))}
              {/* Grid + playhead overlay the track area (offset past the labels) */}
              <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: LABEL_W, right: 0 }}>
                <BeatGrid />
                <Playhead />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
