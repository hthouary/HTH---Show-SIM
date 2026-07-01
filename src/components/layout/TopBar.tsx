import { useRef, useState } from 'react';
import { useShowStore } from '../../store/useShowStore';
import { formatTime } from '../../utils/audio';
import { downloadProject } from '../../utils/project';
import { Icon } from '../ui/Icon';
import { LoadProjectModal } from './LoadProjectModal';
import { APP_VERSION } from '../../version';

/** Isolated so the per-frame time update only re-renders this tiny node. */
function TransportClock() {
  const currentTime = useShowStore((s) => s.currentTime);
  const duration = useShowStore((s) => s.duration);
  return (
    <div className="flex items-baseline gap-1.5 font-mono">
      <span className="text-base font-semibold text-accent-cyan tabular-nums">{formatTime(currentTime)}</span>
      <span className="text-xs text-slate-600">/</span>
      <span className="text-xs text-slate-500 tabular-nums">{formatTime(duration)}</span>
    </div>
  );
}

export function TopBar() {
  const project = useShowStore((s) => s.project);
  const isPlaying = useShowStore((s) => s.isPlaying);
  const togglePlay = useShowStore((s) => s.togglePlay);
  const stop = useShowStore((s) => s.stop);
  const save = useShowStore((s) => s.saveCurrentProject);
  const newProject = useShowStore((s) => s.newProject);
  const importJSON = useShowStore((s) => s.importProjectJSON);
  const setProjectName = useShowStore((s) => s.setProjectName);

  const [showLoad, setShowLoad] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleNew = () => {
    if (confirm('Start a new empty project? Unsaved changes will be lost.')) newProject();
  };

  const handleImport = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importJSON(String(reader.result));
    reader.readAsText(file);
  };

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-ink-700/70 bg-ink-900 px-3">
      {/* Brand */}
      <div className="flex items-center gap-2 pr-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent-cyan to-accent-violet shadow-glow">
          <Icon name="bolt" size={18} filled className="text-ink-950" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-white">
            ShowForge <span className="text-accent-cyan">Studio</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-600">
            3D Show Designer <span className="text-slate-700">· v{APP_VERSION}</span>
          </div>
        </div>
      </div>

      <div className="h-7 w-px bg-ink-700" />

      {/* Project actions */}
      <div className="flex items-center gap-1">
        <button className="btn-ghost" onClick={handleNew} title="New project">
          <Icon name="file" size={15} /> New
        </button>
        <button className="btn-ghost" onClick={save} title="Save to browser">
          <Icon name="save" size={15} /> Save
        </button>
        <button className="btn-ghost" onClick={() => setShowLoad(true)} title="Load saved project">
          <Icon name="folder" size={15} /> Load
        </button>
        <button className="btn-ghost" onClick={() => downloadProject(project)} title="Export JSON file">
          <Icon name="download" size={15} /> Export
        </button>
        <button className="btn-ghost" onClick={() => importInputRef.current?.click()} title="Import JSON file">
          <Icon name="upload" size={15} /> Import
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            handleImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {/* Transport — centered */}
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3">
        <button className="btn-ghost h-9 w-9 px-0" onClick={stop} title="Stop & rewind">
          <Icon name="skip-back" size={16} />
        </button>
        <button
          className="grid h-10 w-10 place-items-center rounded-full bg-accent-cyan text-ink-950 shadow-glow transition-transform hover:scale-105 active:scale-95"
          onClick={togglePlay}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={18} filled />
        </button>
        <TransportClock />
      </div>

      {/* Project name — right aligned */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-600">Project</span>
        {editingName ? (
          <input
            autoFocus
            className="input h-8 w-52"
            defaultValue={project.name}
            onBlur={(e) => {
              setProjectName(e.target.value.trim() || 'Untitled Show');
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingName(false);
            }}
          />
        ) : (
          <button
            className="max-w-[14rem] truncate rounded-md px-2 py-1 text-sm font-semibold text-slate-100 hover:bg-ink-700"
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {project.name}
          </button>
        )}
      </div>

      {showLoad && <LoadProjectModal onClose={() => setShowLoad(false)} />}
    </header>
  );
}
