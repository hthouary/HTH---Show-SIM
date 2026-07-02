import { useShowStore } from '../../store/useShowStore';
import { Icon, type IconName } from '../ui/Icon';
import { useT } from '../../i18n/useT';

/** A labelled on/off chip used throughout the build toolbar. */
function Chip({
  active,
  onClick,
  icon,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: IconName;
  label: string;
  title: string;
}) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
        active
          ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan'
          : 'border-ink-700/70 bg-ink-850 text-slate-400 hover:text-slate-200'
      }`}
    >
      <Icon name={icon} size={13} />
      <span className="font-medium">{label}</span>
      <span className={active ? 'text-accent-cyan/70' : 'text-slate-600'}>{active ? t('state.on') : t('state.off')}</span>
    </button>
  );
}

const GRID_SIZES = [0.25, 0.5, 1, 2];

/**
 * The construction control bar (shown in Build mode in place of the timeline).
 * Toggles the build grid, grid-snapping, magnetic object-to-object snapping and
 * collisions — the toolkit for assembling a clean, believable stage.
 */
export function BuildToolbar() {
  const showGrid = useShowStore((s) => s.showGrid);
  const toggleGrid = useShowStore((s) => s.toggleGrid);
  const gridSnap = useShowStore((s) => s.gridSnap);
  const toggleGridSnap = useShowStore((s) => s.toggleGridSnap);
  const gridSize = useShowStore((s) => s.gridSize);
  const setGridSize = useShowStore((s) => s.setGridSize);
  const magnet = useShowStore((s) => s.magnet);
  const toggleMagnet = useShowStore((s) => s.toggleMagnet);
  const collisions = useShowStore((s) => s.collisions);
  const toggleCollisions = useShowStore((s) => s.toggleCollisions);
  const objectCount = useShowStore((s) => s.project.objects.length);
  const t = useT();

  return (
    <section className="flex h-16 shrink-0 items-center gap-3 overflow-x-auto border-t border-ink-700/70 bg-ink-900 px-3">
      <div className="flex shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon name="box" size={14} className="text-accent-cyan" /> {t('build.title')}
      </div>

      <div className="h-7 w-px shrink-0 bg-ink-700" />

      <Chip active={showGrid} onClick={toggleGrid} icon="grid" label={t('build.grid')} title={t('build.grid.title')} />
      <Chip active={gridSnap} onClick={toggleGridSnap} icon="grid" label={t('build.gridSnap')} title={t('build.gridSnap.title')} />

      {/* Grid cell size */}
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-ink-700/70 bg-ink-850 p-0.5" title={t('build.gridSize.title')}>
        <span className="px-1 text-[10px] uppercase tracking-wider text-slate-500">{t('build.gridSize')}</span>
        {GRID_SIZES.map((g) => (
          <button
            key={g}
            onClick={() => setGridSize(g)}
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
              gridSize === g ? 'bg-accent-cyan/20 text-accent-cyan' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <Chip active={magnet} onClick={toggleMagnet} icon="magnet" label={t('build.magnet')} title={t('build.magnet.title')} />
      <Chip active={collisions} onClick={toggleCollisions} icon="box" label={t('toggle.collisions')} title={t('toggle.collisions.title')} />

      <div className="ml-auto flex shrink-0 items-center gap-2 text-[10px] text-slate-600">
        <span className="hidden lg:inline">{t('build.hint')}</span>
        <span className="rounded bg-ink-800 px-2 py-1 font-mono text-slate-500">{t('library.count', { n: objectCount })}</span>
      </div>
    </section>
  );
}
