export type ThemeMode = 'dark' | 'light';
export type PlanTier = 'free' | 'pro' | 'elite';
export type SessionMode = 'calibration' | 'guided' | 'free';
export type TrainingFocusMode = 'weak' | 'goals';
export type AgeBracket = '18-24' | '25-34' | '35-44' | '45-54' | '55+';

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
  | 'odd-one-out'
  | 'flanker-focus'
  | 'conjunction-search'
  | 'spatial-span'
  | 'dual-n-back'
  | 'memory-pairs'
  | 'photo-recall'
  | 'reverse-digits'
  | 'raven-matrices'
  | 'path-logic'
  | 'number-sequence'
  | 'logic-intruder'
  | 'logic-balance'
  | 'speed-match'
  | 'symbol-digit'
  | 'schulte-order'
  | 'flash-match'
  | 'quick-pair'
  | 'chain-arithmetic'
  | 'number-comparison'
  | 'target-sum'
  | 'missing-operator'
  | 'quick-estimate'
  | 'stroop-conflict'
  | 'go-nogo-reflex'
  | 'opposite-arrow'
  | 'rule-switch'
  | 'inverted-signal';

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
  stage: number;             // effectiveDifficulty = baseStage + (currentWave - 1)
  durationSec: number;
  gridSize: number;          // 3 -> 4 -> 5 -> 6
  stimulusMs: number;        // 1800 -> 1400 -> 1000 -> 580
  targetCount: number;       // alvos simultâneos / comprimento da sequência
  nBackLevel: number;        // 1 -> 2 -> 3
  reverseOrder: boolean;     // Matriz Espacial Reversa a partir de dificuldade >= 3
  alternatingRule: boolean;  // Stroop / Trail Making alternado
  mathComplexity: 1 | 2 | 3 | 4;
  minAccuracyPct: number;    // 80% padrão
  scoreMultiplier: number;
  roundsTarget: number;
  easeBoost: boolean;
}

export interface WaveState {
  baseStage: number;
  currentWave: number;       // 1..5
  waveHits: number;          // acertos na onda atual (0..waveQuota)
  waveQuota: number;         // cota da onda atual (2, 3, 3, 4, 4)
  wavesCompleted: number;    // 0..5
  totalHits: number;         // 0..16
  totalTargetHits: number;   // 16
  effectiveDifficulty: number;
  isCleared: boolean;
}

export type AdaptiveStatus = 'fast_track' | 'level_up' | 'hold' | 'step_down' | 'ease_mode';

export interface CognitiveTier {
  tierIndex: number;   // 1..7
  title: string;
  subtitle: string;
  minScore: number;
  accentColor: string;
}

export interface RawGamePerformance {
  correct: number;
  commissionErrors: number;
  omissionErrors: number;
  reactionTimesMs: number[];
  rawPoints?: number;
}

export interface ComputedSessionResult {
  domain: DomainKey;
  gameSlug: GameSlug;
  mode: SessionMode;
  stagePlayed: number;       // baseStage jogado
  stageCleared: boolean;
  nextStage: number;
  adaptiveDelta: number;     // +2, +1, 0 ou -1
  adaptiveStatus: AdaptiveStatus;
  score: number;             // 0..1000
  accuracyPct: number;       // 0..100
  accuracyPoints: number;    // 0..600 (60%)
  speedPoints: number;       // 0..400 (40%)
  earlyBonusPoints: number;  // pontos extras de tempo economizado incluídos em speedPoints
  speedScore: number;        // 0..100
  performanceIndex: number;  // 0..100 (%)
  percentile: number;        // 1.0..99.9
  earnedTitle: string;
  earnedSubtitle: string;
  tierAccent: string;
  wavesCompleted: number;    // 0..5
  waveReached: number;       // 1..5
  completedEarly: boolean;
  timeRemainingMs: number;
  commissionErrors: number;
  omissionErrors: number;
  rtMeanMs: number;
  rtSdMs: number;
  isPriorityDomain: boolean;
  domainDelta: number;
  rawLevelScore?: number;    // 0..1000 dentro do nível jogado (sem corte do teto global)
  targetRtMs?: number;       // tempo-alvo esperado do exercício + nível + faixa etária
  hits?: number;
  targetHits?: number;
}

export interface OnboardingProfileData {
  goals: string[];
  selected_domains: DomainKey[];
  daily_goal_minutes: 5 | 10 | 15 | 20;
  peak_time: string;
  bottlenecks: string[];
  bottleneck_domains: DomainKey[];
  mental_stamina_baseline: number; // 1..5
  application_context: string;
  application_contexts: string[];
  age_bracket: AgeBracket;
  startCalibrationNow?: boolean;
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
  calibrated: boolean;
  calibration_skipped?: boolean;
  selected_domains: DomainKey[];
  daily_goal_minutes: number;
  peak_time: string | null;
  cognitive_bottlenecks: string[];
  mental_stamina_baseline: number;
  application_context: string | null;
  application_contexts: string[];
  age_bracket: AgeBracket;
  current_title: string;
  onboarding_answers: Record<string, unknown>;
  last_played_date: string | null;
  isLocalGuest?: boolean;
  isAdmin?: boolean;
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
  accuracy_points: number;
  speed_points: number;
  percentile: number;
  earned_title: string;
  waves_completed: number;
  completed_early: boolean;
  time_remaining_ms: number;
  commission_errors: number;
  omission_errors: number;
  rt_mean_ms: number;
  rt_sd_ms: number;
  created_at: string;
}

export interface DailyProtocolRecord {
  protocol_date: string;
  recommended_games: { slug: GameSlug; domain: DomainKey; role: 'weak' | 'priority' | 'maintenance' }[];
  completed_games: GameSlug[];
}

export interface CognitiveSnapshotRecord {
  id: string;
  snapshot_date: string; // YYYY-MM-DD
  global_index: number;
  domain_scores_json: Record<DomainKey, number>;
  avg_rt_ms: number;
  avg_accuracy: number;
  archetype_title: string;
  created_at: string;
}

export interface BenchmarkDistribution {
  mean: number;
  sd: number;
  p50: number;
  p75: number;
  p90: number;
  p99: number;
  avg_rt_ms?: number;
  early_rate_pct?: number;
}

export interface PopulationBenchmarks {
  source: 'population' | 'normative';
  sample_sessions: number;
  distinct_users: number;
  global: BenchmarkDistribution;
  domains: Record<DomainKey, BenchmarkDistribution>;
  games: Record<GameSlug, BenchmarkDistribution>;
}

export interface ClinicalMetricsSummary {
  avgRtMs: number;
  rtDeltaMs: number | null; // negativo = ficou mais rápido
  consistencyIndex: number; // 0..100
  consistencyDelta: number | null;
  avgRtSdMs: number;
  avgAccuracyPct: number;
  impulsivityPerSession: number;
  earlyClearRatePct: number;
  totalSessions: number;
}

export interface GameMasterySummary {
  slug: GameSlug;
  domain: DomainKey;
  currentStage: number;
  highestScore: number;
  totalPlays: number;
  bestWave: number; // 0..5
  bestRemainingMs: number;
  percentile: number; // 1.0..99.9
  topPercent: number; // 1..99 (ex: Top 4%)
  earlyClearRatePct: number;
  avgScore: number;
  sparkline: { idx: number; score: number; waves: number; dateLabel: string }[];
}

export interface CognitiveDossier {
  archetypeTitle: string;
  archetypeSubtitle: string;
  archetypeColor: string;
  topDomains: [DomainKey, DomainKey];
  bottleneckDomain: DomainKey;
  recommendedGame: GameSlug;
  globalPercentile: number;
  topPercent: number;
  populationBand: 'Ápice (Top 1%)' | 'Elite (Top 10%)' | 'Acima da Média (Top 25%)' | 'Média Geral (50%)' | 'Em Evolução';
  paragraphs: {
    profileAndStrengths: string;
    behaviorUnderPressure: string;
    bottleneckAndPrescription: string;
  };
  clinical: ClinicalMetricsSummary;
  shareSummaryText: string;
}
