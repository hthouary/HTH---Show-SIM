import { useRef } from 'react';
import type { ShowEvent } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
import { clampGroupShift } from '../../utils/timeline';
import { snapToGrid } from '../../utils/beat';
import { useT } from '../../i18n/useT';

interface Props {
  event: ShowEvent;
  color: string;
  /** Total show length in seconds. */
  duration: number;
  /** Map a screen Y to the lane id under it (for dragging across lanes). */
  laneAtClientY: (clientY: number) => string | null;
}

type DragMode = 'move' | 'left' | 'right';

interface DragState {
  mode: DragMode;
  startX: number;
  width: number;
  origTime: number;
  origEnd: number;
  /** Group drag: frozen snapshot + per-event original starts. */
  group?: { ids: string[]; snapshot: ShowEvent[]; origTimes: Record<string, number> };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * A clip on a timeline lane. Drag the body to move it (across lanes too); drag
 * either edge to resize its duration. Shift-click toggles it in the selection;
 * dragging one block of a multi-selection moves the whole group together. Blocks
 * can't overlap on a lane — the store clamps every move/resize.
 */
export function EventBlock({ event, color, duration, laneAtClientY }: Props) {
  const selectEvent = useShowStore((s) => s.selectEvent);
  const toggleSelectEvent = useShowStore((s) => s.toggleSelectEvent);
  const moveEvent = useShowStore((s) => s.moveEvent);
  const applyEventTimes = useShowStore((s) => s.applyEventTimes);
  const resizeEventBlock = useShowStore((s) => s.resizeEventBlock);
  const selected = useShowStore((s) => s.selectedEventIds.includes(event.id));
  const anchor = useShowStore((s) => s.selectedEventId === event.id);
  const t = useT();
  const label = t(`evt.short.${event.type}`);

  const drag = useRef<DragState | null>(null);

  const left = (event.time / duration) * 100;
  const width = Math.max((event.duration / duration) * 100, 0.8);

  const begin = (mode: DragMode) => (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const st = useShowStore.getState();
    // Shift-click on the body toggles multi-selection instead of dragging.
    if (mode === 'move' && e.shiftKey) {
      toggleSelectEvent(event.id);
      return;
    }
    const isGroup = mode === 'move' && st.selectedEventIds.includes(event.id) && st.selectedEventIds.length > 1;
    if (!isGroup) selectEvent(event.id);

    const track = (e.currentTarget.closest('[data-lane-track]') as HTMLElement) ?? e.currentTarget.parentElement;
    const w = track?.getBoundingClientRect().width ?? 1;
    drag.current = {
      mode,
      startX: e.clientX,
      width: w,
      origTime: event.time,
      origEnd: event.time + event.duration,
    };
    if (isGroup) {
      const ids = [...st.selectedEventIds];
      const snapshot = st.project.events;
      const origTimes: Record<string, number> = {};
      for (const ev of snapshot) if (ids.includes(ev.id)) origTimes[ev.id] = ev.time;
      drag.current.group = { ids, snapshot, origTimes };
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dt = ((e.clientX - d.startX) / d.width) * duration;

    if (d.mode === 'move' && d.group) {
      // Group move: shift every selected event by a snapped, obstacle-clamped dt.
      const st = useShowStore.getState();
      let shift = dt;
      if (st.snapEnabled) {
        const bpm = st.project.settings.bpm ?? 120;
        shift = snapToGrid(d.origTime + dt, bpm, st.snapDivision) - d.origTime;
      }
      const clamped = clampGroupShift(d.group.snapshot, d.group.ids, shift, duration);
      const times: Record<string, number> = {};
      for (const id of d.group.ids) times[id] = r3(d.group.origTimes[id] + clamped);
      applyEventTimes(times);
    } else if (d.mode === 'move') {
      moveEvent(event.id, d.origTime + dt, laneAtClientY(e.clientY) ?? event.lane);
    } else if (d.mode === 'right') {
      resizeEventBlock(event.id, 'right', d.origEnd + dt);
    } else {
      resizeEventBlock(event.id, 'left', d.origTime + dt);
    }
  };

  const onUp = (e: React.PointerEvent<HTMLElement>) => {
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`group absolute top-1 bottom-1 overflow-hidden rounded-[5px] border text-left text-[10px] font-medium leading-none ${
        selected ? `z-10 ring-2 ${anchor ? 'ring-white' : 'ring-white/60'}` : 'z-0'
      }`}
      style={{ left: `${left}%`, width: `${width}%`, background: `${color}22`, borderColor: `${color}aa`, color }}
      title={`${label} · ${event.time.toFixed(1)}s → ${(event.time + event.duration).toFixed(1)}s`}
    >
      {/* Left resize grip */}
      <span
        className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-ew-resize hover:bg-white/30"
        onPointerDown={begin('left')}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
      {/* Body (move) */}
      <button
        className="absolute inset-0 cursor-grab px-2 text-left active:cursor-grabbing"
        onPointerDown={begin('move')}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <span className="ml-0.5 block truncate pt-1">{label}</span>
      </button>
      {/* Right resize grip */}
      <span
        className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-ew-resize hover:bg-white/30"
        onPointerDown={begin('right')}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
    </div>
  );
}
