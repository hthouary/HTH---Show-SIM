import { useRef } from 'react';
import type { ShowEvent } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
import { snapToGrid } from '../../utils/beat';
import { useT } from '../../i18n/useT';

interface Props {
  event: ShowEvent;
  color: string;
  duration: number;
}

/**
 * A clip on a timeline track. Click to select; drag horizontally to move its
 * start time. Width / position are expressed as a percentage of the show.
 */
export function EventBlock({ event, color, duration }: Props) {
  const selectEvent = useShowStore((s) => s.selectEvent);
  const updateEvent = useShowStore((s) => s.updateEvent);
  const selected = useShowStore((s) => s.selectedEventId === event.id);
  const snapEnabled = useShowStore((s) => s.snapEnabled);
  const snapDivision = useShowStore((s) => s.snapDivision);
  const bpm = useShowStore((s) => s.project.settings.bpm ?? 120);
  const t = useT();
  const label = t(`evt.short.${event.type}`);
  const drag = useRef<{ startX: number; startTime: number; width: number; moved: boolean } | null>(null);

  const left = (event.time / duration) * 100;
  const width = Math.max((event.duration / duration) * 100, 1.2);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    selectEvent(event.id);
    const lane = e.currentTarget.parentElement;
    if (!lane) return;
    drag.current = {
      startX: e.clientX,
      startTime: event.time,
      width: lane.getBoundingClientRect().width,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 2) drag.current.moved = true;
    const dt = (dx / drag.current.width) * duration;
    let next = drag.current.startTime + dt;
    next = snapEnabled ? snapToGrid(next, bpm, snapDivision) : Math.round(next * 10) / 10;
    next = Math.max(0, Math.min(duration - event.duration, next));
    updateEvent(event.id, { time: next });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <button
      className={`group absolute top-1 bottom-1 cursor-grab overflow-hidden rounded-[5px] border px-1.5 text-left text-[10px] font-medium leading-none active:cursor-grabbing ${
        selected ? 'z-10 ring-2 ring-white/80' : ''
      }`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        background: `${color}22`,
        borderColor: `${color}aa`,
        color,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title={`${label} · ${event.time.toFixed(1)}s → ${(event.time + event.duration).toFixed(1)}s`}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: color }}
      />
      <span className="ml-1 block truncate pt-1">{label}</span>
    </button>
  );
}
