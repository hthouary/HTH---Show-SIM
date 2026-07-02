import type { MovementPreset, ShowEvent } from '../types/show';

/**
 * The event engine turns a list of timeline events + the current playback time
 * into a flat "ShowState" snapshot. The 3D scene reads this snapshot every
 * frame and renders the lights / lasers / FX accordingly.
 *
 * Two semantics are used:
 *  - STATE events (color / intensity) persist: the value in effect is taken
 *    from the most recent event that has started (latest `time <= t`).
 *  - WINDOW events (strobe / sweep / bursts / blackout) are only active while
 *    `t` falls inside [time, time + duration].
 */

export type RGB = [number, number, number];

/** Beam movement in effect: a preset pattern + a 0..100 speed dial. */
export interface MoveState {
  pattern: MovementPreset;
  speed: number;
  /** Custom movement (pattern === 'custom'): drawn path + shaping params. */
  path?: number[][];
  /** Inclination 0 (down) .. 90 (forward) .. 180 (up). */
  tilt?: number;
  /** Seconds for one traversal of the drawn path (at speed 50). */
  cycle?: number;
  /** Movement size, 0..100. */
  amp?: number;
  /** How the path repeats when the action outlasts one traversal. */
  repeat?: 'loop' | 'pingpong';
  /** Laser custom chain: number of beams (1..500). */
  count?: number;
  /** Laser custom chain: spacing (phase offset) between consecutive beams. */
  spacing?: number;
  /** Absolute show time the action started (for local phase). */
  since?: number;
}

const STILL: MoveState = { pattern: 'fixed', speed: 0 };

export interface LightState {
  color: RGB;
  intensity: number;
  /** 0..1 strobe gate (1 = lit during a flash, 0 = dark). */
  strobe: number;
  /** Whether a strobe window is currently active. */
  strobing: boolean;
  /** Beam movement in effect (driven by timeline "Movement" events). */
  move: MoveState;
}

export interface LaserState {
  active: boolean;
  color: RGB;
  intensity: number;
  /** Fan movement in effect (driven by timeline laser events). */
  move: MoveState;
}

export interface LedState {
  color: RGB;
  /** 0..1 pulse envelope (drives brightness flashes). */
  pulse: number;
}

export interface BurstState {
  /** 0..1 progress through the burst window. */
  progress: number;
  /** 0..1 eased envelope (fade in/out). */
  env: number;
  intensity: number;
}

export interface ShowState {
  time: number;
  blackout: number; // 0..1
  light: LightState;
  /** Per-object light overrides keyed by object id. */
  overrides: Record<string, Partial<LightState>>;
  laser: LaserState;
  /** Per-object laser color overrides keyed by object id. */
  laserOverrides: Record<string, RGB>;
  /** Per-object laser movement overrides keyed by object id. */
  laserMoveOverrides: Record<string, MoveState>;
  /** Per-object laser on/off (a laser_on targeting specific projectors). */
  laserActive: Record<string, boolean>;
  led: LedState;
  /** Active bursts keyed by target object id (or "all"). */
  bursts: {
    smoke: Record<string, BurstState>;
    flame: Record<string, BurstState>;
    co2: Record<string, BurstState>;
    confetti: Record<string, BurstState>;
  };
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const v =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(v, 16);
  if (Number.isNaN(num)) return [1, 1, 1];
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(params: Record<string, unknown>, key: string, fallback: string): string {
  const v = params[key];
  return typeof v === 'string' ? v : fallback;
}

/** Smooth fade-in / hold / fade-out envelope for bursts. */
function envelope(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  const inT = 0.15;
  const outT = 0.65;
  if (p < inT) return p / inT;
  if (p > outT) return 1 - (p - outT) / (1 - outT);
  return 1;
}

function defaultState(time: number): ShowState {
  return {
    time,
    blackout: 0,
    light: { color: [1, 1, 1], intensity: 0.55, strobe: 1, strobing: false, move: { ...STILL } },
    overrides: {},
    laser: { active: false, color: [0.22, 1, 0.08], intensity: 1, move: { ...STILL } },
    laserOverrides: {},
    laserMoveOverrides: {},
    laserActive: {},
    led: { color: [0.07, 0.12, 0.24], pulse: 0 },
    bursts: { smoke: {}, flame: {}, co2: {}, confetti: {} },
  };
}

function ensureOverride(state: ShowState, target: string): Partial<LightState> {
  if (target === 'all') return state.light;
  if (!state.overrides[target]) state.overrides[target] = {};
  return state.overrides[target];
}

/** An event's targets, with an empty list meaning "all" (the global state). */
function targetsOf(ev: ShowEvent): string[] {
  return ev.targets && ev.targets.length ? ev.targets : ['all'];
}

/**
 * Evaluate all events at time `t`. Events are assumed already known; we sort by
 * time so that "last write wins" for state events.
 */
export function evaluateEvents(events: ShowEvent[], t: number): ShowState {
  const state = defaultState(t);
  const sorted = [...events].sort((a, b) => a.time - b.time);

  for (const ev of sorted) {
    const started = ev.time <= t;
    const active = t >= ev.time && t < ev.time + Math.max(ev.duration, 0.0001);
    const local = ev.duration > 0 ? (t - ev.time) / ev.duration : active ? 1 : 0;

    const targets = targetsOf(ev);

    switch (ev.type) {
      // ---- State events (persist after start) -----------------------------
      case 'light_color': {
        if (started) for (const tg of targets) ensureOverride(state, tg).color = hexToRgb(str(ev.params, 'color', '#ffffff'));
        break;
      }
      case 'light_intensity': {
        if (started) for (const tg of targets) ensureOverride(state, tg).intensity = num(ev.params, 'intensity', 1);
        break;
      }
      case 'laser_color': {
        if (started) {
          const rgb = hexToRgb(str(ev.params, 'color', '#39ff14'));
          for (const tg of targets) {
            if (tg === 'all') state.laser.color = rgb;
            else state.laserOverrides[tg] = rgb;
          }
        }
        break;
      }
      case 'led_color': {
        if (started) state.led.color = hexToRgb(str(ev.params, 'color', '#22d3ee'));
        break;
      }

      // ---- Window events (active only during their span) ------------------
      case 'light_strobe': {
        if (active) {
          const rate = num(ev.params, 'rate', 10);
          // Pulse between a dim floor and full, rather than hard off/on, so the
          // strobe reads as energetic without being harshly epileptic.
          const gate = Math.sin(t * rate * Math.PI * 2) > 0 ? 1 : 0.2;
          const color = hexToRgb(str(ev.params, 'color', '#ffffff'));
          for (const tg of targets) {
            const target = ensureOverride(state, tg);
            target.strobe = gate;
            target.strobing = true;
            target.color = color;
            target.intensity = Math.max(target.intensity ?? 1, 1.3);
          }
        }
        break;
      }
      case 'light_sweep': {
        // "Movement" event: sets the beam movement pattern + speed for its span.
        if (active) {
          const pattern = str(ev.params, 'pattern', 'wave') as MovementPreset;
          const move: MoveState = { pattern, speed: num(ev.params, 'speed', 40) };
          if (pattern === 'custom') {
            const raw = ev.params['path'];
            move.path = Array.isArray(raw) ? (raw as number[][]) : undefined;
            move.tilt = num(ev.params, 'tilt', 90);
            move.cycle = num(ev.params, 'cycle', 2);
            move.amp = num(ev.params, 'amp', 50);
            move.repeat = ev.params['repeat'] === 'pingpong' ? 'pingpong' : 'loop';
            move.since = ev.time;
          }
          for (const tg of targets) ensureOverride(state, tg).move = { ...move };
        }
        break;
      }
      case 'laser_on': {
        if (active) {
          const intensity = envelope(local) * 0.5 + 0.5;
          const pattern = str(ev.params, 'pattern', 'fixed') as MovementPreset;
          const move: MoveState = { pattern, speed: num(ev.params, 'speed', 0) };
          if (pattern === 'custom') {
            const raw = ev.params['path'];
            move.path = Array.isArray(raw) ? (raw as number[][]) : undefined;
            move.tilt = num(ev.params, 'tilt', 90);
            move.count = num(ev.params, 'count', 40);
            move.spacing = num(ev.params, 'spacing', 3);
            move.since = ev.time;
          }
          const c = ev.params['color'];
          for (const tg of targets) {
            if (tg === 'all') {
              state.laser.active = true;
              state.laser.intensity = intensity;
              state.laser.move = { ...move };
              if (typeof c === 'string') state.laser.color = hexToRgb(c);
            } else {
              state.laserActive[tg] = true;
              state.laser.intensity = intensity;
              state.laserMoveOverrides[tg] = { ...move };
              if (typeof c === 'string') state.laserOverrides[tg] = hexToRgb(c);
            }
          }
        }
        break;
      }
      case 'blackout': {
        if (active) state.blackout = Math.min(1, envelope(local) + 0.4);
        break;
      }
      case 'led_pulse': {
        if (active) {
          const rate = num(ev.params, 'rate', 2);
          const pulse = (Math.sin(t * rate * Math.PI * 2) * 0.5 + 0.5) * envelope(local);
          state.led.pulse = Math.max(state.led.pulse, pulse);
          const c = ev.params['color'];
          if (typeof c === 'string') state.led.color = hexToRgb(c);
        }
        break;
      }

      // ---- FX bursts ------------------------------------------------------
      case 'smoke_burst':
      case 'flame_burst':
      case 'co2_burst':
      case 'confetti_burst': {
        if (active) {
          const bucket =
            ev.type === 'smoke_burst'
              ? state.bursts.smoke
              : ev.type === 'flame_burst'
                ? state.bursts.flame
                : ev.type === 'co2_burst'
                  ? state.bursts.co2
                  : state.bursts.confetti;
          const burst: BurstState = {
            progress: Math.max(0, Math.min(1, local)),
            env: envelope(local),
            intensity: num(ev.params, 'intensity', 1),
          };
          for (const tg of targets) bucket[tg] = burst;
        }
        break;
      }
    }
  }

  return state;
}

/** Resolve the effective light state for a specific object id. */
export function lightForObject(state: ShowState, id: string): LightState {
  const ov = state.overrides[id];
  if (!ov) return state.light;
  return { ...state.light, ...ov };
}

/** Resolve the laser color for a specific object id. */
export function laserColorForObject(state: ShowState, id: string): RGB {
  return state.laserOverrides[id] ?? state.laser.color;
}

/** Resolve the laser movement for a specific object id. */
export function laserMoveForObject(state: ShowState, id: string): MoveState {
  return state.laserMoveOverrides[id] ?? state.laser.move;
}

/** Whether a specific laser projector is currently on (global "all" or targeted). */
export function laserOnForObject(state: ShowState, id: string): boolean {
  return state.laser.active || state.laserActive[id] === true;
}
