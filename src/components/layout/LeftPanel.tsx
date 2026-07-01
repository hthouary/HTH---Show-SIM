import { ObjectLibrary } from '../library/ObjectLibrary';
import { Outliner } from '../outliner/Outliner';

/** Left column: the object Library on top, the scene Outliner underneath. */
export function LeftPanel() {
  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-ink-700/70 bg-ink-900 md:w-60">
      <ObjectLibrary />
      <Outliner />
    </aside>
  );
}
