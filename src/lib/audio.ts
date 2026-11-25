import type { ThemeMode } from '../types/cognitive';

const MUTE_KEY = 'neurolab_sound_muted_v1';

// Escala pentatônica maior (Dó5 -> Dó6 -> Ré6 -> Mi6): som musical gostoso que sobe no combo!
const PENTATONIC_HZ = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  constructor() {
    try {
      this.muted = window.localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  setTheme(_theme: ThemeMode) {
    // Mantém o estado de mudo escolhido pelo usuário
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      window.localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // ignore storage errors
    }
    if (!this.muted) this.tap();
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
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

  /**
   * Nota estilo marimba/kalimba: ataque macio sem estalo + harmônico suave de oitava
   */
  private marimba(freq: number, dur = 0.16, vol = 0.08, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2, now);

    // Envelope suave (evita "click" seco e dá textura de madeira/cristal)
    gain1.gain.setValueAtTime(0.0005, now);
    gain1.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0006, now + dur);

    gain2.gain.setValueAtTime(0.0005, now);
    gain2.gain.linearRampToValueAtTime(vol * 0.22, now + 0.008);
    gain2.gain.exponentialRampToValueAtTime(0.0005, now + dur * 0.55);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(ctx.destination);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.01);
    osc2.stop(now + dur * 0.6 + 0.01);
  }

  /** Pop suave e tátil ao tocar em botões */
  tap() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.045);
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  /** Nota musical pentatônica que sobe gostosamente conforme o combo cresce */
  hit(combo = 1) {
    const idx = Math.max(0, Math.min(PENTATONIC_HZ.length - 1, combo - 1));
    const base = PENTATONIC_HZ[idx];
    this.marimba(base, 0.17, 0.085, 0);
    // Brilho extra em combos altos (4+)
    if (combo >= 4) {
      this.marimba(base * 1.25, 0.13, 0.04, 0.045);
    }
  }

  /** Som de erro abafado e educado (sem susto irritante) */
  miss() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(155, now + 0.14);
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  /** Fanfarra cristalina de conclusão (arpejo C5 -> E5 -> G5 -> C6) */
  stageClear() {
    this.marimba(523.25, 0.18, 0.075, 0);
    this.marimba(659.25, 0.18, 0.075, 0.085);
    this.marimba(783.99, 0.2, 0.08, 0.17);
    this.marimba(1046.5, 0.34, 0.09, 0.26);
  }

  /** Fechamento suave quando o tempo acaba */
  stageFail() {
    this.marimba(392.0, 0.18, 0.06, 0);
    this.marimba(329.63, 0.24, 0.055, 0.12);
  }
}

export const sound = new SoundEngine();
