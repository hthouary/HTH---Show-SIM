import { describe, expect, it } from 'vitest';
import type { SceneObject, SceneObjectType, Vec3 } from '../../types/show';
import { resolvePlacement, type PlacementSettings } from '../collision';

let n = 0;
function obj(type: SceneObjectType, position: Vec3, scale = 1): SceneObject {
  n += 1;
  return {
    id: `o${n}`,
    type,
    name: type,
    position,
    rotation: [0, 0, 0],
    scale,
    color: '#ffffff',
    intensity: 1,
    beamAngle: 12,
    target: [0, 0, 4],
  };
}

const OFF: PlacementSettings = { collisions: false, gridSnap: false, gridSize: 1, magnet: false };

describe('resolvePlacement', () => {
  it('passes the position through when everything is off', () => {
    expect(resolvePlacement([], null, 'speaker', 1, [1.234, 2, 3.456], OFF)).toEqual([1.23, 2, 3.46]);
  });

  it('snaps X/Z to the grid when gridSnap is on', () => {
    const s = { ...OFF, gridSnap: true, gridSize: 0.5 };
    expect(resolvePlacement([], null, 'speaker', 1, [1.3, 2, 3.8], s)).toEqual([1.5, 2, 4]);
  });

  it('keeps objects above the floor when collisions are on', () => {
    const s = { ...OFF, collisions: true };
    // speaker half height is 1.5 → the centre may not go below y=1.5
    const p = resolvePlacement([], null, 'speaker', 1, [0, 0, 0], s);
    expect(p[1]).toBe(1.5);
  });

  it('pushes a colliding object out along the least-penetration axis', () => {
    const s = { ...OFF, collisions: true };
    const other = obj('dj_booth', [0, 0.8, 0]); // half extents [1.7, 0.8, 0.8]
    const p = resolvePlacement([other], null, 'dj_booth', 1, [0.2, 0.8, 0], s);
    // No overlap with the resident booth on at least one axis afterwards
    const clear =
      Math.abs(p[0] - 0) >= 3.4 - 1e-6 || Math.abs(p[1] - 0.8) >= 1.6 - 1e-6 || Math.abs(p[2] - 0) >= 1.6 - 1e-6;
    expect(clear).toBe(true);
  });

  it('magnet snaps a nearby object flush against a neighbour face', () => {
    const s = { ...OFF, magnet: true };
    const other = obj('dj_booth', [0, 0.8, 0]);
    // 3.4 would be perfectly flush on X (1.7 + 1.7); 3.6 is within snap range
    const p = resolvePlacement([other], null, 'dj_booth', 1, [3.6, 0.8, 0.1], s);
    expect(p[0]).toBeCloseTo(3.4, 5);
    // Centres also align on the free axes when close enough
    expect(p[2]).toBe(0);
  });
});
