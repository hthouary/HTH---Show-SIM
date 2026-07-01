import { useShowStore } from '../../store/useShowStore';
import { EVENT_TYPES_BY_TRACK, TRACKS, defaultEventParams, isFxEmitter, isLightFixture } from '../../data/catalog';
import type { MovementPreset, ShowEvent, TrackId } from '../../types/show';
import { MOVEMENT_PRESETS } from '../../utils/movement';
import { ColorField, NumberField, SelectField, SliderField } from '../ui/fields';
import { Icon } from '../ui/Icon';
import { useT } from '../../i18n/useT';

/** Build the list of valid targets for an event on a given track. */
function targetOptions(
  track: TrackId,
  objects: { id: string; name: string; type: string }[],
  allLabel: string,
) {
  const filtered = objects.filter((o) => {
    if (track === 'lights') return isLightFixture(o.type as never);
    if (track === 'lasers') return o.type === 'laser';
    if (track === 'led') return o.type === 'led_screen';
    if (track === 'fx') return isFxEmitter(o.type as never);
    return false;
  });
  return [{ value: 'all', label: allLabel }, ...filtered.map((o) => ({ value: o.id, label: o.name }))];
}

function ParamFields({ event }: { event: ShowEvent }) {
  const update = useShowStore((s) => s.updateEvent);
  const tr = useT();
  const setParam = (key: string, value: unknown) =>
    update(event.id, { params: { ...event.params, [key]: value } });

  const num = (k: string, d: number) => (typeof event.params[k] === 'number' ? (event.params[k] as number) : d);
  const col = (k: string, d: string) => (typeof event.params[k] === 'string' ? (event.params[k] as string) : d);

  // Movement pattern + 0..100 speed dial, shared by light "Movement" and laser events.
  const movementFields = (defaultPattern: MovementPreset) => (
    <>
      <SelectField
        label={tr('field.movement')}
        value={col('pattern', defaultPattern) as MovementPreset}
        onChange={(v) => setParam('pattern', v)}
        options={MOVEMENT_PRESETS.map((m) => ({ value: m, label: tr(`movement.${m}`) }))}
      />
      <SliderField label={tr('field.speed')} value={num('speed', 40)} min={0} max={100} step={1} onChange={(v) => setParam('speed', v)} />
    </>
  );

  switch (event.type) {
    case 'light_color':
    case 'laser_color':
    case 'led_color':
      return <ColorField label={tr('param.color')} value={col('color', '#22d3ee')} onChange={(v) => setParam('color', v)} />;
    case 'laser_on':
      return (
        <div className="flex flex-col gap-3">
          <ColorField label={tr('param.color')} value={col('color', '#39ff14')} onChange={(v) => setParam('color', v)} />
          {movementFields('circular')}
        </div>
      );
    case 'light_intensity':
      return (
        <SliderField label={tr('param.intensity')} value={num('intensity', 1)} min={0} max={2} onChange={(v) => setParam('intensity', v)} />
      );
    case 'light_strobe':
      return (
        <div className="flex flex-col gap-3">
          <SliderField label={tr('param.rate')} value={num('rate', 14)} min={2} max={30} step={1} onChange={(v) => setParam('rate', v)} />
          <ColorField label={tr('param.flashColor')} value={col('color', '#ffffff')} onChange={(v) => setParam('color', v)} />
        </div>
      );
    case 'light_sweep':
      return <div className="flex flex-col gap-3">{movementFields('wave')}</div>;
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
      return (
        <SliderField label={tr('param.intensity')} value={num('intensity', 1)} min={0.2} max={2} onChange={(v) => setParam('intensity', v)} />
      );
    case 'blackout':
      return <p className="text-xs text-slate-500">{tr('event.blackoutNote')}</p>;
    default:
      return null;
  }
}

export function EventEditor({ event }: { event: ShowEvent }) {
  const update = useShowStore((s) => s.updateEvent);
  const remove = useShowStore((s) => s.deleteEvent);
  const objects = useShowStore((s) => s.project.objects);
  const duration = useShowStore((s) => s.duration);
  const tr = useT();

  const typeOptions = EVENT_TYPES_BY_TRACK[event.track].map((x) => ({ value: x.type, label: tr(`evt.${x.type}`) }));
  const targets = targetOptions(event.track, objects, tr('event.targetAll'));
  const trackColor = TRACKS.find((x) => x.id === event.track)!.color;

  const setTrack = (track: TrackId) => {
    const firstType = EVENT_TYPES_BY_TRACK[track][0].type;
    update(event.id, { track, type: firstType as ShowEvent['type'], target: 'all', params: defaultEventParams(firstType) });
  };
  const setType = (type: string) =>
    update(event.id, { type: type as ShowEvent['type'], params: defaultEventParams(type) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm" style={{ background: trackColor }} />
        <span className="text-sm font-semibold text-slate-100">{tr('event.title')}</span>
        <span className="chip ml-auto bg-ink-700 text-slate-400">{tr(`track.${event.track}`)}</span>
      </div>

      <SelectField
        label={tr('event.track')}
        value={event.track}
        onChange={(v) => setTrack(v as TrackId)}
        options={TRACKS.map((x) => ({ value: x.id, label: tr(`track.${x.id}`) }))}
      />
      <SelectField label={tr('event.type')} value={event.type} onChange={setType} options={typeOptions} />
      <SelectField label={tr('event.target')} value={event.target} onChange={(v) => update(event.id, { target: v })} options={targets} />

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={tr('event.start')}
          value={event.time}
          step={0.1}
          min={0}
          max={duration}
          onChange={(time) => update(event.id, { time })}
        />
        <NumberField
          label={tr('event.duration')}
          value={event.duration}
          step={0.1}
          min={0.1}
          onChange={(d) => update(event.id, { duration: d })}
        />
      </div>

      <div className="rounded-lg border border-ink-700/70 bg-ink-850 p-3">
        <div className="field-label">{tr('event.parameters')}</div>
        <ParamFields event={event} />
      </div>

      <button className="btn btn-danger" onClick={() => remove(event.id)}>
        <Icon name="trash" size={14} /> {tr('event.delete')}
      </button>
    </div>
  );
}
