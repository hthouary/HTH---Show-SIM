import { useShowStore } from '../../store/useShowStore';
import {
  EVENT_TYPES_BY_TRACK,
  TRACKS,
  defaultEventParams,
  isFxEmitter,
  isLightFixture,
} from '../../data/catalog';
import type { ShowEvent, TrackId } from '../../types/show';
import { ColorField, NumberField, SelectField, SliderField } from '../ui/fields';
import { Icon } from '../ui/Icon';

/** Build the list of valid targets for an event on a given track. */
function targetOptions(track: TrackId, objects: { id: string; name: string; type: string }[]) {
  const filtered = objects.filter((o) => {
    if (track === 'lights') return isLightFixture(o.type as never);
    if (track === 'lasers') return o.type === 'laser';
    if (track === 'led') return o.type === 'led_screen';
    if (track === 'fx') return isFxEmitter(o.type as never);
    return false;
  });
  return [{ value: 'all', label: 'All on track' }, ...filtered.map((o) => ({ value: o.id, label: o.name }))];
}

function ParamFields({ event }: { event: ShowEvent }) {
  const update = useShowStore((s) => s.updateEvent);
  const setParam = (key: string, value: unknown) =>
    update(event.id, { params: { ...event.params, [key]: value } });

  const num = (k: string, d: number) => (typeof event.params[k] === 'number' ? (event.params[k] as number) : d);
  const col = (k: string, d: string) => (typeof event.params[k] === 'string' ? (event.params[k] as string) : d);

  switch (event.type) {
    case 'light_color':
    case 'laser_color':
    case 'led_color':
    case 'laser_on':
      return <ColorField label="Color" value={col('color', '#22d3ee')} onChange={(v) => setParam('color', v)} />;
    case 'light_intensity':
      return (
        <SliderField label="Intensity" value={num('intensity', 1)} min={0} max={2} onChange={(v) => setParam('intensity', v)} />
      );
    case 'light_strobe':
      return (
        <div className="flex flex-col gap-3">
          <SliderField label="Rate (Hz)" value={num('rate', 14)} min={2} max={30} step={1} onChange={(v) => setParam('rate', v)} />
          <ColorField label="Flash Color" value={col('color', '#ffffff')} onChange={(v) => setParam('color', v)} />
        </div>
      );
    case 'light_sweep':
      return (
        <div className="grid grid-cols-2 gap-2">
          <SliderField label="Amplitude" value={num('amplitude', 1)} min={0} max={3} onChange={(v) => setParam('amplitude', v)} />
          <SliderField label="Speed" value={num('speed', 0.6)} min={0.1} max={3} onChange={(v) => setParam('speed', v)} />
        </div>
      );
    case 'led_pulse':
      return (
        <div className="flex flex-col gap-3">
          <SliderField label="Pulse Rate" value={num('rate', 2)} min={0.5} max={6} onChange={(v) => setParam('rate', v)} />
          <ColorField label="Color" value={col('color', '#22d3ee')} onChange={(v) => setParam('color', v)} />
        </div>
      );
    case 'smoke_burst':
    case 'flame_burst':
    case 'co2_burst':
    case 'confetti_burst':
      return (
        <SliderField label="Intensity" value={num('intensity', 1)} min={0.2} max={2} onChange={(v) => setParam('intensity', v)} />
      );
    case 'blackout':
      return <p className="text-xs text-slate-500">Full blackout for the clip duration. No parameters.</p>;
    default:
      return null;
  }
}

export function EventEditor({ event }: { event: ShowEvent }) {
  const update = useShowStore((s) => s.updateEvent);
  const remove = useShowStore((s) => s.deleteEvent);
  const objects = useShowStore((s) => s.project.objects);
  const duration = useShowStore((s) => s.duration);

  const trackMeta = TRACKS.find((t) => t.id === event.track)!;
  const typeOptions = EVENT_TYPES_BY_TRACK[event.track].map((t) => ({ value: t.type, label: t.label }));
  const targets = targetOptions(event.track, objects);

  const setTrack = (track: TrackId) => {
    const firstType = EVENT_TYPES_BY_TRACK[track][0].type;
    update(event.id, { track, type: firstType as ShowEvent['type'], target: 'all', params: defaultEventParams(firstType) });
  };
  const setType = (type: string) =>
    update(event.id, { type: type as ShowEvent['type'], params: defaultEventParams(type) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm" style={{ background: trackMeta.color }} />
        <span className="text-sm font-semibold text-slate-100">Event</span>
        <span className="chip ml-auto bg-ink-700 text-slate-400">{trackMeta.label}</span>
      </div>

      <SelectField
        label="Track"
        value={event.track}
        onChange={(v) => setTrack(v as TrackId)}
        options={TRACKS.map((t) => ({ value: t.id, label: t.label }))}
      />
      <SelectField label="Type" value={event.type} onChange={setType} options={typeOptions} />
      <SelectField label="Target" value={event.target} onChange={(v) => update(event.id, { target: v })} options={targets} />

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Start (s)"
          value={event.time}
          step={0.1}
          min={0}
          max={duration}
          onChange={(time) => update(event.id, { time })}
        />
        <NumberField
          label="Duration (s)"
          value={event.duration}
          step={0.1}
          min={0.1}
          onChange={(d) => update(event.id, { duration: d })}
        />
      </div>

      <div className="rounded-lg border border-ink-700/70 bg-ink-850 p-3">
        <div className="field-label">Parameters</div>
        <ParamFields event={event} />
      </div>

      <button className="btn btn-danger" onClick={() => remove(event.id)}>
        <Icon name="trash" size={14} /> Delete Event
      </button>
    </div>
  );
}
