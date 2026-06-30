/**
 * AudioEngine — a thin wrapper around the Web Audio API + an HTMLAudioElement.
 *
 * The HTMLAudioElement gives us easy play / pause / seek / duration, while an
 * AnalyserNode taps the signal so the LED screen and lights can react to the
 * music level. A single shared instance is exported as `audioEngine`.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private el: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private objectUrl: string | null = null;

  /** True once a file has been loaded successfully. */
  hasAudio = false;
  /** Smoothed 0..1 overall level, updated by sampleLevel(). */
  level = 0;
  /** Normalised waveform peaks (0..1) for the loaded file, for the timeline. */
  peaks: number[] = [];

  private ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  /** Load an audio File (from an <input type=file>). Returns the duration. */
  async load(file: File): Promise<number> {
    this.dispose();
    const ctx = this.ensureContext();
    const url = URL.createObjectURL(file);
    this.objectUrl = url;

    const el = new Audio();
    el.src = url;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    this.el = el;

    const source = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    this.source = source;
    this.analyser = analyser;
    this.freq = new Uint8Array(analyser.frequencyBinCount);

    const duration = await new Promise<number>((resolve, reject) => {
      el.addEventListener(
        'loadedmetadata',
        () => resolve(Number.isFinite(el.duration) ? el.duration : 0),
        { once: true },
      );
      el.addEventListener('error', () => reject(new Error('Failed to decode audio file')), {
        once: true,
      });
    });

    // Decode a copy to extract a real waveform (best-effort).
    await this.computePeaks(file);

    this.hasAudio = true;
    return duration;
  }

  private async computePeaks(file: File, buckets = 240): Promise<void> {
    try {
      const data = await file.arrayBuffer();
      const audioBuf = await this.ensureContext().decodeAudioData(data.slice(0));
      const ch = audioBuf.getChannelData(0);
      const block = Math.max(1, Math.floor(ch.length / buckets));
      const peaks: number[] = [];
      let max = 0.0001;
      for (let i = 0; i < buckets; i++) {
        let peak = 0;
        const start = i * block;
        for (let j = 0; j < block; j++) {
          const v = Math.abs(ch[start + j] || 0);
          if (v > peak) peak = v;
        }
        peaks.push(peak);
        if (peak > max) max = peak;
      }
      this.peaks = peaks.map((p) => p / max);
    } catch {
      this.peaks = [];
    }
  }

  async play() {
    if (!this.el) return;
    await this.ensureContext().resume();
    await this.el.play().catch(() => undefined);
  }

  pause() {
    this.el?.pause();
  }

  seek(time: number) {
    if (this.el && Number.isFinite(time)) {
      try {
        this.el.currentTime = Math.max(0, time);
      } catch {
        /* ignore seeks before metadata is ready */
      }
    }
  }

  get currentTime(): number {
    return this.el?.currentTime ?? 0;
  }

  get duration(): number {
    return this.el && Number.isFinite(this.el.duration) ? this.el.duration : 0;
  }

  /** Sample the analyser and update `level`. Call once per animation frame. */
  sampleLevel(): number {
    if (!this.analyser) {
      // Decay toward zero when there is no audio.
      this.level *= 0.9;
      return this.level;
    }
    this.analyser.getByteFrequencyData(this.freq);
    let sum = 0;
    // Weight the low / mid bands a little more — that is where the "energy" is.
    const n = Math.min(this.freq.length, 48);
    for (let i = 0; i < n; i++) sum += this.freq[i];
    const avg = sum / (n * 255);
    // Smooth attack, slower release.
    this.level = avg > this.level ? avg : this.level * 0.85 + avg * 0.15;
    return this.level;
  }

  /** Release the audio graph and any object URL. */
  dispose() {
    this.pause();
    try {
      this.source?.disconnect();
      this.analyser?.disconnect();
    } catch {
      /* noop */
    }
    if (this.el) {
      this.el.src = '';
      this.el.load();
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.el = null;
    this.source = null;
    this.analyser = null;
    this.hasAudio = false;
    this.level = 0;
    this.peaks = [];
  }
}

export const audioEngine = new AudioEngine();

/** Format seconds as M:SS.t for the transport display. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);
  return `${m}:${s.toString().padStart(2, '0')}.${tenths}`;
}
