import type { BurstState, ShowState } from './events';

/**
 * Crowd "hype": a live 0..1 read of how exciting the show is right now, derived
 * from the current ShowState and the music level. Big synced moments (lasers +
 * flames + confetti on a loud drop) spike it; blackouts and dead air drop it.
 * The crowd reacts to it, a meter shows it, and its average over a run becomes
 * the end-of-show rating — turning "programming a show" into a game with a score.
 */

function burstEnergy(bucket: Record<string, BurstState>, weight: number): number {
  let m = 0;
  for (const k in bucket) {
    const b = bucket[k];
    const e = b.env * Math.min(1.5, b.intensity);
    if (e > m) m = e;
  }
  return m * weight;
}

/** Instantaneous hype target (unsmoothed) for a state + music level. */
export function computeHype(state: ShowState, level: number): number {
  let h = 0;
  // Base energy from the lights.
  h += Math.min(1, state.light.intensity / 1.4) * 0.26;
  if (state.light.strobing) h += 0.18;
  if (state.light.move.pattern !== 'fixed') h += 0.12;
  // Lasers and a pulsing wall lift the room.
  if (state.laser.active || Object.keys(state.laserActive).length > 0) h += 0.2;
  h += Math.min(0.18, state.led.pulse * 0.18);
  // FX bursts are the big "hits".
  h += burstEnergy(state.bursts.flame, 0.3);
  h += burstEnergy(state.bursts.co2, 0.24);
  h += burstEnergy(state.bursts.confetti, 0.32);
  h += burstEnergy(state.bursts.smoke, 0.07);
  // Music sync: a loud track lifts the ceiling and rewards hits on big moments.
  h *= 0.68 + level * 0.55;
  // A blackout kills the energy (tension before the next drop).
  h *= 1 - state.blackout * 0.85;
  return Math.max(0, Math.min(1, h));
}

class HypeMeter {
  /** Smoothed 0..1 hype (fast attack, slow release). */
  value = 0;
  private sum = 0;
  private samples = 0;
  peak = 0;

  update(target: number, dt: number, playing: boolean) {
    const rising = target > this.value;
    // Frame-rate independent smoothing.
    const rate = rising ? 9 : 2.2;
    this.value += (target - this.value) * (1 - Math.exp(-rate * dt));
    if (playing) {
      this.sum += this.value;
      this.samples += 1;
      if (this.value > this.peak) this.peak = this.value;
    }
  }

  /** Whether a run has accumulated enough to be worth scoring. */
  get scored(): boolean {
    return this.samples > 45;
  }

  get average(): number {
    return this.samples ? this.sum / this.samples : 0;
  }

  reset() {
    this.value = 0;
    this.sum = 0;
    this.samples = 0;
    this.peak = 0;
  }
}

export const hypeMeter = new HypeMeter();

/** Star rating (1..5) from an average hype score. */
export function hypeStars(score: number): number {
  if (score < 0.2) return 1;
  if (score < 0.34) return 2;
  if (score < 0.52) return 3;
  if (score < 0.7) return 4;
  return 5;
}
