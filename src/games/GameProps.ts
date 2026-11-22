import type { RawGamePerformance, StageConfig, WaveState } from '../types/cognitive';

export interface LiveMetrics {
  score: number;
  accuracyPct: number;
  combo: number;
  statusTag?: string;
}

export interface MinigameProps {
  config: StageConfig;
  wave: WaveState;
  finishRequested: boolean;
  onWaveHit: () => boolean;
  onLiveUpdate: (live: LiveMetrics) => void;
  onFinish: (perf: RawGamePerformance) => void;
}
