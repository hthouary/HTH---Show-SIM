import { useRef } from 'react';
import type { ShowEvent } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
import { eventCategory } from '../../data/catalog';
import { Modal } from '../ui/Modal';
import { SliderField } from '../ui/fields';
import { Icon } from '../ui/Icon';
import { useT } from '../../i18n/useT';

const W = 380;
const H = 200;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Draw a custom moving-head path. The box centre is the beam's rest aim; the
 * drawn curve is traced over time, tilted by the inclination and repeated
 * (loop or back-and-forth) for the length of the action.
 */
export function CustomMovementModal({ event, onClose }: { event: ShowEvent; onClose: () => void }) {
  const update = useShowStore((s) => s.updateEvent);
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const pts = useRef<number[][]>([]);

  const params = event.params;
  const isLaser = eventCategory(event.type) === 'lasers';
  const path: number[][] = Array.isArray(params.path) ? (params.path as number[][]) : [];
  const numP = (k: string, d: number) => (typeof params[k] === 'number' ? (params[k] as number) : d);
  const tilt = numP('tilt', 90);
  const cycle = numP('cycle', 2);
  const speed = numP('speed', 50);
  const amp = numP('amp', 50);
  const count = numP('count', 40);
  const spacing = numP('spacing', 3);
  const repeat = params.repeat === 'pingpong' ? 'pingpong' : 'loop';

  const set = (patch: Record<string, unknown>) => update(event.id, { params: { ...event.params, ...patch } });

  const norm = (e: React.PointerEvent): number[] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  };
  const onDown = (e: React.PointerEvent) => {
    drawing.current = true;
    pts.current = [norm(e)];
    set({ path: [...pts.current] });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = norm(e);
    const last = pts.current[pts.current.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.015) {
      pts.current.push(p);
      if (pts.current.length > 300) pts.current.shift();
      set({ path: [...pts.current] });
    }
  };
  const onUp = () => {
    drawing.current = false;
  };

  const poly = path.map((p) => `${p[0] * W},${p[1] * H}`).join(' ');

  return (
    <Modal title={t('custom.title')} onClose={onClose} width={440}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-slate-500">{t('custom.hint')}</p>

        {/* Draw box */}
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none select-none rounded-lg border border-ink-600 bg-ink-950"
            style={{ height: H, cursor: 'crosshair', touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {/* Everything drawn is decorative: pointer-events none routes every
                touch to the <svg> itself (touch-action: none), so the finger can
                pass over the line / dots without the popup starting to scroll. */}
            <g style={{ pointerEvents: 'none' }}>
              {/* grid + centre (rest aim) */}
              <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#1e2836" strokeWidth={1} />
              <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#1e2836" strokeWidth={1} />
              {path.length > 1 && <polyline points={poly} fill="none" stroke="#22d3ee" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
              {path.length > 0 && <circle cx={path[0][0] * W} cy={path[0][1] * H} r={4} fill="#39ff14" />}
              {path.length > 1 && <circle cx={path[path.length - 1][0] * W} cy={path[path.length - 1][1] * H} r={4} fill="#f43f5e" />}
            </g>
          </svg>
          <button
            className="btn absolute right-2 top-2 h-6 px-2 text-[11px]"
            onClick={() => {
              pts.current = [];
              set({ path: [] });
            }}
          >
            <Icon name="trash" size={12} /> {t('custom.clear')}
          </button>
        </div>

        {/* Direction (0..360) */}
        <div>
          <SliderField label={t('custom.tilt')} value={tilt} min={0} max={360} step={5} onChange={(v) => set({ tilt: v })} />
          <div className="mt-0.5 text-[10px] text-slate-600">{t('custom.tiltHint')}</div>
        </div>

        {isLaser ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SliderField label={t('field.speed')} value={speed} min={0} max={100} step={1} onChange={(v) => set({ speed: v })} />
              <SliderField label={t('custom.spacing')} value={spacing} min={0} max={100} step={1} onChange={(v) => set({ spacing: v })} />
            </div>
            <SliderField label={t('custom.count')} value={count} min={1} max={500} step={1} onChange={(v) => set({ count: Math.round(v) })} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SliderField label={t('custom.cycle')} value={cycle} min={0.5} max={20} step={0.5} onChange={(v) => set({ cycle: v })} />
              <SliderField label={t('field.speed')} value={speed} min={0} max={100} step={1} onChange={(v) => set({ speed: v })} />
            </div>
            <SliderField label={t('custom.amp')} value={amp} min={0} max={100} step={1} onChange={(v) => set({ amp: v })} />

            <div>
              <div className="field-label">{t('custom.repeat')}</div>
              <div className="flex gap-2">
                {(['loop', 'pingpong'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => set({ repeat: r })}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${
                      repeat === r ? 'border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan' : 'border-ink-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t(`custom.${r}`)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <button className="btn btn-accent mt-1" onClick={onClose}>
          {t('custom.done')}
        </button>
      </div>
    </Modal>
  );
}
