import type { Project, ProjectSummary, SceneObject } from '../types/show';
import { createId } from '../data/catalog';
import { migrateTimeline } from './timeline';

const INDEX_KEY = 'showforge.projects.index';
const PROJECT_KEY = (id: string) => `showforge.project.${id}`;
const LAST_KEY = 'showforge.lastProjectId';

/** Read the saved-project index from localStorage. */
export function listProjects(): ProjectSummary[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectSummary[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

function writeIndex(index: ProjectSummary[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

/** Persist a project to localStorage and update the index. */
export function saveProject(project: Project): void {
  const updated: Project = { ...project, updatedAt: Date.now() };
  localStorage.setItem(PROJECT_KEY(updated.id), JSON.stringify(updated));
  const index = listProjects().filter((p) => p.id !== updated.id);
  index.push({ id: updated.id, name: updated.name, updatedAt: updated.updatedAt });
  writeIndex(index);
  localStorage.setItem(LAST_KEY, updated.id);
}

export function loadProject(id: string): Project | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY(id));
    if (!raw) return null;
    const project = JSON.parse(raw) as Project;
    localStorage.setItem(LAST_KEY, id);
    return sanitizeProject(project);
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  localStorage.removeItem(PROJECT_KEY(id));
  writeIndex(listProjects().filter((p) => p.id !== id));
}

export function getLastProjectId(): string | null {
  return localStorage.getItem(LAST_KEY);
}

/** Serialize a project to a downloadable JSON string. */
export function exportProjectJSON(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/** Trigger a browser download of the project JSON. */
export function downloadProject(project: Project): void {
  const blob = new Blob([exportProjectJSON(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = project.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'show';
  a.href = url;
  a.download = `${safeName}.showforge.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parse + validate an imported JSON string into a Project. */
export function parseProjectJSON(text: string): Project {
  const raw = JSON.parse(text) as Partial<Project>;
  if (!raw || typeof raw !== 'object') throw new Error('Invalid project file');
  if (!Array.isArray(raw.objects) || !Array.isArray(raw.events)) {
    throw new Error('Project file is missing objects or events');
  }
  // Give the imported project a fresh id so it does not clobber an existing one.
  return sanitizeProject({ ...(raw as Project), id: createId('proj') });
}

/** Defensive normalization so a malformed/older file still loads cleanly. */
export function sanitizeProject(p: Project): Project {
  const objects: SceneObject[] = (p.objects ?? []).map((o) => ({
    id: o.id ?? createId('obj'),
    type: o.type,
    name: o.name ?? o.type,
    position: vec3(o.position, [0, 1, 0]),
    rotation: vec3(o.rotation, [0, 0, 0]),
    scale: typeof o.scale === 'number' ? o.scale : 1,
    color: typeof o.color === 'string' ? o.color : '#22d3ee',
    intensity: typeof o.intensity === 'number' ? o.intensity : 1,
    beamAngle: typeof o.beamAngle === 'number' ? o.beamAngle : 12,
    target: vec3(o.target, [0, 0, 4]),
    hidden: o.hidden === true ? true : undefined,
    parent: typeof o.parent === 'string' ? o.parent : undefined,
  }));

  // Normalize each event's timing, then migrate the timeline into the lane model
  // (handles both new lane/targets files and older track/target ones).
  const rawEvents = ((p.events ?? []) as unknown as Record<string, unknown>[]).map((e) => ({
    ...e,
    id: (e.id as string) ?? createId('evt'),
    time: clampNum(e.time, 0),
    duration: clampNum(e.duration, 1),
    params: e.params && typeof e.params === 'object' ? e.params : {},
  }));
  const { lanes, events } = migrateTimeline({ lanes: (p as Project).lanes, events: rawEvents });

  // Keep only well-formed groups whose members still point at real objects.
  const objIds = new Set(objects.map((o) => o.id));
  const groups = Array.isArray(p.groups)
    ? p.groups
        .filter((g): g is NonNullable<typeof g> => !!g && typeof g.name === 'string' && Array.isArray(g.members))
        .map((g) => ({
          id: typeof g.id === 'string' ? g.id : createId('grp'),
          name: g.name,
          members: g.members.filter((m): m is string => typeof m === 'string' && objIds.has(m)),
        }))
    : undefined;

  return {
    id: p.id ?? createId('proj'),
    name: p.name ?? 'Untitled Show',
    createdAt: p.createdAt ?? Date.now(),
    updatedAt: p.updatedAt ?? Date.now(),
    objects,
    lanes,
    events,
    groups,
    settings: {
      duration: clampNum(p.settings?.duration, 90),
      bpm: p.settings?.bpm,
      audioName: p.settings?.audioName,
      fog: p.settings?.fog ?? true,
      timeOfDay: clampNum(p.settings?.timeOfDay, 13),
      dayBrightness: clampNum(p.settings?.dayBrightness, 1),
      nightBrightness: clampNum(p.settings?.nightBrightness, 0.12),
    },
  };
}

function vec3(v: unknown, fallback: [number, number, number]): [number, number, number] {
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number')) {
    return [v[0], v[1], v[2]];
  }
  return [...fallback];
}

function clampNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
