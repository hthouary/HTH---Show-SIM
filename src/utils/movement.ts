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

const LASER_AMP = 0.5; // laser beams throw far, so a little swing goes a long way

export interface LaserMoveRot {
  /** Tilt of the whole fan (radians). */
  x: number;
  /** Pan of the whole fan (radians). */
  z: number;
  /** Roll around the projection axis (radians) — for the rotating-cone effect. */
  spin: number;
  active: boolean;
}

/**
 * Movement for a laser projector. Unlike a moving head, a laser's signature
 * "circular" look is the fan of beams spinning around its own projection axis,
 * sweeping out a rotating cone (a circle in the haze) — so 'circular' is a
 * continuous roll, while the other presets pan / tilt the whole fan.
 */
export function laserMovement(
  pattern: MovementPreset | undefined,
  speed: number | undefined,
  t: number,
  seed = 0,
): LaserMoveRot {
  const spd = speed ?? 0;
  if (!pattern || pattern === 'fixed' || spd <= 0) return { x: 0, z: 0, spin: 0, active: false };
  const omega = movementOmega(spd);
  const ph = t * omega + seed;
  switch (pattern) {
    case 'circular':
      // Continuous roll around the aim axis → the beam fan sweeps a rotating cone.
      return { x: 0, z: 0, spin: ph, active: true };
    case 'wave':
      // Liquid side-to-side sweep with a small vertical component and gentle roll.
      return {
        x: Math.sin(ph * 2) * LASER_AMP * 0.3,
        z: Math.sin(ph) * LASER_AMP,
        spin: Math.sin(ph * 0.5) * 0.25,
        active: true,
      };
    case 'up_down':
      return { x: Math.sin(ph) * LASER_AMP, z: 0, spin: 0, active: true };
    case 'left_right':
      return { x: 0, z: Math.sin(ph) * LASER_AMP, spin: 0, active: true };
    default:
      return { x: 0, z: 0, spin: 0, active: false };
  }
}
