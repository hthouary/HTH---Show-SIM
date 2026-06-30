import { useEffect } from 'react';
import { TopBar } from './TopBar';
import { ObjectLibrary } from '../library/ObjectLibrary';
import { InspectorPanel } from '../inspector/InspectorPanel';
import { SceneViewport } from '../scene/SceneViewport';
import { TimelinePanel } from '../timeline/TimelinePanel';
import { Toasts } from '../ui/Toasts';
import { usePlaybackClock } from '../../utils/usePlaybackClock';
import { useShowStore } from '../../store/useShowStore';

export function AppShell() {
  usePlaybackClock();
  const togglePlay = useShowStore((s) => s.togglePlay);
  const deleteObject = useShowStore((s) => s.deleteObject);
  const selectedObjectId = useShowStore((s) => s.selectedObjectId);

  // Global keyboard shortcuts: Space = play/pause, Delete = remove selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      if (typing) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        e.preventDefault();
        deleteObject(selectedObjectId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, deleteObject, selectedObjectId]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ObjectLibrary />
        <main className="relative min-w-0 flex-1">
          <SceneViewport />
        </main>
        <InspectorPanel />
      </div>
      <TimelinePanel />
      <Toasts />
    </div>
  );
}
