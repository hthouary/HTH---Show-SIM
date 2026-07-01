/**
 * Free-form timeline helpers.
 *
 * Blocks (events) live on lanes (rows) and may not overlap on the same lane.
 * These pure helpers place / resize blocks while enforcing that rule, and
 * migrate older (fixed-track) projects into the lane model.
 */
import type { Lane, ShowEvent } from '../types/show';
import { createId, eventCategory } from '../data/catalog';

/** Shortest a block can be dragged to. */
export const MIN_DURATION = 0.2;

const round = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface Interval {
  time: number;
  duration: number;
}

const overlaps = (start: number, dur: number, o: Interval) =>
  start < o.time + o.duration - 1e-6 && start + dur > o.time + 1e-6;

/**
 * Find a valid, non-overlapping start for a block of length `dur` as close as
 * possible to `desired` on a lane already holding `others`. Returns null when
 * the lane has no gap large enough near the desired spot.
 */
export function placeStart(others: Interval[], dur: number, desired: number, showDur: number): number | null {
  const max = Math.max(0, showDur - dur);
  let start = clamp(desired, 0, max);
  const sorted = [...others].sort((a, b) => a.time - b.time);

  // Iteratively push out of any overlap, towards the side nearer the target.
  for (let iter = 0; iter <= sorted.length; iter++) {
    let moved = false;
    for (const o of sorted) {
      if (overlaps(start, dur, o)) {
        const left = o.time - dur;
        const right = o.time + o.duration;
        start = Math.abs(left - desired) <= Math.abs(right - desired) && left >= 0 ? left : right;
        start = clamp(start, 0, max);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const ok = !sorted.some((o) => overlaps(start, dur, o));
  return ok ? round(start) : null;
}

/** Events on `laneId` other than `exceptId`, as bare intervals. */
function laneIntervals(events: ShowEvent[], laneId: string, exceptId?: string): Interval[] {
  return events.filter((e) => e.lane === laneId && e.id !== exceptId).map((e) => ({ time: e.time, duration: e.duration }));
}

/** Place an existing event on a (possibly different) lane at `desired`. */
export function placeOnLane(
  events: ShowEvent[],
  id: string,
  laneId: string,
  dur: number,
  desired: number,
  showDur: number,
): number | null {
  return placeStart(laneIntervals(events, laneId, id), dur, desired, showDur);
}

/** First free start of length `dur` near `preferred`, scanning gaps if needed. */
export function firstFreeStart(others: Interval[], dur: number, showDur: number, preferred: number): number | null {
  const at = placeStart(others, dur, preferred, showDur);
  if (at != null) return at;
  const sorted = [...others].sort((a, b) => a.time - b.time);
  let cursor = 0;
  for (const o of sorted) {
    if (o.time - cursor >= dur) return round(cursor);
    cursor = Math.max(cursor, o.time + o.duration);
  }
  return showDur - cursor >= dur ? round(cursor) : null;
}

/** New start/duration when dragging one edge of `ev`, clamped to its neighbours. */
export function resizeEvent(
  events: ShowEvent[],
  ev: ShowEvent,
  edge: 'left' | 'right',
  desired: number,
  showDur: number,
): { time: number; duration: number } {
  const others = laneIntervals(events, ev.lane, ev.id);
  const end = ev.time + ev.duration;

  if (edge === 'right') {
    const rightBound = others
      .filter((o) => o.time + 1e-6 >= end)
      .reduce((m, o) => Math.min(m, o.time), showDur);
    const newEnd = clamp(desired, ev.time + MIN_DURATION, rightBound);
    return { time: ev.time, duration: round(newEnd - ev.time) };
  }

  const leftBound = others
    .filter((o) => o.time + o.duration - 1e-6 <= ev.time)
    .reduce((m, o) => Math.max(m, o.time + o.duration), 0);
  const newStart = clamp(desired, leftBound, end - MIN_DURATION);
  return { time: round(newStart), duration: round(end - newStart) };
}

const LANE_LABEL: Record<string, string> = {
  lights: 'Lights',
  lasers: 'Lasers',
  fx: 'FX',
  led: 'LED',
  global: 'Cues',
};

/**
 * Distribute a flat list of events onto lanes: grouped by effect family, then
 * split into as many lanes as needed so nothing overlaps within a lane. Used to
 * migrate older projects (and to lay out the demo).
 */
export function assignLanes(events: ShowEvent[]): { lanes: Lane[]; events: ShowEvent[] } {
  const lanes: Lane[] = [];
  const out: ShowEvent[] = [];
  const cats: ReturnType<typeof eventCategory>[] = ['lights', 'lasers', 'fx', 'led', 'global'];

  for (const cat of cats) {
    const group = events.filter((e) => eventCategory(e.type) === cat).sort((a, b) => a.time - b.time);
    if (group.length === 0) continue;
    const sub: { id: string; end: number }[] = [];
    for (const e of group) {
      let placed = sub.find((sl) => e.time + 1e-6 >= sl.end);
      if (!placed) {
        placed = { id: createId('lane'), end: 0 };
        sub.push(placed);
      }
      placed.end = e.time + e.duration;
      out.push({ ...e, lane: placed.id });
    }
    sub.forEach((sl, i) =>
      lanes.push({ id: sl.id, name: LANE_LABEL[cat] + (sub.length > 1 ? ` ${i + 1}` : '') }),
    );
  }
  return { lanes, events: out };
}

interface RawProject {
  lanes?: Lane[];
  events?: unknown[];
}

/** Whether a project already uses the lane model. */
function isMigrated(p: RawProject): boolean {
  return (
    Array.isArray(p.lanes) &&
    (p.events ?? []).every((e) => typeof (e as ShowEvent).lane === 'string' && Array.isArray((e as ShowEvent).targets))
  );
}

/** Bring an older project (fixed tracks / single target) into the lane model. */
export function migrateTimeline(p: RawProject): { lanes: Lane[]; events: ShowEvent[] } {
  if (isMigrated(p)) return { lanes: p.lanes as Lane[], events: p.events as ShowEvent[] };

  const converted: ShowEvent[] = ((p.events as Record<string, unknown>[]) ?? []).map((e) => {
    const legacyTarget = e.target;
    const targets = Array.isArray(e.targets)
      ? (e.targets as string[])
      : typeof legacyTarget === 'string' && legacyTarget !== 'all'
        ? [legacyTarget]
        : [];
    return {
      id: (e.id as string) ?? createId('evt'),
      lane: (e.lane as string) ?? '',
      time: typeof e.time === 'number' ? e.time : 0,
      duration: typeof e.duration === 'number' ? e.duration : 1,
      type: e.type as ShowEvent['type'],
      targets,
      params: e.params && typeof e.params === 'object' ? (e.params as Record<string, unknown>) : {},
    };
  });

  return assignLanes(converted);
}
