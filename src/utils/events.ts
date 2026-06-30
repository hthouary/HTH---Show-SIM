import type { ShowEvent } from '../types/show';

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

export interface LightState {
  color: RGB;
  intensity: number;
  /** 0..1 strobe gate (1 = lit during a flash, 0 = dark). */
  strobe: number;
  /** Whether a strobe window is currently active. */
  strobing: boolean;
  /** -1..1 horizontal sweep offset for pan animation. */
  sweep: number;
}

export interface LaserState {
  active: boolean;
  color: RGB;
  intensity: number;
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
    light: { color: [1, 1, 1], intensity: 0.55, strobe: 1, strobing: false, sweep: 0 },
    overrides: {},
    laser: { active: false, color: [0.22, 1, 0.08], intensity: 1 },
    laserOverrides: {},
    led: { color: [0.07, 0.12, 0.24], pulse: 0 },
    bursts: { smoke: {}, flame: {}, co2: {}, confetti: {} },
  };
}

function ensureOverride(state: ShowState, target: string): Partial<LightState> {
  if (target === 'all') return state.light;
  if (!state.overrides[target]) state.overrides[target] = {};
  return state.overrides[target];
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

    switch (ev.type) {
      // ---- State events (persist after start) -----------------------------
      case 'light_color': {
        if (started) ensureOverride(state, ev.target).color = hexToRgb(str(ev.params, 'color', '#ffffff'));
        break;
      }
      case 'light_intensity': {
        if (started) ensureOverride(state, ev.target).intensity = num(ev.params, 'intensity', 1);
        break;
      }
      case 'laser_color': {
        if (started) {
          const rgb = hexToRgb(str(ev.params, 'color', '#39ff14'));
          if (ev.target === 'all') state.laser.color = rgb;
          else state.laserOverrides[ev.target] = rgb;
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
          const target = ensureOverride(state, ev.target);
          const rate = num(ev.params, 'rate', 14);
          const gate = Math.sin(t * rate * Math.PI * 2) > 0 ? 1 : 0;
          target.strobe = gate;
          target.strobing = true;
          target.color = hexToRgb(str(ev.params, 'color', '#ffffff'));
          target.intensity = Math.max(target.intensity ?? 1, 1.6);
        }
        break;
      }
      case 'light_sweep': {
        if (active) {
          const target = ensureOverride(state, ev.target);
          const speed = num(ev.params, 'speed', 0.6);
          const amp = num(ev.params, 'amplitude', 1);
          target.sweep = Math.sin(t * speed * Math.PI * 2) * amp;
        }
        break;
      }
      case 'laser_on': {
        if (active) {
          state.laser.active = true;
          state.laser.intensity = envelope(local) * 0.5 + 0.5;
          const c = ev.params['color'];
          if (typeof c === 'string') {
            if (ev.target === 'all') state.laser.color = hexToRgb(c);
            else state.laserOverrides[ev.target] = hexToRgb(c);
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
          bucket[ev.target] = {
            progress: Math.max(0, Math.min(1, local)),
            env: envelope(local),
            intensity: num(ev.params, 'intensity', 1),
          };
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
