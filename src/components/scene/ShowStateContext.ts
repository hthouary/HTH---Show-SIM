import { createContext, useContext, type MutableRefObject } from 'react';
import type { ShowState } from '../../utils/events';
import { evaluateEvents } from '../../utils/events';

/**
 * The live show-state is computed once per frame in StageScene and shared with
 * every fixture through this ref. Children read `ref.current` inside their own
 * useFrame, so the heavy 3D never triggers React re-renders during playback.
 */
export type ShowStateRef = MutableRefObject<ShowState>;

export const ShowStateContext = createContext<ShowStateRef>({
  current: evaluateEvents([], 0),
});

export function useShowStateRef(): ShowStateRef {
  return useContext(ShowStateContext);
}
