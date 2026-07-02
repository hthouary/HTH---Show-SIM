import { useEffect } from 'react';
import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { BuildToolbar } from './BuildToolbar';
import { InspectorPanel } from '../inspector/InspectorPanel';
import { SceneViewport } from '../scene/SceneViewport';
import { TimelinePanel } from '../timeline/TimelinePanel';
import { MobileShell } from './MobileShell';
import { Toasts } from '../ui/Toasts';
import { usePlaybackClock } from '../../utils/usePlaybackClock';
import { useIsMobile } from '../../utils/useIsMobile';
import { useShowStore } from '../../store/useShowStore';

/** Desktop layout: top bar, left/center/right columns, and a mode-dependent
 *  bottom dock — the timeline in Show mode, the build toolbar in Build mode. */
function DesktopShell() {
  const buildMode = useShowStore((s) => s.appMode === 'build');
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <main className="relative min-w-0 flex-1">
          <SceneViewport />
        </main>
        <InspectorPanel />
      </div>
      {buildMode ? <BuildToolbar /> : <TimelinePanel />}
    </div>
  );
}

export function AppShell() {
  usePlaybackClock();
  const togglePlay = useShowStore((s) => s.togglePlay);
  const deleteObject = useShowStore((s) => s.deleteObject);
  const duplicateSelection = useShowStore((s) => s.duplicateSelection);
  const selectedObjectId = useShowStore((s) => s.selectedObjectId);
  const undo = useShowStore((s) => s.undo);
  const redo = useShowStore((s) => s.redo);
  const setGizmoMode = useShowStore((s) => s.setGizmoMode);

  // Restore the current project's saved audio track (best-effort) on first load.
  useEffect(() => {
    void useShowStore.getState().restoreAudio();
  }, []);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // Undo / redo work even without a specific focus (but not while typing).
      if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }
      // Ctrl / Cmd + D duplicates the current selection.
      if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        duplicateSelection();
        return;
      }

      if (typing) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        e.preventDefault();
        deleteObject(selectedObjectId);
      }
      if (e.key === 'w' || e.key === 'W') setGizmoMode('translate');
      if (e.key === 'e' || e.key === 'E') setGizmoMode('rotate');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, deleteObject, duplicateSelection, selectedObjectId, undo, redo, setGizmoMode]);

  const isMobile = useIsMobile();

  return (
    <>
      {isMobile ? <MobileShell /> : <DesktopShell />}
      <Toasts />
    </>
  );
}
