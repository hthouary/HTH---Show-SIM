import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/show';
import { parseProjectJSON, sanitizeProject } from '../project';
import { snapToGrid } from '../beat';

describe('sanitizeProject', () => {
  it('fills defaults for a sparse object and keeps rigging parents', () => {
    const raw = {
      id: 'p1',
      name: 'Test',
      objects: [{ id: 'a', type: 'truss', parent: 'tower1' }, { type: 'laser', position: [1, 2, 3] }],
      events: [{ type: 'light_color', time: 'oops', duration: null, lane: 'l', targets: [] }],
      lanes: [{ id: 'l', name: 'Lane' }],
      settings: {},
    } as unknown as Project;
    const p = sanitizeProject(raw);

    expect(p.objects[0].position).toEqual([0, 1, 0]);
    expect(p.objects[0].scale).toBe(1);
    expect(p.objects[0].parent).toBe('tower1');
    expect(p.objects[1].id).toBeTruthy();
    expect(p.objects[1].position).toEqual([1, 2, 3]);

    // Broken numbers fall back to sane times
    expect(p.events[0].time).toBe(0);
    expect(p.events[0].duration).toBe(1);

    // Settings defaults (incl. the sky model)
    expect(p.settings.duration).toBe(90);
    expect(p.settings.fog).toBe(true);
    expect(p.settings.timeOfDay).toBe(13);
    expect(p.settings.nightBrightness).toBeCloseTo(0.12);
  });
});

describe('parseProjectJSON', () => {
  it('rejects garbage and incomplete files', () => {
    expect(() => parseProjectJSON('not json')).toThrow();
    expect(() => parseProjectJSON(JSON.stringify({ name: 'x' }))).toThrow();
  });

  it('assigns a fresh id so imports never clobber saved projects', () => {
    const src = {
      id: 'orig',
      name: 'Imported',
      objects: [],
      events: [],
      lanes: [],
      settings: { duration: 60 },
    };
    const p = parseProjectJSON(JSON.stringify(src));
    expect(p.name).toBe('Imported');
    expect(p.id).not.toBe('orig');
    expect(p.settings.duration).toBe(60);
  });
});

describe('snapToGrid', () => {
  it('snaps to the beat and to the bar', () => {
    // 120 BPM → 0.5s per beat
    expect(snapToGrid(1.1, 120, 1)).toBe(1);
    expect(snapToGrid(1.3, 120, 1)).toBe(1.5);
    // bar = 4 beats = 2s
    expect(snapToGrid(2.9, 120, 4)).toBe(2);
  });
  it('never returns a negative time', () => {
    expect(snapToGrid(-0.4, 120, 1)).toBe(0);
  });
});
