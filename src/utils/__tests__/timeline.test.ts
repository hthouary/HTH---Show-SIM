import { describe, expect, it } from 'vitest';
import type { ShowEvent, ShowEventType } from '../../types/show';
import { MIN_DURATION, assignLanes, clampGroupShift, firstFreeStart, migrateTimeline, placeStart, resizeEvent } from '../timeline';

let n = 0;
function ev(time: number, duration: number, lane = 'l1', type: ShowEventType = 'light_color'): ShowEvent {
  n += 1;
  return { id: `e${n}`, lane, time, duration, type, targets: [], params: {} };
}

describe('placeStart / firstFreeStart', () => {
  it('keeps the desired start on an empty lane, clamped to the show', () => {
    expect(placeStart([], 4, 10, 90)).toBe(10);
    expect(placeStart([], 4, 200, 90)).toBe(86);
    expect(placeStart([], 4, -3, 90)).toBe(0);
  });

  it('pushes out of an overlap toward the nearest side', () => {
    const others = [{ time: 10, duration: 4 }];
    expect(placeStart(others, 2, 9, 90)).toBe(8); // left edge is closer
    expect(placeStart(others, 2, 13, 90)).toBe(14); // right edge is closer
  });

  it('returns null when the lane truly has no room', () => {
    expect(placeStart([{ time: 0, duration: 10 }], 4, 2, 10)).toBeNull();
  });

  it('firstFreeStart scans gaps when the desired spot is blocked', () => {
    const others = [
      { time: 0, duration: 5 },
      { time: 6, duration: 80 },
    ];
    // Desired inside the big block → the only 4s-wide gap is at 86.
    expect(firstFreeStart(others, 4, 90, 50)).toBe(86);
  });
});

describe('resizeEvent', () => {
  it('clamps the right edge to the next block and the minimum length', () => {
    const a = ev(0, 4);
    const b = ev(6, 4);
    const events = [a, b];
    expect(resizeEvent(events, a, 'right', 8, 90)).toEqual({ time: 0, duration: 6 });
    expect(resizeEvent(events, a, 'right', 0.05, 90).duration).toBeCloseTo(MIN_DURATION);
  });

  it('clamps the left edge to the previous block', () => {
    const a = ev(0, 4);
    const b = ev(6, 4, 'l1');
    const events = [a, b];
    expect(resizeEvent(events, b, 'left', 2, 90)).toEqual({ time: 4, duration: 6 });
  });
});

describe('clampGroupShift', () => {
  it('lets a group slide until a non-selected neighbour blocks it', () => {
    const sel1 = ev(2, 2, 'a');
    const sel2 = ev(2, 2, 'b');
    const wall = ev(8, 2, 'a'); // obstacle on lane a only
    const events = [sel1, sel2, wall];
    const ids = [sel1.id, sel2.id];
    expect(clampGroupShift(events, ids, 10, 90)).toBe(4); // sel1 stops at 6 (wall at 8)
    expect(clampGroupShift(events, ids, -10, 90)).toBe(-2); // floor at t=0
  });

  it('selected events never block each other', () => {
    const a = ev(0, 2, 'a');
    const b = ev(2, 2, 'a');
    expect(clampGroupShift([a, b], [a.id, b.id], 5, 90)).toBe(5);
  });
});

describe('assignLanes / migrateTimeline', () => {
  it('splits overlapping same-family events onto separate lanes', () => {
    const laid = assignLanes([ev(0, 10, ''), ev(5, 10, '')]);
    expect(laid.lanes).toHaveLength(2);
    const [a, b] = laid.events;
    expect(a.lane).not.toBe(b.lane);
  });

  it('keeps sequential events on one lane', () => {
    const laid = assignLanes([ev(0, 4, ''), ev(5, 4, '')]);
    expect(laid.lanes).toHaveLength(1);
  });

  it('migrates a legacy single-target event into the lane model', () => {
    const legacy = { id: 'x', time: 3, duration: 2, type: 'light_color', target: 'spot9', params: {} };
    const { lanes, events } = migrateTimeline({ events: [legacy] });
    expect(lanes.length).toBeGreaterThan(0);
    expect(events[0].targets).toEqual(['spot9']);
    expect(events[0].lane).toBe(lanes[0].id);
  });
});
