/** Beat / tempo helpers for snapping timeline events to a musical grid. */

/** Seconds per beat for a given BPM. */
export function beatDuration(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

/**
 * Snap a time (seconds) to the nearest grid step. `division` is measured in
 * beats: 4 = bar, 1 = beat, 0.5 = eighth, 0.25 = sixteenth.
 */
export function snapToGrid(t: number, bpm: number, division: number): number {
  const step = beatDuration(bpm) * Math.max(0.0625, division);
  const snapped = Math.round(t / step) * step;
  return Math.max(0, Math.round(snapped * 1000) / 1000);
}

export const SNAP_DIVISIONS: { value: number; label: string }[] = [
  { value: 4, label: 'Bar' },
  { value: 1, label: 'Beat' },
  { value: 0.5, label: '1/2' },
  { value: 0.25, label: '1/4' },
];
