import type { SceneObject, SceneObjectType, Vec3 } from '../types/show';

/**
 * Placement handling for the construction sandbox.
 *
 * Each object type is approximated by an axis-aligned box (half-extents). A
 * desired position is passed through a small pipeline:
 *   1. grid snap   — round X/Z to the build grid (like Planet Coaster);
 *   2. magnetism   — snap flush against the nearest object's face and align
 *                    centres, so structures click together like magnets;
 *   3. collisions  — keep objects on the floor and push them out of overlaps.
 * Every stage is independently toggleable, so the builder stays in control.
 */

const HALF_EXTENTS: Record<SceneObjectType, Vec3> = {
  stage_platform: [7, 0.3, 4],
  truss: [7.5, 0.4, 0.4],
  truss_tower: [0.35, 2.5, 0.35],
  truss_arch: [3.75, 2.6, 0.35],
  speaker: [0.8, 1.5, 0.7],
  led_screen: [4.75, 2.75, 0.25],
  dj_booth: [1.7, 0.8, 0.8],
  crowd_block: [9, 1, 4],
  moving_head_spot: [0.28, 0.32, 0.28],
  moving_head_wash: [0.28, 0.32, 0.28],
  beam_light: [0.26, 0.34, 0.26],
  strobe: [0.42, 0.3, 0.16],
  blinder: [0.4, 0.4, 0.16],
  laser: [0.28, 0.22, 0.34],
  smoke_machine: [0.44, 0.24, 0.3],
  flame_jet: [0.22, 0.32, 0.22],
  co2_jet: [0.18, 0.38, 0.18],
  confetti_cannon: [0.26, 0.42, 0.26],
};

/** World-space distance under which magnetism engages. */
const MAGNET_SNAP = 0.7;
/** How far centres may be apart and still auto-align on the free axes. */
const CENTER_SNAP = 0.55;
/** Slack allowed on the perpendicular axes when testing for face contact. */
const FACE_SLACK = 0.12;

export interface PlacementSettings {
  /** Keep objects on the floor and push them out of overlaps. */
  collisions: boolean;
  /** Snap X/Z to the build grid. */
  gridSnap: boolean;
  /** Grid cell size in world units. */
  gridSize: number;
  /** Magnetically snap objects flush against each other. */
  magnet: boolean;
}

export function halfExtents(type: SceneObjectType, scale: number): Vec3 {
  const h = HALF_EXTENTS[type] ?? [0.4, 0.4, 0.4];
  return [h[0] * scale, h[1] * scale, h[2] * scale];
}

/** Do the two boxes overlap on axis `a` (within an optional slack)? */
function overlapsOn(pa: number, ha: number, oa: number, ea: number, slack = 0): boolean {
  return Math.abs(pa - oa) < ha + ea + slack;
}

/**
 * Snap the moved box flush against the nearest neighbouring object and, once
 * touching, line up its centre on the two free axes. Returns the adjusted
 * position (or the input unchanged when nothing is close enough).
 */
function applyMagnet(
  p: Vec3,
  half: Vec3,
  others: SceneObject[],
): Vec3 {
  let best: { axis: number; value: number; dist: number; other: SceneObject } | null = null;

  for (const o of others) {
    const e = halfExtents(o.type, o.scale);
    for (let a = 0; a < 3; a++) {
      const b = (a + 1) % 3;
      const c = (a + 2) % 3;
      // Faces only meet when the boxes already overlap on the other two axes.
      if (!overlapsOn(p[b], half[b], o.position[b], e[b], FACE_SLACK)) continue;
      if (!overlapsOn(p[c], half[c], o.position[c], e[c], FACE_SLACK)) continue;
      const sign = p[a] - o.position[a] >= 0 ? 1 : -1;
      const flush = o.position[a] + sign * (half[a] + e[a]);
      const dist = Math.abs(p[a] - flush);
      if (dist < MAGNET_SNAP && (!best || dist < best.dist)) {
        best = { axis: a, value: flush, dist, other: o };
      }
    }
  }

  if (!best) return p;
  const next: Vec3 = [p[0], p[1], p[2]];
  next[best.axis] = best.value;
  // Line centres up on the two axes we did not snap against.
  for (let a = 0; a < 3; a++) {
    if (a === best.axis) continue;
    if (Math.abs(next[a] - best.other.position[a]) < CENTER_SNAP) next[a] = best.other.position[a];
  }
  return next;
}

/**
 * Resolve a desired position for `type`/`scale` against the grid, neighbouring
 * objects and the floor. Returns the adjusted position.
 */
export function resolvePlacement(
  objects: SceneObject[],
  movedId: string | null,
  type: SceneObjectType,
  scale: number,
  desired: Vec3,
  settings: PlacementSettings,
): Vec3 {
  let p: Vec3 = [desired[0], desired[1], desired[2]];
  const [hx, hy, hz] = halfExtents(type, scale);
  const others = objects.filter((o) => o.id !== movedId);

  // 1) Grid snap on the horizontal plane.
  if (settings.gridSnap && settings.gridSize > 0) {
    const g = settings.gridSize;
    p = [Math.round(p[0] / g) * g, p[1], Math.round(p[2] / g) * g];
  }

  // 2) Magnetism — flush faces + centre alignment against the closest object.
  if (settings.magnet && others.length) {
    p = applyMagnet(p, [hx, hy, hz], others);
  }

  // 3) Collisions — floor + push out of any overlap.
  if (settings.collisions) {
    if (p[1] - hy < 0) p[1] = hy;
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
    if (p[1] - hy < 0) p[1] = hy;
  }

  return [round(p[0]), round(p[1]), round(p[2])];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
