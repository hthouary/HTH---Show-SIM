import { useState } from 'react';
import { useShowStore, selectSelectedEvent, selectSelectedObject } from '../../store/useShowStore';
import { CATALOG_BY_TYPE, isRiggable, isStructure } from '../../data/catalog';
import { ColorField, NumberField, SelectField, SliderField, Vec3Field } from '../ui/fields';
import { Icon } from '../ui/Icon';
import { EventEditor } from '../timeline/EventEditor';
import type { SceneObject, Vec3 } from '../../types/show';
import { useT } from '../../i18n/useT';

/** Rig-to-structure picker — clips a light / laser onto a truss so it follows it. */
function RigField({ object }: { object: SceneObject }) {
  const structures = useShowStore((s) => s.project.objects.filter((o) => isStructure(o.type)));
  const attach = useShowStore((s) => s.attachToParent);
  const t = useT();
  if (!isRiggable(object.type) || structures.length === 0) return null;
  return (
    <div className="border-t border-ink-700/70 pt-3">
      <SelectField
        label={t('rig.label')}
        value={object.parent ?? ''}
        options={[{ value: '', label: t('rig.none') }, ...structures.map((s) => ({ value: s.id, label: s.name }))]}
        onChange={(v) => attach(object.id, v || null)}
      />
    </div>
  );
}

/** Duplicate / array / mirror tools — operate on the whole current selection. */
function BuildTools() {
  const duplicateSelection = useShowStore((s) => s.duplicateSelection);
  const arraySelection = useShowStore((s) => s.arraySelection);
  const mirrorSelection = useShowStore((s) => s.mirrorSelection);
  const [count, setCount] = useState(4);
  const [step, setStep] = useState<Vec3>([2, 0, 0]);
  const t = useT();
  return (
    <div className="flex flex-col gap-2 border-t border-ink-700/70 pt-3">
      <div className="field-label">{t('tools.title')}</div>
      <div className="flex gap-2">
        <button className="btn flex-1" onClick={duplicateSelection}>
          <Icon name="copy" size={14} /> {t('tools.duplicate')}
        </button>
        <button className="btn flex-1" onClick={() => mirrorSelection('x')} title={t('tools.mirrorX.title')}>
          {t('tools.mirrorX')}
        </button>
        <button className="btn flex-1" onClick={() => mirrorSelection('z')} title={t('tools.mirrorZ.title')}>
          {t('tools.mirrorZ')}
        </button>
      </div>
      <div className="rounded-lg border border-ink-700/70 bg-ink-850 p-2">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t('tools.count')} value={count} min={2} max={50} step={1} onChange={(n) => setCount(Math.round(n))} />
        </div>
        <div className="mt-2">
          <Vec3Field label={t('tools.step')} value={step} step={0.5} onChange={setStep} />
        </div>
        <button className="btn mt-2 w-full" onClick={() => arraySelection(count, step)}>
          <Icon name="plus" size={14} /> {t('tools.create')}
        </button>
      </div>
    </div>
  );
}

/** Panel shown when 2+ objects are selected: align / distribute + build tools. */
function MultiInspector() {
  const ids = useShowStore((s) => s.selectedObjectIds);
  const anchorId = useShowStore((s) => s.selectedObjectId);
  const alignSelection = useShowStore((s) => s.alignSelection);
  const distributeSelection = useShowStore((s) => s.distributeSelection);
  const deleteObject = useShowStore((s) => s.deleteObject);
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ink-700 text-accent-cyan">
          <Icon name="box" size={16} />
        </span>
        <div className="text-sm font-medium text-slate-200">{t('multi.selected', { n: ids.length })}</div>
      </div>

      <div>
        <div className="field-label">{t('tools.align')}</div>
        <div className="grid grid-cols-3 gap-1.5">
          {(['X', 'Y', 'Z'] as const).map((ax, i) => (
            <button key={ax} className="btn" onClick={() => alignSelection(i as 0 | 1 | 2)}>
              {ax}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="field-label">{t('tools.distribute')}</div>
        <div className="grid grid-cols-2 gap-1.5">
          <button className="btn" onClick={() => distributeSelection(0)}>X</button>
          <button className="btn" onClick={() => distributeSelection(2)}>Z</button>
        </div>
      </div>

      <BuildTools />

      <button className="btn btn-danger" onClick={() => anchorId && deleteObject(anchorId)}>
        <Icon name="trash" size={14} /> {t('multi.deleteAll')}
      </button>
    </div>
  );
}

function ObjectInspector({ object }: { object: SceneObject }) {
  const update = useShowStore((s) => s.updateObject);
  const remove = useShowStore((s) => s.deleteObject);
  const duplicate = useShowStore((s) => s.duplicateObject);
  const entry = CATALOG_BY_TYPE[object.type];
  const t = useT();
  const set = (patch: Partial<SceneObject>) => update(object.id, patch);

  return (
    <div className="flex flex-col gap-4">
      {/* Identity */}
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ink-700 text-accent-cyan">
          <Icon name="box" size={16} />
        </span>
        <input
          className="input h-8 flex-1 font-medium"
          value={object.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div className="-mt-2 text-[11px] uppercase tracking-wider text-slate-500">{t(`obj.${object.type}.label`)}</div>

      <Vec3Field label={t('field.position')} value={object.position} onChange={(position) => set({ position })} />
      <Vec3Field
        label={t('field.rotation')}
        value={object.rotation}
        step={0.05}
        onChange={(rotation) => set({ rotation })}
      />

      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t('field.scale')} value={object.scale} step={0.05} min={0.05} onChange={(scale) => set({ scale })} />
        <SliderField label={t('field.intensity')} value={object.intensity} min={0} max={2} onChange={(intensity) => set({ intensity })} />
      </div>

      <ColorField label={t('field.color')} value={object.color} onChange={(color) => set({ color })} />

      {entry.emitsBeam && (
        <>
          <SliderField
            label={t('field.beamAngle')}
            value={object.beamAngle}
            min={1}
            max={60}
            step={1}
            onChange={(beamAngle) => set({ beamAngle })}
          />
          <Vec3Field label={t('field.target')} value={object.target} onChange={(target) => set({ target })} />
        </>
      )}

      <RigField object={object} />

      <BuildTools />

      <div className="mt-1 flex gap-2 border-t border-ink-700/70 pt-3">
        <button className="btn flex-1" onClick={() => duplicate(object.id)}>
          <Icon name="copy" size={14} /> {t('action.duplicate')}
        </button>
        <button className="btn btn-danger flex-1" onClick={() => remove(object.id)}>
          <Icon name="trash" size={14} /> {t('action.delete')}
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-ink-800 text-slate-600">
        <Icon name="target" size={22} />
      </span>
      <p className="text-sm font-medium text-slate-400">{t('inspector.emptyTitle')}</p>
      <p className="mt-1 text-xs text-slate-600">{t('inspector.emptyHint')}</p>
    </div>
  );
}

export function InspectorPanel() {
  const object = useShowStore(selectSelectedObject);
  const event = useShowStore(selectSelectedEvent);
  const multi = useShowStore((s) => s.selectedObjectIds.length > 1);
  const selectObject = useShowStore((s) => s.selectObject);
  const t = useT();

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-ink-700/70 bg-ink-900 md:w-[19rem]">
      <div className="panel-header border-b">
        <Icon name="target" size={14} />
        {t('inspector.title')}
        {(object || event) && (
          <button
            className="ml-auto grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-ink-700 hover:text-slate-200"
            title={t('inspector.deselect')}
            onClick={() => selectObject(null)}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {multi ? (
          <MultiInspector />
        ) : object ? (
          <ObjectInspector object={object} />
        ) : event ? (
          <EventEditor event={event} />
        ) : (
          <EmptyState />
        )}
      </div>
    </aside>
  );
}
