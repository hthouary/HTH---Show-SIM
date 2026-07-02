import { useRef, useState } from 'react';
import { useShowStore } from '../../store/useShowStore';
import { formatTime } from '../../utils/audio';
import { downloadProject } from '../../utils/project';
import { Icon } from '../ui/Icon';
import { LoadProjectModal } from './LoadProjectModal';
import { APP_VERSION } from '../../version';
import { useT } from '../../i18n/useT';

/** Build / Show mode switch — the app's primary workflow toggle. */
function ModeSwitch() {
  const appMode = useShowStore((s) => s.appMode);
  const setAppMode = useShowStore((s) => s.setAppMode);
  const t = useT();
  const modes = [
    { id: 'build' as const, icon: 'box' as const, label: t('mode.build') },
    { id: 'show' as const, icon: 'play' as const, label: t('mode.show') },
  ];
  return (
    <div className="flex items-center rounded-lg border border-ink-700 bg-ink-850 p-0.5" title={t('mode.title')}>
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => setAppMode(m.id)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            appMode === m.id ? 'bg-accent-cyan/20 text-accent-cyan' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon name={m.icon} size={13} filled={m.id === 'show'} />
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** EN / FR language switch. */
function LanguageSwitch() {
  const language = useShowStore((s) => s.language);
  const setLanguage = useShowStore((s) => s.setLanguage);
  const t = useT();
  return (
    <div className="flex items-center rounded-md border border-ink-700 bg-ink-850 p-0.5" title={t('topbar.language.title')}>
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLanguage(l)}
          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase transition-colors ${
            language === l ? 'bg-accent-cyan/20 text-accent-cyan' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

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
  const appMode = useShowStore((s) => s.appMode);
  const isPlaying = useShowStore((s) => s.isPlaying);
  const togglePlay = useShowStore((s) => s.togglePlay);
  const stop = useShowStore((s) => s.stop);
  const save = useShowStore((s) => s.saveCurrentProject);
  const newProject = useShowStore((s) => s.newProject);
  const importJSON = useShowStore((s) => s.importProjectJSON);
  const setProjectName = useShowStore((s) => s.setProjectName);
  const undo = useShowStore((s) => s.undo);
  const redo = useShowStore((s) => s.redo);
  const canUndo = useShowStore((s) => s.past.length > 0);
  const canRedo = useShowStore((s) => s.future.length > 0);
  const t = useT();

  const [showLoad, setShowLoad] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleNew = () => {
    if (confirm(t('topbar.newConfirm'))) newProject();
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
            {t('app.subtitle')} <span className="text-slate-700">· v{APP_VERSION}</span>
          </div>
        </div>
      </div>

      <div className="h-7 w-px bg-ink-700" />

      {/* Project actions */}
      <div className="flex items-center gap-1">
        <button className="btn-ghost" onClick={handleNew} title={t('topbar.new.title')}>
          <Icon name="file" size={15} /> {t('action.new')}
        </button>
        <button className="btn-ghost" onClick={save} title={t('topbar.save.title')}>
          <Icon name="save" size={15} /> {t('action.save')}
        </button>
        <button className="btn-ghost" onClick={() => setShowLoad(true)} title={t('topbar.load.title')}>
          <Icon name="folder" size={15} /> {t('action.load')}
        </button>
        <button className="btn-ghost" onClick={() => downloadProject(project)} title={t('topbar.export.title')}>
          <Icon name="download" size={15} /> {t('action.export')}
        </button>
        <button className="btn-ghost" onClick={() => importInputRef.current?.click()} title={t('topbar.import.title')}>
          <Icon name="upload" size={15} /> {t('action.import')}
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

        <div className="mx-1 h-6 w-px bg-ink-700" />
        <button className="btn-ghost w-8 px-0" onClick={undo} disabled={!canUndo} title={t('topbar.undo.title')}>
          <Icon name="undo" size={16} />
        </button>
        <button className="btn-ghost w-8 px-0" onClick={redo} disabled={!canRedo} title={t('topbar.redo.title')}>
          <Icon name="redo" size={16} />
        </button>
      </div>

      {/* Transport — centered (Show mode only; Build mode has no timeline) */}
      {appMode === 'show' ? (
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3">
          <button className="btn-ghost h-9 w-9 px-0" onClick={stop} title={t('topbar.stop.title')}>
            <Icon name="skip-back" size={16} />
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-accent-cyan text-ink-950 shadow-glow transition-transform hover:scale-105 active:scale-95"
            onClick={togglePlay}
            title={isPlaying ? t('topbar.pause.title') : t('topbar.play.title')}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={18} filled />
          </button>
          <TransportClock />
        </div>
      ) : (
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          <Icon name="box" size={14} className="text-accent-cyan" />
          {t('build.banner')}
        </div>
      )}

      {/* Mode switch + project name — right aligned */}
      <div className="ml-auto flex items-center gap-2">
        <ModeSwitch />
        <div className="h-6 w-px bg-ink-700" />
        <LanguageSwitch />
        <span className="text-[10px] uppercase tracking-widest text-slate-600">{t('topbar.project')}</span>
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
            title={t('topbar.rename.title')}
          >
            {project.name}
          </button>
        )}
      </div>

      {showLoad && <LoadProjectModal onClose={() => setShowLoad(false)} />}
    </header>
  );
}
