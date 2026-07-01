import type { SceneObject, SceneObjectType, Vec3 } from '../types/show';

/**
 * Lightweight collision handling for object placement / dragging.
 *
 * Each object type is approximated by an axis-aligned box (half-extents). When
 * collisions are enabled we (a) keep objects from sinking below the floor and
 * (b) push a moved object out of any object it overlaps, along the axis of
 * least penetration. This is intentionally simple but feels right for a V1.
 */

const HALF_EXTENTS: Record<SceneObjectType, Vec3> = {
  stage_platform: [7, 0.3, 4],
  truss: [7.5, 0.4, 0.4],
  speaker: [0.8, 1.5, 0.7],
  led_screen: [4.75, 2.75, 0.25],
  dj_booth: [1.7, 0.8, 0.8],
  crowd_block: [9, 1, 4],
  moving_head_spot: [0.3, 0.3, 0.3],
  moving_head_wash: [0.3, 0.3, 0.3],
  beam_light: [0.3, 0.3, 0.3],
  strobe: [0.3, 0.3, 0.3],
  blinder: [0.3, 0.3, 0.3],
  laser: [0.25, 0.2, 0.3],
  smoke_machine: [0.35, 0.35, 0.35],
  flame_jet: [0.35, 0.35, 0.35],
  co2_jet: [0.35, 0.35, 0.35],
  confetti_cannon: [0.35, 0.35, 0.35],
};

function halfExtents(type: SceneObjectType, scale: number): Vec3 {
  const h = HALF_EXTENTS[type] ?? [0.4, 0.4, 0.4];
  return [h[0] * scale, h[1] * scale, h[2] * scale];
}

/**
 * Resolve a desired position for `type`/`scale` against the floor and the other
 * objects. Returns the adjusted position. When `enabled` is false, only rounds.
 */
export function resolvePlacement(
  objects: SceneObject[],
  movedId: string | null,
  type: SceneObjectType,
  scale: number,
  desired: Vec3,
  enabled: boolean,
): Vec3 {
  const p: Vec3 = [desired[0], desired[1], desired[2]];
  if (!enabled) return p;

  const [hx, hy, hz] = halfExtents(type, scale);

  // Floor: keep the object's bottom on or above the ground plane.
  if (p[1] - hy < 0) p[1] = hy;

  // Object-object: push out of overlaps (a few passes for stability).
  const others = objects.filter((o) => o.id !== movedId);
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of others) {
      const [ox, oy, oz] = halfExtents(o.type, o.scale);
      const dx = p[0] - o.position[0];
      const dy = p[1] - o.position[1];
      const dz = p[2] - o.position[2];
      const px = hx + ox - Math.abs(dx);
      const py = hy + oy - Math.abs(dy);
      const pz = hz + oz - Math.abs(dz);
      if (px > 0 && py > 0 && pz > 0) {
        // Overlapping — resolve along the axis of least penetration.
        if (px <= py && px <= pz) {
          p[0] += dx >= 0 ? px : -px;
        } else if (py <= px && py <= pz) {
          p[1] += dy >= 0 ? py : -py;
        } else {
          p[2] += dz >= 0 ? pz : -pz;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Re-assert the floor constraint after horizontal/vertical pushes.
  if (p[1] - hy < 0) p[1] = hy;

  return [round(p[0]), round(p[1]), round(p[2])];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
