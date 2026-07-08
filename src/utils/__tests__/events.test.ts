import { describe, expect, it } from 'vitest';
import type { ShowEvent, ShowEventType } from '../../types/show';
import { evaluateEvents, hexToRgb, laserOnForObject, lightForObject } from '../events';

let n = 0;
function ev(type: ShowEventType, time: number, duration: number, params: Record<string, unknown> = {}, targets: string[] = []): ShowEvent {
  n += 1;
  return { id: `e${n}`, lane: 'l1', time, duration, type, targets, params };
}

describe('hexToRgb', () => {
  it('parses long and short hex', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
    expect(hexToRgb('#0f0')).toEqual([0, 1, 0]);
  });
  it('falls back to white on garbage', () => {
    expect(hexToRgb('#zzz')).toEqual([1, 1, 1]);
  });
});

describe('evaluateEvents — state events persist', () => {
  it('light_color applies from its start time onward (even after its clip ends)', () => {
    const events = [ev('light_color', 2, 2, { color: '#ff0000' })];
    expect(evaluateEvents(events, 1).light.color).toEqual([1, 1, 1]);
    expect(evaluateEvents(events, 3).light.color).toEqual([1, 0, 0]);
    expect(evaluateEvents(events, 30).light.color).toEqual([1, 0, 0]);
  });

  it('last write wins between successive colors', () => {
    const events = [ev('light_color', 0, 2, { color: '#ff0000' }), ev('light_color', 5, 2, { color: '#0000ff' })];
    expect(evaluateEvents(events, 2).light.color).toEqual([1, 0, 0]);
    expect(evaluateEvents(events, 6).light.color).toEqual([0, 0, 1]);
  });

  it('targeted color goes to the override, not the global state', () => {
    const events = [ev('light_color', 0, 1, { color: '#ff0000' }, ['spot1'])];
    const s = evaluateEvents(events, 1);
    expect(s.light.color).toEqual([1, 1, 1]);
    expect(s.overrides.spot1.color).toEqual([1, 0, 0]);
    // lightForObject merges the override over the global light
    expect(lightForObject(s, 'spot1').color).toEqual([1, 0, 0]);
    expect(lightForObject(s, 'other').color).toEqual([1, 1, 1]);
  });
});

describe('evaluateEvents — window events only live inside their span', () => {
  it('strobe flags strobing only while active', () => {
    const events = [ev('light_strobe', 1, 2, { rate: 10 })];
    expect(evaluateEvents(events, 0.5).light.strobing).toBe(false);
    expect(evaluateEvents(events, 2).light.strobing).toBe(true);
    expect(evaluateEvents(events, 3.5).light.strobing).toBe(false);
  });

  it('blackout saturates during the clip and clears after', () => {
    const events = [ev('blackout', 0, 2)];
    expect(evaluateEvents(events, 1).blackout).toBe(1);
    expect(evaluateEvents(events, 2.5).blackout).toBe(0);
  });

  it('bursts expose progress + envelope keyed by target', () => {
    const events = [ev('co2_burst', 0, 2, { intensity: 1.5 })];
    const mid = evaluateEvents(events, 1);
    expect(mid.bursts.co2.all.progress).toBeCloseTo(0.5);
    expect(mid.bursts.co2.all.env).toBe(1);
    expect(mid.bursts.co2.all.intensity).toBe(1.5);
    expect(evaluateEvents(events, 2.5).bursts.co2.all).toBeUndefined();
  });

  it('laser_on activates globally or per target', () => {
    const all = evaluateEvents([ev('laser_on', 0, 2, { color: '#39ff14' })], 1);
    expect(all.laser.active).toBe(true);
    expect(laserOnForObject(all, 'anything')).toBe(true);

    const targeted = evaluateEvents([ev('laser_on', 0, 2, {}, ['lz1'])], 1);
    expect(targeted.laser.active).toBe(false);
    expect(laserOnForObject(targeted, 'lz1')).toBe(true);
    expect(laserOnForObject(targeted, 'lz2')).toBe(false);
  });
});
