import type { ThemeMode } from '../types/cognitive';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  setTheme(_theme: ThemeMode) {
    // Feedback sonoro discreto e preciso em ambos os modos (escuro e claro)
    this.enabled = true;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AudioCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  private tone(freq: number, dur = 0.07, type: OscillatorType = 'sine', vol = 0.05, delay = 0) {
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
    this.tone(420, 0.035, 'sine', 0.03);
  }

  hit(combo = 1) {
    const pitch = Math.min(860, 480 + combo * 34);
    this.tone(pitch, 0.07, 'sine', 0.055);
  }

  miss() {
    this.tone(190, 0.12, 'triangle', 0.05);
    this.tone(150, 0.12, 'triangle', 0.04, 0.06);
  }

  stageClear() {
    this.tone(523.25, 0.1, 'sine', 0.06, 0);
    this.tone(659.25, 0.1, 'sine', 0.06, 0.09);
    this.tone(783.99, 0.14, 'sine', 0.065, 0.18);
  }

  stageFail() {
    this.tone(330, 0.12, 'sine', 0.05, 0);
    this.tone(262, 0.18, 'sine', 0.05, 0.12);
  }
}

export const sound = new SoundEngine();
