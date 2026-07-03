/**
 * Procedural sound effects (Web Audio, no asset files). Adds "juice" to the
 * show: the hiss of CO2, the woomph of a flame jet, the flutter of confetti,
 * and — the big one — a crowd cheer that erupts when the hype spikes on a drop.
 * A dedicated AudioContext (separate from the music engine) resumed on the first
 * play gesture. All one-shots; nothing loops beyond its envelope.
 */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastCheer = -10;
  /** Global on/off (mirrors the UI Sound toggle). */
  enabled = true;

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Resume the context — call from a user gesture (play). */
  resume() {
    try {
      void this.ensure().resume();
    } catch {
      /* ignore */
    }
  }

  private buf(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const len = Math.floor(ctx.sampleRate * 1.5);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    return b;
  }

  /** A filtered noise burst (hiss / whoosh / flutter). */
  private hiss(freq: number, q: number, dur: number, gain: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.buf(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** A low sine "woomph" / impact sweep. */
  private boom(f0: number, f1: number, dur: number, gain: number) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  co2() {
    if (!this.enabled) return;
    this.hiss(3200, 1.1, 0.55, 0.34);
    this.boom(220, 80, 0.22, 0.12);
  }

  flame() {
    if (!this.enabled) return;
    this.boom(95, 42, 0.5, 0.34);
    this.hiss(900, 0.7, 0.4, 0.14, 'highpass');
  }

  confetti() {
    if (!this.enabled) return;
    this.hiss(2600, 1, 0.3, 0.18);
    this.boom(340, 180, 0.12, 0.14);
  }

  /** Crowd roar on a big moment (rate-limited so drops don't machine-gun it). */
  cheer(level = 1) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    if (t - this.lastCheer < 3) return;
    this.lastCheer = t;
    const src = ctx.createBufferSource();
    src.buffer = this.buf(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(680, t);
    f.frequency.linearRampToValueAtTime(1300, t + 0.4);
    f.Q.value = 0.6;
    const g = ctx.createGain();
    const dur = 1.5;
    const peak = 0.22 * Math.min(1, level + 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.35);
    g.gain.setValueAtTime(peak, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
}

export const sfx = new Sfx();
