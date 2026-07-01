import { useShowStore } from '../../store/useShowStore';
import { CATALOG_BY_TYPE } from '../../data/catalog';
import type { LibraryCategory } from '../../types/show';
import { Icon } from '../ui/Icon';
import { OBJECT_ICONS } from '../library/ObjectLibrary';
import { useT } from '../../i18n/useT';

const ORDER: LibraryCategory[] = ['stage', 'lights', 'fx'];
const ACCENT: Record<LibraryCategory, string> = {
  stage: 'text-slate-400',
  lights: 'text-accent-cyan',
  fx: 'text-accent-magenta',
};

/** Scene tree: list every object to select / hide / duplicate / delete it. */
export function Outliner() {
  const objects = useShowStore((s) => s.project.objects);
  const selectedId = useShowStore((s) => s.selectedObjectId);
  const selectObject = useShowStore((s) => s.selectObject);
  const deleteObject = useShowStore((s) => s.deleteObject);
  const duplicateObject = useShowStore((s) => s.duplicateObject);
  const updateObject = useShowStore((s) => s.updateObject);
  const t = useT();

  return (
    <div className="flex h-[42%] shrink-0 flex-col border-t border-ink-700/70 bg-ink-900">
      <div className="panel-header border-b">
        <Icon name="box" size={14} />
        {t('outliner.title')}
        <span className="ml-auto font-mono text-[10px] normal-case tracking-normal text-slate-600">
          {t('outliner.count', { n: objects.length })}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {objects.length === 0 && (
          <div className="px-2 py-4 text-center text-[11px] text-slate-600">{t('outliner.empty')}</div>
        )}
        {ORDER.map((cat) => {
          const items = objects.filter((o) => CATALOG_BY_TYPE[o.type].category === cat);
          if (items.length === 0) return null;
          return (
            <section key={cat} className="mb-2">
              <h4 className={`mb-1 px-1 text-[9px] font-bold uppercase tracking-widest ${ACCENT[cat]}`}>
                {t(`category.${cat}`)}
              </h4>
              <div className="flex flex-col">
                {items.map((o) => {
                  const active = o.id === selectedId;
                  return (
                    <div
                      key={o.id}
                      onClick={() => selectObject(o.id)}
                      className={`group flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs ${
                        active ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-slate-300 hover:bg-ink-800'
                      } ${o.hidden ? 'opacity-45' : ''}`}
                    >
                      <Icon name={OBJECT_ICONS[o.type]} size={13} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{o.name}</span>
                      <button
                        className="shrink-0 rounded p-0.5 text-slate-500 opacity-0 hover:text-white group-hover:opacity-100"
                        title={o.hidden ? t('outliner.show') : t('outliner.hide')}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateObject(o.id, { hidden: !o.hidden });
                        }}
                      >
                        <Icon name="eye" size={13} />
                      </button>
                      <button
                        className="shrink-0 rounded p-0.5 text-slate-500 opacity-0 hover:text-accent-cyan group-hover:opacity-100"
                        title={t('action.duplicate')}
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateObject(o.id);
                        }}
                      >
                        <Icon name="copy" size={12} />
                      </button>
                      <button
                        className="shrink-0 rounded p-0.5 text-slate-500 opacity-0 hover:text-rose-300 group-hover:opacity-100"
                        title={t('action.delete')}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteObject(o.id);
                        }}
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
