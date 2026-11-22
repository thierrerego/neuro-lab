import type { RawGamePerformance, StageConfig } from '../types/cognitive';

export interface LiveMetrics {
  score: number;
  accuracyPct: number;
  combo: number;
  statusTag?: string;
}

export interface MinigameProps {
  config: StageConfig;
  finishRequested: boolean;
  onLiveUpdate: (live: LiveMetrics) => void;
  onFinish: (perf: RawGamePerformance) => void;
}
