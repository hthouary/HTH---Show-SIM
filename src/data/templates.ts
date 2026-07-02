import type { ShowEventType } from '../types/show';

/**
 * Ready-made event groups you can stamp onto the timeline at the playhead. Each
 * template creates one lane per `row` and drops its events there, so a common
 * cue (a strobe build-up, a laser hit, a CO2 drop, a blackout stab) is one click
 * instead of a dozen manual blocks.
 */
export type TemplateKey = 'strobe_buildup' | 'laser_hit' | 'co2_drop' | 'blackout_flash';

interface TemplateEvent {
  /** Which lane row (0-based) within the template this block sits on. */
  row: number;
  type: ShowEventType;
  /** Start offset from the playhead, in seconds. */
  at: number;
  duration: number;
  params: Record<string, unknown>;
}

interface EventTemplate {
  rows: number;
  events: TemplateEvent[];
}

export const TEMPLATE_LIST: TemplateKey[] = ['strobe_buildup', 'laser_hit', 'co2_drop', 'blackout_flash'];

export const TEMPLATES: Record<TemplateKey, EventTemplate> = {
  strobe_buildup: {
    rows: 1,
    events: [
      { row: 0, type: 'light_strobe', at: 0, duration: 0.75, params: { rate: 6, color: '#ffffff' } },
      { row: 0, type: 'light_strobe', at: 0.75, duration: 0.6, params: { rate: 9, color: '#ffffff' } },
      { row: 0, type: 'light_strobe', at: 1.35, duration: 0.5, params: { rate: 13, color: '#ffffff' } },
      { row: 0, type: 'light_strobe', at: 1.85, duration: 0.4, params: { rate: 18, color: '#ffffff' } },
    ],
  },
  laser_hit: {
    rows: 2,
    events: [
      { row: 0, type: 'laser_on', at: 0, duration: 1.5, params: { color: '#39ff14', pattern: 'circular', speed: 72 } },
      { row: 1, type: 'light_strobe', at: 0, duration: 0.3, params: { rate: 16, color: '#ffffff' } },
    ],
  },
  co2_drop: {
    rows: 3,
    events: [
      { row: 0, type: 'co2_burst', at: 0, duration: 1.2, params: { intensity: 1.3 } },
      { row: 1, type: 'light_color', at: 0, duration: 2, params: { color: '#ffffff' } },
      { row: 2, type: 'confetti_burst', at: 0.2, duration: 1.2, params: { intensity: 1.4 } },
    ],
  },
  blackout_flash: {
    rows: 1,
    events: [
      { row: 0, type: 'light_strobe', at: 0, duration: 0.35, params: { rate: 18, color: '#ffffff' } },
      { row: 0, type: 'blackout', at: 0.35, duration: 1.4, params: {} },
    ],
  },
};
