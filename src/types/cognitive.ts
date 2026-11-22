export type ThemeMode = 'minimal' | 'gamified';
export type PlanTier = 'free' | 'pro' | 'elite';
export type SessionMode = 'calibration' | 'guided' | 'free';

export type DomainKey =
  | 'selective_attention'
  | 'working_memory'
  | 'fluid_reasoning'
  | 'processing_speed'
  | 'numerical_cognition'
  | 'inhibitory_control';

export type GameSlug =
  | 'visual-search'
  | 'sustained-tracking'
  | 'spatial-span'
  | 'dual-n-back'
  | 'raven-matrices'
  | 'path-logic'
  | 'speed-match'
  | 'symbol-digit'
  | 'chain-arithmetic'
  | 'number-comparison'
  | 'stroop-conflict'
  | 'go-nogo-reflex';

export interface DomainMeta {
  key: DomainKey;
  shortName: string;
  name: string;
  color: string;
  calibrationGame: GameSlug;
}

export interface GameMeta {
  slug: GameSlug;
  domain: DomainKey;
  name: string;
  shortTip: string;
  durationSec: number;
}

export interface StageConfig {
  stage: number;
  durationSec: number;
  gridSize: number;          // 3 -> 4 -> 5 -> 6
  stimulusMs: number;        // 1500 -> 1100 -> 800 -> 600
  targetCount: number;       // alvos simultâneos / comprimento da sequência
  nBackLevel: number;        // 1 -> 2 -> 3
  reverseOrder: boolean;     // Matriz Espacial Reversa a partir da fase 3
  alternatingRule: boolean;  // Stroop / Trail Making alternado
  mathComplexity: 1 | 2 | 3 | 4;
  minAccuracyPct: number;    // 80% padrão
  scoreMultiplier: number;   // 1 + stage * 0.15
  roundsTarget: number;      // número de rodadas em jogos por turno
  easeBoost: boolean;        // modo mais leve ativado automaticamente após desempenho baixo na Fase 1
}

export type AdaptiveStatus = 'fast_track' | 'level_up' | 'hold' | 'step_down' | 'ease_mode';

export interface RawGamePerformance {
  correct: number;
  commissionErrors: number;  // erros impulsivos / cliques errados
  omissionErrors: number;    // erros por deixar passar / tempo esgotado
  reactionTimesMs: number[]; // medições via performance.now()
  rawPoints?: number;
}

export interface ComputedSessionResult {
  domain: DomainKey;
  gameSlug: GameSlug;
  mode: SessionMode;
  stagePlayed: number;
  stageCleared: boolean;
  nextStage: number;
  adaptiveDelta: number;     // +3, +2, +1, 0 ou -1
  adaptiveStatus: AdaptiveStatus;
  score: number;
  accuracyPct: number;
  commissionErrors: number;
  omissionErrors: number;
  rtMeanMs: number;
  rtSdMs: number;
  xpEarned: number;
  bonusXp: boolean;
  domainDelta: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  theme_preference: ThemeMode;
  plan_tier: PlanTier;
  global_cognitive_index: number;
  current_streak: number;
  best_streak: number;
  xp: number;
  calibrated: boolean;
  onboarding_answers: Record<string, string>;
  last_played_date: string | null;
  isLocalGuest?: boolean;
}

export interface DomainScoresRecord {
  user_id: string;
  selective_attention: number;
  working_memory: number;
  fluid_reasoning: number;
  processing_speed: number;
  numerical_cognition: number;
  inhibitory_control: number;
  baseline_scores: Partial<Record<DomainKey, number>>;
  updated_at: string;
}

export interface GameProgressRecord {
  game_slug: GameSlug;
  domain: DomainKey;
  current_stage: number;
  highest_score: number;
  total_plays: number;
  ease_mode?: boolean;
  updated_at: string;
}

export interface CognitiveSessionRecord {
  id: string;
  domain: DomainKey;
  game_slug: GameSlug;
  mode: SessionMode;
  stage_played: number;
  stage_cleared: boolean;
  score: number;
  accuracy_pct: number;
  commission_errors: number;
  omission_errors: number;
  rt_mean_ms: number;
  rt_sd_ms: number;
  created_at: string;
}

export interface DailyProtocolRecord {
  protocol_date: string;
  recommended_games: { slug: GameSlug; domain: DomainKey; role: 'weak' | 'maintenance' }[];
  completed_games: GameSlug[];
}
