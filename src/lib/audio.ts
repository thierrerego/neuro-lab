import type { ThemeMode } from '../types/cognitive';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  setTheme(theme: ThemeMode) {
    this.enabled = theme === 'gamified';
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtor();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(freq: number, dur = 0.08, type: OscillatorType = 'triangle', vol = 0.07, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  tap() {
    this.tone(420, 0.04, 'sine', 0.04);
  }

  hit(combo = 1) {
    const pitch = Math.min(980, 480 + combo * 42);
    this.tone(pitch, 0.08, 'triangle', 0.08);
  }

  miss() {
    this.tone(185, 0.14, 'sawtooth', 0.065);
    this.tone(145, 0.14, 'sawtooth', 0.05, 0.07);
  }

  stageClear() {
    this.tone(523.25, 0.11, 'triangle', 0.08, 0);
    this.tone(659.25, 0.11, 'triangle', 0.08, 0.09);
    this.tone(783.99, 0.14, 'triangle', 0.09, 0.18);
    this.tone(1046.5, 0.24, 'triangle', 0.09, 0.28);
  }

  stageFail() {
    this.tone(330, 0.14, 'sine', 0.07, 0);
    this.tone(262, 0.2, 'sine', 0.07, 0.13);
  }
}

export const sound = new SoundEngine();
