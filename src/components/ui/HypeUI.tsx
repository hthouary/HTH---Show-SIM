import { useEffect, useRef } from 'react';
import { useShowStore } from '../../store/useShowStore';
import { hypeMeter, hypeStars } from '../../utils/hype';
import { Icon } from './Icon';
import { useT } from '../../i18n/useT';

/**
 * Live crowd-hype meter. Reads the shared hypeMeter singleton on its own rAF and
 * writes straight to the DOM (no React re-renders), so it stays buttery during
 * playback. Shown over the viewport in Show mode.
 */
export function HypeMeter() {
  const fillRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLSpanElement>(null);
  const t = useT();

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = hypeMeter.value;
      if (fillRef.current) {
        fillRef.current.style.width = `${Math.round(v * 100)}%`;
        const hue = 205 - v * 205; // blue (calm) → red (wild)
        fillRef.current.style.background = `linear-gradient(90deg, hsl(200 85% 55%), hsl(${hue} 92% 55%))`;
      }
      if (emojiRef.current) emojiRef.current.textContent = v > 0.75 ? '🤯' : v > 0.5 ? '🔥' : v > 0.28 ? '🙌' : '🙂';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 w-64 max-w-[70vw] -translate-x-1/2">
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-300">
        <span>{t('hype.label')}</span>
        <span ref={emojiRef}>🙂</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-ink-700/70 bg-ink-900/70 backdrop-blur">
        <div ref={fillRef} className="h-full w-0 rounded-full" style={{ transition: 'width 0.09s linear' }} />
      </div>
    </div>
  );
}

/** End-of-show rating card (stars + hype summary), posted when a run finishes. */
export function ShowResultCard() {
  const result = useShowStore((s) => s.showResult);
  const clear = useShowStore((s) => s.clearShowResult);
  const seek = useShowStore((s) => s.seek);
  const play = useShowStore((s) => s.play);
  const t = useT();
  if (!result) return null;

  const stars = hypeStars(result.score);
  const replay = () => {
    clear();
    seek(0);
    setTimeout(() => play(), 40);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={clear}>
      <div
        className="w-[22rem] max-w-[92vw] rounded-2xl border border-ink-700 bg-ink-900 p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] uppercase tracking-widest text-slate-500">{t('hype.showComplete')}</div>
        <div className="my-3 flex justify-center gap-1.5 text-[28px] leading-none">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={i < stars ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'opacity-20'}>
              ⭐
            </span>
          ))}
        </div>
        <div className="text-lg font-bold text-white">{t(`hype.rating.${stars}`)}</div>
        <div className="mt-2 text-xs text-slate-400">
          {t('hype.avg')}: <span className="font-mono text-slate-200">{Math.round(result.score * 100)}%</span> ·{' '}
          {t('hype.peak')}: <span className="font-mono text-slate-200">{Math.round(result.peak * 100)}%</span>
        </div>
        <div className="mt-5 flex gap-2">
          <button className="btn btn-accent flex-1 justify-center" onClick={replay}>
            <Icon name="play" size={14} filled /> {t('hype.replay')}
          </button>
          <button className="btn flex-1 justify-center" onClick={clear}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
