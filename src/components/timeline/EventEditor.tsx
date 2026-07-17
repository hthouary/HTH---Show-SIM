import { useState } from 'react';
import { useShowStore } from '../../store/useShowStore';
import {
  EVENT_TYPE_GROUPS,
  defaultEventParams,
  eventCategory,
  eventColor,
  isFxEmitter,
  isLightFixture,
} from '../../data/catalog';
import type { EventCategory, EventTransition, MovementPreset, SceneObject, ShowEvent } from '../../types/show';
import { MOVEMENT_PRESETS } from '../../utils/movement';
import { ColorField, NumberField, SelectField, SliderField } from '../ui/fields';
import { Icon } from '../ui/Icon';
import { OBJECT_ICONS } from '../library/ObjectLibrary';
import { CustomMovementModal } from './CustomMovementModal';
import { useT } from '../../i18n/useT';

/** Objects a given event type can meaningfully apply to. */
function eligibleObjects(category: EventCategory, objects: SceneObject[]): SceneObject[] {
  return objects.filter((o) => {
    if (category === 'lights') return isLightFixture(o.type);
    if (category === 'lasers') return o.type === 'laser';
    if (category === 'led') return o.type === 'led_screen';
    if (category === 'fx') return isFxEmitter(o.type);
    return false;
  });
}

function ParamFields({ event }: { event: ShowEvent }) {
  const update = useShowStore((s) => s.updateEvent);
  const tr = useT();
  const [brush, setBrush] = useState(false);
  const setParam = (key: string, value: unknown) => update(event.id, { params: { ...event.params, [key]: value } });
  const num = (k: string, d: number) => (typeof event.params[k] === 'number' ? (event.params[k] as number) : d);
  const col = (k: string, d: string) => (typeof event.params[k] === 'string' ? (event.params[k] as string) : d);

  const movementFields = (defaultPattern: string, allowCustom: boolean) => {
    const pattern = col('pattern', defaultPattern);
    const presets: MovementPreset[] = allowCustom ? [...MOVEMENT_PRESETS, 'custom'] : [...MOVEMENT_PRESETS];
    const path = Array.isArray(event.params.path) ? (event.params.path as number[][]) : [];
    const custom = allowCustom && pattern === 'custom';
    return (
      <>
        <SelectField
          label={tr('field.movement')}
          value={pattern}
          onChange={(v) => setParam('pattern', v)}
          options={presets.map((m) => ({ value: m, label: tr(`movement.${m}`) }))}
        />
        {custom ? (
          <button className="btn flex items-center justify-center gap-2" onClick={() => setBrush(true)}>
            <Icon name="brush" size={14} /> {tr('custom.draw')}
            {path.length > 1 && (
              <svg viewBox="0 0 100 44" className="ml-1 h-6 w-16 rounded bg-ink-950">
                <polyline
                  points={path.map((p) => `${p[0] * 100},${p[1] * 44}`).join(' ')}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={2}
                />
              </svg>
            )}
          </button>
        ) : (
          <SliderField label={tr('field.speed')} value={num('speed', 40)} min={0} max={100} step={1} onChange={(v) => setParam('speed', v)} />
        )}
        {custom && brush && <CustomMovementModal event={event} onClose={() => setBrush(false)} />}
      </>
    );
  };

  switch (event.type) {
    case 'light_color':
    case 'laser_color':
    case 'led_color':
      return <ColorField label={tr('param.color')} value={col('color', '#22d3ee')} onChange={(v) => setParam('color', v)} />;
    case 'laser_on':
      return (
        <div className="flex flex-col gap-3">
          <ColorField label={tr('param.color')} value={col('color', '#39ff14')} onChange={(v) => setParam('color', v)} />
          {movementFields('circular', true)}
        </div>
      );
    case 'light_intensity':
      return <SliderField label={tr('param.intensity')} value={num('intensity', 1)} min={0} max={2} onChange={(v) => setParam('intensity', v)} />;
    case 'light_strobe':
      return (
        <div className="flex flex-col gap-3">
          <SliderField label={tr('param.rate')} value={num('rate', 14)} min={2} max={30} step={1} onChange={(v) => setParam('rate', v)} />
          <ColorField label={tr('param.flashColor')} value={col('color', '#ffffff')} onChange={(v) => setParam('color', v)} />
        </div>
      );
    case 'light_sweep':
      return <div className="flex flex-col gap-3">{movementFields('wave', true)}</div>;
    case 'led_pulse':
      return (
        <div className="flex flex-col gap-3">
          <SliderField label={tr('param.pulseRate')} value={num('rate', 2)} min={0.5} max={6} onChange={(v) => setParam('rate', v)} />
          <ColorField label={tr('param.color')} value={col('color', '#22d3ee')} onChange={(v) => setParam('color', v)} />
        </div>
      );
    case 'smoke_burst':
    case 'flame_burst':
    case 'co2_burst':
    case 'confetti_burst':
      return <SliderField label={tr('param.intensity')} value={num('intensity', 1)} min={0.2} max={2} onChange={(v) => setParam('intensity', v)} />;
    case 'blackout':
      return <p className="text-xs text-slate-500">{tr('event.blackoutNote')}</p>;
    default:
      return null;
  }
}

/** Action types that can crossfade into the next block (or fade out alone). */
const TRANSITION_TYPES: ReadonlySet<string> = new Set(['light_color', 'light_intensity', 'light_sweep', 'laser_on']);

/** Transition toggle + speed: crossfade this block into the next one on its lane. */
function TransitionEditor({ event }: { event: ShowEvent }) {
  const update = useShowStore((s) => s.updateEvent);
  const tr = useT();
  if (!TRANSITION_TYPES.has(event.type)) return null;

  const on = event.transition?.enabled ?? false;
  const duration = event.transition?.duration ?? 1.2;
  const set = (patch: Partial<EventTransition>) => update(event.id, { transition: { enabled: on, duration, ...patch } });

  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-850 p-3">
      <button
        onClick={() => set({ enabled: !on })}
        className={`flex w-full items-center gap-2 text-left text-xs font-semibold ${on ? 'text-accent-cyan' : 'text-slate-300'}`}
      >
        <span className={`grid h-4 w-7 place-items-start rounded-full px-0.5 transition-colors ${on ? 'bg-accent-cyan/70' : 'bg-ink-600'}`}>
          <span className={`h-3 w-3 rounded-full bg-white transition-transform ${on ? 'translate-x-3' : ''}`} />
        </span>
        {tr('event.transition')}
      </button>
      {on && (
        <div className="mt-2">
          <SliderField label={tr('event.transition.speed')} value={duration} min={0.1} max={5} step={0.1} onChange={(v) => set({ duration: v })} />
          <p className="mt-1 text-[11px] leading-snug text-slate-500">{tr('event.transition.note')}</p>
        </div>
      )}
    </div>
  );
}

/** Multi-select of the objects an event applies to (empty = all). */
function TargetPicker({ event }: { event: ShowEvent }) {
  const update = useShowStore((s) => s.updateEvent);
  const objects = useShowStore((s) => s.project.objects);
  const groups = useShowStore((s) => s.project.groups ?? []);
  const tr = useT();
  const category = eventCategory(event.type);
  if (category === 'global') return null;

  const eligible = eligibleObjects(category, objects);
  const eligibleIds = new Set(eligible.map((o) => o.id));
  const isAll = event.targets.length === 0;
  const setTargets = (targets: string[]) => update(event.id, { targets });
  const toggle = (id: string) =>
    setTargets(event.targets.includes(id) ? event.targets.filter((t) => t !== id) : [...event.targets, id]);

  // Groups that hold at least one fixture this event can drive. Clicking one
  // adds all its eligible members (or removes them when they're already all in).
  const usableGroups = groups
    .map((g) => ({ ...g, ids: g.members.filter((m) => eligibleIds.has(m)) }))
    .filter((g) => g.ids.length > 0);
  const toggleGroup = (ids: string[]) => {
    const set = new Set(event.targets);
    const allIn = ids.every((id) => set.has(id));
    if (allIn) ids.forEach((id) => set.delete(id));
    else ids.forEach((id) => set.add(id));
    setTargets([...set]);
  };

  return (
    <div>
      <div className="field-label">{tr('event.appliesTo')}</div>
      {usableGroups.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {usableGroups.map((g) => {
            const allIn = !isAll && g.ids.every((id) => event.targets.includes(id));
            return (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.ids)}
                title={tr('event.group')}
                className={`chip flex items-center gap-1 ${allIn ? 'bg-amber-400/20 text-amber-200' : 'bg-ink-700 text-amber-200/70'}`}
              >
                <Icon name="box" size={11} />
                <span className="max-w-[8rem] truncate">{g.name}</span>
                <span className="opacity-60">{g.ids.length}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-ink-700/70 bg-ink-850 p-2">
        <button
          onClick={() => setTargets([])}
          className={`chip ${isAll ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-ink-700 text-slate-300'}`}
        >
          {tr('event.targetAll')}
        </button>
        {eligible.map((o) => {
          const on = event.targets.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              className={`chip flex items-center gap-1 ${on ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-ink-700 text-slate-300'}`}
            >
              <Icon name={OBJECT_ICONS[o.type]} size={11} />
              <span className="max-w-[8rem] truncate">{o.name}</span>
            </button>
          );
        })}
        {eligible.length === 0 && <span className="px-1 py-0.5 text-[11px] text-slate-600">—</span>}
      </div>
    </div>
  );
}

export function EventEditor({ event }: { event: ShowEvent }) {
  const update = useShowStore((s) => s.updateEvent);
  const remove = useShowStore((s) => s.deleteEvent);
  const duplicate = useShowStore((s) => s.duplicateEvent);
  const moveEvent = useShowStore((s) => s.moveEvent);
  const resizeBlock = useShowStore((s) => s.resizeEventBlock);
  const lanes = useShowStore((s) => s.project.lanes);
  const duration = useShowStore((s) => s.duration);
  const tr = useT();
  const color = eventColor(event.type);

  const groupLabel = (cat: EventCategory) => (cat === 'global' ? tr('evtgroup.global') : tr(`track.${cat}`));
  const setType = (type: string) => update(event.id, { type: type as ShowEvent['type'], params: defaultEventParams(type) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
        <span className="text-sm font-semibold text-slate-100">{tr('event.title')}</span>
        <span className="chip ml-auto bg-ink-700 text-slate-400">{tr(`evt.${event.type}`)}</span>
      </div>

      {/* Type (grouped) */}
      <label className="block">
        <div className="field-label">{tr('event.type')}</div>
        <select className="input cursor-pointer" value={event.type} onChange={(e) => setType(e.target.value)}>
          {EVENT_TYPE_GROUPS.map((g) => (
            <optgroup key={g.category} label={groupLabel(g.category)}>
              {g.types.map((ty) => (
                <option key={ty} value={ty}>
                  {tr(`evt.${ty}`)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {/* Lane */}
      {lanes.length > 0 && (
        <SelectField
          label={tr('event.lane')}
          value={event.lane}
          onChange={(v) => update(event.id, { lane: v })}
          options={lanes.map((l) => ({ value: l.id, label: l.name }))}
        />
      )}

      <TargetPicker event={event} />

      <div className="grid grid-cols-2 gap-2">
        <NumberField label={tr('event.start')} value={event.time} step={0.1} min={0} max={duration} onChange={(time) => moveEvent(event.id, time, event.lane)} />
        <NumberField label={tr('event.duration')} value={event.duration} step={0.1} min={0.1} onChange={(d) => resizeBlock(event.id, 'right', event.time + d)} />
      </div>

      <div className="rounded-lg border border-ink-700/70 bg-ink-850 p-3">
        <div className="field-label">{tr('event.parameters')}</div>
        <ParamFields event={event} />
      </div>

      <TransitionEditor event={event} />

      <div className="mt-1 flex gap-2 border-t border-ink-700/70 pt-3">
        <button className="btn flex-1" onClick={() => duplicate(event.id)}>
          <Icon name="copy" size={14} /> {tr('action.duplicate')}
        </button>
        <button className="btn btn-danger flex-1" onClick={() => remove(event.id)}>
          <Icon name="trash" size={14} /> {tr('action.delete')}
        </button>
      </div>
    </div>
  );
}
