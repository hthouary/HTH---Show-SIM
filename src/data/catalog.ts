import type { EventCategory, LibraryCategory, SceneObject, SceneObjectType, ShowEventType } from '../types/show';

export interface CatalogEntry {
  type: SceneObjectType;
  label: string;
  category: LibraryCategory;
  /** Short hint shown in the library. */
  hint: string;
  /** Which effect family this object's events naturally belong to. */
  track: EventCategory;
  /** Whether the object emits a light/laser cone (drives inspector fields). */
  emitsBeam: boolean;
  /** Default factory values applied when the object is added. */
  defaults: Partial<SceneObject>;
}

export const CATALOG: CatalogEntry[] = [
  // ---------------------------------------------------------------- Stage
  {
    type: 'stage_platform',
    label: 'Stage Platform',
    category: 'stage',
    hint: 'Raised deck',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#2a2f3a', scale: 1, position: [0, 0.25, 0], intensity: 0 },
  },
  {
    type: 'truss',
    label: 'Truss',
    category: 'stage',
    hint: 'Overhead rig',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#9aa3b2', scale: 1, position: [0, 6, -1], intensity: 0 },
  },
  {
    type: 'truss_tower',
    label: 'Truss Tower',
    category: 'stage',
    hint: 'Vertical column',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#9aa3b2', scale: 1, position: [-6, 2.5, -2], intensity: 0 },
  },
  {
    type: 'truss_arch',
    label: 'Truss Arch',
    category: 'stage',
    hint: 'Goalpost gate',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#9aa3b2', scale: 1, position: [0, 2.6, -5], intensity: 0 },
  },
  {
    type: 'speaker',
    label: 'Speaker',
    category: 'stage',
    hint: 'PA stack',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#111419', scale: 1, position: [-7, 1.6, 2], intensity: 0 },
  },
  {
    type: 'led_screen',
    label: 'LED Screen',
    category: 'stage',
    hint: 'Video wall',
    track: 'led',
    emitsBeam: false,
    defaults: { color: '#1a2a44', scale: 1, position: [0, 5, -6.5], intensity: 1 },
  },
  {
    type: 'dj_booth',
    label: 'DJ Booth',
    category: 'stage',
    hint: 'Front-of-stage',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#15181f', scale: 1, position: [0, 0.9, 0], intensity: 0.2 },
  },
  {
    type: 'crowd_block',
    label: 'Crowd Block',
    category: 'stage',
    hint: 'Audience',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#0c0e14', scale: 1, position: [0, 0, 12], intensity: 0 },
  },

  // --------------------------------------------------------------- Lights
  {
    type: 'moving_head_spot',
    label: 'Moving Head Spot',
    category: 'lights',
    hint: 'Sharp beam',
    track: 'lights',
    emitsBeam: true,
    defaults: {
      color: '#22d3ee',
      intensity: 1,
      beamAngle: 7,
      position: [-4, 6, -1],
      target: [-2, 0, 2],
    },
  },
  {
    type: 'moving_head_wash',
    label: 'Moving Head Wash',
    category: 'lights',
    hint: 'Soft wash',
    track: 'lights',
    emitsBeam: true,
    defaults: {
      color: '#8b5cf6',
      intensity: 1,
      beamAngle: 16,
      position: [4, 6, -1],
      target: [2, 0, 2],
    },
  },
  {
    type: 'beam_light',
    label: 'Beam Light',
    category: 'lights',
    hint: 'Tight pillar',
    track: 'lights',
    emitsBeam: true,
    defaults: {
      color: '#3b82f6',
      intensity: 1.2,
      beamAngle: 4,
      position: [0, 6, -2],
      target: [0, 0, 0],
    },
  },
  {
    type: 'strobe',
    label: 'Strobe',
    category: 'lights',
    hint: 'White flash',
    track: 'lights',
    emitsBeam: true,
    defaults: {
      color: '#ffffff',
      intensity: 1.4,
      beamAngle: 30,
      position: [0, 5.5, -4],
      target: [0, 0, 4],
    },
  },
  {
    type: 'blinder',
    label: 'Blinder',
    category: 'lights',
    hint: 'Audience light',
    track: 'lights',
    emitsBeam: true,
    defaults: {
      color: '#ffd9a0',
      intensity: 1,
      beamAngle: 40,
      position: [0, 4.5, -3],
      target: [0, 1, 10],
    },
  },

  // ------------------------------------------------------------------- FX
  {
    type: 'laser',
    label: 'Laser',
    category: 'fx',
    hint: 'Beam fan',
    track: 'lasers',
    emitsBeam: true,
    defaults: {
      color: '#39ff14',
      intensity: 1,
      beamAngle: 18,
      position: [-5, 5.5, -3],
      target: [0, 1, 8],
    },
  },
  {
    type: 'smoke_machine',
    label: 'Smoke Machine',
    category: 'fx',
    hint: 'Haze cloud',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#dfe7f2', intensity: 1, position: [-6, 0.22, -2] },
  },
  {
    type: 'flame_jet',
    label: 'Flame Jet',
    category: 'fx',
    hint: 'Fire burst',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#ff7b1c', intensity: 1, position: [-3, 0.34, -3] },
  },
  {
    type: 'co2_jet',
    label: 'CO2 Jet',
    category: 'fx',
    hint: 'Cryo blast',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#eaf2ff', intensity: 1, position: [3, 0.38, -3] },
  },
  {
    type: 'confetti_cannon',
    label: 'Confetti Cannon',
    category: 'fx',
    hint: 'Paper burst',
    track: 'fx',
    emitsBeam: false,
    defaults: { color: '#e64bd6', intensity: 1, position: [5, 0.42, -2] },
  },
];

export const CATALOG_BY_TYPE: Record<SceneObjectType, CatalogEntry> = CATALOG.reduce(
  (acc, entry) => {
    acc[entry.type] = entry;
    return acc;
  },
  {} as Record<SceneObjectType, CatalogEntry>,
);

export const CATEGORY_LABELS: Record<LibraryCategory, string> = {
  stage: 'Stage',
  lights: 'Lights',
  fx: 'FX',
};

/** True for objects that participate in the lighting simulation. */
export function isLightFixture(type: SceneObjectType): boolean {
  return (
    type === 'moving_head_spot' ||
    type === 'moving_head_wash' ||
    type === 'beam_light' ||
    type === 'strobe' ||
    type === 'blinder'
  );
}

export function isFxEmitter(type: SceneObjectType): boolean {
  return (
    type === 'smoke_machine' ||
    type === 'flame_jet' ||
    type === 'co2_jet' ||
    type === 'confetti_cannon'
  );
}

/** Truss-family structures that fixtures can be rigged onto. */
export function isStructure(type: SceneObjectType): boolean {
  return type === 'truss' || type === 'truss_tower' || type === 'truss_arch';
}

/** Fixtures that can be clipped onto a structure (lights + lasers). */
export function isRiggable(type: SceneObjectType): boolean {
  return isLightFixture(type) || type === 'laser';
}

let idCounter = 0;
/** Reasonably-unique id generator (good enough for a local V1). */
export function createId(prefix = 'obj'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.floor(
    Math.random() * 1e6,
  ).toString(36)}`;
}

const DEFAULT_OBJECT: Omit<SceneObject, 'id' | 'type' | 'name'> = {
  position: [0, 1, 0],
  rotation: [0, 0, 0],
  scale: 1,
  color: '#22d3ee',
  intensity: 1,
  beamAngle: 12,
  target: [0, 0, 4],
};

/** Build a fresh SceneObject from the catalog defaults for a given type. */
export function createSceneObject(type: SceneObjectType, overrides: Partial<SceneObject> = {}): SceneObject {
  const entry = CATALOG_BY_TYPE[type];
  const base: SceneObject = {
    ...DEFAULT_OBJECT,
    id: createId(type),
    type,
    name: entry.label,
    ...entry.defaults,
  } as SceneObject;
  return { ...base, ...overrides } as SceneObject;
}

/** Default params for a newly created event of a given type. */
export function defaultEventParams(type: string): Record<string, unknown> {
  switch (type) {
    case 'light_color':
    case 'laser_color':
    case 'led_color':
      return { color: '#22d3ee' };
    case 'light_intensity':
      return { intensity: 1 };
    case 'light_strobe':
      return { rate: 9, color: '#ffffff' };
    case 'light_sweep':
      return { pattern: 'wave', speed: 40 };
    case 'laser_on':
      return { color: '#39ff14', pattern: 'circular', speed: 45 };
    case 'led_pulse':
      return { color: '#22d3ee', rate: 2 };
    case 'smoke_burst':
    case 'co2_burst':
      return { intensity: 1 };
    case 'flame_burst':
      return { intensity: 1 };
    case 'confetti_burst':
      return { intensity: 1 };
    case 'blackout':
      return {};
    default:
      return {};
  }
}

/** Colour per effect family (drives the block + track accents). */
export const CATEGORY_COLOR: Record<EventCategory, string> = {
  lights: '#22d3ee',
  lasers: '#39ff14',
  fx: '#ff7b1c',
  led: '#8b5cf6',
  global: '#f43f5e',
};

/** Every event type with its family, grouped for the block "Type" picker. */
export const EVENT_TYPE_GROUPS: { category: EventCategory; types: ShowEventType[] }[] = [
  { category: 'lights', types: ['light_color', 'light_intensity', 'light_strobe', 'light_sweep'] },
  { category: 'lasers', types: ['laser_on', 'laser_color'] },
  { category: 'fx', types: ['smoke_burst', 'flame_burst', 'co2_burst', 'confetti_burst'] },
  { category: 'led', types: ['led_color', 'led_pulse'] },
  { category: 'global', types: ['blackout'] },
];

const TYPE_CATEGORY: Record<ShowEventType, EventCategory> = EVENT_TYPE_GROUPS.reduce(
  (acc, g) => {
    for (const t of g.types) acc[t] = g.category;
    return acc;
  },
  {} as Record<ShowEventType, EventCategory>,
);

/** The effect family a given event type belongs to. */
export function eventCategory(type: ShowEventType): EventCategory {
  return TYPE_CATEGORY[type] ?? 'global';
}

/** Display colour for an event block of a given type. */
export function eventColor(type: ShowEventType): string {
  return CATEGORY_COLOR[eventCategory(type)];
}
