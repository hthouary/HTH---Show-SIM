import { useRef, useState } from 'react';
import { useShowStore } from '../../store/useShowStore';
import { SNAP_DIVISIONS } from '../../utils/beat';
import { Icon } from '../ui/Icon';
import { useT } from '../../i18n/useT';

const DIV_KEY: Record<number, string> = { 4: 'div.bar', 1: 'div.beat', 0.5: 'div.half', 0.25: 'div.quarter' };

/** Tempo + grid controls for the timeline: BPM, tap-tempo, snap and grid. */
export function BpmControls() {
  const bpm = useShowStore((s) => s.project.settings.bpm ?? 120);
  const setBpm = useShowStore((s) => s.setBpm);
  const snapEnabled = useShowStore((s) => s.snapEnabled);
  const toggleSnap = useShowStore((s) => s.toggleSnap);
  const snapDivision = useShowStore((s) => s.snapDivision);
  const setSnapDivision = useShowStore((s) => s.setSnapDivision);
  const showBeatGrid = useShowStore((s) => s.showBeatGrid);
  const toggleBeatGrid = useShowStore((s) => s.toggleBeatGrid);
  const t = useT();

  const [buf, setBuf] = useState(String(bpm));
  const taps = useRef<number[]>([]);

  const commitBpm = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) setBpm(n);
  };

  const tap = () => {
    const now = performance.now();
    const arr = taps.current;
    if (arr.length && now - arr[arr.length - 1] > 2000) arr.length = 0;
    arr.push(now);
    if (arr.length > 8) arr.shift();
    if (arr.length >= 2) {
      let sum = 0;
      for (let i = 1; i < arr.length; i++) sum += arr[i] - arr[i - 1];
      const avg = sum / (arr.length - 1);
      const next = Math.round(60000 / avg);
      if (next >= 40 && next <= 300) {
        setBpm(next);
        setBuf(String(next));
      }
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* BPM */}
      <div className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-850 px-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">BPM</span>
        <input
          data-bpm="true"
          type="number"
          className="w-11 bg-transparent py-1 text-xs text-slate-200 outline-none"
          value={buf}
          min={40}
          max={300}
          onChange={(e) => {
            setBuf(e.target.value);
            commitBpm(e.target.value);
          }}
          onBlur={() => setBuf(String(bpm))}
        />
      </div>

      <button className="btn h-7 px-2" onClick={tap} title={t('bpm.tap.title')}>
        {t('bpm.tap')}
      </button>

      {/* Snap toggle */}
      <button
        onClick={toggleSnap}
        className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition-colors ${
          snapEnabled
            ? 'border-accent-cyan/40 bg-accent-cyan/15 text-accent-cyan'
            : 'border-ink-600 text-slate-400 hover:text-slate-200'
        }`}
        title={t('bpm.snap.title')}
      >
        <Icon name="magnet" size={13} /> {t('bpm.snap')}
      </button>

      {/* Snap division */}
      <select
        className="h-7 rounded-md border border-ink-700 bg-ink-850 px-1 text-xs text-slate-300 outline-none disabled:opacity-40"
        value={snapDivision}
        disabled={!snapEnabled}
        onChange={(e) => setSnapDivision(parseFloat(e.target.value))}
        title={t('bpm.div.title')}
      >
        {SNAP_DIVISIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {t(DIV_KEY[d.value] ?? d.label)}
          </option>
        ))}
      </select>

      {/* Grid toggle */}
      <button
        onClick={toggleBeatGrid}
        className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition-colors ${
          showBeatGrid
            ? 'border-accent-cyan/40 bg-accent-cyan/15 text-accent-cyan'
            : 'border-ink-600 text-slate-400 hover:text-slate-200'
        }`}
        title={t('bpm.grid.title')}
      >
        <Icon name="grid" size={13} /> {t('bpm.grid')}
      </button>
    </div>
  );
}
