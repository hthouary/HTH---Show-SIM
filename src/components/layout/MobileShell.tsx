import { useEffect, useRef, useState } from 'react';
import { useShowStore } from '../../store/useShowStore';
import { downloadProject } from '../../utils/project';
import { Icon, type IconName } from '../ui/Icon';
import { SceneViewport } from '../scene/SceneViewport';
import { LeftPanel } from './LeftPanel';
import { InspectorPanel } from '../inspector/InspectorPanel';
import { TimelinePanel } from '../timeline/TimelinePanel';
import { LoadProjectModal } from './LoadProjectModal';
import { APP_VERSION } from '../../version';
import { useT } from '../../i18n/useT';

type Tab = 'scene' | 'library' | 'timeline' | 'inspector';
type PanelTab = Exclude<Tab, 'scene'>;

const SHEET_HEIGHT: Record<PanelTab, string> = {
  library: '72dvh',
  inspector: '72dvh',
  timeline: '270px',
};

/** Language toggle (compact) for the mobile menu. */
function LanguageSwitch() {
  const language = useShowStore((s) => s.language);
  const setLanguage = useShowStore((s) => s.setLanguage);
  const t = useT();
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">{t('topbar.language.title')}</span>
      <div className="ml-auto flex items-center rounded-md border border-ink-700 bg-ink-850 p-0.5">
        {(['fr', 'en'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLanguage(l)}
            className={`rounded px-2.5 py-1 text-xs font-semibold uppercase ${
              language === l ? 'bg-accent-cyan/20 text-accent-cyan' : 'text-slate-500'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Dropdown menu with the file / history actions (mobile). */
function MobileMenu({ onClose, onLoad, onImport }: { onClose: () => void; onLoad: () => void; onImport: () => void }) {
  const project = useShowStore((s) => s.project);
  const save = useShowStore((s) => s.saveCurrentProject);
  const newProject = useShowStore((s) => s.newProject);
  const undo = useShowStore((s) => s.undo);
  const redo = useShowStore((s) => s.redo);
  const canUndo = useShowStore((s) => s.past.length > 0);
  const canRedo = useShowStore((s) => s.future.length > 0);
  const t = useT();

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const Item = ({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-ink-800 disabled:opacity-40"
    >
      <Icon name={icon} size={17} className="text-slate-400" />
      {label}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-2 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-2xl">
        <Item icon="file" label={t('action.new')} onClick={act(() => { if (confirm(t('topbar.newConfirm'))) newProject(); })} />
        <Item icon="save" label={t('action.save')} onClick={act(save)} />
        <Item icon="folder" label={t('action.load')} onClick={act(onLoad)} />
        <Item icon="download" label={t('action.export')} onClick={act(() => downloadProject(project))} />
        <Item icon="upload" label={t('action.import')} onClick={act(onImport)} />
        <div className="my-1 h-px bg-ink-700/70" />
        <Item icon="undo" label={t('action.undo')} onClick={act(undo)} disabled={!canUndo} />
        <Item icon="redo" label={t('action.redo')} onClick={act(redo)} disabled={!canRedo} />
        <div className="my-1 h-px bg-ink-700/70" />
        <div className="px-2 py-2">
          <LanguageSwitch />
        </div>
      </div>
    </>
  );
}

/** Compact top bar for phones. */
function MobileTopBar() {
  const project = useShowStore((s) => s.project);
  const isPlaying = useShowStore((s) => s.isPlaying);
  const togglePlay = useShowStore((s) => s.togglePlay);
  const stop = useShowStore((s) => s.stop);
  const importJSON = useShowStore((s) => s.importProjectJSON);
  const t = useT();
  const [menu, setMenu] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  return (
    <header
      className="relative z-30 flex shrink-0 items-center gap-2 border-b border-ink-700/70 bg-ink-900 px-3"
      style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: '3rem' }}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent-cyan to-accent-violet shadow-glow">
        <Icon name="bolt" size={17} filled className="text-ink-950" />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-semibold text-white">{project.name}</div>
        <div className="text-[9px] uppercase tracking-widest text-slate-600">ShowForge · v{APP_VERSION}</div>
      </div>

      <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 active:bg-ink-800" onClick={stop} title={t('topbar.stop.title')}>
        <Icon name="skip-back" size={18} />
      </button>
      <button
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-cyan text-ink-950 shadow-glow active:scale-95"
        onClick={togglePlay}
        title={isPlaying ? t('topbar.pause.title') : t('topbar.play.title')}
      >
        <Icon name={isPlaying ? 'pause' : 'play'} size={19} filled />
      </button>
      <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 active:bg-ink-800" onClick={() => setMenu((m) => !m)} title={t('nav.menu')}>
        <Icon name="menu" size={20} />
      </button>

      {menu && (
        <MobileMenu
          onClose={() => setMenu(false)}
          onLoad={() => setShowLoad(true)}
          onImport={() => importRef.current?.click()}
        />
      )}
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const reader = new FileReader();
            reader.onload = () => importJSON(String(reader.result));
            reader.readAsText(f);
          }
          e.target.value = '';
        }}
      />
      {showLoad && <LoadProjectModal onClose={() => setShowLoad(false)} />}
    </header>
  );
}

/** Sliding bottom sheet holding one of the panels. */
function BottomSheet({ open, height, onClose, children }: { open: boolean; height: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`absolute inset-x-0 bottom-0 z-20 ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`flex flex-col overflow-hidden rounded-t-2xl border-t border-ink-700 bg-ink-900 shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height }}
      >
        <div className="relative flex shrink-0 items-center justify-center py-1.5">
          <span className="h-1 w-10 rounded-full bg-ink-600" />
          <button className="absolute right-2 top-1 grid h-7 w-7 place-items-center rounded-lg text-slate-400 active:bg-ink-800" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/** Bottom navigation. */
function TabBar({ tab, onPick }: { tab: Tab; onPick: (t: Tab) => void }) {
  const t = useT();
  const tabs: { id: Tab; icon: IconName; label: string }[] = [
    { id: 'scene', icon: 'eye', label: t('nav.scene') },
    { id: 'library', icon: 'box', label: t('nav.library') },
    { id: 'timeline', icon: 'music', label: t('nav.timeline') },
    { id: 'inspector', icon: 'target', label: t('nav.inspector') },
  ];
  return (
    <nav
      className="z-30 flex shrink-0 items-stretch border-t border-ink-700/70 bg-ink-900"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tb) => {
        const active = tab === tb.id;
        return (
          <button
            key={tb.id}
            onClick={() => onPick(tb.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              active ? 'text-accent-cyan' : 'text-slate-500'
            }`}
          >
            <Icon name={tb.icon} size={20} />
            {tb.label}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Touch-first layout for phones: a full-screen 3D viewport with a compact top
 * bar and a bottom tab bar. The Library, Timeline and Inspector open as sliding
 * bottom sheets over the viewport, so the show stays visible while editing.
 */
export function MobileShell() {
  const [tab, setTab] = useState<Tab>('scene');
  const [panelTab, setPanelTab] = useState<PanelTab>('library');

  const placementType = useShowStore((s) => s.placementType);
  const selectedObjectId = useShowStore((s) => s.selectedObjectId);
  const selectedEventId = useShowStore((s) => s.selectedEventId);

  // Arming an object for placement drops back to the scene so the user can tap
  // the floor to drop it (the library sheet would otherwise cover the scene).
  useEffect(() => {
    if (placementType) setTab('scene');
  }, [placementType]);

  // Selecting an object (3D) or an event (timeline) opens the Inspector.
  useEffect(() => {
    if (selectedObjectId || selectedEventId) {
      setPanelTab('inspector');
      setTab('inspector');
    }
  }, [selectedObjectId, selectedEventId]);

  const pick = (nt: Tab) => {
    if (nt === 'scene' || nt === tab) {
      setTab('scene');
    } else {
      setPanelTab(nt);
      setTab(nt);
    }
  };

  const panel =
    panelTab === 'library' ? <LeftPanel /> : panelTab === 'inspector' ? <InspectorPanel /> : <TimelinePanel />;

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-ink-950">
      <MobileTopBar />

      <main className="relative min-h-0 flex-1">
        <SceneViewport />
        <BottomSheet open={tab !== 'scene'} height={SHEET_HEIGHT[panelTab]} onClose={() => setTab('scene')}>
          {panel}
        </BottomSheet>
      </main>

      <TabBar tab={tab} onPick={pick} />
    </div>
  );
}
