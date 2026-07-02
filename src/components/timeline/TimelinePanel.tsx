import { useEffect, useMemo, useRef, useState } from 'react';
import { useShowStore } from '../../store/useShowStore';
import type { Lane } from '../../types/show';
import { eventColor } from '../../data/catalog';
import { TEMPLATE_LIST, type TemplateKey } from '../../data/templates';
import { audioEngine, formatTime } from '../../utils/audio';
import { Icon } from '../ui/Icon';
import { AudioControls } from './AudioControls';
import { BpmControls } from './BpmControls';
import { EventBlock } from './EventBlock';
import { useT } from '../../i18n/useT';

const RULER_H = 22;
const WAVE_H = 40;
const LANE_H = 34;
const LABEL_W = 128; // px — must match the label cells

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
    <div className="group flex h-full w-full items-center gap-1 border-b border-r border-ink-700/70 bg-ink-850 px-2">
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

/** Dropdown that stamps a ready-made event group at the playhead. */
function TemplatesMenu() {
  const addTemplate = useShowStore((s) => s.addTemplate);
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <div className="relative shrink-0">
      <button className="btn h-7 whitespace-nowrap px-2" onClick={() => setOpen((o) => !o)} title={t('timeline.templates.title')}>
        <Icon name="sparkles" size={13} /> {t('timeline.templates')}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-2xl">
            {TEMPLATE_LIST.map((key) => (
              <button
                key={key}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-200 hover:bg-ink-800"
                onClick={() => {
                  addTemplate(key as TemplateKey);
                  setOpen(false);
                }}
              >
                <Icon name="bolt" size={13} className="text-accent-cyan" />
                {t(`template.${key}`)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Horizontal zoom controls for the timeline. */
function ZoomControls({ onOut, onIn, onFit }: { onOut: () => void; onIn: () => void; onFit: () => void }) {
  const t = useT();
  return (
    <div className="flex shrink-0 items-center rounded-md border border-ink-700 bg-ink-850" title={t('timeline.zoom')}>
      <button className="grid h-7 w-7 place-items-center text-slate-400 hover:text-slate-100" onClick={onOut} title={t('timeline.zoomOut')}>
        <Icon name="minus" size={14} />
      </button>
      <button className="border-x border-ink-700 px-2 py-1 text-[11px] text-slate-300 hover:text-white" onClick={onFit} title={t('timeline.zoomFit')}>
        {t('timeline.zoomFit')}
      </button>
      <button className="grid h-7 w-7 place-items-center text-slate-400 hover:text-slate-100" onClick={onIn} title={t('timeline.zoomIn')}>
        <Icon name="plus" size={14} />
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
  const selectEvent = useShowStore((s) => s.selectEvent);
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Horizontal zoom in pixels-per-second; fit to the viewport on first layout.
  const [pxPerSec, setPxPerSec] = useState(12);
  const contentWidth = Math.max(duration * pxPerSec, 1);

  const fit = () => {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth - LABEL_W;
    if (w > 0) setPxPerSec(Math.max(3, w / duration));
  };
  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const zoomOut = () => setPxPerSec((p) => Math.max(3, p / 1.35));
  const zoomIn = () => setPxPerSec((p) => Math.min(160, p * 1.35));

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
    <section
      className="flex h-[248px] shrink-0 flex-col border-t border-ink-700/70 bg-ink-900"
      onContextMenu={(e) => {
        e.preventDefault();
        selectEvent(null);
      }}
    >
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-3 overflow-x-auto border-b border-ink-700/70 px-3">
        <div className="flex shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Icon name="music" size={14} /> {t('timeline.title')}
        </div>
        <BpmControls />
        <TemplatesMenu />
        <button className="btn h-7 shrink-0 whitespace-nowrap px-2" onClick={addLane} title={t('timeline.addLane')}>
          <Icon name="plus" size={13} /> {t('timeline.addLane')}
        </button>
        <ZoomControls onOut={zoomOut} onIn={zoomIn} onFit={fit} />
        <div className="ml-auto flex items-center gap-2">
          <AudioControls />
        </div>
      </div>

      {/* Scrollable grid: sticky ruler/waveform (top) + sticky labels (left) */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: LABEL_W + contentWidth, minWidth: '100%' }}>
          {/* Ruler row */}
          <div className="sticky top-0 z-30 flex">
            <div className="sticky left-0 z-40 shrink-0 border-b border-r border-ink-700/70 bg-ink-850" style={{ width: LABEL_W, height: RULER_H }} />
            <div className="shrink-0 border-b border-ink-700/70 bg-ink-850" style={{ width: contentWidth, height: RULER_H }} onPointerDown={seekFromEvent}>
              <Ruler />
            </div>
          </div>

          {/* Waveform row */}
          <div className="sticky z-20 flex" style={{ top: RULER_H }}>
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center gap-1.5 border-b border-r border-ink-700/70 bg-ink-850 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              style={{ width: LABEL_W, height: WAVE_H }}
            >
              <Icon name="music" size={12} /> {t('timeline.audio')}
            </div>
            <div className="shrink-0 border-b border-ink-700/70" style={{ width: contentWidth, height: WAVE_H }} onPointerDown={seekFromEvent}>
              <WaveformLane />
            </div>
          </div>

          {/* Lanes */}
          {lanes.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-600">{t('timeline.emptyLanes')}</div>
          ) : (
            lanes.map((lane) => (
              <div key={lane.id} data-lane-id={lane.id} className="flex" style={{ height: LANE_H }}>
                <div className="sticky left-0 z-20 shrink-0" style={{ width: LABEL_W, height: LANE_H }}>
                  <LaneLabel lane={lane} />
                </div>
                <div
                  data-lane-track
                  className="relative shrink-0 border-b border-ink-700/40"
                  style={{ width: contentWidth, height: LANE_H }}
                  onPointerDown={seekFromEvent}
                >
                  {events
                    .filter((e) => e.lane === lane.id)
                    .map((e) => (
                      <EventBlock key={e.id} event={e} color={eventColor(e.type)} duration={duration} laneAtClientY={laneAtClientY} />
                    ))}
                </div>
              </div>
            ))
          )}

          {/* Beat grid + playhead overlay the lane area (past ruler + waveform) */}
          {lanes.length > 0 && (
            <div className="pointer-events-none absolute z-10" style={{ left: LABEL_W, top: RULER_H + WAVE_H, width: contentWidth, bottom: 0 }}>
              <BeatGrid />
              <Playhead />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
