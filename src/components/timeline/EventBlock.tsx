import { useRef } from 'react';
import type { ShowEvent } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
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

/**
 * A clip on a timeline lane. Drag the body to move it (across lanes too); drag
 * either edge to resize its duration. Blocks can't overlap on a lane — the store
 * clamps every move/resize. Click selects it for editing in the Inspector.
 */
export function EventBlock({ event, color, duration, laneAtClientY }: Props) {
  const selectEvent = useShowStore((s) => s.selectEvent);
  const moveEvent = useShowStore((s) => s.moveEvent);
  const resizeEventBlock = useShowStore((s) => s.resizeEventBlock);
  const selected = useShowStore((s) => s.selectedEventId === event.id);
  const t = useT();
  const label = t(`evt.short.${event.type}`);

  const drag = useRef<{ mode: DragMode; startX: number; width: number; origTime: number; origEnd: number } | null>(null);

  const left = (event.time / duration) * 100;
  const width = Math.max((event.duration / duration) * 100, 0.8);

  const begin = (mode: DragMode) => (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    selectEvent(event.id);
    const track = (e.currentTarget.closest('[data-lane-track]') as HTMLElement) ?? e.currentTarget.parentElement;
    const w = track?.getBoundingClientRect().width ?? 1;
    drag.current = { mode, startX: e.clientX, width: w, origTime: event.time, origEnd: event.time + event.duration };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dt = ((e.clientX - d.startX) / d.width) * duration;
    if (d.mode === 'move') {
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
        selected ? 'z-10 ring-2 ring-white/80' : 'z-0'
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
