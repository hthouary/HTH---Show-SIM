/**
 * Beam-movement presets for light / laser fixtures.
 *
 * A fixture picks a preset ('circular', 'wave', …) and a 0..100 speed dial;
 * `movementRotation` turns those, the elapsed time and a per-fixture phase
 * seed into two swing-axis rotation offsets (radians) applied on top of the
 * fixture's aim. Speed 0 (or the 'fixed' preset) means no motion.
 */
import type { MovementPreset } from '../types/show';

/** Presets in menu order. */
export const MOVEMENT_PRESETS: MovementPreset[] = [
  'fixed',
  'circular',
  'wave',
  'up_down',
  'left_right',
];

const MAX_OMEGA = 12; // angular frequency (rad/s) at speed 100
const AMP = 0.6; // primary swing amplitude in radians (~34°)

export interface MovementRot {
  /** Tilt offset (radians). */
  x: number;
  /** Pan offset (radians). */
  z: number;
  /** True when the preset actually produces motion. */
  active: boolean;
}

/** Angular frequency (rad/s) for a 0..100 speed dial, eased so low values crawl. */
export function movementOmega(speed: number): number {
  const s = Math.min(1, Math.max(0, speed / 100));
  return Math.pow(s, 1.4) * MAX_OMEGA;
}

/**
 * Rotation offsets for a fixture's beam. Returns the two swing axes plus a flag
 * telling the caller whether any motion is applied (so it can drop its idle sway).
 */
export function movementRotation(
  preset: MovementPreset | undefined,
  speed: number | undefined,
  t: number,
  seed = 0,
): MovementRot {
  const spd = speed ?? 0;
  if (!preset || preset === 'fixed' || spd <= 0) return { x: 0, z: 0, active: false };
  const ph = t * movementOmega(spd) + seed;
  switch (preset) {
    case 'circular':
      // Beam tip traces a circle: the two axes are 90° out of phase.
      return { x: Math.sin(ph) * AMP * 0.75, z: Math.cos(ph) * AMP * 0.75, active: true };
    case 'wave':
      // Side-to-side sweep with a gentle vertical bob at double frequency.
      return { x: Math.sin(ph * 2) * AMP * 0.35, z: Math.sin(ph) * AMP, active: true };
    case 'up_down':
      return { x: Math.sin(ph) * AMP, z: 0, active: true };
    case 'left_right':
      return { x: 0, z: Math.sin(ph) * AMP, active: true };
    default:
      return { x: 0, z: 0, active: false };
  }
}

/** Deterministic phase seed so neighbouring fixtures don't move in lockstep. */
export function movementSeed(position: [number, number, number]): number {
  return position[0] * 1.3 + position[2] * 0.7;
}

const CUSTOM_AMP = 0.95; // beam swing at amplitude 100 (radians)

/** Base pitch (radians, +down) from the 0..360 direction dial: 0 down · 90 forward · 180 up · 270 behind. */
function directionTilt(dir: number): number {
  return ((90 - dir) * Math.PI) / 180;
}

/** Sample the drawn path at parameter `p` (0..1) → normalized [x,y]. */
function samplePath(path: number[][], p: number): [number, number] {
  const n = path.length;
  const f = Math.max(0, Math.min(1, p)) * (n - 1);
  const i0 = Math.floor(f);
  const i1 = Math.min(n - 1, i0 + 1);
  const frac = f - i0;
  return [
    path[i0][0] + (path[i1][0] - path[i0][0]) * frac,
    path[i0][1] + (path[i1][1] - path[i0][1]) * frac,
  ];
}

/**
 * Beam rotation for a custom-drawn path sampled at phase `p` (0..1). `dir` is
 * the 0..360 direction dial (base pitch), `amp` the swing size (0..100). Shared
 * by moving heads and each beam of a laser chain.
 */
export function customRot(
  path: number[][] | undefined,
  dir: number,
  amp: number,
  p: number,
): { x: number; z: number } {
  const baseX = directionTilt(dir);
  if (!path || path.length < 2) return { x: baseX, z: 0 };
  const [px, py] = samplePath(path, p);
  const ampF = (Math.min(100, Math.max(0, amp)) / 100) * CUSTOM_AMP;
  return { x: baseX + (0.5 - py) * 2 * ampF, z: (px - 0.5) * 2 * ampF };
}

/**
 * Custom moving-head movement: the beam traces a hand-drawn path over time.
 * `dir` (0..360) sets the base pitch; `cycle` is the seconds per pass at speed
 * 50; `speed` scales that; `repeat` chooses restart ('loop') or back-and-forth.
 */
export function customMovement(
  path: number[][] | undefined,
  dir: number,
  cycle: number,
  speed: number,
  amp: number,
  repeat: 'loop' | 'pingpong',
  now: number,
  since: number,
): { x: number; z: number } {
  if (!path || path.length < 2 || speed <= 0) return { x: directionTilt(dir), z: 0 };
  const passTime = Math.max(0.05, cycle * (50 / Math.max(1, speed)));
  const local = Math.max(0, now - since);
  let p: number;
  if (repeat === 'pingpong') {
    const q = (local / passTime) % 2;
    p = q < 1 ? q : 2 - q;
  } else {
    p = (local / passTime) % 1;
  }
  return customRot(path, dir, amp, p);
}

const CHAIN_DIST = 14; // distance to the projection plane (local units)
const CHAIN_SX = 9; // half-width of the projected drawing
const CHAIN_SY = 5; // half-height of the projected drawing

/**
 * The point (in the laser's local frame, head at origin) that beam at phase `p`
 * should hit, so its tip traces the drawn path on a projection plane. `dir`
 * (0..360) aims the plane: 0 down · 90 forward (+Z) · 180 up · 270 behind. The
 * drawing's centre maps to the plane centre; a beam is then head → this point.
 */
export function laserChainPoint(path: number[][] | undefined, dir: number, p: number): [number, number, number] {
  const pitch = ((dir - 90) * Math.PI) / 180;
  const ay = Math.sin(pitch);
  const az = Math.cos(pitch);
  // Plane centre along the aim; in-plane axes: right = X, up = (0,-az,ay).
  const cx = 0;
  const cy = ay * CHAIN_DIST;
  const cz = az * CHAIN_DIST;
  if (!path || path.length < 2) return [cx, cy, cz];
  const [px, py] = samplePath(path, p);
  const u = (px - 0.5) * 2 * CHAIN_SX;
  const v = (0.5 - py) * 2 * CHAIN_SY;
  return [cx + u, cy + v * -az, cz + v * ay];
}

/** Phase (0..1) along the path for beam `i` of a laser chain at time `local`. */
export function laserChainPhase(local: number, speed: number, spacing: number, i: number): number {
  const rate = (Math.max(0, speed) / 100) * 1.2; // path traversals per second
  const gap = Math.max(0, spacing) / 1000; // phase offset between consecutive beams
  let p = (local * rate - i * gap) % 1;
  if (p < 0) p += 1;
  return p;
}

// --- Laser projectors -------------------------------------------------------
// A laser is a *fan* of thin beams. The movement preset decides the SHAPE the
// beams draw in the haze (and how it animates), not just how the whole head
// swings. `laserBeamDir` returns the local direction of each individual beam
// (forward is -Y, i.e. the fixture's aim before it is pointed at the target),
// so the fan can form a rotating cone/tunnel, a travelling wave, etc.

const FAN = 1.0; // total horizontal spread of a flat fan (rad) → about ±29°
const CONE = 0.4; // half-angle of the circular cone/tunnel (rad) → about 23°
const WAVE_AMP = 0.3; // vertical amplitude of the wave (rad)
const WAVE_K = Math.PI * 3; // ~1.5 wavelengths across the fan
const FAN_AMP = 0.5; // whole-fan pan/tilt amplitude for up-down / left-right

/**
 * Local unit direction for laser beam `i` of `count`, given the movement
 * pattern, 0..100 speed, show time and a per-fixture seed. The shape the fan
 * draws:
 *  - circular   → a cone/ring of beams (a circle/tunnel) that rotates around
 *                 its axis: stand in the middle and the beams turn around you;
 *  - wave       → a horizontal sheet whose beams ripple up and down as a
 *                 travelling wave: stand under it and it moves like a wave;
 *  - up/left    → a plain flat fan (the whole fan is swung by `laserFanRot`);
 *  - fixed      → a static flat fan.
 */
export function laserBeamDir(
  pattern: MovementPreset | undefined,
  speed: number | undefined,
  t: number,
  i: number,
  count: number,
  seed = 0,
): [number, number, number] {
  const omega = movementOmega(speed ?? 0);
  const u = count > 1 ? i / (count - 1) - 0.5 : 0; // -0.5 .. 0.5 across the fan

  if (pattern === 'circular') {
    // Beam i sits at azimuth φ around the aim axis, tilted out by the cone angle.
    // Advancing φ with time spins the whole ring → a rotating tunnel of beams.
    const phi = (i / count) * Math.PI * 2 + t * omega + seed;
    const s = Math.sin(CONE);
    const c = Math.cos(CONE);
    return [s * Math.cos(phi), -c, s * Math.sin(phi)];
  }

  if (pattern === 'wave') {
    // Flat horizontal spread, with each beam's elevation following a travelling
    // sine so the sheet of light ripples like a wave.
    const ax = u * FAN;
    const az = Math.sin(u * WAVE_K - t * omega + seed) * WAVE_AMP;
    const cax = Math.cos(ax);
    return [Math.sin(ax), -cax * Math.cos(az), -cax * Math.sin(az)];
  }

  // fixed / up_down / left_right → a plain flat fan; the whole-fan sweep (if any)
  // is applied separately via laserFanRot so the fan keeps its shape.
  const ax = u * FAN;
  return [Math.sin(ax), -Math.cos(ax), 0];
}

export interface FanRot {
  x: number;
  z: number;
}

/** Whole-fan pan/tilt for the presets that swing the entire fan as one. */
export function laserFanRot(
  pattern: MovementPreset | undefined,
  speed: number | undefined,
  t: number,
  seed = 0,
): FanRot {
  const spd = speed ?? 0;
  if (spd <= 0) return { x: 0, z: 0 };
  const ph = t * movementOmega(spd) + seed;
  if (pattern === 'up_down') return { x: Math.sin(ph) * FAN_AMP, z: 0 };
  if (pattern === 'left_right') return { x: 0, z: Math.sin(ph) * FAN_AMP };
  return { x: 0, z: 0 };
}
