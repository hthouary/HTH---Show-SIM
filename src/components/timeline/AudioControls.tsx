import { useRef } from 'react';
import { useShowStore } from '../../store/useShowStore';
import { Icon } from '../ui/Icon';

/** Audio import + status, shown in the timeline header. */
export function AudioControls() {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadAudio = useShowStore((s) => s.loadAudioFile);
  const clearAudio = useShowStore((s) => s.clearAudio);
  const hasAudio = useShowStore((s) => s.hasAudio);
  const audioName = useShowStore((s) => s.project.settings.audioName);

  return (
    <div className="flex items-center gap-2">
      <button className="btn" onClick={() => inputRef.current?.click()} title="Import an audio file">
        <Icon name="music" size={14} /> Import Audio
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadAudio(f);
          e.target.value = '';
        }}
      />
      {hasAudio && audioName && (
        <div className="flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-[11px] text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
          <span className="max-w-[12rem] truncate">{audioName}</span>
          <button className="text-slate-500 hover:text-rose-300" onClick={clearAudio} title="Remove audio">
            <Icon name="close" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
