import { CATALOG, CATEGORY_LABELS } from '../../data/catalog';
import type { LibraryCategory, SceneObjectType } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
import { Icon, type IconName } from '../ui/Icon';

export const OBJECT_ICONS: Record<SceneObjectType, IconName> = {
  stage_platform: 'box',
  truss: 'truss',
  speaker: 'speaker',
  led_screen: 'monitor',
  dj_booth: 'box',
  crowd_block: 'crowd',
  moving_head_spot: 'lightbulb',
  moving_head_wash: 'lightbulb',
  beam_light: 'bolt',
  strobe: 'sparkles',
  blinder: 'lightbulb',
  laser: 'laser',
  smoke_machine: 'cloud',
  flame_jet: 'flame',
  co2_jet: 'snow',
  confetti_cannon: 'party',
};

const CATEGORY_ORDER: LibraryCategory[] = ['stage', 'lights', 'fx'];

const CATEGORY_ACCENT: Record<LibraryCategory, string> = {
  stage: 'text-slate-400',
  lights: 'text-accent-cyan',
  fx: 'text-accent-magenta',
};

export function ObjectLibrary() {
  const setPlacementType = useShowStore((s) => s.setPlacementType);
  const placementType = useShowStore((s) => s.placementType);
  const objectCount = useShowStore((s) => s.project.objects.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ink-900">
      <div className="panel-header border-b">
        <Icon name="box" size={14} />
        Library
        <span className="ml-auto font-mono text-[10px] normal-case tracking-normal text-slate-600">
          {objectCount} in scene
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {CATEGORY_ORDER.map((cat) => (
          <section key={cat} className="mb-3">
            <h3 className={`mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest ${CATEGORY_ACCENT[cat]}`}>
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="flex flex-col gap-1">
              {CATALOG.filter((e) => e.category === cat).map((entry) => {
                const armed = placementType === entry.type;
                return (
                  <button
                    key={entry.type}
                    onClick={() => setPlacementType(entry.type)}
                    className={`group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      armed
                        ? 'border-accent-cyan/60 bg-accent-cyan/10'
                        : 'border-transparent bg-ink-800/60 hover:border-ink-600 hover:bg-ink-750'
                    }`}
                    title={`Click, then click in the scene to place ${entry.label}`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink-700 ${
                        armed ? 'text-accent-cyan' : 'text-slate-300 group-hover:text-accent-cyan'
                      }`}
                    >
                      <Icon name={OBJECT_ICONS[entry.type]} size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-200">{entry.label}</span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {armed ? 'Click in the scene to place…' : entry.hint}
                      </span>
                    </span>
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded transition-opacity ${
                        armed ? 'text-accent-cyan opacity-100' : 'text-slate-600 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Icon name="plus" size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="border-t border-ink-700/70 px-3 py-2 text-[10px] leading-relaxed text-slate-600">
        {placementType
          ? 'Click in the scene to place it — press Esc to cancel.'
          : 'Click an item, then click in the scene to place it. Drag the arrows to move a selected object.'}
      </div>
    </div>
  );
}
