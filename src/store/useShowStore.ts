import { create } from 'zustand';
import type { AppMode, Lane, PlayMode, Project, SceneObject, SceneObjectType, ShowEvent, ShowEventType, Vec3 } from '../types/show';
import { createId, createSceneObject, defaultEventParams, eventCategory, isFxEmitter, isLightFixture } from '../data/catalog';
import { createDemoProject } from '../data/demoProject';
import { audioEngine } from '../utils/audio';
import { deleteAudio, getAudio, putAudio } from '../utils/audioStore';
import { hypeMeter } from '../utils/hype';
import { sfx } from '../utils/sfx';
import { resolvePlacement, type PlacementSettings } from '../utils/collision';
import { snapToGrid } from '../utils/beat';
import { firstFreeStart, placeOnLane, resizeEvent as resizeEventTimes } from '../utils/timeline';
import { TEMPLATES, type TemplateKey } from '../data/templates';
import { translate, type Lang } from '../i18n/translations';
import {
  getLastProjectId,
  loadProject as loadProjectFromStorage,
  parseProjectJSON,
  saveProject as persistProject,
} from '../utils/project';

export type ToastKind = 'info' | 'success' | 'error';
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ShowState {
  // ---- Document -------------------------------------------------------
  project: Project;

  // ---- Selection ------------------------------------------------------
  /** Primary / anchor selection (used by the inspector + transform gizmo). */
  selectedObjectId: string | null;
  /** Full multi-selection set (includes the primary id). */
  selectedObjectIds: string[];
  /** Primary / anchor timeline event. */
  selectedEventId: string | null;
  /** Full event multi-selection set (includes the primary id). */
  selectedEventIds: string[];

  // ---- Playback -------------------------------------------------------
  isPlaying: boolean;
  currentTime: number;
  /** Effective show length (audio duration if loaded, else settings.duration). */
  duration: number;
  hasAudio: boolean;

  // ---- Transient UI ---------------------------------------------------
  toasts: Toast[];
  /** Copied timeline events, ready to paste at the playhead. */
  clipboard: ShowEvent[];
  /** Transient live-pad events (VJ triggers), layered over the timeline. */
  liveEvents: ShowEvent[];
  /** When on, live triggers are also written into the timeline ("Live" lanes). */
  liveRecord: boolean;
  /** Current working mode: build (construction sandbox) or show (timeline). */
  appMode: AppMode;
  /** Experience profile: playful sim (game) or clean authoring (pro). */
  playMode: PlayMode;
  /** Whether the welcome / help guide overlay is open. */
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  /** When set, the next click in the scene places an object of this type. */
  placementType: SceneObjectType | null;
  /** Whether floor / object collisions are enforced while placing / moving. */
  collisions: boolean;
  /** Show the build grid on the floor. */
  showGrid: boolean;
  /** Snap placed / moved objects to the build grid. */
  gridSnap: boolean;
  /** Build grid cell size (world units). */
  gridSize: number;
  /** Magnetically snap objects flush against each other while placing / moving. */
  magnet: boolean;
  /** Bright neutral "work light" so the whole scene is visible while building. */
  workLight: boolean;
  /** Procedural FX / crowd sound effects on/off. */
  sound: boolean;
  /** Active transform gizmo mode. */
  gizmoMode: 'translate' | 'rotate';
  /** Render quality: 'high' enables reflections / shadows, 'low' keeps it light. */
  quality: 'low' | 'high';
  /** UI language. */
  language: Lang;
  setLanguage: (lang: Lang) => void;

  // ---- Timeline / musical grid ----------------------------------------
  /** Snap timeline events to the beat grid while placing / dragging. */
  snapEnabled: boolean;
  /** Snap step in beats (4 = bar, 1 = beat, 0.5 = 1/2, 0.25 = 1/4). */
  snapDivision: number;
  /** Show the beat/bar grid on the timeline. */
  showBeatGrid: boolean;

  // ---- Undo / redo ----------------------------------------------------
  past: Project[];
  future: Project[];
  undo: () => void;
  redo: () => void;

  // ---- Object actions -------------------------------------------------
  addObject: (type: SceneObjectType) => void;
  addObjectAt: (type: SceneObjectType, position: Vec3, parentId?: string | null) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  moveObject: (id: string, position: Vec3) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  /** Toggle an object in/out of the multi-selection (Shift-click). */
  toggleSelectObject: (id: string) => void;

  // ---- Selection / build power tools ----------------------------------
  /** Translate every selected object (and its aim target) by a delta. */
  nudgeSelection: (delta: Vec3) => void;
  duplicateSelection: () => void;
  /** Stamp `count` copies of the selection, each offset by `step`. */
  arraySelection: (count: number, step: Vec3) => void;
  /** Mirror the selection across the stage centre on the X or Z axis. */
  mirrorSelection: (axis: 'x' | 'z') => void;
  /** Align every selected object to the anchor on one axis. */
  alignSelection: (axis: 0 | 1 | 2) => void;
  /** Evenly distribute the selection along the X or Z axis. */
  distributeSelection: (axis: 0 | 2) => void;
  /** Rig an object onto a structure (or detach when parentId is null). */
  attachToParent: (childId: string, parentId: string | null) => void;

  // ---- Groups (named selection sets) ----------------------------------
  /** Save the current multi-selection as a named group. */
  createGroup: (name?: string) => void;
  /** Select every (still-existing) member of a group. */
  selectGroup: (id: string) => void;
  /** Replace a group's members with the current selection. */
  setGroupToSelection: (id: string) => void;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;

  // ---- Mode / build tools ---------------------------------------------
  setAppMode: (mode: AppMode) => void;
  setPlayMode: (mode: PlayMode) => void;
  toggleGrid: () => void;
  toggleGridSnap: () => void;
  setGridSize: (size: number) => void;
  toggleMagnet: () => void;
  toggleWorkLight: () => void;
  toggleSound: () => void;

  // ---- Placement / editor ---------------------------------------------
  setPlacementType: (type: SceneObjectType | null) => void;
  cancelPlacement: () => void;
  toggleCollisions: () => void;
  setGizmoMode: (mode: 'translate' | 'rotate') => void;
  toggleQuality: () => void;
  setBpm: (bpm: number) => void;
  toggleSnap: () => void;
  setSnapDivision: (division: number) => void;
  toggleBeatGrid: () => void;

  // ---- Lane actions ---------------------------------------------------
  addLane: () => void;
  removeLane: (id: string) => void;
  renameLane: (id: string, name: string) => void;

  // ---- Event actions --------------------------------------------------
  addBlock: (laneId: string) => void;
  moveEvent: (id: string, time: number, laneId: string) => void;
  resizeEventBlock: (id: string, edge: 'left' | 'right', timeAtPointer: number) => void;
  updateEvent: (id: string, patch: Partial<ShowEvent>) => void;
  duplicateEvent: (id: string) => void;
  deleteEvent: (id: string) => void;
  selectEvent: (id: string | null) => void;
  /** Toggle an event in/out of the multi-selection (Shift-click). */
  toggleSelectEvent: (id: string) => void;
  /** Batch-set event start times (used by group drag). */
  applyEventTimes: (times: Record<string, number>) => void;
  /** Delete every selected event. */
  deleteEventSelection: () => void;
  /** Copy the selected events to the clipboard. */
  copyEventSelection: () => void;
  /** Paste the clipboard at the playhead. */
  pasteClipboard: () => void;
  /** Stamp a ready-made event group at the playhead. */
  addTemplate: (key: TemplateKey) => void;

  // ---- Live pads (VJ mode) ---------------------------------------------
  /** Fire an instant FX at the playhead (records it too when REC is on). */
  triggerLive: (type: ShowEventType) => void;
  toggleLiveRecord: () => void;

  // ---- Playback actions ----------------------------------------------
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  /** Called when playback reaches the end: pauses + posts the crowd rating. */
  finishShow: () => void;
  /** Crowd rating from the last completed run (null = no card shown). */
  showResult: { score: number; peak: number } | null;
  clearShowResult: () => void;

  // ---- Audio actions --------------------------------------------------
  loadAudioFile: (file: File) => Promise<void>;
  clearAudio: () => void;
  /** Restore the current project's saved audio (IndexedDB) after a load. */
  restoreAudio: () => Promise<void>;

  // ---- Project actions ------------------------------------------------
  setProjectName: (name: string) => void;
  setSettings: (patch: Partial<Project['settings']>) => void;
  newProject: () => void;
  saveCurrentProject: () => void;
  loadProjectById: (id: string) => void;
  importProjectJSON: (text: string) => void;
  replaceProject: (project: Project) => void;

  // ---- Toasts ---------------------------------------------------------
  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: string) => void;
}

/**
 * An older saved copy of the bundled demo whose light cues all target "all"
 * fixtures (the previous default). We refresh it to the current per-fixture demo
 * so the lighting behaves as expected. Only the *unedited* stock demo matches:
 * a renamed project, a user's own show, or a demo whose cues were retargeted all
 * keep their saved data untouched.
 */
function isStaleStockDemo(p: Project): boolean {
  if (p.name !== 'Demo Festival Intro') return false;
  const lightCues = p.events.filter((e) => e.type.startsWith('light_') && e.type !== 'light_strobe');
  if (lightCues.length === 0) return false;
  return lightCues.every((e) => !e.targets || e.targets.length === 0);
}

function initialProject(): Project {
  const lastId = getLastProjectId();
  if (lastId) {
    const existing = loadProjectFromStorage(lastId);
    if (existing) return isStaleStockDemo(existing) ? createDemoProject() : existing;
  }
  return createDemoProject();
}

function initialLanguage(): Lang {
  try {
    const saved = localStorage.getItem('showforge.lang');
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/** Persisted construction preferences (grid / snapping / mode / work light). */
interface BuildPrefs {
  appMode: AppMode;
  collisions: boolean;
  showGrid: boolean;
  gridSnap: boolean;
  gridSize: number;
  magnet: boolean;
  workLight: boolean;
  sound: boolean;
  playMode: PlayMode;
}

const BUILD_DEFAULTS: BuildPrefs = {
  appMode: 'show',
  collisions: false,
  showGrid: false,
  gridSnap: false,
  gridSize: 1,
  magnet: true,
  workLight: false,
  sound: true,
  playMode: 'game',
};

const BUILD_KEY = 'showforge.build';

/** Duration + params of each live-pad trigger. */
const LIVE_DEFS: Partial<Record<ShowEventType, { duration: number; params: Record<string, unknown> }>> = {
  flame_burst: { duration: 1.2, params: { intensity: 1.3 } },
  co2_burst: { duration: 1.2, params: { intensity: 1.3 } },
  confetti_burst: { duration: 1.2, params: { intensity: 1.5 } },
  smoke_burst: { duration: 4, params: { intensity: 1.2 } },
  light_strobe: { duration: 1.0, params: { rate: 14, color: '#ffffff' } },
  laser_on: { duration: 2.5, params: { color: '#39ff14', pattern: 'circular', speed: 70 } },
  blackout: { duration: 0.8, params: {} },
};

function initialBuildPrefs(): BuildPrefs {
  try {
    const raw = localStorage.getItem(BUILD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BuildPrefs>;
      return { ...BUILD_DEFAULTS, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...BUILD_DEFAULTS };
}

function saveBuildPrefs(p: BuildPrefs) {
  try {
    localStorage.setItem(BUILD_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export const useShowStore = create<ShowState>((set, get) => {
  const startProject = initialProject();
  const buildPrefs = initialBuildPrefs();
  sfx.enabled = buildPrefs.sound && buildPrefs.playMode === 'game';

  // Snapshot the current build preferences to localStorage.
  const persistBuild = () => {
    const s = get();
    saveBuildPrefs({
      appMode: s.appMode,
      collisions: s.collisions,
      showGrid: s.showGrid,
      gridSnap: s.gridSnap,
      gridSize: s.gridSize,
      magnet: s.magnet,
      workLight: s.workLight,
      sound: s.sound,
      playMode: s.playMode,
    });
  };

  // Build the placement pipeline settings from the current state.
  const placement = (s: ShowState): PlacementSettings => ({
    collisions: s.collisions,
    gridSnap: s.gridSnap,
    gridSize: s.gridSize,
    magnet: s.magnet,
  });

  // Undo/redo history. `record(label)` snapshots the current project *before* a
  // mutation. Consecutive mutations with the same label within a short window
  // are coalesced into one undo step (so dragging a slider is a single undo).
  let histLabel = '';
  let histTime = 0;
  const record = (label: string) => {
    const now = Date.now();
    if (label === histLabel && now - histTime < 700) {
      histTime = now;
      return;
    }
    histLabel = label;
    histTime = now;
    set((s) => ({ past: [...s.past.slice(-59), s.project], future: [] }));
  };
  const resetHistory = () => {
    histLabel = '';
    histTime = 0;
  };

  // Translate using the current language (for toasts / created object names).
  const tr = (key: string, params?: Record<string, string | number>) =>
    translate(get().language, key, params);

  return {
    project: startProject,
    selectedObjectId: null,
    selectedObjectIds: [],
    selectedEventId: null,
    selectedEventIds: [],
    isPlaying: false,
    currentTime: 0,
    duration: startProject.settings.duration,
    hasAudio: false,
    toasts: [],
    clipboard: [],
    showResult: null,
    liveEvents: [],
    liveRecord: false,
    appMode: buildPrefs.appMode,
    playMode: buildPrefs.playMode,
    helpOpen: false,
    placementType: null,
    collisions: buildPrefs.collisions,
    showGrid: buildPrefs.showGrid,
    gridSnap: buildPrefs.gridSnap,
    gridSize: buildPrefs.gridSize,
    magnet: buildPrefs.magnet,
    workLight: buildPrefs.workLight,
    sound: buildPrefs.sound,
    gizmoMode: 'translate',
    quality: 'high',
    language: initialLanguage(),
    snapEnabled: true,
    snapDivision: 1,
    showBeatGrid: true,
    past: [],
    future: [],

    undo: () =>
      set((s) => {
        if (s.past.length === 0) return {};
        resetHistory();
        const previous = s.past[s.past.length - 1];
        return {
          past: s.past.slice(0, -1),
          future: [s.project, ...s.future].slice(0, 60),
          project: previous,
        };
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0) return {};
        resetHistory();
        const next = s.future[0];
        return {
          past: [...s.past, s.project].slice(-60),
          future: s.future.slice(1),
          project: next,
        };
      }),

    setGizmoMode: (mode) => set({ gizmoMode: mode }),
    setLanguage: (lang) => {
      try {
        localStorage.setItem('showforge.lang', lang);
      } catch {
        /* ignore */
      }
      set({ language: lang });
    },
    toggleQuality: () => {
      const next = get().quality === 'high' ? 'low' : 'high';
      set({ quality: next });
      get().pushToast('info', tr('toast.quality', { q: tr(next === 'high' ? 'quality.high' : 'quality.low') }));
    },
    setBpm: (bpm) => {
      const clamped = Math.max(40, Math.min(300, Math.round(bpm)));
      get().setSettings({ bpm: clamped });
    },
    toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
    setSnapDivision: (division) => set({ snapDivision: division }),
    toggleBeatGrid: () => set((s) => ({ showBeatGrid: !s.showBeatGrid })),

    // ---------------------------------------------------------------- Objects
    addObject: (type) => {
      record('add');
      const label = tr(`obj.${type}.label`);
      const obj = createSceneObject(type, { name: label });
      set((s) => ({
        project: { ...s.project, objects: [...s.project.objects, obj], updatedAt: Date.now() },
        selectedObjectId: obj.id,
        selectedObjectIds: [obj.id],
      }));
      get().pushToast('success', tr('toast.added', { name: label }));
    },

    addObjectAt: (type, position, parentId = null) => {
      record('add');
      const s = get();
      const label = tr(`obj.${type}.label`);
      // Dropping straight onto a structure clips the fixture there — no grid /
      // collision resolution, so it lands exactly where you aimed.
      const pos = parentId
        ? ([Math.round(position[0] * 100) / 100, Math.round(position[1] * 100) / 100, Math.round(position[2] * 100) / 100] as Vec3)
        : resolvePlacement(s.project.objects, null, type, 1, position, placement(s));
      const obj = createSceneObject(type, { position: pos, name: label, parent: parentId ?? undefined });
      set((st) => ({
        project: { ...st.project, objects: [...st.project.objects, obj], updatedAt: Date.now() },
        selectedObjectId: obj.id,
        selectedObjectIds: [obj.id],
        selectedEventId: null,
        placementType: null,
      }));
      get().pushToast('success', parentId ? tr('toast.rigged', { name: label }) : tr('toast.placed', { name: label }));
    },

    updateObject: (id, patch) => {
      record('update-object');
      set((s) => ({
        project: {
          ...s.project,
          objects: s.project.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
          updatedAt: Date.now(),
        },
      }));
    },

    moveObject: (id, position) => {
      record('move');
      set((s) => {
        const obj = s.project.objects.find((o) => o.id === id);
        if (!obj) return {};
        const pos = resolvePlacement(s.project.objects, id, obj.type, obj.scale, position, placement(s));
        // Move the aim target along with the fixture so its beam keeps its angle.
        const delta: Vec3 = [pos[0] - obj.position[0], pos[1] - obj.position[1], pos[2] - obj.position[2]];
        const shift = (o: SceneObject): SceneObject => ({
          ...o,
          position: [o.position[0] + delta[0], o.position[1] + delta[1], o.position[2] + delta[2]],
          target: [o.target[0] + delta[0], o.target[1] + delta[1], o.target[2] + delta[2]],
        });
        return {
          project: {
            ...s.project,
            objects: s.project.objects.map((o) => {
              if (o.id === id) return { ...o, position: pos, target: [obj.target[0] + delta[0], obj.target[1] + delta[1], obj.target[2] + delta[2]] };
              // Rigged children follow their parent structure.
              if (o.parent === id) return shift(o);
              return o;
            }),
            updatedAt: Date.now(),
          },
        };
      });
    },

    deleteObject: (id) => {
      record('delete');
      set((s) => {
        // Delete the whole current selection when the target is part of it.
        const ids = s.selectedObjectIds.includes(id) ? s.selectedObjectIds : [id];
        const idSet = new Set(ids);
        return {
          project: {
            ...s.project,
            objects: s.project.objects
              .filter((o) => !idSet.has(o.id))
              // Orphan any fixtures rigged to a structure we just removed.
              .map((o) => (o.parent && idSet.has(o.parent) ? { ...o, parent: undefined } : o)),
            // Drop the deleted objects from any event that targeted them.
            events: s.project.events.map((e) =>
              e.targets.some((t) => idSet.has(t)) ? { ...e, targets: e.targets.filter((t) => !idSet.has(t)) } : e,
            ),
            // …and from any group that listed them.
            groups: (s.project.groups ?? []).map((g) =>
              g.members.some((m) => idSet.has(m)) ? { ...g, members: g.members.filter((m) => !idSet.has(m)) } : g,
            ),
            updatedAt: Date.now(),
          },
          selectedObjectId: idSet.has(s.selectedObjectId ?? '') ? null : s.selectedObjectId,
          selectedObjectIds: s.selectedObjectIds.filter((x) => !idSet.has(x)),
        };
      });
    },

    duplicateObject: (id) => {
      const original = get().project.objects.find((o) => o.id === id);
      if (!original) return;
      record('duplicate');
      const copy: SceneObject = {
        ...original,
        id: createId(original.type),
        name: `${original.name} copy`,
        position: [original.position[0] + 1.2, original.position[1], original.position[2] + 1.2],
        target: [original.target[0] + 1.2, original.target[1], original.target[2] + 1.2],
      };
      set((s) => ({
        project: { ...s.project, objects: [...s.project.objects, copy], updatedAt: Date.now() },
        selectedObjectId: copy.id,
        selectedObjectIds: [copy.id],
      }));
    },

    selectObject: (id) =>
      set({ selectedObjectId: id, selectedObjectIds: id ? [id] : [], selectedEventId: null, selectedEventIds: [] }),

    toggleSelectObject: (id) =>
      set((s) => {
        const has = s.selectedObjectIds.includes(id);
        const ids = has ? s.selectedObjectIds.filter((x) => x !== id) : [...s.selectedObjectIds, id];
        return {
          selectedObjectIds: ids,
          selectedObjectId: has ? (ids[ids.length - 1] ?? null) : id,
          selectedEventId: null,
          selectedEventIds: [],
        };
      }),

    // ------------------------------------------------ Selection / power tools
    nudgeSelection: (delta) => {
      const ids = get().selectedObjectIds;
      if (!ids.length || (delta[0] === 0 && delta[1] === 0 && delta[2] === 0)) return;
      record('move-sel');
      const idSet = new Set(ids);
      set((s) => ({
        project: {
          ...s.project,
          objects: s.project.objects.map((o) =>
            idSet.has(o.id)
              ? {
                  ...o,
                  position: [o.position[0] + delta[0], o.position[1] + delta[1], o.position[2] + delta[2]],
                  target: [o.target[0] + delta[0], o.target[1] + delta[1], o.target[2] + delta[2]],
                }
              : o,
          ),
          updatedAt: Date.now(),
        },
      }));
    },

    duplicateSelection: () => {
      const s = get();
      const originals = s.project.objects.filter((o) => s.selectedObjectIds.includes(o.id));
      if (!originals.length) return;
      record('duplicate-sel');
      const copies = originals.map((o) => ({
        ...o,
        id: createId(o.type),
        name: `${o.name} copy`,
        parent: undefined,
        position: [o.position[0] + 1.2, o.position[1], o.position[2] + 1.2] as Vec3,
        target: [o.target[0] + 1.2, o.target[1], o.target[2] + 1.2] as Vec3,
      }));
      set((st) => ({
        project: { ...st.project, objects: [...st.project.objects, ...copies], updatedAt: Date.now() },
        selectedObjectId: copies[copies.length - 1].id,
        selectedObjectIds: copies.map((c) => c.id),
      }));
      get().pushToast('success', tr('toast.duplicated', { n: copies.length }));
    },

    arraySelection: (count, step) => {
      const s = get();
      const originals = s.project.objects.filter((o) => s.selectedObjectIds.includes(o.id));
      const n = Math.max(1, Math.min(50, Math.round(count)));
      if (!originals.length || n <= 1) return;
      record('array-sel');
      const copies: SceneObject[] = [];
      for (let i = 1; i < n; i++) {
        for (const o of originals) {
          copies.push({
            ...o,
            id: createId(o.type),
            name: `${o.name} ${i + 1}`,
            parent: undefined,
            position: [o.position[0] + step[0] * i, o.position[1] + step[1] * i, o.position[2] + step[2] * i],
            target: [o.target[0] + step[0] * i, o.target[1] + step[1] * i, o.target[2] + step[2] * i],
          });
        }
      }
      set((st) => ({
        project: { ...st.project, objects: [...st.project.objects, ...copies], updatedAt: Date.now() },
        selectedObjectIds: [...st.selectedObjectIds, ...copies.map((c) => c.id)],
      }));
      get().pushToast('success', tr('toast.arrayed', { n: copies.length }));
    },

    mirrorSelection: (axis) => {
      const s = get();
      const originals = s.project.objects.filter((o) => s.selectedObjectIds.includes(o.id));
      if (!originals.length) return;
      record('mirror-sel');
      const i = axis === 'x' ? 0 : 2;
      const copies = originals.map((o) => {
        const position = [...o.position] as Vec3;
        const target = [...o.target] as Vec3;
        const rotation = [...o.rotation] as Vec3;
        position[i] = -position[i];
        target[i] = -target[i];
        // Flip the yaw so a mirrored fixture faces symmetrically.
        rotation[1] = -rotation[1];
        return { ...o, id: createId(o.type), name: `${o.name} mirror`, parent: undefined, position, target, rotation };
      });
      set((st) => ({
        project: { ...st.project, objects: [...st.project.objects, ...copies], updatedAt: Date.now() },
        selectedObjectIds: [...st.selectedObjectIds, ...copies.map((c) => c.id)],
      }));
      get().pushToast('success', tr('toast.mirrored', { n: copies.length }));
    },

    alignSelection: (axis) => {
      const s = get();
      const ids = s.selectedObjectIds;
      const anchor = s.project.objects.find((o) => o.id === s.selectedObjectId);
      if (!anchor || ids.length < 2) return;
      record('align-sel');
      const idSet = new Set(ids);
      const to = anchor.position[axis];
      set((st) => ({
        project: {
          ...st.project,
          objects: st.project.objects.map((o) => {
            if (!idSet.has(o.id) || o.id === anchor.id) return o;
            const d = to - o.position[axis];
            const position = [...o.position] as Vec3;
            const target = [...o.target] as Vec3;
            position[axis] = to;
            target[axis] += d;
            return { ...o, position, target };
          }),
          updatedAt: Date.now(),
        },
      }));
    },

    distributeSelection: (axis) => {
      const s = get();
      const sel = s.project.objects.filter((o) => s.selectedObjectIds.includes(o.id));
      if (sel.length < 3) return;
      record('distribute-sel');
      const sorted = [...sel].sort((a, b) => a.position[axis] - b.position[axis]);
      const min = sorted[0].position[axis];
      const max = sorted[sorted.length - 1].position[axis];
      const stepv = (max - min) / (sorted.length - 1);
      const targetPos = new Map<string, number>();
      sorted.forEach((o, i) => targetPos.set(o.id, min + stepv * i));
      set((st) => ({
        project: {
          ...st.project,
          objects: st.project.objects.map((o) => {
            if (!targetPos.has(o.id)) return o;
            const to = targetPos.get(o.id)!;
            const d = to - o.position[axis];
            const position = [...o.position] as Vec3;
            const target = [...o.target] as Vec3;
            position[axis] = to;
            target[axis] += d;
            return { ...o, position, target };
          }),
          updatedAt: Date.now(),
        },
      }));
    },

    attachToParent: (childId, parentId) => {
      record('rig');
      set((s) => ({
        project: {
          ...s.project,
          objects: s.project.objects.map((o) => (o.id === childId ? { ...o, parent: parentId ?? undefined } : o)),
          updatedAt: Date.now(),
        },
      }));
    },

    // ----------------------------------------------------------- Groups
    createGroup: (name) => {
      const s = get();
      const members = s.selectedObjectIds.length ? [...s.selectedObjectIds] : s.selectedObjectId ? [s.selectedObjectId] : [];
      if (members.length === 0) {
        s.pushToast('info', tr('toast.groupNeedsSelection'));
        return;
      }
      const groups = s.project.groups ?? [];
      const grp = { id: createId('grp'), name: name?.trim() || tr('group.defaultName', { n: groups.length + 1 }), members };
      record('create-group');
      set((st) => ({ project: { ...st.project, groups: [...(st.project.groups ?? []), grp], updatedAt: Date.now() } }));
      s.pushToast('success', tr('toast.groupCreated', { name: grp.name, n: members.length }));
    },

    selectGroup: (id) => {
      const s = get();
      const grp = (s.project.groups ?? []).find((g) => g.id === id);
      if (!grp) return;
      const ids = new Set(s.project.objects.map((o) => o.id));
      const members = grp.members.filter((m) => ids.has(m));
      if (members.length === 0) return;
      set({ selectedObjectIds: members, selectedObjectId: members[members.length - 1], selectedEventId: null, selectedEventIds: [] });
    },

    setGroupToSelection: (id) => {
      const s = get();
      const members = s.selectedObjectIds.length ? [...s.selectedObjectIds] : s.selectedObjectId ? [s.selectedObjectId] : [];
      if (members.length === 0) return;
      record('update-group');
      set((st) => ({
        project: {
          ...st.project,
          groups: (st.project.groups ?? []).map((g) => (g.id === id ? { ...g, members } : g)),
          updatedAt: Date.now(),
        },
      }));
    },

    renameGroup: (id, name) => {
      record('rename-group');
      set((s) => ({
        project: {
          ...s.project,
          groups: (s.project.groups ?? []).map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g)),
          updatedAt: Date.now(),
        },
      }));
    },

    deleteGroup: (id) => {
      record('delete-group');
      set((s) => ({
        project: { ...s.project, groups: (s.project.groups ?? []).filter((g) => g.id !== id), updatedAt: Date.now() },
      }));
    },

    // -------------------------------------------------------- Mode / build
    setHelpOpen: (open) => set({ helpOpen: open }),
    setAppMode: (mode) => {
      const prev = get().appMode;
      if (prev === mode) return;
      // Leaving Show pauses playback; entering Build lights the scene up so it
      // is easy to see, and clears any timeline selection. Show mode restores
      // the moody stage lighting.
      if (mode === 'build') {
        get().pause();
        set({ appMode: mode, workLight: true, selectedEventId: null });
      } else {
        set({ appMode: mode, workLight: false, placementType: null });
      }
      persistBuild();
    },
    toggleGrid: () => {
      set((s) => ({ showGrid: !s.showGrid }));
      persistBuild();
    },
    toggleGridSnap: () => {
      set((s) => ({ gridSnap: !s.gridSnap }));
      persistBuild();
    },
    setGridSize: (size) => {
      set({ gridSize: Math.max(0.25, size) });
      persistBuild();
    },
    toggleMagnet: () => {
      set((s) => ({ magnet: !s.magnet }));
      persistBuild();
    },
    toggleWorkLight: () => {
      set((s) => ({ workLight: !s.workLight }));
      persistBuild();
    },
    toggleSound: () => {
      const next = !get().sound;
      sfx.enabled = next && get().playMode === 'game';
      if (sfx.enabled) sfx.resume();
      set({ sound: next });
      persistBuild();
    },

    setPlayMode: (mode) => {
      if (get().playMode === mode) return;
      // Pro strips the simulation layer: no FX sounds, no hype score pending.
      sfx.enabled = get().sound && mode === 'game';
      if (sfx.enabled) sfx.resume();
      set({ playMode: mode, showResult: null });
      persistBuild();
    },

    // ------------------------------------------------------------ Placement
    setPlacementType: (type) =>
      set((s) => ({ placementType: s.placementType === type ? null : type })),
    cancelPlacement: () => set({ placementType: null }),
    toggleCollisions: () => {
      const next = !get().collisions;
      set({ collisions: next });
      persistBuild();
      get().pushToast('info', tr('toast.collisions', { state: tr(next ? 'toast.on' : 'toast.off') }));
    },

    // ------------------------------------------------------------------ Lanes
    addLane: () => {
      record('add-lane');
      set((s) => {
        const n = s.project.lanes.length + 1;
        const lane = { id: createId('lane'), name: `${tr('timeline.lane')} ${n}` };
        return { project: { ...s.project, lanes: [...s.project.lanes, lane], updatedAt: Date.now() } };
      });
    },

    removeLane: (id) => {
      record('remove-lane');
      set((s) => {
        const removed = new Set(s.project.events.filter((e) => e.lane === id).map((e) => e.id));
        return {
          project: {
            ...s.project,
            lanes: s.project.lanes.filter((l) => l.id !== id),
            events: s.project.events.filter((e) => e.lane !== id),
            updatedAt: Date.now(),
          },
          selectedEventId: removed.has(s.selectedEventId ?? '') ? null : s.selectedEventId,
          selectedEventIds: s.selectedEventIds.filter((x) => !removed.has(x)),
        };
      });
    },

    renameLane: (id, name) => {
      record('rename-lane');
      set((s) => ({
        project: {
          ...s.project,
          lanes: s.project.lanes.map((l) => (l.id === id ? { ...l, name } : l)),
          updatedAt: Date.now(),
        },
      }));
    },

    // ----------------------------------------------------------------- Events
    addBlock: (laneId) => {
      const s = get();
      const bpm = s.project.settings.bpm ?? 120;
      const dur = 4;
      const raw = Math.min(s.currentTime, s.duration);
      const preferred = s.snapEnabled ? snapToGrid(raw, bpm, s.snapDivision) : Math.round(raw * 10) / 10;
      const others = s.project.events.filter((e) => e.lane === laneId).map((e) => ({ time: e.time, duration: e.duration }));
      const start = firstFreeStart(others, dur, s.duration, preferred);
      if (start == null) {
        get().pushToast('error', tr('toast.noRoom'));
        return;
      }
      record('add-event');
      // Seed the new action from the current scene selection so it only drives
      // the gear you picked — a light lights up only during an action that
      // targets it, not every fixture. With nothing selected we fall back to a
      // light action targeting "all" (empty targets), as before.
      const selIds = s.selectedObjectIds.length
        ? s.selectedObjectIds
        : s.selectedObjectId
          ? [s.selectedObjectId]
          : [];
      const selObjs = s.project.objects.filter((o) => selIds.includes(o.id));
      const first = selObjs[0];
      let type: ShowEvent['type'] = 'light_color';
      let targets: string[] = [];
      if (first) {
        if (first.type === 'laser') {
          type = 'laser_on';
          targets = selObjs.filter((o) => o.type === 'laser').map((o) => o.id);
        } else if (first.type === 'led_screen') {
          type = 'led_color'; // LED events are global in the engine (no per-screen targeting)
        } else if (isFxEmitter(first.type)) {
          type = 'smoke_burst';
          targets = selObjs.filter((o) => isFxEmitter(o.type)).map((o) => o.id);
        } else if (isLightFixture(first.type)) {
          type = 'light_color';
          targets = selObjs.filter((o) => isLightFixture(o.type)).map((o) => o.id);
        }
      }
      const event: ShowEvent = {
        id: createId('evt'),
        lane: laneId,
        time: start,
        duration: Math.min(dur, Math.max(0.2, s.duration - start)),
        type,
        targets,
        params: defaultEventParams(type),
      };
      set((st) => ({
        project: { ...st.project, events: [...st.project.events, event], updatedAt: Date.now() },
        selectedEventId: event.id,
        selectedEventIds: [event.id],
        selectedObjectId: null,
        selectedObjectIds: [],
      }));
    },

    moveEvent: (id, time, laneId) => {
      set((s) => {
        const ev = s.project.events.find((e) => e.id === id);
        if (!ev) return {};
        const bpm = s.project.settings.bpm ?? 120;
        const desired = s.snapEnabled ? snapToGrid(time, bpm, s.snapDivision) : Math.round(time * 10) / 10;
        let lane = laneId;
        let start = placeOnLane(s.project.events, id, lane, ev.duration, desired, s.duration);
        if (start == null && lane !== ev.lane) {
          lane = ev.lane;
          start = placeOnLane(s.project.events, id, lane, ev.duration, desired, s.duration);
        }
        if (start == null || (start === ev.time && lane === ev.lane)) return {};
        record('move-event');
        return {
          project: {
            ...s.project,
            events: s.project.events.map((e) => (e.id === id ? { ...e, time: start as number, lane } : e)),
            updatedAt: Date.now(),
          },
        };
      });
    },

    resizeEventBlock: (id, edge, timeAtPointer) => {
      set((s) => {
        const ev = s.project.events.find((e) => e.id === id);
        if (!ev) return {};
        const bpm = s.project.settings.bpm ?? 120;
        const desired = s.snapEnabled ? snapToGrid(timeAtPointer, bpm, s.snapDivision) : Math.round(timeAtPointer * 10) / 10;
        const next = resizeEventTimes(s.project.events, ev, edge, desired, s.duration);
        if (next.time === ev.time && next.duration === ev.duration) return {};
        record('resize-event');
        return {
          project: {
            ...s.project,
            events: s.project.events.map((e) => (e.id === id ? { ...e, ...next } : e)),
            updatedAt: Date.now(),
          },
        };
      });
    },

    duplicateEvent: (id) => {
      const s = get();
      const ev = s.project.events.find((e) => e.id === id);
      if (!ev) return;
      const others = s.project.events.filter((e) => e.lane === ev.lane).map((e) => ({ time: e.time, duration: e.duration }));
      const start = firstFreeStart(others, ev.duration, s.duration, ev.time + ev.duration);
      if (start == null) {
        get().pushToast('error', tr('toast.noRoom'));
        return;
      }
      record('duplicate-event');
      const copy: ShowEvent = { ...ev, id: createId('evt'), time: start, params: { ...ev.params }, targets: [...ev.targets] };
      set((st) => ({
        project: { ...st.project, events: [...st.project.events, copy], updatedAt: Date.now() },
        selectedEventId: copy.id,
        selectedEventIds: [copy.id],
      }));
    },

    updateEvent: (id, patch) => {
      record('update-event');
      set((s) => ({
        project: {
          ...s.project,
          events: s.project.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          updatedAt: Date.now(),
        },
      }));
    },

    deleteEvent: (id) => {
      record('delete-event');
      set((s) => ({
        project: {
          ...s.project,
          events: s.project.events.filter((e) => e.id !== id),
          updatedAt: Date.now(),
        },
        selectedEventId: s.selectedEventId === id ? null : s.selectedEventId,
        selectedEventIds: s.selectedEventIds.filter((x) => x !== id),
      }));
    },

    selectEvent: (id) =>
      set({ selectedEventId: id, selectedEventIds: id ? [id] : [], selectedObjectId: null, selectedObjectIds: [] }),

    toggleSelectEvent: (id) =>
      set((s) => {
        const has = s.selectedEventIds.includes(id);
        const ids = has ? s.selectedEventIds.filter((x) => x !== id) : [...s.selectedEventIds, id];
        return {
          selectedEventIds: ids,
          selectedEventId: has ? (ids[ids.length - 1] ?? null) : id,
          selectedObjectId: null,
          selectedObjectIds: [],
        };
      }),

    applyEventTimes: (times) => {
      record('move-evt-group');
      set((s) => ({
        project: {
          ...s.project,
          events: s.project.events.map((e) => (times[e.id] !== undefined ? { ...e, time: times[e.id] } : e)),
          updatedAt: Date.now(),
        },
      }));
    },

    deleteEventSelection: () => {
      const s = get();
      const ids = s.selectedEventIds.length ? s.selectedEventIds : s.selectedEventId ? [s.selectedEventId] : [];
      if (!ids.length) return;
      record('delete-events');
      const idset = new Set(ids);
      set((st) => ({
        project: { ...st.project, events: st.project.events.filter((e) => !idset.has(e.id)), updatedAt: Date.now() },
        selectedEventId: null,
        selectedEventIds: [],
      }));
    },

    copyEventSelection: () => {
      const s = get();
      const sel = s.project.events.filter((e) => s.selectedEventIds.includes(e.id));
      if (!sel.length) return;
      set({ clipboard: sel.map((e) => ({ ...e, params: { ...e.params }, targets: [...e.targets] })) });
      get().pushToast('info', tr('toast.copied', { n: sel.length }));
    },

    pasteClipboard: () => {
      const s = get();
      const clip = s.clipboard;
      if (!clip.length) return;
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const minTime = Math.min(...clip.map((e) => e.time));
      const offset = Math.min(s.currentTime, s.duration) - minTime;
      const working = [...s.project.events];
      const laneIds = s.project.lanes.map((l) => l.id);
      const newLanes: Lane[] = [];
      const added: ShowEvent[] = [];
      const tryPlace = (laneId: string, dur: number, desired: number) =>
        firstFreeStart(
          working.filter((w) => w.lane === laneId).map((w) => ({ time: w.time, duration: w.duration })),
          dur,
          s.duration,
          desired,
        );

      for (const e of clip) {
        const dur = Math.min(e.duration, s.duration);
        const desired = Math.max(0, e.time + offset);
        let lane = laneIds.includes(e.lane) ? e.lane : laneIds[0] ?? null;
        let start = lane ? tryPlace(lane, dur, desired) : null;
        // Full? scan the other lanes for room…
        if (start == null) {
          for (const lid of laneIds) {
            const st = tryPlace(lid, dur, desired);
            if (st != null) {
              lane = lid;
              start = st;
              break;
            }
          }
        }
        // …still no room? drop it on a fresh lane so paste always lands.
        if (start == null || lane == null) {
          const id = createId('lane');
          newLanes.push({ id, name: `${tr('timeline.lane')} ${s.project.lanes.length + newLanes.length + 1}` });
          laneIds.push(id);
          lane = id;
          start = Math.max(0, Math.min(desired, s.duration - dur));
        }
        const copy: ShowEvent = {
          ...e,
          id: createId('evt'),
          lane,
          time: r2(start),
          duration: r2(Math.max(0.2, Math.min(dur, s.duration - start))),
          params: { ...e.params },
          targets: [...e.targets],
        };
        added.push(copy);
        working.push(copy);
      }
      if (!added.length) {
        get().pushToast('error', tr('toast.noRoom'));
        return;
      }
      record('paste');
      set((st) => ({
        project: {
          ...st.project,
          lanes: [...st.project.lanes, ...newLanes],
          events: [...st.project.events, ...added],
          updatedAt: Date.now(),
        },
        selectedEventId: added[added.length - 1].id,
        selectedEventIds: added.map((a) => a.id),
        selectedObjectId: null,
        selectedObjectIds: [],
      }));
      get().pushToast('success', tr('toast.pasted', { n: added.length }));
    },

    addTemplate: (key) => {
      const tpl = TEMPLATES[key];
      const s = get();
      record('template');
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const t0 = Math.min(s.currentTime, s.duration);
      const baseName = tr(`template.${key}`);
      const laneIds: string[] = [];
      const newLanes: Lane[] = [];
      for (let r = 0; r < tpl.rows; r++) {
        const id = createId('lane');
        laneIds.push(id);
        newLanes.push({ id, name: tpl.rows > 1 ? `${baseName} ${r + 1}` : baseName });
      }
      const newEvents: ShowEvent[] = tpl.events.map((te) => {
        const dur = Math.min(te.duration, s.duration);
        const start = Math.max(0, Math.min(t0 + te.at, s.duration - dur));
        return {
          id: createId('evt'),
          lane: laneIds[te.row],
          time: r2(start),
          duration: r2(Math.max(0.2, dur)),
          type: te.type,
          targets: [],
          params: { ...te.params },
        };
      });
      set((st) => ({
        project: {
          ...st.project,
          lanes: [...st.project.lanes, ...newLanes],
          events: [...st.project.events, ...newEvents],
          updatedAt: Date.now(),
        },
        selectedEventId: newEvents[0]?.id ?? null,
        selectedEventIds: newEvents.map((e) => e.id),
        selectedObjectId: null,
        selectedObjectIds: [],
      }));
      get().pushToast('success', tr('toast.template', { name: baseName }));
    },

    // ------------------------------------------------------------------ Live
    triggerLive: (type) => {
      const def = LIVE_DEFS[type];
      if (!def) return;
      const s = get();
      const t = Math.max(0, Math.min(s.currentTime, s.duration));
      const ev: ShowEvent = {
        id: createId('live'),
        lane: '__live',
        time: Math.max(0, t - 0.02),
        duration: def.duration,
        type,
        targets: [],
        params: { ...def.params },
      };
      // Prune triggers that are long finished (or stranded ahead after a seek).
      const keep = s.liveEvents.filter((e) => e.time + e.duration > t - 4 && e.time < t + 1);
      set({ liveEvents: [...keep, ev] });

      // REC: also stamp the trigger into the timeline on a "Live" lane, keeping
      // its exact timing (spill onto Live 2 / Live 3… when the lane is busy).
      if (s.liveRecord) {
        record('live-rec');
        set((st) => {
          let lanes = st.project.lanes;
          const liveLanes = lanes.filter((l) => l.name === 'Live' || l.name.startsWith('Live '));
          let laneId: string | null = null;
          let start: number | null = null;
          for (const l of liveLanes) {
            const others = st.project.events.filter((e) => e.lane === l.id).map((e) => ({ time: e.time, duration: e.duration }));
            const at = firstFreeStart(others, def.duration, st.duration, ev.time);
            if (at != null && Math.abs(at - ev.time) < 0.3) {
              laneId = l.id;
              start = at;
              break;
            }
          }
          if (laneId == null) {
            const nl: Lane = { id: createId('lane'), name: liveLanes.length ? `Live ${liveLanes.length + 1}` : 'Live' };
            lanes = [...lanes, nl];
            laneId = nl.id;
            start = Math.min(ev.time, Math.max(0, st.duration - def.duration));
          }
          const recEv: ShowEvent = { ...ev, id: createId('evt'), lane: laneId, time: start as number };
          return { project: { ...st.project, lanes, events: [...st.project.events, recEv], updatedAt: Date.now() } };
        });
      }
    },

    toggleLiveRecord: () => set((s) => ({ liveRecord: !s.liveRecord })),

    // -------------------------------------------------------------- Playback
    play: () => {
      const s = get();
      if (s.currentTime >= s.duration) s.seek(0);
      // Starting from the top begins a fresh scored run.
      if (get().currentTime <= 0.05) {
        hypeMeter.reset();
        set({ showResult: null });
      }
      if (get().sound) sfx.resume(); // unlock FX audio on this play gesture
      if (s.hasAudio) void audioEngine.play();
      set({ isPlaying: true });
    },
    pause: () => {
      if (get().hasAudio) audioEngine.pause();
      set({ isPlaying: false });
    },
    togglePlay: () => (get().isPlaying ? get().pause() : get().play()),
    stop: () => {
      if (get().hasAudio) audioEngine.pause();
      audioEngine.seek(0);
      set({ isPlaying: false, currentTime: 0, liveEvents: [] });
    },
    seek: (time) => {
      const d = get().duration;
      const t = Math.max(0, Math.min(time, d));
      if (get().hasAudio) audioEngine.seek(t);
      set({ currentTime: t });
    },
    setCurrentTime: (time) => {
      if (get().currentTime !== time) set({ currentTime: time });
    },
    setDuration: (duration) => set({ duration: Math.max(1, duration) }),

    finishShow: () => {
      if (get().hasAudio) audioEngine.pause();
      const result = get().playMode === 'game' && hypeMeter.scored ? { score: hypeMeter.average, peak: hypeMeter.peak } : null;
      set(result ? { isPlaying: false, showResult: result } : { isPlaying: false });
    },
    clearShowResult: () => set({ showResult: null }),

    // ----------------------------------------------------------------- Audio
    loadAudioFile: async (file) => {
      try {
        const dur = await audioEngine.load(file);
        const pid = get().project.id;
        set((s) => ({
          hasAudio: true,
          duration: dur > 0 ? dur : s.duration,
          currentTime: 0,
          isPlaying: false,
          project: {
            ...s.project,
            settings: { ...s.project.settings, audioName: file.name, duration: dur > 0 ? dur : s.project.settings.duration },
            updatedAt: Date.now(),
          },
        }));
        // Persist the track so it comes back when the project is reloaded.
        void putAudio(pid, file);
        get().pushToast('success', tr('toast.audioLoaded', { name: file.name }));
      } catch (err) {
        get().pushToast('error', tr('toast.audioError', { msg: (err as Error).message }));
      }
    },

    clearAudio: () => {
      audioEngine.dispose();
      void deleteAudio(get().project.id);
      set((s) => ({
        hasAudio: false,
        isPlaying: false,
        currentTime: 0,
        duration: s.project.settings.duration,
        project: { ...s.project, settings: { ...s.project.settings, audioName: undefined } },
      }));
    },

    restoreAudio: async () => {
      if (get().hasAudio) return;
      const pid = get().project.id;
      const stored = await getAudio(pid);
      // Bail if nothing stored, or the project changed while we were reading.
      if (!stored || get().project.id !== pid) return;
      try {
        const file = new File([stored.blob], stored.name, { type: stored.blob.type || 'audio/mpeg' });
        const dur = await audioEngine.load(file);
        if (get().project.id !== pid) {
          audioEngine.dispose();
          return;
        }
        set((s) => ({
          hasAudio: true,
          duration: dur > 0 ? dur : s.duration,
          currentTime: 0,
          project: { ...s.project, settings: { ...s.project.settings, audioName: stored.name } },
        }));
      } catch {
        /* ignore — the stored blob failed to decode */
      }
    },

    // --------------------------------------------------------------- Project
    setProjectName: (name) => {
      record('rename');
      set((s) => ({ project: { ...s.project, name, updatedAt: Date.now() } }));
    },

    setSettings: (patch) => {
      record('settings');
      set((s) => {
        const settings = { ...s.project.settings, ...patch };
        return {
          project: { ...s.project, settings, updatedAt: Date.now() },
          duration: s.hasAudio ? s.duration : settings.duration,
        };
      });
    },

    newProject: () => {
      audioEngine.dispose();
      resetHistory();
      const project: Project = {
        id: createId('proj'),
        name: 'Untitled Show',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        objects: [],
        lanes: [{ id: createId('lane'), name: `${tr('timeline.lane')} 1` }],
        events: [],
        settings: { duration: 90, bpm: 128, fog: true, timeOfDay: 13, dayBrightness: 1, nightBrightness: 0.12 },
      };
      set({
        project,
        selectedObjectId: null,
        selectedObjectIds: [],
        selectedEventId: null,
        selectedEventIds: [],
        isPlaying: false,
        currentTime: 0,
        duration: 90,
        hasAudio: false,
        liveEvents: [],
        past: [],
        future: [],
      });
      get().pushToast('info', tr('toast.newProject'));
    },

    saveCurrentProject: () => {
      const { project } = get();
      persistProject(project);
      get().pushToast('success', tr('toast.saved', { name: project.name }));
    },

    loadProjectById: (id) => {
      const project = loadProjectFromStorage(id);
      if (!project) {
        get().pushToast('error', tr('toast.loadError'));
        return;
      }
      get().replaceProject(project);
      void get().restoreAudio();
      get().pushToast('success', tr('toast.loaded', { name: project.name }));
    },

    importProjectJSON: (text) => {
      try {
        const project = parseProjectJSON(text);
        get().replaceProject(project);
        get().pushToast('success', tr('toast.imported', { name: project.name }));
      } catch (err) {
        get().pushToast('error', tr('toast.importFailed', { msg: (err as Error).message }));
      }
    },

    replaceProject: (project) => {
      audioEngine.dispose();
      resetHistory();
      set({
        project,
        selectedObjectId: null,
        selectedObjectIds: [],
        selectedEventId: null,
        selectedEventIds: [],
        isPlaying: false,
        currentTime: 0,
        duration: project.settings.duration,
        hasAudio: false,
        liveEvents: [],
        past: [],
        future: [],
      });
    },

    // ------------------------------------------------------------------ Toasts
    pushToast: (kind, message) => {
      const toast: Toast = { id: createId('toast'), kind, message };
      set((s) => ({ toasts: [...s.toasts, toast] }));
      window.setTimeout(() => get().dismissToast(toast.id), 3200);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  };
});

// Convenience selectors -------------------------------------------------------
export const selectSelectedObject = (s: ShowState): SceneObject | null =>
  s.project.objects.find((o) => o.id === s.selectedObjectId) ?? null;

export const selectSelectedEvent = (s: ShowState): ShowEvent | null =>
  s.project.events.find((e) => e.id === s.selectedEventId) ?? null;

/**
 * Whether a given scene object should be highlighted (white outline): it is the
 * selected object, or it is targeted by the selected event (an event with no
 * explicit targets highlights every object its type can apply to).
 */
export function isHighlighted(s: ShowState, id: string): boolean {
  if (s.selectedObjectIds.length) return s.selectedObjectIds.includes(id);
  if (s.selectedEventId) {
    const ev = s.project.events.find((e) => e.id === s.selectedEventId);
    if (!ev) return false;
    if (ev.targets.length) return ev.targets.includes(id);
    const obj = s.project.objects.find((o) => o.id === id);
    if (!obj) return false;
    const cat = eventCategory(ev.type);
    if (cat === 'lights') return isLightFixture(obj.type);
    if (cat === 'lasers') return obj.type === 'laser';
    if (cat === 'fx') return isFxEmitter(obj.type);
    if (cat === 'led') return obj.type === 'led_screen';
    return false;
  }
  return false;
}
