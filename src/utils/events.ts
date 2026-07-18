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
  /** Transition: the movement to ease toward, and how far (0..1) we've eased. */
  blendTo?: MoveState;
  blendFactor?: number;
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

/**
 * Expand each action's bound groups into their current member ids (merged into
 * `targets`), so a group-bound cue always drives the group's live members. Runs
 * before `evaluateEvents`; events with no group bindings pass through untouched.
 */
export function withGroupTargets(events: ShowEvent[], groups: { id: string; members: string[] }[]): ShowEvent[] {
  if (!groups.length) return events;
  const byId = new Map(groups.map((g) => [g.id, g.members]));
  let changed = false;
  const out = events.map((e) => {
    if (!e.groups || e.groups.length === 0) return e;
    const extra = e.groups.flatMap((gid) => byId.get(gid) ?? []);
    if (extra.length === 0) return e;
    changed = true;
    return { ...e, targets: [...new Set([...e.targets, ...extra])] };
  });
  return changed ? out : events;
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

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function lerpRgb(a: RGB, b: RGB, k: number): RGB {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

/** Smooth ease-in-out so a transition starts and lands gently. */
function easeInOut(k: number): number {
  const x = Math.min(1, Math.max(0, k));
  return x * x * (3 - 2 * x);
}

/**
 * How far (0..1) a transitioning block has eased toward the next, at time `t`.
 * The crossfade occupies the last `dur` seconds of the block; 0 before it, 1 at
 * the block's end. Eased for a smooth ramp.
 */
function tailBlend(ev: ShowEvent, t: number, dur: number): number {
  const d = Math.max(0.05, dur);
  const start = ev.time + ev.duration - d;
  if (t <= start) return 0;
  return easeInOut((t - start) / d);
}

/** The next block of the same type on the same lane, at/after this one ends. */
function nextOnLane(sorted: ShowEvent[], ev: ShowEvent): ShowEvent | null {
  const end = ev.time + ev.duration - 0.001;
  let best: ShowEvent | null = null;
  for (const e of sorted) {
    if (e === ev || e.lane !== ev.lane || e.type !== ev.type) continue;
    if (e.time < end) continue;
    if (!best || e.time < best.time) best = e;
  }
  return best;
}

/** Build a MoveState from a light_sweep event's params. */
function moveFromSweep(ev: ShowEvent): MoveState {
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
  return move;
}

/** Build a MoveState from a laser_on event's params. */
function moveFromLaser(ev: ShowEvent): MoveState {
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
  return move;
}

/** The transition config of an event, if it's enabled. */
function transitionOf(ev: ShowEvent): { duration: number } | null {
  const tr = ev.transition;
  return tr && tr.enabled ? { duration: tr.duration > 0 ? tr.duration : 1 } : null;
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
    // Lights are OFF by default: a fixture only lights up when an event drives
    // it (i.e. when it's "its turn" on the timeline). Anything the show isn't
    // currently cueing stays dark.
    light: { color: [1, 1, 1], intensity: 0, strobe: 1, strobing: false, move: { ...STILL } },
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

  // A light is lit ONLY while an action targeting it is active. Any light action
  // (colour / intensity / strobe / movement) "cues" its targets on for its span;
  // a fixture with no active action stays dark. `explicitIntensity` records a
  // level set by a light_intensity action; other actions light at full.
  const litTargets = new Set<string>();
  const explicitIntensity: Record<string, number> = {};
  const cue = (tg: string) => litTargets.add(tg);

  for (const ev of sorted) {
    const started = ev.time <= t;
    const active = t >= ev.time && t < ev.time + Math.max(ev.duration, 0.0001);
    const local = ev.duration > 0 ? (t - ev.time) / ev.duration : active ? 1 : 0;

    const targets = targetsOf(ev);

    switch (ev.type) {
      // ---- Light actions (window-scoped: lit only while active) ------------
      case 'light_color': {
        // A colour action lights its targets (at full unless an intensity action
        // also runs) in that colour, for the length of its clip. With transition
        // on, it crossfades toward the next colour block near its end.
        if (active) {
          let color = hexToRgb(str(ev.params, 'color', '#ffffff'));
          const trn = transitionOf(ev);
          if (trn) {
            const bf = tailBlend(ev, t, trn.duration);
            if (bf > 0) {
              const next = nextOnLane(sorted, ev);
              const nextColor = next ? hexToRgb(str(next.params, 'color', '#ffffff')) : color;
              color = lerpRgb(color, nextColor, bf);
            }
          }
          for (const tg of targets) {
            ensureOverride(state, tg).color = color;
            cue(tg);
          }
        }
        break;
      }
      case 'light_intensity': {
        // Sets the explicit brightness of its targets while active. With
        // transition on, it eases toward the next block's level — or to 0 (a
        // smooth fade-out) when this block has no follower.
        if (active) {
          let value = num(ev.params, 'intensity', 1);
          const trn = transitionOf(ev);
          if (trn) {
            const bf = tailBlend(ev, t, trn.duration);
            if (bf > 0) {
              const next = nextOnLane(sorted, ev);
              const nextValue = next ? num(next.params, 'intensity', 1) : 0;
              value = lerp(value, nextValue, bf);
            }
          }
          for (const tg of targets) {
            explicitIntensity[tg] = value;
            cue(tg);
          }
        }
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
            explicitIntensity[tg] = Math.max(explicitIntensity[tg] ?? 0, 1.3);
            cue(tg);
          }
        }
        break;
      }
      case 'light_sweep': {
        // "Movement" event: sets the beam movement pattern + speed for its span.
        // With transition on, it eases from this movement toward the next block's
        // movement (or back to still if it's the last), so e.g. an up-sweep glides
        // smoothly into a down-sweep instead of snapping.
        if (active) {
          const move = moveFromSweep(ev);
          const trn = transitionOf(ev);
          if (trn) {
            const bf = tailBlend(ev, t, trn.duration);
            if (bf > 0) {
              const next = nextOnLane(sorted, ev);
              move.blendTo = next ? moveFromSweep(next) : { ...STILL };
              move.blendFactor = bf;
            }
          }
          for (const tg of targets) {
            ensureOverride(state, tg).move = { ...move };
            cue(tg);
          }
        }
        break;
      }
      case 'laser_on': {
        if (active) {
          let intensity = envelope(local) * 0.5 + 0.5;
          const move = moveFromLaser(ev);
          const trn = transitionOf(ev);
          if (trn) {
            const bf = tailBlend(ev, t, trn.duration);
            if (bf > 0) {
              const next = nextOnLane(sorted, ev);
              // Ease the fan movement toward the next laser cue (or hold shape);
              // with no follower, fade the beams out smoothly instead of cutting.
              move.blendTo = next ? moveFromLaser(next) : { ...STILL };
              move.blendFactor = bf;
              if (!next) intensity = intensity * (1 - bf);
            }
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

  // Apply brightness to every cued light: the explicit level from an intensity /
  // strobe action, or full (1) for a colour / movement action that gives none.
  // Untargeted, un-cued fixtures keep the default intensity 0 — i.e. stay dark.
  const DEFAULT_ON = 1;
  for (const tg of litTargets) {
    const target = tg === 'all' ? state.light : ensureOverride(state, tg);
    target.intensity = explicitIntensity[tg] ?? DEFAULT_ON;
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
