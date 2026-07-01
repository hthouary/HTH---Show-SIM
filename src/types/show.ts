/**
 * Core domain types for ShowForge Studio.
 *
 * A Project is the top-level saved document. It contains the 3D scene objects
 * and the timeline of show events that drive the lighting / FX simulation.
 */

/** Every kind of object that can live in the 3D scene. */
export type SceneObjectType =
  // Stage
  | 'stage_platform'
  | 'truss'
  | 'speaker'
  | 'led_screen'
  | 'dj_booth'
  | 'crowd_block'
  // Lights
  | 'moving_head_spot'
  | 'moving_head_wash'
  | 'beam_light'
  | 'strobe'
  | 'blinder'
  // FX
  | 'laser'
  | 'smoke_machine'
  | 'flame_jet'
  | 'co2_jet'
  | 'confetti_cannon';

export type LibraryCategory = 'stage' | 'lights' | 'fx';

/** Broad family an event type belongs to (drives its colour + grouping). */
export type EventCategory = 'lights' | 'lasers' | 'fx' | 'led' | 'global';

export type Vec3 = [number, number, number];

/**
 * Simple beam-movement preset for light / laser fixtures. Combined with a
 * 0..100 speed dial to drive a continuous, per-object motion.
 */
export type MovementPreset = 'fixed' | 'circular' | 'wave' | 'up_down' | 'left_right';

/** A single object placed in the 3D scene. */
export interface SceneObject {
  id: string;
  type: SceneObjectType;
  name: string;
  position: Vec3;
  rotation: Vec3; // radians
  scale: number;
  color: string; // hex
  /** Base light/emissive intensity (0..2 typical). */
  intensity: number;
  /** Beam cone half-angle in degrees (for fixtures that emit a cone). */
  beamAngle: number;
  /** Aim point used by moving heads / lasers (world space). */
  target: Vec3;
  /** Hidden in the viewport (still listed in the Outliner). */
  hidden?: boolean;
}

/** Discrete, time-based effect commands that drive the show. */
export type ShowEventType =
  | 'light_color'
  | 'light_intensity'
  | 'light_strobe'
  | 'light_sweep'
  | 'laser_on'
  | 'laser_color'
  | 'smoke_burst'
  | 'flame_burst'
  | 'co2_burst'
  | 'confetti_burst'
  | 'led_pulse'
  | 'led_color'
  | 'blackout';

/** A free-form timeline lane (row). Blocks can be placed on any lane. */
export interface Lane {
  id: string;
  name: string;
}

export interface ShowEvent {
  id: string;
  /** Lane (row) this block sits on. */
  lane: string;
  /** Start time in seconds. */
  time: number;
  /** Duration in seconds. */
  duration: number;
  type: ShowEventType;
  /** Object ids this action applies to. Empty = all eligible objects. */
  targets: string[];
  params: Record<string, unknown>;
}

export interface ProjectSettings {
  /** Total show length in seconds (used when no audio is loaded). */
  duration: number;
  bpm?: number;
  /** Display name of the imported audio file, if any. */
  audioName?: string;
  /** Ground fog density toggle for ambiance. */
  fog: boolean;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  objects: SceneObject[];
  /** Timeline lanes (rows), in display order. */
  lanes: Lane[];
  events: ShowEvent[];
  settings: ProjectSettings;
}

/** Lightweight metadata used in the Load dialog. */
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}
