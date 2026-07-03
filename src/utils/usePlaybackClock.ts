import { useEffect } from 'react';
import { useShowStore } from '../store/useShowStore';
import { audioEngine } from './audio';

/**
 * Drives the global playback clock with a single requestAnimationFrame loop.
 *
 * When audio is loaded the clock follows the audio element; otherwise it runs a
 * virtual clock so the demo show plays without any audio file. The analyser
 * level is also sampled here so the rest of the app can read `audioEngine.level`.
 * Mounted once, near the app root.
 */
export function usePlaybackClock() {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      // Clamp the delta so a dropped frame / tab stall can't jump the show.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      const s = useShowStore.getState();
      audioEngine.sampleLevel();

      if (s.isPlaying) {
        let next: number;
        if (s.hasAudio) {
          next = audioEngine.currentTime;
        } else {
          next = s.currentTime + dt;
        }

        if (next >= s.duration) {
          // Reached the end: stop on the last frame + post the crowd rating.
          s.setCurrentTime(s.duration);
          s.finishShow();
        } else {
          s.setCurrentTime(next);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
