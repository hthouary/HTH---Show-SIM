import { create } from 'zustand';
import type { AppMode, Project, SceneObject, SceneObjectType, ShowEvent, Vec3 } from '../types/show';
import { createId, createSceneObject, defaultEventParams, eventCategory, isFxEmitter, isLightFixture } from '../data/catalog';
import { createDemoProject } from '../data/demoProject';
import { audioEngine } from '../utils/audio';
import { resolvePlacement, type PlacementSettings } from '../utils/collision';
import { snapToGrid } from '../utils/beat';
import { firstFreeStart, placeOnLane, resizeEvent as resizeEventTimes } from '../utils/timeline';
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
  selectedObjectId: string | null;
  selectedEventId: string | null;

  // ---- Playback -------------------------------------------------------
  isPlaying: boolean;
  currentTime: number;
  /** Effective show length (audio duration if loaded, else settings.duration). */
  duration: number;
  hasAudio: boolean;

  // ---- Transient UI ---------------------------------------------------
  toasts: Toast[];
  /** Current working mode: build (construction sandbox) or show (timeline). */
  appMode: AppMode;
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
  addObjectAt: (type: SceneObjectType, position: Vec3) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  moveObject: (id: string, position: Vec3) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  selectObject: (id: string | null) => void;

  // ---- Mode / build tools ---------------------------------------------
  setAppMode: (mode: AppMode) => void;
  toggleGrid: () => void;
  toggleGridSnap: () => void;
  setGridSize: (size: number) => void;
  toggleMagnet: () => void;
  toggleWorkLight: () => void;

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

  // ---- Playback actions ----------------------------------------------
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;

  // ---- Audio actions --------------------------------------------------
  loadAudioFile: (file: File) => Promise<void>;
  clearAudio: () => void;

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

function initialProject(): Project {
  const lastId = getLastProjectId();
  if (lastId) {
    const existing = loadProjectFromStorage(lastId);
    if (existing) return existing;
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
}

const BUILD_DEFAULTS: BuildPrefs = {
  appMode: 'show',
  collisions: false,
  showGrid: true,
  gridSnap: false,
  gridSize: 1,
  magnet: true,
  workLight: false,
};

const BUILD_KEY = 'showforge.build';

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
    selectedEventId: null,
    isPlaying: false,
    currentTime: 0,
    duration: startProject.settings.duration,
    hasAudio: false,
    toasts: [],
    appMode: buildPrefs.appMode,
    placementType: null,
    collisions: buildPrefs.collisions,
    showGrid: buildPrefs.showGrid,
    gridSnap: buildPrefs.gridSnap,
    gridSize: buildPrefs.gridSize,
    magnet: buildPrefs.magnet,
    workLight: buildPrefs.workLight,
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
      }));
      get().pushToast('success', tr('toast.added', { name: label }));
    },

    addObjectAt: (type, position) => {
      record('add');
      const s = get();
      const label = tr(`obj.${type}.label`);
      const pos = resolvePlacement(s.project.objects, null, type, 1, position, placement(s));
      const obj = createSceneObject(type, { position: pos, name: label });
      set((st) => ({
        project: { ...st.project, objects: [...st.project.objects, obj], updatedAt: Date.now() },
        selectedObjectId: obj.id,
        selectedEventId: null,
        placementType: null,
      }));
      get().pushToast('success', tr('toast.placed', { name: label }));
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
        const target: Vec3 = [obj.target[0] + delta[0], obj.target[1] + delta[1], obj.target[2] + delta[2]];
        return {
          project: {
            ...s.project,
            objects: s.project.objects.map((o) => (o.id === id ? { ...o, position: pos, target } : o)),
            updatedAt: Date.now(),
          },
        };
      });
    },

    deleteObject: (id) => {
      record('delete');
      set((s) => ({
        project: {
          ...s.project,
          objects: s.project.objects.filter((o) => o.id !== id),
          // Drop the deleted object from any event that targeted it.
          events: s.project.events.map((e) =>
            e.targets.includes(id) ? { ...e, targets: e.targets.filter((t) => t !== id) } : e,
          ),
          updatedAt: Date.now(),
        },
        selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
      }));
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
      };
      set((s) => ({
        project: { ...s.project, objects: [...s.project.objects, copy], updatedAt: Date.now() },
        selectedObjectId: copy.id,
      }));
    },

    selectObject: (id) => set({ selectedObjectId: id, selectedEventId: null }),

    // -------------------------------------------------------- Mode / build
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
      set((s) => ({
        project: {
          ...s.project,
          lanes: s.project.lanes.filter((l) => l.id !== id),
          events: s.project.events.filter((e) => e.lane !== id),
          updatedAt: Date.now(),
        },
        selectedEventId: s.project.events.some((e) => e.lane === id && e.id === s.selectedEventId)
          ? null
          : s.selectedEventId,
      }));
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
      const type = 'light_color' as ShowEvent['type'];
      const event: ShowEvent = {
        id: createId('evt'),
        lane: laneId,
        time: start,
        duration: Math.min(dur, Math.max(0.2, s.duration - start)),
        type,
        targets: [],
        params: defaultEventParams(type),
      };
      set((st) => ({
        project: { ...st.project, events: [...st.project.events, event], updatedAt: Date.now() },
        selectedEventId: event.id,
        selectedObjectId: null,
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
      }));
    },

    selectEvent: (id) => set({ selectedEventId: id, selectedObjectId: null }),

    // -------------------------------------------------------------- Playback
    play: () => {
      const s = get();
      if (s.currentTime >= s.duration) s.seek(0);
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
      set({ isPlaying: false, currentTime: 0 });
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

    // ----------------------------------------------------------------- Audio
    loadAudioFile: async (file) => {
      try {
        const dur = await audioEngine.load(file);
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
        get().pushToast('success', tr('toast.audioLoaded', { name: file.name }));
      } catch (err) {
        get().pushToast('error', tr('toast.audioError', { msg: (err as Error).message }));
      }
    },

    clearAudio: () => {
      audioEngine.dispose();
      set((s) => ({
        hasAudio: false,
        isPlaying: false,
        currentTime: 0,
        duration: s.project.settings.duration,
        project: { ...s.project, settings: { ...s.project.settings, audioName: undefined } },
      }));
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
        settings: { duration: 90, bpm: 128, fog: true },
      };
      set({
        project,
        selectedObjectId: null,
        selectedEventId: null,
        isPlaying: false,
        currentTime: 0,
        duration: 90,
        hasAudio: false,
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
        selectedEventId: null,
        isPlaying: false,
        currentTime: 0,
        duration: project.settings.duration,
        hasAudio: false,
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
  if (s.selectedObjectId) return s.selectedObjectId === id;
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
