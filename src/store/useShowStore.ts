import { create } from 'zustand';
import type { Project, SceneObject, SceneObjectType, ShowEvent, TrackId } from '../types/show';
import { CATALOG_BY_TYPE, createId, createSceneObject, defaultEventParams } from '../data/catalog';
import { createDemoProject } from '../data/demoProject';
import { audioEngine } from '../utils/audio';
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

  // ---- Object actions -------------------------------------------------
  addObject: (type: SceneObjectType) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  selectObject: (id: string | null) => void;

  // ---- Event actions --------------------------------------------------
  addEvent: (track: TrackId, type: string, atTime?: number) => void;
  updateEvent: (id: string, patch: Partial<ShowEvent>) => void;
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

export const useShowStore = create<ShowState>((set, get) => {
  const startProject = initialProject();

  return {
    project: startProject,
    selectedObjectId: null,
    selectedEventId: null,
    isPlaying: false,
    currentTime: 0,
    duration: startProject.settings.duration,
    hasAudio: false,
    toasts: [],

    // ---------------------------------------------------------------- Objects
    addObject: (type) => {
      const obj = createSceneObject(type);
      set((s) => ({
        project: { ...s.project, objects: [...s.project.objects, obj], updatedAt: Date.now() },
        selectedObjectId: obj.id,
      }));
      get().pushToast('success', `Added ${CATALOG_BY_TYPE[type].label}`);
    },

    updateObject: (id, patch) =>
      set((s) => ({
        project: {
          ...s.project,
          objects: s.project.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
          updatedAt: Date.now(),
        },
      })),

    deleteObject: (id) =>
      set((s) => ({
        project: {
          ...s.project,
          objects: s.project.objects.filter((o) => o.id !== id),
          // Re-target events that pointed at the deleted object.
          events: s.project.events.map((e) => (e.target === id ? { ...e, target: 'all' } : e)),
          updatedAt: Date.now(),
        },
        selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
      })),

    duplicateObject: (id) => {
      const original = get().project.objects.find((o) => o.id === id);
      if (!original) return;
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

    // ----------------------------------------------------------------- Events
    addEvent: (track, type, atTime) => {
      const time = atTime ?? Math.min(get().currentTime, get().duration);
      const event: ShowEvent = {
        id: createId('evt'),
        time: Math.max(0, Math.round(time * 10) / 10),
        duration: type.endsWith('_burst') || type === 'blackout' ? 1.2 : 6,
        track,
        type: type as ShowEvent['type'],
        target: 'all',
        params: defaultEventParams(type),
      };
      set((s) => ({
        project: { ...s.project, events: [...s.project.events, event], updatedAt: Date.now() },
        selectedEventId: event.id,
      }));
    },

    updateEvent: (id, patch) =>
      set((s) => ({
        project: {
          ...s.project,
          events: s.project.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          updatedAt: Date.now(),
        },
      })),

    deleteEvent: (id) =>
      set((s) => ({
        project: {
          ...s.project,
          events: s.project.events.filter((e) => e.id !== id),
          updatedAt: Date.now(),
        },
        selectedEventId: s.selectedEventId === id ? null : s.selectedEventId,
      })),

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
        get().pushToast('success', `Loaded audio: ${file.name}`);
      } catch (err) {
        get().pushToast('error', `Could not load audio: ${(err as Error).message}`);
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
    setProjectName: (name) =>
      set((s) => ({ project: { ...s.project, name, updatedAt: Date.now() } })),

    setSettings: (patch) =>
      set((s) => {
        const settings = { ...s.project.settings, ...patch };
        return {
          project: { ...s.project, settings, updatedAt: Date.now() },
          duration: s.hasAudio ? s.duration : settings.duration,
        };
      }),

    newProject: () => {
      audioEngine.dispose();
      const project: Project = {
        id: createId('proj'),
        name: 'Untitled Show',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        objects: [],
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
      });
      get().pushToast('info', 'Created a new empty project');
    },

    saveCurrentProject: () => {
      const { project } = get();
      persistProject(project);
      get().pushToast('success', `Saved “${project.name}”`);
    },

    loadProjectById: (id) => {
      const project = loadProjectFromStorage(id);
      if (!project) {
        get().pushToast('error', 'Could not load that project');
        return;
      }
      get().replaceProject(project);
      get().pushToast('success', `Loaded “${project.name}”`);
    },

    importProjectJSON: (text) => {
      try {
        const project = parseProjectJSON(text);
        get().replaceProject(project);
        get().pushToast('success', `Imported “${project.name}”`);
      } catch (err) {
        get().pushToast('error', `Import failed: ${(err as Error).message}`);
      }
    },

    replaceProject: (project) => {
      audioEngine.dispose();
      set({
        project,
        selectedObjectId: null,
        selectedEventId: null,
        isPlaying: false,
        currentTime: 0,
        duration: project.settings.duration,
        hasAudio: false,
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
